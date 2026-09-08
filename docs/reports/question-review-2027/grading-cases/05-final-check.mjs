import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { gradeQuestionSetV3,applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
const dir='docs/reports/question-review-2027/grading-cases',bank=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json')).filter(s=>s.classification.topic_id==='05');
const cases=JSON.parse(fs.readFileSync(`${dir}/05-v2-cases.json`)),live=fs.readFileSync(`${dir}/05-v2-live.jsonl`,'utf8').trim().split('\n').map(JSON.parse),meta=JSON.parse(fs.readFileSync(`${dir}/05-v2-run-metadata.json`));
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
assert.equal(sha(JSON.stringify(bank)),meta.hashes.topic,'topic changed after live measurement');
const replay=live.map(r=>{const c=cases.find(c=>c.id===r.id);assert.ok(Object.values(c.answers).every(a=>a.length<=5000));const result=applyQuestionSetJudgment(bank.find(s=>s.id===c.set_id),c.answers,r.raw_judgment);assert.deepEqual(result,r.result);return{id:r.id,attempt:r.attempt,passed:true};});
const hashes=Object.fromEntries(['lib/questionV3.ts','lib/questionV3Grading.ts','lib/questionV3Answer.ts','app/actions.ts','app/quiz/QuizClient.tsx'].map(p=>[p,sha(fs.readFileSync(p))]));
const supplements=[];
for(const [id,qid,answer,metId] of [['pilot-05-005','sub1','이 상황에서 처음부터 수익인식 부정위험이 없다고 평가해서는 안 된다.','crit1'],['pilot-05-006','sub2','형식적 적법성 확인만으로는 충분하지 않다.','crit2']]){
 const s=bank.find(s=>s.id===id);supplements.push({id:`${id}-conclusion-only`,set_id:id,answers:Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qid?answer:''])),expected:{subquestions:s.subquestions.map(q=>({subquestion_id:q.id,verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:q.id===qid&&c.id===metId?'met':'not_met'}))}))}});
}
const target=cases.find(c=>c.id==='05-revenue-assumption-only');
supplements.push({...target,id:'05-revenue-assumption-only-repeat2'},{...target,id:'05-revenue-assumption-only-repeat3'});
const originalFetch=globalThis.fetch;let record;
globalThis.fetch=async(url,init)=>{const request=JSON.parse(init.body);record.request={model:request.model,input:request.input,prompt_sha256:sha(request.input)};const response=await originalFetch(url,init);record.responses.push({status:response.status,body:await response.clone().json()});return response;};
try{for(const c of supplements){record={id:c.id,answers:c.answers,expected:c.expected,at:new Date().toISOString(),responses:[]};record.result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers);record.differences=[];for(const q of c.expected.subquestions)for(const v of q.verdicts){const a=record.result.subquestions.find(a=>a.subquestion_id===q.subquestion_id).criteria.find(a=>a.criterion_id===v.criterion_id);if(a.verdict!==v.verdict)record.differences.push({q:q.subquestion_id,c:v.criterion_id,expected:v.verdict,actual:a.verdict});}fs.appendFileSync(`${dir}/05-final-live.jsonl`,JSON.stringify(record)+'\n');console.log(c.id,record.result.score,record.differences);}}finally{globalThis.fetch=originalFetch;}
fs.writeFileSync(`${dir}/05-final-code-replay.json`,JSON.stringify({hashes,replay,scope:'48 live raw judgments replayed through final score code; only input limit changed since v2, all synthetic answers <=5000'},null,2)+'\n');
