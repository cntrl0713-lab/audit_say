import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const own = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(own, '../../../../../..');
const d = path.resolve(own, '../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const identity = file => ({ file: rel(file), sha256: sha(file) });
const baseFile = path.join(d, 'execution-resumes/resume-2026-09-12-v4/remaining/manifest.json');
assert.equal(sha(baseFile), '4779c9882a4c54bda3b3e3344e5962a7e5508ea0b8482b868043eaca56ad4f2b');
const base = read(baseFile); const baseCanary = path.join(d, 'execution-resumes/resume-2026-09-12-v4/canary');
const done = new Set(read(path.join(baseCanary, 'manifest.json')).jobs.map(job => job.set_id));
const directories = [
  'execution-resumes/resume-2026-09-12-v4/remaining/semantic-a',
  'execution-resumes/resume-2026-09-12-v4/remaining/semantic-b',
  'execution-resumes/resume-2026-09-12-v4/remaining/semantic-c',
  'a/resume-review-2026-09-12/r4/transport-retry-01/semantic-a',
  'a/resume-review-2026-09-12/r4/transport-retry-01/pending-semantic-a',
];
const selected = new Map(), excluded = [], protectedInputs = new Map();
const codes = new Map();
const freeze = file => { const row = identity(file); protectedInputs.set(path.resolve(file).toLowerCase(), row); return row; };
const addCode = row => { const key = path.resolve(root, row.file).toLowerCase(); if (codes.has(key)) assert.equal(codes.get(key).sha256, row.sha256); else codes.set(key, row); };
base.code_files.forEach(addCode); freeze(baseFile);
for (const directory of directories) {
  const runDirectory = path.join(d, directory); const runFile = path.join(runDirectory, 'run.json');
  const run = read(runFile); const originalManifestFile = path.resolve(root, run.manifest_file); const origin = read(originalManifestFile);
  assert.equal(sha(originalManifestFile), run.manifest_sha256); assert.equal(origin.bank_sha256, base.bank_sha256);
  assert.equal(path.resolve(root, origin.bank_file), path.resolve(root, base.bank_file));
  assert.equal(origin.model, base.model); assert.equal(origin.review_model, base.review_model);
  assert.equal(origin.max_input_chars, base.max_input_chars);
  for (const oldJob of origin.jobs.filter(job => job.worker === run.worker)) {
    const folder = path.join(runDirectory, oldJob.set_id); const summaryFile = path.join(folder, 'summary.json');
    if (!fs.existsSync(summaryFile)) { excluded.push({ set_id: oldJob.set_id, origin: directory, reason: 'not_completed_at_snapshot' }); continue; }
    const summary = read(summaryFile);
    if (done.has(oldJob.set_id)) { excluded.push({ set_id: oldJob.set_id, origin: directory, reason: 'canary_previously_graded' }); continue; }
    if (summary.outcome !== 'pass' || summary.semantic_verdict !== 'pass' || summary.child_exit_code !== 0 || summary.guard_or_observer_error || summary.child_signal || summary.error) {
      excluded.push({ set_id: oldJob.set_id, origin: directory, reason: summary.outcome, verdict: summary.semantic_verdict ?? null }); continue;
    }
    const receiptFile = path.join(folder, 'semantic.json'); const receipt = read(receiptFile).reviews[0];
    assert.equal(summary.receipt_sha256, sha(receiptFile)); assert.equal(receipt.set_id, oldJob.set_id);
    assert.equal(receipt.verdict, 'pass'); assert.equal(receipt.execution.transport, 'model'); assert.equal(receipt.grading.status, 'not_run');
    assert(receipt.units.every(u => Object.values(u.checks).every(v => v === 'pass'))); assert(receipt.cases.every(c => c.verdict === 'pass'));
    if (selected.has(oldJob.set_id)) { excluded.push({ set_id: oldJob.set_id, origin: directory, reason: 'duplicate_complete_pass_not_repeated' }); continue; }
    origin.code_files.forEach(addCode);
    const requestFile = path.join(folder, 'request.json');
    const provenance = { manifest_file: rel(originalManifestFile), manifest_sha256: sha(originalManifestFile), worker: run.worker,
      run_directory: rel(runDirectory), receipt_file: rel(receiptFile), receipt_sha256: sha(receiptFile),
      run_sha256: sha(runFile), summary_sha256: sha(summaryFile), request_sha256: sha(requestFile) };
    for (const file of [originalManifestFile, runFile, summaryFile, requestFile, receiptFile]) freeze(file);
    selected.set(oldJob.set_id, { job: { ...oldJob, worker: 'b', semantic_provenance: provenance }, completed_at: summary.finished_at,
      semantic_units: receipt.units.length, generated_assertions: receipt.cases.length, author_qa_cases: read(path.resolve(root, oldJob.qa_file)).cases.length });
  }
}
assert(selected.size > 0);
addCode(identity(fileURLToPath(import.meta.url)));
const ordered = [...selected.values()].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
const manifest = { version: 1, created_at: new Date().toISOString(), purpose: 'R4 completed semantic pass snapshot; generated grading then author QA; originals unchanged',
  predecessor: identity(baseFile), bank_file: base.bank_file, bank_sha256: base.bank_sha256, model: base.model, review_model: base.review_model,
  max_input_chars: base.max_input_chars, code_files: [...codes.values()], jobs: ordered.map(x => x.job) };
for (const row of [{ file: manifest.bank_file, sha256: manifest.bank_sha256 }, ...manifest.code_files,
  ...manifest.jobs.flatMap(job => [{ file: job.file, sha256: job.sha256 }, { file: job.plan_file, sha256: job.plan_sha256 }, { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files])]) {
  assert.equal(sha(path.resolve(root, row.file)), row.sha256, row.file); freeze(path.resolve(root, row.file));
}
for (const row of protectedInputs.values()) assert.equal(sha(path.resolve(root, row.file)), row.sha256);
const output = path.join(own, 'manifest.json'); fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(own, 'selection.json'), JSON.stringify({ created_at: manifest.created_at, manifest: identity(output),
  selected: ordered.map(({ job, ...row }) => ({ set_id: job.set_id, original_worker: job.semantic_provenance.worker, ...row })),
  totals: { sets: ordered.length, semantic_units: ordered.reduce((n, r) => n + r.semantic_units, 0), generated_assertions: ordered.reduce((n, r) => n + r.generated_assertions, 0), author_qa_cases: ordered.reduce((n, r) => n + r.author_qa_cases, 0) },
  excluded, canary_already_graded: [...done], protected_inputs: [...protectedInputs.values()], api_calls_during_preparation: 0,
  note: 'Only the listed completed set summaries are selected. Active parent runs may complete more sets later; those need another wave.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ manifest_sha256: sha(output), selected: ordered.map(r => r.job.set_id), sets: ordered.length, generated_assertions: ordered.reduce((n, r) => n + r.generated_assertions, 0), author_qa_cases: ordered.reduce((n, r) => n + r.author_qa_cases, 0) }));
