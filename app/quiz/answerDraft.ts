import type { PublicLearningQuestionSetV3 } from '../../lib/learningTypes.ts';
import { QUESTION_V3_ANSWER_MAX_LENGTH } from '../../lib/questionV3Answer.ts';

export const ANSWER_DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
export interface AnswerDraft {
  schema: 1;
  owner: string;
  identity: string;
  answers: Record<string, string>;
  savedAt: number;
}

export function answerDraftKey(owner: string, unitId: string) {
  return `auditsay-answer-draft:${encodeURIComponent(owner)}:${encodeURIComponent(unitId)}`;
}

function identity(set: PublicLearningQuestionSetV3) {
  // Version IDs alone are absent in file mode; bind the actual public content too.
  return JSON.stringify({ id: set.id, version: set.set_version_id, unit: set.learning_unit_id,
    classifications: set.classification_version_ids, style: set.question_style,
    facts: set.shared_context.facts, questions: set.subquestions });
}

export function createAnswerDraft(owner: string, set: PublicLearningQuestionSetV3, answers: Record<string, string>, now = Date.now()): AnswerDraft {
  return { schema: 1, owner, identity: identity(set), answers: { ...answers }, savedAt: now };
}

export function parseAnswerDraft(raw: string | null, owner: string, set: PublicLearningQuestionSetV3, now = Date.now()): AnswerDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const draft = value as Partial<AnswerDraft>;
    if (draft.schema !== 1 || draft.owner !== owner || draft.identity !== identity(set)
      || typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt)
      || draft.savedAt > now || now - draft.savedAt >= ANSWER_DRAFT_TTL
      || !draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers)
      || Object.keys(draft.answers).length !== set.subquestions.length
      || !set.subquestions.every(question => Object.hasOwn(draft.answers!, question.id)
        && typeof draft.answers![question.id] === 'string'
        && draft.answers![question.id].length <= QUESTION_V3_ANSWER_MAX_LENGTH)) return null;
    return draft as AnswerDraft;
  } catch { return null; }
}
