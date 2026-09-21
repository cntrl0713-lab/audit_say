import fs from 'node:fs';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { canonicalJson } from '../lib/learningSubmission.ts';
import { reviewedContentHash } from './questionReviewIdentity.ts';
import { questionHash } from './analysis/coverage/build-coverage.mjs';
import {
    applyCorrectionToSet, CORRECTIONS_DIRECTORY, learningFields, LINEAGE_DISPOSITIONS, parseCorrectionId, QuestionCorrectionError,
    REPLACEMENT_ARTIFACT_TYPE, validateAppliedSets,
} from './questionCorrection.ts';
import type {
    AppliedBank, AppliedCorrection, CorrectionChange, CorrectionClassificationEntry, CoverageRetarget, QuestionSetReplacement, QuestionSetSpec,
    ReplacementLineageRow,
} from './questionCorrection.ts';
import type { ClassificationReviewEntry } from './questionCorrectionClassification.ts';

/**
 * 세트 통째 교체(replacement) 계약.
 *
 * 수정 패치(correction)는 필드만 고치고 물음 구성은 바꾸지 못한다. 물음을 더하거나 빼거나 다시 쓰는 판본은 같은 세트 ID로
 * 세트 객체 전체를 담은 교체 명세(`artifact_type: question_set_replacement`)로 낸다. 검수·게시·설치·운영 반영 절차는
 * correction과 같고(check → evidence → publish → questions:v3:release), 퇴역·새 ID·wiki 퇴역·가드 목록 갱신이 필요 없다.
 * ID·수명주기 라벨·주제 구조는 교체 명세로도 바꾸지 못한다. 주제가 다른 문항은 새 세트다.
 *
 * 명세는 물음·criterion ID의 전후 대응(lineage)과 모든 물음의 분류(classification_entries)를 반드시 담고, 은행 관계 장부
 * (`cpa_uploader/analysis/coverage/links.json`)가 가리키던 물음·criterion이 사라지면 coverage_retargets로 다시 연결한다.
 * 설계와 배경: docs/문항-수정-패치-운영.md, docs/문항-세트별-파일-분리-설계.md
 */

export function isReplacement(spec: QuestionSetSpec): spec is QuestionSetReplacement {
    return spec.artifact_type === REPLACEMENT_ARTIFACT_TYPE;
}

const sameJson = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const criterionIds = (set: QuestionSetV3) => set.subquestions.flatMap((sub) => (sub.criteria ?? []).map((crit) => `${sub.id}/${crit.id}`));

/** 교체 명세로도 바꾸지 못하는 필드. 다르면 다른 문항이므로 새 세트 ID로 만든다. */
function frozenFields(set: QuestionSetV3): unknown {
    return {
        schema_version: set.schema_version, type: set.type,
        topic_id: set.classification?.topic_id, part: set.classification?.part, chapter: set.classification?.chapter, domain: set.classification?.domain,
        calculation_required: set.verification?.calculation_required,
    };
}

function lineageCompleteness(rows: ReplacementLineageRow[], key: 'before' | 'after', expected: string[], what: string): string[] {
    const listed = rows.map((row) => row[key]).filter((id): id is string => id !== null);
    const problems: string[] = [];
    if (new Set(listed).size !== listed.length) problems.push(`lineage.${what}: 같은 ${key} ID가 두 번 나옵니다.`);
    for (const id of expected) if (!listed.includes(id)) problems.push(`lineage.${what}: ${key} ${id}의 대응이 없습니다.`);
    for (const id of listed) if (!expected.includes(id)) problems.push(`lineage.${what}: ${key} ${id}는 ${key === 'before' ? '현재 세트' : 'replacement'}에 없습니다.`);
    return problems;
}

/** 세트 하나를 교체 명세로 바꾼다. 기준 해시·고정 필드·수명주기 라벨·대응 완결성을 모두 확인한 뒤에만 바꾼다. */
export function applyReplacementToSet(set: QuestionSetV3, spec: QuestionSetReplacement): { after: QuestionSetV3; changes: CorrectionChange[] } {
    if (set.id !== spec.set_id) throw new QuestionCorrectionError(`교체 대상 세트가 다릅니다: ${set.id} ≠ ${spec.set_id}`);
    const baseHash = reviewedContentHash(set), nextHash = reviewedContentHash(spec.replacement);
    if (baseHash !== spec.base_content_hash) {
        if (nextHash === baseHash) throw new QuestionCorrectionError(`${spec.correction_id}: 이미 적용된 상태입니다. 적용 기록(${CORRECTIONS_DIRECTORY}/applied/)을 확인하십시오.`);
        throw new QuestionCorrectionError(`${spec.correction_id}: 정본과 충돌합니다. 덮어쓰지 않았습니다.`,
            [`세트 ${set.id}의 내용이 교체 명세 작성 이후 바뀌었습니다(base ${spec.base_content_hash.slice(0, 12)}…, 현재 ${baseHash.slice(0, 12)}…). 현재 정본으로 명세를 다시 만드십시오.`]);
    }
    if (nextHash === baseHash) throw new QuestionCorrectionError(`${spec.correction_id}: replacement가 현재 세트와 같아 바꾸는 내용이 없습니다.`);
    const problems: string[] = [];
    if (!sameJson(frozenFields(set), frozenFields(spec.replacement))) {
        problems.push('교체 명세로 바꿀 수 없는 필드(schema_version·type·주제 구조·calculation_required)가 다릅니다. 주제가 다른 문항은 새 세트 ID로 만드십시오.');
    }
    if (spec.replacement.status !== set.status || spec.replacement.verification?.review_status !== set.verification.review_status) {
        problems.push('수명주기 라벨(status·review_status)은 승급 도구가 바꿉니다. replacement에는 현재 값을 그대로 두십시오.');
    }
    const beforeSubs = set.subquestions.map((sub) => sub.id), afterSubs = spec.replacement.subquestions.map((sub) => sub.id);
    const beforeCrits = criterionIds(set), afterCrits = criterionIds(spec.replacement);
    problems.push(...lineageCompleteness(spec.lineage.subquestions, 'before', beforeSubs, 'subquestions'));
    problems.push(...lineageCompleteness(spec.lineage.subquestions, 'after', afterSubs, 'subquestions'));
    problems.push(...lineageCompleteness(spec.lineage.criteria, 'before', beforeCrits, 'criteria'));
    problems.push(...lineageCompleteness(spec.lineage.criteria, 'after', afterCrits, 'criteria'));
    if (problems.length) throw new QuestionCorrectionError(`${spec.correction_id}: 교체 명세가 현재 세트와 맞지 않습니다.`, problems);
    const counts = LINEAGE_DISPOSITIONS.map((name) => [name, spec.lineage.criteria.filter((row) => row.disposition === name).length] as const)
        .filter(([, count]) => count > 0).map(([name, count]) => `${name} ${count}`).join(', ');
    return {
        after: structuredClone(spec.replacement),
        changes: [
            { target: 'subquestions', reason: spec.lineage.reason, before: beforeSubs, after: afterSubs },
            { target: 'criteria', reason: `criterion 대응 ${spec.lineage.criteria.length}건(${counts})`, before: beforeCrits, after: afterCrits },
        ],
    };
}

/**
 * correction과 replacement를 섞어 은행에 적용하고 대상 세트와 은행 전체를 검증한다. 입력 은행은 바꾸지 않는다.
 * `applyCorrections`와 같은 규칙이며 세트당 명세 하나만 받는다.
 */
export function applySpecs(bank: QuestionSetV3[], specs: QuestionSetSpec[], root = process.cwd()): AppliedBank {
    if (!specs.length) throw new QuestionCorrectionError('적용할 명세가 없습니다.');
    const duplicateIds = specs.map((spec) => spec.correction_id).filter((id, index, all) => all.indexOf(id) !== index);
    const duplicateSets = specs.map((spec) => spec.set_id).filter((id, index, all) => all.indexOf(id) !== index);
    if (duplicateIds.length || duplicateSets.length) {
        throw new QuestionCorrectionError('한 실행에서 명세 ID와 대상 세트는 각각 한 번만 쓸 수 있습니다.', [...new Set([...duplicateIds, ...duplicateSets])]);
    }
    const sets = [...bank];
    const applied: AppliedCorrection[] = [];
    const problems: string[] = [];
    for (const spec of specs) {
        const index = bank.findIndex((set) => set.id === spec.set_id);
        if (index < 0) { problems.push(`${spec.correction_id}: 정본에 세트 ${spec.set_id}가 없습니다.`); continue; }
        try {
            const before = bank[index];
            const { after, changes } = isReplacement(spec) ? applyReplacementToSet(before, spec) : applyCorrectionToSet(before, spec);
            sets[index] = after;
            applied.push({
                kind: isReplacement(spec) ? 'replacement' : 'correction', correction: spec, index, before, after, changes,
                contentHash: { before: reviewedContentHash(before), after: reviewedContentHash(after) },
                points: { before: computeQuestionSetMaxPoints(before), after: computeQuestionSetMaxPoints(after) },
                publicChanged: !sameJson(compilePublicQuestionSet(before), compilePublicQuestionSet(after)),
                learningFieldsChanged: learningFields(before, after),
            });
        } catch (error) {
            if (error instanceof QuestionCorrectionError) problems.push(error.message);
            else throw error;
        }
    }
    if (problems.length) throw new QuestionCorrectionError('명세를 적용하지 못했습니다.', problems);
    return { sets, applied, errors: validateAppliedSets(sets, applied, root) };
}

/** 비계: 현재 세트를 replacement에 그대로 두고, 대응은 모두 kept로, 이유·분류 근거는 TODO로 둔다. 이 상태로는 파서가 거절한다. */
export function scaffoldReplacement(set: QuestionSetV3, options: { correctionId: string; summary: string; entries: ClassificationReviewEntry[] }) {
    if (parseCorrectionId(options.correctionId).setId !== set.id) throw new Error('correction_id의 세트와 대상 세트가 다르십니다.'.replace('다르십니다', '다릅니다'));
    const current = new Map(options.entries.filter((entry) => entry.set_id === set.id).map((entry) => [entry.subquestion_id, entry]));
    const classification: CorrectionClassificationEntry[] = set.subquestions.map((sub) => {
        const entry = current.get(sub.id);
        const style = entry?.question_style ?? sub.question_style ?? (set.shared_context.facts.length ? 'case' : 'standard');
        return {
            subquestion_id: sub.id, question_style: style,
            topic_ids: entry?.topic_ids ? [...entry.topic_ids] : sub.topic_ids ? [...sub.topic_ids] : [set.classification.topic_id],
            standalone_prompt: style === 'standard' ? entry?.standalone_prompt ?? sub.prompt : null,
            case_fact_ids: entry?.case_fact_ids ? [...entry.case_fact_ids] : [],
            reason: 'TODO: 분류 근거(교체 후 물음의 실제 요구내용으로 다시 판정)',
        };
    });
    return {
        version: 1 as const, artifact_type: REPLACEMENT_ARTIFACT_TYPE, correction_id: options.correctionId, set_id: set.id,
        summary: options.summary, base_content_hash: reviewedContentHash(set),
        replacement: structuredClone(set),
        lineage: {
            reason: 'TODO: 물음 구성을 바꾸는 이유',
            subquestions: set.subquestions.map((sub) => ({ before: sub.id, after: sub.id, disposition: 'kept', note: 'TODO: 대응 설명' })),
            criteria: criterionIds(set).map((id) => ({ before: id, after: id, disposition: 'kept', note: 'TODO: 대응 설명' })),
            dropped_requirements: [],
        },
        classification_entries: classification,
        coverage_retargets: [],
    };
}

// ---------------------------------------------------------------- coverage 관계 장부

export interface CoverageLinkTarget { scope?: string; set_id: string; subquestion_id: string; criterion_ids: string[]; file?: string }
export interface CoverageLink {
    id: string; target: CoverageLinkTarget | null; relationship: string; review_status: string; reason: string;
    snapshot?: Record<string, unknown>; [key: string]: unknown;
}
export interface CoverageLinksDocument { version: number; policy: string; links: CoverageLink[]; [key: string]: unknown }

export function readCoverageLinks(file: string): CoverageLinksDocument {
    const document = JSON.parse(fs.readFileSync(file, 'utf8')) as CoverageLinksDocument;
    if (!Array.isArray(document?.links) || document.links.some((link) => typeof link?.id !== 'string')) throw new Error(`관계 장부 형식이 올바르지 않습니다: ${file}`);
    if (serializeCoverageLinks(document) !== fs.readFileSync(file, 'utf8')) throw new Error(`관계 장부가 직렬화 규칙(JSON.stringify 2칸 + 줄바꿈)과 다릅니다: ${file}`);
    return document;
}

export function serializeCoverageLinks(document: CoverageLinksDocument): string {
    return `${JSON.stringify(document, null, 2)}\n`;
}

/** 은행의 이 세트를 가리키는 관계(초안 대상·대상 없음은 제외). */
export function bankLinksForSet(document: CoverageLinksDocument, setId: string): CoverageLink[] {
    return document.links.filter((link) => link.target !== null && (link.target.scope ?? 'bank') === 'bank' && link.target.set_id === setId);
}

function targetResolves(set: QuestionSetV3, target: { subquestion_id: string; criterion_ids: string[] }): boolean {
    const sub = set.subquestions.find((item) => item.id === target.subquestion_id);
    return Boolean(sub) && target.criterion_ids.every((id) => sub!.criteria.some((crit) => crit.id === id));
}

/** 교체 후에도 모든 은행 관계가 실제 물음·criterion을 가리키는지 확인한다. 사라진 대상은 coverage_retargets로 다시 연결해야 한다. */
export function coverageRetargetProblems(document: CoverageLinksDocument, after: QuestionSetV3, spec: QuestionSetReplacement): string[] {
    const problems: string[] = [];
    const links = bankLinksForSet(document, spec.set_id);
    const retargets = new Map((spec.coverage_retargets ?? []).map((retarget) => [retarget.link_id, retarget]));
    for (const link of links) {
        const retarget = retargets.get(link.id);
        if (retarget) {
            if (retarget.target && !targetResolves(after, retarget.target)) {
                problems.push(`coverage_retargets ${link.id}: 새 대상 ${retarget.target.subquestion_id}/${retarget.target.criterion_ids.join(',')}이 replacement에 없습니다.`);
            }
            continue;
        }
        if (!targetResolves(after, link.target!)) {
            problems.push(`관계 ${link.id}이 가리키던 ${link.target!.subquestion_id}/${link.target!.criterion_ids.join(',')}이 교체 후 없습니다. coverage_retargets에 새 대상(또는 null)과 이유를 적으십시오.`);
        }
    }
    for (const id of retargets.keys()) {
        if (!links.some((link) => link.id === id)) problems.push(`coverage_retargets ${id}: 이 세트를 가리키는 은행 관계가 아닙니다.`);
    }
    return problems;
}

export interface CoverageRetargetChange {
    link_id: string;
    before: { target: CoverageLinkTarget | null; relationship: string; review_status: string; reason: string };
    after: { target: CoverageLinkTarget | null; relationship: string; review_status: string; reason: string };
}

/** 관계 장부에 재연결을 적용한다. 대상이 있으면 물음 지문 해시(snapshot.question_sha256)를 교체 후 값으로 새로 적는다. */
export function applyCoverageRetargets(document: CoverageLinksDocument, after: QuestionSetV3, spec: QuestionSetReplacement): { document: CoverageLinksDocument; changes: CoverageRetargetChange[] } {
    const problems = coverageRetargetProblems(document, after, spec);
    if (problems.length) throw new QuestionCorrectionError(`${spec.correction_id}: coverage 관계를 정리해야 합니다.`, problems);
    const next = structuredClone(document);
    const changes: CoverageRetargetChange[] = [];
    for (const retarget of spec.coverage_retargets ?? []) {
        const link = next.links.find((item) => item.id === retarget.link_id)!;
        const before = { target: structuredClone(link.target), relationship: link.relationship, review_status: link.review_status, reason: link.reason };
        link.target = retarget.target === null ? null
            : { ...(link.target ?? { set_id: after.id }), set_id: after.id, subquestion_id: retarget.target.subquestion_id, criterion_ids: [...retarget.target.criterion_ids] };
        if (retarget.relationship) link.relationship = retarget.relationship;
        link.review_status = retarget.review_status ?? 'needs_review';
        link.reason = retarget.reason;
        if (link.target) {
            const sub = after.subquestions.find((item) => item.id === link.target!.subquestion_id)!;
            link.snapshot = { ...(link.snapshot ?? {}), question_sha256: questionHash(after, sub) };
        }
        changes.push({ link_id: link.id, before, after: { target: structuredClone(link.target), relationship: link.relationship, review_status: link.review_status, reason: link.reason } });
    }
    return { document: next, changes };
}

export function retargetFor(retargets: CoverageRetarget[] | undefined, linkId: string): CoverageRetarget | undefined {
    return (retargets ?? []).find((retarget) => retarget.link_id === linkId);
}
