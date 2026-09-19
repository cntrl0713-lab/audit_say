// 기준서형 수정·스포일러 전수 검토(2026-09-19)의 후속 계획(plan-v2.json)을 세트별 correction 파일로 옮긴다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19/tools/build-corrections-v2.mts [--write]
// v1 실측에서 드러난 채점 입력 오류(명제·critical_facts·모범답안)만 고친다. 발문·배점·criterion 구성은 바꾸지 않는다.
// --write가 없으면 메모리에서 만들고 검증만 한다. 기존 correction 파일은 덮어쓰지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { applyCorrections, CORRECTIONS_DIRECTORY, parseQuestionCorrection, readTarget } from '../../../../questionCorrection.ts';
import type { CorrectionPatch, CorrectionTarget, QuestionSetCorrection } from '../../../../questionCorrection.ts';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const B = 'cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19';
const DATE = '20260919';
const SLUG = 'standard-spoiler-followup';
const write = process.argv.includes('--write');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

type Fact = { type: string; expected: string };
interface Entry {
    set: string; sub: string; tier: string; issue?: string; review: string;
    claims?: Record<string, string>; claims_reason?: string;
    facts?: Record<string, Record<string, Fact>>; facts_reason?: string;
    model_answer?: string[]; model_answer_reason?: string;
}
const allowed = new Set(['set', 'sub', 'tier', 'issue', 'review', 'claims', 'claims_reason', 'facts', 'facts_reason', 'model_answer', 'model_answer_reason']);
const plan = read<{ entries: Entry[] }>(`${B}/plan-v2.json`).entries;
for (const e of plan) for (const key of Object.keys(e)) assert(allowed.has(key), `${e.set}/${e.sub}: plan-v2가 다루지 않는 필드 ${key}`);
const bank = read<QuestionSetV3[]>('cpa_uploader/data/cpa_question_sets_v3.authoring.json');

const changed = (e: Entry) => Boolean(e.claims || e.facts || e.model_answer);
const setIds = [...new Set(plan.filter(changed).map((e) => e.set))];
const tidy = (text: string) => text.replace(/\s+/gu, ' ').trim();

type Criterion = QuestionSetV3['subquestions'][number]['criteria'][number];
function nextFacts(criterion: Criterion, newClaim: string | undefined, updates: Record<string, Fact> | undefined) {
    const facts = structuredClone(criterion.critical_facts ?? []);
    // 옛 명제를 그대로 옮겨 적은 fact는 새 명제로 맞춘다. 따로 지정한 fact는 지정값을 쓴다.
    if (newClaim !== undefined) for (const fact of facts) if (fact.expected === criterion.claim && !updates?.[fact.id]) fact.expected = newClaim;
    for (const [id, value] of Object.entries(updates ?? {})) {
        const found = facts.find((fact) => fact.id === id);
        assert(found, `${criterion.id}: 없는 critical_fact ${id}`);
        found.type = value.type as typeof found.type; found.expected = value.expected;
    }
    return facts;
}

const corrections: QuestionSetCorrection[] = [];
for (const setId of setIds) {
    const set = bank.find((s) => s.id === setId);
    assert(set, `정본에 없는 세트: ${setId}`);
    assert.equal(set.status, 'published', `${setId}: 게시 세트만 correction으로 고친다`);
    for (const sub of set.subquestions) assert(plan.some((e) => e.set === setId && e.sub === sub.id), `${setId}/${sub.id}: 대상 세트의 모든 물음을 plan-v2에서 다시 대조한다`);
    const entries = plan.filter((e) => e.set === setId && changed(e));
    const patches: CorrectionPatch[] = [];
    const add = (target: CorrectionTarget, value: unknown, reason: string) => {
        const before = readTarget(set, target);
        assert.notDeepEqual(before, value, `${setId}: 바뀌지 않는 패치 ${JSON.stringify(target)}`);
        patches.push({ target, reason: tidy(reason), expected_before: before, set: value });
    };
    for (const e of entries) {
        const sub = set.subquestions.find((q) => q.id === e.sub);
        assert(sub, `${setId}/${e.sub} 없음`);
        assert(e.issue, `${setId}/${e.sub}: 고치는 물음에는 issue가 필요하다`);
        for (const [id, claim] of Object.entries(e.claims ?? {})) {
            assert(sub.criteria.some((c) => c.id === id), `${setId}/${sub.id}/${id} 없음`);
            assert(e.claims_reason, `${setId}/${sub.id}: claims_reason 없음`);
            add({ subquestion: sub.id, criterion: id, field: 'claim' }, claim, e.claims_reason);
        }
        for (const id of new Set([...Object.keys(e.claims ?? {}), ...Object.keys(e.facts ?? {})])) {
            const c = sub.criteria.find((x) => x.id === id); assert(c, `${setId}/${sub.id}/${id} 없음`);
            const facts = nextFacts(c, e.claims?.[id], e.facts?.[id]);
            if (JSON.stringify(facts) !== JSON.stringify(c.critical_facts)) {
                add({ subquestion: sub.id, criterion: id, field: 'critical_facts' }, facts,
                    e.facts_reason ?? '채점 입력에 함께 들어가는 critical_facts를 새 명제와 같은 뜻으로 맞춘다.');
            }
        }
        if (e.model_answer) {
            assert(e.model_answer_reason, `${setId}/${sub.id}: model_answer_reason 없음`);
            add({ subquestion: sub.id, field: 'model_answer' }, e.model_answer, e.model_answer_reason);
        }
    }
    const summary = tidy(`기준서형 검토 후속: 실측에서 드러난 채점 입력 오류 수정(${entries.map((e) => e.sub).join('·')})`);
    const correction = {
        version: 1 as const, artifact_type: 'question_set_correction' as const,
        correction_id: `${DATE}-${setId}--${SLUG}`, set_id: setId, summary,
        note: `기준서형 수정·스포일러 전수 검토의 v1 실측(${B}/batch-v1.json)에서 드러난 명제·critical_facts·모범답안의 오류를 고친다(${B}/plan-v2.json). 발문·학습 유형·주제·배점은 바꾸지 않는다.`,
        base_content_hash: reviewedContentHash(set), patches,
    };
    corrections.push(parseQuestionCorrection(JSON.parse(JSON.stringify(correction)), correction.correction_id));
}

const result = applyCorrections(bank, corrections);
assert.deepEqual(result.errors, [], result.errors.join('\n'));
for (const a of result.applied) assert.equal(a.points.before, a.points.after, `${a.after.id}: 배점이 바뀌면 안 된다`);
console.log(JSON.stringify({ corrections: corrections.length, patches: corrections.reduce((n, c) => n + c.patches.length, 0),
    by_set: Object.fromEntries(corrections.map((c) => [c.set_id, c.patches.map((p) => `${p.target.subquestion ?? ''}/${p.target.criterion ?? ''}:${p.target.field}`)])),
    public_changed: result.applied.filter((a) => a.publicChanged).length }, null, 2));
if (write) {
    for (const c of corrections) {
        const file = path.join(CORRECTIONS_DIRECTORY, `${c.correction_id}.json`);
        fs.writeFileSync(file, `${JSON.stringify(c, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    fs.writeFileSync(`${B}/corrections-v2.json`, `${JSON.stringify({ version: 1, created_by: `${B}/tools/build-corrections-v2.mts`,
        plan: `${B}/plan-v2.json`, files: corrections.map((c) => `${CORRECTIONS_DIRECTORY}/${c.correction_id}.json`) }, null, 2)}\n`, { flag: 'wx' });
    console.log(`correction ${corrections.length}개를 썼습니다.`);
}
