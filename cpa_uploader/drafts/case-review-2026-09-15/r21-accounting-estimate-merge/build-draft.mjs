// r21: 17번(pilot-11-005) · 54번(case-11-estimate-lookback-20260914)의 병합 초안 생성기.
// 17번의 기준서형 물음 sub2는 퇴역시키지 않고 별도 기준서형 세트로 분리 보존한다(r17 선례).
//
//   node cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge/build-draft.mjs
//
// 인용은 (1) 두 원 세트가 이미 담고 있는 KGA 540 인용을 바이트와 content_hash 그대로 재사용하고,
// (2) 함정 항목의 근거로 필요한 KGA 540 문단 A57·A58만 이미 등록된 공식 전문에서 줄 범위로 발췌한다.
// 해시는 인용 문자열의 SHA-256이다. 새 원자료 수집은 없다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');

const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const OFFICIAL_FOLLOWUP = 'cpa_uploader/data/official/case-followup-2026-09-14-kga540.md';
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const byId = new Map(bank.map((set) => [set.id, set]));

function extract(relativeFile, fromLine, toLine) {
    const lines = fs.readFileSync(path.join(root, relativeFile), 'utf8').split(/\r?\n/);
    return lines.slice(fromLine - 1, toLine).join('\n');
}

function hash(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function reuse(setId, refId) {
    const set = byId.get(setId);
    if (!set) throw new Error(`정본에 세트가 없습니다: ${setId}`);
    const ref = (set.source_refs || []).find((item) => item.id === refId);
    if (!ref) throw new Error(`${setId}에 source_ref가 없습니다: ${refId}`);
    return ref;
}

// ── 1. 출처 ──────────────────────────────────────────────────────────────────
const PILOT = 'pilot-11-005';
const LOOKBACK = 'case-11-estimate-lookback-20260914';

const reusedCase = [
    ['kga540-22', PILOT, 'std-540-22', 'KGA 540 문단 22, 2025 개정 전문 원문 페이지 452; L91-L107'],
    ['kga540-24', PILOT, 'std-540-24', 'KGA 540 문단 24, 2025 개정 전문 원문 페이지 453; L132-L149'],
    ['kga540-26', PILOT, 'std-540-26', 'KGA 540 문단 26, 2025 개정 전문 원문 페이지 454; L168-L178'],
    ['kga540-29', PILOT, 'std-540-29', 'KGA 540 문단 29, 2025 개정 전문 원문 페이지 455; L213-L225'],
    ['kga540-A109', PILOT, 'std-540-A109', 'KGA 540 문단 A109, 2025 개정 전문 원문 페이지 489; L264-L281'],
    ['kga540-A122', PILOT, 'std-540-A122', 'KGA 540 문단 A122, 2025 개정 전문 원문 페이지 492; L457-L465'],
    ['kga540-A123', PILOT, 'std-540-A123', 'KGA 540 문단 A123, 2025 개정 전문 원문 페이지 493; L467-L478'],
    ['kga540-A125', PILOT, 'std-540-A125', 'KGA 540 문단 A125, 2025 개정 전문 원문 페이지 493; L492-L503'],
    ['kga540-14', LOOKBACK, 'src-558362865301b7f4c6', 'KGA 540 문단 14, 2026 전문 원문 페이지 476; L25-L32'],
    ['kga540-A55', LOOKBACK, 'src-5432df95bfbdaaff9f', 'KGA 540 문단 A55, 2026 전문 원문 페이지 500; L34-L48'],
    ['kga540-A60', LOOKBACK, 'src-d6cf35d77958ee6ecf', 'KGA 540 문단 A60, 2026 전문 원문 페이지 501; L85-L98'],
    ['kga540-32', LOOKBACK, 'src-a3719420bca96cbb5f', 'KGA 540 문단 32, 2026 전문 원문 페이지 481; L100-L107'],
    ['kga540-A133', LOOKBACK, 'src-3ddee34bae3f196bab', 'KGA 540 문단 A133, 2026 전문 원문 페이지 521; L109-L111'],
    ['kga540-A134', LOOKBACK, 'src-d4d8fd7e4106c77bba', 'KGA 540 문단 A134, 2026 전문 원문 페이지 521; L112-L128'],
];

const caseSourceRefs = reusedCase.map(([id, setId, refId, title]) => {
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
    ['kga540-A57', OFFICIAL_FOLLOWUP, 54, 56, 'KGA 540 문단 A57, 2026 전문 원문 페이지 500; L54-L56'],
    ['kga540-A58', OFFICIAL_FOLLOWUP, 62, 72, 'KGA 540 문단 A58, 2026 전문 원문 페이지 500-501; L62-L72'],
];

for (const [id, file, from, to, title] of newCuts) {
    const quote = extract(file, from, to);
    caseSourceRefs.push({
        id,
        file,
        title,
        page: 'KGA 540',
        source_quote: quote,
        role: 'standard',
        content_hash: hash(quote),
        source_span: `${title}; 등록 전문 ${file} L${from}-L${to}`,
    });
}

const caseRefById = new Map(caseSourceRefs.map((ref) => [ref.id, ref]));
function quoteOf(id) {
    const ref = caseRefById.get(id);
    if (!ref) throw new Error(`source_ref 없음: ${id}`);
    return ref.source_quote;
}
// 인용의 일부만 requirement 근거로 쓸 때 사용한다. 원문은 줄바꿈으로 어절이 끊기므로 공백을 지운
// 문자열에서 위치를 찾은 뒤 원문의 연속 부분문자열을 그대로 잘라낸다.
function slicePart(label, quote, from, to) {
    const map = [];
    let stripped = '';
    for (let i = 0; i < quote.length; i += 1) {
        if (/\s/u.test(quote[i])) continue;
        map.push(i);
        stripped += quote[i];
    }
    const key = (value) => value.replace(/\s+/gu, '');
    const start = stripped.indexOf(key(from));
    if (start < 0) throw new Error(`${label}: 시작 문구를 찾을 수 없습니다: ${from}`);
    const end = stripped.indexOf(key(to), start + key(from).length - 1);
    if (end < 0) throw new Error(`${label}: 끝 문구를 찾을 수 없습니다: ${to}`);
    return quote.slice(map[start], map[end + key(to).length - 1] + 1);
}

function partOf(id, from, to) {
    return slicePart(id, quoteOf(id), from, to);
}

// ── 2. 사실관계 ──────────────────────────────────────────────────────────────
const facts = [
    {
        id: 'fact1',
        text: [
            '한들회계법인은 산업용 전장부품을 제조·판매하는 여울전장의 20X2년 1월 1일부터 12월 31일까지의 재무제표를 감사하고 있다.',
            '여울전장은 제품마다 3년의 수리보증을 제공하여 보증충당부채를 인식하고, 매출채권에 대손충당금을 설정하며, 비상장회사 주식을 당기손익-공정가치로 측정한다.',
            '감사팀은 이 세 회계추정치와 관련 공시를 감사하고 있으며 재무제표 전체에 대한 중요성은 세전이익에 근거하여 결정하였다.',
            '아래 세 자료는 같은 감사에서 이어지는 단계이고 금액 계산은 요구하지 않는다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact2',
        text: [
            '경영진은 비상장회사 주식의 평가에 관하여 사용한 방법, 유의적 가정과 데이터, 선택한 점추정치, 추정불확실성을 기술하는 주석 초안을 감사팀에 제출하였다.',
            '감사팀은 경영진의 회계추정치 도출방법을 테스트하는 접근방법을 선택하였고, 평가에 사용된 할인율 가정이 이 회계추정치에서 중요왜곡표시위험을 발생시키는 부분이라고 평가하여 그 가정에 대하여 감사인 자체의 범위추정치를 도출하였다.',
            '도출한 범위의 폭은 재무제표 전체에 대한 중요성의 여러 배이다.',
            '주석 초안의 문구는 전기와 같으며, 당기에는 그 비상장회사가 속한 시장의 거래가격 변동 폭이 전기보다 크게 넓어졌다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact3',
        text: [
            '여울전장은 제품군별로 보증충당부채를 산정한다. 20X1년에 판매한 A형 장비는 잔여 보증기간이 남아 최종 수리비용이 확정되지 않았고, 회사는 당기에 지급한 수리비용과 접수된 고장자료 및 남은 보증기간을 반영하여 그 장비군의 잔여 의무를 당기 목적상 재추정하였다. 전기 산정표와 당기의 지급·재추정 자료는 감사팀이 모두 열람할 수 있다.',
            'B형 장비는 당기에 보증기간이 끝나 실제 수리비용이 확정되었고 그 금액은 전기 추정액보다 컸다. 감사팀이 차이의 원인을 조사한 결과 전기 재무제표를 확정한 뒤에 주요 수리부품의 공급이 중단되어 단가가 오른 사실이 확인되었고, 전기 산정 당시의 고장률 자료와 부품 단가 자료는 전기 산정표에 모두 반영되어 있었다. 전기 재무제표의 재발행이나 수정분개는 이번 감사의 대상이 아니다.',
            '대손충당금은 일상적이고 반복적인 매출채권 기록에서 도출되며 감사팀은 그 고유위험을 높은 것으로 평가하지 않았다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact4',
        text: [
            '감사팀은 여울전장의 회계추정치를 세 보고기간에 걸쳐 함께 살펴보았다. 보증충당부채와 대손충당금에서는 세 기간 모두 합리적으로 가능한 금액의 아래쪽을, 비상장회사 주식의 평가에서는 세 기간 모두 위쪽을 선택해 왔다.',
            '각 추정치의 판단을 따로 보면 개별적으로는 합리적인 범위에 들어간다는 자료가 있다. 개별 추정치가 해당 재무보고체계의 요구사항을 위반하였다는 증거나 경영진에게 오도할 의도가 있었다고 볼 만한 증거는 현재까지 확인되지 않았다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact5',
        text: [
            '[자료 1] 추정불확실성의 정도를 평가하는 단계에서 감사팀이 수행하거나 결정한 절차와 판단은 다음과 같다.',
            '① 감사팀은 경영진이 사용한 방법·유의적 가정·데이터의 선택과 적용에 관련된 중요왜곡표시위험을 다루는 절차를 수행한 결과로 경영진의 도출방법에 대한 추가감사절차가 완료되었다고 보았다.',
            '② 감사팀은 경영진이 추정불확실성의 원천을 식별하고 측정결과의 내재변동성의 정도와 합리적으로 가능한 측정결과의 범위를 평가함으로써 추정불확실성을 이해하였는지 여부를 다루었다.',
            '③ 감사팀은 회계추정치 전부가 아니라 중요왜곡표시위험을 발생시키는 할인율 가정에 대해서만 감사인의 범위추정치를 도출하였다.',
            '④ 감사팀은 경영진의 점추정치가 감사팀이 도출한 범위의 최솟값과 최댓값 사이에 있다는 점을 확인하고 경영진의 점추정치가 합리적이라고 결론지었다.',
            '⑤ 감사팀은 도출한 범위의 폭이 재무제표 전체에 대한 중요성의 여러 배라는 사정만으로 그 범위를 부적합하다고 보지 않고, 수행한 절차와 입수한 감사증거에 근거하여 그 범위가 상황에 적합하다고 결론지었다.',
            '⑥ 감사팀은 추정불확실성을 기술하는 주석 초안의 문구가 전기와 같다는 점을 확인하고 그 확인으로 해당 공시에 대한 절차를 갈음하였다.',
        ].join('\n'),
        scoreable: false,
    },
    {
        id: 'fact6',
        text: [
            '[자료 2] 전기 회계추정의 확정치를 재검토하는 단계에서 감사팀이 수행하거나 계획한 절차와 판단은 다음과 같다.',
            '⑦ 감사팀은 A형 장비의 전기 보증추정치에 대한 검토를 잔여 보증기간이 끝나 최종 수리비용이 확정되는 보고기간의 감사에서 수행하기로 하였다.',
            '⑧ 감사팀은 위험평가절차로서 수행하는 전기 회계추정치의 검토를 감사기준서 240이 요구하는 경영진의 판단과 가정에 대한 소급적 검토와 함께 수행하기로 하였다.',
            '⑨ 감사팀은 B형 장비의 실제 수리비용이 전기 추정액을 초과한 금액을 확인하고 그 초과액을 전기 재무제표의 왜곡표시로 식별하였다.',
            '⑩ 감사팀은 일상적이고 반복적인 거래의 기록에서 발생하는 대손충당금에 대하여는 위험평가절차로서 분석적절차를 수행하는 것이 검토 목적에 충분하다고 판단하였다.',
        ].join('\n'),
        scoreable: false,
    },
    {
        id: 'fact7',
        text: [
            '[자료 3] 경영진 편의의 징후를 평가하는 단계에서 감사팀 안에서 제시된 처리방안은 다음과 같다.',
            '⑪ 세 회계추정치를 도출할 때 경영진이 내린 판단과 결정이 개별적으로는 합리적인 범위에 있다는 자료를 확인하였으므로 그 자료에 근거하여 경영진의 판단과 결정에 대한 검토를 마친다.',
            '⑫ 세 보고기간에 걸쳐 확인한 점추정치 선택의 양상을 근거로 보증충당부채·대손충당금·비상장회사 주식의 인식금액을 모두 왜곡표시로 결정한다.',
            '⑬ 비상장회사 주식의 유의적 가정을 선택할 때 이루어진 판단이 경영진의 편의가능성에 대한 징후를 발생시키는지 여부를 경영진의 도출방법을 테스트하는 추가감사절차에서 다룬다.',
            '⑭ 범위추정치를 도출할 때 사용한 감사인 자체의 가정을 근거로, 회계추정치 도출에 사용된 유의적 가정을 선택할 때의 경영진의 판단이 편의가능성에 대한 징후를 나타내는지에 대한 견해를 갖춘다.',
        ].join('\n'),
        scoreable: false,
    },
];

// ── 3. 사례형 물음 ───────────────────────────────────────────────────────────
const PROMPT = (범위) =>
    `${범위} 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.`;

const criterion = (id, requirementId, claim, type, refs) => ({
    id,
    requirement_id: requirementId,
    claim,
    critical_facts: [{ id: `${id}.fact`, type, expected: claim }],
    max_points: 1,
    scores: { met: 1, not_met: 0, contradicted: 0 },
    source_ref_ids: refs,
});

const SUB1_IDENTIFY =
    '옳지 않은 것으로 ①·④·⑥을 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ①·④·⑥ 중 하나라도 빠뜨리거나, 옳은 것인 ②(경영진이 추정불확실성의 원천을 식별하고 측정결과의 내재변동성의 정도와 합리적으로 가능한 측정결과의 범위를 평가함으로써 추정불확실성을 이해하였는지 여부를 다룸), ③(회계추정치의 일부인 할인율 가정에 대해서만 감사인의 범위추정치를 도출), ⑤(범위의 폭이 재무제표 전체에 대한 중요성의 배수라는 사정만으로 부적합하다고 보지 않고 수행한 절차와 입수한 감사증거에 근거하여 상황에 적합한지 결론) 가운데 하나라도 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB1_C2 =
    '① 경영진의 도출방법을 테스트할 때 감사인의 추가감사절차는 경영진이 점추정치를 선택하고 회계추정치에 대한 관련 공시를 개발한 방법과 관련된 중요왜곡표시위험도 다루어야 한다는 이유, 또는 그 방법을 테스트한다는 절차 중 하나를 제시한다. 점추정치를 선택한 방법과 관련 공시를 개발한 방법 가운데 하나만 들어도 인정한다. 방법·유의적 가정·데이터의 선택과 적용만 다루면 도출방법에 대한 추가감사절차가 충분하다고 쓰면 인정하지 않는다.';

const SUB1_C3 =
    '④ 감사인이 범위추정치를 도출하는 경우 그 범위가 충분하고 적합한 감사증거에 의하여 뒷받침되며 해당 재무보고체계의 측정목적과 기타 요구사항의 관점에서 합리적이라고 감사인에 의해 평가된 금액만 포함하는지를 결정하여야 한다는 이유, 또는 그 결정을 수행한다는 절차 중 하나를 제시한다. 증거에 의한 뒷받침과 합리적이라고 평가된 금액만 포함 가운데 하나만 들어도 인정한다. 경영진의 점추정치가 범위 안에 있다는 사실만으로 그 점추정치의 합리성이 확인된다고 쓰면 인정하지 않는다.';

const SUB1_C4 =
    '⑥ 추정불확실성을 기술하는 재무제표의 공시에 대한 평가된 중요왜곡표시위험과 관련된 충분하고 적합한 감사증거를 입수하기 위해 추가감사절차를 설계하고 수행하여야 한다는 이유, 또는 그 추가감사절차를 수행한다는 절차 중 하나를 제시한다. 주석 문구가 전기와 같다는 확인만으로는 그 공시에 대한 감사증거가 되지 않는다는 취지면 인정하고 설계와 수행을 모두 쓰지 않아도 된다. 문구가 전기와 같으므로 그 공시에 대한 추가 절차가 필요하지 않다고 쓰면 인정하지 않는다.';

const SUB2_IDENTIFY =
    '옳지 않은 것으로 ⑦과 ⑨를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑦·⑨ 중 하나라도 빠뜨리거나, 옳은 것인 ⑧(위험평가절차로서 수행하는 전기 회계추정치의 검토를 감사기준서 240이 요구하는 검토와 함께 수행), ⑩(일상적이고 반복적인 거래의 기록에서 발생하는 대손충당금에 대하여 위험평가절차로서 분석적절차를 수행하는 것으로 검토 목적에 충분하다고 판단) 가운데 하나라도 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB2_C2 =
    '⑦ 감사인은 당기의 중요왜곡표시위험을 식별하고 평가하는 데 도움을 주기 위하여 이전 회계추정치의 결과, 또는 해당되는 경우 후속적인 재추정을 검토하여야 한다는 이유, 또는 전기 산정표와 당기에 수행된 잔여 의무의 재추정 자료를 당기 감사에서 검토한다는 절차 중 하나를 제시한다. 최종 결과가 확정되지 않아도 후속적인 재추정을 검토 대상으로 삼을 수 있다는 취지면 인정한다. 최종 수리비용이 확정되는 보고기간까지 검토를 미루어도 된다고 쓰면 인정하지 않는다.';

const SUB2_C3 =
    '⑨ 회계추정치의 결과와 전기재무제표에 인식된 금액과의 차이가 반드시 전기재무제표의 왜곡표시를 나타내는 것은 아니라는 이유, 또는 그 차이가 전기재무제표를 확정한 뒤에 발생한 부품 공급 중단과 단가 상승에서 생겼고 전기 산정 당시의 자료가 산정표에 반영되어 있었음을 확인하여 왜곡표시로 식별하지 않는다는 절차 중 하나를 제시한다. 전기재무제표를 확정할 때 이용가능하였거나 합리적으로 입수·반영할 것으로 기대할 수 있었던 정보에서 발생한 차이가 아니라는 취지면 인정한다. 실제 결과가 전기 추정액보다 크다는 사실만으로 전기재무제표에 왜곡표시가 있다고 쓰면 인정하지 않는다.';

const SUB3_IDENTIFY =
    '옳지 않은 것으로 ⑪과 ⑫를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑪·⑫ 중 하나라도 빠뜨리거나, 옳은 것인 ⑬(유의적 가정을 선택할 때 이루어진 판단이 경영진의 편의가능성에 대한 징후를 발생시키는지 여부를 경영진의 도출방법을 테스트하는 추가감사절차에서 다룸), ⑭(범위추정치 도출에 사용한 감사인 자체의 가정을 근거로 경영진의 유의적 가정 선택 판단이 편의가능성에 대한 징후를 나타내는지에 대한 견해를 갖춤) 가운데 하나라도 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB3_C2 =
    '⑪ 감사인은 경영진이 재무제표에 포함된 회계추정치를 도출할 때 내린 판단과 결정이 개별적으로는 합리적일지라도 경영진의 편의가능성을 나타내는 징후인지를 평가하여야 한다는 이유, 또는 세 보고기간에 걸친 선택의 양상이 편의가능성의 징후인지 평가한다는 절차 중 하나를 제시한다. 편의는 계정 수준에서 적발하기 어렵고 회계추정치의 집합이나 다수의 회계기간에 걸쳐 관찰할 때 식별할 수 있다는 설명도 인정한다. 개별 판단이 합리적인 범위에 있으므로 검토를 마쳐도 된다고 쓰면 인정하지 않는다.';

const SUB3_C3 =
    '⑫ 경영진의 편의가능성 징후 자체는 개별 회계추정치의 합리성에 대한 결론을 도출하기 위한 목적상 왜곡표시에 해당되지 않는다는 이유, 또는 개별 금액이 왜곡되었다는 감사증거를 입수하기 전에는 왜곡표시로 결정하지 않고 식별된 징후가 감사에 미치는 시사점을 평가한다는 절차 중 하나를 제시한다. 선택의 양상이 경영진주장 수준이나 재무제표 수준의 중요왜곡표시위험을 나타낼 수 있다는 설명을 덧붙여도 인정한다. 선택의 양상만으로 세 회계추정치의 인식금액이 모두 왜곡표시라고 쓰면 인정하지 않는다.';

const sub1 = {
    id: 'sub1',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['11'],
    prompt: PROMPT('추정불확실성의 정도를 평가하는 단계에서 감사팀이 수행하거나 결정한 절차와 판단 ①~⑥'),
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ①, ④, ⑥이다. ②는 감사인의 추가감사절차가 경영진이 추정불확실성에 대하여 이해하는 적합한 조치를 취하였는지 여부를 다루어야 하므로 옳다. ③은 감사인이 회계추정치의 일부, 예를 들어 특정 가정에 대해서만 범위추정치를 도출할 수도 있으므로 옳다. ⑤는 감사인의 범위추정치의 규모가 재무제표 전체에 대한 중요성의 배수일 수 있고 감사인은 수행한 절차와 입수한 감사증거에 근거하여 그러한 범위가 상황에 적합하다고 결론지을 수 있으므로 옳다.',
        '① 경영진의 도출방법을 테스트할 때 감사인의 추가감사절차는 경영진이 점추정치를 선택하고 회계추정치에 대한 관련 공시를 개발한 방법과 관련된 중요왜곡표시위험도 다루어야 한다. 감사팀은 그 방법도 테스트하여야 한다.',
        '④ 감사인이 범위추정치를 도출하는 경우에는 그 범위가 충분하고 적합한 감사증거에 의하여 뒷받침되며 해당 재무보고체계의 측정목적과 기타 요구사항의 관점에서 합리적이라고 평가된 금액만 포함하는지를 결정하여야 한다.',
        '⑥ 추정불확실성을 기술하는 재무제표의 공시에 대한 평가된 중요왜곡표시위험과 관련된 충분하고 적합한 감사증거를 입수하기 위하여 추가감사절차를 설계하고 수행하여야 한다. 주석의 문구가 전기와 같다는 확인은 그 공시에 대한 감사증거가 되지 않는다.',
    ],
    requirements: [
        {
            id: 'sub1.req1',
            source_ref_id: 'kga540-22',
            source_quote: quoteOf('kga540-22'),
            source_span:
                'KGA 540 문단 22·26·29·A109·A122·A125; 식별 기준: ①은 문단 22(b), ④는 문단 29(a), ⑥은 문단 29(b)에 어긋나 옳지 않다. ②는 문단 26(a)와 A109(a), ③은 A122, ⑤는 A125에 따라 옳다.',
        },
        {
            id: 'sub1.req2',
            source_ref_id: 'kga540-22',
            source_quote: partOf('kga540-22', '(b) 경영진이 점추정치를 선택하고', '관련 공시를 개발한 방법'),
            source_span: 'KGA 540 문단 22(b); ①의 판단 근거',
        },
        {
            id: 'sub1.req3',
            source_ref_id: 'kga540-29',
            source_quote: partOf('kga540-29', '(a) 충분하고 적합한 감사증거에 의하여', '결정한다.'),
            source_span: 'KGA 540 문단 29(a); ④의 판단 근거',
        },
        {
            id: 'sub1.req4',
            source_ref_id: 'kga540-29',
            source_quote: partOf('kga540-29', '(b) 추정불확실성을 기술하는', '설계하고 수행한다.'),
            source_span: 'KGA 540 문단 29(b); ⑥의 판단 근거',
        },
    ],
    criteria: [
        criterion('crit1', 'sub1.req1', SUB1_IDENTIFY, 'conclusion', ['kga540-22', 'kga540-26', 'kga540-29', 'kga540-A109', 'kga540-A122', 'kga540-A125']),
        criterion('crit2', 'sub1.req2', SUB1_C2, 'action', ['kga540-22']),
        criterion('crit3', 'sub1.req3', SUB1_C3, 'action', ['kga540-29']),
        criterion('crit4', 'sub1.req4', SUB1_C4, 'action', ['kga540-29']),
    ],
};

const sub2 = {
    id: 'sub2',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['11'],
    prompt: PROMPT('전기 회계추정의 확정치를 재검토하는 단계에서 감사팀이 수행하거나 계획한 절차와 판단 ⑦~⑩'),
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑦과 ⑨이다. ⑧은 위험평가절차로서 수행하는 전기 회계추정치의 검토를 감사기준서 240이 요구하는 검토와 함께 수행할 수 있으므로 옳다. ⑩은 일상적이고 반복적인 거래의 기록에서 발생하는 회계추정치에 대하여 위험평가절차로서 분석적절차를 수행하는 것이 검토목적으로 충분하다고 판단할 수 있으므로 옳다.',
        '⑦ 감사인은 당기의 중요왜곡표시위험을 식별하고 평가하는 데 도움을 주기 위하여 이전 회계추정치의 결과, 또는 해당되는 경우 후속적인 재추정을 검토하여야 한다. 최종 수리비용이 확정되지 않았더라도 전기 산정표와 당기에 수행된 잔여 의무의 재추정 자료를 당기 감사에서 검토하여야 한다.',
        '⑨ 회계추정치의 결과와 전기재무제표에 인식된 금액과의 차이가 반드시 전기재무제표의 왜곡표시를 나타내는 것은 아니다. 그 차이는 전기재무제표를 확정한 뒤에 발생한 부품 공급 중단과 단가 상승에서 생겼고 전기 산정 당시의 고장률·단가 자료는 산정표에 반영되어 있었으므로 초과액을 전기재무제표의 왜곡표시로 식별할 수 없다.',
    ],
    requirements: [
        {
            id: 'sub2.req1',
            source_ref_id: 'kga540-14',
            source_quote: quoteOf('kga540-14'),
            source_span:
                'KGA 540 문단 14·A55·A57·A58·A60; 식별 기준: ⑦은 문단 14 전단, ⑨는 문단 14 후단과 A60에 어긋나 옳지 않다. ⑧은 A57, ⑩은 A58 후단에 따라 옳다.',
        },
        {
            id: 'sub2.req2',
            source_ref_id: 'kga540-14',
            source_quote: partOf('kga540-14', '감사인은 당기의 중요왜곡표시위험을', '검토하여야 한다.'),
            source_span: 'KGA 540 문단 14 전단; ⑦의 판단 근거',
        },
        {
            id: 'sub2.req3',
            source_ref_id: 'kga540-A60',
            source_quote: partOf('kga540-A60', 'A60. 회계추정치의 결과와', '그 차이가 왜곡표시일 수 있다.'),
            source_span: 'KGA 540 문단 A60 전단; ⑨의 판단 근거',
        },
    ],
    criteria: [
        criterion('crit5', 'sub2.req1', SUB2_IDENTIFY, 'conclusion', ['kga540-14', 'kga540-A55', 'kga540-A57', 'kga540-A58', 'kga540-A60']),
        criterion('crit6', 'sub2.req2', SUB2_C2, 'action', ['kga540-14', 'kga540-A55']),
        criterion('crit7', 'sub2.req3', SUB2_C3, 'action', ['kga540-A60', 'kga540-14']),
    ],
};

const sub3 = {
    id: 'sub3',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['11'],
    prompt: PROMPT('경영진 편의의 징후를 평가하는 단계에서 감사팀 안에서 제시된 처리방안 ⑪~⑭'),
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub3.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑪과 ⑫이다. ⑬은 유의적 가정과 관련하여 감사인의 추가감사절차가 유의적 가정을 선택할 때 이루어진 판단이 경영진의 편의가능성에 대한 징후를 발생시키는지 여부를 다루어야 하므로 옳다. ⑭는 감사인이 범위추정치 도출에 자체의 가정을 사용하는 경우 유의적 가정을 선택할 때의 경영진의 판단이 편의가능성에 대한 징후를 나타내는지에 대한 견해를 갖출 수도 있으므로 옳다.',
        '⑪ 감사인은 경영진이 재무제표에 포함된 회계추정치를 도출할 때 내린 판단과 결정이 개별적으로는 합리적일지라도 경영진의 편의가능성을 나타내는 징후인지를 평가하여야 한다. 편의는 계정 수준에서 적발하기 어렵고 회계추정치의 집합이나 다수의 회계기간에 걸쳐 관찰할 때 식별할 수 있으므로 세 기간에 걸친 선택의 양상을 평가하여야 한다.',
        '⑫ 경영진의 편의가능성 징후 자체는 개별 회계추정치의 합리성에 대한 결론을 도출하기 위한 목적상 왜곡표시에 해당되지 않는다. 개별 금액이 왜곡되었다는 감사증거가 없는 단계에서 인식금액을 왜곡표시로 결정할 수 없고, 식별된 징후가 감사에 미치는 시사점을 평가하여야 한다.',
    ],
    requirements: [
        {
            id: 'sub3.req1',
            source_ref_id: 'kga540-32',
            source_quote: quoteOf('kga540-32'),
            source_span:
                'KGA 540 문단 32·A133·A134·24(b)·A123; 식별 기준: ⑪은 문단 32 전단과 A133, ⑫는 A134 후단에 어긋나 옳지 않다. ⑬은 문단 24(b), ⑭는 A123에 따라 옳다.',
        },
        {
            id: 'sub3.req2',
            source_ref_id: 'kga540-32',
            source_quote: partOf('kga540-32', '감사인은 경영진이 재무제표에 포함된 회계추정치를', '징후인지를 평가하여야 한다.'),
            source_span: 'KGA 540 문단 32 전단; ⑪의 판단 근거',
        },
        {
            id: 'sub3.req3',
            source_ref_id: 'kga540-A134',
            source_quote: partOf('kga540-A134', '경영진의 편의가능성 징후 자체가', '왜곡표시에 해당되지는 않는다.'),
            source_span: 'KGA 540 문단 A134 후단; ⑫의 판단 근거',
        },
    ],
    criteria: [
        criterion('crit8', 'sub3.req1', SUB3_IDENTIFY, 'conclusion', ['kga540-32', 'kga540-A133', 'kga540-A134', 'kga540-24', 'kga540-A123']),
        criterion('crit9', 'sub3.req2', SUB3_C2, 'action', ['kga540-32', 'kga540-A133']),
        criterion('crit10', 'sub3.req3', SUB3_C3, 'action', ['kga540-A134', 'kga540-32']),
    ],
};

const caseSet = {
    schema_version: '3.0',
    id: 'case-11-accounting-estimate-20260921',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '회계추정치의 추정불확실성, 전기 추정의 재검토와 편의 징후',
    classification: {
        topic_id: '11',
        part: 'PART3',
        chapter: '회계추정과 특수관계자',
        domain: 'audit',
        standards: ['KGA 540'],
        tags: ['회계추정치', '추정불확실성', '소급적 검토', '경영진 편의', '사례형'],
    },
    source_refs: caseSourceRefs,
    shared_context: { facts },
    learning_order: ['sub1', 'sub2', 'sub3'],
    subquestions: [sub1, sub2, sub3],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-21 사용자 지시("문제 제작 및 수정작업 B도 진행해")와 docs/사례형-병합-종합문제-설계.md의 B등급 "회계추정" 묶음에 따라 17번(pilot-11-005, 회계추정치 도출방법과 추정불확실성에 대한 감사)과 54번(case-11-estimate-lookback-20260914, 장기 보증추정의 소급검토와 경영진 편의)을 한 회사의 이어지는 단계로 합친 병합 초안이다. 두 원 세트는 대체 후 퇴역 대상이며, 17번의 기준서형 물음 sub2만 pilot-11-005-standards-20260921로 분리 보존한다. 원 세트와의 대응은 같은 폴더의 lineage.json에 기록한다.',
            '형식은 학습 단위 계약의 기본인 옳지 않은 것 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 수행하였어야 할 절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 옳은 항목 ②·③·⑤·⑧·⑩·⑬·⑭에는 별도 득점 기준이 없다. 물음 1은 4점, 물음 2는 3점, 물음 3은 3점으로 합계 10점이다. 옳지 않은 항목의 수는 물음마다 3개·2개·2개이며 발문에 밝히지 않는다.',
            '대조되는 두 경우 금지에 따라 KGA 540 문단 A60의 두 경우 가운데 전기재무제표 확정 후에 발생한 사정에서 비롯된 차이(왜곡표시로 단정할 수 없는 쪽)만 남기고, 확정 당시 이용가능했던 정보에서 비롯된 차이는 항목으로 두지 않았다. A58의 고유위험이 높은 경우의 세부 소급적 검토도 항목으로 두지 않고 일상적·반복적 기록에서 발생하는 회계추정치 쪽만 함정으로 두었다. 17번의 기준서형 요구(문단 27)는 삭제하지 않고 별도 기준서형 세트로 분리 보존했다.',
            '사용자가 확정한 대상 연도는 2027년이다. 사례의 20X2년은 2026년 1월 1일 이후 개시하는 보고기간으로 보고, KGA 540의 2025 개정 전문(문단 10: 2026년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 시행)을 적용 판본으로 삼았다. 인용 열여섯 개 가운데 열네 개는 두 원 세트의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 문단 A57(L54-L56)·A58(L62-L72)만 이미 등록된 전문 cpa_uploader/data/official/case-followup-2026-09-14-kga540.md에서 새로 발췌했다. 새 원자료 수집은 없다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 4. 분리 보존하는 기준서형 세트 ───────────────────────────────────────────
const reusedStandards = [
    ['kga540-27', PILOT, 'std-540-27', 'KGA 540 문단 27, 2025 개정 전문 원문 페이지 454; L180-L198'],
    ['kga540-A115', PILOT, 'std-540-A115', 'KGA 540 문단 A115, 2025 개정 전문 원문 페이지 491; L362-L370'],
    ['kga540-A116', PILOT, 'std-540-A116', 'KGA 540 문단 A116, 2025 개정 전문 원문 페이지 491; L372-L381'],
    ['kga540-A117', PILOT, 'std-540-A117', 'KGA 540 문단 A117, 2025 개정 전문 원문 페이지 491; L383-L392'],
];

const standardsSourceRefs = reusedStandards.map(([id, setId, refId, title]) => {
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

const standardsRefById = new Map(standardsSourceRefs.map((ref) => [ref.id, ref]));
function standardsPart(id, from, to) {
    return slicePart(id, standardsRefById.get(id).source_quote, from, to);
}

const STD_27A = standardsPart('kga540-27', '(a) 경영진에게 추정불확실성을', '문단 26에 따라 평가한다.');
const STD_27B = standardsPart('kga540-27', '(b) 감사인이 감사인의 요구에', '범위추정치를 도출한다.');
const STD_27C = standardsPart('kga540-27', '(c) 내부통제의 미비점이', '커뮤니케이션한다.');

const standardsCriteria = [
    {
        id: 'crit1',
        requirement_id: 'req1',
        claim: '경영진에게 추정불확실성을 이해하거나 점추정치 선택을 재고하거나 추가 공시를 제공하는 등 추정불확실성을 다루기 위한 추가 절차를 수행하도록 요구한다.',
        scope: '27(a)의 대안적 대응을 모두 동시에 수행할 의무로 바꾸지 않는다. 상황에 맞는 추가 대응을 경영진에게 요구한다는 명제이다.',
        quote: STD_27A,
        refs: ['kga540-27', 'kga540-A115'],
    },
    {
        id: 'crit2',
        requirement_id: 'req2',
        claim: '경영진의 대응이 추정불확실성을 적절하게 이해하고 다루는지 문단 26에 따라 평가한다.',
        scope: null,
        quote: STD_27A,
        refs: ['kga540-27'],
    },
    {
        id: 'crit3',
        requirement_id: 'req3',
        claim: '감사인의 요구에 대한 경영진의 대응이 추정불확실성을 충분히 다루지 못한다고 결정하면 실행가능한 정도까지 감사인의 점추정치 또는 범위추정치를 도출한다.',
        scope: '경영진 대응 부족이라는 조건과 실행가능한 정도라는 한계를 보존한다. 점추정치·범위추정치는 한 접근방법 안의 대안으로 둘 다 도출하도록 요구하지 않는다.',
        quote: STD_27B,
        refs: ['kga540-27', 'kga540-A116', 'kga540-A117'],
    },
    {
        id: 'crit4',
        requirement_id: 'req4',
        claim: '내부통제의 미비점이 존재하는지 평가한다.',
        scope: null,
        quote: STD_27C,
        refs: ['kga540-27'],
    },
    {
        id: 'crit5',
        requirement_id: 'req5',
        claim: '내부통제 미비점이 존재하는 경우에는 감사기준서 265에 따라 커뮤니케이션한다.',
        scope: '모든 미비점을 같은 상대방에게 동일 방식으로 알린다는 요건을 만들지 않는다. 265에 따른 조건부 커뮤니케이션을 요구하며 상대방·시기·서면 요건의 상세 열거는 별도 배점하지 않는다.',
        quote: STD_27C,
        refs: ['kga540-27'],
    },
];

const standardsSet = {
    schema_version: '3.0',
    id: 'pilot-11-005-standards-20260921',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '추정불확실성에 대한 경영진의 조치가 적합하지 않은 경우',
    classification: {
        topic_id: '11',
        part: 'PART3',
        chapter: '회계추정과 특수관계자',
        domain: 'audit',
        standards: ['KGA 540'],
        tags: ['회계추정치', '추정불확실성', '기준서형'],
    },
    source_refs: standardsSourceRefs,
    shared_context: { facts: [] },
    learning_order: ['sub2'],
    subquestions: [
        {
            id: 'sub2',
            type: 'descriptive',
            question_style: 'standard',
            topic_ids: ['11'],
            prompt: '감사기준서 540 문단 27은 입수된 감사증거에 기초하여 감사인이 판단하기에 경영진이 추정불확실성을 이해하고 다루기 위한 적합한 조치를 취하지 않는 경우에 적용된다. 그 경우에 감사인이 수행하여야 하는 사항을 문단 27의 (a), (b), (c)에 따라 모두 설명하시오.',
            constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
            selection: { type: 'all', n: null },
            decision: null,
            answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
            model_answer: standardsCriteria.map((row) => row.claim),
            requirements: standardsCriteria.map((row) => ({
                id: row.requirement_id,
                source_ref_id: 'kga540-27',
                source_quote: row.quote,
                source_span: `KGA 540 문단 27 원문 페이지 454; L180-L198; ${row.id}의 근거`,
            })),
            criteria: standardsCriteria.map((row) => ({
                id: row.id,
                requirement_id: row.requirement_id,
                claim: row.claim,
                critical_facts: [
                    { id: `${row.id}.fact`, type: 'action', expected: row.claim },
                    ...(row.scope ? [{ id: `${row.id}.scope`, type: 'condition', expected: row.scope }] : []),
                ],
                max_points: 1,
                scores: { met: 1, not_met: 0, contradicted: 0 },
                source_ref_ids: row.refs,
            })),
        },
    ],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-21 사용자 확정 정책에 따라 17번(pilot-11-005)에 섞여 있던 기준서형 물음 sub2를 퇴역시키지 않고 독립 기준서형 세트로 분리 보존한 초안이다(2026-09-20 r17의 pilot-07-006-standards-20260920 선례). 사례형 병합본은 case-11-accounting-estimate-20260921이며, 이 세트는 퇴역 없이 추가만 한다.',
            '물음 ID(sub2), 다섯 개의 정답 명제, 정수 배점(각 1점, 합계 5점), 모범답안, 인용(KGA 540 문단 27)을 원 세트에서 승계했다. criterion ID는 채점 모델이 물음 접두사를 붙인 ID를 되돌려 주지 않도록 sub2.crit1~sub2.crit5에서 crit1~crit5로 다시 매겼고, requirement ID도 sub2.req1~sub2.req5에서 req1~req5로 바꾸었다. 대응표는 lineage.json의 standards_split에 있다.',
            '원 발문은 사례의 사실처럼 단정하는 문장으로 시작하고 "적용 조건과 함께"라는 요구로 답안에 조건 서술이 필요하다는 점을 알려 주어 crit3·crit5의 득점 요건을 미리 드러냈다. 기준서형 발문의 정답 암시 금지에 따라 문단 27의 적용 조건을 기준서의 서술로 바꾸고 범위는 문단·항 기호((a), (b), (c))로만 정했다. 정답 항목의 핵심어·결론·개수는 발문에 쓰지 않았다.',
            '적용 판본은 KGA 540의 2025 개정 전문이다(문단 10: 2026년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 시행). 대상 시험 연도는 2027년이다. 인용 네 개(문단 27·A115·A116·A117)는 pilot-11-005의 정본 인용을 바이트와 content_hash 그대로 재사용했고 새 원자료 수집은 없다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 5. 출력 ──────────────────────────────────────────────────────────────────
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
fs.writeFileSync(path.join(here, 'sets.json'), serialize([caseSet]));
fs.writeFileSync(path.join(here, 'standards-sets.json'), serialize([standardsSet]));

const factChars = facts.map((fact) => fact.text).join('\n').length;
const points = (set) => set.subquestions.reduce((sum, q) => sum + q.criteria.reduce((n, c) => n + c.max_points, 0), 0);
console.log(JSON.stringify({
    case: { id: caseSet.id, subquestions: caseSet.subquestions.length, criteria: caseSet.subquestions.reduce((n, q) => n + q.criteria.length, 0), points: points(caseSet), source_refs: caseSourceRefs.length, fact_chars: factChars },
    standards: { id: standardsSet.id, subquestions: 1, criteria: standardsCriteria.length, points: points(standardsSet), source_refs: standardsSourceRefs.length },
}, null, 2));
