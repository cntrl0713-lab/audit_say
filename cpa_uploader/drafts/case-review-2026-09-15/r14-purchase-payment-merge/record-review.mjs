// r14 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r14-purchase-payment-merge/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r14/root-content-review-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r14-purchase-payment-merge';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r14');
const SET_ID = 'case-06-purchase-payment-20260920';

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
        'cpa_uploader/data/official/delegated-n02-kga315-2025.txt',
        'cpa_uploader/data/official/kga315-330-2025-review06.txt',
        'cpa_uploader/data/official/kga330-2025-review07.txt',
        'cpa_uploader/data/official/kga500-2025-review08.txt',
        'cpa_uploader/data/official/kga501-505-510-2025-review09.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'cpa_uploader/data/learning-question-classifications.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    method_detail:
        'KGA 315 문단 26·27과 적용자료 A157·A166·A173·A176·A177·A180, 보론 3 항목 20, 보론 6 항목 2, KGA 330 문단 8, KGA 500 문단 6·7·A31·A35, KGA 505 문단 7~15를 등록 전문에서 직접 읽고 열네 항목의 옳고 그름을 문단 단위로 확정했다. 인용 열다섯 개 가운데 열세 개는 병합 대상 세 원 세트(pilot-06-006, pilot-06-007, case-09-unrecorded-liabilities-20260914)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 새로 쓰는 KGA 315 문단 27(kga315-330-2025-review06.txt L297-L298)과 KGA 505 문단 12(kga501-505-510-2025-review09.txt L272-L273)만 등록 전문에서 발췌해 SHA-256을 계산했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다(발문 중복 1차 검사에서 r12 세트 case-10-analytical-procedures-20260920의 sub1·sub2 발문과 문자열이 같아 세 발문에 자료의 주제명을 넣어 구분했다). 현재 정본 363세트에서 이 초안이 인용한 문단을 함께 쓰는 모든 세트(pilot-06-003, std-points-20260914-17c71aee6d2b, std-points-20260914-ac4f0f2444b0, std-points-20260914-a8c1931d1cec, pilot-07-002, pilot-08-001, pilot-08-007, pilot-09-007)의 발문·criterion과 분류 카탈로그의 학습 유형을 읽어 중복을 대조했다. 판본은 원 두 세트가 남긴 2026년 7월 전문 대조 기록을 재사용했으며 새 원자료 수집은 하지 않았다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 문단 26(d)(i)(ii)·A176(설계를 먼저 평가)·A177(질문만으로는 충분하지 않음), ②는 보론 3 항목 20의 업무분장 단락, ③은 문단 26(d)(i)·A176과 보론 3 항목 20의 대사·업무분장 단락, ④는 문단 27, ⑤는 문단 26(a)(d)와 KGA 330 문단 8에서 확정했다. 보론 3 항목 20의 마지막 단락(업무분장이 실무적이지 않은 소규모 기업에서 경영진이 추가 통제를 구성할 수 있음)과 A157을 함께 읽고, 자료 1에 재무·회계 인원이 충분하고 소유경영자 기업이 아니라는 사실을 두어 그 해석을 배제했다. ⑤에 대해서는 KGA 330 문단 8(b)가 적용되지 않도록 자료 1에 실증절차만으로 충분하고 적합한 감사증거를 얻을 수 없는 위험이 없다는 사실을 두었다. answer: 모범답안 네 문장이 식별·②·③·④ criterion과 1대1로 대응하고 옳은 항목 ①·⑤의 근거도 제시한다. prompt: 발문은 자료 범위와 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이며, 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 인정한다. 개선 통제의 구체적 설계나 증적 나열은 요구하지 않는다. style: 다섯 항목의 옳고 그름이 다온의 권한 분리 상태·대사표의 내용·인력 규모·실증절차만으로 증거를 얻을 수 있는지에 관한 사실에 따라 달라지므로 사례형이다. topics: 06(통제활동 구성요소의 이해와 미비점 결정)과 07(통제테스트 수행 여부의 판단)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: 같은 문단을 쓰는 pilot-06-003·std-points-20260914-ac4f0f2444b0·std-points-20260914-a8c1931d1cec·pilot-07-002는 모두 기준서형으로 요구를 사실 없이 재현하게 한다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑥은 문단 26(b)(c), ⑦은 문단 26(c)(i)·A173, ⑧은 문단 26(c)(ii)와 보론 6 항목 2(b)(변경 관리 프로세스, 변경 이관에 대한 업무분장), ⑨는 A166에서 확정했다. A166의 마지막 문장(IT 사용으로 인한 위험이 실증절차만으로는 충분하고 적절한 감사증거를 제공하지 못하는 위험과 관련된 경우 대처할 수 없을 수 있음)을 함께 읽고 자료 1의 사실로 그 상황을 배제했다. A180(설계 평가와 실행 결정만으로는 운영효과성 테스트에 충분하지 않음)도 읽었으나 이 물음에는 운영효과성을 결론지은 항목을 두지 않아 득점 요건에 넣지 않았다. ⑥은 작업 순서만 진술하도록 써서 ⑦·⑧이 판단하는 식별 범위와 겹치지 않게 하였고, ⑨는 "식별한 IT 일반통제"로만 적어 ⑧이 빠뜨린 변경 관리 통제를 지목하지 않는다. answer: 모범답안 세 문장이 식별·⑦·⑧ criterion과 대응하고 옳은 항목 ⑥·⑨의 근거도 제시한다. prompt: 자료 범위와 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이며, IT 일반통제의 구체적 테스트 설계는 요구하지 않는다. style: 네 항목의 옳고 그름이 다온의 권한 부여 상태·개발자의 이관 방식·실증절차로 대처할 수 있는지에 관한 사실에 달려 있으므로 사례형이다. topics: 06(IT 관련 통제의 이해)과 07(IT 일반통제 비효과 예상 시의 대응)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: std-points-20260914-17c71aee6d2b(문단 26(b)~(c) 열거)와 std-points-20260914-ac4f0f2444b0(문단 26(d) 서술)은 기준서형이고, 사례형으로 같은 문단을 다루던 것은 병합 대상 pilot-06-007뿐이다.',
        },
        {
            subquestion_id: 'sub3',
            checks: { ...PASS },
            rationale:
                'source: ⑩은 기출문제_연도별_해설_A 원문 451쪽(1)과 KGA 500 문단 A31(과소계상 테스트에서는 후속적인 지급거래·미지급 송장·매입처 계산서·검수보고서가 관련성 있음), ⑪은 KGA 505 문단 7(b)와 기출 해설 (2)(잔액이 없거나 거의 없더라도 당기 중 주요 거래처에 조회서를 발송) 및 A31, ⑫는 KGA 505 문단 7(c)(d), ⑬은 KGA 505 문단 12, ⑭는 고급_회계감사_연습 원문 129쪽과 KGA 500 문단 6에서 확정했다. KGA 505 문단 13(적극적 조회에 대한 회신이 필요하다고 결정한 경우 대체적 절차로는 부족함)을 함께 읽고 자료 1에 그러한 결정을 하지 않았다는 사실을 두어 ⑬의 다른 해석을 배제했다. 문단 8(경영진이 조회서 발송을 거부하는 경우)과 문단 15(소극적 조회)는 사례에 해당 사실이 없어 적용하지 않았다. answer: 모범답안 네 문장이 식별·⑩·⑪·⑭ criterion과 대응하고 옳은 항목 ⑫·⑬의 근거도 제시한다. prompt: 자료 범위와 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이다. 원 세트가 한 요구의 판단·절차·이유를 각각 배점하던 것을 항목별 1점으로 합쳤고, 표본 수 결정이나 의견 형성은 요구하지 않는다. style: 다섯 항목의 옳고 그름이 다온의 결제주기와 현장 철수 후 자료 접근 가능성, 청솔의 기말 잔액과 연간 매입 실적, 한빛의 12월·1월 납품 사실에 따라 달라지므로 사례형이다. topics: 09(외부조회 통제 유지와 대상자 선택), 08(감사증거의 관련성), 07(완전성 실증절차의 대상기간과 기간귀속)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: pilot-09-007(505 문단 7·미회신·불일치)과 pilot-08-001(A31 명제)은 기준서형 열거·서술이고, 사례형 pilot-08-007은 매출 계정의 추출 방향과 국외 매출 기간귀속을 다루어 계정과 요구가 다르다.',
        },
    ],
    observations_not_blocking: [
        '자료 1의 두 배제 사실(실증절차만으로는 충분하고 적합한 감사증거를 제공하지 못하는 위험이 없다, 적극적 조회에 대한 회신이 반드시 있어야 한다고 결정하지 않았다)은 ⑤·⑨·⑬의 다른 해석을 막기 위한 것이다. 결론을 알려 주지는 않으나 그 항목들이 쟁점이라는 신호가 될 수 있다. r12도 같은 방식으로 배제 사실을 두었다.',
        '13번 sub2(개선 통제와 검증 흔적의 설계, 4점)와 14번 sub3(팀원 주장의 평가, 3점)의 요구는 이 초안의 득점 요건에서 빠졌다. 회사 통제의 재설계와 등장인물의 틀린 주장은 각각 선택형 항목과 정답 암시 금지 기준에 맞지 않기 때문이다. KGA 315 문단 A180(설계·실행 확인만으로는 운영효과성에 충분하지 않음)을 직접 묻는 득점 요건도 이 세트에는 없으며 기준서형 pilot-07-002·std-points-20260914-a8c1931d1cec가 계속 다룬다.',
        '득점 요건에서 빠진 함정 ⑤·⑨·⑬의 판단은 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '⑬이 언급하는 "재무제표일 후 현금지급"은 ⑩이 다루는 후속지급 검사와 소재가 겹치지만 ⑬에는 대상기간에 관한 서술이 없어 ⑩의 결론을 드러내지 않는다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v1.json'), `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v1.json 기록:', review.target.reviewed_content_sha256);
