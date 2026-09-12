import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../../../questionReviewIdentity.ts';
import { createEfficientReviewReceipt, createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../../../../../questionEfficientReview.ts';
import { validateAuthoringBank, validatePromotionLedger, loadPromotionLedger } from '../../../../../questionBankPublication.ts';
import { compilePublicQuestionSet } from '../../../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../../../lib/questionV3.ts';

// This batch only. No canonical installation, DB apply, or model invocation.
export const E = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12';
const C = `${E}/c`, CANDIDATE = `${E}/candidate-v1/candidate-authoring.json`;
const ORIGINAL = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const ORIGINAL_LEDGER = 'cpa_uploader/data/cpa_question_sets_v3.promotions.json';
const REVIEW = `${E}/candidate-v1/classification-review.json`;
const PREDECESSOR_PREPARATION = `${C}/publication-workflow-v1/preparation-lock.json`;
export const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
type FileRef = { file: string; sha256: string | null; real_path: string };
type Cohorts = { reverify_existing_ids: string[]; verify_new_ids: string[]; publish_ids: string[] };
type NoteCorrection = { set_id: string; before_hash: string; after_hash: string; before_notes: string[]; after_notes: string[] };
interface Options { batch: string; batchSha: string; readiness: string; sealInputs: string; preparation: string; preparationSha: string; output: string; execute: boolean }
interface Step { id: string; args: string[] }
const slash = (file: string) => file.replaceAll('\\', '/');
function exists(file: string) { try { fs.lstatSync(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
export function realIdentity(file: string): string {
    const resolved = path.resolve(file);
    if (exists(resolved)) return fs.realpathSync(resolved);
    const parent = path.dirname(resolved);
    return parent === resolved ? resolved : path.join(realIdentity(parent), path.basename(resolved));
}
function key(file: string) { const value = realIdentity(file); return process.platform === 'win32' ? value.toLowerCase() : value; }
export function assertNewOutput(output: string, root = process.cwd()) {
    const allowed = key(path.join(root, C, 'publication-stages'));
    const target = key(output);
    assert(target.startsWith(allowed + path.sep), 'Output must be a new child of this batch c/publication-stages');
    assert(!exists(output), 'Output already exists. Preserve partial evidence; do not rerun or overwrite it.');
}
export function parseOptions(args: string[]): Options {
    const options: Record<string, string | boolean> = { execute: false };
    const names: Record<string, string> = { '--batch': 'batch', '--batch-sha256': 'batchSha', '--readiness': 'readiness', '--seal-inputs': 'sealInputs', '--preparation-lock': 'preparation', '--preparation-sha256': 'preparationSha', '--output': 'output' };
    const seen = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        assert(!seen.has(arg), `Duplicate argument: ${arg}`); seen.add(arg);
        if (arg === '--execute') options.execute = true;
        else if (arg === '--dry-run') options.execute = false;
        else {
            assert(names[arg], `Unsupported argument: ${arg}`);
            const value = args[++i]; assert(value?.trim() && !value.startsWith('--'), `Missing value: ${arg}`);
            options[names[arg]] = value;
        }
    }
    assert(!(seen.has('--execute') && seen.has('--dry-run')), 'Choose execute or dry-run, not both');
    for (const name of Object.values(names)) assert(typeof options[name] === 'string', `Missing ${name}`);
    assert(/^[a-f0-9]{64}$/.test(String(options.batchSha)), 'Explicit sealed batch SHA-256 is required');
    assert(/^[a-f0-9]{64}$/.test(String(options.preparationSha)), 'Explicit reviewed preparation lock SHA-256 is required');
    return options as unknown as Options;
}
export function deriveCohorts(original: QuestionSetV3[], candidate: QuestionSetV3[], selected: string[], noteCorrections: NoteCorrection[] = []): Cohorts {
    assert.equal(new Set(selected).size, selected.length, 'Duplicate target IDs');
    assert.equal(new Set(original.map(s => s.id)).size, original.length);
    assert.equal(new Set(candidate.map(s => s.id)).size, candidate.length);
    const oldIds = new Set(original.map(s => s.id));
    assert(original.every(s => candidate.some(t => t.id === s.id)), 'Original set removed');
    assert(selected.every(id => candidate.some(s => s.id === id)), 'Target missing from candidate');
    const result = { reverify_existing_ids: selected.filter(id => oldIds.has(id)), verify_new_ids: selected.filter(id => !oldIds.has(id)), publish_ids: selected };
    assert.deepEqual([result.reverify_existing_ids.length, result.verify_new_ids.length, result.publish_ids.length], [70, 50, 120], 'This helper is limited to the reviewed 70/50/120 batch');
    assert.deepEqual(candidate.filter(s => !oldIds.has(s.id)).map(s => s.id).sort(), [...result.verify_new_ids].sort(), 'Unselected new set');
    for (const previous of original.filter(s => !selected.includes(s.id))) {
        const next = candidate.find(s => s.id === previous.id)!;
        const declaration = noteCorrections.find(n => n.set_id === previous.id);
        const comparable = structuredClone(previous);
        if (declaration) {
            assert.equal(reviewedContentHash(previous), declaration.before_hash);
            assert.equal(reviewedContentHash(next), declaration.after_hash);
            assert.deepEqual(previous.verification.notes, declaration.before_notes);
            assert.deepEqual(next.verification.notes, declaration.after_notes);
            comparable.verification.notes = declaration.after_notes;
        }
        assert.deepEqual(next, comparable, `${previous.id}: undeclared unselected drift`);
    }
    assert(noteCorrections.every(n => oldIds.has(n.set_id) && !selected.includes(n.set_id)), 'Note correction outside unchanged cohort');
    return result;
}
export function assertLifecycleOnly(before: QuestionSetV3[], after: QuestionSetV3[]) {
    assert.deepEqual(before.map(s => s.id), after.map(s => s.id), 'Set ID/order changed');
    for (let i = 0; i < before.length; i++) {
        assert.equal(reviewedContentHash(before[i]), reviewedContentHash(after[i]), `${before[i].id}: reviewed content changed (notes are included)`);
        const strip = (set: QuestionSetV3) => {
            const copy = structuredClone(set) as Partial<QuestionSetV3>;
            delete copy.status; delete (copy.verification as Partial<QuestionSetV3['verification']>).review_status; return copy;
        };
        assert.deepEqual(strip(before[i]), strip(after[i]));
    }
}
export function pathEnvironment(stage: string, inherited = process.env): NodeJS.ProcessEnv {
    // Each subprocess gets its own overrides. The parent environment is untouched.
    const env: NodeJS.ProcessEnv = { ...inherited,
        CPA_QUESTION_V3_AUTHORING_PATH: path.join(stage, 'authoring.json'),
        CPA_QUESTION_V3_PROMOTIONS_PATH: path.join(stage, 'promotions.json'),
        CPA_QUESTION_V3_PUBLIC_PATH: path.join(stage, 'public.json'),
        CPA_QUESTION_V3_ENCRYPTED_PATH: path.join(stage, 'authoring.enc.json') };
    // No model/DB credentials are necessary for these offline CLIs.
    for (const name of Object.keys(env)) if (/OPENAI|ANTHROPIC|SUPABASE|AZURE_OPENAI/i.test(name)) delete env[name];
    delete env.NODE_OPTIONS;
    return env;
}
export function commands(cohorts: Cohorts, batch: string, evidence: string, stage: string): Step[] {
    const promote = 'cpa_uploader/promote_cpa_v3.ts';
    return [
        { id: '01-prepare', args: [`${E}/prepare-publication.ts`, '--batch', batch, '--output', stage] },
        { id: '02-reverify-existing', args: [promote, '--to', 'verified', '--reverify', '--sets', cohorts.reverify_existing_ids.join(','), '--efficient-review', batch, '--evidence', evidence] },
        { id: '03-verify-new', args: [promote, '--to', 'verified', '--sets', cohorts.verify_new_ids.join(','), '--efficient-review', batch, '--evidence', evidence] },
        { id: '04-publish-selected', args: [promote, '--to', 'published', '--sets', cohorts.publish_ids.join(','), '--evidence', evidence] },
        { id: '05-compile-public-encrypted', args: ['scripts/compile-question-bank-v3.ts'] },
        { id: '06-rebind-catalog', args: [`${C}/rebind-final-catalog.ts`, '--bank', path.join(stage, 'authoring.json'), '--review', REVIEW, '--output', path.join(stage, 'published-classification-review.json'), '--catalog-output', path.join(stage, 'learning-question-classifications.json')] },
        { id: '07-full-static-validation', args: ['cpa_uploader/validate_cpa_v3.ts'] },
        { id: '08-catalog-reproduction', args: ['scripts/build-learning-unit-catalog.ts', '--review', path.join(stage, 'published-classification-review.json'), '--output', path.join(stage, 'learning-question-classifications.json'), '--check'] },
        { id: '09-import-local-readiness', args: ['scripts/import-question-bank-v3.ts', '--learning-catalog', path.join(stage, 'learning-question-classifications.json'), '--report', path.join(stage, 'db-readiness.json')] },
    ];
}
export function assertOfflineSteps(steps: Step[]) {
    assert.deepEqual(steps.map(s => s.id), ['01-prepare', '02-reverify-existing', '03-verify-new', '04-publish-selected', '05-compile-public-encrypted', '06-rebind-catalog', '07-full-static-validation', '08-catalog-reproduction', '09-import-local-readiness']);
    for (const step of steps) assert(!step.args.some(a => ['--apply', '--preserve-source', '--backfill-verified', '--review'].includes(a) && !(a === '--review' && ['06-rebind-catalog', '08-catalog-reproduction'].includes(step.id))), `Forbidden option: ${step.id}`);
    assert(steps[1].args.includes('--reverify'));
    assert(!steps[2].args.includes('--reverify'));
    assert(!steps[3].args.includes('--efficient-review'));
}
export function assertInputRefs(refs: FileRef[], root = process.cwd()) {
    for (const ref of refs) {
        const file = path.resolve(root, ref.file);
        assert.equal(key(file), ref.real_path, `Input real path changed: ${ref.file}`);
        assert.equal(exists(file) ? hash(fs.readFileSync(file)) : null, ref.sha256, `Input bytes changed: ${ref.file}. Notes/path-only drift is not waived.`);
    }
}
export function assertStepResult(status: number | null, signal: string | null, error: Error | undefined) {
    assert(!error && status === 0 && signal === null, 'CLI failed/interrupted; preserve this output, stop, and inspect before any resume');
}

export function main(args = process.argv.slice(2)) {
    const workflowStartedAt = new Date().toISOString(), workflowStartedMs = Date.now();
    const opts = parseOptions(args), root = process.cwd(), output = path.resolve(opts.output), stage = path.join(output, 'stage');
    assertNewOutput(output);
    const snapshots = new Map<string, { bytes: Buffer; identity: string }>();
    const read = <T>(file: string): T => {
        const full = path.resolve(file); let snapshot = snapshots.get(full);
        if (!snapshot) { snapshot = { bytes: fs.readFileSync(full), identity: key(full) }; snapshots.set(full, snapshot); }
        return JSON.parse(snapshot.bytes.toString('utf8')) as T;
    };
    assert(key(opts.preparation).startsWith(key(E) + path.sep), 'Preparation lock must belong to this batch');
    const lock = read<{ inputs: FileRef[]; allowed_unselected_note_changes: NoteCorrection[] }>(opts.preparation);
    assert.equal(hash(snapshots.get(path.resolve(opts.preparation))!.bytes), opts.preparationSha, 'Selected preparation lock byte SHA mismatch');
    // Preserve the original protected input surface; only an explicitly reviewed successor can change expected hashes.
    const predecessor = read<{ inputs: FileRef[] }>(PREDECESSOR_PREPARATION);
    for (const file of [...predecessor.inputs.map(r => r.file), fileURLToPath(import.meta.url), PREDECESSOR_PREPARATION]) {
        assert(lock.inputs.some(r => path.resolve(r.file) === path.resolve(file)), `Preparation protection missing: ${file}`);
    }
    assert.equal(new Set(lock.inputs.map(r => path.resolve(r.file))).size, lock.inputs.length, 'Duplicate preparation input paths');
    assertInputRefs(lock.inputs);
    const guard = () => {
        assertInputRefs(lock.inputs);
        for (const [file, before] of snapshots) {
            assert.equal(key(file), before.identity, `Input path drift: ${file}`);
            assert.equal(hash(fs.readFileSync(file)), hash(before.bytes), `Input byte drift: ${file}`);
        }
    };
    const original = read<QuestionSetV3[]>(ORIGINAL), candidate = read<QuestionSetV3[]>(CANDIDATE);
    const scope = read<{ targets: { set_id: string; subquestion_ids: string[] }[] }>(`${E}/candidate-v1/target-scope.json`);
    const cohorts = deriveCohorts(original, candidate, scope.targets.map(t => t.set_id), lock.allowed_unselected_note_changes);
    const preparationIdentity = { file: slash(path.relative(root, path.resolve(opts.preparation))), sha256: opts.preparationSha };
    for (const target of scope.targets) assert.deepEqual(candidate.find(s => s.id === target.set_id)!.subquestions.map(q => q.id), target.subquestion_ids);
    const batch = read<{ grading_manifest: { file: string; sha256: string } }>(opts.batch);
    assert.equal(hash(snapshots.get(path.resolve(opts.batch))!.bytes), opts.batchSha, 'Sealed batch byte SHA mismatch');
    const readiness = read<{ ready: boolean; core_replay_passed: boolean; problems: unknown[]; batch: { file: string; sha256: string } }>(opts.readiness);
    assert.equal(readiness.ready, true, 'Sealed readiness is not ready');
    assert.equal(readiness.core_replay_passed, true); assert.deepEqual(readiness.problems, []);
    const sealedInputs = read<{ batch: { file: string; sha256: string }; grading_manifest: { file: string; sha256: string }; source_inputs: { file: string; sha256: string }[] }>(opts.sealInputs);
    for (const ref of [readiness.batch, sealedInputs.batch]) {
        assert.equal(path.resolve(ref.file), path.resolve(opts.batch)); assert.equal(ref.sha256, opts.batchSha);
    }
    assert.deepEqual(sealedInputs.grading_manifest, batch.grading_manifest);
    assert(Array.isArray(sealedInputs.source_inputs) && sealedInputs.source_inputs.length > 0);
    for (const ref of sealedInputs.source_inputs) {
        const full = path.resolve(ref.file), bytes = fs.readFileSync(full);
        assert.equal(hash(bytes), ref.sha256, `Sealed input changed: ${ref.file}`);
        const cached = snapshots.get(full); if (cached) assert.equal(hash(cached.bytes), ref.sha256);
        else snapshots.set(full, { bytes, identity: key(full) });
    }
    const manifest = read<{ bank: { file: string; sha256: string } }>(batch.grading_manifest.file);
    assert.equal(hash(snapshots.get(path.resolve(batch.grading_manifest.file))!.bytes), batch.grading_manifest.sha256);
    assert.equal(path.resolve(manifest.bank.file), path.resolve(CANDIDATE));
    assert.equal(manifest.bank.sha256, hash(snapshots.get(path.resolve(CANDIDATE))!.bytes));
    const context = createEfficientValidationContext();
    for (const id of cohorts.publish_ids) createEfficientReviewReceipt({ file: slash(path.relative(root, path.resolve(opts.batch))), sha256: opts.batchSha }, candidate.find(s => s.id === id)!, context);
    assertEfficientEvidenceUnchanged(context);
    const evidence = [opts.readiness, opts.batch, opts.sealInputs, `${E}/authorization.md`].join('; ');
    const steps = commands(cohorts, path.resolve(opts.batch), evidence, stage); assertOfflineSteps(steps);
    guard();
    const offlineReceiptPreflightMs = Date.now() - workflowStartedMs;
    if (!opts.execute) {
        console.log(JSON.stringify({ status: 'validated_dry_run_no_stage_writes', preparation_lock: preparationIdentity, cohorts, steps, offline_receipt_preflight_ms: offlineReceiptPreflightMs, canonical_writes: 0, db_calls: 0, api_calls: 0 }));
        return;
    }
    assert(process.env.CPA_QUESTION_V3_ENCRYPTION_KEY?.trim(), 'Encryption key is required in the process environment; its value is never printed');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    assertNewOutput(output); fs.mkdirSync(output); // Exclusive fresh directory; no automatic resume.
    const outputIdentity = key(output);
    const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    const runGuard = () => { guard(); assert.equal(key(output), outputIdentity); assertEfficientEvidenceUnchanged(context); };
    write('execution-plan.json', { status: 'local_staging_started_not_installed', preparation_lock: preparationIdentity, created_at: workflowStartedAt, offline_receipt_preflight_ms: offlineReceiptPreflightMs, cohorts, steps,
        inputs: [...snapshots].map(([file, value]) => ({ file: slash(path.relative(root, file)), sha256: hash(value.bytes) })),
        env_path_overrides: Object.fromEntries(Object.entries(pathEnvironment(stage)).filter(([name]) => /^CPA_QUESTION_V3_(AUTHORING|PROMOTIONS|PUBLIC|ENCRYPTED)_PATH$/.test(name))) });
    const oldLedger = read<{ entries: unknown[] }>(ORIGINAL_LEDGER);
    const stages = new Map<string, Buffer>();
    const resultFiles: string[] = [];
    try {
        for (const step of steps) {
            runGuard();
            for (const [file, bytes] of stages) assert.equal(hash(fs.readFileSync(file)), hash(bytes), `Staging changed outside this workflow: ${file}`);
            const before = fs.existsSync(path.join(stage, 'authoring.json')) ? readBank(path.join(stage, 'authoring.json')) : null;
            const log = path.join(output, `${step.id}.log`), fd = fs.openSync(log, 'wx');
            const stepStartedAt = new Date().toISOString(), stepStartedMs = Date.now();
            let result: ReturnType<typeof spawnSync>;
            try { result = spawnSync(process.execPath, ['--import', 'tsx', ...step.args], { cwd: root, env: pathEnvironment(stage), shell: false, windowsHide: true, stdio: ['ignore', fd, fd] }); }
            finally { fs.closeSync(fd); }
            write(`${step.id}.result.json`, { id: step.id, started_at: stepStartedAt, completed_at: new Date().toISOString(), elapsed_ms: Date.now() - stepStartedMs, exit_code: result.status, signal: result.signal,
                spawn_error_code: (result.error as NodeJS.ErrnoException | undefined)?.code ?? null, log: slash(path.relative(root, log)), log_sha256: hash(fs.readFileSync(log)) });
            resultFiles.push(`${step.id}.result.json`);
            assertStepResult(result.status, result.signal, result.error);
            runGuard();
            if (step.id === '01-prepare') {
                const actual = JSON.parse(fs.readFileSync(path.join(stage, 'cohorts.json'), 'utf8'));
                for (const [name, ids] of Object.entries(cohorts)) assert.deepEqual(actual[name], ids);
                assert.equal(hash(fs.readFileSync(path.join(stage, 'before-canonical.json'))), hash(snapshots.get(path.resolve(ORIGINAL))!.bytes));
                assert.equal(hash(fs.readFileSync(path.join(stage, 'before-promotions.json'))), hash(snapshots.get(path.resolve(ORIGINAL_LEDGER))!.bytes));
            }
            const after = readBank(path.join(stage, 'authoring.json'));
            assertLifecycleOnly(candidate, after);
            if (before) assertLifecycleOnly(before, after);
            const ledger = JSON.parse(fs.readFileSync(path.join(stage, 'promotions.json'), 'utf8'));
            assert.deepEqual(ledger.entries.slice(0, oldLedger.entries.length), oldLedger.entries, 'Historical ledger prefix modified');
            const expectedExtra = step.id === '01-prepare' ? 0 : step.id === '02-reverify-existing' ? 70 : step.id === '03-verify-new' ? 120 : 240;
            assert.equal(ledger.entries.length, oldLedger.entries.length + expectedExtra, 'Unexpected ledger transition count');
            for (const file of ['authoring.json', 'promotions.json', 'before-canonical.json', 'before-promotions.json', 'cohorts.json', 'public.json', 'authoring.enc.json', 'published-classification-review.json', 'learning-question-classifications.json']) {
                const full = path.join(stage, file); if (exists(full)) stages.set(full, fs.readFileSync(full));
            }
        }
        const final = readBank(path.join(stage, 'authoring.json'));
        assert.deepEqual(validateAuthoringBank(final).errors, []);
        assert.deepEqual(validatePromotionLedger(final, loadPromotionLedger(path.join(stage, 'promotions.json')), true), []);
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage, 'public.json'), 'utf8')), final.map(compilePublicQuestionSet));
        const ready = JSON.parse(fs.readFileSync(path.join(stage, 'db-readiness.json'), 'utf8'));
        assert.equal(ready.ready, true); assert.deepEqual(ready.errors, []);
        assert.equal(ready.source_file_hash, hash(fs.readFileSync(path.join(stage, 'authoring.json'))));
        runGuard();
        write('completion.json', { status: 'isolated_published_stage_validated_not_installed_not_db_applied', completed_at: new Date().toISOString(), elapsed_ms: Date.now() - workflowStartedMs,
            preparation_lock: preparationIdentity, cohorts, set_count: final.length, question_count: final.reduce((n, s) => n + s.subquestions.length, 0),
            files: [...stages].map(([file, bytes]) => ({ file: slash(path.relative(root, file)), sha256: hash(bytes) })), result_files: resultFiles,
            canonical_writes: 0, db_calls: 0, api_calls: 0, historical_ledger_prefix_preserved: true,
            next_step: 'Root independent review. Canonical installation and DB apply are separate, unexecuted actions.' });
        console.log(JSON.stringify({ status: 'isolated_stage_complete', output: slash(path.relative(root, output)), canonical_writes: 0, db_calls: 0, api_calls: 0 }));
    } catch (error) {
        write('failure.json', { status: 'stopped_partial_stage_do_not_install', time: new Date().toISOString(), completed_step_results: resultFiles,
            reason: error instanceof Error ? error.message : String(error), automatic_retry: false });
        throw error;
    }
}
function readBank(file: string) { return JSON.parse(fs.readFileSync(file, 'utf8')) as QuestionSetV3[]; }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
}
