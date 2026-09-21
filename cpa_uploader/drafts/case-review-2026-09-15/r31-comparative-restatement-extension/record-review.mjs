// r31 agent 내용 검토 장부 기록기. 사례형·기준서형 두 파일을 한 번만 기록한다.
// 기존 파일이 있으면 쓰지 않는다(flag: 'wx'). 초안 내용을 고쳤으면 장부의 해시만 바꾸지 말고
// 앞선 기록을 지운 뒤 이 기록기를 다시 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension/record-review.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
process.chdir(root);

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r31';
const REVIEWER = 'agent:claude-opus-5 (author agent; no independent peer review)';
const REVIEWED_AT = '2026-09-21T16:10:00.000Z';

const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = (file) => ({ file, sha256: hash(file) });
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
const write = (file, value) => fs.writeFileSync(file, serialize(value), { flag: 'wx' });
const CHECKS = ['source', 'answer', 'prompt', 'points', 'style', 'topics', 'edition', 'nonduplication'];
const pass = () => Object.fromEntries(CHECKS.map((check) => [check, 'pass']));

const evidence = [
    `${D}/design.json`,
    `${D}/design-standards.json`,
    `${D}/lineage.json`,
    `${D}/qa.json`,
    `${D}/qa-standards.json`,
    `${D}/build-draft.mjs`,
    'cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt',
    'cpa_uploader/data/official/point-review-710-appendix-2026-09-11.txt',
    'cpa_uploader/data/official/delegated-n06-kga710-720-1100-supplement-2025.txt',
    'cpa_uploader/data/official/kga700-705-2025-review15.txt',
    'cpa_uploader/data/official/point-review-b-source-followup-2026-09-11.txt',
    'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
    'cpa_uploader/data/learning-question-classifications.json',
    'docs/사례형-병합-종합문제-설계.md',
    'docs/물음별-학습-단위와-분류-계약.md',
    'docs/case-question-edit-notes-2026-09-14.md',
].map(ref);

const [caseSet] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const [standardsSet] = JSON.parse(fs.readFileSync(`${D}/standards-sets.json`, 'utf8'));

const caseReview = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: REVIEWER,
    reviewed_at: REVIEWED_AT,
    target: {
        file: `${D}/sets.json`,
        sha256: hash(`${D}/sets.json`),
        set_id: caseSet.id,
        reviewed_content_sha256: reviewedContentHash(caseSet),
    },
    evidence,
    method_detail:
        'KGA 710의 요구사항 문단 1~19와 적용자료 A1~A13, 보론 사례 1~3을 등록 전문 세 파일(kga701-706-710-720-2025-review16.txt, point-review-710-appendix-2026-09-11.txt, delegated-n06-kga710-720-1100-supplement-2025.txt)에서 직접 읽고, 대응수치 절(문단 10~14, A2~A8)과 비교재무제표 절(문단 15~19, A9~A13)의 요구가 서로 다르다는 점을 문단 단위로 확정했다. 대상 갱신본 case-16-comparative-restatement-20260919의 fact1·verification.notes와 항목 ①~⑨의 근거 문단을 대조해 그 세트가 비교재무제표 방식의 사례임을 확인했고, 확장 재료 pilot-16-008의 shared_context[scope]와 인용 문단(2·11·12·13, 보론 사례 1~3)을 대조해 그 세트가 대응수치 방식만 다룸을 확인했다. 그 결과 배정서가 지시한 "대응수치 방식 하나로 고정"을 그대로 따르면 대상 갱신본의 다섯 항목이 무효가 되므로 비교재무제표 방식으로 고정하고 그 판단과 근거를 lineage.json의 approach_conflict에 기록했다. 인용 열일곱 개 가운데 열다섯 개는 대상 갱신본의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 문단 7(L395-L402)·문단 8(L403-L408)만 kga701-706-710-720-2025-review16.txt에서 새로 발췌했다. 현재 정본 346세트에서 KGA 710을 인용하는 세트 네 개와 KGA 706을 인용하는 세트를 모두 읽고 발문·모범답안·criterion을 대조했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했고, 현재 정본 전체와 같은 배치 초안 31개의 발문을 모두 정규화하여 바이트 충돌이 없음을 확인했으며, 현재 정본에 두 초안을 붙인 348세트를 메모리에서 validateAuthoringBank로 검증해 오류가 없음을 확인했다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: pass(),
            rationale:
                'source: ①은 문단 18 전단(적합한 수준의 경영진과 지배기구에 커뮤니케이션하여야 하며, 이러한 사실을 전임감사인에게 알리도록 요청하여야 한다), ③은 A12 후단(감사인이 감사계약을 체결하고 수정의 적절성에 대하여 만족할 만큼 충분하고 적합한 감사증거를 얻은 경우에는), ⑤는 문단 9 후단(비교정보에 영향을 미치는, 전기재무제표의 중요한 왜곡표시를 수정하기 위해 행해진 재작성에 대하여 구체적인 서면진술을 입수하여야 한다)과 A1 후단에서 확정했다. 옳은 항목은 ②가 문단 17(전임감사인의 감사보고서가 재발행되지 않는 한 기타사항문단에 (a)(b)(c)를 기재)과 A12 전단(전임감사인은 수정전 전기재무제표에 대하여 의견을 표명했다는 사실을 나타낼 수 있을 것이다), ④가 KGA 706 문단 7(a)와 문단 8(a)에서 확정했다. 대상 갱신본이 2026-09-19에 이미 통과시킨 근거이며 이번 확장에서 근거 문단을 바꾸지 않았고 원문을 다시 읽어 재확인했다. answer: 모범답안은 식별 문장과 세 항목의 이유·보완절차로 이루어지고 각 문장이 crit1~crit4와 1대1로 대응한다. 대상 갱신본의 model_answer를 바이트 그대로 승계했다. prompt: 발문은 단계 이름("전기 재무제표에서 발견한 왜곡표시를 처리하고 그 결과를 20X1년 감사보고서에 반영하는 단계")과 항목 범위(①~⑤), 요구(옳지 않은 것을 모두 찾아 번호와 이유 또는 수행하였어야 할 절차)만 적고 옳지 않은 항목의 수·내용·근거를 알려 주지 않는다. 배정된 도입 규칙(비교정보 절차의 단계 이름)을 적용했고 "자료 N의", "위 자료에서" 형태를 쓰지 않았으며 정본·형제 초안 어느 발문과도 정규화 바이트가 같지 않다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이며 대상 갱신본 sub1의 배점을 그대로 유지했다. 요구 요소·부분정답 경로·필요 서술량이 바뀌지 않아 조정하지 않았다. 다섯 항목이 한 단계에 속하고 각각 한 문장으로 답할 수 있어 물음을 더 나누지 않았다. style: 다섯 항목의 옳고 그름이 전임감사인의 적정의견, 회사의 재작성과 주석 공시, 전임감사인의 재발행 거부, 연도별 감사계약, 경영에 참여하지 않는 지배기구 구성원이라는 사실에 달려 있어 사례형이다. topics: 16·03·12를 실제 요구(비교정보 보고, 전임감사인 커뮤니케이션, 서면진술)에서 정했고 대상 갱신본의 topic_ids를 승계했다. edition: KGA 700·705·706·710의 2025 개정 전문을 적용하고 20X0·20X1·20X2 표기만 썼다. nonduplication: 문단 18과 A12를 인용하는 다른 정본 세트가 없고, 문단 17은 case-09-initial-audit-20260915가 초도감사 맥락에서 한 항목으로 쓰지만 그 세트의 득점 요건은 기초잔액 감사절차이므로 겹치지 않는다.',
        },
        {
            subquestion_id: 'sub2',
            checks: pass(),
            rationale:
                'source: ⑦은 KGA 705 문단 5(a)(전반적의 정의)·문단 7(a)(중요하나 전반적이지는 않은 경우 한정의견)·문단 8(중요하며 동시에 전반적인 경우 부적정의견), ⑧은 문단 16(전기재무제표에 대한 감사의견이 이전에 표명한 의견과 다른 경우 기타사항문단에 상이한 의견에 대한 중요한 사유를 공시)과 KGA 706 문단 7(a)(강조사항문단은 재무제표에 적절하게 표시되거나 공시되어 있는 사항을 언급하는 문단)에서 확정했다. 옳은 항목은 ⑥이 문단 15·A9(비교재무제표에 대한 감사보고서는 표시된 각 기간의 재무제표에 적용되므로 기간마다 다른 의견을 표명할 수 있다)와 KGA 700 문단 16, ⑨가 문단 17의 적용 조건(전기재무제표가 전임감사인의 감사를 받은 경우)과 문단 6(c)의 비교재무제표 정의에서 확정했다. 20X2년 감사보고서에 비교표시되는 전기는 소담회계법인이 감사한 20X1년 재무제표이므로 문단 17이 적용되지 않는다. answer: 모범답안 세 문장이 crit5~crit7과 1대1로 대응하고 사례의 수치(중요성 25억원, 누락액 40억원, 영향 범위)를 근거로 삼는다. 대상 갱신본의 model_answer를 바이트 그대로 승계했다. prompt: 단계 이름("비교표시되는 각 기간의 재무제표에 관한 감사의견을 형성하고 20X2년 감사보고서를 구성하는 단계")과 항목 범위(⑥~⑨)만 적고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이며 대상 갱신본 sub2의 배점을 유지했다. ⑦의 중요성과 전반성은 하나의 잘못(의견 유형 선택)에 대한 대안적 이유이므로 criterion을 나누지 않았다. 네 항목을 더 나누면 항목이 둘씩만 남아 옳지 않은 항목 수를 감추기 어려워 나누지 않았다. style: 네 항목의 옳고 그름이 한정의견 원인의 해소, 누락액과 중요성·세전이익·총자산의 관계, 영향이 소송충당부채와 관련 비용·이익잉여금에 국한된다는 점, 20X2년 비교표시 대상이 20X1년이라는 사실에 달려 있어 사례형이다. topics: 16·15를 실제 요구에서 정했다. edition: 20X1·20X2 표기만 쓰고 적용 판본은 notes에 적었다. nonduplication: 문단 15·16·A9를 인용하는 다른 정본 세트가 없고, KGA 705 문단 5(a)·7·8은 주제 15의 여러 세트가 쓰지만 이 물음의 득점 요건은 비교재무제표에서 기간별 의견을 형성하는 맥락이다.',
        },
        {
            subquestion_id: 'sub3',
            checks: pass(),
            rationale:
                'source: ⑫는 문단 9 전단(감사인은 감사의견에서 언급된 모든 기간에 대하여 서면진술을 요구하여야 한다)과 A1 전단(비교재무제표의 경우, 경영진이 전기재무제표에 대하여 이전에 행한 서면진술이 계속 적절하다는 점을 재확인할 필요가 있기 때문에 서면진술은 감사의견에서 언급된 모든 기간에 대하여 요청된다), 그리고 감사의견이 두 기간을 언급한다는 근거인 문단 15에서 확정했다. 옳은 항목은 ⑩이 문단 7(a) 후단(또는 적절한 경우 재작성된 금액 및 기타공시와 일치하는지 여부)과 문단 8 후단(전기재무제표가 수정되었다면 감사인은 비교정보가 수정된 재무제표와 일치하는지 여부를 결정하여야 한다), ⑪이 문단 7(b)(비교정보에 반영된 회계정책이 당기의 회계정책과 일관성이 있는지, 또는 회계정책의 변경이 있었다면 그러한 변경이 적절히 회계처리되고 적절하게 표시 및 공시되었는지 여부)에서 확정했다. 문단 7·8은 요구사항의 감사절차 절에 있어 대응수치와 비교재무제표에 공통으로 적용되므로 방식 고정과 무관하게 성립하고, ⑫의 근거인 문단 9 전단·A1 전단은 비교재무제표 전제에서만 성립하므로 fact1의 비교재무제표 표시와 외부감사법 감사가 전제 근거다. answer: 모범답안 두 문장이 crit8·crit9와 1대1로 대응한다. prompt: 단계 이름("비교정보에 대한 감사절차를 수행하고 서면진술을 요청하는 단계")과 항목 범위(⑩~⑫)만 적는다. 옳지 않은 항목의 수를 밝히지 않았고 물음 1·2와 다르게 한 개로 두었다. points: 식별 1점 + 옳지 않은 항목 한 개 1점으로 2점이며 배치의 기본 배점 계약을 따랐다. 요구 요소가 하나이고 한 문장으로 답할 수 있어 2점을 넘기지 않았다. 이 세 항목을 물음 1이나 2에 붙이면 항목이 7~8개가 되어 식별 1점의 난도가 항목 수에 따라 달라지므로 별도 물음으로 두었고, 옛 총점 7점 상한에 맞추려고 요구를 합치지 않아 세트 합계는 9점이 되었다. style: 세 항목의 옳고 그름이 20X1년 재무제표가 재작성되었다는 점, 20X2년 감사보고서가 두 기간에 대하여 의견을 표명한다는 점, 20X1년 감사에서 이미 서면진술을 입수하였다는 점에 달려 있어 사례형이다. 대응수치 방식이었다면 A1 중단에 따라 ⑫가 옳은 절차가 되므로 사실 의존성이 분명하다. topics: 16을 실제 요구에서 정했고 KGA 710만 인용하므로 주제 범위 안이다. edition: 20X1·20X2 표기만 썼다. nonduplication: 문단 7·8을 인용하는 정본 세트가 없어 새 발췌이며, 문단 9·A1은 물음 1의 ⑤가 후단(재작성에 관한 구체적 서면진술)을, 이 물음의 ⑫가 전단(감사의견에서 언급된 모든 기간)을 각각 쓴다. crit9의 claim에 "재작성에 관한 구체적 서면진술만 받으면 된다고 쓰면 인정하지 않는다"를 두어 두 요구를 갈라 두었고 critical_facts.expected도 서로 다르다.',
        },
    ],
    observations_not_blocking: [
        '배정서는 대상 갱신본을 대응수치 사례로 보고 "대응수치 방식 하나로 고정"하라고 지시했으나, 정본 대조 결과 대상 갱신본은 비교재무제표 사례였다. 두 방식을 섞지 말라는 취지를 지키면서 대상 갱신본의 항목을 보존하기 위해 비교재무제표로 고정했다. 판단 근거와 승계하지 않은 요구는 lineage.json의 approach_conflict·dropped_requirements에 있다. 설치 전에 조율자 확인이 필요하다.',
        'pilot-16-008의 사례형 물음 sub1·sub4(KGA 710 문단 11, 5점)는 이 회차에서 승계하지 않는다. 후속 회차에서 대응수치 기준서형 물음으로 살릴지 조율자가 정해야 한다.',
        '새 세트 ID는 case-16-comparative-restatement-20260921이며 원 두 세트의 퇴역과 정본 설치는 조율자(메인 세션)가 수행한다.',
        'criterion ID는 세트 전체에 crit1~crit9로 연번을 매겼다. 물음 접두사가 붙은 ID를 채점 모델이 잘못 되돌려 주는 문제를 피하기 위한 것이며 대상 갱신본의 subN.cM 형식과 다르다.',
        'validateAuthoringBank의 현재 물음 수 규칙은 "학습 유형·주제가 있는 물음은 1~4개, 기존 linked set은 세부 물음 2~4개"다. 공통 작업지시서가 적은 "2~3개"보다 넓지만 이 초안은 3물음이어서 어느 규칙에서도 통과한다.',
        '형제 회차(r28~r30·r32)의 초안이 같은 시각에 만들어지고 있다. 발문 바이트 충돌 대조는 실측 직전에 한 번 더 수행한다.',
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
        file: `${D}/standards-sets.json`,
        sha256: hash(`${D}/standards-sets.json`),
        set_id: standardsSet.id,
        reviewed_content_sha256: reviewedContentHash(standardsSet),
    },
    evidence,
    method_detail:
        'KGA 710 문단 2·10·11·12·13·14와 적용자료 A2~A8을 등록 전문 point-review-710-appendix-2026-09-11.txt에서 직접 읽고, pilot-16-008/sub2의 두 criterion 명제가 문단 12의 두 허용 의견에, sub3의 네 criterion 명제가 문단 13(a)·(b) 전단·(b) 후단·(c)에 각각 대응하는지 대조했다. 어느 물음이 기준서형인지는 cpa_uploader/data/learning-question-classifications.json의 question_style로 확인했고(sub1·sub4는 case, sub2·sub3은 standard), 점수 합계가 배정서의 "기준서형 2물음 6점"과 일치함을 확인했다. 인용 세 개(문단 2·12·13)는 pilot-16-008의 정본 인용을 바이트와 content_hash 그대로 재사용했다. 물음 ID(sub2·sub3), 여섯 명제, 정수 배점(각 1점), 모범답안, 출처를 원 세트에서 승계하고 발문만 다시 썼다. criterion·requirement ID는 세트 안의 연번으로 다시 매겼고 대응표를 lineage.json의 standards_split에 남겼다. 기준서형 세트의 물음 수 상한은 cpa_uploader/questionBankPublication.ts의 validateAuthoringBank를 직접 읽어 확인했다(학습 유형·주제가 있는 물음은 1~4개). validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다.',
    questions: [
        {
            subquestion_id: 'sub2',
            checks: pass(),
            rationale:
                'source: crit1·crit2는 문단 12의 결론 문장(당기 재무제표에 포함된 대응수치로 인한 의견변형에 따라, 당기 재무제표에 대하여 한정의견이나 부적정의견을 표명하여야 한다)에서 확정했다. 두 의견은 대체 가능한 두 결론이므로 각각을 독립 득점 단위로 둔 원 설계를 유지했다. answer: 모범답안은 "당기재무제표에 대하여 한정의견이나 부적정의견을 표명한다" 한 문장이며 두 criterion을 모두 담는다. 사례 사실이나 다른 물음을 참조하는 표현이 없다. prompt: 독립 발문은 문단 12의 적용 조건(이전에 적정의견이 표명되었던 전기재무제표에 중요한 왜곡표시가 존재한다는 감사증거를 입수하였으나 대응수치가 적절하게 재작성되지 않았거나 적절한 공시가 이루어지지 않았다)과 문단 기호로 범위만 정하고 정답 항목의 핵심어(한정의견·부적정의견)와 개수를 알려 주지 않는다. 원 발문의 "표명하여야 하는 감사의견"이 답이 하나라는 인상을 주어 "문단 12가 이 경우에 대하여 정하고 있는 … 감사의견"으로 고쳤고, 원 세트가 퇴역 전까지 정본에 남아 발문 바이트가 겹치는 문제도 함께 해소했다. 전후 발문과 사유는 design-standards.json의 prompt_revision에 있다. points: 두 독립 명제 각 1점으로 2점이며 원 배점을 그대로 유지했다. 발문이 바뀌어도 명제·critical_facts는 바꾸지 않았다. style: shared_context.facts가 비어 있고 특정 회사의 사실·자료·다른 물음의 판단을 해석할 필요가 없으므로 기준서형이다. 사례를 보지 않은 답안으로 만점이 가능한지는 모범답안 요청으로 실측한다. topics: 16을 실제 요구에서 정했다. edition: pilot-16-008의 판본 기록을 승계했고 KGA 710 2025 개정 전문을 적용한다. nonduplication: 현재 정본에서 문단 12를 인용하는 세트는 원 pilot-16-008뿐이다. std-points-20260914-99e4265696b2는 문단 2·6(b)·6(c)의 정의를, case-09-initial-audit-20260915는 문단 2·17을 쓴다. 같은 회차의 사례형 확장본은 문단 12를 인용하지 않는다.',
        },
        {
            subquestion_id: 'sub3',
            checks: pass(),
            rationale:
                'source: crit3은 문단 13(a)(전기재무제표는 전임감사인이 감사하였음), crit4·crit5는 13(b)(전임감사인이 표명한 의견의 유형, 그리고 해당 의견이 변형되었으면 그 이유), crit6은 13(c)(전임감사인의 감사보고서일)에서 확정했다. 13(b)는 의견 유형이라는 무조건 기재 사항과 변형 이유라는 조건부 기재 사항을 함께 담고 있어 criterion을 나눈 원 설계를 유지했다. answer: 모범답안 네 문장이 네 criterion과 1대1로 대응한다. prompt: 독립 발문은 문단 13의 적용 조건(전기재무제표가 전임감사인의 감사를 받았고, 대응수치에 대하여 전임감사인의 감사보고서를 언급하는 것이 법규상 금지되지 아니하여 감사인이 이를 언급하기로 결정함)과 항 기호((a), (b), (c))로 범위만 정한다. 항 기호는 세 개이고 득점 단위는 네 개여서 정답 수를 알려 주지 않으며, 정답 항목의 핵심어(감사 사실, 의견의 유형, 변형 이유, 감사보고서일)도 쓰지 않았다. r21의 pilot-11-005-standards-20260921이 같은 방식을 썼다. 원 발문은 정답 암시 문제가 없었으나 정본의 pilot-16-008/sub3과 바이트가 같아 적용 조건 서술을 다시 썼다. points: 네 독립 명제 각 1점으로 4점이며 원 배점을 유지했다. 열거형이므로 정답인 독립 요소마다 1점을 부여하는 공통 배점 계약과 일치한다. style: shared_context.facts가 비어 있고 발문이 문단 13의 적용 조건만 서술하므로 기준서형이다. topics: 16. edition: pilot-16-008의 판본 기록을 승계했다. nonduplication: 현재 정본에서 문단 13을 인용하는 세트는 원 pilot-16-008뿐이다. 비교재무제표 절의 대응 요구인 문단 17은 case-09-initial-audit-20260915와 같은 회차의 사례형 확장본이 쓰지만 문단이 다르고 기재 의무의 성격(임의 대 의무)도 달라 요구가 겹치지 않는다.',
        },
    ],
    observations_not_blocking: [
        '새 세트 ID는 r17·r21의 "-standards-" 선례를 따라 pilot-16-008-standards-20260921로 정했다. 원 세트 pilot-16-008이 퇴역해도 계보는 이 ID와 lineage.json으로 추적한다.',
        '이 세트는 물음이 둘이므로 학습 단위가 pilot-16-008-standards-20260921--sub2--standard와 --sub3--standard 두 개가 된다. r17·r21의 기준서형 세트는 물음이 하나여서 단위도 하나였다. 운영 반영 드라이버가 <세트ID>--case만 찾거나 단위가 하나라고 단정하면 이 세트에서 멈추므로 반영 전에 유형별·복수 단위 확인을 고쳐야 한다.',
        '학습 단위가 둘이므로 실제 채점 요청도 물음마다 모범·부분·오답 세 건씩 모두 여섯 건이 된다. r21의 기준서형 세 요청보다 많으며 사유를 policy.json의 reuse_decision에 남긴다.',
        '이 세트는 퇴역 없이 추가만 한다.',
        'pilot-16-008의 사례형 물음 sub1·sub4(문단 11)는 이 세트로 옮기지 않았다. 배정서가 이 세트의 범위를 기준서형 2물음으로 명시했기 때문이며, 그 두 물음의 처리는 조율자 판단에 남긴다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(R, { recursive: true });
write(`${R}/root-content-review-v1.json`, caseReview);
write(`${R}/root-content-review-standards-v1.json`, standardsReview);
console.log(JSON.stringify({
    case: { file: `${R}/root-content-review-v1.json`, reviewed_content_sha256: caseReview.target.reviewed_content_sha256 },
    standards: { file: `${R}/root-content-review-standards-v1.json`, reviewed_content_sha256: standardsReview.target.reviewed_content_sha256 },
}, null, 2));
