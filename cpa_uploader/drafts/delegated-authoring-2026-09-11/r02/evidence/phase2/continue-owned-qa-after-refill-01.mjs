import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gradingModelName} from '../../../../../../lib/questionV3Grading.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const base='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11',drafts='cpa_uploader/drafts/delegated-authoring-2026-09-11',own=drafts+'/r02/evidence/phase2';
const lockFile=base+'/runtime-v5-bank-v3-after-refill-01/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file),phase='phase-two-v5-bank-v3-after-refill-01-owned',control=own+'/'+phase+'-control';
const owners=['r02','n02','n03','s02','s04'],entries=manifest.entries.filter(e=>owners.some(o=>e.file.replaceAll('\\','/').includes('/'+o+'/'))),byId=id=>entries.find(e=>e.plan_id===id);
if(!fs.existsSync(own+'/phase-two-v5-bank-v3-control/queue-stopped.json'))throw Error('Prior stream still active');
const oneHelper=own+'/run-one-author-case-after-refill.mjs',fullHelper=own+'/run-author-qa-after-refill.ts';
const recovered=drafts+'/n03/evidence/phase2/phase-two-v5-bank-v3-after-refill-01/pilot-07-006/c12-refill-probe/summary.json';
if(read(recovered).stopped_on_execution_error||read(recovered).valid_grading_executions!==1)throw Error('Missing third has not recovered');
const extraQA=[drafts+'/n02/phase-two-followup/t08-b-v3/qa-supplement-t08-b-original-expressions.json',drafts+'/n02/phase-two-followup/t06-b-approval-boundary/qa-supplement-t06-b-approval-boundary.json',drafts+'/n03/phase-two-followup/t07-a-qa-v2/qa-cases-t07-a.followup-01.json',drafts+'/n03/phase-two-followup/t07-a-qa-v2/qa-supplement-t07-a-factors.json'];
if(hash(extraQA[2])!=='0e6dcbb2caadba82c20958f6f5e2aaa1a7574f423250b979eede4f91ef7d7b12')throw Error('Approved T07-A QA changed');
const remaining=entries.filter(e=>!['T05-A','T08-A','T08-B','T06-A','T06-B','T07-A'].includes(e.plan_id));
if(remaining.length!==9||remaining.reduce((n,e)=>n+e.qa_cases,0)!==472)throw Error('Expected remaining9/472');
const small=[];
const add=(id,file,selected)=>{const qa=read(file);for(const c of qa.cases.filter(c=>!selected||selected.includes(c.id)))for(let execution=1;execution<=3;execution++)small.push({entry:byId(id),qa_file:file,only:c.id,execution});};
small.push({entry:byId('T07-A'),qa_file:extraQA[2],only:'sub3-crit12-condition-boundary',execution:3});add('T07-A',extraQA[3]);
if(small.length!==7)throw Error('Expected7 small executions');
const identities=[{file:lockFile,sha256:hash(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,...entries.flatMap(e=>[{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files,...e.source_files]),...[...extraQA,oneHelper,fullHelper,recovered,process.argv[1]].map(file=>({file,sha256:hash(file)}))];
const guard=()=>{if(gradingModelName()!==lock.settings.grading_model)throw Error('Model changed');for(const i of identities)if(hash(i.file)!==i.sha256)throw Error('Fixed input/code changed '+i.file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-JOB'))throw Error('Owner pause at job boundary');};
if(fs.existsSync(control))throw Error('Fresh control required');guard();fs.mkdirSync(control,{recursive:true});
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write(control+'/queue-inputs.json',{created_at:new Date().toISOString(),manifest:lock.manifest_file,runtime_lock:lockFile,identities,model:gradingModelName(),single_stream:true,small_executions:7,remaining_required_sets:9,remaining_required_cases:472,required_total:835,already_covered_required_cases:363,T07_A_override:{file:extraQA[2],sha256:hash(extraQA[2]),count:73,changed_expected_cases:2,all_original_answers_preserved:true,old71_unmodified_expected_cases_reused:true},after_refill_probe:{file:recovered,sha256:hash(recovered),failed_attempt_counted_as_valid:false},previous_evidence_controls:[own+'/phase-two-v4-bank-v2-control',own+'/phase-two-v5-source-ranges-control',own+'/phase-two-v5-bank-v3-control',own+'/phase-two-v5-bank-v3-resume-followups-control'],note:'Parent confirmed refill. Probe succeeded; same grader/question/bank/source/model lock. Nested credit_balance_exhausted/insufficient_quota are detected before transport in the owned helper; any execution error immediately stops the whole queue. Normal completed cases are not restarted.'});
let job=0,completed=0;
async function run(entry,file,output,only){
 guard();const number=String(++job).padStart(2,'0');fs.mkdirSync(path.dirname(output),{recursive:true});const start={started_at:new Date().toISOString(),job,plan_id:entry.plan_id,set_id:entry.set_id,qa_file:file,only:only||null,output};write(control+'/job-'+number+'-start.json',start);console.log(JSON.stringify(start));const fd=fs.openSync(control+'/job-'+number+'-console.log','wx');let code;
 const helper=only?oneHelper:fullHelper,childArgs=['--import','tsx',helper,'--file',entry.file,'--qa',file,'--output',output,...(only?['--only',only,'--runtime-lock',lockFile]:[])];
 try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,childArgs,{stdio:['ignore',fd,fd],env:process.env});child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error('Child signal '+signal)):resolve(code));});}finally{fs.closeSync(fd);}
 const summary=fs.existsSync(output+'/summary.json')?read(output+'/summary.json'):null;write(control+'/job-'+number+'-result.json',{finished_at:new Date().toISOString(),job,plan_id:entry.plan_id,set_id:entry.set_id,only:only||null,exit_code:code,summary_file:output+'/summary.json',summary});
 if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length||summary.recorded_cases!==summary.planned_cases)throw Error('Incomplete execution: preserve evidence and stop before another request');
 if(code!==0&&!(code===1&&summary.mismatched_case_ids.length))throw Error('Unexpected exit');console.log(JSON.stringify({job,plan_id:entry.plan_id,recorded:summary.recorded_cases,attempts:summary.actual_attempts,mismatches:summary.mismatched_case_ids}));return summary;
}
try{
 for(const s of small){const owner=owners.find(o=>s.entry.file.replaceAll('\\','/').includes('/'+o+'/')),output=drafts+'/'+owner+'/evidence/phase2/'+phase+'/'+s.entry.set_id+'/followup/'+s.only+'/execution-'+s.execution;await run(s.entry,s.qa_file,output,s.only);guard();}
 for(const entry of remaining){const owner=owners.find(o=>entry.file.replaceAll('\\','/').includes('/'+o+'/')),out=drafts+'/'+owner+'/evidence/phase2/'+phase+'/'+entry.set_id,summary=await run(entry,entry.qa_file,out+'/author-qa-run1');if(summary.planned_cases!==entry.qa_cases)throw Error('Required QA count mismatch');write(out+'/required-case-coverage-summary.json',{finished_at:new Date().toISOString(),set_id:entry.set_id,plan_id:entry.plan_id,required_cases:entry.qa_cases,QA_file:entry.qa_file,QA_sha256:hash(entry.qa_file),new_grading_executions:summary.actual_attempts,unresolved_cases:summary.mismatched_case_ids,completed_required_case_coverage:true,summary_file:out+'/author-qa-run1/summary.json'});completed++;guard();}
 write(control+'/queue-completed.json',{finished_at:new Date().toISOString(),required_total:835,required_already_covered:363,newly_completed_required_sets:completed,newly_completed_required_cases:472,small_executions:7,all_original_evidence_preserved:true});
}catch(error){write(control+'/queue-stopped.json',{stopped_at:new Date().toISOString(),newly_completed_required_sets:completed,last_job:job,error:String(error)});console.error(String(error));process.exitCode=1;}
