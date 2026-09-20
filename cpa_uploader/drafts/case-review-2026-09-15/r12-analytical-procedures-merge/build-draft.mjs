// r12: 68번(case-10-completion-analytics-20260914)과 32번(pilot-10-007)의 병합 초안 생성기.
//
//   node cpa_uploader/drafts/case-review-2026-09-15/r12-analytical-procedures-merge/build-draft.mjs
//
// 인용은 (1) 현재 정본의 두 원 세트가 이미 담고 있는 KGA 520·315 인용을 바이트 그대로 재사용하고,
// (2) 새로 필요한 KGA 520 문단 A12·A13만 등록 전문에서 줄 범위로 발췌한다. 해시는 인용 문자열의 SHA-256이다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');

const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const OFFICIAL_520 = 'cpa_uploader/data/official/delegated-s04-kga-2025.txt';

const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const byId = new Map(bank.map((set) => [set.id, set]));

function reuse(setId, refId) {
    const set = byId.get(setId);
    if (!set) throw new Error(`정본에 세트가 없습니다: ${setId}`);
    const ref = (set.source_refs || []).find((item) => item.id === refId);
    if (!ref) throw new Error(`${setId}에 source_ref가 없습니다: ${refId}`);
    return ref;
}

function extract(relativeFile, fromLine, toLine) {
    const absolute = path.join(root, relativeFile);
    const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
    return lines.slice(fromLine - 1, toLine).join('\n');
}

function hash(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── 1. 출처 ──────────────────────────────────────────────────────────────────
// 원 세트에서 바이트 그대로 재사용하는 인용
const reused = [
    ['kga520-5', 'pilot-10-007', 'src-b5481cdcc415319fcf', 'KGA 520 문단 5, 2025 개정 전문 원문 PDF 424쪽; L314-L329'],
    ['kga520-A15', 'pilot-10-007', 'src-25610cb1397cb3355d', 'KGA 520 문단 A15, 2025 개정 전문 원문 PDF 428쪽; L488-L503'],
    ['kga520-A16', 'pilot-10-007', 'src-4b0e398ec0a4fad77f', 'KGA 520 문단 A16, 2025 개정 전문 원문 PDF 428쪽; L505-L513'],
    ['kga520-6', 'case-10-completion-analytics-20260914', 'src-e67ae1831db41aa655', 'KGA 520 문단 6, 2025 개정 전문 원문 PDF 424쪽; L331-L333'],
    ['kga520-7', 'case-10-completion-analytics-20260914', 'src-e7d17e54be2d240805', 'KGA 520 문단 7, 2025 개정 전문 원문 PDF 424쪽; L338-L342'],
    ['kga520-A17', 'case-10-completion-analytics-20260914', 'src-93c9a60b32ac6a97bd', 'KGA 520 문단 A17, 2025 개정 전문 원문 PDF 428쪽; L515-L517'],
    ['kga520-A18', 'case-10-completion-analytics-20260914', 'src-805f45ff18dbcd0b6f', 'KGA 520 문단 A18, 2025 개정 전문 원문 PDF 428쪽; L521-L523'],
    ['kga520-A19', 'case-10-completion-analytics-20260914', 'src-5c224e2b3d26cb7abb', 'KGA 520 문단 A19, 2025 개정 전문 원문 PDF 429쪽; L532-L533'],
    ['kga520-A20', 'case-10-completion-analytics-20260914', 'src-610dfeb49d38af086d', 'KGA 520 문단 A20, 2025 개정 전문 원문 PDF 429쪽; L538-L540'],
    ['kga315-37', 'case-10-completion-analytics-20260914', 'src-9dc3ef023abb077fff', 'KGA 315 문단 37, 2025 개정 전문 원문 PDF 229쪽; L344-L346'],
];

const sourceRefs = reused.map(([id, setId, refId, title]) => {
    const ref = reuse(setId, refId);
    return {
        id,
        file: ref.file,
        title,
        page: ref.page,
        source_quote: ref.source_quote,
        role: 'standard',
        content_hash: ref.content_hash,
        source_span: `${title}; 재사용 출처 ${setId}/${refId}`,
    };
});

// 새로 발췌하는 인용
const newCuts = [
    ['kga520-A12', 446, 457, 'KGA 520 문단 A12, 2025 개정 전문 원문 PDF 427쪽; L446-L457'],
    ['kga520-A13', 461, 471, 'KGA 520 문단 A13, 2025 개정 전문 원문 PDF 427쪽; L461-L471'],
];

for (const [id, from, to, title] of newCuts) {
    const quote = extract(OFFICIAL_520, from, to);
    sourceRefs.push({
        id,
        file: OFFICIAL_520,
        title,
        page: 'KGA 520',
        source_quote: quote,
        role: 'standard',
        content_hash: hash(quote),
        source_span: `${title}; 등록 전문 ${OFFICIAL_520} L${from}-L${to}`,
    });
}

const refById = new Map(sourceRefs.map((ref) => [ref.id, ref]));
function quoteOf(id) {
    const ref = refById.get(id);
    if (!ref) throw new Error(`source_ref 없음: ${id}`);
    return ref.source_quote;
}

// ── 2. 사실관계 ──────────────────────────────────────────────────────────────
const facts = [
    {
        id: 'fact1',
        text: [
            '가람회계법인은 생활용품을 판매하는 해솔의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사하고 있으며, 감사보고서일은 20X2년 3월 중순으로 예정되어 있다.',
            '해솔은 상반기까지 이익률이 낮은 도매판매의 비중이 높았고, 하반기에는 도매판매를 줄이는 대신 이익률이 높은 직영판매를 늘렸다. 감사팀은 이러한 판매구조의 변화를 계약서와 거래자료에서 확인하였다.',
            '해솔은 여러 은행에서 자금을 조달하고 있고, 고정금리 차입금과 변동금리 차입금이 20X1년 중 서로 다른 시기에 실행되거나 상환되었으며, 이자비용은 재무제표에 중요하다.',
            '감사팀은 위험평가 단계에서 20X1년 상반기 자료로 매출과 이익률을 분석하였고, 이자비용과 관련된 경영진주장에 대해서는 유의적 위험을 식별하지 않았다.',
            '20X2년 2월 말 현재 감사팀은 계획한 계정별 세부테스트를 마치고 회사로부터 최종 재무제표를 받았다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact2',
        text: [
            '감사팀은 20X2년 1월에 이자비용에 대한 실증적인 분석적절차를 설계하고 수행하였다. 회사의 자금팀 담당자는 차입금의 연간 평균잔액과 평균이자율을 표로 정리한 명세를 감사팀에 전달하였다. 이 절차와 관련한 감사팀의 절차와 판단은 다음과 같다.',
            '① 감사팀은 이자비용과 관련된 경영진주장에 대하여 평가한 중요왜곡표시위험을 고려하여, 이 주장에 대하여 실증적인 분석적절차가 적합한지를 결정하였다.',
            '② 담당자는 자금팀이 전달한 명세의 합계가 총계정원장의 이자비용과 크게 다르지 않다는 점을 확인하는 것으로 이 자료에 대한 검토를 마치고, 이를 감사인의 기대치를 도출하는 자료로 이용하였다. 이 명세는 자금팀 담당자가 표 계산 프로그램으로 직접 정리한 것이다.',
            '③ 담당자는 전기 감사에서도 같은 방식으로 이자비용을 분석하였다는 점을 고려하여, 명세의 연간 평균잔액에 연간 평균이자율을 곱한 하나의 금액을 감사인의 기대치로 삼고 이를 장부의 이자비용과 비교하였다.',
            '④ 담당자는 이자비용에서 큰 차이가 생길 가능성이 낮다고 보아, 절차를 시작하기 전에는 별도의 기준을 두지 않고 기대치와 장부금액 사이에 차이가 나타나면 그때 재무제표 전체에 대한 중요성과 견주어 추가로 조사할지를 판단하기로 하였다.',
            '⑤ 감사팀은 이자비용이 차입금 잔액과 이자율에서 도출되는 관계가 비교적 예측가능하다고 보아, 이자비용에 대해서는 세부테스트를 결합하지 않고 실증적인 분석적절차만을 단독으로 수행하기로 하였다.',
        ].join('\n'),
        scoreable: false,
    },
    {
        id: 'fact3',
        text: [
            '20X2년 2월 말 최종 재무제표를 받은 뒤 감사종료를 앞두고 감사팀이 한 일은 다음과 같다.',
            '⑥ 담당자 갑은 위험평가 단계에서 상반기 자료로 매출과 이익률을 이미 분석하였고 계획한 계정별 세부테스트도 모두 마쳤다는 점을 들어, 감사종료에 근접한 시점의 분석적절차를 따로 설계하지 않고 위험평가 단계에서 수행한 매출·이익률 분석의 결과로 갈음하기로 하였다.',
            '⑦ 업무수행이사가 최종 자료를 살펴보던 중 도매부문의 12월 매출액만 전월보다 크게 늘어난 것을 발견하였다. 같은 상품의 판매단가는 변하지 않았고, 창고에서 고객에게 실제 출하한 수량은 오히려 줄었으며, 증가액은 12월 마지막 사흘에 기록한 몇몇 거래에 집중되어 있었다. 이 관계는 위험평가 단계에서 사용한 자료에는 나타나 있지 않았다. 감사팀은 이 사항을 12월에 기록한 몇몇 거래의 기록 시점에 관한 문제로 보아, 매출에 대하여 최초에 식별하고 평가한 중요왜곡표시위험은 그대로 두기로 하였다.',
            '⑧ 감사팀은 도매부문 12월 매출의 증가에 대하여 영업부장에게 질문하여 연말 판촉행사 때문이라는 답변을 들었고, 그 답변과 관련하여 12월 마지막 사흘에 기록된 거래의 고객 인수자료와 창고의 출하기록을 입수하여 답변을 평가하기로 하였다.',
            '⑨ 연간 외주운송비도 전년보다 크게 줄었다. 재무이사는 20X1년 7월부터 주요 배송구간을 자체 운송으로 바꾸었기 때문이라고 설명하였다. 감사팀은 다른 계정의 감사에서 이미 검사한 6월 말 외주운송 계약종료 합의서와 정산내역, 7월 이후 회사 차량의 운행기록과 배송명세, 자체 운송기사의 급여 지급내역을 함께 검토하여 재무이사의 설명이 뒷받침되는지 평가하였다. 외주운송 계약이 끝나고 자체 운송이 시작된 시점은 운송비가 줄기 시작한 시점과 부합하였다. 감사팀은 운송업체로부터 새로운 확인서를 받지는 않았다.',
        ].join('\n'),
        scoreable: false,
    },
];

// ── 3. 물음 ──────────────────────────────────────────────────────────────────
const SUB1_IDENTIFY =
    '옳지 않은 것으로 ②·③·④를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ②·③·④ 중 하나라도 빠뜨리거나, 옳은 것인 ①(이자비용 관련 경영진주장에 대하여 평가한 중요왜곡표시위험을 고려하여 실증적인 분석적절차가 적합한지를 결정), ⑤(세부테스트를 결합하지 않고 실증적인 분석적절차만을 단독으로 수행하기로 함)를 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB2_IDENTIFY =
    '옳지 않은 것으로 ⑥·⑦을 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑥·⑦ 중 하나라도 빠뜨리거나, 옳은 것인 ⑧(영업부장의 답변과 관련하여 고객 인수자료와 창고 출하기록을 입수하여 답변을 평가), ⑨(다른 계정의 감사에서 이미 입수한 자료를 함께 검토하여 재무이사의 설명이 뒷받침되는지 평가하고 운송업체로부터 새로운 확인서를 받지 않음)를 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const sub1 = {
    id: 'sub1',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['10', '08'],
    prompt:
        '자료 2의 ①~⑤ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 수행하였어야 할 절차를 간략히 서술하시오.',
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ②, ③, ④이다. ①은 주어진 경영진주장에 대한 평가된 중요왜곡표시위험을 고려하여 특정 실증적인 분석적절차가 적합한지를 결정한 것이므로 옳다. ⑤는 실증절차로서의 분석적절차를 단독으로 또는 세부테스트와 결합하여 설계하고 수행할 수 있으므로 옳다.',
        '② 기록된 금액에 대한 감사인의 기대치가 도출될 데이터의 신뢰성을 평가하여야 하며, 이때 이용가능한 정보의 원천과 비교가능성 및 그 성격과 관련성을 고려하고 그 작성에 대한 통제를 고려한다. 총계정원장 합계와의 비교만으로 이를 갈음할 수 없으므로, 차입계약서나 금융기관이 발급한 잔액·약정이자율 확인서와 대조하거나 그 명세의 작성에 관한 통제를 테스트하여야 한다.',
        '③ 도출한 기대치가 개별적으로 또는 다른 왜곡표시와 합쳐져서 재무제표를 중요하게 왜곡표시시킬 수 있는 왜곡표시를 식별할 정도로 충분히 정확한지를 평가하여야 한다. 금리조건과 실행·상환 시기가 서로 다른 차입금을 하나의 연간 평균으로 묶은 값은 그 정확성을 갖추기 어려우므로, 차입계약이나 기간별로 구분하여 기대치를 도출하여야 한다.',
        '④ 문단 7에서 요구되는 추가적인 조사를 하지 않고 수용될 수 있는, 기록된 금액과 기대치와의 차이금액을 절차를 설계·수행하는 단계에서 결정하여야 한다.',
    ],
    requirements: [
        {
            id: 'sub1.req1',
            source_ref_id: 'kga520-5',
            source_quote: quoteOf('kga520-5'),
            source_span:
                'KGA 520 문단 5·A12·A13·A15·A16; 식별 기준: ②(명세의 합계가 총계정원장과 크게 다르지 않다는 확인만으로 자료 검토를 마치고 기대치 도출 자료로 이용), ③(금리조건과 시기가 다른 차입금을 하나의 연간 평균으로 묶은 값을 기대치로 사용), ④(절차를 시작하기 전에 추가 조사 없이 수용할 차이금액을 정하지 않음)는 옳지 않다. ①은 문단 5(a)(평가된 중요왜곡표시위험을 고려하여 특정 실증적인 분석적절차가 적합한지를 결정), ⑤는 문단 5 본문(실증절차로서의 분석적절차를 단독으로 또는 세부테스트와 결합하여 설계하고 수행)에 따라 옳다. 이자비용 관련 주장에 유의적 위험은 식별되지 않았다.',
        },
        {
            id: 'sub1.req2',
            source_ref_id: 'kga520-A12',
            source_quote: quoteOf('kga520-A12'),
            source_span: 'KGA 520 문단 5(b)·A12·A13; ②의 판단 근거',
        },
        {
            id: 'sub1.req3',
            source_ref_id: 'kga520-A15',
            source_quote: quoteOf('kga520-A15'),
            source_span: 'KGA 520 문단 5(c)·A15; ③의 판단 근거',
        },
        {
            id: 'sub1.req4',
            source_ref_id: 'kga520-A16',
            source_quote: quoteOf('kga520-A16'),
            source_span: 'KGA 520 문단 5(d)·A16; ④의 판단 근거',
        },
    ],
    criteria: [
        {
            id: 'sub1.c1',
            requirement_id: 'sub1.req1',
            claim: SUB1_IDENTIFY,
            critical_facts: [{ id: 'sub1.c1.fact', type: 'conclusion', expected: SUB1_IDENTIFY }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga520-5', 'kga520-A12', 'kga520-A13', 'kga520-A15', 'kga520-A16'],
        },
        {
            id: 'sub1.c2',
            requirement_id: 'sub1.req2',
            claim:
                '② 기대치가 도출될 데이터의 신뢰성을 평가하여야 한다는 이유(이용가능한 정보의 원천·비교가능성·성격과 관련성, 그 작성에 대한 통제 가운데 어느 하나를 들면 인정한다), 또는 차입계약서·금융기관 확인서 등 독립된 원천의 자료와 대조하거나 명세의 작성에 관한 통제를 테스트하는 절차 중 하나를 제시한다. 회사가 준 자료라도 신뢰성을 확인하여야 한다는 취지면 인정한다. 총계정원장 합계와 맞으면 그 자료를 그대로 이용해도 된다고 쓰면 인정하지 않는다.',
            critical_facts: [
                {
                    id: 'sub1.c2.fact',
                    type: 'action',
                    expected:
                        '② 기대치가 도출될 데이터의 신뢰성을 평가하여야 한다는 이유(이용가능한 정보의 원천·비교가능성·성격과 관련성, 그 작성에 대한 통제 가운데 어느 하나를 들면 인정한다), 또는 차입계약서·금융기관 확인서 등 독립된 원천의 자료와 대조하거나 명세의 작성에 관한 통제를 테스트하는 절차 중 하나를 제시한다. 회사가 준 자료라도 신뢰성을 확인하여야 한다는 취지면 인정한다. 총계정원장 합계와 맞으면 그 자료를 그대로 이용해도 된다고 쓰면 인정하지 않는다.',
                },
            ],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga520-5', 'kga520-A12', 'kga520-A13'],
        },
        {
            id: 'sub1.c3',
            requirement_id: 'sub1.req3',
            claim:
                '③ 도출한 기대치가 중요한 왜곡표시를 식별할 정도로 충분히 정확한지를 평가하여야 한다는 이유, 또는 금리조건·실행 시기가 다른 차입금을 차입계약이나 기간별로 구분하여 기대치를 도출하여야 한다는 절차 중 하나를 제시한다. 연간 평균 하나로 계산한 값으로는 왜곡표시를 식별하기 어렵다는 취지도 인정한다. 자료의 신뢰성만 다루고 기대치의 정확성이나 세분화를 다루지 않으면 인정하지 않는다. 전기와 같은 방식이면 그대로 기대치로 써도 된다고 쓰면 인정하지 않는다.',
            critical_facts: [
                {
                    id: 'sub1.c3.fact',
                    type: 'action',
                    expected:
                        '③ 도출한 기대치가 중요한 왜곡표시를 식별할 정도로 충분히 정확한지를 평가하여야 한다는 이유, 또는 금리조건·실행 시기가 다른 차입금을 차입계약이나 기간별로 구분하여 기대치를 도출하여야 한다는 절차 중 하나를 제시한다. 연간 평균 하나로 계산한 값으로는 왜곡표시를 식별하기 어렵다는 취지도 인정한다. 자료의 신뢰성만 다루고 기대치의 정확성이나 세분화를 다루지 않으면 인정하지 않는다. 전기와 같은 방식이면 그대로 기대치로 써도 된다고 쓰면 인정하지 않는다.',
                },
            ],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga520-5', 'kga520-A15'],
        },
        {
            id: 'sub1.c4',
            requirement_id: 'sub1.req4',
            claim:
                '④ 추가적인 조사를 하지 않고 수용될 수 있는 기록금액과 기대치의 차이금액을 절차를 설계·수행하는 단계에서 미리 결정하여야 한다는 이유나 절차를 제시한다. 평가된 위험이 높을수록 그 차이금액이 작아진다는 취지를 함께 써도 1점이며, 그 취지만 써도 인정한다. 차이가 나타난 뒤에 재무제표 전체 중요성과 견주어 판단해도 된다고 쓰면 인정하지 않는다.',
            critical_facts: [
                {
                    id: 'sub1.c4.fact',
                    type: 'action',
                    expected:
                        '④ 추가적인 조사를 하지 않고 수용될 수 있는 기록금액과 기대치의 차이금액을 절차를 설계·수행하는 단계에서 미리 결정하여야 한다는 이유나 절차를 제시한다. 평가된 위험이 높을수록 그 차이금액이 작아진다는 취지를 함께 써도 1점이며, 그 취지만 써도 인정한다. 차이가 나타난 뒤에 재무제표 전체 중요성과 견주어 판단해도 된다고 쓰면 인정하지 않는다.',
                },
            ],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga520-5', 'kga520-A16'],
        },
    ],
};

const sub2 = {
    id: 'sub2',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['10', '06'],
    prompt:
        '자료 3의 ⑥~⑨ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 수행하였어야 할 절차를 간략히 서술하시오.',
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑥, ⑦이다. ⑧은 기대치와 차이가 있는 변동을 식별한 경우 경영진에게 질문하고 그 답변과 관련성이 있는 적합한 감사증거를 입수하여야 하므로 옳다. ⑨는 경영진의 답변과 관련된 감사증거를 감사의 진행 중에 입수한 다른 감사증거를 고려하여 그 답변을 평가함으로써 입수할 수 있으므로, 새로운 외부 확인서를 다시 받지 않았더라도 옳다.',
        '⑥ 감사인은 감사의 종료시점에 근접하여 기업에 대하여 이해한 바와 재무제표가 일관성이 있는지에 대하여 전반적인 결론을 내리기 위한 분석적절차를 설계하고 수행하여야 한다. 상반기 자료로 수행한 위험평가 단계의 분석으로 이를 갈음할 수 없으므로, 하반기에 도매판매가 줄고 직영판매가 늘었다는 이해와 최종 재무제표의 매출 구성·이익률 등의 관계가 일관되는지를 분석하여 개별 부문에 관하여 감사 중 형성한 결론을 확인하여야 한다.',
        '⑦ 최초에 중요왜곡표시위험을 식별하고 평가하는 데 근거가 된 감사증거와 일관성이 없는 새로운 정보를 입수하였으므로 그 식별 또는 평가를 수정하여야 한다. 판매단가가 같은데 출하수량은 줄고 12월 말 매출만 급증한 관계는 위험평가 단계의 자료에 나타나 있지 않았으므로, 매출에 대하여 이전에 인식되지 않았던 중요왜곡표시위험을 반영하여 위험평가를 수정하고 이에 따라 계획된 추가감사절차를 변경하여야 한다.',
    ],
    requirements: [
        {
            id: 'sub2.req1',
            source_ref_id: 'kga520-6',
            source_quote: quoteOf('kga520-6'),
            source_span:
                'KGA 520 문단 6·7·A17·A18·A19·A20, KGA 315 문단 37; 식별 기준: ⑥(감사종료에 근접한 시점의 분석적절차를 따로 설계하지 않고 위험평가 단계의 분석 결과로 갈음), ⑦(위험평가 단계의 자료에 나타나지 않았던 관계를 확인하고도 최초의 중요왜곡표시위험 평가를 그대로 둠)은 옳지 않다. ⑧은 문단 7(a)(경영진에게 질문하고 경영진의 답변과 관련성이 있는 적합한 감사증거를 입수), ⑨는 문단 A20(경영진의 답변과 관련된 감사증거는 감사의 진행 중에 입수한 다른 감사증거를 고려하여 그 답변을 평가함으로써 입수될 수 있음)에 따라 옳다.',
        },
        {
            id: 'sub2.req2',
            source_ref_id: 'kga520-A17',
            source_quote: quoteOf('kga520-A17'),
            source_span: 'KGA 520 문단 6·A17·A19; ⑥의 판단 근거',
        },
        {
            id: 'sub2.req3',
            source_ref_id: 'kga315-37',
            source_quote: quoteOf('kga315-37'),
            source_span: 'KGA 315 문단 37, KGA 520 문단 A18; ⑦의 판단 근거',
        },
    ],
    criteria: [
        {
            id: 'sub2.c1',
            requirement_id: 'sub2.req1',
            claim: SUB2_IDENTIFY,
            critical_facts: [{ id: 'sub2.c1.fact', type: 'conclusion', expected: SUB2_IDENTIFY }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga520-6', 'kga520-7', 'kga520-A17', 'kga520-A19', 'kga520-A20', 'kga315-37'],
        },
        {
            id: 'sub2.c2',
            requirement_id: 'sub2.req2',
            claim:
                '⑥ 감사의 종료시점에 근접하여 기업에 대하여 이해한 바와 재무제표가 일관성이 있는지에 대한 전반적인 결론을 내리기 위한 분석적절차를 수행하여야 한다는 이유, 또는 최종 재무제표를 대상으로 판매구조 변화와 매출 구성·이익률 등의 관계가 일관되는지를 분석하여야 한다는 절차 중 하나를 제시한다. 세부테스트를 마쳤다는 이유로 이를 생략하거나 위험평가 단계의 분석으로 갈음할 수 없다는 취지도 인정한다. 감사종료 시점의 분석이 위험평가 단계의 분석과 유사한 방법일 수 있다는 점만 쓰면 인정하지 않는다.',
            critical_facts: [
                {
                    id: 'sub2.c2.fact',
                    type: 'action',
                    expected:
                        '⑥ 감사의 종료시점에 근접하여 기업에 대하여 이해한 바와 재무제표가 일관성이 있는지에 대한 전반적인 결론을 내리기 위한 분석적절차를 수행하여야 한다는 이유, 또는 최종 재무제표를 대상으로 판매구조 변화와 매출 구성·이익률 등의 관계가 일관되는지를 분석하여야 한다는 절차 중 하나를 제시한다. 세부테스트를 마쳤다는 이유로 이를 생략하거나 위험평가 단계의 분석으로 갈음할 수 없다는 취지도 인정한다. 감사종료 시점의 분석이 위험평가 단계의 분석과 유사한 방법일 수 있다는 점만 쓰면 인정하지 않는다.',
                },
            ],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga520-6', 'kga520-A17', 'kga520-A19'],
        },
        {
            id: 'sub2.c3',
            requirement_id: 'sub2.req3',
            claim:
                '⑦ 최초의 위험 식별·평가에 근거가 된 감사증거와 일관성이 없는 새로운 정보를 입수하였으므로 그 식별 또는 평가를 수정하여야 한다는 이유, 또는 매출에 대하여 새로 식별되는 중요왜곡표시위험을 반영하여 위험평가를 수정하고 계획된 추가감사절차를 변경하여야 한다는 절차 중 하나를 제시한다. 분석적절차의 결과로 이전에 인식되지 않았던 중요왜곡표시위험이 식별될 수 있다는 취지도 인정한다. 12월 거래에 대한 구체적인 추가절차만 쓰고 위험평가의 수정을 다루지 않으면 인정하지 않는다. 기록 시점의 문제이므로 위험평가를 그대로 두어도 된다고 쓰면 인정하지 않는다.',
            critical_facts: [
                {
                    id: 'sub2.c3.fact',
                    type: 'action',
                    expected:
                        '⑦ 최초의 위험 식별·평가에 근거가 된 감사증거와 일관성이 없는 새로운 정보를 입수하였으므로 그 식별 또는 평가를 수정하여야 한다는 이유, 또는 매출에 대하여 새로 식별되는 중요왜곡표시위험을 반영하여 위험평가를 수정하고 계획된 추가감사절차를 변경하여야 한다는 절차 중 하나를 제시한다. 분석적절차의 결과로 이전에 인식되지 않았던 중요왜곡표시위험이 식별될 수 있다는 취지도 인정한다. 12월 거래에 대한 구체적인 추가절차만 쓰고 위험평가의 수정을 다루지 않으면 인정하지 않는다. 기록 시점의 문제이므로 위험평가를 그대로 두어도 된다고 쓰면 인정하지 않는다.',
                },
            ],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga315-37', 'kga520-A18'],
        },
    ],
};

// ── 4. 세트 ──────────────────────────────────────────────────────────────────
const set = {
    schema_version: '3.0',
    id: 'case-10-analytical-procedures-20260920',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '차입금 이자비용의 분석과 감사종료 전 최종 자료의 검토',
    classification: {
        topic_id: '10',
        part: 'PART3',
        chapter: '분석적절차와 표본감사',
        domain: 'audit',
        standards: ['KGA 315', 'KGA 520'],
        tags: ['분석적절차', '실증적 분석절차', '감사종료 분석', '사례형'],
    },
    source_refs: sourceRefs,
    shared_context: { facts },
    learning_order: ['sub1', 'sub2'],
    subquestions: [sub1, sub2],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-20 사용자 지시("68 + 32로 r12 초안 만들어줘")에 따라 68번(case-10-completion-analytics-20260914, 감사종료를 앞둔 매출·운송비 자료의 검토)과 32번(pilot-10-007, 이자비용 분석의 기대치와 차이 조사)을 한 회사의 시간 순서로 합친 병합 초안이다. 두 원 세트는 대체 후 퇴역 대상이며 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
            '형식은 학습 단위 계약의 기본인 옳지 않은 것 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 수행하였어야 할 절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 옳은 항목 ①·⑤·⑧·⑨에는 별도 득점 기준이 없다. 물음 1은 4점, 물음 2는 3점으로 합계 7점이다.',
            '원 두 세트는 KGA 520 문단 7·A20의 같은 기준에서 결론이 갈리는 두 경우를 각각 정답으로 삼고 있었다(68번 sub3: 이미 입수한 증거가 설명을 뒷받침하므로 새 외부증거가 필요하지 않음, 32번 exp1의 나: 입수한 증거가 설명을 뒷받침하지 못하므로 기타 감사절차가 필요함). 학습 단위 계약의 "대조되는 두 경우를 함께 두지 않음"에 따라 68번 쪽만 ⑨의 함정으로 남기고 32번의 차이 조사 요소는 삭제하였다.',
            '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다. KGA 520 문단 5·6·7·A12·A13·A15·A16·A17·A18·A19·A20과 KGA 315 문단 37은 이미 등록된 전문(delegated-s04-kga-2025.txt, kga315-330-2025-review06.txt)에서 인용했고, 문단 5·6·7·A15~A20과 315.37은 두 원 세트의 정본 인용을 바이트와 해시 그대로 재사용했다. 문단 A12·A13만 같은 등록 전문에서 새로 발췌했다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

const outPath = path.join(here, 'sets.json');
fs.writeFileSync(outPath, `${JSON.stringify([set], null, 2)}\n`, 'utf8');

const total = set.subquestions.reduce(
    (sum, sub) => sum + sub.criteria.reduce((inner, criterion) => inner + criterion.max_points, 0),
    0,
);
const factChars = facts.map((fact) => fact.text).join('\n').length;
console.log(`sets.json 작성: ${set.id} · 물음 ${set.subquestions.length}개 · ${total}점 · 사실관계 ${factChars}자 · source_refs ${sourceRefs.length}개`);
