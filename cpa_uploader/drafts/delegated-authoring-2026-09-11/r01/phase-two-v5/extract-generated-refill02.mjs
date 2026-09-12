// Preserve completed generated-QA failures. No receipt changes and no API calls.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const planId=process.argv[2],label=process.argv[3]||'generated-bank-v3-refill02-01';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const manifest=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/manifest.json');
const entry=manifest.entries.find(e=>e.plan_id===planId&&['R01','N04','N05','S03'].includes(e.package));
if(!entry||!/^[a-z0-9-]+$/.test(label))throw Error('Unassigned input');
const directory=path.join(entry.output_directory,'phase-two-v5',planId.toLowerCase(),label),summary=read(path.join(directory,'summary.json')),input=read(path.join(directory,'inputs.json'));
const receipt=read(input.semantic_file).reviews.find(r=>r.set_id===entry.set_id);
const logs=['initial.grading.jsonl','repeat.grading.jsonl'].map(name=>path.join(directory,name)).filter(f=>fs.existsSync(f));
const events=logs.flatMap(file=>fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map((line,index)=>({file,line:index+1,event:JSON.parse(line)})));
const failed=summary.initial_mismatched_case_ids.map(id=>{
 const observations=events.filter(x=>x.event.id===id&&x.event.status==='completed').map(x=>({...x,file_sha256:sha(x.file)}));
 if(observations.length!==3)throw Error('Need three valid observations');
 return{id,expected:observations[0].event.expected,answers:observations[0].event.answers,observations,source_cases:receipt.cases.filter(c=>observations[0].event.expected.some(e=>e.unit_id===c.unit_id&&e.case_kind===c.kind&&observations[0].event.answers[e.subquestion_id]===c.answer)),analysis_status:'pending_original_source_target_and_full_answer_review'};
});
const result={recorded_at:new Date().toISOString(),plan_id:planId,api_calls:0,semantic:{file:input.semantic_file,sha256:sha(input.semantic_file),receipt_hash:receipt.receipt_hash},inputs:{file:path.join(directory,'inputs.json'),sha256:sha(path.join(directory,'inputs.json'))},summary,failed,original_receipts_unchanged:true};
fs.writeFileSync(path.join(directory,'failure-evidence.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({plan_id:planId,initial:summary.initial_cases,valid_observations:summary.recorded_executions,failures:failed.map(f=>({id:f.id,answers:f.answers,expected:f.expected,scores:f.observations.map(o=>o.event.result.score),matches:f.observations.map(o=>o.event.matched)}))}));
