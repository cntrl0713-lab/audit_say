// Explicit sequential author-QA continuation. Without --execute, no API is called.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const oldLockFile=control+'/runtime-v4-stable/runtime-lock.json';
const lockFile=control+'/runtime-v5-stable/runtime-lock.json';
const selected=['T11-B','T13-A','T14-A','T14-B','T09-C','T09-D','T05-C','T13-B','T13-C'];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const oldLock=read(oldLockFile),lock=read(lockFile),oldManifest=read(oldLock.manifest_file),manifest=read(lock.manifest_file);
const assigned=manifest.entries.filter(e=>['R01','N04','N05','S03'].includes(e.package));
const entries=selected.map(id=>{const e=assigned.find(e=>e.plan_id===id);if(!e)throw Error('Unassigned '+id);return e;});
const codeChanges=lock.code_files.filter(f=>oldLock.code_files.find(p=>p.file===f.file)?.sha256!==f.sha256);
if(codeChanges.some(f=>f.file!=='cpa_uploader/questionSemanticReview.ts'))throw Error('Non-semantic runtime change');
if(JSON.stringify(oldLock.settings)!==JSON.stringify(lock.settings))throw Error('Model/settings changed');
if(JSON.stringify(oldLock.source_files)!==JSON.stringify(lock.source_files))throw Error('Source files changed');
for(const e of assigned){const prior=oldManifest.entries.find(p=>p.plan_id===e.plan_id);if(!prior||e.file!==prior.file||e.sha256!==prior.sha256||e.qa_file!==prior.qa_file||e.qa_sha256!==prior.qa_sha256||JSON.stringify(e.plan_files)!==JSON.stringify(prior.plan_files))throw Error('Assigned grading input changed '+e.plan_id);}
const records=[{file:lockFile,sha256:sha(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files];
for(const e of assigned)records.push({file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files);
const guard=()=>records.filter(f=>sha(f.file)!==f.sha256).map(f=>f.file);
if(guard().length)throw Error('Current lock mismatch: '+guard().join(', '));
const preflight={recorded_at:new Date().toISOString(),old_lock:{file:oldLockFile,sha256:sha(oldLockFile)},new_lock:{file:lockFile,sha256:sha(lockFile)},changed_code:codeChanges,assigned_sets_with_identical_question_qa_plan:assigned.length,source_files_identical:true,settings_identical:true,selected_plan_ids:selected,selected_cases:entries.reduce((sum,e)=>sum+e.qa_cases,0),completed_v4_evidence_reused_without_reinvocation:'../phase-two-v4/author-progress-007-runtime-transition.json',api_calls:0};
if(!process.argv.includes('--execute')){if(process.argv.includes('--save-preflight'))fs.writeFileSync(path.join(folder,'transition-preflight.json'),JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(preflight));process.exit(0);}
if(!process.env.OPENAI_API_KEY)throw Error('Credential missing; use --env-file=.env.local');
const label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)||'author5';
if(!/^[-a-z0-9]+$/.test(label))throw Error('Invalid label');
const queueFile=path.join(folder,'author-queue-'+label+'.json');
if(fs.existsSync(queueFile))throw Error('Queue output exists');
fs.writeFileSync(path.join(folder,'author-queue-'+label+'-start.json'),JSON.stringify({...preflight,started_at:new Date().toISOString(),runner_sha256:sha(fileURLToPath(import.meta.url)),api_calls_started_by_this_record:false},null,2)+'\n',{flag:'wx'});
const completed=[];let stopped=null;
for(const entry of entries){
 const changedBefore=guard();if(changedBefore.length){stopped={reason:'runtime_input_changed_before_next_set',next_plan_id:entry.plan_id,changed_inputs:changedBefore};break;}
 const pauseFile=path.join(folder,'pause-author-queue-'+label+'.json');if(fs.existsSync(pauseFile)){stopped={reason:'pause_requested_at_set_boundary',next_plan_id:entry.plan_id,pause_file:pauseFile};break;}
 const outputFolder=path.join(path.dirname(entry.file),'phase-two-v5',entry.plan_id.toLowerCase(),label);
 if(fs.existsSync(outputFolder))throw Error('Set output exists '+entry.plan_id);
 fs.mkdirSync(outputFolder,{recursive:true});
 const write=(name,value)=>fs.writeFileSync(path.join(outputFolder,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 write('author-input-lock.json',{started_at:new Date().toISOString(),entry,lock_file:lockFile,lock_sha256:sha(lockFile),inputRecords:records,settings:lock.settings,runner_sha256:sha(fileURLToPath(import.meta.url))});
 console.log(JSON.stringify({event:'start',plan_id:entry.plan_id,qa_cases:entry.qa_cases}));
 const out=fs.createWriteStream(path.join(outputFolder,'author.stdout.log'),{flags:'wx'}),err=fs.createWriteStream(path.join(outputFolder,'author.stderr.log'),{flags:'wx'});
 const child=spawn(process.execPath,['--import','tsx',control+'/run-author-qa.ts','--file',entry.file,'--qa',entry.qa_file,'--output',path.join(outputFolder,'author-qa')],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',b=>out.write(b));child.stderr.on('data',b=>err.write(b));
 const exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});out.end();err.end();
 const summaryFile=path.join(outputFolder,'author-qa/summary.json'),summary=fs.existsSync(summaryFile)?read(summaryFile):null,changedAfter=guard();
 const status={finished_at:new Date().toISOString(),plan_id:entry.plan_id,set_id:entry.set_id,exit_code:exitCode,summary_file:summaryFile,summary_sha256:summary?sha(summaryFile):null,recorded_cases:summary?.recorded_cases??0,expected_cases:entry.qa_cases,actual_attempts:summary?.actual_attempts??0,mismatched_case_ids:summary?.mismatched_case_ids??[],changed_inputs:changedAfter,execution_failure:!summary||Boolean(summary.stopped_on_execution_error)||Boolean(summary.changed_inputs?.length),all_case_coverage:summary?.recorded_cases===entry.qa_cases};
 write('author-stage-result.json',status);completed.push(status);console.log(JSON.stringify({event:'finish',...status}));
 if(status.execution_failure||changedAfter.length){stopped={reason:status.execution_failure?'execution_failure':'runtime_changed_during_set',last_plan_id:entry.plan_id,changed_inputs:changedAfter};break;}
}
fs.writeFileSync(queueFile,JSON.stringify({finished_at:new Date().toISOString(),lock_file:lockFile,selected_plan_ids:selected,completed,stopped},null,2)+'\n',{flag:'wx'});
if(stopped||completed.some(s=>s.mismatched_case_ids.length))process.exitCode=1;
