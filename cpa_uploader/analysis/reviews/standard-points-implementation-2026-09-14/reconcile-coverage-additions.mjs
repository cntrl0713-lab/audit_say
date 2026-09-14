import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file='cpa_uploader/analysis/coverage/links.json';
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const original=read(R+'coverage-links.snapshot.json'),current=read(file),bank=read(bankFile);
for(const l of original.links)assert.deepEqual(current.links.find(x=>x.id===l.id),l,'An original relation changed: '+l.id);
const withoutLinks=o=>Object.fromEntries(Object.entries(o).filter(([k])=>k!=='links'));
assert.deepEqual(withoutLinks(original),withoutLinks(current));
const added=current.links.filter(l=>!original.links.some(x=>x.id===l.id));
assert.equal(added.length,6,'Recheck concurrent additions if their count changes');
const ids=[...new Set(added.map(l=>l.target?.set_id))];
const sets=ids.map(id=>{const s=bank.find(x=>x.id===id);assert(s,'Added case set absent: '+id);return s;});
const snapshot=R+'coverage-concurrent-links.snapshot.json';
const extraSets=R+'coverage-concurrent-sets.snapshot.json';
for(const [out,data] of [[snapshot,fs.readFileSync(file)],[extraSets,JSON.stringify(sets,null,2)+'\n']]){
 if(fs.existsSync(out))assert.equal(sha(fs.readFileSync(out)),sha(data),'Preserve existing reconciliation snapshot');
 else fs.writeFileSync(out,data);
}
const note={schema_version:1,reviewed_at:'2026-09-14',kind:'non_overlapping_concurrent_additions_preservation',
 base_links:snapshot,base_links_sha256:sha(fs.readFileSync(snapshot)),
 added_sets:extraSets,added_sets_sha256:sha(fs.readFileSync(extraSets)),
 source_bank:{file:bankFile,sha256:sha(fs.readFileSync(bankFile))},
 unchanged_original_links:original.links.length,added_link_ids:added.map(l=>l.id),added_set_ids:ids,
 rationale:'별도 case-applied 작업이 기존228관계는 바꾸지 않고6관계를 추가했다. 해당 관계·provenance·근거·판정을 완전히 보존하며 이번 기준서형 검토의 신규 의미검토로 귀속하지 않는다. preview는 현재정본의 추가6세트를 읽기용으로 합치고 apply는 실제 정본의 존재를 검증한다.'};
fs.writeFileSync(R+'coverage-reconciliation.json',JSON.stringify(note,null,2)+'\n');
console.log(JSON.stringify({original_links:original.links.length,preserved_concurrent_links:added.length,extra_sets:sets.length}));
