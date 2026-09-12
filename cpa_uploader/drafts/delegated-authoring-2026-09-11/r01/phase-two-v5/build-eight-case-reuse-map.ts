// Explicit original-QA mapping for targeted v4 observations outside common filename padding.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildGradingPrompt,buildGradingResponseSchema,gradingModelName} from '../../../../../lib/questionV3Grading.ts';
const dir=path.dirname(fileURLToPath(import.meta.url)),control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const sha=(f:string)=>hash(fs.readFileSync(f));
const lockFile=control+'/runtime-v5-bank-v3/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file);
const priorFile=path.join(dir,'../phase-two-v4/reuse-index.json'),prior=read(priorFile);
const normalize=(c:any)=>({id:c.id,subquestion_id:c.subquestion_id,answer:c.answer,expected_points:c.expected_points,expected_verdicts:[...c.expected_verdicts].map(v=>({criterion_id:v.criterion_id,verdict:v.verdict})).sort((a,b)=>a.criterion_id.localeCompare(b.criterion_id))});
const graderFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3Answer.ts','lib/questionV3.ts','lib/ai/openaiStructured.ts',control+'/run-author-qa.ts'];
const grader=graderFiles.map(file=>{const r=lock.code_files.find((r:any)=>r.file===file),old=prior.source_and_code_guard.find((r:any)=>r.file===file);if(!r||r.sha256!==old?.sha256||sha(file)!==r.sha256)throw Error('Grader changed '+file);return r;});
const entries:any[]=[];
for(const previous of prior.entries){
 const e=manifest.entries.find((e:any)=>e.plan_id===previous.plan_id),doc=read(e.file),set=Array.isArray(doc)?doc[0]:doc,qa=read(e.qa_file);
 if(sha(e.file)!==e.sha256||sha(e.qa_file)!==e.qa_sha256||e.sha256!==previous.candidate_sha256||e.qa_sha256!==previous.original_qa_sha256)throw Error('Question/QA changed');
 for(const c of previous.cases){
  const current=qa.cases.find((q:any)=>q.id===c.case_id);if(!current)throw Error('Missing current case');
  const observations=c.observations.map((o:any)=>{
   const r=read(o.file);if(sha(o.file)!==o.sha256||r.error||r.transport!=='live_model'||r.model!==gradingModelName())throw Error('Invalid raw');
   if(JSON.stringify(normalize(current))!==JSON.stringify(normalize(r.expected)))throw Error('Expectation contract changed '+c.case_id);
   const request=hash(buildGradingPrompt(set,r.answers)),schema=hash(JSON.stringify(buildGradingResponseSchema(set,r.answers)));
   if(request!==r.request_hash||schema!==r.schema_hash||request!==o.request_hash||schema!==o.schema_hash)throw Error('Request/schema changed');
   return{file:o.file,sha256:o.sha256,raw_case_id:r.case_id,attempt:r.attempt,model:r.model,transport:r.transport,direct_request_hash:r.request_hash,direct_schema_hash:r.schema_hash,current_recomputed_request_hash:request,current_recomputed_schema_hash:schema,expected_points:r.expected.expected_points,expected_verdicts:r.expected.expected_verdicts.map((v:any)=>({criterion_id:v.criterion_id,verdict:v.verdict})),verdict_order_same:JSON.stringify(current.expected_verdicts.map((v:any)=>v.criterion_id))===JSON.stringify(r.expected.expected_verdicts.map((v:any)=>v.criterion_id)),full_qa_object_same:JSON.stringify(current)===JSON.stringify(r.expected),matched:r.matched,actual_points:r.result.score};
  });
  entries.push({plan_id:e.plan_id,set_id:e.set_id,question_file:e.file,question_sha256:e.sha256,current_qa_file:e.qa_file,current_qa_sha256:e.qa_sha256,current_case_id:current.id,current_case_sha256:hash(JSON.stringify(current)),current_expected_points:current.expected_points,current_expected_verdicts:current.expected_verdicts.map((v:any)=>({criterion_id:v.criterion_id,verdict:v.verdict})),mapping_method:'exact case_id + unchanged full answer and integer expectation + all criterion IDs/verdicts compared irrespective of array order + direct recorded request/schema hashes equal current production builders',observations});
 }
}
if(entries.length!==8||entries.reduce((n,e)=>n+e.observations.length,0)!==24)throw Error('Wrong count');
const output=path.join(dir,'eight-case-reuse-map.json');
fs.writeFileSync(output,JSON.stringify({recorded_at:new Date().toISOString(),api_calls:0,cases:8,valid_observations:24,runtime_lock:{file:lockFile,sha256:sha(lockFile)},manifest:{file:lock.manifest_file,sha256:sha(lock.manifest_file)},prior_reuse_index:{file:priorFile,sha256:sha(priorFile)},grader_unchanged:grader,explanation:'Raw filenames use case-1-attempt-1.json without four-digit zero padding. Canonical QA and rubric are unchanged. Full-object insertion order may differ; score/verdict mapping is checked by exact IDs, and request/schema are directly captured in the original raw observations, not only reconstructed.',unresolved:'T12-A/q2/omit-1 remains expected 5 versus actual 4/4/4. Its three mismatches are included as valid measurements, not pass.',entries},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:output,sha256:sha(output),cases:8,observations:24,full_qa_object_differences:entries.flatMap(e=>e.observations).filter(o=>!o.full_qa_object_same).length,verdict_order_differences:entries.flatMap(e=>e.observations).filter(o=>!o.verdict_order_same).length,api_calls:0}));
