import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const control=base+'/r02/evidence/phase2/phase-two-v4-focused-control';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const grouped=new Map();
for(const run of read(control+'/completed.json').results){
 const dir=path.dirname(run.summary_file);const summary=read(run.summary_file);
 for(const rr of summary.records){const file=path.join(dir,rr.file);const row=read(file);const key=row.set_id+'/'+row.case_id;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push({file,sha256:sha(file),row});}
}
const cases=[...grouped].map(([key,rows])=>({key,observed:rows.length,scores:rows.map(r=>r.row.result?.score),expected_points:rows[0].row.expected.expected_points,all_matched:rows.every(r=>r.row.matched),errors:rows.filter(r=>r.row.error).length,request_hashes:[...new Set(rows.map(r=>r.row.request_hash))],schema_hashes:[...new Set(rows.map(r=>r.row.schema_hash))],records:rows.map(({file,sha256,row:r})=>({file,sha256,started_at:r.started_at,finished_at:r.finished_at,matched:r.matched,actual_points:r.result?.score,security_flag:r.result?.security_flag,raw_judgment:r.raw_judgment,final_subquestion:r.result?.subquestions.find(q=>q.subquestion_id===r.expected.subquestion_id),differences:r.exact_verdict_differences,error:r.error||null,all_quotes_literal:r.result?.subquestions.every(q=>q.criteria.every(c=>!c.quote||r.answers[q.subquestion_id].includes(c.quote)))??false})),answer:rows[0].row.expected.answer,expected_verdicts:rows[0].row.expected.expected_verdicts}));
const result={created_at:new Date().toISOString(),scope:'16 focused author QA cases only; not full 835 required author QA or semantic review',runtime_lock:read(control+'/inputs.json').runtime_lock,unique_cases:cases.length,grade_executions:cases.reduce((n,c)=>n+c.observed,0),http_request_count:'not inferred from grade executions',all_cases_at_least_three:cases.every(c=>c.observed>=3),all_matched_cases:cases.filter(c=>c.all_matched).length,unresolved_cases:cases.filter(c=>!c.all_matched).map(c=>c.key),input_change_detected:false,process_completed:true,cases};
fs.writeFileSync(control+'/focused-results-investigation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...result,cases:cases.map(({key,observed,scores,all_matched,errors,records})=>({key,observed,scores,all_matched,errors,mismatch_records:records.filter(r=>!r.matched).map(r=>({points:r.actual_points,security:r.security_flag,quotes_literal:r.all_quotes_literal,differences:r.differences,actual_verdicts:r.final_subquestion?.criteria.map(c=>({id:c.criterion_id,verdict:c.verdict,quote:c.quote}))}))}))}));
