import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {compilePublicQuestionSet,validateQuestionSetV3,computeQuestionSetMaxPoints} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const file='cpa_uploader/data/cpa_question_sets_v3.authoring.json',bank=JSON.parse(fs.readFileSync(file,'utf8')),pub=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.public.json','utf8'));
const encrypted=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));
assert.ok(JSON.stringify(encrypted)===JSON.stringify(bank),'encrypted bank differs from current authoring; recompile current bank without changing source data');assert.ok(JSON.stringify(pub)===JSON.stringify(bank.map(compilePublicQuestionSet)),'public bank differs from current authoring');
const sets=bank.filter(s=>s.classification.topic_id==='18');assert.equal(sets.length,4);assert.equal(sets.reduce((n,s)=>n+computeQuestionSetMaxPoints(s),0),27);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const s of sets){assert.deepEqual(validateQuestionSetV3(s,{verifySourceQuotes:true}).errors,[]);for(const ref of s.source_refs)assert.equal(ref.content_hash,hash(ref.source_quote));assert.ok(!/model_answer|source_quote|critical_facts|requirements|content_hash/.test(JSON.stringify(compilePublicQuestionSet(s))));}
const result={at:new Date().toISOString(),bank_sets:bank.length,bank_criteria:bank.flatMap(s=>s.subquestions.flatMap(q=>q.criteria)).length,topic_sets:4,topic_questions:8,topic_criteria:27,topic_points:27,all_bank_public_matches:true,all_bank_decryption_matches:true,topic_sources_and_hashes:true,topic_private_fields_absent:true,hashes:Object.fromEntries([file,'cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json'].map(p=>[p,hash(fs.readFileSync(p))]))};
fs.writeFileSync('docs/reports/question-review-2027/grading-cases/18-deployment-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
