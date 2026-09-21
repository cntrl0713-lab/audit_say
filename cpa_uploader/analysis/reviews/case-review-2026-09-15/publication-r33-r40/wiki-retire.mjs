// 퇴역한 원 8세트의 wiki 생성 페이지를 원 바이트로 보존한 뒤 제거한다(정본 설치 뒤 한 번 실행; coverage 재연결이 끝난 뒤 wiki:build로 잇는다).
//   node cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40/wiki-retire.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const P = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/publication-r33-r40', W = P + '/wiki-retirement';
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8')), hash = (b) => createHash('sha256').update(b).digest('hex'), ref = (f) => ({ file: f, sha256: hash(fs.readFileSync(f)) });
const write = (f, v) => { fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); return ref(f); };
assert.equal(read(P + '/install-completion.json').status, 'canonical_installed_and_validated'); assert(!fs.existsSync(W), 'Wiki retirement already recorded');
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'), retired = read(P + '/plan.json').rounds.flatMap((r) => r.retires);
const pages = retired.map((id) => {
    assert(!bank.some((s) => s.id === id), 'Retired set still active: ' + id);
    const original = `cpa_uploader/wiki/questions/${id}.md`; assert(fs.existsSync(original), 'Missing generated page: ' + original);
    const text = fs.readFileSync(original, 'utf8'); assert(/^status: generated$/m.test(text), 'Only generated pages may be removed: ' + original);
    return { set_id: id, original_path: original, bytes: fs.readFileSync(original) };
});
const extra = fs.readdirSync('cpa_uploader/wiki/questions').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).filter((id) => !bank.some((s) => s.id === id));
assert.deepEqual(extra.sort(), [...retired].sort(), 'Only the retired sets may lack an active bank entry');
fs.mkdirSync(W + '/old-pages', { recursive: true });
const entries = pages.map((p) => { const archived = `${W}/old-pages/${p.set_id}.md`; fs.writeFileSync(archived, p.bytes, { flag: 'wx' }); assert.equal(hash(fs.readFileSync(archived)), hash(p.bytes));
    return { set_id: p.set_id, original_path: p.original_path, archived_path: archived, sha256: hash(p.bytes), bytes: p.bytes.length }; });
const manifest = write(W + '/manifest.json', { schema_version: 1, recorded_at: new Date().toISOString(), status: 'archived_before_removal', retired_sets: retired.length, current_bank: ref('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),
    install: ref(P + '/install-completion.json'), ownership_basis: [ref('cpa_uploader/wiki/SCHEMA.md'), ref('cpa_uploader/wiki/scripts/build-wiki.mjs'), ref('cpa_uploader/wiki/scripts/check-wiki.mjs')], entries });
for (const e of entries) fs.unlinkSync(e.original_path);
write(W + '/completion.json', { schema_version: 1, status: 'removed_archived_retired_generated_pages', manifest, removed: entries.length, archived: entries.length, recursive_delete: false, current_bank_unchanged: true });
console.log({ archived_and_removed: entries.length });
