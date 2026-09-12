// Local follow-up preparation only: original QA, question, evidence and code are not edited.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const folder = path.dirname(fileURLToPath(import.meta.url));
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous = `${base}/b/canary-plan-followup-v1`;
const wave = `${base}/execution-resumes/resume-2026-09-12-v3/canary`;
const gradeDir = `${wave}/grading-b/pilot-05-003`;
const qaFile = `${previous}/qa-pilot-05-003.json`;
const planFile = `${previous}/plan-pilot-05-003.json`;
const setFile = `${base}/a/execution-all-v7/sets/pilot-05-003.json`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity = file => ({ file: path.relative(process.cwd(), path.resolve(file)).replaceAll('\\', '/'), sha256: sha(file) });
const write = (name, doc) => fs.writeFileSync(path.join(folder, name), JSON.stringify(doc, null, 2) + '\n', { flag: 'wx' });
const { validateQuestionAuthoringPlan } = await import(pathToFileURL(path.resolve('cpa_uploader/questionAuthoringPlan.ts')).href);
assert.equal(sha(qaFile), '7ac435e1c7008924d0e17c1995be6b7f6204e2bf9a68b3612ea92571e9dcaf8f');
assert.equal(sha(planFile), '95d4ee7fafc42a3dd81378706bdad243570fc70a1cd0ee3b497aff42138ebbdf');
const set = read(setFile), beforeQa = read(qaFile), beforePlan = read(planFile);
const oldEvidence = read(`${gradeDir}/investigation-v1/findings.json`);
const oldSemantic = read(`${wave}/semantic-b/pilot-05-003/semantic.json`).reviews[0];
const preserved = read(`${gradeDir}/diagnostic-repeat-v1/inputs.json`);
const inputFiles = [qaFile, planFile, setFile, `${wave}/manifest.json`, `${wave}/semantic-b/pilot-05-003/semantic.json`,
    `${gradeDir}/grading.json`, `${gradeDir}/grading.json.grading.jsonl`, `${gradeDir}/diagnostic-repeat-v1/inputs.json`,
    `${gradeDir}/diagnostic-repeat-v1/observations.jsonl`, `${gradeDir}/diagnostic-repeat-v1/observation-2.json`,
    `${gradeDir}/diagnostic-repeat-v1/observation-3.json`, `${gradeDir}/investigation-v1/findings.json`, ...set.source_refs.map(ref => ref.file)];
const inputs = [...new Set(inputFiles)].map(identity);
assert.equal(beforeQa.cases.length, 35);
const plans = preserved.selection.plans;
const verdict = (criterion_id, value, reason) => ({ criterion_id, verdict: value, reason });
const additions = [
    { id: 'pilot-05-003-sub1-identification-time-not-communication-time-preserved', subquestion_id: 'sub1', kind: 'omission', target_criterion_id: 'crit2',
        answer: plans[0].answers.sub1, expected_points: 2,
        expected_verdicts: [verdict('crit1', 'met', '지배기구를 전달 상대방으로 제시한다.'), verdict('crit2', 'not_met', '감사 중은 미비점 식별을 수식한다. 전달의 적시성은 진술하지 않았으며 다른 맞는 명제로 보충하지 않는다.'), verdict('crit3', 'met', '서면 전달을 제시한다.')],
        note: 'R3 생성 omission 원답 그대로. 원 not_met 기대를 유지하고 3회 과다인정 실측은 별도 보존한다. strict not_met이며 0점 동률 판정 완화를 적용하지 않는다.' },
    { id: 'pilot-05-003-sub2-details-explicit-negation-preserved', subquestion_id: 'sub2', kind: 'contradiction', target_criterion_id: 'crit4',
        answer: plans[1].answers.sub2, expected_points: 1,
        expected_verdicts: [verdict('crit4', 'contradicted', '내역은 제시하지 않는다고 명시하여 내역 제시 의무를 부정한다.'), verdict('crit5', 'met', '미비점의 잠재적 영향은 설명한다고 제시한다.'),
            verdict('crit6', 'not_met', '재무제표 의견 목적을 제시하지 않는다.'), verdict('crit7', 'not_met', '내부통제 효과성 의견이 감사 목적이 아니라는 설명이 없다.'),
            verdict('crit9', 'not_met', '절차 설계를 위한 통제 고려를 설명하지 않는다.'), verdict('crit8', 'not_met', '보고할 미비점 범위의 식별·중요성 조건을 설명하지 않는다.')],
        note: 'R3 생성 원답 그대로. 역사적 kind=omission/expected=not_met과 3회 contradicted 실측을 보존한다. 공식265.11(a)·명시반대 정책에 따라 후속 기대만 contradicted로 정정하며 잠재 영향의 독립1점은 유지한다.' },
];
for (const test of additions) test.expected_by_subquestion = set.subquestions.map(sub => sub.id === test.subquestion_id
    ? { subquestion_id: sub.id, expected_points: test.expected_points, expected_verdicts: structuredClone(test.expected_verdicts) }
    : { subquestion_id: sub.id, expected_points: 0, expected_verdicts: sub.criteria.map(c => verdict(c.id, 'not_met', '이 물음의 답안은 빈 문자열이다.')) });
const qa = structuredClone(beforeQa);
qa.cases.push(...additions);
qa.r3_followup_lineage = { status: 'selected_for_followup_model_grading_not_run', predecessor: identity(qaFile), changes_file: `${base}/b/canary-followup-v2/changes.json`,
    original_cases_preserved: 35, added_cases: 2, api_calls_by_this_preparation: 0, human_approval: false };
const addedScope = [
    '검증 범위 후속 R3: sub1/crit2는 커뮤니케이션의 적시성이다. KGA 265.9의 감사 중 식별이라는 수식은 미비점 식별 시점이고 전달의 적시성을 대신하지 않는다. 지배기구에 서면 전달한다고만 쓴 원답은 crit1·crit3을 충족하지만 crit2는 중립 누락이다. 감사 중 등 시점 표현의 존재만으로 다른 행위의 요구 시점을 보충하지 않는다.',
    '검증 범위 후속 R3: sub2/crit4의 중립 누락은 내역을 제시할 의무의 반대 주장이 없는 답이다. 내역은 제시하지 않는다는 답은 KGA 265.11(a)의 내역 제시를 명시 부정하므로 contradicted이며 omission/not_met 사례로 분류하지 않는다. 같은 답의 잠재 영향 설명은 독립된 crit5로 인정한다.',
];
const plan = structuredClone(beforePlan);
plan.scope.exceptions.push(...addedScope);
plan.metadata.r3_followup = { status: 'selected_for_followup_model_review', predecessor: identity(planFile), changes_file: `${base}/b/canary-followup-v2/changes.json`,
    current_qa_file: `${base}/b/canary-followup-v2/qa-pilot-05-003.json`, question_content_changed: false, api_calls_by_this_preparation: 0, human_approval: false,
    expected_status: { identification_time_omission: 'original_not_met_retained', explicit_details_negation: 'historical_not_met_not_accepted_as_current_expected_current_contradicted' } };
const errors = validateQuestionAuthoringPlan(plan);
assert.deepEqual(errors, []);
assert.deepEqual(qa.cases.slice(0, 35), beforeQa.cases);
assert.equal(new Set(qa.cases.map(test => test.id)).size, 37);
for (const test of qa.cases) {
    const sub = set.subquestions.find(row => row.id === test.subquestion_id);
    assert(sub && typeof test.answer === 'string' && Number.isInteger(test.expected_points));
    assert.deepEqual([...test.expected_verdicts.map(row => row.criterion_id)].sort(), sub.criteria.map(row => row.id).sort());
    const points = test.expected_verdicts.reduce((sum, row) => {
        const criterion = sub.criteria.find(c => c.id === row.criterion_id);
        assert(['met', 'not_met', 'contradicted'].includes(row.verdict));
        return sum + criterion.scores[row.verdict];
    }, 0);
    assert.equal(points, test.expected_points);
}
assert.deepEqual(plan.scope.exceptions.slice(0, -2), beforePlan.scope.exceptions);
const reversePlan = structuredClone(plan);
reversePlan.scope.exceptions.splice(-2);
delete reversePlan.metadata.r3_followup;
assert.deepEqual(reversePlan, beforePlan);
for (const ref of set.source_refs) assert(fs.readFileSync(ref.file, 'utf8').includes(ref.source_quote));
for (const row of inputs) assert.equal(sha(row.file), row.sha256);
write('qa-pilot-05-003.json', qa);
write('plan-pilot-05-003.json', plan);
write('changes.json', { version: 1, created_at: new Date().toISOString(), set_id: set.id, status: 'selected_inputs_ready_not_model_executed', api_calls: 0,
    inputs, qa: { before: identity(qaFile), after: identity(path.join(folder, 'qa-pilot-05-003.json')), before_count: 35, after_count: 37,
        original_prefix_deep_equal: true, added_case_ids: additions.map(test => test.id), original_answers_exact: true },
    plan: { before: identity(planFile), after: identity(path.join(folder, 'plan-pilot-05-003.json')), scope_exceptions_added: addedScope, other_fields_unchanged_except_r3_lineage: true },
    counterexamples: additions.map((test, index) => ({ added_case_id: test.id, run_id: plans[index].id,
        original_generated_case: oldSemantic.cases.find(row => row.unit_id === plans[index].expected[0].unit_id && row.kind === 'omission'),
        original_expected_assertions: plans[index].expected, current_expected_verdicts: test.expected_verdicts,
        current_expected_points: test.expected_points, observations: oldEvidence.investigations[index].observations,
        source: oldEvidence.investigations[index].source, rationale: oldEvidence.investigations[index].reasoning })),
    question_bank_sources_criteria_model_answers_points_changed: false, old_qa_plan_receipts_bytes_preserved: true, common_code_modified: false, human_approval: false });
write('checks.json', { version: 1, model_api_calls: 0, plan_validation_errors: errors, qa_cases: 37, preserved_original_cases: 35, all_target_criterion_ids_and_integer_sums_valid: true,
    original_answers_exact: additions.every((test, i) => test.answer === plans[i].answers[test.subquestion_id]), source_quotes_exact: true,
    original_plan_recoverable_by_removing_only_two_scope_entries_and_r3_lineage: true, inputs_unchanged: true });
console.log(JSON.stringify({ outputs: ['qa-pilot-05-003.json', 'plan-pilot-05-003.json', 'changes.json', 'checks.json'].map(name => identity(path.join(folder, name))), api_calls: 0 }, null, 2));
