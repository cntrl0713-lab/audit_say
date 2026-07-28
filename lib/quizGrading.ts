import type { BatchItem, GradeRequestItem } from './serverUtils';
import { validateRubric, flattenRubricVariants } from './rubric.ts';

/** Minimal question shape needed to hydrate a model answer. */
export interface QuestionAnswerRow {
    id: number | string;
    question_title?: string | null;
    question_description?: string | null;
    model_answer?: string | string[] | null;
    keywords?: any;
    explanation?: string | null;
}

/** 채점 프롬프트에 들어갈 질문 본문을 DB 행에서 만든다. */
function buildQuestionText(row: QuestionAnswerRow): string {
    const title = typeof row?.question_title === 'string' ? row.question_title.trim() : '';
    const description = typeof row?.question_description === 'string' ? row.question_description.trim() : '';
    if (title && description) return `${title} - ${description}`;
    return title || description;
}

/**
 * 채점 요청(GradeRequestItem)을 DB 값으로 채워 BatchItem 배열을 만든다.
 *
 * 질문 본문(q), 모범 답안(m), 키워드(k), 루브릭(r)은 **전부 여기서 서버가 확정한다.**
 * 클라이언트는 id·qid·답안만 보내므로, 프롬프트에 들어가는 값 중 사용자가 통제할 수 있는
 * 것은 답안뿐이고 그 답안은 채점 프롬프트에서 구분자로 격리된다.
 *
 * 매칭되는 v2 레코드가 없거나 루브릭 검증에 실패하면 invalid로 표시하고, 프롬프트에
 * 들어갈 값은 전부 빈 값으로 확정한다.
 */
export function hydrateModelAnswers(
    requests: GradeRequestItem[],
    questionsV2?: any[]
): BatchItem[] {
    return requests.map((request) => {
        const item: BatchItem = {
            id: request.id,
            qid: request.qid,
            a: request.a,
            q: '',
            m: '',
            k: [],
            r: '',
        };

        // 1. v2 레코드 매칭 검색
        let v2Match: any = null;
        if (questionsV2 && Array.isArray(questionsV2)) {
            v2Match = questionsV2.find((row) => row.id.toString() === item.qid.toString());
        }

        if (!v2Match) {
            console.warn(`⚠️ [hydrateModelAnswers] 문제 ${item.qid}의 v2 루브릭 데이터를 찾을 수 없습니다.`);
            item.invalid = true;
            item.errorMsg = '해당 문항의 v2 루브릭 데이터를 찾을 수 없습니다.';
            return item;
        }

        // 2. 루브릭 검증 후 수화
        const rubric = v2Match.rubric;
        const validationErrors = validateRubric(rubric);
        if (validationErrors.length > 0) {
            console.warn(`⚠️ [hydrateModelAnswers] 문제 ${item.qid}의 v2 루브릭 검증 실패. 오류:`, validationErrors);
            item.invalid = true;
            item.errorMsg = `루브릭 검증 실패: ${validationErrors.join(', ')}`;
            return item;
        }

        item.q = buildQuestionText(v2Match);
        item.m = stringifyModelAnswer(v2Match.model_answer);
        item.k = flattenRubricVariants(rubric);
        item.r = JSON.stringify(rubric);
        item.invalid = false;
        return item;
    });
}

/** Normalize a model answer (array or scalar) into the newline-joined string the grader expects. */
export function stringifyModelAnswer(modelAnswer: string | string[] | null | undefined): string {
    if (Array.isArray(modelAnswer)) return modelAnswer.join('\n');
    return String(modelAnswer ?? '');
}
