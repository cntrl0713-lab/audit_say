// Local inspection/replay of actual recorded evidence. Does not call a model.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../lib/questionV3Grading.ts';
import { resolveAnswerEvidence } from '../../../../../../lib/questionV3Evidence.ts';
const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../../../..');
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/grading-model-comparison-v1/b-terra-full';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const frozen = new Map();
function freeze(file, expected) {
    const full = path.resolve(root, file), hash = sha(fs.readFileSync(full));
    if (expected) assert.equal(hash, expected, `Hash mismatch: ${file}`);
    if (frozen.has(full)) assert.equal(hash, frozen.get(full));
    frozen.set(full, hash);
    return { file: path.relative(root, full).replaceAll('\\', '/'), sha256: hash };
}
function read(file) { freeze(file); return JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8').replace(/^\uFEFF/, '')); }
const selection = read(path.join(owned, 'input-selection.json'));
const runtime = read(selection.runtime.file);
freeze(selection.runtime.file, selection.runtime.sha256);
freeze(selection.source_manifest.file, selection.source_manifest.sha256);
for (const row of runtime.code_files) freeze(row.file, row.sha256);
assert.equal(runtime.code_files.length, 16);
assert.equal(selection.model, 'gpt-5.6-terra');
const inputs = read(`${folder}/inputs.json`), summary = read(`${folder}/summary.json`);
assert.equal(inputs.model, selection.model); assert.equal(summary.model, selection.model);
assert.equal(inputs.transport, 'production_gradeQuestionSetV3'); assert.equal(inputs.mock, false); assert.equal(inputs.selected, null);
assert.equal(inputs.qa.cases.length, 37); assert.equal(summary.planned_cases, 37);
for (const [file, hash] of Object.entries(inputs.hashes)) freeze(file, hash);
freeze(selection.job.file, selection.job.sha256); freeze(selection.job.qa_file, selection.job.qa_sha256);
const set = read(selection.job.file);
assert.deepEqual(inputs.question_set, set); assert.deepEqual(inputs.qa, read(selection.job.qa_file));
const runnerFile = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts';
const runnerText = fs.readFileSync(path.resolve(root, runnerFile), 'utf8');
assert(runnerText.includes("gradeQuestionSetV3(set,answers,process.env.OPENAI_API_KEY||'',value=>{raw=value;},undefined,event=>trace.push(event))"));
const observations = [];
for (const entry of summary.records) {
    const file = `${folder}/${entry.file}`, record = read(file);
    const expected = inputs.qa.cases.find(row => row.id === record.case_id); assert(expected);
    assert.deepEqual(record.expected, expected); assert.equal(record.model, selection.model); assert.equal(record.set_id, set.id);
    const answers = Object.fromEntries(set.subquestions.map(sub => [sub.id, sub.id === expected.subquestion_id ? expected.answer : '']));
    assert.deepEqual(record.answers, answers);
    if (record.error) { observations.push({ case_id: record.case_id, attempt: record.attempt, error: record.error, file: freeze(file) }); continue; }
    assert.equal(record.request_hash, sha(buildGradingPrompt(set, answers)));
    assert.equal(record.schema_hash, sha(JSON.stringify(buildGradingResponseSchema(set, answers))));
    const nonempty = Object.values(answers).some(answer => answer.trim());
    let groundedIdentical = null, replayedIdentical = null;
    const rawSecurity = [];
    if (nonempty) {
        assert.equal(record.transport, 'live_model');
        const traces = record.trace.filter(trace => trace.stage === 'judgment'); assert(traces.length);
        const raw = traces.at(-1).response; assert(raw);
        const reconstructed = { subquestions: [], injection_detected: false, salad_detected: false };
        for (const rawSub of raw.subquestions) {
            const sub = set.subquestions.find(row => row.id === rawSub.subquestion_id); assert(sub);
            rawSecurity.push({ subquestion_id: sub.id, injection_detected: rawSub.injection_detected, salad_detected: rawSub.salad_detected });
            assert.equal(rawSub.verdicts.length, sub.criteria.length);
            assert.equal(new Set(rawSub.verdicts.map(v => v.criterion_id)).size, sub.criteria.length);
            const verdicts = rawSub.verdicts.map(value => {
                assert(sub.criteria.some(c => c.id === value.criterion_id));
                return { criterion_id: value.criterion_id, verdict: value.verdict,
                    ...(value.verdict === 'not_met' ? {} : { quote: resolveAnswerEvidence(sub.id, answers[sub.id], value.evidence_ids) }),
                    ...(typeof value.reason === 'string' ? { reason: value.reason } : {}) };
            });
            reconstructed.subquestions.push({ subquestion_id: sub.id, verdicts, injection_detected: rawSub.injection_detected, salad_detected: rawSub.salad_detected });
        }
        // Preserve unexpected flags as findings rather than silently certifying them.
        if (rawSecurity.every(row => row.injection_detected === false && row.salad_detected === false)) {
            assert.deepEqual(reconstructed, record.raw_judgment); groundedIdentical = true;
        }
        assert.deepEqual(applyQuestionSetJudgment(set, answers, record.raw_judgment), record.result); replayedIdentical = true;
    } else {
        assert.equal(record.transport, 'production_empty_answer_no_model'); assert.equal(record.raw_judgment, null);
        assert.deepEqual(record.trace, []); assert.equal(record.result.score, 0);
    }
    const criterionRows = record.result.subquestions.flatMap(sub => sub.criteria.map(c => {
        const exp = sub.subquestion_id === expected.subquestion_id ? expected.expected_verdicts.find(v => v.criterion_id === c.criterion_id) : { verdict: 'not_met' };
        assert(exp);
        return { subquestion_id: sub.subquestion_id, criterion_id: c.criterion_id, expected: exp.verdict, actual: c.verdict,
            awarded_points: c.awarded_points, exact_match: exp.verdict === c.verdict, quote: c.quote ?? null, reason: c.reason ?? null };
    }));
    observations.push({ case_id: record.case_id, attempt: record.attempt, model: record.model, transport: record.transport, matched: record.matched,
        expected_points: expected.expected_points, actual_points: record.result.score, request_hash: record.request_hash, schema_hash: record.schema_hash,
        criteria: criterionRows, grounded_raw_matches_stored: groundedIdentical, local_replay_matches_entire_result: replayedIdentical,
        raw_security: rawSecurity, final_security: record.result.security_flag, trace_stages: record.trace.map(trace => trace.stage), record_file: freeze(file) });
}
const cases = inputs.qa.cases.map(test => ({ id: test.id, observations: observations.filter(row => row.case_id === test.id) }));
for (const sample of cases) if (sample.observations.some(row => row.matched === false) && !sample.observations.some(row => row.error)) assert.equal(sample.observations.length, 3);
const report = { version: 1, reviewer: 'plan_procedures', created_at: new Date().toISOString(), purpose: 'independent_terra_model_comparison_diagnostic',
    model_api_calls_by_this_verifier: 0, human_approval: false, formal_semantic_receipt_or_deployment: false,
    selected_model: selection.model, historical_full_manifest_model: selection.source_manifest.historical_configured_model,
    runtime_code_identity: freeze(selection.runtime.file), runtime_model_overridden_for_explicit_diagnostic: true,
    counts: { expected_cases: 37, recorded_cases: summary.recorded_cases, recorded_observations: summary.actual_attempts,
        nonempty_observations: observations.filter(row => row.transport === 'live_model').length,
        no_model_empty_observations: observations.filter(row => row.transport === 'production_empty_answer_no_model').length,
        raw_criterion_judgments: observations.filter(row => row.transport === 'live_model').reduce((n, row) => n + row.criteria.length, 0),
        mismatched_case_ids: summary.mismatched_case_ids, execution_errors: observations.filter(row => row.error).length },
    input_changes: summary.changed_inputs, cases, code_path: { runner: freeze(runnerFile), createResponse_argument: 'undefined', response_injection: false },
    limitations: ['The trace records the configured model and production transport, not a separate provider response-model field.',
        'Passing these 37 QA cases does not establish success for every question, semantic review or learning-unit smoke.'],
    preserved_files: [...frozen].map(([file, hash]) => ({ file: path.relative(root, file).replaceAll('\\', '/'), sha256: hash })) };
for (const [file, hash] of frozen) assert.equal(sha(fs.readFileSync(file)), hash);
fs.writeFileSync(path.join(owned, 'terra-verification.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ counts: report.counts, output: freeze(path.join(owned, 'terra-verification.json')), new_api_calls: 0 }, null, 2));
