// Topic-only artifact update when unrelated in-progress source edits block full compilation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {compilePublicQuestionSet,validateQuestionSetV3} from '../../../../lib/questionV3.ts';
import {encryptAuthoringQuestionBankV3,decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const authoring='cpa_uploader/data/cpa_question_sets_v3.authoring.json',pubfile='cpa_uploader/data/cpa_question_sets_v3.public.json',encfile='data/cpa_question_sets_v3.authoring.enc.json';
const bank=JSON.parse(fs.readFileSync(authoring)),sets=bank.filter(s=>s.classification.topic_id==='15');
for(const s of sets){assert.equal(s.status,'published');assert.equal(s.verification.review_status,'verified');assert.deepEqual(validateQuestionSetV3(s,{verifySourceQuotes:true}).errors,[]);}
const pubtext=fs.readFileSync(pubfile,'utf8'),enctext=fs.readFileSync(encfile,'utf8'),secret=process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||'';
const pub=JSON.parse(pubtext),enc=JSON.parse(decryptAuthoringQuestionBankV3(enctext,secret));
const updated=enc.map(s=>sets.find(t=>t.id===s.id)||s),updatedPub=pub.map(s=>{const t=sets.find(t=>t.id===s.id);return t?compilePublicQuestionSet(t):s;});
assert.equal(updated.filter(s=>s.classification.topic_id==='15').length,4);
const plaintext=JSON.stringify(updated,null,2)+'\n',encrypted=encryptAuthoringQuestionBankV3(plaintext,secret);
assert.equal(decryptAuthoringQuestionBankV3(encrypted,secret),plaintext);
assert.equal(fs.readFileSync(pubfile,'utf8'),pubtext);assert.equal(fs.readFileSync(encfile,'utf8'),enctext);
fs.writeFileSync(pubfile,JSON.stringify(updatedPub,null,2)+'\n');fs.writeFileSync(encfile,encrypted);
console.log('Topic 15 synchronized: 4 published sets; source validation and encryption round-trip passed; other topic artifact entries preserved.');
