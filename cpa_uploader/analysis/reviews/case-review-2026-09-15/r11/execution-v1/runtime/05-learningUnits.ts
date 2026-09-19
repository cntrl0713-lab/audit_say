import type { QuestionSetV3 } from './questionV3.ts';
import type { PublicLearningQuestionSetV3 } from './learningTypes.ts';

/** Learning style is independent of the descriptive/enumeration/judgment answer format. */
export type QuestionStyle = 'case' | 'standard';
export interface LearningTopic { id: string; title: string; part: string; position: number }
export interface LearningClassification {
    learning_question_id: string;
    classification_version_id: string;
    source_set_id: string;
    source_set_version_id: string;
    source_content_hash?: string;
    source_subquestion_version_id: string;
    subquestion_id: string;
    question_style: QuestionStyle;
    case_set_id: string | null;
    topic_ids: string[];
    standalone_prompt: string | null;
    case_fact_ids?: string[];
    content_hash: string;
}

export function learningUnitId(setId: string, style: QuestionStyle, subquestionId?: string): string {
    if (style === 'standard' && !subquestionId) throw new Error('독립 물음 ID가 필요합니다.');
    return style === 'case' ? `${setId}--case` : `${setId}--${subquestionId}--standard`;
}

export function validateLearningClassification(value: unknown): LearningClassification {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('물음 분류 형식이 올바르지 않습니다.');
    const row = value as Record<string, unknown>;
    for (const key of ['learning_question_id', 'classification_version_id', 'source_set_id', 'source_set_version_id',
        'source_subquestion_version_id', 'subquestion_id', 'content_hash']) {
        if (typeof row[key] !== 'string' || !row[key]) throw new Error(`물음 분류 식별자가 없습니다: ${key}`);
    }
    if (row.question_style !== 'case' && row.question_style !== 'standard') throw new Error('물음의 학습 유형이 필요합니다.');
    if (!Array.isArray(row.topic_ids) || row.topic_ids.length === 0
        || row.topic_ids.some(id => typeof id !== 'string' || !/^\d{2}$/.test(id))
        || new Set(row.topic_ids).size !== row.topic_ids.length) throw new Error('물음별 주제가 올바르지 않습니다.');
    if (row.question_style === 'case' ? row.case_set_id !== row.source_set_id || row.standalone_prompt !== null
        : row.case_set_id !== null || typeof row.standalone_prompt !== 'string' || !row.standalone_prompt.trim()) {
        throw new Error('사례형 부모 또는 기준서형 독립 발문이 올바르지 않습니다.');
    }
    if (row.case_fact_ids !== undefined && (!Array.isArray(row.case_fact_ids)
        || row.case_fact_ids.some(id => typeof id !== 'string'))) throw new Error('사실관계 연결이 올바르지 않습니다.');
    // Explicit fields: import/review notes and private content never reach the client through this parser.
    return {
        learning_question_id: row.learning_question_id as string,
        classification_version_id: row.classification_version_id as string,
        source_set_id: row.source_set_id as string, source_set_version_id: row.source_set_version_id as string,
        ...(typeof row.source_content_hash === 'string' ? { source_content_hash: row.source_content_hash } : {}),
        source_subquestion_version_id: row.source_subquestion_version_id as string, subquestion_id: row.subquestion_id as string,
        question_style: row.question_style, case_set_id: row.case_set_id as string | null,
        topic_ids: row.topic_ids as string[], standalone_prompt: row.standalone_prompt as string | null,
        ...(row.case_fact_ids === undefined ? {} : { case_fact_ids: row.case_fact_ids as string[] }),
        content_hash: row.content_hash as string,
    };
}

/** Reject an incomplete migration instead of silently classifying a whole source set. */
export function buildLearningUnits(
    sets: PublicLearningQuestionSetV3[], classifications: LearningClassification[], topics: LearningTopic[],
): PublicLearningQuestionSetV3[] {
    const bySource = new Map<string, LearningClassification>();
    const topicMap = new Map(topics.map(topic => [topic.id, topic]));
    for (const entry of classifications) {
        validateLearningClassification(entry);
        const key = `${entry.source_set_id}/${entry.subquestion_id}`;
        if (bySource.has(key)) throw new Error(`중복 물음 분류: ${key}`);
        if (entry.topic_ids.some(id => !topicMap.has(id))) throw new Error(`알 수 없는 물음 주제: ${key}`);
        bySource.set(key, entry);
    }
    const units: PublicLearningQuestionSetV3[] = [];
    let consumed = 0;
    for (const set of sets) {
        const groups = new Map<string, Array<{ sub: typeof set.subquestions[number]; meta: LearningClassification }>>();
        for (const sub of set.subquestions) {
            const meta = bySource.get(`${set.id}/${sub.id}`);
            if (!meta || set.set_version_id && meta.source_set_version_id !== set.set_version_id) {
                throw new Error(`현재 판본의 물음 분류가 없습니다: ${set.id}/${sub.id}`);
            }
            consumed++;
            const id = learningUnitId(set.id, meta.question_style, sub.id);
            groups.set(id, [...(groups.get(id) ?? []), { sub, meta }]);
        }
        for (const [id, entries] of groups) {
            const style = entries[0].meta.question_style;
            if (style === 'case' && set.shared_context.facts.length === 0) throw new Error(`사례형 사실관계가 없습니다: ${id}`);
            const selectedTopics = [...new Set(entries.flatMap(({ meta }) => meta.topic_ids))]
                .map(id => topicMap.get(id)!).sort((a, b) => a.position - b.position);
            const selectedIds = new Set(entries.map(({ sub }) => sub.id));
            units.push({
                ...set, id, source_set_id: set.id, learning_unit_id: id, question_style: style,
                case_set_id: style === 'case' ? set.id : null,
                title: style === 'case' ? set.title : entries[0].meta.standalone_prompt!,
                topics: selectedTopics,
                classification: { ...set.classification, topic_id: selectedTopics[0].id, part: selectedTopics[0].part, chapter: selectedTopics[0].title },
                classification_version_ids: entries.map(({ meta }) => meta.classification_version_id),
                shared_context: { facts: style === 'case' ? set.shared_context.facts : [] },
                learning_order: set.learning_order.filter(subId => selectedIds.has(subId)),
                subquestions: entries.map(({ sub, meta }) => ({ ...sub,
                    prompt: style === 'standard' ? meta.standalone_prompt! : sub.prompt,
                    question_style: style, topic_ids: meta.topic_ids, learning_question_id: meta.learning_question_id,
                    classification_version_id: meta.classification_version_id,
                })),
                max_points: entries.reduce((sum, { sub }) => sum + sub.max_points, 0),
            });
        }
    }
    if (consumed !== classifications.length) throw new Error('출처에 없는 물음 분류가 포함되었습니다.');
    return units.sort((a, b) => (a.topics![0].position - b.topics![0].position));
}

/** A private compatibility projection for the unchanged criterion engine; no synthetic DB parent is created. */
export function selectLearningQuestionSet(
    source: QuestionSetV3, classifications: LearningClassification[], expectedUnitId: string,
): QuestionSetV3 {
    if (classifications.length === 0) throw new Error('풀이할 물음이 없습니다.');
    const ids = new Set<string>();
    for (const meta of classifications) {
        validateLearningClassification(meta);
        if (meta.source_set_id !== source.id || !source.subquestions.some(sub => sub.id === meta.subquestion_id)
            || ids.has(meta.subquestion_id) || learningUnitId(source.id, meta.question_style, meta.subquestion_id) !== expectedUnitId) {
            throw new Error('학습 단위와 물음 판본이 일치하지 않습니다.');
        }
        ids.add(meta.subquestion_id);
    }
    const style = classifications[0].question_style;
    if (classifications.some(meta => meta.question_style !== style) || style === 'standard' && classifications.length !== 1
        || style === 'case' && source.shared_context.facts.length === 0) throw new Error('학습 유형의 구성 요건이 올바르지 않습니다.');
    return { ...source,
        title: style === 'standard' ? classifications[0].standalone_prompt! : source.title,
        shared_context: { facts: style === 'case' ? source.shared_context.facts : [] },
        learning_order: source.learning_order.filter(id => ids.has(id)),
        subquestions: classifications.map(meta => ({ ...source.subquestions.find(sub => sub.id === meta.subquestion_id)!,
            ...(style === 'standard' ? { prompt: meta.standalone_prompt! } : {}),
        })),
    };
}
