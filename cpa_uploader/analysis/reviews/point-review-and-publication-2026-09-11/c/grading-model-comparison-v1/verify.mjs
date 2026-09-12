import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const { buildGradingPrompt, buildGradingResponseSchema, applyQuestionSetJudgment } = await import(pathToFileURL(path.resolve('lib/questionV3Grading.ts')));
const { resolveAnswerEvidence } = await import(pathToFileURL(path.resolve('lib/questionV3Evidence.ts')));
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const own = `${D}/c/grading-model-comparison-v1`;
const output = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/grading-model-comparison-v1/c-terra-full';
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const desc = file => ({ file, sha256: hash(file) });
const runtimeFile = `${D}/execution-runtime-v7.json`;
assert.equal(hash(runtimeFile), '17e99d1dff7f6ecaba48658796788be0b1f47b03364cc23c348932474d18a250');
const runtime = json(runtimeFile);
for (const f of runtime.code_files) assert.equal(hash(f.file), f.sha256);
const manifestFile = `${D}/a/execution-all-v9/manifest.json`;
const manifest = json(manifestFile);
const job = manifest.jobs.find(j => j.set_id === 'pilot-03-001');
assert(job);
assert.equal(hash(job.file), job.sha256);
assert.equal(hash(job.qa_file), job.qa_sha256);
for (const f of job.source_files) assert.equal(hash(f.file), f.sha256);
const value = json(job.file);
const set = Array.isArray(value) ? value[0] : value;
const qa = json(job.qa_file);
assert.equal(qa.cases.length, 22);
assert(set.source_refs.some(s => s.id === 'src210-6b-supplement'));
const cases = qa.cases.map(test => {
  const q = set.subquestions.find(q => q.id === test.subquestion_id);
  assert(q);
  assert.equal(test.expected_verdicts.length, q.criteria.length);
  const sum = test.expected_verdicts.reduce((s, v) => s + (v.verdict === 'met' ? q.criteria.find(c => c.id === v.criterion_id).scores.met : 0), 0);
  assert.equal(sum, test.expected_points);
  const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
  return { id: test.id, expected_points: test.expected_points, answer: test.answer, answers, expected_verdicts: test.expected_verdicts, request_hash: sha(buildGradingPrompt(set, answers)), schema_hash: sha(JSON.stringify(buildGradingResponseSchema(set, answers))) };
});
const preflight = { version: 1, status: 'local_model_comparison_preflight', runtime: desc(runtimeFile), runtime_declared_model: runtime.grading_model, explicit_diagnostic_model_override: 'gpt-5.6-terra', manifest: desc(manifestFile), job, cases, output, scope: 'C QA22 선행 모델 비교 진단; 정식 의미검수/승급/DB 실행 아님', api_calls_in_preflight: 0 };
const preflightFile = `${own}/preflight.json`;
if (!fs.existsSync(preflightFile)) {
  assert(!fs.existsSync(output));
  fs.writeFileSync(preflightFile, `${JSON.stringify(preflight, null, 2)}\n`, { flag: 'wx' });
} else assert.deepEqual(json(preflightFile), preflight);
if (!process.argv.includes('--results')) {
  console.log(JSON.stringify({ status: 'preflight_pass_api0', ...desc(preflightFile), cases: cases.length, nonempty: cases.filter(c => c.answer.trim()).length }));
} else {
  const inputs = json(`${output}/inputs.json`);
  const summary = json(`${output}/summary.json`);
  assert.equal(inputs.model, 'gpt-5.6-terra');
  assert.equal(inputs.selected, null);
  assert.equal(inputs.mock, false);
  assert.deepEqual(inputs.question_set, set);
  assert.deepEqual(inputs.qa, qa);
  for (const [file, expectedHash] of Object.entries(inputs.hashes)) assert.equal(hash(file), expectedHash);
  assert.deepEqual(summary.changed_inputs, []);
  const observations = summary.records.map(entry => {
    const file = `${output}/${entry.file}`;
    const r = json(file);
    const test = cases.find(c => c.id === r.case_id);
    assert(test);
    assert.equal(r.model, 'gpt-5.6-terra');
    assert.deepEqual(r.expected, qa.cases.find(c => c.id === r.case_id));
    assert.deepEqual(r.answers, test.answers);
    assert.equal(r.request_hash, test.request_hash);
    assert.equal(r.schema_hash, test.schema_hash);
    assert(!r.error);
    if (test.answer.trim()) {
      assert.equal(r.transport, 'live_model');
      const rawEvents = r.trace.filter(t => t.response);
      assert(rawEvents.length >= 1);
      const final = rawEvents.findLast(t => t.stage === 'judgment').response;
      for (const sub of final.subquestions) for (const v of sub.verdicts) {
        const grounded = r.raw_judgment.subquestions.find(q => q.subquestion_id === sub.subquestion_id).verdicts.find(c => c.criterion_id === v.criterion_id);
        assert.equal(v.verdict, grounded.verdict);
        if (v.verdict === 'not_met') assert.deepEqual(v.evidence_ids, []);
        else assert.equal(resolveAnswerEvidence(sub.subquestion_id, r.answers[sub.subquestion_id], v.evidence_ids), grounded.quote);
      }
      assert.deepEqual(applyQuestionSetJudgment(set, r.answers, r.raw_judgment), r.result);
    } else {
      assert.equal(r.transport, 'production_empty_answer_no_model');
      assert.equal(r.result.score, 0);
      assert.equal(r.trace.length, 0);
    }
    return { ...desc(file), case_id: r.case_id, attempt: r.attempt, model: r.model, transport: r.transport, score: r.result.score, expected_score: test.expected_points, matched: r.matched, security_flag: r.result.security_flag, raw_response_count: r.trace.filter(t => t.response).length, errors: r.trace.filter(t => t.error), request_hash: r.request_hash, schema_hash: r.schema_hash, differences: r.verdict_differences, started_at: r.started_at, finished_at: r.finished_at };
  });
  const result = { version: 1, status: summary.mismatched_case_ids.length ? 'diagnostic_mismatches' : 'diagnostic_all_matched', preflight: desc(preflightFile), inputs: desc(`${output}/inputs.json`), summary: desc(`${output}/summary.json`), counts: { expected_cases: 22, observed_unique_cases: new Set(observations.map(o => o.case_id)).size, observations: observations.length, live_model_observations: observations.filter(o => o.transport === 'live_model').length, empty_no_model: observations.filter(o => o.transport === 'production_empty_answer_no_model').length, actual_responses: observations.reduce((s,o)=>s+o.raw_response_count,0), mismatched_observations: observations.filter(o=>!o.matched).length }, observations, remaining: cases.filter(c=>!observations.some(o=>o.case_id===c.id)).map(c=>c.id), running_processes_owned: [], no_new_api_in_verifier: true, checks: { input_and_qa_unchanged: true, source_and_16_code_hashes_unchanged: true, request_schema_and_quote_grounding_verified: true, rescore_verified: true, formal_semantic_or_publication: false }, limitation: '모델명은 production 요청의 명시적 gpt-5.6-terra 설정이다. 공급자 응답의 세부 버전 메타데이터는 현재 trace에 없으며 별도 식별을 주장하지 않는다.' };
  const resultFile = `${own}/results.json`;
  fs.writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ ...desc(resultFile), status: result.status, counts: result.counts }));
}
