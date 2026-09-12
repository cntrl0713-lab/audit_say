import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const masterFile = `${base}/a/execution-all-v8/manifest.json`;
const output = `${base}/execution-resumes/resume-2026-09-12-v3`;
const qaOutput = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v3';
const previousOutput = `${base}/execution-resumes/resume-2026-09-12-v2`;
const runtimeFile = `${base}/execution-runtime-v6.json`;
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const identity = file => ({ file: file.replaceAll('\\', '/'), sha256: hash(file) });
const priorFreezeFile = `${previousOutput}/frozen-inputs.json`;
const smokeInputsFile = `${base}/b/learning-unit-smoke-v5-runtime-inputs.json`;
const pinned = [
    { file: masterFile, sha256: '0de5e7377689c31655dc020e234f3234b732cb9511ff74e11fccb44b137ce669' },
    { file: runtimeFile, sha256: '5965bfc11dd440298431c418585b335828a23b10ed56fdca6832e8728ed70ba7' },
    { file: priorFreezeFile, sha256: '1c13124fb8cb55e4b10990fda5cd8292aa7962c3b8b256e9e30e75b223d21413' },
    { file: smokeInputsFile, sha256: '8bd87a84ddb077653083a3c06542919a5dac46ab764ac53b6458d583031c8af7' },
    { file: `${base}/c/grade-preserved-semantic-v1.ts`, sha256: '767798beec8e4938e77ea75645786ef5cae2c1408cef3732e8f4978517494abb' },
];
for (const row of pinned) assert.equal(hash(row.file), row.sha256, `Pinned artifact changed: ${row.file}`);
const master = read(masterFile), runtime = read(runtimeFile);
assert(!fs.existsSync(output) && !fs.existsSync(qaOutput), 'Use unused execution and author-QA paths');
assert.equal(master.bank_sha256, '2867c39aead6225d2fdb46e1114a94abf323b275d48714e2c38dde12fb5d6f50');
assert.equal(master.jobs.length, 119);
assert.equal(master.jobs.reduce((n, job) => n + job.semantic_units, 0), 1393);
assert.equal(master.jobs.reduce((n, job) => n + job.author_qa_cases, 0), 6038);
const identities = new Map();
function verify(row) {
    const file = row.file.replaceAll('\\', '/');
    assert.equal(hash(file), row.sha256, `Frozen identity differs: ${file}`);
    const key = path.resolve(file).toLowerCase();
    if (identities.has(key)) assert.equal(identities.get(key).sha256, row.sha256, 'Conflicting identities');
    identities.set(key, { file, sha256: row.sha256 });
}
for (const row of pinned) verify(row);
const guard = () => { for (const row of identities.values()) assert.equal(hash(row.file), row.sha256, `Input changed during preparation: ${row.file}`); };
for (const row of [identity(masterFile), identity(runtimeFile), { file: master.bank_file, sha256: master.bank_sha256 },
    ...master.code_files, { file: master.preflight_file, sha256: master.preflight_sha256 },
    ...master.jobs.flatMap(job => [{ file: job.file, sha256: job.sha256 }, { file: job.plan_file, sha256: job.plan_sha256 },
        { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files])]) verify(row);
// The predecessor snapshot remains unchanged. Only declared changed files may
// differ at their live paths, and their old bytes must still exist separately.
const changed = [...runtime.changed_predecessor_files, ...runtime.policy_changes];
assert.deepEqual(changed.map(row => row.file).sort(), ['.agents/skills/audit-question-review/references/regression-cases.md', 'lib/questionV3Grading.ts']);
const priorRows = read(priorFreezeFile).files;
assert.equal(priorRows.length, 1730);
assert.equal(new Set(priorRows.map(row => path.resolve(row.file).toLowerCase())).size, 1730);
let changedCount = 0;
for (const row of priorRows) {
    if (hash(row.file) === row.sha256) verify(row);
    else {
        const declared = changed.find(item => path.resolve(item.file).toLowerCase() === path.resolve(row.file).toLowerCase());
        assert(declared && declared.before_sha256 === row.sha256 && declared.after_sha256 === hash(row.file), `Undeclared predecessor change: ${row.file}`);
        assert.equal(hash(declared.snapshot.file), row.sha256, 'Missing preserved predecessor bytes');
        verify(identity(row.file)); verify(declared.snapshot);
        changedCount++;
    }
}
assert.equal(changedCount, 2, 'Expected exactly the declared grader and review-guidance changes');
verify(identity(priorFreezeFile));
function collect(folder) {
    assert(fs.statSync(folder).isDirectory(), `Missing finalized input folder: ${folder}`);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const target = `${folder}/${entry.name}`;
        assert(!entry.isSymbolicLink(), 'Do not freeze through a symlink');
        if (entry.isDirectory()) collect(target);
        else if (entry.isFile()) verify(identity(target));
    }
}
for (const folder of [
    `${base}/a/execution-all-v8`, `${base}/a/canary-plan-followup-v1`, `${base}/b/canary-plan-followup-v1`,
    `${base}/c/canary-plan-followup-v1`, `${base}/b/learning-unit-smoke-v5`, `${base}/grading-inference-followup-v1`,
    `${base}/b/grading-inference-early-diagnostics-verification-v1`,
    `${base}/c/grade-preserved-semantic-fixtures-v1`,
    `${previousOutput}/canary`,
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v2/canary',
    'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/grading-inference-followup-v1',
]) collect(folder);
verify(identity(smokeInputsFile));
const smokeRows = read(smokeInputsFile).files;
assert.equal(smokeRows.length, 813);
assert.equal(new Set(smokeRows.map(row => path.resolve(row.file).toLowerCase())).size, 813);
for (const row of smokeRows) verify(row);
for (const file of [
    `${base}/prepare-runtime-v6.mjs`, `${base}/prepare-resume-v8.mjs`, `${base}/a/prepare-execution-v8.ts`,
    `${base}/b/run-learning-unit-smoke-v5.ts`, `${base}/c/grade-preserved-semantic-v1.ts`,
]) verify(identity(file));
const first = new Map([['pilot-01-002', 'a'], ['pilot-05-003', 'b'], ['pilot-03-001', 'c']]);
const waves = [];
guard();
for (const wave of ['canary', 'remaining']) {
    const jobs = master.jobs.filter(job => first.has(job.set_id) === (wave === 'canary'))
        .map(job => ({ ...job, worker: wave === 'canary' ? first.get(job.set_id) : job.worker }));
    const folder = `${output}/${wave}`;
    const manifest = { ...master, created_at: new Date().toISOString(),
        purpose: 'actual_verification_after_source_grounded_generated_case_and_grading_inference_followup',
        predecessor: identity(masterFile), resume_name: 'resume-2026-09-12-v3', jobs,
        workers: ['a', 'b', 'c'].map(id => ({ id, sets: jobs.filter(job => job.worker === id).length,
            units: jobs.filter(job => job.worker === id).reduce((n, job) => n + job.semantic_units, 0) })) };
    fs.mkdirSync(folder, { recursive: true });
    const file = `${folder}/manifest.json`;
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    verify(identity(file));
    waves.push({ wave, manifest: identity(file), output_directory: folder, stop_file: `${folder}/STOP`,
        sets: jobs.length, semantic_units: jobs.reduce((n, job) => n + job.semantic_units, 0) });
}
assert.equal(waves.reduce((n, wave) => n + wave.semantic_units, 0), 1393);
const resume = { version: 'question-verification-2026-09-12-resume-003', created_at: new Date().toISOString(),
    predecessor: identity(`${previousOutput}/resume.json`), master: identity(masterFile), runtime: identity(runtimeFile),
    bank: { file: master.bank_file, sha256: master.bank_sha256 }, model: master.model, review_model: master.review_model,
    max_concurrent_workers: 3, waves, author_qa_cases: 6038, author_qa_output_root: qaOutput,
    learning_smoke: identity(`${base}/b/learning-unit-smoke-v5/manifest.json`),
    canary_semantic_plan: {
        fresh_set_ids: ['pilot-05-003', 'pilot-03-001'],
        unchanged_semantic_candidate: { set_id: 'pilot-01-002', units: 11,
            receipt: identity(`${previousOutput}/canary/semantic-a/pilot-01-002/semantic.json`),
            condition: 'Use only after grade-preserved-semantic-v1 validates original model provenance and unchanged current semantic inputs. No earlier grading result is reused.' },
    },
    api_calls_at_preparation: 0, validation_completed: false,
};
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
write(`${output}/resume.json`, resume); verify(identity(`${output}/resume.json`));
guard();
write(`${output}/frozen-inputs.json`, { version: resume.version, created_at: new Date().toISOString(),
    predecessor: identity(priorFreezeFile), declared_changes: changed,
    api_calls_by_this_snapshot: 0, files: [...identities.values()].sort((a, b) => a.file.localeCompare(b.file, 'en')) });
guard();
console.log(JSON.stringify({ version: resume.version, frozen_files: identities.size, waves,
    frozen_snapshot: identity(`${output}/frozen-inputs.json`), api_calls: 0 }, null, 2));
