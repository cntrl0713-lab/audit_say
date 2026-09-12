// Pure in-memory contract fixture. No CLI promotion, approval, receipt or ledger is written.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { prepareSemanticReview, validateSemanticReviewReceipt, validateRecordedSemanticReview } from '../../../../../questionSemanticReview.ts';
import { validatePromotionLedger } from '../../../../../questionBankPublication.ts';
import { jsonHash, reviewedContentHash, sha256 } from '../../../../../questionReviewIdentity.ts';
import { offlineReviewReceipt } from '../../../../../../tests/helpers/questionSemanticReviewFixture.ts';

const owned = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(owned, '../../../../../..');
const review = path.resolve(owned, '../..');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const canonicalFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const ledgerFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.promotions.json');
const candidateFile = path.join(review, 'prepared-reviewed-v6/candidate-authoring.json');
const codeFiles = ['cpa_uploader/promote_cpa_v3.ts', 'cpa_uploader/questionSemanticReview.ts',
  'cpa_uploader/questionBankPublication.ts', 'cpa_uploader/questionReviewIdentity.ts',
  'cpa_uploader/questionReviewGrading.ts', 'lib/questionV3Grading.ts',
  'tests/helpers/questionSemanticReviewFixture.ts'];
const protectedFiles = [...codeFiles.map(file => path.join(root, file)), canonicalFile, ledgerFile, candidateFile];
const before = protectedFiles.map(file => ({ file: relative(file), sha256: sha256(fs.readFileSync(file)) }));
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('NETWORK_DISABLED_IN_CONTRACT_FIXTURE'); };
const canonical = read(canonicalFile);
const checks = [];
function pass(id, actual, expected = true) { assert.deepEqual(actual, expected, id); checks.push({ id, passed: true }); }
function errorsCheck(id, errors, pattern) { assert.ok(errors.some(error => pattern.test(error)), `${id}: ${errors.join('; ')}`); checks.push({ id, passed: true, observed_errors: errors }); }
const makeSet = (id, source) => {
  const set = structuredClone(source); set.id = id; set.status = 'needs_review'; set.verification.review_status = 'needs_human_review';
  set.verification.notes = ['IN_MEMORY_CONTRACT_FIXTURE_ONLY: no actual content review or approval'];
  return set;
};
const a = makeSet('sequence-contract-a', canonical[0]);
const b = makeSet('sequence-contract-b', canonical[1]);
const bank0 = [a, b];
// Existing test helper makes synthetic verdict/transport fields only. Never export them.
const receiptA = await offlineReviewReceipt(a, bank0);
const hashA = jsonHash(receiptA);
pass('fresh_acceptance_original_bank', validateSemanticReviewReceipt(receiptA, a, { bank: bank0 }), []);
const bank1 = structuredClone(bank0);
bank1[1].subquestions[0].prompt += ' [independent peer mutation fixture]';
errorsCheck('unrecorded_old_receipt_rejected_after_peer_content_change', validateSemanticReviewReceipt(receiptA, bank1[0], { bank: bank1 }), /비교 은행/);
pass('recorded_reader_ignores_peer_bank_but_is_not_a_new_acceptance_path', validateRecordedSemanticReview(receiptA, bank1[0]), []);
const lifecycle = structuredClone(bank0);
lifecycle[1].status = 'verified'; lifecycle[1].verification.review_status = 'verified';
pass('only_lifecycle_labels_do_not_change_bank_hash', prepareSemanticReview(a, { bank: lifecycle }).bankHash, receiptA.bank_hash);
pass('bank_order_does_not_change_peer_hash', prepareSemanticReview(a, { bank: [...bank0].reverse() }).bankHash, receiptA.bank_hash);
pass('own_lifecycle_does_not_change_content_hash', reviewedContentHash(lifecycle[1]), reviewedContentHash(b));
const event = (set, receipt) => ({ set_id: set.id, from_status: set.status, to_status: 'verified', date: '2000-01-01',
  evidence: 'IN_MEMORY_CONTRACT_FIXTURE_NOT_AN_APPROVAL', content_hash: reviewedContentHash(set), semantic_review: receipt,
  review_receipt_hash: receipt.receipt_hash, review_summary: { units: receipt.units.length, cases: receipt.cases.length, method: receipt.execution.method, verdict: 'pass' } });
const memoryLedger = { version: 1, entries: [event(a, receiptA)] };
const stage = structuredClone(bank0); stage[0].status = 'verified'; stage[0].verification.review_status = 'verified';
pass('record_A_while_new_B_is_pending', validatePromotionLedger(stage, memoryLedger), []);
stage[1] = bank1[1];
pass('later_pending_B_content_change_preserves_recorded_A', validatePromotionLedger(stage, memoryLedger), []);
errorsCheck('cannot_publish_full_bank_while_other_set_pending', validatePromotionLedger(stage, memoryLedger, true), /status=published/);
const receiptB = await offlineReviewReceipt(stage[1], stage);
pass('new_B_receipt_accepted_against_updated_bank', validateSemanticReviewReceipt(receiptB, stage[1], { bank: stage }), []);
memoryLedger.entries.push(event(stage[1], receiptB)); stage[1].status = 'verified'; stage[1].verification.review_status = 'verified';
pass('different_epoch_recorded_receipts_coexist', validatePromotionLedger(stage, memoryLedger), []);
pass('earlier_receipt_bytes_not_refreshed', jsonHash(memoryLedger.entries[0].semantic_review), hashA);
const touched = structuredClone(stage[0]); touched.subquestions[0].prompt += ' [own content change]';
errorsCheck('own_content_change_still_invalidates_recorded_receipt', validateRecordedSemanticReview(receiptA, touched), /내용 해시|draft/);
const rehash = value => { const copy = { ...value }; delete copy.receipt_hash; value.receipt_hash = jsonHash(copy); return value; };
const alteredSource = structuredClone(receiptA); alteredSource.source_files[0].sha256 = '0'.repeat(64); rehash(alteredSource);
errorsCheck('recorded_reader_still_checks_actual_source_files', validateRecordedSemanticReview(alteredSource, stage[0]), /source 파일/);
const alteredMetadata = structuredClone(receiptA); alteredMetadata.context.source_metadata[0].note += ' fixture mutation';
alteredMetadata.context_hash = jsonHash(alteredMetadata.context); rehash(alteredMetadata);
errorsCheck('recorded_reader_still_checks_source_authority_metadata', validateRecordedSemanticReview(alteredMetadata, stage[0]), /권위\/판본 metadata/);
const injected = structuredClone(receiptA); injected.grading.transport = 'injected_response'; rehash(injected);
errorsCheck('injected_grading_cannot_be_new_approval', validateSemanticReviewReceipt(injected, a, { bank: bank0 }), /주입 응답/);
const savedModel = process.env.CPA_GRADING_MODEL;
try {
  process.env.CPA_GRADING_MODEL = 'contract-fixture-different-model';
  errorsCheck('new_acceptance_requires_current_grader_model', validateSemanticReviewReceipt(receiptA, a, { bank: bank0 }), /채점 모델 설정/);
  pass('historical_record_preserves_prior_grader_model_but_replays_scores', validateRecordedSemanticReview(receiptA, a), []);
} finally { if (savedModel === undefined) delete process.env.CPA_GRADING_MODEL; else process.env.CPA_GRADING_MODEL = savedModel; }
const modifiedApproved = structuredClone(stage);
modifiedApproved[0].subquestions[0].prompt += ' [approved A edit]'; modifiedApproved[1].subquestions[0].prompt += ' [approved B edit]';
errorsCheck('partial_reverification_does_not_waive_other_changed_approved_set', validatePromotionLedger(modifiedApproved, memoryLedger, false, { pendingReverificationIds: new Set([a.id]) }), new RegExp(`${b.id}.*내용|${b.id}.*해시`));
pass('all_changed_approved_ids_can_clear_precheck_only', validatePromotionLedger(modifiedApproved, memoryLedger, false, { pendingReverificationIds: new Set([a.id, b.id]) }), []);
const resetApproved = structuredClone(stage); resetApproved[1].status = 'needs_review'; resetApproved[1].verification.review_status = 'needs_human_review';
errorsCheck('resetting_approved_id_to_draft_does_not_erase_history', validatePromotionLedger(resetApproved, memoryLedger), /장부와 needs_review 상태가 불일치/);

// Actual repository inputs are only read. This is diagnosis, never a promotion.
const candidate = read(candidateFile); const actualLedger = read(ledgerFile);
const ledgerPrecheck = validatePromotionLedger(candidate, actualLedger);
const historyConflictIds = candidate.filter(set => set.status === 'needs_review' && actualLedger.entries.some(entry => entry.set_id === set.id)).map(set => set.id);
pass('real_candidate_history_conflicts_are_reported', ledgerPrecheck.filter(error => /장부와 needs_review 상태가 불일치/.test(error)).length, historyConflictIds.length);
pass('network_calls_zero', networkAttempts, 0);
for (const snapshot of before) pass(`protected_bytes:${snapshot.file}`, sha256(fs.readFileSync(path.join(root, snapshot.file))), snapshot.sha256);
const output = { version: 1, purpose: 'in-memory publication sequence contract study', api_calls: 0, cli_promotions: 0,
  approvals_created: 0, ledgers_or_receipts_written: 0,
  synthetic_fixture_warning: 'Only transport/validation-gate mechanics were exercised using existing test helpers. No model reviewed content; no person approved it. Synthetic receipts and ledger entries remain exclusively in memory.',
  code_and_input_snapshots: before, checks,
  real_candidate_diagnosis: { file: relative(candidateFile), sha256: sha256(fs.readFileSync(candidateFile)),
    status_counts: candidate.reduce((counts, set) => ({ ...counts, [set.status]: (counts[set.status] || 0) + 1 }), {}),
    original_ledger_file: relative(ledgerFile), history_conflict_ids: historyConflictIds, prior_validation_errors: ledgerPrecheck },
  limits: ['CLI entire-bank topic/count/structure gate is inspected in source but the 2-set fixture does not call it.',
    'There is no source-file mutation fixture; the stored identity is tampered in memory to exercise comparison without editing originals.',
    'No runtime provenance or independent human evidence is manufactured or promoted.'] };
fs.writeFileSync(path.join(owned, 'checks.json'), `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ checks: checks.length, all_passed: true, api_calls: 0, real_history_conflicts: historyConflictIds.length,
  real_prior_validation_errors: ledgerPrecheck.length, output: relative(path.join(owned, 'checks.json')) }));
