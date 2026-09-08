import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {gradeQuestionSetV3} from '../../../../lib/questionV3Grading.ts';
import {compilePublicQuestionSet,validateQuestionSetV3} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const d='docs/reports/question-review-2027/grading-cases',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const sets=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json').filter(s=>s.id.startsWith('pilot-16-'));
const cases=read(`${d}/16-v3-cases.json`),logs=['16-live','16-v2-live','16-v3-live'].flatMap(name=>fs.readFileSync(`${d}/${name}.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(line=>({...JSON.parse(line),log:name}))),records=[];
for(const s of sets){assert.deepEqual(validateQuestionSetV3(s,{verifySourceQuotes:true}).errors,[]);for(const src of s.source_refs)assert.equal(src.content_hash,sha(src.source_quote));}
const original=globalThis.fetch;
function response(j){return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(j),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});}
try{for(const c of cases){const s=sets.find(s=>s.id===c.set_id);let promptHash;
globalThis.fetch=async(url,init)=>{promptHash=sha(JSON.parse(init.body).input);return response(c.expected);};
const expectedResult=await gradeQuestionSetV3(s,c.answers,'offline');assert.equal(expectedResult.score,c.expected_score);
if(!promptHash){assert.equal(expectedResult.score,0);records.push({id:c.id,blank_no_model_call:true,score:0});continue;}
const candidates=logs.filter(r=>r.id===c.id&&r.requests[0]?.prompt_sha256===promptHash);
assert.ok(candidates.length>0,`No actual response matches current prompt: ${c.id}`);
for(const r of candidates){assert.ok(!r.error&&!r.differences?.length&&!r.raw_differences?.length,`Mismatch ${r.id}/${r.attempt}`);globalThis.fetch=async()=>response(r.raw_judgment);const result=await gradeQuestionSetV3(s,c.answers,'offline-replay');assert.deepEqual(result,r.result);assert.equal(result.score,c.expected_score);}
records.push({id:c.id,prompt_sha256:promptHash,matching_live:candidates.map(r=>({log:r.log,attempt:r.attempt})),raw_response_replay_equal:true,score:c.expected_score});
}}finally{globalThis.fetch=original;}
const pub=read('cpa_uploader/data/cpa_question_sets_v3.public.json'),enc=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));
for(const s of sets){assert.deepEqual(compilePublicQuestionSet(s),pub.find(p=>p.id===s.id));assert.deepEqual(s,enc.find(p=>p.id===s.id));assert.ok(!/source_quote|critical_facts|requirements|model_answer/.test(JSON.stringify(compilePublicQuestionSet(s))));}
const result={at:new Date().toISOString(),note:'Every final case matched against an actual request hash or verified as blank/model-free. Old changed-prompt results are preserved, excluded from final verification. Replay is not a new model call.',topic_sha256:sha(JSON.stringify(sets)),code_hashes:Object.fromEntries(['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts','app/quiz/QuizClient.tsx','app/actions.ts'].map(p=>[p,sha(fs.readFileSync(p))])),records,source_quotes_and_hashes:true,public_matches:true,encrypted_matches:true,private_source_data_not_in_public:true};
fs.writeFileSync(`${d}/16-final-verification.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:records.length,source:true,public:true,encrypted:true}));
