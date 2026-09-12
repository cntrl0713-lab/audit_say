// Exact original generated answers, two additional observations only. No receipt mutation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { executeReviewGrading } from '../../../../../cpa_uploader/questionReviewGrading.ts';
import { jsonHash } from '../../../../../cpa_uploader/questionReviewIdentity.ts';
import { buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../../../lib/questionV3Grading.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const wave = `${base}/execution-resumes/resume-2026-09-12-v2/canary`;
const manifestFile = `${wave}/manifest.json`;
const semanticFile = `${wave}/semantic-b/pilot-05-003/semantic.json`;
const gradingFile = `${wave}/grading-b/pilot-05-003/grading.json`;
const output = path.resolve(root, `${wave}/grading-b/pilot-05-003/mismatch-followup-v1`);
const dryRun = process.argv.length === 3 && process.argv[2] === '--dry-run';
assert(process.argv.length === 2 || dryRun, 'Only --dry-run is supported');
const hash = file => createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
const snapshots = new Map();
function freeze(file, expected) {
    const actual = hash(file);
    if (expected) assert.equal(actual, expected, `Frozen file mismatch: ${file}`);
    snapshots.set(file, actual);
}
freeze(manifestFile, '9fab5fb3effbb1fa1838de75ea5c5118c2fbda3df41278a51fc1bd5d055cb62d');
const manifest = read(manifestFile);
const job = manifest.jobs.find(row => row.worker === 'b' && row.set_id === 'pilot-05-003');
assert(job);
for (const row of [{ file: manifest.bank_file, sha256: manifest.bank_sha256 }, ...manifest.code_files,
    { file: job.file, sha256: job.sha256 }, ...(job.plan_file ? [{ file: job.plan_file, sha256: job.plan_sha256 }] : []), ...job.source_files]) freeze(row.file, row.sha256);
for (const file of [semanticFile, gradingFile, `${wave}/semantic-b/run.json`, `${wave}/grading-b/run.json`,
    `${wave}/semantic-b/pilot-05-003/summary.json`, `${wave}/grading-b/pilot-05-003/summary.json`, fileURLToPath(import.meta.url)]) freeze(file);
const semantic = read(semanticFile).reviews[0], graded = read(gradingFile).reviews[0];
const originalSummary = read(`${wave}/grading-b/pilot-05-003/summary.json`);
assert.equal(originalSummary.receipt_sha256, hash(gradingFile));
assert.equal(originalSummary.input_sha256, job.sha256);
for (const phase of ['semantic', 'grading']) {
    const run = read(`${wave}/${phase}-b/run.json`);
    assert.equal(run.manifest_sha256, hash(manifestFile));
    assert.equal(run.worker, 'b'); assert.equal(run.mock, false);
}
assert.equal(semantic.verdict, 'pass');
assert.equal(semantic.execution.transport, 'model');
assert.equal(semantic.execution.model, manifest.review_model);
assert.equal(graded.grading.status, 'completed');
assert.equal(graded.grading.transport, 'model');
assert.equal(graded.grading.model, manifest.model);
assert.equal(semantic.content_hash, graded.content_hash);
assert.equal(semantic.bank_hash, graded.bank_hash);
assert.deepEqual(semantic.cases, graded.cases);
const raw = read(job.file), set = Array.isArray(raw) ? raw[0] : raw;
assert.equal(set.id, job.set_id);
const originalMismatches = graded.grading.runs.filter(run => !run.matched);
assert(originalMismatches.length > 0, 'Do not repeat an all-matched run');
assert(originalMismatches.every(run => run.id !== 'empty-answer'));
function answersFor(sample) {
    const sub = set.subquestions.find(q => q.criteria.some(c => `criterion:${q.id}:${c.id}` === sample.unit_id));
    assert(sub);
    return Object.fromEntries(set.subquestions.map(q => [q.id, q.id === sub.id ? sample.answer : '']));
}
const selectedCases = semantic.cases.filter(sample => originalMismatches.some(run => run.id === jsonHash(answersFor(sample))));
for (const run of originalMismatches) {
    const samples = selectedCases.filter(sample => jsonHash(answersFor(sample)) === run.id);
    assert(samples.length);
    assert.deepEqual(answersFor(samples[0]), run.answers);
    assert.deepEqual(samples.map(sample => {
        const [ , subquestion_id, criterion_id] = sample.unit_id.split(':');
        return { unit_id: sample.unit_id, case_kind: sample.kind, subquestion_id, criterion_id, verdict: sample.expected };
    }), run.expected);
}
function guard() {
    assert.equal(gradingModelName(), manifest.model, 'Grading model changed');
    for (const [file, value] of snapshots) assert.equal(hash(file), value, `Frozen input changed: ${file}`);
}
guard();
const input = { version: 1, manifest_file: manifestFile, original_semantic: semanticFile, original_grading: gradingFile,
    set_id: set.id, model: manifest.model, transport: 'production_executeReviewGrading', mock: false,
    additional_observations: 2, original_mismatches: originalMismatches.map(run => ({ id: run.id, answers: run.answers, expected: run.expected,
        prompt_hash: jsonHash(buildGradingPrompt(set, run.answers)), schema_hash: jsonHash(buildGradingResponseSchema(set, run.answers)) })),
    selected_cases: selectedCases, snapshots: Object.fromEntries(snapshots) };
if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, mismatched_original_answers: originalMismatches.length,
        selected_generated_assertions: selectedCases.length, additional_model_observations: originalMismatches.length * 2, api_calls: 0 }));
} else {
    assert(!fs.existsSync(output), 'New output directory required');
    assert(!fs.existsSync(path.resolve(root, `${wave}/STOP`)), 'Global stop file exists');
    fs.mkdirSync(output);
    const write = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    write('inputs.json', input);
    const results = [];
    try {
        for (let observation = 2; observation <= 3; observation++) {
            guard(); assert(!fs.existsSync(path.resolve(root, `${wave}/STOP`)), 'Global stop file exists');
            const result = await executeReviewGrading(set, selectedCases, { onRun(event) {
                guard();
                // Production empty-answer branch is explicitly distinguished from real observations.
                fs.appendFileSync(path.join(output, 'observations.jsonl'), JSON.stringify({ observation,
                    execution_kind: event.id === 'empty-answer' ? 'production_empty_answer_no_model' : 'actual_model', ...event }) + '\n');
                console.log(JSON.stringify({ observation, id: event.id, status: event.status, matched: event.matched }));
            } });
            guard(); write(`observation-${observation}.json`, result); results.push(result);
        }
        write('summary.json', { status: 'completed', original_answers: originalMismatches.length, original_observations: originalMismatches.length,
            additional_valid_observations: results.flatMap(r => r.runs).filter(r => r.id !== 'empty-answer').length,
            results: results.map(r => r.runs.map(run => ({ id: run.id, matched: run.matched, score: run.result.score }))), input_hashes_unchanged: true });
    } catch (error) {
        const safe = (value, depth = 0) => ({ name: value?.name, code: value?.code, status: value?.status, retryable: value?.retryable,
            ...(depth < 4 && value?.cause ? { cause: safe(value.cause, depth + 1) } : {}) });
        const detail = safe(error);
        const quota = /credit_balance_exhausted|insufficient_quota/.test(JSON.stringify(detail));
        write('interrupted.json', { status: 'stopped', error: detail, quota_exhausted: quota, completed_observation_groups: results.length });
        if (quota && !fs.existsSync(path.resolve(root, `${wave}/STOP`))) fs.writeFileSync(path.resolve(root, `${wave}/STOP`), 'Quota exhausted in B generated-case followup.\n', { flag: 'wx' });
        console.error(JSON.stringify({ stopped: true, quota_exhausted: quota, error: detail })); process.exitCode = 1;
    }
}
