import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const R = `${D}/execution-resumes/resume-2026-09-12-v4`;
const out = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const id = file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
const verify = row => assert.equal(id(row.file).sha256, row.sha256, row.file);
const parent = { file: `${R}/remaining/manifest.json`, sha256: '4779c9882a4c54bda3b3e3344e5962a7e5508ea0b8482b868043eaca56ad4f2b' };
const freeze = { file: `${R}/frozen-inputs.json`, sha256: '2d037253d8fc7955906f141014a9e3a1caf5b47e65dad436d940b7abc181deef' };
verify(parent); verify(freeze); const old = read(parent.file), rows = read(freeze.file).files;
rows.forEach(verify); assert.equal(rows.length, 3065);
assert(!fs.existsSync(`${out}/manifest.json`) && !fs.existsSync(`${out}/semantic-a`));
const job = old.jobs.find(j => j.set_id === 'pilot-05-001'); assert(job); assert.equal(job.worker, 'a');
assert(!job.semantic_provenance); assert.equal(old.model, 'gpt-5.6-luna'); assert.equal(old.review_model, 'gpt-5.6-luna');
assert.equal(old.max_input_chars, 500000);
const partial = `${R}/remaining/semantic-a/pilot-05-001`;
const chunks = fs.readFileSync(`${partial}/semantic.json.chunks.jsonl`, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
assert.equal(chunks.filter(x => x.response && !x.error).length, 1);
assert.equal(chunks.filter(x => x.error_status === 429).length, 2);
assert(!fs.existsSync(`${partial}/semantic.json`));
const history = ['request.json', 'summary.json', 'semantic.json.chunks.jsonl', 'stdout.log', 'stderr.log'].map(n => id(`${partial}/${n}`));
const manifest = { ...old, created_at: new Date().toISOString(), purpose: 'single_set_transport_followup_full_fresh_semantic',
    predecessor: parent, jobs: [job], workers: [{ id: 'a', sets: 1, units: job.semantic_units }],
    retry_boundary: { previous_partial: history, original_success_units: 1, original_http429_observations: 2,
        semantic_receipts_reused: 0, cached_unit_reuse: 0, full_set_reexecuted: true, duplicate_success_units_expected: 1,
        attempts: 'Exactly one new production CLI invocation. Existing per-unit max2 protocol attempts unchanged. No further CLI retry on repeated429.' } };
assert.deepEqual(manifest.jobs[0], job); assert.deepEqual(manifest.code_files, old.code_files);
rows.forEach(verify); history.forEach(verify);
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
const report = { created_at: new Date().toISOString(), api_calls: 0, preparation_tool: id(`${out}/prepare.mjs`), manifest: id(`${out}/manifest.json`),
    parent, freeze, frozen_inputs_verified: rows.length, job_unchanged: true, runtime_and_bank_unchanged: true,
    previous_partial: history, planned_sets: 1, planned_semantic_units: job.semantic_units, output: `${out}/semantic-a`, stop_file: `${out}/STOP` };
fs.writeFileSync(`${out}/preparation.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
