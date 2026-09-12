import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gradingModelName} from '../../../../../../lib/questionV3Grading.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11',common='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11',own=base+'/r02/evidence/phase2';
const lockFile=common+'/runtime-v5-bank-v3-after-refill-02/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file);
const phase='phase-two-v5-bank-v3-after-refill-02-owned',control=own+'/'+phase+'-control',s04=base+'/s04',one=own+'/run-one-author-case-after-refill.mjs',full=own+'/run-author-qa-after-refill.ts';
const entry=id=>manifest.entries.find(e=>e.plan_id===id),t10=entry('T10-C'),originalQA=read(t10.qa_file);
const oldDir=s04+'/evidence/phase2/phase-two-v5-bank-v3-after-refill-01-owned/pilot-10-007/author-qa-run1',oldSummary=read(oldDir+'/summary.json');
if(!oldSummary.stopped_on_execution_error)throw Error('Expected credit stop');
const oldRecords=oldSummary.records.map(r=>({file:oldDir+'/'+r.file,value:read(oldDir+'/'+r.file)}));
const oldValid=new Set(oldRecords.filter(r=>!r.value.error&&r.value.result).map(r=>r.value.case_id));
const pendingQA={...originalQA,cases:originalQA.cases.filter(c=>!oldValid.has(c.id))};
if(oldValid.size!==46||pendingQA.cases.length!==19)throw Error('Expected46 valid IDs and19 untouched required cases');
const probe=s04+'/evidence/phase2/phase-two-v5-bank-v3-after-refill-02/pilot-10-007/crit7-refill-probe/case-0001-attempt-1.json';
if(read(probe).error||!read(probe).raw_judgment)throw Error('Refill02 probe unavailable');
const subsetFile=s04+'/evidence/phase2/'+phase+'/pilot-10-007/remaining-required-qa-19.json';
if(fs.existsSync(control)||fs.existsSync(subsetFile))throw Error('Fresh paths required');
fs.mkdirSync(path.dirname(subsetFile),{recursive:true});fs.writeFileSync(subsetFile,JSON.stringify(pendingQA,null,2)+'\n',{flag:'wx'});
const supplement=s04+'/phase-two-followup/t10-b-qa-v2/qa-supplement-t10-b-number-classification.json';
const jobs=[
 {entry:t10,qa:t10.qa_file,only:'sub2-crit7-paraphrase',reference:probe,tag:'last-missing-valid-observation'},
 {entry:t10,qa:subsetFile,tag:'remaining-required-19'},
 {entry:entry('T12-C'),qa:entry('T12-C').qa_file,tag:'required-54'},
 {entry:entry('T12-D'),qa:entry('T12-D').qa_file,tag:'required-47'},
 ...read(supplement).cases.flatMap(c=>[1,2,3].map(n=>({entry:entry('T10-B'),qa:supplement,only:c.id,tag:'supplement/'+c.id+'/execution-'+n})))
];
const identities=[{file:lockFile,sha256:hash(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,...jobs.flatMap(j=>[{file:j.entry.file,sha256:j.entry.sha256},{file:j.qa,sha256:hash(j.qa)},...j.entry.plan_files,...j.entry.source_files]),...[probe,oldDir+'/summary.json',one,full,process.argv[1],t10.qa_file].map(file=>({file,sha256:hash(file)}))];
const guard=()=>{if(gradingModelName()!==lock.settings.grading_model)throw Error('Model changed');for(const i of identities)if(hash(i.file)!==i.sha256)throw Error('Fixed input/code changed '+i.file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-JOB'))throw Error('Owner pause at job boundary');};
guard();fs.mkdirSync(control,{recursive:true});const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write(control+'/queue-inputs.json',{created_at:new Date().toISOString(),runtime_lock:lockFile,identities,single_stream:true,required_total:835,required_previously_observed:715,required_remaining:120,partial_repetition_remaining:1,supplementary_executions:6,subset:{file:subsetFile,sha256:hash(subsetFile),original_qa:t10.qa_file,original_qa_sha256:hash(t10.qa_file),case_ids:pendingQA.cases.map(c=>c.id),original_case_bytes_equal:pendingQA.cases.every(c=>JSON.stringify(c)===JSON.stringify(originalQA.cases.find(o=>o.id===c.id)))},historical_stop_index:own+'/credit-balance-stop-after-refill-2026-09-11/owned-current-author-qa-stop-index.json',jobs:jobs.map(j=>({plan_id:j.entry.plan_id,qa:j.qa,only:j.only||null,tag:j.tag})),note:'Parent confirmed second refill; one actual incomplete-case observation succeeded. Continue only untouched required cases, last missing valid repetition, and approved boundary supplements. Nested credit/quota errors stop all calls. No semantic or generated-QA calls in this runner.'});
let index=0;
try{
 for(const j of jobs){
  guard();const n=String(++index).padStart(2,'0'),output=s04+'/evidence/phase2/'+phase+'/'+j.entry.set_id+'/'+j.tag;fs.mkdirSync(path.dirname(output),{recursive:true});
  write(control+'/job-'+n+'-start.json',{started_at:new Date().toISOString(),job:index,plan_id:j.entry.plan_id,output,only:j.only||null});console.log(JSON.stringify({job:index,started_at:new Date().toISOString(),plan_id:j.entry.plan_id,output,only:j.only||null}));
  const fd=fs.openSync(control+'/job-'+n+'-console.log','wx');let code;
  try{code=await new Promise((resolve,reject)=>{const args=['--import','tsx',j.only?one:full,'--file',j.entry.file,'--qa',j.qa,'--output',output,...(j.only?['--only',j.only,'--runtime-lock',lockFile]:[]),...(j.reference?['--reference-record',j.reference]:[])];const child=spawn(process.execPath,args,{env:process.env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',(c,s)=>s?reject(Error('Child signal '+s)):resolve(c));});}finally{fs.closeSync(fd);}
  const summary=fs.existsSync(output+'/summary.json')?read(output+'/summary.json'):null;write(control+'/job-'+n+'-result.json',{finished_at:new Date().toISOString(),job:index,plan_id:j.entry.plan_id,exit_code:code,summary_file:output+'/summary.json',summary});
  if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length||summary.recorded_cases!==summary.planned_cases)throw Error('Incomplete execution: preserve and stop');
  if(code!==0&&!(code===1&&summary.mismatched_case_ids.length))throw Error('Unexpected exit');
  console.log(JSON.stringify({job:index,plan_id:j.entry.plan_id,recorded:summary.recorded_cases,attempts:summary.actual_attempts,mismatches:summary.mismatched_case_ids}));guard();
 }
 write(control+'/queue-completed.json',{finished_at:new Date().toISOString(),new_required_cases:120,required_total_observed:835,completed_missing_repetition:1,supplement_executions:6,original_evidence_preserved:true});
}catch(error){write(control+'/queue-stopped.json',{stopped_at:new Date().toISOString(),last_job:index,error:String(error)});console.error(String(error));process.exitCode=1;}
