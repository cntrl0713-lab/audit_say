import type { BatchItem } from './serverUtils';
import { validateRubric, flattenRubricVariants } from './rubric.ts';

/** Minimal question shape needed to hydrate a model answer. */
export interface QuestionAnswerRow {
    id: number | string;
    model_answer?: string | string[] | null;
    keywords?: any;
    explanation?: string | null;
}

/**
 * Fill each batch item's model-answer field (`m`), keywords (`k`), and explanation/rubric (`r`) 
 * from the matching question.
 *
 * It will try to use v2 questions if present, falling back to v1 logic if v2 is absent 
 * or has invalid rubric data.
 */
export function hydrateModelAnswers(
    items: BatchItem[], 
    questionsV2?: any[]
): void {
    for (const item of items) {
        // 1. v2 레코드 매칭 검색
        let v2Match: any = null;
        if (questionsV2 && Array.isArray(questionsV2)) {
            v2Match = questionsV2.find((row) => row.id.toString() === item.qid.toString());
        }

        // v2 매칭 검증 및 수화
        if (v2Match) {
            const rubric = v2Match.rubric;
            const validationErrors = validateRubric(rubric);
            if (validationErrors.length === 0) {
                item.m = Array.isArray(v2Match.model_answer) ? v2Match.model_answer.join('\n') : String(v2Match.model_answer || '');
                item.k = flattenRubricVariants(rubric);
                item.r = JSON.stringify(rubric);
                item.invalid = false;
            } else {
                console.warn(`⚠️ [hydrateModelAnswers] 문제 ${item.qid}의 v2 루브릭 검증 실패. 오류:`, validationErrors);
                item.invalid = true;
                item.errorMsg = `루브릭 검증 실패: ${validationErrors.join(', ')}`;
                // 클라이언트가 보낸 m/k를 그대로 흘려보내지 않는다 — invalid 항목도 항상 서버가 값을 확정한다.
                item.m = '';
                item.k = [];
            }
        } else {
            console.warn(`⚠️ [hydrateModelAnswers] 문제 ${item.qid}의 v2 루브릭 데이터를 찾을 수 없습니다.`);
            item.invalid = true;
            item.errorMsg = '해당 문항의 v2 루브릭 데이터를 찾을 수 없습니다.';
            item.m = '';
            item.k = [];
        }
    }
}

/** Normalize a model answer (array or scalar) into the newline-joined string the grader expects. */
export function stringifyModelAnswer(modelAnswer: string | string[] | null | undefined): string {
    if (Array.isArray(modelAnswer)) return modelAnswer.join('\n');
    return String(modelAnswer ?? '');
}
