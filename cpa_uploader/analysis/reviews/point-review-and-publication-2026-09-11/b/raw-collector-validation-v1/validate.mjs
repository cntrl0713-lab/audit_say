import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const outputRoot = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(outputRoot, '../../../../../..');
const collectorFile = path.join(repo, 'cpa_uploader/raw/collect.mjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const collectorHash = sha(fs.readFileSync(collectorFile));
const { collect, verify } = await import(pathToFileURL(collectorFile).href);
const run = fs.mkdtempSync(path.join(outputRoot, 'fixture-run-'));
const results = [], observations = [];
const relative = file => path.relative(repo, file).split(path.sep).join('/');
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const safeFileCount = root => !fs.existsSync(root) ? 0 : fs.readdirSync(root, { withFileTypes: true }).reduce((n, x) => n + (x.isDirectory() ? safeFileCount(path.join(root, x.name)) : 1), 0);
function fixture(name, entries = [{ original_path: 'sources/a.bin', category: 'official', role: 'synthetic source' }]) {
  const root = path.join(run, name);
  fs.mkdirSync(root, { recursive: true });
  write(path.join(root, 'sources/a.bin'), Buffer.from([0, 255, 1, 128, 13, 10, 0, 65]));
  write(path.join(root, 'inventory.json'), JSON.stringify({ version: 1, entries, missing: [{ original_path: 'absent.pdf', reason: 'fixture known unavailable' }], excluded: ['fixture excluded'], provenance_notes: ['synthetic only'] }, null, 2) + '\r\n');
  const output = 'cpa_uploader/raw/collections/test-01';
  return { root, output, args: { repoDir: root, input: 'inventory.json', output }, manifest: path.join(root, output, 'manifest.json') };
}
function test(id, operation) {
  try { const detail = operation(); results.push({ id, pass: true, ...(detail === undefined ? {} : { detail }) }); }
  catch (error) { results.push({ id, pass: false, error: error.message }); }
}
function assertNoArchive(f) { assert.equal(fs.existsSync(path.join(f.root, 'cpa_uploader/raw')), false); }
function material(f) { return path.join(f.root, json(f.manifest).entries[0].archived_path); }
function snapshot(root) {
  const result = {};
  function visit(dir) { for (const name of fs.readdirSync(dir)) { const file = path.join(dir, name); const stat = fs.lstatSync(file); if (stat.isDirectory()) visit(file); else result[path.relative(root, file)] = stat.isSymbolicLink() ? `link:${fs.readlinkSync(file)}` : sha(fs.readFileSync(file)); } }
  visit(root); return result;
}

test('binary-and-inventory-byte-preserving-copy', () => {
  const f = fixture('binary');
  const before = snapshot(f.root), result = collect(f.args), manifest = json(f.manifest);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(fs.readFileSync(material(f)), fs.readFileSync(path.join(f.root, 'sources/a.bin')));
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.output, 'inventory.json')), fs.readFileSync(path.join(f.root, 'inventory.json')));
  for (const [name, hash] of Object.entries(before)) assert.equal(sha(fs.readFileSync(path.join(f.root, name))), hash);
  assert.equal(manifest.summary.archived_bytes, 8);
  assert.equal(manifest.original_paths_retained, true);
  assert.equal(manifest.entries[0].sha256, sha(fs.readFileSync(material(f))));
  return result;
});
test('intra-collection-dedup-across-names-categories-and-provenance', () => {
  const entries = [{ original_path: 'sources/a.bin', category: 'official', role: 'source' }, { original_path: 'other/b.bin', category: 'verification', role: 'copy', url: 'https://example.invalid/fixture' }];
  const f = fixture('dedup', entries);
  write(path.join(f.root, 'other/b.bin'), fs.readFileSync(path.join(f.root, 'sources/a.bin')));
  collect(f.args); const m = json(f.manifest);
  assert.equal(m.entries[0].archived_path, m.entries[1].archived_path);
  assert.equal(m.entries[1].category, 'verification'); assert.equal(m.entries[1].url, entries[1].url);
  assert.deepEqual(m.summary, { original_paths: 2, unique_files: 1, duplicate_paths: 1, archived_bytes: 8 });
  assert.equal(safeFileCount(path.join(f.root, 'cpa_uploader/raw/materials')), 1);
});
test('distinct-bytes-never-dedup', () => {
  const f = fixture('distinct', [{ original_path: 'sources/a.bin', category: 'official', role: 'a' }, { original_path: 'other/a.bin', category: 'official', role: 'b' }]);
  write(path.join(f.root, 'other/a.bin'), Buffer.from([0, 255, 1, 128, 13, 10, 0, 66]));
  collect(f.args); assert.equal(json(f.manifest).summary.unique_files, 2);
});
test('existing-collection-refused-and-all-bytes-preserved', () => {
  const f = fixture('overwrite'); collect(f.args); const before = snapshot(f.root);
  assert.throws(() => collect(f.args), /Collection already exists/u); assert.deepEqual(snapshot(f.root), before);
});
test('repeat-new-collection-reuses-same-material-path-without-write', () => {
  const f = fixture('repeat'); collect(f.args); const first = material(f), bytes = fs.readFileSync(first), time = fs.statSync(first).mtimeMs;
  collect({ ...f.args, output: 'cpa_uploader/raw/collections/test-02' });
  assert.deepEqual(fs.readFileSync(first), bytes); assert.equal(fs.statSync(first).mtimeMs, time);
  assert.equal(safeFileCount(path.join(f.root, 'cpa_uploader/raw/materials')), 1);
});
test('second-missing-source-preflight-produces-no-archive', () => {
  const f = fixture('missing-source', [{ original_path: 'sources/a.bin', category: 'official', role: 'a' }, { original_path: 'sources/missing.bin', category: 'official', role: 'b' }]);
  assert.throws(() => collect(f.args), /ENOENT/u); assertNoArchive(f);
});
test('inventory-sha-mismatch-preflight-produces-no-archive', () => {
  const f = fixture('wrong-sha', [{ original_path: 'sources/a.bin', category: 'official', role: 'a', sha256: '0'.repeat(64) }]);
  assert.throws(() => collect(f.args), /Inventory source changed/u); assertNoArchive(f);
});
test('directory-source-preflight-produces-no-archive', () => {
  const f = fixture('directory', [{ original_path: 'sources', category: 'official', role: 'directory' }]);
  assert.throws(() => collect(f.args), /regular source/u); assertNoArchive(f);
});
test('duplicate-resolved-source-refused-before-write', () => {
  const f = fixture('duplicate-path', [{ original_path: 'sources/a.bin', category: 'official', role: 'a' }, { original_path: 'sources/../sources/a.bin', category: 'official', role: 'a again' }]);
  assert.throws(() => collect(f.args), /Duplicate original path/u); assertNoArchive(f);
});
for (const [name, inventory] of [['empty', { version: 1, entries: [] }], ['version', { version: 2, entries: [] }], ['category', { version: 1, entries: [{ original_path: 'sources/a.bin', category: 'invalid', role: 'a' }] }], ['role', { version: 1, entries: [{ original_path: 'sources/a.bin', category: 'official' }] }]]) {
  test(`invalid-inventory-${name}-preflight`, () => { const f = fixture(`invalid-${name}`); write(path.join(f.root, 'inventory.json'), JSON.stringify(inventory)); assert.throws(() => collect(f.args)); assertNoArchive(f); });
}
test('conflicting-existing-material-preflight-refuses-all-writes', () => {
  const f = fixture('conflict', [{ original_path: 'sources/a.bin', category: 'official', role: 'a' }, { original_path: 'sources/b.bin', category: 'official', role: 'b' }]);
  write(path.join(f.root, 'sources/b.bin'), 'second-file');
  const target = path.join(f.root, 'cpa_uploader/raw/materials/official', sha(Buffer.from('second-file')).slice(0, 16), 'b.bin');
  write(target, 'old-conflicting-bytes'); const before = snapshot(f.root);
  assert.throws(() => collect(f.args), /different bytes/u); assert.deepEqual(snapshot(f.root), before);
});
test('archive-tamper-detected', () => { const f = fixture('tamper'); collect(f.args); write(material(f), 'tampered'); assert.ok(verify({ repoDir: f.root, output: f.output }).errors.some(x => x.startsWith('Archived bytes changed:'))); });
test('archived-file-missing-detected', () => { const f = fixture('missing-archive'); collect(f.args); fs.unlinkSync(material(f)); assert.ok(verify({ repoDir: f.root, output: f.output }).errors.some(x => x.startsWith('Missing archived file:'))); });
test('inventory-tamper-detected', () => { const f = fixture('tamper-inventory'); collect(f.args); fs.appendFileSync(path.join(f.root, f.output, 'inventory.json'), '\n'); assert.ok(verify({ repoDir: f.root, output: f.output }).errors.includes('Inventory hash mismatch')); });
test('index-tamper-detected', () => { const f = fixture('tamper-index'); collect(f.args); fs.appendFileSync(path.join(f.root, f.output, 'index.md'), '\nchanged'); assert.ok(verify({ repoDir: f.root, output: f.output }).errors.includes('Index differs from manifest')); });
test('summary-tamper-detected', () => { const f = fixture('tamper-summary'); collect(f.args); const m = json(f.manifest); m.summary.archived_bytes++; write(f.manifest, JSON.stringify(m)); assert.ok(verify({ repoDir: f.root, output: f.output }).errors.includes('Summary does not match archived files')); });
test('historical-check-preserves-original-change-distinction', () => {
  const f = fixture('original-change'); collect(f.args); write(path.join(f.root, 'sources/a.bin'), 'later revision');
  assert.deepEqual(verify({ repoDir: f.root, output: f.output }).errors, []);
  assert.ok(verify({ repoDir: f.root, output: f.output, againstOriginals: true }).errors.some(x => x.startsWith('Original missing or changed:')));
});
test('historical-check-preserves-original-missing-distinction', () => {
  const f = fixture('original-missing'); collect(f.args); fs.unlinkSync(path.join(f.root, 'sources/a.bin'));
  assert.deepEqual(verify({ repoDir: f.root, output: f.output }).errors, []);
  assert.ok(verify({ repoDir: f.root, output: f.output, againstOriginals: true }).errors.some(x => x.startsWith('Original missing or changed:')));
});
test('known-missing-records-retained-without-false-successful-copy', () => { const f = fixture('missing-metadata'); const result = collect(f.args); assert.equal(result.missing_source_records, 1); assert.equal(result.original_paths, 1); assert.equal(json(f.manifest).missing[0].reason, 'fixture known unavailable'); });
for (const [name, output] of [['outside', '../escaped'], ['nested', 'cpa_uploader/raw/collections/parent/child'], ['base', 'cpa_uploader/raw/collections'], ['traversal', 'cpa_uploader/raw/collections/../../escaped']]) {
  test(`collection-output-${name}-refused-before-write`, () => { const f = fixture(`path-${name}`); assert.throws(() => collect({ ...f.args, output }), /direct child/u); assertNoArchive(f); });
}
test('manifest-archived-path-traversal-refused', () => { const f = fixture('manifest-traversal'); collect(f.args); const m = json(f.manifest); m.entries[0].archived_path = 'cpa_uploader/raw/materials/../../../../sources/a.bin'; write(f.manifest, JSON.stringify(m)); assert.throws(() => verify({ repoDir: f.root, output: f.output }), /Path escapes archive/u); });
test('manifest-archived-namespace-refused', () => { const f = fixture('manifest-namespace'); collect(f.args); const m = json(f.manifest); m.entries[0].archived_path = 'sources/a.bin'; write(f.manifest, JSON.stringify(m)); assert.throws(() => verify({ repoDir: f.root, output: f.output }), /Invalid archived namespace/u); });
test('source-archive-recollection-refused', () => {
  const f = fixture('recollect'); collect(f.args); write(path.join(f.root, 'inventory-02.json'), JSON.stringify({ version: 1, entries: [{ original_path: json(f.manifest).entries[0].archived_path, category: 'official', role: 'archive' }] }));
  assert.throws(() => collect({ ...f.args, input: 'inventory-02.json', output: 'cpa_uploader/raw/collections/test-02' }), /Cannot recollect/u);
});
test('source-change-during-copy-detected-no-completed-collection', () => {
  const f = fixture('during-copy'), source = path.join(f.root, 'sources/a.bin');
  const originalCopy = fs.copyFileSync;
  try {
    fs.copyFileSync = (...args) => { originalCopy(...args); if (args[0] === source) write(source, 'simulated concurrent change'); };
    assert.throws(() => collect(f.args), /Source changed during collection/u);
    assert.equal(fs.existsSync(path.join(f.root, f.output)), false);
    observations.push({ id: 'non-atomic-material-preparation', severity: 'information', detail: 'A source changed after copying is rejected before a collection receipt is written; the already verified material copy remains. This is not a completed collection or rollback guarantee.' });
  } finally { fs.copyFileSync = originalCopy; }
});
test('index-special-filename-links-percent-encode-delimiters', () => {
  const name = 'sources/감사 (원문)#1.bin';
  const f = fixture('index-name', [{ original_path: name, category: 'official', role: 'a | b' }]);
  write(path.join(f.root, name), 'file'); collect(f.args);
  const index = fs.readFileSync(path.join(f.root, f.output, 'index.md'), 'utf8');
  assert.ok(index.includes('%28')); assert.ok(index.includes('%29')); assert.ok(index.includes('%23')); assert.ok(index.includes('a &#124; b'));
});
test('cross-collection-dedup-scope-observed', () => {
  const f = fixture('cross-dedup'); collect(f.args);
  write(path.join(f.root, 'sources/renamed.bin'), fs.readFileSync(path.join(f.root, 'sources/a.bin')));
  write(path.join(f.root, 'inventory-02.json'), JSON.stringify({ version: 1, entries: [{ original_path: 'sources/renamed.bin', category: 'verification', role: 'same bytes later' }] }));
  collect({ ...f.args, input: 'inventory-02.json', output: 'cpa_uploader/raw/collections/test-02' });
  const count = safeFileCount(path.join(f.root, 'cpa_uploader/raw/materials'));
  observations.push({ id: 'dedup-is-per-collection', severity: 'documentation', actual_material_files: count, detail: 'Identical bytes under a different filename/category in a later collection produce a second physical file. README should qualify dedup as per-collection, or implement archive-wide lookup if intended.' });
  assert.equal(count, 2);
});
test('external-original-source-policy-observed-with-synthetic-sibling', () => {
  const f = fixture('external-source', [{ original_path: '../synthetic-external.bin', category: 'reference', role: 'explicit external fixture' }]);
  write(path.join(run, 'synthetic-external.bin'), 'synthetic external source'); collect(f.args);
  assert.equal(json(f.manifest).entries[0].original_path, '../synthetic-external.bin');
  observations.push({ id: 'external-source-path-accepted', severity: 'policy-choice', detail: 'Original input paths can leave repoDir. Only synthetic sibling fixture was read. Archive output containment and explicit external-source authorization should be documented separately.' });
});
test('material-directory-junction-cannot-escape-archive', () => {
  const f = fixture('junction-escape');
  const outside = path.join(run, 'synthetic-junction-target'); fs.mkdirSync(outside);
  const link = path.join(f.root, 'cpa_uploader/raw/materials'); fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  let error = null; try { collect(f.args); } catch (caught) { error = caught.message; }
  const outsideFiles = safeFileCount(outside);
  observations.push({ id: 'material-ancestor-link-path-escape', severity: outsideFiles ? 'defect' : 'none', rejected: error !== null, error, actual_files_outside_fixture_repo: outsideFiles, physical_target: relative(outside), detail: 'All targets remain under this test-owned fixture root. A junction at materials redirects archive writes outside the lexical repo/archive root; lstat on the final file does not catch a linked ancestor.' });
  assert.ok(error !== null && outsideFiles === 0, 'Collector wrote through a materials directory junction outside its archive root and accepted the collection');
});
test('collector-source-unchanged-by-test', () => assert.equal(sha(fs.readFileSync(collectorFile)), collectorHash));

const report = { version: 1, reviewed_at: new Date().toISOString(), api_calls: 0, actual_materials_collected: 0, fixture_root: relative(run), collector_file: relative(collectorFile), collector_sha256: collectorHash, script_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), summary: { total: results.length, passed: results.filter(x => x.pass).length, failed: results.filter(x => !x.pass).length }, results, observations, limitations: ['Filesystem race resistance is bounded to the tested simulated source-change hook, not a concurrency proof.', 'No existing source or actual raw collection was modified or collected.', 'Missing/changed source tests mutate synthetic fixture files only.', 'No CLI default-root execution and no network/API calls.'] };
const reportFile = path.join(outputRoot, `results-${path.basename(run)}.json`);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ report_file: relative(reportFile), ...report.summary, observations }, null, 2));
if (report.summary.failed) process.exitCode = 1;
