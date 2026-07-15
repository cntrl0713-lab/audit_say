import type { BatchItem } from './serverUtils';

/** Minimal question shape needed to hydrate a model answer. */
export interface QuestionAnswerRow {
    id: number | string;
    model_answer?: string | string[] | null;
}

/**
 * Fill each batch item's model-answer field (`m`) from the matching question.
 *
 * Matching is by the real question id (`item.qid`), NOT the array index (`item.id`).
 * Conflating the two was the R1 regression: items were matched by position, so a
 * question whose db id happened to equal an index hydrated the wrong answer while
 * every other item silently got none. When no question matches, `m` is set to '' so
 * the review UI shows its "no model answer" fallback instead of a stale value.
 */
export function hydrateModelAnswers(items: BatchItem[], questions: QuestionAnswerRow[]): void {
    for (const item of items) {
        const match = questions.find((row) => row.id.toString() === item.qid.toString());
        item.m = match ? stringifyModelAnswer(match.model_answer) : '';
    }
}

/** Normalize a model answer (array or scalar) into the newline-joined string the grader expects. */
export function stringifyModelAnswer(modelAnswer: string | string[] | null | undefined): string {
    if (Array.isArray(modelAnswer)) return modelAnswer.join('\n');
    return String(modelAnswer ?? '');
}
