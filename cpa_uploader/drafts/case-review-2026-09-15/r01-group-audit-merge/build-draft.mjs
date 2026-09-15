// 55·18·19 사례 병합 초안 생성기. 원문 인용은 현재 정본의 원 세트와 등록 전문에서 그대로 복사한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const KGA600 = 'cpa_uploader/data/official/kga600-2025-review14.txt';
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const text = fs.readFileSync(KGA600, 'utf8');
const original = (id) => { const set = bank.find((s) => s.id === id); assert(set, id); return set; };
const from = (setId, refId) => original(setId).source_refs.find((r) => r.id === refId);
const between = (start, end) => {
    const i = text.indexOf(start); const j = text.indexOf(end, i);
    assert(i >= 0 && j > i, start); return text.slice(i, j + end.length);
};
const lines = (quote) => {
    const i = text.indexOf(quote); assert(i >= 0);
    const first = text.slice(0, i).split('\n').length; return `L${first}-L${first + quote.split('\n').length - 1}`;
};
const reuse = (id, setId, refId) => {
    const ref = from(setId, refId); assert(ref && ref.content_hash === sha(ref.source_quote), refId);
    return { id, file: ref.file, title: ref.title, page: ref.page, source_quote: ref.source_quote, role: 'standard', content_hash: ref.content_hash };
};
const extract = (id, paragraph, start, end) => {
    const quote = between(start, end);
    return { id, file: KGA600, title: `KGA 600 문단 ${paragraph}, 2025 개정 전문; ${lines(quote)}`, page: 'KGA 600', source_quote: quote, role: 'standard', content_hash: sha(quote) };
};

const G = 'case-14-component-evidence-gap-20260914', P6 = 'pilot-14-006', P7 = 'pilot-14-007';
const refs = [
    reuse('kga600-7', P6, 'std-7'),
    reuse('kga600-20', P6, 'std-20'),
    reuse('kga600-A39', P6, 'std-A39'),
    reuse('kga600-A40', P6, 'std-A40'),
    reuse('kga600-27', P7, 'std-27'),
    reuse('kga600-29', P7, 'std-29'),
    extract('kga600-A8', 'A8', 'A8. 부문감사인은', '회계법인에 있다.'),
    reuse('kga600-43', G, 'src-8b5100ad4819792a6a'),
    extract('kga600-A62', 'A62', 'A62. 그룹업무팀이', '직접 그 자신의 절차를 수행할 것이다.'),
    reuse('kga600-44', G, 'src-819bd8dfba551bbe1a'),
    reuse('kga600-45', G, 'src-c9a271b8337eb8bec6'),
    reuse('kga600-A63', G, 'src-0b37276323f5bbc99f'),
];
const quote = (id) => refs.find((r) => r.id === id).source_quote;
const quote29Condition = between('29. 다음의 업무들을', '(c) 그룹수준에서 수행한 분석적절차');
const quote29Action = between('이러한 경우에는, 그룹업무팀은 유의적이지 아니한', '(문단 A51-A53 참조)');
assert(quote('kga600-29').includes(quote29Condition) && quote('kga600-29').includes(quote29Action));

const facts = [
    { id: 'fact1', text: '한빛회계법인의 그룹업무팀은 한빛그룹의 20X1년 1월 1일부터 12월 31일까지의 그룹재무제표를 감사하고 있다. 그룹은 제조부문, 해외판매부문, 물류부문, 서비스부문, 자금부문과 12개의 소규모 판매부문으로 구성된다. 제조부문, 해외판매부문, 물류부문, 서비스부문은 각각 그룹에 대하여 개별적으로 재무적 유의성이 있는 유의적 부문이며, 그룹업무팀은 이들 부문의 재무정보를 부문중요성을 사용하여 감사하도록 계획하였다. 제조부문 감사인 갑과 해외판매부문 감사인 을은 그룹감사에 적용되는 독립성 요구사항을 충족하고 전문가적 적격성에 대한 우려도 없으며, 그룹업무팀은 두 감사인의 업무와 감사문서에 필요한 만큼 관여할 수 있다.' },
    { id: 'fact2', text: [
        '계획 단계에서 그룹업무팀은 유의적 부문의 재무정보에 대한 업무, 그룹차원의 통제와 연결절차에 대한 업무 및 그룹 수준의 분석적절차만으로는 그룹감사의견의 근거가 되는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상하였다. 그룹업무팀이 계획 단계에서 수행한 절차는 다음과 같다.',
        '① 물류부문 감사인 병은 그룹감사에 적용되는 독립성 요구사항을 충족하지 못하며, 그 사유는 감사 종료 시까지 해소되지 않는다. 그룹업무팀은 물류부문 재무정보에 대한 감사를 병에게 요청하되, 병의 위험평가에 참여하고 병의 감사조서를 폭넓게 검토하기로 하였다.',
        '② 서비스부문 감사인 정은 독립성 요구사항을 충족하지만 서비스부문이 영위하는 산업의 특수한 거래에 관한 지식이 부족하다. 그룹업무팀은 정의 전문가적 적격성에 대한 이 우려가 심각한 수준은 아니라고 평가하였다. 그룹업무팀은 서비스부문 재무정보에 대한 감사를 정에게 요청하고, 정의 위험평가에 참여하며 해당 거래와 관련된 정의 감사문서를 검토하기로 하였다.',
        '③ 자금부문은 개별적으로 재무적 유의성이 없지만 그룹의 외화자금 거래를 집중 처리한다. 당기에 체결한 복잡한 외화파생상품의 측정과 관련 공시로 인해 그룹재무제표의 유의적인 중요왜곡표시위험을 포함할 것 같아 유의적 부문으로 식별되었으며, 그 밖의 거래와 계정에서는 유의적 위험이 식별되지 않았다. 그룹업무팀은 자금부문에 대하여 외화파생상품의 측정과 공시에 관한 위험에 대응하는 특정 감사절차만을 직접 수행하기로 하였다.',
        '④ 12개 소규모 판매부문은 모두 유의적이지 않은 부문이다. 그룹업무팀은 이들 부문에 대하여 그룹 수준의 분석적절차를 수행하고, 유의적이지 않은 부문이라는 점을 들어 어느 판매부문도 추가 업무 대상으로 선정하지 않았다.',
    ].join('\n') },
    { id: 'fact3', text: [
        '업무 수행 단계에서 그룹업무팀은 해외판매부문이 제3자 창고에 보관한 중요한 재고의 실재성을 확인하도록 을에게 요청하였다. 을의 종결보고서에는 충분한 증거를 얻었다고 기재되어 있었으나 첨부 요약표에는 회사 내부의 재고명세서만 열람한 것으로 표시되어 있었다. 그룹업무팀은 이 차이를 을과 토의하고 관련 감사문서를 검토한 결과, 을이 요청의 범위를 내부 명세서와의 대사로 잘못 이해하였고 창고 재고에 관한 을의 업무가 불충분하다고 결론 내렸다. 제3자 창고는 감사인의 직접 조회에 응할 수 있고 창고 현장에 대한 접근도 가능하다.',
        '⑤ 그룹업무팀은 창고에 보관된 재고의 수량과 상태를 창고에 직접 조회하고 창고 현장에서 재고를 검사하는 추가 감사절차를 정하여, 이를 을이 수행하도록 지시하였다. 을이 이 절차를 수행하더라도 그룹감사의견에 대한 책임은 그룹업무수행이사가 지므로, 그룹업무팀은 추가 감사절차의 결과를 직접 평가하여 그룹감사의견에 반영하기로 하였다.',
    ].join('\n') },
    { id: 'fact4', text: [
        '종결 단계에서 제조부문과 해외판매부문에서 각각 발견된 매출 과대계상은 경영진이 수정하지 않았으며, 갑과 을이 이를 그룹업무팀에 전달하였다. 두 왜곡표시는 모두 그룹의 매출과 이익을 증가시키는 방향이다. 또한 제조부문의 진행 중인 소송과 관련된 충당부채에 대하여는 갑과 그룹업무팀이 추가 절차를 수행하였음에도 충분하고 적합한 감사증거를 입수하지 못한 상황이 남아 있다.',
        '⑥ 그룹업무팀은 갑과 을이 각 부문의 법정감사에서 적정의견을 표명하였다는 이유로, 위 미수정 매출 과대계상과 소송충당부채에 관한 사항을 그룹 수준에서 별도로 평가하지 않고 그룹감사를 종결하였다.',
    ].join('\n') },
].map((fact) => ({ ...fact, scoreable: false }));

const one = { met: 1, not_met: 0, contradicted: 0 };
const criterion = (id, type, claim, refIds) => ({
    id, requirement_id: id.replace(/\.c(\d+)$/u, '.req$1'), claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }], max_points: 1, scores: { ...one }, source_ref_ids: refIds,
});
const requirement = (id, refId, sourceQuote, span) => ({ id, source_ref_id: refId, source_quote: sourceQuote, source_span: span });
const shape = { constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: null };

const sub1 = {
    id: 'sub1', type: 'judgment', question_style: 'case', topic_ids: ['14', '01'],
    prompt: '계획 단계에서 그룹업무팀이 수행한 절차 ①~④ 중 감사기준에 비추어 옳지 않은 절차를 모두 찾아 번호를 쓰고, 각 절차가 옳지 않은 이유와 그룹업무팀이 수행하였어야 할 올바른 절차를 설명하시오.',
    ...shape, answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 절차는 ①과 ④이다. ②는 심각하지 않은 전문가적 적격성 우려를 그룹업무팀의 관여로 보완한 것이고, ③은 유의적 위험을 포함할 것 같은 부문에 허용되는 업무유형 중 하나를 수행한 것이므로 옳다.',
        '① 병은 그룹감사에 적용되는 독립성 요구사항을 충족하지 못하므로, 그룹업무팀이 병의 위험평가에 참여하거나 감사조서 검토를 넓히더라도 이를 극복할 수 없어 병에게 물류부문 재무정보에 관한 업무를 요청할 수 없다.',
        '① 병에게 업무를 요청하지 않고, 그룹감사인이 물류부문 재무정보에 관하여 충분하고 적합한 감사증거를 직접 입수하여야 한다.',
        '④ 유의적 부문 업무, 그룹차원의 통제와 연결절차에 대한 업무 및 그룹 수준의 분석적절차만으로는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상하였으므로, 판매부문이 유의적이지 않다는 이유로 그룹 수준의 분석적절차에 그치고 추가 업무를 생략할 수 없다.',
        '④ 유의적이지 않은 판매부문 중 일부를 선정하여, 선정한 부문의 재무정보에 대하여 부문중요성을 사용한 감사, 하나 이상의 거래유형·계정잔액·공시에 대한 감사, 부문중요성을 사용한 검토 또는 특정 절차 중 하나 이상을 수행하거나 부문감사인에게 수행하도록 요청하여야 한다.',
    ],
    requirements: [
        requirement('sub1.req1', 'kga600-20', quote('kga600-20'), 'KGA 600 문단 20·A39·A40·27·29; 식별 기준: 옳지 않은 절차 ①(독립성 요구사항을 충족하지 못한 부문감사인에게 관여 강화를 조건으로 업무 요청)과 ④(충분한 증거 입수가 어려울 것으로 예상됨에도 유의적이지 않은 부문의 추가 업무 생략)를 모두 고른다. 문단 A40상 관여로 극복할 수 있는 ②와 문단 27상 하나 이상의 업무유형 수행을 허용하는 ③은 고르지 않는다.'),
        requirement('sub1.req2', 'kga600-A39', quote('kga600-A39'), 'KGA 600 문단 A39·20; 적용: 독립성 결격은 그룹업무팀의 관여나 추가 위험평가·추가감사절차로 극복할 수 없으므로 병에게 업무를 요청할 수 없다.'),
        requirement('sub1.req3', 'kga600-20', quote('kga600-20'), 'KGA 600 문단 20; 적용: 병의 업무를 요청하지 않고 그룹감사인이 물류부문 재무정보에 관하여 충분하고 적합한 감사증거를 입수한다.'),
        requirement('sub1.req4', 'kga600-29', quote29Condition, 'KGA 600 문단 29 전단; 적용: 사례의 증거 부족 예상이 문단 29의 조건에 해당하므로 유의적이지 않다는 이유만으로 추가 업무를 생략할 수 없다. 문단 28의 그룹 수준 분석적절차만으로는 이 조건에서 충분하지 않다.'),
        requirement('sub1.req5', 'kga600-29', quote29Action, 'KGA 600 문단 29 후단; 적용: 유의적이지 않은 부문 중 일부를 추출하여 문단 29의 업무 중 하나 이상을 수행하거나 부문감사인에게 요청한다. 선정 부문 수와 특정 업무유형은 요구하지 않는다.'),
    ],
    criteria: [
        criterion('sub1.c1', 'conclusion', '옳지 않은 절차로 ①과 ④를 모두 지적한다. 번호 대신 절차의 내용으로 특정해도 인정한다. ①·④ 중 하나를 빠뜨리거나, 옳은 절차인 ②(심각하지 않은 적격성 우려에 대한 관여)나 ③(유의적 위험에 대응한 특정 감사절차만 수행)을 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga600-20', 'kga600-A39', 'kga600-A40', 'kga600-27', 'kga600-29']),
        criterion('sub1.c2', 'action', '① 병이 그룹감사에 적용되는 독립성 요구사항을 충족하지 못하므로 그룹업무팀이 위험평가 참여나 감사조서 검토 확대로 관여하더라도 이를 극복할 수 없어 병에게 업무를 요청할 수 없다는 이유를 제시한다. 독립성 요구사항을 충족하지 못한 부문감사인에게는 관여 여부와 관계없이 업무를 요청할 수 없다는 취지면 인정한다. 독립성 결격을 이유로 들지 않고 그룹업무팀이 직접 증거를 입수한다는 절차만 쓰거나, 관여나 조서 검토로 독립성 문제를 보완할 수 있다고 쓰면 인정하지 않는다.', ['kga600-A39', 'kga600-20']),
        criterion('sub1.c3', 'action', '① 병에게 업무를 요청하지 않고 그룹감사인(그룹업무팀)이 물류부문 재무정보에 관하여 충분하고 적합한 감사증거를 직접 입수하여야 한다는 올바른 절차를 제시한다. 그룹업무팀이 물류부문에 필요한 감사절차를 직접 수행한다는 표현도 인정한다. 병의 업무를 이용하면서 검토만 강화한다는 대안은 인정하지 않는다.', ['kga600-20']),
        criterion('sub1.c4', 'action', '④ 그룹업무팀이 유의적 부문 업무, 그룹차원의 통제·연결절차 업무와 그룹 수준의 분석적절차만으로는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상한 상황이므로, 판매부문이 유의적이지 않다는 이유만으로 추가 업무를 생략할 수 없다는 이유를 제시한다. 사례의 증거 부족 예상과 연결하지 않고 유의적이지 않은 부문에는 언제나 추가 업무가 필요하다고만 쓰면 인정하지 않는다.', ['kga600-29']),
        criterion('sub1.c5', 'action', '④ 유의적이지 않은 판매부문 중 일부를 선정하여, 선정한 부문의 재무정보에 대하여 부문중요성을 사용한 감사, 하나 이상의 거래유형·계정잔액·공시에 대한 감사, 부문중요성을 사용한 검토 또는 특정 절차 중 하나 이상을 수행하거나 부문감사인에게 요청하여야 한다는 올바른 절차를 제시한다. 일부 부문의 선정과 추가 업무의 수행이 함께 드러나면 네 업무유형의 명칭을 모두 열거하지 않아도 인정한다. 선정할 부문 수나 특정 업무유형은 요구하지 않는다.', ['kga600-29']),
    ],
};
const sub2 = {
    id: 'sub2', type: 'judgment', question_style: 'case', topic_ids: ['14'],
    prompt: '업무 수행과 종결 단계에서 그룹업무팀이 수행한 절차 ⑤와 ⑥ 중 감사기준에 비추어 옳지 않은 절차를 모두 찾아 번호를 쓰고, 각 절차가 옳지 않은 이유와 그룹업무팀이 수행하였어야 할 올바른 절차를 설명하시오.',
    ...shape, answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 절차는 ⑥이다. 부문감사인의 업무가 불충분하면 그룹업무팀은 추가 절차와 그 절차를 부문감사인과 그룹업무팀 중 누가 수행할지를 결정하므로, 을에게 추가 감사절차를 수행하도록 지시하고 그 결과를 그룹업무팀이 평가하기로 한 ⑤는 옳다.',
        '⑥ 갑과 을의 적정의견은 각 부문재무제표에 대한 결론일 뿐 그룹감사의견을 위한 평가를 대신할 수 없으므로, 그룹 수준의 평가를 생략할 수 없다.',
        '⑥ 제조부문과 해외판매부문에서 같은 방향으로 발생한 미수정 매출 과대계상을 합하여 그룹재무제표와 그룹감사의견에 미치는 영향을 평가하여야 한다.',
        '⑥ 소송충당부채에 관하여 충분하고 적합한 감사증거를 입수하지 못한 상황은 확정된 매출 왜곡표시와 구별하여, 그 상황이 그룹감사의견에 미치는 영향을 평가하여야 한다.',
    ],
    requirements: [
        requirement('sub2.req1', 'kga600-43', quote('kga600-43'), 'KGA 600 문단 43·A62·A8·44·45; 식별 기준: 옳지 않은 절차 ⑥(부문 적정의견을 이유로 그룹 수준 평가 없이 종결)을 고른다. 문단 43·A62상 추가 절차를 부문감사인이 수행하게 할 수 있고 문단 A8상 그룹감사의견 책임은 그룹업무수행이사에게 있으므로 ⑤는 고르지 않는다.'),
        requirement('sub2.req2', 'kga600-44', quote('kga600-44'), 'KGA 600 문단 44·A8; 적용: 부문감사인의 적정의견은 부문에 대한 결론이며, 그룹업무팀은 그룹감사의견의 근거가 되는 증거의 충분성과 적합성을 그룹 수준에서 평가하여야 하므로 그 평가를 생략할 수 없다.'),
        requirement('sub2.req3', 'kga600-45', quote('kga600-45'), 'KGA 600 문단 45·A63; 적용: 두 부문에서 같은 방향으로 발생한 미수정 매출 과대계상을 그룹 수준에서 합하여 그룹감사의견에 미치는 영향을 평가한다. 금액 계산은 요구하지 않는다.'),
        requirement('sub2.req4', 'kga600-45', quote('kga600-45'), 'KGA 600 문단 45; 적용: 소송충당부채의 증거 미입수는 확정된 왜곡표시와 구별하여 충분하고 적합한 감사증거를 입수할 수 없었던 상황으로서 그룹감사의견에 미치는 영향을 평가한다.'),
    ],
    criteria: [
        criterion('sub2.c1', 'conclusion', '옳지 않은 절차로 ⑥을 지적한다. 번호 대신 절차의 내용으로 특정해도 인정한다. ⑥을 빠뜨리거나, 옳은 절차인 ⑤(을에게 창고 재고의 추가 감사절차를 수행하도록 지시하고 그 결과를 그룹업무팀이 평가함)를 옳지 않다고 지적하면 이 점수는 주지 않는다.', ['kga600-43', 'kga600-A62', 'kga600-A8', 'kga600-44', 'kga600-45']),
        criterion('sub2.c2', 'action', '⑥이 옳지 않은 이유로, 갑과 을의 적정의견은 각 부문재무제표에 대한 결론일 뿐 그룹감사의견을 위한 평가를 대신할 수 없으므로 그룹 수준의 평가를 생략할 수 없다는 점을 제시한다. 그룹업무팀이나 그룹업무수행이사가 부문 의견과 별도로 그룹감사의견의 근거가 되는 증거의 충분성 또는 미수정왜곡표시와 증거 미입수 상황의 영향을 평가하여야 한다는 이유를 들어도 인정한다. 부문 적정의견으로 그룹 수준 평가를 대신할 수 있다고 쓰면 인정하지 않는다.', ['kga600-44', 'kga600-A8']),
        criterion('sub2.c3', 'action', '⑥ 제조부문과 해외판매부문에서 같은 방향으로 발생한 미수정 매출 과대계상을 합하여 그룹재무제표와 그룹감사의견에 미치는 영향을 평가하여야 한다는 올바른 절차를 제시한다. 각 부문에서 금액이 작거나 적정의견이 표명되었다는 이유로 제외하지 않고 그룹 수준에서 집계한다는 의미면 인정하며 금액 계산은 요구하지 않는다.', ['kga600-45', 'kga600-A63']),
        criterion('sub2.c4', 'action', '⑥ 소송충당부채에 관하여 충분하고 적합한 감사증거를 입수하지 못한 상황은 확정된 매출 왜곡표시와 구별하여 그 상황이 그룹감사의견에 미치는 영향을 평가하여야 한다는 올바른 절차를 제시한다. 소송충당부채가 왜곡표시되었다고 단정하거나 입수하지 못한 금액을 미수정왜곡표시 합계에 확정 오류처럼 더하면 인정하지 않는다.', ['kga600-45']),
    ],
};

const set = {
    schema_version: '3.0', id: 'case-14-group-procedures-20260915', type: 'linked_question_set', status: 'needs_review',
    title: '부문감사인 활용과 그룹감사 종결 절차',
    classification: { topic_id: '14', part: 'PART4', chapter: '그룹재무제표감사', domain: 'audit', standards: ['KGA 600'],
        tags: ['그룹재무제표감사', '부문감사인', '사례형', '기출·연습 응용'] },
    source_refs: refs, shared_context: { facts }, learning_order: ['sub1', 'sub2'], subquestions: [sub1, sub2],
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
        '2026-09-15 사용자가 지정한 사례형 검토에 따라 case-14-component-evidence-gap-20260914, pilot-14-006, pilot-14-007을 한 사례로 병합한 재구성 초안이다. 원 세트·물음·criterion과의 대응은 같은 배치의 lineage.json에 기록한다.',
        '사례의 20X1년은 KGA 600 2025 개정 전문(문단 7: 2026년 1월 1일 이후 개시 보고기간부터 시행)이 적용되는 보고기간으로 가정하고, 등록된 전문 추출본의 본문과 적용자료를 직접 대조하였다. 향후 시험 적용 판본의 승인으로 표시하지 않는다.',
        '절차 선택형이다. 물음마다 옳지 않은 절차 전체를 정확히 고른 식별에 1점, 옳지 않은 절차별 이유와 올바른 절차에 독립 정수 점수를 둔다. 함정 절차 ②·③·⑤에는 별도 득점 기준이 없다.',
        'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
    ] },
};
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
const chars = [...facts.map((f) => f.text).join('\n')].length;
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
