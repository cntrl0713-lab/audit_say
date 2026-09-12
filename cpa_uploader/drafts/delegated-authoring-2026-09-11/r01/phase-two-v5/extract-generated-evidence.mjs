// Preserve completed generated-QA failures without changing any receipt.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const folder=path.dirname(fileURLToPath(import.meta.url)),planId=process.argv[2];
if(!['T04-A','T09-A','T09-B','T10-A'].includes(planId))throw Error('Unassigned generated batch');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const directory=path.join(folder,planId.toLowerCase(),'generated5-01');
const summary=read(path.join(directory,'summary.json')),input=read(path.join(directory,'inputs.json'));
const receipt=read(input.semantic_file).reviews[0];
const logs=['initial.grading.jsonl','repeat.grading.jsonl'].map(name=>path.join(directory,name)).filter(f=>fs.existsSync(f));
const events=logs.flatMap(file=>fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map((line,index)=>({file,line:index+1,event:JSON.parse(line)})));
const failed=summary.initial_mismatched_case_ids.map(id=>{
 const observations=events.filter(x=>x.event.id===id&&x.event.status==='completed').map(x=>({...x,file_sha256:sha(x.file)}));
 if(observations.length!==3)throw Error('Expected three observations: '+id+' actual '+observations.length);
 return{id,expected:observations[0].event.expected,answers:observations[0].event.answers,observations,source_cases:receipt.cases.filter(c=>observations[0].event.expected.some(e=>e.unit_id===c.unit_id&&e.case_kind===c.kind&&observations[0].event.answers[e.subquestion_id]===c.answer)),analysis_status:'pending_original_source_target_and_full_answer_investigation'};
});
const output={recorded_at:new Date().toISOString(),plan_id:planId,scope:'완료된 실제 생성 사례 채점의 원 기대·답안·모든 명제 판정·3회 관측을 추출한다. receipt/기대값 수정 또는 수동 검수 생성 없음.',api_calls:0,semantic:{file:input.semantic_file,sha256:sha(input.semantic_file),receipt_hash:receipt.receipt_hash},input_file:{file:path.join(directory,'inputs.json'),sha256:sha(path.join(directory,'inputs.json'))},summary,failed};
fs.writeFileSync(path.join(directory,'failure-evidence.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({plan_id:planId,initial_cases:summary.initial_cases,recorded_executions:summary.recorded_executions,failed:failed.map(f=>({id:f.id,answer:f.answers,expected:f.expected,observations:f.observations.map(o=>({matched:o.event.matched,score:o.event.result.score,verdicts:o.event.judgment.subquestions.filter(s=>Object.keys(f.answers).some(id=>id===s.subquestion_id&&f.answers[id])).flatMap(s=>s.verdicts)}))}))}));
