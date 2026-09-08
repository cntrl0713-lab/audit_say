import type { PublicLearningQuestionSetV3, LeaderboardEntry } from './learningTypes.ts';
import type { QuestionSetGradeResultV3 } from './questionV3Grading.ts';

type Row = Record<string, unknown>;
function row(value: unknown): Row {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('저장 데이터 형식이 올바르지 않습니다.');
    return value as Row;
}
function str(value: unknown): string {
    if (typeof value !== 'string') throw new Error('저장 데이터 문자열 형식이 올바르지 않습니다.');
    return value;
}
function list(value: unknown): unknown[] {
    if (!Array.isArray(value)) throw new Error('저장 데이터 배열 형식이 올바르지 않습니다.');
    return value;
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
    if (typeof value !== 'string' || !options.includes(value as T)) throw new Error('저장 데이터 분류가 올바르지 않습니다.');
    return value as T;
}
export function safeInteger(value: unknown): number {
    if (!(typeof value === 'number' || typeof value === 'string' && /^-?\d+$/.test(value))) throw new Error('저장 데이터 숫자가 올바르지 않습니다.');
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error('저장 데이터가 안전한 정수 범위를 벗어났습니다.');
    return number;
}

/** Never spread database rows into client payloads, even when the RPC is intended to be public. */
export function publicLearningSet(value: unknown): PublicLearningQuestionSetV3 {
    const envelope = row(value);
    const set = row(envelope.question_set);
    const classification = row(set.classification);
    return {
        id: str(set.id), type: 'linked_question_set', title: str(set.title),
        release_id: str(envelope.release_id), set_version_id: str(envelope.set_version_id),
        classification: {
            topic_id: str(classification.topic_id), part: str(classification.part), chapter: str(classification.chapter),
            domain: choice(classification.domain, ['audit', 'ethics', 'law', 'internal_control', 'other']),
            standards: list(classification.standards).map(str), tags: list(classification.tags).map(str),
        },
        sources: list(set.sources).map((value) => {
            const source = row(value);
            return { id: str(source.id), title: str(source.title), ...(source.page == null ? {} : { page: str(source.page) }), role: choice(source.role, ['question', 'answer', 'standard', 'practice']) };
        }),
        shared_context: { facts: list(row(set.shared_context).facts).map((value) => {
            const fact = row(value);
            if (fact.scoreable !== false) throw new Error('공통 지문 채점 계약이 올바르지 않습니다.');
            return { id: str(fact.id), text: str(fact.text), scoreable: false };
        }) },
        learning_order: list(set.learning_order).map(str),
        subquestions: list(set.subquestions).map((value) => {
            const sub = row(value);
            const constraints = row(sub.constraints);
            const selection = row(sub.selection);
            const maxEntries = constraints.max_entries === null ? null : safeInteger(constraints.max_entries);
            if (typeof constraints.ordered !== 'boolean' || maxEntries !== null && maxEntries <= 0
                || selection.type !== 'all' || selection.n !== null) throw new Error('저장된 물음의 제한 형식이 올바르지 않습니다.');
            return {
                id: str(sub.id), type: choice(sub.type, ['descriptive', 'enumeration', 'judgment']), prompt: str(sub.prompt),
                ...(sub.logical_subquestion_id == null ? {} : { logical_subquestion_id: str(sub.logical_subquestion_id) }),
                constraints: { ordered: constraints.ordered, max_entries: maxEntries, overflow_policy: choice(constraints.overflow_policy, ['none', 'ignore_after_limit']) },
                selection: { type: 'all' as const, n: null },
                ...(sub.decision == null ? {} : { decision: { options: list(row(sub.decision).options).map(str) } }),
                answer_slots: list(sub.answer_slots).map((value) => { const slot = row(value); return { id: str(slot.id), label: str(slot.label), input: choice(slot.input, ['text', 'textarea', 'choice']) }; }),
                max_points: safeInteger(sub.max_points),
            };
        }),
        max_points: safeInteger(set.max_points),
    };
}

export function publicGradeResult(value: unknown): QuestionSetGradeResultV3 {
    const result = row(value);
    return {
        question_set_id: str(result.question_set_id), score: safeInteger(result.score), max_points: safeInteger(result.max_points),
        security_flag: choice(result.security_flag, ['none', 'injection', 'keyword_salad']),
        subquestions: list(result.subquestions).map((value) => {
            const sub = row(value);
            return {
                subquestion_id: str(sub.subquestion_id), prompt: str(sub.prompt), user_answer: str(sub.user_answer),
                score: safeInteger(sub.score), max_points: safeInteger(sub.max_points), model_answer: list(sub.model_answer).map(str),
                criteria: list(sub.criteria).map((value) => {
                    const criterion = row(value);
                    return {
                        criterion_id: str(criterion.criterion_id), claim: str(criterion.claim),
                        verdict: choice(criterion.verdict, ['met', 'partial', 'not_met', 'contradicted']),
                        max_points: safeInteger(criterion.max_points), awarded_points: safeInteger(criterion.awarded_points),
                        ...(criterion.quote == null ? {} : { quote: str(criterion.quote) }),
                        ...(['AI가 제시한 인용을 사용자 답안에서 확인할 수 없음', '이 criterion은 부분점수를 허용하지 않음'].includes(String(criterion.reason))
                            ? { reason: str(criterion.reason) } : {}),
                    };
                }),
            };
        }),
    };
}

export function publicLeaderboard(value: unknown): LeaderboardEntry[] {
    return list(value).map((value) => { const entry = row(value); return {
        rank: safeInteger(entry.rank), username: str(entry.username), role: choice(entry.role, ['MEMBER', 'PRO', 'ADMIN', 'GUEST']),
        level: safeInteger(entry.level), exp: safeInteger(entry.exp),
    }; });
}
