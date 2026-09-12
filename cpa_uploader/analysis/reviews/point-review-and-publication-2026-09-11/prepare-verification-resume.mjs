import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, '../../../..');
const relative = file => path.relative(repo, file).replaceAll('\\', '/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--run-name' || !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(args[1]))
  throw new Error('Use --run-name NEW_NAME (lowercase letters, digits and hyphens)');
const target = path.join(root, 'execution-resumes', args[1]);
if (fs.existsSync(target)) throw new Error('Resume name already exists; preserve old output and use a new name');
const waves = ['canary', 'remaining'].map(wave => {
  const source = path.join(root, `execution-${wave}-v6/manifest.json`);
  return { wave, source, manifest: read(source) };
});
const identities = new Map();
for (const { manifest } of waves) {
  for (const row of [{ file: manifest.bank_file, sha256: manifest.bank_sha256 },
    { file: manifest.preflight_file, sha256: manifest.preflight_sha256 }, ...manifest.code_files,
    ...manifest.jobs.flatMap(job => [{ file: job.file, sha256: job.sha256 },
      { file: job.plan_file, sha256: job.plan_sha256 }, { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files])]) {
    if (identities.has(row.file) && identities.get(row.file) !== row.sha256) throw new Error(`Conflicting locked hash: ${row.file}`);
    identities.set(row.file, row.sha256);
  }
}
for (const [file, expected] of identities) if (hash(path.resolve(repo, file)) !== expected) throw new Error(`Frozen input changed: ${file}; prepare a new reviewed version instead of rewriting hashes`);
const output = [];
for (const { wave, source, manifest } of waves) {
  const directory = path.join(target, wave);
  fs.mkdirSync(directory, { recursive: true });
  const resumed = { ...manifest, created_at: new Date().toISOString(),
    purpose: 'user_requested_deferred_full_verification_resume',
    predecessor: { file: relative(source), sha256: hash(source) },
    resume_name: args[1], prior_execution_reused_as_completion: false };
  const manifestFile = path.join(directory, 'manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify(resumed, null, 2) + '\n', { flag: 'wx' });
  output.push({ wave, manifest_file: relative(manifestFile), manifest_sha256: hash(manifestFile),
    stop_file: relative(path.join(directory, 'STOP')), output_directory: relative(directory),
    sets: resumed.jobs.length, semantic_units: resumed.jobs.reduce((n, job) => n + job.semantic_units, 0) });
}
const result = { version: 1, created_at: new Date().toISOString(), run_name: args[1],
  checked_identities: identities.size, max_concurrent_workers: 3, api_calls: 0, execution_started: false,
  waves: output,
  author_qa_output_root: `cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/${args[1]}` };
fs.writeFileSync(path.join(target, 'resume.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
