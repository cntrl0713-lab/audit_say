// r38 실행 요약 기록기. 사례형·기준서형 실제 채점이 모두 끝난 뒤 한 번만 실행한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r38-interim-review-update/record-summary.mjs
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r38';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r38-interim-review-update';
const CASE_SET = 'case-19-interim-review-20260921';
const STD_SET = 'pilot-19-005-standards-20260921';
const STD_UNIT = `${STD_SET}--sub1--standard`;

const sha = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ref = (f) => ({ file: f, sha256: sha(f) });
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function collect(dir, entryPrefix) {
    const rows = [];
    for (const kind of ['model', 'partial', 'wrong']) {
        const entry = `${entryPrefix}--${kind}`;
        const o = read(`${dir}/${entry}/observation.json`);
        const expected = new Map();
        for (const e of o.original_expected) for (const v of e.expected_verdicts) expected.set(v.criterion_id, v.verdict);
        for (const s of o.subquestions) {
            const judged = o.judgment.subquestions.find((q) => q.subquestion_id === s.subquestion_id);
            const diffs = (judged?.verdicts ?? judged?.criteria ?? [])
                .filter((c) => expected.get(c.criterion_id) !== c.verdict)
                .map((c) => ({ criterion_id: c.criterion_id, expected: expected.get(c.criterion_id), actual: c.verdict }));
            rows.push({ entry, kind, subquestion_id: s.subquestion_id,
                expected: s.expected_points, actual: s.actual_points, delta: s.delta, verdict_state_differences: diffs });
        }
    }
    return rows;
}

const caseMain = read(`${R}/execution-v1/actual-a/summary.json`);
const stdMain = read(`${R}/execution-standards-v1/actual-a/summary.json`);
const caseRows = collect(`${R}/execution-v1/actual-a`, `${CASE_SET}--case`);
const stdRows = collect(`${R}/execution-standards-v1/actual-a`, STD_UNIT);

const gradingBlock = (main, rows, manifest, summaryFile, note) => ({
    model: 'gpt-5.6-luna',
    manifest: ref(manifest),
    summary: ref(summaryFile),
    transport: 'model',
    actual_sdk_calls: main.actual_sdk_calls,
    representative_answers: main.representative_subquestion_answers,
    within_tolerance: main.within_tolerance,
    observed_within_tolerance_ratio: main.observed_within_tolerance_ratio,
    target_ratio: main.target_ratio,
    exact_points: rows.filter((r) => r.delta === 0).length,
    rows,
    verdict_state_note: note,
    usd: main.usd,
    provider_token_totals: main.provider_token_totals,
    requests_without_returned_usage: main.requests_without_returned_usage,
    provider_request_ids: main.new_usage.map((u) => u.provider.request_id),
    provider_response_ids: main.new_usage.map((u) => u.provider.response_id),
    response_models: [...new Set(main.new_usage.map((u) => u.provider.response_model))],
});

const summary = {
    version: 1,
    round: 'r38',
    draft_version: 'v1',
    set_id: CASE_SET,
    standards_set_id: STD_SET,
    created_at: new Date().toISOString(),
    route: 'case_single_update_with_standards_split',
    updated_set: 'pilot-19-005',
    edit_note_number: 41,
    draft: ref(`${D}/sets.json`),
    standards_draft: ref(`${D}/standards-sets.json`),
    content_review: ref(`${R}/root-content-review-v1.json`),
    standards_content_review: ref(`${R}/root-content-review-standards-v1.json`),
    classification: ref(`${R}/classification-v1.json`),
    standards_classification: ref(`${R}/classification-standards-v1.json`),
    grading: gradingBlock(
        caseMain, caseRows,
        `${R}/execution-v1/grading-manifest.json`,
        `${R}/execution-v1/actual-a/summary.json`,
        '기대 판정과 실제 판정의 상태 차이는 rows에 남긴다. 이 실행의 상태 차이는 대표 오답이 아니라 대표 부분정답 물음 2의 crit4 한 건(기대 not_met, 실제 contradicted)이며 두 판정 모두 0점이어서 점수 차이가 없다. 비용 통제 지침에 따라 0점끼리의 판정 상태 차이는 재채점하지 않는다.',
    ),
    standards_grading: gradingBlock(
        stdMain, stdRows,
        `${R}/execution-standards-v1/grading-manifest.json`,
        `${R}/execution-standards-v1/actual-a/summary.json`,
        '기대 판정과 실제 판정의 상태 차이가 없다.',
    ),
    combined: {
        representative_answers: caseMain.representative_subquestion_answers + stdMain.representative_subquestion_answers,
        within_tolerance: caseMain.within_tolerance + stdMain.within_tolerance,
        observed_within_tolerance_ratio:
            (caseMain.within_tolerance + stdMain.within_tolerance)
            / (caseMain.representative_subquestion_answers + stdMain.representative_subquestion_answers),
        target_ratio: 0.95,
        exact_points: caseRows.filter((r) => r.delta === 0).length + stdRows.filter((r) => r.delta === 0).length,
    },
    supplementary: {
        run: false,
        reason: '대표 12답안(사례형 9·기준서형 3)의 점수가 모두 기대와 정확히 일치했고(delta 0) 허용 범위 밖 결과가 없어 보조 요청을 추가하지 않았다. 허용한 ±1점 편차를 없애기 위한 반복 호출도 하지 않았다. qa.json의 supplementary_cases 3건과 qa-standards.json의 2건은 run=false로 남겨 두었다.',
    },
    total_actual_sdk_calls: caseMain.actual_sdk_calls + stdMain.actual_sdk_calls,
    total_usd_provider_usage_arithmetic: caseMain.usd + stdMain.usd,
    costs_are_provider_usage_arithmetic_not_invoice: true,
    separate_paid_semantic_review: 'not_run',
    human_review_performed: false,
    classification_standards_note: '이 회차의 두 세트는 근거가 KGA가 아니라 분·반기재무제표 검토준칙이어서 source_refs[].page가 "KGA "로 시작하지 않는다. validateAuthoringBank의 classification.standards 대조는 KGA 접두 page만 모아 비교하므로 두 세트의 classification.standards는 빈 배열이 규칙에 맞고, 주제별 허용 기준서 범위 검사와 KGA 제목 구간 인용 검사도 적용되지 않는다. 현재 정본 341세트 + 두 초안 = 343세트를 메모리에서 validateAuthoringBank로 검증해 오류 0건이었다. 검증에서 걸린 항목은 없다.',
    registered_source_limit_note: '등록 원문 cpa_uploader/data/official/delegated-s06-interim-2015.txt에는 이 준칙의 문단 1(1-1)·7·8·9·19·20·36·46(46-1)만 있다. 배정이 후보로 든 검토절차의 구체 내용(문단 22·23), 수정되지 않은 왜곡표시의 평가(문단 32~35), 결론의 변형(문단 49~51) 등은 등록 원문에 없어 항목으로 쓰지 않았다. 목록과 사유는 lineage.json의 requirements_not_written_for_lack_of_registered_text에 있다.',
    not_done: [
        '정본·공개본·암호화본 반영',
        '운영 DB 등록',
        '원 세트 pilot-19-005의 활성 릴리스 제외(퇴역)',
        '승급 receipt 봉인(authorization.production_publication 미승인)',
        'coverage links 갱신',
        '수정 요청서·검토 장부·drafts README 갱신(메인 세션 담당)',
        '등록 원문에 없는 문단의 추가 등록(조율자 판단 사항)',
    ],
};

fs.writeFileSync(`${R}/summary-v1.json`, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
console.log('summary-v1.json 기록:', summary.total_actual_sdk_calls, '회 ·', summary.total_usd_provider_usage_arithmetic, 'USD · exact',
    summary.combined.exact_points, '/', summary.combined.representative_answers);
