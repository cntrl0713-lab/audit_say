import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {gradingModelName,buildGradingPrompt,buildGradingResponseSchema} from '../../../../../../lib/questionV3Grading.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sha=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>JSON.stringify(v);
const norm=f=>path.resolve(f).toLowerCase();
const base='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const drafts='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const manifestFile=base+'/final-153-v2/manifest.json',lockFile=base+'/runtime-v4-bank-v2/runtime-lock.json';
const manifest=read(manifestFile),lock=read(lockFile);
const owners=['r02','n02','n03','s02','s04'];
const entries=manifest.entries.filter(e=>owners.some(owner=>e.file.replaceAll('\\','/').includes('/'+owner+'/')));
const control=drafts+'/r02/evidence/phase2/phase-two-v4-bank-v2-control';
if(entries.length!==15||fs.existsSync(control))throw Error('15 entries and new output directory required');
const identities=[{file:manifestFile,sha256:lock.manifest_sha256},{file:lockFile,sha256:hash(lockFile)},lock.comparison_bank,...lock.code_files,...lock.source_files,...entries.flatMap(e=>[{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files,...e.source_files])];
const guard=()=>{if(gradingModelName()!==lock.settings.grading_model)throw Error('Model lock differs');for(const i of identities)if(hash(i.file)!==i.sha256)throw Error('Fixed input/code changed: '+i.file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-JOB'))throw Error('Owner pause before next set');};
guard();fs.mkdirSync(control,{recursive:true});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const oldControl=drafts+'/r02/evidence/phase2/phase-two-v4-focused-control';
const priorRuns=[];
for(const run of read(oldControl+'/completed.json').results){const dir=path.dirname(run.summary_file),summary=read(run.summary_file),inputs=read(dir+'/inputs.json');for(const rec of summary.records){const file=path.join(dir,rec.file);priorRuns.push({file,file_sha256:hash(file),inputs_file:dir+'/inputs.json',inputs_sha256:hash(dir+'/inputs.json'),inputs,row:read(file)});}}
const graderFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3.ts','lib/questionV3Answer.ts','lib/ai/openaiStructured.ts',base+'/run-author-qa.ts'];
const expectedSignature=c=>canonical({points:c.expected_points,verdicts:[...c.expected_verdicts].sort((a,b)=>a.criterion_id.localeCompare(b.criterion_id)).map(v=>[v.criterion_id,v.verdict]),boundary:['condition_boundary','condition-boundary'].includes(c.kind)});
const prepared=[];
for(const entry of entries){
 const owner=owners.find(o=>entry.file.replaceAll('\\','/').includes('/'+o+'/'));
 const out=drafts+'/'+owner+'/evidence/phase2/phase-two-v4-bank-v2/'+entry.set_id;
 fs.mkdirSync(out,{recursive:true});
 const qa=read(entry.qa_file),array=read(entry.file),set=Array.isArray(array)?array[0]:array;
 const reused=[],remaining=[];
 for(const c of qa.cases){
  const answers=Object.fromEntries(set.subquestions.map(q=>[q.id,q.id===c.subquestion_id?c.answer:'']));
  const requestHash=sha(buildGradingPrompt(set,answers)),schemaHash=sha(JSON.stringify(buildGradingResponseSchema(set,answers)));
  const candidates=priorRuns.filter(p=>p.row.set_id===set.id&&p.row.answers[c.subquestion_id]===c.answer&&p.row.expected.subquestion_id===c.subquestion_id&&p.row.request_hash===requestHash&&p.row.schema_hash===schemaHash&&expectedSignature(p.row.expected)===expectedSignature(c));
  const valid=candidates.filter(p=>{
   if(p.row.error||!p.row.raw_judgment||p.row.transport!=='live_model'||p.row.model!==gradingModelName()||p.inputs.mock!==false||canonical(p.inputs.question_set)!==canonical(set))return false;
   const h=new Map(Object.entries(p.inputs.hashes).map(([f,v])=>[norm(f),v]));
   return [...graderFiles,...set.source_refs.map(s=>s.file)].every(f=>h.get(norm(f))===hash(f));
  });
  if(valid.length){
   if(valid.some(p=>!p.row.matched)&&valid.length<3)throw Error('Unresolved reused case needs three original runs');
   const records=valid.map(p=>({file:p.file,sha256:p.file_sha256,inputs_file:p.inputs_file,inputs_sha256:p.inputs_sha256,original_case_id:p.row.case_id,attempt:p.row.attempt,matched:p.row.matched,actual_points:p.row.result.score,request_hash:p.row.request_hash,schema_hash:p.row.schema_hash,transport:'prior_actual_model_evidence_reuse',new_API_calls:0}));
   reused.push({case_id:c.id,subquestion_id:c.subquestion_id,expected:c,all_matched:valid.every(p=>p.row.matched),records,verification:'Same current question object, answer, per-criterion expected verdicts/points, model, request/schema hashes, six grader/runtime files, all referenced source file hashes. Bank v2 does not enter grading request; source candidate set unchanged. Reason text is not model input.'});
  }else remaining.push(c);
 }
 const subset={...qa,artifact_role:'required_QA_subset_excluding_linked_actual_v4_evidence',original_qa_file:entry.qa_file,original_qa_sha256:entry.qa_sha256,cases:remaining};
 const qaFile=out+'/remaining-required-qa.json';write(qaFile,subset);identities.push({file:qaFile,sha256:hash(qaFile)});
 write(out+'/prior-actual-evidence-reuse.json',{created_at:new Date().toISOString(),manifest_file:manifestFile,runtime_lock:lockFile,set_id:set.id,required_total:qa.cases.length,reused_unique_cases:reused.length,remaining_unique_cases:remaining.length,new_API_calls:0,reused});
 prepared.push({entry,owner,out,qaFile,total:qa.cases.length,reused,remaining:remaining.length});
}
if(prepared.reduce((n,p)=>n+p.total,0)!==835)throw Error('Required total must remain835');
write(control+'/queue-inputs.json',{created_at:new Date().toISOString(),manifest:manifestFile,runtime_lock:lockFile,identities,model:gradingModelName(),required_unique_cases:835,reused_unique_cases:prepared.reduce((n,p)=>n+p.reused.length,0),new_required_unique_cases:prepared.reduce((n,p)=>n+p.remaining,0),sets:prepared.map(p=>({plan_id:p.entry.plan_id,set_id:p.entry.set_id,total:p.total,reused:p.reused.length,remaining:p.remaining,output:p.out})),policy:'one set stream; original actual evidence linked per-case, including unresolved; no v3 reuse; no repeated pending/reconciliation counterexamples without new basis'});
let completed=0;
try{
 for(const [idx,p]of prepared.entries()){
  guard();const n=String(idx+1).padStart(2,'0'),output=p.out+'/author-qa-run1';
  const started={started_at:new Date().toISOString(),job:idx+1,plan_id:p.entry.plan_id,set_id:p.entry.set_id,remaining:p.remaining,reused:p.reused.length,output};write(control+'/job-'+n+'-start.json',started);console.log(JSON.stringify(started));
  let summary=null,code=0;
  if(p.remaining){const fd=fs.openSync(control+'/job-'+n+'-console.log','wx');try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',base+'/run-author-qa.ts','--file',p.entry.file,'--qa',p.qaFile,'--output',output],{stdio:['ignore',fd,fd],env:process.env});child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error('Child signal '+signal)):resolve(code));});}finally{fs.closeSync(fd);}summary=fs.existsSync(output+'/summary.json')?read(output+'/summary.json'):null;
   if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length||summary.recorded_cases!==p.remaining)throw Error('Incomplete child/transport or changed input; no next set');
   if(code!==0&&!(code===1&&summary.mismatched_case_ids.length))throw Error('Unexpected child exit');
  }
  const newMismatch=summary?.mismatched_case_ids??[],reusedMismatch=p.reused.filter(r=>!r.all_matched).map(r=>r.case_id);
  const result={finished_at:new Date().toISOString(),job:idx+1,set_id:p.entry.set_id,plan_id:p.entry.plan_id,required_cases:p.total,reused_unique_cases:p.reused.length,newly_executed_unique_cases:summary?.recorded_cases??0,new_grading_executions:summary?.actual_attempts??0,reused_grading_executions:p.reused.reduce((n,r)=>n+r.records.length,0),unresolved_cases:[...new Set([...newMismatch,...reusedMismatch])],summary_file:summary?output+'/summary.json':null,all_evidence_preserved:true,completed_required_case_coverage:true};
  write(p.out+'/required-case-coverage-summary.json',result);write(control+'/job-'+n+'-result.json',result);console.log(JSON.stringify(result));completed++;guard();
 }
 write(control+'/queue-completed.json',{finished_at:new Date().toISOString(),completed_sets:completed,required_cases:835,results_preserved:true});
}catch(error){write(control+'/queue-stopped.json',{stopped_at:new Date().toISOString(),completed_sets:completed,error:String(error)});console.error(String(error));process.exitCode=1;}
