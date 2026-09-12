import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, '../../../../../..');
const batch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
const docs = ['docs/plans/문항-전수검증-재개-작업요구서-2026-09-11.md', 'docs/reports/문항-전수검증-재개-현황-2026-09-11.md'];
const documentChecks = docs.map(file => {
  const text = fs.readFileSync(path.resolve(root, file), 'utf8');
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)].map(match => match[1]).filter(x => !/^[a-z]+:\/\//iu.test(x)).map(target => {
    const resolved = path.resolve(root, path.dirname(file), decodeURI(target.split('#')[0]));
    return { target, exists: fs.existsSync(resolved) };
  });
  return { file, sha256: sha(file), links };
});
const resumeFile = batch + '/execution-resumes/handoff-001/resume.json';
const resume = read(resumeFile), dryRuns = [];
for (const wave of resume.waves) {
  const manifest = read(wave.manifest_file);
  for (const worker of ['a', 'b', 'c']) {
    const output = path.join(own, 'never-created-resume-' + wave.wave + '-' + worker);
    const argv = [batch + '/b/validation-worker-v3.mjs', '--manifest', wave.manifest_file, '--worker', worker, '--phase', 'semantic', '--output', output, '--stop-file', wave.stop_file, '--dry-run'];
    const result = spawnSync(process.execPath, argv, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 5_000_000,
      env: { ...process.env, OPENAI_API_KEY: '', CPA_GRADING_MODEL: manifest.model, CPA_REVIEW_MODEL: manifest.review_model, CPA_REVIEW_INPUT_MAX_CHARS: String(manifest.max_input_chars) } });
    let doc = null; try { doc = JSON.parse(result.stdout); } catch { /* Report failure without executing any fallback. */ }
    dryRuns.push({ wave: wave.wave, worker, manifest_file: wave.manifest_file, manifest_sha256: sha(wave.manifest_file), matches_resume: sha(wave.manifest_file) === wave.manifest_sha256,
      command: argv, exit_code: result.status, stderr: result.stderr, pass: result.status === 0 && doc?.api_calls === 0 && doc?.subprocesses === 0 && doc?.files_written === 0,
      jobs: doc?.jobs.map(j => j.set_id), api_calls: doc?.api_calls, subprocesses: doc?.subprocesses, files_written: doc?.files_written, output_created: fs.existsSync(output) });
  }
}
const result = { version: 1, checked_at: new Date().toISOString(), api_calls: 0, resume: { file: resumeFile, sha256: sha(resumeFile), checked_identities: resume.checked_identities },
  docs: documentChecks, dry_runs: dryRuns,
  issues: [
    { severity: 'wording', location: docs[1], issue: '실제 함수 미호출 경로 can imply the function itself was not called; gradeQuestionSetV3 was called, with model API 0. Root notified.' },
    { severity: 'implementation-note', location: docs[0], issue: 'worker --dry-run writes no output, but smoke --dry-run creates output; actual smoke must use a fresh output path after dry-run.' },
    { severity: 'command-simplification', location: docs[0], issue: 'Prefer node --env-file=.env.local --import tsx to npx tsx: uses installed dependency directly without an npx package-resolution step.' }
  ], human_approval_created: false, source_or_bank_changed: false };
fs.writeFileSync(path.join(own, 'resume-docs-check.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed_dry_runs: dryRuns.filter(x => x.pass).length, total_dry_runs: dryRuns.length, missing_links: documentChecks.flatMap(d => d.links.filter(l => !l.exists).map(l => ({ doc: d.file, target: l.target }))), api_calls: 0 }));
if (dryRuns.some(x => !x.pass)) process.exitCode = 1;
