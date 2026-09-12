import fs from 'node:fs';
import crypto from 'node:crypto';

const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const collection = 'cpa_uploader/raw/collections/2026-09-11-initial';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = read(`${collection}/manifest.json`);
const entries = new Map(manifest.entries.map(entry => [entry.original_path, entry]));
const aliases = new Map();
function add(oldPath, currentPath, expectedHash, record) {
  const entry = entries.get(currentPath);
  if (!entry || entry.sha256 !== expectedHash || hash(fs.readFileSync(entry.archived_path)) !== expectedHash)
    throw new Error(`Cannot verify historical alias: ${oldPath}`);
  const value = { recorded_path: oldPath, current_path: currentPath, archived_path: entry.archived_path,
    sha256: expectedHash, source_record: record, status: 'same_bytes_verified' };
  aliases.set(`${record}:${oldPath}`, value);
}
const migrationFile = 'cpa_uploader/analysis/reviews/question-review-2027/migration-manifest.json';
for (const entry of read(migrationFile).entries) if (entries.has(entry.new_path)) add(entry.old_path, entry.new_path, entry.sha256, migrationFile);
const aFile = `${base}/a/raw-crosscheck-v1/path-and-missing-evidence.json`;
for (const item of read(aFile).relocations) add(item.original_path, item.same_byte_files[0].file, item.documented_sha256, item.source_record.file);
const cFile = `${base}/c/raw-source-inventory-v1/gap-assessment-final.json`;
for (const item of read(cFile).historical_path_resolutions) add(item.recorded_path, item.matching_current_paths[0], item.expected_sha256, item.record);
for (const item of read(cFile).relative_path_resolutions) add(item.recorded_path, item.resolved_path, item.sha256, item.record);
const result = { version: 1, created_at: new Date().toISOString(),
  note: '옛 기록은 수정하지 않고 같은 바이트를 가진 현재 위치와 raw 보존본으로 연결한다. 파일명만 기록된 상대 경로는 source_record 위치에서 해석한다.',
  inputs: [migrationFile, aFile, cFile, `${collection}/manifest.json`].map(file => ({ file, sha256: hash(fs.readFileSync(file)) })),
  aliases: [...aliases.values()], errors: [] };
fs.writeFileSync(`${collection}/path-aliases.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ aliases: result.aliases.length, errors: result.errors }));
