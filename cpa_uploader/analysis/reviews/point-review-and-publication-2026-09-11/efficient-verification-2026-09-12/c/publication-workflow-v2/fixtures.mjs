import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import * as v1 from '../stage-publication-v1.ts';
import * as v2 from '../stage-publication-v2.ts';
import { compareChanges, parseArgs as parseLockArgs } from './prepare-lock.ts';
const here = path.dirname(fileURLToPath(import.meta.url)), dir = fs.mkdtempSync(path.join(here, 'synthetic-fixture-'));
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, message: e.message }); } }
const read = f => JSON.parse(fs.readFileSync(f));
const oldLock = read(`${v2.E}/c/publication-workflow-v1/preparation-lock.json`);
const original = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'), candidate = read(`${v2.E}/candidate-v1/candidate-authoring.json`);
const base = ['--batch', 'synthetic-batch.json', '--batch-sha256', 'a'.repeat(64), '--readiness', 'synthetic-readiness.json', '--seal-inputs', 'synthetic-seal.json', '--output', path.resolve(v2.E, 'c/publication-stages/synthetic-unused-v2')];
const args = [...base, '--preparation-lock', path.join(dir, 'synthetic-preparation-not-written.json'), '--preparation-sha256', 'b'.repeat(64)];
test('v2 requires explicit preparation path and SHA; default remains dry-run', () => {
    assert.throws(() => v2.parseOptions(base)); assert.equal(v2.parseOptions(args).execute, false);
    assert.throws(() => v2.parseOptions([...args, '--preparation-lock', 'duplicate']));
    assert.throws(() => v2.parseOptions([...args, '--apply']));
});
test('v1 and v2 produce identical 9-step commands, argv and child environment', () => {
    const stage = path.join(dir, 'stage');
    assert.deepEqual(v2.commands(oldLock.cohorts, 'batch', 'evidence', stage), v1.commands(oldLock.cohorts, 'batch', 'evidence', stage));
    assert.deepEqual(v2.pathEnvironment(stage, { PATH: 'synthetic', OPENAI_API_KEY: 'synthetic' }), v1.pathEnvironment(stage, { PATH: 'synthetic', OPENAI_API_KEY: 'synthetic' }));
});
test('Actual cohort/note declaration yields unchanged 70/50/120; undeclared note drift rejected', () => {
    assert.deepEqual(v2.deriveCohorts(original, candidate, oldLock.cohorts.publish_ids, oldLock.allowed_unselected_note_changes), oldLock.cohorts);
    assert.throws(() => v2.deriveCohorts(original, candidate, oldLock.cohorts.publish_ids));
});
test('Lifecycle-only shape accepted; added prompt/notes rejected', () => {
    const after = structuredClone(candidate); after.forEach(s => { s.status = 'published'; s.verification.review_status = 'verified'; });
    v2.assertLifecycleOnly(candidate, after); after[0].verification.notes.push('synthetic new note'); assert.throws(() => v2.assertLifecycleOnly(candidate, after));
});
test('Actual v2 rejects incorrect preparation hash before any stage creation', () => {
    const file = path.join(dir, 'synthetic-invalid-preparation.json'); fs.writeFileSync(file, '{}', { flag: 'wx' });
    const run = [...base, '--preparation-lock', file, '--preparation-sha256', 'b'.repeat(64), '--execute'];
    assert.throws(() => v2.main(run), /Selected preparation lock byte SHA mismatch/);
    assert(!fs.existsSync(base.at(-1)));
});
test('Actual v2 rejects thinning prior input protection even with correct synthetic file SHA', () => {
    const file = path.join(dir, 'synthetic-thin-preparation.json'); const bytes = JSON.stringify({ inputs: [], allowed_unselected_note_changes: [] }); fs.writeFileSync(file, bytes, { flag: 'wx' });
    assert.throws(() => v2.main([...base, '--preparation-lock', file, '--preparation-sha256', v2.hash(bytes)]), /Preparation protection missing/);
    assert(!fs.existsSync(base.at(-1)));
});
const prior = [{ file: 'synthetic-code.ts', sha256: 'a'.repeat(64), real_path: 'synthetic-code' }, { file: 'synthetic-bank.json', sha256: 'b'.repeat(64), real_path: 'synthetic-bank' }];
const current = [{ ...prior[0], sha256: 'c'.repeat(64) }, prior[1], { file: 'synthetic-new-evidence.json', sha256: 'd'.repeat(64), real_path: 'synthetic-evidence' }];
const review = { artifact_type: 'publication_preparation_change_review', status: 'reviewed', reviewer: 'synthetic_fixture_not_a_person', reviewed_at: '2026-09-12T00:00:00.000Z',
    changes: [{ file: prior[0].file, before_sha256: prior[0].sha256, after_sha256: current[0].sha256, reason: 'Synthetic consumer patch' }],
    validation_evidence: [{ file: 'synthetic-only-validation.json', sha256: 'e'.repeat(64) }] };
test('Reviewed exact synthetic code changes accepted and added evidence kept separate', () => assert.deepEqual(compareChanges(prior, current, review, ['synthetic-bank.json']), review.changes));
test('Pre-patch no-change lock is rejected', () => assert.throws(() => compareChanges(prior, prior, { ...review, changes: [] }, ['synthetic-bank.json']), /not a pre-patch rehash/));
test('Undeclared change, wrong before hash, missing/duplicate declarations rejected', () => {
    assert.throws(() => compareChanges(prior, current, { ...review, changes: [] }, []));
    const wrong = structuredClone(review); wrong.changes[0].before_sha256 = 'f'.repeat(64); assert.throws(() => compareChanges(prior, current, wrong, []));
    assert.throws(() => compareChanges(prior, current, { ...review, changes: [...review.changes, ...review.changes] }, []));
});
test('Removing old protection or changing real path is rejected', () => {
    assert.throws(() => compareChanges(prior, current.slice(0, 1), review, []));
    assert.throws(() => compareChanges(prior, [{ ...current[0], real_path: 'other' }, ...current.slice(1)], review, []));
});
test('Bank/source protection cannot be waived in a code change review', () => {
    const next = structuredClone(current); next[1].sha256 = 'f'.repeat(64);
    const amended = structuredClone(review); amended.changes.push({ file: prior[1].file, before_sha256: prior[1].sha256, after_sha256: next[1].sha256, reason: 'Must still be rejected' });
    assert.throws(() => compareChanges(prior, next, amended, ['synthetic-bank.json']), /Immutable bank/);
});
test('Unreviewed/no-evidence declarations rejected; lock writer defaults to no write', () => {
    assert.throws(() => compareChanges(prior, current, { ...review, status: 'planned' }, []));
    assert.throws(() => compareChanges(prior, current, { ...review, validation_evidence: [] }, []));
    const lockArgs = ['--previous-lock', 'previous', '--previous-sha256', 'a'.repeat(64), '--change-review', 'review', '--change-review-sha256', 'b'.repeat(64), '--manifest', 'manifest', '--manifest-sha256', 'c'.repeat(64), '--output', 'new'];
    assert.equal(parseLockArgs(lockArgs).write, false); assert.throws(() => parseLockArgs([...lockArgs, '--apply']));
});
test('Stage boundary failures and output containment unchanged', () => {
    assert.throws(() => v2.assertStepResult(1, null, undefined)); assert.throws(() => v2.assertStepResult(null, 'SIGINT', undefined));
    assert.throws(() => v2.assertNewOutput(path.resolve(v2.E, 'candidate-v1')));
    const bad = v2.commands(oldLock.cohorts, 'batch', 'evidence', 'stage'); bad.at(-1).args.push('--apply'); assert.throws(() => v2.assertOfflineSteps(bad));
});
fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ scope: 'Synthetic guard fixtures and read-only cohort comparison; no actual successor preparation lock generated',
    results, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, actual_stage_runs: 0, actual_lock_generated: false, canonical_writes: 0, api_calls: 0, db_calls: 0 }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ fixture_output: dir, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass) }));
if (results.some(r => !r.pass)) process.exitCode = 1;
