import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
const own='cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2',taskFile=own+'/semantic-diagnostic-tasks-refill02.json';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const config=read(taskFile),control=own+'/semantic-exact-diagnostics-refill02-control';
if(fs.existsSync(control)||!fs.existsSync(own+'/phase-two-v5-bank-v3-after-refill-02-owned-control/queue-completed.json'))throw Error('Finish single author stream first and use fresh diagnostic control');
if(config.tasks.length!==6||config.tasks.some(t=>t.preflight_exit_code!==0||read(t.preflight_output).status!=='preflight_valid'))throw Error('All6 original unit preflights required');
const snapshots=new Map([[taskFile,hash(taskFile)],[process.argv[1],hash(process.argv[1])]]);
for(const t of config.tasks){snapshots.set(t.preflight_output,hash(t.preflight_output));for(const [file,sha] of Object.entries(read(t.preflight_output).checked_hashes))snapshots.set(file,sha);}
const guard=()=>{for(const [file,sha]of snapshots)if(hash(file)!==sha)throw Error('Fixed input/code changed '+file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-UNIT'))throw Error('Owner requested unit boundary stop');};
guard();fs.mkdirSync(control,{recursive:true});const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write(control+'/inputs.json',{created_at:new Date().toISOString(),task_file:taskFile,task_file_sha256:hash(taskFile),single_API_stream:true,exact_attempt_instructions:true,planned_actual_requests:12,checked_hashes:Object.fromEntries(snapshots),no_repromotion_of_original_receipts:true});
let job=0;
try{
 for(const t of config.tasks)for(const output of t.actual_outputs){
  guard();const n=String(++job).padStart(2,'0');console.log(JSON.stringify({job,plan_id:t.plan_id,unit_id:t.unit_id,started_at:new Date().toISOString(),output}));
  const fd=fs.openSync(control+'/job-'+n+'-console.log','wx');let code;
  try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',t.helper,'--manifest',t.manifest,'--runtime-lock',t.runtime_lock,'--chunks',t.chunks,'--unit-id',t.unit_id,'--plan-id',t.plan_id,'--output',output,'--execute'],{env:process.env,stdio:['ignore',fd,fd]});child.once('error',reject);child.once('exit',(c,s)=>s?reject(Error('Child signal '+s)):resolve(c));});}finally{fs.closeSync(fd);}
  const record=fs.existsSync(output)?read(output):null;write(control+'/job-'+n+'-result.json',{finished_at:new Date().toISOString(),job,plan_id:t.plan_id,unit_id:t.unit_id,exit_code:code,output,output_sha256:record?hash(output):null,status:record?.status||'no_record',http_status:record?.http_status,request_id:record?.request_id});
  if(code!==0||!record||record.status!=='response_valid'||record.actual_API_requests!==1||record.changed_files?.length)throw Error('Diagnostic did not produce a stable valid observation; preserve and stop before another call');
  console.log(JSON.stringify({job,plan_id:t.plan_id,unit_id:t.unit_id,status:record.status,http_status:record.http_status,checks:record.grounded?.unit?.checks||record.grounded?.units?.[0]?.checks||null}));guard();
 }
 write(control+'/queue-completed.json',{finished_at:new Date().toISOString(),actual_valid_observations:12,original_valid_observations:6,units_with_three:6,receipt_mutations:0});
}catch(error){write(control+'/queue-stopped.json',{stopped_at:new Date().toISOString(),last_job:job,error:String(error)});console.error(String(error));process.exitCode=1;}
