// r21 agent 내용 검토 장부 기록기. 사례형·기준서형 두 파일을 한 번만 기록한다.
// 기존 파일이 있으면 쓰지 않는다(flag: 'wx'). 초안 내용을 고쳤으면 장부의 해시만 바꾸지 말고
// 앞선 기록을 지운 뒤 이 기록기를 다시 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge/record-review.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
process.chdir(root);

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r21';
const REVIEWER = 'agent:claude-opus-5 (author agent; no independent peer review)';
const REVIEWED_AT = '2026-09-21T06:20:00.000Z';

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
    'cpa_uploader/data/official/delegated-n04-kga-2025.txt',
    'cpa_uploader/data/official/case-followup-2026-09-14-kga540.md',
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
        'KGA 540의 요구사항 문단 10·11·14·18·22~30·32와 적용자료 A55~A60·A94·A109~A125·A133~A136을 등록 전문 두 파일(delegated-n04-kga-2025.txt, case-followup-2026-09-14-kga540.md)에서 직접 읽고, 열네 항목의 옳고 그름과 세 물음의 열 개 criterion을 문단 단위로 확정했다. 인용 열여섯 개 가운데 열네 개는 두 원 세트(pilot-11-005, case-11-estimate-lookback-20260914)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 문단 A57(L54-L56)·A58(L62-L72)만 case-followup-2026-09-14-kga540.md에서 새로 발췌했다. 현재 정본 354세트에서 KGA 540을 인용하는 세트 여섯 개와 경영진 편의를 다루는 case-05-management-override-20260913을 모두 읽고 발문·모범답안·criterion을 대조했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했고, 현재 정본과 같은 배치의 초안 발문을 모두 정규화하여 바이트 충돌이 없음을 확인했다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: pass(),
            rationale:
                'source: ①은 문단 22 본문과 22(b)(경영진이 점추정치를 선택하고 회계추정치에 대한 관련 공시를 개발한 방법), ④는 문단 29(a), ⑥은 문단 29(b)에서 확정했다. 옳은 항목은 ②가 문단 26(a)와 A109(a), ③이 A122, ⑤가 A125의 결론 문장("이 감사기준서의 요구사항에 따라 수행한 절차와 입수한 감사증거에 근거하여, 감사인은 중요성의 배수인 범위추정치가 감사인이 판단하기에 상황에 있어 적합하다고 결론지을 수 있다")에서 확정했다. A125가 보험업·은행업에서 더 흔하다고 예시하지만 결론 문장은 산업을 한정하지 않고, 중요성이 운영성과(세전이익)에 근거하였다는 전제는 사실로 두었으므로 제조업 사례에서도 성립한다. A124는 ④의 인접 조건(범위 내 각 금액의 개별 증거까지 요구하지는 않음)을 다루지만 ④의 잘못은 범위에 포함된 금액의 뒷받침·합리성 자체를 결정하지 않은 것이므로 A124로 다투어지지 않는다. answer: 모범답안은 식별 문장과 세 항목의 이유·보완절차로 이루어지고 각 문장이 crit1~crit4와 1대1로 대응한다. prompt: 발문은 자료 범위(①~⑥)와 요구(옳지 않은 것을 모두 찾아 번호와 이유 또는 수행하였어야 할 절차)를 적을 뿐 옳지 않은 항목의 수·내용·근거를 알려 주지 않는다. 단계 이름("추정불확실성의 정도를 평가하는 단계")은 배정된 도입 규칙이며 정본·형제 초안 어느 발문과도 정규화 바이트가 같지 않다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이다. 문단 22(b)의 두 대상과 문단 29(a)의 두 요건은 각각 하나의 잘못에 대한 대안적 이유이므로 항목을 나누지 않고 한 criterion에서 둘 중 하나를 인정했으며, 그 결과 원 pilot-11-005의 7점이 3점으로 줄었다. 줄어든 사유는 lineage.json의 points에 있다. style: 여섯 항목의 옳고 그름이 경영진이 점추정치·주석 초안까지 제출했다는 점, 할인율 가정만 중요왜곡표시위험을 발생시킨다는 평가, 범위의 폭과 중요성 기준, 주석 문구와 당기 시장 변동이라는 사실에 달려 있어 사례형이다. topics: 11을 실제 요구에서 정했다. edition: KGA 540 2025 개정 전문을 적용하고 20X1·20X2 표기만 썼다. nonduplication: 문단 22(b)는 std-points-20260914-de06831a21f9가 발문에서 명시적으로 제외한 범위이고, 문단 29는 원 pilot-11-005 외에 인용하는 세트가 없다.',
        },
        {
            subquestion_id: 'sub2',
            checks: pass(),
            rationale:
                'source: ⑦은 문단 14 전단(당기의 중요왜곡표시위험을 식별하고 평가하는 데 도움을 주기 위하여 이전 회계추정치의 결과, 또는 해당되는 경우 후속적인 재추정을 검토하여야 한다)과 A55, ⑨는 문단 14 후단(추정 당시 이용가능했던 정보에 근거하여 적합한 과거 보고기간의 회계추정치에 대한 판단에 의문을 제기하는 목적이 아니다)과 A60 전단에서 확정했다. 옳은 항목은 ⑧이 A57, ⑩이 A58 후단에서 확정했다. A60은 차이가 왜곡표시일 수 있는 경우도 함께 서술하지만, 차이의 원인이 전기재무제표 확정 후에 발생하였고 전기 산정 당시 자료가 산정표에 반영되어 있었다는 사실로 그 경우를 배제했다. A58 전단(고유위험이 높은 경우의 세부 소급적 검토)은 대손충당금의 고유위험을 높게 평가하지 않았다는 배제 사실로 막았다. answer: 모범답안 세 문장이 crit5~crit7과 1대1로 대응하고 사례의 사실(재추정 자료의 존재, 차이의 원인과 전기 자료 반영)을 인용한다. prompt: 단계 이름("전기 회계추정의 확정치를 재검토하는 단계")과 자료 범위(⑦~⑩)만 적고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이다. 원 54번의 검토 대상·목적 criterion과 사후 원인 criterion은 각 항목의 대안적 이유로 흡수하여 5점이 2점으로 줄었고 식별 1점이 새로 붙었다. style: 네 항목의 옳고 그름이 A형의 재추정 자료 존재, B형 차이의 원인과 시점, 대손충당금의 성격이라는 사실에 달려 있어 사례형이다. topics: 11. edition: 20X1·20X2 표기만 쓰고 적용 판본은 notes에 적었다. nonduplication: 문단 14·A55~A60을 인용하는 다른 정본 세트는 원 case-11-estimate-lookback-20260914뿐이며, A57·A58은 정본 어느 세트도 인용하지 않는 새 발췌다.',
        },
        {
            subquestion_id: 'sub3',
            checks: pass(),
            rationale:
                'source: ⑪은 문단 32 전단(개별적으로는 합리적일지라도 경영진의 편의가능성을 나타내는 징후인지를 평가하여야 한다)과 A133, ⑫는 A134 후단(경영진의 편의가능성 징후 자체가 개별 회계추정치의 합리성에 대한 결론을 도출하기 위한 목적상 왜곡표시에 해당되지는 않는다)에서 확정했다. 옳은 항목은 ⑬이 문단 24(b), ⑭가 A123에서 확정했다. 문단 32 셋째 문장(오도할 의도가 있는 경우 편의는 본질적으로 부정)은 항목으로 두지 않고 오도 의도의 증거가 없다는 배제 사실로만 두었다. A134 후단의 마지막 문장(어떤 경우에는 감사증거가 왜곡표시임을 보여줄 수 있다)은 개별 금액의 왜곡 증거가 아직 없다는 사실로 배제했다. answer: 모범답안 세 문장이 crit8~crit10과 1대1로 대응한다. prompt: 단계 이름("경영진 편의의 징후를 평가하는 단계")과 자료 범위(⑪~⑭)만 적는다. 자료 3을 처리방안 형식으로 둔 것은 ⑪과 ⑫가 서로 배타적인 대안이기 때문이고 네 항목이 모두 같은 형식이어서 형식이 정답 표지가 되지 않는다. 옳은 항목 ⑬·⑭가 편의 징후를 다루는 절차라는 점에서 ⑪의 검토 종료 결정과 대조되는 인접성이 남아 있으나, 두 항목의 근거(문단 24(b)·A123)는 문단 32의 평가 의무와 다른 요구이므로 정답을 알려 주지 않는다고 판단했다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이며 원 54번 sub3의 3점과 같다. style: 네 항목의 옳고 그름이 세 보고기간의 방향성 있는 선택, 개별 합리성 자료, 위반·의도 증거의 부재라는 사실에 달려 있어 사례형이다. topics: 11. edition: 20X1·20X2 표기만 썼다. nonduplication: pilot-11-002 sub2가 문단 32·A133을 사실 없이 묻는 기준서형이지만 이 물음은 같은 문단을 세 기간 선택 양상이라는 사실에 적용하고 ⑫(A134 후단)는 그 기준서형에 없는 요구다. 설계서 42번(case-05-management-override-20260913 sub3)은 KGA 240으로 같은 논점을 다루며 조율자 배정에 따라 이 논점을 r21에 두고 r25에서 뺀다.',
        },
    ],
    observations_not_blocking: [
        '새 세트 ID는 case-11-accounting-estimate-20260921이며 원 두 세트의 퇴역과 정본 설치는 조율자(메인 세션)가 수행한다.',
        'criterion ID는 세트 전체에 crit1~crit10으로 연번을 매겼다. 물음 접두사가 붙은 ID를 채점 모델이 잘못 되돌려 주는 문제를 피하기 위한 것이며 r16~r19의 subN.cM 형식과 다르다.',
        '형제 회차(r20·r22~r27)의 초안은 이 검토 시점에 아직 만들어지지 않았다. 발문 바이트 충돌 대조는 실측 직전에 한 번 더 수행한다.',
        'r25(42·64)의 초안이 나오면 경영진 편의 요구가 이 세트와 겹치지 않는지 다시 대조해야 한다.',
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
        'KGA 540 문단 26·27·28·29와 적용자료 A109~A125를 등록 전문 delegated-n04-kga-2025.txt에서 직접 읽고, pilot-11-005/sub2의 다섯 criterion 명제가 문단 27(a)·(b)·(c)의 요구에 각각 대응하는지 대조했다. 인용 네 개(문단 27·A115·A116·A117)는 pilot-11-005의 정본 인용을 바이트와 content_hash 그대로 재사용했다. 물음 ID(sub2), 다섯 명제, 정수 배점(각 1점), 모범답안, 출처를 원 세트에서 승계하고 발문만 기준서형 발문의 정답 암시 금지 기준으로 고쳤다. criterion·requirement ID는 세트 안의 연번으로 다시 매겼고 대응표를 lineage.json의 standards_split에 남겼다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다.',
    questions: [
        {
            subquestion_id: 'sub2',
            checks: pass(),
            rationale:
                'source: crit1은 문단 27(a) 전단(경영진에게 추정불확실성을 이해하거나 점추정치의 선택을 재고하거나 추가적인 공시를 제공함으로써 추정불확실성을 다루는 추가적인 절차를 수행하도록 요구), crit2는 27(a) 후단(경영진의 대응을 문단 26에 따라 평가), crit3은 27(b)(대응이 충분하지 않다고 결정하는 경우 실행가능한 정도까지 문단 28-29에 따라 점추정치 또는 범위추정치를 도출), crit4·crit5는 27(c)(내부통제 미비점의 존재 여부 평가와 미비점이 존재하는 경우 감사기준서 265에 따른 커뮤니케이션)에서 확정했다. A115는 경영진에게 요청할 추가 절차의 예(대체적 가정의 고려, 민감도 분석), A116·A117은 실행가능성 판단의 고려사항이므로 crit1·crit3의 보강 근거로 붙였다. answer: 모범답안 다섯 문장이 다섯 criterion과 1대1로 대응하며 사례 사실이나 다른 물음을 참조하는 표현이 없다. prompt: 독립 발문은 문단 27의 적용 조건과 문단·항 기호((a), (b), (c))로 범위만 정하고 정답 항목의 핵심어·결론·개수를 알려 주지 않는다. 원 발문의 "적용 조건과 함께"가 crit3·crit5의 조건부 득점 요건을 알려 주고, 원 발문이 사례의 사실처럼 단정하여 시작해 기준서형 독립 발문에 맞지 않아 고쳤다. 전후 발문과 사유는 design-standards.json의 prompt_revision에 있다. 답이 정해진 예/아니오나 답을 가정한 후속 요구는 쓰지 않았다. points: 다섯 독립 명제 각 1점으로 5점이며 원 배점을 그대로 유지했다. 문단 27(a)와 27(c)는 각각 서로 독립된 두 요구를 담고 있어 criterion을 나눈 원 설계를 유지했고, 발문이 바뀌어도 명제·critical_facts는 바꾸지 않았다. style: shared_context.facts가 비어 있고 특정 회사의 사실·자료·다른 물음의 판단을 해석할 필요가 없으므로 기준서형이다. 사례를 보지 않은 답안으로 만점이 가능한지는 모범답안 요청으로 실측한다. topics: 11을 실제 요구에서 정했다. edition: pilot-11-005의 판본 기록을 승계했고 KGA 540 2025 개정 전문을 적용한다. nonduplication: 현재 정본에서 문단 27을 인용해 득점 요건으로 삼은 세트는 원 pilot-11-005뿐이다. pilot-11-002는 문단 32·A133·A134를, std-points-20260914-de06831a21f9는 문단 22(a)를 다룬다. 같은 회차의 사례형 병합본은 문단 27을 인용하지 않는다.',
        },
    ],
    observations_not_blocking: [
        '새 세트 ID는 r17의 "-standards-" 선례를 따라 pilot-11-005-standards-20260921로 정했다. 원 세트 pilot-11-005가 퇴역해도 계보는 이 ID와 lineage.json으로 추적한다.',
        '이 세트의 물음은 하나이므로 학습 단위 ID는 pilot-11-005-standards-20260921--sub2--standard가 된다. 운영 반영 드라이버가 <세트ID>--case만 찾으면 이 단위에서 멈추므로 반영 전에 유형별 단위 확인을 고쳐야 한다.',
        '이 세트는 퇴역 없이 추가만 한다.',
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
