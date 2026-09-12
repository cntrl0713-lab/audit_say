// Diagnostic observations only. Never alters a receipt or publishes a passing replacement.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { executeReviewGrading } from '../../../../../cpa_uploader/questionReviewGrading.ts';
import { jsonHash } from '../../../../../cpa_uploader/questionReviewIdentity.ts';
import { buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../../../lib/questionV3Grading.ts';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../../../../..');
const resolve = file => path.resolve(ROOT, file);
const relative = file => path.relative(ROOT, resolve(file)).replaceAll('\\', '/');
const samePath = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();
const within = (file, parent) => { const part = path.relative(resolve(parent), resolve(file)); return part && !part.startsWith('..') && !path.isAbsolute(part); };
const hash = file => createHash('sha256').update(fs.readFileSync(resolve(file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(resolve(file), 'utf8'));
const serial = value => JSON.stringify(value, null, 2) + '\n';
export function parseArgs(argv) {
    const values = {}; let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const key = argv[i];
        if (key === '--dry-run') { assert(!dryRun, 'Duplicate dry-run'); dryRun = true; continue; }
        assert(['--manifest', '--worker', '--set-id', '--grading-directory', '--output', '--stop-file'].includes(key) && !values[key]
            && argv[i + 1] && !argv[i + 1].startsWith('--'), `Invalid argument: ${key}`);
        values[key] = argv[++i];
    }
    for (const key of ['--manifest', '--worker', '--set-id', '--grading-directory', '--output']) assert(values[key], `Missing ${key}`);
    assert(['a', 'b', 'c'].includes(values['--worker']), 'Worker must be a, b or c');
    return { ...values, dryRun };
}
export function safeError(error, depth = 0) {
    return { name: error?.name, code: error?.code, status: error?.status, retryable: error?.retryable,
        request_id: error?.request_id, ...(depth < 6 && error?.cause ? { cause: safeError(error.cause, depth + 1) } : {}) };
}
export function selectMismatchCases(set, cases, runs) {
    const mismatches = runs.filter(run => run.matched === false);
    assert(mismatches.length, 'No mismatched original answer; nothing to repeat');
    assert(mismatches.every(run => run.id !== 'empty-answer'), 'Empty-answer mismatches require local investigation');
    assert.equal(new Set(runs.map(run => run.id)).size, runs.length, 'Duplicate original run IDs');
    function samplePlan(sample) {
        const target = set.subquestions.flatMap(sub => sub.criteria.map(c => ({ unit: `criterion:${sub.id}:${c.id}`, sub, c }))).find(x => x.unit === sample.unit_id);
        assert(target, 'Unknown original case target');
        const answers = Object.fromEntries(set.subquestions.map(sub => [sub.id, sub.id === target.sub.id ? sample.answer : '']));
        return { id: jsonHash(answers), answers, expected: { unit_id: sample.unit_id, case_kind: sample.kind,
            subquestion_id: target.sub.id, criterion_id: target.c.id, verdict: sample.expected } };
    }
    const selected = cases.filter(sample => mismatches.some(run => run.id === samplePlan(sample).id));
    const plans = mismatches.map(run => {
        const samples = selected.filter(sample => samplePlan(sample).id === run.id);
        assert(samples.length, 'Original mismatch not linked to semantic cases');
        const plan = samplePlan(samples[0]);
        assert.deepEqual(plan.answers, run.answers, 'Original answer changed');
        const expected = samples.map(sample => samplePlan(sample).expected);
        assert.deepEqual(expected, run.expected, 'Original expectations changed or omitted');
        return { id: run.id, answers: structuredClone(run.answers), expected: structuredClone(expected) };
    });
    assert.equal(new Set(selected.map(sample => samplePlan(sample).id)).size, plans.length);
    return { cases: structuredClone(selected), plans };
}
export function verifyEventScope(event, plans) {
    if (event.id === 'empty-answer') {
        assert(Object.values(event.answers).every(answer => answer === ''), 'Empty branch contains a nonempty answer'); return;
    }
    const plan = plans.find(item => item.id === event.id);
    assert(plan, 'Unexpected nonempty answer outside selected mismatch scope');
    assert.deepEqual(event.answers, plan.answers, 'Repeated answer changed');
    assert.deepEqual(event.expected, plan.expected, 'Repeated expected assertions changed');
}
export function prepare(options) {
    const snapshots = new Map();
    function freeze(file, expected) {
        const actual = hash(file);
        if (expected) assert.equal(actual, expected, `Frozen file mismatch: ${relative(file)}`);
        const prior = snapshots.get(resolve(file)); if (prior) assert.equal(prior, actual);
        snapshots.set(resolve(file), actual); return actual;
    }
    const manifestFile = resolve(options['--manifest']), gradingDirectory = resolve(options['--grading-directory']);
    const output = resolve(options['--output']), worker = options['--worker'], setId = options['--set-id'];
    assert(!fs.existsSync(output), 'An unused output directory is required');
    assert(within(output, gradingDirectory), 'Diagnostic output must be beneath the original owned grading directory');
    const manifestHash = freeze(manifestFile), manifest = read(manifestFile);
    const matches = manifest.jobs.filter(row => row.worker === worker && row.set_id === setId); assert.equal(matches.length, 1);
    const job = matches[0], folder = path.join(gradingDirectory, setId), gradingFile = path.join(folder, 'grading.json');
    const requestFile = path.join(folder, 'request.json'), request = read(requestFile), gradingSummary = read(path.join(folder, 'summary.json'));
    const runFile = path.join(gradingDirectory, 'run.json'), run = read(runFile);
    assert.equal(run.worker, worker); assert.equal(run.phase, 'grading'); assert.equal(run.mock, false);
    assert.equal(run.transport, 'production_cli_subprocess'); assert(samePath(run.output, gradingDirectory));
    assert.equal(run.manifest_sha256, manifestHash); assert(samePath(run.manifest_file, manifestFile));
    assert.equal(run.model, manifest.model); assert.equal(run.review_model, manifest.review_model);
    assert.equal(run.max_input_chars, manifest.max_input_chars);
    freeze(run.worker_file, run.worker_sha256);
    assert.equal(request.set_id, setId); assert.equal(request.manifest_sha256, manifestHash);
    const argValue = key => { const index = request.argv.indexOf(key); assert(index >= 0 && request.argv[index + 1], `Original request missing ${key}`); return request.argv[index + 1]; };
    assert(samePath(argValue('--file'), job.file)); assert(samePath(argValue('--bank'), manifest.bank_file));
    assert(samePath(argValue('--output'), gradingFile)); assert(request.argv.includes('--grade-cases'));
    if (job.plan_file) assert(samePath(argValue('--plan'), job.plan_file)); else assert(!request.argv.includes('--plan'));
    const semanticFile = resolve(argValue('--review-input')), semanticFolder = path.dirname(semanticFile), semanticDirectory = path.dirname(semanticFolder);
    const semanticRunFile = path.join(semanticDirectory, 'run.json'), semanticSummaryFile = path.join(semanticFolder, 'summary.json');
    const semanticRun = read(semanticRunFile), semanticSummary = read(semanticSummaryFile);
    assert.equal(semanticRun.worker, worker); assert.equal(semanticRun.phase, 'semantic'); assert.equal(semanticRun.mock, false);
    assert.equal(semanticRun.manifest_sha256, manifestHash, 'Cross-manifest compatibility requires a separate explicit contract');
    assert.equal(semanticRun.review_model, manifest.review_model); assert.equal(semanticRun.model, manifest.model);
    assert.equal(semanticSummary.outcome, 'pass'); assert.equal(semanticSummary.input_sha256, job.sha256);
    assert.equal(semanticSummary.receipt_sha256, hash(semanticFile));
    assert.equal(gradingSummary.set_id, setId); assert.equal(gradingSummary.phase, 'grading');
    assert.equal(gradingSummary.outcome, 'grading_mismatch'); assert.equal(gradingSummary.child_signal, null);
    assert.equal(gradingSummary.input_sha256, job.sha256); assert.equal(gradingSummary.receipt_sha256, hash(gradingFile));
    const gradeDoc = read(gradingFile), semanticDoc = read(semanticFile); assert.equal(gradeDoc.reviews.length, 1); assert.equal(semanticDoc.reviews.length, 1);
    const graded = gradeDoc.reviews[0], semantic = semanticDoc.reviews[0];
    assert.equal(graded.set_id, setId); assert.equal(semantic.set_id, setId); assert.equal(semantic.verdict, 'pass');
    assert.equal(semantic.execution.transport, 'model'); assert.equal(semantic.execution.model, manifest.review_model);
    assert.equal(graded.grading.status, 'completed'); assert.equal(graded.grading.transport, 'model'); assert.equal(graded.grading.model, manifest.model);
    assert.equal(semantic.content_hash, graded.content_hash); assert.equal(semantic.bank_hash, graded.bank_hash);
    assert.deepEqual(semantic.cases, graded.cases); assert.deepEqual(semantic.source_files, graded.source_files);
    const rawFile = gradingFile + '.grading.jsonl';
    const rawRows = fs.readFileSync(rawFile, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(rawRows.length, graded.grading.runs.length, 'Incomplete or duplicate original raw log');
    assert.equal(new Set(rawRows.map(row => row.id)).size, rawRows.length);
    for (const original of graded.grading.runs) {
        const raw = rawRows.find(row => row.id === original.id); assert(raw);
        assert.equal(raw.status, 'completed'); assert.equal(raw.transport, 'model'); assert.equal(raw.model, manifest.model);
        assert.equal(raw.set_id, setId); assert.equal(raw.content_hash, graded.content_hash); assert.equal(raw.bank_hash, graded.bank_hash);
        assert.deepEqual(raw.source_files, graded.source_files);
        for (const key of ['answers', 'expected', 'judgment', 'result', 'matched']) assert.deepEqual(raw[key], original[key], `Original raw/receipt ${key} differs`);
        assert(Array.isArray(raw.trace));
    }
    const identities = [{ file: manifest.bank_file, sha256: manifest.bank_sha256 }, ...manifest.code_files,
        { file: job.file, sha256: job.sha256 }, ...(job.plan_file ? [{ file: job.plan_file, sha256: job.plan_sha256 }] : []), ...job.source_files];
    for (const item of identities) { freeze(item.file, item.sha256); assert(request.frozen_files.some(row => samePath(row.file, item.file) && row.sha256 === item.sha256), 'Origin request lacks current frozen identity'); }
    for (const item of request.frozen_files) freeze(item.file, item.sha256);
    for (const item of request.semantic_provenance || []) freeze(item.file, item.sha256);
    for (const file of [SELF, manifestFile, gradingFile, rawFile, runFile, requestFile, path.join(folder, 'summary.json'), semanticFile,
        semanticRunFile, semanticSummaryFile, path.join(semanticFolder, 'request.json'), semanticFile + '.chunks.jsonl']) freeze(file);
    const source = read(job.file), set = Array.isArray(source) ? source[0] : source;
    assert.equal(set.id, setId); if (Array.isArray(source)) assert.equal(source.length, 1);
    const selection = selectMismatchCases(set, semantic.cases, graded.grading.runs);
    for (const plan of selection.plans) { plan.prompt_hash = jsonHash(buildGradingPrompt(set, plan.answers)); plan.schema_hash = jsonHash(buildGradingResponseSchema(set, plan.answers)); }
    const stopFile = options['--stop-file'] ? resolve(options['--stop-file']) : run.stop_file ? resolve(run.stop_file) : null;
    if (stopFile) assert(run.stop_file && samePath(stopFile, run.stop_file), 'Use the original wave stop file');
    const guard = () => { assert.equal(gradingModelName(), manifest.model, 'Model changed'); for (const [file, value] of snapshots) assert.equal(hash(file), value, `Frozen input changed: ${relative(file)}`); };
    guard(); return { set, selection, manifest, output, stopFile, guard, snapshots, original: { manifest: relative(manifestFile), grading: relative(gradingFile), semantic: relative(semanticFile) } };
}
export async function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv), prepared = prepare(options);
    const { set, selection, manifest, output, stopFile, guard, snapshots, original } = prepared;
    if (options.dryRun) { console.log(JSON.stringify({ dry_run: true, set_id: set.id, worker: options['--worker'],
        original_mismatched_answers: selection.plans.length, original_generated_assertions: selection.cases.length,
        additional_observations: selection.plans.length * 2, api_calls: 0, preserved_files: snapshots.size })); return; }
    assert(!stopFile || !fs.existsSync(stopFile), 'Global stop file exists');
    fs.mkdirSync(output, { recursive: true });
    const write = (name, value) => fs.writeFileSync(path.join(output, name), serial(value), { flag: 'wx' });
    write('inputs.json', { version: 1, purpose: 'diagnostic_repeats_not_a_semantic_receipt', created_at: new Date().toISOString(),
        set_id: set.id, worker: options['--worker'], model: manifest.model, original, additional_observations: 2,
        selection, snapshots: [...snapshots].map(([file, sha256]) => ({ file: relative(file), sha256 })), mock: false });
    const results = []; let valid = 0;
    try {
        for (let observation = 2; observation <= 3; observation++) {
            guard(); assert(!stopFile || !fs.existsSync(stopFile), 'Global stop file exists');
            const result = await executeReviewGrading(set, selection.cases, { onRun(event) {
                guard(); verifyEventScope(event, selection.plans);
                fs.appendFileSync(path.join(output, 'observations.jsonl'), JSON.stringify({ observation,
                    execution_kind: event.id === 'empty-answer' ? 'production_empty_answer_no_model' : 'actual_model', ...event }) + '\n');
                if (event.status === 'completed' && event.id !== 'empty-answer') valid++;
                console.log(JSON.stringify({ set_id: set.id, observation, id: event.id, status: event.status, matched: event.matched }));
            } });
            guard();
            assert.deepEqual(result.runs.filter(run => run.id !== 'empty-answer').map(run => run.id), selection.plans.map(plan => plan.id));
            write(`observation-${observation}.json`, result); results.push(result);
        }
        write('summary.json', { status: 'completed_diagnostic_observations', set_id: set.id, original_observations: selection.plans.length,
            additional_valid_observations: valid, input_hashes_unchanged: true, formal_receipt_created: false,
            results: results.map(r => r.runs.map(run => ({ id: run.id, matched: run.matched, score: run.result.score }))) });
    } catch (error) {
        const detail = safeError(error), quota = /credit_balance_exhausted|insufficient_quota/.test(JSON.stringify(detail));
        write('interrupted.json', { status: 'stopped', error: detail, quota_exhausted: quota, additional_valid_observations: valid });
        if (quota && stopFile && !fs.existsSync(stopFile)) fs.writeFileSync(stopFile, 'Quota exhausted in generated-case diagnostic repeats.\n', { flag: 'wx' });
        console.error(JSON.stringify({ stopped: true, quota_exhausted: quota, error: detail })); process.exitCode = 1;
    }
}
if (process.argv[1] && samePath(process.argv[1], SELF)) await main();
