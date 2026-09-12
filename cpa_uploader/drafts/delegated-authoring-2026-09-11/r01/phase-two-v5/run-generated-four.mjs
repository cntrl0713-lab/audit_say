// Four coordinator-approved semantic pass receipts; one sequential grader stream.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const manifest=control+'/final-153-v2/manifest.json',lock=control+'/runtime-v5-stable/runtime-lock.json';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mode=process.argv.includes('--execute')?'execute':'preflight';
if(mode==='execute'){
 const previous=read(path.join(folder,'author-queue-author5.json'));
 if(previous.stopped?.reason!=='pause_requested_at_set_boundary'||previous.completed.some(s=>s.execution_failure))throw Error('Author stream not safely stopped');
}
const entries=[['T04-A','draft-04-320-freq01'],['T09-A','draft-09-501-freq01'],['T09-B','draft-09-505-freq01'],['T10-A','draft-10-530-freq01']];
const records=[];
for(const [id,setId]of entries){
 if(mode==='preflight'&&process.argv.includes('--only-t10')&&id!=='T10-A')continue;
 const semantic=path.join(folder,setId,'semantic-cohort-v5-01-1/review/semantic.json');
 const receipt=read(semantic).reviews.find(r=>r.set_id===setId);
 if(receipt?.verdict!=='pass'||receipt.grading.status!=='not_run')throw Error('Unapproved or already graded semantic receipt');
 const output=path.join(folder,id.toLowerCase(),mode==='execute'?'generated5-01':'generated5-preflight');
 const stdout=path.join(folder,'generated-four-'+mode+'-'+id.toLowerCase()+'.stdout.log'),stderr=path.join(folder,'generated-four-'+mode+'-'+id.toLowerCase()+'.stderr.log');
 const out=fs.createWriteStream(stdout,{flags:'wx'}),err=fs.createWriteStream(stderr,{flags:'wx'});
 console.log(JSON.stringify({event:'start',plan_id:id,mode,semantic}));
 const child=spawn(process.execPath,['--import','tsx',control+'/run-generated-qa.ts','--manifest',manifest,'--plan-id',id,'--runtime-lock',lock,'--semantic',semantic,'--output',output,...(mode==='execute'?['--execute']:[])],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',b=>out.write(b));child.stderr.on('data',b=>err.write(b));
 const exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});out.end();err.end();
 const summaryFile=path.join(output,'summary.json'),stopFile=path.join(output,'stopped.json');
 const record={plan_id:id,set_id:setId,semantic,semantic_sha256:sha(semantic),mode,exit_code:exitCode,output,summary:fs.existsSync(summaryFile)?read(summaryFile):null,stopped:fs.existsSync(stopFile)?read(stopFile):null};
 records.push(record);console.log(JSON.stringify({event:'finish',...record}));
 if(record.stopped||(mode==='execute'&&!record.summary)||(mode==='preflight'&&exitCode!==0))break;
}
fs.writeFileSync(path.join(folder,'generated-four-'+mode+'.json'),JSON.stringify({finished_at:new Date().toISOString(),mode,runtime_lock:{file:lock,sha256:sha(lock)},manifest:{file:manifest,sha256:sha(manifest)},records},null,2)+'\n',{flag:'wx'});
if(records.length!==(mode==='preflight'&&process.argv.includes('--only-t10')?1:entries.length)||records.some(r=>r.exit_code!==0))process.exitCode=1;
