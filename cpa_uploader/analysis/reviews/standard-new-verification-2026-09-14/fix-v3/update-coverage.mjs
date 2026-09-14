// B1·B2 수정 세트를 가리키는 coverage 관계를 대조한다. 내용 해시가 바뀐 물음(s03/sub4)의 관계만 의미를 재대조하고 확인 해시·이력을 남긴다.
// 같은 세트의 다른 물음을 가리키는 관계는 물음 해시가 그대로임을 확인만 한다.
//   node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v3/update-coverage.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash} from '../../../coverage/build-coverage.mjs';
const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v3';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const installed=read(F+'/publication-v1/install-completion.json');assert.equal(installed.status,'canonical_installed_and_validated');
const changes=read(F+'/changes.json'),bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),old=read(F+'/baseline/authoring.json');
const file='cpa_uploader/analysis/coverage/links.json',bytes=fs.readFileSync(file,'utf8'),ledger=JSON.parse(bytes);
const REVIEW={
 'standard-followup-20260913-block-suitability':'연결 criterion crit2·crit3은 그대로다. crit2의 "특정 구획 조사가 항상 금지되는 것은 아니다"를 요건이 아닌 안내로 바꾸었고, 전체 모집단 추론에 일반적으로 부적합하다는 명제와 그 이유는 같다. OX 123 구획추출 적용 적합성과의 broader 관계가 같다.',
};
const rows=ledger.links.filter(l=>l.target&&changes.changed_sets.includes(l.target.set_id));
const unchanged=[],updated=[];const before=structuredClone(rows);
for(const l of rows){
 assert.equal((l.target.scope??'bank'),'bank');
 const prev=old.find(s=>s.id===l.target.set_id),next=bank.find(s=>s.id===l.target.set_id);
 const pq=prev.subquestions.find(q=>q.id===l.target.subquestion_id),nq=next.subquestions.find(q=>q.id===l.target.subquestion_id);
 assert.equal(l.snapshot.question_sha256,questionHash(prev,pq),'수정 전에도 이미 오래된 관계다: '+l.id);
 for(const c of l.target.criterion_ids)assert(nq.criteria.some(k=>k.id===c),'criterion 없음: '+l.id);
 const next_hash=questionHash(next,nq);
 if(next_hash===l.snapshot.question_sha256){assert(!REVIEW[l.id]);unchanged.push(l.id);continue;}
 assert(REVIEW[l.id],'재대조 판단 없음: '+l.id);
 l.review_history=[...(l.review_history??[]),{reviewed_at:'2026-09-14',reviewer:'Claude Code 담당 agent',kind:'agent_semantic_relationship_review',method:'B1·B2 채점기준 수정본의 발문·criterion을 이 관계의 원발문 요소·대응 criterion과 다시 대조했다. 관계·criterion·원문 단위는 바꾸지 않았다.',decision:REVIEW[l.id],input:ref(F+'/changes.json'),prior:{snapshot:{question_sha256:l.snapshot.question_sha256}}}];
 l.snapshot={...l.snapshot,question_sha256:next_hash};updated.push(l.id);
}
assert.deepEqual(updated.sort(),Object.keys(REVIEW).sort(),'재대조 대상이 검토 목록과 다르다');
assert.equal(fs.readFileSync(file,'utf8'),bytes,'동시 관계 장부 변경');
fs.writeFileSync(F+'/coverage-before.json',JSON.stringify(before,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
fs.writeFileSync(F+'/coverage-update.json',JSON.stringify({updated_links:updated,unchanged_question_hash_links:unchanged,input_hash:sha(bytes),output_hash:sha(fs.readFileSync(file)),relationships_changed:0,criterion_targets_changed:0,meaning_rechecked:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({updated:updated.length,unchanged:unchanged.length}));
