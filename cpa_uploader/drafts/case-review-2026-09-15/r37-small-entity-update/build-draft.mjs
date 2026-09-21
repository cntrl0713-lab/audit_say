// r37: 수정 요청서 40번 pilot-18-005(4물음 20점)을 선택형 사례형 세트와 분리 보존 기준서형 세트로 다시 쓰는 초안 생성기.
//
//   node cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update/build-draft.mjs
//
// 출력: sets.json(case-18-small-entity-20260921), standards-sets.json(pilot-18-005-standards-20260921)
//
// 인용은 모두 현재 정본의 등록 인용을 바이트와 content_hash 그대로 재사용한다.
//   문단 2·문단 3(각주 1~5 포함)  ← 퇴역 대상 pilot-18-005
//   문단 4·문단 5                ← pilot-18-003
//   문단 6                       ← std-points-20260914-1f185dbcb15a
// 새 원자료 수집도, 새 발췌도 하지 않는다. 한 세트 안에서 같은 문단을 두 번 인용하지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');

const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const ORIGIN = 'pilot-18-005';
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const byId = new Map(bank.map((set) => [set.id, set]));

function reuse(setId, refId) {
    const set = byId.get(setId);
    if (!set) throw new Error(`정본에 세트가 없습니다: ${setId}`);
    const ref = (set.source_refs || []).find((item) => item.id === refId);
    if (!ref) throw new Error(`${setId}에 source_ref가 없습니다: ${refId}`);
    return ref;
}

function inherited(setId, refId, { id, title, span }) {
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
        _span_note: span,
    };
}

// ── 1. 출처 ──────────────────────────────────────────────────────────────────
const P2 = inherited(ORIGIN, 'src-eefc15ac2516338307', {
    id: 'kga1200-2',
    title: 'KGA 1200 문단 2 본문 및 (a)(i)~(vi)·(b), 2025 개정 전문; 원문 페이지 909',
});
const P3 = inherited(ORIGIN, 'src-5d149516e009fdc5f1', {
    id: 'kga1200-3',
    title: 'KGA 1200 문단 3 및 각주 1~5, 2025 개정 전문; 원문 페이지 909',
});
const P4 = inherited('pilot-18-003', 'src1', {
    id: 'kga1200-4',
    title: 'KGA 1200 문단 4, 2025 개정 전문; 원문 페이지 910',
});
const P5 = inherited('pilot-18-003', 'src3', {
    id: 'kga1200-5',
    title: 'KGA 1200 문단 5, 2025 개정 전문; 원문 페이지 910',
});
const P6 = inherited('std-points-20260914-1f185dbcb15a', 'src-5500125298737004', {
    id: 'kga1200-6',
    title: 'KGA 1200 문단 6, 2025 개정 전문; 원문 페이지 910',
});

function clean(ref) {
    const { _span_note, ...rest } = ref;
    return rest;
}

function checkQuotes(refs, label) {
    const seen = new Map();
    for (const ref of refs) {
        const key = ref.source_quote.replace(/\s+/gu, '');
        if (seen.has(key)) throw new Error(`${label}: source_quote 중복 ${ref.id} ↔ ${seen.get(key)}`);
        seen.set(key, ref.id);
    }
}

const caseRefs = [P2, P3, P4, P5, P6].map(clean);
const standardsRefs = [P2, P3].map(clean);
checkQuotes(caseRefs, 'case');
checkQuotes(standardsRefs, 'standards');

const quoteOf = (id) => {
    const ref = [...caseRefs, ...standardsRefs].find((item) => item.id === id);
    if (!ref) throw new Error(`source_ref 없음: ${id}`);
    return ref.source_quote;
};

// ── 2. 사례형 세트 ────────────────────────────────────────────────────────────
const FACT1 = [
    '한결회계법인은 (주)들녘산업의 20X2년 1월 1일부터 12월 31일까지의 일반목적 재무제표에 대한 감사를 수임하였다.',
    '회사는 주식회사 등의 외부감사에 관한 법률(이하 ‘외부감사법’)에 따른 외부감사 대상 주식회사이며, 외부감사 대상인지 여부 자체는 이 사례에서 다투어지지 않는다.',
    '회사의 20X1년 말 개별재무제표상 자산은 200억원이고 20X1년 매출은 99억원이다.',
    '회사는 주권상장법인이 아니고, 해당 회계연도나 그 다음 회계연도 중에 주권상장법인이 되기 위한 절차를 진행하기로 결정한 사실이 없으며, 금융회사도 아니다.',
    '회사는 자본시장과 금융투자업에 관한 법률 제159조 제1항에 따른 사업보고서 제출대상법인이 아니고, 외부감사법 제11조 제1항에 따라 증권선물위원회가 감사인을 지정한 회사도 아니다.',
    '회사는 (주)한들홀딩스의 종속회사로서 (주)한들홀딩스가 작성하는 연결재무제표에 포함되며, 회사 자신은 다른 회사의 지분을 보유하고 있지 않다.',
    '직전 회계연도인 20X1년 재무제표에 대한 감사도 한결회계법인이 수행하였고, 그 감사에서는 회사와 서면으로 합의하여 일반 감사기준서를 적용하였다.',
    '20X2년 재무제표 감사에 관하여는 아직 그러한 서면 합의를 하지 않았다.',
].join(' ');

const FACT2 = [
    '감사팀은 20X2년 재무제표 감사를 계획하면서 이 감사에 감사기준서 1200(소규모기업 재무제표에 대한 감사)을 적용할 수 있는 기업인지를 먼저 검토하였다. 이 단계에서 감사팀이 적용한 판단 기준과 확인한 내용은 다음과 같다.',
    '① 감사팀은 문단 2(b)의 규모 요건을 회사가 작성한 개별재무제표를 기준으로, 20X1년 말 자산 금액과 20X1년 매출 금액을 사용하여 판단하기로 하였다.',
    '② 감사팀은 문단 2(b)의 규모 요건이 자산에 관한 금액 요건과 매출에 관한 금액 요건을 모두 충족할 때 성립한다고 보아, 20X1년 말 자산이 200억원 미만인지와 20X1년 매출이 100억원 미만인지를 함께 확인하였다.',
    '③ 감사팀은 회사가 (주)한들홀딩스가 작성하는 연결재무제표에 포함된다는 점을 확인하고, 회사가 문단 2(a)의 기업 범주 중 연결재무제표를 작성하는 회사에 해당한다고 보았다.',
    '④ 감사팀은 일반 감사기준서에서 언급하는 소규모기업과 감사기준서 1200이 정의하는 소규모기업이 같은 의미라고 보아, 회사가 감사기준서 200 문단 A71의 특성을 지니는지를 확인하여 문단 2의 판단에 갈음하기로 하였다.',
    '⑤ 감사팀은 회사가 문단 2(a)의 기업 범주 중 어느 것에도 해당하지 않고 문단 2(b)의 규모 요건도 충족하여야 소규모기업에 해당한다고 보았다.',
].join('\n');

const FACT3 = [
    '이어서 감사팀은 20X2년 감사에 적용할 감사기준서와 감사보고에 관하여 다음과 같이 정하였다.',
    '⑥ 감사팀은 문단 2에 해당하는 기업의 감사에도 기업과 서면으로 합의하면 감사기준서 1200 대신 일반 감사기준서를 적용할 수 있다고 보아, 회사와 그러한 합의를 할지를 협의하기로 하였다.',
    '⑦ 감사팀은 감사기준서 1200이 감사문서에 관하여 정한 요구사항이 회사의 규모에 더 알맞다고 보아, 소규모기업에 해당하지 않는 기업의 감사에서도 감사문서에 관하여는 감사기준서 1200의 요구사항을 적용하기로 정리하였다.',
    '⑧ 감사팀은 이 감사에 감사기준서 1200을 적용하여 감사를 수행하게 되는 경우, 감사보고서에 회계감사기준 전체를 준수하여 감사를 수행하였다고 기술하기로 하였다.',
    '⑨ 감사팀은 직전 회계연도 감사에서 회사와 서면으로 합의하여 일반 감사기준서를 적용하였고 이 감사에는 감사기준서 1200을 적용하게 되는 경우, 감사기준서 1200을 이 회계연도 감사부터 전진적으로 적용하고 적용 감사기준서의 변경을 이유로 기초잔액과 비교재무제표에 관하여 추가로 고려하거나 수행할 사항은 두지 않기로 하였다.',
].join('\n');

const criterion = (id, requirementId, claim, factType, expected, sourceRefIds) => ({
    id,
    requirement_id: requirementId,
    claim,
    critical_facts: [{ id: `${id}.fact`, type: factType, expected }],
    max_points: 1,
    scores: { met: 1, not_met: 0, contradicted: 0 },
    source_ref_ids: sourceRefIds,
});

const shell = (question) => ({
    id: question.id,
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['18'],
    prompt: question.prompt,
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: `${question.id}.answer`, label: '답안', input: 'textarea' }],
    model_answer: question.model_answer,
    requirements: question.requirements,
    criteria: question.criteria,
});

const caseSet = {
    schema_version: '3.0',
    id: 'case-18-small-entity-20260921',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '소규모기업 감사기준의 적용 검토와 감사보고 계획',
    classification: {
        topic_id: '18',
        part: 'PART4',
        chapter: '소규모기업 감사',
        domain: 'audit',
        standards: ['KGA 1200'],
        tags: ['소규모기업 감사', '적용대상 검토', '적용 감사기준서', '사례형'],
    },
    source_refs: caseRefs,
    shared_context: {
        facts: [
            { id: 'fact1', text: FACT1, scoreable: false },
            { id: 'fact2', text: FACT2, scoreable: false },
            { id: 'fact3', text: FACT3, scoreable: false },
        ],
    },
    learning_order: ['sub1', 'sub2'],
    subquestions: [
        shell({
            id: 'sub1',
            prompt: '소규모기업 해당 여부를 검토하는 단계에서 감사팀이 적용한 판단 기준과 확인 내용 ①~⑤ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
            model_answer: [
                '옳지 않은 것은 ②, ③, ④이다. ①은 문단 2(b)가 개별(별도)재무제표상 직전 회계연도말 자산과 직전 회계연도 매출을 기준으로 정하고 있으므로 옳다. ⑤는 문단 2가 (a)와 (b)의 조건을 모두 충족하는 기업에 적용된다고 정하고 있으므로 옳다.',
                '② 문단 2(b)의 자산 요건과 매출 요건은 또는 관계이므로 어느 하나만 충족하면 규모 요건이 충족된다. 두 요건이 함께 충족되는지 확인할 것이 아니라 20X1년 매출 99억원이 100억원 미만이라는 점만으로 규모 요건이 충족된 것으로 보았어야 한다.',
                '③ 문단 2(a)에서 제외하는 연결재무제표를 작성하는 회사는 외부감사법상 지배회사에 해당하여 연결재무제표를 작성하는 회사를 말한다. 회사는 지배회사의 연결재무제표에 포함되는 종속회사일 뿐이므로, 회사 자신이 지배회사로서 연결재무제표를 작성하는지를 확인하였어야 한다.',
                '④ 일반 감사기준서에서 언급하는 소규모기업은 감사기준서 200 문단 A71의 특성을 지닌 기업으로서 감사기준서 1200이 정의하는 소규모기업과 다르다. 감사기준서 200 문단 A71의 특성 대신 문단 2(a)와 문단 2(b)의 조건으로 판단하였어야 한다.',
            ],
            requirements: [
                { id: 'sub1.req1', source_ref_id: 'kga1200-2', source_quote: quoteOf('kga1200-2'), source_span: 'KGA 1200 문단 2 본문 및 (a)(i)~(vi)·(b); 2025 개정 전문 원문 페이지 909' },
                { id: 'sub1.req2', source_ref_id: 'kga1200-3', source_quote: quoteOf('kga1200-3'), source_span: 'KGA 1200 문단 3 및 각주 1~5; 2025 개정 전문 원문 페이지 909' },
            ],
            criteria: [
                criterion('crit1', 'sub1.req1',
                    '옳지 않은 것으로 ②·③·④를 모두 지적한다. 번호 대신 내용으로 특정하거나 이유·보완절차에서 해당 항목의 부적절성이 분명히 드러나도 인정한다. 셋 중 하나라도 빠뜨리거나, 옳은 것인 ①(개별재무제표의 직전 회계연도 금액으로 규모 요건을 판단), ⑤(문단 2(a)의 어느 범주에도 해당하지 않고 문단 2(b)도 충족하여야 소규모기업에 해당) 가운데 하나라도 옳지 않다고 고르면 충족하지 않는다.',
                    'conclusion', '옳지 않은 항목으로 ②·③·④를 모두 고르고 ①·⑤는 옳지 않다고 고르지 않는다.',
                    ['kga1200-2', 'kga1200-3']),
                criterion('crit2', 'sub1.req1',
                    '② 문단 2(b)의 자산 요건과 매출 요건이 또는 관계여서 어느 하나만 충족하면 규모 요건이 충족된다는 이유, 또는 20X1년 매출 99억원이 100억원 미만이라는 점만으로 규모 요건이 충족된 것으로 보았어야 한다는 절차 중 하나를 제시한다. 이유 또는 절차 한 가지만 핵심 원칙 수준으로 쓰면 충족하며 둘 다 써도 1점이다. 두 요건을 모두 충족하여야 한다는 판단을 유지하면 충족하지 않는다.',
                    'condition', '문단 2(b)의 두 금액 요건이 또는 관계라는 이유 또는 매출 요건만으로 규모 요건이 충족된다고 보았어야 한다는 절차 중 하나를 제시한다.',
                    ['kga1200-2']),
                criterion('crit3', 'sub1.req2',
                    '③ 문단 2(a)에서 제외하는 연결재무제표를 작성하는 회사가 외부감사법상 지배회사에 해당하여 연결재무제표를 작성하는 회사를 말한다는 이유, 또는 회사 자신이 지배회사로서 연결재무제표를 작성하는지를 확인하였어야 한다는 절차 중 하나를 제시한다. 종속회사로서 지배회사의 연결재무제표에 포함된다는 사실만으로는 이 범주에 해당하지 않는다는 취지가 드러나야 한다. 이유 또는 절차 한 가지만 핵심 원칙 수준으로 쓰면 충족한다.',
                    'condition', '제외 범주의 연결재무제표를 작성하는 회사가 지배회사에 한정된다는 이유 또는 회사가 직접 지배회사로서 연결재무제표를 작성하는지를 확인하였어야 한다는 절차 중 하나를 제시한다.',
                    ['kga1200-3', 'kga1200-2']),
                criterion('crit4', 'sub1.req2',
                    '④ 일반 감사기준서에서 언급하는 소규모기업(감사기준서 200 문단 A71의 특성을 지닌 기업)이 감사기준서 1200이 정의하는 소규모기업과 다르다는 이유, 또는 감사기준서 200 문단 A71의 특성 대신 문단 2의 조건으로 판단하였어야 한다는 절차 중 하나를 제시한다. 이유 또는 절차 한 가지만 핵심 원칙 수준으로 쓰면 충족한다.',
                    'condition', '두 소규모기업 개념이 서로 다르다는 이유 또는 문단 2의 조건으로 판단하였어야 한다는 절차 중 하나를 제시한다.',
                    ['kga1200-3']),
            ],
        }),
        shell({
            id: 'sub2',
            prompt: '적용할 감사기준서와 감사보고에 관하여 감사팀이 정한 사항 ⑥~⑨ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
            model_answer: [
                '옳지 않은 것은 ⑦과 ⑧이다. ⑥은 문단 5가 기업과 서면으로 합의한 경우 문단 2에 해당하는 기업의 감사에 감사기준서 1200 대신 일반 감사기준서를 적용할 수 있도록 하고 있으므로 옳다. ⑨는 문단 6이 적용 감사기준서의 변경을 해당 회계연도 감사부터 전진적으로 적용하도록 하고, 그 변경 때문에 기초잔액과 비교재무제표와 관련하여 추가 고려할 사항이나 추가 수행할 절차는 없다고 정하고 있으므로 옳다.',
                '⑦ 감사기준서 1200은 소규모기업에 해당하지 않는 기업의 재무제표 감사에 적용할 수 없으므로 감사문서에 관한 요구사항만 떼어 적용할 수 없다. 소규모기업에 해당하지 않는 기업의 일반목적 재무제표 감사에는 감사기준서 200에서 감사기준서 720까지의 일반 감사기준서를 적용하였어야 한다.',
                '⑧ 감사기준서 1200을 적용하여 감사를 수행한 경우 감사보고서에 회계감사기준 전체를 준수하였다고 기술해서는 안 된다. 그러한 기술을 감사보고서에 넣지 않기로 하였어야 한다.',
            ],
            requirements: [
                { id: 'sub2.req1', source_ref_id: 'kga1200-3', source_quote: quoteOf('kga1200-3'), source_span: 'KGA 1200 문단 3 및 각주 1~5; 2025 개정 전문 원문 페이지 909' },
                { id: 'sub2.req2', source_ref_id: 'kga1200-4', source_quote: quoteOf('kga1200-4'), source_span: 'KGA 1200 문단 4; 2025 개정 전문 원문 페이지 910' },
                { id: 'sub2.req3', source_ref_id: 'kga1200-5', source_quote: quoteOf('kga1200-5'), source_span: 'KGA 1200 문단 5; 2025 개정 전문 원문 페이지 910 (옳은 항목 ⑥의 근거)' },
                { id: 'sub2.req4', source_ref_id: 'kga1200-6', source_quote: quoteOf('kga1200-6'), source_span: 'KGA 1200 문단 6; 2025 개정 전문 원문 페이지 910 (옳은 항목 ⑨의 근거)' },
            ],
            criteria: [
                criterion('crit5', 'sub2.req1',
                    '옳지 않은 것으로 ⑦과 ⑧을 모두 지적한다. 번호 대신 내용으로 특정하거나 이유·보완절차에서 해당 항목의 부적절성이 분명히 드러나도 인정한다. 둘 중 하나를 빠뜨리거나, 옳은 것인 ⑥(서면 합의로 일반 감사기준서를 적용할 수 있다고 보고 협의하기로 함), ⑨(적용 기준서 변경을 전진적으로 적용) 가운데 하나라도 옳지 않다고 고르면 충족하지 않는다.',
                    'conclusion', '옳지 않은 항목으로 ⑦과 ⑧을 모두 고르고 ⑥·⑨는 옳지 않다고 고르지 않는다.',
                    ['kga1200-3', 'kga1200-4', 'kga1200-5', 'kga1200-6']),
                criterion('crit6', 'sub2.req1',
                    '⑦ 감사기준서 1200을 소규모기업에 해당하지 않는 기업의 재무제표 감사에 적용할 수 없다는 이유, 또는 그러한 기업의 감사에는 감사기준서 200에서 감사기준서 720까지의 일반 감사기준서를 적용하였어야 한다는 절차 중 하나를 제시한다. 감사문서에 관한 요구사항만 떼어 적용할 수 없다는 취지가 드러나야 한다. 이유 또는 절차 한 가지만 핵심 원칙 수준으로 쓰면 충족한다.',
                    'negation', '소규모기업이 아닌 기업의 감사에 감사기준서 1200을 일부라도 적용할 수 없다는 이유 또는 일반 감사기준서를 적용하였어야 한다는 절차 중 하나를 제시한다.',
                    ['kga1200-3']),
                criterion('crit7', 'sub2.req2',
                    '⑧ 감사기준서 1200을 적용하여 감사를 수행한 경우 감사보고서에 회계감사기준 전체를 준수하였다고 기술해서는 안 된다는 이유, 또는 그러한 기술을 감사보고서에 넣지 않기로 하였어야 한다는 절차 중 하나를 제시한다. 이유 또는 절차 한 가지만 핵심 원칙 수준으로 쓰면 충족한다.',
                    'negation', '감사보고서에 회계감사기준 전체 준수를 기술할 수 없다는 이유 또는 그 기술을 넣지 않기로 하였어야 한다는 절차 중 하나를 제시한다.',
                    ['kga1200-4']),
            ],
        }),
    ],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-21 사용자 지시("D등급도 진행해")와 docs/사례형-병합-종합문제-설계.md 4절 D등급("40 소규모기업 … 이미 3물음·8~10점이거나 붙일 짝이 없다. 발문 형식만 선택형으로 바꾸는 갱신 대상")에 따라, 수정 요청서 40번 pilot-18-005(4물음 20점)을 선택형 사례형으로 다시 쓴 초안이다. 원 세트는 대체 후 퇴역 대상이며, 그 안의 기준서형 2물음은 같은 배치의 pilot-18-005-standards-20260921로 분리 보존한다. 대응은 같은 폴더의 lineage.json에 기록한다.',
            '원 세트의 사례형 2물음은 A·B(적용대상 해당)와 C(적용대상 아님)를 같은 문단 2(b)로 판단하게 하여 같은 기준에서 결론이 갈리는 두 경우에 해당하였다. 네 회사 가운데 A만 남기고 B·C·D의 요구는 승계하지 않았다. 남은 회사 하나의 사실로 적용 검토 단계와 적용 기준서·감사보고 결정 단계를 구성하고, 문단 3·4·5·6을 항목으로 더했다. 물음마다 식별 1점과 옳지 않은 항목마다 이유 또는 보완절차 중 하나에 1점을 두어 물음 1은 4점, 물음 2는 3점으로 합계 7점이다. 옳지 않은 항목의 수는 3개·2개이며 발문에 밝히지 않는다. 옳은 항목 ①·⑤·⑥·⑨에는 별도 득점 기준이 없다.',
            '사용자가 확정한 대상 연도는 2027년이다. 사례의 20X1년·20X2년은 2027년 시험에 적용되는 KGA 1200 2025 개정 전문(문단 8: 2023년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 적용)을 기준으로 판단한다. 인용 5개는 모두 현재 정본의 등록 인용을 바이트와 content_hash 그대로 재사용했다(문단 2·3은 pilot-18-005, 문단 4·5는 pilot-18-003, 문단 6은 std-points-20260914-1f185dbcb15a). 새 원자료 수집과 새 발췌는 없다.',
            'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 3. 기준서형 분리 보존 세트 ────────────────────────────────────────────────
const origin = byId.get(ORIGIN);
if (!origin) throw new Error('정본에 pilot-18-005가 없습니다.');
const originSub = (id) => {
    const sub = origin.subquestions.find((q) => q.id === id);
    if (!sub) throw new Error(`pilot-18-005에 ${id}가 없습니다.`);
    return sub;
};
const originCriterion = (subId, critId) => {
    const found = originSub(subId).criteria.find((c) => c.id === critId);
    if (!found) throw new Error(`${subId}에 ${critId}가 없습니다.`);
    return found;
};

// 원 criterion의 claim·critical_facts·배점을 그대로 승계하고 id만 세트 안에서 연번으로 다시 매긴다.
function inheritCriterion(subId, oldId, newId, requirementId) {
    const source = originCriterion(subId, oldId);
    if (source.max_points !== 1) throw new Error(`${oldId}: 1점 criterion만 승계한다.`);
    return {
        id: newId,
        requirement_id: requirementId,
        claim: source.claim,
        critical_facts: source.critical_facts.map((fact) => ({
            id: `${newId}.fact`,
            type: fact.type,
            expected: fact.expected,
        })),
        max_points: 1,
        scores: { met: 1, not_met: 0, contradicted: 0 },
        source_ref_ids: source.source_ref_ids.map((id) => {
            if (id === 'src-eefc15ac2516338307') return 'kga1200-2';
            if (id === 'src-5d149516e009fdc5f1') return 'kga1200-3';
            throw new Error(`승계 대상 밖 source_ref_id: ${id}`);
        }),
    };
}

const standardsShell = (question) => ({
    id: question.id,
    type: question.type,
    question_style: 'standard',
    topic_ids: ['18'],
    prompt: question.prompt,
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: `${question.id}.answer`, label: '답안', input: 'textarea' }],
    model_answer: question.model_answer,
    requirements: question.requirements,
    criteria: question.criteria,
});

const standardsSet = {
    schema_version: '3.0',
    id: 'pilot-18-005-standards-20260921',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '소규모기업 감사기준의 적용대상 요건',
    classification: {
        topic_id: '18',
        part: 'PART4',
        chapter: '소규모기업 감사',
        domain: 'audit',
        standards: ['KGA 1200'],
        tags: ['소규모기업 감사', '적용대상', '기준서형'],
    },
    source_refs: standardsRefs,
    shared_context: { facts: [] },
    learning_order: ['sub1', 'sub2'],
    subquestions: [
        standardsShell({
            id: 'sub1',
            type: 'enumeration',
            prompt: '감사기준서 1200(소규모기업 재무제표에 대한 감사) 문단 2(a)는 소규모기업에 해당하려면 일정한 기업 범주 중 어느 것에도 해당하지 않아야 한다고 정한다. 그 (i)부터 (vi)까지의 기업 범주를 모두 제시하시오. 각 범주는 관련 법률의 조문번호 없이 제시하여도 된다.',
            model_answer: originSub('sub1').model_answer,
            requirements: [
                { id: 'sub1.req1', source_ref_id: 'kga1200-2', source_quote: quoteOf('kga1200-2'), source_span: 'KGA 1200 문단 2 본문 및 (a)(i)~(vi)·(b); 2025 개정 전문 원문 페이지 909' },
                { id: 'sub1.req2', source_ref_id: 'kga1200-3', source_quote: quoteOf('kga1200-3'), source_span: 'KGA 1200 문단 3 및 각주 1~5; 2025 개정 전문 원문 페이지 909' },
            ],
            criteria: [
                inheritCriterion('sub1', 'crit1', 'crit1', 'sub1.req1'),
                inheritCriterion('sub1', 'crit2', 'crit2', 'sub1.req1'),
                inheritCriterion('sub1', 'crit3', 'crit3', 'sub1.req1'),
                inheritCriterion('sub1', 'crit4', 'crit4', 'sub1.req1'),
                inheritCriterion('sub1', 'crit5', 'crit5', 'sub1.req1'),
                inheritCriterion('sub1', 'crit6', 'crit6', 'sub1.req1'),
            ],
        }),
        standardsShell({
            id: 'sub2',
            type: 'descriptive',
            prompt: '감사기준서 1200(소규모기업 재무제표에 대한 감사) 문단 2(b)는 소규모기업에 해당하기 위한 규모 요건을 정한다. 그 규모 요건의 내용을 빠짐없이 설명하시오.',
            model_answer: originSub('sub2').model_answer,
            requirements: [
                { id: 'sub2.req1', source_ref_id: 'kga1200-2', source_quote: quoteOf('kga1200-2'), source_span: 'KGA 1200 문단 2 본문 및 (a)(i)~(vi)·(b); 2025 개정 전문 원문 페이지 909' },
            ],
            criteria: [
                inheritCriterion('sub2', 'crit7', 'crit7', 'sub2.req1'),
                inheritCriterion('sub2', 'crit8', 'crit8', 'sub2.req1'),
                inheritCriterion('sub2', 'crit15', 'crit9', 'sub2.req1'),
                inheritCriterion('sub2', 'crit9', 'crit10', 'sub2.req1'),
                inheritCriterion('sub2', 'crit16', 'crit11', 'sub2.req1'),
                inheritCriterion('sub2', 'crit10', 'crit12', 'sub2.req1'),
            ],
        }),
    ],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-21 사용자 확정 정책(혼합 세트의 기준서형 물음은 퇴역시키지 않고 별도 기준서형 세트로 분리 보존)에 따라, 수정 요청서 40번 pilot-18-005의 기준서형 2물음(sub1 6점·sub2 6점)을 facts=[]로 옮긴 세트다. 선례는 pilot-07-006-standards-20260920, pilot-11-005-standards-20260921, pilot-16-008-standards-20260921이다. 이 세트는 퇴역 없이 추가만 한다.',
            'criterion의 claim·critical_facts·배점·모범답안·출처는 원 세트에서 그대로 승계했고 criterion id만 세트 안에서 crit1~crit12 연번으로 다시 매겼다(원 sub2의 crit7·crit8·crit15·crit9·crit16·crit10 순서를 유지하여 crit7~crit12). 인용 2개는 pilot-18-005의 등록 인용을 바이트와 content_hash 그대로 재사용했다.',
            '발문은 두 물음 모두 다시 썼다. 원 sub1의 "각 범주의 시기적·법적 범위가 드러나도록 답하되"와 원 sub2의 "금액을 읽는 재무제표의 기준, 자산과 매출 각각의 대상 시점·기간 및 금액 경계, 두 금액 조건 사이의 논리관계를 구별하여 제시하시오"는 답안의 목차를 발문에 적은 것이어서 기준서형 발문의 정답 암시 금지에 걸린다. 범위는 문단·항 기호(문단 2(a)의 (i)~(vi), 문단 2(b))로만 정했다. 사유는 같은 폴더의 lineage.json에 적었다.',
            '사용자가 확정한 대상 연도는 2027년이다. KGA 1200 2025 개정 전문(문단 8: 2023년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 적용)을 기준으로 한다.',
            'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 4. 검사와 출력 ────────────────────────────────────────────────────────────
const points = (set) => set.subquestions.reduce((sum, q) => sum + q.criteria.reduce((n, c) => n + c.max_points, 0), 0);
const factLength = caseSet.shared_context.facts.map((f) => f.text).join('\n').length;
if (factLength < 400) throw new Error(`사례 사실관계는 400자 이상이어야 합니다: ${factLength}`);

const write = (file, value) => fs.writeFileSync(path.join(here, file), `${JSON.stringify(value, null, 2)}\n`);
write('sets.json', [caseSet]);
write('standards-sets.json', [standardsSet]);
console.log(JSON.stringify({
    case: { id: caseSet.id, subquestions: caseSet.subquestions.length, points: points(caseSet), facts_chars: factLength },
    standards: { id: standardsSet.id, subquestions: standardsSet.subquestions.length, points: points(standardsSet) },
}, null, 2));
