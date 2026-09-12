// Aggregate preserved v4 and unchanged-grader v5 observations. No API calls.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const lockFile=control+'/runtime-v5-bank-v3-after-refill-01/runtime-lock.json';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lock=read(lockFile),manifest=read(lock.manifest_file);
const priorFile=path.join(directory,'../phase-two-v4/author-progress-007-runtime-transition.json'),prior=read(priorFile);
const transitionFile=path.join(directory,'transition-preflight.json'),transition=read(transitionFile);
if(sha(transition.new_lock.file)!==transition.new_lock.sha256)throw Error('Original transition lock changed');
const transitionLock=read(transition.new_lock.file);for(const key of ['code_files','source_files','settings'])if(JSON.stringify(lock[key])!==JSON.stringify(transitionLock[key]))throw Error('Grading contract changed '+key);
if(sha(lock.manifest_file)!==lock.manifest_sha256)throw Error('Manifest changed');
const sets=manifest.entries.filter(e=>['R01','N04','N05','S03'].includes(e.package)).map(entry=>{
 const previous=prior.details.find(d=>d.plan_id===entry.plan_id);
 const records=[...previous.records],summaries=[...previous.summaries];
 const folder=path.join(path.dirname(entry.file),'phase-two-v5',entry.plan_id.toLowerCase());
 const files=fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>name.startsWith('author5')).map(name=>path.join(folder,name,'author-qa/summary.json')).filter(file=>fs.existsSync(file)):[];
 for(const file of files){const summary=read(file);summaries.push({file,sha256:sha(file),stopped_on_execution_error:summary.stopped_on_execution_error,changed_inputs:summary.changed_inputs});for(const item of summary.records){const recordFile=path.join(path.dirname(file),item.file),r=read(recordFile),sub=r.result?.subquestions?.find(s=>s.subquestion_id===r.expected.subquestion_id);records.push({file:recordFile,sha256:sha(recordFile),case_id:r.case_id,attempt:r.attempt,transport:r.transport,matched:r.matched,error:r.error??null,points:sub?.score??null,trace_events:r.trace?.length??0,exact_verdict_differences:r.exact_verdict_differences??[],verdict_differences:r.verdict_differences??[],version:'v5_same_grader_as_v4'});}}
 for(const r of records)if(sha(r.file)!==r.sha256)throw Error('Observation changed '+r.file);
 if(sha(entry.file)!==entry.sha256||sha(entry.qa_file)!==entry.qa_sha256)throw Error('Question/QA changed '+entry.plan_id);
 const valid=records.filter(r=>!r.error&&['live_model','production_empty_answer_no_model'].includes(r.transport));
 const qa=read(entry.qa_file),observed=new Set(valid.map(r=>r.case_id)),missing=qa.cases.filter(c=>!observed.has(c.id)).map(c=>c.id),failures=[...new Set(valid.filter(r=>r.matched===false).map(r=>r.case_id))];
 return{plan_id:entry.plan_id,set_id:entry.set_id,package:entry.package,expected_cases:entry.qa_cases,observed_unique_cases:observed.size,full_case_coverage:missing.length===0,missing_case_ids:missing,mismatched_case_ids:failures,recorded_attempts:records.length,valid_observations:valid.length,failed_transport_attempts:records.length-valid.length,live_model_attempts:records.filter(r=>r.transport==='live_model').length,production_no_model_attempts:records.filter(r=>r.transport==='production_empty_answer_no_model').length,reused_model_observations:records.filter(r=>r.reused).length,trace_events:records.reduce((sum,r)=>sum+r.trace_events,0),failure_repetitions:failures.map(id=>({case_id:id,observations:valid.filter(r=>r.case_id===id).length,scores:valid.filter(r=>r.case_id===id).map(r=>r.points),matches:valid.filter(r=>r.case_id===id).map(r=>r.matched)})),summaries,records};
});
const sum=key=>sets.reduce((total,s)=>total+s[key],0);
const report={recorded_at:new Date().toISOString(),scope:'Assigned 16 sets: preserved v4 completed 7 sets plus v5 author5-prefixed completed runs with the same grader, model, question, plan, QA and source inputs. Only valid completed judgments count towards unique case coverage; timeout attempts remain separate records. T14-A authorized QA followup is linked separately, leaving original expectations historical. Experimental T12-A v2 and all generated QA excluded.',runtime_lock:{file:lockFile,sha256:sha(lockFile)},manifest:{file:lock.manifest_file,sha256:sha(lock.manifest_file)},prior_snapshot:{file:priorFile,sha256:sha(priorFile)},transition_proof:{file:transitionFile,sha256:sha(transitionFile)},sets:sets.length,completed_sets:sets.filter(s=>s.full_case_coverage).length,expected_unique_cases:sum('expected_cases'),observed_unique_cases:sum('observed_unique_cases'),recorded_attempts:sum('recorded_attempts'),valid_observations:sum('valid_observations'),failed_transport_attempts:sum('failed_transport_attempts'),live_model_attempts:sum('live_model_attempts'),production_no_model_attempts:sum('production_no_model_attempts'),reused_model_observations:sum('reused_model_observations'),mismatched_case_count:sets.reduce((total,s)=>total+s.mismatched_case_ids.length,0),trace_events:sum('trace_events'),details:sets};
if(process.argv[2]){const output=path.resolve(process.argv[2]),allowed=path.resolve(directory)+path.sep;if(!output.toLowerCase().startsWith(allowed.toLowerCase()))throw Error('Output outside owned folder');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({...report,details:sets.map(({summaries,records,missing_case_ids,...s})=>({...s,missing_case_count:missing_case_ids.length}))},null,2));
