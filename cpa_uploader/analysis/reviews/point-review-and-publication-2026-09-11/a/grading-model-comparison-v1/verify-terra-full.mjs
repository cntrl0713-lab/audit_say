import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../lib/questionV3Grading.ts';

// Read-only validation of an already completed production run. This file never calls a model.
globalThis.fetch = async () => { throw Error('No API is allowed in the result verifier'); };
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/a/grading-model-comparison-v1';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = value => createHash('sha256').update(value).digest('hex');
const identity = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const invocation = read(`${base}/terra-full-invocation.json`);
for (const row of invocation.frozen_inputs) assert.equal(identity(row.file).sha256, row.sha256, row.file);
const dir = invocation.output, inputs = read(`${dir}/inputs.json`), summary = read(`${dir}/summary.json`);
const originalSet = read(invocation.argv[invocation.argv.indexOf('--file') + 1]);
assert.deepEqual(inputs.question_set, Array.isArray(originalSet) ? originalSet[0] : originalSet);
assert.deepEqual(inputs.qa, read(invocation.argv[invocation.argv.indexOf('--qa') + 1]));
assert.equal(inputs.model, 'gpt-5.6-terra'); assert.equal(inputs.mock, false); assert.equal(inputs.selected, null);
assert.equal(summary.model, inputs.model); assert.deepEqual(summary.changed_inputs, []);
for (const [file, expected] of Object.entries(inputs.hashes)) assert.equal(identity(file).sha256, expected, file);
assert.equal(inputs.qa.cases.length, 35); assert.equal(summary.planned_cases, 35);
const results = []; let live = 0, empty = 0, responses = 0, traceErrors = 0, rawSecurity = 0;
for (const row of summary.records) {
    const file = `${dir}/${row.file}`, record = read(file), expected = inputs.qa.cases.find(c => c.id === record.case_id);
    assert(expected); assert.deepEqual(record.expected, expected); assert.equal(record.model, inputs.model);
    const answers = Object.fromEntries(inputs.question_set.subquestions.map(q => [q.id, q.id === expected.subquestion_id ? expected.answer : '']));
    assert.deepEqual(record.answers, answers);
    if (record.error) { results.push({ original: identity(file), case_id: record.case_id, attempt: record.attempt, execution_error: record.error }); continue; }
    assert.equal(record.request_hash, sha(buildGradingPrompt(inputs.question_set, answers)));
    assert.equal(record.schema_hash, sha(JSON.stringify(buildGradingResponseSchema(inputs.question_set, answers))));
    responses += record.trace.filter(t => t.response).length;
    traceErrors += record.trace.filter(t => t.error).length;
    const security = !!record.raw_judgment?.injection_detected || !!record.raw_judgment?.salad_detected
        || !!record.raw_judgment?.subquestions.some(q => q.injection_detected || q.salad_detected);
    if (security) rawSecurity++;
    if (expected.answer.trim()) {
        live++; assert.equal(record.transport, 'live_model'); assert(record.raw_judgment);
        assert.deepEqual(applyQuestionSetJudgment(inputs.question_set, answers, record.raw_judgment), record.result);
    } else {
        empty++; assert.equal(record.transport, 'production_empty_answer_no_model'); assert.equal(record.raw_judgment, null);
        assert.equal(record.trace.length, 0); assert.equal(record.result.score, 0);
        assert(record.result.subquestions.every(q => q.criteria.every(c => c.awarded_points === 0 && c.verdict === 'not_met')));
    }
    const sub = record.result.subquestions.find(q => q.subquestion_id === expected.subquestion_id);
    const exact = expected.expected_verdicts.filter(e => sub.criteria.find(c => c.criterion_id === e.criterion_id)?.verdict !== e.verdict);
    assert.deepEqual(exact, record.exact_verdict_differences);
    const zero = new Set(['not_met', 'contradicted']), boundary = ['condition_boundary', 'condition-boundary'].includes(expected.kind);
    const differences = exact.filter(e => !(boundary && zero.has(e.verdict) && zero.has(sub.criteria.find(c => c.criterion_id === e.criterion_id)?.verdict)));
    assert.deepEqual(differences, record.verdict_differences);
    const matched = differences.length === 0 && record.result.score === expected.expected_points && record.result.security_flag === 'none';
    assert.equal(matched, record.matched);
    results.push({ original: identity(file), case_id: record.case_id, attempt: record.attempt, expected_points: expected.expected_points,
        actual_points: record.result.score, exact_verdict_differences: exact, accepted_verdict_differences: differences,
        matched, raw_security_flag: security, final_security_flag: record.result.security_flag,
        request_hash: record.request_hash, schema_hash: record.schema_hash, raw_arithmetic_replay_exact: true });
}
assert.equal(summary.actual_attempts, results.length);
assert.equal(summary.recorded_cases, new Set(results.map(r => r.case_id)).size);
for (const row of invocation.frozen_inputs) assert.equal(identity(row.file).sha256, row.sha256, row.file);
const report = { created_at: new Date().toISOString(), purpose: 'Independent Terra diagnostic; not a new execution manifest, semantic receipt, human confirmation, or publication',
    model: inputs.model, verification_api_calls: 0, original_production_run: invocation.output,
    inputs: identity(`${dir}/inputs.json`), summary: identity(`${dir}/summary.json`), invocation: identity(`${base}/terra-full-invocation.json`),
    planned_cases: 35, unique_cases: summary.recorded_cases, observations: results.length, live_model_observations: live, empty_no_model_observations: empty,
    successful_model_responses: responses, trace_error_events: traceErrors, stopped_on_execution_error: summary.stopped_on_execution_error,
    mismatched_case_ids: summary.mismatched_case_ids, raw_security_observations: rawSecurity,
    unchanged_frozen_inputs: invocation.frozen_inputs.length, results };
fs.writeFileSync(`${base}/terra-full-result.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ file: `${base}/terra-full-result.json`, sha256: identity(`${base}/terra-full-result.json`).sha256,
    unique_cases: report.unique_cases, observations: report.observations, mismatch_ids: report.mismatched_case_ids,
    responses, live, empty, rawSecurity, traceErrors, execution_error: report.stopped_on_execution_error }));
