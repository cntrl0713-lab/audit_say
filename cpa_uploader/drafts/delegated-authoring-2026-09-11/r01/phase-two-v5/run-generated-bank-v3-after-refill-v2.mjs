// New bank-v3 generated QA, serial after all mandatory author QA. No API unless --execute.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lockFile=control+'/runtime-v5-bank-v3-after-refill-01/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file);
const entries=manifest.entries.filter(e=>['R01','N04','N05','S03'].includes(e.package));
const execute=process.argv.includes('--execute'),label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)||'generated-bank-v3-after-refill-02';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Bad label');
const selected=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const chosen=selected?selected.map(id=>{const e=entries.find(e=>e.plan_id===id);if(!e)throw Error('Unassigned ID');return e;}):entries;
const records=[{file:lockFile,sha256:sha(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,...entries.flatMap(e=>[{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files])];
const guard=()=>{const changed=records.filter(r=>sha(r.file)!==r.sha256);if(changed.length)throw Error('Frozen input changed '+changed.map(r=>r.file).join(', '));};guard();
if(execute){
 const author=read(path.join(dir,'author-queue-author5d.json'));
 if(author.stopped||author.completed.length!==5||author.completed.some(s=>s.execution_failure||!s.all_case_coverage))throw Error('Mandatory author queue is not safely complete');
 const pause=path.join(dir,'pause-generated-bank-v3-after-refill.json');if(fs.existsSync(pause))throw Error('Generation queue paused');
 if(!process.env.OPENAI_API_KEY)throw Error('Credential missing');
}
const outputFile=path.join(dir,label+(execute?'-execute':'-preflight')+'.json');if(fs.existsSync(outputFile))throw Error('Queue output exists');
const completed=[];let stopped=null;
for(const entry of chosen){
 guard();
 const semanticCandidates=['semantic-v5-bank-v3-after-refill-root-01-1','semantic-v5-bank-v3-root-01-1'].map(label=>path.join(entry.output_directory,'phase-two-v5',entry.set_id,label,'review/semantic.json'));
 const semantic=semanticCandidates.find(file=>fs.existsSync(file))||semanticCandidates[0];
 if(!fs.existsSync(semantic)){completed.push({plan_id:entry.plan_id,semantic,available:false,api_calls:0});continue;}
 const receipt=read(semantic).reviews.find(r=>r.set_id===entry.set_id);
 if(receipt?.verdict!=='pass'){completed.push({plan_id:entry.plan_id,semantic,available:true,verdict:receipt?.verdict,api_calls:0});continue;}
 const output=path.join(entry.output_directory,'phase-two-v5',entry.plan_id.toLowerCase(),label+(execute?'':'-preflight'));
 if(fs.existsSync(output))throw Error('Set output exists');
 const logPrefix=path.join(dir,label+(execute?'-execute-':'-preflight-')+entry.plan_id.toLowerCase());
 const stdout=fs.createWriteStream(logPrefix+'.stdout.log',{flags:'wx'}),stderr=fs.createWriteStream(logPrefix+'.stderr.log',{flags:'wx'});
 const args=['--import','tsx',control+'/run-generated-qa.ts','--manifest',lock.manifest_file,'--plan-id',entry.plan_id,'--runtime-lock',lockFile,'--semantic',semantic,'--output',output];if(execute)args.push('--execute');
 console.log(JSON.stringify({event:'start',plan_id:entry.plan_id,execute,semantic_cases:receipt.cases.length}));
 const child=spawn(process.execPath,args,{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout.on('data',b=>stdout.write(b));child.stderr.on('data',b=>stderr.write(b));
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});stdout.end();stderr.end();guard();
 const summaryFile=path.join(output,'summary.json'),stopFile=path.join(output,'stopped.json'),inputsFile=path.join(output,'inputs.json');
 const result={plan_id:entry.plan_id,set_id:entry.set_id,semantic,semantic_sha256:sha(semantic),output,exit_code:code,inputs:fs.existsSync(inputsFile)?{file:inputsFile,sha256:sha(inputsFile)}:null,summary:fs.existsSync(summaryFile)?{file:summaryFile,sha256:sha(summaryFile),value:read(summaryFile)}:null,stopped:fs.existsSync(stopFile)?{file:stopFile,sha256:sha(stopFile),value:read(stopFile)}:null};completed.push(result);
 console.log(JSON.stringify({event:'finish',plan_id:entry.plan_id,exit_code:code,valid_executions:result.summary?.value.recorded_executions??0,mismatches:result.summary?.value.initial_mismatched_case_ids.length??0,stopped:!!result.stopped}));
 if(result.stopped||!result.inputs||(execute&&!result.summary)||(!execute&&code!==0)){stopped={reason:'execution_or_preflight_failure',plan_id:entry.plan_id,detail:result.stopped?.value};break;}
}
fs.writeFileSync(outputFile,JSON.stringify({recorded_at:new Date().toISOString(),mode:execute?'actual_model':'preflight_api_0',runtime_lock:{file:lockFile,sha256:sha(lockFile)},runner_sha256:sha(fileURLToPath(import.meta.url)),selected_plan_ids:chosen.map(e=>e.plan_id),completed,stopped,pending_semantic_plan_ids:completed.filter(r=>r.available===false||r.verdict&&r.verdict!=='pass').map(r=>r.plan_id),original_semantic_receipts_unchanged:true,older_v2_generated_evidence_preserved:true},null,2)+'\n',{flag:'wx'});
if(stopped)process.exitCode=1;
