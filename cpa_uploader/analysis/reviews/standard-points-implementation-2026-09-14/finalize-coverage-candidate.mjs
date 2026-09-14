import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const v1=read(R+'candidate-v1/bank.json'),v2=read(R+'candidate-v2/bank.json'),v3=read(R+'candidate-v3/bank.json');
const changed=v1.filter(s=>JSON.stringify(s)!==JSON.stringify(v2.find(x=>x.id===s.id))).map(s=>s.id);
assert.deepEqual(changed,['std-points-20260914-17c71aee6d2b']);
assert.equal(v1.length,v2.length);
for(const s of v2)assert.deepEqual(v3.find(x=>x.id===s.id),s,'A v2 set changed in the final candidate: '+s.id);
const added=v3.filter(s=>!v2.some(x=>x.id===s.id));
const saved=read(R+'coverage-concurrent-sets.snapshot.json');
assert.deepEqual(added.map(s=>s.id).sort(),saved.map(s=>s.id).sort());
for(const s of added)assert.deepEqual(s,saved.find(x=>x.id===s.id),'Concurrent case set changed: '+s.id);
const overlay=read(R+'coverage-links.proposed.json');
assert(!overlay.links.some(l=>changed.includes(l.target?.set_id)), 'Clarified target has coverage; review its final meaning');
const binding={schema_version:1,reviewed_at:'2026-09-14',reviewer:'agent:/root/review_06_10',
 bank:ref(R+'candidate-v3/bank.json'),
 preserved_manual_mapping:ref(R+'coverage-update-plan.json'),
 prior_versions:[ref(R+'candidate-v1/bank.json'),ref(R+'candidate-v2/bank.json')],
 clarification_review:ref(R+'qa-targeted-clarification-crosscheck.json'),
 compared_changes:{v1_to_v2_changed_sets:changed,clarified_target_has_coverage:false,v2_to_v3_changed_existing_sets:[],v2_to_v3_added_sets:added.map(s=>s.id),concurrent_sets_exactly_preserved:true},
 conclusion:'v1 기반34관계의 수동 의미대조는 v3에서도 같은 target 발문·criterion을 가리킨다. v2의315 발문/범위 명료화는 target관계가 없고, v3은 v2전부를 보존하면서 동시추가6사례만 더했다. 새로 추가된 사례관계6개는 해당 작업의 기존 근거와 상태를 그대로 보존한다.'};
fs.writeFileSync(R+'coverage-final-candidate.json',JSON.stringify(binding,null,2)+'\n');
console.log(JSON.stringify({bank:binding.bank,changes:binding.compared_changes}));
