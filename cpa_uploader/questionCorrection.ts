import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints, validateQuestionSetV3 } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { canonicalJson } from '../lib/learningSubmission.ts';
import { reviewedContentHash } from './questionReviewIdentity.ts';
import { validateAuthoringBank } from './questionBankPublication.ts';

/**
 * 문항 수정 패치(correction) 계약.
 *
 * 기존 세트 하나를 고칠 때 편집 정본 전체나 전체 은행 사본을 다시 쓰지 않고, 바꿀 필드와 수정 전 값만
 * 적은 작은 파일(`cpa_uploader/corrections/<correction_id>.json`)을 입력으로 삼는다. 적용기는 정본을
 * 메모리에서 고치고 대상 세트의 바이트만 달라졌는지 확인한다. 검수·게시 수명주기 라벨(status,
 * review_status)은 승급 도구만 바꾼다.
 */

export const CORRECTION_ARTIFACT_TYPE = 'question_set_correction';
export const CORRECTIONS_DIRECTORY = 'cpa_uploader/corrections';
/** 선택 필드가 없음을 나타낸다. `null`은 실제 값이므로 구분한다(예: decision:null과 decision 없음). */
export const ABSENT: { readonly $absent: true } = Object.freeze({ $absent: true as const });

const SET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;
const SLUG = '[0-9a-z가-힣]+(?:-[0-9a-z가-힣]+)*';
export const CORRECTION_ID_PATTERN = new RegExp(`^(\\d{8})-(.+)--(${SLUG})$`, 'u');
const MAX_PATCHES = 50;

type FieldKind = 'text' | 'text-list' | 'object-list' | 'object' | 'object-or-null' | 'points';
interface FieldSpec { kind: FieldKind; optional?: boolean; values?: readonly string[] }

// 수정 가능한 필드만 둔다. id·수명주기 라벨·주제 구조(topic_id/part/chapter/domain)·물음 구성·답안 정책
// (constraints/selection)은 대상이 아니다. 이런 변경은 제작 경로의 새 판본으로 다룬다.
export const PATCHABLE_FIELDS = {
    set: {
        title: { kind: 'text' },
        'classification.tags': { kind: 'text-list' },
        'classification.standards': { kind: 'text-list' },
        'verification.notes': { kind: 'text-list' },
        'verification.source_fidelity': { kind: 'text', values: ['exact', 'normalized', 'reconstructed', 'excerpt'] },
        learning_order: { kind: 'text-list' },
        source_refs: { kind: 'object-list' },
        'shared_context.facts': { kind: 'object-list' },
    },
    subquestion: {
        prompt: { kind: 'text' },
        type: { kind: 'text', values: ['descriptive', 'enumeration', 'judgment'] },
        model_answer: { kind: 'text-list' },
        answer_slots: { kind: 'object-list', optional: true },
        decision: { kind: 'object-or-null', optional: true },
        question_style: { kind: 'text', values: ['standard', 'case'], optional: true },
        topic_ids: { kind: 'text-list', optional: true },
        requirements: { kind: 'object-list' },
        criteria: { kind: 'object-list' },
    },
    criterion: {
        claim: { kind: 'text' },
        requirement_id: { kind: 'text' },
        critical_facts: { kind: 'object-list' },
        max_points: { kind: 'points' },
        scores: { kind: 'object' },
        source_ref_ids: { kind: 'text-list' },
    },
    requirement: {
        source_ref_id: { kind: 'text' },
        source_quote: { kind: 'text' },
        source_span: { kind: 'text', optional: true },
    },
    source_ref: {
        file: { kind: 'text' },
        title: { kind: 'text', optional: true },
        page: { kind: 'text', optional: true },
        source_quote: { kind: 'text' },
        role: { kind: 'text', values: ['question', 'answer', 'standard', 'practice'] },
        content_hash: { kind: 'text', optional: true },
        source_span: { kind: 'text', optional: true },
    },
    fact: {
        text: { kind: 'text' },
    },
} as const satisfies Record<string, Record<string, FieldSpec>>;

type Fields = typeof PATCHABLE_FIELDS;
export type CorrectionTarget =
    | { field: keyof Fields['set'] }
    | { subquestion: string; field: keyof Fields['subquestion'] }
    | { subquestion: string; criterion: string; field: keyof Fields['criterion'] }
    | { subquestion: string; requirement: string; field: keyof Fields['requirement'] }
    | { source_ref: string; field: keyof Fields['source_ref'] }
    | { fact: string; field: keyof Fields['fact'] };
type Scope = keyof Fields;

export interface CorrectionPatch {
    target: CorrectionTarget;
    reason: string;
    expected_before: unknown;
    set: unknown;
}
export interface CorrectionClassificationEntry {
    subquestion_id: string;
    question_style: 'standard' | 'case';
    topic_ids: string[];
    standalone_prompt: string | null;
    case_fact_ids: string[];
    reason: string;
}
export interface QuestionSetCorrection {
    version: 1;
    artifact_type: typeof CORRECTION_ARTIFACT_TYPE;
    correction_id: string;
    set_id: string;
    summary: string;
    note?: string;
    base_content_hash: string;
    patches: CorrectionPatch[];
    classification_entries?: CorrectionClassificationEntry[];
}

export class QuestionCorrectionError extends Error {
    readonly problems: string[];
    constructor(message: string, problems: string[] = []) {
        super(problems.length ? `${message}\n${problems.map((problem) => `- ${problem}`).join('\n')}` : message);
        this.name = 'QuestionCorrectionError';
        this.problems = problems;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
export const isAbsent = (value: unknown): boolean =>
    isRecord(value) && Object.keys(value).length === 1 && value.$absent === true;
const nonEmptyText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const sameJson = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);
const TARGET_ID_PATTERN = /^[^\s/:=]+$/u;

function scopeOf(target: CorrectionTarget): Scope {
    if ('criterion' in target) return 'criterion';
    if ('requirement' in target) return 'requirement';
    if ('subquestion' in target) return 'subquestion';
    if ('source_ref' in target) return 'source_ref';
    if ('fact' in target) return 'fact';
    return 'set';
}

/** 사람이 읽고 CLI에서 쓰는 대상 표기. `parseTargetExpression`과 서로 역이다. */
export function targetLabel(target: CorrectionTarget): string {
    if ('criterion' in target) return `crit=${target.subquestion}/${target.criterion}:${target.field}`;
    if ('requirement' in target) return `req=${target.subquestion}/${target.requirement}:${target.field}`;
    if ('subquestion' in target) return `sub=${target.subquestion}:${target.field}`;
    if ('source_ref' in target) return `src=${target.source_ref}:${target.field}`;
    if ('fact' in target) return `fact=${target.fact}:${target.field}`;
    return target.field;
}

/** 같은 값을 두 패치가 함께 바꾸지 않도록, 배열 전체 교체와 그 안의 필드 교체를 겹침으로 본다. */
function containerLabels(target: CorrectionTarget): string[] {
    if ('criterion' in target) return [`sub=${target.subquestion}:criteria`];
    if ('requirement' in target) return [`sub=${target.subquestion}:requirements`];
    if ('source_ref' in target) return ['source_refs'];
    if ('fact' in target) return ['shared_context.facts'];
    return [];
}

export function parseTargetExpression(expression: string): CorrectionTarget {
    const text = expression.trim();
    const equals = text.indexOf('=');
    if (equals < 0) {
        if (!(text in PATCHABLE_FIELDS.set)) throw new Error(`수정할 수 없는 세트 필드입니다: ${text}`);
        return { field: text as keyof Fields['set'] };
    }
    const scope = text.slice(0, equals);
    const rest = text.slice(equals + 1);
    const colon = rest.lastIndexOf(':');
    if (colon <= 0) throw new Error(`대상 표기는 <범위>=<ID>:<필드> 형식이어야 합니다: ${expression}`);
    const ids = rest.slice(0, colon);
    const field = rest.slice(colon + 1);
    const pair = () => {
        const slash = ids.indexOf('/');
        if (slash <= 0 || slash === ids.length - 1) throw new Error(`물음 ID와 하위 ID를 '/'로 구분해야 합니다: ${expression}`);
        return [ids.slice(0, slash), ids.slice(slash + 1)] as const;
    };
    let target: unknown;
    if (scope === 'sub') target = { subquestion: ids, field };
    else if (scope === 'crit') { const [subquestion, criterion] = pair(); target = { subquestion, criterion, field }; }
    else if (scope === 'req') { const [subquestion, requirement] = pair(); target = { subquestion, requirement, field }; }
    else if (scope === 'src') target = { source_ref: ids, field };
    else if (scope === 'fact') target = { fact: ids, field };
    else throw new Error(`알 수 없는 대상 범위입니다: ${scope} (sub, crit, req, src, fact)`);
    return parseTarget(target, expression);
}

function parseTarget(value: unknown, label: string): CorrectionTarget {
    if (!isRecord(value)) throw new Error(`${label}: target은 객체여야 합니다.`);
    const keys = Object.keys(value).sort().join(',');
    const shapes: Record<string, Scope> = {
        field: 'set', 'field,subquestion': 'subquestion', 'criterion,field,subquestion': 'criterion',
        'field,requirement,subquestion': 'requirement', 'field,source_ref': 'source_ref', 'fact,field': 'fact',
    };
    const scope = shapes[keys];
    if (!scope) throw new Error(`${label}: target 키 조합이 올바르지 않습니다(${keys}).`);
    for (const [key, id] of Object.entries(value)) {
        if (key === 'field') continue;
        if (typeof id !== 'string' || !TARGET_ID_PATTERN.test(id)) throw new Error(`${label}: target.${key}는 공백·'/'·':'·'='가 없는 ID여야 합니다.`);
    }
    const field = value.field;
    if (typeof field !== 'string' || !(field in PATCHABLE_FIELDS[scope])) {
        throw new Error(`${label}: ${scope} 범위에서 수정할 수 없는 필드입니다: ${String(field)}`);
    }
    return value as unknown as CorrectionTarget;
}

function fieldSpec(target: CorrectionTarget): FieldSpec {
    return (PATCHABLE_FIELDS[scopeOf(target)] as Record<string, FieldSpec>)[target.field];
}

function checkValueShape(value: unknown, spec: FieldSpec, label: string): void {
    if (isAbsent(value)) {
        if (!spec.optional) throw new Error(`${label}: 필수 필드는 없음({"$absent":true})으로 둘 수 없습니다.`);
        return;
    }
    if (typeof value === 'string' && value.includes(' ')) throw new Error(`${label}: NUL 문자는 허용하지 않습니다.`);
    const ok = spec.kind === 'text' ? nonEmptyText(value) && (!spec.values || spec.values.includes(value))
        : spec.kind === 'text-list' ? Array.isArray(value) && value.every(nonEmptyText)
        : spec.kind === 'object-list' ? Array.isArray(value) && value.every(isRecord)
        : spec.kind === 'object' ? isRecord(value)
        : spec.kind === 'object-or-null' ? value === null || isRecord(value)
        : Number.isInteger(value) && [1, 2, 3].includes(value as number);
    if (!ok) {
        const expected = spec.values ? `${spec.values.join('|')} 중 하나` : {
            text: '비어 있지 않은 문자열', 'text-list': '비어 있지 않은 문자열 배열', 'object-list': '객체 배열',
            object: '객체', 'object-or-null': '객체 또는 null', points: '1, 2, 3 중 하나',
        }[spec.kind];
        throw new Error(`${label}: 값은 ${expected}이어야 합니다.`);
    }
}

function assertKeys(value: Record<string, unknown>, required: string[], optional: string[], label: string): void {
    const allowed = new Set([...required, ...optional]);
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error(`${label}: 알 수 없는 키 ${unknown.join(', ')}`);
    const missing = required.filter((key) => !(key in value));
    if (missing.length) throw new Error(`${label}: 필수 키 ${missing.join(', ')}가 없습니다.`);
}

export function parseCorrectionId(id: string): { date: string; setId: string; slug: string } {
    const match = CORRECTION_ID_PATTERN.exec(id);
    if (!match || id.length > 160) throw new Error(`correction_id는 YYYYMMDD-<set_id>--<slug> 형식이어야 합니다: ${id}`);
    const [, date, setId, slug] = match;
    const parsed = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10).replaceAll('-', '') !== date) {
        throw new Error(`correction_id의 날짜가 올바르지 않습니다: ${date}`);
    }
    if (slug.length > 60) throw new Error('correction_id의 slug는 60자 이하여야 합니다.');
    return { date, setId, slug };
}

function parseClassificationEntries(value: unknown, label: string): CorrectionClassificationEntry[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${label}: classification_entries는 비어 있지 않은 배열이어야 합니다.`);
    const seen = new Set<string>();
    return value.map((entry, index) => {
        const at = `${label}.classification_entries[${index}]`;
        if (!isRecord(entry)) throw new Error(`${at}: 객체여야 합니다.`);
        assertKeys(entry, ['subquestion_id', 'question_style', 'topic_ids', 'standalone_prompt', 'case_fact_ids', 'reason'], [], at);
        if (!nonEmptyText(entry.subquestion_id) || seen.has(entry.subquestion_id)) throw new Error(`${at}: subquestion_id가 없거나 중복됩니다.`);
        seen.add(entry.subquestion_id);
        if (entry.question_style !== 'standard' && entry.question_style !== 'case') throw new Error(`${at}: question_style은 standard 또는 case입니다.`);
        const topics = entry.topic_ids;
        if (!Array.isArray(topics) || !topics.length || topics.some((id) => typeof id !== 'string' || !/^(0[1-9]|1[0-9])$/u.test(id))
            || new Set(topics).size !== topics.length) throw new Error(`${at}: topic_ids는 중복 없는 01~19 주제 ID 배열이어야 합니다.`);
        if (entry.standalone_prompt !== null && !nonEmptyText(entry.standalone_prompt)) throw new Error(`${at}: standalone_prompt는 문자열 또는 null입니다.`);
        if (!Array.isArray(entry.case_fact_ids) || entry.case_fact_ids.some((id) => !nonEmptyText(id))) throw new Error(`${at}: case_fact_ids는 문자열 배열입니다.`);
        if (entry.question_style === 'standard' && entry.case_fact_ids.length) throw new Error(`${at}: 기준서형 물음은 사실관계를 연결하지 않습니다.`);
        if (!nonEmptyText(entry.reason) || /^todo\b/iu.test(entry.reason.trim())) throw new Error(`${at}: 분류 근거(reason)를 채워야 합니다.`);
        return entry as unknown as CorrectionClassificationEntry;
    });
}

/** 파일에서 읽은 correction을 엄격하게 검사한다. 모르는 키·빈 이유·효과 없는 패치·겹치는 대상을 거절한다. */
export function parseQuestionCorrection(value: unknown, label = 'correction'): QuestionSetCorrection {
    if (!isRecord(value)) throw new Error(`${label}: correction은 JSON 객체여야 합니다.`);
    assertKeys(value, ['version', 'artifact_type', 'correction_id', 'set_id', 'summary', 'base_content_hash', 'patches'],
        ['note', 'classification_entries'], label);
    if (value.version !== 1) throw new Error(`${label}: version은 1이어야 합니다.`);
    if (value.artifact_type !== CORRECTION_ARTIFACT_TYPE) throw new Error(`${label}: artifact_type은 ${CORRECTION_ARTIFACT_TYPE}이어야 합니다.`);
    if (typeof value.set_id !== 'string' || !SET_ID_PATTERN.test(value.set_id) || value.set_id.includes('--')) {
        throw new Error(`${label}: set_id 형식이 올바르지 않습니다.`);
    }
    if (typeof value.correction_id !== 'string') throw new Error(`${label}: correction_id가 필요합니다.`);
    if (parseCorrectionId(value.correction_id).setId !== value.set_id) throw new Error(`${label}: correction_id에 적은 세트와 set_id가 다릅니다.`);
    if (!nonEmptyText(value.summary) || value.summary.length > 500 || value.summary.includes(' ')) throw new Error(`${label}: summary는 500자 이하의 비어 있지 않은 문자열이어야 합니다.`);
    if (value.note !== undefined && (typeof value.note !== 'string' || value.note.includes(' '))) throw new Error(`${label}: note는 문자열이어야 합니다.`);
    if (typeof value.base_content_hash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.base_content_hash)) throw new Error(`${label}: base_content_hash는 64자리 소문자 16진수여야 합니다.`);
    if (!Array.isArray(value.patches) || value.patches.length === 0 || value.patches.length > MAX_PATCHES) {
        throw new Error(`${label}: patches는 1~${MAX_PATCHES}개여야 합니다.`);
    }
    const labels = new Set<string>();
    const patches = value.patches.map((patch, index) => {
        const at = `${label}.patches[${index}]`;
        if (!isRecord(patch)) throw new Error(`${at}: 객체여야 합니다.`);
        assertKeys(patch, ['target', 'reason', 'expected_before', 'set'], [], at);
        // 이유를 먼저 본다. 비계는 수정 전 값과 같은 set을 두므로 빈 이유가 먼저 드러나야 한다.
        if (!nonEmptyText(patch.reason) || /^todo\b/iu.test(patch.reason.trim()) || patch.reason.length > 1000) {
            throw new Error(`${at}: reason에 수정 이유를 적어야 합니다(TODO 불가, 1000자 이하).`);
        }
        const target = parseTarget(patch.target, at);
        const spec = fieldSpec(target);
        const name = targetLabel(target);
        checkValueShape(patch.expected_before, spec, `${at}(${name}).expected_before`);
        checkValueShape(patch.set, spec, `${at}(${name}).set`);
        if (sameJson(patch.expected_before, patch.set)) throw new Error(`${at}(${name}): set이 expected_before와 같아 바꾸는 내용이 없습니다.`);
        if (labels.has(name)) throw new Error(`${at}: 같은 대상을 두 번 수정합니다: ${name}`);
        labels.add(name);
        return { target, reason: patch.reason, expected_before: patch.expected_before, set: patch.set } as CorrectionPatch;
    });
    for (const patch of patches) {
        const overlap = containerLabels(patch.target).find((container) => labels.has(container));
        if (overlap) throw new Error(`${label}: ${targetLabel(patch.target)}와 ${overlap}가 같은 값을 함께 바꿉니다. 한쪽만 쓰십시오.`);
    }
    return {
        version: 1, artifact_type: CORRECTION_ARTIFACT_TYPE, correction_id: value.correction_id, set_id: value.set_id,
        summary: value.summary, ...(value.note === undefined ? {} : { note: value.note as string }),
        base_content_hash: value.base_content_hash, patches,
        ...(value.classification_entries === undefined ? {} : { classification_entries: parseClassificationEntries(value.classification_entries, label) }),
    };
}

export interface CorrectionFile { file: string; bytes: Buffer; sha256: string; gitBlob: string; correction: QuestionSetCorrection }

export const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
export const gitBlobId = (bytes: Buffer): string => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/** 파일 이름이 correction_id와 같아야 한다. 커밋될 LF 바이트 기준으로 지문을 남긴다. */
export function readCorrectionFile(file: string): CorrectionFile {
    const raw = fs.readFileSync(file);
    // 작업트리가 CRLF로 체크아웃되어도 커밋되는 바이트(LF)로 지문을 계산한다(.gitattributes eol=lf).
    const bytes = Buffer.from(raw.toString('utf8').replace(/\r\n/gu, '\n'), 'utf8');
    const text = bytes.toString('utf8').replace(/^﻿/u, '');
    let value: unknown;
    try { value = JSON.parse(text); } catch (error) { throw new Error(`${file}: JSON이 아닙니다. ${error instanceof Error ? error.message : ''}`); }
    const correction = parseQuestionCorrection(value, path.basename(file));
    if (path.basename(file) !== `${correction.correction_id}.json`) {
        throw new Error(`${file}: 파일 이름은 ${correction.correction_id}.json이어야 합니다.`);
    }
    return { file, bytes, sha256: sha256(bytes), gitBlob: gitBlobId(bytes), correction };
}

type Container = Record<string, unknown>;
interface Location { container: Container; key: string }

function locate(set: QuestionSetV3, target: CorrectionTarget): Location {
    const find = <T extends { id: string }>(items: T[] | undefined, id: string, what: string): T => {
        const found = (items ?? []).filter((item) => item.id === id);
        if (found.length !== 1) throw new QuestionCorrectionError(`${targetLabel(target)}: ${what} ${id}가 ${found.length ? '중복됩니다' : '없습니다'}.`);
        return found[0];
    };
    const record = set as unknown as Container;
    if ('subquestion' in target) {
        const sub = find(set.subquestions, target.subquestion, '물음');
        if ('criterion' in target) return { container: find(sub.criteria, target.criterion, 'criterion') as unknown as Container, key: target.field };
        if ('requirement' in target) return { container: find(sub.requirements, target.requirement, 'requirement') as unknown as Container, key: target.field };
        return { container: sub as unknown as Container, key: target.field };
    }
    if ('source_ref' in target) return { container: find(set.source_refs, target.source_ref, '출처') as unknown as Container, key: target.field };
    if ('fact' in target) return { container: find(set.shared_context?.facts, target.fact, '사실') as unknown as Container, key: target.field };
    const [head, tail] = target.field.split('.');
    if (!tail) return { container: record, key: head };
    const parent = record[head];
    if (!isRecord(parent)) throw new QuestionCorrectionError(`${target.field}: 상위 객체 ${head}가 없습니다.`);
    return { container: parent, key: tail };
}

export function readTarget(set: QuestionSetV3, target: CorrectionTarget): unknown {
    const { container, key } = locate(set, target);
    return Object.hasOwn(container, key) ? structuredClone(container[key]) : ABSENT;
}

function writeTarget(set: QuestionSetV3, target: CorrectionTarget, value: unknown): void {
    const { container, key } = locate(set, target);
    // 기존 키에 대입하면 키 순서가 유지된다. 새 선택 필드는 객체 끝에 붙는다.
    if (isAbsent(value)) delete container[key];
    else container[key] = structuredClone(value);
}

export interface CorrectionChange { target: string; reason: string; before: unknown; after: unknown }
export interface AppliedCorrection {
    correction: QuestionSetCorrection;
    index: number;
    before: QuestionSetV3;
    after: QuestionSetV3;
    changes: CorrectionChange[];
    contentHash: { before: string; after: string };
    points: { before: number; after: number };
    publicChanged: boolean;
    learningFieldsChanged: string[];
}

/** 수정 대상이 될 수 없는 구조가 그대로인지 다시 확인한다(배열 전체 교체가 우회로가 되지 않게). */
function frozenShape(set: QuestionSetV3): unknown {
    return {
        schema_version: set.schema_version, id: set.id, type: set.type, status: set.status,
        review_status: set.verification?.review_status, calculation_required: set.verification?.calculation_required,
        topic_id: set.classification?.topic_id, part: set.classification?.part, chapter: set.classification?.chapter,
        domain: set.classification?.domain,
        subquestions: set.subquestions?.map((sub) => ({ id: sub.id, constraints: sub.constraints, selection: sub.selection })),
    };
}

function learningFields(before: QuestionSetV3, after: QuestionSetV3): string[] {
    const changed: string[] = [];
    if (!sameJson(before.shared_context?.facts, after.shared_context?.facts)) changed.push('shared_context.facts');
    for (const sub of after.subquestions) {
        const old = before.subquestions.find((item) => item.id === sub.id);
        for (const key of ['question_style', 'topic_ids', 'prompt'] as const) {
            if (!sameJson(old?.[key] ?? null, sub[key] ?? null)) changed.push(`${sub.id}.${key}`);
        }
    }
    return changed;
}

/** 세트 하나에 correction을 적용한다. 모든 불일치를 모아서 한 번에 보고한다. */
export function applyCorrectionToSet(set: QuestionSetV3, correction: QuestionSetCorrection): { after: QuestionSetV3; changes: CorrectionChange[] } {
    if (set.id !== correction.set_id) throw new QuestionCorrectionError(`correction 대상 세트가 다릅니다: ${set.id} ≠ ${correction.set_id}`);
    const conflicts: string[] = [];
    const current = correction.patches.map((patch) => {
        try { return readTarget(set, patch.target); } catch (error) { conflicts.push(error instanceof Error ? error.message : String(error)); return undefined; }
    });
    const baseHash = reviewedContentHash(set);
    if (baseHash !== correction.base_content_hash) {
        if (!conflicts.length && correction.patches.every((patch, index) => sameJson(current[index], patch.set))) {
            throw new QuestionCorrectionError(`${correction.correction_id}: 이미 적용된 상태입니다. 적용 기록(${CORRECTIONS_DIRECTORY}/applied/)을 확인하십시오.`);
        }
        conflicts.unshift(`세트 ${set.id}의 내용이 correction 작성 이후 바뀌었습니다(base ${correction.base_content_hash.slice(0, 12)}…, 현재 ${baseHash.slice(0, 12)}…). 현재 정본으로 correction을 다시 만드십시오.`);
    }
    correction.patches.forEach((patch, index) => {
        if (current[index] !== undefined && !sameJson(current[index], patch.expected_before)) {
            conflicts.push(`${targetLabel(patch.target)}: 현재 값이 expected_before와 다릅니다.`);
        }
    });
    if (conflicts.length) throw new QuestionCorrectionError(`${correction.correction_id}: 정본과 충돌합니다. 덮어쓰지 않았습니다.`, conflicts);
    const after = structuredClone(set);
    for (const patch of correction.patches) writeTarget(after, patch.target, patch.set);
    if (!sameJson(frozenShape(set), frozenShape(after))) {
        throw new QuestionCorrectionError(`${correction.correction_id}: 수정할 수 없는 구조(ID·수명주기·주제 구조·답안 정책)가 바뀌었습니다.`);
    }
    return {
        after,
        changes: correction.patches.map((patch, index) => ({ target: targetLabel(patch.target), reason: patch.reason, before: current[index], after: patch.set })),
    };
}

export interface AppliedBank { sets: QuestionSetV3[]; applied: AppliedCorrection[]; errors: string[] }

/**
 * 은행에 correction들을 적용하고 대상 세트와 은행 전체를 검증한다. 입력 은행은 바꾸지 않는다.
 * 한 번에 세트당 correction 하나만 받는다(같은 세트의 수정은 한 파일로 합친다).
 */
export function applyCorrections(bank: QuestionSetV3[], corrections: QuestionSetCorrection[], root = process.cwd()): AppliedBank {
    if (!corrections.length) throw new QuestionCorrectionError('적용할 correction이 없습니다.');
    const duplicateIds = corrections.map((c) => c.correction_id).filter((id, i, all) => all.indexOf(id) !== i);
    const duplicateSets = corrections.map((c) => c.set_id).filter((id, i, all) => all.indexOf(id) !== i);
    if (duplicateIds.length || duplicateSets.length) {
        throw new QuestionCorrectionError('한 실행에서 correction ID와 대상 세트는 각각 한 번만 쓸 수 있습니다.', [...new Set([...duplicateIds, ...duplicateSets])]);
    }
    const sets = [...bank];
    const applied: AppliedCorrection[] = [];
    const problems: string[] = [];
    for (const correction of corrections) {
        const index = bank.findIndex((set) => set.id === correction.set_id);
        if (index < 0) { problems.push(`${correction.correction_id}: 정본에 세트 ${correction.set_id}가 없습니다.`); continue; }
        try {
            const before = bank[index];
            const { after, changes } = applyCorrectionToSet(before, correction);
            sets[index] = after;
            applied.push({
                correction, index, before, after, changes,
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
    if (problems.length) throw new QuestionCorrectionError('correction을 적용하지 못했습니다.', problems);
    const errors: string[] = [];
    for (const item of applied) {
        const checked = validateQuestionSetV3(item.after, { verifySourceQuotes: true, cwd: root });
        errors.push(...checked.errors.map((error) => `${item.after.id}: ${error}`));
        // DB 이관 준비 검사와 같은 규칙: 기록한 인용 해시는 인용 문자열의 SHA-256이어야 한다.
        for (const source of item.after.source_refs ?? []) {
            if (source.content_hash !== undefined && source.content_hash !== sha256(source.source_quote)) {
                errors.push(`${item.after.id}/${source.id}: source_quote를 바꾸면 content_hash도 새 인용의 SHA-256으로 바꿔야 합니다.`);
            }
        }
    }
    // 세트 간 발문 중복·주제 최소 분포·기준서 범위는 은행 전체에서만 확인할 수 있다.
    if (!errors.length) errors.push(...validateAuthoringBank(sets, root).errors);
    return { sets, applied, errors };
}

/** 편집 정본의 직렬화 규칙. 세트 순서와 키 순서가 같으면 바이트도 같다. */
export function serializeBank(sets: QuestionSetV3[]): string {
    return `${JSON.stringify(sets, null, 2)}\n`;
}

/** `JSON.stringify(sets,null,2)+'\n'` 문서에서 각 세트 객체의 [start,end) 위치. 문서가 규칙대로가 아니면 거절한다. */
export function bankSpans(document: string, sets: readonly unknown[]): { start: number; end: number }[] {
    const texts = sets.map((set) => JSON.stringify(set, null, 2).split('\n').map((line) => `  ${line}`).join('\n'));
    if (`[\n${texts.join(',\n')}\n]\n` !== document) throw new Error('문제은행 문서가 정본 직렬화 규칙(JSON.stringify 2칸 + 줄바꿈)과 다릅니다.');
    let at = 2;
    return texts.map((text) => { const span = { start: at, end: at + text.length }; at = span.end + 2; return span; });
}

/** 두 정본 문서에서 바이트가 달라진 세트 ID. 세트 목록·순서가 다르면 거절한다. */
export function changedSetIds(beforeDocument: string, afterDocument: string): string[] {
    const before = JSON.parse(beforeDocument) as QuestionSetV3[];
    const after = JSON.parse(afterDocument) as QuestionSetV3[];
    if (!sameJson(before.map((set) => set.id), after.map((set) => set.id))) throw new Error('세트 목록이나 순서가 바뀌었습니다. 수정 경로는 세트를 추가·삭제·재정렬하지 않습니다.');
    const a = bankSpans(beforeDocument, before), b = bankSpans(afterDocument, after);
    return before.map((set, i) => beforeDocument.slice(a[i].start, a[i].end) === afterDocument.slice(b[i].start, b[i].end) ? null : set.id)
        .filter((id): id is string => id !== null);
}

/** 수정 대상 세트만 담은 검수용 부분 은행. 전체 은행 사본 대신 검수 manifest의 bank로 쓴다. */
export function correctionEvidenceBank(sets: QuestionSetV3[], ids: string[]): QuestionSetV3[] {
    const wanted = new Set(ids);
    const subset = sets.filter((set) => wanted.has(set.id));
    if (subset.length !== wanted.size) throw new Error('검수용 부분 은행에 없는 세트가 있습니다.');
    return subset;
}

/** 비계: 현재 정본 값을 expected_before와 set에 그대로 넣고 이유는 TODO로 둔다. 이 상태로는 파서가 거절한다. */
export function scaffoldCorrection(set: QuestionSetV3, options: { correctionId: string; summary: string; targets: CorrectionTarget[] }) {
    if (parseCorrectionId(options.correctionId).setId !== set.id) throw new Error('correction_id의 세트와 대상 세트가 다릅니다.');
    if (!options.targets.length) throw new Error('--target을 하나 이상 지정하십시오.');
    const labels = options.targets.map(targetLabel);
    if (new Set(labels).size !== labels.length) throw new Error('같은 대상을 두 번 지정했습니다.');
    return {
        version: 1, artifact_type: CORRECTION_ARTIFACT_TYPE, correction_id: options.correctionId, set_id: set.id,
        summary: options.summary, base_content_hash: reviewedContentHash(set),
        patches: options.targets.map((target) => {
            const value = readTarget(set, target);
            return { target, reason: 'TODO: 수정 이유', expected_before: value, set: structuredClone(value) };
        }),
    };
}

/** 사람이 읽는 변경 요약. 긴 값은 줄인다. */
export function formatAppliedCorrection(item: AppliedCorrection): string {
    const show = (value: unknown) => {
        const text = isAbsent(value) ? '(없음)' : typeof value === 'string' ? JSON.stringify(value) : canonicalJson(value);
        return text.length > 160 ? `${text.slice(0, 157)}…` : text;
    };
    const lines = [
        `교정 ${item.correction.correction_id} (${item.correction.set_id}) — ${item.correction.summary}`,
        `  내용 해시 ${item.contentHash.before.slice(0, 12)}… → ${item.contentHash.after.slice(0, 12)}…  배점 ${item.points.before} → ${item.points.after}  공개본 ${item.publicChanged ? '바뀜' : '같음'}`
            + (item.learningFieldsChanged.length ? `  학습 분류 관련 변경: ${item.learningFieldsChanged.join(', ')}` : ''),
        ...item.changes.map((change) => `  - ${change.target}: ${show(change.before)} → ${show(change.after)}\n    이유: ${change.reason}`),
    ];
    return lines.join('\n');
}
