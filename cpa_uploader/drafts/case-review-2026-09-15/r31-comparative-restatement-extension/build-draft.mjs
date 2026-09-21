// r31: 대상 갱신본 case-16-comparative-restatement-20260919(2물음 7점)의 확장 초안과
// 수정 요청서 4번 pilot-16-008에 섞여 있던 기준서형 2물음의 분리 보존 세트를 만든다.
//
//   node cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension/build-draft.mjs
//
// 인용은 (1) 두 원 세트가 이미 담고 있는 정본 인용을 바이트와 content_hash 그대로 재사용하고,
// (2) 새 물음 3의 근거인 KGA 710 문단 7·8만 이미 등록된 공식 전문에서 줄 범위로 발췌한다.
// 해시는 인용 문자열의 SHA-256이다. 새 원자료 수집은 없다.
//
// 방식 고정: KGA 710은 대응수치(문단 10~14)와 비교재무제표(문단 15~19)의 보고 요구가 다르다.
// 사례형 세트는 대상 갱신본이 이미 외부감사법에 따른 비교재무제표 방식으로 확정되어 있으므로
// 비교재무제표 방식 하나로 고정하고, 대응수치 방식만 다루는 pilot-16-008의 요구는 사례형으로
// 승계하지 않는다. 기준서형 세트는 원 세트 그대로 대응수치 방식 하나만 다룬다. lineage.json 참조.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');

const BANK = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const OFFICIAL_710 = 'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt';
const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const byId = new Map(bank.map((set) => [set.id, set]));

const TARGET = 'case-16-comparative-restatement-20260919';
const PILOT = 'pilot-16-008';

function set(id) {
    const value = byId.get(id);
    if (!value) throw new Error(`정본에 세트가 없습니다: ${id}`);
    return value;
}

function reuseRef(setId, refId) {
    const ref = (set(setId).source_refs || []).find((item) => item.id === refId);
    if (!ref) throw new Error(`${setId}에 source_ref가 없습니다: ${refId}`);
    return { ...ref };
}

function sub(setId, subId) {
    const value = set(setId).subquestions.find((item) => item.id === subId);
    if (!value) throw new Error(`${setId}에 물음이 없습니다: ${subId}`);
    return value;
}

function fact(setId, factId) {
    const value = set(setId).shared_context.facts.find((item) => item.id === factId);
    if (!value) throw new Error(`${setId}에 fact가 없습니다: ${factId}`);
    return { ...value };
}

function extract(relativeFile, fromLine, toLine) {
    const raw = fs.readFileSync(path.join(root, relativeFile), 'utf8');
    return raw.split('\n').slice(fromLine - 1, toLine).join('\n').replace(/\r$/, '');
}

function hash(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── 1. 사례형 세트의 출처 ────────────────────────────────────────────────────
// 대상 갱신본의 인용 15개를 바이트 그대로 재사용하고, 새 물음 3의 근거인 문단 7·8만 발췌한다.
const reusedCaseRefIds = [
    'kga700-16', 'kga705-5a', 'kga705-7', 'kga705-8', 'kga706-7', 'kga706-8',
    'kga710-6c', 'kga710-9', 'kga710-15', 'kga710-16', 'kga710-17', 'kga710-18',
    'kga710-A1', 'kga710-A9', 'kga710-A12',
];

const newCaseRefs = [
    {
        id: 'kga710-7',
        file: OFFICIAL_710,
        title: 'KGA 710 문단 7(a)·(b), 2025 개정 전문 원문 PDF 788쪽; L395-L402',
        page: 'KGA 710',
        quote: extract(OFFICIAL_710, 395, 402),
        role: 'standard',
    },
    {
        id: 'kga710-8',
        file: OFFICIAL_710,
        title: 'KGA 710 문단 8, 2025 개정 전문 원문 PDF 788쪽; L403-L408',
        page: 'KGA 710',
        quote: extract(OFFICIAL_710, 403, 408),
        role: 'standard',
    },
];

const caseSourceRefs = [
    ...reusedCaseRefIds.map((id) => reuseRef(TARGET, id)),
    ...newCaseRefs.map((ref) => ({
        id: ref.id,
        file: ref.file,
        title: ref.title,
        page: ref.page,
        source_quote: ref.quote,
        role: ref.role,
        content_hash: hash(ref.quote),
    })),
];

// ── 2. 사례형 세트의 사실관계 ────────────────────────────────────────────────
// fact1·fact2·fact3은 대상 갱신본에서 바이트 그대로 승계한다. 항목 ①~⑨의 옳고 그름과 근거가
// 이미 검토를 통과했으므로 다시 나누지 않는다. fact4는 물음 3을 위해 새로 쓴 20X2년 비교정보
// 감사절차 단계이며, 같은 기준에서 결론이 갈리는 항목을 넣지 않았다.
const fact4 = {
    id: 'fact4',
    text: [
        '소담회계법인이 20X2년 재무제표를 감사하면서 비교정보에 대하여 수행한 절차는 다음과 같다.',
        '⑩ 감사팀은 20X2년 재무제표에 비교정보로 표시된 20X1년의 금액과 공시가 재작성된 20X1년 재무제표의 금액 및 공시와 일치하는지 여부를 결정하였다.',
        '⑪ 감사팀은 20X2년 재무제표의 비교정보에 반영된 회계정책이 20X2년의 회계정책과 일관성이 있는지, 회계정책의 변경이 있었다면 그 변경이 적절히 회계처리되고 적절하게 표시 및 공시되었는지를 평가하였다.',
        '⑫ 감사팀은 20X1년 재무제표에 관한 서면진술을 20X1년 감사에서 이미 입수하였으므로, 20X2년 감사에서는 경영진에게 20X2년 재무제표에 관한 서면진술만 요청하였다.',
    ].join('\n'),
    scoreable: false,
};

const caseFacts = [fact(TARGET, 'fact1'), fact(TARGET, 'fact2'), fact(TARGET, 'fact3'), fact4];

// ── 3. 사례형 세트의 물음 ────────────────────────────────────────────────────
// criterion·requirement id는 세트 전체 연번(crit1~crit9, req1~req9)으로 다시 매긴다.
// 채점 모델이 물음 접두사가 붙은 id를 되돌려 주지 않도록 하기 위한 계약이다.
const CASE_PROMPTS = {
    sub1: '전기 재무제표에서 발견한 왜곡표시를 처리하고 그 결과를 20X1년 감사보고서에 반영하는 단계에서 업무수행이사와 감사팀이 수행한 절차와 판단 ①~⑤ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
    sub2: '비교표시되는 각 기간의 재무제표에 관한 감사의견을 형성하고 20X2년 감사보고서를 구성하는 단계에서 업무수행이사가 내린 판단 ⑥~⑨ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
    sub3: '비교정보에 대한 감사절차를 수행하고 서면진술을 요청하는 단계에서 감사팀이 수행한 절차 ⑩~⑫ 중 감사기준에 비추어 옳지 않은 것을 모두 찾아 번호를 쓰고, 각각에 대하여 옳지 않은 이유나 감사인이 수행하였어야 할 절차를 간략히 서술하시오.',
};

// 대상 갱신본의 물음별 criterion·requirement를 순서대로 새 id에 대응시킨다.
const carried = [
    { id: 'sub1', from: 'sub1', criteria: ['crit1', 'crit2', 'crit3', 'crit4'], requirements: ['req1', 'req2', 'req3', 'req4'], topic_ids: ['16', '03', '12'] },
    { id: 'sub2', from: 'sub2', criteria: ['crit5', 'crit6', 'crit7'], requirements: ['req5', 'req6', 'req7'], topic_ids: ['16', '15'] },
];

const carriedSubquestions = carried.map((row) => {
    const source = sub(TARGET, row.from);
    if (source.criteria.length !== row.criteria.length) throw new Error(`${row.from}: criterion 수가 다릅니다.`);
    if (source.requirements.length !== row.requirements.length) throw new Error(`${row.from}: requirement 수가 다릅니다.`);
    const requirementIdByOld = new Map(source.requirements.map((item, index) => [item.id, row.requirements[index]]));
    return {
        id: row.id,
        type: source.type,
        question_style: 'case',
        topic_ids: row.topic_ids,
        prompt: CASE_PROMPTS[row.id],
        constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
        selection: { type: 'all', n: null },
        decision: null,
        answer_slots: [{ id: `${row.id}.answer`, label: '답안', input: 'textarea' }],
        model_answer: [...source.model_answer],
        requirements: source.requirements.map((item, index) => ({
            id: row.requirements[index],
            source_ref_id: item.source_ref_id,
            source_quote: item.source_quote,
            source_span: item.source_span,
        })),
        criteria: source.criteria.map((item, index) => ({
            id: row.criteria[index],
            requirement_id: requirementIdByOld.get(item.requirement_id),
            claim: item.claim,
            critical_facts: item.critical_facts.map((critical, position) => ({
                id: `${row.criteria[index]}.fact${position === 0 ? '' : position + 1}`,
                type: critical.type,
                expected: critical.expected,
            })),
            max_points: item.max_points,
            scores: { ...item.scores },
            source_ref_ids: [...item.source_ref_ids],
        })),
    };
});

const WRONG_TWELVE = '⑫ 비교재무제표에서 감사의견은 재무제표가 표시되는 각각의 기간과 감사의견이 표명되는 각각의 기간을 언급하므로, 감사인은 감사의견에서 언급된 모든 기간에 대하여 서면진술을 요구하여야 한다. 경영진이 전기 재무제표에 대하여 이전에 행한 서면진술이 계속 적절하다는 점을 재확인할 필요가 있으므로, 20X2년 감사에서 20X1년 재무제표에 관한 서면진술도 함께 요청하여야 한다.';

const IDENTIFY_TWELVE = '옳지 않은 것으로 ⑫를 지적한다. 번호 대신 내용으로 특정해도 인정한다. ⑫를 빠뜨리거나, 옳은 것인 ⑩(비교정보가 재작성된 20X1년 재무제표의 금액 및 공시와 일치하는지 여부를 결정), ⑪(비교정보에 반영된 회계정책이 당기의 회계정책과 일관성이 있는지와 회계정책 변경의 회계처리·표시·공시를 평가)를 옳지 않다고 지적하면 이 점수는 주지 않는다.';

const REASON_TWELVE = '⑫ 비교재무제표에서 감사의견은 재무제표가 표시되는 각각의 기간과 감사의견이 표명되는 각각의 기간을 언급하므로 감사인은 감사의견에서 언급된 모든 기간에 대하여 서면진술을 요구하여야 하고, 경영진이 전기 재무제표에 대하여 이전에 행한 서면진술이 계속 적절하다는 점을 재확인할 필요가 있으므로 20X2년 감사에서 20X1년 재무제표에 관한 서면진술도 함께 요청하여야 한다는 이유나 절차를 제시한다. 두 기간 모두에 대하여 서면진술을 받아야 한다는 취지면 인정하며 재확인이라는 표현은 요구하지 않는다. 전기 재무제표에 관한 서면진술은 전기 감사에서 이미 입수하였으므로 다시 요청할 필요가 없다고 쓰거나, 재작성에 관한 구체적 서면진술만 받으면 된다고 쓰면 인정하지 않는다.';

const caseSub3 = {
    id: 'sub3',
    type: 'judgment',
    question_style: 'case',
    topic_ids: ['16'],
    prompt: CASE_PROMPTS.sub3,
    constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
    selection: { type: 'all', n: null },
    decision: null,
    answer_slots: [{ id: 'sub3.answer', label: '답안', input: 'textarea' }],
    model_answer: [
        '옳지 않은 것은 ⑫이다. ⑩은 전기 재무제표가 재작성되었으므로 비교정보가 재작성된 20X1년 재무제표의 금액 및 공시와 일치하는지 여부를 결정한 것이고, ⑪은 비교정보에 반영된 회계정책이 당기의 회계정책과 일관성이 있는지와 회계정책의 변경이 적절히 회계처리되고 표시·공시되었는지를 평가한 것이므로 옳다.',
        WRONG_TWELVE,
    ],
    requirements: [
        {
            id: 'req8',
            source_ref_id: 'kga710-9',
            source_quote: reuseRef(TARGET, 'kga710-9').source_quote,
            source_span: 'KGA 710 문단 9·A1·15, 문단 7·8; 식별 기준: ⑫(20X1년 재무제표에 관한 서면진술을 전기 감사에서 이미 입수하였다는 이유로 20X2년 감사에서 20X2년 재무제표에 관한 서면진술만 요청)는 옳지 않다. ⑩은 KGA 710 문단 7(a) 후단과 문단 8 후단(전기재무제표가 수정되었다면 비교정보가 수정된 재무제표와 일치하는지 여부를 결정), ⑪은 문단 7(b)(비교정보에 반영된 회계정책의 당기 회계정책과의 일관성, 회계정책 변경의 회계처리·표시·공시)에 따라 옳다.',
        },
        {
            id: 'req9',
            source_ref_id: 'kga710-A1',
            source_quote: reuseRef(TARGET, 'kga710-A1').source_quote,
            source_span: 'KGA 710 문단 9 전단·A1 전단·문단 15; 적용: 비교재무제표에서 감사의견은 표시되는 각 기간과 의견이 표명되는 각 기간을 언급하므로 서면진술은 감사의견에서 언급된 모든 기간에 대하여 요청되며, 경영진이 전기재무제표에 대하여 이전에 행한 서면진술이 계속 적절하다는 점을 재확인할 필요가 있다. 전기 감사에서 이미 서면진술을 입수하였다는 사실은 이 요구를 면제하지 않는다.',
        },
    ],
    criteria: [
        {
            id: 'crit8',
            requirement_id: 'req8',
            claim: IDENTIFY_TWELVE,
            critical_facts: [{ id: 'crit8.fact', type: 'conclusion', expected: IDENTIFY_TWELVE }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga710-9', 'kga710-A1', 'kga710-15', 'kga710-7', 'kga710-8'],
        },
        {
            id: 'crit9',
            requirement_id: 'req9',
            claim: REASON_TWELVE,
            critical_facts: [{ id: 'crit9.fact', type: 'action', expected: REASON_TWELVE }],
            max_points: 1,
            scores: { met: 1, not_met: 0, contradicted: 0 },
            source_ref_ids: ['kga710-A1', 'kga710-9', 'kga710-15'],
        },
    ],
};

const caseSet = {
    schema_version: '3.0',
    id: 'case-16-comparative-restatement-20260921',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '비교재무제표 방식에서 전기 재무제표의 재작성과 감사보고',
    classification: {
        topic_id: '16',
        part: 'PART4',
        chapter: '핵심감사사항·강조사항·비교정보·기타정보',
        domain: 'audit',
        standards: ['KGA 700', 'KGA 705', 'KGA 706', 'KGA 710'],
        tags: ['비교재무제표', '전임감사인', '사례형'],
    },
    source_refs: caseSourceRefs,
    shared_context: { facts: caseFacts },
    learning_order: ['sub1', 'sub2', 'sub3'],
    subquestions: [...carriedSubquestions, caseSub3],
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-21 C등급 확장 회차 r31의 초안이다. 대상 갱신본 case-16-comparative-restatement-20260919(2물음 7점)과 수정 요청서 4번 pilot-16-008을 함께 퇴역시키고, pilot-16-008의 기준서형 2물음은 pilot-16-008-standards-20260921로 분리 보존한다.',
            'KGA 710은 대응수치(문단 10~14)와 비교재무제표(문단 15~19)에서 감사보고 요구가 다르다. 대상 갱신본은 외부감사법에 따른 감사로 문단 2에 따라 비교재무제표 방식이 적용되는 사례이고 항목 ①~⑨의 근거가 문단 9·15·16·17·18과 A1·A9·A12이므로 이 세트는 비교재무제표 방식 하나로 고정했다. pilot-16-008의 사례형 물음 2개는 대응수치 방식의 문단 11만 다루고 그 세트의 전제가 "외부감사법에 따라 비교재무제표 방식으로 보고하는 감사를 전제로 하지 않는다"이므로 이 사례로 승계하지 않았다. 승계하지 않은 요구와 판단 근거는 같은 폴더의 lineage.json에 있다.',
            '대상 갱신본의 사실 fact1·fact2·fact3과 항목 ①~⑨, 물음별 criterion·claim·모범답안·인용은 바이트 그대로 승계했고 물음 경계만 단계별로 다시 그었다(물음 1=①~⑤, 물음 2=⑥~⑨). criterion id는 채점 모델이 물음 접두사가 붙은 id를 되돌려 주지 않도록 sub1.c1~sub2.c3에서 세트 전체 연번 crit1~crit7로 다시 매겼고 requirement id도 req1~req7로 바꾸었다. 대응표는 lineage.json에 있다.',
            '새 물음 3(fact4의 ⑩~⑫, crit8·crit9)은 대상 갱신본에 없던 비교정보에 대한 감사절차와 비교재무제표의 서면진술 범위를 더한 확장이다. 옳지 않은 항목 ⑫의 근거는 KGA 710 문단 9 전단·A1 전단과 문단 15이고, 옳은 항목 ⑩·⑪은 문단 7(a)·(b)와 문단 8 후단으로 확정했다. 문단 7·8 인용은 이미 등록된 공식 전문 cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt의 L395-L402·L403-L408에서 발췌했고 새 원자료 수집은 없다.',
            '물음마다 옳지 않은 항목 수를 밝히지 않고 다르게 두었다(물음 1은 3개, 물음 2는 2개, 물음 3은 1개). 배점은 물음마다 옳지 않은 항목 전체를 정확히 고른 식별 1점과 옳지 않은 항목마다 이유 또는 보완절차 1점이며, 옳은 항목 ②·④·⑥·⑨·⑪·⑫에는 별도 득점 기준이 없다. 합계는 4+3+2=9점이다.',
            '사용자가 확정한 대상 연도는 2027년이다. 20X1년을 2026년 1월 1일 개시 보고기간, 20X2년을 2027년 1월 1일 개시 보고기간으로 보고, 20X0년(2025년)은 전임감사인이 감사한 기간으로 판단 대상이 아니다. KGA 700·705·706·710은 2025 개정 전문과 2026 전문 모두 2026년 1월 1일 이후 개시 보고기간부터 시행하며, 인용한 문단(700.16, 705.5(a)·7·8, 706.7·8, 710.6(c)·7·8·9·15~18·A1·A9·A12)의 본문은 두 판본이 같다. 비상장회사인 이 사례에 2027년 이후 개시 보고기간부터 새로 시행되는 규정은 적용되지 않는다.',
            'agent 내용검토·작성자 기대값과 실제 Luna 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 4. 기준서형 분리 보존 세트 ───────────────────────────────────────────────
// pilot-16-008의 기준서형 물음 sub2(문단 12)·sub3(문단 13)을 퇴역시키지 않고 독립 세트로 옮긴다.
// facts=[]이며 부모 사례 없이 한 물음만으로 풀린다. 이 세트는 퇴역 없이 추가만 한다.
const standardsSourceRefs = ['scope', 'p12', 'p13'].map((id) => reuseRef(PILOT, id));

const STANDARDS_PROMPTS = {
    sub2: '감사기준서 710의 대응수치 방식이 적용되는 감사에서, 이전에 적정의견이 표명되었던 전기재무제표에 중요한 왜곡표시가 존재한다는 감사증거를 감사인이 입수하였으나 대응수치가 적절하게 재작성되지 않았거나 적절한 공시가 이루어지지 않았다. 감사기준서 710 문단 12가 이 경우에 대하여 정하고 있는 당기재무제표에 대한 감사의견을 제시하시오.',
    sub3: '감사기준서 710의 대응수치 방식이 적용되는 감사에서 전기재무제표가 전임감사인의 감사를 받았고, 감사인이 대응수치에 대하여 전임감사인의 감사보고서를 언급하는 것이 법규상 금지되지 아니하여 감사인이 이를 언급하기로 결정하였다. 이 경우 감사기준서 710 문단 13의 (a), (b), (c)에 따라 감사보고서의 기타사항문단에 기재하여야 할 사항을 모두 제시하시오.',
};

const standardsCarried = [
    { id: 'sub2', criteria: ['crit1', 'crit2'], requirement: 'req1', topic_ids: ['16'] },
    { id: 'sub3', criteria: ['crit3', 'crit4', 'crit5', 'crit6'], requirement: 'req2', topic_ids: ['16'] },
];

const standardsSubquestions = standardsCarried.map((row) => {
    const source = sub(PILOT, row.id);
    if (source.criteria.length !== row.criteria.length) throw new Error(`${row.id}: criterion 수가 다릅니다.`);
    if (source.requirements.length !== 1) throw new Error(`${row.id}: requirement가 하나여야 합니다.`);
    const [requirement] = source.requirements;
    return {
        id: row.id,
        type: source.type,
        question_style: 'standard',
        topic_ids: row.topic_ids,
        prompt: STANDARDS_PROMPTS[row.id],
        constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
        selection: { type: 'all', n: null },
        decision: null,
        answer_slots: [{ id: `${row.id}.answer`, label: '답안', input: 'textarea' }],
        model_answer: [...source.model_answer],
        requirements: [{
            id: row.requirement,
            source_ref_id: requirement.source_ref_id,
            source_quote: requirement.source_quote,
            source_span: requirement.source_span,
        }],
        criteria: source.criteria.map((item, index) => ({
            id: row.criteria[index],
            requirement_id: row.requirement,
            claim: item.claim,
            critical_facts: item.critical_facts.map((critical, position) => ({
                id: `${row.criteria[index]}.fact${position === 0 ? '' : position + 1}`,
                type: critical.type,
                expected: critical.expected,
            })),
            max_points: item.max_points,
            scores: { ...item.scores },
            source_ref_ids: [...item.source_ref_ids],
        })),
    };
});

const standardsSet = {
    schema_version: '3.0',
    id: 'pilot-16-008-standards-20260921',
    type: 'linked_question_set',
    status: 'needs_review',
    title: '대응수치에 관한 감사보고 요구사항',
    classification: {
        topic_id: '16',
        part: 'PART4',
        chapter: '감사보고 특수사항',
        domain: 'audit',
        standards: ['KGA 710'],
        tags: ['대응수치', '전임감사인', '기준서형'],
    },
    source_refs: standardsSourceRefs,
    shared_context: { facts: [] },
    learning_order: ['sub2', 'sub3'],
    subquestions: standardsSubquestions,
    verification: {
        source_fidelity: 'reconstructed',
        review_status: 'needs_human_review',
        calculation_required: false,
        notes: [
            '2026-09-21 사용자 확정 정책에 따라 수정 요청서 4번(pilot-16-008)에 섞여 있던 기준서형 물음 sub2·sub3을 퇴역시키지 않고 독립 기준서형 세트로 분리 보존한 초안이다(2026-09-20 r17의 pilot-07-006-standards-20260920, 2026-09-21 r21의 pilot-11-005-standards-20260921 선례). 사례형 확장본은 case-16-comparative-restatement-20260921이며, 이 세트는 퇴역 없이 추가만 한다.',
            '물음 ID(sub2·sub3), 여섯 개의 정답 명제, 정수 배점(각 1점, 합계 6점), 모범답안, 인용(KGA 710 문단 2·12·13)을 원 세트에서 승계했다. criterion ID는 채점 모델이 물음 접두사가 붙은 id를 되돌려 주지 않도록 crit5·crit5.p2·crit6~crit9에서 세트 전체 연번 crit1~crit6으로 다시 매겼고, requirement ID도 req12·req13에서 req1·req2로 바꾸었다. 대응표는 lineage.json의 standards_split에 있다.',
            '원 발문은 상황 서술을 앞세워 pilot-16-008의 사례형 물음과 한 세트를 이루고 있었다. 분리하면서 적용 조건을 기준서의 서술로 다시 쓰고 범위는 문단·항 기호(문단 12, 문단 13의 (a)·(b)·(c))로만 정했다. 정답 항목의 핵심어·결론·개수는 발문에 쓰지 않았고, 원 세트의 발문 바이트와도 겹치지 않게 했다.',
            'KGA 710 문단 2는 주식회사 등의 외부감사에 관한 법률에 의한 감사일 경우 비교재무제표 방식에 따라 보고하도록 하므로, 이 세트의 두 물음은 발문에서 대응수치 방식이 적용되는 감사임을 먼저 정한다. 대응수치 방식과 비교재무제표 방식을 한 학습 단위에 섞지 않았다.',
            '적용 판본은 KGA 710의 2025 개정 전문이다(문단 4: 2026년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 시행). 대상 시험 연도는 2027년이다. 인용 세 개(문단 2·12·13)는 pilot-16-008의 정본 인용을 바이트와 content_hash 그대로 재사용했고 새 원자료 수집은 없다.',
            'agent 내용검토·작성자 기대값과 실제 모델 채점·사람 확인·정본 수록·운영 DB 반영은 별개이며 이 초안 생성으로 완료되지 않는다.',
        ],
    },
};

// ── 5. 출력 ──────────────────────────────────────────────────────────────────
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
fs.writeFileSync(path.join(here, 'sets.json'), serialize([caseSet]));
fs.writeFileSync(path.join(here, 'standards-sets.json'), serialize([standardsSet]));

const points = (value) => value.subquestions.reduce((sum, q) => sum + q.criteria.reduce((n, c) => n + c.max_points, 0), 0);
console.log(JSON.stringify({
    case: {
        id: caseSet.id,
        subquestions: caseSet.subquestions.length,
        criteria: caseSet.subquestions.reduce((n, q) => n + q.criteria.length, 0),
        points: points(caseSet),
        per_question: caseSet.subquestions.map((q) => ({ id: q.id, points: q.criteria.reduce((n, c) => n + c.max_points, 0) })),
        source_refs: caseSourceRefs.length,
        fact_chars: caseFacts.map((item) => item.text).join('\n').length,
    },
    standards: {
        id: standardsSet.id,
        subquestions: standardsSet.subquestions.length,
        criteria: standardsSet.subquestions.reduce((n, q) => n + q.criteria.length, 0),
        points: points(standardsSet),
        per_question: standardsSet.subquestions.map((q) => ({ id: q.id, points: q.criteria.reduce((n, c) => n + c.max_points, 0) })),
        source_refs: standardsSourceRefs.length,
    },
    wrong_item_reason_recorded: WRONG_TWELVE.slice(0, 12),
}, null, 2));
