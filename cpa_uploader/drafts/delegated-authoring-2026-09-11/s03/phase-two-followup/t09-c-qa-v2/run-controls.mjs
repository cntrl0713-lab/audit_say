// Two preserved answers, each observed at least three times with corrected QA metadata.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const directory=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const lockFile=control+'/runtime-v5-bank-v3-after-refill-01/runtime-lock.json';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lock=read(lockFile),manifest=read(lock.manifest_file),entry=manifest.entries.find(e=>e.plan_id==='T09-C');
const lineage=read(path.join(directory,'lineage.json')),qaFile=lineage.regression_qa.file;
const records=[{file:lockFile,sha256:sha(lockFile)},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,{file:entry.file,sha256:entry.sha256},{file:entry.qa_file,sha256:entry.qa_sha256},...entry.plan_files,lineage.followup_qa,lineage.regression_qa,{file:path.join(directory,'lineage.json'),sha256:sha(path.join(directory,'lineage.json'))}];
const guard=()=>{const changed=records.filter(r=>sha(r.file)!==r.sha256);if(changed.length)throw Error('Frozen input changed '+changed.map(c=>c.file).join(', '));};guard();
if(!process.argv.includes('--execute')){console.log(JSON.stringify({preflight:true,cases:2,planned_minimum_observations:6,api_calls:0}));process.exit(0);}
const previous=read('cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-v5/author-queue-author5d.json');
const permittedStop=!previous.stopped&&previous.completed.length===5&&previous.completed.every(s=>s.all_case_coverage&&!s.execution_failure);
if(!permittedStop||previous.completed.some(s=>s.changed_inputs?.length))throw Error('Author queue has not stopped with unchanged inputs');
if(!process.env.OPENAI_API_KEY)throw Error('Credential missing');
const output=path.join(directory,'phase-two-v5-control-recheck-01');if(fs.existsSync(output))throw Error('Output exists');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'inputs.json'),JSON.stringify({started_at:new Date().toISOString(),runtime_lock_file:lockFile,runtime_lock_sha256:sha(lockFile),input_records:records,cases:['sub2/direct-reply-only-positive','sub2/management-reply-only-opposite'],question_changed:false,original_qa_changed:false,runner_sha256:sha(fileURLToPath(import.meta.url))},null,2)+'\n',{flag:'wx'});
const completed=[];let stopped=null;
for(const id of ['sub2/direct-reply-only-positive','sub2/management-reply-only-opposite']){
 let count=0,round=0;
 while(count<3){
  guard();round++;
  const caseFolder=path.join(output,id.replaceAll('/','-')+'-round-'+round);fs.mkdirSync(caseFolder,{recursive:true});
  const stdout=fs.createWriteStream(path.join(caseFolder,'stdout.log'),{flags:'wx'}),stderr=fs.createWriteStream(path.join(caseFolder,'stderr.log'),{flags:'wx'});
  const child=spawn(process.execPath,['--import','tsx',control+'/run-author-qa.ts','--file',entry.file,'--qa',qaFile,'--only',id,'--output',path.join(caseFolder,'author-qa')],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.on('data',b=>stdout.write(b));child.stderr.on('data',b=>stderr.write(b));
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});stdout.end();stderr.end();guard();
  const summaryFile=path.join(caseFolder,'author-qa/summary.json'),summary=fs.existsSync(summaryFile)?read(summaryFile):null;
  if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length){stopped={case_id:id,round,exit_code:code,summary};break;}
  const observations=summary.records.map(r=>{const file=path.join(path.dirname(summaryFile),r.file),o=read(file);return{file,sha256:sha(file),case_id:o.case_id,request_hash:o.request_hash,schema_hash:o.schema_hash,model:o.model,transport:o.transport,expected:o.expected,score:o.result.score,judgments:o.raw_judgment.subquestions.find(s=>s.subquestion_id==='sub2').verdicts,matched:o.matched};});
  completed.push(...observations);count+=observations.length;
  console.log(JSON.stringify({event:'recheck',case_id:id,round,observations:count,scores:observations.map(o=>o.score),matched:observations.every(o=>o.matched)}));
 }
 if(stopped)break;
}
const result={finished_at:new Date().toISOString(),runtime_lock:{file:lockFile,sha256:sha(lockFile)},planned_cases:2,recorded_observations:completed.length,cases:['sub2/direct-reply-only-positive','sub2/management-reply-only-opposite'].map(id=>({id,observations:completed.filter(o=>o.case_id===id).length,scores:completed.filter(o=>o.case_id===id).map(o=>o.score),all_matched:completed.filter(o=>o.case_id===id).every(o=>o.matched)})),stopped,records:completed,original_evidence_preserved:true};
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
if(stopped||result.cases.some(c=>c.observations<3||!c.all_matched))process.exitCode=1;
