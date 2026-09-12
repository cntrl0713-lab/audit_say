import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const snapshot=read(path.join(here,'author-progress-004.json'));
const selected={'T04-A':['q1/irrelevant-prefix'],'T09-A':['q1/opposite'],'T09-B':['q1/condition-boundary','q2/irrelevant-prefix'],'T10-A':['q2/irrelevant-prefix']};
const cases=[];
for(const [planId,ids] of Object.entries(selected))for(const id of ids){
 const set=snapshot.details.find(set=>set.plan_id===planId);
 const records=set.records.filter(record=>record.case_id===id);
 const observations=records.map(record=>{
  const raw=read(record.file),target=raw.result.subquestions.find(sub=>sub.subquestion_id===raw.expected.subquestion_id);
  return {file:record.file,sha256:sha(record.file),model:raw.model,transport:raw.transport,request_hash:raw.request_hash,schema_hash:raw.schema_hash,expected:raw.expected,answers:raw.answers,raw_target:raw.raw_judgment.subquestions.find(sub=>sub.subquestion_id===target.subquestion_id),final_target:target,security_flag:raw.result.security_flag,matched:raw.matched,exact_verdict_differences:raw.exact_verdict_differences};
 });
 if(observations.length<3)throw Error('Insufficient v3 repetitions: '+planId+'/'+id);
 cases.push({plan_id:planId,case_id:id,observed_attempts:observations.length,all_matched:observations.every(observation=>observation.matched),observations});
}
const predecessor=path.join(here,'../phase-two-case-investigation/ledger.json');
const lock='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/runtime-v3-stable/runtime-lock.json';
const output={recorded_at:new Date().toISOString(),scope:'The five historical author QA mismatches, fresh v3 observations only; the original v1/v2 evidence remains unchanged.',predecessor:{file:predecessor,sha256:sha(predecessor)},runtime_lock:{file:lock,sha256:sha(lock)},cases:cases.length,attempts:cases.reduce((sum,item)=>sum+item.observed_attempts,0),all_matched:cases.every(item=>item.all_matched),actual_model_calls_by_this_aggregation_script:0,details:cases};
fs.writeFileSync(path.join(here,'prior-five-failures-v3-followup.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:output.cases,attempts:output.attempts,all_matched:output.all_matched,api_calls:0}));
