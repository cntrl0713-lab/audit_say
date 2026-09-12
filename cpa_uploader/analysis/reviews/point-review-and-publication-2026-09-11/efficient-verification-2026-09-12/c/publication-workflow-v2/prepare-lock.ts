import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { E, hash, realIdentity, deriveCohorts } from '../stage-publication-v2.ts';
import { validateAuthoringBank, validatePromotionLedger, loadPromotionLedger } from '../../../../../../questionBankPublication.ts';
import type { QuestionSetV3 } from '../../../../../../../lib/questionV3.ts';

type Ref = { file: string; sha256: string; real_path?: string };
type PriorRef = { file: string; sha256: string | null; real_path: string };
type Change = { file: string; before_sha256: string | null; after_sha256: string; reason: string };
interface Review { artifact_type: 'publication_preparation_change_review'; status: 'reviewed'; reviewer: string; reviewed_at: string; changes: Change[]; validation_evidence: Ref[] }
const V1 = `${E}/c/publication-workflow-v1/preparation-lock.json`;
const CANDIDATE = `${E}/candidate-v1/candidate-authoring.json`, CLASSIFICATION = `${E}/candidate-v1/classification-review.json`;
const ORIGINAL = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json', LEDGER = 'cpa_uploader/data/cpa_question_sets_v3.promotions.json';
const TARGETS = `${E}/candidate-v1/target-scope.json`;
const FIVE = [ORIGINAL, LEDGER, 'cpa_uploader/data/cpa_question_sets_v3.public.json', 'data/cpa_question_sets_v3.authoring.enc.json', 'cpa_uploader/data/learning-question-classifications.json'];
function id(file: string) { const p = path.resolve(file); return process.platform === 'win32' ? p.toLowerCase() : p; }
function real(file: string) { const p = realIdentity(file); return process.platform === 'win32' ? p.toLowerCase() : p; }
function exists(file: string) { try { fs.lstatSync(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
export function parseArgs(args: string[]) {
    const names: Record<string, string> = { '--previous-lock': 'previous', '--previous-sha256': 'previousSha', '--change-review': 'review', '--change-review-sha256': 'reviewSha', '--manifest': 'manifest', '--manifest-sha256': 'manifestSha', '--output': 'output' };
    const value: Record<string, string | boolean> = { write: false }, seen = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        const name = args[i]; assert(!seen.has(name), `Duplicate ${name}`); seen.add(name);
        if (name === '--write') value.write = true;
        else { assert(names[name], `Unsupported option ${name}`); const next = args[++i]; assert(next?.trim() && !next.startsWith('--'), `Missing ${name}`); value[names[name]] = next; }
    }
    for (const name of Object.values(names)) assert(typeof value[name] === 'string', `Missing ${name}`);
    for (const name of ['previousSha', 'reviewSha', 'manifestSha']) assert(/^[a-f0-9]{64}$/.test(String(value[name])), `Explicit ${name} required`);
    return value as unknown as { previous: string; previousSha: string; review: string; reviewSha: string; manifest: string; manifestSha: string; output: string; write: boolean };
}
export function compareChanges(prior: PriorRef[], current: PriorRef[], review: Review, protectedFiles: string[]) {
    assert.equal(review.artifact_type, 'publication_preparation_change_review'); assert.equal(review.status, 'reviewed');
    assert(review.reviewer?.trim() && review.reviewed_at && Number.isFinite(Date.parse(review.reviewed_at)), 'Actual reviewer/date required');
    assert(Array.isArray(review.validation_evidence) && review.validation_evidence.length > 0, 'Post-patch validation evidence required');
    assert.equal(new Set(prior.map(r => id(r.file))).size, prior.length); assert.equal(new Set(current.map(r => id(r.file))).size, current.length);
    assert.equal(new Set(review.changes.map(r => id(r.file))).size, review.changes.length, 'Duplicate reviewed changes');
    const protectedIds = new Set(protectedFiles.map(id)), changes: Change[] = [];
    for (const before of prior) {
        const after = current.find(r => id(r.file) === id(before.file)); assert(after, `Previous protection removed: ${before.file}`);
        assert.equal(after.real_path, before.real_path, `Real-path replacement is outside this follow-up: ${before.file}`);
        if (after.sha256 === before.sha256) continue;
        assert(!protectedIds.has(id(before.file)), `Immutable bank/source/old tool changed: ${before.file}`);
        assert(typeof after.sha256 === 'string', 'Removing a protected input is forbidden');
        const declared = review.changes.find(r => id(r.file) === id(before.file)); assert(declared, `Undeclared change: ${before.file}`);
        assert.equal(declared.before_sha256, before.sha256); assert.equal(declared.after_sha256, after.sha256); assert(declared.reason?.trim());
        changes.push({ ...declared, file: before.file });
    }
    assert.equal(changes.length, review.changes.length, 'Review includes unchanged or absent predecessor files');
    assert(changes.length > 0, 'This successor is for reviewed patches, not a pre-patch rehash');
    return changes;
}

/** Run by root only AFTER reviewed patches/tests and final execution003 manifest exist. */
export function main(args = process.argv.slice(2)) {
    const opts = parseArgs(args), output = path.resolve(opts.output);
    assert(real(output).startsWith(real(`${E}/c/publication-workflow-v2`) + path.sep), 'New lock must stay in this owned follow-up folder');
    assert(!exists(output), 'New lock output already exists');
    assert.equal(id(opts.previous), id(V1), 'This follow-up must explicitly name the preserved v1 predecessor');
    const snapshots = new Map<string, { file: string; bytes: Buffer; real_path: string }>();
    const capture = (file: string, expected?: string) => {
        const key = id(file); let value = snapshots.get(key);
        if (!value) { value = { file: path.resolve(file), bytes: fs.readFileSync(file), real_path: real(file) }; snapshots.set(key, value); }
        if (expected) assert.equal(hash(value.bytes), expected, `Reference hash differs: ${file}`);
        return value.bytes;
    };
    const read = <T>(file: string, expected?: string): T => JSON.parse(capture(file, expected).toString('utf8'));
    const previous = read<{ inputs: PriorRef[]; cohorts: ReturnType<typeof deriveCohorts>; allowed_unselected_note_changes: NonNullable<Parameters<typeof deriveCohorts>[3]> }>(opts.previous, opts.previousSha);
    const review = read<Review>(opts.review, opts.reviewSha);
    const manifest = read<{ artifact_type: string; model: string; bank: Ref; classifications: Ref; policy: Ref; code_files: Ref[]; inputs: Ref[] }>(opts.manifest, opts.manifestSha);
    assert.equal(manifest.artifact_type, 'efficient_grading_manifest'); assert.equal(manifest.model, 'gpt-5.6-luna');
    assert.equal(id(manifest.bank.file), id(CANDIDATE), 'Question bank path changes require a separate workflow review');
    const candidate = read<QuestionSetV3[]>(CANDIDATE, manifest.bank.sha256), original = read<QuestionSetV3[]>(ORIGINAL);
    const classification = read<{ source_file: string; source_file_sha256: string }>(CLASSIFICATION);
    assert.equal(id(classification.source_file), id(CANDIDATE)); assert.equal(classification.source_file_sha256, manifest.bank.sha256);
    const selected = read<{ targets: { set_id: string }[] }>(TARGETS).targets.map(t => t.set_id);
    const cohorts = deriveCohorts(original, candidate, selected, previous.allowed_unselected_note_changes);
    assert.deepEqual(cohorts, previous.cohorts);
    for (const ref of [...manifest.inputs, ...manifest.code_files, manifest.classifications, manifest.policy, ...review.validation_evidence]) capture(ref.file, ref.sha256);
    const extra = [`${E}/c/stage-publication-v2.ts`, fileURLToPath(import.meta.url), opts.previous, opts.review, opts.manifest,
        `${E}/c/install-canonical-v1.ts`, `${E}/c/canonical-installer-v1/implementation-lock.json`];
    for (const file of [...previous.inputs.map(r => r.file), ...extra]) if (exists(file)) capture(file);
    const current: PriorRef[] = [...new Set([...previous.inputs.map(r => path.resolve(r.file)), ...[...snapshots.values()].map(v => v.file)])].sort().map(file => {
        const old = previous.inputs.find(r => id(r.file) === id(file));
        const value = snapshots.get(id(file));
        return { file: old?.file ?? path.relative(process.cwd(), file).replaceAll('\\', '/'), sha256: value ? hash(value.bytes) : null, real_path: real(file) };
    });
    const protectedFiles = [...FIVE, CANDIDATE, CLASSIFICATION, TARGETS, `${E}/candidate-v1/grading-manifest.json`,
        `${E}/c/stage-publication-v1.ts`, `${E}/c/publication-workflow-v1/inspect-and-freeze.mjs`,
        ...candidate.flatMap(s => s.source_refs.map(r => r.file))];
    const changed = compareChanges(previous.inputs, current, review, protectedFiles);
    for (const file of [...FIVE, CANDIDATE, CLASSIFICATION, TARGETS]) assert(previous.inputs.some(r => id(r.file) === id(file) && r.sha256), `Missing protected predecessor ${file}`);
    const stageShape = structuredClone(candidate);
    for (const name of cohorts.reverify_existing_ids) {
        const from = original.find(s => s.id === name)!, to = stageShape.find(s => s.id === name)!;
        to.status = from.status; to.verification.review_status = from.verification.review_status;
    }
    assert.deepEqual(validateAuthoringBank(stageShape).errors, []);
    assert.deepEqual(validatePromotionLedger(stageShape, loadPromotionLedger(LEDGER), false, { pendingReverificationIds: new Set(cohorts.reverify_existing_ids) }), []);
    const guard = () => {
        for (const value of snapshots.values()) { assert.equal(real(value.file), value.real_path); assert.equal(hash(fs.readFileSync(value.file)), hash(value.bytes), `Input changed while preparing lock: ${value.file}`); }
        for (const row of current.filter(r => r.sha256 === null)) assert(!exists(row.file), `Previously absent input appeared: ${row.file}`);
    };
    guard();
    const result = { version: 2, created_at: new Date().toISOString(), status: 'reviewed_successor_preparation_lock_not_execution_evidence',
        predecessor: { file: opts.previous, sha256: opts.previousSha }, change_review: { file: opts.review, sha256: opts.reviewSha },
        execution_manifest: { file: opts.manifest, sha256: opts.manifestSha },
        changes: changed, added_inputs: current.filter(r => !previous.inputs.some(p => id(p.file) === id(r.file))).map(r => r.file),
        inputs: current, allowed_unselected_note_changes: previous.allowed_unselected_note_changes, cohorts,
        checks: { bank_structure_errors: 0, pending70_ledger_errors: 0, no_old_inputs_removed: true, immutable_bank_and_sources_unchanged: true },
        api_calls: 0, db_calls: 0, canonical_writes: 0, sealed_results_validated: false };
    if (!opts.write) { console.log(JSON.stringify({ status: 'dry_run_no_lock_written', changes: changed, guarded_inputs: current.length })); return; }
    assert(!exists(output)); const plannedIdentity = real(output);
    fs.mkdirSync(path.dirname(output), { recursive: true }); assert.equal(real(output), plannedIdentity); guard();
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); guard();
    console.log(JSON.stringify({ status: 'new_preparation_lock_written_not_promoted', file: output, sha256: hash(fs.readFileSync(output)), guarded_inputs: current.length, changes: changed.length }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
