import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { buildGradingPrompt, buildGradingResponseSchema, applyQuestionSetJudgment } from '../../../../../../../lib/questionV3Grading.ts';
import { resolveAnswerEvidence } from '../../../../../../../lib/questionV3Evidence.ts';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const out = `${D}/c/resume-review-2026-09-12/semantic-case-contract-proposal-v1`;
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));
const describe = file => ({ file, sha256: fileSha(file) });
const preflight = json(`${out}/early-regression-preflight.json`);
const runtime = json(preflight.runtime.file);
assert.equal(fileSha(preflight.runtime.file), preflight.runtime.sha256);
for (const f of runtime.code_files) assert.equal(fileSha(f.file), f.sha256);
const groups = [];
for (const job of preflight.jobs) {
  const directory = job.outputs[0];
  const inputsFile = `${directory}/inputs.json`;
  const summaryFile = `${directory}/summary.json`;
  const inputs = json(inputsFile);
  const summary = json(summaryFile);
  assert.equal(inputs.model, 'gpt-5.6-luna');
  assert.equal(inputs.selected, job.case_id);
  assert.equal(inputs.mock, false);
  assert.equal(inputs.transport, 'production_gradeQuestionSetV3');
  assert.deepEqual(inputs.qa, json(job.qa_file));
  for (const [file, hash] of Object.entries(inputs.hashes)) assert.equal(fileSha(file), hash);
  assert.deepEqual(summary.changed_inputs, []);
  assert.equal(summary.stopped_on_execution_error, false);
  const observations = summary.records.map(entry => {
    const file = `${directory}/${entry.file}`;
    const record = json(file);
    assert.equal(record.case_id, job.case_id);
    assert.equal(record.model, 'gpt-5.6-luna');
    assert.equal(record.transport, 'live_model');
    assert.deepEqual(record.expected, job.expected);
    assert.deepEqual(record.answers, job.answers);
    assert.equal(record.request_hash, job.request_hash);
    assert.equal(record.schema_hash, job.schema_hash);
    assert.equal(sha(buildGradingPrompt(inputs.question_set, record.answers)), record.request_hash);
    assert.equal(sha(JSON.stringify(buildGradingResponseSchema(inputs.question_set, record.answers))), record.schema_hash);
    assert.equal(record.trace.length, 1);
    const trace = record.trace[0];
    assert.equal(trace.stage, 'judgment');
    assert.equal(trace.attempt, 1);
    assert(trace.response);
    assert(!trace.error);
    for (const sub of trace.response.subquestions) {
      assert.equal(sub.injection_detected, false);
      assert.equal(sub.salad_detected, false);
      const grounded = record.raw_judgment.subquestions.find(q => q.subquestion_id === sub.subquestion_id);
      for (const v of sub.verdicts) {
        const actual = grounded.verdicts.find(c => c.criterion_id === v.criterion_id);
        assert.equal(v.verdict, actual.verdict);
        if (v.verdict === 'not_met') assert.deepEqual(v.evidence_ids, []);
        else assert.equal(resolveAnswerEvidence(sub.subquestion_id, record.answers[sub.subquestion_id], v.evidence_ids), actual.quote);
      }
    }
    assert.deepEqual(applyQuestionSetJudgment(inputs.question_set, record.answers, record.raw_judgment), record.result);
    assert.equal(record.result.security_flag, 'none');
    const target = record.result.subquestions.find(q => q.subquestion_id === job.expected.subquestion_id);
    return { ...describe(file), attempt: record.attempt, started_at: record.started_at, finished_at: record.finished_at, request_hash: record.request_hash, schema_hash: record.schema_hash, model: record.model, transport: record.transport, expected_score: job.expected.expected_points, actual_score: record.result.score, matched: record.matched, target_criteria: target.criteria, security_flag: record.result.security_flag, raw_model_response_count: record.trace.length, request_schema_quote_replay_and_rescore_verified: true };
  });
  for (const remaining of job.outputs.slice(1)) assert(!fs.existsSync(remaining));
  groups.push({ label: job.label, set_id: job.set_id, case_id: job.case_id, input: describe(inputsFile), summary: describe(summaryFile), observations, unexecuted_round_paths: job.outputs.slice(1) });
}
assert.deepEqual(groups.map(g => g.observations.length), [1, 1, 3]);
assert.deepEqual(groups.map(g => g.observations.map(o => o.actual_score)), [[0], [5], [3, 3, 3]]);
assert.deepEqual(groups.map(g => g.observations.map(o => o.matched)), [[true], [true], [false, false, false]]);
const B = json(preflight.jobs[2].file);
const bSet = Array.isArray(B) ? B[0] : B;
const bSub = bSet.subquestions.find(q => q.id === 'sub1');
const sourceIds = [...new Set(bSub.criteria.find(c => c.id === 'crit2').source_ref_ids)];
const sources = bSet.source_refs.filter(s => sourceIds.includes(s.id));
const report = {
  version: 1, status: 'stopped_after_first_mismatch_cli_completed', checked_at: new Date().toISOString(), runtime: preflight.runtime,
  actual_nonempty_model_observations: 5, matched_observations: 2, mismatched_observations: 3, execution_errors: 0,
  planned_case_count: 3, planned_observations_per_case: 3, unexecuted_observations: 4,
  running_processes_owned: [], no_new_calls_after_mismatching_cli: true, groups,
  source_grounded_conclusion: {
    set_id: 'pilot-05-003', subquestion_id: 'sub1', criterion_id: 'crit2', prompt: bSub.prompt,
    criterion: bSub.criteria.find(c => c.id === 'crit2'), source_refs: sources,
    original_answer: preflight.jobs[2].expected.answer, original_expected: preflight.jobs[2].expected,
    result: '세 관측 모두 답안에 없는 적시 커뮤니케이션을 설명했다고 raw 모델 reason이 주장한다. 감사 중은 식별된 미비점을 수식하며, 별도 전달의 적시성을 말하거나 필연적으로 함축하지 않는다. 원 기대 crit2 not_met/합계2를 유지한다.',
    classification: 'grader_semantic_overcredit_unresolved_after_instruction_clarification',
    ruled_out: ['원답안·QA·문항 변조', 'request/schema/code/source drift', '증거 ID 해석 실패', '보안 감점/재확인', '합산 오류', '전송 실패/형상 재시도'],
    limitation: '요청한 모델명과 production 모델 호출/원시 응답을 확인했다. 현재 trace는 응답측 모델 버전 메타데이터를 보관하지 않아 제공자가 실제 반환한 세부 모델 버전까지 독립 식별했다고 주장하지 않는다.',
  },
  remaining: ['A 조건부 해지 누락 추가2관측', 'B 목적배제 누락 추가2관측', 'B 시점 누락의 3회 반복 오류에 관한 다음 변경·검증 방침'],
  checks: { raw_response_grounding_and_rescore: '5/5 pass', runtime_hash: '16/16 pass', qa_answers_and_expectations_unchanged: true, no_api_during_this_verifier: true, formal_acceptance: false },
};
const file = `${out}/early-regression-results.json`;
fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ ...describe(file), actual: 5, matched: 2, mismatched: 3, remaining: 4, errors: 0 }));
