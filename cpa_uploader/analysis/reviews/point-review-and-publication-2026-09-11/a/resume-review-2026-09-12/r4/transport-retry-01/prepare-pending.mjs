import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const R = `${D}/execution-resumes/resume-2026-09-12-v4`;
const O = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01`;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const id = file => ({ file, sha256: hash(file) });
const verify = row => assert.equal(hash(row.file), row.sha256, row.file);
const parent = { file: `${R}/remaining/manifest.json`, sha256: '4779c9882a4c54bda3b3e3344e5962a7e5508ea0b8482b868043eaca56ad4f2b' };
verify(parent); const previous = read(parent.file), frozen = read(`${R}/frozen-inputs.json`); frozen.files.forEach(verify);
assert.equal(hash(`${R}/frozen-inputs.json`), '2d037253d8fc7955906f141014a9e3a1caf5b47e65dad436d940b7abc181deef');
const completed = [], partial = [], inputs = [parent, id(`${R}/frozen-inputs.json`)];
const state = [];
const collect = folder => fs.existsSync(folder) ? fs.readdirSync(folder, { withFileTypes: true }).filter(e => e.isFile()).map(e => id(`${folder}/${e.name}`)) : [];
for (const job of previous.jobs) {
    const original = `${R}/remaining/semantic-${job.worker}/${job.set_id}`;
    const actual = job.set_id === 'pilot-05-001' ? `${O}/semantic-a/${job.set_id}` : original;
    const summaryFile = `${actual}/summary.json`, receiptFile = `${actual}/semantic.json`;
    const summary = fs.existsSync(summaryFile) ? read(summaryFile) : null;
    state.push({ file: receiptFile, exists: fs.existsSync(receiptFile) });
    if (summary && ['pass', 'semantic_nonpass'].includes(summary.outcome)) {
        assert(fs.existsSync(receiptFile)); assert.equal(hash(receiptFile), summary.receipt_sha256);
        assert.equal(summary.input_sha256, job.sha256);
        const receipt = read(receiptFile).reviews[0];
        assert.equal(receipt.set_id, job.set_id); assert.equal(receipt.execution.model, previous.review_model);
        assert.equal(receipt.execution.transport, 'model'); assert.equal(receipt.units.length, job.semantic_units);
        const request = read(`${actual}/request.json`);
        assert.equal(request.manifest_sha256, job.set_id === 'pilot-05-001' ? hash(`${O}/manifest.json`) : parent.sha256);
        for (const row of request.frozen_files) verify(row);
        const evidence = collect(actual); inputs.push(...evidence);
        completed.push({ set_id: job.set_id, worker: job.worker, verdict: receipt.verdict, semantic_units: job.semantic_units,
            full_receipt: id(receiptFile), evidence, reason: 'Full current-bank model receipt exists; nonpass remains nonpass for separate followup.' });
    }
    const oldEvidence = collect(original);
    if (oldEvidence.length && (actual !== original || !completed.some(c => c.set_id === job.set_id))) {
        const chunkFile = `${original}/semantic.json.chunks.jsonl`;
        const rows = fs.existsSync(chunkFile) ? fs.readFileSync(chunkFile, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
        inputs.push(...oldEvidence);
        partial.push({ set_id: job.set_id, worker: job.worker, evidence: oldEvidence,
            previous_successful_unit_ids: [...new Set(rows.filter(x => x.response && !x.error).map(x => x.unit_id))],
            previous_successful_responses: rows.filter(x => x.response).length,
            previous_errors: rows.filter(x => x.error).map(x => ({ unit_id: x.unit_id, attempt: x.attempt, code: x.error_code, status: x.error_status })),
            fresh_full_set_required_if_pending: true, reuse_partial_responses: false });
    }
}
const done = new Set(completed.map(x => x.set_id)), jobs = previous.jobs.filter(j => !done.has(j.set_id));
assert.equal(done.size, 11); assert.equal(jobs.length, 105);
assert.deepEqual(['a', 'b', 'c'].map(w => jobs.filter(j => j.worker === w).length), [35, 36, 34]);
assert.equal(completed.filter(c => c.verdict !== 'pass').length, 1);
assert.equal(completed.find(c => c.verdict !== 'pass').set_id, 'pilot-02-004');
assert.equal(new Set([...jobs.map(j => j.set_id), ...done]).size, previous.jobs.length);
for (const j of jobs) { assert.deepEqual(j, previous.jobs.find(x => x.set_id === j.set_id)); assert(!j.semantic_provenance); }
inputs.forEach(verify); frozen.files.forEach(verify);
for (const row of state) assert.equal(fs.existsSync(row.file), row.exists, 'Completion state changed during preparation');
const write = (name, x) => fs.writeFileSync(`${O}/${name}`, JSON.stringify(x, null, 2) + '\n', { flag: 'wx' });
const workers = ['a', 'b', 'c'].map(worker => ({ id: worker, sets: jobs.filter(j => j.worker === worker).length,
    units: jobs.filter(j => j.worker === worker).reduce((n, j) => n + j.semantic_units, 0) }));
const manifest = { ...previous, created_at: new Date().toISOString(), purpose: 'pending105_fresh_semantic_single_stream_original_worker_labels',
    predecessor: parent, jobs, workers, scheduling: { maximum_actual_streams: 1, order: ['a', 'b', 'c'],
        stop_on_execution_error: true, additional_cli_retry: false, grading_and_author_qa_authorized_here: false },
    completion_exclusions: completed.map(c => ({ set_id: c.set_id, verdict: c.verdict, receipt: c.full_receipt })),
    original_partial_history: partial, partial_cache_reuse: false };
write('pending-manifest.json', manifest);
write('pending-preparation.json', { created_at: new Date().toISOString(), api_calls: 0, manifest: id(`${O}/pending-manifest.json`),
    parent, preparation_tool: id(`${O}/prepare-pending.mjs`), completed, partial, workers, total_sets: jobs.length,
    semantic_units: jobs.reduce((n, j) => n + j.semantic_units, 0), bank_code_jobs_unchanged: true,
    full_receipts_preserved: 11, uncertain_for_separate_followup: ['pilot-02-004'], frozen_inputs: frozen.files.length, inputs, observed_receipt_state: state });
console.log(JSON.stringify({ manifest: id(`${O}/pending-manifest.json`), workers, total: jobs.length }));
