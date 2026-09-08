import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { compilePublicQuestionSet, validateQuestionSetV3 } from '../../../../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../../../../lib/questionV3Encryption.ts';
const dir='docs/reports/question-review-2027/grading-cases/';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const prior=read(dir+'13-final-validation.json');
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const sets=bank.filter(s=>s.id.startsWith('pilot-13-'));
assert.equal(hash(JSON.stringify(sets)),prior.topic_hash,'topic contract changed');
for(const [file,expected]of Object.entries(prior.code))assert.equal(hash(fs.readFileSync(file)),expected,file);
const pub=read('cpa_uploader/data/cpa_question_sets_v3.public.json');
const decrypted=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY));
for(const set of sets){
 assert.deepEqual(validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()}).errors,[]);
 assert.deepEqual(pub.find(s=>s.id===set.id),compilePublicQuestionSet(set));
 assert.deepEqual(decrypted.find(s=>s.id===set.id),set);
 for(const source of set.source_refs)assert.equal(hash(source.source_quote),source.content_hash);
}
const record={at:new Date().toISOString(),topic:'13',topic_hash:prior.topic_hash,code:prior.code,unchanged_grading_contract:true,new_model_calls:0,prior_effective_scenarios:new Set(prior.effective.map(r=>r.id)).size,sets:sets.map(s=>s.id),public_and_encrypted_match:true,source_validation:true,reason:'문서 링크만 수정. 주제13 데이터·채점 코드 해시가 기존 실측과 동일하므로 의미 채점을 재호출하지 않음.'};
fs.writeFileSync(dir+'13-followup-validation.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
