import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E, hash, realIdentity, assertInputRefs, assertLifecycleOnly, deriveCohorts, assertStepResult } from './stage-publication-v1.ts';
import { withPublicationLock, writePublicationFiles, validateAuthoringBank, validatePromotionLedger, loadPromotionLedger } from '../../../../../questionBankPublication.ts';
import { createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../../../../../questionEfficientReview.ts';
import { compilePublicQuestionSet } from '../../../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../../../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../../../../../../lib/questionV3Encryption.ts';
import { compileLearningCatalog } from '../../../../../../scripts/build-learning-unit-catalog.ts';

type Ref = { file: string; sha256: string | null; real_path: string };
type FileIdentity = { file: string; sha256: string };
interface Completion { status: string; files: FileIdentity[]; result_files: string[]; cohorts: { reverify_existing_ids: string[]; verify_new_ids: string[]; publish_ids: string[] }; set_count: number; question_count: number; canonical_writes: number; db_calls: number; api_calls: number; historical_ledger_prefix_preserved: boolean }
type Bank = QuestionSetV3[];
const C = `${E}/c`;
const SELF_LOCK = `${C}/canonical-installer-v1/implementation-lock.json`;
const CANDIDATE = `${E}/candidate-v1/candidate-authoring.json`, REVIEW = `${E}/candidate-v1/classification-review.json`;
export const canonicalFiles = {
    authoring: 'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
    ledger: 'cpa_uploader/data/cpa_question_sets_v3.promotions.json',
    public: 'cpa_uploader/data/cpa_question_sets_v3.public.json',
    encrypted: 'data/cpa_question_sets_v3.authoring.enc.json',
    catalog: 'cpa_uploader/data/learning-question-classifications.json',
};
function exists(file: string) { try { fs.lstatSync(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
function identity(file: string) { const value = realIdentity(file); return process.platform === 'win32' ? value.toLowerCase() : value; }
const relative = (file: string) => path.relative(process.cwd(), file).replaceAll('\\', '/');
export function assertFreshInstallOutput(output: string) {
    assert(identity(output).startsWith(identity(`${E}/canonical-install-v1`) + path.sep), 'Choose a fresh child of E/canonical-install-v1');
    assert(!exists(output), 'Install output already exists; preserve it and do not rerun');
}
export function parseInstallArgs(args: string[]) {
    const value: Record<string, string | boolean> = { execute: false }, seen = new Set<string>();
    const names: Record<string, string> = { '--stage-completion': 'completion', '--completion-sha256': 'completionSha', '--preparation-lock': 'preparation', '--preparation-sha256': 'preparationSha', '--output': 'output' };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; assert(!seen.has(arg), `Duplicate argument: ${arg}`); seen.add(arg);
        if (arg === '--execute' || arg === '--dry-run') value.execute = arg === '--execute';
        else { assert(names[arg], `Unsupported option: ${arg}`); const next = args[++i]; assert(next?.trim() && !next.startsWith('--'), `Missing ${arg}`); value[names[arg]] = next; }
    }
    assert(!(seen.has('--execute') && seen.has('--dry-run')), 'Choose execute or dry-run');
    for (const name of Object.values(names)) assert(typeof value[name] === 'string', `Missing ${name}`);
    assert(/^[a-f0-9]{64}$/.test(String(value.completionSha)), 'Explicit stage completion SHA required');
    assert(/^[a-f0-9]{64}$/.test(String(value.preparationSha)), 'Explicit reviewed preparation lock SHA required');
    return value as unknown as { completion: string; completionSha: string; preparation: string; preparationSha: string; output: string; execute: boolean };
}
export function canonicalEnvironment(inherited = process.env): NodeJS.ProcessEnv {
    const result: NodeJS.ProcessEnv = { ...inherited,
        CPA_QUESTION_V3_AUTHORING_PATH: path.resolve(canonicalFiles.authoring),
        CPA_QUESTION_V3_PROMOTIONS_PATH: path.resolve(canonicalFiles.ledger),
        CPA_QUESTION_V3_PUBLIC_PATH: path.resolve(canonicalFiles.public),
        CPA_QUESTION_V3_ENCRYPTED_PATH: path.resolve(canonicalFiles.encrypted) };
    for (const name of Object.keys(result)) if (/OPENAI|ANTHROPIC|SUPABASE|AZURE_OPENAI/i.test(name)) delete result[name];
    delete result.NODE_OPTIONS; return result;
}
export type OwnedFile = { file: string; original: Buffer; allowed_hashes: string[]; real_path: string };
/** Caller must hold the same authoring publication lock throughout install/rollback. */
export function rollbackOwnedFiles(files: OwnedFile[]) {
    const observed = files.map(file => ({ file: file.file, current_hash: exists(file.file) ? hash(fs.readFileSync(file.file)) : null,
        allowed: identity(file.file) === file.real_path && exists(file.file) && file.allowed_hashes.includes(hash(fs.readFileSync(file.file))) }));
    if (observed.some(row => !row.allowed)) return { status: 'refused_foreign_or_unknown_change', observed, restored: false };
    const guards = observed.map(row => ({ file: row.file, hash: row.current_hash }));
    // Do not silently transcode an original. All five production files are UTF-8 JSON.
    for (const file of files) assert(Buffer.from(file.original.toString('utf8'), 'utf8').equals(file.original), 'Original is not lossless UTF-8');
    writePublicationFiles(files.map(file => ({ file: file.file, content: file.original.toString('utf8') })), guards);
    for (const file of files) assert.equal(hash(fs.readFileSync(file.file)), hash(file.original), 'Synchronous rollback byte mismatch');
    return { status: 'rolled_back_to_exact_original_five', observed, restored: true };
}

/** Installs only this reviewed batch after independent root approval; default is read-only. */
export function main(args = process.argv.slice(2)) {
    const start = Date.now(), opts = parseInstallArgs(args), output = path.resolve(opts.output), completionFile = path.resolve(opts.completion);
    assertFreshInstallOutput(output);
    assert(identity(completionFile).startsWith(identity(`${C}/publication-stages`) + path.sep), 'Only this batch staging output is accepted');
    assert.equal(path.basename(completionFile), 'completion.json');
    const stage = path.join(path.dirname(completionFile), 'stage');
    const snapshots = new Map<string, { bytes: Buffer; real_path: string }>();
    const capture = (file: string) => {
        const full = path.resolve(file); let value = snapshots.get(full);
        if (!value) { value = { bytes: fs.readFileSync(full), real_path: identity(full) }; snapshots.set(full, value); }
        return value.bytes;
    };
    const read = <T>(file: string): T => JSON.parse(capture(file).toString('utf8'));
    assert(identity(opts.preparation).startsWith(identity(E) + path.sep), 'Preparation lock must be a reviewed artifact of this batch');
    const preparation = read<{ inputs: Ref[]; cohorts: Completion['cohorts']; allowed_unselected_note_changes: Parameters<typeof deriveCohorts>[3] }>(opts.preparation);
    assert.equal(hash(capture(opts.preparation)), opts.preparationSha, 'Selected preparation lock byte hash changed');
    for (const file of [...Object.values(canonicalFiles), CANDIDATE, REVIEW]) {
        assert(preparation.inputs.some(ref => path.resolve(ref.file) === path.resolve(file) && typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256)), `Required preparation identity missing: ${file}`);
    }
    const implementation = read<{ inputs: Ref[] }>(SELF_LOCK);
    assertInputRefs(preparation.inputs); assertInputRefs(implementation.inputs);
    const completion = read<Completion>(completionFile);
    assert.equal(hash(capture(completionFile)), opts.completionSha);
    assert.equal(completion.status, 'isolated_published_stage_validated_not_installed_not_db_applied');
    assert.equal(completion.canonical_writes, 0); assert.equal(completion.api_calls, 0); assert.equal(completion.db_calls, 0);
    assert.equal(completion.historical_ledger_prefix_preserved, true);
    assert(!exists(path.join(path.dirname(completionFile), 'failure.json')), 'Stage failure evidence is present');
    const stageNames = ['authoring.json', 'promotions.json', 'before-canonical.json', 'before-promotions.json', 'cohorts.json', 'public.json', 'authoring.enc.json', 'published-classification-review.json', 'learning-question-classifications.json'];
    assert.equal(new Set(completion.files.map(r => path.resolve(r.file))).size, stageNames.length);
    assert.deepEqual(completion.files.map(r => path.resolve(r.file)).sort(), stageNames.map(name => path.join(stage, name)).sort());
    for (const ref of completion.files) assert.equal(hash(capture(ref.file)), ref.sha256, `Stage file changed: ${ref.file}`);
    const resultNames = ['01-prepare', '02-reverify-existing', '03-verify-new', '04-publish-selected', '05-compile-public-encrypted', '06-rebind-catalog', '07-full-static-validation', '08-catalog-reproduction', '09-import-local-readiness'];
    assert.deepEqual(completion.result_files, resultNames.map(n => `${n}.result.json`));
    for (const name of resultNames) {
        const result = read<{ id: string; exit_code: number; signal: string | null; log: string; log_sha256: string }>(path.join(path.dirname(completionFile), `${name}.result.json`));
        assert.equal(result.id, name); assert.equal(result.exit_code, 0); assert.equal(result.signal, null);
        assert.equal(path.resolve(result.log), path.join(path.dirname(completionFile), `${name}.log`));
        assert.equal(hash(capture(result.log)), result.log_sha256);
    }
    const candidate = read<Bank>(CANDIDATE), before = read<Bank>(canonicalFiles.authoring), published = read<Bank>(path.join(stage, 'authoring.json'));
    const targetScope = read<{ targets: { set_id: string }[] }>(`${E}/candidate-v1/target-scope.json`);
    assert.deepEqual(preparation.cohorts.publish_ids, targetScope.targets.map(t => t.set_id), 'Preparation scope differs from reviewed target scope');
    assertLifecycleOnly(candidate, published);
    assert(published.every(s => s.status === 'published' && s.verification.review_status === 'verified'));
    const cohorts = deriveCohorts(before, candidate, preparation.cohorts.publish_ids, preparation.allowed_unselected_note_changes);
    assert.deepEqual(completion.cohorts, cohorts);
    assert.equal(completion.set_count, published.length); assert.equal(completion.question_count, published.flatMap(s => s.subquestions).length);
    assert.equal(hash(capture(path.join(stage, 'before-canonical.json'))), hash(capture(canonicalFiles.authoring)));
    assert.equal(hash(capture(path.join(stage, 'before-promotions.json'))), hash(capture(canonicalFiles.ledger)));
    const oldLedger = read<{ entries: { set_id: string; to_status: string }[] }>(canonicalFiles.ledger), ledger = loadPromotionLedger(path.join(stage, 'promotions.json'));
    assert.deepEqual(ledger.entries.slice(0, oldLedger.entries.length), oldLedger.entries);
    assert.deepEqual(ledger.entries.slice(oldLedger.entries.length).map(e => [e.set_id, e.to_status]), [
        ...cohorts.reverify_existing_ids.map(id => [id, 'verified']), ...cohorts.verify_new_ids.map(id => [id, 'verified']), ...cohorts.publish_ids.map(id => [id, 'published'])]);
    assert.deepEqual(validateAuthoringBank(published).errors, []);
    const context = createEfficientValidationContext();
    assert.deepEqual(validatePromotionLedger(published, ledger, true, { efficientContext: context }), []);
    assert.deepEqual(read(path.join(stage, 'public.json')), published.map(compilePublicQuestionSet));
    const ready = read<{ ready: boolean; errors: unknown[]; source_file_hash: string }>(path.join(stage, 'db-readiness.json'));
    assert.equal(ready.ready, true); assert.deepEqual(ready.errors, []); assert.equal(ready.source_file_hash, hash(capture(path.join(stage, 'authoring.json'))));
    assert(process.env.CPA_QUESTION_V3_ENCRYPTION_KEY?.trim(), 'Encryption key must be present in process environment; no key is printed');
    assert.equal(decryptAuthoringQuestionBankV3(capture(path.join(stage, 'authoring.enc.json')).toString('utf8'), process.env.CPA_QUESTION_V3_ENCRYPTION_KEY!), capture(path.join(stage, 'authoring.json')).toString('utf8'));
    const priorCatalog = read<{ review_file: string; review_file_sha256: string }>(canonicalFiles.catalog);
    assert(typeof priorCatalog.review_file === 'string' && priorCatalog.review_file.length > 0);
    assert.equal(hash(capture(priorCatalog.review_file)), priorCatalog.review_file_sha256, 'Historical classification review byte identity changed');
    const mutable = new Set(Object.values(canonicalFiles).map(f => path.resolve(f)));
    assert(!mutable.has(path.resolve(priorCatalog.review_file)), 'Historical review must remain a separate immutable file');
    const owned: OwnedFile[] = Object.values(canonicalFiles).map(file => ({ file: path.resolve(file), original: capture(file), allowed_hashes: [hash(capture(file))], real_path: identity(file) }));
    const expectedCurrent = new Map(owned.map(file => [file.file, hash(file.original)]));
    const immutableGuard = () => {
        assertInputRefs(preparation.inputs.filter(r => !mutable.has(path.resolve(r.file)))); assertInputRefs(implementation.inputs);
        for (const [file, value] of snapshots) if (!mutable.has(file)) {
            assert.equal(identity(file), value.real_path); assert.equal(hash(fs.readFileSync(file)), hash(value.bytes), `Immutable input changed: ${file}`);
        }
        assertEfficientEvidenceUnchanged(context);
    };
    const originalGuard = () => { assertInputRefs(preparation.inputs); immutableGuard(); };
    originalGuard();
    if (!opts.execute) {
        console.log(JSON.stringify({ status: 'installer_dry_run_validated_no_writes', cohorts, stage_completion_sha256: opts.completionSha, preflight_ms: Date.now() - start, canonical_writes: 0, api_calls: 0, db_calls: 0 })); return;
    }
    withPublicationLock(path.resolve(canonicalFiles.authoring), () => {
        originalGuard(); assertFreshInstallOutput(output);
        fs.mkdirSync(path.dirname(output), { recursive: true }); fs.mkdirSync(output);
        const outputIdentity = identity(output), backup = path.join(output, 'backup'); fs.mkdirSync(backup);
        const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
        const outputGuard = () => assert.equal(identity(output), outputIdentity, 'Install output identity changed');
        const backupRefs: FileIdentity[] = [];
        for (const [name, file] of Object.entries(canonicalFiles)) {
            const target = path.join(backup, `${name}.json`); fs.writeFileSync(target, capture(file), { flag: 'wx' });
            backupRefs.push({ file: relative(target), sha256: hash(capture(file)) });
        }
        const previousReviewBackup = path.join(backup, 'previous-classification-review.json');
        fs.writeFileSync(previousReviewBackup, capture(priorCatalog.review_file), { flag: 'wx' });
        backupRefs.push({ file: relative(previousReviewBackup), sha256: hash(capture(priorCatalog.review_file)) });
        write('before.json', { created_at: new Date().toISOString(), stage_completion: { file: relative(completionFile), sha256: opts.completionSha },
            preparation_lock: { file: relative(path.resolve(opts.preparation)), sha256: opts.preparationSha },
            prior_review: { file: priorCatalog.review_file, sha256: hash(capture(priorCatalog.review_file)) }, backups: backupRefs,
            originals: owned.map(f => ({ file: relative(f.file), sha256: hash(f.original) })), cohorts,
            status: 'backed_up_not_yet_installed', preflight_ms: Date.now() - start });
        const assertOwnedCurrent = () => {
            outputGuard(); immutableGuard();
            for (const file of owned) assert(identity(file.file) === file.real_path && expectedCurrent.get(file.file) === hash(fs.readFileSync(file.file)), `Foreign or unexpected canonical edit: ${file.file}`);
        };
        const run = (id: string, args: string[]) => {
            assertOwnedCurrent(); const begun = Date.now(), log = path.join(output, `${id}.log`), fd = fs.openSync(log, 'wx');
            let result: ReturnType<typeof spawnSync>;
            try { result = spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: process.cwd(), env: canonicalEnvironment(), shell: false, windowsHide: true, stdio: ['ignore', fd, fd] }); }
            finally { fs.closeSync(fd); }
            write(`${id}.result.json`, { id, elapsed_ms: Date.now() - begun, completed_at: new Date().toISOString(), exit_code: result.status, signal: result.signal,
                error_code: (result.error as NodeJS.ErrnoException | undefined)?.code ?? null, log: relative(log), log_sha256: hash(fs.readFileSync(log)) });
            assertStepResult(result.status, result.signal, result.error); assertOwnedCurrent();
        };
        const install = (writes: { file: string; bytes: Buffer }[]) => {
            assertOwnedCurrent();
            for (const write of writes) {
                assert(Buffer.from(write.bytes.toString('utf8'), 'utf8').equals(write.bytes));
                const target = owned.find(f => f.file === path.resolve(write.file)); assert(target); target.allowed_hashes.push(hash(write.bytes));
            }
            const guards = owned.map(f => ({ file: f.file, hash: hash(fs.readFileSync(f.file)) }));
            writePublicationFiles(writes.map(w => ({ file: w.file, content: w.bytes.toString('utf8') })), guards);
            for (const write of writes) {
                assert.equal(hash(fs.readFileSync(write.file)), hash(write.bytes));
                expectedCurrent.set(path.resolve(write.file), hash(write.bytes));
            }
        };
        try {
            // The publication lock stays held for the whole install/check/rollback sequence.
            originalGuard();
            install([
                { file: canonicalFiles.authoring, bytes: capture(path.join(stage, 'authoring.json')) },
                { file: canonicalFiles.ledger, bytes: capture(path.join(stage, 'promotions.json')) },
                { file: canonicalFiles.public, bytes: capture(path.join(stage, 'public.json')) },
                { file: canonicalFiles.encrypted, bytes: capture(path.join(stage, 'authoring.enc.json')) },
            ]);
            const newReview = path.join(output, 'classification-review.json'), newCatalog = path.join(output, 'learning-question-classifications.json');
            run('01-canonical-rebind', [`${C}/rebind-final-catalog.ts`, '--bank', canonicalFiles.authoring, '--review', REVIEW, '--output', newReview, '--catalog-output', newCatalog]);
            const catalogBytes = capture(newCatalog), catalog = JSON.parse(catalogBytes.toString('utf8'));
            const classification = read<{ entries: Parameters<typeof compileLearningCatalog>[1]; source_file: string; source_file_sha256: string }>(newReview);
            assert.equal(path.resolve(classification.source_file), path.resolve(canonicalFiles.authoring));
            assert.equal(classification.source_file_sha256, hash(capture(path.join(stage, 'authoring.json'))));
            assert.deepEqual(classification.entries, read<{ entries: unknown[] }>(REVIEW).entries);
            assert.equal(path.resolve(catalog.source_file), path.resolve(canonicalFiles.authoring));
            assert.equal(catalog.review_file_sha256, hash(capture(newReview)));
            assert.equal(path.resolve(catalog.review_file), newReview);
            const compiled = compileLearningCatalog(published, classification.entries, catalog.topics);
            assert.deepEqual(catalog.classifications, compiled.classifications);
            // Official builder generated these exact bytes through rebind. Install via the same guarded writer.
            install([{ file: canonicalFiles.catalog, bytes: catalogBytes }]);
            run('02-official-catalog-check', ['scripts/build-learning-unit-catalog.ts', '--review', newReview, '--output', canonicalFiles.catalog, '--check']);
            run('03-default-catalog-check', ['scripts/build-learning-unit-catalog.ts', '--check']);
            run('04-full-canonical-validator', ['cpa_uploader/validate_cpa_v3.ts']);
            for (const [canonical, source] of [[canonicalFiles.authoring, 'authoring.json'], [canonicalFiles.ledger, 'promotions.json'], [canonicalFiles.public, 'public.json'], [canonicalFiles.encrypted, 'authoring.enc.json']]) assert.equal(hash(fs.readFileSync(canonical)), hash(capture(path.join(stage, source))));
            assert.equal(hash(fs.readFileSync(canonicalFiles.catalog)), hash(catalogBytes));
            assertOwnedCurrent();
            write('completion.json', { status: 'canonical_installed_and_locally_validated_db_not_applied', completed_at: new Date().toISOString(), elapsed_ms: Date.now() - start,
                stage_completion: { file: relative(completionFile), sha256: opts.completionSha }, cohorts,
                preparation_lock: { file: relative(path.resolve(opts.preparation)), sha256: opts.preparationSha },
                files: Object.values(canonicalFiles).map(file => ({ file, sha256: hash(fs.readFileSync(file)) })),
                classification_review: { file: relative(newReview), sha256: hash(capture(newReview)) }, backups: backupRefs,
                counts: { sets: published.length, questions: published.flatMap(s => s.subquestions).length, learning_units: compiled.units.length },
                api_calls: 0, db_calls: 0, prior_review_unchanged: true, human_review_asserted: false });
        } catch (error) {
            let rollback: unknown;
            try { outputGuard(); rollback = rollbackOwnedFiles(owned); }
            catch (rollbackError) { rollback = { status: 'rollback_failed', message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError) }; }
            try { write('failure.json', { status: 'installation_failed_do_not_db_apply', time: new Date().toISOString(),
                reason: error instanceof Error ? error.message : String(error), rollback, automatic_retry: false, api_calls: 0, db_calls: 0 }); }
            catch { console.error('Failure report could not be written. Preserve all files and inspect backups before any further action.'); }
            throw error;
        }
    });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
