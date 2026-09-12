import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work = `${control}/question-style-v2`;
const manifestFile = `${control}/final-153-style-v2/manifest.json`;
const file = 'cpa_uploader/analysis/coverage/links.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const oldHash = hash(file), oldText = fs.readFileSync(file, 'utf8'), data = JSON.parse(oldText);
const manifest = read(manifestFile), changes = [], links = [];
assert(!fs.existsSync(`${work}/coverage-before.json`));
for (const link of data.links) {
    const entry = manifest.entries.find(entry => entry.set_id === link.target?.set_id);
    if (!entry || link.target.scope !== 'draft' || link.target.file === entry.file) { links.push(link); continue; }
    const raw = read(entry.file), set = Array.isArray(raw) ? raw.find(set => set.id === entry.set_id) : raw;
    const partitions = set.subquestions.map(sub => ({ sub, ids: link.target.criterion_ids.filter(id => sub.criteria.some(c => c.id === id)) }))
        .filter(row => row.ids.length || (!link.target.criterion_ids.length && row.sub.id === link.target.subquestion_id));
    assert(partitions.length);
    assert.deepEqual(partitions.flatMap(row => row.ids).sort(), [...link.target.criterion_ids].sort());
    for (const [index, partition] of partitions.entries()) {
        const next = structuredClone(link);
        if (index > 0) next.id = `${link.id}-split-${partition.sub.id}`;
        next.target = { ...next.target, file: entry.file, subquestion_id: partition.sub.id, criterion_ids: partition.ids };
        next.review_status = 'needs_review';
        next.reason = '기존 후보 관계의 동일 정답 명제를 독립 발문·물음 분할 후의 활성 위치에 연결했다. ' +
            (partitions.length > 1 ? '기존 sub2의 명제를 업무 이해·결론 평가와 가정·방법·자료 검토로 나누었으며 원출제 추가나 빈도 증가를 뜻하지 않는다. ' : '') +
            '원 요구·criterion·직접 출처는 유지하고, 관계 종류와 당시 snapshot을 보존한다. 관계의 재검토 완료는 주장하지 않는다.';
        next.provenance = { ...next.provenance, previous_link: link, cohort_manifest: manifestFile, candidate_sha256: entry.sha256,
            learning_style_review: `${work}/index.json`, application_note: 'Location and scope partition only; original snapshot retained, no frequency increase or review/publication acceptance.' };
        links.push(next);
        changes.push({ before_id: link.id, after_id: next.id, before_target: link.target, after_target: next.target });
    }
}
assert.equal(new Set(links.map(link => link.id)).size, links.length);
fs.writeFileSync(`${work}/coverage-before.json`, oldText, { flag: 'wx' });
assert.equal(hash(file), oldHash);
data.links = links;
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(`${work}/coverage-followup.json`, JSON.stringify({ before_sha256: oldHash, after_sha256: hash(file),
    before_links: read(`${work}/coverage-before.json`).links.length, after_links: links.length, changes,
    interpretation: 'One old T08-C relation is partitioned across two subquestions. Source occurrences and frequencies are unchanged; old snapshots remain pending.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ relations: links.length, retargeted_rows: changes.length }));
