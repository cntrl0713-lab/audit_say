import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {gradingModelName} from '../../../../../../lib/questionV3Grading.ts';
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+2*i],process.argv[3+2*i]]));
if(Object.keys(args).some(k=>!['--runtime-lock','--output-phase'].includes(k))||!args['--runtime-lock']||!args['--output-phase']||!/^[a-z0-9-]+$/.test(args['--output-phase']))throw Error('Explicit --runtime-lock and new --output-phase required');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const norm=f=>path.resolve(f).toLowerCase();
const base='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11',drafts='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const manifestFile=base+'/final-153-v2/manifest.json',lockFile=args['--runtime-lock'],phase=args['--output-phase'];
const manifest=read(manifestFile),lock=read(lockFile),owners=['r02','n02','n03','s02','s04'];
if(norm(lock.manifest_file)!==norm(manifestFile)||lock.manifest_sha256!==hash(manifestFile))throw Error('Wrong manifest lock');
const all=manifest.entries.filter(e=>owners.some(o=>e.file.replaceAll('\\','/').includes('/'+o+'/')));
const priorControl=drafts+'/r02/evidence/phase2/phase-two-v4-bank-v2-control',priorInputs=read(priorControl+'/queue-inputs.json');
if(!fs.existsSync(priorControl+'/queue-stopped.json'))throw Error('Prior queue must be stopped');
const priorHash=new Map(priorInputs.identities.map(i=>[norm(i.file),i.sha256]));
const graderFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3.ts','lib/questionV3Answer.ts','lib/ai/openaiStructured.ts',base+'/run-author-qa.ts'];
for(const f of graderFiles)if(priorHash.get(norm(f))!==hash(f))throw Error('Prior completed grading cannot be reused after grader change: '+f);
if(priorInputs.model!==gradingModelName()||lock.settings.grading_model!==gradingModelName())throw Error('Model differs');
const inherited=[];
for(const name of fs.readdirSync(priorControl).filter(n=>/^job-\d+-result\.json$/.test(n))){const file=priorControl+'/'+name,r=read(file);if(!r.completed_required_case_coverage)continue;const e=all.find(e=>e.set_id===r.set_id);if(!e||r.required_cases!==e.qa_cases)throw Error('Prior coverage mismatch');for(const i of [{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.source_files])if(hash(i.file)!==i.sha256||priorHash.get(norm(i.file))!==i.sha256)throw Error('Prior completed inputs changed');inherited.push({file,sha256:hash(file),...r,new_API_calls_for_reuse:0});}
if(inherited.length!==2||inherited.reduce((n,r)=>n+r.required_cases,0)!==114)throw Error('Expected prior R02/T08-A114 cases');
const entries=all.filter(e=>!inherited.some(r=>r.set_id===e.set_id));
if(entries.length!==13||entries.reduce((n,e)=>n+e.qa_cases,0)!==721)throw Error('Expected remaining13/721');
const overrideFile=drafts+'/n02/evidence/phase2/phase-two-v4-proposals/qa-cases-t06-a.followup-01.json';
const overrideHash='18a1684115c4c20b36ee400a815848ee757f426899922066b73fe193d053cf86';
if(hash(overrideFile)!==overrideHash)throw Error('Approved T06-A override changed');
const supplementFile=drafts+'/n02/evidence/phase2/phase-two-v4-proposals/qa-supplement-t06-a-implementation-boundaries.json';
const control=drafts+'/r02/evidence/phase2/'+phase+'-control';
if(fs.existsSync(control))throw Error('Fresh control path required');
const identities=[{file:manifestFile,sha256:lock.manifest_sha256},{file:lockFile,sha256:hash(lockFile)},lock.comparison_bank,...lock.code_files,...lock.source_files,...all.flatMap(e=>[{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files,...e.source_files]),{file:overrideFile,sha256:overrideHash},{file:supplementFile,sha256:hash(supplementFile)},{file:process.argv[1],sha256:hash(process.argv[1])}];
const guard=()=>{if(gradingModelName()!==lock.settings.grading_model)throw Error('Model changed');for(const i of identities)if(hash(i.file)!==i.sha256)throw Error('Fixed input/code changed: '+i.file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-JOB'))throw Error('Owner pause before next job');};
guard();fs.mkdirSync(control,{recursive:true});
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write(control+'/queue-inputs.json',{created_at:new Date().toISOString(),manifest:manifestFile,runtime_lock:lockFile,identities,model:gradingModelName(),required_total:835,previous_completed_required:114,new_required:721,inherited,QA_override:{plan_id:'T06-A',file:overrideFile,sha256:overrideHash,required_count:67,authorization:'parent accepted original prompt/source based two expectation corrections; content/plan/bank unchanged'},supplement:{file:supplementFile,count:5,minimum_repeats:3,not_in_required_835:true},policy:'single child stream; stop at set/job boundary on change; preserve partial evidence'});
let job=0,completed=0;
async function run(entry,qaFile,output,only){
 guard();const n=String(++job).padStart(2,'0');fs.mkdirSync(path.dirname(output),{recursive:true});const started={started_at:new Date().toISOString(),job,set_id:entry.set_id,plan_id:entry.plan_id,qa_file:qaFile,only:only||null,output};write(control+'/job-'+n+'-start.json',started);console.log(JSON.stringify(started));const fd=fs.openSync(control+'/job-'+n+'-console.log','wx');let code;
 try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',base+'/run-author-qa.ts','--file',entry.file,'--qa',qaFile,'--output',output,...(only?['--only',only]:[])],{stdio:['ignore',fd,fd],env:process.env});child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error('Child signal '+signal)):resolve(code));});}finally{fs.closeSync(fd);}
 const summary=fs.existsSync(output+'/summary.json')?read(output+'/summary.json'):null;
 write(control+'/job-'+n+'-result.json',{finished_at:new Date().toISOString(),job,set_id:entry.set_id,only:only||null,exit_code:code,summary_file:output+'/summary.json',summary});
 if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length||summary.recorded_cases!==summary.planned_cases)throw Error('Incomplete child/transport failure; no further API jobs');if(code!==0&&!(code===1&&summary.mismatched_case_ids.length))throw Error('Unexpected child exit');
 console.log(JSON.stringify({job,set_id:entry.set_id,only:only||null,recorded:summary.recorded_cases,attempts:summary.actual_attempts,mismatches:summary.mismatched_case_ids}));return summary;
}
try{
 for(const entry of entries){
  const owner=owners.find(o=>entry.file.replaceAll('\\','/').includes('/'+o+'/')),out=drafts+'/'+owner+'/evidence/phase2/'+phase+'/'+entry.set_id;
  const qaFile=entry.plan_id==='T06-A'?overrideFile:entry.qa_file;
  const summary=await run(entry,qaFile,out+'/author-qa-run1');
  if(summary.planned_cases!==entry.qa_cases)throw Error('Required count changed');
  write(out+'/required-case-coverage-summary.json',{finished_at:new Date().toISOString(),set_id:entry.set_id,plan_id:entry.plan_id,required_cases:entry.qa_cases,QA_file:qaFile,QA_sha256:hash(qaFile),new_grading_executions:summary.actual_attempts,unresolved_cases:summary.mismatched_case_ids,completed_required_case_coverage:true,summary_file:out+'/author-qa-run1/summary.json'});completed++;guard();
  if(entry.plan_id==='T06-A'){
   for(const c of read(supplementFile).cases){let observed=0,invocation=0;const evidence=[];while(observed<3){const output=out+'/supplement/'+c.id+'/execution-'+(++invocation);const r=await run(entry,supplementFile,output,c.id);observed+=r.actual_attempts;evidence.push({summary_file:output+'/summary.json',actual_attempts:r.actual_attempts,mismatched_case_ids:r.mismatched_case_ids});guard();}write(out+'/supplement/'+c.id+'/minimum-three-result.json',{case_id:c.id,observed,evidence});}
  }
 }
 write(control+'/queue-completed.json',{finished_at:new Date().toISOString(),newly_completed_required_sets:completed,inherited_required_sets:2,required_cases:835,supplement_cases:5,all_evidence_preserved:true});
}catch(error){write(control+'/queue-stopped.json',{stopped_at:new Date().toISOString(),completed_required_sets:completed,inherited_required_sets:2,error:String(error)});console.error(String(error));process.exitCode=1;}
