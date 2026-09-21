// r31 회차의 검증 요약을 기록한다. 실제 채점이 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension/summarize.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r31';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const ref = (file) => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });

function block(execDir, entryPrefixes, kinds) {
    const summary = read(`${execDir}/actual-a/summary.json`);
    const rows = [];
    for (const entryPrefix of entryPrefixes) {
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

const caseGrading = block(`${R}/execution-v1`, ['case-16-comparative-restatement-20260921--case'], ['model', 'partial', 'wrong']);
const stdGrading = block(`${R}/execution-standards-v1`, [
    'pilot-16-008-standards-20260921--sub2--standard',
    'pilot-16-008-standards-20260921--sub3--standard',
], ['model', 'partial', 'wrong']);

const summary = {
    version: 1,
    round: 'r31',
    draft_version: 'v1',
    set_id: 'case-16-comparative-restatement-20260921',
    standards_set_id: 'pilot-16-008-standards-20260921',
    created_at: new Date().toISOString(),
    draft: ref(`${D}/sets.json`),
    standards_draft: ref(`${D}/standards-sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    standards_content_review: ref(`${R}/root-content-review-standards-v1.json`),
    candidate_bank_check: {
        note: '현재 정본 346세트에 이 회차의 사례형 초안을 더한 347세트·483물음·1,757점, 두 초안을 모두 더한 348세트·485물음·1,763점을 각각 메모리에서 validateAuthoringBank로 검증하고 분류 카탈로그를 함께 컴파일했다(오류 0). 전체 은행 사본은 쓰지 않았다.',
        case_baseline: ref(`${R}/baseline-v1.json`),
        standards_baseline: ref(`${R}/baseline-standards-v1.json`),
    },
    prompt_collision_check: {
        method: '현재 정본 346세트의 발문 480개와 같은 배치(case-review-2026-09-15)의 형제 초안 폴더 31개가 담은 발문 86개를 공백 제거·소문자 정규화하여 이 회차의 발문 5개(사례형 3, 기준서형 2)와 대조했다. 후보 은행 빌드 직전과 실측 직전에 각각 한 번씩 수행했다.',
        compared_prompts: 566,
        this_round_prompts: 5,
        collisions: 0,
        retiring_self_collisions: 0,
        note: '퇴역 예정인 case-16-comparative-restatement-20260919·pilot-16-008의 발문과도 겹치지 않는다. 사례형 세 발문은 배정된 도입 규칙(비교정보 절차의 단계 이름)으로, 기준서형 두 발문은 문단·항 기호로 새로 썼다. 형제 회차 r28~r30·r32가 이 시각에도 초안을 만들고 있으므로 설치 전에 조율자가 한 번 더 대조해야 한다.',
    },
    grading: caseGrading,
    standards_grading: stdGrading,
    aborted_runs: [
        {
            path: `${R}/execution-standards-v1-aborted-build`,
            stage: 'manifest_build',
            model_calls: 0,
            reason: 'r21에서 옮겨 온 build-standards-round.mjs가 selectLearningQuestionSet에 세트의 분류 전체를 넘겨, 물음이 둘인 기준서형 세트에서 "학습 단위와 물음 판본이 일치하지 않습니다"로 멈췄다. 학습 단위에 속한 분류만 넘기도록 고쳤다.',
            disposition: '지우지 않고 보존했다. abort-note.json에 경위를 적었고 실제 채점 증거는 들어 있지 않다.',
        },
    ],
    total_actual_sdk_calls: caseGrading.actual_sdk_calls + stdGrading.actual_sdk_calls,
    total_representative_answers: caseGrading.representative_answers + stdGrading.representative_answers,
    total_within_tolerance: caseGrading.within_tolerance + stdGrading.within_tolerance,
    total_usd_provider_usage_arithmetic: caseGrading.usd + stdGrading.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    budget: '이 회차에 배정된 한도는 Luna 대표 3요청 + 보조 최대 3요청이다. 사례형은 모범·부분·오답 3요청으로 세 물음을 한 번에 채점했고, 기준서형은 물음마다 학습 단위가 따로 생겨 한 요청이 한 물음만 담으므로 2물음 × 3역할 = 6요청을 썼다. 모두 9회이며 보조 실측은 하지 않았다. 기준서형 6요청은 대표 역할을 늘린 것이 아니라 학습 단위 구조에 따른 최소 요청 수다(r17·r21의 기준서형 세트는 1물음이어서 3요청이었다). 사용자가 설정한 제공자 한도는 policy-input.json에 따라 not_specified다.',
    deviation_note: '대표 답안 15개(사례형 9, 기준서형 6)가 모두 기대 점수와 정확히 일치했다(delta 0). 허용 ±1점을 쓴 답안이 없고 허용 범위 안 비율은 15/15 = 100%다. 재채점이나 추가 요청은 하지 않았다.',
    verdict_state_note: '0점 또는 부분정답 상태에서 판정 이름만 다른 경우가 일곱 건 있었다(사례형 partial sub3/crit9, 사례형 wrong sub1/crit1·sub2/crit5·sub3/crit8, 기준서형 wrong sub2/crit1·crit2·sub3/crit6). 모두 기대 not_met, 실제 contradicted이고 두 상태의 점수가 0으로 같다. 비용 통제 지침에 따라 0점끼리의 판정 상태 차이는 재채점하지 않았고 기대값도 바꾸지 않았다.',
    standalone_check: '기준서형 세트의 모범답안 요청 두 건은 shared_context.facts가 빈 투영으로 채점되었고 각각 2점·4점 만점이 나왔다. 사례를 보지 않은 답안으로 만점이 성립함을 실측으로 확인했다.',
    new_question_check: '새로 더한 사례형 물음 3(⑩~⑫, 2점)의 모범·부분·오답이 모두 기대대로 채점되었다. 부분정답은 식별(crit8)만 인정되고 이유(crit9)가 불인정되어 1점이 나왔으며, 물음 1의 ⑤(문단 9 후단)와 물음 3의 ⑫(문단 9 전단)를 혼동한 답안이 실제로 이유 점수를 받지 못하는 것을 확인했다.',
    approach_fixing_note: '배정서는 대상 갱신본을 대응수치 사례로 보고 "대응수치 방식 하나로 고정"하라고 지시했으나, 원문 대조 결과 대상 갱신본 case-16-comparative-restatement-20260919은 외부감사법 감사·비교재무제표 방식의 사례였다. 두 방식을 섞지 말라는 취지를 지키면서 대상 갱신본의 항목을 보존하기 위해 비교재무제표 방식으로 고정했고 근거는 lineage.json의 approach_conflict에 있다. 그 결과 pilot-16-008의 사례형 2물음(KGA 710 문단 11, 5점)은 승계하지 않았다. 설치 전에 조율자 확인이 필요하다.',
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 두 세트(case-16-comparative-restatement-20260919, pilot-16-008)의 활성 릴리스 제외(퇴역)',
        '승급 receipt 봉인',
        'coverage links 갱신',
        '검토 장부·수정 요청서·설계서의 반영 현황 갱신(조율자 담당)',
        '방식 고정 판단(비교재무제표)과 pilot-16-008 사례형 2물음의 처리에 대한 조율자 확인',
        '기준서형 세트가 학습 단위 두 개를 만드는 점에 대한 운영 반영 드라이버 확인',
        '형제 회차 r28~r30·r32 초안이 확정된 뒤의 발문 바이트 재대조',
    ],
};

fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회', summary.total_usd_provider_usage_arithmetic);
