// 문구가 바뀐 물음을 가리키는 coverage 관계 6건을 다시 대조하고 확인 당시 해시와 이력을 남긴다.
// F2(구두점)·F3(발문 약칭)만 바뀌어 요소↔criterion 대응·관계 판정은 같다. 해시만 바꾸지 않고 의미 재대조 근거를 함께 기록한다.
//   node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v1/update-coverage.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash} from '../../../coverage/build-coverage.mjs';
const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const installed=read(F+'/publication-v1/install-completion.json');assert.equal(installed.status,'canonical_installed_and_validated');
const changes=read(F+'/changes.json'),bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),old=read(F+'/baseline/authoring.json');
const file='cpa_uploader/analysis/coverage/links.json',bytes=fs.readFileSync(file,'utf8'),ledger=JSON.parse(bytes);
// 링크별 재대조 판단: 원발문 요소와 대응 criterion은 그대로이고 바뀐 곳은 아래뿐이다.
const REVIEW={
 'standard-priority-20260914-governance-2018-timing':'대응 criterion crit4(적시 커뮤니케이션)는 그대로다. 발문의 "KGA 260 문단19~21"을 "감사기준서 260 문단 19~21"로 바꾼 표기 변경뿐이라 2018:7:3 사례의 시기 적절성 판단과의 partial 관계가 같다.',
 'standard-priority-20260914-governance-2018-form':'대응 criterion crit2·crit3(유의적 사항의 조건부 서면, 독립성 문제의 서면)은 그대로다. 발문 약칭만 감사기준서로 바뀌어 2018:7:3 사례의 전부 구두 소통 판단과의 partial 관계가 같다.',
 'standard-priority-20260914-component-2015-completion':'연결 criterion crit1·crit2·crit3·crit10 중 crit1에 마침표만 들어갔다. 2015:6:3 종결단계 후보(윤리준수·업무팀요구 준수·보고대상·전반 결론)와의 partial 관계가 같다.',
 'standard-priority-20260914-component-2015-completion-points-20260914-2':'연결 criterion crit4–crit9 중 crit5·crit8에 마침표만 들어갔다. 2015:6:3 종결단계 후보 여섯 요구와의 partial 관계가 같다.',
 'standard-priority-20260914-component-2025-confirmation':'이 관계가 연결한 crit1(윤리적 요구사항 준수 여부)에 마침표만 들어갔다. 2025:9:2 확인서에서 빠진 윤리준수 요구와의 partial 관계가 같다.',
 'standard-priority-20260914-component-2025-confirmation-points-20260914-2':'연결 criterion crit5–crit8 중 crit5·crit8에 마침표만 들어갔다. 2025:9:2 확인서에서 빠진 네 요구와의 partial 관계가 같다.',
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
 assert.deepEqual(nq.criteria.map(c=>[c.id,c.critical_facts]),pq.criteria.map(c=>[c.id,c.critical_facts]));
 const next_hash=questionHash(next,nq);assert.notEqual(next_hash,l.snapshot.question_sha256);
 l.review_history=[...(l.review_history??[]),{reviewed_at:'2026-09-14',reviewer:'Claude Code 담당 agent',kind:'agent_semantic_relationship_review',method:'F1–F3 문구 수정본의 발문·criterion을 이 관계의 원발문 요소·대응 criterion과 다시 대조했다. 관계·criterion·원문 단위는 바꾸지 않았다.',decision:REVIEW[l.id],input:ref(F+'/changes.json'),prior:{snapshot:{question_sha256:l.snapshot.question_sha256}}}];
 l.snapshot={...l.snapshot,question_sha256:next_hash};
}
assert.equal(fs.readFileSync(file,'utf8'),bytes,'동시 관계 장부 변경');
fs.writeFileSync(F+'/coverage-before.json',JSON.stringify(before,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(F+'/coverage-update.json',JSON.stringify({links:rows.map(l=>l.id),input_hash:sha(bytes),output_hash:sha(fs.readFileSync(file)),relationships_changed:0,criterion_targets_changed:0,meaning_rechecked:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({rechecked_links:rows.length}));
