import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { validateGradingAcceptance, gradingAcceptanceHash, fixtureValidateTrace } from './fixture-runtime/questionGradingAcceptance.mjs';
import { auditReviewGrading, validateReviewGrading } from './fixture-runtime/questionReviewGrading.mjs';
import { validateSemanticReviewReceipt, validateRecordedSemanticReview } from './fixture-runtime/questionSemanticReview.mjs';
import { validatePromotionLedger } from './fixture-runtime/questionBankPublication.mjs';
import { buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../../lib/questionV3Grading.ts';
import { jsonHash, sha256 } from '../../../../../../questionReviewIdentity.ts';

const own = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(own, '../../../../../../..'); const d = path.resolve(own, '../../..');
const fixture = fs.mkdtempSync(path.join(own, 'fixture-artifacts-'));
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = file => ({ file: rel(file), sha256: sha256(fs.readFileSync(file)) });
const base = path.join(d, 'execution-resumes/resume-2026-09-12-v4/canary'); const sourceDir = path.join(base, 'grading-b/pilot-05-003');
const bank = read(path.join(d, 'c/prepared-reviewed-v8/candidate-authoring.json'));
const receipt = read(path.join(sourceDir, 'grading.json')).reviews[0]; const set = bank.find(s => s.id === receipt.set_id);
const originalHash = jsonHash(receipt); const checks = []; let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('NETWORK_DISABLED_IN_IMPLEMENTATION_FIXTURE'); };
const record = (id, actual, expected = true) => { assert.deepEqual(actual, expected, id); checks.push({ id, passed: true }); };
const mismatch = receipt.grading.runs.find(r => !r.matched);
const report = read(path.join(d, 'b/resume-review-2026-09-12/r4/canary-report.json'));
const bounds = set.subquestions.flatMap(sub => sub.criteria.map(criterion => {
  const prior = report.formal.expected_full_by_subquestion.find(s => s.subquestion_id === sub.id).criteria.find(c => c.criterion_id === criterion.id);
  return { subquestion_id: sub.id, criterion_id: criterion.id, criterion_claim: criterion.claim,
    min: prior.points, max: prior.points, reason: prior.reason, source_ref_ids: criterion.source_ref_ids };
}));
const sourceReview = { set_id: set.id, run_id: mismatch.id, answers_hash: jsonHash(mismatch.answers), original_expected_hash: jsonHash(mismatch.expected),
  method: 'complete_exact_expectation', expectation_basis: 'source_prompt_rubric_and_whole_answer', bounds, reviewer_kind: 'agent_source_review', human_confirmation: false };
const sourceFile = path.join(fixture, 'synthetic-fixture-source-review-not-approval.json'); fs.writeFileSync(sourceFile, JSON.stringify(sourceReview, null, 2) + '\n', { flag: 'wx' });
const policyFile = path.join(d, 'grading-inference-followup-v2/minor-error-policy.json');
const proof = { ...sourceReview, source_review: identity(sourceFile), request_hash: sha256(buildGradingPrompt(set, mismatch.answers)), schema_hash: sha256(JSON.stringify(buildGradingResponseSchema(set, mismatch.answers))) };
delete proof.set_id;
const a = { version: 1, artifact_type: 'grading_deviation_acceptance', set_id: set.id, content_hash: receipt.content_hash,
  receipt_hash: receipt.receipt_hash, acceptance_label: 'accepted_with_grading_deviation', policy_file: identity(policyFile), policy: read(policyFile),
  origin: { manifest: identity(path.join(base, 'manifest.json')), run: identity(path.join(base, 'grading-b/run.json')),
    summary: identity(path.join(sourceDir, 'summary.json')), request: identity(path.join(sourceDir, 'request.json')), receipt: identity(path.join(sourceDir, 'grading.json')),
    observations: identity(path.join(sourceDir, 'grading.json.grading.jsonl')), additional_observations: [] }, cases: [proof], acceptance_hash: '' };
a.acceptance_hash = gradingAcceptanceHash(a);
record('old_default_strict_rejects_actual_B', validateReviewGrading(receipt.grading, set, receipt.cases).length, 1);
const audit = auditReviewGrading(receipt.grading, set, receipt.cases);
record('typed_audit_does_not_turn_mismatch_into_integrity_error', audit.integrity_errors, []);
record('typed_audit_one_strict_mismatch', audit.strict_mismatches.map(r => r.run_id), [mismatch.id]);
const accepted = validateGradingAcceptance(a, receipt, set); record('formal_adapter_accepts_bound_actual_B_with_all_39_primary_rows', accepted, []);
record('new_semantic_acceptance_checks_all_existing_semantic_gates', validateSemanticReviewReceipt(receipt, set, { bank, gradingAcceptance: a, maxInputChars: 500000 }), []);
record('recorded_optional_acceptance_retains_receipt', validateRecordedSemanticReview(receipt, set, root, a), []);
record('recorded_default_still_strict', validateRecordedSemanticReview(receipt, set, root).length, 1);
function reject(id, mutate) { const changed = structuredClone(a); mutate(changed); changed.acceptance_hash = gradingAcceptanceHash(changed); record(id, validateGradingAcceptance(changed, receipt, set).length > 0); }
reject('missing_full_expected_criterion', a => { a.cases[0].bounds.pop(); });
reject('bounds_must_match_selected_source_review', a => { a.cases[0].bounds[0].min = 0; });
reject('missing_original_mismatch_proof', a => { a.cases = []; });
reject('changed_original_answer_hash', a => { a.cases[0].answers_hash = '0'.repeat(64); });
reject('changed_original_expected_hash', a => { a.cases[0].original_expected_hash = '0'.repeat(64); });
reject('wrong_policy_or_widening', a => { a.policy.max_absolute_score_delta_per_subquestion = 2; });
reject('changed_raw_file_hash', a => { a.origin.observations.sha256 = '0'.repeat(64); });
reject('unrelated_original_run', a => { a.origin.run = a.origin.request; });
reject('additional_unvalidated_producer_fails_closed', a => { a.origin.additional_observations = [a.origin.observations]; });
reject('human_confirmation_not_inferred', a => { a.cases[0].human_confirmation = true; });
reject('current_request_hash_mismatch', a => { a.cases[0].request_hash = '0'.repeat(64); });
reject('current_schema_hash_mismatch', a => { a.cases[0].schema_hash = '0'.repeat(64); });
for (const to of [true, 'true']) {
  const grading = structuredClone(receipt.grading); grading.runs.find(r => r.id === mismatch.id).matched = to;
  record(`raw_matched_tamper_${String(to)}_${typeof to}`, auditReviewGrading(grading, set, receipt.cases).integrity_errors.some(e => e.includes('matched')));
}
const inverse = structuredClone(receipt.grading); inverse.runs.find(r => r.matched).matched = false;
record('computed_pass_raw_false_is_integrity_error_not_waiver', auditReviewGrading(inverse, set, receipt.cases).integrity_errors.some(e => e.includes('matched')));
const primary = fs.readFileSync(path.join(sourceDir, 'grading.json.grading.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
for (const event of primary) fixtureValidateTrace(event, set);
record('39_original_trace_rows_valid', primary.length, 39);
for (const field of ['injection_detected', 'salad_detected']) {
  const event = structuredClone(primary.find(e => e.id === mismatch.id)); event.trace[0].response.subquestions[0][field] = true;
  assert.throws(() => fixtureValidateTrace(event, set), /security/); record(`raw_${field}_never_score_waiver`, true);
}
const traceError = structuredClone(primary[0]); traceError.trace.push({ stage: 'judgment', attempt: 2, error: 'synthetic failure' });
assert.throws(() => fixtureValidateTrace(traceError, set), /failure/); record('trace_failure_not_score_waiver', true);
const missingCriterion = structuredClone(primary[0]); missingCriterion.trace[0].response.subquestions[0].verdicts.pop();
assert.throws(() => fixtureValidateTrace(missingCriterion, set)); record('raw_missing_criterion_rejected', true);
const badEvidence = structuredClone(primary[0]); const matchedCriterion = badEvidence.trace[0].response.subquestions.flatMap(s => s.verdicts).find(c => c.verdict !== 'not_met');
matchedCriterion.evidence_ids = ['invented-evidence']; assert.throws(() => fixtureValidateTrace(badEvidence, set)); record('invented_evidence_rejected', true);
const memorySet = structuredClone(set); memorySet.status = 'verified'; memorySet.verification.review_status = 'verified';
const entry = { set_id: set.id, from_status: 'needs_review', to_status: 'verified', date: '2000-01-01',
  evidence: 'SYNTHETIC_IN_MEMORY_FIXTURE_NOT_HUMAN_APPROVAL', content_hash: receipt.content_hash, semantic_review: receipt,
  review_receipt_hash: receipt.receipt_hash, review_summary: { units: receipt.units.length, cases: receipt.cases.length, method: receipt.execution.method, verdict: 'pass' },
  grading_acceptance: a, grading_acceptance_hash: a.acceptance_hash };
record('in_memory_ledger_optional_acceptance', validatePromotionLedger([memorySet], { version: 1, entries: [entry] }), []);
const broken = structuredClone(entry); broken.grading_acceptance_hash = '0'.repeat(64);
record('in_memory_ledger_acceptance_hash_tamper', validatePromotionLedger([memorySet], { version: 1, entries: [broken] }).length > 0);
const aDir = path.join(base, 'grading-a/pilot-01-002');
const aReceipt = read(path.join(aDir, 'grading.json')).reviews[0]; const aSet = bank.find(s => s.id === aReceipt.set_id);
const aRun = aReceipt.grading.runs.find(r => !r.matched);
const aReview = read(path.join(d, 'a/resume-review-2026-09-12/r4/canary-generated-tolerance-bound-review.json'));
const aBounds = aSet.subquestions.flatMap(sub => sub.criteria.map(criterion => {
  const prior = aReview.criterion_bounds.find(b => b.subquestion_id === sub.id && b.criterion_id === criterion.id);
  return { subquestion_id: sub.id, criterion_id: criterion.id, criterion_claim: criterion.claim,
    min: prior?.min || 0, max: prior?.max || 0, reason: prior?.reason || 'Other subquestion is blank.', source_ref_ids: criterion.source_ref_ids };
}));
const aSourceReview = { set_id: aSet.id, run_id: aRun.id, answers_hash: jsonHash(aRun.answers), original_expected_hash: jsonHash(aRun.expected),
  method: 'conservative_criterion_bounds', expectation_basis: 'source_prompt_rubric_and_whole_answer', bounds: aBounds, reviewer_kind: 'agent_source_review', human_confirmation: false };
const aSourceFile = path.join(fixture, 'synthetic-A-bounds-not-approval.json'); fs.writeFileSync(aSourceFile, JSON.stringify(aSourceReview, null, 2) + '\n', { flag: 'wx' });
const aProof = { ...aSourceReview, source_review: identity(aSourceFile), request_hash: sha256(buildGradingPrompt(aSet, aRun.answers)), schema_hash: sha256(JSON.stringify(buildGradingResponseSchema(aSet, aRun.answers))) }; delete aProof.set_id;
const aAcceptance = { ...structuredClone(a), set_id: aSet.id, content_hash: aReceipt.content_hash, receipt_hash: aReceipt.receipt_hash,
  origin: { ...structuredClone(a.origin), run: identity(path.join(base, 'grading-a/run.json')), summary: identity(path.join(aDir, 'summary.json')),
    request: identity(path.join(aDir, 'request.json')), receipt: identity(path.join(aDir, 'grading.json')), observations: identity(path.join(aDir, 'grading.json.grading.jsonl')) }, cases: [aProof] };
aAcceptance.acceptance_hash = gradingAcceptanceHash(aAcceptance);
record('actual_A_interval0_to2_actual1_with_full_origin_trace', validateGradingAcceptance(aAcceptance, aReceipt, aSet), []);
const broad = structuredClone(aAcceptance); broad.cases[0].bounds[0].max = 1;
const broadSource = { ...aSourceReview, bounds: broad.cases[0].bounds }; const broadFile = path.join(fixture, 'synthetic-A-too-wide-bound-not-approval.json');
fs.writeFileSync(broadFile, JSON.stringify(broadSource, null, 2) + '\n', { flag: 'wx' }); broad.cases[0].source_review = identity(broadFile); broad.acceptance_hash = gradingAcceptanceHash(broad);
record('A_interval0_to3_actual1_rejected_even_with_bound_file_binding', validateGradingAcceptance(broad, aReceipt, aSet).some(e => e.includes('worst deviation')));
record('actual_receipt_unchanged', jsonHash(receipt), originalHash);
for (const file of read(path.join(own, 'baseline.json')).files) record(`production_unchanged:${file.file}`, sha256(fs.readFileSync(path.resolve(root, file.file))), file.sha256);
record('no_network_attempts', networkAttempts, 0);
fs.writeFileSync(path.join(own, 'fixture-results-v2.json'), JSON.stringify({ created_at: new Date().toISOString(), api_calls: 0, promotions: 0, human_approvals: 0,
  note: 'Relocated snapshots only. Acceptance and ledger remain in memory; normalized source review is a synthetic fixture, not selected production evidence.',
  tests: checks, actual_production_receipt: identity(path.join(sourceDir, 'grading.json')), fixture_directory: rel(fixture) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ checks: checks.length, api_calls: 0 }));
