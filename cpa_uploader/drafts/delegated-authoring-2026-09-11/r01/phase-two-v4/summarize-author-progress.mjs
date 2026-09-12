// Read-only evidence aggregation; an optional new JSON path preserves a snapshot.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const entries=read(manifestFile).entries.filter(entry=>['R01','N04','N05','S03'].includes(entry.package));
const reuseIndex=read(path.join(base,'r01/phase-two-v4/reuse-index.json'));
const sets=entries.map(entry=>{
 const folder=path.join(path.dirname(entry.file),'phase-two-v4',entry.plan_id.toLowerCase());
 const runs=fs.existsSync(folder)?fs.readdirSync(folder).filter(name=>name.startsWith('author4')).map(name=>path.join(folder,name,'author-qa','summary.json')).filter(file=>fs.existsSync(file)):[];
 const records=[],summaries=[];
 for(const file of runs){
  const summary=read(file);summaries.push({file,sha256:hash(file),stopped_on_execution_error:summary.stopped_on_execution_error,changed_inputs:summary.changed_inputs});
  for(const item of summary.records){
   const recordFile=path.join(path.dirname(file),item.file),record=read(recordFile);
   const sub=record.result?.subquestions?.find(sub=>sub.subquestion_id===record.expected.subquestion_id);
   records.push({file:recordFile,sha256:hash(recordFile),case_id:record.case_id,attempt:record.attempt,transport:record.transport,matched:record.matched,error:record.error??null,trace_events:record.trace?.length??0,points:sub?.score??null,exact_verdict_differences:record.exact_verdict_differences??[],verdict_differences:record.verdict_differences??[]});
  }
 }
 const reuse=reuseIndex.entries.find(item=>item.plan_id===entry.plan_id);
 for(const item of reuse?.cases??[])for(const observation of item.observations){
  if(hash(observation.file)!==observation.sha256)throw Error('Reused observation changed');
  const record=read(observation.file),sub=record.result?.subquestions?.find(sub=>sub.subquestion_id===record.expected.subquestion_id);
  records.push({file:observation.file,sha256:observation.sha256,case_id:record.case_id,attempt:record.attempt,transport:record.transport,matched:record.matched,error:record.error??null,trace_events:record.trace?.length??0,points:sub?.score??null,exact_verdict_differences:record.exact_verdict_differences??[],verdict_differences:record.verdict_differences??[],reused:true});
 }
 const observedCases=new Set(records.map(record=>record.case_id));
 const expectedCases=read(entry.qa_file).cases.map(sample=>sample.id);
 const missing=expectedCases.filter(id=>!observedCases.has(id));
 return {plan_id:entry.plan_id,set_id:entry.set_id,package:entry.package,expected_cases:entry.qa_cases,observed_unique_cases:observedCases.size,recorded_attempts:records.length,live_model_attempts:records.filter(record=>record.transport==='live_model').length,production_no_model_attempts:records.filter(record=>record.transport==='production_empty_answer_no_model').length,other_transports:[...new Set(records.map(record=>record.transport))].filter(transport=>!['live_model','production_empty_answer_no_model'].includes(transport)),trace_events:records.reduce((sum,record)=>sum+record.trace_events,0),mismatched_case_ids:[...new Set(records.filter(record=>record.matched===false).map(record=>record.case_id))],exact_difference_attempts:records.filter(record=>record.exact_verdict_differences.length).length,missing_case_ids:missing,full_case_coverage:missing.length===0,summaries,records};
});
const report={recorded_at:new Date().toISOString(),artifact_type:'author_qa_progress_snapshot',manifest_file:manifestFile,manifest_sha256:hash(manifestFile),scope:'R01/N04/N05/S03 phase-two-v4 author4-prefixed finished runs only; supplemental T09-B comparison and generated QA are separate.',sets:sets.length,expected_unique_cases:sets.reduce((sum,set)=>sum+set.expected_cases,0),completed_case_coverage_sets:sets.filter(set=>set.full_case_coverage).length,observed_unique_cases:sets.reduce((sum,set)=>sum+set.observed_unique_cases,0),recorded_attempts:sets.reduce((sum,set)=>sum+set.recorded_attempts,0),live_model_attempts:sets.reduce((sum,set)=>sum+set.live_model_attempts,0),production_no_model_attempts:sets.reduce((sum,set)=>sum+set.production_no_model_attempts,0),trace_events:sets.reduce((sum,set)=>sum+set.trace_events,0),mismatched_case_count:sets.reduce((sum,set)=>sum+set.mismatched_case_ids.length,0),details:sets};
report.reused_model_observations=sets.flatMap(set=>set.records).filter(record=>record.reused).length;
report.new_live_model_attempts=sets.flatMap(set=>set.records).filter(record=>record.transport==='live_model'&&!record.reused).length;
report.scope='R01/N04/N05/S03 v4 author4-prefixed finished runs plus the exactly verified eight original-case v4 reuse links. Experimental T12-A v2 excluded. Reuse is not an additional model invocation.';
if(process.argv[2]){
 const output=path.resolve(process.argv[2]),allowed=path.resolve(base,'r01','phase-two-v4')+path.sep;
 if(!output.toLowerCase().startsWith(allowed.toLowerCase()))throw Error('Output must stay in the assigned R01 phase-two-v4 folder');
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({...report,details:sets.map(({summaries,records,missing_case_ids,...set})=>({...set,missing_case_count:missing_case_ids.length}))},null,2));
