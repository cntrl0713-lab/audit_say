import fs from 'node:fs';
import { createHash } from 'node:crypto';

export interface QuestionAuthoringPlan {
    version: 1;
    topic_id: string;
    mode: 'new_from_standard' | 'adapt_existing_question';
    objective: string;
    scope: {
        actors: string[];
        timing: string[];
        conditions: string[];
        exceptions: string[];
        required_answers: string[];
        exclusions: string[];
    };
    question_types: Array<'descriptive' | 'enumeration' | 'judgment'>;
    source_unit_ids: string[];
    existing_question_difference: string;
    edition_assumption: string;
    unresolved_items: string[];
    status: 'draft' | 'ready';
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0);
const placeholder = (value: string) => /TODO|작성하세요|채우세요|미작성|\{\{[^}]+\}\}/iu.test(value);

/** Ready means the author defined a bounded task, not that a question was reviewed. */
export function validateQuestionAuthoringPlan(value: unknown, requireReady = true): string[] {
    if (!record(value)) return ['출제 계획은 객체여야 합니다.'];
    const errors: string[] = [];
    if (value.version !== 1) errors.push('출제 계획 version=1이 필요합니다.');
    if (typeof value.topic_id !== 'string' || !/^(0[1-9]|1[0-9])$/u.test(value.topic_id)) errors.push('유효한 topic_id(01~19)가 필요합니다.');
    if (typeof value.mode !== 'string' || !['new_from_standard', 'adapt_existing_question'].includes(value.mode)) errors.push('출제 경로 mode가 필요합니다.');
    if (typeof value.status !== 'string' || !['draft', 'ready'].includes(value.status)) errors.push('출제 계획 status는 draft 또는 ready여야 합니다.');
    if (requireReady && value.status !== 'ready') errors.push('출제 계획이 미완성입니다. 목표·범위·근거를 확인한 뒤 status=ready로 기록하십시오.');
    for (const key of ['objective', 'existing_question_difference', 'edition_assumption']) {
        const text = value[key];
        if (typeof text !== 'string' || !text.trim() || requireReady && placeholder(text)) errors.push(`출제 계획 ${key}를 구체적으로 작성하십시오.`);
    }
    if (!record(value.scope)) errors.push('출제 계획 scope가 필요합니다.');
    else for (const key of ['actors', 'timing', 'conditions', 'exceptions', 'required_answers', 'exclusions']) {
        const values = value.scope[key];
        if (!strings(values) || values.length === 0 || requireReady && values.some(placeholder)) errors.push(`scope.${key}를 기록하십시오. 적용되지 않는 항목도 이유를 명시하십시오.`);
    }
    if (!strings(value.question_types) || value.question_types.length === 0
        || value.question_types.some(type => !['descriptive', 'enumeration', 'judgment'].includes(type))) errors.push('유효한 question_types가 필요합니다.');
    if (!strings(value.source_unit_ids) || value.source_unit_ids.length === 0
        || new Set(value.source_unit_ids).size !== value.source_unit_ids.length) errors.push('중복 없는 원자료 source_unit_ids가 필요합니다.');
    if (!strings(value.unresolved_items)) errors.push('unresolved_items는 문자열 배열이어야 합니다.');
    else if (requireReady && value.unresolved_items.length > 0) errors.push('출제 범위에 영향을 주는 unresolved_items를 해소한 뒤 생성하십시오.');
    return errors;
}

export function createQuestionAuthoringPlan(topicId: string, sourceIds: string[], mode: QuestionAuthoringPlan['mode'] = 'new_from_standard'): QuestionAuthoringPlan {
    return {
        version: 1, topic_id: topicId, mode, status: 'draft',
        objective: 'TODO: 학습자가 답할 수 있어야 할 판단·정의·절차를 작성하세요.',
        scope: {
            actors: ['TODO: 주체와 대상을 작성하세요.'],
            timing: ['TODO: 적용 시점 또는 비해당 이유를 작성하세요.'],
            conditions: ['TODO: 결론을 바꾸는 전제를 작성하세요.'],
            exceptions: ['TODO: 원문 예외 또는 비해당 이유를 작성하세요.'],
            required_answers: ['TODO: 발문이 요구할 답의 범위를 작성하세요.'],
            exclusions: ['TODO: 이번 물음에서 요구하지 않을 범위를 작성하세요.'],
        },
        question_types: ['descriptive'], source_unit_ids: sourceIds,
        existing_question_difference: 'TODO: 기존 문항과 다른 학습목표·조건·유형을 작성하세요.',
        edition_assumption: 'TODO: 적용 판본과 확인 근거·시험 연도 가정을 작성하세요.',
        unresolved_items: ['학습목표·범위와 출처 문맥을 확인해야 함'],
    };
}

export function authoringPlanHash(plan: QuestionAuthoringPlan): string {
    // Sidecars add set_id; object key order and linkage metadata must not change
    // the identity of the author's actual plan.
    const canonical = {
        version: plan.version, topic_id: plan.topic_id, mode: plan.mode,
        objective: plan.objective,
        scope: {
            actors: plan.scope.actors, timing: plan.scope.timing,
            conditions: plan.scope.conditions, exceptions: plan.scope.exceptions,
            required_answers: plan.scope.required_answers, exclusions: plan.scope.exclusions,
        },
        question_types: plan.question_types, source_unit_ids: plan.source_unit_ids,
        existing_question_difference: plan.existing_question_difference,
        edition_assumption: plan.edition_assumption,
        unresolved_items: plan.unresolved_items, status: plan.status,
    };
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function readQuestionAuthoringPlans(file: string, requireReady = true): QuestionAuthoringPlan[] {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    const values = record(raw) && raw.artifact_type === 'question_authoring_plan' ? raw.plans : Array.isArray(raw) ? raw : [raw];
    if (!Array.isArray(values) || values.length === 0) throw new Error('출제 계획이 하나 이상 필요합니다.');
    for (const [index, value] of values.entries()) {
        const errors = validateQuestionAuthoringPlan(value, requireReady);
        if (errors.length) throw new Error(`출제 계획 ${index + 1} 검증 실패:\n${errors.join('\n')}`);
    }
    return values as QuestionAuthoringPlan[];
}
