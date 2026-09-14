// KGA 약칭을 고친 물음을 가리키는 coverage 관계 2건을 다시 대조하고 확인 당시 해시와 이력을 남긴다.
// 발문 표기(KGA 240 → 감사기준서 240)만 바뀌어 요소↔criterion 대응·관계 판정은 같다. 해시만 바꾸지 않고 의미 재대조 근거를 함께 기록한다.
//   node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2/update-coverage.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash} from '../../../coverage/build-coverage.mjs';
const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const installed=read(F+'/publication-v1/install-completion.json');assert.equal(installed.status,'canonical_installed_and_validated');
const changes=read(F+'/changes.json'),bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),old=read(F+'/baseline/authoring.json');
const file='cpa_uploader/analysis/coverage/links.json',bytes=fs.readFileSync(file,'utf8'),ledger=JSON.parse(bytes);
const REVIEW={
 'frequency-gap-2026-09-10-G-1':'연결 criterion crit1(보고 요구를 포함한 책임 결정)·crit2(법규상 가능 시 해지 고려)는 그대로다. 발문의 "KGA 240 문단 39(a)~(b)"를 "감사기준서 240 문단 39(a)~(b)"로 바꾼 표기뿐이라, 감사 계속불가 시 세 절차를 묻는 원발문과의 partial 관계가 같다.',
 'frequency-gap-2026-09-10-G-2':'연결 criterion crit1·crit2는 그대로다. 발문 약칭만 감사기준서로 바뀌어, 부정 인지·경영진 진술거부로 계속수행 능력에 의문이 생긴 원발문과의 partial 관계가 같다.',
};
const rows=ledger.links.filter(l=>l.target&&changes.changed_sets.includes(l.target.set_id));
assert.deepEqual(rows.map(l=>l.id).sort(),Object.keys(REVIEW).sort(),'대상 관계 집합이 검토 목록과 다르다');
const before=structuredClone(rows);
for(const l of rows){
 assert.equal((l.target.scope??'bank'),'bank');
 const prev=old.find(s=>s.id===l.target.set_id),next=bank.find(s=>s.id===l.target.set_id);
 const pq=prev.subquestions.find(q=>q.id===l.target.subquestion_id),nq=next.subquestions.find(q=>q.id===l.target.subquestion_id);
 assert.equal(l.snapshot.question_sha256,questionHash(prev,pq),'수정 전에도 이미 오래된 관계다: '+l.id);
 for(const c of l.target.criterion_ids)assert(nq.criteria.some(k=>k.id===c),'criterion 없음: '+l.id);
 assert.deepEqual(nq.criteria.map(c=>[c.id,c.claim,c.critical_facts]),pq.criteria.map(c=>[c.id,c.claim,c.critical_facts]),'criterion이 바뀌었다');
 const next_hash=questionHash(next,nq);assert.notEqual(next_hash,l.snapshot.question_sha256);
 l.review_history=[...(l.review_history??[]),{reviewed_at:'2026-09-14',reviewer:'Claude Code 담당 agent',kind:'agent_semantic_relationship_review',method:'KGA 약칭 수정본의 발문을 이 관계의 원발문 요소·대응 criterion과 다시 대조했다. 관계·criterion·원문 단위는 바꾸지 않았다.',decision:REVIEW[l.id],input:ref(F+'/changes.json'),prior:{snapshot:{question_sha256:l.snapshot.question_sha256}}}];
 l.snapshot={...l.snapshot,question_sha256:next_hash};
}
assert.equal(fs.readFileSync(file,'utf8'),bytes,'동시 관계 장부 변경');
fs.writeFileSync(F+'/coverage-before.json',JSON.stringify(before,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(F+'/coverage-update.json',JSON.stringify({links:rows.map(l=>l.id),input_hash:sha(bytes),output_hash:sha(fs.readFileSync(file)),relationships_changed:0,criterion_targets_changed:0,meaning_rechecked:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({rechecked_links:rows.length}));
