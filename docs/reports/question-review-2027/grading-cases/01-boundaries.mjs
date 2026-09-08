import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import { build } from 'esbuild';
import { gradeQuestionSetV3, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet,isQuestionSetAnswerPayloadV3 } from '../../../../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../../../../lib/questionV3Encryption.ts';
const dir='docs/reports/question-review-2027/grading-cases';
const paths=['cpa_uploader/data/cpa_question_sets_v3.authoring.json','cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json','lib/questionV3.ts','lib/questionV3Grading.ts','app/actions.ts','app/quiz/QuizClient.tsx','lib/ai/openaiStructured.ts'];
const hashes=Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const bank=JSON.parse(fs.readFileSync(paths[0]));const topic=bank.filter(s=>s.classification.topic_id==='01');
assert.deepEqual(JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync(paths[2],'utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY)),bank);
assert.deepEqual(JSON.parse(fs.readFileSync(paths[1])),bank.map(compilePublicQuestionSet));
const cases=JSON.parse(fs.readFileSync(`${dir}/01-cases.json`));let checks=[];
for(const s of topic)for(const q of s.subquestions)for(const c of q.criteria){
  const base=cases.find(x=>x.id===`${s.id}-full`);const j=structuredClone(base.expected);
  j.subquestions.find(x=>x.subquestion_id===q.id).verdicts.find(x=>x.criterion_id===c.id).verdict='partial';
  const r=applyQuestionSetJudgment(s,base.answers,j);assert.equal(r.subquestions.find(x=>x.subquestion_id===q.id).criteria.find(x=>x.criterion_id===c.id).awarded_points,0);
  checks.push({kind:'partial_disallowed',id:`${s.id}/${q.id}/${c.id}`,passed:true});
}
const originalFetch=globalThis.fetch;
for(const kind of ['missing-question','duplicate-question','unknown-question','missing-criterion','duplicate-criterion','unknown-criterion']){
  const j=structuredClone(cases[0].expected);
  if(kind==='missing-question')j.subquestions.pop();
  if(kind==='duplicate-question')j.subquestions.push(j.subquestions[0]);
  if(kind==='unknown-question')j.subquestions[0].subquestion_id='unknown';
  if(kind==='missing-criterion')j.subquestions[0].verdicts.pop();
  if(kind==='duplicate-criterion')j.subquestions[0].verdicts.push(j.subquestions[0].verdicts[0]);
  if(kind==='unknown-criterion')j.subquestions[0].verdicts[0].criterion_id='unknown';
  globalThis.fetch=async()=>new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(j),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
  await assert.rejects(gradeQuestionSetV3(topic[0],cases[0].answers,'offline-key'));checks.push({kind,passed:true});
}
globalThis.fetch=originalFetch;
assert.equal(isQuestionSetAnswerPayloadV3({sub1:'가'.repeat(5001)}),false);
const mockCode={
 supabaseServer:'export async function assertAuthenticated(){return{user:{id:"isolated-user"}}} export async function assertAdmin(){}',
 dbAdmin:'export async function incrementProgress(){globalThis.__auditMock.progress++;return false} export const checkUsernameExists=async()=>false,getAllUsers=async()=>[],getLeaderboardData=async()=>[],updateUserRole=async()=>true;',
 rateLimit:'export async function consumeGradeQuota(){globalThis.__auditMock.quota++;return true}',
 questionV3Store:'export function findAuthoringQuestionSetV3(){return globalThis.__auditMock.set} export function loadPublicQuestionSetsV3(){return []} export function classifyQuestionBankV3LoadError(){return "invalid"}',
 questionV3Grading:'export async function gradeQuestionSetV3(){return globalThis.__auditMock.result}'
};
const compiled=await build({entryPoints:['app/actions.ts'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'isolate-infrastructure',setup(b){b.onResolve({filter:/^\.\.\/lib\//},a=>{const name=a.path.split('/').at(-1);if(mockCode[name])return{path:name,namespace:'mock'};});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mockCode[a.path]}));}}]});
const mod=new Module('audit-action.cjs');mod.filename='audit-action.cjs';mod.paths=Module._nodeModulePaths(process.cwd());mod._compile(compiled.outputFiles[0].text,'audit-action.cjs');
globalThis.__auditMock={quota:0,progress:0,set:topic[0],result:{score:5}};
const action=mod.exports.gradeQuestionSetV3Action;
await assert.rejects(action(topic[0].id,{sub1:'가'.repeat(5001)}));assert.equal(globalThis.__auditMock.quota,0);
await assert.rejects(action(topic[0].id,{unknown:'답안'}));assert.equal(globalThis.__auditMock.quota,1);
const first=await action(topic[0].id,cases[0].answers),second=await action(topic[0].id,cases[0].answers);
assert.equal(first.ok,true);assert.equal(second.ok,true);assert.equal(globalThis.__auditMock.progress,2);
const observations={server_5001_rejected:true,invalid_question_id_consumes_quota:true,progress_failure_still_returns_success:true,repeated_submission_progress_calls:2};
delete globalThis.__auditMock;
fs.writeFileSync(`${dir}/01-boundaries.json`,JSON.stringify({hashes,authoring_public_encrypted_equal:true,checks,observations,working_tree:execFileSync('git',['status','--short'],{encoding:'utf8'}),limitations:'server action uses isolated auth/quota/grading/progress adapters; real database side effects not executed'},null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,...observations,authoring_public_encrypted_equal:true}));
