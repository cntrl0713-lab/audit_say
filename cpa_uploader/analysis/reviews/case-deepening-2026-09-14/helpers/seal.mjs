import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEfficientReviewReceipt, createEfficientValidationContext, assertEfficientEvidenceUnchanged} from '../../../../questionEfficientReview.ts';

const R = 'cpa_uploader/analysis/reviews/case-deepening-2026-09-14';
const read = file => JSON.parse(fs.readFileSync(file));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = file => ({file, sha256: hash(fs.readFileSync(file))});
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index], value = process.argv[index + 1];
  assert(['--execution', '--output', '--prior-executions'].includes(key) && !args.has(key) && value && !value.startsWith('--'), 'Unknown/duplicate/incomplete argument');
  args.set(key, value);
}
const safeDirectory = name => {
  assert(/^[a-zA-Z0-9-]+$/.test(name), 'Directory must be a direct child of this batch');
  return R + '/' + name;
};
const execution = safeDirectory(args.get('--execution') ?? 'execution-v1');
const out = safeDirectory(args.get('--output') ?? 'sealed-v1');
const prior = (args.get('--prior-executions') ?? '').split(',').filter(Boolean).map(safeDirectory);
assert.equal(new Set([execution, ...prior]).size, 1 + prior.length, 'Duplicate execution would double count costs');
assert(!fs.existsSync(out), 'Do not overwrite previous seal evidence');
const manifestFile = execution + '/grading-manifest.json', manifest = read(manifestFile);
const workers = [...new Set(manifest.entries.map(entry => entry.worker))];
assert(workers.every(worker => ['a', 'b', 'c'].includes(worker)));
const reviewsFiles = manifest.inputs.filter(input => /\/agent-reviews\.json$/.test(input.file));
assert.equal(reviewsFiles.length, 1, 'Manifest must identify one authoritative agent review ledger');
assert.equal(ref(reviewsFiles[0].file).sha256, reviewsFiles[0].sha256);
const runtimeFile = execution + '/runtime-snapshots.json';
assert(manifest.inputs.some(input => input.file === runtimeFile && input.sha256 === ref(runtimeFile).sha256), 'Current execution must register its own runtime snapshot index');

const observations = [], all = [], summaries = [];
for (const worker of workers) {
  const summaryFile = execution + '/actual-' + worker + '/summary.json', summary = read(summaryFile);
  assert.equal(summary.status, 'completed'); assert.equal(summary.frozen_input_error, null);
  assert.deepEqual(summary.remaining_entry_ids, []);
  const entries = manifest.entries.filter(entry => entry.worker === worker);
  assert.deepEqual(summary.rows.map(row => row.id).sort(), entries.map(entry => entry.id).sort(), 'Every fixed request must be completed exactly once');
  for (const row of summary.rows) {
    assert(row.observation && !row.error);
    assert.equal(ref(row.observation.file).sha256, row.observation.sha256);
    const observation = read(row.observation.file);
    assert.equal(observation.entry_id, row.id);
    assert.deepEqual(observation.security_findings, [], 'Security/shape failures cannot be accepted as scoring deviations');
    observations.push(row.observation); all.push(observation);
  }
  summaries.push({worker, ...ref(summaryFile)});
}
assert.equal(observations.length, manifest.entries.length);
assert.equal(new Set(observations.map(observation => observation.file)).size, observations.length);
const scores = all.flatMap(observation => observation.subquestions.filter(question => question.evaluated).map(question => ({entry_id: observation.entry_id, source_set_id: observation.source_set_id, kind: observation.kind, ...question})));
const outside = scores.filter(question => !question.within_tolerance);
const findingsFile = R + '/residual-findings-v1.json', findings = fs.existsSync(findingsFile) ? read(findingsFile) : [];
assert.equal(outside.length, findings.length, 'Investigate every outside-tolerance result');
assert.deepEqual(findings.map(finding => `${finding.entry_id}/${finding.subquestion_id}/${finding.delta}`).sort(),
  outside.map(question => `${question.entry_id}/${question.subquestion_id}/${question.delta}`).sort(), 'Findings must match exact observations');

const accountingDirectories = [...prior, execution];
const executionSummaries = accountingDirectories.flatMap(directory => {
  const originalManifest = read(directory + '/grading-manifest.json');
  return [...new Set(originalManifest.entries.map(entry => entry.worker))].map(worker => {
    const file = directory + '/actual-' + worker + '/summary.json';
    return {file, value: read(file)};
  });
});
const accountedObservationPaths = new Set(executionSummaries.flatMap(summary => summary.value.rows.filter(row => row.observation && !row.reused).map(row => path.resolve(row.observation.file))));
for (const observation of observations) assert(accountedObservationPaths.has(path.resolve(observation.file)), 'Supply every originating execution via --prior-executions; original calls cannot be omitted');
const usage = executionSummaries.flatMap(summary => summary.value.new_usage);
assert(usage.every(event => event && event.provider && event.cost));
const actualCalls = executionSummaries.reduce((sum, summary) => {
  assert(Number.isSafeInteger(summary.value.actual_sdk_calls) && summary.value.actual_sdk_calls >= 0);
  return sum + summary.value.actual_sdk_calls;
}, 0);
const unknown = usage.filter(event => event.cost.status === 'unknown').length;
const bounded = usage.filter(event => event.cost.status === 'bounded_missing_cache_write').length;
const unaccounted = actualCalls - usage.length; assert(unaccounted >= 0);
const knownCost = unknown === 0 && bounded === 0 && unaccounted === 0;
const accounting = {actual_sdk_calls: actualCalls, requests_without_returned_usage: unaccounted,
  unknown_cost_responses: unknown, bounded_cost_responses: bounded,
  provider_token_totals: Object.fromEntries(['input_tokens', 'output_tokens', 'total_tokens'].map(key => [key,
    usage.every(event => Number.isSafeInteger(event.provider.usage?.[key])) ? usage.reduce((sum, event) => sum + event.provider.usage[key], 0) : null])),
  accounted_min_usd: unknown ? null : usage.reduce((sum, event) => sum + event.cost.min_usd, 0),
  accounted_max_usd: unknown ? null : usage.reduce((sum, event) => sum + event.cost.max_usd, 0)};

fs.mkdirSync(out);
const batch = {version: 1, artifact_type: 'cost_controlled_review_batch', created_at: new Date().toISOString(),
  authorization: {evidence: ref(R + '/authorization.md'), agent_review_and_representative_grading: true, production_publication: true},
  grading_manifest: ref(manifestFile), observations, agent_reviews: read(reviewsFiles[0].file),
  runtime_snapshots: read(runtimeFile), residual_grading_findings: findings};
write(out + '/batch.json', batch);
const context = createEfficientValidationContext(), bank = read(manifest.bank.file);
const receipts = batch.agent_reviews.map(review => createEfficientReviewReceipt(ref(out + '/batch.json'), bank.find(set => set.id === review.set_id), context));
assertEfficientEvidenceUnchanged(context);
write(out + '/receipts.json', receipts);
write(out + '/summary.json', {created_at: new Date().toISOString(), status: 'passed', target_sets: receipts.length,
  target_questions: batch.agent_reviews.reduce((sum, review) => sum + review.questions.length, 0), requests: all.length,
  actual_sdk_calls: actualCalls, successful_observation_sdk_calls: all.reduce((sum, observation) => sum + observation.actual_sdk_calls, 0),
  execution_summaries: executionSummaries.map(summary => ref(summary.file)), reused_observations: manifest.reused_observations?.length ?? 0,
  fixed_evaluated_answers: scores.length, exact_score_matches: scores.filter(question => question.delta === 0).length,
  within_tolerance: scores.filter(question => question.within_tolerance).length,
  within_tolerance_ratio: scores.filter(question => question.within_tolerance).length / scores.length,
  outside_tolerance: outside, scores, usage, known_cost: knownCost,
  estimated_cost_usd: knownCost ? usage.reduce((sum, event) => sum + event.cost.usd, 0) : null, accounting,
  budget_usd: manifest.budget_usd, budget_enforcement: manifest.budget_enforcement,
  new_model_semantic_review_calls: 0, statistical_confidence_claim: false, human_review_performed: false, run_summaries: summaries});
write(out + '/readiness.json', {ready: true, errors: [], batch: ref(out + '/batch.json'), receipt_count: receipts.length,
  validated_at: new Date().toISOString(), validated_files: [...context.files].map(([file, sha256]) => ({file, sha256})),
  accounting_evidence: executionSummaries.map(summary => ref(summary.file)), canonical_writes: 0, db_writes: 0, model_api_calls: 0});
console.log(JSON.stringify({ready: true, receipts: receipts.length, evaluated: scores.length,
  exact: scores.filter(question => question.delta === 0).length, within: scores.filter(question => question.within_tolerance).length,
  actual_sdk_calls: actualCalls, known_cost: knownCost, output: out}, null, 2));
