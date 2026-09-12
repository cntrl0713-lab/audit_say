// Read-only inspection and local replay of already recorded production judgments. API 0.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../lib/questionV3Grading.ts';
import { resolveAnswerEvidence } from '../../../../../../lib/questionV3Evidence.ts';

const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../../../..');
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const data = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/grading-inference-followup-v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const frozen = new Map();
function freeze(file, expected) {
    const absolute = path.resolve(root, file), value = sha(fs.readFileSync(absolute));
    if (expected) assert.equal(value, expected, `Input hash mismatch: ${file}`);
    if (frozen.has(absolute)) assert.equal(frozen.get(absolute), value, `Input changed while inspecting: ${file}`);
    frozen.set(absolute, value); return { file: path.relative(root, absolute).replaceAll('\\', '/'), sha256: value };
}
function read(file) { freeze(file); return JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8')); }
const runtimeFile = `${base}/execution-runtime-v6.json`;
const runtimeIdentity = freeze(runtimeFile, '5965bfc11dd440298431c418585b335828a23b10ed56fdca6832e8728ed70ba7');
const runtime = read(runtimeFile);
for (const row of runtime.code_files) freeze(row.file, row.sha256);
freeze(runtime.source_question_bank.file, runtime.source_question_bank.sha256);
const runner = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts';
const runnerText = fs.readFileSync(path.resolve(root, runner), 'utf8');
assert(runnerText.includes("gradeQuestionSetV3(set,answers,process.env.OPENAI_API_KEY||'',value=>{raw=value;},undefined,event=>trace.push(event))"),
    'Recorded runner must use the production path with createResponse explicitly undefined');
const rows = [], crossRound = new Map();
for (const worker of ['a', 'b']) for (const round of [1, 2, 3]) {
    const directory = `${data}/${worker}-round-${round}`;
    const inputs = read(`${directory}/inputs.json`), summary = read(`${directory}/summary.json`);
    assert.equal(inputs.model, runtime.grading_model); assert.equal(summary.model, runtime.grading_model);
    assert.equal(inputs.transport, 'production_gradeQuestionSetV3'); assert.equal(inputs.mock, false);
    assert.equal(summary.planned_cases, 1); assert.equal(summary.recorded_cases, 1); assert.equal(summary.actual_attempts, 1);
    assert.equal(summary.stopped_on_execution_error, false); assert.deepEqual(summary.changed_inputs, []); assert.deepEqual(summary.mismatched_case_ids, []);
    assert.equal(summary.records.length, 1); assert.equal(summary.records[0].error, null);
    for (const [file, hash] of Object.entries(inputs.hashes)) freeze(file, hash);
    assert.equal(inputs.hashes['lib/questionV3Grading.ts'], '0f685328ffa59248ed56e9ff77fafb84e1f5913a3b6e5d1c6c6a208f1f49e124');
    const setFile = Object.keys(inputs.hashes).find(file => file.includes('/sets/'));
    const qaFile = Object.keys(inputs.hashes).find(file => file.includes('/canary-plan-followup-v1/qa-'));
    assert(setFile && qaFile);
    const source = read(setFile), set = Array.isArray(source) ? source[0] : source;
    assert.deepEqual(inputs.question_set, set); assert.deepEqual(inputs.qa, read(qaFile));
    const selected = inputs.qa.cases.filter(sample => sample.id === inputs.selected); assert.equal(selected.length, 1);
    const expected = selected[0], recordFile = `${directory}/${summary.records[0].file}`, record = read(recordFile);
    assert.equal(record.set_id, set.id); assert.equal(record.case_id, expected.id); assert.equal(record.attempt, 1);
    assert.equal(record.transport, 'live_model'); assert.equal(record.model, runtime.grading_model); assert.equal(record.matched, true);
    assert.deepEqual(record.expected, expected);
    const answers = Object.fromEntries(set.subquestions.map(sub => [sub.id, sub.id === expected.subquestion_id ? expected.answer : '']));
    assert.deepEqual(record.answers, answers); assert(Object.values(answers).some(answer => answer.trim()));
    const prompt = buildGradingPrompt(set, answers), schema = buildGradingResponseSchema(set, answers);
    assert.equal(record.request_hash, sha(prompt)); assert.equal(record.schema_hash, sha(JSON.stringify(schema)));
    assert.equal(record.trace.length, 1, 'These early records contain one first-attempt response with no retry/security trace');
    const trace = record.trace[0]; assert.equal(trace.stage, 'judgment'); assert.equal(trace.attempt, 1); assert(!trace.error);
    const raw = trace.response; assert(raw && Array.isArray(raw.subquestions));
    assert.equal(new Set(raw.subquestions.map(sub => sub.subquestion_id)).size, set.subquestions.length);
    assert.equal(raw.subquestions.length, set.subquestions.length);
    const reconstructed = { subquestions: [], injection_detected: false, salad_detected: false };
    for (const rawSub of raw.subquestions) {
        const sub = set.subquestions.find(sub => sub.id === rawSub.subquestion_id); assert(sub);
        assert.equal(rawSub.injection_detected, false); assert.equal(rawSub.salad_detected, false); assert.deepEqual(rawSub.injection_evidence_ids, []);
        assert.equal(rawSub.verdicts.length, sub.criteria.length);
        assert.equal(new Set(rawSub.verdicts.map(v => v.criterion_id)).size, sub.criteria.length);
        const verdicts = rawSub.verdicts.map(value => {
            const criterion = sub.criteria.find(c => c.id === value.criterion_id); assert(criterion);
            assert(['met', 'partial', 'not_met', 'contradicted'].includes(value.verdict));
            if (value.verdict === 'partial') assert(criterion.scores.partial !== undefined);
            assert(Array.isArray(value.evidence_ids));
            if (value.verdict === 'not_met') assert.deepEqual(value.evidence_ids, []);
            return { criterion_id: value.criterion_id, verdict: value.verdict,
                ...(value.verdict === 'not_met' ? {} : { quote: resolveAnswerEvidence(sub.id, answers[sub.id], value.evidence_ids) }),
                ...(typeof value.reason === 'string' ? { reason: value.reason } : {}) };
        });
        reconstructed.subquestions.push({ subquestion_id: sub.id, verdicts, injection_detected: false, salad_detected: false });
    }
    assert.deepEqual(reconstructed, record.raw_judgment, 'Raw response grounding/quotes must reproduce the stored judgment exactly');
    const replayed = applyQuestionSetJudgment(set, answers, record.raw_judgment);
    assert.deepEqual(replayed, record.result, 'Local replay must reproduce every result field, criterion and point');
    assert.equal(replayed.security_flag, 'none'); assert.equal(replayed.score, expected.expected_points);
    assert.equal(replayed.score, worker === 'a' ? 0 : 5);
    const allCriteria = replayed.subquestions.flatMap(sub => sub.criteria.map(c => {
        const expect = sub.subquestion_id === expected.subquestion_id ? expected.expected_verdicts.find(v => v.criterion_id === c.criterion_id) : { verdict: 'not_met' };
        assert(expect); assert.equal(c.verdict, expect.verdict);
        return { subquestion_id: sub.subquestion_id, criterion_id: c.criterion_id, expected: expect.verdict, actual: c.verdict,
            awarded_points: c.awarded_points, quote: c.quote ?? null, reason: c.reason ?? null };
    }));
    assert.deepEqual(record.exact_verdict_differences, []); assert.deepEqual(record.verdict_differences, []);
    const roundIdentity = { set: inputs.question_set, qa: inputs.qa, answers, prompt_hash: record.request_hash, schema_hash: record.schema_hash,
        hashes: inputs.hashes, all_verdicts: allCriteria.map(c => [c.subquestion_id, c.criterion_id, c.actual, c.awarded_points]) };
    if (crossRound.has(worker)) assert.deepEqual(roundIdentity, crossRound.get(worker), 'Repeated rounds use identical inputs and return identical verdicts');
    else crossRound.set(worker, roundIdentity);
    rows.push({ worker, round, set_id: set.id, case_id: expected.id, recorded_production_observations: 1, model: record.model,
        transport: record.transport, mock: inputs.mock, expected_points: expected.expected_points, actual_points: replayed.score,
        request_hash: record.request_hash, schema_hash: record.schema_hash, first_attempt_only: true, all_criteria: allCriteria,
        raw_security: raw.subquestions.map(sub => ({ subquestion_id: sub.subquestion_id, injection_detected: sub.injection_detected, salad_detected: sub.salad_detected })),
        final_security: replayed.security_flag, grounded_raw_matches_stored: true, local_replay_matches_entire_result: true,
        inputs_file: freeze(`${directory}/inputs.json`), summary_file: freeze(`${directory}/summary.json`), record_file: freeze(recordFile) });
}
for (const [file, hash] of frozen) assert.equal(sha(fs.readFileSync(file)), hash, `Protected input changed: ${file}`);
const result = { version: 1, created_at: new Date().toISOString(), reviewer: 'plan_procedures',
    status: 'six_recorded_early_diagnostics_independently_verified', new_model_api_calls: 0,
    method: 'current_request_rebuild_recorded_raw_evidence_grounding_and_applyQuestionSetJudgment_local_replay',
    runtime: runtimeIdentity, recorded_model: runtime.grading_model, recorded_observations: 6, entries: rows,
    code_path: { runner: freeze(runner), createResponse_argument: 'undefined', expectations_injected_as_model_responses: false },
    files_preserved: [...frozen].map(([file, sha256]) => ({ file: path.relative(root, file).replaceAll('\\', '/'), sha256 })),
    limits: ['This inspection adds no model observation and is not a replacement semantic/grading receipt.',
        'The six records demonstrate these two counterexamples only; full canary, all author QA, all learning smoke and deployment remain separate.',
        'The original trace format records configured model and production path, without a separate provider response-model field.'] };
fs.writeFileSync(path.join(owned, 'verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ entries: rows.length, A: rows.filter(r => r.worker === 'a').map(r => r.actual_points),
    B: rows.filter(r => r.worker === 'b').map(r => r.actual_points), preserved_files: frozen.size, errors: 0, api_calls: 0,
    output: path.relative(root, path.join(owned, 'verification.json')).replaceAll('\\', '/') }));
