import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { assembleCoverage, questionHash, resolveDraftFile, sourceUnitHash } from '../../coverage/build-coverage.mjs';

// Run from the repository root. The default only writes evidence in this review directory.
// --apply checks the published authoring bank and is the sole canonical mutation switch.
const R = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const canonical = 'cpa_uploader/analysis/coverage/links.json';
const elementFile = 'cpa_uploader/analysis/question-elements/question-elements.json';
const planFile = R + 'coverage-update-plan.json';
const proposedFile = R + 'coverage-links.proposed.json';
const argv = process.argv.slice(2);
let apply = false, candidateOverride = null;
while (argv.length) {
  const arg = argv.shift();
  if (arg === '--apply') apply = true;
  else if (arg === '--candidate-bank') { candidateOverride = argv.shift(); assert(candidateOverride?.startsWith(R)); }
  else throw new Error('Unknown argument: ' + arg);
}
assert(!apply || !candidateOverride, '--apply always validates the actual canonical bank');
const bytes = p => fs.readFileSync(p);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(bytes(p).toString('utf8').replace(/^\uFEFF/u, ''));
const plan = read(planFile);
const finalBinding = fs.existsSync(R + 'coverage-final-candidate.json') ? read(R + 'coverage-final-candidate.json') : null;
if (finalBinding) {
  assert.equal(sha(bytes(finalBinding.bank.file)), finalBinding.bank.sha256, 'Final reviewed candidate changed');
  assert.equal(sha(bytes(planFile)), finalBinding.preserved_manual_mapping.sha256, 'Final manual mapping changed');
}
assert.equal(sha(bytes(plan.source_links)), plan.source_links_sha256, 'Original links snapshot changed');
assert.equal(sha(bytes(plan.review_input)), plan.review_input_sha256, 'Manual review input changed');
assert.equal(sha(bytes(plan.candidate_lineage)), plan.candidate_lineage_sha256, 'Reviewed lineage changed');
const original = read(plan.source_links);
const reconciliation = read(R + 'coverage-reconciliation.json');
assert.equal(sha(bytes(reconciliation.base_links)), reconciliation.base_links_sha256);
assert.equal(sha(bytes(reconciliation.added_sets)), reconciliation.added_sets_sha256);
const source = read(reconciliation.base_links);
for (const l of original.links) assert.deepEqual(source.links.find(x => x.id === l.id), l, 'An original relationship was changed in the reconciliation');
const bankFile = apply ? 'cpa_uploader/data/cpa_question_sets_v3.authoring.json' : candidateOverride ?? finalBinding?.bank.file ?? plan.candidate_bank;
const bank = read(bankFile);
const concurrentSets = read(reconciliation.added_sets);
const previewAddedSets = [];
if (!apply) for (const s of concurrentSets) if (!bank.some(x => x.id === s.id)) { bank.push(s); previewAddedSets.push(s.id); }
const dataset = read(elementFile);
const catalog = buildSourceCatalog({ repoDir: process.cwd() });
const elements = new Map(dataset.elements.map(e => [e.id, e]));
const units = new Map(catalog.units.map(u => [u.id, u]));
const questions = new Map(bank.flatMap(s => s.subquestions.map(q => [s.id + '/' + q.id, { s, q }])));
const oldLinks = new Map(source.links.map(l => [l.id, l]));
const updates = new Map(plan.updates.map(u => [u.link_id, u]));
assert.equal(updates.size, plan.updates.length, 'Duplicate mapping source link');
const updatedIds = new Set();
const history = (old, output) => ({
  reviewed_at: plan.reviewed_at,
  reviewer: plan.reviewer,
  kind: 'agent_semantic_relationship_review',
  method: plan.method,
  input: { file: planFile, sha256: sha(bytes(planFile)), source_link_id: old.id },
  preserved_snapshot: { file: plan.source_links, sha256: plan.source_links_sha256 },
  prior: { target: old.target, relationship: old.relationship, review_status: old.review_status,
    reason: old.reason, source_unit_ids: old.source_unit_ids, snapshot: old.snapshot },
  evidence: output.evidence,
});

for (const update of updates.values()) {
  const old = oldLinks.get(update.link_id);
  assert(old, 'Unknown source link: ' + update.link_id);
  assert.deepEqual(update.old_target, old.target, 'Source target changed: ' + old.id);
  assert.equal(update.prior_relationship, old.relationship, 'Source relationship changed: ' + old.id);
  assert(update.outputs.length, 'A removed target needs an explicit reviewed replacement/exclusion policy');
  for (const o of update.outputs) {
    assert(!updatedIds.has(o.id), 'Duplicate output link: ' + o.id);
    assert(o.id === old.id || !oldLinks.has(o.id), 'Output ID collides with an existing link: ' + o.id);
    updatedIds.add(o.id);
    const target = questions.get(o.target.set_id + '/' + o.target.subquestion_id);
    assert(target, 'Reviewed target absent from bank: ' + o.id);
    assert(o.target.criterion_ids.length, 'Empty target criteria: ' + o.id);
    assert.equal(new Set(o.target.criterion_ids).size, o.target.criterion_ids.length);
    for (const id of o.target.criterion_ids) assert(target.q.criteria.some(c => c.id === id), 'Target criterion absent: ' + o.id + '/' + id);
    assert.equal(o.snapshot.element_sha256, sha(JSON.stringify(elements.get(old.element_id))), 'Element changed after review: ' + o.id);
    assert.equal(o.snapshot.question_sha256, questionHash(target.s, target.q), 'Question changed after review; compare meaning before remapping: ' + o.id);
    for (const id of o.source_unit_ids) {
      assert(units.has(id), 'Source unit absent: ' + id);
      assert.equal(o.snapshot.source_hashes[id], units.get(id).contentHash, 'Source content changed after review: ' + id);
      assert.equal(o.snapshot.source_metadata_hashes[id], sourceUnitHash(units.get(id)), 'Source metadata changed after review: ' + id);
    }
  }
}

const overlay = { ...source, links: source.links.flatMap(old => {
  const update = updates.get(old.id);
  if (!update) return [old];
  return update.outputs.map(o => ({ ...old, id: o.id, target: o.target,
    relationship: o.relationship, review_status: o.review_status, reason: o.reason,
    source_unit_ids: o.source_unit_ids, snapshot: o.snapshot,
    review_history: [...(old.review_history ?? []), history(old, o)],
  }));
}) };
for (const old of source.links.filter(l => !updates.has(l.id))) {
  assert.deepEqual(overlay.links.find(l => l.id === old.id), old, 'Unreviewed link was modified: ' + old.id);
}
for (const update of updates.values()) for (const o of update.outputs) {
  assert.deepEqual(overlay.links.find(l => l.id === o.id).provenance, oldLinks.get(update.link_id).provenance,
    'Historical provenance must remain byte-equivalent as a JSON value');
}
const draftFiles = [...new Set(overlay.links.filter(l => l.target?.scope === 'draft').map(l => l.target.file))];
const drafts = draftFiles.flatMap(file => {
  const raw = read(resolveDraftFile(process.cwd(), file));
  return (Array.isArray(raw) ? raw : [raw]).map(set => ({ file, set }));
});
const result = assembleCoverage({ dataset, bank, catalog, overlay, drafts, inputs: {
  bank: { file: bankFile, sha256: sha(bytes(bankFile)) },
  final_candidate_binding: finalBinding ? { file: R + 'coverage-final-candidate.json', sha256: sha(bytes(R + 'coverage-final-candidate.json')) } : null,
  elements: { file: elementFile, sha256: sha(bytes(elementFile)) },
  overlay: { file: proposedFile }, source_catalog_fingerprint: catalog.fingerprint,
} });
const reviewed = result.links.filter(l => updatedIds.has(l.id));
assert.equal(reviewed.length, updatedIds.size);
assert(reviewed.every(l => l.freshness === 'current' && l.effective_review_status === 'reviewed'), 'A remapped relationship is stale');
const proposedBytes = JSON.stringify(overlay, null, 2) + '\n';
const canonicalSha = sha(bytes(canonical));
const proposedSha = sha(proposedBytes);
assert(canonicalSha === reconciliation.base_links_sha256 || canonicalSha === proposedSha,
  'Canonical links changed independently; reconcile that change before applying this review');
fs.writeFileSync(proposedFile, proposedBytes);
const checks = {
  schema_version: 1, mode: apply ? 'apply' : 'preview', reviewed_at: plan.reviewed_at,
  original_review_snapshot: { file: plan.source_links, sha256: plan.source_links_sha256, count: original.links.length },
  source_links: { file: reconciliation.base_links, sha256: reconciliation.base_links_sha256, count: source.links.length },
  concurrent_additions_preserved: { links: reconciliation.added_link_ids, preview_added_sets: previewAddedSets,
    evidence: R + 'coverage-reconciliation.json' },
  output: { file: proposedFile, sha256: proposedSha, count: overlay.links.length },
  bank: { file: bankFile, sha256: sha(bytes(bankFile)) },
  source_link_count_reviewed: updates.size, resulting_reviewed_links: reviewed.length,
  added_links: overlay.links.length - source.links.length,
  unchanged_links_preserved: source.links.length - updates.size,
  deleted_only_targets: plan.deleted_only_target_links,
  current_remapped_links: reviewed.filter(l => l.freshness === 'current').length,
  remapped_links_without_source_units: reviewed.filter(l => !l.source_unit_ids.length).map(l => l.id),
  existing_unreviewed_or_stale_links_preserved: result.links.filter(l => !updatedIds.has(l.id) && l.effective_review_status !== 'reviewed').map(l => l.id),
  summary: result.summary,
  checks: { valid_target_ids: true, valid_criterion_ids: true, reviewed_hashes_current: true,
    original_provenance_preserved: true, untouched_links_unchanged: true, unique_link_ids: true },
  limitations: '관계 검토 상태이며 문항 의미검수·실제 채점·사람 승인·게시·운영 DB 반영을 대체하지 않는다. 기존 미검토 관계를 이 실행으로 검토 완료 처리하지 않았다.',
};
if (apply && canonicalSha !== proposedSha) fs.writeFileSync(canonical, proposedBytes);
checks.canonical_mutated = apply && canonicalSha !== proposedSha;
checks.already_applied = canonicalSha === proposedSha;
fs.writeFileSync(R + (apply ? 'coverage-update-application.json' : 'coverage-update-checks.json'), JSON.stringify(checks, null, 2) + '\n');
console.log(JSON.stringify({ mode: checks.mode, old_links: source.links.length, new_links: overlay.links.length,
  reviewed_source_links: updates.size, reviewed_result_links: reviewed.length,
  unchanged: checks.unchanged_links_preserved, canonical_mutated: checks.canonical_mutated,
  already_applied: checks.already_applied, remaining_unreviewed_or_stale: checks.existing_unreviewed_or_stale_links_preserved.length }));
