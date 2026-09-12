import fs from 'node:fs';
import { buildSourceCatalog, createSourcePacket } from '../../../questionSourceCatalog.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s04';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const catalog = buildSourceCatalog();
const manifest = read(`${folder}/draft-manifest.json`);
const results = [];
for (const s of manifest.sets) {
  const plan = read(s.plan), set = read(s.file)[0];
  const omitted = plan.source_unit_ids.filter(id => !catalog.units.find(u => u.id === id)?.topicIds.includes(set.classification.topic_id));
  const packet = createSourcePacket({ topicId: set.classification.topic_id, sourceIds: plan.source_unit_ids.filter(id => !omitted.includes(id)), maxChars: 1500000, catalog });
  const file = `${folder}/evidence/phase1/${s.set_id}.packet-investigation-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(packet, null, 2) + '\n');
  results.push({ set_id: s.set_id, file, inspection_only: true, omitted_from_investigation_only: omitted,
    charCount: packet.charCount, completeness: packet.completeness, unresolved: packet.unresolved,
    direct_unresolved: packet.unresolved.filter(u => set.source_refs.some(r => r.id === u.sourceId)) });
}
fs.writeFileSync(`${folder}/evidence/phase1/packet-context-investigation.json`, JSON.stringify({ checked_at: new Date().toISOString(), final_packet: false, inspection_limit_only: 1500000, model_input_limit: 500000, results,
  note: '읽기 조사만의 입력 한도다. 원래 계획과 원출제 계보의 모든 ID는 보존했다. 주제 미연결 페이지는 조사 호출에서만 제외해 나머지 자동 의존의 한계를 확인했으며 검수 입력에서 제거하지 않았다. 이 자동 결과를 --packet으로 사용하거나 complete로 바꾸지 않는다.' }, null, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({ id: r.set_id, chars: r.charCount, unresolved: r.unresolved.length, direct_unresolved: r.direct_unresolved })), null, 2));
