// r24: 대표 실측과 보조 실측을 한 장부로 요약한다. 실측이 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r24-engagement-change-merge/record-summary.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
process.chdir(root);

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r24-engagement-change-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r24';
const SET_ID = 'case-03-engagement-acceptance-change-20260921';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const ref = (file) => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });

const actual = read(`${R}/execution-v1/actual-a/summary.json`);
const supp = read(`${R}/supplementary-v1/summary.json`);
const rows = [];
let exact = 0;
for (const kind of ['model', 'partial', 'wrong']) {
    const folder = `${R}/execution-v1/actual-a/${SET_ID}--case--${kind}`;
    const observation = read(`${folder}/observation.json`);
    for (const question of observation.subquestions) {
        const expected = observation.original_expected.find((e) => e.subquestion_id === question.subquestion_id);
        const judged = observation.judgment.subquestions.find((s) => s.subquestion_id === question.subquestion_id);
        const differences = expected.expected_verdicts
            .filter((v) => judged.verdicts.find((a) => a.criterion_id === v.criterion_id)?.verdict !== v.verdict)
            .map((v) => v.criterion_id);
        if (question.delta === 0) exact += 1;
        rows.push({
            entry: observation.entry_id, kind, subquestion_id: question.subquestion_id,
            expected: question.expected_points, actual: question.actual_points, delta: question.delta,
            verdict_state_differences: differences,
        });
    }
}

const summary = {
    version: 1,
    round: 'r24',
    draft_version: 'v1',
    set_id: SET_ID,
    created_at: new Date().toISOString(),
    draft: ref(`${D}/sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    grading: {
        model: 'gpt-5.6-luna',
        manifest: ref(`${R}/execution-v1/grading-manifest.json`),
        summary: ref(`${R}/execution-v1/actual-a/summary.json`),
        transport: 'model',
        actual_sdk_calls: actual.actual_sdk_calls,
        representative_answers: actual.representative_subquestion_answers,
        within_tolerance: actual.within_tolerance,
        exact_points: exact,
        observed_within_tolerance_ratio: actual.observed_within_tolerance_ratio,
        target_ratio: actual.target_ratio,
        grading_point_tolerance: 1,
        statistical_confidence_claim: false,
        rows,
        provider_token_totals: actual.provider_token_totals,
        usd: actual.usd,
        requests_without_returned_usage: actual.requests_without_returned_usage,
    },
    supplementary: {
        input: ref(`${R}/supplementary-input-v1.json`),
        summary: ref(`${R}/supplementary-v1/summary.json`),
        receipt_denominator: false,
        actual_sdk_calls: supp.actual_sdk_calls,
        usd: supp.usd,
        rows: supp.rows.map((row) => ({
            id: row.id, strict_matched: row.strict_matched, within_tolerance: row.within_tolerance,
            subquestions: row.subquestions.map((q) => ({ subquestion_id: q.subquestion_id, expected: q.expected_points, actual: q.actual_points, delta: q.delta })),
        })),
    },
    residual_findings: [
        '대표 답안 아홉 개 모두 delta 0으로 기대와 정확히 일치했다. 대표 부분정답의 식별 기준 한 건(crit1)만 기대 contradicted와 실제 not_met이 달랐고 둘 다 0점인 판정 상태 차이여서 재채점하지 않았다(정책: 0점끼리의 판정 상태 차이는 재채점하지 않는다).',
        '보조 실측 두 건은 판정까지 모두 일치했다. crit2의 "기록·문서 접근만 언급하면 인정하지 않음"과 crit6의 "사례와 연결하지 않은 일반론은 인정하지 않음" 경계, 물음 3 함정 ⑫를 옳지 않다고 고른 답의 식별 점수 상실이 설계대로 작동했다.',
        'agent 내용검토와 이 실측은 사람 검수·정본 수록·운영 DB 반영을 뜻하지 않는다. 설치와 승급은 조율자가 수행한다.',
    ],
};

const out = `${R}/summary-v1.json`;
fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log(`${out} 작성: 대표 ${summary.grading.representative_answers}개 중 허용 범위 ${summary.grading.within_tolerance}개(정확 일치 ${exact}개) · 보조 ${summary.supplementary.rows.length}건 · 모델 호출 ${actual.actual_sdk_calls + supp.actual_sdk_calls}회`);
