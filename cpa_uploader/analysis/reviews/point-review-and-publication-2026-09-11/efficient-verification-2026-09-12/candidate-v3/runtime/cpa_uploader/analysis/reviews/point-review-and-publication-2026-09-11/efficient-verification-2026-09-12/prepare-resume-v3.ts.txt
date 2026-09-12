import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import { sha256 } from '../../../../questionReviewIdentity.ts';
import { createEfficientValidationContext, validateReusableEfficientObservation, assertEfficientEvidenceUnchanged } from '../../../../questionEfficientReview.ts';
import type { AgentSetReview, ReviewFile } from '../../../../questionEfficientReview.ts';
import type { EfficientManifest, EfficientObservation, ExpectedSubquestion } from './b/contract.ts';

const root = process.cwd(), here = path.dirname(fileURLToPath(import.meta.url));
const rel = (file: string) => path.relative(root, path.resolve(file)).replace(/\\/g, '/');
const identity = (file: string): ReviewFile => ({ file: rel(file), sha256: sha256(fs.readFileSync(file)) });
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const oldDirectory = path.join(here, 'candidate-v1'), output = path.join(here, 'candidate-v3');
assert(!fs.existsSync(output), 'Use a fresh resume directory');
const oldManifestFile = identity(path.join(oldDirectory, 'grading-manifest.json'));
assert.equal(oldManifestFile.sha256, '5920ef24babb0fb11a83322f280da66282a33b11f02ad7f87a3d6ebce62fce99');
const previous = read<EfficientManifest>(oldManifestFile.file), manifest = structuredClone(previous);
const inputs = new Map(previous.inputs.map(i => [i.file, i]));
const add = (file: string) => {
    const id = identity(file), prior = inputs.get(id.file); assert(!prior || prior.sha256 === id.sha256);
    inputs.set(id.file, id); return id;
};
for (const input of inputs.values()) assert.equal(identity(input.file).sha256, input.sha256);
add(oldManifestFile.file); add(path.join(here, 'execution-lock.json')); add(path.join(here, 'run-v1/STOP.json'));
const correctionFolder = path.join(here, 'a/expectation-correction-v2');
const correctedQA = add(path.join(correctionFolder, 'pilot-02-007-sub2-partial.json'));
const correctionProof = add(path.join(correctionFolder, 'review-supplement.json'));
const correction = read<{ entries?: unknown[]; cases: { id: string; subquestion_id: string; answer: string; expected_points: number; expected_verdicts: ExpectedSubquestion['expected_verdicts'] }[] }>(correctedQA.file).cases[0];
const changedId = 'pilot-02-007--case--partial', changed = manifest.entries.find(e => e.id === changedId)!;
assert.equal(correction.subquestion_id, 'sub2'); assert.equal(correction.answer, changed.answers.sub2); assert.equal(correction.expected_points, 1);
changed.expected_by_subquestion = changed.expected_by_subquestion.map(e => e.subquestion_id === 'sub2'
    ? { subquestion_id: 'sub2', expected_points: correction.expected_points, expected_verdicts: correction.expected_verdicts } : e);
changed.selection_evidence = changed.selection_evidence.map(e => e.subquestion_id === 'sub2'
    ? { ...e, ...correctedQA, case_id: correction.id, reason: '공식 A53 및 판단·이유 분리 계약에 따라 판단만 쓴 원답안은 1점으로 정정했다. 원 2점 기대·실측은 보존하고 새 기대표로 한 차례 표적 검사한다.' } : e);
for (const entry of manifest.entries.filter(e => e.id !== changedId))
    assert.equal(contentHash(entry), contentHash(previous.entries.find(e => e.id === entry.id)));
manifest.reused_observations = [];
const excluded: ReviewFile[] = [];
let originalCalls = 0, originalUsd = 0;
for (const worker of ['a', 'b', 'c'] as const) {
    const directory = path.join(here, 'run-v1', 'worker-' + worker);
    const summaryId = add(path.join(directory, 'summary.json')); add(path.join(directory, 'preflight.json'));
    const summary = read<{ worker: string; completed_observations: number; actual_sdk_calls: number; usd: number; rows: { id: string; observation?: ReviewFile; error?: unknown }[] }>(summaryId.file);
    assert.equal(summary.worker, worker); assert(summary.rows.every(row => row.observation && !row.error));
    assert.equal(summary.completed_observations, summary.rows.length); originalCalls += summary.actual_sdk_calls; originalUsd += summary.usd;
    for (const row of summary.rows) {
        const observation = row.observation!; assert.equal(identity(observation.file).sha256, observation.sha256); add(observation.file);
        const obs = read<EfficientObservation>(observation.file); assert.equal(obs.entry_id, row.id);
        for (const file of Object.values(obs.files)) { assert.equal(identity(file.file).sha256, file.sha256); add(file.file); }
        add(path.join(path.dirname(observation.file), 'usage.jsonl'));
        if (row.id === changedId) excluded.push(observation);
        else manifest.reused_observations.push({ entry_id: row.id, worker, observation, origin_manifest: oldManifestFile });
    }
}
assert.equal(originalCalls, 67); assert.equal(excluded.length, 1); assert.equal(manifest.reused_observations.length, 66);
const reviews = read<AgentSetReview[]>(path.join(oldDirectory, 'agent-reviews.json'));
const reviewed = reviews.find(r => r.set_id === 'pilot-02-007')!;
reviewed.evidence.push(correctionProof, correctedQA);
reviewed.reviewed_at = read<{ reviewed_at: string }>(correctionProof.file).reviewed_at;
reviewed.questions.find(q => q.subquestion_id === 'sub2')!.rationale += ' 후속 원문 대조에서 판단만 서술한 대표 부분답안의 이유 점수를 제거하여 기대2점을1점으로 정정했다. 문항·모범답안·물음3점 배점은 유지하고 원 QA와 실측은 보존한다.';
const policy = read<Record<string, unknown>>(previous.policy.file);
policy.execution_version = 'question-verification-2026-09-12-efficient-002';
policy.prior_execution = oldManifestFile;
policy.resume_reason = 'SDK 비열거 요청 헤더의 명시 기록 및 원응답 재사용 계약. 실제 채점 입력·모델·엔진은 동일하며 QA 기대 정정1건만 새 기준으로 표적 검사한다.';
fs.mkdirSync(output);
const write = (name: string, value: unknown) => {
    const file = path.join(output, name); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return add(file);
};
for (const name of ['candidate-authoring.json', 'classification-review.json', 'learning-question-classifications.json', 'point-reviews.json', 'target-scope.json']) {
    fs.copyFileSync(path.join(oldDirectory, name), path.join(output, name), fs.constants.COPYFILE_EXCL);
    add(path.join(output, name));
}
write('agent-reviews.json', reviews);
manifest.policy = write('policy.json', policy);
const codeFiles = [...new Set([...previous.code_files.map(c => c.file), rel(fileURLToPath(import.meta.url)), rel(path.join(here, 'b/seal-results.ts'))])];
manifest.code_files = codeFiles.map(identity);
const runtime = manifest.code_files.map(code => {
    const target = path.join(output, 'runtime', code.file + '.txt'); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.resolve(root, code.file), target, fs.constants.COPYFILE_EXCL);
    const saved = identity(target); assert.equal(saved.sha256, code.sha256); return { ...saved, runtime_file: code.file };
});
write('runtime-snapshots.json', runtime);
manifest.inputs = [...inputs.values()];
const manifestId = write('grading-manifest.json', manifest);
const context = createEfficientValidationContext();
for (const reuse of manifest.reused_observations) validateReusableEfficientObservation(reuse, manifest, context);
assertEfficientEvidenceUnchanged(context);
for (const file of [...manifest.inputs, ...manifest.code_files]) assert.equal(identity(file.file).sha256, file.sha256);
write('summary.json', { execution_version: policy.execution_version, status: 'prepared_not_completed', manifest: manifestId,
    selected_sets: reviews.length, selected_questions: reviews.reduce((n, r) => n + r.questions.length, 0),
    planned_requests: manifest.entries.length, reused_observations: manifest.reused_observations.length,
    new_requests: manifest.entries.length - manifest.reused_observations.length, original_calls: originalCalls, original_usd: originalUsd,
    excluded_prior_observations: excluded, exclusion_reason: 'Expectation corrected from source; old observation and old expectation preserved. One targeted current-benchmark check is planned.',
    api_calls_by_preparer: 0, db_writes: 0 });
console.log(JSON.stringify({ output: rel(output), manifest: manifestId, reused: manifest.reused_observations.length,
    new_requests: manifest.entries.length - manifest.reused_observations.length, original_usd: originalUsd, api_calls: 0 }));
