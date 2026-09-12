import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, '../../../../../..');
const review = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const abs = file => path.resolve(root, file);
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(abs(file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(own, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const manifestFile = review + '/execution-all-v6/manifest.json';
const manifest = read(manifestFile);
const runtimeFile = review + '/execution-runtime-v5.json';
const runtime = read(runtimeFile);
const smokeFile = review + '/a/learning-unit-smoke-v3/manifest.json';
const smoke = read(smokeFile);
const canaryFile = review + '/execution-canary-v6/manifest.json';
const remainingFile = review + '/execution-remaining-v6/manifest.json';
const canary = read(canaryFile), remaining = read(remainingFile);
const protectedFiles = [runtimeFile, manifestFile, canaryFile, remainingFile, smokeFile,
  review + '/execution-canary-v6/STOP', review + '/execution-canary-v6/semantic-a/run.json', review + '/execution-canary-v6/semantic-a/summary.json',
  'cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'cpa_uploader/data/cpa_question_sets_v3.public.json', 'cpa_uploader/data/cpa_question_sets_v3.promotions.json'];
const protectedBefore = protectedFiles.map(file => ({ file, sha256: sha(file) }));
const allRows = [{ file: manifest.bank_file, sha256: manifest.bank_sha256 }, ...manifest.code_files, ...runtime.code_files,
  ...manifest.jobs.flatMap(j => [{ file: j.file, sha256: j.sha256 }, ...['plan', 'qa'].flatMap(k => j[k + '_file'] ? [{ file: j[k + '_file'], sha256: j[k + '_sha256'] }] : []), ...j.source_files])];
const unique = [...new Map(allRows.map(row => [row.file, row])).values()];
const hashErrors = unique.filter(row => !fs.existsSync(abs(row.file)) || sha(row.file) !== row.sha256);
const env = { ...process.env, OPENAI_API_KEY: '', CPA_GRADING_MODEL: manifest.model, CPA_REVIEW_MODEL: manifest.review_model, CPA_REVIEW_INPUT_MAX_CHARS: String(manifest.max_input_chars) };
const checks = [];
for (const worker of ['a', 'b', 'c']) {
  const argv = [review + '/b/validation-worker-v3.mjs', '--manifest', manifestFile, '--worker', worker, '--phase', 'semantic', '--output', rel(path.join(own, 'never-created-semantic-' + worker)), '--dry-run'];
  const result = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 5_000_000 });
  let doc = null; try { doc = JSON.parse(result.stdout); } catch { /* Preserve failed CLI output below. */ }
  write('semantic-dry-run-' + worker + '.json', { argv, exit_code: result.status, output: doc, stderr: result.stderr, actual_api_calls: 0 });
  checks.push({ id: 'semantic-dry-run-' + worker, pass: result.status === 0 && doc?.api_calls === 0 && doc?.subprocesses === 0 && doc?.files_written === 0, jobs: doc?.jobs.length });
}
for (const worker of ['a', 'b', 'c']) {
  const out = path.join(own, 'smoke-dry-run-' + worker);
  const argv = ['--import', 'tsx', review + '/a/run-learning-unit-smoke-v3.ts', '--manifest', smokeFile, '--worker', worker, '--output', rel(out), '--dry-run'];
  const result = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 2_000_000 });
  const doc = fs.existsSync(path.join(out, 'summary.json')) ? read(rel(path.join(out, 'summary.json'))) : null;
  write('smoke-command-' + worker + '.json', { argv, exit_code: result.status, stdout: result.stdout, stderr: result.stderr, actual_api_calls: 0 });
  checks.push({ id: 'smoke-dry-run-' + worker, pass: result.status === 0 && doc?.model_calls === 0 && doc?.nonempty_cases_executed === 0 && doc?.runtime_guards_passed === true, jobs: doc?.selected_jobs });
}
const protectedAfter = protectedBefore.map(row => ({ ...row, unchanged: sha(row.file) === row.sha256 }));
checks.push({ id: 'frozen-all-inputs-code-bank-source-hashes', pass: hashErrors.length === 0, distinct_files: unique.length });
checks.push({ id: 'protected-originals-and-stop-logs-unchanged', pass: protectedAfter.every(x => x.unchanged), files: protectedAfter.length });
const allIds = manifest.jobs.map(j => j.set_id), partitionIds = [...canary.jobs, ...remaining.jobs].map(j => j.set_id);
checks.push({ id: 'canary-and-remaining-partition-all-targets', pass: new Set(partitionIds).size === allIds.length && JSON.stringify([...partitionIds].sort()) === JSON.stringify([...allIds].sort()), canary: canary.jobs.length, remaining: remaining.jobs.length, all: allIds.length });
write('checks.json', { version: 1, checked_at: new Date().toISOString(), api_calls: 0, actual_semantic_calls: 0, actual_grading_calls: 0, actual_db_calls: 0,
  runtime: { file: runtimeFile, sha256: sha(runtimeFile), code_files: runtime.code_files.length },
  manifest: { file: manifestFile, sha256: sha(manifestFile), bank_file: manifest.bank_file, bank_sha256: manifest.bank_sha256, jobs: manifest.jobs.length, code_files: manifest.code_files.length, model: manifest.model, review_model: manifest.review_model, max_input_chars: manifest.max_input_chars },
  canary_manifest: { file: canaryFile, sha256: sha(canaryFile), jobs: canary.jobs.map(j => ({ set_id: j.set_id, worker: j.worker })) },
  remaining_manifest: { file: remainingFile, sha256: sha(remainingFile), jobs: remaining.jobs.length },
  canary_stopped_summary: read(review + '/execution-canary-v6/semantic-a/summary.json'),
  smoke: { file: smokeFile, sha256: sha(smokeFile), counts: smoke.counts }, checks, hash_errors: hashErrors, protected_files: protectedAfter,
  limits: ['Grading-phase CLI has no completed current-v6 semantic receipt and was not invoked.', 'Author-QA and nonempty smoke were not executed.', 'Smoke dry-run writes only local preflight records; semantic worker dry-run starts no production subprocess.', 'Actual promotion, human evidence creation, publication and DB writes were not performed.'] });
console.log(JSON.stringify({ checks: checks.length, passed: checks.filter(x => x.pass).length, failed: checks.filter(x => !x.pass), api_calls: 0, hashes_checked: unique.length }));
if (checks.some(x => !x.pass)) process.exitCode = 1;
