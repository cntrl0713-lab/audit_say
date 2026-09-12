import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const own = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(own, '../../../../../../..');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(own, 'baseline.json'), 'utf8'));
const lint = [];
for (const file of fs.readdirSync(path.join(own, 'proposed/cpa_uploader'))) {
  const name = file.slice(0, -4); const input = fs.readFileSync(path.join(own, 'proposed/cpa_uploader', file), 'utf8');
  const result = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '--stdin', '--stdin-filename', `cpa_uploader/${name}`], { cwd: root, input, encoding: 'utf8' });
  lint.push({ file: `cpa_uploader/${name}`, exit_code: result.status, stdout: result.stdout, stderr: result.stderr });
}
for (const item of baseline.files) if (sha(path.join(root, item.file)) !== item.sha256) throw Error(`PRODUCTION_CHANGED:${item.file}`);
const result = spawnSync('git', ['diff', '--no-index', '--', 'before/cpa_uploader', 'proposed/cpa_uploader'], { cwd: own, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (![0, 1].includes(result.status)) throw Error(result.stderr);
const patch = result.stdout.replaceAll('a/before/cpa_uploader/', 'a/cpa_uploader/').replaceAll('b/proposed/cpa_uploader/', 'b/cpa_uploader/')
  .replaceAll('a/proposed/cpa_uploader/', 'a/cpa_uploader/').replaceAll('.ts.txt', '.ts');
fs.writeFileSync(path.join(own, 'proposed.patch'), patch, { flag: 'wx' });
const entries = fs.readdirSync(path.join(own, 'proposed/cpa_uploader')).map(file => ({ target: `cpa_uploader/${file.slice(0, -4)}`,
  snapshot: `proposed/cpa_uploader/${file}`, before_sha256: baseline.files.find(b => b.file === `cpa_uploader/${file.slice(0, -4)}`)?.sha256 || null,
  proposed_sha256: sha(path.join(own, 'proposed/cpa_uploader', file)) }));
const output = { version: 1, created_at: new Date().toISOString(), production_edits: 0, api_calls: 0,
  scope: 'Four existing validation/publication files plus one new generated-receipt adapter. All are unapplied snapshots.',
  entries, patch: { file: 'proposed.patch', sha256: sha(path.join(own, 'proposed.patch')) }, lint,
  fixture: { file: 'fixture-results-v2.json', sha256: sha(path.join(own, 'fixture-results-v2.json')), checks: 38 },
  typecheck: { file: 'typecheck.json', sha256: sha(path.join(own, 'typecheck.json')) },
  limitations: ['Additional diagnostic producer logs deliberately rejected until their own origin adapter is implemented.', 'Author-QA adapter belongs to root separate assessment task.', 'No policy expansion; source review normalization requires real selected source/whole-answer review before production use.', 'Production apply/typecheck/whole regression and promotion CLI write guards remain required.'] };
fs.writeFileSync(path.join(own, 'handoff.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ snapshots: entries.length, patch_sha256: output.patch.sha256, checks: 38, lint_errors: lint.filter(x => x.exit_code !== 0).length }));
if (lint.some(x => x.exit_code !== 0)) process.exitCode = 1;
