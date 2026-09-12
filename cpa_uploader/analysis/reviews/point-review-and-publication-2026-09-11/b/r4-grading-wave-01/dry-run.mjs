import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const own = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(own, '../../../../../..');
const d = path.resolve(own, '../..'); const rel = file => path.relative(root, file).replaceAll('\\', '/');
const env = { ...process.env, CPA_GRADING_MODEL: 'gpt-5.6-luna', CPA_REVIEW_MODEL: 'gpt-5.6-luna', CPA_REVIEW_INPUT_MAX_CHARS: '500000' };
const qa = path.join(root, 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4/grading-wave-01/author-qa-b');
const summaries = [];
for (const [phase, output] of [['grading', path.join(own, 'grading-b')], ['author-qa', qa]]) {
  const argv = ['--env-file=.env.local', rel(path.join(d, 'b/validation-worker-v3.mjs')), '--manifest', rel(path.join(own, 'manifest.json')), '--worker', 'b', '--phase', phase,
    '--output', rel(output), '--stop-file', rel(path.join(own, 'STOP')), '--dry-run'];
  const result = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  fs.writeFileSync(path.join(own, `${phase}.dry-run.stdout.json`), result.stdout, { flag: 'wx' });
  fs.writeFileSync(path.join(own, `${phase}.dry-run.stderr.log`), result.stderr, { flag: 'wx' });
  assert.equal(result.status, 0, result.stderr);
  const document = JSON.parse(result.stdout); assert.equal(document.api_calls, 0); assert.equal(document.subprocesses, 0);
  assert.equal(document.jobs.length, 12); assert(document.jobs.every(job => !job.will_skip_nonpass));
  assert.equal(document.will_stop_before_first_set, false);
  summaries.push({ phase, jobs: document.jobs.length, manifest_sha256: document.manifest_sha256, worker_sha256: document.worker_sha256,
    output: rel(output), dry_run: true, api_calls: 0, production_child_processes: 0 });
}
fs.writeFileSync(path.join(own, 'preflight.json'), JSON.stringify({ created_at: new Date().toISOString(), status: 'ready_waiting_for_root_transport_diagnostic', checks: summaries }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summaries));
