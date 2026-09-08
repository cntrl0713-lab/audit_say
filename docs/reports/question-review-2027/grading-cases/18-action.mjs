// Execute the real action with isolated auth/store/quota/grader/progress adapters.
import { build } from 'esbuild';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const state={auth:0,quota:0,grade:0,progress:0};globalThis.__review18Action=state;
const stub={
 'supabaseServer':`export async function assertAuthenticated(){globalThis.__review18Action.auth++;return{user:{id:'synthetic-review-user'}}}export const assertAdmin=assertAuthenticated;`,
 'dbAdmin':`export const checkUsernameExists=async()=>false,getAllUsers=async()=>[],getLeaderboardData=async()=>[],updateUserRole=async()=>true;export async function incrementProgress(){globalThis.__review18Action.progress++;return true;}`,
 'rateLimit':`export async function consumeGradeQuota(){globalThis.__review18Action.quota++;return true;}`,
 'questionV3Store':`export const classifyQuestionBankV3LoadError=()=> 'invalid_data',loadPublicQuestionSetsV3=()=>[];export function findAuthoringQuestionSetV3(id){if(id!=='pilot-18-001')throw Error('missing synthetic set');return{id,subquestions:[{id:'subq1'},{id:'subq2'}]};}`,
 'questionV3Grading':`export async function gradeQuestionSetV3(s,answers){globalThis.__review18Action.grade++;return{question_set_id:s.id,score:0,max_points:3,subquestions:[],security_flag:'none'}}`
};
const outfile='tmp/review18-action.mjs';
await build({entryPoints:['app/actions.ts'],outfile,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'review-adapters',setup(b){b.onResolve({filter:/lib\/(supabaseServer|dbAdmin|rateLimit|questionV3Store|questionV3Grading)$/},a=>({path:a.path.split('/').at(-1),namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:stub[a.path]}));}}]});
const {gradeQuestionSetV3Action:action}=await import('../../../../tmp/review18-action.mjs');
const key=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
const checks=[];
try{
 assert.equal((await action('pilot-18-001',{subq1:'',subq2:' '})).ok,true);assert.equal(state.quota,0);assert.equal(state.grade,1);checks.push('blank without key/quota');
 await assert.rejects(action('pilot-18-001',{wrong:''}),/속하지/);assert.equal(state.quota,0);checks.push('foreign question before quota');
 await assert.rejects(action('pilot-18-001',{subq1:'x'.repeat(5001)}),/허용된/);assert.equal(state.grade,1);checks.push('5001 rejected before grading');
 assert.equal((await action('pilot-18-001',{subq1:'답안'})).code,'grading_key_missing');assert.equal(state.quota,0);checks.push('nonblank requires key before quota');
 process.env.OPENAI_API_KEY='synthetic-key';assert.equal((await action('pilot-18-001',{subq1:'x'.repeat(5000),subq2:''})).ok,true);assert.equal(state.quota,1);assert.equal(state.grade,2);assert.equal(state.progress,0);checks.push('5000 + partial blank accepted, one quota, zero-score no progress');
}finally{if(key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=key;}
const result={scope:'actual action; adapters mocked, no production user or DB',checks,state};fs.writeFileSync('docs/reports/question-review-2027/grading-cases/18-action-results.json',JSON.stringify(result,null,2)+'\n');console.log(result);
