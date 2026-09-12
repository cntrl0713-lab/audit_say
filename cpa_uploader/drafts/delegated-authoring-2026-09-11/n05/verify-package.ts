/** N05 static checks only. No API calls or permanent bank writes. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateQuestionSetV3,type QuestionSetV3} from '../../../../lib/questionV3.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {draftConflicts,readPendingDrafts} from '../../../questionDraftInventory.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
import {prepareSemanticReview} from '../../../questionSemanticReview.ts';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/n05');
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lineage=read(path.join(base,'lineage.json')).sets;
const sets:QuestionSetV3[]=lineage.map((x:any)=>read(x.actual_file));
const bank:QuestionSetV3[]=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const initial:QuestionSetV3[]=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json');
const catalog=buildSourceCatalog();
const errors:string[]=[];
const perSet:any[]=[];
const peerBank=[...initial,...sets];
for(const entry of lineage){
 const set=sets.find(s=>s.id===entry.set_id)!;
 const validation=validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()});
 errors.push(...validation.errors.map(x=>`${set.id}: ${x}`));
 const plan=read(entry.plan_file).plans[0];
 const planErrors=validateQuestionAuthoringPlan(plan);
 for(const id of plan.source_unit_ids)if(!catalog.units.some(u=>u.id===id))planErrors.push(`Missing catalog ID ${id}`);
 errors.push(...planErrors.map(x=>`${set.id}: ${x}`));
 const qa=read(entry.qa_file),qaErrors:string[]=[];
 if(qa.draft_sha256!==sha(entry.actual_file))qaErrors.push('QA candidate hash mismatch');
 if(new Set(qa.cases.map((c:any)=>c.id)).size!==qa.cases.length)qaErrors.push('Duplicate QA ID');
 for(const c of qa.cases){
  const q=set.subquestions.find(q=>q.id===c.subquestion_id);
  if(!q){qaErrors.push(`Unknown question ${c.id}`);continue;}
  if(c.expected_verdicts.length!==q.criteria.length||new Set(c.expected_verdicts.map((v:any)=>v.criterion_id)).size!==q.criteria.length)qaErrors.push(`Missing/duplicate verdict ${c.id}`);
  let total=0;
  for(const v of c.expected_verdicts){const criterion=q.criteria.find(x=>x.id===v.criterion_id);if(!criterion||!['met','not_met','contradicted'].includes(v.verdict))qaErrors.push(`Invalid verdict ${c.id}`);else if(v.verdict==='met')total+=criterion.max_points;}
  if(total!==c.expected_points)qaErrors.push(`Wrong expected total ${c.id}`);
 }
 errors.push(...qaErrors.map(e=>`${set.id}: ${e}`));
 let prepared:any=null,preparationError:string|null=null;
 try{const p=prepareSemanticReview(set,{bank:peerBank,authoringPlan:plan});prepared={request_chars:p.requestChars,content_hash:p.contentHash,bank_hash:p.bankHash,source_files:p.sourceFiles,official_sources:(p.context.source_metadata as any[]).every(x=>x.registered_sources.some((r:any)=>r.authority==='official_transcription'))};}catch(e){preparationError=String(e);}
 // Phase 1 separates a complete static draft from a runtime input-budget gate.
 if(preparationError&&!preparationError.includes('예산'))errors.push(`${set.id}: ${preparationError}`);
 perSet.push({plan_id:entry.plan_id,set_id:set.id,static_errors:validation.errors,static_warnings:validation.warnings,plan_errors:planErrors,qa_errors:qaErrors,points:validation.max_points,qa_cases:qa.cases.length,review_preparation:prepared,preparation_error:preparationError});
}
errors.push(...draftConflicts(sets,initial));
errors.push(...validateAuthoringBank([...bank,...sets]).errors);
let inventoryIds:string[]=[];
try{inventoryIds=readPendingDrafts(process.cwd(),base).filter(s=>sets.some(x=>x.id===s.id)).map(s=>s.id);if(inventoryIds.length!==2||new Set(inventoryIds).size!==2)errors.push('N05 inventory duplicates/missing');}catch(e){errors.push(String(e));}
const ledger:any=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json');
const rows:any[]=Object.values(ledger).find(Array.isArray) as any[];
for(const s of lineage){const row=rows.find(x=>x.plan_id===s.plan_id);if(!row||row.set_id!==s.set_id||row.package!=='N05')errors.push(`Ledger mismatch ${s.plan_id}`);}
const result={created_at:new Date().toISOString(),phase:'static_only',model_calls:0,sets:sets.length,questions:sets.reduce((n,s)=>n+s.subquestions.length,0),points:perSet.reduce((n,s)=>n+s.points,0),qa_cases:perSet.reduce((n,s)=>n+s.qa_cases,0),errors,review_preparation_issues:perSet.filter(s=>s.preparation_error).map(s=>({set_id:s.set_id,error:s.preparation_error})),inventory_ids:inventoryIds,per_set:perSet,bank_sha256:sha('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),limitations:['작성자 QA의 형상·정수합계 검사이며 실제 채점이 아니다.','현재 111개 준비용 비교은행에 N05를 추가한 검사이며 전체49개 최종 비교은행 검사와 다르다.','source_refs와 plan을 통한 수동 의미검수 입력 준비이다. 자동 생성 source packet 완결성을 주장하지 않는다.','review_preparation_issues의 입력 예산 실패는 별도 실행 게이트이다. 이를 정적 errors에서 구별하며 모델검수 준비 완료로 보고하지 않는다.']};
fs.writeFileSync(path.join(base,'static-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({sets:result.sets,questions:result.questions,points:result.points,qa:result.qa_cases,errors,preparation:perSet.map(s=>({set_id:s.set_id,error:s.preparation_error,official:s.review_preparation?.official_sources,chars:s.review_preparation?.request_chars}))}));
if(errors.length)process.exitCode=1;
