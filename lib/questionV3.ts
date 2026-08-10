import fs from 'node:fs';
import path from 'node:path';

export type QuestionTypeV3 = 'descriptive' | 'enumeration' | 'judgment';
export type ReviewStatusV3 = 'needs_human_review' | 'verified' | 'published';
export type CriterionVerdictNameV3 = 'met' | 'partial' | 'not_met' | 'contradicted';

export interface SourceRefV3 {
    id: string;
    file: string;
    title?: string;
    page?: string;
    source_quote: string;
    role: 'question' | 'answer' | 'standard' | 'practice';
    content_hash?: string;
}

export interface RequirementV3 {
    id: string;
    source_ref_id: string;
    source_quote: string;
    source_span?: string;
}

export interface CriterionScoresV3 {
    met: number;
    partial?: number;
    not_met: 0;
    contradicted: 0;
}

export interface CriterionV3 {
    id: string;
    requirement_id: string;
    claim: string;
    critical_facts: Array<{
        id: string;
        type: 'actor' | 'condition' | 'action' | 'conclusion' | 'number' | 'negation';
        expected: string;
    }>;
    max_points: 1 | 2 | 3;
    scores: CriterionScoresV3;
    source_ref_ids: string[];
}

export interface SubquestionV3 {
    id: string;
    type: QuestionTypeV3;
    prompt: string;
    constraints: {
        ordered: boolean;
        max_entries: number | null;
        overflow_policy: 'none' | 'ignore_after_limit';
    };
    selection: {
        type: 'all' | 'best_n' | 'at_least_n';
        n: number | null;
    };
    decision?: {
        options: string[];
        correct: string;
    } | null;
    answer_slots?: Array<{
        id: string;
        label: string;
        input: 'text' | 'textarea' | 'choice';
    }>;
    model_answer: string[];
    requirements: RequirementV3[];
    criteria: CriterionV3[];
}

export interface QuestionSetV3 {
    schema_version: '3.0';
    id: string;
    type: 'linked_question_set';
    status: 'needs_review' | 'verified' | 'published';
    title: string;
    classification: {
        topic_id: string;
        part: string;
        chapter: string;
        domain: 'audit' | 'ethics' | 'law' | 'internal_control' | 'other';
        standards: string[];
        tags: string[];
    };
    source_refs: SourceRefV3[];
    shared_context: {
        facts: Array<{ id: string; text: string; scoreable: false }>;
    };
    learning_order: string[];
    subquestions: SubquestionV3[];
    verification: {
        source_fidelity: 'exact' | 'normalized' | 'reconstructed';
        review_status: ReviewStatusV3;
        calculation_required: boolean;
        notes: string[];
    };
}

export interface PublicQuestionSetV3 {
    id: string;
    type: 'linked_question_set';
    title: string;
    classification: QuestionSetV3['classification'];
    sources: Array<{
        id: string;
        title: string;
        page?: string;
        role: SourceRefV3['role'];
    }>;
    shared_context: QuestionSetV3['shared_context'];
    learning_order: string[];
    subquestions: Array<{
        id: string;
        type: QuestionTypeV3;
        prompt: string;
        constraints: SubquestionV3['constraints'];
        selection: SubquestionV3['selection'];
        decision?: { options: string[] };
        answer_slots: NonNullable<SubquestionV3['answer_slots']>;
        max_points: number;
    }>;
    max_points: number;
}

export interface CriterionVerdictV3 {
    criterion_id: string;
    verdict: CriterionVerdictNameV3;
    quote?: string;
    reason?: string;
}

export interface ScoredCriterionV3 extends CriterionVerdictV3 {
    claim: string;
    max_points: number;
    awarded_points: number;
}

export interface SubquestionScoreV3 {
    score: number;
    max_points: number;
    criteria: ScoredCriterionV3[];
}

export interface QuestionSetValidationResultV3 {
    errors: string[];
    warnings: string[];
    max_points: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isQuestionSetAnswerPayloadV3(value: unknown): value is Record<string, string> {
    if (!isRecord(value)) return false;

    const entries = Object.entries(value);
    return entries.length <= 10 && entries.every(([id, answer]) => (
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id)
        && typeof answer === 'string'
        && answer.length <= 5000
    ));
}

function normalizeSourceText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizePublicLeakText(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
}

function resolveSourcePath(file: string, cwd: string): string {
    return path.isAbsolute(file) ? file : path.resolve(cwd, file);
}

export function computeSubquestionMaxPoints(subquestion: SubquestionV3): number {
    if (!Array.isArray(subquestion.criteria)) return 0;
    const points = subquestion.criteria
        .map((criterion) => criterion.max_points)
        .filter((points) => Number.isInteger(points) && points > 0);
    if (subquestion.selection?.type !== 'best_n') {
        return points.reduce((sum, value) => sum + value, 0);
    }

    const n = subquestion.selection.n ?? 0;
    return [...points]
        .sort((a, b) => b - a)
        .slice(0, n)
        .reduce((sum, value) => sum + value, 0);
}

export function computeQuestionSetMaxPoints(questionSet: QuestionSetV3): number {
    if (!Array.isArray(questionSet.subquestions)) return 0;
    return questionSet.subquestions.reduce(
        (sum, subquestion) => sum + computeSubquestionMaxPoints(subquestion),
        0,
    );
}

function defaultAnswerSlots(subquestion: SubquestionV3): NonNullable<SubquestionV3['answer_slots']> {
    if (subquestion.answer_slots && subquestion.answer_slots.length > 0) {
        return subquestion.answer_slots;
    }
    return [{ id: `${subquestion.id}.answer`, label: '답안', input: 'textarea' }];
}

export function compilePublicQuestionSet(questionSet: QuestionSetV3): PublicQuestionSetV3 {
    return {
        id: questionSet.id,
        type: questionSet.type,
        title: questionSet.title,
        classification: questionSet.classification,
        sources: questionSet.source_refs.map((source) => ({
            id: source.id,
            title: source.title || path.basename(source.file, path.extname(source.file)),
            ...(source.page ? { page: source.page } : {}),
            role: source.role,
        })),
        shared_context: questionSet.shared_context,
        learning_order: questionSet.learning_order,
        subquestions: questionSet.subquestions.map((subquestion) => ({
            id: subquestion.id,
            type: subquestion.type,
            prompt: subquestion.prompt,
            constraints: subquestion.constraints,
            selection: subquestion.selection,
            ...(subquestion.decision ? { decision: { options: subquestion.decision.options } } : {}),
            answer_slots: defaultAnswerSlots(subquestion),
            max_points: computeSubquestionMaxPoints(subquestion),
        })),
        max_points: computeQuestionSetMaxPoints(questionSet),
    };
}

export function verifyCriterionVerdicts(
    userAnswer: string,
    subquestion: SubquestionV3,
    verdicts: CriterionVerdictV3[],
): CriterionVerdictV3[] {
    const normalizedAnswer = normalizeSourceText(userAnswer);
    const criteriaById = new Map(subquestion.criteria.map((criterion) => [criterion.id, criterion]));
    const verified = verdicts
        .filter((verdict) => criteriaById.has(verdict.criterion_id))
        .map((verdict): CriterionVerdictV3 => {
            if (verdict.verdict === 'not_met') return { ...verdict, quote: undefined };
            const quote = verdict.quote?.trim();
            if (!quote || !normalizedAnswer.includes(normalizeSourceText(quote))) {
                return {
                    criterion_id: verdict.criterion_id,
                    verdict: 'not_met',
                    reason: 'AI가 제시한 인용을 사용자 답안에서 확인할 수 없음',
                };
            }
            return { ...verdict, quote };
        });

    const positiveByQuote = new Map<string, CriterionVerdictV3[]>();
    for (const verdict of verified) {
        if (!verdict.quote || !['met', 'partial'].includes(verdict.verdict)) continue;
        const key = normalizeSourceText(verdict.quote);
        const group = positiveByQuote.get(key) ?? [];
        group.push(verdict);
        positiveByQuote.set(key, group);
    }

    for (const group of positiveByQuote.values()) {
        if (group.length < 2) continue;
        const winner = [...group].sort((left, right) => {
            const pointsDifference = (criteriaById.get(right.criterion_id)?.max_points ?? 0)
                - (criteriaById.get(left.criterion_id)?.max_points ?? 0);
            return pointsDifference || left.criterion_id.localeCompare(right.criterion_id);
        })[0];
        for (const verdict of group) {
            if (verdict === winner) continue;
            verdict.verdict = 'not_met';
            verdict.quote = undefined;
            verdict.reason = '동일한 답안 인용의 중복 득점 방지';
        }
    }

    return verified;
}

export function scoreCriterionVerdicts(
    subquestion: SubquestionV3,
    verdicts: CriterionVerdictV3[],
): SubquestionScoreV3 {
    const verdictById = new Map(verdicts.map((verdict) => [verdict.criterion_id, verdict]));
    const criteria = subquestion.criteria.map((criterion): ScoredCriterionV3 => {
        const provided = verdictById.get(criterion.id);
        const verdict = provided?.verdict ?? 'not_met';
        const awarded = criterion.scores[verdict] ?? 0;
        return {
            criterion_id: criterion.id,
            verdict,
            ...(provided?.quote ? { quote: provided.quote } : {}),
            ...(provided?.reason ? { reason: provided.reason } : {}),
            claim: criterion.claim,
            max_points: criterion.max_points,
            awarded_points: awarded,
        };
    });

    const awardedPoints = criteria.map((criterion) => criterion.awarded_points);
    const score = subquestion.selection.type === 'best_n'
        ? [...awardedPoints]
            .sort((a, b) => b - a)
            .slice(0, subquestion.selection.n ?? 0)
            .reduce((sum, value) => sum + value, 0)
        : awardedPoints.reduce((sum, value) => sum + value, 0);

    return {
        score,
        max_points: computeSubquestionMaxPoints(subquestion),
        criteria,
    };
}

export function validateQuestionSetV3(
    value: unknown,
    options: { verifySourceQuotes?: boolean; cwd?: string } = {},
): QuestionSetValidationResultV3 {
    const errors: string[] = [];
    const warnings: string[] = [];
    const cwd = options.cwd ?? process.cwd();

    if (!isRecord(value)) {
        return { errors: ['문제 세트는 객체여야 합니다.'], warnings, max_points: 0 };
    }

    const questionSet = value as unknown as QuestionSetV3;
    if (questionSet.schema_version !== '3.0') errors.push('schema_version은 3.0이어야 합니다.');
    if (questionSet.type !== 'linked_question_set') errors.push('type은 linked_question_set이어야 합니다.');
    if (!questionSet.id?.trim()) errors.push('문제 세트 id가 필요합니다.');
    if (!questionSet.title?.trim()) errors.push('문제 세트 title이 필요합니다.');
    if (!['needs_review', 'verified', 'published'].includes(questionSet.status)) {
        errors.push('유효한 문제 세트 status가 필요합니다.');
    }
    if (!/^\d{2}$/.test(questionSet.classification?.topic_id || '')) {
        errors.push('classification.topic_id는 두 자리 문자열이어야 합니다.');
    }
    if (!Array.isArray(questionSet.source_refs) || questionSet.source_refs.length === 0) {
        errors.push('source_refs가 최소 하나 필요합니다.');
    }
    if (!Array.isArray(questionSet.subquestions) || questionSet.subquestions.length === 0) {
        errors.push('subquestions가 최소 하나 필요합니다.');
        return { errors, warnings, max_points: 0 };
    }
    const modelAnswers = new Set(questionSet.subquestions.flatMap((subquestion) => (
        Array.isArray(subquestion.model_answer)
            ? subquestion.model_answer
                .filter((answer): answer is string => typeof answer === 'string')
                .map(normalizePublicLeakText)
            : []
    )));
    for (const tag of questionSet.classification?.tags || []) {
        if (typeof tag === 'string' && modelAnswers.has(normalizePublicLeakText(tag))) {
            errors.push(`classification.tags에 model_answer가 노출되어 있습니다: ${tag}`);
        }
    }
    if (questionSet.verification?.calculation_required !== false) {
        errors.push('계산이 필요한 문제는 v3 파일럿에 포함할 수 없습니다.');
    }

    const sourceIds = new Set<string>();
    const sourceContent = new Map<string, string>();
    for (const source of questionSet.source_refs || []) {
        if (!source.id?.trim()) errors.push('모든 source_ref에는 id가 필요합니다.');
        if (sourceIds.has(source.id)) errors.push(`중복 source_ref id: ${source.id}`);
        sourceIds.add(source.id);
        if (!source.file?.trim()) errors.push(`[${source.id}] source file이 필요합니다.`);
        if (!source.source_quote?.trim()) errors.push(`[${source.id}] source_quote가 필요합니다.`);

        if (options.verifySourceQuotes && source.file) {
            const sourcePath = resolveSourcePath(source.file, cwd);
            if (!fs.existsSync(sourcePath)) {
                errors.push(`[${source.id}] source_quote 확인 실패: source file을 찾을 수 없습니다 (${source.file}).`);
            } else {
                const content = normalizeSourceText(fs.readFileSync(sourcePath, 'utf8'));
                sourceContent.set(source.id, content);
                if (source.source_quote && !content.includes(normalizeSourceText(source.source_quote))) {
                    errors.push(`[${source.id}] source_quote가 source file에 존재하지 않습니다.`);
                }
            }
        }
    }

    const subquestionIds = new Set<string>();
    for (const subquestion of questionSet.subquestions) {
        if (!subquestion.id?.trim()) errors.push('모든 subquestion에는 id가 필요합니다.');
        if (subquestionIds.has(subquestion.id)) errors.push(`중복 subquestion id: ${subquestion.id}`);
        subquestionIds.add(subquestion.id);
        if (!['descriptive', 'enumeration', 'judgment'].includes(subquestion.type)) {
            errors.push(`[${subquestion.id}] 지원하지 않는 문제 유형입니다.`);
        }
        if (!subquestion.prompt?.trim()) errors.push(`[${subquestion.id}] prompt가 필요합니다.`);
        if (!subquestion.constraints || typeof subquestion.constraints.ordered !== 'boolean') {
            errors.push(`[${subquestion.id}] constraints 형식이 올바르지 않습니다.`);
        }
        if (!subquestion.selection || !['all', 'best_n', 'at_least_n'].includes(subquestion.selection.type)) {
            errors.push(`[${subquestion.id}] selection 형식이 올바르지 않습니다.`);
        }
        if (!Array.isArray(subquestion.model_answer) || subquestion.model_answer.length === 0) {
            errors.push(`[${subquestion.id}] model_answer가 최소 하나 필요합니다.`);
        }
        if (!Array.isArray(subquestion.requirements) || subquestion.requirements.length === 0) {
            errors.push(`[${subquestion.id}] requirements가 최소 하나 필요합니다.`);
        }
        if (!Array.isArray(subquestion.criteria) || subquestion.criteria.length === 0) {
            errors.push(`[${subquestion.id}] criteria가 최소 하나 필요합니다.`);
            continue;
        }

        const requirementIds = new Set<string>();
        const requirementSources = new Map<string, string>();
        for (const requirement of subquestion.requirements || []) {
            if (requirementIds.has(requirement.id)) errors.push(`[${subquestion.id}] 중복 requirement id: ${requirement.id}`);
            requirementIds.add(requirement.id);
            requirementSources.set(requirement.id, requirement.source_ref_id);
            if (!sourceIds.has(requirement.source_ref_id)) {
                errors.push(`[${requirement.id}] 존재하지 않는 source_ref_id: ${requirement.source_ref_id}`);
            }
            if (!requirement.source_quote?.trim()) {
                errors.push(`[${requirement.id}] source_quote가 필요합니다.`);
            } else if (options.verifySourceQuotes) {
                const content = sourceContent.get(requirement.source_ref_id);
                if (content && !content.includes(normalizeSourceText(requirement.source_quote))) {
                    errors.push(`[${requirement.id}] source_quote가 source file에 존재하지 않습니다.`);
                }
            }
        }

        const criterionIds = new Set<string>();
        for (const criterion of subquestion.criteria) {
            if (criterionIds.has(criterion.id)) errors.push(`[${subquestion.id}] 중복 criterion id: ${criterion.id}`);
            criterionIds.add(criterion.id);
            if (!requirementIds.has(criterion.requirement_id)) {
                errors.push(`[${criterion.id}] 존재하지 않는 requirement_id: ${criterion.requirement_id}`);
            }
            if (!criterion.claim?.trim()) errors.push(`[${criterion.id}] claim이 필요합니다.`);
            if (![1, 2, 3].includes(criterion.max_points)) {
                errors.push(`[${criterion.id}] max_points는 1, 2, 3 중 하나여야 합니다.`);
            }
            if (criterion.scores?.met !== criterion.max_points) {
                errors.push(`[${criterion.id}] scores.met은 max_points와 같아야 합니다.`);
            }
            if (criterion.scores?.not_met !== 0 || criterion.scores?.contradicted !== 0) {
                errors.push(`[${criterion.id}] not_met과 contradicted 점수는 0이어야 합니다.`);
            }
            if (criterion.max_points === 1 && criterion.scores?.partial !== undefined) {
                errors.push(`[${criterion.id}] 1점 criterion은 partial 점수를 가질 수 없습니다.`);
            }
            if (criterion.max_points > 1) {
                const partial = criterion.scores?.partial;
                if (!Number.isInteger(partial) || partial === undefined || partial <= 0 || partial >= criterion.max_points) {
                    errors.push(`[${criterion.id}] 복합 criterion의 partial은 0보다 크고 max_points보다 작은 정수여야 합니다.`);
                }
            }
            const requirementSourceId = requirementSources.get(criterion.requirement_id);
            if (!Array.isArray(criterion.source_ref_ids) || criterion.source_ref_ids.length === 0) {
                errors.push(`[${criterion.id}] source_ref_ids가 최소 하나 필요합니다.`);
            } else if (requirementSourceId && !criterion.source_ref_ids.includes(requirementSourceId)) {
                errors.push(`[${criterion.id}] source_ref_ids는 requirement의 source_ref_id를 포함해야 합니다.`);
            }
            for (const sourceId of criterion.source_ref_ids || []) {
                if (!sourceIds.has(sourceId)) errors.push(`[${criterion.id}] 존재하지 않는 source_ref_id: ${sourceId}`);
            }
        }

        if (subquestion.selection?.type === 'best_n') {
            const n = subquestion.selection.n;
            if (!Number.isInteger(n) || n === null || n <= 0 || n > subquestion.criteria.length) {
                errors.push(`[${subquestion.id}] best_n에는 유효한 n이 필요합니다.`);
            }
            const distinctPoints = new Set(subquestion.criteria.map((criterion) => criterion.max_points));
            if (distinctPoints.size > 1) errors.push(`[${subquestion.id}] best_n criterion의 배점은 모두 같아야 합니다.`);
        }
    }

    const expectedOrder = new Set(questionSet.subquestions.map((subquestion) => subquestion.id));
    if (!Array.isArray(questionSet.learning_order)
        || questionSet.learning_order.length !== expectedOrder.size
        || questionSet.learning_order.some((id) => !expectedOrder.has(id))) {
        errors.push('learning_order는 모든 subquestion id를 정확히 한 번씩 포함해야 합니다.');
    }

    return {
        errors,
        warnings,
        max_points: computeQuestionSetMaxPoints(questionSet),
    };
}
