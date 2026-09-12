import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildGradingPrompt,buildGradingResponseSchema,gradingModelName} from '../../../../../lib/questionV3Grading.ts';
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const sha=(file:string)=>hash(fs.readFileSync(file));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11',base='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const lockFile=control+'/runtime-v4-stable/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file);
const guarded=[{file:lockFile,sha256:sha(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files];
for(const item of guarded)if(sha(item.file)!==item.sha256)throw Error('Frozen input changed: '+item.file);
const bundles=[{id:'T12-A',folder:base+'/r01/phase-two-case-investigation/t12-a-date-regression/phase-two-v4/run-01'},{id:'T11-A',folder:base+'/n04/phase-two-case-investigation/t11-a-range-regression/phase-two-v4/run-01'}];
const entries=[];
for(const bundle of bundles){
 const entry=manifest.entries.find((entry:any)=>entry.plan_id===bundle.id),setRaw=read(entry.file),set=Array.isArray(setRaw)?setRaw[0]:setRaw,qa=read(entry.qa_file);
 if(sha(entry.file)!==entry.sha256||sha(entry.qa_file)!==entry.qa_sha256)throw Error('Candidate/QA changed');
 const inputFile=path.join(bundle.folder,'inputs.json'),inputs=read(inputFile),summaryFile=path.join(bundle.folder,'summary.json'),summary=read(summaryFile);
 if(inputs.runtime_lock_sha256!==sha(lockFile)||JSON.stringify(inputs.question_set)!==JSON.stringify(set)||summary.stopped_on_execution_or_runtime_error)throw Error('Prior actual input/runtime mismatch');
 const caseMap=new Map<string,any>();
 for(const event of summary.records){
  const file=path.join(bundle.folder,event.file),record=read(file),original=qa.cases.find((sample:any)=>sample.id===record.case_id);
  if(!original||JSON.stringify(original)!==JSON.stringify(record.expected)||record.model!==gradingModelName()||record.transport!=='live_model'||record.changed_inputs.length||record.error)throw Error('Original case/actual transport mismatch');
  if(record.request_hash!==hash(buildGradingPrompt(set,record.answers))||record.schema_hash!==hash(JSON.stringify(buildGradingResponseSchema(set,record.answers))))throw Error('Grader request/schema changed');
  if(!caseMap.has(record.case_id))caseMap.set(record.case_id,{case_id:record.case_id,original_case_hash:hash(JSON.stringify(original)),observations:[]});
  caseMap.get(record.case_id).observations.push({file,sha256:sha(file),attempt:record.attempt,matched:record.matched,request_hash:record.request_hash,schema_hash:record.schema_hash});
 }
 for(const item of caseMap.values())if(item.observations.length!==3)throw Error('Expected exactly three prior observations');
 entries.push({plan_id:bundle.id,candidate_file:entry.file,candidate_sha256:entry.sha256,original_qa_file:entry.qa_file,original_qa_sha256:entry.qa_sha256,proof_files:[{file:inputFile,sha256:sha(inputFile)},{file:summaryFile,sha256:sha(summaryFile)},...[...caseMap.values()].flatMap(item=>item.observations.map((o:any)=>({file:o.file,sha256:o.sha256})))],cases:[...caseMap.values()]});
}
for(const item of guarded)if(sha(item.file)!==item.sha256)throw Error('Input changed during local verification');
const result={recorded_at:new Date().toISOString(),artifact_type:'exact_per_case_actual_grading_reuse',runtime_lock_file:lockFile,runtime_lock_sha256:sha(lockFile),manifest_file:lock.manifest_file,manifest_sha256:lock.manifest_sha256,source_and_code_guard:guarded,cases:entries.reduce((n,e)=>n+e.cases.length,0),observations:entries.reduce((n,e)=>n+e.cases.reduce((n,c)=>n+c.observations.length,0),0),api_calls_by_this_verification:0,policy:'원문항·원QA·v4코드/출처·모델·요청/스키마 해시가 동일한 8사례만 연결한다. T12-A 원 실패3회는 미해결 그대로, 후속 실험문항은 제외한다.',entries};
fs.writeFileSync(base+'/r01/phase-two-v4/reuse-index.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:result.cases,observations:result.observations,api_calls:0}));
