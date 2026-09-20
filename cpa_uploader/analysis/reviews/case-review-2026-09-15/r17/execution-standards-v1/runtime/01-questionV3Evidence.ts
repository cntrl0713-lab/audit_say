import type { QuestionSetV3 } from './questionV3.ts';

export interface AnswerEvidence { id: string; start: number; end: number; text: string }

/** Offsets always address the submitted string, including CRLF and surrogate pairs. */
export function answerEvidence(subquestionId: string, answer: string): AnswerEvidence[] {
    if (!answer.trim()) return [];
    const ranges = [{ start: 0, end: answer.length }];
    const segmenter = new Intl.Segmenter('ko', { granularity: 'sentence' });
    for (const segment of segmenter.segment(answer)) {
        if (segment.segment.trim() && (segment.index !== 0 || segment.segment.length !== answer.length)) {
            ranges.push({ start: segment.index, end: segment.index + segment.segment.length });
        }
    }
    return ranges.map((r, i) => ({ id: `${subquestionId}/e${i}`, ...r, text: answer.slice(r.start, r.end) }));
}

export function resolveAnswerEvidence(subquestionId: string, answer: string, ids: unknown): string {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) throw new Error('유효한 인용 구간 ID가 필요합니다.');
    const catalog = answerEvidence(subquestionId, answer);
    const selected = ids.map(id => catalog.find(e => e.id === id));
    if (selected.some(e => !e)) throw new Error('답안에 없는 인용 구간 ID입니다.');
    return answer.slice(Math.min(...selected.map(e => e!.start)), Math.max(...selected.map(e => e!.end)));
}

export function evidenceSchema(set: QuestionSetV3, answers: Record<string, string>) {
    const nullableString = { type: ['string', 'null'] };
    return { type: 'object', additionalProperties: false, required: ['subquestions'], properties: {
        subquestions: { type: 'array', items: { anyOf: set.subquestions.map(q => {
            const ids = answerEvidence(q.id, answers[q.id] ?? '').map(e => e.id);
            // A blank answer has no selectable evidence, including no sentinel ID.
            const evidenceIds = ids.length ? { type: 'array', items: { type: 'string', enum: ids } }
                : { type: 'array', maxItems: 0, items: { type: 'string' } };
            return { type: 'object', additionalProperties: false,
                required: ['subquestion_id', 'verdicts', 'injection_detected', 'injection_evidence_ids', 'salad_detected'], properties: {
                    subquestion_id: { type: 'string', enum: [q.id] },
                    verdicts: { type: 'array', items: { type: 'object', additionalProperties: false,
                        required: ['criterion_id', 'verdict', 'evidence_ids', 'reason'], properties: {
                            criterion_id: { type: 'string', enum: q.criteria.map(c => c.id) },
                            verdict: { type: 'string', enum: ids.length ? ['met', 'partial', 'not_met', 'contradicted'] : ['not_met'] }, evidence_ids: evidenceIds, reason: nullableString,
                        } } },
                    injection_detected: { type: 'boolean' }, injection_evidence_ids: evidenceIds, salad_detected: { type: 'boolean' },
                } };
        }) } },
    } };
}
