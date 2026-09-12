import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { studyTopics } from '../../../../wiki/scripts/ox-study-order.mjs';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work = `${control}/question-style-v1`;
const manifestFile = `${control}/final-153-structure-v2/manifest.json`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = read(manifestFile);
const sources = ['foundations', 'completion', 'procedures', 't08-c'].map(name => `${work}/${name}.json`);
const rows = sources.flatMap(file => read(file).entries.map(entry => ({ ...entry, review_file: file })));
assert.equal(rows.length, manifest.collected_questions);
assert.equal(new Set(rows.map(row => `${row.set_id}/${row.subquestion_id}`)).size, rows.length);
const result = [];
for (const entry of manifest.entries) {
    assert.equal(hash(entry.file), entry.sha256);
    const raw = read(entry.file);
    const set = Array.isArray(raw) ? raw.find(set => set.id === entry.set_id) : raw;
    for (const [index, sub] of set.subquestions.entries()) {
        const row = rows.find(row => row.set_id === set.id && row.subquestion_id === sub.id);
        assert(row && ['standard', 'case'].includes(row.style) && row.reason.trim().length > 10);
        assert.equal(typeof row.mixed, 'boolean');
        assert(!row.mixed || row.style === 'case');
        assert(row.case_fact_ids.every(id => set.shared_context.facts.some(fact => fact.id === id)));
        result.push({ ...row, plan_id: entry.plan_id, topic_id: entry.topic_id, question_file: entry.file,
            question_sha256: entry.sha256, display_number: index + 1, points: sub.criteria.reduce((sum, c) => sum + c.max_points, 0) });
    }
}
const counts = { standard: result.filter(row => row.style === 'standard').length, case: result.filter(row => row.style === 'case').length,
    mixed_case: result.filter(row => row.mixed).length, sets: manifest.collected_sets, questions: result.length };
const out = { schema_version: 1, purpose: 'draft_learning_navigation', manifest_file: manifestFile, manifest_sha256: hash(manifestFile),
    topic_order: studyTopics.map(topic => topic.id), source_files: sources.map(file => ({ file, sha256: hash(file) })),
    counts, review_status: 'editorial_classification', api_calls: 0, human_approval: false, entries: result };
fs.writeFileSync(`${work}/index.json`, JSON.stringify(out, null, 2) + '\n', { flag: 'wx' });
const table = ['| 주제 | 세트 | 물음 | 분류 | 배점 | 판단 근거 |', '| --- | --- | --- | --- | --- | --- |',
    ...result.sort((a, b) => out.topic_order.indexOf(a.topic_id) - out.topic_order.indexOf(b.topic_id) || a.plan_id.localeCompare(b.plan_id) || a.display_number - b.display_number)
        .map(row => `| ${row.topic_id} | ${row.plan_id} | ${row.display_number} (${row.subquestion_id}) | ${row.style === 'standard' ? '기준서형' : '사례형'}${row.mixed ? '·혼합' : ''} | ${row.points} | ${row.reason.replaceAll('|', '\\|')} |`)];
fs.writeFileSync(`${work}/classification-report.md`, '# 물음별 기준서형·사례형 분류\n\n' +
    `현재 ${counts.sets}세트·${counts.questions}물음: 기준서형 ${counts.standard}, 사례형 ${counts.case}(혼합 ${counts.mixed_case} 포함). 분류는 발문·공통사실·criterion의 실제 요구에 따른 수동 탐색 분류이며 모델 검증이나 사람 승인이 아니다.\n\n` + table.join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify(counts));
