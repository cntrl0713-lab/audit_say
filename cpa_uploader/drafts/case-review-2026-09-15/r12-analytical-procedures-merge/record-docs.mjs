// r12 초안의 설계·계보·QA 장부 기록기. sets.json 내용을 확정한 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r12-analytical-procedures-merge/record-docs.mjs
//
// 기존 파일이 있으면 쓰지 않는다(flag 'wx'). 초안을 고쳤으면 이 장부를 지우고 다시 실행한다.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const SET_ID = 'case-10-analytical-procedures-20260920';

const [draft] = JSON.parse(fs.readFileSync(path.join(here, 'sets.json'), 'utf8'));
if (draft.id !== SET_ID) throw new Error('set id 불일치');

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) });
const write = (name, value) => {
    fs.writeFileSync(path.join(here, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    console.log(`${name} 기록`);
};

const reviewedSha = reviewedContentHash(draft);

// ── design.json ──────────────────────────────────────────────────────────────
const design = {
    version: 1,
    set_id: SET_ID,
    route: 'case_merge',
    format: '옳지 않은 것 선택형(번호 + 이유 또는 보완절차 간략 서술)',
    user_requests: [
        '2026-09-20: "68 + 32로 r12 초안 만들어줘". 68번(case-10-completion-analytics-20260914)과 32번(pilot-10-007)을 합친 사례형 초안을 만든다.',
        '형식은 따로 지정하지 않아 학습 단위 계약의 기본인 옳지 않은 것 선택형을 적용했다. 구성은 실행 전에 사용자 확인을 받지 않았다.',
        '병합 전에 안내한 걸림돌(원 두 세트가 KGA 520 문단 7·A20의 같은 기준에서 결론이 갈리는 두 경우를 각각 정답으로 삼고 있음)은 사용자가 어느 쪽을 남길지 지정하지 않아, 68번 쪽(이미 입수한 증거로 설명을 평가)을 함정으로 남기고 32번의 차이 조사 요소를 삭제하는 것으로 정했다.',
    ],
    items: [
        {
            no: '①', question: 'sub1', verdict: 'correct', trap: false,
            summary: '이자비용 관련 경영진주장에 대하여 평가한 중요왜곡표시위험을 고려하여 실증적인 분석적절차가 적합한지를 결정',
            basis: 'KGA 520 문단 5(a). 주어진 경영진주장에 대한 평가된 중요왜곡표시위험을 고려하여 특정 실증적인 분석적절차가 적합한지를 결정하도록 요구한다.',
        },
        {
            no: '②', question: 'sub1', verdict: 'incorrect', trap: false,
            summary: '회사 자금팀이 정리한 명세의 합계가 총계정원장과 크게 다르지 않다는 확인으로 자료 검토를 마치고 기대치 도출 자료로 이용',
            basis: 'KGA 520 문단 5(b)·A12·A13. 기대치가 도출될 데이터의 신뢰성을 평가하면서 이용가능한 정보의 원천·비교가능성·성격과 관련성 및 그 작성에 대한 통제를 고려하여야 한다. 총액 일치만으로는 원천·작성 통제를 고려한 것이 아니다.',
        },
        {
            no: '③', question: 'sub1', verdict: 'incorrect', trap: false,
            summary: '금리조건과 실행·상환 시기가 다른 차입금을 하나의 연간 평균으로 묶은 값을 그대로 감사인의 기대치로 사용',
            basis: 'KGA 520 문단 5(c)·A15. 도출한 기대치가 중요한 왜곡표시를 식별할 정도로 충분히 정확한지를 평가하여야 하고, 정보가 세분될 수 있는 정도가 그 평가에 관련된다.',
        },
        {
            no: '④', question: 'sub1', verdict: 'incorrect', trap: false,
            summary: '절차 착수 전에 기준을 두지 않고, 차이가 나타나면 그때 재무제표 전체 중요성과 견주어 추가 조사 여부를 판단하기로 함',
            basis: 'KGA 520 문단 5(d)·A16. 문단 7의 추가 조사 없이 수용될 수 있는 기록금액과 기대치의 차이금액을 절차의 설계·수행 단계에서 결정하여야 한다.',
        },
        {
            no: '⑤', question: 'sub1', verdict: 'correct', trap: true,
            summary: '세부테스트를 결합하지 않고 실증적인 분석적절차만을 단독으로 수행하기로 함',
            basis: 'KGA 520 문단 5 본문. 실증절차로서의 분석적절차는 단독으로 또는 세부테스트와 결합하여 설계·수행할 수 있다. 자료 1에서 이자비용 관련 주장에 유의적 위험이 식별되지 않았음을 밝혀 다른 해석을 배제했다. 실증적 분석절차는 반드시 세부테스트와 결합해야 한다는 오해를 겨냥한 함정이다.',
        },
        {
            no: '⑥', question: 'sub2', verdict: 'incorrect', trap: false,
            summary: '감사종료에 근접한 시점의 분석적절차를 따로 설계하지 않고 위험평가 단계의 상반기 분석 결과로 갈음하기로 함',
            basis: 'KGA 520 문단 6·A17. 감사의 종료시점에 근접하여 기업에 대하여 이해한 바와 재무제표가 일관성이 있는지에 대한 전반적인 결론을 내리기 위한 분석적절차를 설계·수행하여야 하고, 그 결론은 개별 부문·요소에 대하여 감사 중 형성한 결론을 확인하기 위한 것이다.',
        },
        {
            no: '⑦', question: 'sub2', verdict: 'incorrect', trap: false,
            summary: '위험평가 단계 자료에 나타나지 않았던 12월 도매매출의 관계를 확인하고도 최초의 중요왜곡표시위험 평가를 그대로 둠',
            basis: 'KGA 315 문단 37, KGA 520 문단 A18. 최초 평가의 근거가 된 감사증거와 일관성이 없는 새로운 정보를 입수하면 식별 또는 평가를 수정하여야 하며, 분석적절차의 결과 이전에 인식되지 않았던 중요왜곡표시위험이 식별될 수 있다.',
        },
        {
            no: '⑧', question: 'sub2', verdict: 'correct', trap: false,
            summary: '12월 매출 증가에 대하여 영업부장에게 질문하고 그 답변과 관련하여 고객 인수자료·창고 출하기록을 입수하여 답변을 평가',
            basis: 'KGA 520 문단 7(a). 경영진에게 질문하고 경영진의 답변과 관련성이 있는 적합한 감사증거를 입수하도록 요구한다.',
        },
        {
            no: '⑨', question: 'sub2', verdict: 'correct', trap: true,
            summary: '다른 계정의 감사에서 이미 입수한 계약종료 정산자료·운행기록·급여자료로 재무이사의 설명이 뒷받침되는지 평가하고 운송업체로부터 새 확인서를 받지 않음',
            basis: 'KGA 520 문단 A20. 경영진의 답변과 관련된 감사증거는 감사의 진행 중에 입수한 다른 감사증거를 고려하여 그 답변을 평가함으로써 입수될 수 있다. 경영진의 설명에는 반드시 새로운 외부증거가 필요하다는 오해를 겨냥한 함정이다.',
        },
    ],
    questions: [
        {
            subquestion_id: 'sub1',
            question_style: 'case',
            type: 'judgment',
            topic_ids: ['10', '08'],
            case_fact_ids: ['fact1', 'fact2'],
            topic_reason:
                '10: 실증절차로서의 분석적절차를 설계·수행할 때의 적합성 결정, 기대치의 도출과 정확성 평가, 수용 차이금액 결정(KGA 520 문단 5(a)~(d)·A15·A16)을 해솔의 차입 구조와 담당자의 절차에 적용한다. 08: 기대치 도출에 이용하는 기업생성정보의 원천과 작성 통제 등 데이터 신뢰성 평가(문단 5(b)·A12·A13)를 자금팀 명세에 적용한다.',
            classification_note:
                '다섯 항목의 옳고 그름이 해솔의 차입금 구성·자료 출처·평가한 위험이라는 사실에 따라 달라지므로 사례형이다. 기준서 문단을 나열하는 것만으로는 ③·⑤의 판단이 성립하지 않는다.',
            criteria: [
                { id: 'sub1.c1', points: 1, meaning: '식별: ②·③·④를 고르고 ①·⑤는 고르지 않음' },
                { id: 'sub1.c2', points: 1, meaning: '②: 기대치 도출 데이터의 신뢰성 평가가 필요하다는 이유, 또는 독립된 원천과의 대조·작성 통제 테스트(이유 또는 절차 중 하나)' },
                { id: 'sub1.c3', points: 1, meaning: '③: 기대치의 충분한 정확성 평가가 필요하다는 이유, 또는 차입계약·기간별 세분화(이유 또는 절차 중 하나)' },
                { id: 'sub1.c4', points: 1, meaning: '④: 추가 조사 없이 수용할 차이금액을 절차 설계·수행 단계에서 결정(이유 또는 절차, A16의 방향만 써도 인정)' },
            ],
            minimum_sufficient_answer: '②·③·④를 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision:
                '4점. 식별 1점 + 옳지 않은 항목 세 개(②·③·④)에 각 1점. 옳은 항목 ①·⑤에는 별도 득점 기준을 두지 않는다. 원 pilot-10-007 sub2(3점, 기대치의 정확성 평가와 수용 차이금액 결정)와 exp1(2점, 차이 조사)의 5점을 대체한다. 데이터 신뢰성(②)은 원 세트가 사실로 이미 충족시켰던 전제를 득점 요건으로 올린 새 요구이고, 차이 조사(exp1)는 병합 기준에 따라 삭제했다. 자료 신뢰성 평가의 구체적 방법 나열이나 기대치 금액 계산은 요구하지 않는다.',
        },
        {
            subquestion_id: 'sub2',
            question_style: 'case',
            type: 'judgment',
            topic_ids: ['10', '06'],
            case_fact_ids: ['fact1', 'fact3'],
            topic_reason:
                '10: 감사종료에 근접한 시점의 분석적절차(KGA 520 문단 6·A17·A19)와 식별한 차이의 조사(문단 7(a)·A20)를 해솔의 최종 재무제표와 운송비 설명에 적용한다. 06: 위험평가 단계의 근거와 일관성이 없는 새로운 정보를 입수한 경우의 위험평가 수정(KGA 315 문단 37, KGA 520 문단 A18)을 12월 도매매출의 관계에 적용한다.',
            classification_note:
                '네 항목의 옳고 그름이 해솔의 판매구조 변화, 12월 매출·출하수량·단가의 관계, 운송 전환에 관하여 이미 입수한 증거라는 사실에 따라 달라지므로 사례형이다.',
            criteria: [
                { id: 'sub2.c1', points: 1, meaning: '식별: ⑥·⑦을 고르고 ⑧·⑨는 고르지 않음' },
                { id: 'sub2.c2', points: 1, meaning: '⑥: 감사종료에 근접하여 전반적 결론을 위한 분석적절차를 수행해야 한다는 이유, 또는 최종 재무제표를 대상으로 한 분석(이유 또는 절차 중 하나)' },
                { id: 'sub2.c3', points: 1, meaning: '⑦: 일관성이 없는 새 정보를 입수하면 위험 식별·평가를 수정해야 한다는 이유, 또는 위험평가 수정과 계획된 추가감사절차 변경(이유 또는 절차 중 하나)' },
            ],
            minimum_sufficient_answer: '⑥·⑦을 고르고 각각 한 문장씩 이유나 보완절차를 쓴다.',
            point_decision:
                '3점. 식별 1점 + 옳지 않은 항목 두 개(⑥·⑦)에 각 1점. 옳은 항목 ⑧·⑨에는 별도 득점 기준을 두지 않는다. 원 case-10-completion-analytics-20260914의 sub1(2점)·sub2(2점)·sub3(2점) 6점을 대체한다. sub1의 종결 분석 요구는 ⑥으로, sub2의 위험 재평가 요구는 ⑦로 승계하고, sub3(이미 입수한 증거로 경영진 설명 평가)은 병합 기준에 따라 함정 ⑨로 전환하여 득점 기준에서 뺐다. 12월 거래에 대한 구체적 후속절차의 나열은 요구하지 않는다.',
        },
    ],
    exam_elements: {
        note: '병합 초안이므로 새 기출 요소를 주장하지 않는다. 두 원 세트가 이미 다루던 요구를 한 사례로 합치고 데이터 신뢰성(문단 5(b)) 항목만 득점 요건으로 새로 올렸다.',
        reused_from: [
            { set_id: 'pilot-10-007', elements: 'KGA 520 문단 5(c)·5(d)·A15·A16의 사례 적용' },
            { set_id: 'case-10-completion-analytics-20260914', elements: 'KGA 520 문단 6·A17·A19, 문단 7(a)·A20, KGA 315 문단 37의 사례 적용' },
        ],
    },
    spoiler_review: {
        title_and_tags: '제목("차입금 이자비용의 분석과 감사종료 전 최종 자료의 검토")과 태그는 다루는 절차의 범위만 알려 주고 어느 항목이 옳지 않은지, 어떤 결론을 내려야 하는지는 알려 주지 않는다.',
        person_claims: '원 세트의 담당자 갑·팀원 을·담당자의 틀린 주장은 모두 제거하고, 각 항목을 감사팀이 수행하거나 결정한 절차·판단으로 다시 썼다. 다만 ⑥은 원 세트와 같이 담당자 갑의 결정으로 남겼고 이는 주장이 아니라 계획한 처리다.',
        reason_symmetry: '아홉 항목 모두에 절차를 택한 사실상의 이유를 붙였다. 옳지 않은 항목에만 근거를 붙이거나 같은 근거를 되풀이하지 않았다.',
        contrasting_pairs:
            'KGA 520 문단 7·A20·A21의 같은 기준에서 결론이 갈리는 두 경우(설명이 기존 증거로 뒷받침되는 경우와 뒷받침되지 않는 경우)는 한쪽만 남겼다. ⑨(뒷받침되는 경우, 옳음)를 함정으로 두고, 원 pilot-10-007의 이자감면 사례(뒷받침되지 않아 기타 감사절차가 필요한 경우)는 삭제했다. 그 결과 목록에는 질문만 하고 증거 없이 조사를 끝낸 항목이 없다.',
        within_question_pairs:
            'sub1의 ②(신뢰성)·③(정확성)·④(수용 차이금액)는 문단 5의 서로 다른 항이고, ①·⑤는 문단 5(a)와 문단 5 본문으로 각각 다른 명제다. sub2의 ⑥(문단 6)·⑦(315.37)·⑧(문단 7(a))·⑨(A20)도 명제가 서로 달라 한 항목의 결론이 다른 항목의 판단 기준을 알려 주지 않는다.',
        ordering:
            '뒤 항목의 사실이 앞 항목의 옳고 그름을 드러내지 않는지 확인했다. ⑦에서 업무수행이사가 최종 자료를 검토하다 관계를 발견한 것은 ⑥이 생략한 설계된 분석적절차와 구분되며, ⑧·⑨의 조사 절차도 ⑥·⑦의 판단을 드러내지 않는다.',
        residual_observation:
            '⑥(감사종료 분석을 위험평가 단계 분석으로 갈음)과 ⑦의 발견 경위는 한 사례 안에서 긴장이 있다. 원 case-10-completion-analytics-20260914도 같은 구조(담당자의 생략 제안과 책임자의 최종 자료 검토)였고, 두 항목의 위반 근거가 서로 독립적이어서 그대로 두었다.',
    },
    nonduplication: {
        method: '현재 정본에서 KGA 520을 인용한 모든 세트와 KGA 315 문단 37을 인용한 모든 세트를 찾아 발문·criterion을 대조했다.',
        compared: [
            { set_id: 'pilot-10-002', style: 'standard', difference: '문단 5(a)~(d)·7의 요구를 사실 없이 재현하도록 묻는 기준서형이다. 이 초안은 같은 문단을 해솔의 자료·차입 구조에 적용해 옳고 그름을 가리게 한다.' },
            { set_id: 'pilot-10-007-standards-20260913', style: 'standard', difference: '문단 A16의 고려 요소를 열거하게 하는 기준서형이다. 이 초안의 ④는 절차 착수 전 결정 여부를 사실에 적용해 판단하게 한다.' },
            { set_id: 'std-points-20260914-82e96243c6aa', style: 'standard', difference: '위험평가·종결 단계 분석의 목적과 단독/결합 사용의 고려사항을 서술하게 하는 기준서형이다. 이 초안의 ⑤·⑥은 그 일반 요구를 해솔의 사실에 적용한다.' },
            { set_id: 'std-points-20260914-7c8d41e23fcc', style: 'standard', difference: '일관되지 않은 새 정보를 입수한 경우의 조치를 서술하게 하는 기준서형이다. 이 초안의 ⑦은 12월 매출 관계가 그 상황인지부터 판단하게 한다.' },
            { set_id: 'pilot-06-008-standards-20260913', style: 'standard', difference: 'KGA 315 문단 23(경영진이 식별하지 못한 위험)을 다루며 문단 37의 수정 요구와 요구가 다르다.' },
        ],
        conclusion:
            '같은 문단을 인용하는 기존 문항은 모두 기준서형이며 사실 적용을 요구하지 않는다. 사례형으로 같은 문단을 다루던 세트는 이번에 병합하는 두 원 세트뿐이다.',
    },
    references_consulted: [
        'cpa_uploader/data/official/delegated-s04-kga-2025.txt (KGA 520 전체: 문단 1~7, A1~A21)',
        'cpa_uploader/data/official/kga315-330-2025-review06.txt (KGA 315 문단 37, A236 문맥)',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json (현재 정본 364세트의 KGA 520·315.37 인용 대조)',
        'docs/물음별-학습-단위와-분류-계약.md (사례형 발문과 절차 선택형, 배점과 물음별 타당성)',
        'docs/case-question-edit-notes-2026-09-14.md (공통 수정 기준)',
    ],
    edition: {
        target_exam_year: 2027,
        case_years: '20X1·20X2',
        assumption:
            '사례의 20X1년을 2026년 1월 1일 개시 보고기간으로 보고 2025 개정 전문을 기준으로 판단했다. KGA 520과 KGA 315 문단 37은 2025·2026 전문의 본문이 같다는 두 원 세트의 대조 기록(pilot-10-007 verification.notes, case-10-completion-analytics-20260914 source_span의 2026 전문 PDF 대조)을 재사용했다.',
    },
    target_reviewed_content_sha256: reviewedSha,
};

// ── lineage.json ─────────────────────────────────────────────────────────────
const lineage = {
    version: 1,
    set_id: SET_ID,
    merged_from: ['case-10-completion-analytics-20260914', 'pilot-10-007'],
    edit_note_numbers: { 68: 'case-10-completion-analytics-20260914', 32: 'pilot-10-007' },
    premise_reconciliation: [
        {
            item: '회사·감사인',
            before: '68번은 가람회계법인·해솔(생활용품 판매), 32번은 한결회계법인·다온(다수 은행 차입)이다.',
            after: '가람회계법인·해솔 하나로 합치고, 해솔에 여러 은행 차입과 고정·변동금리 구성을 더했다.',
        },
        {
            item: '보고기간',
            before: '두 원 세트 모두 2026년 재무제표를 감사한다고 썼다.',
            after: '공통 기준에 따라 20X1년 1월 1일~12월 31일, 감사보고서일 20X2년 3월 중순으로 바꾸었다.',
        },
        {
            item: '위험 상태',
            before: '32번은 이자비용의 유의적 위험 여부를 밝히지 않았다.',
            after: '⑤(분석적절차 단독 수행)의 판단이 다투어지지 않도록 이자비용 관련 주장에 유의적 위험이 식별되지 않았음을 자료 1에 두었다. 정답 결론을 알려 주지 않는 중립적 사실이다.',
        },
        {
            item: '독립 상황 표기',
            before: '두 원 세트 모두 "가와 나는 독립적인 상황", "A와 B는 독립적인 가상 상황" 같은 구분을 두었다.',
            after: '한 회사의 시간 순서(기중 실증 분석 → 감사종료 전 최종 자료 검토)로 통합해 독립 상황 표기를 없앴다.',
        },
    ],
    mapping: [
        {
            origin: 'pilot-10-007 fact2·sub2 (기대치 정확성 평가와 수용 차이금액 결정, 3점)',
            destination: 'sub1의 ③·④ (각 1점)',
            change: '승계. 담당자의 "절차를 마치려 한다"는 주장과 "아직 평가하지 않았다"는 미결 사실 표기를 없애고, 수행한 절차로 다시 썼다.',
        },
        {
            origin: 'pilot-10-007 fact1 (자료의 신뢰성 평가를 이미 마쳤다는 전제)',
            destination: 'sub1의 ② (1점)',
            change: '전제였던 사실을 득점 요건으로 올렸다. 회사 자금팀 명세를 총액 일치만 확인하고 이용한 항목으로 바꾸었다(문단 5(b)·A12·A13).',
        },
        {
            origin: 'pilot-10-007 fact3·exp1 (이자감면 설명이 은행 확인자료와 어긋나 기타 감사절차가 필요한 상황, 2점)',
            destination: '삭제',
            change:
                '학습 단위 계약의 "대조되는 두 경우를 함께 두지 않음"에 따라 삭제했다. 68번 sub3(이미 입수한 증거로 설명을 평가할 수 있는 경우)과 같은 KGA 520 문단 7·A20·A21에서 결론이 갈리는 두 경우이기 때문이다. 68번 쪽을 함정 ⑨로 남겼다.',
        },
        {
            origin: 'pilot-10-007 fact1 (실증적 분석절차가 적합하다고 판단했다는 전제)',
            destination: 'sub1의 ①·⑤ (옳은 항목, 별도 득점 없음)',
            change: '전제를 항목으로 전환했다. ①은 문단 5(a)의 적합성 결정, ⑤는 문단 5 본문의 단독 수행 허용을 겨냥한 함정이다.',
        },
        {
            origin: 'case-10-completion-analytics-20260914 fact1·sub1 (종결 분석 생략 제안의 평가, 2점)',
            destination: 'sub2의 ⑥ (1점)',
            change: '승계. 담당자 갑의 제안을 결정으로 바꾸고, 발문이 답의 구성 요소를 알려 주던 부분("어떤 기업 이해와 연결하여 무엇을 확인해야 하는지")을 없앴다.',
        },
        {
            origin: 'case-10-completion-analytics-20260914 fact2·sub2 (새 위험 추론과 보완 절차, 2점)',
            destination: 'sub2의 ⑦ (1점)',
            change:
                '위험평가 수정 요구(KGA 315 문단 37, KGA 520 문단 A18)로 좁혀 승계했다. 원 sub2가 함께 요구하던 구체적 보완절차(고객 인수자료·실제 출하일 대조)는 ⑧의 옳은 항목에 사실로 남기고 득점 요건에서는 뺐다. 미결 사실("아직 확인하지 않았다", "원인은 아직 밝혀지지 않았다")도 없앴다.',
        },
        {
            origin: 'case-10-completion-analytics-20260914 fact3·sub3 (을의 주장 평가와 기존 증거의 사용, 2점)',
            destination: 'sub2의 ⑨ (옳은 항목·함정, 별도 득점 없음)',
            change:
                '팀원 을의 틀린 주장을 없애고 감사팀이 실제로 한 처리로 바꾸어 함정으로 전환했다. 삭제한 pilot-10-007 exp1의 자리를 대신하며, 득점 요건에서는 빠졌다.',
        },
    ],
    points: {
        before: { 'case-10-completion-analytics-20260914': 6, 'pilot-10-007': 5, total: 11 },
        after: { sub1: 4, sub2: 3, total: 7 },
        reason:
            '선택형으로 바꾸면서 물음마다 식별 1점과 옳지 않은 항목별 1점 구조를 적용했다. 함정으로 전환한 요구(68번 sub3)와 병합 기준에 따라 삭제한 요구(32번 exp1)의 4점이 득점 요건에서 빠지고, 새로 올린 데이터 신뢰성 1점이 더해졌다. 옛 총점에 맞추기 위해 요구를 합치거나 나누지 않았다.',
    },
    retirement: {
        planned: ['case-10-completion-analytics-20260914', 'pilot-10-007'],
        note: '원 두 세트의 퇴역과 정본·운영 DB 반영은 이 초안의 검증과 별개이며 사용자 승인 범위에서 별도로 진행한다.',
    },
};

// ── qa.json ──────────────────────────────────────────────────────────────────
const qa = {
    version: 1,
    set_id: SET_ID,
    method: 'author_expectation_before_execution',
    human_review_performed: false,
    note:
        '실제 채점 전에 원문·발문·criterion에서 정한 대표 부분정답·오답과 보조 사례다. 작성자 기대값이며 모델 판정이 아니다.',
    cases: [
        {
            id: 'r12-sub1-partial',
            set_id: SET_ID,
            subquestion_id: 'sub1',
            kind: 'partial',
            answer: [
                '옳지 않은 것은 ②, ③, ⑤이다.',
                '② 회사 자금팀이 정리한 명세는 총계정원장 합계와 맞는다는 것만으로 신뢰할 수 없으므로, 차입계약서나 금융기관이 발급한 확인서와 대조하여 자료의 신뢰성을 평가했어야 한다.',
                '③ 금리조건과 실행 시기가 서로 다른 차입금을 하나의 연간 평균으로 묶은 값은 기대치로서 충분히 정확하지 않으므로, 차입계약별로 구분하여 기대치를 도출했어야 한다.',
                '⑤ 이자비용에는 세부테스트를 반드시 결합해야 하므로 실증적 분석절차만 단독으로 수행할 수 없다.',
            ].join('\n'),
            expected_points: 2,
            expected_verdicts: [
                { criterion_id: 'sub1.c1', verdict: 'contradicted', reason: '옳은 ⑤를 옳지 않다고 골랐고 ④를 빠뜨렸다.' },
                { criterion_id: 'sub1.c2', verdict: 'met', reason: '자료의 신뢰성 평가가 필요하다는 이유와 독립된 원천과의 대조 절차를 적었다.' },
                { criterion_id: 'sub1.c3', verdict: 'met', reason: '기대치의 정확성 부족을 이유로 들고 차입계약별 세분화 절차를 적었다.' },
                { criterion_id: 'sub1.c4', verdict: 'not_met', reason: '④를 다루지 않았다.' },
            ],
            reason: '함정 ⑤를 고르고 ④를 빠뜨린 답에서 식별 점수와 ④의 점수만 잃고 ②·③의 이유는 유지되는지 확인하는 부분정답이다.',
        },
        {
            id: 'r12-sub1-wrong',
            set_id: SET_ID,
            subquestion_id: 'sub1',
            kind: 'wrong',
            answer: [
                '옳지 않은 것은 ①, ⑤이다.',
                '① 실증적 분석절차가 적합한지는 평가된 위험과 관계없이 결정할 수 있으므로 위험을 고려한 것은 옳지 않다.',
                '⑤ 실증적 분석절차는 반드시 세부테스트와 결합하여야 하므로 단독으로 수행할 수 없다.',
                '②, ③, ④는 옳다. 회사가 준 명세는 총계정원장 합계와 맞으면 그대로 이용해도 되고, 전기와 같은 방식이면 연간 평균으로 계산한 값을 그대로 기대치로 써도 되며, 수용할 수 있는 차이금액은 차이가 나타난 뒤에 재무제표 전체 중요성과 견주어 판단해도 된다.',
            ].join('\n'),
            expected_points: 0,
            expected_verdicts: [
                { criterion_id: 'sub1.c1', verdict: 'contradicted', reason: '옳은 ①·⑤만 고르고 ②·③·④가 옳다고 명시했다.' },
                { criterion_id: 'sub1.c2', verdict: 'contradicted', reason: '총계정원장 합계와 맞으면 그대로 이용해도 된다고 명시했다.' },
                { criterion_id: 'sub1.c3', verdict: 'contradicted', reason: '전기와 같은 방식이면 연간 평균값을 그대로 기대치로 써도 된다고 명시했다.' },
                { criterion_id: 'sub1.c4', verdict: 'contradicted', reason: '차이가 나타난 뒤에 중요성과 견주어 판단해도 된다고 명시했다.' },
            ],
            reason: '옳은 항목만 고르고 옳지 않은 세 항목을 모두 옳다고 명시한 0점 오답이다.',
        },
        {
            id: 'r12-sub2-partial',
            set_id: SET_ID,
            subquestion_id: 'sub2',
            kind: 'partial',
            answer: [
                '옳지 않은 것은 ⑥, ⑨이다.',
                '⑥ 감사종료에 근접한 시점에 최종 재무제표를 대상으로 기업에 대하여 이해한 바와 재무제표가 일관성이 있는지를 분석했어야 한다.',
                '⑨ 경영진의 설명은 반드시 새로운 외부증거로 뒷받침해야 하므로 운송업체로부터 확인서를 받았어야 한다.',
            ].join('\n'),
            expected_points: 1,
            expected_verdicts: [
                { criterion_id: 'sub2.c1', verdict: 'contradicted', reason: '옳은 ⑨를 옳지 않다고 골랐고 ⑦을 빠뜨렸다.' },
                { criterion_id: 'sub2.c2', verdict: 'met', reason: '감사종료에 근접하여 최종 재무제표를 대상으로 분석해야 한다는 이유·절차를 적었다.' },
                { criterion_id: 'sub2.c3', verdict: 'not_met', reason: '⑦을 다루지 않았다.' },
            ],
            reason: '함정 ⑨를 고르고 ⑦을 빠뜨린 답에서 ⑥의 점수만 남는지 확인하는 부분정답이다.',
        },
        {
            id: 'r12-sub2-wrong',
            set_id: SET_ID,
            subquestion_id: 'sub2',
            kind: 'wrong',
            answer: [
                '옳지 않은 것은 ⑧, ⑨이다.',
                '⑧ 감사종료 단계에서는 경영진에게 질문하여 확인할 것이 아니라 세부테스트만으로 결론을 내려야 하므로 옳지 않다.',
                '⑨ 이미 다른 계정의 감사에서 입수한 자료로는 경영진의 설명을 평가할 수 없으므로 운송업체로부터 새 확인서를 받았어야 한다.',
                '⑥, ⑦은 옳다. 계정별 세부테스트를 모두 마쳤으면 감사종료에 근접한 분석은 위험평가 단계의 분석 결과로 갈음할 수 있고, 12월 매출의 급증은 기록 시점의 문제이므로 최초에 평가한 중요왜곡표시위험을 그대로 두어도 된다.',
            ].join('\n'),
            expected_points: 0,
            expected_verdicts: [
                { criterion_id: 'sub2.c1', verdict: 'contradicted', reason: '옳은 ⑧·⑨를 골랐고 ⑥·⑦이 옳다고 명시했다.' },
                { criterion_id: 'sub2.c2', verdict: 'contradicted', reason: '위험평가 단계의 분석으로 갈음할 수 있다고 명시했다.' },
                { criterion_id: 'sub2.c3', verdict: 'contradicted', reason: '기록 시점의 문제이므로 위험평가를 그대로 두어도 된다고 명시했다.' },
            ],
            reason: '옳은 두 항목을 고르고 옳지 않은 두 항목을 옳다고 명시한 0점 오답이다.',
        },
    ],
    supplementary_cases: [
        {
            id: 'r12-supp-numbers-only',
            subquestion_ids: { sub1: '옳지 않은 것은 ②, ③, ④이다.', sub2: '옳지 않은 것은 ⑥, ⑦이다.' },
            expected: { sub1: 1, sub2: 1 },
            reason: '번호만 쓴 답은 물음마다 식별 1점만 받는다.',
        },
        {
            id: 'r12-supp-remedy-only',
            subquestion_ids: {
                sub1: '옳지 않은 것은 ②, ③, ④이다. ②는 차입계약서·금융기관 확인서와 대조한다. ③은 차입계약별로 기대치를 도출한다. ④는 절차를 시작하기 전에 수용할 수 있는 차이금액을 정한다.',
                sub2: '옳지 않은 것은 ⑥, ⑦이다. ⑥은 최종 재무제표를 대상으로 분석적절차를 수행한다. ⑦은 매출의 중요왜곡표시위험 평가를 수정하고 계획된 추가감사절차를 변경한다.',
            },
            expected: { sub1: 4, sub2: 3 },
            reason: '이유 없이 보완절차만 쓴 답도 항목별 1점을 받는다.',
        },
        {
            id: 'r12-supp-boundary',
            subquestion_ids: {
                sub1: '옳지 않은 것은 ②, ③, ④이다. ②는 옳지 않다. ③도 옳지 않다. ④도 옳지 않다.',
                sub2: '옳지 않은 것은 ⑥, ⑦이다. ⑥은 옳지 않다. ⑦도 옳지 않다.',
            },
            expected: { sub1: 1, sub2: 1 },
            reason: '옳지 않다는 결론만 되풀이한 경계 답은 식별 점수만 받는다.',
        },
        {
            id: 'r12-supp-condition-boundary',
            subquestion_ids: {
                sub1: '옳지 않은 것은 ②, ③, ④이다. ② 자료의 신뢰성을 평가했어야 한다. ③ 회사가 이자비용을 계약별로 관리하지 않으므로 세부테스트를 더 했어야 한다. ④ 추가 조사 없이 수용할 수 있는 차이금액을 미리 정했어야 한다.',
                sub2: '옳지 않은 것은 ⑥, ⑦이다. ⑥ 감사종료에 근접하여 전반적 결론을 위한 분석적절차를 수행했어야 한다. ⑦ 12월 마지막 사흘의 거래에 대하여 고객 인수자료를 검사했어야 한다.',
            },
            expected: { sub1: 3, sub2: 2 },
            reason:
                'sub1 ③에 기대치의 정확성·세분화 대신 세부테스트 확대만 쓴 답과 sub2 ⑦에 위험평가 수정 없이 구체적 절차만 쓴 답은 해당 항목 점수를 받지 못하는 조건 경계 사례다.',
        },
    ],
};

write('design.json', design);
write('lineage.json', lineage);
write('qa.json', qa);
console.log('reviewed_content_sha256 =', reviewedSha);
console.log('sets.json =', ref('cpa_uploader/drafts/case-review-2026-09-15/r12-analytical-procedures-merge/sets.json').sha256);
