// r37 사례형 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r37/root-content-review-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r37');
const SET_ID = 'case-18-small-entity-20260921';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) });
const [draft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT_DIR, 'sets.json'), 'utf8'));
if (draft.id !== SET_ID) throw new Error('set id 불일치');

const PASS = {
    source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass',
    style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass',
};

const review = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)',
    reviewed_at: new Date().toISOString(),
    target: {
        file: `${DRAFT_DIR}/sets.json`,
        sha256: ref(`${DRAFT_DIR}/sets.json`).sha256,
        set_id: SET_ID,
        reviewed_content_sha256: reviewedContentHash(draft),
    },
    evidence: [
        `${DRAFT_DIR}/design.json`,
        `${DRAFT_DIR}/lineage.json`,
        `${DRAFT_DIR}/qa.json`,
        `${DRAFT_DIR}/build-draft.mjs`,
        'cpa_uploader/data/official/kga1200-2025-review18.txt',
        'cpa_uploader/data/official/delegated-s06-kga1100-1200-2025.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/사례형-병합-종합문제-설계.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    method_detail:
        '등록 공식 전문 kga1200-2025-review18.txt의 KGA 1200 문단 1~10과 22~33, 보론 2 목차를 직접 읽고 아홉 항목의 옳고 그름을 문단 단위로 확정했다. 각주 1~5는 문단 3에 붙은 각주로서 delegated-s06-kga1100-1200-2025.txt의 등록 인용에 포함되어 있으며 두 파일의 본문이 같은지 대조했다. 인용 5개는 모두 현재 정본의 등록 인용을 바이트와 content_hash 그대로 재사용했다(문단 2·3은 퇴역 대상 pilot-18-005, 문단 4·5는 pilot-18-003, 문단 6은 std-points-20260914-1f185dbcb15a). 새 발췌와 새 원자료 수집은 없다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했고, 현재 정본 341세트에 이 회차의 두 초안을 붙인 전체 후보(343세트)를 메모리에서 validateAuthoringBank로 검증해 오류 0건을 확인했다. 현재 정본에서 KGA 1200을 인용한 세트 12개(pilot-18-001·pilot-18-003·pilot-18-005와 std-points 아홉 세트) 전부의 발문·모범답안·criterion을 읽어 대조했고, 문단 22~26의 대체 후보를 검토하기 위해 주제 08의 KGA 500 세트도 읽었다. 판본은 pilot-18-005의 verification.notes가 남긴 2025 전문·2026 전문 대조 기록을 재사용했고 새 원자료 수집은 하지 않았다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 KGA 1200 문단 2(b)("개별(별도)재무제표상 직전 회계연도말 자산이 200억원 미만 또는 직전 회계연도 매출이 100억원 미만임")의 기준 재무제표·대상 시점 부분, ②는 같은 문단의 "또는", ③은 문단 2(a)(vi)와 문단 3에 붙은 각주 4("외부감사법 제2조 제3호에 따른 지배회사에 해당하여 연결재무제표를 작성하는 회사를 말함"), ④는 각주 5("일반 감사기준서에서 언급하는 \'소규모기업\'은 감사기준서 200 문단 A71의 특성을 지닌 기업으로서 이 감사기준서에서 정의하는 소규모기업과 다르다"), ⑤는 문단 2 본문("다음 조건을 모두 충족하는 기업")에서 확정했다. 옳은 항목과 옳지 않은 항목이 서로의 판단 기준을 알려 주지 않는지 대조했다. ⑤는 (a)와 (b) 사이의 관계를, ②는 (b) 안 두 금액 요건 사이의 관계를 다루는 별개 명제이므로 한쪽이 다른 쪽의 정답을 알려 주지 않으며, 오히려 문장 모양이 비슷해 ⑤가 ②와 함께 잘못 선택되기 쉬운 함정이 된다. ①은 금액의 비교 방법에 관하여 아무 말도 하지 않아 ②의 정답을 드러내지 않는다. answer: 모범답안 네 문장이 식별·②·③·④ criterion과 대응하고 옳은 항목 ①·⑤의 근거도 함께 제시한다. prompt: 발문은 단계 이름(소규모기업 해당 여부를 검토하는 단계)과 항목 범위, 요구 형식만 밝히고 옳지 않은 항목의 수·내용과 회사의 적용대상 결론을 알려 주지 않는다. 원 세트가 발문에 적어 두었던 근거 조건 지정("자산·매출의 양적 조건과 연결하여")은 없앴다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이다. 원 세트는 같은 범위를 8점(sub3 4점 = A·B의 판단 2점 + 이유 2점, sub4 4점 = C·D의 판단 2점 + 이유 2점)으로 두었는데, 대조되는 두 경우 금지로 B·C가 삭제되어 4점이 줄고 A·D의 판단 2점이 선택형 식별 1점으로 흡수되어 1점이 줄었으며, 새 항목 ④(각주 5) 1점이 늘었다. 분리 검토: ②(문단 2(b)의 또는 관계)·③(각주 4의 지배회사 한정)·④(각주 5의 개념 구별)는 근거 문장과 대상이 모두 달라 한 항목으로 묶지 않았고 어느 항목에도 독립된 잘못을 둘 이상 담지 않았다. style: 다섯 항목의 옳고 그름이 20X1년 말 개별재무제표 자산 200억원·20X1년 매출 99억원이라는 금액과, 회사가 지배회사의 연결재무제표에 포함되는 종속회사이며 다른 회사의 지분을 보유하지 않는다는 지배구조 사실에 달려 있으므로 사례형이다. 문단 2의 조문 나열만으로는 ②·③의 판단이 성립하지 않는다. topics: 18을 실제 요구에서 정했다. 이 물음에는 다른 주제의 요구가 없어 18만 두었다. edition: 20X1·20X2 표기이며 KGA 1200의 2025 개정 전문(문단 8: 2023년 1월 1일 이후 개시하는 보고기간의 재무제표에 대한 감사부터 적용)을 기준으로 판단했다. nonduplication: 같은 배치의 기준서형 pilot-18-005-standards-20260921 sub1·sub2는 문단 2(a)의 범주를 열거하고 문단 2(b)를 설명하게 하는 독립 물음이며, 이 물음은 같은 문단을 (주)들녘산업의 금액·지배구조 사실에 적용한 판단의 옳고 그름을 묻는다. 원 세트가 이미 같은 구조(sub1 열거 + sub4 적용)를 가지고 있던 관계를 그대로 이어받았고 학습 단위가 나뉘어 한 화면에 함께 나오지 않는다. 주제 18의 다른 세트 가운데 문단 2를 다루는 것은 pilot-18-005뿐이며 그 세트는 퇴역 대상이다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑥은 KGA 1200 문단 5("감사인은 기업과 서면으로 합의한 경우, 문단 2에 해당하는 기업의 감사에 이 감사기준서 대신 일반 감사기준서를 적용할 수 있다"), ⑦은 문단 3("이 감사기준서는 소규모기업에 해당하지 않는 기업의 재무제표 감사에 적용할 수 없다. … 감사기준서 200에서 감사기준서 720 … 을 적용한다"), ⑧은 문단 4("감사보고서에 회계감사기준 전체를 준수하였다고 기술하거나 일반 감사기준서(또는 그 일부)를 언급해서는 안 된다"), ⑨는 문단 6(전진 적용과 "추가 고려할 사항이나 추가 수행할 절차는 없다", 그리고 마지막 문장의 반대 방향 전환)에서 확정했다. 문단 4는 두 금지를 한 문장에 담고 있으나 ⑧에는 앞의 금지 하나만 담아 한 항목에 독립된 잘못이 하나만 있게 했고, 뒤의 금지(일반 감사기준서 언급)는 항목으로 쓰지 않아 같은 근거가 두 항목에 반복되지 않게 했다. 문단 7(감사 도중 조건 미충족 시 절차)은 옳은 항목으로 두면 "조건 미충족이면 일반 감사기준서를 적용한다"를 보여 주어 ⑦의 정답을 드러내므로 쓰지 않았다. answer: 모범답안 세 문장이 식별·⑦·⑧ criterion과 대응하고 옳은 항목 ⑥·⑨의 근거도 제시한다. prompt: 발문은 단계 이름(적용할 감사기준서와 감사보고에 관하여 감사팀이 정한 사항)과 항목 범위, 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이다. 원 세트에는 이 단계의 요구가 없었고 문단 3·4·5·6을 새로 항목으로 두어 생긴 점수다. 분리 검토: ⑦(문단 3)과 ⑧(문단 4)은 근거 문단과 대상이 달라 한 항목으로 묶지 않았다. 비슷한 물음 대조: 같은 형식의 3점 물음(case-14-group-procedures-20260921 sub2·sub3)과 요구 수·서술 부담이 같다. style: 네 항목의 옳고 그름이 직전 회계연도(20X1년) 감사에서 회사와 서면으로 합의하여 일반 감사기준서를 적용하였다는 사실에 달려 있으므로 사례형이다. 특히 ⑨는 직전 회계연도의 적용 기준서를 알아야 문단 6의 어느 문장(마지막 문장)이 적용되는지 판단할 수 있다. topics: 18을 실제 요구에서 정했다. edition: 위와 같다. nonduplication: pilot-18-001 subq1은 문단 3을 기준서형으로 묻고(적용할 수 있는지 판단하고 적용 기준서 제시), crit6은 그 명제의 진술이 아니라 감사문서 요구사항만 떼어 적용하겠다는 이 사례의 결정이 옳지 않은 이유나 보완절차 중 하나를 요구한다. pilot-18-003 sub1은 문단 4의 두 금지를 열거하고 문단 5를 설명하게 하며, crit7은 금지 항목의 열거를 요구하지 않고 ⑥에는 득점 기준이 없다. std-points-20260914-1f185dbcb15a와 std-points-20260914-15c4192496ff는 문단 6·7을 기준서형으로 다루는데 이 물음은 문단 6을 옳은 항목 ⑨의 근거로만 쓰고 득점 기준을 두지 않았으며 문단 7은 쓰지 않았다. 세 세트 모두 퇴역 대상이 아니다.',
        },
    ],
    observations_not_blocking: [
        '원 세트 pilot-18-005의 네 회사 가운데 A·B(적용대상 해당)와 C(적용대상 아님)는 같은 문단 2(b)에서 결론이 갈린다. A의 자산 200억원과 B의 매출 100억원이 각각 C의 두 금액과 같아, 한쪽의 정답을 읽으면 다른 쪽의 판단 기준(미만과 이하의 구별)이 그대로 드러난다. A만 남기고 B·C를 삭제했다. D는 문단 2(a)(vi)로 판단해 적용 조건이 다르지만 결론이 A와 나란히 갈리므로 회사로는 남기지 않고, 그 요구를 옳지 않은 항목 ③으로 옮겼다. 삭제한 요구와 그 요구를 계속 다루는 문항은 lineage.json의 deleted_requirements에 적었다.',
        '물음 2의 ⑥(문단 5)과 ⑦(문단 3)은 적용 방향이 반대인 두 명제이지만 근거 문단이 다르고 어느 것도 이 회사의 문단 2 판단을 묻지 않는 일반 명제다. ⑥이 옳다는 사실만으로 ⑦의 옳고 그름은 정해지지 않는다. 다만 문단 5의 비대칭(소규모기업이 일반 감사기준서를 선택할 수는 있으나 그 반대는 없다)을 아는 학습자는 ⑦을 상대적으로 쉽게 고를 수 있다. 문단 3이 명시적으로 적용 금지를 정하고 있어 그대로 두었다.',
        'fact1이 "회사 자신은 다른 회사의 지분을 보유하고 있지 않다"고 적어 회사가 연결재무제표를 작성하지 않는다는 점을 추론할 수 있다. 이 사실이 없으면 종속회사이면서 동시에 다른 회사의 지배회사일 수 있어 항목 ③의 옳고 그름이 확정되지 않으므로 남겼다. 이 사실만으로는 문단 2(a)(vi)가 지배회사에 한정된다는 각주 4를 알 수 없어 ③의 정답을 직접 알려 주지는 않는다.',
        '물음 수를 3으로 늘리지 않았다. 셋째 물음 후보인 KGA 1200 문단 22~26(감사증거)은 KGA 500 문단 7~11과 같은 요구여서 주제 08의 pilot-08-001·002·003과 사례형 case-08-sales-receivable-20260920·case-10-sampling-evaluation-20260921이 이미 다루고, 문단 27~31(감사문서)은 주제 18의 기준서형 여섯 세트가 이미 전부 다룬다. 또한 감사 수행 단계를 사실로 두려면 감사팀이 어느 감사기준서를 적용하기로 했는지를 사실관계에 써야 하고 그것이 물음 1의 ②·③·④ 정답을 드러낸다. KGA 1200 문단 32(커뮤니케이션 상대 결정)와 문단 33은 이 초안에서 쓰지 않았고 사례형 후속 제작 후보로 남는다.',
        '옳은 항목 ①·⑤·⑥·⑨에는 득점 기준이 없으며 그 판단은 각 물음의 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '발문 바이트 중복 대조는 현재 정본 341세트의 발문 전부와 같은 배치의 형제 초안 파일(r01~r36의 sets.json·standards-sets.json, 발문 498개)을 대상으로 공백·대소문자 정규화 기준으로 수행해 충돌 0건을 확인했다. 퇴역 예정인 원 세트 pilot-18-005의 네 발문과도 충돌하지 않는다(사례형 두 발문은 선택형으로 새로 썼고 기준서형 두 발문은 분리본에서 다시 썼다). 형제 회차가 동시에 진행되므로 실측 직전에 한 번 더 대조한다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v1.json'), `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v1.json 기록:', review.target.reviewed_content_sha256);
