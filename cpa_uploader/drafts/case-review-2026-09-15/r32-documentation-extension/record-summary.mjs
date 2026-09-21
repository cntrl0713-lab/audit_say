// r32 실행 요약 기록기. 실제 채점이 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r32-documentation-extension/record-summary.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r32';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r32-documentation-extension';
const SET = 'case-04-audit-documentation-20260921';
const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref = (f) => ({ file: f, sha256: sha(f) });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const main = read(`${R}/execution-v1/actual-a/summary.json`);
const supp = read(`${R}/supplementary-v1/summary.json`);

const diffsOf = (observationFile, entry) => {
    const o = read(observationFile);
    const expected = new Map();
    for (const e of o.original_expected) for (const v of e.expected_verdicts) expected.set(v.criterion_id, v.verdict);
    const rows = [];
    for (const s of o.subquestions) {
        const judged = o.judgment.subquestions.find((q) => q.subquestion_id === s.subquestion_id);
        const diffs = (judged?.verdicts ?? judged?.criteria ?? [])
            .filter((c) => expected.get(c.criterion_id) !== c.verdict)
            .map((c) => ({ criterion_id: c.criterion_id, expected: expected.get(c.criterion_id), actual: c.verdict }));
        rows.push({ entry, subquestion_id: s.subquestion_id, expected: s.expected_points, actual: s.actual_points, delta: s.delta, verdict_state_differences: diffs });
    }
    return rows;
};

const rows = [];
for (const kind of ['model', 'partial', 'wrong']) {
    rows.push(...diffsOf(`${R}/execution-v1/actual-a/${SET}--case--${kind}/observation.json`, `${SET}--case--${kind}`).map((row) => ({ ...row, kind })));
}
const suppRows = [];
for (const row of supp.rows) suppRows.push(...diffsOf(`${R}/supplementary-v1/${row.id}/observation.json`, row.id));
const suppTokens = supp.usage.reduce((acc, e) => ({
    input_tokens: acc.input_tokens + e.provider.usage.input_tokens,
    output_tokens: acc.output_tokens + e.provider.usage.output_tokens,
    total_tokens: acc.total_tokens + e.provider.usage.total_tokens,
}), { input_tokens: 0, output_tokens: 0, total_tokens: 0 });

const summary = {
    version: 1, round: 'r32', draft_version: 'v1', set_id: SET, created_at: new Date().toISOString(),
    route: 'case_extension',
    extended_from: 'case-04-audit-documentation-20260917',
    merged_from: ['case-04-audit-documentation-20260917', 'pilot-04-005', 'case-04-documentation-trace-20260914'],
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
        observed_within_tolerance_ratio: main.observed_within_tolerance_ratio,
        target_ratio: main.target_ratio,
        exact_points: rows.filter((r) => r.delta === 0).length,
        rows,
        verdict_state_note: '기대 판정과 실제 판정의 상태 차이는 rows에 남긴다. 이 실행의 차이 두 건(partial sub1 crit1, partial sub3 crit8: contradicted → not_met)은 모두 0점 상태끼리의 차이여서 점수에 영향이 없고, 비용 통제 지침에 따라 원 기대값을 바꾸거나 재채점하지 않았다.',
        usd: main.usd,
        provider_token_totals: main.provider_token_totals,
    },
    supplementary: {
        run: true,
        reason: '이 회차는 새 득점 요건 셋(①·② 식별특성, ⑥ A14, ⑫ 문단 15)과 새 인정 경계를 도입했으므로 조건 경계를 표적으로 확인했다. 승급 receipt 분모와는 별개이며 허용 편차를 없애기 위한 반복 호출이 아니다.',
        summary: ref(`${R}/supplementary-v1/summary.json`),
        actual_sdk_calls: supp.actual_sdk_calls,
        answers: suppRows.length,
        exact_points: suppRows.filter((r) => r.delta === 0).length,
        rows: suppRows,
        usd: supp.usd,
        provider_token_totals: suppTokens,
        verdict_state_note: '차이 한 건(r32-supp-condition-boundary sub3 crit12: not_met → contradicted)은 0점 상태끼리의 차이다. 모델이 든 이유(보존기간의 기산점을 취합 완료일로 적었다)가 criterion의 불인정 사유와 같아 점수와 판정 근거가 모두 기대대로다.',
    },
    total_actual_sdk_calls: main.actual_sdk_calls + supp.actual_sdk_calls,
    total_usd_provider_usage_arithmetic: main.usd + supp.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 세 세트(case-04-audit-documentation-20260917, pilot-04-005, case-04-documentation-trace-20260914)의 활성 릴리스 제외(퇴역)',
        '승급 receipt 봉인(authorization.production_publication 미승인)',
        'coverage links 갱신',
        '수정 요청서·검토 장부·drafts README의 반영 현황 갱신',
        '사람의 내용 확인',
    ],
};
fs.writeFileSync(`${R}/summary-v1.json`, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log('written', `${R}/summary-v1.json`);
