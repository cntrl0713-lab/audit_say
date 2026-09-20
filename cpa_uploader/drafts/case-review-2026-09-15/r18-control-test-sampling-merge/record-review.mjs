// r18 병합 초안에 대한 agent 내용 검토 장부 기록기. 실제 대조를 마친 뒤 한 번만 실행하며 기존 파일이 있으면 쓰지 않는다.
//
//   node --import tsx cpa_uploader/drafts/case-review-2026-09-15/r18-control-test-sampling-merge/record-review.mjs
//
// 출력: cpa_uploader/analysis/reviews/case-review-2026-09-15/r18/root-content-review-v1.json

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const DRAFT = 'cpa_uploader/drafts/case-review-2026-09-15/r18-control-test-sampling-merge/sets.json';
const OUT = path.join(root, 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r18/root-content-review-v1.json');

const sha = (file) => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const ref = (file) => ({ file, sha256: sha(file) });
const [draft] = JSON.parse(fs.readFileSync(path.join(root, DRAFT), 'utf8'));

const PASS = { source: 'pass', answer: 'pass', prompt: 'pass', points: 'pass', style: 'pass', topics: 'pass', edition: 'pass', nonduplication: 'pass' };

const rationales = {
    sub1:
        'source: ①은 KGA 500 문단 A21(관찰은 어떤 과정이나 절차의 수행에 대한 감사증거를 제공하지만 관찰이 행해지는 시점으로만 제한되며, 그 행위가 관찰되고 있다는 사실 자체가 수행 방식에 영향을 미칠 수 있음)과 KGA 330 문단 A26(관찰은 관찰시점에만 귀속됨), ②는 KGA 330 문단 10(a)(i)~(iii), ③은 문단 10(b)와 A32, ④는 문단 A23에서 확정했다. 등록 전문 kga330-2025-review07.txt의 문단 9~17과 적용자료 A23~A33을 이어서 읽어 인접 조건이 판단을 다투게 하지 않는지 확인했다. 문단 11·A33(의존대상 기간)은 ①의 판단을 보강할 뿐 다투지 않으며, 문단 12(중간기간 증거)는 이 초안의 항목·득점 요건에 두지 않았다. ③에 대하여 문단 10(b)의 두 결정을 사실과 대조했다. 첫째 결정(간접통제 의존 여부)은 "감사팀은 ERP의 권한 관리 절차가 승인 통제의 운영에 영향을 준다고 보았다"는 사실로 이미 이루어졌고, 둘째 결정(그 간접통제에 관한 감사증거의 필요 여부)만 남아 있다. 문단 A32가 "이미 테스트하였을 수 있다"고 인정하는 경우에 해당하는지도 대조했으나 자료에는 그런 사실이 없다. ④에 대하여 문단 A23의 마지막 문장("이중목적테스트는 각각의 테스트 목적을 개별적으로 고려하여 설계되고 평가된다")이 항목의 서술과 일치함을 확인했다. answer: 모범답안 세 문장이 식별·①·③ criterion과 1대1로 대응하고 옳은 항목 ②·④의 근거도 함께 제시한다. prompt: 발문은 단계 이름과 항목 범위, 요구 형식만 밝히고 옳지 않은 항목의 수·내용을 알려 주지 않는다. points: 식별 1점 + 옳지 않은 항목 두 개에 각 1점으로 3점이며, 이유 또는 보완절차 중 하나를 핵심 원칙 수준으로 쓰면 인정한다. 관찰의 두 한계 가운데 하나만 들어도 되고 구체적 후속절차의 나열은 요구하지 않는다. style: 네 항목의 옳고 그름이 관찰한 시간대와 사전 통지·인원 추가 배치라는 사실, 감사팀이 ERP 권한 관리 절차가 승인 통제의 운영에 영향을 준다고 본 사실, 같은 출고지시서를 두 테스트에 쓰기로 한 설계에 달려 있으므로 사례형이다. topics: 07(통제테스트의 설계와 수행)과 08(관찰이라는 증거 입수절차의 한계)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 개정 전문을 기준으로 판단했다. nonduplication: 현재 정본에서 KGA 330 문단 10(b)·A32를 인용하거나 간접통제에 관한 증거의 필요 여부 결정을 득점 요건으로 둔 세트는 없다. pilot-08-003 sub2는 KGA 500 문단 A21의 관찰의 정의와 두 한계를 사실 없이 재현하게 하는 기준서형이고, 이 물음의 ①은 같은 두 한계를 벼리상사의 사실에 적용한다. pilot-07-001 subq2는 이중목적 테스트의 명칭만 묻는다. case-06-purchase-payment-20260920의 IT 관련 항목은 KGA 315의 IT 일반통제 식별이어서 요구가 다르다.',
    sub2:
        'source: ⑤는 KGA 530 문단 A5(이탈 또는 왜곡표시를 구성하는 것이 무엇이며 표본감사를 위해 어떤 모집단을 이용할 것인지 정의, 표본이 도출된 모집단이 완전하다는 증거를 입수하기 위한 감사절차 수행), ⑥은 문단 A6(감사절차의 목적과 관련성이 있는 모든 조건 그리고 그러한 조건들만이 이탈의 평가에 포함되도록 이탈을 구성하는 사항을 명확하게 이해)과 사전 승인을 요구하는 벼리상사 통제의 내용, ⑦은 문단 A7, ⑧은 문단 11과 A15(서류가 분실된 때), ⑨는 문단 12에서 확정했다. 등록 전문 kga520-530-2025-review10.txt의 문단 5~15와 적용자료 A1~A23을 이어서 읽었다. ⑥의 근거는 명문 요구가 아니라 문단 A6의 요구를 사례의 통제 내용에 적용한 것이며, 통제가 "사전 승인 표시를 확인한 뒤 출고"로 정의되어 있으므로 출고 이후에 기록된 승인은 규정된 통제로부터의 이탈이다. ⑧에 대하여 문단 10·A14(적법하게 무효화된 항목의 대체)를 대조하였고, 자료에서 물품이 실제로 출고되었고 승인 여부를 확인할 다른 자료도 없다는 사실로 문단 10의 경우를 배제했다. 이 두 갈래는 대조되는 두 경우이므로 문단 10·A14는 인용하지 않고 항목으로도 두지 않았다. ⑦에 대하여 문단 A7의 "통제에 대한 감사인의 이해 또는 모집단의 소수 항목에 대한 조사를 근거로 예상이탈률을 평가한다"가 항목의 서술을 그대로 지지함을 확인했다. answer: 모범답안 네 문장이 식별·⑤·⑥·⑧ criterion과 1대1로 대응하고 옳은 항목 ⑦·⑨의 근거도 제시한다. prompt: 발문은 단계 이름과 항목 범위만 밝힌다. points: 식별 1점 + 옳지 않은 항목 세 개에 각 1점으로 4점이다. ⑤의 완전성 확인 자료는 두 가지 가운데 하나만 들어도 인정한다. style: 다섯 항목의 옳고 그름이 ERP가 승인 여부와 관계없이 발행번호를 보존한다는 사실, 승인 시각과 출고 시각의 선후, 승인 기록의 분실과 대체 자료의 부재에 달려 있으므로 사례형이다. topics: 10(분석적절차와 표본감사)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 KGA 530 문단 3의 시행일(2026년 1월 1일 이후 개시하는 보고기간)을 등록 전문에서 확인했다. nonduplication: case-09-inventory-count-20260920 sub1.c3이 KGA 530 문단 6(모집단의 특성 고려)으로 두 장소의 단일 모집단 처리를 득점 요건으로 두고 있으므로, 이 물음은 문단 6을 인용하지 않고 문단 A5의 모집단 완전성으로 요구를 한정했으며 sub2.req1에도 계층화·구분이 요구가 아님을 적었다. pilot-10-003 sub1은 문단 10·A14와 문단 11·A15를 사실 없이 구분해 설명하게 하는 기준서형이고, 이 물음은 문단 11 쪽만 벼리상사의 사실에 적용한다. case-10-anomaly-projection-conclusion-20260914는 변이와 세부테스트 투영을 다루어 대상이 다르다.',
    sub3:
        'source: ⑩은 KGA 530 문단 15(a)·(b), ⑪은 문단 A21(통제테스트의 경우 예상과 다른 높은 표본이탈률은 최초의 평가를 입증할 수 있는 추가적인 감사증거가 입수되지 않는 한 평가된 중요왜곡표시위험을 증가시킴), ⑫는 문단 A20(통제테스트에서는 대부분 표본이탈률이 곧 모집단 전체의 투영 이탈률이기 때문에 이탈에 대한 명시적인 투영이 필요없음), ⑬은 KGA 330 문단 17(a)~(c)에서 확정했다. 문단 14(세부테스트의 투영)와 A18·A19를 함께 읽어 ⑫가 통제테스트에만 해당한다는 점을 확인했고, 문단 A20의 각주가 KGA 330 문단 17을 가리키는 것도 확인했다. ⑪에 대하여 문단 A21의 단서("최초의 평가를 입증할 수 있는 추가적인 감사증거가 입수되지 않는 한")가 자료의 사실로 충족됨을 대조했다. 문단 13(변이)과 A23(표본이 합리적 근거를 제공하지 못할 때의 후속 조치)은 항목·득점 요건에 두지 않았고 A23은 인용하지 않았다. answer: 모범답안 세 문장이 식별·⑪·⑬ criterion과 1대1로 대응한다. prompt: 발문은 단계 이름과 항목 범위만 밝힌다. points: 식별 1점 + 옳지 않은 항목 두 개에 각 1점으로 3점이며, ⑬은 (b)·(c) 두 결정 가운데 하나만 들어도 인정한다. style: 네 항목의 옳고 그름이 표본이탈률 8%와 예상이탈률 1%·허용이탈률 5%의 관계, 추가 증거가 없다는 사실, 감사팀이 실제로 결정한 범위에 달려 있으므로 사례형이다. topics: 10(표본 결과의 평가)과 07(이탈 발견 후의 후속 결정)을 실제 요구에서 정했다. edition: 20X1·20X2 표기이며 2025 개정 전문을 기준으로 판단했다. nonduplication: case-08-sales-receivable-20260920(r13)은 KGA 330 문단 17을 옳은 항목 ①의 근거로만 쓰고 득점 요건으로 두지 않았으며, 그 세트의 득점 요건인 문단 16은 이 초안에 없다. case-10-anomaly-projection-conclusion-20260914 sub3은 문단 15(b)·A23의 후속 조치를 득점 요건으로 두지만 이 물음에서 문단 15는 옳은 항목 ⑩의 근거일 뿐이고 A23은 인용하지 않았다. std-points-20260914-a9f84f7eef8b도 A23의 대응을 열거하게 하는 기준서형이어서 요구가 다르다.',
};

const review = {
    version: 1,
    method: 'agent_content_review',
    human_review_performed: false,
    reviewer_id: 'agent:claude-opus-5 (author agent; no independent peer review)',
    reviewed_at: new Date().toISOString(),
    target: { ...ref(DRAFT), set_id: draft.id, reviewed_content_sha256: reviewedContentHash(draft) },
    evidence: [
        'cpa_uploader/drafts/case-review-2026-09-15/r18-control-test-sampling-merge/design.json',
        'cpa_uploader/drafts/case-review-2026-09-15/r18-control-test-sampling-merge/lineage.json',
        'cpa_uploader/drafts/case-review-2026-09-15/r18-control-test-sampling-merge/qa.json',
        'cpa_uploader/drafts/case-review-2026-09-15/r18-control-test-sampling-merge/build-draft.mjs',
        'cpa_uploader/data/official/kga330-2025-review07.txt',
        'cpa_uploader/data/official/kga500-2025-review08.txt',
        'cpa_uploader/data/official/kga520-530-2025-review10.txt',
        'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
        'docs/사례형-병합-종합문제-설계.md',
        'docs/물음별-학습-단위와-분류-계약.md',
        'docs/case-question-edit-notes-2026-09-14.md',
    ].map(ref),
    method_detail:
        'KGA 330 문단 9~17과 적용자료 A23~A33, KGA 500 문단 A21, KGA 530 문단 5~15와 적용자료 A1~A23을 등록 전문에서 직접 읽고 열세 항목의 옳고 그름을 문단 단위로 확정했다. 인용 열여섯 개 가운데 열 개(KGA 330 문단 10(a)·17·A23·A26, KGA 500 문단 A21, KGA 530 문단 11·15·A5·A15·A21)는 병합 대상 두 원 세트(case-07-control-evidence-20260914, case-10-control-sample-frame-20260914)의 정본 인용을 바이트와 content_hash 그대로 재사용했고, 나머지 여섯 개(KGA 330 문단 10(b) L67-L69·A32 L287-L292, KGA 530 문단 12 L156-L157·A6 L201-L215·A7 L216-L222·A20 L269-L271)는 같은 등록 전문에서 줄 범위로 발췌해 SHA-256을 계산했다. validate_draft_v3.ts --against-bank로 인용 원문 실존과 기존 은행과의 ID·발문 중복 없음을 확인했다. 현재 정본 358세트에서 KGA 530을 분류에 둔 세트 전부(pilot-10-001·10-003·10-004·10-005·10-006, draft-10-530-freq01, draft-standard-followup-20260913-s03, case-09-inventory-count-20260920, case-10-anomaly-projection-conclusion-20260914, std-points 5개, 병합 대상 53번)와 "간접통제"·"예상이탈률"·"투영 이탈률"·"이중목적"·"질문만으로는"·"관찰이 행해지는 시점"으로 검색한 세트(pilot-07-001, pilot-08-003, pilot-17-006, case-06-purchase-payment-20260920)의 발문과 criterion을 읽어 요구를 갈랐다. 전제 통일(구두 승인 대 문서화된 승인)과 대조되는 두 경우(KGA 530 문단 10·A14 대 문단 11·A15)의 처리는 lineage.json에 기록했다. 판본은 KGA 530 문단 3과 KGA 520 문단 2의 시행일 문장을 등록 전문에서 직접 확인했고, KGA 330·500의 해당 문단은 원 63번이 남긴 2026 전문 대조 기록을 재사용했다. 새 원자료 수집은 하지 않았다.',
    questions: draft.subquestions.map((question) => ({
        subquestion_id: question.id,
        criterion_ids: question.criteria.map((c) => c.id),
        source_ref_ids: [...new Set([
            ...question.requirements.map((r) => r.source_ref_id),
            ...question.criteria.flatMap((c) => c.source_ref_ids),
        ])],
        checks: { ...PASS },
        rationale: rationales[question.id],
    })),
    observations_not_blocking: [
        'KGA 530 문단 A6의 발췌(L201-L215)에는 원문 페이지 경계에서 생긴 각주("2 감사기준서 320 …")와 "=== PDF page 435 ===" 머리글이 섞여 있다. 병합 대상 53번의 문단 6 인용도 같은 형태이며, 판단에 쓰는 본문("감사절차의 목적과 관련성이 있는 모든 조건 그리고 그러한 조건들 만이 이탈의 평가나 왜곡표시의 투영에 포함되도록 한다")은 발췌 안에 온전히 들어 있다.',
        '전제를 문서화된 승인 통제로 통일하면서 63번 sub1의 요구(문서화가 이용가능하지 않은 통제에서 질문에 관찰 등을 결합, KGA 330 문단 A27 후단)는 성립하지 않아 삭제했다. 문단 A27은 source_ref로도 인용하지 않았으므로 이 초안에는 그 요구를 평가하는 득점 기준이 없다.',
        '옳지 않은 항목의 수가 물음 1과 물음 3에서 모두 두 개다. 물음 2를 세 개로 두어 고정되지 않게 했으나 두 물음의 개수는 같다. 물음 3에 옳지 않은 항목을 더 넣으려면 KGA 530 문단 13(변이)이나 A23(후속 조치)을 써야 하는데 case-10-anomaly-projection-conclusion-20260914의 득점 요건과 겹치므로 늘리지 않았다.',
        '자료 3의 항목 ⑩(표본감사가 모집단에 대한 결론에 합리적인 근거를 제공하는지 여부도 평가, 옳음)은 평가를 수행하였다는 사실만 적고 결론을 적지 않는다. 같은 자료의 ⑪(최초의 낮은 위험평가 유지, 옳지 않음)과 판단 기준이 다르며 ⑩이 ⑪의 정답을 알려 주지는 않지만, 두 항목이 같은 표본 결과를 다루므로 배치를 ⑩ → ⑪ 순으로 두어 뒤 항목의 사실이 앞 항목을 되짚지 않게 했다.',
        '득점 요건에서 빠진 함정 ④·⑦·⑫의 판단은 식별 criterion에서만 평가된다. 함정을 옳지 않다고 고른 답은 식별 점수만 잃고 다른 항목의 이유·절차 점수는 유지된다.',
        '자료 2의 배경에 감사팀이 이미 이탈로 집계한 건(승인된 수량보다 많은 수량이 출고된 건)을 두어 자료 3의 표본이탈률 8%가 ⑥·⑧의 처리와 무관하게 성립하도록 했다. 원 53번이 두었던 "올바르게 처리한 후 확정한" 같은 정답 암시 문장은 쓰지 않았다.',
    ],
    unresolved_content_findings: [],
};

fs.writeFileSync(OUT, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
console.log('root-content-review-v1.json 기록', { set_id: draft.id, reviewed_content_sha256: review.target.reviewed_content_sha256 });
