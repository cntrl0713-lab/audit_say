import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { evaluateBoundProof, hash } from './bounds-prototype.mjs';
import { validateReviewGrading } from '../../../../../questionReviewGrading.ts';
import { validateSemanticReviewReceipt, validateRecordedSemanticReview } from '../../../../../questionSemanticReview.ts';
import { sha256, reviewedContentHash } from '../../../../../questionReviewIdentity.ts';

const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../../../..');
const d = path.resolve(owned, '../..');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const tracked = new Map();
const load = file => { tracked.set(file, sha256(fs.readFileSync(file))); return read(file); };
let attemptedNetworkCalls = 0;
globalThis.fetch = async () => { attemptedNetworkCalls++; throw Error('NETWORK_DISABLED_IN_LOCAL_STUDY'); };
const policyFile = path.join(d, 'grading-inference-followup-v2/minor-error-policy.json');
const policy = load(policyFile);
const bankFile = path.join(d, 'c/prepared-reviewed-v8/candidate-authoring.json');
const bank = load(bankFile);
const manifestFile = path.join(d, 'execution-resumes/resume-2026-09-12-v4/canary/manifest.json');
const manifest = load(manifestFile);
for (const item of manifest.code_files) tracked.set(path.resolve(root, item.file), item.sha256);
const codes = ['cpa_uploader/questionReviewGrading.ts', 'cpa_uploader/questionSemanticReview.ts',
  'cpa_uploader/questionBankPublication.ts', 'cpa_uploader/promote_cpa_v3.ts'];
for (const file of codes) tracked.set(path.resolve(root, file), sha256(fs.readFileSync(path.resolve(root, file))));
const checks = [];
function check(id, actual, expected) { assert.deepEqual(actual, expected, id); checks.push({ id, passed: true }); }
const gradingFile = path.join(d, 'execution-resumes/resume-2026-09-12-v4/canary/grading-b/pilot-05-003/grading.json');
const doc = load(gradingFile); const receipt = doc.reviews[0];
const set = bank.find(set => set.id === receipt.set_id);
const strictErrors = validateReviewGrading(receipt.grading, set, receipt.cases);
check('actual_B_strict_grading_mismatch_retained', strictErrors.length, 1);
check('actual_B_strict_error_is_expected_verdict_failure', strictErrors[0].includes('기대 판정과 다릅니다'), true);
const freshErrors = validateSemanticReviewReceipt(receipt, set, { bank, maxInputChars: 500000 });
check('actual_B_new_acceptance_still_rejects', freshErrors.length, 1);
const historicalErrors = validateRecordedSemanticReview(receipt, set, root);
check('historical_path_does_not_bypass_strict_mismatch', historicalErrors.length, 1);
const localReceiptHash = hash(receipt);
const failed = receipt.grading.runs.filter(run => !run.matched);
check('actual_B_one_original_mismatch', failed.length, 1);
check('actual_B_original_mismatch_stays_false', failed[0].matched, false);

const criterion = id => ({ id, scores: { met: 1, not_met: 0, contradicted: 0 } });
const context = {
  artifact_type: 'trusted_adapter_fixture_not_a_receipt', model: 'gpt-5.6-luna', policy,
  semantic_verdict: 'pass', non_score_errors: [],
  binding: { policy_sha256: tracked.get(policyFile), receipt_sha256: tracked.get(gradingFile),
    content_hash: reviewedContentHash(set), bank_sha256: tracked.get(bankFile),
    original_expected_hash: hash(failed[0].expected), answers_hash: hash(failed[0].answers),
    runtime_manifest_sha256: tracked.get(manifestFile), request_hash: 'fixture-request', schema_hash: 'fixture-schema' },
  selected_review_evidence: [{ file: 'synthetic-source-grounding-fixture', sha256: hash('fixture') }],
  subquestions: [{ id: 'sub1', criteria: ['c1', 'c2', 'c3'].map(criterion) }],
  observations: [{ id: 'observation-1', transport: 'model', security_flag: 'none', raw_security_clear: true,
    trace_schema_valid: true, replay_matches: true, strict_matched: false, subquestions: [{ subquestion_id: 'sub1', score: 1 }] }],
};
const makeProof = c => ({ method: 'conservative_criterion_bounds', expectation_derivation: 'source_prompt_rubric_and_whole_answer',
  binding: structuredClone(c.binding), evidence: structuredClone(c.selected_review_evidence),
  criteria: c.subquestions.flatMap(sub => sub.criteria.map((criterion, index) => ({ subquestion_id: sub.id, criterion_id: criterion.id,
    min: 0, max: index === 0 ? 0 : 1, reason: index === 0 ? 'Certainly absent in fixture answer' : 'Two possible source-grounded readings in fixture' }))),
  observations: c.observations.map(row => ({ id: row.id, sha256: hash(row) })) });
const run = (c, p) => evaluateBoundProof(c, p, { explicitlyRequested: true });
check('default_strict_no_opt_in', evaluateBoundProof(context, makeProof(context)).accepted, false);
check('interval_0_to_2_actual1_worst1', run(context, makeProof(context)).accepted, true);
function reject(id, mutate) { const c = structuredClone(context); const p = makeProof(c); mutate(c, p); check(id, run(c, p).accepted, false); }
reject('interval_0_to_3_actual1_worst2_rejected', (c, p) => { p.criteria[0].max = 1; });
reject('all_valid_observations_required', c => { c.observations.push({ ...structuredClone(c.observations[0]), id: 'omitted-observation-2' }); });
reject('unfavorable_observation_cannot_be_cherry_picked', (c, p) => { c.observations[0].subquestions[0].score = 3; p.observations[0].sha256 = hash(c.observations[0]); });
reject('target_only_expectation_not_full_proof', (c, p) => { p.criteria = [p.criteria[2]]; });
reject('duplicate_criterion_rejected', (c, p) => { p.criteria[1] = structuredClone(p.criteria[0]); });
reject('nonexistent_partial_points_rejected', (c, p) => { p.criteria[0].max = 2; });
reject('no_rounding_fractional_expectation', (c, p) => { p.criteria[0].max = 0.5; });
reject('ambiguous_bound_cannot_masquerade_as_exact', (c, p) => { p.method = 'complete_exact_expectation'; });
reject('actual_dependent_expectation_rejected', (c, p) => { p.expectation_derivation = 'actual_result'; });
reject('missing_source_based_reason', (c, p) => { p.criteria[0].reason = ''; });
reject('missing_source_evidence', (c, p) => { p.evidence = []; });
for (const field of Object.keys(context.binding)) reject(`changed_binding_${field}`, (c, p) => { p.binding[field] = 'changed'; });
for (const error of ['source_defect', 'question_defect', 'answer_defect', 'rubric_defect', 'transport_failure', 'schema_failure', 'persistence_failure', 'missing_raw_trace'])
  reject(`non_score_gate_${error}`, c => { c.non_score_errors.push(error); });
reject('semantic_nonpass', c => { c.semantic_verdict = 'uncertain'; });
reject('policy_cannot_expand_to_two', c => { c.policy.max_absolute_score_delta_per_subquestion = 2; });
reject('wrong_model', c => { c.model = 'gpt-5.6-terra'; });
for (const field of ['raw_security_clear', 'trace_schema_valid', 'replay_matches']) reject(`invalid_${field}`, (c, p) => { c.observations[0][field] = false; p.observations[0].sha256 = hash(c.observations[0]); });
reject('final_security_not_waived', (c, p) => { c.observations[0].security_flag = 'injection'; p.observations[0].sha256 = hash(c.observations[0]); });
reject('injected_transport_not_waived', (c, p) => { c.observations[0].transport = 'injected_response'; p.observations[0].sha256 = hash(c.observations[0]); });
reject('unbound_observation_tamper', c => { c.observations[0].subquestions[0].score = 0; });

// Apply only the arithmetic to A's actual independent source review. This does not
// synthesize a complete model receipt or claim to validate trace provenance.
const aFile = path.join(d, 'a/resume-review-2026-09-12/r4/canary-generated-tolerance-bound-review.json');
const a = load(aFile);
check('A_bound_file_expected_identity', tracked.get(aFile), '53dd0825ec000f69814d85bfdb1db57a23cfcac7550de7c7fcf07ebd32df4470');
const aSet = bank.find(set => set.id === a.set_id);
const ac = structuredClone(context); ac.subquestions = aSet.subquestions.map(sub => ({ id: sub.id, criteria: sub.criteria }));
ac.selected_review_evidence = [{ file: rel(aFile), sha256: tracked.get(aFile) }];
ac.observations[0].id = a.run_id; ac.observations[0].subquestions = a.subquestions.map(sub => ({ subquestion_id: sub.subquestion_id, score: sub.actual }));
const ap = makeProof(ac);
ap.criteria = aSet.subquestions.flatMap(sub => sub.criteria.map(criterion => {
  const bound = a.criterion_bounds.find(row => row.subquestion_id === sub.id && row.criterion_id === criterion.id);
  return bound ? { ...bound } : { subquestion_id: sub.id, criterion_id: criterion.id, min: 0, max: 0, reason: 'Sub2 blank answer, as explicitly recorded by source-review artifact.' };
}));
const aArithmetic = run(ac, ap);
check('actual_A_source_grounded_interval_arithmetic', aArithmetic.accepted, true);
check('actual_A_maximum_deviations', aArithmetic.deviations.map(row => row.worst_absolute_deviation), [1, 0]);
const exact = structuredClone(context); exact.observations = [3, 2, 3].map((score, index) => ({ ...structuredClone(context.observations[0]), id: `B-preserved-${index + 1}`, subquestions: [{ subquestion_id: 'sub1', score }] }));
const exactProof = makeProof(exact); exactProof.method = 'complete_exact_expectation';
exactProof.criteria = exactProof.criteria.map((row, index) => ({ ...row, min: index === 1 ? 0 : 1, max: index === 1 ? 0 : 1, reason: 'Recipient and written form present; communication timeliness absent (actual B source/QA review).' }));
const bArithmetic = run(exact, exactProof);
check('B_all_three_3_2_3_compared_to_exact2', bArithmetic.accepted, true);
check('B_all_three_delta1_0_1_preserved', bArithmetic.deviations.map(row => row.worst_absolute_deviation), [1, 0, 1]);
check('original_actual_receipt_object_preserved', hash(receipt), localReceiptHash);
check('network_attempts_zero', attemptedNetworkCalls, 0);
for (const [file, before] of tracked) check(`preserved:${rel(file)}`, sha256(fs.readFileSync(file)), before);
const output = { version: 1, created_at: new Date().toISOString(), api_calls: 0,
  shared_code_changes: 0, actual_promotions: 0, approvals_created: 0,
  scope: 'Read current production validators and execute arithmetic/identity fixtures only; not a deployable acceptance validator.',
  limitation: 'Prototype trusted adapter inputs are synthetic. It cannot establish source review, actual transport, request/schema/raw security, or human approval. Those gates must be implemented by the production adapter before use.',
  production_observation: { receipt_file: rel(gradingFile), strict_errors: strictErrors, new_acceptance_errors: freshErrors, recorded_errors: historicalErrors },
  actual_A_arithmetic: aArithmetic, actual_B_3_2_3_arithmetic: bArithmetic,
  preserved_inputs: [...tracked].map(([file, sha256]) => ({ file: rel(file), sha256 })), checks };
fs.writeFileSync(path.join(owned, 'checks.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ checks: checks.length, api_calls: 0, output: rel(path.join(owned, 'checks.json')) }));
