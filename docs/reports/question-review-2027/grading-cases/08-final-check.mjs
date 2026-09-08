import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {gradeQuestionSetV3,applyQuestionSetJudgment} from '../../../../lib/questionV3Grading.ts';
import {compilePublicQuestionSet,validateQuestionSetV3} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const d='docs/reports/question-review-2027/grading-cases',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const sets=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json').filter(s=>s.id.startsWith('pilot-08-'));
const cases=read(`${d}/08-cases.json`),live=fs.readFileSync(`${d}/08-live.jsonl`,'utf8').trim().split('\n').map(JSON.parse),meta=read(`${d}/08-run-metadata.json`);
assert.equal(live.length,94);assert.ok(live.every(r=>!r.error&&!r.differences.length&&!r.raw_differences.length));
for(const s of sets){assert.deepEqual(validateQuestionSetV3(s,{verifySourceQuotes:true}).errors,[]);for(const src of s.source_refs)assert.equal(src.content_hash,sha(src.source_quote));}
const original=globalThis.fetch,records=[];
try{for(const r of live){const c=cases.find(c=>c.id===r.id),s=sets.find(s=>s.id===c.set_id);let promptHash;
globalThis.fetch=async(url,init)=>{promptHash=sha(JSON.parse(init.body).input);return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(r.raw_judgment),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});};
const result=await gradeQuestionSetV3(s,c.answers,'offline-replay');assert.equal(promptHash,r.requests[0].prompt_sha256);assert.deepEqual(result,r.result);records.push({id:r.id,prompt_unchanged:true,raw_response_replay_equal:true});
}}finally{globalThis.fetch=original;}
const pub=read('cpa_uploader/data/cpa_question_sets_v3.public.json'),enc=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));
for(const s of sets){assert.deepEqual(compilePublicQuestionSet(s),pub.find(p=>p.id===s.id));assert.deepEqual(s,enc.find(p=>p.id===s.id));assert.ok(!/source_quote|critical_facts|requirements|model_answer/.test(JSON.stringify(compilePublicQuestionSet(s))));}
const result={at:new Date().toISOString(),live_fingerprint:meta.fingerprint,note:'Source page/title metadata corrected after live run. All 94 final prompts are byte-identical to live input; raw replies replay identically. No prior cache relabelled as new live calls.',topic_sha256:sha(JSON.stringify(sets)),code_hashes:Object.fromEntries(['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts','app/quiz/QuizClient.tsx','app/actions.ts'].map(p=>[p,sha(fs.readFileSync(p))])),records,source_quotes_and_hashes:true,public_matches:true,encrypted_matches:true,private_source_data_not_in_public:true};
fs.writeFileSync(`${d}/08-final-verification.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({replayed:records.length,source:true,public:true,encrypted:true}));
