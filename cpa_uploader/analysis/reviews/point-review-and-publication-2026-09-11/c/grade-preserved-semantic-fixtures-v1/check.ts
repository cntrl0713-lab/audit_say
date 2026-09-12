/** Local provenance and tamper regressions only. No child process/API is started. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { prepare, validateTransition, verifyChunks, validateCompletionExit, controlEvent, main, read, resolve, fileHash, D, GRADER, AFTER, SELF } from '../grade-preserved-semantic-v1.ts';
import type { Manifest } from '../grade-preserved-semantic-v1.ts';

process.env.CPA_GRADING_MODEL = 'gpt-5.6-luna';
process.env.CPA_REVIEW_MODEL = 'gpt-5.6-luna';
process.env.CPA_REVIEW_INPUT_MAX_CHARS = '500000';
let calls = 0;
globalThis.fetch = async () => { calls++; throw Error('Fixture forbids network'); };
const base = `${D}/c/grade-preserved-semantic-fixtures-v1`;
const fixture = `${base}/manifest-fixture.json`;
const origin = read<Manifest>(`${D}/execution-resumes/resume-2026-09-12-v2/canary/manifest.json`);
const current = read<Manifest>(fixture);
const options = { manifest: fixture, manifestSha256: fileHash(fixture), output: `${base}/never-created-dryrun`, stopFile: `${D}/execution-resumes/resume-2026-09-12-v2/canary/STOP` };
const p = prepare(options);
const raw = fs.readFileSync(resolve(`${D}/execution-resumes/resume-2026-09-12-v2/canary/semantic-a/pilot-01-002/semantic.json.chunks.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line)) as Parameters<typeof verifyChunks>[2];
const records: { name: string; passed: boolean }[] = [];
const check = (name: string, fn: () => unknown) => test(name, async () => { await fn(); records.push({ name, passed: true }); });

check('Actual 11 chunks and all 45 original generated cases match current semantic input, schema and grounding', () => {
    assert.equal(p.matches.length, 11); assert.equal(p.receipt.cases.length, 45);
    assert.equal(p.provenance.unique_nonempty_runs, 38); assert.equal(p.provenance.empty_no_model_runs, 1);
    assert(!fs.existsSync(p.output)); p.guard();
});
check('Only approved before/after grader transition passes', () => assert.equal(validateTransition(origin, current).job.set_id, 'pilot-01-002'));
const transitionReject = (name: string, mutate: (m: Manifest) => void, re: RegExp) => check(name, () => { const m = structuredClone(current); mutate(m); assert.throws(() => validateTransition(origin, m), re); });
transitionReject('Different grader patch is rejected', m => { m.code_files.find(r => r.file === GRADER)!.sha256 = 'a'.repeat(64); }, /Unapproved/);
transitionReject('Other engine hash change is rejected', m => { m.code_files.find(r => r.file === 'cpa_uploader/questionSemanticReview.ts')!.sha256 = AFTER; }, /Unapproved/);
transitionReject('Omitted frozen engine is rejected', m => { m.code_files = m.code_files.filter(r => r.file !== 'lib/questionV3Evidence.ts'); }, /missing/);
transitionReject('Duplicate code identity is rejected', m => { m.code_files.push(m.code_files[0]); }, /Duplicate/);
transitionReject('Question change is rejected', m => { m.jobs[0].sha256 = AFTER; }, /Question/);
transitionReject('Plan-only change is rejected', m => { m.jobs[0].plan_sha256 = AFTER; }, /plan/);
transitionReject('Source content change is rejected', m => { m.jobs[0].source_files[0].sha256 = AFTER; }, /Source/);
transitionReject('Peer bank change is rejected', m => { m.bank_sha256 = AFTER; }, /Bank/);
transitionReject('Different new owner is rejected', m => { m.jobs[0].worker = 'c'; }, /original A/);
check('Master v8 assignment c is rejected; only final wave reassignment a may execute', () => {
    assert.throws(() => validateTransition(origin, read<Manifest>(`${D}/a/execution-all-v8/manifest.json`)), /new owner a/);
});
transitionReject('Duplicate assigned job is rejected', m => { m.jobs.push(m.jobs[0]); }, /original A/);
transitionReject('Different model is rejected', m => { m.model = 'other'; }, /Model/);
transitionReject('Different budget is rejected', m => { m.max_input_chars = 400000; }, /budget/);
const rawReject = (name: string, mutate: (value: typeof raw) => void, re: RegExp) => check(name, () => { const value = structuredClone(raw); mutate(value); assert.throws(() => verifyChunks(p.prepared, p.receipt, value), re); });
rawReject('Actual input hash alteration is rejected', a => { a[0].input_hash = AFTER; }, /input\/schema/);
rawReject('Actual schema hash alteration is rejected', a => { a[0].schema_hash = AFTER; }, /input\/schema/);
rawReject('Missing actual unit is rejected', a => { a.pop(); }, /exactly 11/);
rawReject('Duplicate/foreign actual unit is rejected', a => { a[0].unit_id = a[1].unit_id; }, /Missing\/duplicate/);
rawReject('Injected transport is rejected', a => { a[0].transport = 'injected_response'; }, /transport/);
rawReject('Failed chunk cannot count as successful observation', a => { a[0].error = 'timeout'; }, /transport/);
rawReject('Raw source alteration is rejected', a => { a[0].source_files[0].sha256 = AFTER; }, /source mismatch/);
rawReject('Modified raw response is rejected by official grounding', a => { a[0].response = {}; }, /./);
check('Receipt semantic replacement is rejected', () => {
    const changed = structuredClone(p.receipt); changed.notes.push('fabricated');
    assert.throws(() => verifyChunks(p.prepared, changed, raw), /differs/);
});
check('Wrong expected manifest digest is rejected', () => assert.throws(() => prepare({ ...options, manifestSha256: AFTER }), /Frozen file mismatch/));
check('Existing output is rejected without changing it', () => assert.throws(() => prepare({ ...options, output: base }), /new directory/));
check('Output outside assigned review batch is rejected', () => assert.throws(() => prepare({ ...options, output: 'tmp/forbidden-preserved-semantic-output' }), /review batch/));
check('Unsafe STOP target is rejected', () => assert.throws(() => prepare({ ...options, stopFile: `${D}/c/STOP` }), /separate batch/));
check('Environment drift is rejected', () => {
    process.env.CPA_GRADING_MODEL = 'wrong';
    try { assert.throws(p.guard, /environment/); } finally { process.env.CPA_GRADING_MODEL = 'gpt-5.6-luna'; }
});
check('CLI rejects implicit execution; explicit dry-run remains required', async () => {
    await assert.rejects(main([]), /exactly one/);
    await assert.rejects(main(['--dry-run', '--execute']), /exactly one/);
});
check('Shared STOP is observed without killing active CLI', () => {
    let aborts = 0; const state = { shared_stop_observed: false, quota_exhausted: false };
    controlEvent(state, 'shared-stop', () => { aborts++; }, () => { throw Error('unexpected quota write'); });
    assert.equal(aborts, 0); assert.equal(state.shared_stop_observed, true);
});
check('Quota records STOP and lets CLI preserve its own error exit', () => {
    let aborts = 0, records = 0; const state = { shared_stop_observed: false, quota_exhausted: false };
    controlEvent(state, 'quota', () => { aborts++; }, () => { records++; });
    assert.equal(aborts, 0); assert.equal(records, 1); assert.equal(state.quota_exhausted, true);
});
check('Input drift and explicit operator interruption abort immediately', () => {
    let aborts = 0; const state = { shared_stop_observed: false, quota_exhausted: false };
    controlEvent(state, 'drift', () => { aborts++; }, () => {}); controlEvent(state, 'operator', () => { aborts++; }, () => {});
    assert.equal(aborts, 2);
});
check('Exact grading mismatch with exit 1 is preserved as mismatch', () => validateCompletionExit(1, ['x: 실제 채점 결과가 검토 사례의 기대 판정과 다릅니다.'], ['x']));
check('Malformed-output error is never accepted as a grading mismatch', () => assert.throws(() => validateCompletionExit(1, ['invalid raw judgment'], ['x']), /beyond/));
check('Different mismatch ID is rejected', () => assert.throws(() => validateCompletionExit(1, ['y: 실제 채점 결과가 검토 사례의 기대 판정과 다릅니다.'], ['x']), /beyond/));
check('Execution failure with no mismatch is not a pass', () => assert.throws(() => validateCompletionExit(1, [], []), /exit status/));
check('Killed subprocess cannot pass despite complete-looking receipt', () => assert.throws(() => validateCompletionExit(null, [], [], 'SIGTERM'), /signal/));
check('Complete pass requires exit 0 and no errors', () => validateCompletionExit(0, [], []));
after(() => {
    p.guard(); assert.equal(calls, 0); assert(!fs.existsSync(p.output));
    const report = fs.existsSync(resolve(`${base}/checks-v3.json`)) ? `${base}/checks-repeat-${Date.now()}.json` : `${base}/checks-v3.json`;
    fs.writeFileSync(resolve(report), JSON.stringify({ created_at: new Date().toISOString(), purpose: 'Local fixture only; no model or subprocess execution',
        helper: { file: SELF, sha256: fileHash(SELF) }, fixture_manifest_sha256: fileHash(fixture), api_calls: calls,
        subprocesses_started: 0, output_directory_created: false, successful_checks: records.length, records, provenance: p.provenance }, null, 2) + '\n', { flag: 'wx' });
});
