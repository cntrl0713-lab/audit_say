import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { createHash } from 'node:crypto';

const audit = resolve(import.meta.dirname, '..');
const cta = resolve(audit, '../CTA_tax_law');
const output = resolve(audit, 'tmp/common-account-release-' + new Date().toISOString().replace(/[:.]/g, '-'));
const hash = data => createHash('sha256').update(data).digest('hex');
async function walk(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await walk(root, name));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
const auditOverlay = [
  'app/actions.ts', 'app/admin/page.tsx', 'app/page.tsx', 'app/profile/page.tsx',
  'components/AccountSettings.tsx', 'contexts/AuthContext.tsx', 'lib/db.ts', 'lib/dbAdmin.ts',
  'lib/learningRepository.ts', 'lib/learningSubmission.ts', 'lib/rateLimit.ts', 'lib/supabaseServer.ts',
  'lib/accountPolicy.ts', 'lib/accountRecovery.ts', 'lib/accountRepository.ts', 'lib/accountServer.ts',
];
for (const folder of ['app/account', 'app/api/account', 'app/auth']) {
  auditOverlay.push(...(await walk(join(audit, folder))).map(name => `${folder}/${name}`));
}
const gitNames = args => execFileSync('git', ['-C', cta, ...args], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const ctaOverlay = [...new Set([...gitNames(['diff', '--name-only', 'HEAD', '--', 'src']), ...gitNames(['ls-files', '--others', '--exclude-standard', '--', 'src'])])].sort();
await mkdir(output, { recursive: true });
const manifest = { createdAt: new Date().toISOString(), projects: [] };
for (const [name, repo, overlay] of [['audit_say', audit, auditOverlay], ['CTA_tax_law', cta, ctaOverlay]]) {
  const destination = resolve(output, name);
  if (!destination.startsWith(output + sep)) throw new Error('Release path escaped workspace');
  // A fresh destination prevents a previous build or environment file being reused.
  await mkdir(destination);
  const archive = join(output, `${name}.zip`);
  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '--output', archive, 'HEAD']);
  // Windows bsdtar can misdecode UTF-8 Korean archive paths; .NET ZIP preserves them.
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "& { param($archivePath,$destinationPath) $ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($archivePath,$destinationPath) }", archive, destination]);
  JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
  const changes = [];
  for (const file of overlay.sort()) {
    const target = resolve(destination, file);
    if (!target.startsWith(destination + sep) || file.includes('..')) throw new Error('Invalid overlay path');
    const bytes = await readFile(join(repo, file));
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(repo, file), target);
    changes.push({ file, sha256: hash(bytes) });
  }
  if (name === 'CTA_tax_law') await writeFile(join(destination, '.vercelignore'), [
    '.env*', '.next', 'node_modules', '/cta_uploader', '/tests', '/docs', '/supabase',
    '/.security-evidence', '/.claude', '/.hermes', '/.github', '**/*.tsbuildinfo', '',
  ].join('\n'));
  manifest.projects.push({ name, directory: relative(audit, destination).replaceAll('\\', '/'),
    baseCommit: execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), overlay: changes });
}
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(resolve(audit, 'tmp/common-account-release-latest.json'), JSON.stringify({ output, manifest: join(output, 'manifest.json') }, null, 2));
console.log(JSON.stringify({ output, projects: manifest.projects.map(p => ({ name: p.name, baseCommit: p.baseCommit, overlayFiles: p.overlay.length })) }));
