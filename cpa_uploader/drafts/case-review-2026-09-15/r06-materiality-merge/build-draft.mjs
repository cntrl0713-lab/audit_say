// 5·25·45번(draft-04-320-freq01, pilot-04-007, case-04-materiality-reset-20260914) 병합 초안(중요성 종합). 원문 인용은 현재 정본의 기존 인용과 등록 전문에서 그대로 복사한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge/build-draft.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r06-materiality-merge';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const SET_ID = 'case-04-materiality-20260917';
const FILES = {
    s01: 'cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt',
    r06: 'cpa_uploader/data/official/case-review-2026-09-15-kga320.md',
};
const ORIGINALS = { freq: 'draft-04-320-freq01', pm: 'pilot-04-007', reset: 'case-04-materiality-reset-20260914' };
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const texts = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
for (const id of Object.values(ORIGINALS)) assert(bank.some((s) => s.id === id), id);
assert(!bank.some((s) => s.id === SET_ID), 'new set ID must not exist in the bank');
const reuse = (id, setId, refId) => {
    const ref = bank.find((s) => s.id === setId).source_refs.find((r) => r.id === refId);
    assert(ref && ref.content_hash === sha(ref.source_quote) && ref.page === 'KGA 320', `${setId}/${refId}`);
    return { id, file: ref.file, title: ref.title, page: ref.page, source_quote: ref.source_quote, role: 'standard', content_hash: ref.content_hash };
};
const extract = (id, key, paragraph, pdfPage, start, end) => {
    const text = texts[key];
    const i = text.indexOf(start); const j = text.indexOf(end, i);
    assert(i >= 0 && j > i, `${id}: ${start}`);
    assert.equal(text.indexOf(start, i + 1), -1, `${id}: 시작 문구가 유일하지 않음`);
    const quote = text.slice(i, j + end.length);
    const first = text.slice(0, i).split('\n').length;
    const span = `L${first}-L${first + quote.split('\n').length - 1}`;
    return { id, file: FILES[key], title: `KGA 320 문단 ${paragraph}, 2025 개정 전문 원문 PDF ${pdfPage}쪽; ${span}`, page: 'KGA 320', source_quote: quote, role: 'standard', content_hash: sha(quote) };
};

const refs = [
    extract('kga320-6', 'r06', '6', 306, '6. \n감사계획 수립시, 감사인은 중요하다고', '발생한 특수한 상황도 고려한다.4 (문단 A2 참조)'),
    extract('kga320-10', 's01', '10', 307, '10. \r\n감사인은 전반감사전략을 수립할 때', '중요성 수준도 결정하여야 한다. (문단 A3-A12 참조)'),
    extract('kga320-11', 's01', '11', 307, '11. \r\n감사인은 중요왜곡표시위험을 평가하고', '하여 수행중요성을 결정하여야 한다. (문단 A13 참조)'),
    reuse('kga320-12', ORIGINALS.reset, 'src-0daaa18eaf14f4f6a8'),
    reuse('kga320-13', ORIGINALS.reset, 'src-5fbe07fb969895bbb3'),
    reuse('kga320-14a', ORIGINALS.reset, 'src-2fec01ef526043b066'),
    reuse('kga320-14bd', ORIGINALS.reset, 'src-68a4011b89412b5afd'),
    reuse('kga320-A6', ORIGINALS.freq, 'src1'),
    extract('kga320-A11', 'r06', 'A11', '310~311', 'A11. 그 왜곡표시가 재무제표 전체의 중요성보다는', '부문이나 유의적인 사업결합에 대한 공시)'),
    extract('kga320-A13', 's01', 'A13', 311, 'A13. 개별적으로 중요한 왜곡표시만을', '감사인의 예상에 영향을 받는다.'),
    reuse('kga320-A14', ORIGINALS.reset, 'src-24bfa3ad9356517e75'),
];
const quote = (id) => refs.find((r) => r.id === id).source_quote;

const facts = [
    { id: 'fact1', text: '솔빛회계법인은 상장회사인 새봄회사의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사한다. 새봄회사는 여러 지점에서 제품을 판매하는 제조회사로 설립 이후 매년 안정적인 이익을 내 왔으며, 주주 등 재무제표 이용자들은 주로 법인세비용차감전계속영업이익을 보고 투자 판단을 한다.' },
    { id: 'fact2', text: [
        '20X1년 6월 감사계획 단계에서 감사팀이 파악한 사항은 다음과 같다.',
        '새봄회사는 20X1년 상반기에 투자처의 파산으로 투자주식 손상차손을 인식하였다. 이와 같은 손실은 과거에 없었고 다시 발생할 사정도 없으며, 손상차손을 반영한 20X1년 법인세비용차감전계속영업이익 예측치는 과거 3년 평균의 절반 수준이다.',
        '새봄회사는 20X1년 5월 새 사업에 진출하기 위하여 새봄회사보다 규모가 훨씬 작은 다온회사를 인수하였다. 주주들은 인수 대가와 다온회사의 실적을 향후 투자 판단의 핵심으로 보고 있으며, 주주총회에서도 인수 관련 주석 공시에 질문이 집중되었다.',
        '전기 감사에서는 여러 지점에서 반품이 늦게 반영된 왜곡표시가 다수 발견되었고 그중 일부는 수정되지 않았다. 새봄회사는 20X1년 초 새 회계시스템으로 전환하였고, 두 지점의 자료 연결은 아직 수작업으로 이루어진다.',
    ].join('\n') },
    { id: 'fact3', text: [
        '감사팀이 감사계획 단계에서 중요성을 결정한 내용은 다음과 같다.',
        '① 20X1년 예측치를 그대로 쓰면 벤치마크가 과거 3년 평균의 절반 수준이 되므로, 감사팀은 과거 3년의 실적에 기초하여 손상차손이 없었을 경우의 정상적인 수준으로 조정한 법인세비용차감전계속영업이익을 벤치마크로 삼아 재무제표 전체에 대한 중요성을 결정하였다.',
        '② 감사팀은 다온회사 인수 관련 주석 공시 금액이 모두 재무제표 전체에 대한 중요성보다 작고 인수가 이사회 승인을 거쳤으므로, 인수 관련 공시에 대해서도 다른 항목과 같은 재무제표 전체에 대한 중요성을 적용하였다.',
        '③ 감사팀은 해마다 같은 방식으로 수행중요성을 정해야 감사의 일관성이 유지된다는 이유로, 전기와 같이 재무제표 전체에 대한 중요성의 75%를 수행중요성으로 정하였다.',
    ].join('\n') },
    { id: 'fact4', text: [
        '20X1년 8월 감사팀은 계획 단계에서 정한 수행중요성에 따라 표본 규모를 정하여 매출과 매출채권에 대한 중간감사를 마쳤다. 20X1년 10월 새봄회사는 주요 사업부문의 처분을 결정하였고, 그 사업부문의 주요 거래처와 맺은 공급계약도 종료되었다. 감사팀이 9월까지의 실제 실적과 회사가 새로 작성한 연간 예측을 대조한 결과, 손상차손의 영향을 제외하더라도 20X1년 법인세비용차감전계속영업이익은 계획 단계에서 중요성을 결정할 때 사용한 금액에 크게 미달할 것으로 예상되었다. 이후 감사팀의 절차와 판단은 다음과 같다.',
        '④ 새 연간 예측이 9월까지의 실제 실적 추세와 맞았으므로, 감사팀은 새 연간 예측에서 손상차손의 영향을 제외한 이익을 기초로 재무제표 전체에 대한 중요성을 다시 결정하여 최초 금액보다 낮추었다.',
        '⑤ 감사팀은 수행중요성은 위험평가 단계에서 정하면 감사가 끝날 때까지 쓰는 금액이라고 판단하여, 계획 단계에서 정한 수행중요성을 그대로 사용하였다.',
        '⑥ 기말감사의 인력과 일정 배정이 이미 끝나 있어, 감사팀은 기말의 매출채권 조회와 매출 기간귀속 테스트를 계획 단계에서 정한 표본 규모와 일정대로 수행하기로 하였다.',
        '⑦ 감사팀은 조서의 중요성표에 있던 최초 금액을 수정된 금액으로 바꿔 적었으며, 중요성을 수정한 이유는 담당 이사에게 구두로 보고하였다.',
    ].join('\n') },
    { id: 'fact5', text: [
        '20X2년 2월 기말감사에서 감사팀은 대표이사가 지배하는 회사에 대한 매출이 과대계상된 왜곡표시를 발견하였고, 새봄회사는 이를 수정하지 않았다. 이 왜곡표시의 금액은 수정된 재무제표 전체에 대한 중요성보다 작다.',
        '⑧ 감사팀은 이 미수정왜곡표시가 중요한지 평가할 때 금액과 함께 대표이사가 지배하는 회사와의 거래에서 발생하였다는 점을 고려하였다.',
    ].join('\n') },
].map((fact) => ({ ...fact, scoreable: false }));

const one = { met: 1, not_met: 0, contradicted: 0 };
const criterion = (id, type, claim, refIds) => ({
    id, requirement_id: id.replace(/\.c(\d+)$/u, '.req$1'), claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }], max_points: 1, scores: { ...one }, source_ref_ids: refIds,
});
const requirement = (id, refId, span) => ({ id, source_ref_id: refId, source_quote: quote(refId), source_span: span });
const shape = { constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: null };
const selectPrompt = (stage, range) => `${stage} ${range} 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.`;
const identification = (wrong, particle, right) => `옳지 않은 것으로 ${wrong}${particle} 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ${wrong} 중 하나라도 빠뜨리거나, 옳은 것인 ${right}을 옳지 않다고 지적하면 이 점수는 주지 않는다.`;

const sub1 = {
    id: 'sub1', type: 'judgment', question_style: 'case', topic_ids: ['04'],
    prompt: selectPrompt('감사계획 단계의 중요성 결정', '①~③'),
    ...shape, answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ②, ③이다. ①은 일회성 손상차손으로 이익이 예외적으로 감소한 상황에서 과거 실적에 기초하여 정상적 수준으로 조정한 법인세비용차감전계속영업이익을 벤치마크로 사용한 것이므로 옳다.',
        '② 주주들의 관심이 인수 관련 공시에 집중되어 재무제표 전체에 대한 중요성보다 작은 왜곡표시도 이용자의 경제적 의사결정에 영향을 줄 것으로 예상되므로, 인수 관련 공시에 적용할 더 낮은 중요성 수준을 결정하여야 한다.',
        '③ 수행중요성의 결정은 기계적 계산이 아니라 전문가적 판단이므로, 새 회계시스템 전환과 두 지점의 수작업 연결 등 갱신된 기업 이해, 전기 반품 반영 지연 왜곡표시의 성격과 범위, 그에 따른 당기 왜곡표시의 예상을 고려하여 수행중요성을 정하여야 한다.',
    ],
    requirements: [
        requirement('sub1.req1', 'kga320-A6', 'KGA 320 문단 10·11, A6·A11·A13; 식별 기준: ②(인수 관련 공시에 금액이 작고 인수가 승인되었다는 이유로 전체 중요성만 적용), ③(전기와 같은 비율로 수행중요성을 기계적으로 결정)은 옳지 않다. ①은 문단 A6(이익의 예외적인 증감이 있으면 과거 실적에 기초해 정상적 수준으로 조정한 법인세비용차감전계속영업이익을 사용할 수 있음)에 따라 옳다.'),
        requirement('sub1.req2', 'kga320-10', 'KGA 320 문단 10·A11; 적용: 이용자의 주의가 집중된 유의적인 사업결합(다온회사 인수) 공시는 전체 중요성보다 작은 왜곡표시도 이용자의 경제적 의사결정에 영향을 줄 것으로 합리적으로 예상되므로, 그 공시에 적용할 중요성 수준도 결정한다. 공시 금액이 전체 중요성보다 작다는 사실이나 이사회 승인은 이 판단을 대신하지 못한다.'),
        requirement('sub1.req3', 'kga320-A13', 'KGA 320 문단 11·A13; 적용: 수행중요성은 기계적 계산이 아니라 전문가적 판단으로 정하며, 위험평가 중 갱신된 기업 이해(새 회계시스템 전환, 두 지점의 수작업 연결), 과거 감사에서 식별된 왜곡표시의 성격과 범위(여러 지점의 반품 반영 지연, 미수정 왜곡표시)와 이에 따른 당기 왜곡표시의 예상에 영향을 받는다.'),
    ],
    criteria: [
        criterion('sub1.c1', 'conclusion', identification('②·③', '을', '①(일회성 손상차손을 반영한 20X1년 예측치 대신 과거 3년 실적에 기초하여 정상적인 수준으로 조정한 법인세비용차감전계속영업이익을 벤치마크로 사용)'), ['kga320-A6', 'kga320-10', 'kga320-A11', 'kga320-11', 'kga320-A13']),
        criterion('sub1.c2', 'action', '② 주주들의 관심이 인수 대가와 다온회사 실적 등 인수 관련 공시에 집중되어 있어 재무제표 전체에 대한 중요성보다 작은 왜곡표시도 이용자의 경제적 의사결정에 영향을 줄 것으로 예상되므로, 인수 관련 공시에 적용할 더 낮은 중요성 수준을 결정해야 한다는 이유나 절차를 제시한다. 이용자의 관심이 집중된 공시는 전체 중요성보다 작은 왜곡표시도 의사결정에 영향을 줄 수 있다는 이유와, 인수 관련 공시에 별도의 더 낮은 중요성 수준을 정해야 한다는 절차 중 하나만 써도 인정한다. 금액이 전체 중요성보다 작거나 인수가 승인되었으면 전체 중요성만 적용하면 된다고 쓰면 인정하지 않는다.', ['kga320-10', 'kga320-A11']),
        criterion('sub1.c3', 'action', '③ 수행중요성의 결정은 기계적 계산이 아니라 전문가적 판단이 수반되므로, 위험평가 중 갱신된 기업에 대한 이해(새 회계시스템 전환, 두 지점의 수작업 연결), 전기 감사에서 식별된 왜곡표시의 성격과 범위(여러 지점의 반품 반영 지연, 미수정 왜곡표시)와 그에 따른 당기 왜곡표시의 예상을 고려해 정해야 한다는 이유나 절차를 제시한다. 전문가적 판단이 필요하다는 이유와, 위 고려사항 중 하나 이상을 반영해 수행중요성을 정해야 한다는 절차 중 하나만 써도 인정하며 비율이나 금액은 요구하지 않는다. 매년 같은 비율을 적용해야 일관성이 유지된다고 쓰면 인정하지 않는다.', ['kga320-A13', 'kga320-11']),
    ],
};

const sub2 = {
    id: 'sub2', type: 'judgment', question_style: 'case', topic_ids: ['04', '12'],
    prompt: selectPrompt('감사 수행 중과 기말감사 단계의 절차와 판단', '④~⑧'),
    ...shape, answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑤, ⑥, ⑦이다. ④는 감사 중 알게 된 사업부문 처분결정과 계약종료로 실제 이익이 최초에 사용한 금액과 크게 달라질 것이므로 중요성을 수정한 것이고, ⑧은 중요성에 미달하는 왜곡표시도 그 성격과 발생 상황을 고려하여 중요한지 평가한 것이므로 옳다.',
        '⑤ 재무제표 전체에 대한 중요성을 최초보다 낮추었으므로 수행중요성을 수정할 필요가 있는지 결정하여야 한다.',
        '⑥ 재무제표 전체에 대한 중요성을 낮추었으므로 기말 매출채권 조회와 매출 기간귀속 테스트 등 추가감사절차의 성격, 시기 및 범위가 여전히 적합한지 결정하여야 한다.',
        '⑦ 중요성에 관하여 최초 금액과 감사 진행에 따른 수정내용, 그리고 금액을 결정할 때 고려한 요소(사업부문 처분결정, 계약종료, 새 연간 예측)를 감사문서에 포함하여야 하며 구두 보고로 대신할 수 없다.',
    ],
    requirements: [
        requirement('sub2.req1', 'kga320-12', 'KGA 320 문단 6·12·13·14, A14; 식별 기준: ⑤(전체 중요성을 낮춘 뒤 수행중요성을 그대로 사용), ⑥(기말 조회·기간귀속 테스트를 당초 표본 규모와 일정대로 수행), ⑦(최초 금액을 수정 금액으로 덮어쓰고 수정 이유는 구두로 보고)은 옳지 않다. ④는 문단 12·A14(주요사업의 처분결정 등으로 실제 재무결과가 최초 예측과 상당히 다를 것 같으면 중요성을 수정), ⑧은 문단 6(중요성에 미달하는 왜곡표시도 상황에 따라 중요할 수 있으며 크기뿐 아니라 성격과 발생 상황을 고려)에 따라 옳다.'),
        requirement('sub2.req2', 'kga320-13', 'KGA 320 문단 13; 적용: 재무제표 전체에 대한 중요성을 최초보다 낮추는 것이 적합하다고 결정한 경우 수행중요성을 수정할 필요가 있는지 결정한다.'),
        requirement('sub2.req3', 'kga320-13', 'KGA 320 문단 13; 적용: 재무제표 전체에 대한 중요성을 낮춘 경우 기말 매출채권 조회·매출 기간귀속 테스트 등 추가감사절차의 성격, 시기 및 범위가 여전히 적합한지 결정한다.'),
        requirement('sub2.req4', 'kga320-14a', 'KGA 320 문단 14(a)·(d); 적용: 재무제표 전체에 대한 중요성과 감사 진행에 따른 수정내용, 그리고 그 금액을 결정할 때 고려한 요소를 감사문서에 포함한다.'),
    ],
    criteria: [
        criterion('sub2.c1', 'conclusion', identification('⑤·⑥·⑦', '을', '④(사업부문 처분결정과 계약종료를 반영한 새 연간 예측에서 손상차손의 영향을 제외한 이익을 기초로 재무제표 전체에 대한 중요성을 다시 결정해 낮춤), ⑧(수정된 전체 중요성보다 작은 미수정왜곡표시가 중요한지 평가할 때 대표이사가 지배하는 회사와의 거래라는 점을 함께 고려)'), ['kga320-12', 'kga320-A14', 'kga320-13', 'kga320-14a', 'kga320-14bd', 'kga320-6']),
        criterion('sub2.c2', 'action', '⑤ 재무제표 전체에 대한 중요성을 최초보다 낮추었으면 수행중요성을 수정할 필요가 있는지 결정해야 한다는 이유나 절차를 제시한다. 낮아진 전체 중요성에 비추어 수행중요성을 다시 검토하고 필요하면 낮춰야 한다는 절차도 인정한다. 수행중요성은 한 번 정하면 감사가 끝날 때까지 유지한다고 쓰면 인정하지 않는다.', ['kga320-13']),
        criterion('sub2.c3', 'action', '⑥ 재무제표 전체에 대한 중요성을 낮추었으면 추가감사절차의 성격, 시기 및 범위가 여전히 적합한지 결정해야 한다는 이유나 절차를 제시한다. 기말 조회·기간귀속 테스트의 표본 규모나 일정, 중간감사에서 수행한 절차가 낮아진 중요성에서도 충분한지 다시 검토하고 필요하면 표본을 늘리거나 절차를 추가해야 한다는 절차 중 하나만 써도 인정하며, 성격·시기·범위의 완전한 나열은 요구하지 않는다. 인력과 일정 배정이 끝났으면 계획대로 수행해도 된다고 쓰면 인정하지 않는다.', ['kga320-13']),
        criterion('sub2.c4', 'action', '⑦ 중요성에 관하여 최초 금액과 감사 진행에 따른 수정내용, 그리고 수정한 금액을 결정할 때 고려한 요소(사업부문 처분결정, 계약종료, 새 연간 예측)를 감사문서에 포함해야 한다는 이유나 절차를 제시한다. 수정내용(최초 금액과 수정 금액)의 문서화와 고려한 요소(수정 이유)의 문서화 중 하나만 써도 인정한다. 최종 금액만 남기고 수정 이유는 구두로 보고하면 충분하다고 쓰면 인정하지 않는다.', ['kga320-14a', 'kga320-14bd']),
    ],
};

const p = bank.find((s) => s.id === ORIGINALS.reset).classification;
const set = {
    schema_version: '3.0', id: SET_ID, type: 'linked_question_set', status: 'needs_review',
    title: '중요성의 결정과 감사 진행에 따른 적용',
    classification: { topic_id: '04', part: p.part, chapter: p.chapter, domain: 'audit', standards: ['KGA 320'],
        tags: ['중요성', '수행중요성', '사례형'] },
    source_refs: refs, shared_context: { facts }, learning_order: ['sub1', 'sub2'], subquestions: [sub1, sub2],
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
        '2026-09-17 사용자가 지정한 사례형 검토에 따라 draft-04-320-freq01, pilot-04-007, case-04-materiality-reset-20260914를 하나의 중요성 종합 사례로 합친 초안이다. 정답을 암시하던 사실·발문·등장인물의 주장을 없애고, 감사인이 수행한 절차·판단 중 옳지 않은 것을 골라 이유나 보완절차를 간략히 쓰는 선택형으로 바꾸었다. 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
        '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다(KGA 320 문단 7: 2026년 1월 1일 이후 개시하는 보고기간부터 시행). 2026 전문과 대조한 결과 KGA 320 문단 1~14·A1~A14는 각주의 KGA 315 제목 외에 같다. 문단 6과 A11은 2025 전문 PDF 306·310~311쪽에서 새로 발췌해 등록했다. 등록 전문(KGA 320 문단 6·10·11·12·13·14, A6·A11·A13·A14)을 직접 대조했다.',
        '두 물음 모두 옳고 그름을 구분하는 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 옳은 항목 ①·④·⑧에는 별도 득점 기준이 없다.',
        'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
    ] },
};
fs.writeFileSync(`${D}/sets.json`, JSON.stringify([set], null, 2) + '\n');
const chars = [...facts.map((f) => f.text).join('\n')].length;
assert(chars >= 400, 'facts must be at least 400 characters');
console.log({ set: set.id, facts_characters: chars, points: set.subquestions.map((q) => q.criteria.length), sha256: createHash('sha256').update(fs.readFileSync(`${D}/sets.json`)).digest('hex') });
