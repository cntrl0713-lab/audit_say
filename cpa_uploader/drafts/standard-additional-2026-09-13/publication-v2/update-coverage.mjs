import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash} from '../../../analysis/coverage/build-coverage.mjs';
const D='cpa_uploader/drafts/standard-additional-2026-09-13',P=D+'/publication-v2';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),file='cpa_uploader/analysis/coverage/links.json',bytes=fs.readFileSync(file,'utf8'),ledger=JSON.parse(bytes);
const rows=ledger.links.filter(l=>l.id.startsWith('standard-additional-20260913-'));assert.equal(rows.length,3);
const old=structuredClone(rows);
for(const l of rows){assert.equal(l.target.scope,'draft');const draft=read(l.target.file),set=bank.find(s=>s.id===l.target.set_id),question=set?.subquestions.find(q=>q.id===l.target.subquestion_id);assert(set&&question&&set.status==='published');assert.deepEqual(set.subquestions,draft.subquestions);assert.deepEqual(set.source_refs,draft.source_refs);assert.equal(questionHash(set,question),l.snapshot.question_sha256);l.target={scope:'bank',set_id:set.id,subquestion_id:question.id,criterion_ids:l.target.criterion_ids};l.provenance.publication={file:P+'/install-completion.json',sha256:sha(fs.readFileSync(P+'/install-completion.json')),content_identity:'발문·답안·criterion·출처가 기존 초안과 동일함을 재대조. 원 의미 관계와 검토 해시 유지.'};}
assert.equal(fs.readFileSync(file,'utf8'),bytes,'동시 관계 장부 변경');
fs.writeFileSync(P+'/coverage-before.json',JSON.stringify(old,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(P+'/coverage-promotion.json',JSON.stringify({from:'draft',to:'bank',links:rows,input_hash:sha(bytes),output_hash:sha(fs.readFileSync(file)),meaning_unchanged:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({promoted_links:rows.length}));
