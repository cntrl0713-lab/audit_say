// Read-only input verification plus owned recovery manifests. No API calls.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildGradingPrompt,buildGradingResponseSchema,gradingModelName} from '../../../../../../lib/questionV3Grading.ts';
const dir=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const lockFile=control+'/runtime-v5-bank-v3/runtime-lock.json';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const sha=(f:string)=>hash(fs.readFileSync(f));
const lock=read(lockFile),manifest=read(lock.manifest_file),entry=manifest.entries.find((e:any)=>e.plan_id==='T09-C');
for(const r of [{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,{file:entry.file,sha256:entry.sha256},{file:entry.qa_file,sha256:entry.qa_sha256},...entry.plan_files])if(sha(r.file)!==r.sha256)throw Error('Input changed '+r.file);
const question=read(entry.file),set=Array.isArray(question)?question[0]:question,qa=read(entry.qa_file);
const priorDir=path.join(dir,'author5b/author-qa'),priorInputs=read(path.join(priorDir,'inputs.json')),summaryFile=path.join(priorDir,'summary.json'),summary=read(summaryFile);
if(!summary.stopped_on_execution_error||summary.changed_inputs.length)throw Error('Unexpected previous stage');
for(const [file,value] of Object.entries(priorInputs.hashes))if(sha(file)!==value)throw Error('Previous grading input changed '+file);
if(priorInputs.model!==gradingModelName())throw Error('Model changed');
const reused:any[]=[],failed:any[]=[];
for(const item of summary.records){
 const file=path.join(priorDir,item.file),r=read(file),original=qa.cases.find((c:any)=>c.id===r.case_id);
 if(JSON.stringify(original)!==JSON.stringify(r.expected))throw Error('QA contract changed '+r.case_id);
 if(r.error){failed.push({file,sha256:sha(file),case_id:r.case_id,error:r.error,trace:r.trace,valid_model_judgment:false});continue;}
 const request=hash(buildGradingPrompt(set,r.answers)),schema=hash(JSON.stringify(buildGradingResponseSchema(set,r.answers)));
 if(request!==r.request_hash||schema!==r.schema_hash||!r.matched)throw Error('Cannot reuse '+r.case_id);
 reused.push({file,sha256:sha(file),case_id:r.case_id,request_hash:request,schema_hash:schema,model:r.model,transport:r.transport,matched:r.matched});
}
if(reused.length!==11||failed.length!==1||failed[0].case_id!=='sub1/boundary-2')throw Error('Unexpected recovery extent');
const completed=new Set(reused.map(r=>r.case_id)),remaining={...qa,cases:qa.cases.filter((c:any)=>!completed.has(c.id))};
if(remaining.cases.length!==54||remaining.cases[0].id!==failed[0].case_id)throw Error('Recovery selection mismatch');
const out=path.join(dir,'timeout-recovery-inputs');fs.mkdirSync(out,{recursive:true});
const qaFile=path.join(out,'remaining-qa.json');fs.writeFileSync(qaFile,JSON.stringify(remaining,null,2)+'\n',{flag:'wx'});
const report={recorded_at:new Date().toISOString(),api_calls:0,root_direction:'일시 전송장애 후 성공 11개를 동일성 확인하여 보존하고 실패 12번째 및 나머지 53개만 제한 재개. 실행오류는 유효 판정 및 의미 불일치 집계에서 제외.',runtime_lock:{file:lockFile,sha256:sha(lockFile)},entry,prior_summary:{file:summaryFile,sha256:sha(summaryFile)},prior_inputs:{file:path.join(priorDir,'inputs.json'),sha256:sha(path.join(priorDir,'inputs.json'))},reused_successful_cases:reused,failed_transport_attempts:failed,recovery_qa:{file:qaFile,sha256:sha(qaFile),cases:54},original_question_qa_unchanged:true,per_case_answers_expectations_unchanged:true};
fs.writeFileSync(path.join(out,'lineage.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({reused_successful:reused.length,failed_transport:failed.length,remaining_cases:54,api_calls:0}));
