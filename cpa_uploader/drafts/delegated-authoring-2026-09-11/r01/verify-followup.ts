/** R01 static and historical-evidence checks only. This file never calls a model. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateQuestionSetV3 } from '../../../../lib/questionV3.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { draftConflicts, readPendingDrafts } from '../../../questionDraftInventory.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
import { prepareSemanticReview, semanticReceiptIntegrityErrors } from '../../../questionSemanticReview.ts';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/r01');
const old=path.resolve('cpa_uploader/drafts/frequency-priority-2026-09-10');
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f:string,value:unknown)=>fs.writeFileSync(path.join(base,f),JSON.stringify(value,null,2)+'\n');
const lineage=read(path.join(base,'lineage.json')).sets;
const sets:QuestionSetV3[]=lineage.map((item:{actual_file:string})=>read(item.actual_file));
const bank:QuestionSetV3[]=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const initial:QuestionSetV3[]=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json');
const peers=[...initial.filter(s=>!sets.some(candidate=>candidate.id===s.id)),...sets];
const errors:string[]=[];
const perSet:any[]=[];
for(const item of lineage) {
  const set=sets.find(s=>s.id===item.set_id)!;
  const validation=validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()});
  errors.push(...validation.errors.map(e=>`${set.id}: ${e}`));
  const plan=read(item.plan_file).plans[0];
  const planErrors=validateQuestionAuthoringPlan(plan);
  errors.push(...planErrors.map(e=>`${set.id}: ${e}`));
  const qa=read(item.qa_file);
  const qaErrors:string[]=[];
  if(qa.draft_sha256!==sha(item.actual_file))qaErrors.push('QA file hash differs from candidate');
  for(const c of qa.cases) {
    const q=set.subquestions.find(q=>q.id===c.subquestion_id);
    if(!q){qaErrors.push(`${c.id}: no subquestion`);continue;}
    if(c.expected_verdicts.length!==q.criteria.length || new Set(c.expected_verdicts.map((v:any)=>v.criterion_id)).size!==q.criteria.length)qaErrors.push(`${c.id}: criterion coverage`);
    let sum=0;
    for(const verdict of c.expected_verdicts) {
      const criterion=q.criteria.find(x=>x.id===verdict.criterion_id);
      if(!criterion || !['met','not_met','contradicted'].includes(verdict.verdict)){qaErrors.push(`${c.id}: invalid verdict`);continue;}
      if(verdict.verdict==='met')sum+=criterion.max_points;
    }
    if(sum!==c.expected_points)qaErrors.push(`${c.id}: expected total`);
  }
  errors.push(...qaErrors.map(e=>`${set.id}: ${e}`));
  const past=read(path.join(old,`${set.id}.json`));
  const receiptFile=path.join(old,'semantic-review/engine-final',`${set.id}.review.json`);
  const receipt=read(receiptFile).reviews[0];
  const gradedFile=path.join(old,'semantic-review/engine-final',`${set.id}.graded.json`);
  const graded=fs.existsSync(gradedFile)?read(gradedFile).reviews[0]:null;
  let prepared:any=null,preparationError:null|string=null;
  try {const p=prepareSemanticReview(set,{bank:peers,authoringPlan:plan});prepared={request_chars:p.requestChars,content_hash:p.contentHash,bank_hash:p.bankHash,source_files:p.sourceFiles,
    registered_official_sources:(p.context.source_metadata as any[]).every((x:any)=>x.registered_sources.some((s:any)=>s.authority==='official_transcription'))};} catch(e){preparationError=String(e);}
  perSet.push({plan_id:item.plan_id,set_id:set.id,static_errors:validation.errors,plan_errors:planErrors,qa_errors:qaErrors,qa_cases:qa.cases.length,
    historical:{receipt_file:path.relative(process.cwd(),receiptFile).replaceAll('\\','/'),receipt_sha256:sha(receiptFile),verdict:receipt.verdict,
      integrity_errors:semanticReceiptIntegrityErrors(receipt,false),original_content_hash_matches:receipt.content_hash===reviewedContentHash(past),
      final_candidate_content_matches:receipt.content_hash===reviewedContentHash(set),has_graded_receipt:!!graded,
      graded_integrity_errors:graded?semanticReceiptIntegrityErrors(graded,true):null,source_files_still_match:receipt.source_files.every((s:any)=>fs.existsSync(s.file)&&sha(s.file)===s.sha256),
      reuse:'당시 기록과 무결성은 보존. 새 사례연도·출처경로·계획·후속 명제 및 최종 비교은행이 달라 최종 receipt로 직접 재사용하지 않음.'},
    review_preparation:prepared,review_preparation_error:preparationError});
}
const conflictErrors=draftConflicts(sets,initial.filter(s=>!sets.some(candidate=>candidate.id===s.id)));
errors.push(...conflictErrors);
const combined=validateAuthoringBank([...bank,...sets]);
errors.push(...combined.errors);
let inventoryIds:string[]=[];
try {inventoryIds=readPendingDrafts(process.cwd(),base).filter(s=>sets.some(x=>x.id===s.id)).map(s=>s.id);if(inventoryIds.length!==6 || new Set(inventoryIds).size!==6)errors.push('R01 auto inventory duplicated or missing');}catch(e){errors.push(String(e));}
const originalPreserved=lineage.every((x:any)=>sha(x.predecessor)===x.predecessor_sha256);
if(!originalPreserved)errors.push('Historical original changed');
const result={created_at:new Date().toISOString(),phase:'static_only',model_calls:0,sets:sets.length,questions:sets.reduce((n,s)=>n+s.subquestions.length,0),points:perSet.reduce((n,s)=>n+sets.find(x=>x.id===s.set_id)!.subquestions.reduce((a,q)=>a+q.criteria.reduce((a,c)=>a+c.max_points,0),0),0),
  qa_cases:perSet.reduce((n,s)=>n+s.qa_cases,0),errors,originals_preserved:originalPreserved,inventory_ids:inventoryIds,per_set:perSet,
  caveats:['QA 검사는 기대판정의 형상·정수합계 검사이며 실제 채점이 아니다.','준비용 비교본은 최종 고정 비교은행이 아니다.','의미검수 preparation은 API를 호출하지 않는다.']};
write('static-check.json',result);
console.log(JSON.stringify({sets:result.sets,questions:result.questions,points:result.points,qa:result.qa_cases,errors:result.errors,preparation:perSet.map(x=>({id:x.set_id,error:x.review_preparation_error,official:x.review_preparation?.registered_official_sources}))}));
if(errors.length)process.exitCode=1;
