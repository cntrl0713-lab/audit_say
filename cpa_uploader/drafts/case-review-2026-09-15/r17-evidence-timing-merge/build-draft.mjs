// r17: 15번(pilot-07-006) · 50번(case-07-interim-misstatement-20260914) · 16번(pilot-07-007)의 병합 초안 생성기.
//
//   node cpa_uploader/drafts/case-review-2026-09-15/r17-evidence-timing-merge/build-draft.mjs
//
// 출력은 두 개다.
//   sets.json           사례형 병합본 case-07-evidence-timing-20260920 (3물음 10점)
//   standards-sets.json 15번에 섞여 있던 기준서형 물음 1개를 분리 보존한 pilot-07-006-standards-20260920 (1물음 3점)
//
// 인용은 (1) 세 원 세트가 이미 담고 있는 KGA 330 인용을 바이트와 content_hash 그대로 재사용하고,
// (2) 새로 필요한 문단만 이미 등록된 공식 전문에서 줄 범위로 발췌한다. 해시는 인용 문자열의 SHA-256이다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');

const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const OFFICIAL_N03 = 'cpa_uploader/data/official/delegated-n03-kga330-2025.txt';
const OFFICIAL_S02 = 'cpa_uploader/data/official/delegated-s02-kga330-2025.txt';
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

function reusedRef(id, setId, refId, title) {
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
}

function cutRef(id, file, from, to, title, page) {
    const quote = extract(file, from, to);
    return {
        id,
        file,
        title,
        page,
        source_quote: quote,
        role: 'standard',
        content_hash: hash(quote),
        source_span: `${title}; 등록 전문 ${file} L${from}-L${to}`,
    };
}

// ── 1. 사례형 세트의 출처 ────────────────────────────────────────────────────
const caseSourceRefs = [
    // 15번 pilot-07-006 (KGA 330 요구사항·적용자료)
    reusedRef('kga330-11', 'pilot-07-006', 'src-d1b1ab43a41d508aef', 'KGA 330 문단 11, 2025 개정 전문 원문 페이지 315; L110-L114'),
    reusedRef('kga330-12', 'pilot-07-006', 'src-a0951edde81b677113', 'KGA 330 문단 12, 2025 개정 전문 원문 페이지 315; L115-L122'),
    reusedRef('kga330-15', 'pilot-07-006', 'src-3839a593a5ba230eb2', 'KGA 330 문단 15, 2025 개정 전문 원문 페이지 316; L169-L172'),
    reusedRef('kga330-A33', 'pilot-07-006', 'src-0bcf958ea1cee0dbb4', 'KGA 330 문단 A33, 2025 개정 전문 원문 페이지 326; L275-L280'),
    reusedRef('kga330-A34', 'pilot-07-006', 'src-15d06b1c85e6eb9944', 'KGA 330 문단 A34, 2025 개정 전문 원문 페이지 326; L281-L302'),
    // 16번 pilot-07-007
    reusedRef('kga330-18', 'pilot-07-007', 'src-4f2edc5ba108c8cf05', 'KGA 330 문단 18, 2025 개정 전문 원문 페이지 316; L190-L192'),
    reusedRef('kga330-21', 'pilot-07-007', 'src-1b053681cc89b2584b', 'KGA 330 문단 21, 2025 개정 전문 원문 페이지 317; L215-L220'),
    reusedRef('kga330-A43', 'pilot-07-007', 'src-51e3bd09a5fea51de3', 'KGA 330 문단 A43, 2025 개정 전문 원문 페이지 328; L363-L383'),
    // 50번 case-07-interim-misstatement-20260914
    reusedRef('kga330-22', 'case-07-interim-misstatement-20260914', 'src-2baf3ec238b61cb2b9', 'KGA 330 문단 22, 2025 개정 전문 등록자료 L148-L152'),
    reusedRef('kga330-23', 'case-07-interim-misstatement-20260914', 'src-999926d9fcadbd4726', 'KGA 330 문단 23, 2025 개정 전문 등록자료 L153-L156'),
    reusedRef('kga330-A11', 'case-07-interim-misstatement-20260914', 'src-08edce34488d5464f7', 'KGA 330 문단 A11, 2025 개정 전문 등록자료 L186-L192'),
    // 새 발췌
    cutRef('kga330-9', OFFICIAL_N03, 83, 85, 'KGA 330 문단 9, 2025 개정 전문 원문 페이지 314; L83-L85', 'KGA 330'),
    cutRef('kga330-20', OFFICIAL_N03, 204, 213, 'KGA 330 문단 20, 2025 개정 전문 원문 페이지 317; L204-L213', 'KGA 330'),
    cutRef('kga330-24', OFFICIAL_N03, 234, 241, 'KGA 330 문단 24, 2025 개정 전문 원문 페이지 317; L234-L241', 'KGA 330'),
    cutRef('kga330-A44', OFFICIAL_N03, 384, 387, 'KGA 330 문단 A44, 2025 개정 전문 원문 페이지 329; L384-L387', 'KGA 330'),
    cutRef('kga330-A15', OFFICIAL_S02, 122, 128, 'KGA 330 문단 A15, 2025 개정 전문 원문 페이지 322; L122-L128', 'KGA 330'),
];

const caseRefById = new Map(caseSourceRefs.map((ref) => [ref.id, ref]));
function caseQuote(id) {
    const ref = caseRefById.get(id);
    if (!ref) throw new Error(`source_ref 없음: ${id}`);
    return ref.source_quote;
}

// ── 2. 사례형 세트의 사실관계 ────────────────────────────────────────────────
const facts = [
    {
        id: 'fact1',
        text: [
            '청람회계법인은 산업용 계측기를 제조하는 우진정밀의 20X1년 1월 1일부터 12월 31일까지의 재무제표를 감사하고 있으며, 감사보고서일은 20X2년 3월 중순으로 예정되어 있다. 청람회계법인은 전기에도 우진정밀을 감사하였다.',
            '우진정밀의 재무제표에서 매출 거래유형, 매출채권 잔액과 관련 주석공시, 재고자산 잔액은 각각 중요하다.',
            '감사팀은 계획 단계의 위험평가에서 매출채권 회수가능성에 관한 중요왜곡표시위험만을 유의적 위험으로 결정하였고, 그 위험에 대응하여 대손충당금 산정 검토 통제에 의존하기로 계획하였다. 감사팀은 매출 승인통제와 매출 마감 승인 통제에도 의존하기로 계획하였다.',
            '매출 승인통제는 20X1년 전체 기간에 걸쳐 매일 적용되고, 매출 마감 승인 통제는 보고기간말에 한 차례 적용된다. 대손충당금 산정 검토 통제는 전기 감사에서 테스트하였다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact2',
        text: [
            '감사팀은 20X1년 1월부터 9월까지의 기간을 대상으로 계획한 통제테스트를 20X1년 9월에 수행하였고, 매출 승인통제가 그 기간 동안 효과적으로 운영되었다는 감사증거를 입수하였다.',
            '우진정밀의 매출·회수·반품 거래는 20X1년 10월부터 12월까지도 계속 발생하며, 그 기간의 통제 운영과 개별 거래에 관한 기록은 감사팀이 요청하면 입수할 수 있다.',
        ].join(' '),
        scoreable: false,
    },
    {
        id: 'fact3',
        text: [
            '[자료 1] 20X1년 감사계획과 통제테스트에 관하여 감사팀이 수행하거나 결정한 절차와 판단은 다음과 같다.',
            '① 감사팀은 매출 승인통제의 효과성에 당초 계획보다 더 크게 의존하기로 하면서, 그에 맞추어 더욱 설득력이 있는 감사증거를 입수하도록 통제테스트의 범위를 정하였다.',
            '② 감사팀은 매출채권 회수가능성에 관한 유의적 위험에 대응하여 대손충당금 산정 검토 통제에 의존하기로 하고, 전기 감사 이후 그 통제에 유의적인 변화가 발생하였는지에 관한 감사증거를 관찰과 검사를 결합한 질문으로 입수한 뒤, 전기 감사에서 수행한 그 통제의 테스트 결과를 당기의 감사증거로 이용하기로 하였다.',
            '③ 감사팀은 보고기간말에 한 차례 적용되는 매출 마감 승인 통제에 대하여 보고기간말 그 시점을 대상으로 통제테스트를 수행하기로 하였다.',
            '④ 감사팀은 20X1년 1월부터 9월까지의 기간을 대상으로 입수한 매출 승인통제의 운영효과성에 관한 감사증거를 20X1년 전체 기간에 대하여 그 통제에 의존하는 근거로 삼기로 하였다.',
        ].join('\n'),
        scoreable: false,
    },
    {
        id: 'fact4',
        text: [
            '[자료 2] 감사팀은 20X1년 9월 30일 현재 매출채권 잔액에 대한 실증절차를 20X1년 10월에 수행하였다. 그 절차에서 20X1년 9월 30일 이전에 고객이 반품한 제품을 매출채권에서 차감한 기록 없이 그대로 남겨 둔 왜곡표시가 발견되었다. 이는 최초 위험평가에서 예상하지 않았던 왜곡표시였고, 경영진은 발견된 거래를 수정하였다. 같은 반품처리 방식이 다른 거래와 20X1년 10월 이후의 기간에도 적용되는지는 확인되어 있지 않다.',
            '20X1년 11월에 감사팀은 재무책임자가 12월 반품의 입력을 다음 해로 미루도록 지시한 내부 전자우편을 입수하였고, 이를 반영한 위험평가에서 연말 반품과 매출채권의 고의적 조작위험을 유의적 위험으로 결정하였다. 감사팀은 이 위험에 대응하는 접근방법을 관련 통제에 의존하지 않고 실증절차만으로 구성하기로 하였다.',
            '이와 관련하여 감사팀이 결정한 절차는 다음과 같다.',
            '⑤ 감사팀은 20X1년 10월에 수행한 실증절차에서 20X1년 9월 30일 현재 매출채권 잔액에 관하여 얻은 결론을 20X1년 12월 31일 현재 매출채권 잔액에 대한 결론으로 삼기로 하였다.',
            '⑥ 감사팀은 20X1년 10월의 실증절차에서 검사할 매출채권 항목을 선정하면서 중요성, 위험평가 그리고 감사팀이 얻고자 하는 확신의 수준을 고려하여 그 범위를 정하였다.',
            '⑦ 감사팀은 20X1년 10월에 발견된 반품 관련 왜곡표시를 경영진이 수정한 것을 확인하고, 매출채권에 관한 위험평가와 잔여기간을 포괄하는 실증절차의 계획된 성격·시기 및 범위를 당초 계획대로 확정하였다.',
            '⑧ 감사팀은 연말 반품과 매출채권의 고의적 조작위험에 대응하는 실증절차를 20X1년 11월 15일까지 기록된 거래를 대상으로 수행하고, 그 이후의 기간에 대하여는 우진정밀이 20X2년 1월에 작성하는 반품·매출채권 총액 증감표를 입수하여 대조함으로써 결론을 보고기간말까지 확대하기로 하였다.',
            '⑨ 감사팀은 재무제표 결산절차와 관련된 실증절차로서 재무제표의 정보가 그 기초가 되는 회계기록과 일치하는지 확인하거나 차이를 조정하는 절차와, 재무제표를 작성하는 과정에서 행한 중요한 분개 및 기타 수정사항을 조사하는 절차를 수행하기로 하였다.',
        ].join('\n'),
        scoreable: false,
    },
    {
        id: 'fact5',
        text: [
            '[자료 3] 감사팀은 감사종결을 앞두고 실증절차의 성격과 범위를 정하고 있다. 감사팀이 감사종결 단계에서 수행하려는 재무제표 전반에 대한 총괄적 분석적 검토는 개별 경영진주장의 중요한 왜곡표시를 발견하기 위한 실증적 분석절차로 설계된 것이 아니다.',
            '이와 관련하여 감사팀이 결정한 절차와 판단은 다음과 같다.',
            '⑩ 감사팀은 매출 관련 통제가 효과적으로 운영된다는 감사증거를 입수하여 매출 거래유형, 매출채권 잔액과 관련 주석공시의 중요왜곡표시위험을 낮게 평가하였으므로, 이 항목들에 대한 실증절차는 감사종결 단계의 총괄적 분석적 검토로 갈음하기로 하였다.',
            '⑪ 감사팀은 중요한 재고자산 잔액에 대한 실증절차를 설계하면서, 모든 경영진주장을 테스트 대상으로 삼는 대신 왜곡표시가 발생하였다면 그 왜곡표시가 중요할 합리적인 가능성이 있는 경영진주장을 고려하여 절차의 성격·시기 및 범위를 정하였다.',
            '⑫ 감사팀은 연말 반품과 매출채권의 고의적 조작위험에 대응하는 실증절차를 20X1년의 월별 반품액과 매출채권 잔액을 전기 및 예산과 비교하는 실증적 분석절차로 구성하기로 하였다.',
            '⑬ 감사팀은 재무제표의 전반적인 표시가 해당 재무보고체계를 준수하였는지 여부를 평가하기 위한 감사절차를 수행하기로 하였다.',
        ].join('\n'),
        scoreable: false,
    },
];

// ── 3. 사례형 세트의 물음 ────────────────────────────────────────────────────
const PROMPT = (scope) =>
    `${scope} 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 수행하였어야 할 절차를 간략히 서술하시오.`;

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
    '옳지 않은 것으로 ②와 ④를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ②와 ④ 가운데 하나라도 빠뜨리거나, 옳은 것인 ①(통제의 효과성에 더 크게 의존하기로 하면서 더욱 설득력이 있는 감사증거를 입수하도록 통제테스트의 범위를 정함), ③(보고기간말에 한 차례 적용되는 매출 마감 승인 통제를 보고기간말 그 시점을 대상으로 테스트) 가운데 하나라도 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB1_C2 =
    '② 유의적이라고 결정한 위험에 대하여 그 통제에 의존하려고 계획한 경우에는 당기에 해당 통제를 테스트하여야 하므로 전기 감사의 통제테스트 결과만 이용할 수 없다는 이유, 또는 대손충당금 산정 검토 통제를 당기에 테스트한다는 절차 중 하나를 제시한다. 전기 감사 이후 유의적인 변화가 없음을 확인하였더라도 유의적 위험에 대응하여 의존하려는 통제이므로 당기 테스트가 요구된다는 취지면 인정한다. 전기 감사 이후 변화가 없으면 전기의 통제테스트 결과를 그대로 이용할 수 있다고 쓰면 인정하지 않는다.';

const SUB1_C3 =
    '④ 중간기간에 통제의 운영효과성에 대한 감사증거를 입수하였으므로 중간기간 이후 해당 통제에 유의적 변화가 있었는지에 대한 감사증거를 입수하여야 한다는 이유나 절차, 또는 잔여기간에 대하여 입수할 추가적인 감사증거를 결정하여야 한다는 이유나 절차 중 하나를 제시한다. 20X1년 1월부터 9월까지의 증거만으로는 20X1년 전체 기간에 대한 의존의 근거가 되지 못한다는 취지면 인정한다. 잔여기간에 대하여 추가로 고려할 사항이 없다고 쓰면 인정하지 않는다.';

const SUB2_IDENTIFY =
    '옳지 않은 것으로 ⑤, ⑦, ⑧을 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. 셋 가운데 하나라도 빠뜨리거나, 옳은 것인 ⑥(중요성·위험평가·얻고자 하는 확신의 수준을 고려하여 검사할 항목의 범위를 정함), ⑨(재무제표 결산절차와 관련된 실증절차로 회계기록과의 일치 확인·차이 조정과 중요한 분개 및 기타 수정사항의 조사를 수행) 가운데 하나라도 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB2_C2 =
    '⑤ 실증절차가 기중의 일자를 기준으로 수행되었으면 그 결론을 보고기간말까지 확대하기 위한 합리적인 근거를 제공하도록 잔여기간에 대한 절차를 수행하여야 한다는 이유, 또는 잔여기간에 대하여 통제테스트를 수반한 실증절차를 수행하거나 감사인이 충분하다고 결정한 경우 후속적인 실증절차를 수행한다는 절차 중 하나를 제시한다. 20X1년 10월부터 12월까지의 매출채권 증감 거래를 다루는 실증절차가 필요하다는 취지면 인정한다. 9월 말 잔액의 확인만으로 보고기간말 잔액에 대한 결론을 내릴 수 있다고 쓰면 인정하지 않는다.';

const SUB2_C3 =
    '⑦ 중요왜곡표시위험을 평가할 때 예상하지 않았던 왜곡표시가 기중에 발견되었으므로 관련된 위험평가와 잔여기간을 포괄하는 실증절차의 계획된 성격·시기 및 범위를 변경할 필요가 있는지 평가하여야 한다는 이유 또는 절차를 제시한다. 같은 반품처리 방식이 다른 거래와 잔여기간에도 적용되었는지에 따라 위험평가와 잔여기간 절차를 다시 정한다는 취지면 인정한다. 발견된 거래를 경영진이 수정하였으므로 당초 계획을 유지할 수 있다고 쓰면 인정하지 않는다.';

const SUB2_C4 =
    '⑧ 고의적인 왜곡표시위험 또는 조작위험이 식별되었을 때에는 감사결론을 기중의 일자에서 보고기간말까지 확대하는 감사절차가 효과적이지 않다는 이유, 또는 연말 반품과 매출채권에 대한 실증절차를 보고기간말이나 보고기간말에 근접한 시기에 수행하거나 불시에 또는 예측불가능한 시기에 수행한다는 절차 중 하나를 제시한다. 회사가 작성한 총액 증감표와의 대조만으로는 그 위험에 대응할 수 없다는 취지면 인정한다. 절차의 시기를 다루지 않고 표본규모나 검사 범위를 늘려야 한다고만 쓰면 인정하지 않는다.';

const SUB3_IDENTIFY =
    '옳지 않은 것으로 ⑩과 ⑫를 모두 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑩과 ⑫ 가운데 하나라도 빠뜨리거나, 옳은 것인 ⑪(중요한 재고자산 잔액의 실증절차를 설계하면서 왜곡표시가 중요할 합리적인 가능성이 있는 경영진주장을 고려하여 절차의 성격·시기 및 범위를 정함), ⑬(재무제표의 전반적인 표시가 해당 재무보고체계를 준수하였는지 여부를 평가하기 위한 감사절차를 수행) 가운데 하나라도 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const SUB3_C2 =
    '⑩ 평가된 중요왜곡표시위험과 관계없이 중요한 각 거래유형과 계정잔액 및 공시에 대하여는 실증절차를 설계하고 수행하여야 한다는 이유, 또는 매출 거래유형과 매출채권 잔액 및 관련 주석공시에 대한 실증절차를 설계하고 수행한다는 절차 중 하나를 제시한다. 감사인의 위험평가에는 판단이 수반되어 모든 중요왜곡표시위험이 식별되지 않을 수 있다는 점이나 경영진의 통제무력화 등 내부통제의 고유한계를 이유로 들어도 인정한다. 통제의 운영효과성에 관한 증거가 20X1년 9월까지의 기간에만 있다는 점만 지적하면 이 점수는 인정하지 않는다.';

const SUB3_C3 =
    '⑫ 유의적 위험에 대응하는 접근방법이 실증절차만으로 구성되어 있는 경우에는 반드시 세부테스트를 포함하여야 한다는 이유, 또는 그 위험에 대응하는 실증절차에 세부테스트를 포함한다는 절차 중 하나를 제시한다. 실증적 분석절차만으로는 그 유의적 위험에 구체적으로 대응할 수 없다는 취지면 인정한다. 유의적 위험이라는 조건과 무관하게 모든 실증절차에 세부테스트가 필요하다고만 쓰면 인정하지 않는다.';

const sub1 = {
    id: 'sub1',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['07'],
    prompt: PROMPT('통제테스트의 계획과 시기에 관한 ①~④'),
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub1.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ②와 ④이다. ①은 감사인이 통제의 효과성에 보다 크게 의존할수록 더욱 설득력이 있는 감사증거를 입수하여야 하므로 옳다. ③은 어떤 시점에만 해당되는 감사증거도 감사인의 목적에 충분할 수 있고, 보고기간말에 한 차례 적용되는 통제에 대하여는 그 시점을 대상으로 한 테스트가 의존하고자 하는 시기를 포괄하므로 옳다.',
        '② 감사인이 유의적이라고 결정한 위험에 대하여 그 통제에 의존하려고 계획한 경우에는 당기에 해당 통제를 테스트하여야 한다. 전기 감사 이후 유의적인 변화가 없음을 확인하였더라도 전기의 통제테스트 결과만으로 대신할 수 없으므로, 대손충당금 산정 검토 통제를 당기에 테스트하여야 한다.',
        '④ 중간기간에 통제의 운영효과성에 대한 감사증거를 입수하였으므로 중간기간 이후 해당 통제에 유의적 변화가 있었는지에 대한 감사증거를 입수하고, 잔여기간에 대하여 입수할 추가적인 감사증거를 결정하여야 한다. 20X1년 1월부터 9월까지 입수한 증거만으로는 20X1년 전체 기간에 대하여 그 통제에 의존할 근거가 되지 못한다.',
    ],
    requirements: [
        {
            id: 'sub1.req1',
            source_ref_id: 'kga330-15',
            source_quote: caseQuote('kga330-15'),
            source_span:
                'KGA 330 문단 9·11·12·15·A33·A34; 식별 기준: ②(유의적 위험에 대응하여 의존하려는 통제의 전기 테스트 결과를 당기 증거로 이용)는 문단 15에 어긋나 옳지 않고, ④(20X1년 1~9월 증거를 20X1년 전체 기간 의존의 근거로 삼음)는 문단 12(a)·(b)에 어긋나 옳지 않다. ①은 문단 9(통제의 효과성에 보다 크게 의존할수록 더욱 설득력이 있는 감사증거를 입수), ③은 문단 11과 A33(어떤 시점에만 해당되는 감사증거도 감사인의 목적에 충분할 수 있음)에 따라 옳다.',
        },
        {
            id: 'sub1.req2',
            source_ref_id: 'kga330-15',
            source_quote: caseQuote('kga330-15'),
            source_span: 'KGA 330 문단 15; ②의 판단 근거',
        },
        {
            id: 'sub1.req3',
            source_ref_id: 'kga330-12',
            source_quote: caseQuote('kga330-12'),
            source_span: 'KGA 330 문단 12(a)·(b)와 A34; ④의 판단 근거',
        },
    ],
    criteria: [
        criterion('sub1.c1', 'sub1.req1', SUB1_IDENTIFY, 'conclusion', ['kga330-15', 'kga330-12', 'kga330-11', 'kga330-9', 'kga330-A33', 'kga330-A34']),
        criterion('sub1.c2', 'sub1.req2', SUB1_C2, 'action', ['kga330-15']),
        criterion('sub1.c3', 'sub1.req3', SUB1_C3, 'action', ['kga330-12', 'kga330-A34', 'kga330-11']),
    ],
};

const sub2 = {
    id: 'sub2',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['07'],
    prompt: PROMPT('기중 실증절차와 잔여기간의 감사에 관한 ⑤~⑨'),
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub2.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑤, ⑦, ⑧이다. ⑥은 필요하다고 판단되는 감사절차의 범위가 중요성, 위험평가 그리고 감사인이 얻고자 하는 확신의 수준을 고려하여 결정되므로 옳다. ⑨는 기업의 재무제표 결산절차와 관련된 실증절차를 수행할 때 포함하여야 하는 절차이므로 옳다.',
        '⑤ 실증절차가 기중의 일자를 기준으로 수행되면 기중 일자를 기준으로 얻은 감사결론을 보고기간말까지 확대하기 위한 합리적인 근거를 제공하기 위하여 잔여기간에 대한 절차를 수행하여야 한다. 잔여기간에 대하여 통제테스트를 수반한 실증절차를 수행하거나, 감사인이 충분하다고 결정한 경우 후속적인 실증절차를 수행하여야 한다.',
        '⑦ 중요왜곡표시위험을 평가할 때 예상하지 않았던 왜곡표시가 기중에 발견되었으므로, 관련된 위험평가와 잔여기간을 포괄하는 실증절차의 계획된 성격·시기 및 범위를 변경할 필요가 있는지 평가하여야 한다. 발견된 거래를 경영진이 수정한 것을 확인하는 것만으로 종결할 수 없다.',
        '⑧ 고의적인 왜곡표시위험 또는 조작위험이 식별되었을 때에는 감사결론을 기중의 일자에서 보고기간말까지 확대하는 감사절차가 효과적이지 않다. 연말 반품과 매출채권에 대한 실증절차를 보고기간말 또는 보고기간말에 근접한 시기에 수행하거나, 불시에 또는 예측불가능한 시기에 수행하여야 한다.',
    ],
    requirements: [
        {
            id: 'sub2.req1',
            source_ref_id: 'kga330-22',
            source_quote: caseQuote('kga330-22'),
            source_span:
                'KGA 330 문단 20·22·23·A11·A15; 식별 기준: ⑤(기중 결론을 보고기간말 결론으로 삼음)는 문단 22, ⑦(예상하지 않았던 왜곡표시 발견 후 위험평가와 잔여기간 계획을 당초대로 확정)은 문단 23, ⑧(조작위험 식별 후 총액 증감표 대조로 기중 결론을 보고기간말까지 확대)은 문단 A11에 어긋나 옳지 않다. ⑥은 문단 A15(범위는 중요성·위험평가·확신의 수준을 고려하여 결정), ⑨는 문단 20(a)·(b)에 따라 옳다.',
        },
        {
            id: 'sub2.req2',
            source_ref_id: 'kga330-22',
            source_quote: caseQuote('kga330-22'),
            source_span: 'KGA 330 문단 22(a)·(b); ⑤의 판단 근거',
        },
        {
            id: 'sub2.req3',
            source_ref_id: 'kga330-23',
            source_quote: caseQuote('kga330-23'),
            source_span: 'KGA 330 문단 23; ⑦의 판단 근거',
        },
        {
            id: 'sub2.req4',
            source_ref_id: 'kga330-A11',
            source_quote: caseQuote('kga330-A11'),
            source_span: 'KGA 330 문단 A11; ⑧의 판단 근거',
        },
    ],
    criteria: [
        criterion('sub2.c1', 'sub2.req1', SUB2_IDENTIFY, 'conclusion', ['kga330-22', 'kga330-23', 'kga330-A11', 'kga330-A15', 'kga330-20']),
        criterion('sub2.c2', 'sub2.req2', SUB2_C2, 'action', ['kga330-22']),
        criterion('sub2.c3', 'sub2.req3', SUB2_C3, 'action', ['kga330-23']),
        criterion('sub2.c4', 'sub2.req4', SUB2_C4, 'action', ['kga330-A11']),
    ],
};

const sub3 = {
    id: 'sub3',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['07', '06'],
    prompt: PROMPT('감사종결을 앞둔 실증절차의 성격에 관한 ⑩~⑬'),
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub3.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑩과 ⑫이다. ⑪은 중요한 거래유형, 계정잔액 또는 공시의 모든 경영진주장이 테스트되어야 하는 것은 아니고, 왜곡표시가 중요할 합리적인 가능성이 있는 경영진주장에 대한 고려가 수행될 절차의 적합한 성격·시기 및 범위를 식별하는 데 도움을 주므로 옳다. ⑬은 재무제표의 전반적인 표시가 해당 재무보고체계를 준수하였는지 여부를 평가하기 위하여 수행하여야 하는 절차이므로 옳다.',
        '⑩ 감사인은 평가된 중요왜곡표시위험과 관계없이 중요한 각 거래유형과 계정잔액 및 공시에 대하여는 실증절차를 설계하고 수행하여야 한다. 감사인의 위험평가에는 판단이 수반되므로 모든 중요왜곡표시위험이 식별되지 않을 수 있고 경영진의 통제무력화 등 내부통제에 고유한계가 존재하므로, 매출 거래유형과 매출채권 잔액 및 관련 주석공시에 대한 실증절차를 설계하고 수행하여야 한다.',
        '⑫ 유의적 위험에 대응하는 접근방법이 실증절차만으로 구성되어 있는 경우에는 반드시 세부테스트를 포함하여야 한다. 연말 반품과 매출채권의 고의적 조작위험에 대응하는 실증절차에 세부테스트를 포함하여야 한다.',
    ],
    requirements: [
        {
            id: 'sub3.req1',
            source_ref_id: 'kga330-18',
            source_quote: caseQuote('kga330-18'),
            source_span:
                'KGA 330 문단 18·21·24·A43·A44; 식별 기준: ⑩(통제가 효과적이어서 위험을 낮게 평가하였다는 이유로 중요한 매출 거래유형·매출채권 잔액·관련 주석공시의 실증절차를 총괄적 분석적 검토로 갈음)은 문단 18과 A43, ⑫(유의적 위험에 실증절차만으로 대응하면서 실증적 분석절차만 구성)는 문단 21에 어긋나 옳지 않다. ⑪은 문단 A44, ⑬은 문단 24에 따라 옳다.',
        },
        {
            id: 'sub3.req2',
            source_ref_id: 'kga330-A43',
            source_quote: caseQuote('kga330-A43'),
            source_span: 'KGA 330 문단 18과 A43; ⑩의 판단 근거',
        },
        {
            id: 'sub3.req3',
            source_ref_id: 'kga330-21',
            source_quote: caseQuote('kga330-21'),
            source_span: 'KGA 330 문단 21; ⑫의 판단 근거',
        },
    ],
    criteria: [
        criterion('sub3.c1', 'sub3.req1', SUB3_IDENTIFY, 'conclusion', ['kga330-18', 'kga330-21', 'kga330-A43', 'kga330-A44', 'kga330-24']),
        criterion('sub3.c2', 'sub3.req2', SUB3_C2, 'action', ['kga330-18', 'kga330-A43']),
        criterion('sub3.c3', 'sub3.req3', SUB3_C3, 'action', ['kga330-21']),
    ],
};

// ── 4. 사례형 세트 ───────────────────────────────────────────────────────────
const caseSet = {
    schema_version: '3.0',
    id: 'case-07-evidence-timing-20260920',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '통제증거의 시기와 실증절차의 계획',
    classification: {
        topic_id: '07',
        part: 'PART2',
        chapter: '위험에 대한 대응',
        domain: 'audit',
        standards: ['KGA 330'],
        tags: ['감사증거의 시기', '통제테스트', '기중 실증절차', '잔여기간', '사례형'],
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
            '2026-09-20 사용자 지시("설계서에 따라서 사례형 문제 제작해서 대체해줘")에 따라 docs/사례형-병합-종합문제-설계.md의 A등급 "감사증거의 시기" 묶음인 15번(pilot-07-006, 전기 통제증거의 재사용과 당기 중간기간 증거), 50번(case-07-interim-misstatement-20260914, 기중 실증절차에서 발견한 오류와 잔여기간 감사), 16번(pilot-07-007, 효과적인 통제와 유의적 위험에 대응하는 실증절차)을 한 회사의 시간 순서로 합친 병합 초안이다. 원 세 세트는 대체 후 퇴역 대상이며 대응은 같은 폴더의 lineage.json에 기록한다.',
            '형식은 학습 단위 계약의 기본인 옳지 않은 것 선택형이다. 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점, 옳지 않은 항목마다 이유 또는 수행하였어야 할 절차 중 하나를 핵심 원칙 수준으로 쓴 1점을 둔다. 옳은 항목 ①·③·⑥·⑨·⑪·⑬에는 별도 득점 기준이 없다. 물음 1은 3점, 물음 2는 4점, 물음 3은 3점으로 합계 10점이다. 옳지 않은 항목의 수는 물음마다 2개·3개·2개이며 발문에 밝히지 않는다.',
            '원 세 세트에서 같은 기준에서 결론이 갈리는 두 경우를 정리했다. 15번은 유의적 위험을 완화시키는 통제가 아닌 통제의 전기 증거 이용(문단 14, 상황 A)과 유의적 위험에 대응하는 통제의 당기 테스트 요구(문단 15, 상황 B)를 한 사례에 나란히 두고 있었다. 학습 단위 계약의 "대조되는 두 경우를 함께 두지 않음"에 따라 이 사례에는 문단 15 쪽(②)만 남기고, 문단 14 쪽은 항목으로 두지 않은 채 별도의 기준서형 세트 pilot-07-006-standards-20260920으로 분리 보존했다. 문단 22(a)와 22(b)의 두 대안도 한쪽만 고르게 하지 않고 ⑤ 하나로 두었다.',
            '유의적 위험의 대상은 매출채권 관련 위험으로 통일했다. 16번이 함께 쓰던 복잡한 금융상품의 평가 위험은 삭제하고, 문단 21의 요구는 50번에서 이어받은 연말 반품·매출채권의 고의적 조작위험에 적용했다. 50번이 두었던 "관련 통제의 운영효과성에는 의존하지 않기로 계획"이라는 전제는 16번·15번의 통제 의존 전제와 충돌하므로 통제 의존 쪽으로 통일했다.',
            '사용자가 확정한 대상 연도는 2027년이다. 판본 정책에 따라 사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다. 인용 열여섯 개 가운데 열한 개(KGA 330 문단 11·12·15·18·21·22·23·A11·A33·A34·A43)는 원 세 세트의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 문단 9·20·24·A44는 등록 전문 cpa_uploader/data/official/delegated-n03-kga330-2025.txt(L83-L85, L204-L213, L234-L241, L384-L387)에서, 문단 A15는 cpa_uploader/data/official/delegated-s02-kga330-2025.txt(L122-L128)에서 새로 발췌했다. 새 원자료 수집은 없다. 2025년 11월 전문과 2026년 7월 전문의 대조 기록은 15번·16번의 verification.notes를 재사용했다.',
            'KGA 330 문단 A56~A60(실증절차의 시기에 관한 적용자료)은 등록된 공식 전문에 들어 있지 않고 학습자료 전사본에만 있으므로 득점 요건의 근거로 쓰지 않았다. 50번이 문단 A58을 학습자료에서 인용하던 관계는 승계하지 않고, 잔여기간 요구는 문단 22 본문에서 확정했다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 5. 분리 보존하는 기준서형 세트 ───────────────────────────────────────────
const standardsSourceRefs = [
    reusedRef('kga330-14', 'pilot-07-006', 'src-45ceee61a33e65e192', 'KGA 330 문단 14, 2025 개정 전문 원문 페이지 315; L144-L168'),
    reusedRef('kga330-A37', 'pilot-07-006', 'src-00954ab13a5cfd8a7c', 'KGA 330 문단 A37, 2025 개정 전문 원문 페이지 327; L314-L319'),
    reusedRef('kga330-A38', 'pilot-07-006', 'src-b72115fa95182ee65a', 'KGA 330 문단 A38, 2025 개정 전문 원문 페이지 327; L320-L334'),
    reusedRef('kga330-A39', 'pilot-07-006', 'src-dc63b1c2ea2e6fd2ad', 'KGA 330 문단 A39, 2025 개정 전문 원문 페이지 328; L335-L349'),
    reusedRef('kga330-A40', 'pilot-07-006', 'src-74cc168a3ded8a5dba', 'KGA 330 문단 A40, 2025 개정 전문 원문 페이지 328; L350-L354'),
];
const standardsRefById = new Map(standardsSourceRefs.map((ref) => [ref.id, ref]));
const standardsQuote = (id) => {
    const ref = standardsRefById.get(id);
    if (!ref) throw new Error(`source_ref 없음: ${id}`);
    return ref.source_quote;
};

const STANDALONE_PROMPT =
    '감사인이 이전의 감사에서 입수한 통제의 운영효과성에 관한 감사증거를 당기의 감사증거로 이용하려 한다. 그 통제가 유의적 위험을 완화시키는 통제가 아닌 경우를 전제로, 감사기준서 330 문단 14(a)와 (b)가 각각 요구하는 사항을 설명하시오.';

const standardsSub = {
    id: 'sub4',
    type: 'judgment',
    question_style: 'standard',
    topic_ids: ['07'],
    prompt: STANDALONE_PROMPT,
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '전기 증거의 계속적인 관련성에 영향을 미치는 변화가 발생했다면 당기감사에서 해당 통제를 테스트해야 한다.',
        '계속적인 관련성에 영향을 미치는 변화가 없더라도 매 3회의 감사에 최소한 한 번은 해당 통제를 테스트해야 하므로 횟수 제한 없는 재사용은 허용되지 않는다.',
        '한 감사에서 의존할 모든 통제를 일괄 테스트하고 다음 두 감사에서 통제테스트를 전혀 하지 않는 방식을 피하도록 매 보고기간의 감사마다 일부 통제는 테스트해야 한다.',
    ],
    requirements: [
        {
            id: 'req2',
            source_ref_id: 'kga330-14',
            source_quote: standardsQuote('kga330-14'),
            source_span: 'KGA 330 문단 14(a)와 A37; 원 pilot-07-006/sub4의 req2를 승계',
        },
        {
            id: 'req3',
            source_ref_id: 'kga330-14',
            source_quote: standardsQuote('kga330-14'),
            source_span: 'KGA 330 문단 14(b)의 매 3회 감사 요구와 A38·A39; 원 pilot-07-006/sub4의 req3을 승계',
        },
        {
            id: 'req4',
            source_ref_id: 'kga330-14',
            source_quote: standardsQuote('kga330-14'),
            source_span: 'KGA 330 문단 14(b)의 매 보고기간 일부 통제 테스트 요구와 A40; 원 pilot-07-006/sub4의 req4를 승계',
        },
    ],
    criteria: [
        {
            id: 'crit2',
            requirement_id: 'req2',
            claim: '전기 증거의 계속적인 관련성에 영향을 미치는 변화가 발생했다면 당기감사에서 해당 통제를 테스트해야 한다.',
            critical_facts: [{ id: 'cf2', type: 'conclusion', expected: '전기 증거의 계속적인 관련성에 영향을 미치는 변화가 발생했다면 당기감사에서 해당 통제를 테스트해야 한다.' }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga330-14', 'kga330-A37'],
        },
        {
            id: 'crit3',
            requirement_id: 'req3',
            claim: '계속적인 관련성에 영향을 미치는 변화가 없더라도 매 3회의 감사에 최소한 한 번은 해당 통제를 테스트해야 하므로 횟수 제한 없는 재사용은 허용되지 않는다.',
            critical_facts: [{ id: 'cf3', type: 'conclusion', expected: '계속적인 관련성에 영향을 미치는 변화가 없더라도 매 3회의 감사에 최소한 한 번은 해당 통제를 테스트해야 하므로 횟수 제한 없는 재사용은 허용되지 않는다.' }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga330-14', 'kga330-A38', 'kga330-A39'],
        },
        {
            id: 'crit4',
            requirement_id: 'req4',
            claim: '한 감사에서 의존할 모든 통제를 일괄 테스트하고 다음 두 감사에서 통제테스트를 전혀 하지 않는 방식을 피하도록 매 보고기간의 감사마다 일부 통제는 테스트해야 한다.',
            critical_facts: [{ id: 'cf4', type: 'conclusion', expected: '한 감사에서 의존할 모든 통제를 일괄 테스트하고 다음 두 감사에서 통제테스트를 전혀 하지 않는 방식을 피하도록 매 보고기간의 감사마다 일부 통제는 테스트해야 한다.' }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga330-14', 'kga330-A40'],
        },
    ],
};

const standardsSet = {
    schema_version: '3.0',
    id: 'pilot-07-006-standards-20260920',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '이전 감사에서 입수한 통제 운영효과성 증거의 이용',
    classification: {
        topic_id: '07',
        part: 'PART2',
        chapter: '위험에 대한 대응',
        domain: 'audit',
        standards: ['KGA 330'],
        tags: ['통제테스트', '이전 감사의 감사증거', '기준서형'],
    },
    source_refs: standardsSourceRefs,
    shared_context: { facts: [] },
    learning_order: ['sub4'],
    subquestions: [standardsSub],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-20 사용자 결정에 따라 15번(pilot-07-006)에 섞여 있던 기준서형 물음 sub4를 퇴역시키지 않고 독립 기준서형 세트로 분리 보존한 것이다. 물음 ID(sub4), criterion ID(crit2·crit3·crit4), 정수 배점(각 1점, 합계 3점), 모범답안, 공식 인용을 원 세트에서 그대로 승계했다. 분리 방식은 2026-09-13 case-expansion 배치의 "-standards-" 세트 선례를 따른다.',
            '독립 발문은 고쳤다. 원 발문("유의적 위험에 대응하는 통제가 아닌 통제의 전기 운영효과성 증거를 재사용하려 한다. 증거의 계속적 관련성에 영향을 주는 변화가 있을 때와 없을 때의 재테스트 요구를 구별하고, 매 감사에 통제테스트를 배분하는 원칙을 설명하시오. 주기는 감사 횟수로 제시하시오.")은 "배분하는 원칙"과 "주기는 감사 횟수로 제시"가 crit4·crit3의 정답 방향을 알려 주므로, 기준서형 발문의 정답 암시 금지에 따라 문단·항 기호로 범위를 정하는 발문으로 바꾸었다. 요구 범위(문단 14(a)와 (b))와 적용 조건(유의적 위험을 완화시키는 통제가 아닐 것)은 같고 criterion 명제와 배점은 바꾸지 않았다.',
            'shared_context.facts는 비어 있으며 사례 사실이나 다른 물음을 참조하는 표현은 발문·모범답안·criterion에 없다. 이 물음은 사례를 보지 않은 답안으로 만점이 가능해야 한다.',
            '사용자가 확정한 대상 연도는 2027년이다. 인용 다섯 개(KGA 330 문단 14·A37·A38·A39·A40)는 pilot-07-006의 정본 인용을 바이트와 content_hash 그대로 재사용했다. 새 원자료 수집은 없다. 330.14(b)의 매 3회 감사 요구를 적용하며 A38의 "매 3년의 감사"라는 인쇄 문구는 고치지 않았다는 원 세트의 판본 기록을 승계한다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 6. 출력 ──────────────────────────────────────────────────────────────────
const summarize = (set) => {
    const total = set.subquestions.reduce((sum, sub) => sum + sub.criteria.reduce((inner, c) => inner + c.max_points, 0), 0);
    const factChars = (set.shared_context.facts || []).map((fact) => fact.text).join('\n').length;
    return `${set.id} · 물음 ${set.subquestions.length}개 · ${total}점 · 사실관계 ${factChars}자 · source_refs ${set.source_refs.length}개`;
};

fs.writeFileSync(path.join(here, 'sets.json'), `${JSON.stringify([caseSet], null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(here, 'standards-sets.json'), `${JSON.stringify([standardsSet], null, 2)}\n`, 'utf8');
console.log('sets.json 작성:', summarize(caseSet));
console.log('standards-sets.json 작성:', summarize(standardsSet));
