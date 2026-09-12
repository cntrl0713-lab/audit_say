/** Run assigned author QA sequentially; stop immediately on execution failure. */
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const folder=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const lockFile=process.argv[3]||'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/runtime-lock.json';
const lock=JSON.parse(fs.readFileSync(lockFile,'utf8'));
const manifest=JSON.parse(fs.readFileSync(lock.manifest_file,'utf8'));
const selected=process.argv[4]?.split(',');
const entries=manifest.entries.filter(x=>['R01','N04','N05','S03'].includes(x.package)&&(!selected||selected.includes(x.plan_id)));
if(selected&&selected.some(id=>!entries.some(x=>x.plan_id===id)))throw Error('Unassigned or unknown plan ID');
const label=process.argv[2];
if(!label||!/^[-a-z0-9]+$/.test(label))throw Error('Unique run label is required');
const summaryFile=path.join(folder,'author-queue-'+label+'.json');
if(fs.existsSync(summaryFile))throw Error('Queue output exists');
const records=[];
const pauseFile=path.join(folder,'pause-author-queue-'+label+'.json');
let paused=false;
for(const entry of entries){
 if(fs.existsSync(pauseFile)){paused=true;console.log(JSON.stringify({event:'paused_before_next_set',next_plan_id:entry.plan_id,pause_file:pauseFile}));break;}
 console.log(JSON.stringify({event:'start',plan_id:entry.plan_id,qa_cases:entry.qa_cases,time:new Date().toISOString()}));
 const child=spawn(process.execPath,[path.join(folder,'launch-stage.mjs'),entry.plan_id,'author',label,lockFile],{stdio:['ignore','pipe','pipe'],env:process.env,windowsHide:true});
 let failureOutput='';child.stdout.on('data',()=>{});child.stderr.on('data',b=>{failureOutput+=b.toString();});
 const exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
 const summaryPath=path.join(path.dirname(entry.file),'phase-two-v1',entry.plan_id.toLowerCase(),label,'author-qa','summary.json');
 const summary=fs.existsSync(summaryPath)?JSON.parse(fs.readFileSync(summaryPath,'utf8')):null;
 const executionFailure=!summary||summary.stopped_on_execution_error||summary.changed_inputs.length>0;
 const record={plan_id:entry.plan_id,set_id:entry.set_id,exit_code:exitCode,summary_file:summaryPath,recorded_cases:summary?.recorded_cases??0,actual_attempts:summary?.actual_attempts??0,mismatched_case_ids:summary?.mismatched_case_ids??[],execution_failure:executionFailure,stderr:failureOutput||null};
 records.push(record);console.log(JSON.stringify({event:'finish',...record}));
 if(executionFailure)break;
}
fs.writeFileSync(summaryFile,JSON.stringify({recorded_at:new Date().toISOString(),manifest_file:lock.manifest_file,runtime_lock_file:lockFile,assigned_sets:entries.length,recorded_sets:records.length,records,paused_at_set_boundary:paused,pause_file:paused?pauseFile:null,stopped_on_execution_error:records.some(x=>x.execution_failure)},null,2)+'\n',{flag:'wx'});
if(records.some(x=>x.execution_failure||x.mismatched_case_ids.length))process.exitCode=1;
