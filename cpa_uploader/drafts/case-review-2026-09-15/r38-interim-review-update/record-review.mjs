// r38 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r38-interim-review-update/record-review.mjs
//
// 출력:
//   cpa_uploader/analysis/reviews/case-review-2026-09-15/r38/root-content-review-v1.json           (사례형)
//   cpa_uploader/analysis/reviews/case-review-2026-09-15/r38/root-content-review-standards-v1.json (기준서형)

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r38-interim-review-update';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r38');
const CASE_SET_ID = 'case-19-interim-review-20260921';
const STANDARDS_SET_ID = 'pilot-19-005-standards-20260921';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) });
const [caseDraft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT_DIR, 'sets.json'), 'utf8'));
const [standardsDraft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT_DIR, 'standards-sets.json'), 'utf8'));
if (caseDraft.id !== CASE_SET_ID) throw new Error('사례형 set id 불일치');
if (standardsDraft.id !== STANDARDS_SET_ID) throw new Error('기준서형 set id 불일치');

const PASS = {
    source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass',
    style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass',
};
const REVIEWER = 'agent:claude-opus-5 (author agent; no independent peer review)';
const reviewedAt = new Date().toISOString();

const SHARED_EVIDENCE = [
    `${DRAFT_DIR}/lineage.json`,
    `${DRAFT_DIR}/build-draft.mjs`,
    'cpa_uploader/data/official/delegated-s06-interim-2015.txt',
    'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
    'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/source-registration-s06-interim-2015.json',
    'docs/물음별-학습-단위와-분류-계약.md',
    'docs/사례형-병합-종합문제-설계.md',
    'docs/case-question-edit-notes-2026-09-14.md',
];

const SHARED_METHOD = '등록 공식 전문 cpa_uploader/data/official/delegated-s06-interim-2015.txt(SHA-256 b24d45161ca8da8804603b3fa6e70d5ff054ade89d4271f3d5c0b7b09068fd23, 63행)를 전수로 읽고 이 준칙에서 등록된 문단이 1(1-1 포함)·7·8·9·19·20·36·46(46-1 포함) 여덟 개뿐임을 확인했다. 등록 장부 source-registration-s06-interim-2015.json의 units 8건과 문단·locator·contentHash를 일대일로 대조했다. 인용 여덟 개의 source_quote 바이트와 content_hash를 원 세트 pilot-19-005에서 그대로 옮겼고, 각 인용의 sha256이 quote 바이트와 일치함을 다시 계산해 확인했다. 새 원자료 수집은 없다. page가 "KGA "로 시작하지 않아 validateAuthoringBank의 classification.standards 대조와 주제별 허용 기준서 검사, quoteBelongsToStandardSection의 기준서 구간 검사가 모두 적용되지 않는 세트이므로(코드 직접 확인), classification.standards는 빈 배열이 규칙에 맞는다. validate_draft_v3.ts --against-bank로 인용 실존과 기존 은행과의 ID·발문 중복 없음을 확인했고, 현재 정본 341세트 뒤에 이 회차의 두 초안을 붙인 전체 후보(343세트)를 메모리에서 validateAuthoringBank로 검증해 오류 0건을 확인했다. 발문 바이트는 정본 341세트와 cpa_uploader/drafts/case-review-2026-09-15 아래 모든 초안(형제 회차 r33~r36 포함)에 대하여 공백 제거·소문자 정규화 후 대조해 충돌 0건이었다. 현재 정본에서 이 준칙을 인용하거나 중간재무제표 검토를 다루는 세트(pilot-19-001·pilot-19-004·pilot-19-005)의 발문·모범답안·criterion을 전부 읽어 대조했다.';

const caseReview = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: REVIEWER,
    reviewed_at: reviewedAt,
    target: {
        file: `${DRAFT_DIR}/sets.json`,
        sha256: ref(`${DRAFT_DIR}/sets.json`).sha256,
        set_id: CASE_SET_ID,
        reviewed_content_sha256: reviewedContentHash(caseDraft),
    },
    evidence: [
        `${DRAFT_DIR}/design.json`,
        `${DRAFT_DIR}/qa.json`,
        ...SHARED_EVIDENCE,
    ].map(ref),
    method_detail: `${SHARED_METHOD} 이 세트는 원 세트 pilot-19-005의 사례형 물음 두 개(sub2 갑의 서면진술 생략 제안, sub3 을의 중요성 완화 제안)를 선택형 항목으로 옮기고, 등록 원문 안에서만 요구를 더해 3물음 9점으로 구성했다. 등록 원문에 없는 문단(21~35·37~45·47~59)의 요구는 쓰지 않았고 그 목록과 사유를 lineage.json의 requirements_not_written_for_lack_of_registered_text에 남겼다.`,
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 문단 1 후단("동 준칙에서 “감사인”이라는 용어를 사용하는 것은 감사업무를 수행해서가 아니라 회사의 독립된 감사인이 동 준칙에 따라 중간재무제표의 검토업무를 수행하기 때문이다")에서 옳음으로, ②는 문단 (1-1)("반기 및 분기보고서에 포함되지 않는 중간재무제표 또는 과거 재무정보에 대하여 회사의 연간재무제표 감사업무를 수행하는 감사인이 검토업무를 수행할 때에도 이 준칙을 적용할 수 있다")에서 옳지 않음으로, ③은 문단 9 제2문("검토는 주로 재무 및 회계담당자에 대한 질문, 분석적절차 및 기타 검토절차로 구성된다")에서 옳음으로, ④는 문단 9 제1문("검토는 … 감사와 같은 합리적 수준의 확신을 얻도록 설계되지는 않는다")에서 옳지 않음으로 확정했다. ④의 보완 내용은 문단 7 후단("의견을 변형하지 않을 위험을 보통 수준 이하로 감소시키기 위하여 질문, 분석적절차 및 기타의 검토절차를 수행하여야 한다")에서 가져왔고 sub1.req3으로 인용했다. ②가 성립하도록 fact1에 가온이 반기보고서에 포함하지 않는 별도 중간재무제표를 작성해 같은 감사인에게 검토를 요청했다는 사실을 두었고, 솔빛회계법인이 가온의 연간재무제표 감사업무를 수행한다는 사실도 두어 (1-1)의 적용 조건을 충족시켰다. answer: 모범답안 세 문장이 식별·②·④ criterion과 대응하고 옳은 항목 ①·③의 근거도 함께 제시한다. prompt: 발문은 단계 이름(검토업무의 적용범위와 검토절차의 구성을 정하는 단계)과 항목 범위, 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이다. 원 세트에는 이 단계의 물음이 없어 전부 새로 더한 요구이며, 같은 배치의 선택형 물음이 옳지 않은 항목 두 개일 때 3점인 것과 일관된다. 분리 검토: ②(적용범위)와 ④(절차 설계의 확신 수준)는 근거 문단과 대상이 모두 달라 한 항목으로 묶지 않았고, 어느 항목에도 독립된 잘못을 둘 이상 담지 않았다. style: 네 항목의 옳고 그름이 솔빛회계법인이 가온의 외감법 제3조제1항 감사인이자 연간재무제표 감사인이라는 점, 검토대상이 반기보고서에 포함되는 반기재무제표라는 점, 별도 중간재무제표의 검토도 같은 감사인에게 요청되었다는 점에 달려 있으므로 사례형이다. 기준서 문단의 나열만으로는 ②의 판단이 성립하지 않는다. topics: 19를 실제 요구에서 정했다. 이 물음에는 중요성이나 서면진술 요구가 없어 04·12를 넣지 않았다. edition: 20X1 표기이며 금융위원회고시 제2015-20호(2015-07-01 시행)를 기준으로 판단했고 대상 시험 연도는 2027년이다. nonduplication: 현재 정본에서 이 준칙을 인용하는 세트는 pilot-19-005(이 회차에서 퇴역)뿐이고, pilot-19-004의 src4가 같은 문단 1을 다른 파일에서 인용하나 그 sub2 crit4는 중간재무제표 검토에 적용되는 수행기준의 명칭을 연결하게 할 뿐 문단 1-1의 적용 가능 범위를 판단하게 하지 않는다. pilot-19-001 sub2는 역사적 재무제표에 대한 검토업무기준(다른 기준)의 확신과 절차를 묻는다. 분리 보존 세트 pilot-19-005-standards-20260921의 crit1은 확신의 수준을 제시하게 하고 이 물음의 ④는 절차 설계가 옳지 않은 이유·보완을 쓰게 하여 득점 요건이 다르다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑤는 문단 19 제2문("이러한 중요성 기준의 결정시 감사인은 양적·질적인 요소를 고려한 전문가적인 판단에 기초하여야 한다")에서 옳음으로, ⑥은 문단 19 제1문("감사인은 검토절차의 성격·시기 및 범위를 결정하거나 왜곡사항의 영향을 평가할 때 중요성을 고려하여야 한다")에서 옳지 않음으로, ⑦은 문단 20 제2문("감사와 비교할 경우 검토업무는 왜곡표시를 발견하지 못할 위험이 더욱 크다")에서 옳음으로, ⑧은 문단 20 제1문·제3문("검토업무 수행시에도 재무제표에 대한 감사의견 표명시 적용하였을 중요성에 관한 사항을 동일하게 고려하여야 한다", "검토업무라고 하여 감사업무 수행시에 비하여 중요성의 판단기준을 완화해서는 안된다")에서 옳지 않음으로 확정했다. 문단 20 제3문 전단(보고해야 하는 정보와 이를 신뢰·이용하는 측의 요구에 의거한 판단)은 같은 문장 후단이 ⑧의 위반 근거이므로 별도 항목으로 두지 않고 crit6의 인정 근거·보완 내용으로만 남겼다. ⑧이 성립하도록 fact3에 반기재무정보의 성격과 이용자 요구에 직전 연차감사 이후 달라진 점이 없다는 사실을 두어 완화를 뒷받침할 다른 조건이 없음을 고정했고, 원 세트가 배제하던 연간감사 중요성 금액의 전용 문제도 배제 문구로 남겼다. answer: 모범답안 세 문장이 식별·⑥·⑧ criterion과 대응하고 옳은 항목 ⑤·⑦의 근거도 제시한다. prompt: 단계 이름(이 검토업무에 적용할 중요성을 결정하는 단계)과 항목 범위, 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이며 원 세트 sub3의 3점을 유지했다. 원 crit4(완화 부적절 판단)는 crit4·crit6이, 원 crit5(보고 정보와 이용자 요구에 의거한 판단)는 crit6의 인정 근거·보완 내용이 담고, 원 crit6(발견위험 차이와 중요성 기준 차이의 구별)은 함정 ⑦과 crit6의 불인정 조건으로 옮겼다. 줄어든 2점은 문단 19에서 더한 ⑥ 1점과 식별 1점으로 채웠으며 같은 의미를 중복 배점하지 않았다. style: 네 항목의 옳고 그름이 이 업무가 검토업무이고 같은 반기재무정보에 감사의견을 표명한다면 적용하였을 중요성이 비교 대상이라는 점, 보고 정보의 성격과 이용자 요구에 달라진 점이 없다는 점에 달려 있으므로 사례형이다. topics: 19와 04를 실제 요구에서 정했고 원 세트 sub3의 분류를 이어받았다. edition: 위와 같다. nonduplication: 주제 04의 중요성 세트(case-04-materiality-20260917 등)는 KGA 320의 재무제표 전체 중요성·수행중요성을 다루고 이 준칙을 인용하지 않는다. 검토업무의 중요성 판단기준 완화 금지를 묻는 다른 문항은 현재 은행에 없다.',
        },
        {
            subquestion_id: 'sub3',
            checks: { ...PASS },
            rationale:
                'source: ⑨는 문단 36 본문("감사인은 경영진으로부터 다음과 같은 내용이 포함된 서면진술을 입수하여야 한다")에서 옳지 않음으로, ⑩은 문단 36(1)("경영진은 부정과 오류의 예방과 적발을 위한 내부통제제도를 수립하고 운영할 책임이 있다는 사실을 인정함")에서 옳음으로, ⑪은 문단 36 단서와 (3)("다만 (3)의 경우 경영진은 수정반영 하지 아니한 사항들을 요약하여 서면진술에 기재하거나 별도로 첨부하여야 한다")에서 옳지 않음으로, ⑫는 문단 36(7)("경영진은 재무상태표일 후 검토보고서일까지 발생된 사건으로서 중간재무제표의 수정이나 공시를 요하는 유의적인 사건을 감사인에게 모두 공개하였음")에서 옳음으로 확정했다. ⑨가 성립하도록 fact4에 중요한 수정이 필요한 사항이 발견되지 않았다는 사실을, ⑪이 성립하도록 경영진이 수정반영하지 않은 왜곡표시가 있고 경영진이 그 영향을 중요하지 않다고 본다는 사실을 두었다. 이 두 사실은 서로 모순되지 않는다. 문단 36(3)이 전제하는 것은 왜곡표시의 존재이고 그 영향이 중요하지 않다는 것은 경영진의 진술 내용이기 때문이다. answer: 모범답안 세 문장이 식별·⑨·⑪ criterion과 대응하고 옳은 항목 ⑩·⑫의 근거도 제시한다. prompt: 단계 이름(경영진 서면진술을 입수하는 종결 단계)과 항목 범위, 요구 형식만 밝힌다. 원 세트 sub2가 두던 "서면진술에 담을 모든 개별 항목의 열거는 요구하지 않는다"는 제외 문구는 발문에서 빼고 crit8의 불요구 조건으로 옮겼다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이다. 원 세트 sub2는 갑의 제안 하나에 1점이었고, 늘어난 2점은 문단 36 단서·(3)에서 더한 새 독립 요구(⑪)와 선택형의 식별 요구에서 나온 것이며 같은 의미를 중복 배점하지 않았다. 분리 검토: ⑨(입수 의무)와 ⑪(요약의 기재·첨부 주체)은 근거 항과 대상이 달라 한 항목으로 묶지 않았다. style: 네 항목의 옳고 그름이 이 업무가 감사가 아닌 중간재무제표 검토라는 점, 중요한 수정이 필요한 사항이 발견되지 않았다는 점, 경영진이 수정반영하지 않은 왜곡표시가 존재한다는 점에 달려 있으므로 사례형이다. topics: 19와 12를 실제 요구에서 정했고 원 세트 sub2의 분류를 이어받았다. edition: 위와 같다. nonduplication: 주제 12의 서면진술 세트는 KGA 580의 연차감사 서면진술을 다루고, 미수정왜곡표시 세트(case-12-uncorrected-misstatement-20260921 등)는 KGA 450을 다룬다. 이 물음의 근거는 중간재무제표 검토준칙 문단 36이며 검토업무의 서면진술을 묻는 다른 문항은 현재 은행에 없다. 원 세트 pilot-19-005 sub2는 이 회차에서 퇴역한다.',
        },
    ],
    observations_not_blocking: [
        '세 물음 모두 항목 4개·옳지 않은 항목 2개가 되었다. 계약은 옳지 않은 항목 수를 사례마다 고정하지 말라고 하지만 등록 원문이 여덟 문단뿐이어서 항목을 더 만들 근거가 없었다. 발문에는 개수를 밝히지 않았다. 등록 문단이 늘어나면 물음마다 항목 수를 달리하는 개정을 검토한다.',
        '문단 8(검토목적과 공정표시 의견 근거의 부제공)과 문단 46(보고서 기재사항)은 사례형 항목으로 쓰지 않았다. 전자는 항목 ④와 같은 통찰로 풀려 변별이 떨어지고 분리 보존 세트의 crit2와 요구가 겹치며, 후자는 보고서 영역이자 46-1을 쓰면 fact1의 "전체 재무제표 형식"이 정답을 알려 준다. 두 요구는 pilot-19-005-standards-20260921이 계속 다룬다.',
        '배정이 후보로 든 "검토절차의 성격과 범위"(문단 22·23), "수정되지 않은 왜곡표시의 처리"(문단 32~35), "결론의 변형"(문단 49~51)은 등록 원문에 없어 쓰지 않았다. 같은 고시의 전체 추출본이 cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/sources/interim-2015-text.txt(raw 보존 d277ee81283c4b52)에 있으나 등록 입력 cpa_uploader/data/*는 이 작업의 금지 경로이고 source_quote 실재 검증은 등록 원문만 본다. 추가 문단의 등록은 조율자 판단 사항이다.',
        '항목 ⑥은 중요성의 적용을 검토절차 결정 단계로 한정한다는 결정이다. 문단 19가 두 시점을 함께 요구하므로 옳지 않음이 확정되지만 학습자가 다른 시점을 떠올리지 못하면 이유를 쓰기 어렵다. crit5는 이유와 보완 내용 중 하나만 요구하고 금액·비율을 요구하지 않는다.',
        '옳은 항목 ①·③·⑤·⑦·⑩·⑫에는 별도 득점 기준이 없고 그 판단은 각 물음의 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유 점수는 유지된다.',
        '근거 절을 붙인 항목은 옳은 항목 ①·⑤·⑫와 옳지 않은 항목 ②·⑧·⑨로 셋씩이다. 근거의 유무가 정답 표지가 되지 않게 배치했고 "그러나"·"다만" 같은 연결어는 쓰지 않았다.',
    ],
    unresolved_content_findings: [],
};

const standardsReview = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: REVIEWER,
    reviewed_at: reviewedAt,
    target: {
        file: `${DRAFT_DIR}/standards-sets.json`,
        sha256: ref(`${DRAFT_DIR}/standards-sets.json`).sha256,
        set_id: STANDARDS_SET_ID,
        reviewed_content_sha256: reviewedContentHash(standardsDraft),
    },
    evidence: [
        `${DRAFT_DIR}/design-standards.json`,
        `${DRAFT_DIR}/qa-standards.json`,
        `${DRAFT_DIR}/sets.json`,
        ...SHARED_EVIDENCE,
    ].map(ref),
    method_detail: `${SHARED_METHOD} 이 세트는 원 세트 pilot-19-005의 기준서형 물음 sub1을 퇴역시키지 않고 분리 보존한 것이다. criterion id·claim·critical_facts·scores·max_points·requirement id·인용 바이트·모범답안을 원 세트에서 그대로 승계했고, 바꾼 것은 발문·제목·태그·사실관계(빈 배열)·상태뿐이다. 승계 대조표는 lineage.json의 standards_split에 있다.`,
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: crit1의 확신 수준은 문단 9 제1문("감사와 같은 합리적 수준의 확신을 얻도록 설계되지는 않는다")과 문단 46(7)("감사 업무시 파악되었을 모든 유의적 사항을 알 수 있을 정도의 확신을 획득하지 못하며, 이로 인해 검토시 감사의견을 표명하지 아니한다는 사실"), 문단 7 후단(보통 수준 이하로 감소), 문단 8(공정표시 의견 표명의 근거를 제공하지 않음)에서 확정했다. crit2의 소극적 결론은 문단 46(8)("중간재무제표가 회계처리기준에 따라 중요성의 관점에서 공정하게 표시하고 있지 않다고 믿게 하는 사항이 존재하는지 여부에 대한 결론")과 문단 7 전단에서 확정했다. 발문이 전체 재무제표 형식임을 밝히므로 문단 (46-1)의 요약 중간재무제표 수정 적용은 배제된다. 인용 네 개는 원 세트의 바이트·content_hash 그대로이며 세트 안에서 중복되지 않는다. answer: 모범답안 두 문장이 crit1·crit2와 하나씩 대응하고 원 세트의 문장을 그대로 승계했다. prompt: 원 발문이 특정 업무 상황을 앞세우고 종결 조건을 "변형된 검토의견을 필요로 하는 사항이 없다"로 적어 결론 방향에 가까웠으므로, 준칙의 일반 적용 조건 서술로 다시 쓰고 조건을 "검토보고서를 변형할 사유는 발생하지 않았다"로 중립화했다. 결론을 묻는 범위는 문단·항 기호(문단 46의 (8))로 정했다. 정답 핵심어인 "제한적 확신"·"보통수준의 확신"과 소극적 결론의 문형은 발문에 쓰지 않았고, 답이 정해진 예/아니오나 유도 표현도 쓰지 않았다. "대상 반기재무제표와 적용한 회계처리기준이 드러나도록"은 crit2의 명제가 요구하는 특정성이어서 유지했다. 제목도 원 제목에서 사례형으로 남는 "종결 판단"을 빼고 물음의 축 이름만 남겼으며, 태그에서 원 세트의 "제한적 확신"을 뺐다. points: 두 독립 명제 각 1점으로 2점이며 원 세트 sub1의 배점을 그대로 유지했다. 확신의 수준과 보고서 결론은 서로를 함축하지 않으므로 한쪽만 맞으면 1점이다. 분리 자체를 점수 증가 이유로 삼지 않았다. style: 사례 사실 없이 준칙의 일반 적용 조건만으로 두 명제가 성립하므로 기준서형이며 shared_context.facts는 빈 배열이다. 특정 회사·자료·다른 물음의 판단을 해석할 필요가 없다. topics: 19를 실제 요구에서 정했고 원 세트 sub1의 분류를 이어받았다. edition: 금융위원회고시 제2015-20호(2015-07-01 시행)이며 대상 시험 연도는 2027년이다. crit1이 허용하는 "보통수준의 확신"은 2015 첨부에 없는 보론 4를 2014 공식 원문 맥락으로 구분한 원 세트의 기록을 승계한 것이다. nonduplication: pilot-19-001 sub2는 역사적 재무제표에 대한 검토업무기준의 확신과 절차를 묻는 다른 기준의 물음이고, pilot-19-004 sub2 crit4는 수행기준의 명칭만 연결하게 한다. 사례형 case-19-interim-review-20260921의 항목 ④는 같은 문단 9를 쓰지만 절차 설계가 옳지 않은 이유·보완을 요구하여 득점 요건이 다르다.',
        },
    ],
    observations_not_blocking: [
        'crit1은 인용 네 개(문단 9·7·8·46)를 모두 source_ref_ids로 들고 있다. 확신의 수준을 직접 말하는 문장은 문단 9 제1문과 문단 46(7)이고 문단 7·8은 업무 목적의 차이를 말한다. 원 세트의 연결을 그대로 유지했으며 채점 명제 자체는 확신 수준 한 가지만 요구한다.',
        '이 세트는 물음이 하나여서 학습 단위도 하나(pilot-19-005-standards-20260921--sub1--standard)다. r17·r21의 기준서형 분리본과 같은 형상이고 r31(2물음)과는 다르다.',
        '원 세트 sub1은 status=published·review_status=verified였으나 발문을 고쳤으므로 초안 상태로 되돌렸다. 과거 검증을 새 발문으로 승계하지 않는다.',
        '문단 46의 나머지 기재사항((1)~(7)·(10)~(12))과 (46-1)의 요약 중간재무제표 수정 적용은 이 물음의 득점 요건이 아니다. 이를 묻는 문항은 현재 은행에 없어 후속 제작 후보로 남는다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v1.json'), `${JSON.stringify(caseReview, null, 2)}\n`, { flag: 'wx' });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-standards-v1.json'), `${JSON.stringify(standardsReview, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v1.json / root-content-review-standards-v1.json 기록 완료');
