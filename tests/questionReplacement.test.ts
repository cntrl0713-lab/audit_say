import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { reviewedContentHash } from '../cpa_uploader/questionReviewIdentity.ts';
import { changedSetIds, parseQuestionSetReplacement, QuestionCorrectionError, serializeBank } from '../cpa_uploader/questionCorrection.ts';
import type { QuestionSetReplacement, ReplacementLineageRow } from '../cpa_uploader/questionCorrection.ts';
import {
    applyCoverageRetargets, applyReplacementToSet, applySpecs, bankLinksForSet, coverageRetargetProblems, scaffoldReplacement,
} from '../cpa_uploader/questionReplacement.ts';
import type { CoverageLinksDocument } from '../cpa_uploader/questionReplacement.ts';
import { carryClassificationEntries } from '../cpa_uploader/questionCorrectionClassification.ts';
import type { ClassificationReviewEntry } from '../cpa_uploader/questionCorrectionClassification.ts';
import { questionHash } from '../cpa_uploader/analysis/coverage/build-coverage.mjs';

const fixtureFile = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/bank.snapshot.json';
const peerIds = [3, 4, 3, 3, 4, 4, 3, 4, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 4].flatMap((count, topic) =>
    Array.from({ length: count }, (_, index) => `pilot-${String(topic + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`));
let cachedBank: QuestionSetV3[] | undefined;
/** 게시된 65세트: 은행 전체 검증(주제 최소 분포 포함)을 실제로 통과하는 격리 은행. */
function bank(): QuestionSetV3[] {
    cachedBank ??= (JSON.parse(fs.readFileSync(fixtureFile, 'utf8')) as QuestionSetV3[]).filter((set) => peerIds.includes(set.id));
    assert.equal(cachedBank.length, 65);
    return structuredClone(cachedBank);
}
const criterionIds = (set: QuestionSetV3) => set.subquestions.flatMap((sub) => sub.criteria.map((crit) => `${sub.id}/${crit.id}`));

function entriesFor(sets: QuestionSetV3[]): ClassificationReviewEntry[] {
    return sets.flatMap((set) => set.subquestions.map((sub) => {
        const style = sub.question_style ?? (set.shared_context.facts.length ? 'case' : 'standard');
        return { set_id: set.id, subquestion_id: sub.id, question_style: style, topic_ids: sub.topic_ids ?? [set.classification.topic_id],
            standalone_prompt: style === 'standard' ? sub.prompt : null, case_fact_ids: [], reason: '격리 분류' };
    }));
}

/** 둘째 물음을 복제해 셋째 물음으로 더하고 첫 criterion의 ID를 바꾼 판본. */
function restructured(set: QuestionSetV3): QuestionSetV3 {
    const next = structuredClone(set);
    const first = next.subquestions[0];
    first.criteria[0].id = `${first.criteria[0].id}r`;
    const third = structuredClone(next.subquestions[1]);
    third.id = 'sub3';
    third.prompt = `${third.prompt} (추가 물음)`;
    for (const requirement of third.requirements) requirement.id = `${requirement.id}r`;
    for (const criterion of third.criteria) { criterion.id = `${criterion.id}x`; criterion.requirement_id = `${criterion.requirement_id}r`; }
    next.subquestions.push(third);
    next.learning_order = [...next.learning_order, 'sub3'];
    return next;
}

/** 현재 세트와 교체본의 ID 차이로 완전한 대응 목록을 만든다. */
function lineageRows(before: string[], after: string[], renamed: Record<string, string> = {}): ReplacementLineageRow[] {
    const rows: ReplacementLineageRow[] = [];
    for (const id of before) {
        const target = renamed[id] ?? (after.includes(id) ? id : null);
        rows.push(target === null ? { before: id, after: null, disposition: 'removed', note: '삭제' }
            : { before: id, after: target, disposition: target === id ? 'kept' : 'rewritten', note: target === id ? '그대로 승계' : 'ID 변경' });
    }
    for (const id of after) if (!rows.some((row) => row.after === id)) rows.push({ before: null, after: id, disposition: 'added', note: '추가' });
    return rows;
}

function specFor(set: QuestionSetV3, replacement: QuestionSetV3, extra: Partial<QuestionSetReplacement> = {}): QuestionSetReplacement {
    const oldFirst = set.subquestions[0].criteria[0].id, newFirst = replacement.subquestions[0].criteria[0].id;
    const renamed = oldFirst === newFirst ? {} : { [`${set.subquestions[0].id}/${oldFirst}`]: `${set.subquestions[0].id}/${newFirst}` };
    return {
        version: 1, artifact_type: 'question_set_replacement', correction_id: `20260922-${set.id}--restructure`, set_id: set.id,
        summary: '격리 테스트 교체', base_content_hash: reviewedContentHash(set), replacement,
        lineage: {
            reason: '둘째 물음을 복제해 셋째 물음으로 더한다(격리 테스트).',
            subquestions: lineageRows(set.subquestions.map((sub) => sub.id), replacement.subquestions.map((sub) => sub.id)),
            criteria: lineageRows(criterionIds(set), criterionIds(replacement), renamed),
        },
        classification_entries: entriesFor([replacement]).map(({ set_id: _set, ...entry }) => entry),
        ...extra,
    };
}
const raw = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

test('the replacement parser demands reasons, complete lineage, full classification and well-formed retargets', () => {
    const set = bank().find((item) => item.subquestions.length === 2)!;
    const spec = specFor(set, restructured(set));
    assert.equal(parseQuestionSetReplacement(raw(spec)).replacement.subquestions.length, 3);
    const mutate = (change: (value: Record<string, unknown>) => void) => { const value = raw(spec); change(value); return value; };
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { (value.lineage as { reason: string }).reason = 'TODO: 이유'; })), /TODO 불가/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { (value.lineage as { subquestions: unknown[] }).subquestions.pop(); })), /sub3의 대응\(after\)이 없습니다/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { (value.classification_entries as unknown[]).pop(); })), /모든 물음.*정확히 한 번씩/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { (value.replacement as { id: string }).id = 'other-id'; })), /같은 id의 세트 객체/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { value.coverage_retargets = [{ link_id: 'l', target: { subquestion_id: 'sub1', criterion_ids: [] }, reason: '재연결' }]; })), /criterion_ids/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { value.coverage_retargets = [{ link_id: 'l', target: null, reason: 'TODO' }]; })), /재연결 근거/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { value.coverage_retargets = [{ link_id: 'l', target: null, relationship: 'exact', reason: '재연결' }]; })), /relationship/);
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { value.patches = []; })), /알 수 없는 키/);
    const added = spec.lineage.subquestions.find((row) => row.disposition === 'added')!;
    assert.throws(() => parseQuestionSetReplacement(mutate((value) => { const rows = (value.lineage as { subquestions: ReplacementLineageRow[] }).subquestions; rows[rows.indexOf(rows.find((row) => row.after === added.after)!)] = { ...added, before: 'sub1' }; })), /added는 before=null/);
});

test('applying a replacement guards the base hash, frozen fields, lifecycle labels and lineage completeness', () => {
    const set = bank().find((item) => item.subquestions.length === 2)!;
    const replacement = restructured(set);
    const applied = applyReplacementToSet(set, specFor(set, replacement));
    assert.deepEqual(applied.after.subquestions.map((sub) => sub.id), [...set.subquestions.map((sub) => sub.id), 'sub3']);
    assert.equal(applied.changes[0].target, 'subquestions');
    assert.match(applied.changes[1].reason, /rewritten 1/);
    // 기준 해시가 다르면 거절, 이미 적용된 상태는 따로 알린다
    assert.throws(() => applyReplacementToSet(set, specFor(set, replacement, { base_content_hash: 'a'.repeat(64) })), /정본과 충돌/);
    assert.throws(() => applyReplacementToSet(replacement, specFor(set, replacement)), /이미 적용된 상태/);
    assert.throws(() => applyReplacementToSet(set, specFor(set, structuredClone(set))), /바꾸는 내용이 없습니다/);
    // 주제 구조·수명주기 라벨은 바꾸지 못한다
    const otherTopic = restructured(set); otherTopic.classification.topic_id = '19';
    assert.throws(() => applyReplacementToSet(set, specFor(set, otherTopic)), /주제 구조/);
    const relabeled = restructured(set); relabeled.status = 'needs_review';
    assert.throws(() => applyReplacementToSet(set, specFor(set, relabeled)), /수명주기 라벨/);
    // 대응이 빠지거나 없는 ID를 가리키면 거절
    const incomplete = specFor(set, replacement);
    incomplete.lineage.criteria = incomplete.lineage.criteria.filter((row) => row.disposition !== 'rewritten');
    try { applyReplacementToSet(set, incomplete); assert.fail('incomplete lineage accepted'); } catch (error) {
        assert.ok(error instanceof QuestionCorrectionError);
        assert.match(error.message, /before .* 대응이 없습니다/);
    }
});

test('applySpecs changes only the replaced set, keeps the bank valid and gives the catalog explicit classifications', () => {
    const sets = bank();
    const set = sets.find((item) => item.subquestions.length === 2)!;
    const spec = specFor(set, restructured(set));
    const result = applySpecs(sets, [spec]);
    assert.deepEqual(result.errors, []);
    assert.equal(result.applied[0].kind, 'replacement');
    assert.equal(result.applied[0].publicChanged, true);
    assert.deepEqual(changedSetIds(serializeBank(sets), serializeBank(result.sets)), [set.id]);
    assert.deepEqual(result.applied[0].learningFieldsChanged, ['sub3.prompt']);
    const carried = carryClassificationEntries(entriesFor(sets), result.applied).filter((entry) => entry.set_id === set.id);
    assert.deepEqual(carried.map((entry) => entry.subquestion_id), [...set.subquestions.map((sub) => sub.id), 'sub3']);
    assert.throws(() => applySpecs(sets, [spec, spec]), /한 번만/);
});

test('bank links that lose their target require a retarget, and applying one refreshes the question hash', () => {
    const sets = bank();
    const set = sets.find((item) => item.subquestions.length === 2)!;
    const replacement = restructured(set);
    const first = set.subquestions[0], oldCrit = first.criteria[0].id, newCrit = replacement.subquestions[0].criteria[0].id;
    const document: CoverageLinksDocument = { version: 1, policy: '격리', links: [
        { id: 'moved', element_id: 'e1', source_unit_ids: [], target: { set_id: set.id, subquestion_id: first.id, criterion_ids: [oldCrit] }, relationship: 'direct', review_status: 'reviewed', reason: '격리', snapshot: { question_sha256: 'old' } },
        { id: 'kept', element_id: 'e2', source_unit_ids: [], target: { set_id: set.id, subquestion_id: set.subquestions[1].id, criterion_ids: [set.subquestions[1].criteria[0].id] }, relationship: 'partial', review_status: 'reviewed', reason: '격리' },
        { id: 'draft', element_id: 'e3', source_unit_ids: [], target: { scope: 'draft', file: 'cpa_uploader/drafts/x.json', set_id: set.id, subquestion_id: first.id, criterion_ids: [oldCrit] }, relationship: 'direct', review_status: 'needs_review', reason: '초안' },
        { id: 'other', element_id: 'e4', source_unit_ids: [], target: { set_id: 'pilot-19-001', subquestion_id: 'sub1', criterion_ids: ['crit1'] }, relationship: 'direct', review_status: 'reviewed', reason: '다른 세트' },
    ] };
    assert.deepEqual(bankLinksForSet(document, set.id).map((link) => link.id), ['moved', 'kept']);
    const spec = specFor(set, replacement);
    assert.match(coverageRetargetProblems(document, replacement, spec).join('\n'), /관계 moved이 가리키던/);
    assert.throws(() => applyCoverageRetargets(document, replacement, spec), /coverage 관계를 정리/);
    const wrong = specFor(set, replacement, { coverage_retargets: [{ link_id: 'other', target: null, reason: '엉뚱한 관계' }] });
    assert.match(coverageRetargetProblems(document, replacement, wrong).join('\n'), /이 세트를 가리키는 은행 관계가 아닙니다/);
    const missing = specFor(set, replacement, { coverage_retargets: [{ link_id: 'moved', target: { subquestion_id: first.id, criterion_ids: ['nope'] }, reason: '없는 대상' }] });
    assert.match(coverageRetargetProblems(document, replacement, missing).join('\n'), /replacement에 없습니다/);
    const good = specFor(set, replacement, { coverage_retargets: [{ link_id: 'moved', target: { subquestion_id: first.id, criterion_ids: [newCrit] }, review_status: 'reviewed', relationship: 'partial', reason: 'criterion ID만 바뀌었다.' }] });
    assert.deepEqual(coverageRetargetProblems(document, replacement, good), []);
    const applied = applyCoverageRetargets(document, replacement, good);
    assert.equal(document.links[0].target!.criterion_ids[0], oldCrit, '입력 장부는 바뀌지 않는다');
    const moved = applied.document.links[0];
    assert.deepEqual(moved.target, { set_id: set.id, subquestion_id: first.id, criterion_ids: [newCrit] });
    assert.equal(moved.relationship, 'partial'); assert.equal(moved.review_status, 'reviewed'); assert.equal(moved.reason, 'criterion ID만 바뀌었다.');
    assert.equal(moved.snapshot!.question_sha256, questionHash(replacement, replacement.subquestions[0]));
    assert.deepEqual(applied.document.links.slice(1), document.links.slice(1));
    assert.equal(applied.changes[0].before.target!.criterion_ids[0], oldCrit);
    const detached = applyCoverageRetargets(document, replacement, specFor(set, replacement, { coverage_retargets: [{ link_id: 'moved', target: null, reason: '대상 없음' }] }));
    assert.equal(detached.document.links[0].target, null);
    assert.equal(detached.document.links[0].review_status, 'needs_review');
});

test('a replacement scaffold copies the live set and cannot be applied until reasons are written', () => {
    const sets = bank();
    const set = sets.find((item) => item.subquestions.length === 2)!;
    const draft = scaffoldReplacement(set, { correctionId: `20260922-${set.id}--restructure`, summary: '격리', entries: entriesFor(sets) });
    assert.equal(draft.base_content_hash, reviewedContentHash(set));
    assert.deepEqual(draft.replacement, set);
    assert.equal(draft.lineage.subquestions.length, set.subquestions.length);
    assert.equal(draft.lineage.criteria.length, criterionIds(set).length);
    assert.deepEqual(draft.classification_entries.map((entry) => entry.subquestion_id), set.subquestions.map((sub) => sub.id));
    assert.throws(() => parseQuestionSetReplacement(raw(draft)), /TODO 불가/);
    assert.throws(() => scaffoldReplacement(set, { correctionId: '20260922-other--x', summary: '격리', entries: [] }), /다릅니다/);
});
