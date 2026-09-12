import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {gradingModelName} from '../../../../../..//lib/questionV3Grading.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const base='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const manifestFile=base+'/final-153-v1/manifest.json';
const lockFile=base+'/runtime-v3-stable/runtime-lock.json';
const manifest=read(manifestFile),lock=read(lockFile);
const packages=['r02','n02','n03','s02','s04'];
const entries=manifest.entries.filter(e=>packages.some(owner=>e.file.replaceAll('\\','/').includes('/'+owner+'/')));
if(entries.length!==15)throw Error('Expected exactly 15 owned sets');
const control='cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2/phase-two-v3-control';
if(fs.existsSync(control))throw Error('New control directory required');
const identities=[{file:manifestFile,sha256:lock.manifest_sha256},{file:lockFile,sha256:hash(lockFile)},lock.comparison_bank,...lock.code_files,...lock.source_files,
 ...entries.flatMap(e=>[{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files,...e.source_files])];
const guard=()=>{if(gradingModelName()!==lock.settings.grading_model)throw Error('Model differs from v3 lock');for(const identity of identities)if(hash(identity.file)!==identity.sha256)throw Error('Fixed input/code changed: '+identity.file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-JOB'))throw Error('Owner stop requested before next job');};
guard();fs.mkdirSync(control,{recursive:true});
const write=(name,value)=>fs.writeFileSync(control+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const jobs=[];
const r02=entries.find(e=>e.plan_id==='T05-A');
for(let i=1;i<=3;i++)jobs.push({entry:r02,only:'sub1-request-pending',suffix:'request-pending-repeat-'+i});
for(const entry of entries)jobs.push({entry,suffix:'author-qa-run1'});
write('queue-inputs.json',{created_at:new Date().toISOString(),runtime_lock:lockFile,identities,model:gradingModelName(),owned_sets:15,full_suite_cases:835,additional_r02_minimum_repeats:3,jobs:jobs.map(j=>({plan_id:j.entry.plan_id,set_id:j.entry.set_id,only:j.only??null,suffix:j.suffix})),execution:'one child process at a time; stop on execution error/code change; preserve mismatches and continue independent unchanged sets'});
let completed=0;
try{
for(const [index,job]of jobs.entries()){
 guard();const entry=job.entry;
 const output=path.dirname(entry.file)+'/evidence/phase2/phase-two-v3/'+entry.set_id+'/'+job.suffix;
 const args=['--import','tsx',base+'/run-author-qa.ts','--file',entry.file,'--qa',entry.qa_file,'--output',output,...(job.only?['--only',job.only]:[])];
 const n=String(index+1).padStart(2,'0');
 const started={started_at:new Date().toISOString(),job:index+1,set_id:entry.set_id,plan_id:entry.plan_id,only:job.only??null,output};write('job-'+n+'-start.json',started);console.log(JSON.stringify(started));
 const fd=fs.openSync(control+'/job-'+n+'-console.log','wx');
 let code;
 try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:['ignore',fd,fd],env:process.env});child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error('child signal '+signal)):resolve(code));});}finally{fs.closeSync(fd);}
 const summaryFile=output+'/summary.json';
 const summary=fs.existsSync(summaryFile)?read(summaryFile):null;
 const result={finished_at:new Date().toISOString(),job:index+1,set_id:entry.set_id,exit_code:code,summary_file:summaryFile,summary};write('job-'+n+'-result.json',result);
 console.log(JSON.stringify({job:index+1,set_id:entry.set_id,exit_code:code,recorded:summary?.recorded_cases??0,mismatches:summary?.mismatched_case_ids??[],execution_error:summary?.stopped_on_execution_error??true}));
 if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length||summary.recorded_cases!==summary.planned_cases)throw Error('Child execution incomplete or fixed inputs changed; no further API jobs');
 if(code!==0&&!(code===1&&summary.mismatched_case_ids.length))throw Error('Unexpected child failure');
 completed++;guard();
}
write('queue-completed.json',{finished_at:new Date().toISOString(),completed_jobs:completed,full_suite_cases:835,all_results_preserved:true});
}catch(error){write('queue-stopped.json',{stopped_at:new Date().toISOString(),completed_jobs:completed,error:String(error)});console.error(String(error));process.exitCode=1;}
