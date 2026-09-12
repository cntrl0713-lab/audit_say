/** pilot-01-002 only: preserve its actual v7 semantic receipt and grade its
 * original cases with the approved v6 grader. No API without --execute.
 * node --env-file=.env.local --import tsx <this> --manifest <new manifest>
 *   --manifest-sha256 <pinned hash> --output <unused directory> --stop-file <STOP>
 *   --dry-run | --execute
 * This is a provenance/guard wrapper; the production review CLI performs grading.
 * An in-memory receipt reconstruction below is validation, never a new receipt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import assert from 'node:assert/strict';
import { sha256, jsonHash } from '../../../../questionReviewIdentity.ts';
import { prepareSemanticReview, reviewChunkSchema, buildReviewChunkInput, groundReviewChunk,
    completeSemanticReview, semanticReceiptIntegrityErrors, readSemanticReviewDocument,
    validateSemanticReviewReceipt } from '../../../../questionSemanticReview.ts';
import type { PreparedSemanticReview, SemanticReviewReceipt, SemanticReviewResult } from '../../../../questionSemanticReview.ts';
import type { ReviewGradingEvent } from '../../../../questionReviewGrading.ts';
import type { QuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';

export const SELF = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(SELF), '../../../../..');
export const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
export const SET_ID = 'pilot-01-002';
export const GRADER = 'lib/questionV3Grading.ts';
export const BEFORE = '6a3033f9a5a6e408ebb8251787a5daeef3b478e287b5ae5c0aecc94d967a2dd7';
export const AFTER = '0f685328ffa59248ed56e9ff77fafb84e1f5913a3b6e5d1c6c6a208f1f49e124';
const MODEL = 'gpt-5.6-luna';
const ORIGIN = `${D}/execution-resumes/resume-2026-09-12-v2/canary`;
const SEMANTIC = `${ORIGIN}/semantic-a`;
const RECEIPT = `${SEMANTIC}/${SET_ID}/semantic.json`;
const CLI = 'cpa_uploader/review_question_draft_v3.ts';
const PINNED = [
    [`${ORIGIN}/manifest.json`, '9fab5fb3effbb1fa1838de75ea5c5118c2fbda3df41278a51fc1bd5d055cb62d'],
    [`${SEMANTIC}/run.json`, '201739c9cf3ca57c79de22f47df84e760ad4285c2d846bc327e3fa10ee3e32b5'],
    [`${SEMANTIC}/summary.json`, '0a0b219f7a2ebda59150df57e46f9ac27157fd8c8fe164d731eaa46a78981c17'],
    [`${SEMANTIC}/${SET_ID}/summary.json`, '569e4a2466096d31642b81b7dfe0fbe8362380357c2d941d8243326e507b0c86'],
    [`${SEMANTIC}/${SET_ID}/request.json`, '9e624a14ff8bceb9971623b41c4e74c395e2abbb4c7045847b992f840fc74f43'],
    [RECEIPT, 'b5b3711a99d95181512560887531b99f1b5aa618b32bf40d2ac61fdb0590e948'],
    [`${RECEIPT}.chunks.jsonl`, '03aa46aea1e7e31c17a46e42069a6635502fa55e2e1d64ab4e6c99e4f4067cae'],
    [`${D}/grading-inference-followup-v1/before.json`, '20f42261fc8fa80100fd78e9678b9382752f0d05cd6dfb70fe75f0dc541a2179'],
    [`${D}/execution-runtime-v6.json`, '5965bfc11dd440298431c418585b335828a23b10ed56fdca6832e8728ed70ba7'],
] as const;
export interface FileIdentity { file: string; sha256: string }
interface Job extends FileIdentity { set_id: string; worker: string; plan_file: string; plan_sha256: string;
    qa_file?: string; qa_sha256?: string; source_files: FileIdentity[] }
export interface Manifest { bank_file: string; bank_sha256: string; model: string; review_model: string;
    max_input_chars: number; code_files: FileIdentity[]; jobs: Job[] }
interface RawChunk { set_id: string; content_hash: string; bank_hash: string; source_files: FileIdentity[];
    unit_id: string; attempt: number; model: string; transport: string; performed_at: string;
    input_hash: string; schema_hash: string; response: unknown; error?: unknown }
export const resolve = (file: string) => path.resolve(ROOT, file);
export const fileHash = (file: string) => sha256(fs.readFileSync(resolve(file)));
export const read = <T = Record<string, unknown>>(file: string): T => JSON.parse(fs.readFileSync(resolve(file), 'utf8').replace(/^\uFEFF/, '')) as T;
const rel = (file: string) => path.relative(ROOT, file).replaceAll('\\', '/');
const samePath = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase();
const required: (ok: unknown, message: string) => asserts ok = (ok, message) => { if (!ok) throw Error(message); };
const equal = (a: unknown, b: unknown, label: string) => required(jsonHash(a) === jsonHash(b), label);
const validHash = (value: string) => /^[a-f0-9]{64}$/.test(value);
const within = (file: string, parent: string) => { const p = path.relative(resolve(parent), resolve(file)); return !!p && !p.startsWith(`..${path.sep}`) && p !== '..' && !path.isAbsolute(p); };
const identities = (rows: FileIdentity[]) => rows.map(r => ({ file: resolve(r.file).toLowerCase(), sha256: r.sha256 })).sort((a, b) => a.file.localeCompare(b.file));
const rows = (m: Manifest, j: Job): FileIdentity[] => [{ file: m.bank_file, sha256: m.bank_sha256 }, ...m.code_files,
    { file: j.file, sha256: j.sha256 }, { file: j.plan_file, sha256: j.plan_sha256 },
    ...(j.qa_file ? [{ file: j.qa_file, sha256: j.qa_sha256! }] : []), ...j.source_files];
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const jsonl = <T>(file: string): T[] => fs.readFileSync(resolve(file), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as T);

/** The only exception is this explicit before/after pair, not a generic legacy mode. */
export function validateTransition(origin: Manifest, current: Manifest) {
    for (const m of [origin, current]) {
        required(m.model === MODEL && m.review_model === MODEL && m.max_input_chars === 500000, 'Model/budget changed');
        required(Array.isArray(m.code_files) && new Set(identities(m.code_files).map(r => r.file)).size === m.code_files.length, 'Duplicate/missing code identities');
        required(m.code_files.every(r => validHash(r.sha256)), 'Invalid code hash');
    }
    const oldJob = origin.jobs.filter(j => j.set_id === SET_ID), newJob = current.jobs.filter(j => j.set_id === SET_ID);
    required(oldJob.length === 1 && newJob.length === 1 && oldJob[0].worker === 'a' && newJob[0].worker === 'a', 'Only original A pilot-01-002 and new owner a are permitted');
    const a = oldJob[0], b = newJob[0];
    required(samePath(origin.bank_file, current.bank_file) && origin.bank_sha256 === current.bank_sha256, 'Bank changed');
    required(a.sha256 === b.sha256 && a.plan_sha256 === b.plan_sha256 && !!a.plan_file && !!b.plan_file, 'Question/plan changed');
    equal(identities(a.source_files), identities(b.source_files), 'Source identities changed');
    for (const old of origin.code_files) {
        const next = current.code_files.find(r => samePath(r.file, old.file));
        required(next, `Original frozen file missing from new manifest: ${old.file}`);
        required(samePath(old.file, GRADER) ? old.sha256 === BEFORE && next.sha256 === AFTER : next.sha256 === old.sha256,
            `Unapproved code/evidence change: ${old.file}`);
    }
    required(origin.code_files.some(r => samePath(r.file, GRADER)), 'Original grader identity missing');
    return { oldJob: a, job: b };
}

/** Compare actual transmitted chunk hashes and re-ground responses without calls. */
export function verifyChunks(prepared: PreparedSemanticReview, receipt: SemanticReviewReceipt, chunks: RawChunk[]) {
    required(chunks.length === 11 && prepared.units.length === 11, 'The preserved A run must contain exactly 11 successful chunks');
    const results: SemanticReviewResult[] = [];
    const matches: { unit_id: string; input_sha256: string; schema_sha256: string }[] = [];
    for (const unit of prepared.units) {
        const matching = chunks.filter(c => c.unit_id === unit.id);
        required(matching.length === 1, `Missing/duplicate actual chunk: ${unit.id}`);
        const raw = matching[0];
        required(!raw.error && raw.attempt === 1 && raw.transport === 'model' && raw.model === MODEL && Number.isFinite(Date.parse(raw.performed_at)), `Invalid actual transport/attempt: ${unit.id}`);
        required(raw.set_id === SET_ID && raw.content_hash === prepared.contentHash && raw.bank_hash === prepared.bankHash, `Raw question/bank mismatch: ${unit.id}`);
        equal(raw.source_files, prepared.sourceFiles, `Raw source mismatch: ${unit.id}`);
        const input = sha256(buildReviewChunkInput(prepared, unit)), schema = jsonHash(reviewChunkSchema(unit));
        required(raw.input_hash === input && raw.schema_hash === schema, `Actual input/schema mismatch: ${unit.id}`);
        results.push(groundReviewChunk(raw.response, prepared, unit));
        matches.push({ unit_id: unit.id, input_sha256: input, schema_sha256: schema });
    }
    const result = { units: results.flatMap(r => r.units), cases: results.flatMap(r => r.cases), notes: results.flatMap(r => r.notes) };
    equal(result, { units: receipt.units, cases: receipt.cases, notes: receipt.notes }, 'Actual grounded raw differs from original receipt');
    required(semanticReceiptIntegrityErrors(receipt, false).length === 0, 'Original semantic integrity failed');
    const reconstructed = completeSemanticReview(prepared, result, receipt.execution);
    equal(reconstructed, receipt, 'Current formal semantic validation differs from original receipt');
    return matches;
}

export interface Options { manifest: string; manifestSha256: string; output: string; stopFile: string }
export function prepare(options: Options) {
    const frozen = new Map<string, string>();
    const freeze = (file: string, expected = fileHash(file)) => {
        required(validHash(expected) && fileHash(file) === expected, `Frozen file mismatch: ${file}`);
        const absolute = resolve(file), prior = frozen.get(absolute);
        required(!prior || prior === expected, `Conflicting frozen identity: ${file}`); frozen.set(absolute, expected);
    };
    PINNED.forEach(([file, h]) => freeze(file, h));
    freeze(options.manifest, options.manifestSha256); freeze(SELF);
    const origin = read<Manifest>(`${ORIGIN}/manifest.json`), current = read<Manifest>(options.manifest);
    const { oldJob, job } = validateTransition(origin, current);
    const runtime = read<{ code_files: FileIdentity[]; review_model: string; grading_model: string }>(`${D}/execution-runtime-v6.json`);
    required(runtime.review_model === MODEL && runtime.grading_model === MODEL, 'Runtime v6 models differ');
    for (const r of runtime.code_files) required(current.code_files.some(c => samePath(c.file, r.file) && c.sha256 === r.sha256), `Runtime v6 code absent/different: ${r.file}`);
    const before = read<{ api_processes_stopped: boolean; source_question_changes: boolean; files: { file: string; before_sha256: string; snapshot_file: string; snapshot_sha256: string }[] }>(`${D}/grading-inference-followup-v1/before.json`);
    const saved = before.files.filter(r => samePath(r.file, GRADER));
    required(before.api_processes_stopped && before.source_question_changes === false && saved.length === 1 && saved[0].before_sha256 === BEFORE && saved[0].snapshot_sha256 === BEFORE, 'Approved before snapshot declaration differs');
    freeze(saved[0].snapshot_file, BEFORE);
    for (const r of rows(origin, oldJob)) if (!samePath(r.file, GRADER)) freeze(r.file, r.sha256);
    for (const r of rows(current, job)) freeze(r.file, r.sha256);
    const run = read(`${SEMANTIC}/run.json`), summary = read(`${SEMANTIC}/${SET_ID}/summary.json`);
    const overall = read(`${SEMANTIC}/summary.json`), request = read(`${SEMANTIC}/${SET_ID}/request.json`);
    required(run.worker === 'a' && run.phase === 'semantic' && run.mock === false && run.transport === 'production_cli_subprocess'
        && run.manifest_sha256 === PINNED[0][1] && run.model === MODEL && run.review_model === MODEL && run.max_input_chars === 500000, 'Original run identity invalid');
    equal(run.set_ids, [SET_ID], 'Original run ownership differs');
    required(samePath(String(run.manifest_file), `${ORIGIN}/manifest.json`) && samePath(String(run.output), SEMANTIC), 'Original run paths differ');
    required(origin.code_files.some(r => samePath(r.file, String(run.worker_file)) && r.sha256 === run.worker_sha256), 'Original worker identity absent');
    required(overall.interrupted === false && overall.stopped_on_execution_error === false && overall.recorded_sets === 1 && overall.planned_sets === 1, 'Original run not completed');
    equal(overall.results, [summary], 'Original overall/set summaries differ');
    required(summary.set_id === SET_ID && summary.phase === 'semantic' && summary.outcome === 'pass' && summary.child_exit_code === 0
        && !summary.child_signal && !summary.guard_or_observer_error && !summary.error && summary.input_sha256 === oldJob.sha256 && Number.isFinite(Date.parse(String(summary.finished_at))), 'Original set execution invalid');
    required(summary.receipt_sha256 === fileHash(RECEIPT) && samePath(String(summary.receipt_file), RECEIPT), 'Original receipt summary differs');
    required(request.set_id === SET_ID && request.manifest_sha256 === PINNED[0][1] && request.credential_logged === false && samePath(String(request.executable), process.execPath), 'Original request identity invalid');
    equal(identities(request.frozen_files as FileIdentity[]), identities(rows(origin, oldJob)), 'Original request frozen inputs differ');
    equal(request.argv, ['--import', 'tsx', CLI, '--file', resolve(oldJob.file), '--bank', resolve(origin.bank_file), '--plan', resolve(oldJob.plan_file), '--output', resolve(RECEIPT)], 'Original CLI command differs');
    for (const [file] of PINNED.filter(([file]) => file.startsWith(SEMANTIC))) required(within(fs.realpathSync(resolve(file)), fs.realpathSync(resolve(SEMANTIC))), 'Original artifact symlink escapes semantic run');
    for (const file of [job.file, oldJob.file]) required(!fs.existsSync(resolve(`${file}.source-packet.json`)) && !fs.existsSync(resolve(`${file}.authoring-plan.json`)), 'Implicit sidecars are outside this explicit contract');
    const rawSet = read<QuestionSetV3 | QuestionSetV3[] | { sets: QuestionSetV3[] }>(job.file);
    const sets = Array.isArray(rawSet) ? rawSet : 'sets' in rawSet ? rawSet.sets : [rawSet];
    required(sets.length === 1 && sets[0].id === SET_ID, 'Question file must contain only pilot-01-002');
    const set = sets[0], plan = read<QuestionAuthoringPlan>(job.plan_file);
    const bankValue = read<QuestionSetV3[] | { sets: QuestionSetV3[] }>(current.bank_file), bank = Array.isArray(bankValue) ? bankValue : bankValue.sets;
    required(bank.filter(s => s.id === SET_ID).length === 1, 'Bank set identity missing/duplicate');
    equal(bank.find(s => s.id === SET_ID), set, 'Explicit question differs from bank');
    const peerBank = [...bank.filter(s => s.id !== SET_ID), set];
    const semanticOptions = { root: ROOT, bank: peerBank, authoringPlan: plan, packet: null, maxInputChars: current.max_input_chars };
    const prepared = prepareSemanticReview(set, semanticOptions);
    const doc = readSemanticReviewDocument(resolve(RECEIPT));
    required(doc.reviews.length === 1, 'Original receipt document must contain only one set');
    const receipt = doc.reviews[0];
    required(receipt.execution.method === 'model_reasoned' && receipt.execution.transport === 'model' && receipt.execution.model === MODEL
        && receipt.grading.status === 'not_run' && receipt.grading.transport === 'none' && receipt.verdict === 'pass', 'Original actual semantic pass required');
    const chunks = jsonl<RawChunk>(`${RECEIPT}.chunks.jsonl`);
    const matches = verifyChunks(prepared, receipt, chunks);
    const output = resolve(options.output), stop = resolve(options.stopFile);
    required(within(output, D) && !fs.existsSync(output), 'Output must be a new directory within the review batch');
    required(within(stop, `${D}/execution-resumes`) && path.basename(stop) === 'STOP' && !within(stop, output), 'STOP must be a separate batch execution STOP file');
    let ancestor = path.dirname(output);
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    required(samePath(fs.realpathSync(ancestor), ancestor), 'Output ancestor is a symlink');
    const resultFile = path.join(output, SET_ID, 'grading.json');
    const argv = ['--import', 'tsx', CLI, '--file', resolve(job.file), '--bank', resolve(current.bank_file), '--plan', resolve(job.plan_file), '--review-input', resolve(RECEIPT), '--grade-cases', '--output', resultFile];
    const env = () => {
        required(process.env.CPA_GRADING_MODEL === MODEL && process.env.CPA_REVIEW_MODEL === MODEL && process.env.CPA_REVIEW_INPUT_MAX_CHARS === '500000', 'Explicit runtime environment does not match lock');
    };
    const guard = () => { env(); for (const [file, h] of frozen) required(fileHash(file) === h, `Input/code changed: ${rel(file)}`); };
    const unique = new Set(receipt.cases.map(c => {
        const sub = set.subquestions.find(s => s.criteria.some(k => c.unit_id === `criterion:${s.id}:${k.id}`));
        required(sub, 'Unregistered generated criterion');
        return jsonHash(Object.fromEntries(set.subquestions.map(s => [s.id, s.id === sub.id ? c.answer : ''])));
    }));
    required(unique.size === 38, 'Original unique case count changed');
    guard();
    return { options, current, job, set, semanticOptions, receipt, prepared, matches, output, stop, argv, resultFile, guard,
        frozen: [...frozen].map(([file, h]) => ({ file: rel(file), sha256: h })),
        provenance: { original_manifest: PINNED[0], original_receipt: PINNED[5], original_chunks: PINNED[6],
            approved_grader_change: { file: GRADER, before: BEFORE, after: AFTER, snapshot_file: rel(resolve(saved[0].snapshot_file)) },
            original_semantic_units: matches.length, original_generated_cases: receipt.cases.length, unique_nonempty_runs: unique.size,
            empty_no_model_runs: 1, current_manifest: { file: options.manifest, sha256: options.manifestSha256 },
            validation: 'Exact actual input/schema hashes, grounded original raw, in-memory current completeSemanticReview validation; original receipt unchanged',
            chunks: matches } };
}

type Prepared = ReturnType<typeof prepare>;
export function validateCompletionExit(exitCode: number | null, errors: string[], mismatches: string[], signal: string | null = null) {
    required(!signal, 'CLI terminated by signal');
    const expectedErrors = mismatches.map(id => `${id}: 실제 채점 결과가 검토 사례의 기대 판정과 다릅니다.`).sort();
    equal([...errors].sort(), expectedErrors, 'Formal validation found errors beyond the exact recorded mismatch set');
    required(exitCode === (mismatches.length ? 1 : 0), 'CLI exit status disagrees with validated grading result');
}

export function validateOutput(p: Prepared, exitCode: number | null) {
    p.guard();
    required(!fs.existsSync(`${p.resultFile}.chunks.jsonl`), 'Unexpected new semantic chunk log: only grading was authorized');
    const doc = readSemanticReviewDocument(p.resultFile);
    required(doc.reviews.length === 1, 'Output receipt count differs');
    const result = doc.reviews[0];
    const { grading: ignoredOld, receipt_hash: ignoredHash, ...oldSemantic } = p.receipt;
    const { grading: execution, receipt_hash: nextHash, ...newSemantic } = result;
    void ignoredOld; void ignoredHash; void nextHash;
    equal(oldSemantic, newSemantic, 'Grading changed original semantic units/cases/context/execution');
    const integrity = semanticReceiptIntegrityErrors(result, true);
    required(integrity.length === 0, `Output integrity errors: ${integrity.join('; ')}`);
    required(execution.transport === 'model' && execution.model === MODEL && execution.status === 'completed', 'Actual grading did not complete');
    const events = jsonl<ReviewGradingEvent & { set_id: string; content_hash: string; bank_hash: string; source_files: FileIdentity[] }>(`${p.resultFile}.grading.jsonl`);
    required(events.length === 39 && execution.runs.length === 39, 'Expected 38 distinct original answers plus one empty branch');
    const seen = new Set<string>();
    for (const event of events) {
        required(!seen.has(event.id), 'Duplicate raw grading run'); seen.add(event.id);
        required(event.set_id === SET_ID && event.content_hash === result.content_hash && event.bank_hash === result.bank_hash && event.status === 'completed'
            && !event.error && event.transport === 'model' && event.model === MODEL && event.grader_hash === execution.grader_hash, 'Raw grading identity/status mismatch');
        equal(event.source_files, result.source_files, 'Raw grading sources changed');
        const run = execution.runs.find(r => r.id === event.id); required(run, 'Raw run absent from receipt');
        for (const key of ['answers', 'expected', 'judgment', 'result', 'matched'] as const) equal(event[key], run[key], `Raw/receipt ${key} differs`);
        required(event.id === 'empty-answer' ? event.judgment === null && event.trace.length === 0 : event.judgment !== null && event.trace.length > 0, 'Raw model evidence or empty branch differs');
    }
    const errors = validateSemanticReviewReceipt(result, p.set, p.semanticOptions);
    const mismatches = execution.runs.filter(r => !r.matched).map(r => r.id);
    validateCompletionExit(exitCode, errors, mismatches);
    return { outcome: mismatches.length ? 'grading_mismatch' : 'pass', original_semantic_preserved: true, mismatched_run_ids: mismatches,
        formal_validation_errors: errors, unique_model_runs: 38, empty_no_model_runs: 1, receipt_file: rel(p.resultFile), receipt_sha256: fileHash(p.resultFile), raw_sha256: fileHash(`${p.resultFile}.grading.jsonl`) };
}

function redactor(env: NodeJS.ProcessEnv) {
    const secrets = Object.entries(env).filter(([k, v]) => /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k) && v && v.length >= 8).map(([, v]) => v!).sort((a, b) => b.length - a.length);
    return (value: unknown) => { let text = String(value); for (const secret of secrets) text = text.replaceAll(secret, '[REDACTED]'); return text.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]'); };
}

export interface ControlState { shared_stop_observed: boolean; quota_exhausted: boolean }
/** Shared STOP is a boundary signal; it never discards the active CLI's work.
 * A quota error already makes the production grading CLI exit on that case.
 * Explicit operator interruption and frozen-input drift remain immediate aborts. */
export function controlEvent(state: ControlState, event: 'shared-stop' | 'quota' | 'operator' | 'drift', abort: (reason: string) => void, recordQuota: () => void) {
    if (event === 'shared-stop') state.shared_stop_observed = true;
    else if (event === 'quota') { state.quota_exhausted = true; state.shared_stop_observed = true; recordQuota(); }
    else abort(event === 'operator' ? 'Operator interrupted' : 'Frozen input/code drift');
}

async function execute(p: Prepared) {
    required(!fs.existsSync(p.stop), 'STOP present; no subprocess started'); p.guard();
    const started = new Date().toISOString(), safe = redactor(process.env), folder = path.dirname(p.resultFile);
    fs.mkdirSync(folder, { recursive: true });
    write(path.join(p.output, 'run.json'), { version: 1, phase: 'grading_preserved_semantic', started_at: started, set_id: SET_ID, mock: false,
        transport: 'production_cli_subprocess', credentials_logged: false, provenance: p.provenance, frozen_files: p.frozen, helper_sha256: fileHash(SELF) });
    write(path.join(folder, 'request.json'), { executable: process.execPath, argv: p.argv, model: MODEL, review_model: MODEL,
        max_input_chars: 500000, manifest_sha256: p.options.manifestSha256, frozen_files: p.frozen, credential_logged: false });
    const stdout = fs.openSync(path.join(folder, 'stdout.log'), 'wx'), stderr = fs.openSync(path.join(folder, 'stderr.log'), 'wx');
    let failure: string | null = null, stopped = false;
    const control: ControlState = { shared_stop_observed: false, quota_exhausted: false };
    p.guard(); required(!fs.existsSync(p.stop), 'STOP present immediately before subprocess start');
    const child = spawn(process.execPath, p.argv, { cwd: ROOT, env: { ...process.env }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const abort = (reason: string) => { failure ||= reason; if (!child.killed) child.kill('SIGTERM'); };
    const operatorStop = () => { stopped = true; controlEvent(control, 'operator', abort, () => {}); };
    process.on('SIGINT', operatorStop); process.on('SIGTERM', operatorStop);
    const stream = (fd: number) => {
        const decoder = new StringDecoder('utf8'); let pending = '';
        const emit = (text: string) => {
            const clean = safe(text); fs.writeSync(fd, clean);
            if (/credit_balance_exhausted|insufficient_quota/i.test(clean)) {
                controlEvent(control, 'quota', abort, () => {
                    if (!fs.existsSync(p.stop)) fs.writeFileSync(p.stop, `${JSON.stringify({ reason: 'quota_exhausted', set_id: SET_ID, observed_at: new Date().toISOString() })}\n`, { flag: 'wx' });
                });
            }
        };
        return { data(chunk: Buffer) { try { pending += decoder.write(chunk); const at = pending.lastIndexOf('\n'); if (at >= 0) { emit(pending.slice(0, at + 1)); pending = pending.slice(at + 1); } } catch (e) { abort(safe(e)); } },
            end() { try { pending += decoder.end(); if (pending) emit(pending); } catch (e) { abort(safe(e)); } } };
    };
    const out = stream(stdout), err = stream(stderr);
    child.stdout.on('data', out.data); child.stdout.on('end', out.end); child.stderr.on('data', err.data); child.stderr.on('end', err.end);
    const timer = setInterval(() => { try {
        if (fs.existsSync(p.stop)) controlEvent(control, 'shared-stop', abort, () => {});
        p.guard();
    } catch (e) { controlEvent(control, 'drift', () => abort(safe(e)), () => {}); } }, 1500);
    let state: { code: number | null; signal: NodeJS.Signals | null };
    try { state = await new Promise(resolveChild => { child.once('error', e => abort(safe(e))); child.once('close', (code, signal) => resolveChild({ code, signal })); }); }
    finally { clearInterval(timer); fs.closeSync(stdout); fs.closeSync(stderr); process.off('SIGINT', operatorStop); process.off('SIGTERM', operatorStop); }
    let validation: ReturnType<typeof validateOutput> | null = null;
    try { required(!failure && !state.signal && !control.quota_exhausted && !stopped, failure || (control.quota_exhausted ? 'Quota exhausted; CLI error exit preserved' : 'Subprocess interrupted')); validation = validateOutput(p, state.code); }
    catch (e) { failure ||= safe(e); }
    const summary = { started_at: started, finished_at: new Date().toISOString(), set_id: SET_ID, child_pid: child.pid ?? null,
        child_exit_code: state.code, child_signal: state.signal, ...control, operator_stopped: stopped, error: failure,
        outcome: failure ? 'execution_error' : validation!.outcome, validation, provenance: p.provenance,
        partial_raw_file: fs.existsSync(`${p.resultFile}.grading.jsonl`) ? rel(`${p.resultFile}.grading.jsonl`) : null };
    write(path.join(p.output, 'summary.json'), summary);
    console.log(JSON.stringify({ outcome: summary.outcome, summary_file: rel(path.join(p.output, 'summary.json')), error: failure }));
    process.exitCode = failure ? 1 : validation!.outcome === 'pass' ? 0 : 2;
}

export async function main(argv: string[]) {
    const args: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i++) {
        const key = argv[i]; required(!Object.hasOwn(args, key), `Duplicate option: ${key}`);
        if (['--dry-run', '--execute'].includes(key)) args[key] = true;
        else { required(['--manifest', '--manifest-sha256', '--output', '--stop-file'].includes(key), `Unknown option: ${key}`); const value = argv[++i]; required(value && !value.startsWith('--'), `Missing value: ${key}`); args[key] = value; }
    }
    required(Boolean(args['--dry-run']) !== Boolean(args['--execute']), 'Specify exactly one of --dry-run or --execute');
    for (const key of ['--manifest', '--manifest-sha256', '--output', '--stop-file']) required(typeof args[key] === 'string', `${key} required`);
    const p = prepare({ manifest: args['--manifest'] as string, manifestSha256: args['--manifest-sha256'] as string, output: args['--output'] as string, stopFile: args['--stop-file'] as string });
    if (args['--dry-run']) { assert(!fs.existsSync(p.output)); console.log(JSON.stringify({ api_calls: 0, writes: 0, frozen_files: p.frozen.length, provenance: p.provenance, command: p.argv })); return; }
    await execute(p);
}
if (process.argv[1] && samePath(process.argv[1], SELF)) main(process.argv.slice(2)).catch(error => { console.error(redactor(process.env)(error)); process.exitCode = 1; });
