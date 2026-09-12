import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateQuestionSetV3,type QuestionSetV3} from '../../../../lib/questionV3.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
import {prepareSemanticReview} from '../../../questionSemanticReview.ts';
import {draftConflicts} from '../../../questionDraftInventory.ts';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';

const dir='cpa_uploader/drafts/delegated-authoring-2026-09-11/s05';
const name=process.argv[2];
if(!name||path.basename(name)!==name)throw Error('새 검증 파일 이름 필요');
const output=path.join(dir,name);
if(fs.existsSync(output))throw Error('이전 검증 보존');
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ledger=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json');
const active=new Map<string,QuestionSetV3>(read('cpa_uploader/data/cpa_question_sets_v3.authoring.json').map((s:QuestionSetV3)=>[s.id,s]));
for(const entry of ledger.entries){
 if(!fs.existsSync(entry.output_directory))continue;
 for(const name of fs.readdirSync(entry.output_directory)){
  if(!name.endsWith('.json'))continue;
  const raw=read(path.join(entry.output_directory,name));
  for(const set of Array.isArray(raw)?raw:[raw])if(set?.id===entry.set_id&&Array.isArray(set.subquestions))active.set(set.id,set);
 }
}
const manifest=read(path.join(dir,'lineage.json'));
const catalog=buildSourceCatalog();
const rows=manifest.entries.map((entry:any)=>{
 const set=read(entry.file) as QuestionSetV3;
 const plan=read(entry.plan_file).plans[0];
 const qa=read(entry.qa_file);
 const errors=[...validateQuestionSetV3(set,{cwd:process.cwd(),verifySourceQuotes:true}).errors,...validateQuestionAuthoringPlan(plan)];
 for(const ref of set.source_refs){
  const unit=catalog.units.find(u=>u.id===ref.id);
  if(!unit||unit.file!==ref.file||!unit.quote.includes(ref.source_quote))errors.push(`실제 source ID/quote 불일치 ${ref.id}`);
 }
 const prepared=prepareSemanticReview(set,{bank:[...active.values()],authoringPlan:plan,maxInputChars:400000});
 const request=JSON.stringify(prepared.requestContext);
 for(const ref of set.source_refs)if(!request.includes(JSON.stringify(ref.source_quote).slice(1,-1)))errors.push(`모델입력 source 누락 ${ref.id}`);
 const chunks=prepared.units.map(unit=>JSON.stringify({...prepared.requestContext as any,target_unit:unit.id,
  reference_catalog:{fields:unit.fields,sources:prepared.sources.filter(s=>unit.sources.includes(s.source_ref_id)).map(s=>({id:s.source_ref_id,quote:s.declared_metadata.source_quote}))}}).length);
 if(chunks.some(n=>n>400000))errors.push('chunk 입력 한도 초과');
 return {...entry,current_file_sha256:sha(entry.file),current_plan_sha256:sha(entry.plan_file),current_qa_sha256:sha(entry.qa_file),qa_cases:qa.cases.length,
  errors,context_chars:prepared.requestChars,max_chunk_chars:Math.max(...chunks),bank_hash:prepared.bankHash,content_hash:prepared.contentHash};
});
const own=manifest.entries.map((e:any)=>read(e.file)) as QuestionSetV3[];
const other=[...active.values()].filter(s=>!own.some(c=>c.id===s.id));
const domain=validateAuthoringBank([...other,...own]);
const errors=[...domain.errors,...draftConflicts(own,other),...rows.flatMap((r:any)=>r.errors)];
const report={created_at:new Date().toISOString(),stage:'static_only',model_calls:0,sets:rows.length,questions:rows.reduce((n:number,r:any)=>n+r.questions,0),points:rows.reduce((n:number,r:any)=>n+r.points,0),qa_cases:rows.reduce((n:number,r:any)=>n+r.qa_cases,0),comparison_sets:active.size,errors,rows};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sets:report.sets,questions:report.questions,points:report.points,qa_cases:report.qa_cases,comparison_sets:report.comparison_sets,errors}));
if(errors.length)process.exitCode=1;
