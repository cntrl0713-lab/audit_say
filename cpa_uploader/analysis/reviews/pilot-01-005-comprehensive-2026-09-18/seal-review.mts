import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createEfficientReviewReceipt, createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../../../questionEfficientReview.ts';

const R = 'cpa_uploader/analysis/reviews/pilot-01-005-comprehensive-2026-09-18';
const E = `${R}/execution-v1`;
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const ref = (file: string) => ({ file, sha256: sha(fs.readFileSync(file)) });
const summary = read(`${E}/actual-a/summary.json`);
assert.equal(summary.status, 'completed');
assert.equal(summary.selected_entries, 3);
assert.equal(summary.completed_observations, 3);
assert.equal(summary.representative_subquestion_answers, 9);
assert(summary.observed_within_tolerance_ratio >= 0.95);
const observations = summary.rows.map((row: { status: string; observation: { file: string; sha256: string } }) => {
  assert.equal(row.status, 'within_tolerance');
  assert(row.observation);
  return row.observation;
});
const batchFile = `${R}/batch-v1.json`;
const batch = {
  version: 1,
  artifact_type: 'cost_controlled_review_batch',
  created_at: new Date().toISOString(),
  authorization: { evidence: ref(`${R}/authorization.md`), agent_review_and_representative_grading: true, production_publication: true },
  grading_manifest: ref(`${E}/grading-manifest.json`),
  observations,
  agent_reviews: [read(`${R}/content-review-v1.json`)],
  runtime_snapshots: read(`${E}/runtime-snapshots.json`),
  residual_grading_findings: [],
};
fs.writeFileSync(batchFile, `${JSON.stringify(batch, null, 2)}\n`, { flag: 'wx' });
const candidate = read(`${R}/candidate-v1.json`);
const set = candidate.find((row: { id: string }) => row.id === 'pilot-01-005');
const context = createEfficientValidationContext();
const receipt = createEfficientReviewReceipt(ref(batchFile), set, context, process.cwd(), true);
assertEfficientEvidenceUnchanged(context);
fs.writeFileSync(`${R}/receipt-v1.json`, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ batch: ref(batchFile), receipt, actual_sdk_calls: summary.actual_sdk_calls, within_tolerance: `${summary.within_tolerance}/${summary.representative_subquestion_answers}` }, null, 2));
