// Read-only evidence replay. No request function is imported or invoked.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const wave = `${base}/execution-resumes/resume-2026-09-12-v3/canary`;
const gradeDir = `${wave}/grading-b/pilot-05-003`;
const qaDir = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v3/canary/author-qa-b/pilot-05-003/author-qa';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = file => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema } = await import(pathToFileURL(path.resolve('lib/questionV3Grading.ts')).href);
const { jsonHash } = await import(pathToFileURL(path.resolve('cpa_uploader/questionReviewIdentity.ts')).href);
const manifest = read(`${wave}/manifest.json`);
const job = manifest.jobs.find(row => row.worker === 'b');
const set = read(job.file);
const preserved = read(`${gradeDir}/diagnostic-repeat-v1/inputs.json`);
for (const row of preserved.snapshots) assert.equal(sha(row.file), row.sha256);
assert.equal(sha(job.file), job.sha256);
const semantic = read(`${wave}/semantic-b/pilot-05-003/semantic.json`).reviews[0];
const formalRows = lines(`${gradeDir}/grading.json.grading.jsonl`);
const repeats = lines(`${gradeDir}/diagnostic-repeat-v1/observations.jsonl`);
const qaSummary = read(`${qaDir}/summary.json`);
const qaRows = qaSummary.records.map(row => read(`${qaDir}/${row.file}`));
const mismatchIds = formalRows.filter(row => row.matched === false).map(row => row.id);
assert.equal(mismatchIds.length, 2);
const allRows = [...formalRows, ...repeats];
let replayed = 0;
let emptyResultsChecked = 0;
for (const row of [...allRows, ...qaRows]) {
    const judgment = row.judgment ?? row.raw_judgment;
    if (!judgment) {
        assert(Object.values(row.answers).every(answer => !answer.trim()));
        assert.equal(row.result.score, 0);
        assert.equal(row.result.security_flag, 'none');
        assert.equal((row.trace ?? []).length, 0);
        assert(row.result.subquestions.every(sub => sub.criteria.every(c => c.verdict === 'not_met' && c.awarded_points === 0)));
        emptyResultsChecked++;
        continue;
    }
    assert(judgment && row.result);
    assert.deepEqual(applyQuestionSetJudgment(set, row.answers, judgment), row.result);
    assert.equal(row.result.security_flag, 'none');
    for (const sub of judgment.subquestions) {
        assert(!sub.injection_detected && !sub.salad_detected);
        for (const verdict of sub.verdicts) if (verdict.quote) assert((row.answers[sub.subquestion_id] ?? '').includes(verdict.quote));
    }
    for (const trace of row.trace ?? []) if (trace.stage === 'judgment') for (const sub of trace.response.subquestions) assert(!sub.injection_detected && !sub.salad_detected);
    replayed++;
}
const investigations = preserved.selection.plans.map(plan => {
    assert.equal(jsonHash(buildGradingPrompt(set, plan.answers)), plan.prompt_hash);
    assert.equal(jsonHash(buildGradingResponseSchema(set, plan.answers)), plan.schema_hash);
    const observations = allRows.filter(row => row.id === plan.id);
    assert.equal(observations.length, 3);
    for (const row of observations) {
        assert.deepEqual(row.answers, plan.answers);
        assert.deepEqual(row.expected, plan.expected);
        assert.equal(row.transport, 'model');
        assert.equal(row.model, 'gpt-5.6-luna');
    }
    const target = plan.expected[0];
    return { id: plan.id, answers: plan.answers, historical_generated_expected: plan.expected,
        current_prompt_hash: plan.prompt_hash, current_schema_hash: plan.schema_hash,
        target, observations: observations.map((row, i) => ({ observation: i + 1, total_score: row.result.score,
            target_raw: row.judgment.subquestions.find(sub => sub.subquestion_id === target.subquestion_id).verdicts.find(v => v.criterion_id === target.criterion_id),
            all_criteria: row.result.subquestions.flatMap(sub => sub.criteria.map(c => ({ subquestion_id: sub.subquestion_id, criterion_id: c.criterion_id, verdict: c.verdict, points: c.awarded_points }))),
            raw_security_clear: true, final_security: row.result.security_flag, replay_identical: true })) };
});
Object.assign(investigations[0], { finding: 'model_semantic_overcredit_reproduced_3_of_3', expected_verdict_retained: 'not_met', expected_total_points: 2,
    source: { source_ref_id: 'src1', file: set.source_refs[0].file, sha256: sha(set.source_refs[0].file), paragraph: 'KGA 265.9', lines: [158, 160], quote: set.source_refs[0].source_quote },
    reasoning: '발문은 상대방·시점·형태를 각각 요구한다. 답안의 감사 중은 식별 시점에 붙고 커뮤니케이션을 적시에 한다는 행위 시점을 제시하지 않는다. 지배기구와 서면은 맞지만 적시 명제는 없다. 세 raw 모두 답안에 없는 적시 의미를 인정하므로 인용 복원·보안·합산이 아닌 모델 의미판정의 과다 인정이다.',
    next_step: '유효 원답과 적시를 명시한 정상 답안을 보존한다. 기대값이나 원 문항을 모델에 맞춰 바꾸지 않고 총괄이 제한된 후속 채점정책/대조군 검증 범위를 결정한다.' });
Object.assign(investigations[1], { finding: 'generated_case_expectation_error', proposed_current_verdict: 'contradicted', proposed_kind: 'contradiction', expected_total_points: 1,
    source: { source_ref_id: 'src2', file: set.source_refs[1].file, sha256: sha(set.source_refs[1].file), paragraph: 'KGA 265.11(a)', lines: [166, 171], quote: set.source_refs[1].source_quote },
    reasoning: '발문이 서면 전달에 포함할 내용을 묻는데 내역은 제시하지 않는다고 명시하므로 내역 제시 의무의 반대이다. 잠재적 영향 설명은 독립적으로 맞아 1점을 유지한다. 생성 kind=omission/expected=not_met은 잘못되었고 원시 contradicted가 타당하다. 0점 동률만으로 원 receipt를 통과로 덮어쓰지 않는다.',
    next_step: '원 생성사례·기대·세 실측을 보존한다. 총괄 승인 시 동일 답안의 corrected QA와 진짜 중립 누락 대조군을 별도 후속으로 준비하며 원 receipt는 수정하지 않는다.' });
for (const ref of set.source_refs) assert(fs.readFileSync(ref.file, 'utf8').includes(ref.source_quote));
const traceCounts = rows => ({ observations: rows.length, nonempty_answers: rows.filter(row => Object.values(row.answers).some(answer => answer.trim())).length,
    judgment_responses: rows.flatMap(row => row.trace ?? []).filter(row => row.stage === 'judgment').length,
    nonjudgment_trace_stages: rows.flatMap(row => row.trace ?? []).filter(row => row.stage !== 'judgment').map(row => row.stage) });
const report = { version: 1, created_at: new Date().toISOString(), set_id: set.id, method: 'independent_local_source_and_recorded_actual_model_evidence_review',
    model_api_calls_by_this_audit: 0, human_approval: false, formal_pass_claimed: false, active_processes: 0,
    semantic: { verdict: semantic.verdict, units: semantic.units.length, generated_assertions: semantic.cases.length, hash: sha(`${wave}/semantic-b/pilot-05-003/semantic.json`) },
    formal_grading: { ...traceCounts(formalRows), matches: formalRows.filter(row => row.matched).length, mismatches: mismatchIds.length, hash: sha(`${gradeDir}/grading.json`) },
    diagnostic_repeats: traceCounts(repeats), author_qa: { ...traceCounts(qaRows), cases: 35, matches: qaRows.filter(row => row.matched).length, hash: sha(`${qaDir}/summary.json`),
        historical_omit_crit7: qaRows.find(row => row.case_id.endsWith('omit-crit7')).result.score,
        preserved_recipient_condition: qaRows.find(row => row.case_id.endsWith('recipient-law-condition-preserved')).result.score },
    local_replay_count: replayed, empty_no_model_results_checked: emptyResultsChecked, source_quotes_exact: true, remaining_and_learning_smoke: 'not_started', investigations,
    evidence_files: [job.file, job.plan_file, job.qa_file, `${wave}/manifest.json`, `${gradeDir}/grading.json`, `${gradeDir}/grading.json.grading.jsonl`,
        `${gradeDir}/diagnostic-repeat-v1/inputs.json`, `${gradeDir}/diagnostic-repeat-v1/observations.jsonl`, `${qaDir}/summary.json`].map(file => ({ file, sha256: sha(file) })) };
fs.writeFileSync(path.join(out, 'findings.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ report: path.join(out, 'findings.json'), sha256: sha(path.join(out, 'findings.json')), replayed, formal: report.formal_grading, repeats: report.diagnostic_repeats, author_qa: report.author_qa }, null, 2));
