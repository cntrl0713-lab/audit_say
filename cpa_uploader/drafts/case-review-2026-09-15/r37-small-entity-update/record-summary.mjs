// r37 실행 요약 기록기. 사례형·기준서형 실제 채점이 모두 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update/record-summary.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r37';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update';
const CASE_SET = 'case-18-small-entity-20260921';
const STD_SET = 'pilot-18-005-standards-20260921';

const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref = (f) => ({ file: f, sha256: sha(f) });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function rowsOf(dir, entryIds) {
    const rows = [];
    for (const entry of entryIds) {
        const o = read(`${dir}/${entry}/observation.json`);
        const expected = new Map();
        for (const e of o.original_expected) for (const v of e.expected_verdicts) expected.set(v.criterion_id, v.verdict);
        for (const s of o.subquestions) {
            const judged = o.judgment.subquestions.find((q) => q.subquestion_id === s.subquestion_id);
            const diffs = (judged?.verdicts ?? judged?.criteria ?? [])
                .filter((c) => expected.get(c.criterion_id) !== c.verdict)
                .map((c) => ({ criterion_id: c.criterion_id, expected: expected.get(c.criterion_id), actual: c.verdict }));
            rows.push({
                entry, kind: entry.split('--').pop(), subquestion_id: s.subquestion_id,
                expected: s.expected_points, actual: s.actual_points, delta: s.delta, verdict_state_differences: diffs,
            });
        }
    }
    return rows;
}

const caseDir = `${R}/execution-v1/actual-a`;
const stdDir = `${R}/execution-standards-v1/actual-a`;
const caseMain = read(`${caseDir}/summary.json`);
const stdMain = read(`${stdDir}/summary.json`);
const caseRows = rowsOf(caseDir, ['model', 'partial', 'wrong'].map((k) => `${CASE_SET}--case--${k}`));
const stdRows = rowsOf(stdDir, ['sub1', 'sub2'].flatMap((u) => ['model', 'partial', 'wrong'].map((k) => `${STD_SET}--${u}--standard--${k}`)));
const allRows = [...caseRows, ...stdRows];

const summary = {
    version: 1,
    round: 'r37',
    draft_version: 'v1',
    set_ids: { case: CASE_SET, standards: STD_SET },
    created_at: new Date().toISOString(),
    route: 'case_single_update_with_standards_split',
    origin_set: 'pilot-18-005',
    edit_note_number: 40,
    drafts: { case: ref(`${D}/sets.json`), standards: ref(`${D}/standards-sets.json`) },
    content_reviews: {
        case: ref(`${R}/root-content-review-v1.json`),
        standards: ref(`${R}/root-content-review-standards-v1.json`),
    },
    grading: {
        model: 'gpt-5.6-luna',
        case: {
            manifest: ref(`${R}/execution-v1/grading-manifest.json`),
            summary: ref(`${caseDir}/summary.json`),
            transport: 'model',
            actual_sdk_calls: caseMain.actual_sdk_calls,
            representative_answers: caseMain.representative_subquestion_answers,
            within_tolerance: caseMain.within_tolerance,
            observed_within_tolerance_ratio: caseMain.observed_within_tolerance_ratio,
            target_ratio: caseMain.target_ratio,
            exact_points: caseRows.filter((r) => r.delta === 0).length,
            usd: caseMain.usd,
            provider_token_totals: caseMain.provider_token_totals,
            requests_without_returned_usage: caseMain.requests_without_returned_usage,
            rows: caseRows,
        },
        standards: {
            manifest: ref(`${R}/execution-standards-v1/grading-manifest.json`),
            summary: ref(`${stdDir}/summary.json`),
            transport: 'model',
            actual_sdk_calls: stdMain.actual_sdk_calls,
            representative_answers: stdMain.representative_subquestion_answers,
            within_tolerance: stdMain.within_tolerance,
            observed_within_tolerance_ratio: stdMain.observed_within_tolerance_ratio,
            target_ratio: stdMain.target_ratio,
            exact_points: stdRows.filter((r) => r.delta === 0).length,
            usd: stdMain.usd,
            provider_token_totals: stdMain.provider_token_totals,
            requests_without_returned_usage: stdMain.requests_without_returned_usage,
            learning_units: [`${STD_SET}--sub1--standard`, `${STD_SET}--sub2--standard`],
            rows: stdRows,
        },
        combined: {
            representative_answers: allRows.length,
            within_tolerance: allRows.filter((r) => Math.abs(r.delta) <= 1).length,
            observed_within_tolerance_ratio: allRows.filter((r) => Math.abs(r.delta) <= 1).length / allRows.length,
            target_ratio: 0.95,
            exact_points: allRows.filter((r) => r.delta === 0).length,
        },
        verdict_state_note: '기대 판정과 실제 판정의 상태 차이는 rows에 남긴다. 사례형 오답 답안에서 식별 criterion crit1·crit5가 contradicted 대신 not_met으로 판정되었으나 두 판정의 점수가 모두 0이어서 점수 차이는 없다. 0점끼리의 판정 상태 차이는 비용 통제 지침에 따라 재채점하지 않는다.',
        out_of_expectation_note: '기준서형 sub1 부분정답 1건이 기대 4점·실제 3점으로 −1점이다(허용 ±1점 안). 원인은 채점 오류가 아니라 작성자 기대값 쪽이다. crit6의 승계된 claim은 "외부감사법상 지배회사에 해당하여 연결재무제표를 작성하는 회사를 제외범주로 제시한다"이고 각주 4가 이 범주를 지배회사로 한정하는데, qa-standards.json의 대표 부분정답은 문단 2(a)(vi) 본문 표현인 "연결재무제표를 작성하는 회사"만 적었다. 채점 모델은 "지배회사라는 요건 없이 연결재무제표를 작성하는 회사라고만 제시했다"는 이유로 not_met을 주었고 이는 claim의 문언에 맞는 판정이다. 문항 내용·출처·배점에 오류는 없으므로 초안을 고치지 않았고, 허용 범위 안의 편차를 없애기 위한 재호출도 하지 않았다. 봉인된 qa-standards.json 바이트도 고치지 않는다.',
        usd_total: caseMain.usd + stdMain.usd,
    },
    supplementary: {
        run: false,
        reason: '대표 12답안이 모두 허용 범위 안이고 그 가운데 11개가 정확히 일치했다. 허용 범위 밖 결과가 없어 보조 요청을 추가하지 않았다. 비용 통제 지침에 따라 허용한 ±1점 편차를 없애기 위한 반복 호출도 하지 않았다. qa.json의 supplementary_cases 세 건과 qa-standards.json의 두 건은 run=false로 남겨 두었다.',
    },
    total_actual_sdk_calls: caseMain.actual_sdk_calls + stdMain.actual_sdk_calls,
    total_usd_provider_usage_arithmetic: caseMain.usd + stdMain.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 세트 pilot-18-005의 활성 릴리스 제외(퇴역)',
        '승급 receipt 봉인(authorization.production_publication 미승인)',
        'coverage links 갱신',
        '수정 요청서·검토 장부·drafts README 갱신(메인 세션 담당)',
    ],
};

fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회 ·', summary.total_usd_provider_usage_arithmetic, 'USD · exact',
    summary.grading.combined.exact_points, '/', summary.grading.combined.representative_answers);
