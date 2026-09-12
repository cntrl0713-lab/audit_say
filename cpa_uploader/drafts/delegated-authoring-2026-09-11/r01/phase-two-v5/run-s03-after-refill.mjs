// One production grader stream. Original successful cases are not re-run.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lockFile=control+'/runtime-v5-bank-v3-after-refill-01/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file);
const recoveryFile='cpa_uploader/drafts/delegated-authoring-2026-09-11/s03/phase-two-v5/t09-c/timeout-recovery-inputs/lineage.json',recovery=read(recoveryFile);
const recheckFile='cpa_uploader/drafts/delegated-authoring-2026-09-11/n05/phase-two-followup/t14-a-qa-v2/phase-two-v5-recheck-01/summary.json',recheck=read(recheckFile);
if(recheck.stopped||recheck.cases.some(c=>c.observations<3||!c.all_matched))throw Error('T14-A followup not complete');
const oldLock=read(control+'/runtime-v5-bank-v3/runtime-lock.json');
for(const key of ['manifest_sha256','comparison_bank','code_files','source_files','settings'])if(JSON.stringify(oldLock[key])!==JSON.stringify(lock[key]))throw Error('Refill changed frozen contract '+key);
const assigned=manifest.entries.filter(e=>['R01','N04','N05','S03'].includes(e.package));
const entries=['T09-C','T09-D','T05-C','T13-B','T13-C'].map(id=>assigned.find(e=>e.plan_id===id));
const records=[{file:lockFile,sha256:sha(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,{file:recoveryFile,sha256:sha(recoveryFile)},recovery.recovery_qa,{file:recheckFile,sha256:sha(recheckFile)},...recovery.reused_successful_cases];
for(const e of assigned)records.push({file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files);
const guard=()=>records.filter(r=>sha(r.file)!==r.sha256).map(r=>r.file);
if(guard().length)throw Error('Frozen input changed '+guard().join(', '));
if(!process.argv.includes('--execute')){console.log(JSON.stringify({api_calls:0,selected:entries.map(e=>e.plan_id),new_cases:263,reused_cases:11,lock_sha256:sha(lockFile)}));process.exit(0);}
const previous=read(path.join(directory,'author-queue-author5b.json'));
if(previous.stopped?.reason!=='execution_failure'||previous.stopped.last_plan_id!=='T09-C')throw Error('Previous stream not stopped');
if(!process.env.OPENAI_API_KEY)throw Error('Credential missing');
const label='author5d',queueFile=path.join(directory,'author-queue-'+label+'.json');
if(fs.existsSync(queueFile))throw Error('Output exists');
fs.writeFileSync(path.join(directory,'author-queue-'+label+'-start.json'),JSON.stringify({started_at:new Date().toISOString(),lockFile,runner_sha256:sha(fileURLToPath(import.meta.url)),input_records:records},null,2)+'\n',{flag:'wx'});
const completed=[];let stopped=null;
for(const entry of entries){
 const changed=guard();if(changed.length){stopped={reason:'runtime_input_changed',changed};break;}
 const pause=path.join(directory,'pause-author-queue-'+label+'.json');if(fs.existsSync(pause)){stopped={reason:'pause_requested_at_set_boundary',next_plan_id:entry.plan_id,pause_file:pause};break;}
 const selectedQA=entry.plan_id==='T09-C'?recovery.recovery_qa.file:entry.qa_file;
 const selectedCount=read(selectedQA).cases.length;
 const outDir=path.join(path.dirname(entry.file),'phase-two-v5',entry.plan_id.toLowerCase(),label);if(fs.existsSync(outDir))throw Error('Set output exists');fs.mkdirSync(outDir,{recursive:true});
 const write=(name,value)=>fs.writeFileSync(path.join(outDir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 write('author-input-lock.json',{started_at:new Date().toISOString(),entry,selected_qa_file:selectedQA,selected_qa_sha256:sha(selectedQA),lock_file:lockFile,lock_sha256:sha(lockFile),inputRecords:records,reused:entry.plan_id==='T09-C'?recovery.reused_successful_cases:[]});
 console.log(JSON.stringify({event:'start',plan_id:entry.plan_id,selected_cases:selectedCount,reused_cases:entry.plan_id==='T09-C'?11:0}));
 const stdout=fs.createWriteStream(path.join(outDir,'author.stdout.log'),{flags:'wx'}),stderr=fs.createWriteStream(path.join(outDir,'author.stderr.log'),{flags:'wx'});
 const child=spawn(process.execPath,['--import','tsx',control+'/run-author-qa.ts','--file',entry.file,'--qa',selectedQA,'--output',path.join(outDir,'author-qa')],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',b=>stdout.write(b));child.stderr.on('data',b=>stderr.write(b));
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});stdout.end();stderr.end();
 const summaryFile=path.join(outDir,'author-qa/summary.json'),summary=fs.existsSync(summaryFile)?read(summaryFile):null,after=guard();
 const status={finished_at:new Date().toISOString(),plan_id:entry.plan_id,set_id:entry.set_id,exit_code:code,summary_file:summaryFile,summary_sha256:summary?sha(summaryFile):null,recorded_cases:summary?.recorded_cases??0,selected_cases:selectedCount,expected_cases:entry.qa_cases,reused_case_count:entry.plan_id==='T09-C'?11:0,actual_attempts:summary?.actual_attempts??0,mismatched_case_ids:summary?.mismatched_case_ids??[],changed_inputs:after,execution_failure:!summary||!!summary.stopped_on_execution_error||!!summary.changed_inputs?.length};
 status.all_case_coverage=!status.execution_failure&&status.recorded_cases+status.reused_case_count===entry.qa_cases;
 write('author-stage-result.json',status);completed.push(status);console.log(JSON.stringify({event:'finish',...status}));
 if(status.execution_failure||after.length){stopped={reason:status.execution_failure?'execution_failure':'runtime_changed',last_plan_id:entry.plan_id};break;}
}
fs.writeFileSync(queueFile,JSON.stringify({finished_at:new Date().toISOString(),lock_file:lockFile,completed,stopped},null,2)+'\n',{flag:'wx'});
if(stopped||completed.some(s=>s.mismatched_case_ids.length))process.exitCode=1;
