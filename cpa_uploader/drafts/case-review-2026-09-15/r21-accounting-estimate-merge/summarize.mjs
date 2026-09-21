// r21 회차의 검증 요약을 기록한다. 실제 채점이 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge/summarize.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r21';
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
        requests_without_returned_usage: summary.requests_without_returned_usage,
        request_ids: summary.new_usage.map((u) => ({ request_id: u.provider.request_id, response_id: u.provider.response_id, model: u.provider.response_model, service_tier: u.provider.service_tier })),
    };
}

const caseGrading = block(`${R}/execution-v1`, 'case-11-accounting-estimate-20260921--case', ['model', 'partial', 'wrong']);
const stdGrading = block(`${R}/execution-standards-v1`, 'pilot-11-005-standards-20260921--sub2--standard', ['model', 'partial', 'wrong']);

const summary = {
    version: 1,
    round: 'r21',
    draft_version: 'v1',
    set_id: 'case-11-accounting-estimate-20260921',
    standards_set_id: 'pilot-11-005-standards-20260921',
    created_at: new Date().toISOString(),
    draft: ref(`${D}/sets.json`),
    standards_draft: ref(`${D}/standards-sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    standards_content_review: ref(`${R}/root-content-review-standards-v1.json`),
    candidate_bank_check: {
        note: '현재 정본 354세트에 이 회차의 사례형 초안을 더한 355세트·506물음·1,794점, 두 초안을 모두 더한 356세트·507물음·1,799점을 각각 메모리에서 validateAuthoringBank로 검증하고 분류 카탈로그를 함께 컴파일했다(오류 0). 전체 은행 사본은 쓰지 않았다.',
        case_baseline: ref(`${R}/baseline-v1.json`),
        standards_baseline: ref(`${R}/baseline-standards-v1.json`),
    },
    prompt_collision_check: {
        method: '현재 정본 354세트의 발문과 같은 배치(case-review-2026-09-15)의 모든 초안 발문을 공백 제거 후 정규화하여 이 회차의 발문 4개와 대조했다. 후보 은행 빌드 직전과 실측 직전에 각각 한 번씩 수행했다.',
        compared_prompts: 532,
        this_round_prompts: 4,
        collisions: 0,
        note: '형제 회차 r20·r22~r27의 초안은 실측 시점에 아직 만들어지지 않았다. 형제 초안이 생긴 뒤 설치 전에 조율자가 한 번 더 대조해야 한다.',
    },
    grading: caseGrading,
    standards_grading: stdGrading,
    aborted_runs: [],
    total_actual_sdk_calls: caseGrading.actual_sdk_calls + stdGrading.actual_sdk_calls,
    total_representative_answers: caseGrading.representative_answers + stdGrading.representative_answers,
    total_within_tolerance: caseGrading.within_tolerance + stdGrading.within_tolerance,
    total_usd_provider_usage_arithmetic: caseGrading.usd + stdGrading.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    budget: '이 회차에 배정된 한도는 Luna 대표 3요청 + 보조 최대 3요청이다. 사례형 3회와 기준서형 3회(모범·부분·오답)로 6회를 사용했고 보조 실측은 하지 않았다. 사용자가 설정한 제공자 한도는 policy-input.json에 따라 not_specified다.',
    deviation_note: '대표 답안 12개 가운데 11개가 기대 점수와 정확히 일치했고(delta 0), 기준서형 부분정답 1개가 -1점이었다(허용 ±1점 안). 원인은 crit2("경영진의 대응이 추정불확실성을 적절하게 이해하고 다루는지 문단 26에 따라 평가한다")에 대하여 답안이 문단 27(a)의 문언 그대로 평가 대상을 생략하고 썼기 때문이다. 이 criterion은 원 pilot-11-005에서 바이트 그대로 승계했고 편차가 허용 범위 안이므로 재채점하지 않았다. 명제의 한정어가 문단 27(a) 문언보다 엄격한지는 사람 확인 사항으로 남긴다.',
    verdict_state_note: '사례형 오답에서 crit1·crit3·crit5·crit8의 판정이 기대 not_met·실제 contradicted로 달랐다. 넷 다 0점 상태 사이의 차이여서 원 기대값을 바꾸거나 재채점하지 않았다.',
    standalone_check: '기준서형 세트의 모범답안 요청은 shared_context.facts가 빈 투영으로 채점되었고 5점 만점이 나왔다. 사례를 보지 않은 답안으로 만점이 성립함을 실측으로 확인했다.',
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 두 세트(pilot-11-005, case-11-estimate-lookback-20260914)의 활성 릴리스 제외(퇴역)와 pilot-11-005 기준서형 물음의 이관 처리',
        '승급 receipt 봉인',
        'coverage links 갱신',
        '검토 장부·수정 요청서·설계서의 반영 현황 갱신(조율자 담당)',
        'r25(42·64) 초안이 나온 뒤의 경영진 편의 요구 중복 재대조',
    ],
};

fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회', summary.total_usd_provider_usage_arithmetic);
