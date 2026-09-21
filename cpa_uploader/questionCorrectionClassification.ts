import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { canonicalJson } from '../lib/learningSubmission.ts';
import type { AppliedCorrection } from './questionCorrection.ts';
import { QuestionCorrectionError } from './questionCorrection.ts';

/** `scripts/build-learning-unit-catalog.ts`의 분류 검토 입력 형상. */
export interface ClassificationReviewEntry {
    set_id: string;
    subquestion_id: string;
    question_style: 'standard' | 'case';
    topic_ids: string[];
    standalone_prompt: string | null;
    case_fact_ids: string[];
    reason: string;
}
export interface ClassificationReview { source_file: string; source_file_sha256: string; entries: ClassificationReviewEntry[] }

const sameJson = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/**
 * 수정한 세트의 물음 분류 항목만 새로 정하고 나머지 항목은 그대로 잇는다.
 *
 * 분류 입력 전체를 다시 검토한 것처럼 새 사본을 만들지 않는다. 기계적으로 따라오는 변경(기준서형
 * 독립 발문이 원 발문과 같았는데 발문이 바뀐 경우)만 자동으로 반영하고, 분류 판단이 필요한 변경은
 * correction의 `classification_entries`로 명시해야 한다.
 */
export function carryClassificationEntries(entries: ClassificationReviewEntry[], applied: AppliedCorrection[]): ClassificationReviewEntry[] {
    const problems: string[] = [];
    const replacements = new Map<string, ClassificationReviewEntry[]>();
    for (const item of applied) {
        const { before, after, correction } = item;
        const explicit = new Map((correction.classification_entries ?? []).map((entry) => [entry.subquestion_id, entry]));
        for (const id of explicit.keys()) {
            if (!after.subquestions.some((sub) => sub.id === id)) problems.push(`${correction.correction_id}: classification_entries의 물음 ${id}가 세트에 없습니다.`);
        }
        const derived: ClassificationReviewEntry[] = [];
        for (const sub of after.subquestions) {
            const old = before.subquestions.find((item) => item.id === sub.id);
            const previous = entries.find((entry) => entry.set_id === after.id && entry.subquestion_id === sub.id);
            const given = explicit.get(sub.id);
            const at = `${correction.correction_id} ${after.id}/${sub.id}`;
            let entry: ClassificationReviewEntry | undefined;
            if (given) {
                entry = { set_id: after.id, ...given };
            } else if (item.kind === 'replacement') {
                // 교체 명세는 물음 구성이 바뀌므로 이전 항목을 이어받지 않는다. 파서가 전수 명시를 요구하지만 여기서도 막는다.
                problems.push(`${at}: 교체 명세는 모든 물음의 분류를 classification_entries로 명시해야 합니다.`);
            } else if (!previous) {
                problems.push(`${at}: 현재 분류 입력에 항목이 없습니다. classification_entries로 분류를 명시하십시오.`);
            } else if (!old) {
                problems.push(`${at}: 이전 판본에 없는 물음입니다. classification_entries로 분류를 명시하십시오.`);
            } else if (!sameJson(old.question_style ?? null, sub.question_style ?? null) || !sameJson(old.topic_ids ?? null, sub.topic_ids ?? null)) {
                problems.push(`${at}: 학습 유형·주제를 바꿨습니다. classification_entries로 새 분류와 근거를 명시하십시오.`);
            } else {
                entry = { ...previous, topic_ids: [...previous.topic_ids], case_fact_ids: [...previous.case_fact_ids] };
                if (entry.question_style === 'standard' && old.prompt !== sub.prompt && entry.standalone_prompt !== null) {
                    // 독립 발문이 원 발문 그대로였으면 새 발문을 따른다. 따로 다듬은 독립 발문은 사람이 다시 정한다.
                    if (entry.standalone_prompt === old.prompt) entry.standalone_prompt = sub.prompt;
                    else problems.push(`${at}: 별도로 다듬은 독립 발문이 있는데 원 발문이 바뀌었습니다. classification_entries로 독립 발문을 명시하십시오.`);
                }
                const facts = new Set(after.shared_context.facts.map((fact) => fact.id));
                if (entry.case_fact_ids.some((id) => !facts.has(id))) {
                    problems.push(`${at}: 연결된 사실 ID가 수정 후 없습니다. classification_entries로 사실 연결을 명시하십시오.`);
                }
            }
            if (!entry) continue;
            // 원문에 학습 메타데이터가 있으면 분류 입력도 같아야 한다(DB 이관이 같은 규칙으로 거절한다).
            if (sub.question_style && sub.topic_ids?.length && (entry.question_style !== sub.question_style
                || !sameJson([...entry.topic_ids].sort(), [...sub.topic_ids].sort()))) {
                problems.push(`${at}: 분류 항목의 유형·주제가 원문의 question_style·topic_ids와 다릅니다.`);
            }
            derived.push(entry);
        }
        replacements.set(after.id, derived);
    }
    if (problems.length) throw new QuestionCorrectionError('물음 분류 입력을 이어받지 못했습니다.', problems);
    const result: ClassificationReviewEntry[] = [];
    const placed = new Set<string>();
    for (const entry of entries) {
        const replacement = replacements.get(entry.set_id);
        if (!replacement) { result.push(entry); continue; }
        if (!placed.has(entry.set_id)) { result.push(...replacement); placed.add(entry.set_id); }
    }
    for (const [setId, replacement] of replacements) if (!placed.has(setId)) result.push(...replacement);
    return result;
}

/** 대상 세트의 분류 항목만 뽑는다(검수용 부분 카탈로그 입력). */
export function entriesForSets(entries: ClassificationReviewEntry[], sets: QuestionSetV3[]): ClassificationReviewEntry[] {
    const ids = new Set(sets.map((set) => set.id));
    return entries.filter((entry) => ids.has(entry.set_id));
}
