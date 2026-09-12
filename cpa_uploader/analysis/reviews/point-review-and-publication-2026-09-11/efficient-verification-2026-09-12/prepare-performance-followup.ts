import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../../../questionReviewIdentity.ts';
import { createEfficientValidationContext, validateReusableEfficientObservation, assertEfficientEvidenceUnchanged } from '../../../../questionEfficientReview.ts';
import type { ReviewFile } from '../../../../questionEfficientReview.ts';
import type { EfficientManifest } from './b/contract.ts';

// Recorder performance follow-up only: no question, answer, expectation or API change.
const started = Date.now(), root = process.cwd(), here = path.dirname(fileURLToPath(import.meta.url));
const relative = (file: string) => path.relative(root, path.resolve(file)).replaceAll('\\', '/');
const identity = (file: string): ReviewFile => ({ file: relative(file), sha256: sha256(fs.readFileSync(file)) });
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const previousDirectory = path.join(here, 'candidate-v4'), output = path.join(here, 'candidate-v5');
assert(!fs.existsSync(output), 'Use a fresh follow-up directory');
const previousRef = identity(path.join(previousDirectory, 'grading-manifest.json'));
assert.equal(previousRef.sha256, '50287a7729405c6157c962ee30f58b683fb5b58cfcc93d299e20e854e8365d1c');
const previous = read<EfficientManifest>(previousRef.file), manifest = structuredClone(previous);
assert(!fs.existsSync(path.join(here, 'run-v3')), 'Execution003 must remain API-unexecuted for this preparation');
const dry = read<{ status: string; actual_sdk_calls: number }>(path.join(here, 'dry-run-v3/worker-a/summary.json'));
assert.equal(dry.status, 'dry_run_complete'); assert.equal(dry.actual_sdk_calls, 0);
const inputs = new Map(previous.inputs.map(ref => [ref.file, ref]));
const add = (file: string) => {
    const ref = identity(file), before = inputs.get(ref.file);
    assert(!before || before.sha256 === ref.sha256, 'Earlier evidence cannot be rewritten'); inputs.set(ref.file, ref); return ref;
};
for (const ref of inputs.values()) assert.equal(identity(ref.file).sha256, ref.sha256);
add(previousRef.file); add(path.join(previousDirectory, 'summary.json')); add(path.join(here, 'dry-run-v3/worker-a/summary.json'));
const evidence = add(path.join(here, 'followup-runtime-evidence.json'));
for (const ref of read<ReviewFile[]>(evidence.file)) assert.deepEqual(add(ref.file), ref);
const beforeCore = previous.code_files.find(ref => ref.file === 'cpa_uploader/questionEfficientReview.ts'); assert(beforeCore);
assert.notEqual(identity(beforeCore.file).sha256, beforeCore.sha256, 'A reviewed runtime change is required');
for (const ref of previous.code_files.filter(ref => ref.file !== beforeCore.file)) assert.equal(identity(ref.file).sha256, ref.sha256);
fs.mkdirSync(output);
const write = (name: string, value: unknown) => {
    const file = path.join(output, name); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return add(file);
};
for (const name of ['candidate-authoring.json', 'classification-review.json', 'learning-question-classifications.json', 'point-reviews.json', 'target-scope.json', 'agent-reviews.json']) {
    fs.copyFileSync(path.join(previousDirectory, name), path.join(output, name), fs.constants.COPYFILE_EXCL); add(path.join(output, name));
}
const policy = read<Record<string, unknown>>(previous.policy.file);
policy.execution_version = 'question-verification-2026-09-12-efficient-004';
policy.prior_execution = previousRef;
policy.resume_reason = '실제 검사 시간에 근거한 증거 재생 성능 보완. 동일 파일·동일 입력의 중복 처리만 줄이고 최초 SHA 검증과 최종 실제 바이트 검증을 유지한다. 문항·답안·기대점수와 735건 재사용·3건 신규 검사 계획은 동일하다.';
manifest.policy = write('policy.json', policy);
manifest.code_files = [...new Set([...previous.code_files.map(ref => ref.file), relative(fileURLToPath(import.meta.url))])].map(identity);
const runtime = manifest.code_files.map(ref => {
    const file = path.join(output, 'runtime', ref.file + '.txt'); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.resolve(root, ref.file), file, fs.constants.COPYFILE_EXCL);
    const archived = identity(file); assert.equal(archived.sha256, ref.sha256); return { ...archived, runtime_file: ref.file };
});
write('runtime-snapshots.json', runtime); manifest.inputs = [...inputs.values()];
assert.deepEqual(manifest.entries, previous.entries); assert.deepEqual(manifest.reused_observations, previous.reused_observations);
const manifestRef = write('grading-manifest.json', manifest), context = createEfficientValidationContext();
for (const reuse of manifest.reused_observations ?? []) validateReusableEfficientObservation(reuse, manifest, context);
assertEfficientEvidenceUnchanged(context);
for (const ref of [...manifest.inputs, ...manifest.code_files]) assert.equal(identity(ref.file).sha256, ref.sha256);
const priorSummary = read<Record<string, unknown>>(path.join(previousDirectory, 'summary.json'));
const summary = { ...priorSummary, execution_version: policy.execution_version, manifest: manifestRef,
    status: 'prepared_not_completed', prior_preparation: previousRef, prior_preparation_api_calls: 0,
    runtime_change: { before: beforeCore, after: identity(beforeCore.file), evidence }, elapsed_ms: Date.now() - started,
    api_calls_by_preparer: 0, db_writes: 0 };
write('summary.json', summary); console.log(JSON.stringify(summary));
