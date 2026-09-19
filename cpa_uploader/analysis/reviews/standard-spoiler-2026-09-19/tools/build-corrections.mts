// 기준서형 스포일러 전수 검토(2026-09-19)의 수정 계획(plan-v1.json)을 세트별 correction 파일로 옮긴다.
//   npx tsx cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19/tools/build-corrections.mts [--write]
// --write가 없으면 메모리에서 만들고 검증만 한다. 기존 correction 파일은 덮어쓰지 않는다.
// 계획 항목: prompt·type·model_answer·decision·claims·facts(critical_facts upsert)·remove_criteria·move·classification_standalone.
// 세트 제목이 바뀌는 물음의 옛 발문과 같으면 새 발문으로 맞춘다(std-points 세트는 제목=발문).
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { applyCorrections, CORRECTIONS_DIRECTORY, parseQuestionCorrection, readTarget } from '../../../../questionCorrection.ts';
import type { CorrectionPatch, CorrectionTarget, QuestionSetCorrection } from '../../../../questionCorrection.ts';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const B = 'cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19';
const DATE = '20260919';
const SLUG = 'standard-spoiler';
const write = process.argv.includes('--write');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

type Facts = Record<string, Record<string, { type: string; expected: string }>>;
interface Entry {
    set: string; sub: string; tier: string; issue?: string; review: string; prompt?: string; type?: string;
    model_answer?: string[]; decision?: null; claims?: Record<string, string>; facts?: Facts; facts_reason?: string;
    remove_criteria?: string[]; classification_standalone?: boolean;
    move?: { remove: string[]; receive: { from_set: string; criterion: string; requirement_source_ref: string; after: string } };
}
const plan = read<{ entries: Entry[] }>(`${B}/plan-v1.json`).entries;
const bank = read<QuestionSetV3[]>('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const catalog = read<{ review_file: string }>('cpa_uploader/data/learning-question-classifications.json');
const review = read<{ entries: { set_id: string; subquestion_id: string; question_style: 'standard' | 'case'; topic_ids: string[]; standalone_prompt: string | null; case_fact_ids: string[] }[] }>(catalog.review_file);

const changed = (e: Entry) => Boolean(e.prompt || e.type || e.model_answer || e.decision === null || e.claims || e.facts || e.remove_criteria || e.move);
const setIds = [...new Set(plan.filter(changed).map((e) => e.set))];
const clone = <T,>(value: T): T => structuredClone(value);
const tidy = (text: string) => text.replace(/\s+/gu, ' ').trim();

function upsertFacts(criterion: QuestionSetV3['subquestions'][number]['criteria'][number], oldClaim: string, newClaim: string | undefined, updates: Record<string, { type: string; expected: string }> | undefined) {
    const facts = clone(criterion.critical_facts ?? []);
    if (newClaim !== undefined) for (const fact of facts) if (fact.expected === oldClaim && !updates?.[fact.id]) fact.expected = newClaim;
    for (const [id, value] of Object.entries(updates ?? {})) {
        const found = facts.find((fact) => fact.id === id);
        if (found) { found.type = value.type as typeof found.type; found.expected = value.expected; }
        else facts.push({ id, type: value.type as typeof facts[number]['type'], expected: value.expected });
    }
    return facts;
}

const corrections: QuestionSetCorrection[] = [];
for (const setId of setIds) {
    const set = bank.find((s) => s.id === setId);
    assert(set, `정본에 없는 세트: ${setId}`);
    assert.equal(set.status, 'published', `${setId}: 게시 세트만 correction으로 고친다`);
    const entries = plan.filter((e) => e.set === setId && changed(e));
    const patches: CorrectionPatch[] = [];
    const add = (target: CorrectionTarget, value: unknown, reason: string) => {
        const before = readTarget(set, target);
        assert.notDeepEqual(before, value, `${setId}: 바뀌지 않는 패치 ${JSON.stringify(target)}`);
        patches.push({ target, reason: tidy(reason), expected_before: before, set: value });
    };
    const classificationEntries: NonNullable<QuestionSetCorrection['classification_entries']> = [];
    let criteriaMoved = false;
    for (const e of entries) {
        const sub = set.subquestions.find((q) => q.id === e.sub);
        assert(sub, `${setId}/${e.sub} 없음`);
        const issue = e.issue ?? e.review;
        if (e.prompt) {
            add({ subquestion: sub.id, field: 'prompt' }, e.prompt, `정답 암시: ${issue}`);
            if (set.title === sub.prompt) add({ field: 'title' }, e.prompt, '세트 제목이 옛 발문과 같아 발문에서 없앤 정답 암시가 제목에 남는다. 새 발문으로 맞춘다.');
            const current = review.entries.find((r) => r.set_id === setId && r.subquestion_id === sub.id);
            assert(current, `${setId}/${sub.id}: 분류 입력 없음`);
            if (e.classification_standalone) {
                assert.equal(current.question_style, 'standard');
                classificationEntries.push({ subquestion_id: sub.id, question_style: 'standard', topic_ids: [...current.topic_ids],
                    standalone_prompt: e.prompt, case_fact_ids: [],
                    reason: '기준서형 독립 발문을 정답 암시가 없는 새 발문으로 바꾸고 원 발문도 같은 문장으로 맞췄다. 학습 유형·주제는 그대로다.' });
            } else {
                assert.equal(current.standalone_prompt, sub.prompt, `${setId}/${sub.id}: 따로 다듬은 독립 발문이 있어 classification_standalone가 필요하다`);
            }
        }
        if (e.type) add({ subquestion: sub.id, field: 'type' }, e.type, `답안 형식: ${issue} 새 발문은 ${e.type === 'descriptive' ? '서술' : e.type === 'enumeration' ? '열거' : '판단'}을 요구한다.`);
        if (e.model_answer) add({ subquestion: sub.id, field: 'model_answer' }, e.model_answer, '새 발문과 바뀐 criterion에 맞춘 모범답안이다.');
        if (e.decision === null) add({ subquestion: sub.id, field: 'decision' }, null, '공개본으로 나가는 선택지가 정답 문장을 담고 있었다. 채점은 decision을 쓰지 않으므로 선택지를 없앤다.');
        if (e.remove_criteria || e.move) {
            // 배열 교체: 삭제·이동·claim·critical_facts 변경을 한 패치에 담는다.
            criteriaMoved = true;
            let criteria = clone(sub.criteria);
            const removed = [...(e.remove_criteria ?? []), ...(e.move?.remove ?? [])];
            for (const id of removed) assert(criteria.some((c) => c.id === id), `${setId}: 삭제 대상 ${id} 없음`);
            criteria = criteria.filter((c) => !removed.includes(c.id));
            for (const c of criteria) {
                const old = sub.criteria.find((x) => x.id === c.id)!;
                if (e.claims?.[c.id] !== undefined) c.claim = e.claims[c.id];
                if (e.claims?.[c.id] !== undefined || e.facts?.[c.id]) c.critical_facts = upsertFacts(old, old.claim, e.claims?.[c.id], e.facts?.[c.id]);
            }
            if (e.move) {
                const from = bank.find((s) => s.id === e.move!.receive.from_set)!;
                const moved = from.subquestions.flatMap((q) => q.criteria).find((c) => c.id === e.move!.receive.criterion);
                assert(moved, 'move 대상 criterion 없음');
                assert(!criteria.some((c) => c.id === moved.id), '이동 criterion ID 충돌');
                // 받는 세트에서 같은 원문을 인용하는 requirement를 쓴다(40(d) 발췌·문단 40 전체 인용). 비어 있는 것을 먼저 쓴다.
                const candidates = sub.requirements.filter((r) => r.source_ref_id === e.move!.receive.requirement_source_ref);
                assert(candidates.length, '받는 세트에 해당 원문 requirement가 없음');
                const target = candidates.find((r) => !criteria.some((c) => c.requirement_id === r.id)) ?? candidates[0];
                const copy = { ...clone(moved), requirement_id: target.id, source_ref_ids: [e.move.receive.requirement_source_ref] };
                const at = criteria.findIndex((c) => c.id === e.move!.receive.after);
                assert(at >= 0, 'move 위치 없음');
                criteria.splice(at + 1, 0, copy);
            }
            add({ subquestion: sub.id, field: 'criteria' }, criteria, e.move
                ? `문단 40(c)(d)가 두 물음에 문장 단위로 나뉘어 있어 정답을 쓰지 않고는 범위를 정할 수 없었다. 문단 기호로 범위를 정하도록 ${e.move.remove.join(', ')}를 다른 물음으로 옮기고 ${e.move.receive.criterion}을 받아온다. ${e.review}`
                : `${e.review}`);
            if (e.move) {
                // 이동으로 쓰지 않게 된 requirement·출처는 지운다(채점 입력에는 영향 없음, 공개본 출처 목록 정리).
                const used = new Set(criteria.map((c) => c.requirement_id));
                const requirements = sub.requirements.filter((r) => used.has(r.id));
                if (requirements.length !== sub.requirements.length) {
                    add({ subquestion: sub.id, field: 'requirements' }, requirements, '옮긴 criterion만 쓰던 requirement를 지운다.');
                    const sources = new Set([...requirements.map((r) => r.source_ref_id), ...criteria.flatMap((c) => c.source_ref_ids),
                        ...set.subquestions.filter((q) => q.id !== sub.id).flatMap((q) => [...q.requirements.map((r) => r.source_ref_id), ...q.criteria.flatMap((c) => c.source_ref_ids)])]);
                    const refs = set.source_refs.filter((r) => sources.has(r.id));
                    if (refs.length !== set.source_refs.length) add({ field: 'source_refs' }, refs, '옮긴 criterion만 인용하던 출처(문단 40(c) 발췌)를 지운다.');
                }
            }
        } else {
            for (const [id, claim] of Object.entries(e.claims ?? {})) {
                const c = sub.criteria.find((x) => x.id === id); assert(c, `${setId}/${sub.id}/${id} 없음`);
                add({ subquestion: sub.id, criterion: id, field: 'claim' }, claim, `criterion 명제: ${e.review}`);
            }
            const factIds = new Set([...Object.keys(e.claims ?? {}), ...Object.keys(e.facts ?? {})]);
            for (const id of factIds) {
                const c = sub.criteria.find((x) => x.id === id); assert(c, `${setId}/${sub.id}/${id} 없음`);
                const facts = upsertFacts(c, c.claim, e.claims?.[id], e.facts?.[id]);
                if (JSON.stringify(facts) !== JSON.stringify(c.critical_facts)) {
                    add({ subquestion: sub.id, criterion: id, field: 'critical_facts' }, facts,
                        e.facts_reason ?? '채점 입력에 함께 들어가는 critical_facts를 새 명제·새 발문과 같은 뜻으로 맞춘다.');
                }
            }
        }
    }
    void criteriaMoved;
    const summary = tidy(`기준서형 발문의 정답 암시 제거(${entries.map((e) => e.sub).join('·')})`);
    const correction = {
        version: 1 as const, artifact_type: 'question_set_correction' as const,
        correction_id: `${DATE}-${setId}--${SLUG}`, set_id: setId, summary,
        note: `기준서형 수정·스포일러 전수 검토(${B}/plan-v1.json). 학습 유형·주제·배점 구조는 바꾸지 않는다.`,
        base_content_hash: reviewedContentHash(set), patches,
        ...(classificationEntries.length ? { classification_entries: classificationEntries } : {}),
    };
    corrections.push(parseQuestionCorrection(JSON.parse(JSON.stringify(correction)), correction.correction_id));
}

const result = applyCorrections(bank, corrections);
assert.deepEqual(result.errors, [], result.errors.join('\n'));
const pointChanges = result.applied.filter((a) => a.points.before !== a.points.after).map((a) => `${a.after.id} ${a.points.before}→${a.points.after}`);
console.log(JSON.stringify({ corrections: corrections.length, patches: corrections.reduce((n, c) => n + c.patches.length, 0),
    point_changes: pointChanges, public_changed: result.applied.filter((a) => a.publicChanged).length }, null, 2));
if (write) {
    fs.mkdirSync(CORRECTIONS_DIRECTORY, { recursive: true });
    for (const c of corrections) {
        const file = path.join(CORRECTIONS_DIRECTORY, `${c.correction_id}.json`);
        fs.writeFileSync(file, `${JSON.stringify(c, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    fs.writeFileSync(`${B}/corrections-v1.json`, `${JSON.stringify({ version: 1, created_by: `${B}/tools/build-corrections.mts`,
        plan: `${B}/plan-v1.json`, files: corrections.map((c) => `${CORRECTIONS_DIRECTORY}/${c.correction_id}.json`) }, null, 2)}\n`, { flag: 'wx' });
    console.log(`correction ${corrections.length}개를 썼습니다.`);
}
