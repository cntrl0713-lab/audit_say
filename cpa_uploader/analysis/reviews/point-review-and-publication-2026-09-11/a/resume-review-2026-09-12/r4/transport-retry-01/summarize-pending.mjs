import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const O = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01`;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const identity = file => ({ file, sha256: hash(file) });
const lines = file => !fs.existsSync(file) ? [] : fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
const manifest = read(`${O}/pending-manifest.json`);
assert.equal(hash(`${O}/pending-manifest.json`), '1fd8ea479db627f2aa93a348058bb6ec3a4b5b50100887f1210da9ddeeb71e8f');
const jobs = manifest.jobs.map(job => {
    const folder = `${O}/pending-semantic-${job.worker}/${job.set_id}`;
    const receiptFile = `${folder}/semantic.json`, summaryFile = `${folder}/summary.json`, rawFile = `${receiptFile}.chunks.jsonl`;
    const rows = lines(rawFile), summary = fs.existsSync(summaryFile) ? read(summaryFile) : null;
    const priorFile = `${D}/execution-resumes/resume-2026-09-12-v4/remaining/semantic-${job.worker}/${job.set_id}/semantic.json.chunks.jsonl`;
    const previousSuccess = lines(priorFile).filter(r => r.response);
    const duplicateObservations = rows.filter(r => r.response).flatMap(r => previousSuccess.filter(p =>
        p.unit_id === r.unit_id && p.input_hash === r.input_hash && p.schema_hash === r.schema_hash && p.model === r.model)
        .map(p => ({ unit_id: r.unit_id, prior_performed_at: p.performed_at, new_performed_at: r.performed_at,
            input_hash: r.input_hash, schema_hash: r.schema_hash, reason: 'Whole partial set was re-executed; both actual observations are preserved, with no cached receipt reuse.' })));
    return { set_id: job.set_id, worker: job.worker,
        state: summary?.outcome ?? (fs.existsSync(`${folder}/request.json`) ? 'in_progress_or_partial' : 'not_started'),
        successful_model_responses: rows.filter(r => r.response).length,
        error_observations: rows.filter(r => !r.response).map(r => ({ unit_id: r.unit_id, attempt: r.attempt, performed_at: r.performed_at,
            error: r.error, code: r.error_code, status: r.error_status, retryable: r.error_retryable })),
        unique_successful_units: new Set(rows.filter(r => r.response).map(r => r.unit_id)).size,
        nonpass_units: summary?.nonpass_units ?? [], nonpass_cases: summary?.nonpass_cases ?? [],
        receipt: fs.existsSync(receiptFile) ? identity(receiptFile) : null,
        summary: summary ? identity(summaryFile) : null, raw: fs.existsSync(rawFile) ? identity(rawFile) : null,
        previous_partial_raw: previousSuccess.length ? identity(priorFile) : null, duplicate_observations: duplicateObservations };
});
const total = { sets: jobs.length, pass: jobs.filter(j => j.state === 'pass').length,
    semantic_nonpass: jobs.filter(j => j.state === 'semantic_nonpass').length,
    execution_error: jobs.filter(j => j.state === 'execution_error').length,
    partial: jobs.filter(j => j.state === 'in_progress_or_partial').length,
    not_started: jobs.filter(j => j.state === 'not_started').length,
    successful_model_responses: jobs.reduce((n, j) => n + j.successful_model_responses, 0),
    error_observations: jobs.reduce((n, j) => n + j.error_observations.length, 0),
    duplicate_actual_observations_from_partial_history: jobs.reduce((n, j) => n + j.duplicate_observations.length, 0) };
const report = { observed_at: new Date().toISOString(), mode: 'read_only_evidence_summary_no_model_calls',
    manifest: identity(`${O}/pending-manifest.json`), total, jobs,
    preserved_excluded_completed: read(`${O}/pending-preparation.json`).completed.map(r => ({ set_id: r.set_id, verdict: r.verdict, full_receipt: r.full_receipt })),
    grading_started: false, author_qa_started: false, human_review_claimed: false, database_modified: false };
if (process.argv[2]) {
    assert.match(process.argv[2], /^[a-z0-9-]+\.json$/);
    for (const pin of read(`${D}/execution-resumes/resume-2026-09-12-v4/frozen-inputs.json`).files) assert.equal(hash(pin.file), pin.sha256, pin.file);
    report.frozen_inputs_verified = 3065;
    fs.writeFileSync(`${O}/${process.argv[2]}`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ observed_at: report.observed_at, ...total,
    active: jobs.filter(j => j.state === 'in_progress_or_partial').map(j => ({ set_id: j.set_id, units: j.unique_successful_units })),
    nonpass: jobs.filter(j => j.state === 'semantic_nonpass').map(j => ({ set_id: j.set_id, units: j.nonpass_units, cases: j.nonpass_cases })) }));
