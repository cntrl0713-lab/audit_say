// r28 실행 요약 기록기. 대표·보조 실측을 마친 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r28-confirmation-extension/record-summary.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r28';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r28-confirmation-extension';
const SET = 'case-09-confirmation-20260921';
const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref = (f) => ({ file: f, sha256: sha(f) });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const main = read(`${R}/execution-v1/actual-a/summary.json`);
const supp = read(`${R}/supplementary-v1/summary.json`);
const rows = [];
for (const kind of ['model', 'partial', 'wrong']) {
    const o = read(`${R}/execution-v1/actual-a/${SET}--case--${kind}/observation.json`);
    for (const s of o.subquestions) {
        const expected = o.original_expected.find((e) => e.subquestion_id === s.subquestion_id);
        const judged = o.result.subquestions.find((q) => q.subquestion_id === s.subquestion_id);
        const diffs = judged.criteria
            .filter((c) => expected.expected_verdicts.find((v) => v.criterion_id === c.criterion_id).verdict !== c.verdict)
            .map((c) => `${c.criterion_id}: ${expected.expected_verdicts.find((v) => v.criterion_id === c.criterion_id).verdict} -> ${c.verdict}`);
        rows.push({ entry: `${SET}--case--${kind}`, kind, subquestion_id: s.subquestion_id,
            expected: s.expected_points, actual: s.actual_points, delta: s.delta, verdict_state_differences: diffs });
    }
}
const summary = {
    version: 1, round: 'r28', draft_version: 'v1', set_id: SET, created_at: new Date().toISOString(),
    draft: ref(`${D}/sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    grading: {
        model: 'gpt-5.6-luna',
        manifest: ref(`${R}/execution-v1/grading-manifest.json`),
        summary: ref(`${R}/execution-v1/actual-a/summary.json`),
        dry_run: ref(`${R}/execution-v1/dry-a/summary.json`),
        transport: 'model',
        actual_sdk_calls: main.actual_sdk_calls,
        representative_answers: main.representative_subquestion_answers,
        within_tolerance: main.within_tolerance,
        observed_within_tolerance_ratio: main.observed_within_tolerance_ratio,
        target_ratio: main.target_ratio,
        exact_points: rows.filter((r) => r.delta === 0).length,
        rows,
        verdict_state_note: '물음별 점수는 아홉 개 모두 기대와 정확히 일치했다(delta 0). 판정 상태 차이는 한 건(대표 부분정답의 sub1 crit1, contradicted -> not_met)이며 두 상태 모두 0점이므로 점수에 영향이 없다. 정책에 따라 0점끼리의 판정 상태 차이는 재채점하지 않았고 원 기대값도 바꾸지 않았다.',
        usd: main.usd,
        provider_token_totals: main.provider_token_totals,
    },
    supplementary: {
        input: ref(`${D}/qa.json`),
        dry_run: ref(`${R}/supplementary-v1-dry/summary.json`),
        summary: ref(`${R}/supplementary-v1/summary.json`),
        receipt_denominator: false,
        actual_sdk_calls: supp.actual_sdk_calls,
        rows: supp.rows.map((row) => ({ id: row.id, strict_matched: row.strict_matched,
            points: row.subquestions.map((s) => [s.subquestion_id, s.expected_points, s.actual_points]) })),
        usd: supp.usd,
    },
    total_actual_sdk_calls: main.actual_sdk_calls + supp.actual_sdk_calls,
    total_usd_provider_usage_arithmetic: main.usd + supp.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    prompt_collision_check: '확정 전과 실측 직후에 각각 대조했다. 실측 직후 기준으로 현재 정본 346세트와 같은 배치의 초안 34개 파일(합계 568개 발문)을 공백 정규화 기준으로 대조해 바이트 동일 발문이 없음을 확인했다. 퇴역 예정인 대상 갱신본 case-09-confirmation-skepticism-20260918과도 충돌하지 않는다(세 발문 모두 조회 절차의 단계 이름으로 새로 썼다).',
    item_count_note: '옳지 않은 항목 수가 세 물음 모두 3개다. 배정 지시("물음마다 다르게 둔다")와 다른 점이며 사유는 design.json의 structure_decision.item_count_note와 root-content-review-v1.json의 observations_not_blocking 첫 항목에 있다. 발문에는 수를 밝히지 않고 물음별 전체 항목 수는 5·5·4로 다르다.',
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 두 세트(case-09-confirmation-skepticism-20260918, case-09-negative-confirmation-conditions-20260914)의 활성 릴리스 제외(퇴역)',
        '승급 receipt 봉인(authorization.production_publication 미승인)',
        'coverage links 갱신',
        '수정 요청서·검토 장부·drafts README 갱신(조율자 담당)',
        '사람의 내용 확인',
    ],
};
fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회 ·', summary.total_usd_provider_usage_arithmetic, 'USD · exact', summary.grading.exact_points, '/', rows.length);
