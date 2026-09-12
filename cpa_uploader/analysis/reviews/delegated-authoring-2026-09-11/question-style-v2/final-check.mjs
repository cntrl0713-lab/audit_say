import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work = `${control}/question-style-v2`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const index = read(`${work}/index.json`), manifest = read(index.manifest_file);
assert.equal(hash(index.manifest_file), index.manifest_sha256);
assert.equal(hash(index.learning_groups_file), index.learning_groups_sha256);
for (const source of index.source_files) assert.equal(hash(source.file), source.sha256);
let preserved = 0;
for (const manifestFile of [`${control}/final-153-point-policy-v1/manifest.json`, `${control}/final-153-structure-v2/manifest.json`, index.manifest_file]) {
    const current = read(manifestFile);
    assert.equal(hash(current.bank_file), current.bank_sha256);
    assert.equal(hash(path.join(path.dirname(manifestFile), 'comparison-bank.json')), current.comparison_bank_sha256);
    for (const entry of current.entries) for (const item of [{ file: entry.file, sha256: entry.sha256 }, ...entry.plan_files,
        { file: entry.qa_file, sha256: entry.qa_sha256 }, ...entry.source_files]) {
        assert.equal(hash(item.file), item.sha256, item.file); preserved++;
    }
}
const lock = read(`${control}/runtime-v6-point-policy-v1/runtime-lock.json`);
const codeChanges = lock.code_files.map(item => ({ ...item, current_sha256: hash(item.file), changed: hash(item.file) !== item.sha256 }));
assert.deepEqual(codeChanges.filter(item => item.changed).map(item => item.file), ['cpa_uploader/questionBankPublication.ts']);
const beforeCode = read(`${control}/question-style-v1/code-before.json`);
for (const previous of beforeCode) {
    const expected = previous.file.endsWith('questionBankPublication.ts')
        ? previous.text.replace('set.subquestions.length > 3', 'set.subquestions.length > 4').replace('세부 물음 2~3개', '세부 물음 2~4개')
        : previous.text.replace('maxItems: 3,', 'maxItems: 4,').replace("'- 2~3개의 서로 연계된 subquestion을 만든다.'", "'- 2~4개의 서로 연계된 subquestion을 만든다. 독립된 답안 범위가 과도하게 묶이면 별도 물음으로 분리한다.'");
    assert.equal(fs.readFileSync(previous.file, 'utf8').replaceAll('\r\n', '\n'), expected.replaceAll('\r\n', '\n'));
}
const publicFile = 'cpa_uploader/data/cpa_question_sets_v3.public.json';
assert.equal(hash(publicFile), '39f7dc822a600c0e5a72a9ea297cde24edfd59b0a4c882bd01f10c1218bdb505');
const pages = ['app/quiz/draft-preview/page.tsx', 'app/quiz/draft-preview/catalog/page.tsx', 'app/quiz/draft-preview/draftPreviewData.ts'];
const groups = read(index.learning_groups_file).groups;
assert(groups.filter(group => group.style === 'standard').every(group => group.shared_context.facts.length === 0));
assert.equal(groups.flatMap(group => group.subquestions).length, manifest.collected_questions);
const record = { recorded_at: new Date().toISOString(), manifest_file: index.manifest_file, manifest_sha256: hash(index.manifest_file),
    index_sha256: hash(`${work}/index.json`), comparison_bank_sha256: manifest.comparison_bank_sha256, counts: index.counts,
    selected_file_identity_checks: preserved, canonical_sha256: hash(manifest.bank_file), public_sha256: hash(publicFile),
    code_changes_from_previous_runtime: codeChanges, preview_files: pages.map(file => ({ file, sha256: hash(file) })),
    api_calls: 0, model_semantic_review: 'not_run', model_grading: 'not_run', canonical_or_public_mutation: false,
    local_checks: read(`${work}/check-results.json`), errors: [] };
fs.writeFileSync(`${work}/final-verification.json`, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ counts: index.counts, selected_file_identity_checks: preserved, grading_code_changes: 0, errors: [] }));
