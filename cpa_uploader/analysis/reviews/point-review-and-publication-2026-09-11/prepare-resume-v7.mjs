import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const masterFile = `${base}/a/execution-all-v7/manifest.json`;
const output = `${base}/execution-resumes/resume-2026-09-12-v2`;
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
assert(!fs.existsSync(output), 'Use a new execution directory');
const master = read(masterFile), identities = new Map();
for (const row of [{ file: master.bank_file, sha256: master.bank_sha256 }, ...master.code_files,
    { file: master.preflight_file, sha256: master.preflight_sha256 },
    ...master.jobs.flatMap(job => [{ file: job.file, sha256: job.sha256 },
        { file: job.plan_file, sha256: job.plan_sha256 }, { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files])]) {
    if (identities.has(row.file)) assert.equal(identities.get(row.file), row.sha256);
    assert.equal(hash(row.file), row.sha256, row.file); identities.set(row.file, row.sha256);
}
const first = new Map([['pilot-01-002', 'a'], ['pilot-05-003', 'b'], ['pilot-03-001', 'c']]);
const allIds = new Set(master.jobs.map(job => job.set_id));
assert.equal(allIds.size, 119);
for (const id of first.keys()) assert(allIds.has(id));
const waves = [];
for (const wave of ['canary', 'remaining']) {
    const jobs = master.jobs.filter(job => first.has(job.set_id) === (wave === 'canary'))
        .map(job => ({ ...job, worker: wave === 'canary' ? first.get(job.set_id) : job.worker }));
    const folder = `${output}/${wave}`;
    const manifest = { ...master, created_at: new Date().toISOString(),
        purpose: 'actual_verification_after_preserving_canonical_notes_and_clarifying_scope',
        predecessor: { file: masterFile, sha256: hash(masterFile) }, resume_name: 'resume-2026-09-12-v2',
        prior_execution_reused_as_completion: false, jobs,
        workers: ['a', 'b', 'c'].map(id => ({ id, sets: jobs.filter(job => job.worker === id).length,
            units: jobs.filter(job => job.worker === id).reduce((n, job) => n + job.semantic_units, 0) })) };
    fs.mkdirSync(folder, { recursive: true });
    const file = `${folder}/manifest.json`;
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    waves.push({ wave, manifest_file: file, manifest_sha256: hash(file), output_directory: folder,
        stop_file: `${folder}/STOP`, sets: jobs.length, semantic_units: jobs.reduce((n, job) => n + job.semantic_units, 0) });
}
assert.equal(waves.reduce((n, wave) => n + wave.semantic_units, 0), 1393);
const resume = { version: 'question-verification-2026-09-12-resume-002', created_at: new Date().toISOString(),
    predecessor: `${base}/verification-handoff-001.json`, master: { file: masterFile, sha256: hash(masterFile) },
    bank: { file: master.bank_file, sha256: master.bank_sha256 }, checked_identities: identities.size,
    max_concurrent_workers: 3, model: master.model, review_model: master.review_model,
    api_calls_at_preparation: 0, execution_started_at_preparation: false, waves,
    author_qa_output_root: 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v2',
    prior_observations: 'handoff-001 canary: 30 model responses, two passed sets and one uncertain set; preserved as previous-version evidence, no grading performed.' };
fs.writeFileSync(`${output}/resume.json`, JSON.stringify(resume, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(resume, null, 2));
