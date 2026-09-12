// Collect already completed observations for manual investigation; no grading or edits.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const planId=process.argv[2],label=process.argv[3]||'author5';
if(!/^author5[-a-z0-9]*$/.test(label))throw Error('Invalid author run label');
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestFile=control+'/final-153-v2/manifest.json',entry=read(manifestFile).entries.find(e=>e.plan_id===planId);
if(!entry||!['R01','N04','N05','S03'].includes(entry.package))throw Error('Unassigned ID');
const directory=path.join(path.dirname(entry.file),'phase-two-v5',planId.toLowerCase(),label);
const summaryFile=path.join(directory,'author-qa/summary.json'),summary=read(summaryFile),set=read(entry.file),qa=read(entry.qa_file);
if(summary.recorded_cases!==entry.qa_cases||summary.stopped_on_execution_error||summary.changed_inputs.length)throw Error('Set not complete or input guard failed');
if(sha(entry.file)!==entry.sha256||sha(entry.qa_file)!==entry.qa_sha256)throw Error('Fixed question/QA changed');
const failed=summary.mismatched_case_ids.map(id=>{
 const expected=qa.cases.find(c=>c.id===id),sub=set.subquestions.find(s=>s.id===expected.subquestion_id);
 const observations=summary.records.filter(r=>r.case_id===id).map(r=>{const file=path.join(directory,'author-qa',r.file),o=read(file);return{file,sha256:sha(file),attempt:o.attempt,model:o.model,transport:o.transport,started_at:o.started_at,finished_at:o.finished_at,request_hash:o.request_hash,schema_hash:o.schema_hash,score:o.result?.subquestions?.find(s=>s.subquestion_id===expected.subquestion_id)?.score,judgments:o.raw_judgment?.subquestions?.find(s=>s.subquestion_id===expected.subquestion_id)?.verdicts,matched:o.matched,exact_verdict_differences:o.exact_verdict_differences,verdict_differences:o.verdict_differences,security_flag:o.result?.security_flag,error:o.error??null};});
 if(observations.length<3)throw Error('Failure fewer than 3 observations '+id);
 const controls=summary.records.filter(r=>r.case_id.startsWith(sub.id+'/')&&(/model|opposite|true-omission|single-sentence|irrelevant-prefix/.test(r.case_id))).map(r=>{const file=path.join(directory,'author-qa',r.file),o=read(file);return{id:r.case_id,file,sha256:sha(file),answer:o.expected.answer,expected_points:o.expected.expected_points,score:o.result?.subquestions?.find(s=>s.subquestion_id===expected.subquestion_id)?.score,matched:o.matched};});
 return{id,expected,subquestion:sub,observations,unique_request_hashes:[...new Set(observations.map(o=>o.request_hash))],unique_schema_hashes:[...new Set(observations.map(o=>o.schema_hash))],controls,analysis_status:'pending_independent_original_text_and_full_answer_review'};
});
const evidence={recorded_at:new Date().toISOString(),scope:'실행 완료한 작성자 QA의 불일치와 원문·답안·scope 증거 추출. 이 파일만으로 모델 결함 또는 기대값 오류를 판정하지 않는다.',api_calls:0,plan_id:planId,set_id:entry.set_id,input:{file:entry.file,sha256:sha(entry.file),qa_file:entry.qa_file,qa_sha256:sha(entry.qa_file),plan_files:entry.plan_files},summary:{file:summaryFile,sha256:sha(summaryFile)},shared_context:set.shared_context,source_refs:set.source_refs.map(s=>({...s,file_sha256:sha(s.file),exact_quote_present:fs.readFileSync(s.file,'utf8').includes(s.source_quote)})),failed};
const output=path.join(directory,'failure-evidence.json');fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({plan_id:planId,failed:failed.map(f=>({id:f.id,expected:f.expected.expected_points,scores:f.observations.map(o=>o.score),differences:f.observations.map(o=>o.verdict_differences)})),source_quotes_present:evidence.source_refs.every(s=>s.exact_quote_present),api_calls:0}));
