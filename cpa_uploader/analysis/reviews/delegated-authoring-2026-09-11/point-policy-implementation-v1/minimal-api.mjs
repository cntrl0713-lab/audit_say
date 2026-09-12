import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const work='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/point-policy-implementation-v1';
const planFile=`${work}/minimal-api-plan.json`;
const runner='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const mode=process.argv[2];
if(mode==='prepare'){
 const [manifestFile,lockFile]=process.argv.slice(3);
 const manifest=read(manifestFile),lock=read(lockFile);
 if(manifest.errors.length||hash(manifestFile)!==lock.manifest_sha256)throw Error('Validated fixed inputs required');
 const specs=[
  ['T19-A','sub3/boundary-crit4',1,'01-t19-judgment'],
  ['T19-A','point-policy/sub3/crit6/omission',2,'02-t19-two-parts'],
  ['T19-A','sub3/implicit',3,'03-t19-implicit'],
  ['T08-C','sub2-assumptions-only-missing-data',4,'04-t08-independent-parts'],
  ['T09-C','sub2/point-policy/sub2.crit7/opposite',2,'05-t09-wrong-and'],
  ['T18-A','point-policy/sub3/crit11/condition_boundary',0,'06-t18-given-facts'],
  ['T12-B','q2/point-policy/q2.c1/paraphrase',1,'07-t12-one-opinion'],
 ];
 const jobs=specs.map(([id,caseId,points,label])=>{
  const entry=manifest.entries.find(e=>e.plan_id===id),qa=read(entry.qa_file),sample=qa.cases.find(c=>c.id===caseId);
  if(!sample||sample.expected_points!==points||!sample.answer.trim())throw Error(`Case contract missing: ${id}/${caseId}`);
  return {plan_id:id,set_id:entry.set_id,question_file:entry.file,question_sha256:entry.sha256,qa_file:entry.qa_file,qa_sha256:entry.qa_sha256,
   case_id:caseId,expected:sample,output:`cpa_uploader/drafts/delegated-authoring-2026-09-11/point-policy-minimal-api-v1/${label}`};
 });
 write(planFile,{created_at:new Date().toISOString(),authorization:`${work}/minimal-api-scope.md`,manifest_file:manifestFile,manifest_sha256:hash(manifestFile),runtime_lock_file:lockFile,runtime_lock_sha256:hash(lockFile),planned_cases:jobs.length,jobs});
 console.log(JSON.stringify({planFile,planned_cases:jobs.length,model_calls:0}));
}else if(mode==='run'){
 if(fs.existsSync(`${work}/minimal-api-halt.json`))throw Error('This run stopped after a recorded API error. Preserve it and use a new execution path for any later retry.');
 const plan=read(planFile),lock=read(plan.runtime_lock_file),index=Number(process.argv[3]);
 if(!Number.isInteger(index)||index<1||index>plan.jobs.length)throw Error('One allowlisted case index required');
 const job=plan.jobs[index-1];
 const identities=[{file:plan.runtime_lock_file,sha256:plan.runtime_lock_sha256},{file:plan.manifest_file,sha256:plan.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,
  {file:job.question_file,sha256:job.question_sha256},{file:job.qa_file,sha256:job.qa_sha256}];
 for(const item of identities)if(hash(item.file)!==item.sha256)throw Error(`Fixed input changed: ${item.file}`);
 if(fs.existsSync(job.output))throw Error('Refuse execution output overwrite');
 const result=spawnSync(process.execPath,['--env-file=.env.local','--import','tsx',runner,'--file',job.question_file,'--qa',job.qa_file,'--output',job.output,'--only',job.case_id],{stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}else if(mode==='summarize'){
 const plan=read(planFile),rows=[];
 for(const job of plan.jobs){
  const summaryFile=path.join(job.output,'summary.json');
  if(!fs.existsSync(summaryFile)){rows.push({...job,observed:false});continue;}
  const summary=read(summaryFile),inputs=read(path.join(job.output,'inputs.json'));
  if(inputs.mock!==false||inputs.transport!=='production_gradeQuestionSetV3'||inputs.hashes[job.question_file]!==job.question_sha256||inputs.hashes[job.qa_file]!==job.qa_sha256)throw Error('Actual input/transport identity mismatch');
  const records=summary.records.map(record=>{
   const file=path.join(job.output,record.file),raw=read(file);
   if(raw.case_id!==job.case_id||raw.expected.answer!==job.expected.answer||raw.expected.expected_points!==job.expected.expected_points)throw Error('Actual sample mismatch');
   if(!raw.error&&(raw.transport!=='live_model'||!raw.raw_judgment||!raw.trace?.length))throw Error('Actual model evidence required');
   return {file,sha256:hash(file),attempt:raw.attempt,matched:raw.matched,actual_points:raw.result?.score,error:raw.error||null};
  });
  if(summary.changed_inputs.length||summary.recorded_cases!==1)throw Error('Invalid completed sample');
  rows.push({...job,attempted:true,observed:records.some(r=>Number.isFinite(r.actual_points)&&!r.error),execution_error:records.some(r=>r.error),matched:records.length>0&&records.every(r=>r.matched),summary_file:summaryFile,summary_sha256:hash(summaryFile),records});
 }
 const report={created_at:new Date().toISOString(),manifest_file:plan.manifest_file,manifest_sha256:plan.manifest_sha256,plan_file:planFile,plan_sha256:hash(planFile),planned_cases:plan.jobs.length,
  observed_cases:rows.filter(r=>r.observed).length,matched_cases:rows.filter(r=>r.observed&&r.matched).length,mismatched_cases:rows.filter(r=>r.observed&&!r.matched).length,
  attempted_cases:rows.filter(r=>r.attempted).length,execution_error_cases:rows.filter(r=>r.execution_error).length,
  actual_attempts:rows.reduce((n,r)=>n+(r.records?.length||0),0),rows,full_semantic_review:'not_run',full_grading:'not_run',core_changes:0,canonical_public_changes:0};
 const output=`${work}/minimal-api-result.json`;write(output,report);
 console.log(JSON.stringify({output,planned:report.planned_cases,observed:report.observed_cases,matched:report.matched_cases,mismatched:report.mismatched_cases,execution_errors:report.execution_error_cases,attempts:report.actual_attempts}));
}else throw Error('prepare manifest lock | run 1..7 | summarize');
