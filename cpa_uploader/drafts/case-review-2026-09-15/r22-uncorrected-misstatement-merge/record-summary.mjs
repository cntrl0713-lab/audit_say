// r22 대표·보조 실측을 한 번 요약한다. 기존 파일이 있으면 쓰지 않는다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r22-uncorrected-misstatement-merge/record-summary.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r22';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r22-uncorrected-misstatement-merge';
const SET = 'case-12-uncorrected-misstatement-20260921';
const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref = (f) => ({ file: f, sha256: sha(f) });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const main = read(`${R}/execution-v1/actual-a/summary.json`);
const supp = read(`${R}/supplementary-v1/summary.json`);
const rows = [];
for (const kind of ['model', 'partial', 'wrong']) {
    const o = read(`${R}/execution-v1/actual-a/${SET}--case--${kind}/observation.json`);
    const expected = new Map();
    for (const e of o.original_expected) for (const v of e.expected_verdicts) expected.set(v.criterion_id, v.verdict);
    for (const s of o.subquestions) {
        const judged = o.judgment.subquestions.find((q) => q.subquestion_id === s.subquestion_id);
        const diffs = (judged?.verdicts ?? judged?.criteria ?? []).filter((c) => expected.get(c.criterion_id) !== c.verdict).map((c) => c.criterion_id);
        rows.push({ entry: `${SET}--case--${kind}`, kind, subquestion_id: s.subquestion_id,
            expected: s.expected_points, actual: s.actual_points, delta: s.delta, verdict_state_differences: diffs });
    }
}
const summary = {
    version: 1, round: 'r22', draft_version: 'v1', set_id: SET, created_at: new Date().toISOString(),
    draft: ref(`${D}/sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    grading: {
        model: 'gpt-5.6-luna',
        manifest: ref(`${R}/execution-v1/grading-manifest.json`),
        summary: ref(`${R}/execution-v1/actual-a/summary.json`),
        transport: 'model',
        actual_sdk_calls: main.actual_sdk_calls,
        representative_answers: main.representative_subquestion_answers,
        within_tolerance: main.within_tolerance,
        exact_points: rows.filter((r) => r.delta === 0).length,
        rows,
        verdict_state_note: '기대 판정과 실제 판정의 상태 차이가 있으면 모두 0점 상태(contradicted/not_met) 사이의 차이인지 rows에서 확인한다. 원 기대값을 바꾸거나 재채점하지 않았다.',
        usd: main.usd,
        provider_token_totals: main.provider_token_totals,
    },
    supplementary: {
        input: ref(`${R}/supplementary-input-v1.json`),
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
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 두 세트(pilot-12-009, case-12-trivial-classification-offset-20260914)의 활성 릴리스 제외(퇴역)',
        '승급 receipt 봉인(authorization.production_publication 미승인)',
        'coverage links 갱신',
        '수정 요청서·검토 장부·drafts README 갱신(메인 세션 담당)',
    ],
};
fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회 ·', summary.total_usd_provider_usage_arithmetic, 'USD · exact', summary.grading.exact_points, '/', rows.length);
