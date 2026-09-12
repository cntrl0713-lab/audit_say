import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const configurationFile = `${base}/prepare-resume-v9-inputs.json`;
const output = `${base}/execution-resumes/resume-2026-09-12-v4`;
const qaOutput = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4';
const previousOutput = `${base}/execution-resumes/resume-2026-09-12-v3`;
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const identity = file => ({ file: file.replaceAll('\\', '/'), sha256: hash(file) });
const configurationBytes = fs.readFileSync(configurationFile);
const configuration = JSON.parse(configurationBytes.toString('utf8').replace(/^\uFEFF/, ''));
assert.equal(configuration.ready, true);
assert.equal(configuration.api_processes_stopped, true);
assert(!fs.existsSync(output) && !fs.existsSync(qaOutput), 'New execution and QA paths are required');
const identities = new Map();
function verify(row) {
    const file = row.file.replaceAll('\\', '/');
    assert.equal(hash(file), row.sha256, `Input changed: ${file}`);
    const key = path.resolve(file).toLowerCase();
    if (identities.has(key)) assert.equal(identities.get(key).sha256, row.sha256, `Conflicting identities: ${file}`);
    identities.set(key, { file, sha256: row.sha256 });
}
const folderInventories = new Map();
const inventory = folder => fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), 'Do not freeze through a link');
    const file = `${folder}/${entry.name}`;
    return entry.isDirectory() ? [file + '/', ...inventory(file)] : [file];
}).sort();
const guard = () => {
    for (const row of identities.values()) assert.equal(hash(row.file), row.sha256, `Input changed during preparation: ${row.file}`);
    for (const [folder, files] of folderInventories) assert.deepEqual(inventory(folder), files, `Folder contents changed: ${folder}`);
};
verify({ file: configurationFile, sha256: createHash('sha256').update(configurationBytes).digest('hex') });
for (const row of configuration.pinned) verify(row);
assert(configuration.pinned.some(row => row.file === `${base}/prepare-resume-v9.mjs`), 'Pin this preparer before execution');
const masterPin = configuration.pinned.find(row => row.file === `${base}/a/execution-all-v9/manifest.json`);
const runtimePin = configuration.pinned.find(row => row.file === `${base}/execution-runtime-v7.json`);
const smokeInputPin = configuration.pinned.find(row => row.file === `${base}/b/learning-unit-smoke-v6-runtime-inputs.json`);
assert(masterPin && runtimePin && smokeInputPin, 'Missing finalized master/runtime/smoke identity');
assert.equal(runtimePin.sha256, '17e99d1dff7f6ecaba48658796788be0b1f47b03364cc23c348932474d18a250');
const master = read(masterPin.file), runtime = read(runtimePin.file);
assert.equal(master.bank_sha256, '11618f57625ae6ec71630f6413411ad513291674573e4eb0f028d129c0eab90b');
assert.equal(master.jobs.length, 119);
assert.equal(new Set(master.jobs.map(job => job.set_id)).size, 119);
assert.equal(master.jobs.reduce((n, job) => n + job.semantic_units, 0), 1393);
assert.equal(master.jobs.reduce((n, job) => n + job.author_qa_cases, 0), 6040);
assert(master.jobs.every(job => !job.semantic_provenance), 'Fresh semantic execution cannot include prior provenance');
for (const row of [{ file: master.bank_file, sha256: master.bank_sha256 }, ...master.code_files,
    { file: master.preflight_file, sha256: master.preflight_sha256 },
    ...master.jobs.flatMap(job => [{ file: job.file, sha256: job.sha256 }, { file: job.plan_file, sha256: job.plan_sha256 },
        { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files])]) verify(row);

const priorFreezeFile = `${previousOutput}/frozen-inputs.json`;
assert.equal(hash(priorFreezeFile), '584c45bbc0175cdcddbaebe231027d69170ae345227398e03c4420da03b8cb03');
verify(identity(priorFreezeFile));
const priorRows = read(priorFreezeFile).files;
assert.equal(priorRows.length, 2353);
assert.equal(new Set(priorRows.map(row => path.resolve(row.file).toLowerCase())).size, 2353);
const changed = [...runtime.changed_predecessor_files, ...runtime.policy_changes];
assert.deepEqual(changed.map(row => row.file).sort(), ['.agents/skills/audit-question-review/references/regression-cases.md', 'cpa_uploader/questionSemanticReview.ts', 'lib/questionV3Grading.ts']);
let changedCount = 0;
for (const row of priorRows) {
    if (hash(row.file) === row.sha256) verify(row);
    else {
        const declared = changed.find(item => path.resolve(item.file).toLowerCase() === path.resolve(row.file).toLowerCase());
        assert(declared && declared.before_sha256 === row.sha256 && declared.after_sha256 === hash(row.file), `Undeclared predecessor change: ${row.file}`);
        assert.equal(declared.snapshot.sha256, row.sha256);
        verify(declared.snapshot); verify(identity(row.file)); changedCount++;
    }
}
assert.equal(changedCount, 3);
function collect(folder) {
    assert(fs.statSync(folder).isDirectory(), `Missing finalized folder: ${folder}`);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const target = `${folder}/${entry.name}`;
        assert(!entry.isSymbolicLink(), 'Do not freeze through a link');
        if (entry.isDirectory()) collect(target);
        else if (entry.isFile()) verify(identity(target));
    }
}
for (const folder of configuration.finalized_folders) {
    folderInventories.set(folder, inventory(folder));
    collect(folder);
}
const smokeRows = read(smokeInputPin.file).files;
assert.equal(smokeRows.length, configuration.smoke_frozen_files);
assert.equal(new Set(smokeRows.map(row => path.resolve(row.file).toLowerCase())).size, smokeRows.length);
for (const row of smokeRows) verify(row);
for (const file of [`${base}/prepare-runtime-v7.mjs`, `${base}/prepare-resume-v9.mjs`, `${base}/a/prepare-execution-v9.ts`, `${base}/b/run-learning-unit-smoke-v6.ts`]) verify(identity(file));
const first = new Map([['pilot-01-002', 'a'], ['pilot-05-003', 'b'], ['pilot-03-001', 'c']]);
const canaryJobs = master.jobs.filter(job => first.has(job.set_id));
assert.equal(canaryJobs.length, 3);
assert.equal(canaryJobs.reduce((n, job) => n + job.semantic_units, 0), 30);
assert.equal(canaryJobs.reduce((n, job) => n + job.author_qa_cases, 0), 94);
assert.equal(master.jobs.filter(job => !first.has(job.set_id)).length, 116);
const waves = [];
guard();
fs.mkdirSync(output);
for (const wave of ['canary', 'remaining']) {
    const jobs = master.jobs.filter(job => first.has(job.set_id) === (wave === 'canary'))
        .map(job => ({ ...job, worker: wave === 'canary' ? first.get(job.set_id) : job.worker }));
    const folder = `${output}/${wave}`;
    const manifest = { ...master, created_at: new Date().toISOString(), purpose: 'actual_verification_after_direct_source_and_evidence_followup',
        predecessor: identity(masterPin.file), resume_name: 'resume-2026-09-12-v4', jobs,
        workers: ['a', 'b', 'c'].map(id => ({ id, sets: jobs.filter(job => job.worker === id).length,
            units: jobs.filter(job => job.worker === id).reduce((n, job) => n + job.semantic_units, 0) })) };
    fs.mkdirSync(folder);
    const file = `${folder}/manifest.json`;
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    verify(identity(file));
    waves.push({ wave, manifest: identity(file), output_directory: folder, stop_file: `${folder}/STOP`, sets: jobs.length,
        semantic_units: jobs.reduce((n, job) => n + job.semantic_units, 0) });
}
assert.equal(waves.reduce((n, wave) => n + wave.semantic_units, 0), 1393);
const resume = { version: 'question-verification-2026-09-12-resume-004', created_at: new Date().toISOString(),
    predecessor: identity(`${previousOutput}/resume.json`), master: masterPin, runtime: runtimePin,
    bank: { file: master.bank_file, sha256: master.bank_sha256 }, model: master.model, review_model: master.review_model,
    max_concurrent_workers: 3, waves, author_qa_cases: 6040, author_qa_output_root: qaOutput,
    learning_smoke: identity(`${base}/b/learning-unit-smoke-v6/manifest.json`),
    canary_semantic_plan: { fresh_set_ids: [...first.keys()], reason: 'New bank and semantic instructions; no prior semantic pass transfer' },
    author_qa_policy: 'All 94 canary cases require fresh actual grading. Earlier 92 cases remain historical evidence.',
    api_calls_at_preparation: 0, validation_completed: false };
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
write(`${output}/resume.json`, resume); verify(identity(`${output}/resume.json`));
guard();
write(`${output}/frozen-inputs.json`, { version: resume.version, created_at: new Date().toISOString(), predecessor: identity(priorFreezeFile),
    declared_changes: changed, api_calls_by_this_snapshot: 0, files: [...identities.values()].sort((a, b) => a.file.localeCompare(b.file, 'en')) });
guard();
console.log(JSON.stringify({ version: resume.version, frozen_files: identities.size, waves, frozen_snapshot: identity(`${output}/frozen-inputs.json`), api_calls: 0 }, null, 2));
