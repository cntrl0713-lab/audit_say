// r12 초안의 agent 내용검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행한다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r12-analytical-procedures-merge/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r12/root-content-review-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT_DIR = 'cpa_uploader/drafts/case-review-2026-09-15/r12-analytical-procedures-merge';
const OUT_DIR = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r12');
const SET_ID = 'case-10-analytical-procedures-20260920';

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
        'cpa_uploader/data/official/delegated-s04-kga-2025.txt',
        'cpa_uploader/data/official/kga315-330-2025-review06.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    method_detail:
        'KGA 520 전체(문단 1~7, A1~A21)와 KGA 315 문단 37을 등록 전문에서 직접 읽고 아홉 항목의 옳고 그름을 문단 단위로 확정했다. 문단 5 본문·5(a)~(d), 6, 7(a)(b), A4·A5·A6~A11, A12~A16, A17~A21을 모두 대조했다. 인용 열두 개 가운데 열 개는 병합 대상인 두 원 세트(pilot-10-007, case-10-completion-analytics-20260914)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 새로 쓰는 문단 A12·A13만 같은 등록 전문(delegated-s04-kga-2025.txt L446-L457, L461-L471)에서 발췌해 SHA-256을 계산했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다. 현재 정본 364세트에서 KGA 520을 인용한 모든 세트(pilot-10-002, pilot-10-007, pilot-10-007-standards-20260913, std-points-20260914-82e96243c6aa, case-10-completion-analytics-20260914)와 KGA 315 문단 37을 인용한 모든 세트(pilot-06-008-standards-20260913, std-points-20260914-7c8d41e23fcc, case-10-completion-analytics-20260914, case-16-other-information-20260915)의 발문·criterion을 읽어 중복을 대조했다. 판본은 두 원 세트가 남긴 2026 전문 대조 기록을 재사용했으며 새 원자료 수집은 하지 않았다.',
    questions: [
        {
            subquestion_id: 'sub1',
            checks: { ...PASS },
            rationale:
                'source: ①은 문단 5(a)·A9, ②는 문단 5(b)·A12(a)~(d)·A13, ③은 문단 5(c)·A15, ④는 문단 5(d)·A16, ⑤는 문단 5 본문("단독으로 또는 세부테스트와 결합하여")·A4·A7·A8에서 각각 확정했다. A5(경영진이 작성한 분석적 데이터가 적절하게 작성되었다는 점에 만족할 수 있으면 사용 가능)를 함께 읽고, 총계정원장 합계 일치만 확인한 ②가 그 "만족"에 이르지 못하므로 5(b) 위반이 유지됨을 확인했다. ⑤는 유의적 위험이 식별되지 않았다는 자료 1의 사실로 KGA 330의 유의적 위험 대응 요구가 적용되지 않음을 배제 조건으로 두었다. answer: 모범답안 네 문장이 식별·②·③·④ criterion과 1대1로 대응하고, 옳은 항목 ①·⑤의 근거도 함께 제시한다. prompt: 발문은 자료 범위와 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 세 개 각 1점으로 4점이며, 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 인정한다. 구체적 방법 나열이나 금액 계산은 요구하지 않는다. style: 다섯 항목의 옳고 그름이 해솔의 차입 구조·자료 출처·평가한 위험이라는 사실에 따라 달라지므로 사례형이다. topics: 10(실증적 분석절차의 설계)과 08(기대치 도출 자료의 신뢰성)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 전문을 기준으로 판단했다. nonduplication: 같은 문단을 쓰는 pilot-10-002·pilot-10-007-standards-20260913·std-points-20260914-82e96243c6aa는 모두 기준서형으로 요구를 사실 없이 재현하게 한다.',
        },
        {
            subquestion_id: 'sub2',
            checks: { ...PASS },
            rationale:
                'source: ⑥은 문단 6·A17(종결 분석의 시점과 목적), ⑦은 KGA 315 문단 37·KGA 520 문단 A18, ⑧은 문단 7(a), ⑨는 문단 A20에서 확정했다. A19(종결 분석이 위험평가 분석과 유사할 수 있음)를 함께 읽고 ⑥의 위반이 "유사한 방법"이 아니라 "감사의 종료시점에 근접하여" 수행하지 않은 점임을 구분했다. A21(설명이 적절하다고 고려될 수 없는 경우 다른 감사절차가 필요할 수 있음)을 읽고, ⑨에 계약종료·자체 운송 개시 시점이 비용 감소 시점과 부합했다는 사실을 두어 A21의 상황이 아님을 확정했다. answer: 모범답안 세 문장이 식별·⑥·⑦ criterion과 대응하고 옳은 항목 ⑧·⑨의 근거도 제시한다. prompt: 자료 범위와 요구 형식만 밝힌다. points: 식별 1점 + 옳지 않은 항목 두 개 각 1점으로 3점이며, 12월 거래에 대한 구체적 후속절차는 요구하지 않는다. style: 네 항목의 옳고 그름이 판매구조 변화, 12월 매출·단가·출하수량의 관계, 운송 전환에 관하여 이미 입수한 증거라는 사실에 달려 있으므로 사례형이다. topics: 10(종결 분석과 차이 조사)과 06(위험평가의 수정)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 KGA 315 문단 37은 두 판본의 본문이 같다는 원 세트 대조 기록을 재사용했다. nonduplication: std-points-20260914-7c8d41e23fcc(문단 37)와 std-points-20260914-82e96243c6aa(종결 분석의 목적)는 기준서형 서술 요구이고, 사례형으로 같은 문단을 다루던 것은 병합 대상 두 세트뿐이다.',
        },
    ],
    observations_not_blocking: [
        '⑥(감사종료 분석을 위험평가 단계 분석으로 갈음)과 ⑦(업무수행이사가 최종 자료를 검토하다 관계를 발견)은 한 사례 안에서 긴장이 있다. 원 case-10-completion-analytics-20260914도 담당자의 생략 제안과 책임자의 최종 자료 검토라는 같은 구조였고, 두 항목의 위반 근거(문단 6, 315.37)가 서로 독립적이어서 그대로 두었다.',
        'pilot-10-007의 이자감면 차이 조사 요소를 삭제한 결과, 이 세트에는 KGA 520 문단 7(b)(기타의 감사절차)을 직접 묻는 득점 요건이 없다. 문단 7(b)는 기준서형 pilot-10-002 sub2가 계속 다룬다.',
        '득점 요건에서 빠진 함정 ⑤·⑨의 판단은 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
    ],
    unresolved_content_findings: [],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'root-content-review-v1.json'), `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
console.log('root-content-review-v1.json 기록:', review.target.reviewed_content_sha256);
