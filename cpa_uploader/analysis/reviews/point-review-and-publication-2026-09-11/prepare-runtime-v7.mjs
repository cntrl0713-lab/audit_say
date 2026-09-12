import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const identity = file => ({ file, sha256: hash(file) });
const previousFile = `${base}/execution-runtime-v6.json`;
const output = `${base}/execution-runtime-v7.json`;
const beforeFile = `${base}/grading-inference-followup-v2/before.json`;
assert(!fs.existsSync(output), 'Use a new runtime path');
assert.equal(hash(previousFile), '5965bfc11dd440298431c418585b335828a23b10ed56fdca6832e8728ed70ba7');
const previous = read(previousFile), preservation = read(beforeFile);
assert.equal(preservation.api_processes_stopped, true);
const changed = previous.code_files.filter(row => hash(row.file) !== row.sha256);
assert.deepEqual(changed.map(row => row.file).sort(), ['cpa_uploader/questionSemanticReview.ts', 'lib/questionV3Grading.ts']);
for (const row of preservation.files) assert.equal(hash(row.snapshot_file), row.before_sha256);
const normalized = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const grader = 'lib/questionV3Grading.ts';
const lines = normalized(grader).split('\n');
const added = lines.filter(line => line.includes("'- met를 정하기 전에 선택한 답안 구간이") || line.includes("'- 시점·속도·빈도 수식어가"));
assert.equal(added.length, 2);
assert.equal(lines.filter(line => !added.includes(line)).join('\n'), normalized(preservation.files.find(row => row.file === grader).snapshot_file));
const semantic = 'cpa_uploader/questionSemanticReview.ts';
const from = 'omission/opposite/condition_boundary는 목표 criterion의 필수 요소·조건을 실제로 바꾸는 사례로 설계한다.';
const to = 'omission은 목표 명제를 실제로 빠뜨리되 부정하지 않는 중립적 누락으로 설계한다. 필요한 행위를 하지 않는다고 명시하거나 만·제외 등으로 그 의무를 실제 배제한 답은 목표 명제에 대한 반대이므로 omission/not_met으로 만들지 말고 opposite/contradicted로 구별하며, condition_boundary는 실제 적용을 가르는 조건을 바꾸고 그 조건에서의 필수 요구를 대조한다.';
const previousSemantic = normalized(preservation.files.find(row => row.file === semantic).snapshot_file);
assert.equal(previousSemantic.split(from).length, 2);
assert.equal(normalized(semantic), previousSemantic.replace(from, to));
const bank = `${base}/c/prepared-reviewed-v8/candidate-authoring.json`;
assert.equal(hash(bank), '11618f57625ae6ec71630f6413411ad513291674573e4eb0f028d129c0eab90b');
const result = {
    created_at: new Date().toISOString(), version: 'grading-evidence-and-semantic-case-followup-2026-09-12-v7',
    predecessor: identity(previousFile), purpose: 'Require actual answer support and correct temporal attachment; distinguish neutral omission from explicit opposition in generated cases',
    review_model: previous.review_model, grading_model: previous.grading_model,
    changed_predecessor_files: changed.map(row => {
        const before = preservation.files.find(item => item.file === row.file);
        assert.equal(before.before_sha256, row.sha256);
        return { file: row.file, before_sha256: row.sha256, after_sha256: hash(row.file), snapshot: identity(before.snapshot_file) };
    }),
    code_files: previous.code_files.map(row => identity(row.file)), source_question_bank: identity(bank), preservation: identity(beforeFile),
    policy_changes: preservation.files.filter(row => !changed.some(item => item.file === row.file)).map(row => ({ file: row.file, before_sha256: row.before_sha256, after_sha256: hash(row.file), snapshot: identity(row.snapshot_file) })),
    validation: { changed_scope: 'grader two instruction lines; semantic one instruction replacement; no schema/parser/scoring/transport change', local_checks: 'record final results separately in grading-inference-followup-v2/decision.md', actual_model_followup: 'not_started' },
    execution_policy: 'Use new manifests and outputs. Preserve all old bytes, expectations, responses and frozen snapshots. New comparison-bank epoch and semantic instructions require actual semantic reviews. Changed grading prompt requires fresh actual grading; no automatic pass transfer.'
};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ runtime: identity(output), changed_code_files: changed.length, policy_changes: result.policy_changes.length, api_calls: 0 }));
