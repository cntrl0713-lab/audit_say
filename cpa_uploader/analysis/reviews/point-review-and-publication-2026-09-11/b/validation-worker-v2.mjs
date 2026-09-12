/** Sequential production CLI orchestration; dry-run never starts a subprocess.
 * node --env-file=.env.local <this file> --manifest <manifest.json>
 *   --worker a|b|c --phase semantic|grading|author-qa --output <new directory>
 *   [--semantic-directory <same-worker semantic output>] [--stop-file <path>] [--dry-run]
 * Grading may instead bind each job.semantic_provenance to an earlier frozen run.
 * Explicit CPA_GRADING_MODEL and CPA_REVIEW_MODEL must equal the manifest.
 * Exit 0=all pass/dry-run; 2=content nonpass/mismatch/blocked; 1=execution error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import assert from 'node:assert/strict';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../../../../..');
const REVIEW_CLI = 'cpa_uploader/review_question_draft_v3.ts';
const AUTHOR_CLI = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts';
const DRAFT_ROOT = path.join(ROOT, 'cpa_uploader/drafts/delegated-authoring-2026-09-11');
const BATCH_ROOT = path.resolve(path.dirname(SELF), '..');
const HEX = /^[a-f0-9]{64}$/;
const now = () => new Date().toISOString();
const hash = value => createHash('sha256').update(value).digest('hex');
const fileHash = file => hash(fs.readFileSync(file));
const resolve = file => path.resolve(ROOT, file);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const relative = file => path.relative(ROOT, file).replaceAll('\\', '/');
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const within = (file, base) => {
    const rel = path.relative(base, file);
    return Boolean(rel) && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
};
const required = (ok, message) => { if (!ok) throw Error(message); };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const key = argv[i];
        required(!Object.hasOwn(args, key), `Duplicate option: ${key}`);
        if (['--dry-run', '--self-test', '--help'].includes(key)) args[key] = true;
        else {
            required(['--manifest', '--worker', '--phase', '--output', '--semantic-directory', '--stop-file'].includes(key), `Unknown option: ${key}`);
            const value = argv[++i];
            required(value && !value.startsWith('--'), `Missing value: ${key}`);
            args[key] = value;
        }
    }
    return args;
}

function validateManifest(value) {
    required(object(value) && nonempty(value.bank_file) && HEX.test(value.bank_sha256), 'Manifest bank identity is required');
    required(nonempty(value.model) && nonempty(value.review_model), 'Manifest grading/review models are required');
    required(Number.isSafeInteger(value.max_input_chars) && value.max_input_chars >= 1000 && value.max_input_chars <= 500000, 'Invalid max_input_chars');
    required(Array.isArray(value.code_files) && value.code_files.length > 0, 'Manifest code_files is required');
    const checkFiles = (rows, label) => {
        required(Array.isArray(rows), `${label} must be an array`);
        const seen = new Set();
        for (const row of rows) {
            required(object(row) && nonempty(row.file) && HEX.test(row.sha256), `${label}: file/sha256 required`);
            const key = resolve(row.file).toLowerCase();
            required(!seen.has(key), `${label}: duplicate path ${row.file}`);
            seen.add(key);
        }
    };
    checkFiles(value.code_files, 'code_files');
    required(Array.isArray(value.jobs) && value.jobs.length > 0, 'Manifest jobs is required');
    const ids = new Set();
    for (const job of value.jobs) {
        required(object(job) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(job.set_id), 'Unsafe or missing set_id');
        required(!ids.has(job.set_id), `Duplicate set_id: ${job.set_id}`); ids.add(job.set_id);
        required(['a', 'b', 'c'].includes(job.worker), `${job.set_id}: invalid worker`);
        required(nonempty(job.file) && HEX.test(job.sha256), `${job.set_id}: file/sha256 required`);
        for (const kind of ['plan', 'qa']) {
            const f = job[`${kind}_file`], h = job[`${kind}_sha256`];
            required((f == null && h == null) || nonempty(f) && HEX.test(h), `${job.set_id}: ${kind} path/hash pair required`);
        }
        checkFiles(job.source_files, `${job.set_id}/source_files`);
        if (job.semantic_provenance !== undefined) {
            const p = job.semantic_provenance;
            required(object(p) && ['a', 'b', 'c'].includes(p.worker), `${job.set_id}: invalid semantic provenance worker`);
            for (const key of ['manifest_file', 'run_directory', 'receipt_file']) required(nonempty(p[key]), `${job.set_id}: missing semantic provenance ${key}`);
            for (const key of ['manifest_sha256', 'receipt_sha256']) required(HEX.test(p[key]), `${job.set_id}: missing semantic provenance ${key}`);
            for (const key of ['run_sha256', 'summary_sha256', 'request_sha256']) if (p[key] !== undefined) required(HEX.test(p[key]), `${job.set_id}: invalid optional provenance ${key}`);
        }
    }
    return value;
}

function environment(manifest, env) {
    required(env.CPA_GRADING_MODEL === manifest.model, 'CPA_GRADING_MODEL must explicitly match manifest.model');
    required(env.CPA_REVIEW_MODEL === manifest.review_model, 'CPA_REVIEW_MODEL must explicitly match manifest.review_model');
    if (env.CPA_REVIEW_INPUT_MAX_CHARS !== undefined) {
        required(Number(env.CPA_REVIEW_INPUT_MAX_CHARS) === manifest.max_input_chars, 'CPA_REVIEW_INPUT_MAX_CHARS differs from manifest');
    }
    return { ...env, CPA_REVIEW_INPUT_MAX_CHARS: String(manifest.max_input_chars) };
}

function identityRows(manifest, job) {
    return [{ file: manifest.bank_file, sha256: manifest.bank_sha256 }, ...manifest.code_files,
        { file: job.file, sha256: job.sha256 },
        ...['plan', 'qa'].flatMap(kind => job[`${kind}_file`] ? [{ file: job[`${kind}_file`], sha256: job[`${kind}_sha256`] }] : []),
        ...job.source_files];
}

function guard(manifest, job, manifestFile, manifestHash, selfHash, env) {
    required(fileHash(manifestFile) === manifestHash, 'Manifest changed during execution');
    required(fileHash(SELF) === selfHash, 'Worker code changed during execution');
    environment(manifest, env);
    for (const row of identityRows(manifest, job)) {
        required(fileHash(resolve(row.file)) === row.sha256, `Frozen file changed: ${row.file}`);
    }
}

function loadJob(job, phase) {
    const value = read(resolve(job.file));
    const sets = Array.isArray(value) ? value : value?.sets || [value];
    required(sets.length === 1 && sets[0]?.id === job.set_id, `${job.set_id}: input must contain exactly the assigned set`);
    if (phase === 'author-qa') required(!value?.sets, 'Author QA CLI requires a single object or single-element array');
    const set = sets[0];
    required(Array.isArray(set.source_refs), `${job.set_id}: source_refs missing`);
    for (const ref of set.source_refs) {
        required(job.source_files.some(row => samePath(resolve(row.file), resolve(ref.file))), `${job.set_id}: source file is not frozen: ${ref.file}`);
    }
    const autoPlan = `${resolve(job.file)}.authoring-plan.json`;
    required(job.plan_file || !fs.existsSync(autoPlan), `${job.set_id}: implicit plan must be explicitly frozen`);
    required(!fs.existsSync(`${resolve(job.file)}.source-packet.json`), `${job.set_id}: implicit packet is outside this manifest contract; freeze it explicitly in a follow-up runner contract`);
    if (phase === 'author-qa') {
        required(job.qa_file, `${job.set_id}: author-qa requires qa_file`);
        const qa = read(resolve(job.qa_file));
        required(qa.version === 1 && qa.artifact_type === 'author_expected_judgments' && qa.set_id === job.set_id && Array.isArray(qa.cases) && qa.cases.length > 0, `${job.set_id}: incompatible author QA shape`);
        const seen = new Set();
        for (const test of qa.cases) {
            required(nonempty(test.id) && !seen.has(test.id), `${job.set_id}: duplicate/missing QA id`); seen.add(test.id);
            const sub = set.subquestions.find(q => q.id === test.subquestion_id);
            required(sub && typeof test.answer === 'string' && Number.isInteger(test.expected_points) && Array.isArray(test.expected_verdicts), `${job.set_id}/${test.id}: incompatible QA`);
            const verdictIds = new Set(test.expected_verdicts.map(v => v.criterion_id));
            required(verdictIds.size === sub.criteria.length && test.expected_verdicts.length === sub.criteria.length, `${test.id}: incomplete/duplicate QA expectations`);
            let points = 0;
            for (const verdict of test.expected_verdicts) {
                const c = sub.criteria.find(c => c.id === verdict.criterion_id);
                required(c && ['met', 'partial', 'not_met', 'contradicted'].includes(verdict.verdict), `${test.id}: unknown criterion/verdict`);
                required(verdict.verdict !== 'partial' || Number.isInteger(c.scores.partial), `${test.id}: partial score not allowed`);
                points += verdict.verdict === 'met' ? c.scores.met : verdict.verdict === 'partial' ? c.scores.partial : 0;
            }
            required(points === test.expected_points, `${test.id}: QA point sum differs`);
        }
        return { set, qa };
    }
    return { set };
}

function semanticInput(directory, worker, manifestHash, job, reviewModel) {
    const runFile = path.join(directory, 'run.json'), summaryFile = path.join(directory, job.set_id, 'summary.json');
    const receiptFile = path.join(directory, job.set_id, 'semantic.json');
    const run = read(runFile), summary = read(summaryFile), doc = read(receiptFile);
    required(run.worker === worker && run.phase === 'semantic' && run.manifest_sha256 === manifestHash && run.mock === false, 'Semantic directory is not this worker/frozen manifest production run');
    required(summary.set_id === job.set_id && ['pass', 'semantic_nonpass'].includes(summary.outcome), `${job.set_id}: semantic execution is incomplete`);
    required(summary.receipt_sha256 === fileHash(receiptFile), `${job.set_id}: semantic receipt bytes changed`);
    const receipt = doc.reviews?.length === 1 ? doc.reviews[0] : null;
    required(receipt?.set_id === job.set_id && receipt.execution?.method === 'model_reasoned' && receipt.execution?.transport === 'model' && receipt.execution.model === reviewModel, `${job.set_id}: model semantic receipt required`);
    return { file: receiptFile, verdict: receipt.verdict, frozen: [runFile, summaryFile, receiptFile].map(file => ({ file, sha256: fileHash(file) })) };
}

function jsonHash(value) {
    const ordered = item => Array.isArray(item) ? item.map(ordered) : object(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, ordered(val)])) : item;
    return hash(JSON.stringify(ordered(value)));
}

function reviewedHash(set) {
    const body = structuredClone(set); delete body.status;
    if (body.verification) delete body.verification.review_status;
    return hash(JSON.stringify(body));
}

function fileIdentities(rows) {
    return rows.map(row => ({ file: resolve(row.file).toLowerCase(), sha256: row.sha256 })).sort((a, b) => a.file.localeCompare(b.file));
}

/** Fail closed on any old runtime change; no compatibility or cache exception. */
function semanticProvenanceInput(provenance, currentManifest, job) {
    const manifestFile = resolve(provenance.manifest_file);
    required(fileHash(manifestFile) === provenance.manifest_sha256, `${job.set_id}: original manifest hash differs`);
    const origin = validateManifest(read(manifestFile));
    const oldJob = origin.jobs.find(item => item.set_id === job.set_id && item.worker === provenance.worker);
    required(oldJob, `${job.set_id}: source manifest/worker does not own this set`);
    required(origin.model === currentManifest.model && origin.review_model === currentManifest.review_model
        && origin.max_input_chars === currentManifest.max_input_chars, `${job.set_id}: original runtime model/budget differs`);
    required(origin.bank_sha256 === currentManifest.bank_sha256 && samePath(resolve(origin.bank_file), resolve(currentManifest.bank_file)), `${job.set_id}: original bank identity differs`);
    required(oldJob.sha256 === job.sha256 && (oldJob.plan_sha256 ?? null) === (job.plan_sha256 ?? null)
        && Boolean(oldJob.plan_file) === Boolean(job.plan_file), `${job.set_id}: original question/plan hash differs`);
    required(jsonHash(fileIdentities(oldJob.source_files)) === jsonHash(fileIdentities(job.source_files)), `${job.set_id}: original source-file identities differ`);
    for (const row of origin.code_files) {
        required(currentManifest.code_files.some(current => samePath(resolve(current.file), resolve(row.file)) && current.sha256 === row.sha256), `Original runtime file is missing or differs in current lock: ${row.file}`);
        required(fileHash(resolve(row.file)) === row.sha256, `Original runtime code changed: ${row.file}`);
    }
    for (const row of identityRows(origin, oldJob)) required(fileHash(resolve(row.file)) === row.sha256, `Original frozen input changed: ${row.file}`);
    const directory = resolve(provenance.run_directory);
    const receiptFile = resolve(provenance.receipt_file);
    const expectedReceipt = path.join(directory, job.set_id, 'semantic.json');
    required(samePath(receiptFile, expectedReceipt) && samePath(fs.realpathSync(receiptFile), fs.realpathSync(expectedReceipt)), `${job.set_id}: receipt is outside the original set run`);
    const directoryReal = fs.realpathSync(directory);
    required(within(fs.realpathSync(receiptFile), directoryReal), `${job.set_id}: receipt symlink leaves original run`);
    const runFile = path.join(directory, 'run.json'), summaryFile = path.join(directory, job.set_id, 'summary.json');
    const requestFile = path.join(directory, job.set_id, 'request.json');
    for (const file of [runFile, summaryFile, requestFile]) required(within(fs.realpathSync(file), directoryReal), 'Semantic provenance symlink leaves original run');
    for (const [file, expected] of [[runFile, provenance.run_sha256], [summaryFile, provenance.summary_sha256], [requestFile, provenance.request_sha256]]) {
        if (expected !== undefined) required(fileHash(file) === expected, `${job.set_id}: provenance artifact hash differs`);
    }
    const run = read(runFile), summary = read(summaryFile), request = read(requestFile), doc = read(receiptFile);
    required(run.worker === provenance.worker && run.phase === 'semantic' && run.mock === false && run.transport === 'production_cli_subprocess'
        && run.manifest_sha256 === provenance.manifest_sha256 && samePath(resolve(run.manifest_file), manifestFile)
        && samePath(resolve(run.output), directory) && run.set_ids?.includes(job.set_id), `${job.set_id}: original run identity differs`);
    required(run.model === origin.model && run.review_model === origin.review_model && run.max_input_chars === origin.max_input_chars, `${job.set_id}: original run model/budget differs`);
    required(origin.code_files.some(row => samePath(resolve(row.file), resolve(run.worker_file)) && row.sha256 === run.worker_sha256)
        && fileHash(resolve(run.worker_file)) === run.worker_sha256, `${job.set_id}: original worker hash is not frozen`);
    required(summary.set_id === job.set_id && summary.phase === 'semantic' && ['pass', 'semantic_nonpass'].includes(summary.outcome)
        && summary.input_sha256 === oldJob.sha256 && !summary.child_signal && !summary.guard_or_observer_error
        && !summary.error && nonempty(summary.finished_at), `${job.set_id}: original set execution is incomplete`);
    required(summary.receipt_sha256 === provenance.receipt_sha256 && fileHash(receiptFile) === provenance.receipt_sha256
        && samePath(resolve(summary.receipt_file), receiptFile), `${job.set_id}: original receipt hash/path differs`);
    required(request.set_id === job.set_id && request.manifest_sha256 === provenance.manifest_sha256
        && jsonHash(fileIdentities(request.frozen_files || [])) === jsonHash(fileIdentities(identityRows(origin, oldJob))), `${job.set_id}: original request does not bind the frozen inputs`);
    required(samePath(request.executable, process.execPath) && request.credential_logged === false, `${job.set_id}: original CLI executable/record contract differs`);
    const expectedCommand = commandFor(oldJob, 'semantic', directory, null).argv.map(value => value === '__BANK__' ? resolve(origin.bank_file) : value);
    required(jsonHash(request.argv) === jsonHash(expectedCommand), `${job.set_id}: original command does not match the semantic CLI`);
    const receipt = doc.reviews?.length === 1 ? doc.reviews[0] : null;
    required(receipt?.set_id === job.set_id && receipt.execution?.method === 'model_reasoned' && receipt.execution.transport === 'model'
        && receipt.execution.model === origin.review_model && receipt.grading?.status === 'not_run'
        && receipt.grading.transport === 'none' && ['pass', 'fail', 'uncertain'].includes(receipt.verdict), `${job.set_id}: actual model semantic receipt required`);
    required(summary.semantic_verdict === receipt.verdict && summary.child_exit_code === (receipt.verdict === 'pass' ? 0 : 1)
        && summary.outcome === (receipt.verdict === 'pass' ? 'pass' : 'semantic_nonpass'), `${job.set_id}: original completion verdict differs`);
    const receiptBody = { ...receipt }; delete receiptBody.receipt_hash;
    required(receipt.receipt_hash === jsonHash(receiptBody) && receipt.context_hash === jsonHash(receipt.context), `${job.set_id}: receipt/context hash is invalid`);
    const currentSet = loadJob(job, 'grading').set;
    required(receipt.content_hash === reviewedHash(currentSet), `${job.set_id}: receipt does not match the current question body`);
    required(jsonHash(fileIdentities(receipt.source_files)) === jsonHash(fileIdentities(job.source_files)), `${job.set_id}: receipt source files differ`);
    const bankValue = read(resolve(currentManifest.bank_file));
    const bank = Array.isArray(bankValue) ? bankValue : bankValue.sets;
    const peers = bank.filter(item => item.id !== job.set_id).sort((a, b) => a.id.localeCompare(b.id));
    required(receipt.bank_hash === jsonHash(peers.map(item => ({ id: item.id, content_hash: reviewedHash(item) }))), `${job.set_id}: receipt comparison-bank hash differs`);
    let plan = job.plan_file ? read(resolve(job.plan_file)) : null;
    if (plan?.plans) {
        const matching = plan.plans.filter(item => item.set_id === job.set_id);
        required(matching.length === 1, `${job.set_id}: plan collection identity differs`); plan = matching[0];
    }
    required(jsonHash(receipt.context.authoring_plan) === jsonHash(plan) && receipt.context.source_packet === null, `${job.set_id}: receipt plan/packet differs`);
    const files = [manifestFile, runFile, summaryFile, requestFile, receiptFile, ...identityRows(origin, oldJob).map(row => resolve(row.file))];
    return { file: receiptFile, verdict: receipt.verdict, provenance: { ...provenance, run_sha256: fileHash(runFile), summary_sha256: fileHash(summaryFile), request_sha256: fileHash(requestFile) },
        frozen: [...new Set(files)].map(file => ({ file, sha256: fileHash(file) })) };
}

function commandFor(job, phase, output, semantic) {
    const folder = path.join(output, job.set_id);
    if (phase === 'author-qa') return { folder, result: path.join(folder, 'author-qa'), argv: ['--import', 'tsx', AUTHOR_CLI, '--file', resolve(job.file), '--qa', resolve(job.qa_file), '--output', path.join(folder, 'author-qa')] };
    const result = path.join(folder, phase === 'semantic' ? 'semantic.json' : 'grading.json');
    return { folder, result, argv: ['--import', 'tsx', REVIEW_CLI, '--file', resolve(job.file), '--bank', '__BANK__',
        ...(job.plan_file ? ['--plan', resolve(job.plan_file)] : []),
        ...(phase === 'grading' ? ['--review-input', semantic.file, '--grade-cases'] : []), '--output', result] };
}

function classify(phase, exitCode, doc, setId, manifest) {
    if (phase === 'author-qa') {
        if (!object(doc) || doc.set_id !== setId || doc.model !== manifest.model || doc.stopped_on_execution_error !== false || !Array.isArray(doc.changed_inputs) || doc.changed_inputs.length || !Array.isArray(doc.records) || doc.records.some(row => row.error) || doc.recorded_cases !== doc.planned_cases) return 'execution_error';
        const mismatch = Array.isArray(doc.mismatched_case_ids) && doc.mismatched_case_ids.length > 0;
        return exitCode === (mismatch ? 1 : 0) ? mismatch ? 'grading_mismatch' : 'pass' : 'execution_error';
    }
    const receipt = doc?.reviews?.length === 1 ? doc.reviews[0] : null;
    if (receipt?.set_id !== setId || receipt.execution?.method !== 'model_reasoned' || receipt.execution?.transport !== 'model' || receipt.execution.model !== manifest.review_model || !['pass', 'fail', 'uncertain'].includes(receipt.verdict)) return 'execution_error';
    if (phase === 'semantic') return exitCode === (receipt.verdict === 'pass' ? 0 : 1) ? receipt.verdict === 'pass' ? 'pass' : 'semantic_nonpass' : 'execution_error';
    if (receipt.verdict !== 'pass' || receipt.grading?.status !== 'completed' || receipt.grading.transport !== 'model' || receipt.grading.model !== manifest.model || !Array.isArray(receipt.grading.runs) || !receipt.grading.runs.length) return 'execution_error';
    const mismatch = receipt.grading.runs.some(run => run.matched !== true);
    return exitCode === (mismatch ? 1 : 0) ? mismatch ? 'grading_mismatch' : 'pass' : 'execution_error';
}

function makeRedactor(env) {
    const values = Object.entries(env).filter(([key, value]) => /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) && typeof value === 'string' && value.length >= 8).map(([, value]) => value).sort((a, b) => b.length - a.length);
    return text => {
        let safe = String(text);
        for (const secret of values) safe = safe.replaceAll(secret, '[REDACTED]');
        return safe.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]');
    };
}

async function runChild(command, env, check, redact, stopRequested, allowStart = () => true) {
    const stdoutFd = fs.openSync(path.join(command.folder, 'stdout.log'), 'wx');
    const stderrFd = fs.openSync(path.join(command.folder, 'stderr.log'), 'wx');
    let child, failure = null, stderrTail = '';
    const abort = error => { failure ||= redact(error.message || String(error)); if (child && !child.killed) child.kill('SIGTERM'); };
    const consume = (fd, target, isError) => {
        const decoder = new StringDecoder('utf8'); let pending = '';
        const emit = line => {
            const safe = redact(line);
            fs.writeSync(fd, safe); target.write(safe);
            if (isError) stderrTail = (stderrTail + safe).slice(-16000);
        };
        return { data(chunk) { try { pending += decoder.write(chunk); const cut = pending.lastIndexOf('\n'); if (cut >= 0) { emit(pending.slice(0, cut + 1)); pending = pending.slice(cut + 1); } } catch (error) { abort(error); } },
            end() { try { pending += decoder.end(); if (pending) emit(pending); } catch (error) { abort(error); } } };
    };
    let timer;
    try {
        check();
        required(!stopRequested(), 'Interrupted before subprocess start');
        if (!allowStart()) return { code: null, signal: null, pid: null, not_started: true, guard_or_observer_error: null, stderr_tail: '' };
        child = spawn(process.execPath, command.argv, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false });
        const out = consume(stdoutFd, process.stdout, false), err = consume(stderrFd, process.stderr, true);
        child.stdout.on('data', out.data); child.stdout.on('end', out.end);
        child.stderr.on('data', err.data); child.stderr.on('end', err.end);
        timer = setInterval(() => { try { required(!stopRequested(), 'Interrupted by operator'); check(); } catch (error) { abort(error); } }, 1500);
        const result = await new Promise(resolveResult => {
            child.once('error', error => { failure ||= redact(error.message); });
            child.once('close', (code, signal) => resolveResult({ code, signal }));
        });
        return { ...result, pid: child.pid ?? null, guard_or_observer_error: failure, stderr_tail: stderrTail };
    } finally {
        clearInterval(timer); fs.closeSync(stdoutFd); fs.closeSync(stderrFd);
    }
}

async function localSelfTest() {
    assert(fs.existsSync(path.join(ROOT, REVIEW_CLI)));
    const manifest = { model: 'fixture-grader', review_model: 'fixture-review', max_input_chars: 500000 };
    const fixtureEnv = { CPA_GRADING_MODEL: manifest.model, CPA_REVIEW_MODEL: manifest.review_model };
    const selfHash = fileHash(SELF);
    const job = { set_id: 'fixture', worker: 'b', file: SELF, sha256: selfHash, source_files: [] };
    const frozen = { ...manifest, bank_file: SELF, bank_sha256: selfHash, code_files: [{ file: SELF, sha256: selfHash }], jobs: [job] };
    validateManifest(frozen);
    // Exercise real filesystem hash guards without creating fixture files.
    guard(frozen, job, SELF, selfHash, selfHash, fixtureEnv);
    assert.throws(() => guard({ ...frozen, bank_sha256: '0'.repeat(64) }, job, SELF, selfHash, selfHash, fixtureEnv));
    assert.throws(() => guard(frozen, { ...job, sha256: '0'.repeat(64) }, SELF, selfHash, selfHash, fixtureEnv));
    assert.throws(() => guard(frozen, { ...job, source_files: [{ file: SELF, sha256: '0'.repeat(64) }] }, SELF, selfHash, selfHash, fixtureEnv));
    assert.throws(() => guard(frozen, job, SELF, '0'.repeat(64), selfHash, fixtureEnv));
    assert.throws(() => guard(frozen, job, SELF, selfHash, '0'.repeat(64), fixtureEnv));
    assert.throws(() => validateManifest({ ...frozen, jobs: [job, job] }));
    assert.throws(() => validateManifest({ ...frozen, jobs: [{ ...job, set_id: '../outside' }] }));
    assert.throws(() => validateManifest({ ...frozen, jobs: [{ ...job, plan_file: 'missing-hash' }] }));
    assert.throws(() => environment(manifest, {}));
    assert.throws(() => environment(manifest, { CPA_GRADING_MODEL: 'other', CPA_REVIEW_MODEL: manifest.review_model }));
    assert.equal(environment(manifest, { CPA_GRADING_MODEL: manifest.model, CPA_REVIEW_MODEL: manifest.review_model }).CPA_REVIEW_INPUT_MAX_CHARS, '500000');
    assert.throws(() => parseArgs(['--worker', 'b', '--worker', 'a']));
    assert(!within(path.resolve(BATCH_ROOT, '..'), BATCH_ROOT));
    assert(!within(BATCH_ROOT, BATCH_ROOT));
    assert(within(path.join(BATCH_ROOT, 'fixture'), BATCH_ROOT));
    const receipt = { set_id: 'fixture', execution: { method: 'model_reasoned', transport: 'model', model: manifest.review_model }, verdict: 'uncertain' };
    assert.equal(classify('semantic', 1, { reviews: [receipt] }, 'fixture', manifest), 'semantic_nonpass');
    assert.equal(classify('semantic', 1, null, 'fixture', manifest), 'execution_error');
    assert.equal(classify('semantic', 0, { reviews: [{ ...receipt, verdict: 'pass' }] }, 'fixture', manifest), 'pass');
    assert.equal(classify('semantic', 1, { reviews: [{ ...receipt, verdict: 'pass' }] }, 'fixture', manifest), 'execution_error');
    assert.equal(classify('semantic', 1, { reviews: [{ ...receipt, execution: { ...receipt.execution, transport: 'injected_response' } }] }, 'fixture', manifest), 'execution_error');
    const author = { set_id: 'fixture', model: manifest.model, stopped_on_execution_error: false, changed_inputs: [], records: [{ error: null }], recorded_cases: 1, planned_cases: 1, mismatched_case_ids: ['one'] };
    assert.equal(classify('author-qa', 1, author, 'fixture', manifest), 'grading_mismatch');
    assert.equal(classify('author-qa', 1, { ...author, stopped_on_execution_error: true }, 'fixture', manifest), 'execution_error');
    assert.equal(classify('author-qa', 1, { ...author, recorded_cases: 0 }, 'fixture', manifest), 'execution_error');
    assert.equal(classify('author-qa', 1, { ...author, changed_inputs: ['input'] }, 'fixture', manifest), 'execution_error');
    const grade = { reviews: [{ ...receipt, verdict: 'pass', grading: { status: 'completed', transport: 'model', model: manifest.model, runs: [{ matched: false }] } }] };
    assert.equal(classify('grading', 1, grade, 'fixture', manifest), 'grading_mismatch');
    assert.equal(classify('grading', 1, null, 'fixture', manifest), 'execution_error');
    assert.equal(makeRedactor({ OPENAI_API_KEY: 'fixture-secret-value' })('x fixture-secret-value y'), 'x [REDACTED] y');
    const integration = await provenanceFixtureTests();
    console.log(JSON.stringify({ mode: 'local_pure_and_temporary_fixture_self_test', passed: true, api_calls: 0,
        production_cli_calls: 0, synthetic_results_are_not_model_evidence: true, ...integration }));
}

async function provenanceFixtureTests() {
    const fixture = fs.mkdtempSync(path.join(path.dirname(SELF), '.worker-v2-fixture-'));
    const events = [];
    let workerInvocations = 0;
    const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    try {
        const set = read(path.join(path.dirname(SELF), 'sets.json')).find(set => set.id === 'pilot-07-005');
        const sourceFile = path.join(fixture, 'question.json'), bankFile = path.join(fixture, 'bank.json'), planFile = path.join(fixture, 'plan.json');
        write(sourceFile, set); write(bankFile, [set]); write(planFile, { set_id: set.id, fixture_only: true });
        const requiredCode = [REVIEW_CLI, 'cpa_uploader/questionSemanticReview.ts', 'cpa_uploader/questionReviewGrading.ts',
            'lib/questionV3Grading.ts', 'lib/ai/openaiStructured.ts', 'cpa_uploader/questionReviewIdentity.ts', relative(path.join(path.dirname(SELF), 'validation-worker.mjs'))];
        const codeFiles = requiredCode.map(file => ({ file, sha256: fileHash(resolve(file)) }));
        const oldJob = { set_id: set.id, worker: 'a', file: sourceFile, sha256: fileHash(sourceFile), plan_file: planFile, plan_sha256: fileHash(planFile),
            source_files: [...new Set(set.source_refs.map(ref => ref.file))].map(file => ({ file, sha256: fileHash(resolve(file)) })) };
        const originFile = path.join(fixture, 'origin-manifest.json');
        const origin = { bank_file: bankFile, bank_sha256: fileHash(bankFile), model: 'fixture-no-api-grader', review_model: 'fixture-no-api-review',
            max_input_chars: 500000, code_files: codeFiles, jobs: [oldJob] };
        write(originFile, origin);
        const originHash = fileHash(originFile), runDirectory = path.join(fixture, 'origin-run'), folder = path.join(runDirectory, set.id);
        fs.mkdirSync(folder, { recursive: true });
        const runFile = path.join(runDirectory, 'run.json'), summaryFile = path.join(folder, 'summary.json'), requestFile = path.join(folder, 'request.json'), receiptFile = path.join(folder, 'semantic.json');
        const context = { authoring_plan: read(planFile), source_packet: null, source_metadata: [] };
        const receipt = { schema_version: '1.0', set_id: set.id, content_hash: reviewedHash(set), bank_hash: jsonHash([]),
            source_files: oldJob.source_files, context, context_hash: jsonHash(context),
            execution: { method: 'model_reasoned', transport: 'model', model: origin.review_model, performed_at: now(), description: 'SYNTHETIC LOCAL FIXTURE: NOT MODEL EVIDENCE' },
            grading: { status: 'not_run', transport: 'none' }, units: [], cases: [], verdict: 'pass' };
        receipt.receipt_hash = jsonHash(receipt);
        write(receiptFile, { schema_version: '1.0', reviews: [receipt] });
        const run = { worker: 'a', phase: 'semantic', mock: false, transport: 'production_cli_subprocess', manifest_file: originFile, manifest_sha256: originHash,
            output: runDirectory, set_ids: [set.id], model: origin.model, review_model: origin.review_model, max_input_chars: origin.max_input_chars,
            worker_file: requiredCode.at(-1), worker_sha256: fileHash(resolve(requiredCode.at(-1))) };
        const summary = { set_id: set.id, phase: 'semantic', outcome: 'pass', input_sha256: oldJob.sha256, child_signal: null,
            guard_or_observer_error: null, finished_at: now(), receipt_file: receiptFile, receipt_sha256: fileHash(receiptFile), semantic_verdict: 'pass', child_exit_code: 0 };
        const argv = commandFor(oldJob, 'semantic', runDirectory, null).argv.map(value => value === '__BANK__' ? bankFile : value);
        const request = { set_id: set.id, manifest_sha256: originHash, frozen_files: identityRows(origin, oldJob), argv, executable: process.execPath, credential_logged: false };
        write(runFile, run); write(summaryFile, summary); write(requestFile, request);
        const provenance = { manifest_file: originFile, manifest_sha256: originHash, worker: 'a', run_directory: runDirectory, receipt_file: receiptFile,
            receipt_sha256: fileHash(receiptFile), run_sha256: fileHash(runFile), summary_sha256: fileHash(summaryFile), request_sha256: fileHash(requestFile) };
        const currentJob = { ...oldJob, worker: 'b', semantic_provenance: provenance };
        const current = { ...origin, code_files: [...origin.code_files, { file: relative(SELF), sha256: fileHash(SELF) }], jobs: [currentJob] };
        const currentFile = path.join(fixture, 'current-manifest.json'); write(currentFile, current);
        const env = { ...process.env, OPENAI_API_KEY: '', CPA_GRADING_MODEL: current.model, CPA_REVIEW_MODEL: current.review_model, CPA_REVIEW_INPUT_MAX_CHARS: String(current.max_input_chars) };
        const invoke = args => {
            workerInvocations++;
            return spawnSync(process.execPath, [SELF, '--manifest', currentFile, '--worker', 'b', '--phase', 'grading', '--output', path.join(fixture, `output-${workerInvocations}`), ...args], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true });
        };
        const success = invoke(['--dry-run']);
        assert.equal(success.status, 0, success.stderr);
        assert.equal(JSON.parse(success.stdout).jobs[0].semantic_provenance.worker, 'a');
        events.push('valid_cross_run_and_original_worker_provenance_dry_run');
        const negative = (label, change, restore) => {
            change(); const result = invoke(['--dry-run']); restore();
            assert.equal(result.status, 1, `${label}: ${result.stdout} ${result.stderr}`); events.push(label);
        };
        negative('original_manifest_hash_rejected', () => write(currentFile, { ...current, jobs: [{ ...currentJob, semantic_provenance: { ...provenance, manifest_sha256: '0'.repeat(64) } }] }), () => write(currentFile, current));
        negative('wrong_original_worker_rejected', () => write(currentFile, { ...current, jobs: [{ ...currentJob, semantic_provenance: { ...provenance, worker: 'c' } }] }), () => write(currentFile, current));
        negative('arbitrary_receipt_path_rejected', () => write(currentFile, { ...current, jobs: [{ ...currentJob, semantic_provenance: { ...provenance, receipt_file: bankFile } }] }), () => write(currentFile, current));
        negative('incomplete_origin_summary_rejected', () => write(summaryFile, { ...summary, outcome: 'execution_error' }), () => write(summaryFile, summary));
        negative('changed_original_request_rejected', () => write(requestFile, { ...request, argv: [...argv, '--manual-input', 'fake.json'] }), () => write(requestFile, request));
        negative('origin_model_change_rejected', () => write(runFile, { ...run, review_model: 'wrong' }), () => write(runFile, run));
        const unhashed = { ...provenance }; delete unhashed.run_sha256; delete unhashed.summary_sha256; delete unhashed.request_sha256;
        const currentWithoutOptional = { ...current, jobs: [{ ...currentJob, semantic_provenance: unhashed }] };
        write(currentFile, currentWithoutOptional);
        negative('injected_transport_rejected_even_with_refreshed_file_hashes', () => {
            const changed = { ...receipt, execution: { ...receipt.execution, transport: 'injected_response' } }; delete changed.receipt_hash; changed.receipt_hash = jsonHash(changed);
            write(receiptFile, { schema_version: '1.0', reviews: [changed] });
            write(summaryFile, { ...summary, receipt_sha256: fileHash(receiptFile) });
            write(currentFile, { ...currentWithoutOptional, jobs: [{ ...currentJob, semantic_provenance: { ...unhashed, receipt_sha256: fileHash(receiptFile) } }] });
        }, () => { write(receiptFile, { schema_version: '1.0', reviews: [receipt] }); write(summaryFile, summary); write(currentFile, current); });
        negative('changed_question_hash_rejected', () => { write(sourceFile, { ...set, title: `${set.title} modified` }); }, () => write(sourceFile, set));
        negative('changed_plan_rejected', () => write(planFile, { set_id: set.id, fixture_only: false }), () => write(planFile, context.authoring_plan));
        negative('missing_original_runtime_file_rejected', () => write(currentFile, { ...current, code_files: current.code_files.filter(row => row.file !== requiredCode.at(-1)) }), () => write(currentFile, current));
        const stopFile = path.join(fixture, 'STOP'); fs.writeFileSync(stopFile, 'fixture stop');
        const stopped = invoke(['--stop-file', stopFile]);
        assert.equal(stopped.status, 0, stopped.stderr);
        const stoppedSummary = read(path.join(fixture, `output-${workerInvocations}`, 'summary.json'));
        assert.equal(stoppedSummary.gracefully_stopped, true); assert.equal(stoppedSummary.recorded_sets, 0);
        assert.deepEqual(stoppedSummary.not_started_set_ids, [set.id]);
        events.push('existing_stop_file_preserves_not_started_sets_without_key_or_cli');
        fs.unlinkSync(stopFile);
        const childFolder = path.join(fixture, 'dummy-child'); fs.mkdirSync(childFolder);
        const dummy = path.join(fixture, 'dummy-child.mjs');
        fs.writeFileSync(dummy, `import fs from 'node:fs'; fs.writeFileSync(process.argv[2], 'stop-after-start'); console.log('LOCAL FIXTURE START'); setTimeout(()=>console.log('LOCAL FIXTURE FINISHED'),80);`);
        const child = await runChild({ folder: childFolder, argv: [dummy, stopFile] }, env, () => {}, makeRedactor(env), () => false);
        assert.equal(child.code, 0); assert.equal(child.signal, null); assert.equal(child.guard_or_observer_error, null);
        assert(fs.existsSync(stopFile)); assert(fs.readFileSync(path.join(childFolder, 'stdout.log'), 'utf8').includes('LOCAL FIXTURE FINISHED'));
        events.push('stop_file_created_during_current_child_does_not_kill_current_child');
        const blockedFolder = path.join(fixture, 'blocked-child'); fs.mkdirSync(blockedFolder);
        const blocked = await runChild({ folder: blockedFolder, argv: [dummy, stopFile] }, env, () => {}, makeRedactor(env), () => false, () => !fs.existsSync(stopFile));
        assert.equal(blocked.not_started, true); assert.equal(blocked.pid, null);
        assert.equal(fs.readFileSync(path.join(blockedFolder, 'stdout.log'), 'utf8'), '');
        events.push('last_pre_spawn_stop_check_starts_no_child');
        return { fixture_checks: events, worker_fixture_invocations: workerInvocations, dummy_processes: 1, fixture_artifacts_removed: true };
    } finally {
        assert.equal(path.dirname(fixture), path.dirname(SELF)); assert(path.basename(fixture).startsWith('.worker-v2-fixture-'));
        fs.rmSync(fixture, { recursive: true, force: true });
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args['--help']) { console.log('Required: --manifest --worker a|b|c --phase semantic|grading|author-qa --output <new directory>; grading needs per-job semantic_provenance or --semantic-directory fallback. Optional: --stop-file (finish current CLI before stopping), --dry-run (read-only, no subprocess), --self-test. Use explicit CPA_GRADING_MODEL and CPA_REVIEW_MODEL; node --env-file=.env.local loads credentials without logging them.'); return; }
    if (args['--self-test']) { required(Object.keys(args).length === 1, '--self-test is standalone'); await localSelfTest(); return; }
    for (const key of ['--manifest', '--worker', '--phase', '--output']) required(args[key], `${key} is required`);
    const worker = args['--worker'], phase = args['--phase'];
    required(['a', 'b', 'c'].includes(worker), 'Invalid worker');
    required(['semantic', 'grading', 'author-qa'].includes(phase), 'Invalid phase');
    required(phase === 'grading' || !args['--semantic-directory'], '--semantic-directory is only supported for grading');
    const manifestFile = resolve(args['--manifest']), manifestHash = fileHash(manifestFile), selfHash = fileHash(SELF);
    const manifest = validateManifest(read(manifestFile));
    const env = environment(manifest, process.env), redact = makeRedactor(env);
    const output = resolve(args['--output']);
    const stopFile = args['--stop-file'] ? resolve(args['--stop-file']) : null;
    required(!fs.existsSync(output), 'Output directory already exists; use a new path');
    required(phase === 'author-qa' ? within(output, DRAFT_ROOT) : within(output, BATCH_ROOT) || within(output, DRAFT_ROOT), 'Output is outside the dedicated review/draft roots');
    const jobs = manifest.jobs.filter(job => job.worker === worker);
    required(jobs.length > 0, 'No assigned jobs');
    required(phase !== 'grading' || jobs.every(job => job.semantic_provenance || args['--semantic-directory']), 'Every grading job needs semantic_provenance or --semantic-directory');
    const critical = [REVIEW_CLI, 'cpa_uploader/questionSemanticReview.ts', 'cpa_uploader/questionReviewGrading.ts', 'lib/questionV3Grading.ts', 'lib/ai/openaiStructured.ts', ...(phase === 'author-qa' ? [AUTHOR_CLI] : [])];
    for (const file of critical) required(manifest.code_files.some(row => samePath(resolve(row.file), resolve(file))), `Manifest must freeze production code: ${file}`);
    const planned = [];
    for (const job of jobs) {
        guard(manifest, job, manifestFile, manifestHash, selfHash, process.env);
        loadJob(job, phase);
        const semantic = phase === 'grading' ? job.semantic_provenance
            ? semanticProvenanceInput(job.semantic_provenance, manifest, job)
            : semanticInput(resolve(args['--semantic-directory']), worker, manifestHash, job, manifest.review_model) : null;
        const command = commandFor(job, phase, output, semantic);
        command.argv = command.argv.map(value => value === '__BANK__' ? resolve(manifest.bank_file) : value);
        planned.push({ job, semantic, command });
    }
    if (args['--dry-run']) {
        console.log(JSON.stringify({ mode: 'dry_run', worker, phase, manifest_sha256: manifestHash, worker_sha256: selfHash, models: { grading: manifest.model, review: manifest.review_model }, max_input_chars: manifest.max_input_chars, stop_file: stopFile, will_stop_before_first_set: Boolean(stopFile && fs.existsSync(stopFile)), jobs: planned.map(({ job, semantic, command }) => ({ set_id: job.set_id, will_skip_nonpass: Boolean(semantic && semantic.verdict !== 'pass'), semantic_provenance: semantic?.provenance ?? null, executable: process.execPath, argv: command.argv })), api_calls: 0, subprocesses: 0, files_written: 0 }, null, 2)); return;
    }
    required(stopFile && fs.existsSync(stopFile) || nonempty(env.OPENAI_API_KEY), 'OPENAI_API_KEY is missing; no subprocess started');
    // Exclusive final mkdir prevents two workers from acquiring the same new run.
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.mkdirSync(output);
    const run = { version: 2, started_at: now(), worker, phase, manifest_file: relative(manifestFile), manifest_sha256: manifestHash, worker_file: relative(SELF), worker_sha256: selfHash, model: manifest.model, review_model: manifest.review_model, max_input_chars: manifest.max_input_chars, set_ids: jobs.map(job => job.set_id), output: relative(output), transport: 'production_cli_subprocess', mock: false, credentials_logged: false, stop_file: stopFile ? relative(stopFile) : null, receipt_provenance: args['--semantic-directory'] ? relative(resolve(args['--semantic-directory'])) : null };
    writeJson(path.join(output, 'run.json'), run);
    let interrupted = false;
    const onSignal = () => { interrupted = true; };
    process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    const summaries = [];
    let gracefullyStopped = false;
    try {
        for (const { job, semantic, command } of planned) {
            if (stopFile && fs.existsSync(stopFile)) { gracefullyStopped = true; break; }
            const summary = { set_id: job.set_id, started_at: now(), phase, outcome: 'execution_error', input_sha256: job.sha256 };
            try {
                const check = () => {
                    guard(manifest, job, manifestFile, manifestHash, selfHash, process.env);
                    for (const row of semantic?.frozen || []) required(fileHash(row.file) === row.sha256, 'Semantic provenance changed during execution');
                };
                check(); required(!interrupted, 'Interrupted before next set');
                fs.mkdirSync(command.folder);
                writeJson(path.join(command.folder, 'request.json'), { set_id: job.set_id, executable: process.execPath, argv: command.argv, manifest_sha256: manifestHash, frozen_files: identityRows(manifest, job), semantic_provenance: semantic?.frozen || [], semantic_provenance_identity: semantic?.provenance ?? null, credential_logged: false });
                if (semantic && semantic.verdict !== 'pass') {
                    summary.outcome = 'blocked_semantic_nonpass'; summary.semantic_verdict = semantic.verdict; summary.api_calls = 0;
                } else {
                    console.log(JSON.stringify({ event: 'set_started', worker, phase, set_id: job.set_id, time: now() }));
                    const child = await runChild(command, env, check, redact, () => interrupted, () => !stopFile || !fs.existsSync(stopFile));
                    Object.assign(summary, { child_exit_code: child.code, child_signal: child.signal, child_pid: child.pid, guard_or_observer_error: child.guard_or_observer_error, stderr_tail: child.stderr_tail });
                    check();
                    const resultFile = phase === 'author-qa' ? path.join(command.result, 'summary.json') : command.result;
                    const doc = fs.existsSync(resultFile) ? read(resultFile) : null;
                    if (child.not_started) { gracefullyStopped = true; summary.api_calls = 0; }
                    summary.outcome = child.not_started ? 'not_started_stop_file' : child.guard_or_observer_error || child.signal ? 'execution_error' : classify(phase, child.code, doc, job.set_id, manifest);
                    summary.receipt_file = relative(resultFile);
                    summary.receipt_sha256 = fs.existsSync(resultFile) ? fileHash(resultFile) : null;
                    if (phase === 'author-qa' && doc) Object.assign(summary, { planned_cases: doc.planned_cases, recorded_cases: doc.recorded_cases, actual_attempts: doc.actual_attempts, mismatched_case_ids: doc.mismatched_case_ids, stopped_on_execution_error: doc.stopped_on_execution_error });
                    else if (doc?.reviews?.[0]) {
                        const receipt = doc.reviews[0];
                        Object.assign(summary, { semantic_verdict: receipt.verdict, nonpass_units: receipt.units.filter(unit => Object.values(unit.checks).some(verdict => verdict !== 'pass')).map(unit => ({ id: unit.id, checks: unit.checks, rationale: unit.rationale })), nonpass_cases: receipt.cases.filter(test => test.verdict !== 'pass').map(test => ({ unit_id: test.unit_id, kind: test.kind, verdict: test.verdict, rationale: test.rationale })), grading_status: receipt.grading?.status, mismatched_run_ids: receipt.grading?.runs?.filter(item => item.matched !== true).map(item => item.id) || [] });
                    }
                }
            } catch (error) { summary.outcome = 'execution_error'; summary.error = redact(error.message || String(error)); }
            summary.finished_at = now();
            // Filesystem/logging failures escape immediately; they never trigger API retries.
            if (!fs.existsSync(command.folder)) fs.mkdirSync(command.folder);
            writeJson(path.join(command.folder, 'summary.json'), summary); summaries.push(summary);
            fs.appendFileSync(path.join(output, 'events.jsonl'), `${JSON.stringify(summary)}\n`, { flag: 'a' });
            console.log(JSON.stringify({ event: 'set_finished', set_id: job.set_id, outcome: summary.outcome, time: now() }));
            if (summary.outcome === 'execution_error' || gracefullyStopped) break;
        }
    } finally {
        process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
        const completed = new Set(summaries.filter(item => item.outcome !== 'not_started_stop_file').map(item => item.set_id));
        const failed = summaries.some(item => item.outcome === 'execution_error');
        if (stopFile && fs.existsSync(stopFile) && !failed && !interrupted) gracefullyStopped = true;
        writeJson(path.join(output, 'summary.json'), { ...run, finished_at: now(), interrupted, gracefully_stopped: gracefullyStopped,
            stopped_on_execution_error: failed, planned_sets: jobs.length, recorded_sets: summaries.length, not_started_set_ids: jobs.filter(job => !completed.has(job.set_id)).map(job => job.set_id), results: summaries });
        process.exitCode = failed || interrupted ? 1 : summaries.some(item => !['pass', 'not_started_stop_file'].includes(item.outcome)) ? 2 : 0;
    }
}

main().catch(error => { console.error(makeRedactor(process.env)(error.message || String(error))); process.exitCode = 1; });
