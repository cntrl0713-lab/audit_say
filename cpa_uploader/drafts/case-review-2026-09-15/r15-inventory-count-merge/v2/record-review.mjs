// r15 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r15/root-content-review-v2.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r15');
const SET_ID = 'case-09-inventory-count-20260920';

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
        'cpa_uploader/data/official/kga501-505-510-2025-review09.txt',
        'cpa_uploader/data/official/delegated-r01-kga-2025.txt',
        'cpa_uploader/data/official/delegated-s03-kga-2025.txt',
        'cpa_uploader/data/official/case-deepening-2026-09-14-kga501.md',
        'cpa_uploader/data/official/kga520-530-2025-review10.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/sets.json',
        'cpa_uploader/analysis/reviews/case-review-2026-09-15/r15/root-content-review-v1.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    supersedes: { version: 1, file: 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r15/root-content-review-v1.json' },
    version_change:
        'v2에서 두 물음의 발문만 바꾸었다. v1을 만든 뒤 다른 세션이 정본에 설치한 case-10-analytical-procedures-20260920의 발문과 바이트가 같아 새 정본에 대한 validateAuthoringBank가 발문 중복으로 거절했다. 은행의 다른 선택형 사례가 쓰는 대로 자료 번호 대신 단계 이름으로 범위를 정했고, 두 발문 모두 다루는 단계의 범위만 알려 준다. 사실관계·항목·모범답안·criterion·배점·출처는 v1과 같으며 v1의 초안 파일과 실행 증거는 보존한다. 발문은 채점 모델이 함께 읽는 입력이므로 v1의 대표 실측을 승계하지 않고 v2에서 다시 실측한다.',
    method_detail:
        'KGA 501의 등록 전문(kga501-505-510-2025-review09.txt의 문단 1~13과 A1·A2·A11~A15, delegated-s03-kga-2025.txt의 문단 2 시행일과 문단 9~13·A17~A23, delegated-r01-kga-2025.txt의 문단 5·A9, case-deepening-2026-09-14-kga501.md의 문단 A3·A7)과 KGA 530 문단 6(kga520-530-2025-review10.txt)을 직접 읽고 아홉 항목의 옳고 그름을 문단 단위로 확정했다. 인용 아홉 개 가운데 다섯 개(문단 5·A9·A3·A7, KGA 530 문단 6)는 병합 대상인 두 원 세트(draft-09-501-freq01, case-09-inventory-location-population-20260914)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 새로 쓰는 문단 4(a)·4(b)·8·A11만 이미 등록된 전문 kga501-505-510-2025-review09.txt(L26-L34, L42-L43, L54-L59, L112-L116)에서 발췌해 SHA-256을 계산했다. 아홉 인용 모두 파일의 바이트와 정확히 일치함을 별도로 확인했고 validate_draft_v3.ts --against-bank로 인용 원문 실존, 형상, 기존 은행과의 ID·발문 중복 없음을 확인했다. 현재 정본에서 KGA 501을 인용한 모든 세트(pilot-09-002, pilot-09-009, std-points-20260914-e615676c4f59, std-points-20260914-2ae588b5cc20, std-points-20260914-01449b4b68f4, std-points-20260914-bb44226b906a, std-points-20260914-d6c7d2ca05e6, draft-09-501-freq01, draft-09-501-freq01-standards-20260913, case-09-legal-inquiry-20260914, case-09-inventory-location-population-20260914, case-15-scope-limitation-disclaimer-20260919)와 KGA 530을 인용한 모든 세트(pilot-10-001, pilot-10-003, pilot-10-004, pilot-10-005, pilot-10-006, draft-10-530-freq01, draft-standard-followup-20260913-s03, case-10-control-sample-frame-20260914, case-10-anomaly-projection-conclusion-20260914, std-points-20260914-aa672e0fc674, std-points-20260914-a11d5f35f990, std-points-20260914-d1bdf656a521, std-points-20260914-a9f84f7eef8b, std-points-20260914-22ef6986d79c), 그리고 재고자산 실사를 다루는 사례형(case-09-initial-audit-20260915)의 발문·criterion을 읽어 중복을 대조했다. 판본은 KGA 501 문단 2(2026년 1월 1일 이후 개시 보고기간부터 시행)를 등록 전문에서 직접 확인하고, 2026 전문 대조는 두 원 세트가 남긴 기록을 재사용했으며 새 원자료 수집은 하지 않았다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 문단 4(a)(i)(ii)(iii), ②는 문단 A3의 "적절한 입회장소를 결정시 보관장소(장소 별 재고자산의 중요성 및 중요왜곡표시위험 포함)", ③은 KGA 530 문단 6, ④는 문단 A7의 두 추적 방향, ⑤는 문단 8(a)에서 각각 확정했다. 문단 4(a)의 "실행불가능하지 않는 한"이라는 예외와 문단 7·A12~A14(입회가 실행가능하지 않은 경우의 대체절차)를 함께 읽고, 이 사례에는 입회를 실행불가능하게 하는 사실이 없어 ②의 위반이 유지됨을 확인했다. 문단 8 본문의 "다음 중 하나 이상의 절차"와 A15(조회는 KGA 505를 따름)를 읽어 ⑤가 조회만으로도 요구사항을 충족함을 확정했다. A1(경영진이 연 1회 이상 실사절차를 수립)과 문단 5를 읽어 회사가 11월 30일을 실사기준일로 정한 것 자체는 이 물음의 판단 대상이 아님을 확인했다. answer: 모범답안 네 문장이 식별·②·③·④ criterion과 1대1로 대응하고, 옳은 항목 ①·⑤의 근거도 함께 제시한다. prompt: 발문은 자료 범위와 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이며, 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 인정한다. 표본규모 산정 방법이나 조회서 문안 같은 구체적 방법은 요구하지 않는다. style: 다섯 항목의 옳고 그름이 한별상사의 장소별 보관금액 비중과 위험징후, 두 장소의 상품 성격·관리 부서·실사팀 차이, 별도 보관구역의 실물 존재, 제3자 보관이라는 사실에 따라 달라지므로 사례형이다. topics: 09(재고자산 실사의 입회장소·테스트 실사·제3자 보관)와 10(테스트 실사 표본의 모집단 특성)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했고 KGA 501 문단 2의 시행일을 확인했다. nonduplication: 같은 문단을 쓰는 pilot-09-002(문단 4(a) 열거)·std-points-20260914-2ae588b5cc20(문단 4·7)·std-points-20260914-d6c7d2ca05e6(문단 8)·pilot-10-001(KGA 530 문단 A5)·std-points-20260914-aa672e0fc674(계층화)는 모두 기준서형으로 사실 적용을 요구하지 않고, 사례형 case-10-control-sample-frame-20260914는 모집단의 완전성을 다루어 이 물음의 동질성 요구와 다르다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑥은 문단 A9("계속기록법을 유지하는지 여부와 관계없이 … 통제의 설계, 실행 및 유지의 효과성은 … 감사목적에 적합한지 여부를 결정"), ⑦은 문단 5, ⑧은 문단 A11의 세 번째 고려사항("실사 중 입수된 정보와 계속기록법에 의한 재고기록 간의 유의적 차이에 대한 이유"), ⑨는 문단 4(b)에서 확정했다. A11의 나머지 두 고려사항(계속기록법 재고기록의 조정 여부, 재고기록의 신뢰성)을 함께 읽고 ⑧이 조정 사실의 확인에 그쳐 세 번째 고려사항을 다루지 않았음을 구분했다. 문단 6(감사인이 예상하지 못한 상황으로 입회할 수 없는 경우)은 이 사례의 트리거가 아니므로 인용하지 않았고 항목으로도 두지 않았다. answer: 모범답안 네 문장이 식별·⑥·⑦·⑧ criterion과 1대1로 대응하고 옳은 항목 ⑨의 근거도 제시한다. prompt: 자료 범위와 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이며, ⑥은 통제의 설계·실행·유지 가운데 일부만 들어도 인정하고 12월 거래에 대한 구체적 표본 설계나 증빙의 종류는 요구하지 않는다. style: 네 항목의 옳고 그름이 실사기준일과 재무제표일의 차이, 12월 대규모 입출고, 대조 담당자의 퇴사와 인계 미확인·12월 기록 미입수, 11월 30일 실사에서 나타난 유의적 차이라는 사실에 달려 있으므로 사례형이다. topics: 09(기중 실사 이후의 감사절차와 최종 기록)와 06(재고변동 통제의 설계·실행·유지 효과성)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 문단 5·A9·A11의 본문은 두 원 세트가 2026 전문과 대조한 기록을 재사용했다. nonduplication: draft-09-501-freq01-standards-20260913은 문단 A9의 세 측면을 사실 없이 열거하게 하는 기준서형이고, case-09-initial-audit-20260915의 ⑥은 기말 실사 수량을 기초 재고로 역산한 결과의 평가 증거 한계(KGA 510)를 다루어 방향과 요구가 다르다. case-15-scope-limitation-disclaimer-20260919의 옳은 항목 ④는 문단 6과 감사범위 제한을 다루므로 이 물음의 문단 5·A9·A11과 근거·결론이 어긋나지 않는다.',
        },
    ],
    observations_not_blocking: [
        '⑥(통제 효과성을 고려하지 않은 적합성 결론)과 ⑧(유의적 차이의 이유를 다루지 않은 처리)은 모두 실사일 이후 절차의 전제를 다루므로 한 사례 안에서 인접해 있다. 근거 문단이 A9와 A11로 다르고 각각 독립적으로 성립하여 그대로 두었다. 통제 평가를 옳게 수행한 항목은 두지 않아 ⑥의 정답을 다른 항목이 드러내지 않게 했다.',
        '원 draft-09-501-freq01이 통제의 설계·실행·유지를 criterion 세 개(각 1점)로 나누어 배점하던 것을 문단 A9의 한 요구로 보아 ⑥의 1점으로 합쳤다. 그 결과 이 세트에는 통제의 실행 확인과 유지 평가를 각각 묻는 득점 요건이 없으며, 세 측면의 열거는 기준서형 draft-09-501-freq01-standards-20260913이 계속 다룬다.',
        '득점 요건에서 빠진 옳은 항목 ①·⑤·⑨의 판단은 식별 criterion에서만 평가된다. 함정 ⑤나 ⑨를 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '이 세션은 배치 안내로 받은 기출 빈도(기중 실사 입회 시 감사절차 4회, 재고변동 내부통제 고려 2회, 여러 창고의 모집단 통합 1회)를 빈도표에서 다시 집계하지 않았다. design.json의 exam_elements에 전달받은 값임을 밝혀 두었고 새 집계 근거로 쓰지 않는다.',
    ],
    observations_v2: [
        '정본 설치 후 새 정본(363세트)에 이 초안을 더해 validateAuthoringBank를 다시 실행하여, v1의 두 발문이 새로 설치된 case-10-analytical-procedures-20260920의 발문과 중복된다는 오류를 확인하고 발문을 고쳤다. v2 초안으로 다시 실행한 결과 오류는 0개다(364세트·531물음·1,847점).',
        '새 발문 두 개가 현재 정본의 어떤 발문과도 겹치지 않는지 정규화 문자열로 전수 대조했다. 은행의 다른 선택형 사례형(case-09-initial-audit-20260915, case-15-scope-limitation-disclaimer-20260919 등)과 같은 단계 이름 방식이다.',
        '퇴역으로 정본에서 빠진 case-10-completion-analytics-20260914·pilot-10-007과 새로 들어온 case-10-analytical-procedures-20260920은 모두 KGA 501·530을 인용하지 않아, v1에서 마친 중복 대조의 결론은 새 정본에서도 그대로 성립한다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v2.json'), `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v2.json 기록:', review.target.reviewed_content_sha256);
