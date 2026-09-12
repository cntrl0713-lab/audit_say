import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import { sha256 } from '../../../../questionReviewIdentity.ts';
import { createEfficientValidationContext, validateReusableEfficientObservation, assertEfficientEvidenceUnchanged } from '../../../../questionEfficientReview.ts';
import type { AgentSetReview, ReviewFile } from '../../../../questionEfficientReview.ts';
import type { EfficientManifest, EfficientObservation, ExpectedSubquestion } from './b/contract.ts';

// Run only after all execution-002 workers end and the reviewed recorder patch is installed.
// This helper performs no model or database call and never rewrites an earlier artifact.
const root = process.cwd(), here = path.dirname(fileURLToPath(import.meta.url));
const relative = (file: string) => path.relative(root, path.resolve(file)).replaceAll('\\', '/');
const identity = (file: string): ReviewFile => ({ file: relative(file), sha256: sha256(fs.readFileSync(file)) });
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const previousDirectory = path.join(here, 'candidate-v3'), output = path.join(here, 'candidate-v4');
assert(!fs.existsSync(output), 'Use a fresh final candidate directory');
const previousManifest = identity(path.join(previousDirectory, 'grading-manifest.json'));
assert.equal(previousManifest.sha256, 'd1a7509a18076bfc776b8092877dcc0686b06c209f8d0741347d5aedf6dafc4c');
const previous = read<EfficientManifest>(previousManifest.file), manifest = structuredClone(previous);
const inputs = new Map(previous.inputs.map(i => [i.file, i]));
const add = (file: string) => {
    const id = identity(file), before = inputs.get(id.file); assert(!before || before.sha256 === id.sha256);
    inputs.set(id.file, id); return id;
};
for (const input of inputs.values()) assert.equal(identity(input.file).sha256, input.sha256);
add(previousManifest.file); add(path.join(here, 'execution-lock-v2.json'));
const correctionsFile = add(path.join(here, 'final-corrections.json'));
interface Correction { entry_id: string; subquestion_id: string; qa: ReviewFile; evidence: ReviewFile[]; rationale: string; reviewed_at: string }
const corrections = read<Correction[]>(correctionsFile.file), changedIds = new Set<string>();
assert(corrections.length > 0);
const reviews = read<AgentSetReview[]>(path.join(previousDirectory, 'agent-reviews.json'));
for (const correction of corrections) {
    assert(!changedIds.has(correction.entry_id)); changedIds.add(correction.entry_id);
    assert(correction.rationale.trim() && correction.reviewed_at && correction.evidence.length > 0);
    for (const ref of [correction.qa, ...correction.evidence]) assert.deepEqual(add(ref.file), ref);
    const entry = manifest.entries.find(e => e.id === correction.entry_id); assert(entry && entry.kind === 'partial');
    const qa = read<{ cases: { id: string; subquestion_id: string; answer: string; expected_points: number; expected_verdicts: ExpectedSubquestion['expected_verdicts'] }[] }>(correction.qa.file);
    assert.equal(qa.cases.length, 1); const chosen = qa.cases[0];
    assert.equal(chosen.subquestion_id, correction.subquestion_id); assert(entry.evaluated_subquestion_ids.includes(chosen.subquestion_id));
    entry.answers[chosen.subquestion_id] = chosen.answer;
    entry.expected_by_subquestion = entry.expected_by_subquestion.map(e => e.subquestion_id === chosen.subquestion_id
        ? { subquestion_id: chosen.subquestion_id, expected_points: chosen.expected_points, expected_verdicts: chosen.expected_verdicts } : e);
    entry.selection_evidence = entry.selection_evidence.map(e => e.subquestion_id === chosen.subquestion_id
        ? { ...e, ...correction.qa, case_id: chosen.id, reason: correction.rationale } : e);
    const review = reviews.find(r => r.set_id === entry.source_set_id); assert(review);
    review.evidence.push(correction.qa, ...correction.evidence); review.reviewed_at = correction.reviewed_at;
    const question = review.questions.find(q => q.subquestion_id === chosen.subquestion_id); assert(question);
    question.rationale += ' 후속 QA 정정: ' + correction.rationale;
}
for (const entry of manifest.entries.filter(e => !changedIds.has(e.id)))
    assert.equal(contentHash(entry), contentHash(previous.entries.find(e => e.id === entry.id)));

manifest.reused_observations = [];
const excluded: ReviewFile[] = [], seen = new Set<string>();
let priorNewCalls = 0, priorNewUsd = 0;
for (const worker of ['a', 'b', 'c'] as const) {
    const directory = path.join(here, 'run-v2', 'worker-' + worker);
    const summaryRef = add(path.join(directory, 'summary.json')); add(path.join(directory, 'preflight.json'));
    const summary = read<{ status: string; worker: string; selected_entries: number; completed_observations: number; actual_sdk_calls: number; usd: number;
        unknown_cost_count?: number; frozen_input_error: unknown; rows: { id: string; observation?: ReviewFile; error?: unknown }[] }>(summaryRef.file);
    assert.equal(summary.status, 'completed'); assert.equal(summary.worker, worker); assert.equal(summary.frozen_input_error, null);
    assert.equal(summary.selected_entries, summary.completed_observations); assert.equal(summary.completed_observations, summary.rows.length);
    assert(Number.isFinite(summary.usd), 'Prior actual cost must be known before final accounting');
    priorNewCalls += summary.actual_sdk_calls; priorNewUsd += summary.usd;
    for (const row of summary.rows) {
        assert(row.observation && !row.error); assert(!seen.has(row.id)); seen.add(row.id);
        const reference = row.observation; assert.deepEqual(add(reference.file), reference);
        const observation = read<EfficientObservation>(reference.file); assert.equal(observation.entry_id, row.id);
        for (const ref of Object.values(observation.files)) assert.deepEqual(add(ref.file), ref);
        add(path.join(path.dirname(reference.file), 'usage.jsonl'));
        assert.deepEqual(add(observation.manifest.file), observation.manifest);
        if (changedIds.has(row.id)) excluded.push(reference);
        else manifest.reused_observations.push({ entry_id: row.id, worker, observation: reference, origin_manifest: observation.manifest });
    }
}
assert.deepEqual([...seen].sort(), manifest.entries.map(e => e.id).sort());
assert.equal(excluded.length, changedIds.size);
assert.equal(manifest.reused_observations.length + changedIds.size, manifest.entries.length);
const policy = read<Record<string, unknown>>(previous.policy.file);
policy.execution_version = 'question-verification-2026-09-12-efficient-003';
policy.prior_execution = previousManifest;
policy.resume_reason = '원문에 따른 대표 QA 정정의 표적 검사. 불변 원응답은 원 manifest에 연결하고 모델·판정 입력·엔진의 동일성을 확인해 재사용한다.';
fs.mkdirSync(output);
const write = (name: string, value: unknown) => {
    const file = path.join(output, name); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return add(file);
};
for (const name of ['candidate-authoring.json', 'classification-review.json', 'learning-question-classifications.json', 'point-reviews.json', 'target-scope.json']) {
    fs.copyFileSync(path.join(previousDirectory, name), path.join(output, name), fs.constants.COPYFILE_EXCL); add(path.join(output, name));
}
write('agent-reviews.json', reviews); manifest.policy = write('policy.json', policy);
manifest.code_files = [...new Set([...previous.code_files.map(c => c.file), relative(fileURLToPath(import.meta.url))])].map(identity);
const runtime = manifest.code_files.map(code => {
    const target = path.join(output, 'runtime', code.file + '.txt'); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.resolve(root, code.file), target, fs.constants.COPYFILE_EXCL);
    const saved = identity(target); assert.equal(saved.sha256, code.sha256); return { ...saved, runtime_file: code.file };
});
write('runtime-snapshots.json', runtime); manifest.inputs = [...inputs.values()];
const manifestRef = write('grading-manifest.json', manifest), context = createEfficientValidationContext();
for (const reuse of manifest.reused_observations) validateReusableEfficientObservation(reuse, manifest, context);
assertEfficientEvidenceUnchanged(context);
for (const file of [...manifest.inputs, ...manifest.code_files]) assert.equal(identity(file.file).sha256, file.sha256);
const summary = { execution_version: policy.execution_version, status: 'prepared_not_completed', manifest: manifestRef,
    selected_sets: reviews.length, selected_questions: reviews.reduce((n, r) => n + r.questions.length, 0),
    planned_requests: manifest.entries.length, reused_observations: manifest.reused_observations.length, new_requests: changedIds.size,
    prior_run_001_calls: 67, prior_run_001_usd: .07273115, prior_run_002_new_calls: priorNewCalls, prior_run_002_new_usd: priorNewUsd,
    all_prior_actual_calls: 67 + priorNewCalls, all_prior_usd: .07273115 + priorNewUsd,
    excluded_prior_run_002_observations: excluded, corrections: correctionsFile, api_calls_by_preparer: 0, db_writes: 0 };
write('summary.json', summary); console.log(JSON.stringify(summary));
