import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { gradeQuestionSetV3, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
const dir='docs/reports/question-review-2027/grading-cases';
const bank=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json'));
const cases=JSON.parse(fs.readFileSync(`${dir}/03-cases.json`));
const good=cases.find(c=>c.id==='pilot-03-001-full'),set=bank.find(s=>s.id===good.set_id);
const rows=[];let judgment=good.expected,calls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({id:'r',object:'response',status:'completed',output:[{type:'message',id:'m',role:'assistant',content:[{type:'output_text',text:JSON.stringify(judgment),annotations:[]}]}]}),{headers:{'Content-Type':'application/json'}});};
for(const [id,mutate] of [
  ['duplicate-subquestion',j=>j.subquestions.push(j.subquestions[0])],
  ['missing-subquestion',j=>j.subquestions.pop()],
  ['unknown-subquestion',j=>j.subquestions[0].subquestion_id='bad'],
  ['duplicate-criterion',j=>j.subquestions[0].verdicts.push(j.subquestions[0].verdicts[0])],
  ['missing-criterion',j=>j.subquestions[0].verdicts.pop()],
  ['unknown-criterion',j=>j.subquestions[0].verdicts[0].criterion_id='bad'],
]){judgment=structuredClone(good.expected);mutate(judgment);await assert.rejects(()=>gradeQuestionSetV3(set,good.answers,'mock'));rows.push({id,passed:true,behavior:'rejects malformed coverage'});}
calls=0;await gradeQuestionSetV3(set,{sub1:'  \n',sub2:''},'');assert.equal(calls,0);rows.push({id:'whitespace-empty-no-model',passed:true,calls});
const overflow=cases.find(c=>c.id==='third-entry-overflow'),oset=bank.find(s=>s.id===overflow.set_id);
judgment=structuredClone(overflow.expected);judgment.subquestions[1].verdicts[1]={criterion_id:'crit5',verdict:'met',quote:'새로운 업무조건을 계약서 또는 기타 적절한 형태의 합의서에 기록한다.'};
const over=await gradeQuestionSetV3(oset,overflow.answers,'mock');assert.equal(over.score,2);rows.push({id:'overflow-code-boundary',expected_score:1,actual_score:over.score,passed:false,result:over});
const scored=applyQuestionSetJudgment(set,good.answers,good.expected);assert.equal(scored.score,scored.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.awarded_points,0),0));assert.ok(scored.score<=scored.max_points);rows.push({id:'sum-and-cap',passed:true});
globalThis.fetch=originalFetch;

// Actual app/actions.ts with isolated auth, quota, store, grader and DB boundaries.
const bundle=await build({entryPoints:['app/actions.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'review-boundaries',setup(b){
  b.onResolve({filter:/lib\/(supabaseServer|dbAdmin|rateLimit|questionV3Store|questionV3Grading)$/},a=>({path:a.path.split('/').at(-1),namespace:'review-mock'}));
  b.onLoad({filter:/.*/,namespace:'review-mock'},a=>({contents:{
    supabaseServer:`export async function assertAuthenticated(){if(globalThis.review03.authFail)throw Error('unauthenticated');return{user:{id:'synthetic-review-user'}};}export const assertAdmin=assertAuthenticated;`,
    dbAdmin:`export async function incrementProgress(id,points){globalThis.review03.progress.push({id,points});if(globalThis.review03.progressFail)throw Error('database unavailable');}export const checkUsernameExists=async()=>false;export const getAllUsers=async()=>[];export const getLeaderboardData=async()=>[];export const updateUserRole=async()=>{};`,
    rateLimit:`export async function consumeGradeQuota(){globalThis.review03.quota++;return !globalThis.review03.limited;}`,
    questionV3Store:`export const findAuthoringQuestionSetV3=()=>globalThis.review03.set;export const loadPublicQuestionSetsV3=()=>[];export const classifyQuestionBankV3LoadError=()=> 'invalid';`,
    questionV3Grading:`export async function gradeQuestionSetV3(){globalThis.review03.grades++;if(globalThis.review03.gradeFail)throw Error('synthetic service failure');return globalThis.review03.result;}`
  }[a.path]}));
}}]});
const actions=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const savedKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='mock-no-network';
function reset(){globalThis.review03={set,result:scored,progress:[],quota:0,grades:0};}
async function check(id,fn){reset();await fn(globalThis.review03);rows.push({id,passed:true,state:{quota:globalThis.review03.quota,grades:globalThis.review03.grades,progress:globalThis.review03.progress}});}
await check('auth-required',async t=>{t.authFail=true;await assert.rejects(()=>actions.gradeQuestionSetV3Action(set.id,good.answers));assert.equal(t.quota,0);});
await check('invalid-set-id',async t=>{await assert.rejects(()=>actions.gradeQuestionSetV3Action('invalid',good.answers));assert.equal(t.quota,0);});
await check('ui-5001-server-reject',async t=>{await assert.rejects(()=>actions.gradeQuestionSetV3Action(set.id,{sub1:'가'.repeat(5001),sub2:'답'}));assert.equal(t.quota,0);});
await check('unknown-slot-quota-consumed-first',async t=>{await assert.rejects(()=>actions.gradeQuestionSetV3Action(set.id,{sub3:'답'}));assert.equal(t.quota,1);assert.equal(t.grades,0);});
await check('zero-no-progress',async t=>{t.result={...scored,score:0};const r=await actions.gradeQuestionSetV3Action(set.id,good.answers);assert.equal(r.ok,true);assert.equal(t.progress.length,0);});
await check('repeated-positive-repeated-progress',async t=>{await actions.gradeQuestionSetV3Action(set.id,good.answers);await actions.gradeQuestionSetV3Action(set.id,good.answers);assert.equal(t.progress.length,2);assert.equal(t.grades,2);});
await check('quota-failure-no-grading',async t=>{t.limited=true;const r=await actions.gradeQuestionSetV3Action(set.id,good.answers);assert.equal(r.code,'rate_limited');assert.equal(t.grades,0);});
await check('missing-key-even-blank',async t=>{delete process.env.OPENAI_API_KEY;try{const r=await actions.gradeQuestionSetV3Action(set.id,{sub1:'',sub2:''});assert.equal(r.code,'grading_key_missing');assert.equal(t.grades,0);}finally{process.env.OPENAI_API_KEY='mock-no-network';}});
await check('progress-failure-rejects-after-grading',async t=>{t.progressFail=true;await assert.rejects(()=>actions.gradeQuestionSetV3Action(set.id,good.answers));assert.equal(t.grades,1);});
if(savedKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=savedKey;
delete globalThis.review03;
fs.writeFileSync(`${dir}/03-boundaries.json`,JSON.stringify({scope:'Actual grading/parsing/scoring and actual actions.ts with synthetic adapters; no production DB/auth E2E',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({result,state,...r})=>r)));
