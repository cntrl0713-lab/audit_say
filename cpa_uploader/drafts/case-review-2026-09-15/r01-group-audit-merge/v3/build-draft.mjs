// r01 병합 초안 v3: v2 사실관계·출처는 그대로 두고 새 선택형 배점(옳지 않은 항목마다 이유 또는 보완절차 1점)으로 발문·모범답안·기준을 바꾼다.
// v2(../v2/sets.json)는 execution-v2의 고정 입력이므로 읽기만 한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v3/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v3';
const V2 = 'cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v2/sets.json';
const [v2] = JSON.parse(fs.readFileSync(V2, 'utf8'));
const set = structuredClone(v2);
const quote = (id) => { const ref = set.source_refs.find((r) => r.id === id); assert(ref, id); return ref.source_quote; };
const [sub1, sub2] = set.subquestions;
const v2Requirement = (sub, id) => { const row = sub.requirements.find((r) => r.id === id); assert(row, id); return row; };
const one = { met: 1, not_met: 0, contradicted: 0 };
const criterion = (id, type, claim, refIds) => ({
    id, requirement_id: id.replace(/\.c(\d+)$/u, '.req$1'), claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }], max_points: 1, scores: { ...one }, source_ref_ids: refIds,
});
const requirement = (id, refId, sourceQuote, span) => ({ id, source_ref_id: refId, source_quote: sourceQuote, source_span: span });

Object.assign(sub1, {
    prompt: '계획 단계에서 그룹업무팀이 수행한 절차 ①~④ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 그룹업무팀이 수행하였어야 할 절차를 간략히 서술하시오.',
    model_answer: [
        '옳지 않은 것은 ①과 ④이다. ②는 심각하지 않은 전문가적 적격성 우려를 그룹업무팀의 관여로 보완한 것이고, ③은 유의적 위험을 포함할 것 같은 부문에 허용되는 업무유형 중 하나를 수행한 것이므로 옳다.',
        '① 독립성 요구사항을 충족하지 못한 부문감사인은 그룹업무팀이 관여를 강화하더라도 그 결함을 극복할 수 없으므로 병에게 업무를 요청할 수 없고, 그룹감사인이 물류부문 재무정보에 관하여 충분하고 적합한 감사증거를 직접 입수하여야 한다.',
        '④ 유의적 부문 업무 등만으로는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상하였으므로 판매부문이 유의적이지 않다는 이유로 추가 업무를 생략할 수 없고, 판매부문 중 일부를 선정하여 감사·검토·특정 절차 등의 추가 업무를 수행하거나 부문감사인에게 요청하여야 한다.',
    ],
    requirements: [
        v2Requirement(sub1, 'sub1.req1'),
        requirement('sub1.req2', 'kga600-A39', quote('kga600-A39'), 'KGA 600 문단 A39·20; 적용: 독립성 결격은 그룹업무팀의 관여나 추가 위험평가·추가감사절차로 극복할 수 없으므로 병에게 업무를 요청하지 않고 그룹감사인이 물류부문 재무정보에 관한 증거를 입수한다. 이유와 절차 중 하나를 핵심 수준으로 쓰면 충족한다.'),
        requirement('sub1.req3', 'kga600-29', quote('kga600-29'), 'KGA 600 문단 29; 적용: 유의적 부문 업무·그룹차원 통제와 연결절차 업무·그룹 수준 분석적절차만으로 충분한 증거를 입수하지 못할 것으로 예상하면 유의적이지 않은 부문 중 일부를 추출해 추가 업무를 수행하거나 요청한다. 이유와 절차 중 하나를 핵심 수준으로 쓰면 충족하며 업무유형 명칭의 나열은 요구하지 않는다.'),
    ],
    criteria: [
        sub1.criteria.find((c) => c.id === 'sub1.c1'),
        criterion('sub1.c2', 'action', '① 독립성 요구사항을 충족하지 못한 부문감사인에게는 그룹업무팀이 위험평가 참여나 감사조서 검토로 관여를 강화하더라도 업무를 요청할 수 없다는 이유, 또는 병에게 요청하지 않고 그룹감사인(그룹업무팀)이 물류부문 재무정보에 관하여 충분하고 적합한 감사증거를 직접 입수해야 한다는 절차를 제시한다. 둘 중 하나만 써도 인정한다. 관여나 조서 검토로 독립성 문제를 보완할 수 있다고 쓰면 인정하지 않는다.', ['kga600-A39', 'kga600-20']),
        criterion('sub1.c3', 'action', '④ 유의적 부문 업무 등만으로는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상한 상황이므로 유의적이지 않다는 이유로 추가 업무를 생략할 수 없다는 이유, 또는 판매부문 중 일부를 선정하여 감사·검토·특정 절차 등 추가 업무를 수행하거나 부문감사인에게 요청해야 한다는 절차를 제시한다. 둘 중 하나만 써도 인정하며 업무유형의 명칭 나열은 요구하지 않는다. 이유만 쓸 때에는 분석적절차만으로는 증거가 부족한 상황이라는 점이 드러나야 한다. 유의적이지 않은 부문에는 분석적절차만으로 충분하다고 쓰면 인정하지 않는다.', ['kga600-29']),
    ],
});
Object.assign(sub2, {
    prompt: '업무 수행과 종결 단계에서 그룹업무팀이 수행한 절차 ⑤~⑨ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 그룹업무팀이 수행하였어야 할 절차를 간략히 서술하시오.',
    model_answer: [
        sub2.model_answer[0],
        '⑦ 부문중요성 미달이나 갑과 을의 적정의견은 부문 수준의 판단일 뿐이어서 부문별로 작더라도 합하면 그룹재무제표에 중요할 수 있으므로, 제조부문과 해외판매부문의 같은 방향 미수정 매출 과대계상을 합산하여 그룹재무제표와 그룹감사의견에 미치는 영향을 평가하여야 한다.',
        sub2.model_answer[3],
    ],
    requirements: [
        v2Requirement(sub2, 'sub2.req1'),
        requirement('sub2.req2', 'kga600-A43', quote('kga600-A43'), 'KGA 600 문단 A43·A44·A8·45·A63; 적용: 부문중요성은 합계 위험을 줄이려고 그룹 중요성보다 낮게 정한 부문 수준 금액이고 부문감사인의 의견은 부문에 대한 것이므로, 그룹 수준에서 미수정왜곡표시의 총영향을 평가한다. 이유와 절차 중 하나를 핵심 수준으로 쓰면 충족하며 금액 계산은 요구하지 않는다.'),
        { ...v2Requirement(sub2, 'sub2.req4'), id: 'sub2.req3' },
    ],
    criteria: [
        sub2.criteria.find((c) => c.id === 'sub2.c1'),
        criterion('sub2.c2', 'action', '⑦ 각 과대계상이 부문중요성보다 작다는 점이나 갑과 을이 적정의견을 표명한 점은 부문 수준의 판단이어서 그룹 수준의 평가를 대신할 수 없다는 이유, 또는 두 부문에서 같은 방향으로 발생한 미수정 매출 과대계상을 합산하여 그룹재무제표와 그룹감사의견에 미치는 영향을 평가해야 한다는 절차를 제시한다. 둘 중 하나만 써도 인정하며 금액 계산은 요구하지 않는다. 부문중요성 미달이나 부문 적정의견으로 그룹 수준 평가를 대신할 수 있다고 쓰면 인정하지 않는다.', ['kga600-A43', 'kga600-A44', 'kga600-A8', 'kga600-45', 'kga600-A63']),
        { ...sub2.criteria.find((c) => c.id === 'sub2.c4'), id: 'sub2.c3', requirement_id: 'sub2.req3',
            critical_facts: sub2.criteria.find((c) => c.id === 'sub2.c4').critical_facts.map((f) => ({ ...f, id: 'sub2.c3.fact' })) },
    ],
});
assert.equal(sub2.criteria[2].claim.startsWith('⑧'), true);
set.verification.notes = [
    '2026-09-15 사용자가 지정한 사례형 검토에 따라 case-14-component-evidence-gap-20260914, pilot-14-006, pilot-14-007을 한 사례로 병합한 재구성 초안의 v3다. v2의 사실관계·출처를 그대로 두고, 사용자가 확정한 새 선택형 배점(옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 1점)에 맞춰 발문·모범답안·기준을 바꾸었다. 원 세트·v1·v2와의 대응은 같은 폴더의 lineage.json에 기록한다.',
    '사용자가 확정한 대상 연도는 2027년이다. 사례의 20X1년은 2027년 시험에 적용되는 KGA 600 2025 개정 전문(문단 7: 2026년 1월 1일 이후 개시 보고기간부터 시행)을 기준으로 판단하며, 등록된 전문 추출본의 본문과 적용자료를 직접 대조하였다.',
    '옳고 그름을 구분하는 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별에 1점, 옳지 않은 항목마다 이유 또는 보완절차 중 하나에 1점을 둔다. 구체적인 후속절차의 나열은 요구하지 않는다. 함정 ②·③·⑤·⑥·⑨에는 별도 득점 기준이 없다.',
    'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
];
fs.mkdirSync(D, { recursive: true });
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
assert.deepEqual(set.shared_context, v2.shared_context, 'v3 keeps the v2 facts');
assert.deepEqual(set.source_refs, v2.source_refs, 'v3 keeps the v2 sources');
console.log({ set: set.id, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
