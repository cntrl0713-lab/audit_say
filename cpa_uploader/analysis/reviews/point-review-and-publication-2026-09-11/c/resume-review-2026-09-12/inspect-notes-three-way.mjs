import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const output = path.dirname(fileURLToPath(import.meta.url));
const files = {
  base: D + '/canonical-before.json',
  current: 'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
  candidate: D + '/prepared-reviewed-v6/candidate-authoring.json',
  historical_migration: 'cpa_uploader/analysis/reviews/question-review-2027/migration-manifest.json',
};
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const evidence = Object.entries(files).map(([role, file]) => ({ role, file, sha256: sha(fs.readFileSync(file)) }));
const base = read(files.base), current = read(files.current), candidate = read(files.candidate), migration = read(files.historical_migration);
const differences = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function diff(a, b, location) {
  if (same(a, b)) return;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    differences.push({ path: location, before: a, after: b });
    return;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], location + '/' + key);
}
for (const set of base) diff(set, current.find(item => item.id === set.id), set.id);
const pathPattern = /docs\/[^\s]+?\.(?:md|json)/g;
const paths = value => typeof value === 'string' ? [...value.matchAll(pathPattern)].map(match => match[0]) : [];
const merged = structuredClone(candidate);
const changes = [], conflicts = [], linkIssues = [];
for (const item of differences) {
  const match = item.path.match(/^([^/]+)\/verification\/notes\/(\d+)$/);
  if (!match) { conflicts.push({ ...item, reason: 'non-note difference requires separate review' }); continue; }
  const [, setId, originalIndex] = match;
  const beforePaths = paths(item.before), afterPaths = paths(item.after);
  const purePathChange = beforePaths.length === 1 && afterPaths.length === 1
    && item.before.replace(beforePaths[0], '<PATH>') === item.after.replace(afterPaths[0], '<PATH>');
  if (!purePathChange) { conflicts.push({ ...item, reason: 'not exactly one path-only substitution' }); continue; }
  const target = merged.find(set => set.id === setId);
  const matches = target?.verification?.notes?.map((text, index) => ({ text, index })).filter(row => row.text === item.before) || [];
  if (matches.length !== 1) { conflicts.push({ ...item, reason: 'candidate does not contain exactly one unchanged base note', matches: matches.length }); continue; }
  const noteIndex = matches[0].index;
  const exists = fs.existsSync(afterPaths[0]);
  const migrationRow = migration.entries.find(row => row.old_path === beforePaths[0]);
  const mappedExists = migrationRow ? fs.existsSync(migrationRow.new_path) : false;
  const mappedHash = mappedExists ? sha(fs.readFileSync(migrationRow.new_path)) : null;
  const resolution = exists ? afterPaths[0]
    : migrationRow && mappedExists && mappedHash === migrationRow.sha256 ? migrationRow.new_path : null;
  const finalNote = resolution ? item.after.replace(afterPaths[0], resolution) : null;
  const row = {
    set_id: setId,
    base_note_index: Number(originalIndex),
    candidate_note_index: noteIndex,
    before_note: item.before,
    current_note: item.after,
    old_path: beforePaths[0],
    current_path: afterPaths[0],
    current_path_exists: exists,
    path_only_change: purePathChange,
    candidate_has_unmodified_base_note: true,
    proposed_note: finalNote,
    proposed_path: resolution,
    proposal_kind: exists ? 'preserve_current_document_path' : 'repair_missing_current_path_using_historical_migration',
    migration_evidence: migrationRow ? { ...migrationRow, actual_sha256: mappedHash, actual_hash_matches: mappedHash === migrationRow.sha256 } : null,
  };
  changes.push(row);
  if (!exists) linkIssues.push(row);
  if (!resolution) { conflicts.push({ ...item, reason: 'no verified destination' }); continue; }
  target.verification.notes[noteIndex] = finalNote;
}
const withoutNotes = sets => sets.map(set => {
  const clone = structuredClone(set);
  if (clone.verification) delete clone.verification.notes;
  return clone;
});
const guards = {
  base_and_current_ids_identical: same(base.map(set => set.id), current.map(set => set.id)),
  current_vs_base_only_note_paths: differences.length === changes.length && changes.every(row => row.path_only_change),
  all_candidate_merge_targets_unique_and_exact: conflicts.length === 0,
  candidate_non_note_fields_preserved: same(withoutNotes(candidate), withoutNotes(merged)),
  candidate_note_lengths_preserved: candidate.every((set, index) => set.verification?.notes?.length === merged[index].verification?.notes?.length),
  all_proposed_destinations_exist: changes.every(row => row.proposed_path && fs.existsSync(row.proposed_path)),
  protected_input_bytes_unchanged: evidence.every(row => sha(fs.readFileSync(row.file)) === row.sha256),
};
const result = {
  version: 1,
  checked_at: new Date().toISOString(),
  scope: 'Read-only three-way comparison and in-memory merge proposal; no bank, canonical, lock, source or receipt mutation.',
  api_calls: 0,
  evidence,
  counts: { base_sets: base.length, current_sets: current.length, candidate_sets: candidate.length, changed_notes: differences.length, affected_sets: new Set(changes.map(row => row.set_id)).size, unique_path_substitutions: new Set(changes.map(row => row.old_path + '\n' + row.current_path)).size, existing_current_paths: new Set(changes.filter(row => row.current_path_exists).map(row => row.current_path)).size, missing_current_paths: new Set(linkIssues.map(row => row.current_path)).size, notes_with_missing_current_path: linkIssues.length },
  changes,
  conflicts,
  guards,
  errors: Object.entries(guards).filter(([, passed]) => !passed).map(([name]) => name),
  hash_contract: 'verification.notes participates in reviewedContentHash. Even a path-only merge changes bank/peer identity; preserve prior receipts and build a new frozen manifest before fresh execution. No existing receipt hashes are rewritten.',
  limitation: 'Existing Markdown destinations were checked for existence only; this does not certify their current substantive contents. The missing JSON destination is resolved through the historical exact-hash migration record.',
};
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'notes-three-way-proposal.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ counts: result.counts, guards, errors: result.errors, proposal_sha256: sha(fs.readFileSync(path.join(output, 'notes-three-way-proposal.json'))) }, null, 2));
