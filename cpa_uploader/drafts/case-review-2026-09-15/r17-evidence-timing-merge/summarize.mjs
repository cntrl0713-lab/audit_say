// r17 회차의 검증 요약을 기록한다. 실제 채점이 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r17-evidence-timing-merge/summarize.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r17-evidence-timing-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r17';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const ref = (file) => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });

function block(execDir, entryPrefix, kinds) {
    const summary = read(`${execDir}/actual-a/summary.json`);
    const rows = [];
    for (const kind of kinds) {
        const o = read(`${execDir}/actual-a/${entryPrefix}--${kind}/observation.json`);
        for (const sub of o.subquestions) {
            const expected = o.original_expected.find((e) => e.subquestion_id === sub.subquestion_id);
            const actual = o.result.subquestions.find((x) => x.subquestion_id === sub.subquestion_id);
            const differences = expected.expected_verdicts
                .filter((v) => actual.criteria.find((c) => c.criterion_id === v.criterion_id).verdict !== v.verdict)
                .map((v) => `${v.criterion_id}: ${v.verdict} → ${actual.criteria.find((c) => c.criterion_id === v.criterion_id).verdict}`);
            rows.push({ entry: o.entry_id, kind, subquestion_id: sub.subquestion_id,
                expected: sub.expected_points, actual: sub.actual_points, delta: sub.delta,
                verdict_state_differences: differences, security_findings: o.security_findings });
        }
    }
    return {
        model: summary.new_usage[0]?.provider.response_model ?? 'gpt-5.6-luna',
        manifest: ref(`${execDir}/grading-manifest.json`),
        summary: ref(`${execDir}/actual-a/summary.json`),
        transport: 'model',
        actual_sdk_calls: summary.actual_sdk_calls,
        representative_answers: summary.representative_subquestion_answers,
        within_tolerance: summary.within_tolerance,
        exact_points: rows.filter((r) => r.delta === 0).length,
        observed_within_tolerance_ratio: summary.observed_within_tolerance_ratio,
        rows,
        usd: summary.usd,
        provider_token_totals: summary.provider_token_totals,
        request_ids: summary.new_usage.map((u) => ({ request_id: u.provider.request_id, response_id: u.provider.response_id, model: u.provider.response_model, service_tier: u.provider.service_tier })),
    };
}

const caseGrading = block(`${R}/execution-v1`, 'case-07-evidence-timing-20260920--case', ['model', 'partial', 'wrong']);
const stdGrading = block(`${R}/execution-standards-v1`, 'pilot-07-006-standards-20260920--sub4--standard', ['model', 'partial', 'wrong']);

const summary = {
    version: 1,
    round: 'r17',
    draft_version: 'v1',
    set_id: 'case-07-evidence-timing-20260920',
    standards_set_id: 'pilot-07-006-standards-20260920',
    created_at: new Date().toISOString(),
    draft: ref(`${D}/sets.json`),
    standards_draft: ref(`${D}/standards-sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    standards_content_review: ref(`${R}/root-content-review-standards-v1.json`),
    candidate_bank_check: {
        note: '현재 정본 358세트에 이 회차의 두 초안을 더한 360세트·518물음·1,816점을 메모리에서 validateAuthoringBank로 검증하고 분류 카탈로그를 함께 컴파일했다. 전체 은행 사본은 쓰지 않았다.',
        case_baseline: ref(`${R}/baseline-v1.json`),
        standards_baseline: ref(`${R}/baseline-standards-v1.json`),
    },
    grading: caseGrading,
    standards_grading: stdGrading,
    aborted_runs: [
        {
            path: `${R}/execution-v1/actual-a-aborted-nokey`,
            reason: 'OPENAI_API_KEY가 환경에 없어 모델 호출 전에 중단되었다. 모델 호출 0회, 사용량 0. preflight.json만 남아 있으며 분모에 넣지 않는다.',
            actual_sdk_calls: 0,
        },
    ],
    total_actual_sdk_calls: caseGrading.actual_sdk_calls + stdGrading.actual_sdk_calls,
    total_usd_provider_usage_arithmetic: caseGrading.usd + stdGrading.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    budget: '이 회차에 배정된 대표 요청 한도는 7회(사례형 3 + 기준서형 2 + 보조 최대 2)였다. 실제로는 사례형 3회 + 기준서형 3회(모범·부분·오답)로 6회를 사용했고 보조 실측은 하지 않았다.',
    verdict_state_note: '기대 판정과 실제 판정의 상태 차이는 모두 0점 상태(contradicted/not_met) 사이의 차이다. 원 기대값을 바꾸거나 재채점하지 않았다.',
    standalone_check: '기준서형 세트의 모범답안 요청은 shared_context.facts가 빈 투영으로 채점되었고 3점 만점이 나왔다. 사례를 보지 않은 답안으로 만점이 성립함을 실측으로 확인했다.',
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 세 세트의 활성 릴리스 제외(퇴역)와 pilot-07-006 기준서형 물음의 이관 처리',
        '승급 receipt 봉인',
        'coverage links 갱신',
        '검토 장부·수정 요청서·설계서의 반영 현황 갱신(메인 세션 담당)',
    ],
};

fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회', summary.total_usd_provider_usage_arithmetic);
