import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

globalThis.fetch = async () => { throw Error('Local evidence verification only'); };
const local = file => import(pathToFileURL(path.resolve(file)).href);
const { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema } = await local('lib/questionV3Grading.ts');
const { prepareSemanticReview, buildReviewChunkInput, reviewChunkSchema, groundReviewChunk } = await local('cpa_uploader/questionSemanticReview.ts');
const { jsonHash } = await local('cpa_uploader/questionReviewIdentity.ts');
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const R = `${D}/execution-resumes/resume-2026-09-12-v4`, out = `${D}/a/resume-review-2026-09-12/r4`;
const Q = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4/canary/author-qa-a/pilot-01-002/author-qa';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const lines = file => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const sha = value => createHash('sha256').update(value).digest('hex');
const id = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const frozen = read(`${R}/frozen-inputs.json`);
const verifyFrozen = () => { for (const x of frozen.files) assert.equal(id(x.file).sha256, x.sha256, x.file); };
verifyFrozen();
const manifest = read(`${R}/canary/manifest.json`), job = manifest.jobs.find(j => j.worker === 'a');
assert.equal(job.set_id, 'pilot-01-002');
const set = read(job.file), bank = read(manifest.bank_file), plan = read(job.plan_file), qa = read(job.qa_file);
const semFile = `${R}/canary/semantic-a/pilot-01-002/semantic.json`, gradeFile = `${R}/canary/grading-a/pilot-01-002/grading.json`;
const sem = read(semFile).reviews[0], grade = read(gradeFile).reviews[0];
assert.equal(sem.verdict, 'pass'); assert.equal(sem.execution.transport, 'model'); assert.equal(sem.execution.model, 'gpt-5.6-luna');
const prepared = prepareSemanticReview(set, { bank, authoringPlan: plan, maxInputChars: 500000 });
const semRows = lines(`${semFile}.chunks.jsonl`);
assert.equal(semRows.length, 11);
for (const row of semRows) {
    const unit = prepared.units.find(u => u.id === row.unit_id); assert(unit);
    assert.equal(row.attempt, 1); assert.equal(row.transport, 'model'); assert.equal(row.model, 'gpt-5.6-luna'); assert(!row.error);
    assert.equal(row.input_hash, sha(buildReviewChunkInput(prepared, unit))); assert.equal(row.schema_hash, jsonHash(reviewChunkSchema(unit)));
    groundReviewChunk(row.response, prepared, unit);
}
const grading = lines(`${gradeFile}.grading.jsonl`); assert.equal(grading.length, 39); assert.equal(grade.grading.runs.length, 39);
let gradeResponses = 0, qaResponses = 0, rawSecurity = 0, traceErrors = 0;
const hasSecurity = judgment => !!judgment?.injection_detected || !!judgment?.salad_detected
    || !!judgment?.subquestions.some(q => q.injection_detected || q.salad_detected);
for (const row of grading) {
    assert.equal(row.status, 'completed'); assert.equal(row.model, 'gpt-5.6-luna');
    if (Object.values(row.answers).some(answer => answer.trim())) assert.deepEqual(applyQuestionSetJudgment(set, row.answers, row.judgment), row.result);
    else { assert.equal(row.judgment, null); assert.equal(row.result.score, 0); assert.equal(row.trace.length, 0); }
    gradeResponses += row.trace.filter(t => t.response).length; traceErrors += row.trace.filter(t => t.error).length;
    if (hasSecurity(row.judgment) || row.result.security_flag !== 'none') rawSecurity++;
}
const mismatches = grading.filter(r => !r.matched); assert.equal(mismatches.length, 1);
const tolerance = read(`${out}/canary-generated-tolerance-bound-review.json`);
assert.equal(mismatches[0].id, tolerance.run_id); assert.equal(tolerance.strict_match, false);
assert.equal(tolerance.acceptance, 'accepted_with_grading_deviation');
for (const q of tolerance.subquestions) {
    assert.equal(mismatches[0].result.subquestions.find(s => s.subquestion_id === q.subquestion_id).score, q.actual);
    assert(Math.max(Math.abs(q.actual - q.expected_min), Math.abs(q.actual - q.expected_max)) <= 1);
}
const inputs = read(`${Q}/inputs.json`), summary = read(`${Q}/summary.json`);
assert.deepEqual(inputs.question_set, set); assert.deepEqual(inputs.qa, qa); assert.equal(inputs.model, 'gpt-5.6-luna'); assert.equal(inputs.mock, false);
for (const [file, hash] of Object.entries(inputs.hashes)) assert.equal(id(file).sha256, hash);
assert.deepEqual([summary.planned_cases, summary.recorded_cases, summary.actual_attempts], [35, 35, 35]);
assert.deepEqual(summary.mismatched_case_ids, []); assert.deepEqual(summary.changed_inputs, []); assert.equal(summary.stopped_on_execution_error, false);
const qaFiles = [];
for (const ref of summary.records) {
    const file = `${Q}/${ref.file}`, row = read(file), test = qa.cases.find(c => c.id === row.case_id); assert(test);
    assert.deepEqual(row.expected, test); assert(row.matched); assert.equal(row.attempt, 1); assert.equal(row.model, 'gpt-5.6-luna');
    const answers = Object.fromEntries(set.subquestions.map(s => [s.id, s.id === test.subquestion_id ? test.answer : '']));
    assert.deepEqual(row.answers, answers); assert.equal(row.request_hash, sha(buildGradingPrompt(set, answers)));
    assert.equal(row.schema_hash, sha(JSON.stringify(buildGradingResponseSchema(set, answers))));
    assert.deepEqual(row.exact_verdict_differences, []); assert.equal(row.result.score, test.expected_points);
    if (test.answer.trim()) assert.deepEqual(applyQuestionSetJudgment(set, answers, row.raw_judgment), row.result);
    else { assert.equal(row.raw_judgment, null); assert.equal(row.trace.length, 0); assert.equal(row.result.score, 0); }
    qaResponses += row.trace.filter(t => t.response).length; traceErrors += row.trace.filter(t => t.error).length;
    if (hasSecurity(row.raw_judgment) || row.result.security_flag !== 'none') rawSecurity++;
    qaFiles.push(id(file));
}
assert.deepEqual([gradeResponses, qaResponses, traceErrors, rawSecurity], [38, 33, 0, 0]); verifyFrozen();
const report = { created_at: new Date().toISOString(), set_id: set.id, model: 'gpt-5.6-luna', local_verification_api_calls: 0,
    semantic: { units: 11, cases: 45, verdict: 'pass', actual_responses: 11, receipt: id(semFile), raw: id(`${semFile}.chunks.jsonl`) },
    generated_grading: { unique_runs: 39, strict_matches: 38, accepted_with_grading_deviation: 1, strict_mismatches_preserved: 1,
        actual_model_responses: 38, empty_without_model: 1, receipt: id(gradeFile), raw: id(`${gradeFile}.grading.jsonl`), tolerance_review: id(`${out}/canary-generated-tolerance-bound-review.json`) },
    author_qa: { unique_cases: 35, observations: 35, strict_matches: 35, actual_model_responses: 33, empty_without_model: 2,
        summary: id(`${Q}/summary.json`), inputs: id(`${Q}/inputs.json`), raw_files: qaFiles },
    successful_model_responses: 82, additional_diagnostic_calls: 0, trace_error_events: 0, raw_or_final_security_events: 0,
    frozen_inputs_unchanged: frozen.files.length, original_question_qa_expected_receipts_changed: false,
    remaining: { sets: 38, semantic_units: 457, status: 'running_separate_production_worker', grading_and_author_qa: 'not_started' },
    human_confirmation: false, db_publication: false };
fs.writeFileSync(`${out}/canary-completed.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(id(`${out}/canary-completed.json`)));
