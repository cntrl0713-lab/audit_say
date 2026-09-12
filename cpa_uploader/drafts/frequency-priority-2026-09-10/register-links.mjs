import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';
import { questionHash, sourceUnitHash } from '../../analysis/coverage/build-coverage.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const inputFile = path.join(base, 'frequency-links.json');
const input = read(inputFile);
const ledgerFile = path.join(root, 'cpa_uploader/analysis/coverage/links.json');
const ledger = read(ledgerFile);
const dataset = read(path.join(root, input.dataset.file));
const catalog = buildSourceCatalog();
const additions = [];
for (const entry of input.sets) {
  const set = read(path.join(root, entry.draft_file));
  for (const [index, link] of entry.links.entries()) {
    const q = set.subquestions.find(q => q.id === link.subquestion_id);
    const element = dataset.elements.find(e => e.id === link.element_id);
    const units = link.source_unit_ids.map(id => catalog.units.find(u => u.id === id));
    if (!q || !element || units.some(u => !u)) throw new Error('Unresolved link');
    const proposed = { id: `frequency-priority-2026-09-10-${set.id.replace('draft-', '')}-${index + 1}`,
      element_id: link.element_id, source_unit_ids: link.source_unit_ids,
      target: { scope: 'draft', file: entry.draft_file, set_id: set.id, subquestion_id: q.id, criterion_ids: link.criterion_ids },
      relationship: link.relationship, review_status: 'needs_review',
      reason: `${link.reason} ${set.classification.topic_id === '10' ? 'A11은 보론 표의 탐색 연결이며 직접 정답 근거는 초안 source_refs의 공식 표 발췌이다.' : '카탈로그 문단 연결과 별도로 초안 source_refs의 공식 발췌를 확보하였다.'} 의미검수·사람 승인 전 작성자 제안이다.`,
      provenance: { file: path.relative(root, inputFile).replaceAll('\\', '/'), sha256: hash(fs.readFileSync(inputFile)), original_set_id: set.id,
        original_target: q.id, original_relationship: link.relationship },
      snapshot: { element_sha256: hash(JSON.stringify(element)), question_sha256: questionHash(set, q),
        source_hashes: Object.fromEntries(units.map(u => [u.id, u.contentHash])),
        source_metadata_hashes: Object.fromEntries(units.map(u => [u.id, sourceUnitHash(u)])) } };
    const existing = ledger.links.find(l => l.id === proposed.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(proposed)) throw new Error(`Existing relationship changed: ${proposed.id}. Reassess the relation before updating the ledger.`);
    if (!existing) additions.push(proposed);
  }
}
ledger.links.push(...additions);
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify({ added: additions.length, total: ledger.links.length }));
