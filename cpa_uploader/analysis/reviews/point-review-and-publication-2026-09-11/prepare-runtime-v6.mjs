import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity = file => ({ file, sha256: hash(file) });
const previousFile = `${base}/execution-runtime-v5.json`;
const output = `${base}/execution-runtime-v6.json`;
assert(!fs.existsSync(output), 'A new runtime path is required');
const previous = read(previousFile), beforeFile = `${base}/grading-inference-followup-v1/before.json`;
const preservation = read(beforeFile);
assert.equal(preservation.api_processes_stopped, true);
const changed = previous.code_files.filter(row => hash(row.file) !== row.sha256);
assert.deepEqual(changed.map(row => row.file), ['lib/questionV3Grading.ts']);
assert.equal(hash(changed[0].file), '0f685328ffa59248ed56e9ff77fafb84e1f5913a3b6e5d1c6c6a208f1f49e124');
for (const row of preservation.files) assert.equal(hash(row.snapshot_file), row.before_sha256);
const oldCode = preservation.files.find(row => row.file === changed[0].file);
assert.equal(oldCode.before_sha256, changed[0].sha256);
const normalized = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
const addedLines = normalized(changed[0].file).split('\n').filter(line => line.includes("'- 조건부 일반 절차를 요구할 때,") || line.includes("'- 어떤 목적을 긍정한 답안이"));
assert.equal(addedLines.length, 2);
assert.equal(normalized(changed[0].file).split('\n').filter(line => !addedLines.includes(line)).join('\n'), normalized(oldCode.snapshot_file), 'Unexpected grading implementation change');
const record = {
    created_at: new Date().toISOString(), version: 'grading-inference-followup-2026-09-12-v6',
    predecessor: identity(previousFile), purpose: 'Clarify conditional procedure and independent negative-purpose inference after actual canary mismatches',
    review_model: previous.review_model, grading_model: previous.grading_model,
    changed_predecessor_files: changed.map(row => ({ ...row, before_sha256: row.sha256, after_sha256: hash(row.file), snapshot: identity(oldCode.snapshot_file) })),
    code_files: previous.code_files.map(row => identity(row.file)),
    source_question_bank: identity(`${base}/prepared-reviewed-v7/candidate-authoring.json`),
    preservation: identity(beforeFile),
    policy_changes: preservation.files.filter(row => row.file !== changed[0].file).map(row => ({ file: row.file, before_sha256: row.before_sha256, after_sha256: hash(row.file), snapshot: identity(row.snapshot_file) })),
    validation: { typecheck: 'passed', target_lint: 'passed', full_suite: 'in_progress_record_final_result_separately', actual_model_followup: 'not_started' },
    execution_policy: 'New manifests and output paths only. No prior receipt or frozen hash is rewritten. Bank and criterion contracts unchanged.'
};
fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ runtime: identity(output), changed_code_files: changed.length, added_instruction_lines: addedLines.length, api_calls: 0 }));
