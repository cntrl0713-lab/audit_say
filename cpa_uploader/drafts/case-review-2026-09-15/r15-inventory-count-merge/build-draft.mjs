// r15: 6번(draft-09-501-freq01)과 65번(case-09-inventory-location-population-20260914)의 병합 초안 생성기.
//
//   node cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/build-draft.mjs
//
// 인용은 (1) 현재 정본의 두 원 세트가 이미 담고 있는 KGA 501 문단 5·A9·A3·A7과 KGA 530 문단 6을
// 바이트 그대로 재사용하고, (2) 새로 필요한 KGA 501 문단 4(a)·4(b)·8·A11만 이미 등록된 전문에서
// 줄 범위로 발췌한다. 해시는 인용 문자열의 SHA-256이다. 새 원자료 수집은 없다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');

const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const OFFICIAL_501 = 'cpa_uploader/data/official/kga501-505-510-2025-review09.txt';

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
// 원 두 세트에서 바이트 그대로 재사용하는 인용
const reused = [
    ['kga501-5', 'draft-09-501-freq01', 'src1', 'KGA 501 문단 5, 2025 개정 전문 원문 PDF 391쪽'],
    ['kga501-A9', 'draft-09-501-freq01', 'src2', 'KGA 501 문단 A9, 2025 개정 전문 원문 PDF 394쪽'],
    ['kga501-A3', 'case-09-inventory-location-population-20260914', 'src-7077392dbc2aa6676b', 'KGA 501 문단 A3, 2025 개정 전문 원문 PDF 393쪽'],
    ['kga501-A7', 'case-09-inventory-location-population-20260914', 'src-1fad7e9a1e928ed563', 'KGA 501 문단 A7, 2025 개정 전문 원문 PDF 393쪽'],
    ['kga530-6', 'case-09-inventory-location-population-20260914', 'src-78146d7821a5d4d62f', 'KGA 530 문단 6, 2025 개정 전문 원문 PDF 431쪽'],
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

// 새로 발췌하는 인용 (이미 등록된 공식 전문)
const newCuts = [
    ['kga501-4a', 26, 34, 'KGA 501 문단 4 본문과 (a), 2025 개정 전문 원문 PDF 390쪽'],
    ['kga501-4b', 42, 43, 'KGA 501 문단 4(b), 2025 개정 전문 원문 PDF 391쪽'],
    ['kga501-8', 54, 59, 'KGA 501 문단 8, 2025 개정 전문 원문 PDF 391쪽'],
    ['kga501-A11', 112, 116, 'KGA 501 문단 A11, 2025 개정 전문 원문 PDF 395쪽'],
];

for (const [id, from, to, title] of newCuts) {
    const quote = extract(OFFICIAL_501, from, to);
    sourceRefs.push({
        id,
        file: OFFICIAL_501,
        title,
        page: 'KGA 501',
        source_quote: quote,
        role: 'standard',
        content_hash: hash(quote),
        source_span: `${title}; 등록 전문 ${OFFICIAL_501} L${from}-L${to}`,
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
            '온누리회계법인은 생활잡화를 도소매하는 한별상사의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사하고 있으며, 감사보고서일은 20X2년 3월 중순으로 예정되어 있다.',
            '재고자산은 한별상사의 재무제표에 중요하고, 회사는 품목별 수량을 계속기록법으로 관리한다.',
            '한별상사는 재고자산을 중앙물류창고, 동부영업소, 반품창고의 세 곳에 보관하며 보관금액은 각각 전체 재고금액의 60%, 22%, 18%이다.',
            '중앙물류창고에는 물류팀이 관리하는 박스 단위의 대량 보관 상품이 있고, 동부영업소에는 영업본부 동부지점이 관리하는 낱개 진열·배송용 소량 다품종 상품이 있으며, 반품창고에는 영업지원팀이 관리하는 회수·반품 상품이 있다.',
            '반품창고에서는 20X1년 중 장부수량과 실제수량의 차이가 여러 차례 나타났고, 재고관리자가 교체된 뒤 그 차이를 조사한 기록은 남아 있지 않다.',
            '한별상사는 이 밖에 외부 물류업체인 다원로지스의 창고에 재무제표에 중요한 금액의 상품을 맡겨 두고 있다.',
            '회사는 실무상의 이유로 세 장소의 재고자산 실사기준일을 20X1년 11월 30일로 정하였고, 장소마다 다른 실사팀이 실사를 수행하며 실사 결과를 기록하는 담당자도 각각 다르다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact2',
        text: [
            '중앙물류창고 안쪽에는 출고를 앞둔 상품을 따로 쌓아 두는 별도 보관구역이 있고, 20X1년 11월 30일 실사 당일에도 그 구역에 한별상사 소유 상품이 놓여 있었다. 이 실사와 관련하여 감사팀이 계획하거나 수행한 절차와 판단은 다음과 같다.',
            '① 재고자산이 재무제표에 중요하므로 감사팀은 중앙물류창고의 실사에 입회하여, 회사가 실사 결과를 기록하고 통제하기 위하여 실사팀에 배포한 지시서와 절차를 평가하고, 실사팀이 그 지시서대로 수량을 세는 과정을 관찰하였으며, 보관 중인 상품의 상태를 조사하였다.',
            '② 감사팀은 세 장소의 보관금액 비중을 산정한 뒤, 비중이 가장 낮은 반품창고는 입회대상에서 제외하고 중앙물류창고와 동부영업소의 실사에만 입회하기로 하였다.',
            '③ 감사팀은 테스트 실사의 표본규모를 산정하면서, 입회하기로 한 중앙물류창고와 동부영업소의 재고 목록을 하나로 합쳐 단일 모집단으로 보았다.',
            '④ 감사팀은 중앙물류창고에서 회사의 실사기록에서 고른 항목을 실물과 대조하여 수량을 세었고, 고른 항목의 수량이 모두 일치하였으므로 실사기록에 빠진 상품이 있는지에 관한 테스트도 마쳤다고 정리하였다.',
            '⑤ 감사팀은 다원로지스가 보관·통제하고 있는 한별상사 소유 상품에 대하여, 다원로지스에 그 수량과 상태에 관한 조회를 요청하기로 하고 다원로지스 창고의 실사에는 입회하지 않기로 하였다.',
        ].join('\n'),
        scoreable: false,
    },
    {
        id: 'fact3',
        text: [
            '20X1년 12월에는 연말 성수기 출하와 신규 상품 입고가 대규모로 이루어졌다. 한별상사의 규정은 창고 담당자가 작성한 입출고 기록을 회계 담당자가 전표와 대조하고 재무팀장이 월말 차이를 검토하여 승인하도록 정하고 있다. 12월 초 회계 담당자가 퇴사하였고 대조 업무의 인계는 확인되지 않았으며, 감사팀은 12월분 대조·차이 검토 기록을 아직 받지 못하였다. 한편 11월 30일 실사에서 일부 품목은 계속기록법에 의한 재고기록과 유의적인 차이가 있었고, 회사는 실사 결과에 맞추어 그 품목의 재고기록을 수정하였다. 실사일 이후 재무제표일까지 감사팀의 절차와 판단은 다음과 같다.',
            '⑥ 감사팀은 한별상사가 품목별 수량을 계속기록법으로 관리하고 있다는 점을 근거로, 11월 30일 실사 결과가 재무제표일 현재의 재고자산에 대한 감사목적에 적합하다고 결론지었다.',
            '⑦ 감사팀은 12월 1일부터 12월 31일까지의 재고변동에 대하여, 회사의 12월 재고수불부에 집계된 입고·출고 합계와 재고자산 계정의 12월 증감액이 서로 일치하는지를 확인하는 절차를 수행하였다.',
            '⑧ 감사팀은 11월 30일 실사에서 계속기록법에 의한 재고기록과 유의적인 차이가 있었던 품목을 파악하고, 회사가 그 차이를 재고기록에 반영하여 수정한 것을 확인하는 것으로 이 사항에 대한 절차를 마쳤다.',
            '⑨ 감사팀은 회사가 작성한 재무제표일 현재의 재고자산 최종 기록에 대하여, 그 기록이 11월 30일 재고자산 실사의 결과를 정확하게 반영하고 있는지를 결정하기 위한 감사절차를 수행하였다.',
        ].join('\n'),
        scoreable: false,
    },
];

// ── 3. 물음 ──────────────────────────────────────────────────────────────────
const PROMPT = (source, range) =>
    `${source}의 ${range} 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 수행하였어야 할 절차를 간략히 서술하시오.`;

const sub1Answers = [
    '옳지 않은 것은 ②, ③, ④이다. ①은 재고자산이 중요하여 실사에 입회하면서 경영진의 지시와 절차를 평가하고 경영진이 수행하는 실사절차를 관찰하며 재고자산을 조사한 것이므로 옳다. ⑤는 제3자가 보관·통제하고 있는 재고자산이 중요한 경우 그 제3자에게 수량과 상태에 대한 조회를 요청하는 것이 인정되는 절차이므로 옳다.',
    '② 적절한 입회장소를 결정할 때에는 보관장소별 재고자산의 중요성뿐 아니라 장소별 중요왜곡표시위험도 함께 고려하여야 한다. 반품창고는 장부수량과 실제수량의 차이가 반복되고 그 차이를 조사한 기록도 없어 중요왜곡표시위험이 높으므로, 보관금액 비중이 가장 낮다는 이유만으로 제외할 것이 아니라 그 위험을 반영하여 입회 필요성을 다시 판단하였어야 한다.',
    '③ 감사표본을 설계할 때에는 감사절차의 목적과 표본을 도출할 모집단의 특성을 고려하여야 한다. 중앙물류창고와 동부영업소는 상품의 성격과 관리 부서가 다르고 실사팀과 실사기록 담당자도 서로 달라 실사기록의 신뢰성이 같다고 보기 어려우므로, 두 장소를 하나로 묶지 말고 모집단을 구분하여 테스트 실사를 계획하였어야 한다.',
    '④ 테스트 실사는 경영진의 실사기록에서 선정한 항목을 실제의 재고로 추적하거나 실제의 재고에서 선정한 항목을 경영진의 실사기록으로 추적하는 방법으로 수행되며, 실사기록에 빠진 상품이 있는지는 앞의 방향만으로 확인되지 않는다. 별도 보관구역에 있던 실제 상품에서 항목을 선정하여 회사의 실사기록에 기재되어 있는지 추적하였어야 한다.',
];

const sub2Answers = [
    '옳지 않은 것은 ⑥, ⑦, ⑧이다. ⑨는 재고자산의 최종 기록이 재고자산 실사의 결과를 정확하게 반영하고 있는지 여부를 결정하기 위하여 최종 기록에 대한 감사절차를 수행한 것이므로 옳다.',
    '⑥ 기업이 계속기록법을 유지하는지 여부와 관계없이 재고자산 변동에 대한 통제의 설계·실행 및 유지의 효과성이 재무제표일 외의 날에 수행된 재고자산 실사가 감사목적에 적합한지를 결정한다. 계속기록법을 사용한다는 사실만으로 적합하다고 결론지을 것이 아니라, 12월 재고변동에 대한 대조·검토 통제가 효과적으로 설계되고 실행되었으며 재무제표일까지 유지되었는지를 평가하였어야 한다.',
    '⑦ 재고자산 실사가 재무제표일이 아닌 일자에 수행된 경우에는 실사일과 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지 여부에 대한 감사증거를 얻기 위한 감사절차를 수행하여야 한다. 회사 내부의 수불부 합계와 계정 증감액이 서로 일치하는지 확인하는 것만으로는 그 증거가 되지 않으므로, 12월의 입고·출고 거래를 표본추출하여 전표·운송서류 등 증빙과 대조하는 절차를 수행하였어야 한다.',
    '⑧ 실사일과 최종 재고자산 기록일 사이의 금액변동이 적절히 기록되었는지에 대한 감사증거를 얻기 위한 절차를 설계할 때에는 실사 중 입수된 정보와 계속기록법에 의한 재고기록 간의 유의적 차이에 대한 이유도 고려하여야 한다. 회사가 차이를 수정하였다는 사실을 확인하는 데 그치지 말고 그 차이가 발생한 이유를 확인하여 절차의 설계에 반영하였어야 한다.',
];

const criteriaSpec = {
    sub1: [
        {
            id: 'sub1.c1',
            requirement: 'sub1.req1',
            refs: ['kga501-4a', 'kga501-A3', 'kga530-6', 'kga501-A7', 'kga501-8'],
            claim:
                '옳지 않은 것으로 ②·③·④를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ②·③·④ 중 하나라도 빠뜨리거나, 옳은 것인 ①(재고자산이 중요하여 실사에 입회하고 경영진의 지시와 절차 평가·실사절차 관찰·재고자산 조사를 수행), ⑤(제3자가 보관·통제하는 중요한 재고자산에 대하여 그 제3자에게 수량과 상태의 조회를 요청하고 그 창고의 실사에는 입회하지 않기로 함)를 옳지 않다고 지적하면 이 점수는 주지 않는다.',
        },
        {
            id: 'sub1.c2',
            requirement: 'sub1.req2',
            refs: ['kga501-A3'],
            claim:
                '② 적절한 입회장소를 결정할 때 보관장소별 재고자산의 중요성과 함께 장소별 중요왜곡표시위험을 고려하여야 한다는 이유, 또는 반품창고의 반복된 수량차이와 조사기록 부재를 그 장소의 위험에 반영하여 입회 필요성을 다시 판단하여야 한다는 절차 중 하나를 제시한다. 둘 중 하나만 써도 인정하고 두 위험징후 가운데 하나만 들어도 인정하며, 모든 보관장소에 반드시 입회하여야 한다는 보편 규칙은 요구하지 않는다. 보관금액 비중이 가장 낮으므로 입회대상에서 제외해도 된다고 쓰면 인정하지 않는다.',
        },
        {
            id: 'sub1.c3',
            requirement: 'sub1.req3',
            refs: ['kga530-6'],
            claim:
                '③ 감사표본을 설계할 때 감사절차의 목적과 표본을 도출할 모집단의 특성을 고려하여야 한다는 이유, 또는 상품의 성격·관리 부서·실사팀과 실사기록 담당자가 서로 다른 두 장소를 구분하여 테스트 실사를 계획하여야 한다는 절차 중 하나를 제시한다. 둘 중 하나만 써도 인정하고 사례에 있는 차이 가운데 하나만 들어도 인정하며, 장소가 다르면 언제나 별도 모집단이어야 한다는 일반화는 요구하지 않는다. 두 장소의 목록을 합쳐 표본규모를 산정해도 된다고 쓰면 인정하지 않는다.',
        },
        {
            id: 'sub1.c4',
            requirement: 'sub1.req4',
            refs: ['kga501-A7'],
            claim:
                '④ 실사기록에서 선정한 항목을 실물로 추적하는 방향만으로는 실사기록에 빠진 상품이 있는지에 관한 증거가 되지 않는다는 이유, 또는 별도 보관구역의 실제 상품에서 항목을 선정하여 회사의 실사기록에 기재되어 있는지 추적하여야 한다는 절차 중 하나를 제시한다. 둘 중 하나만 써도 인정하며, 실사기록에서 실물로 검사하는 절차의 표본을 늘려야 한다고만 쓰면 인정하지 않는다.',
        },
    ],
    sub2: [
        {
            id: 'sub2.c1',
            requirement: 'sub2.req1',
            refs: ['kga501-5', 'kga501-A9', 'kga501-A11', 'kga501-4b'],
            claim:
                '옳지 않은 것으로 ⑥·⑦·⑧을 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑥·⑦·⑧ 중 하나라도 빠뜨리거나, 옳은 것인 ⑨(재무제표일 현재의 재고자산 최종 기록이 11월 30일 실사의 결과를 정확하게 반영하고 있는지를 결정하기 위한 감사절차를 수행)를 옳지 않다고 지적하면 이 점수는 주지 않는다.',
        },
        {
            id: 'sub2.c2',
            requirement: 'sub2.req2',
            refs: ['kga501-A9'],
            claim:
                '⑥ 기업이 계속기록법을 유지하는지 여부와 관계없이 재고자산 변동에 대한 통제의 설계·실행 및 유지의 효과성이 재무제표일 외의 날에 수행된 재고자산 실사가 감사목적에 적합한지를 결정한다는 이유, 또는 12월 재고변동에 대한 대조·검토 통제가 효과적으로 설계·실행되고 재무제표일까지 유지되었는지를 평가하여야 한다는 절차 중 하나를 제시한다. 둘 중 하나만 써도 인정하고 설계·실행·유지 가운데 일부만 들어도 인정한다. 계속기록법을 사용하므로 기중 실사 결과가 재무제표일의 감사목적에 적합하다고 쓰면 인정하지 않는다.',
        },
        {
            id: 'sub2.c3',
            requirement: 'sub2.req3',
            refs: ['kga501-5'],
            claim:
                '⑦ 실사일과 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지 여부에 대한 감사증거를 얻기 위한 감사절차를 수행하여야 한다는 이유, 또는 12월의 입고·출고 거래를 증빙과 대조하는 등 그 기간의 변동 자체를 검증하는 절차를 수행하여야 한다는 절차 중 하나를 제시한다. 둘 중 하나만 써도 인정하고 구체적인 증빙의 종류는 요구하지 않는다. 회사 내부의 수불부 합계와 계정 증감액이 일치하면 그 기간의 재고변동에 관한 감사증거로 충분하다고 쓰면 인정하지 않는다.',
        },
        {
            id: 'sub2.c4',
            requirement: 'sub2.req4',
            refs: ['kga501-A11'],
            claim:
                '⑧ 실사 중 입수된 정보와 계속기록법에 의한 재고기록 간의 유의적 차이에 대한 이유도 고려하여 실사일 이후의 감사절차를 설계하여야 한다는 이유, 또는 회사가 차이를 수정하였다는 확인에 그치지 말고 그 차이가 발생한 이유를 확인하여야 한다는 절차 중 하나를 제시한다. 둘 중 하나만 써도 인정하며, 차이의 이유를 다룬다는 취지가 없이 수정 금액을 다시 계산하여야 한다고만 쓰면 인정하지 않는다. 회사가 재고기록을 수정하였으므로 더 확인할 사항이 없다고 쓰면 인정하지 않는다.',
        },
    ],
};

const requirementSpec = {
    'sub1.req1': ['kga501-4a', 'KGA 501 문단 4·A3·A7과 KGA 530 문단 6; 식별 기준: ②(세 장소의 보관금액 비중만으로 반품창고를 입회대상에서 제외), ③(중앙물류창고와 동부영업소의 재고 목록을 하나로 합쳐 단일 모집단으로 보고 테스트 실사의 표본규모를 산정), ④(실사기록에서 고른 항목만 실물과 대조하고 실사기록의 누락 여부에 관한 테스트도 마쳤다고 정리)는 옳지 않다. ①은 문단 4(a)(i)~(iii), ⑤는 문단 8(a)에 따라 옳다.'],
    'sub1.req2': ['kga501-A3', 'KGA 501 문단 A3; 적절한 입회장소를 결정할 때 보관장소별 재고자산의 중요성 및 중요왜곡표시위험을 고려한다. 반품창고의 반복된 수량차이와 조사기록 부재가 그 장소의 위험에 해당한다.'],
    'sub1.req3': ['kga530-6', 'KGA 530 문단 6; 감사표본을 설계할 때 감사절차의 목적과 표본을 도출할 모집단의 특성을 고려한다. 이 사례의 상품 성격·관리 부서·실사팀과 기록 담당자의 차이가 모집단의 특성 차이에 해당한다.'],
    'sub1.req4': ['kga501-A7', 'KGA 501 문단 A7; 실사기록에서 실물로 추적하는 방향과 실물에서 실사기록으로 추적하는 방향이 함께 기록의 완전성과 정확성에 대한 증거를 제공한다. 별도 보관구역의 실물에서 출발하는 추적이 누락 여부에 관한 증거가 된다.'],
    'sub2.req1': ['kga501-5', 'KGA 501 문단 5·A9·A11; 식별 기준: ⑥(계속기록법을 관리한다는 점을 근거로 기중 실사 결과가 재무제표일의 감사목적에 적합하다고 결론), ⑦(12월 재고변동에 대하여 회사 수불부 합계와 계정 증감액의 일치만 확인), ⑧(유의적 차이를 회사가 수정한 것을 확인하는 것으로 절차를 마침)은 옳지 않다. ⑨는 문단 4(b)에 따라 옳다.'],
    'sub2.req2': ['kga501-A9', 'KGA 501 문단 A9; 계속기록법 유지 여부와 관계없이 재고자산 변동에 대한 통제의 설계·실행 및 유지의 효과성이 재무제표일 외의 날에 수행되는 실사의 감사목적 적합성을 결정한다.'],
    'sub2.req3': ['kga501-5', 'KGA 501 문단 5; 재고자산 실사가 재무제표일이 아닌 일자에 수행되면 문단 4의 절차에 추가하여 실사일과 재무제표일 사이의 재고자산 변동이 적절하게 기록되었는지에 대한 감사증거를 얻기 위한 절차를 수행하여야 한다.'],
    'sub2.req4': ['kga501-A11', 'KGA 501 문단 A11; 실사일과 최종 재고자산 기록일 사이의 금액변동에 대한 감사절차를 설계할 때 실사 중 입수된 정보와 계속기록법에 의한 재고기록 간의 유의적 차이에 대한 이유가 고려사항에 포함된다.'],
};

function buildSubquestion({ id, topicIds, source, range, answers, specKey }) {
    const specs = criteriaSpec[specKey];
    const requirementIds = [...new Set(specs.map((spec) => spec.requirement))];
    return {
        id,
        type: 'judgment',
        question_style: 'case',
        topic_ids: topicIds,
        prompt: PROMPT(source, range),
        constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
        selection: { type: 'all', n: null },
        decision: null,
        answer_slots: [{ id: `${id}.answer`, label: '답안', input: 'textarea' }],
        model_answer: answers,
        requirements: requirementIds.map((requirementId) => {
            const [refId, span] = requirementSpec[requirementId];
            return { id: requirementId, source_ref_id: refId, source_quote: quoteOf(refId), source_span: span };
        }),
        criteria: specs.map((spec) => ({
            id: spec.id,
            requirement_id: spec.requirement,
            claim: spec.claim,
            critical_facts: [{ id: `${spec.id}.fact`, type: spec.id.endsWith('.c1') ? 'conclusion' : 'action', expected: spec.claim }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: spec.refs,
        })),
    };
}

const set = {
    schema_version: '3.0',
    id: 'case-09-inventory-count-20260920',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '재고자산 실사의 계획·입회와 실사일 이후의 감사절차',
    classification: {
        topic_id: '09',
        part: 'PART3',
        chapter: '계정과목별 실증절차',
        domain: 'audit',
        standards: ['KGA 501', 'KGA 530'],
        tags: ['사례형', '재고자산 실사', '실사 입회', '실사일과 재무제표일'],
    },
    source_refs: sourceRefs,
    shared_context: { facts },
    learning_order: ['sub1', 'sub2'],
    subquestions: [
        buildSubquestion({ id: 'sub1', topicIds: ['09', '10'], source: '자료 2', range: '①~⑤', answers: sub1Answers, specKey: 'sub1' }),
        buildSubquestion({ id: 'sub2', topicIds: ['09', '06'], source: '자료 3', range: '⑥~⑨', answers: sub2Answers, specKey: 'sub2' }),
    ],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-20 사용자 지시("6·65를 합쳐서 새 문제로 대체해줘")에 따라 6번(draft-09-501-freq01, 기중 재고실사와 결산일까지의 재고변동 통제)과 65번(case-09-inventory-location-population-20260914, 재고실사 장소의 위험과 모집단·테스트 방향)을 한 회사의 재고실사 하나로 합친 병합 초안이다. 두 원 세트는 대체 후 퇴역 대상이며 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
            '형식은 학습 단위 계약의 기본인 옳지 않은 것 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 수행하였어야 할 절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 옳은 항목 ①·⑤·⑨에는 별도 득점 기준이 없다. 물음 1은 4점, 물음 2는 4점으로 합계 8점이다.',
            '대조되는 두 경우를 함께 두지 않기 위하여, 입회장소 결정(문단 A3)과 테스트 실사의 방향(문단 A7)은 각각 옳지 않은 항목 한 개만 두고 같은 기준에서 옳은 결론이 되는 항목을 두지 않았다. 함정 ⑤는 기업 자신의 보관장소가 아니라 제3자가 보관·통제하는 재고자산에 관한 문단 8(a)의 다른 기준이다.',
            '이미 게시된 case-15-scope-limitation-disclaimer-20260919의 옳은 항목 ④는 감사인이 예상하지 못한 상황으로 실사에 입회할 수 없었던 문단 6의 경우이며 감사범위 제한 여부를 묻는다. 이 초안은 기업이 재무제표일이 아닌 일자에 실사를 수행한 문단 5·A9·A11의 경우로 실사일 이후의 감사절차와 통제 고려를 묻는다. 문단 6과 감사범위 제한의 결론은 이 초안에서 다루지 않는다.',
            '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다. KGA 501은 문단 2에서 2026년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 시행된다고 정한다. 문단 5·A9·A3·A7과 KGA 530 문단 6은 두 원 세트의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 문단 4(a)·4(b)·8·A11만 이미 등록된 전문 cpa_uploader/data/official/kga501-505-510-2025-review09.txt에서 새로 발췌했다. 새 원자료 수집은 없다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

const outFile = path.join(here, 'sets.json');
fs.writeFileSync(outFile, `${JSON.stringify([set], null, 2)}\n`, { flag: 'wx' });
const points = set.subquestions.map((question) => question.criteria.reduce((sum, c) => sum + c.max_points, 0));
const factLength = facts.map((fact) => fact.text).join('\n').length;
console.log(JSON.stringify({ file: 'sets.json', id: set.id, questions: set.subquestions.length, points, total: points.reduce((a, b) => a + b, 0), fact_chars: factLength, source_refs: sourceRefs.length }, null, 2));
