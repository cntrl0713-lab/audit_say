import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs, partition, safeError, failureKind, rawSecurityFindings, fullCreditFindings, runSequential, verifyFrozenFile, GuardError, RecordingError } from './run-learning-unit-smoke-v3.ts';
import type { GradingTraceV3, QuestionSetGradeResultV3 } from '../../../../../lib/questionV3Grading.ts';
import { gradeQuestionSetV3 } from '../../../../../lib/questionV3Grading.ts';
import { OpenAIRequestError } from '../../../../../lib/ai/openaiStructured.ts';

const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../../..');
const runner = path.join(owned, 'run-learning-unit-smoke-v3.ts');
const manifest = path.join(owned, 'learning-unit-smoke-v3/manifest.json');
const fixtureRoot = fs.mkdtempSync(path.join(owned, 'learning-unit-runner-fixtures-'));
fs.writeFileSync(path.join(fixtureRoot, 'README.md'), 'API 0회 실행기 fixture 증거. 실제 모델 채점·의미검수 결과가 아니다.\n');
const hash = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalManifestHash = hash(manifest);
const unitFile = path.resolve(root, JSON.parse(fs.readFileSync(manifest, 'utf8')).entries[0].file);
const artifact = JSON.parse(fs.readFileSync(unitFile, 'utf8'));
const set = artifact.projected_question_set as Parameters<typeof fullCreditFindings>[0];
const expected = artifact.cases[0].expected as Parameters<typeof fullCreditFindings>[1];
const fullResult: QuestionSetGradeResultV3 = {
    question_set_id: set.id, score: expected.score, max_points: expected.max_points, security_flag: 'none',
    subquestions: set.subquestions.map(sub => ({ subquestion_id: sub.id, prompt: sub.prompt, user_answer: sub.model_answer.join('\n'), model_answer: sub.model_answer,
        score: sub.criteria.reduce((n, c) => n + c.max_points, 0), max_points: sub.criteria.reduce((n, c) => n + c.max_points, 0),
        criteria: sub.criteria.map(c => ({ criterion_id: c.id, claim: c.claim, max_points: c.max_points, awarded_points: c.scores.met, verdict: 'met' as const })) })),
};
const cleanTrace: GradingTraceV3[] = [{ stage: 'judgment', attempt: 1, response: { subquestions: set.subquestions.map(sub => ({ subquestion_id: sub.id, injection_detected: false, salad_detected: false })) } }];

test('CLI accepts only the explicit worker/output contract', () => {
    assert.equal(parseArgs(['--manifest', manifest, '--worker', 'b', '--output', 'new', '--dry-run']).worker, 'b');
    for (const args of [[], ['--manifest', manifest, '--worker', 'd', '--output', 'new'], ['--manifest', manifest, '--worker', 'a', '--output', 'new', '--live'], ['--manifest', manifest, '--worker', 'a', '--worker', 'b', '--output', 'new']]) assert.throws(() => parseArgs(args));
});
test('249 units partition by stable global index into disjoint 83-job workers', () => {
    const rows = Array.from({ length: 249 }, (_, i) => i);
    const parts = (['a', 'b', 'c'] as const).map(worker => partition(rows, worker));
    assert.deepEqual(parts.map(x => x.length), [83, 83, 83]);
    assert.deepEqual(parts.flatMap(x => x.map(y => y.index)).sort((a, b) => a - b), rows);
});
test('root security flags may be absent under the current schema', () => {
    assert.deepEqual(rawSecurityFindings(cleanTrace), []);
    assert.deepEqual(fullCreditFindings(set, expected, fullResult, cleanTrace), []);
});
test('raw per-question security true remains a finding even if final security is clear', () => {
    const traces = structuredClone(cleanTrace);
    (traces[0].response as { subquestions: { injection_detected: boolean }[] }).subquestions[0].injection_detected = true;
    assert(fullCreditFindings(set, expected, fullResult, traces).some(x => x.includes('injection_detected')));
});
test('missing required child security and explicit root security are reported', () => {
    assert(rawSecurityFindings([{ stage: 'judgment', attempt: 1, response: { injection_detected: true, subquestions: [{ subquestion_id: 'x' }] } }]).length === 3);
});
test('full-credit check detects missing criterion and leaves expected values immutable', () => {
    const original = JSON.stringify(expected), result = structuredClone(fullResult);
    result.subquestions[0].criteria.pop();
    assert(fullCreditFindings(set, expected, result, cleanTrace).some(x => x.includes('criterion_coverage')));
    assert.equal(JSON.stringify(expected), original);
});
test('quota takes priority over an outer transport error and secrets are omitted', () => {
    const error = new Error('bad fixture-secret', { cause: { code: 'transport', status: 429, error: { code: 'credit_balance_exhausted' }, headers: { authorization: 'never serialize' } } });
    assert.deepEqual(failureKind(error), { kind: 'quota_exhausted', stopAll: true });
    const safe = JSON.stringify(safeError(error, 'fixture-secret'));
    assert(!safe.includes('fixture-secret') && !safe.includes('authorization'));
});
test('missing or changed frozen input is a fatal guard failure', () => {
    assert.throws(() => verifyFrozenFile(path.join(fixtureRoot, 'missing-frozen-input'), 'x'), GuardError);
    assert.throws(() => verifyFrozenFile(manifest, 'x'), GuardError);
    verifyFrozenFile(manifest, originalManifestHash);
});
test('the production grader does not retry the wrapper nonretryable quota error (fixture transport)', async () => {
    let requests = 0;
    await assert.rejects(gradeQuestionSetV3(set, artifact.cases[0].answers, 'fixture-not-a-real-key', undefined, async () => {
        requests++;
        throw new OpenAIRequestError('configuration', 'Quota exhausted', { cause: { status: 429, error: { code: 'credit_balance_exhausted' } } });
    }), error => failureKind(error).kind === 'quota_exhausted');
    assert.equal(requests, 1);
});
test('one successful observation per job stays sequential', async () => {
    let inFlight = 0, maxFlight = 0, count = 0;
    const result = await runSequential([1, 2, 3], { guard() {}, stopped: () => false, event() {}, execute: async (_job, round) => {
        count++; inFlight++; maxFlight = Math.max(maxFlight, inFlight); await Promise.resolve(); inFlight--; return { round, status: 'passed', issues: [] };
    } });
    assert.equal(result.status, 'passed'); assert.equal(count, 3); assert.equal(maxFlight, 1);
});
test('a first mismatch is kept with exactly three observations despite a later pass', async () => {
    const result = await runSequential([1], { guard() {}, stopped: () => false, event() {}, execute: async (_job, round) => ({ round, status: round === 1 ? 'mismatch' : 'passed', issues: round === 1 ? ['criterion'] : [] }) });
    assert.equal(result.rows[0].status, 'variable'); assert.equal(result.rows[0].observations.length, 3);
});
test('ordinary execution errors are not zero scores and independent jobs continue', async () => {
    const result = await runSequential([1, 2], { guard() {}, stopped: () => false, event() {}, execute: async (job, round) => {
        if (job === 1) throw new Error('fixture connection failure'); return { round, status: 'passed', issues: [] };
    } });
    assert.equal(result.rows[0].status, 'execution_error'); assert.equal(result.rows[0].observations.length, 0); assert.equal(result.rows[1].status, 'passed');
});
test('nested quota stops all remaining jobs without retry', async () => {
    let calls = 0;
    const result = await runSequential([1, 2], { guard() {}, stopped: () => false, event() {}, execute: async () => {
        calls++; throw new Error('transport', { cause: { error: { code: 'insufficient_quota' } } });
    } });
    assert.equal(calls, 1); assert.equal(result.status, 'stopped'); assert.equal(result.remaining_jobs, 1);
});
test('stop before a job executes none', async () => {
    const result = await runSequential([1], { guard() {}, stopped: () => true, event() {}, execute: async () => { throw Error('must not execute'); } });
    assert.equal(result.status, 'stopped'); assert.equal(result.rows[0].status, 'stopped');
});
test('post-observation changed input preserves the observation and stops next job', async () => {
    let changed = false, calls = 0;
    const result = await runSequential([1, 2], { guard() { if (changed) throw new GuardError('fixture source hash'); }, stopped: () => false, event() {}, execute: async (_job, round) => {
        calls++; changed = true; return { round, status: 'passed', issues: [] };
    } });
    assert.equal(calls, 1); assert.equal(result.rows[0].status, 'frozen_input_changed'); assert.equal(result.rows[0].observations.length, 1); assert.equal(result.status, 'stopped');
});
test('recording failure stops without repeating the executed job', async () => {
    let calls = 0;
    const result = await runSequential([1, 2], { guard() {}, stopped: () => false, event() {}, execute: async () => { calls++; throw new RecordingError('fixture disk full'); } });
    assert.equal(calls, 1); assert.equal(result.rows[0].status, 'recording_failed');
});
test('real CLI dry-run validates every frozen artifact for all workers without a key', () => {
    for (const worker of ['a', 'b', 'c']) {
        const output = path.join(fixtureRoot, 'dry-' + worker);
        const child = spawnSync(process.execPath, ['--import', 'tsx', runner, '--manifest', manifest, '--worker', worker, '--output', output, '--dry-run'], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '' }, timeout: 90000 });
        fs.writeFileSync(path.join(fixtureRoot, 'cli-' + worker + '.json'), JSON.stringify({ status: child.status, stdout: child.stdout, stderr: child.stderr, model_api_calls: 0 }));
        assert.equal(child.status, 0, child.stderr);
        const summary = JSON.parse(fs.readFileSync(path.join(output, 'summary.json'), 'utf8'));
        assert.equal(summary.selected_jobs, 83); assert.equal(summary.model_calls, 0);
    }
    assert.equal(hash(manifest), originalManifestHash);
});
test('real CLI preserves existing output and stop-file exits before key lookup', () => {
    const common = ['--import', 'tsx', runner, '--manifest', manifest, '--worker', 'a', '--output'];
    const before = hash(path.join(fixtureRoot, 'dry-a/summary.json'));
    const exists = spawnSync(process.execPath, [...common, path.join(fixtureRoot, 'dry-a'), '--dry-run'], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '' } });
    assert.notEqual(exists.status, 0); assert.equal(hash(path.join(fixtureRoot, 'dry-a/summary.json')), before);
    const stopFile = path.join(fixtureRoot, 'STOP'); fs.writeFileSync(stopFile, 'fixture stop');
    const output = path.join(fixtureRoot, 'stopped');
    const stopped = spawnSync(process.execPath, [...common, output, '--stop-file', stopFile], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '' }, timeout: 90000 });
    assert.notEqual(stopped.status, 0);
    const summary = JSON.parse(fs.readFileSync(path.join(output, 'summary.json'), 'utf8'));
    assert.equal(summary.status, 'stopped'); assert.equal(summary.model_calls, 0); assert.equal(summary.remaining_jobs, 83);
});
