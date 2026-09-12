import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { E, hash, realIdentity, deriveCohorts, assertLifecycleOnly, pathEnvironment, commands, assertOfflineSteps,
    parseOptions, assertNewOutput, assertInputRefs, assertStepResult, main } from '../stage-publication-v1.ts';
const here = path.dirname(fileURLToPath(import.meta.url));
const output = fs.mkdtempSync(path.join(here, 'synthetic-fixture-'));
const read = file => JSON.parse(fs.readFileSync(file));
const original = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const candidate = read(`${E}/candidate-v1/candidate-authoring.json`);
const locked = read(path.join(here, 'preparation-lock.json'));
const ids = locked.cohorts.publish_ids;
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, message: error.message }); } }
test('Current actual cohorts 70/50/120 with two exact historical note corrections', () => assert.deepEqual(deriveCohorts(original, candidate, ids, locked.allowed_unselected_note_changes), locked.cohorts));
test('Undeclared notes are rejected, even when only migration paths differ', () => assert.throws(() => deriveCohorts(original, candidate, ids)));
test('Declared notes do not permit arbitrary added text', () => {
    const bank = structuredClone(candidate); bank.find(s => s.id === locked.allowed_unselected_note_changes[0].set_id).verification.notes.push('unreviewed change');
    assert.throws(() => deriveCohorts(original, bank, ids, locked.allowed_unselected_note_changes));
});
test('Missing target rejected', () => assert.throws(() => deriveCohorts(original, candidate, ids.slice(1), locked.allowed_unselected_note_changes)));
test('Duplicate target rejected', () => assert.throws(() => deriveCohorts(original, candidate, [...ids, ids[0]], locked.allowed_unselected_note_changes)));
test('Unselected new source set rejected', () => {
    const bank = structuredClone(candidate); const extra = structuredClone(bank.at(-1)); extra.id = 'synthetic-unselected'; bank.push(extra);
    assert.throws(() => deriveCohorts(original, bank, ids, locked.allowed_unselected_note_changes));
});
test('Synthetic lifecycle labels only are accepted without modifying original', () => {
    const after = structuredClone(candidate); for (const s of after) { s.status = 'published'; s.verification.review_status = 'verified'; }
    assertLifecycleOnly(candidate, after);
});
test('Notes change changes reviewed content and is rejected after staging', () => {
    const after = structuredClone(candidate); after[0].verification.notes.push('archive only'); assert.throws(() => assertLifecycleOnly(candidate, after));
});
test('Prompt changes rejected after staging', () => {
    const after = structuredClone(candidate); after[0].subquestions[0].prompt += '?'; assert.throws(() => assertLifecycleOnly(candidate, after));
});
test('Child four paths override hostile inherited paths; parent unchanged; credentials suppressed', () => {
    const inherited = { CPA_QUESTION_V3_AUTHORING_PATH: 'canonical', CPA_QUESTION_V3_PROMOTIONS_PATH: 'ledger',
        CPA_QUESTION_V3_PUBLIC_PATH: 'public', CPA_QUESTION_V3_ENCRYPTED_PATH: 'encrypted',
        OPENAI_API_KEY: 'synthetic-not-a-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-not-a-key',
        CPA_QUESTION_V3_ENCRYPTION_KEY: 'synthetic-fixture-only', NODE_OPTIONS: '--synthetic' };
    const snapshot = structuredClone(inherited), stage = path.join(output, 'stage'), env = pathEnvironment(stage, inherited);
    assert.deepEqual(inherited, snapshot);
    for (const name of ['AUTHORING', 'PROMOTIONS', 'PUBLIC', 'ENCRYPTED']) assert(env[`CPA_QUESTION_V3_${name}_PATH`].startsWith(stage + path.sep));
    assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined); assert.equal(env.NODE_OPTIONS, undefined);
    assert.equal(env.CPA_QUESTION_V3_ENCRYPTION_KEY, inherited.CPA_QUESTION_V3_ENCRYPTION_KEY);
});
test('Production CLI order includes offline importer only', () => {
    const steps = commands(locked.cohorts, 'synthetic-batch.json', 'synthetic evidence', path.join(output, 'stage')); assertOfflineSteps(steps);
    assert.equal(steps[1].args[steps[1].args.indexOf('--sets') + 1].split(',').length, 70);
    assert.equal(steps[2].args[steps[2].args.indexOf('--sets') + 1].split(',').length, 50);
    assert(!steps.at(-1).args.includes('--apply'));
});
test('DB apply and stage reordering are rejected', () => {
    const steps = commands(locked.cohorts, 'synthetic-batch.json', 'synthetic evidence', output);
    const changed = structuredClone(steps); changed.at(-1).args.push('--apply'); assert.throws(() => assertOfflineSteps(changed));
    [steps[1], steps[2]] = [steps[2], steps[1]]; assert.throws(() => assertOfflineSteps(steps));
});
const args = ['--batch', 'future.json', '--batch-sha256', 'a'.repeat(64), '--readiness', 'ready.json', '--seal-inputs', 'seal.json', '--output', path.join(E, 'c/publication-stages/new')];
test('Default is dry-run and CLI rejects apply/duplicates/ambiguous modes', () => {
    assert.equal(parseOptions(args).execute, false);
    assert.throws(() => parseOptions([...args, '--apply'])); assert.throws(() => parseOptions([...args, '--batch', 'other.json']));
    assert.throws(() => parseOptions([...args, '--execute', '--dry-run']));
});
test('Output containment and existing-output guards', () => {
    assertNewOutput(path.resolve(E, 'c/publication-stages/synthetic-unused'));
    assert.throws(() => assertNewOutput(path.resolve(E, 'candidate-v1')));
    assert.throws(() => assertNewOutput(path.resolve(E, 'c/publication-stages/../outside')));
    assert.throws(() => assertNewOutput(output));
});
test('Byte drift guard detects even same-path contents changed', () => {
    const file = path.join(output, 'synthetic-input.txt'); fs.writeFileSync(file, 'before', { flag: 'wx' });
    const identity = realIdentity(file); const refs = [{ file, sha256: hash(fs.readFileSync(file)), real_path: process.platform === 'win32' ? identity.toLowerCase() : identity }];
    assertInputRefs(refs); fs.writeFileSync(file, 'after'); assert.throws(() => assertInputRefs(refs));
});
test('CLI failures, signals and spawn errors stop; only successful zero exit accepted', () => {
    assertStepResult(0, null, undefined);
    assert.throws(() => assertStepResult(1, null, undefined)); assert.throws(() => assertStepResult(null, 'SIGINT', undefined));
    assert.throws(() => assertStepResult(null, null, new Error('synthetic spawn failure')));
});
test('No sealed batch: actual helper refuses before any staging output or child execution', () => {
    const stageOut = path.resolve(E, 'c/publication-stages/synthetic-missing-seal-do-not-create');
    const call = ['--batch', path.join(output, 'nonexistent-sealed-batch.json'), '--batch-sha256', 'a'.repeat(64), '--readiness', path.join(output, 'not-created-ready.json'), '--seal-inputs', path.join(output, 'not-created-seal.json'), '--output', stageOut, '--execute'];
    assert.throws(() => main(call), /ENOENT/); assert(!fs.existsSync(stageOut));
});
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ scope: 'Synthetic/pure local fixtures; no publication CLI, API, or DB execution', results,
    passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, api_calls: 0, db_calls: 0, production_promotions: 0 }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ fixture_output: output, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass) }));
if (results.some(r => !r.pass)) process.exitCode = 1;
