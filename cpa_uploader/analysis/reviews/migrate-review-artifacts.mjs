import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const oldReports = 'docs/reports/question-review-2027';
const newRun = 'cpa_uploader/analysis/reviews/question-review-2027';
const oldPlan = 'docs/plans/2027-question-review/manifest.json';
const manifestRelative = `${newRun}/migration-manifest.json`;
const slash = value => value.split(path.sep).join('/');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function inside(root, relative) {
    if (path.isAbsolute(relative)) throw new Error(`Absolute artifact path is not allowed: ${relative}`);
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Artifact escapes repository: ${relative}`);
    return absolute;
}

function regularFiles(directory) {
    if (!fs.existsSync(directory)) return [];
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Refusing to migrate a symbolic link: ${full}`);
        if (entry.isDirectory()) files.push(...regularFiles(full));
        else if (entry.isFile()) files.push(full);
    }
    return files;
}

function assertMapping(entry) {
    const suffix = entry.old_path.startsWith(`${oldReports}/`) ? entry.old_path.slice(oldReports.length + 1) : null;
    const allowed = suffix && (/^[^/]+\.json$/u.test(suffix) || suffix.startsWith('grading-cases/') || suffix.startsWith('sources/'));
    const expected = entry.old_path === oldPlan ? `${newRun}/plan-manifest.json` : allowed ? `${newRun}/${suffix}` : null;
    if (!expected || entry.new_path !== expected) throw new Error(`Unexpected migration mapping: ${entry.old_path} → ${entry.new_path}`);
}

export function checkReviewMigration({ repoDir = repoDefault, requireLocal = false } = {}) {
    const manifest = JSON.parse(fs.readFileSync(inside(repoDir, manifestRelative), 'utf8'));
    const errors = [], unavailableLocal = [];
    const oldPaths = new Set(), newPaths = new Set();
    let verified = 0, bytes = 0;
    for (const entry of manifest.entries) {
        assertMapping(entry);
        if (oldPaths.has(entry.old_path) || newPaths.has(entry.new_path)) errors.push(`Duplicate mapping: ${entry.old_path}`);
        oldPaths.add(entry.old_path); newPaths.add(entry.new_path);
        const oldFile = inside(repoDir, entry.old_path), newFile = inside(repoDir, entry.new_path);
        if (fs.existsSync(oldFile)) errors.push(`Old copy still exists: ${entry.old_path}`);
        if (!fs.existsSync(newFile)) {
            if (entry.local_only && !requireLocal) unavailableLocal.push(entry.new_path);
            else errors.push(`Missing migrated artifact: ${entry.new_path}`);
            continue;
        }
        const contents = fs.readFileSync(newFile);
        if (contents.length !== entry.bytes || sha256(contents) !== entry.sha256) errors.push(`Historical bytes changed: ${entry.new_path}`);
        else { verified++; bytes += contents.length; }
    }
    if (manifest.entries.length !== manifest.verification.files) errors.push('Manifest file count does not match entries');
    if (manifest.entries.reduce((sum, entry) => sum + entry.bytes, 0) !== manifest.verification.bytes) errors.push('Manifest byte count does not match entries');
    return { files: manifest.entries.length, verified, bytes, unavailableLocal, errors };
}

export function migrateReviewArtifacts({ repoDir = repoDefault } = {}) {
    const manifestFile = inside(repoDir, manifestRelative);
    if (fs.existsSync(manifestFile)) return checkReviewMigration({ repoDir });
    const reportDir = inside(repoDir, oldReports);
    const candidates = regularFiles(reportDir).filter(file => {
        const relative = slash(path.relative(reportDir, file));
        return /^[^/]+\.json$/u.test(relative) || relative.startsWith('grading-cases/') || relative.startsWith('sources/');
    }).map(file => ({ old_path: slash(path.relative(repoDir, file)), new_path: `${newRun}/${slash(path.relative(reportDir, file))}` }));
    if (fs.existsSync(inside(repoDir, oldPlan))) candidates.push({ old_path: oldPlan, new_path: `${newRun}/plan-manifest.json` });
    if (!candidates.length) throw new Error('No historical artifacts found; a manifest must not be fabricated');
    const entries = candidates.sort((a, b) => a.old_path.localeCompare(b.old_path)).map(entry => {
        assertMapping(entry);
        const source = inside(repoDir, entry.old_path), destination = inside(repoDir, entry.new_path);
        if (fs.existsSync(destination)) throw new Error(`Destination already exists: ${entry.new_path}`);
        const content = fs.readFileSync(source);
        const originally_tracked = spawnSync('git', ['-C', repoDir, 'ls-files', '--error-unmatch', '--', entry.old_path], { stdio: 'ignore', windowsHide: true }).status === 0;
        const local_only = !originally_tracked && (entry.old_path.includes('/sources/') || /-live\.jsonl$/u.test(entry.old_path));
        const role = entry.old_path === oldPlan ? 'historical-plan-inventory' : entry.old_path.includes('/sources/') ? 'historical-source-evidence' : entry.old_path.includes('/grading-cases/') ? 'historical-grading-evidence' : 'historical-review-ledger';
        return { ...entry, role, sha256: sha256(content), bytes: content.length, originally_tracked, local_only };
    });
    // Preflight every resolved source/destination before moving any regular file.
    for (const entry of entries) {
        const source = inside(repoDir, entry.old_path), destination = inside(repoDir, entry.new_path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.renameSync(source, destination);
        if (sha256(fs.readFileSync(destination)) !== entry.sha256) throw new Error(`Post-move hash mismatch: ${entry.new_path}`);
    }
    const manifest = {
        version: 1,
        migrated_at: new Date().toISOString(),
        reason: 'Separate historical machine-readable review evidence from human reports; preserve every artifact byte and its original path for traceability.',
        history_policy: 'Embedded historical paths, timestamps, verdicts and hashes remain unchanged. Resolve former locations through entries.old_path → entries.new_path; these records do not certify the current bank.',
        verification: { method: 'SHA-256 and byte count before and after regular-file rename', files: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), all_bytes_preserved: true },
        entries,
    };
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    return checkReviewMigration({ repoDir, requireLocal: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--apply', '--check', '--require-local'].includes(arg))) throw new Error('Usage: node cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs [--check | --apply] [--require-local]');
    const result = args.includes('--apply') ? migrateReviewArtifacts() : checkReviewMigration({ requireLocal: args.includes('--require-local') });
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) process.exitCode = 1;
}
