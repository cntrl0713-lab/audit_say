import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const O = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01`;
const manifestFile = `${O}/pending-manifest.json`, expectedManifest = '1fd8ea479db627f2aa93a348058bb6ec3a4b5b50100887f1210da9ddeeb71e8f';
const runner = `${D}/b/validation-worker-v3.mjs`, stop = `${O}/PENDING_STOP`;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const id = file => ({ file, sha256: hash(file) });
const write = (name, value) => fs.writeFileSync(`${O}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
assert.deepEqual(process.argv.slice(2).filter(x => ['--dry-run', '--execute'].includes(x)), process.argv.slice(2));
assert.equal(process.argv.length, 3); const dry = process.argv[2] === '--dry-run';
const manifest = read(manifestFile), preparation = read(`${O}/pending-preparation.json`);
assert.equal(preparation.manifest.sha256, expectedManifest);
const self = id(fileURLToPath(import.meta.url)), pins = [self, id(`${O}/pending-preparation.json`), { file: manifestFile, sha256: expectedManifest },
    { file: runner, sha256: 'c3c6aa47085eae4f9aac7502ed1a7523f8d2ef84c59e486f498a1537dcad2926' },
    ...read(`${D}/execution-resumes/resume-2026-09-12-v4/frozen-inputs.json`).files, ...preparation.inputs];
const guard = () => {
    for (const row of pins) assert.equal(hash(row.file), row.sha256, row.file);
    assert.equal(process.env.CPA_GRADING_MODEL, 'gpt-5.6-luna'); assert.equal(process.env.CPA_REVIEW_MODEL, 'gpt-5.6-luna');
    assert.equal(process.env.CPA_REVIEW_INPUT_MAX_CHARS, '500000');
};
guard(); assert.equal(manifest.jobs.length, 105);
const argsFor = worker => [runner, '--manifest', manifestFile, '--worker', worker, '--phase', 'semantic', '--output', `${O}/pending-semantic-${worker}`, '--stop-file', stop];
for (const w of ['a', 'b', 'c']) assert(!fs.existsSync(`${O}/pending-semantic-${w}`), `Output already used: ${w}`);
if (dry) {
    const rows = [];
    for (const w of ['a', 'b', 'c']) {
        guard(); const args = [...argsFor(w), '--dry-run'];
        const r = spawnSync(process.execPath, args, { env: process.env, encoding: 'utf8', windowsHide: true });
        assert.equal(r.status, 0, r.stderr); const result = JSON.parse(r.stdout);
        assert.equal(result.api_calls, 0); assert.equal(result.subprocesses, 0);
        assert.equal(result.jobs.length, { a: 35, b: 36, c: 34 }[w]); assert(!fs.existsSync(`${O}/pending-semantic-${w}`));
        rows.push({ worker: w, argv: args, exit_code: r.status, result });
    }
    guard(); write('pending-dry-runs.json', { created_at: new Date().toISOString(), api_calls: 0, production_subprocesses: 0, rows });
    console.log(JSON.stringify({ dry_run: 'passed', workers: [35, 36, 34], api_calls: 0 }));
} else {
    assert(process.env.OPENAI_API_KEY?.trim(), 'Credential unavailable; no production child started');
    assert(!fs.existsSync(`${O}/pending-controller-run.json`), 'One execution invocation only');
    write('pending-controller-run.json', { started_at: new Date().toISOString(), manifest: id(manifestFile), runner: id(runner), controller: self,
        mode: 'production_cli_sequential_workers', semantic_only: true, workers: ['a', 'b', 'c'], maximum_streams: 1, stop_file: stop, credentials_logged: false });
    const results = []; let child = null, interrupted = false;
    const event = value => fs.appendFileSync(`${O}/pending-controller-events.jsonl`, JSON.stringify({ time: new Date().toISOString(), ...value }) + '\n');
    const interrupt = () => { interrupted = true; if (!fs.existsSync(stop)) fs.writeFileSync(stop, 'Controller interrupted\n', { flag: 'wx' }); child?.kill('SIGINT'); };
    process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
    try {
        for (const worker of ['a', 'b', 'c']) {
            guard(); if (interrupted || fs.existsSync(stop)) break;
            const args = argsFor(worker); event({ event: 'worker_started', worker, argv: args });
            const completed = await new Promise(resolve => {
                child = spawn(process.execPath, args, { env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
                child.stdout.on('data', data => process.stdout.write(data)); child.stderr.on('data', data => process.stderr.write(data));
                child.once('error', error => resolve({ code: null, error: error.message }));
                child.once('close', (code, signal) => resolve({ code, signal }));
            });
            child = null; guard();
            const summaryFile = `${O}/pending-semantic-${worker}/summary.json`, summary = fs.existsSync(summaryFile) ? read(summaryFile) : null;
            const allRecorded = summary?.recorded_sets === manifest.jobs.filter(j => j.worker === worker).length && summary?.not_started_set_ids?.length === 0;
            const okay = [0, 2].includes(completed.code) && allRecorded && !summary?.stopped_on_execution_error && !summary?.interrupted
                && !summary?.gracefully_stopped && summary.results.every(r => ['pass', 'semantic_nonpass'].includes(r.outcome));
            const result = { worker, ...completed, all_semantic_jobs_recorded: allRecorded, continue_next_worker: okay,
                summary: summary ? id(summaryFile) : null, pass_sets: summary?.results.filter(r => r.outcome === 'pass').length ?? 0,
                nonpass_sets: summary?.results.filter(r => r.outcome === 'semantic_nonpass').length ?? 0 };
            results.push(result); event({ event: 'worker_finished', ...result });
            if (!okay || interrupted || fs.existsSync(stop)) break;
        }
    } catch (error) { results.push({ execution_error: error.message }); process.exitCode = 1; }
    finally {
        process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
        const complete = results.length === 3 && results.every(r => r.continue_next_worker);
        write('pending-controller-summary.json', { finished_at: new Date().toISOString(), manifest: id(manifestFile), interrupted,
            semantic_only: true, complete, additional_cli_retries: 0, results });
        if (!complete) process.exitCode = 1;
    }
}
