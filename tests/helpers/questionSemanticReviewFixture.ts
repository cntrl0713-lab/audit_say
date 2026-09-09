import { completeSemanticReview, gradeSemanticReviewReceipt, prepareSemanticReview, REVIEW_CASES, REVIEW_CHECKS } from '../../cpa_uploader/questionSemanticReview.ts';
import type { SemanticReviewReceipt } from '../../cpa_uploader/questionSemanticReview.ts';
import type { Response } from 'openai/resources/responses/responses';
import type { PreparedSemanticReview, SemanticReviewResult, SemanticReviewUnit, SemanticReviewCase } from '../../cpa_uploader/questionSemanticReview.ts';
import type { QuestionSetV3 } from '../../lib/questionV3.ts';

/** Transport/receipt-gate fixture only. It is not a real semantic review or a
 * claim that the synthetic case answers below would be correct exam answers. */
export function offlineReviewResult(prepared: PreparedSemanticReview): SemanticReviewResult {
    const quotes = (unit: PreparedSemanticReview['units'][number]) => unit.sources.map((id) => ({ source_ref_id: id,
        quote: prepared.sources.find((source) => source.source_ref_id === id)!.declared_metadata.source_quote }));
    const units: SemanticReviewUnit[] = prepared.units.map((unit) => ({ id: unit.id,
        checks: Object.fromEntries(REVIEW_CHECKS.map((check) => [check, 'pass'])) as SemanticReviewUnit['checks'],
        rationale: '오프라인 gate fixture: 실제 의미 정확성 검증을 주장하지 않음',
        draft_quotes: Object.entries(unit.fields).map(([field, quote]) => ({ path: field, quote })), source_quotes: quotes(unit) }));
    const cases: SemanticReviewCase[] = prepared.units.filter((unit) => unit.modelAnswer).flatMap((unit) => REVIEW_CASES.map((kind) => {
        const answer = kind === 'model_answer' ? unit.modelAnswer! : `오프라인 ${unit.id} ${kind} 사례`;
        return { unit_id: unit.id, kind, answer, answer_quote: answer, expected: kind === 'omission' ? 'not_met' : kind === 'opposite' ? 'contradicted' : 'met',
            verdict: 'pass', rationale: '오프라인 사례 형상과 인용 검증 fixture. 실제 채점 미실행.', source_quotes: quotes(unit) };
    }));
    return { units, cases, notes: ['오프라인 테스트 전용 합성 응답'] };
}
export async function offlineGradeReceipt(receipt: SemanticReviewReceipt, set: QuestionSetV3, bank: QuestionSetV3[], root = process.cwd()) {
    return gradeSemanticReviewReceipt(receipt, set, { bank, root, apiKey: 'offline-callback-test-key' }, async (request) => {
        const payload = JSON.parse(String(request.input).split('<<<GRADING_PAYLOAD_START>>>')[1].split('<<<GRADING_PAYLOAD_END>>>')[0]);
        const subquestions = set.subquestions.map((sub) => {
            const answer = payload.subquestions.find((item: { subquestion_id: string }) => item.subquestion_id === sub.id).user_answer;
            return { subquestion_id: sub.id, injection_detected: false, salad_detected: false, verdicts: sub.criteria.map((criterion) => {
                const sample = receipt.cases.find((item) => item.unit_id === `criterion:${sub.id}:${criterion.id}` && item.answer === answer);
                const verdict = sample?.expected || 'not_met';
                return { criterion_id: criterion.id, verdict, quote: verdict === 'not_met' ? null : answer, reason: '오프라인 주입 판정. 실제 모델 품질 실측 아님.' };
            }) };
        });
        return { status: 'completed', output: [], output_text: JSON.stringify({ subquestions, injection_detected: false, salad_detected: false }) } as unknown as Response;
    });
}
export async function offlineReviewReceipt(set: QuestionSetV3, bank: QuestionSetV3[], root = process.cwd()) {
    const prepared = prepareSemanticReview(set, { bank, root });
    const receipt = completeSemanticReview(prepared, offlineReviewResult(prepared), { method: 'manual_reasoned', model: null,
        performed_at: '2026-09-09T00:00:00Z', description: '테스트용 구조화 fixture 주입. 실제 검수·게시 승인이 아님.' });
    return offlineGradeReceipt(receipt, set, bank, root);
}
