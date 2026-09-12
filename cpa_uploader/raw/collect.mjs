import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const slash = value => value.split(path.sep).join('/');
const categories = new Set(['learning', 'reference', 'official', 'verification', 'wiki-input']);

function within(root, relative) {
  if (path.isAbsolute(relative)) throw new Error(`Expected a relative archive path: ${relative}`);
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path escapes archive: ${relative}`);
  return target;
}

function readRegular(file) {
  if (!fs.lstatSync(file).isFile()) throw new Error(`Expected a regular source file: ${file}`);
  return fs.readFileSync(file);
}

function assertArchiveParents(repoDir, target) {
  const root = path.resolve(repoDir);
  for (let current = target; current !== root; current = path.dirname(current)) {
    if (!current.startsWith(`${root}${path.sep}`)) throw new Error('Archive path escapes repository');
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error(`Refusing an archive symlink or junction: ${current}`);
  }
}

function collectionPath(repoDir, output) {
  const base = path.join(repoDir, 'cpa_uploader/raw/collections');
  const relative = slash(path.relative(base, path.resolve(repoDir, output)));
  if (!relative || relative.includes('/') || !/^[a-zA-Z0-9_-]+$/u.test(relative))
    throw new Error('Output must be a new direct child of cpa_uploader/raw/collections');
  const target = within(base, relative);
  assertArchiveParents(repoDir, target);
  return target;
}

export function collect({ repoDir = defaultRoot, input, output }) {
  const destination = collectionPath(repoDir, output);
  if (fs.existsSync(destination)) throw new Error(`Collection already exists: ${output}`);
  const inputBytes = readRegular(path.resolve(repoDir, input));
  const selection = JSON.parse(inputBytes.toString('utf8'));
  if (selection.version !== 1 || !Array.isArray(selection.entries) || !selection.entries.length)
    throw new Error('Inventory requires version 1 and nonempty entries');
  const seen = new Set(), materials = new Map();
  const entries = selection.entries.map(entry => {
    if (typeof entry.original_path !== 'string' || !categories.has(entry.category) || !entry.role)
      throw new Error('Each source requires original_path, category and role');
    const source = path.resolve(repoDir, entry.original_path);
    if (source.startsWith(path.join(repoDir, 'cpa_uploader/raw/materials') + path.sep)
      || source.startsWith(path.join(repoDir, 'cpa_uploader/raw/collections') + path.sep))
      throw new Error(`Cannot recollect the archive as a source: ${entry.original_path}`);
    if (seen.has(source.toLowerCase())) throw new Error(`Duplicate original path: ${entry.original_path}`);
    seen.add(source.toLowerCase());
    const bytes = readRegular(source), sha256 = hash(bytes);
    if (entry.sha256 && entry.sha256 !== sha256) throw new Error(`Inventory source changed: ${entry.original_path}`);
    if (!materials.has(sha256)) {
      const basename = path.basename(source).replace(/[<>:"|?*]/gu, '_');
      const ext = path.extname(basename);
      const name = basename.length > 110 ? `${basename.slice(0, 90)}${ext}` : basename;
      materials.set(sha256, { source, bytes: bytes.length,
        archived_path: `cpa_uploader/raw/materials/${entry.category}/${sha256.slice(0, 16)}/${name}` });
    }
    return { ...entry, bytes: bytes.length, sha256, archived_path: materials.get(sha256).archived_path };
  });
  // Complete read-only preflight before creating any archive output.
  for (const [sha256, item] of materials) {
    const target = within(repoDir, item.archived_path);
    assertArchiveParents(repoDir, target);
    if (fs.existsSync(target) && hash(readRegular(target)) !== sha256)
      throw new Error(`Archive destination has different bytes: ${item.archived_path}`);
  }
  for (const [sha256, item] of materials) {
    const target = within(repoDir, item.archived_path);
    assertArchiveParents(repoDir, target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.copyFileSync(item.source, target, fs.constants.COPYFILE_EXCL);
    if (hash(readRegular(target)) !== sha256) throw new Error(`Archive copy verification failed: ${item.archived_path}`);
  }
  for (const entry of entries)
    if (hash(readRegular(path.resolve(repoDir, entry.original_path))) !== entry.sha256)
      throw new Error(`Source changed during collection: ${entry.original_path}`);
  const manifest = {
    version: 1, collected_at: new Date().toISOString(), mode: 'byte_preserving_copy',
    inventory_sha256: hash(inputBytes), original_paths_retained: true,
    scope: selection.scope || null, missing: selection.missing || [],
    excluded: selection.excluded || [], provenance_notes: selection.provenance_notes || [],
    summary: { original_paths: entries.length, unique_files: materials.size,
      duplicate_paths: entries.length - materials.size,
      archived_bytes: [...materials.values()].reduce((n, item) => n + item.bytes, 0) },
    entries,
  };
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'inventory.json'), inputBytes, { flag: 'wx' });
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(destination, 'index.md'), renderIndex(manifest, destination, repoDir), { flag: 'wx' });
  const result = verify({ repoDir, output, againstOriginals: true });
  if (result.errors.length) throw new Error(JSON.stringify(result));
  fs.writeFileSync(path.join(destination, 'verification.json'), JSON.stringify({ checked_at: new Date().toISOString(), ...result }, null, 2) + '\n', { flag: 'wx' });
  return result;
}

function renderIndex(manifest, destination, repoDir) {
  const link = (file, label) => `[${label.replaceAll('|', '&#124;').replaceAll('[', '\\[').replaceAll(']', '\\]')}](${encodeURI(slash(path.relative(destination, path.resolve(repoDir, file)))).replace(/[()#?]/gu, value => `%${value.codePointAt(0).toString(16).toUpperCase()}`)})`;
  let text = '# 원자료 수집 색인\n\n이 수집은 원본 바이트를 보존한 사본이다. 기존 출처·인용 경로와 검수 기록은 유지했다. 시점 사본을 현행 편집 정본이나 검수 완료 증거로 사용하지 않는다.\n\n';
  text += `원래 경로 ${manifest.summary.original_paths}개 · 고유 파일 ${manifest.summary.unique_files}개 · 동일 바이트 중복 경로 ${manifest.summary.duplicate_paths}개.\n\n[전체 매니페스트](manifest.json) · [보존 검사](verification.json) · [보관소 안내](../../README.md)\n`;
  for (const category of categories) {
    const entries = manifest.entries.filter(entry => entry.category === category);
    if (!entries.length) continue;
    text += `\n## ${category}\n\n| 원래 경로 | raw 보존본 | 역할 |\n| --- | --- | --- |\n`;
    for (const entry of entries) text += `| ${link(entry.original_path, entry.original_path)} | ${link(entry.archived_path, path.basename(entry.archived_path))} | ${String(entry.role).replaceAll('|', '&#124;')} |\n`;
  }
  if (manifest.missing.length) text += '\n## 미보관·미확인\n\n' + manifest.missing.map(item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n') + '\n';
  return text;
}

export function verify({ repoDir = defaultRoot, output, againstOriginals = false }) {
  const destination = collectionPath(repoDir, output);
  const manifest = JSON.parse(readRegular(path.join(destination, 'manifest.json')).toString('utf8'));
  const errors = [], originals = new Set(), materials = new Map();
  if (hash(readRegular(path.join(destination, 'inventory.json'))) !== manifest.inventory_sha256) errors.push('Inventory hash mismatch');
  if (manifest.version !== 1 || manifest.mode !== 'byte_preserving_copy') errors.push('Unsupported collection format');
  for (const entry of manifest.entries) {
    if (!entry.archived_path.startsWith('cpa_uploader/raw/materials/')) throw new Error('Invalid archived namespace');
    const target = within(path.join(repoDir, 'cpa_uploader/raw/materials'), entry.archived_path.slice('cpa_uploader/raw/materials/'.length));
    assertArchiveParents(repoDir, target);
    if (originals.has(entry.original_path.toLowerCase())) errors.push(`Duplicate original: ${entry.original_path}`);
    originals.add(entry.original_path.toLowerCase());
    if (!materials.has(target)) {
      if (!fs.existsSync(target)) errors.push(`Missing archived file: ${entry.archived_path}`);
      else {
        const bytes = readRegular(target);
        materials.set(target, { sha256: hash(bytes), bytes: bytes.length });
      }
    }
    const material = materials.get(target);
    if (material && (material.sha256 !== entry.sha256 || material.bytes !== entry.bytes)) errors.push(`Archived bytes changed: ${entry.archived_path}`);
    if (againstOriginals) {
      const source = path.resolve(repoDir, entry.original_path);
      if (!fs.existsSync(source) || hash(readRegular(source)) !== entry.sha256) errors.push(`Original missing or changed: ${entry.original_path}`);
    }
  }
  if (originals.size !== manifest.summary.original_paths || materials.size !== manifest.summary.unique_files
    || originals.size - materials.size !== manifest.summary.duplicate_paths
    || [...materials.values()].reduce((n, item) => n + item.bytes, 0) !== manifest.summary.archived_bytes) errors.push('Summary does not match archived files');
  const expectedIndex = renderIndex(manifest, destination, repoDir);
  if (fs.readFileSync(path.join(destination, 'index.md'), 'utf8') !== expectedIndex) errors.push('Index differs from manifest');
  return { ...manifest.summary, against_originals: againstOriginals, missing_source_records: manifest.missing.length, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const output = value('--output');
  if (!output || (!args.includes('--check') && !value('--input'))) throw new Error('Use --input INVENTORY --output COLLECTION, or --check --output COLLECTION [--against-originals]');
  const result = args.includes('--check') ? verify({ output, againstOriginals: args.includes('--against-originals') }) : collect({ input: value('--input'), output });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
