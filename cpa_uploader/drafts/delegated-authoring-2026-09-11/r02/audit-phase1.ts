import fs from 'node:fs';
import path from 'node:path';
import { jsonHash, reviewedContentHash, sha256 } from '../../../questionReviewIdentity.ts';
import { validateReviewGrading } from '../../../questionReviewGrading.ts';
import { prepareSemanticReview, semanticReceiptIntegrityErrors } from '../../../questionSemanticReview.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { validateQuestionSetV3, computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';

const root = process.cwd();
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/r02';
const originalFile = 'cpa_uploader/drafts/frequency-gap-2026-09-10/release/per-set/pilot-05-008.json';
const receiptFile = originalFile.replace('.json', '.review.json');
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const original = read(originalFile)[0];
const receipt = read(receiptFile).reviews[0];
const candidate = read(`${folder}/pilot-05-008.json`)[0];
const plan = read(`${folder}/pilot-05-008.authoring-plan.json`);
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const initial = read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json');
const baseline = read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/input-baseline.json');
const graderFiles = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts', 'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts'];
const currentGraderHash = sha256(graderFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n'));
const strictMismatches = receipt.grading.runs.flatMap((run: any) => run.expected.filter((expected: any) => {
    const actual = run.result.subquestions.find((q: any) => q.subquestion_id === expected.subquestion_id)?.criteria.find((c: any) => c.criterion_id === expected.criterion_id)?.verdict;
    return actual !== expected.verdict;
}).map((expected: any) => ({ run_id: run.id, expected })));
const prepared = prepareSemanticReview(original, { bank, authoringPlan: receipt.context.authoring_plan, maxInputChars: 200000 });
const candidatePrepared = prepareSemanticReview(candidate, { bank: initial, authoringPlan: plan, maxInputChars: 200000 });
const canonicalCases = receipt.cases;
const criterionCoverage = original.subquestions.flatMap((q: any) => q.criteria.map((c: any) => ({
    subquestion_id: q.id, criterion_id: c.id,
    recorded_kinds: canonicalCases.filter((sample: any) => sample.unit_id === `criterion:${q.id}:${c.id}`).map((sample: any) => sample.kind),
    recorded_conditions_are_primarily_answer_scope_variants: true,
})));
const proposalResult = validateAuthoringBank([...bank.filter((set: any) => set.id !== candidate.id), candidate]);
const result = {
    checked_at: new Date().toISOString(), phase: 'phase1_no_model_calls',
    original_file: originalFile, original_sha256: sha256(fs.readFileSync(originalFile)),
    candidate_file: `${folder}/pilot-05-008.json`, candidate_sha256: sha256(fs.readFileSync(`${folder}/pilot-05-008.json`)),
    receipt_file: receiptFile, receipt_file_sha256: sha256(fs.readFileSync(receiptFile)),
    original_content_hash: reviewedContentHash(original), receipt_content_matches: reviewedContentHash(original) === receipt.content_hash,
    candidate_content_hash: reviewedContentHash(candidate),
    receipt_integrity_errors: semanticReceiptIntegrityErrors(receipt, true),
    original_grading_replay_errors_current_code: validateReviewGrading(receipt.grading, original, receipt.cases, false),
    candidate_grading_replay_errors_current_code: validateReviewGrading(receipt.grading, candidate, receipt.cases, false),
    replay_is_new_live_call: false,
    old_semantic_method: receipt.execution.method, old_semantic_model: receipt.execution.model,
    old_grading_model: receipt.grading.model, old_grader_hash: receipt.grading.grader_hash, current_grader_hash: currentGraderHash,
    grader_hash_equal: receipt.grading.grader_hash === currentGraderHash,
    prior_runs: receipt.grading.runs.length, prior_matched_runs: receipt.grading.runs.filter((r: any) => r.matched).length,
    prior_nonblank_model_runs: receipt.grading.runs.filter((r: any) => r.id !== 'empty-answer').length,
    prior_empty_no_model_runs: receipt.grading.runs.filter((r: any) => r.id === 'empty-answer').length,
    prior_cases: receipt.cases.length, prior_cases_hash_matches: jsonHash(receipt.cases) === receipt.grading.cases_hash,
    strict_expected_actual_mismatches: strictMismatches,
    old_bank_hash: receipt.bank_hash, current_bank_semantic_hash: prepared.bankHash,
    bank_semantic_hash_equal: receipt.bank_hash === prepared.bankHash,
    current_original_context_hash: jsonHash(prepared.context), old_context_hash: receipt.context_hash,
    source_hash_matches: receipt.source_files.map((s: any) => ({ ...s, current_sha256: sha256(fs.readFileSync(s.file)), matches: s.sha256 === sha256(fs.readFileSync(s.file)) })),
    baseline_file_checks: baseline.files.map((f: any) => ({ file: f.file, expected: f.sha256, current: sha256(fs.readFileSync(f.file)), matches: f.sha256 === sha256(fs.readFileSync(f.file)) })),
    criterion_coverage: criterionCoverage,
    counts: { sets: 1, questions: candidate.subquestions.length, criteria: candidate.subquestions.reduce((n: number, q: any) => n + q.criteria.length, 0), points: computeQuestionSetMaxPoints(candidate) },
    candidate_static: validateQuestionSetV3(candidate, { verifySourceQuotes: true, cwd: root }),
    candidate_plan_errors: validateQuestionAuthoringPlan(plan),
    in_memory_bank_validation: proposalResult,
    initial_comparison_only: { bank_hash: candidatePrepared.bankHash, request_chars: candidatePrepared.requestChars, unit_count: candidatePrepared.units.length },
    reuse_decision: '기존51회는 역사적실측으로보존. 현행raw재처리는새모델호출이아님. 현행비교은행과독립모델의미검수, 추가QA, 후속문맥변경에대한최종검증은2차에서수행.',
};
const evidenceFile = `${folder}/evidence/phase1/static-and-reuse-${Date.now()}.json`;
fs.writeFileSync(evidenceFile, JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(`${folder}/evidence/phase1/latest-static.json`, JSON.stringify({ evidence_file: evidenceFile, sha256: sha256(fs.readFileSync(evidenceFile)) }, null, 2) + '\n');
console.log(JSON.stringify({ counts: result.counts, grader_hash_equal: result.grader_hash_equal, bank_semantic_hash_equal: result.bank_semantic_hash_equal,
    prior_runs: result.prior_runs, strict_mismatches: strictMismatches.length,
    original_replay_errors: result.original_grading_replay_errors_current_code, candidate_replay_errors: result.candidate_grading_replay_errors_current_code,
    candidate_static: result.candidate_static, plan_errors: result.candidate_plan_errors, in_memory_errors: proposalResult.errors,
    request_chars: candidatePrepared.requestChars }, null, 2));
