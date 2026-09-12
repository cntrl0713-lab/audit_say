import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../../lib/questionV3Grading.ts';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const out = `${D}/c/resume-review-2026-09-12/semantic-case-contract-proposal-v1`;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const runtimeFile = `${D}/execution-runtime-v7.json`;
assert.equal(fileSha(runtimeFile), '17e99d1dff7f6ecaba48658796788be0b1f47b03364cc23c348932474d18a250');
const runtime = json(runtimeFile);
for (const entry of runtime.code_files) assert.equal(fileSha(entry.file), entry.sha256);
const manifestFile = `${D}/execution-resumes/resume-2026-09-12-v3/canary/manifest.json`;
const manifest = json(manifestFile);
assert.equal(fileSha(manifestFile), 'dc2deafcd2804c55054ddbb7e405b3439ceef9de883a9ba59f5ee8f281e54452');
const banks = [`${D}/prepared-reviewed-v7/candidate-authoring.json`, `${D}/c/prepared-reviewed-v8/candidate-authoring.json`].map(file => ({ file, sha256: fileSha(file), sets: json(file) }));
const requested = [
  ['a', 'pilot-01-002', 'a/canary-plan-followup-v1/qa-pilot-01-002.json', 'followup/sub2/positive-withdrawal-action-omitted', 35],
  ['b-purpose', 'pilot-05-003', 'b/canary-followup-v2/qa-pilot-05-003.json', 'pilot-05-003-sub2-omit-crit7', 37],
  ['b-time', 'pilot-05-003', 'b/canary-followup-v2/qa-pilot-05-003.json', 'pilot-05-003-sub1-identification-time-not-communication-time-preserved', 37],
];
const jobs = requested.map(([label, setId, qaPath, caseId, count]) => {
  const job = manifest.jobs.find(j => j.set_id === setId);
  assert(job);
  assert.equal(fileSha(job.file), job.sha256);
  const value = json(job.file);
  const set = Array.isArray(value) ? value[0] : value;
  for (const bank of banks) assert.deepEqual(bank.sets.find(s => s.id === setId), set);
  const qaFile = `${D}/${qaPath}`;
  const qa = json(qaFile);
  assert.equal(qa.cases.length, count);
  const test = qa.cases.find(c => c.id === caseId);
  assert(test && test.answer.trim());
  const q = set.subquestions.find(q => q.id === test.subquestion_id);
  assert.equal(test.expected_verdicts.length, q.criteria.length);
  const expectedSum = test.expected_verdicts.reduce((sum, v) => sum + (v.verdict === 'met' ? q.criteria.find(c => c.id === v.criterion_id).scores.met : 0), 0);
  assert.equal(expectedSum, test.expected_points);
  const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
  const requestHash = sha(buildGradingPrompt(set, answers));
  const schemaHash = sha(JSON.stringify(buildGradingResponseSchema(set, answers)));
  for (const bank of banks) {
    const otherSet = bank.sets.find(s => s.id === setId);
    assert.equal(sha(buildGradingPrompt(otherSet, answers)), requestHash);
    assert.equal(sha(JSON.stringify(buildGradingResponseSchema(otherSet, answers))), schemaHash);
  }
  return { label, set_id: setId, file: job.file, file_sha256: job.sha256, qa_file: qaFile, qa_sha256: fileSha(qaFile), case_id: caseId, expected: test, answers, request_hash: requestHash, schema_hash: schemaHash, v7_v8_set_json_bytes_equal: true, v7_v8_grading_request_and_schema_equal: true, outputs: [1, 2, 3].map(round => `cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/grading-inference-followup-v2/c/${label}-round-${round}`) };
});
const result = { version: 1, status: 'preflight_pass_api0', runtime: { file: runtimeFile, sha256: fileSha(runtimeFile) }, manifest: { file: manifestFile, sha256: fileSha(manifestFile) }, banks: banks.map(({file,sha256})=>({file,sha256})), jobs, errors: [], notes: ['R3 문항파일은 그 파일 SHA와 일치하고, A/B 문항 객체의 JSON 바이트는 v7/v8 은행 추출과 동일하다. 전체 은행 SHA 동일 주장 아님.', 'current grader 지침을 적용한 v7/v8 입력과 schema가 동일하다. runtime-v6의 과거 요청 해시와 현재 요청 해시 동일 주장 아님.'] };
const outputFile = `${out}/early-regression-preflight.json`;
if (!fs.existsSync(outputFile)) {
  for (const job of jobs) for (const output of job.outputs) assert(!fs.existsSync(output));
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
} else assert.deepEqual(json(outputFile), result);
console.log(JSON.stringify({ status: result.status, file: outputFile, sha256: fileSha(outputFile), jobs: jobs.length }));
