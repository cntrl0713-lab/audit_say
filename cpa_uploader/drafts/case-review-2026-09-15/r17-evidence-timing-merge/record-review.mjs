// r17 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r17-evidence-timing-merge/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r17/root-content-review-v1.json
//       cpa_uploader/analysis/reviews/case-review-2026-09-15/r17/root-content-review-standards-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r17-evidence-timing-merge';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r17');
const SET_ID = 'case-07-evidence-timing-20260920';
const STD_SET_ID = 'pilot-07-006-standards-20260920';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) });
const [draft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT_DIR, 'sets.json'), 'utf8'));
const [stdDraft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT_DIR, 'standards-sets.json'), 'utf8'));
if (draft.id !== SET_ID || stdDraft.id !== STD_SET_ID) throw new Error('set id 불일치');

const PASS = {
    source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass',
    style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass',
};

const REVIEWER = 'agent:claude-opus-5 (author agent; no independent peer review)';
const REVIEWED_AT = new Date().toISOString();

const SHARED_EVIDENCE = [
    `${DRAFT_DIR}/design.json`,
    `${DRAFT_DIR}/design-standards.json`,
    `${DRAFT_DIR}/lineage.json`,
    `${DRAFT_DIR}/qa.json`,
    `${DRAFT_DIR}/qa-standards.json`,
    `${DRAFT_DIR}/build-draft.mjs`,
    'cpa_uploader/data/official/delegated-n03-kga330-2025.txt',
    'cpa_uploader/data/official/delegated-s02-kga330-2025.txt',
    'cpa_uploader/data/official/kga330-2025-review07.txt',
    'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
    'cpa_uploader/data/learning-question-classifications.json',
    'docs/사례형-병합-종합문제-설계.md',
    'docs/물음별-학습-단위와-분류-계약.md',
    'docs/case-question-edit-notes-2026-09-14.md',
];

const caseReview = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: REVIEWER,
    reviewed_at: REVIEWED_AT,
    target: {
        file: `${DRAFT_DIR}/sets.json`,
        sha256: ref(`${DRAFT_DIR}/sets.json`).sha256,
        set_id: SET_ID,
        reviewed_content_sha256: reviewedContentHash(draft),
    },
    evidence: SHARED_EVIDENCE.map(ref),
    method_detail:
        'KGA 330 요구사항 문단 6~24와 적용자료 A32~A49를 등록 전문 delegated-n03-kga330-2025.txt에서, 적용자료 A11·A14·A15는 delegated-s02-kga330-2025.txt에서, 문단 22·23과 A11의 등록 전사는 kga330-2025-review07.txt에서 직접 읽고 열세 항목의 옳고 그름을 문단 단위로 확정했다. 인용 열여섯 개 가운데 열한 개(문단 11·12·15·18·21·22·23·A11·A33·A34·A43)는 병합 대상 세 원 세트(pilot-07-006, case-07-interim-misstatement-20260914, pilot-07-007)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 문단 9(L83-L85)·20(L204-L213)·24(L234-L241)·A44(L384-L387)는 delegated-n03-kga330-2025.txt에서, A15(L122-L128)는 delegated-s02-kga330-2025.txt에서 새로 발췌해 SHA-256을 계산했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다. 현재 정본에서 classification.standards에 KGA 330이 있는 세트 21개의 발문·모범답안·criterion을 모두 읽어 이 초안의 득점 요건과 대조했고, 특히 2026-09-20에 설치된 r13 병합본(case-08-sales-receivable-20260920)이 이미 쓰고 있는 KGA 330 문단 16·17과 A6·A11·A14·A15·A19의 요구를 피해 시기(문단 11·12·15·22·23·A11·A33)와 실증절차 수행 요구(문단 18·21·A43)로 갈랐다. KGA 330 문단 A56~A60이 등록 공식 전문에 없다는 점을 확인하고 원 50번이 학습자료에서 인용하던 A58을 승계하지 않았다. 새 원자료 수집은 하지 않았고, 판본 대조는 원 세 세트의 verification.notes를 재사용했다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 문단 9(통제의 효과성에 보다 크게 의존할수록 더욱 설득력이 있는 감사증거를 입수하여야 함), ②는 문단 15(유의적이라고 결정한 위험에 대하여 그 통제에 의존하려고 계획한 경우 당기에 해당 통제를 테스트하여야 함), ③은 문단 11(의존하고자 하는 특정의 시기나 전체 기간에 대하여 통제테스트를 수행)과 A33(어떤 시점에만 해당되는 감사증거도 감사인의 목적에 충분할 수 있음), ④는 문단 12(a)·(b)와 A34에서 확정했다. ②에 대하여 문단 14의 요구를 함께 읽고, 관찰 또는 검사와 결합된 질문으로 변화 여부의 증거를 입수했다는 사실을 항목에 담아 문단 14 절차의 미이행이 쟁점이 되지 않게 했다. 그 결과 ②가 옳지 않은 유일한 근거는 문단 15다. ③에 대하여는 마감 승인 통제가 보고기간말에 한 차례 적용된다는 사실을 자료 앞에 두어 문단 11의 "의존하고자 하는 특정의 시기"가 그 시점임을 확정했고, 문단 15가 적용되지 않도록 유의적 위험은 매출채권 회수가능성 하나뿐이라는 배제 사실을 두었다. ④에 대하여는 문단 13·14(과거의 감사에서 입수된 증거)가 아니라 당기 중간기간 증거의 문제임을 문단 12의 제목·본문과 대조했다. answer: 모범답안 세 문장이 식별·②·④ criterion과 1대1로 대응하고 옳은 항목 ①·③의 근거도 함께 제시한다. prompt: 발문은 단계 이름과 항목 범위, 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이며, 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 인정한다. ④는 문단 12(a)와 (b)를 모두 건너뛴 하나의 결정이므로 둘 중 하나를 쓰면 인정하고 점수를 늘리지 않았다. style: 네 항목의 옳고 그름이 어느 위험을 유의적 위험으로 결정했는지, 각 통제가 언제 적용되는지, 통제테스트가 1~9월을 대상으로 수행되었는지라는 사실에 달려 있으므로 사례형이다. topics: 07(평가위험 대응·통제테스트·실증절차)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: pilot-07-002 sub2가 문단 12의 두 후속절차를 사실 없이 열거하게 하는 기준서형이고 이 물음의 ④는 같은 문단을 우진정밀의 1~9월 통제테스트에 적용한다(의도된 심화). std-points-20260914-e5b7001074a3은 A34의 결정 요소를 열거하게 하지만 이 물음은 그 요소의 열거를 요구하지 않는다. 문단 15를 사례에 적용한 세트는 병합 대상 pilot-07-006뿐이고, 문단 9·11·A33을 득점 요건으로 쓰는 세트는 없다(이 물음에서도 옳은 항목의 근거일 뿐이다).',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑤는 문단 22(기중 일자를 기준으로 수행된 실증절차의 결론을 보고기간말까지 확대하기 위해 잔여기간에 대하여 (a) 또는 (b)의 절차를 수행), ⑥은 문단 A15(범위는 중요성·위험평가·얻고자 하는 확신의 수준을 고려하여 결정), ⑦은 문단 23(예상하지 않았던 왜곡표시가 기중에 발견된 경우 위험평가와 잔여기간 실증절차 계획의 변경 필요 여부를 평가), ⑧은 문단 A11(고의적인 왜곡표시위험 또는 조작위험이 식별되었을 때 감사결론을 기중의 일자에서 보고기간말까지 확대하는 감사절차가 효과적이지 않을 것), ⑨는 문단 20(a)·(b)에서 확정했다. ⑤와 ⑧이 중복 배점이 되지 않도록 대상을 나누었다. ⑤는 매출채권 잔액 전반에 대하여 잔여기간 절차 자체가 없는 문제이고 근거는 문단 22이며, ⑧은 조작위험에 대응하는 절차를 수행하되 그 시기·방법이 부적합한 문제이고 근거는 A11이다. 두 항목의 보완절차도 각각 잔여기간 실증절차와 보고기간말 근접·불시 절차로 다르다. 문단 22(a)·(b)를 각각 옳은 항목으로 두면 ⑤의 정답이 드러나므로 항목으로 두지 않았다. answer: 모범답안 네 문장이 식별·⑤·⑦·⑧ criterion과 대응하고 옳은 항목 ⑥·⑨의 근거도 제시한다. prompt: 단계 이름과 항목 범위, 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이다. 원 50번이 판단·이유·방법을 각각 배점하던 여덟 criterion을 항목 세 개로 합쳐 구체적 후속절차의 나열을 요구하지 않는다. style: 다섯 항목의 옳고 그름이 기중 절차의 기준일(9월 30일), 발견된 왜곡표시가 최초 위험평가에서 예상하지 않았던 것이라는 점, 12월 반품의 이월 지시가 확인되어 조작위험을 유의적 위험으로 결정했다는 사실에 달려 있으므로 사례형이다. topics: 07을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: std-points-20260914-8f1e15100ee9(문단 22의 두 방법 열거)와 std-points-20260914-f70c845ada83(문단 23의 평가사항)은 사실 없이 요구를 재현하게 하는 기준서형이고 이 물음은 같은 문단을 우진정밀의 일정에 적용한다. r13 병합본 case-08-sales-receivable-20260920의 ⑤는 A6·A11·A14로 조회 기준일의 조정을 묻지만, 이 물음의 ⑧은 A11의 다른 문장(조작위험이 식별되면 기중 결론의 확대 자체가 효과적이지 않음)을 근거로 하고 사실도 조회가 아닌 반품 조작위험이다. A15는 r13에서 옳지 않은 항목의 근거였으나 이 물음에서는 옳은 항목 ⑥의 근거여서 득점 요건이 아니다.',
        },
        {
            subquestion_id: 'sub3',
            checks: { ...PASS },
            rationale:
                'source: ⑩은 문단 18(평가된 중요왜곡표시위험과 관계없이 중요한 각 거래유형과 계정잔액 및 공시에 대하여 실증절차를 설계하고 수행)과 A43(그 요구사항이 위험평가에 판단이 수반된다는 점과 내부통제의 고유한계를 반영한다는 설명), ⑪은 문단 A44(중요한 거래유형·계정잔액·공시의 모든 경영진주장이 테스트되어야 하는 것은 아님), ⑫는 문단 21(유의적 위험에 대응하는 접근방법이 실증절차만으로 구성되어 있으면 반드시 세부테스트를 포함), ⑬은 문단 24에서 확정했다. ⑩이 다투어지지 않도록 감사종결 단계의 총괄적 분석적 검토가 개별 경영진주장의 중요한 왜곡표시를 발견하기 위한 실증적 분석절차로 설계된 것이 아니라는 배제 사실을 자료 3 앞에 두었다. 문단 A45 첫 글머리(통제테스트 증거가 뒷받침하는 위험평가에서 실증적 분석절차만으로 충분한 경우)는 ⑫와 결론이 갈리는 경우이므로 항목으로 두지 않았고, 중요하지 않은 거래유형에 실증절차를 설계하지 않는 경우도 ⑩의 판단 기준을 알려 주므로 두지 않았다. answer: 모범답안 세 문장이 식별·⑩·⑫ criterion과 대응하고 옳은 항목 ⑪·⑬의 근거도 제시한다. prompt: 단계 이름과 항목 범위, 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이다. ⑩의 이유로 위험평가의 판단 수반과 내부통제의 고유한계를 모두 요구하지 않고 하나만 써도 인정하며, 문단 18의 원칙 자체나 실증절차를 설계·수행한다는 절차를 써도 인정한다. style: 네 항목의 옳고 그름이 매출 관련 항목이 중요하다는 점, 총괄적 검토의 설계 목적, 조작위험에 대한 접근방법이 실증절차만으로 구성되었다는 사실에 달려 있으므로 사례형이다. topics: 07(실증절차의 수행 요구와 유의적 위험 대응)과 06(⑩의 이유로 인정하는 위험평가의 판단 수반·내부통제의 고유한계)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: pilot-07-001 subq1이 문단 21을 사실 없이 설명하게 하는 기준서형이고 이 물음의 ⑫는 같은 문단을 조작위험 대응 계획에 적용한다. 문단 18·A43을 득점 요건으로 쓰던 세트는 병합 대상 pilot-07-007뿐이다. std-points-20260914-9daf79eb8757(문단 20)과 std-points-20260914-a3ca61fccae4(문단 9)의 요구는 이 초안에서 옳은 항목의 근거일 뿐 득점 요건이 아니다.',
        },
    ],
    observations_not_blocking: [
        'KGA 330 문단 A56~A60(실증절차의 시기에 관한 적용자료)은 등록된 공식 전문 두 파일(delegated-n03-kga330-2025.txt, kga330-2025-review07.txt)에 모두 없고 A55에서 끝난다. 원 50번이 A58을 학습자료 전사본에서 인용하던 관계는 승계하지 않았고, ⑤의 득점 요건은 문단 22 본문의 목적 문언에서 확정했다. 미확보 문단을 근거로 하는 득점 요건은 이 세트에 없다.',
        '자료 3의 ⑩은 매출 관련 통제가 효과적으로 운영된다는 증거를 전제로 하는데, 자료 1의 ④가 그 증거의 대상기간이 20X1년 1~9월이라는 점을 옳지 않은 항목으로 다룬다. 두 물음의 득점 요건이 겹치지 않도록 ⑩의 criterion에서 "통제의 운영효과성에 관한 증거가 20X1년 9월까지의 기간에만 있다는 점만 지적하면 인정하지 않는다"고 명시했다.',
        '⑧(자료 2)과 ⑫(자료 3)는 같은 조작위험을 다루지만 ⑧은 절차의 시기(A11), ⑫는 절차의 성격(문단 21)을 각각 득점 요건으로 한다. 한쪽의 보완절차가 다른 쪽의 정답을 알려 주지 않는다.',
        '물음 1과 물음 3의 옳지 않은 항목이 각각 2개로 같다. 물음 1에 옳지 않은 항목을 더 넣으려면 대조되는 두 경우에 해당하는 문단 14 쪽을 다시 들여야 하므로 늘리지 않았고, 대신 물음 2를 3개로 두어 물음마다 같은 개수가 되지 않게 했다.',
        '득점 요건에서 빠진 옳은 항목 ①·③·⑥·⑨·⑪·⑬의 판단은 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '같은 배치에서 동시에 만들어지는 r16·r18·r19 초안 폴더는 이 검토 시점에 존재하지 않았다. 실측 직전에 다시 확인하여 발문 바이트 중복이 없는지 대조한다.',
    ],
    unresolved_content_findings: [],
};

const standardsReview = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: REVIEWER,
    reviewed_at: REVIEWED_AT,
    target: {
        file: `${DRAFT_DIR}/standards-sets.json`,
        sha256: ref(`${DRAFT_DIR}/standards-sets.json`).sha256,
        set_id: STD_SET_ID,
        reviewed_content_sha256: reviewedContentHash(stdDraft),
    },
    evidence: SHARED_EVIDENCE.map(ref),
    method_detail:
        'KGA 330 문단 13·14와 적용자료 A36~A40을 등록 전문 delegated-n03-kga330-2025.txt에서 직접 읽고, pilot-07-006/sub4의 세 criterion 명제가 문단 14(a)와 14(b)의 두 요구에 각각 대응하는지 대조했다. 인용 다섯 개(문단 14·A37·A38·A39·A40)는 pilot-07-006의 정본 인용을 바이트와 content_hash 그대로 재사용했다. 물음 ID(sub4), criterion ID(crit2·crit3·crit4), 정수 배점(각 1점), 모범답안, requirement ID(req2·req3·req4)를 원 세트에서 승계했고 발문만 기준서형 발문의 정답 암시 금지 기준으로 고쳤다. 원 발문과 새 발문의 차이·이유는 design-standards.json의 prompt_revision에 기록했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다.',
    questions: [
        {
            subquestion_id: 'sub4',
            checks: { ...PASS },
            rationale:
                'source: crit2는 문단 14(a)(계속적 관련성에 영향을 미치는 변화가 생겼다면 당기감사에서 그 통제에 대한 테스트를 수행)와 A37, crit3은 문단 14(b) 전단(변화가 없었다면 매 3회의 감사에 최소한 한번은 통제에 대한 테스트를 수행)과 A38·A39, crit4는 문단 14(b) 후단(의존하고자 하는 통제 모두를 한 번에 테스트하고 후속 두 보고기간에 전혀 테스트하지 않을 가능성을 피하기 위해 매 보고기간의 감사마다 일부 통제는 반드시 테스트)과 A40에서 확정했다. A38(b)가 "유의적 위험을 완화시키는 통제가 아님"을 조건으로 들고 있어 발문의 전제와 일치한다. answer: 모범답안 세 문장이 세 criterion과 1대1로 대응하며 사례 사실이나 다른 물음을 참조하는 표현이 없다. prompt: 독립 발문은 적용 조건(유의적 위험을 완화시키는 통제가 아닐 것)과 문단·항 기호(문단 14(a)와 (b))로 범위만 정하고 정답 항목의 핵심어·결론·개수를 알려 주지 않는다. 원 발문의 "매 감사에 통제테스트를 배분하는 원칙"과 "주기는 감사 횟수로 제시하시오"가 crit4·crit3의 정답을 알려 주어 고쳤다. 답이 정해진 예/아니오나 답을 가정한 후속 요구도 쓰지 않았다. points: 세 독립 명제 각 1점으로 3점이며 원 배점을 그대로 유지했다. 문단 14(b)의 두 요구는 서로 다른 명제여서 criterion을 나눈 원 설계를 유지했고 발문이 바뀌어도 명제·critical_facts는 바꾸지 않았다. style: shared_context.facts가 비어 있고 특정 회사의 사실·자료·다른 물음의 판단을 해석할 필요가 없으므로 기준서형이다. 사례를 보지 않은 답안으로 만점이 가능한지는 모범답안 요청으로 실측한다. topics: 07을 실제 요구에서 정했다. edition: pilot-07-006의 판본 기록을 승계했고 A38의 "매 3년의 감사"라는 인쇄 문구는 고치지 않았다. nonduplication: 현재 정본에서 문단 14를 인용해 득점 요건으로 삼은 세트는 원 pilot-07-006뿐이다. std-points-20260914-c3d6fde34fc2와 std-points-20260914-5571d08338aa는 문단 13의 고려사항을, pilot-07-002 sub1·sub2는 문단 8과 12를 다룬다. 같은 회차의 사례형 병합본은 문단 14를 인용하지 않는다.',
        },
    ],
    observations_not_blocking: [
        '새 세트 ID는 2026-09-13 case-expansion 배치의 "-standards-" 선례를 따라 pilot-07-006-standards-20260920으로 정했다. 원 세트 pilot-07-006이 퇴역해도 계보는 이 ID와 lineage.json으로 추적한다.',
        'criterion ID를 crit2·crit3·crit4로 승계하여 crit1이 없다. 원 pilot-07-006의 criterion 번호를 보존하기 위한 것이며 세트 안에서는 고유하다.',
        '이 세트의 물음은 하나이므로 학습 단위 ID는 pilot-07-006-standards-20260920--sub4--standard가 된다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v1.json'), `${JSON.stringify(caseReview, null, 2)}\n`, { flag: 'wx' });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-standards-v1.json'), `${JSON.stringify(standardsReview, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v1.json 기록:', caseReview.target.reviewed_content_sha256);
console.log('root-content-review-standards-v1.json 기록:', standardsReview.target.reviewed_content_sha256);
