// Read-only evidence audit. It imports prompt builders and makes no API calls.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../../../lib/questionV3Grading.ts';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const base = 'cpa_uploader/drafts/delegated-authoring-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const fileSha = file => sha(fs.readFileSync(file));
const ensure = (condition, detail) => { if (!condition) throw Error(detail); };
const relative = file => path.relative(process.cwd(), path.resolve(file)).replaceAll('\\', '/');
const own = new Set(['N01', 'N06', 'S01', 'S05', 'S06']);
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--manifest', '--runtime-lock'].includes(process.argv[i]) || !process.argv[i + 1] || args[process.argv[i]]) throw Error('Explicit --manifest and --runtime-lock required');
  args[process.argv[i]] = process.argv[i + 1];
}
const manifestFile = args['--manifest'];
const lockFile = args['--runtime-lock'];
ensure(manifestFile && lockFile, 'Explicit manifest/runtime-lock required');
const lock = read(lockFile);
const manifest = read(manifestFile);
ensure(fileSha(manifestFile) === lock.manifest_sha256, 'Manifest differs from explicit lock');
const graderPaths = [
  'lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts',
  'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts',
  `${control}/run-author-qa.ts`,
];
const grader = lock.code_files.filter(row => graderPaths.includes(row.file));
ensure(grader.length === 6, 'Six grader input files required');
for (const row of grader) ensure(fileSha(row.file) === row.sha256, `Changed grader ${row.file}`);
ensure(gradingModelName() === lock.settings.grading_model, 'Current grading model differs');
const rows = [];
for (const entry of manifest.entries.filter(row => own.has(row.package))) {
  ensure(fileSha(entry.file) === entry.sha256, `Changed question ${entry.plan_id}`);
  ensure(fileSha(entry.qa_file) === entry.qa_sha256, `Changed selected QA ${entry.plan_id}`);
  for (const source of entry.source_files) ensure(fileSha(source.file) === source.sha256, `Changed source ${source.file}`);
  const document = read(entry.file);
  const set = Array.isArray(document) ? document[0] : document;
  const qa = read(entry.qa_file);
  const folders = [`${base}/${entry.package.toLowerCase()}/phase-two-v4/${entry.set_id}/author-qa-01`];
  if (entry.plan_id === 'T16-A') folders.push(`${base}/n06/phase-two-v4/pilot-16-010/grader-regression-01`);
  const records = [];
  const inputs = [];
  for (const folder of folders) {
    const summaryFile = `${folder}/summary.json`;
    const summary = read(summaryFile);
    const snapshotFile = `${folder}/inputs.json`;
    const snapshot = read(snapshotFile);
    ensure(!summary.stopped_on_execution_error && !summary.changed_inputs.length, `${entry.plan_id}: execution incomplete`);
    ensure(summary.planned_cases === summary.recorded_cases, `${entry.plan_id}: missing planned cases`);
    ensure(!snapshot.mock && snapshot.model === gradingModelName(), `${entry.plan_id}: transport/model mismatch`);
    ensure(isDeepStrictEqual(snapshot.question_set, set), `${entry.plan_id}: question snapshot mismatch`);
    for (const [file, hash] of Object.entries(snapshot.hashes)) ensure(fileSha(file) === hash, `${entry.plan_id}: snapshot input changed ${file}`);
    inputs.push({ file: snapshotFile, sha256: fileSha(snapshotFile), summary: summaryFile, summary_sha256: fileSha(summaryFile) });
    for (const item of summary.records) {
      const file = `${folder}/${item.file}`;
      records.push({ file, sha256: fileSha(file), value: read(file) });
    }
  }
  ensure(new Set(records.map(row => row.value.case_id)).size === qa.cases.length, `${entry.plan_id}: missing/extra required cases`);
  const cases = [];
  for (const test of qa.cases) {
    const group = records.filter(row => row.value.case_id === test.id);
    ensure(group.length > 0, `No evidence for ${entry.plan_id}/${test.id}`);
    const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
    const requestHash = sha(buildGradingPrompt(set, answers));
    const schemaHash = sha(JSON.stringify(buildGradingResponseSchema(set, answers)));
    for (const row of group) {
      const value = row.value;
      ensure(!value.error && value.result, `Execution failure ${row.file}`);
      ensure(isDeepStrictEqual(value.expected, test), `QA expectation changed ${row.file}`);
      ensure(isDeepStrictEqual(value.answers, answers), `Answer changed ${row.file}`);
      ensure(value.request_hash === requestHash && value.schema_hash === schemaHash, `Recomputed prompt/schema mismatch ${row.file}`);
      ensure(value.model === gradingModelName(), `Model changed ${row.file}`);
      ensure(value.transport === (test.answer.trim() ? 'live_model' : 'production_empty_answer_no_model'), `Transport mismatch ${row.file}`);
    }
    const mismatched = group.some(row => !row.value.matched);
    ensure(!mismatched || group.length >= 3, `Fewer than 3 observations for mismatch ${entry.plan_id}/${test.id}`);
    cases.push({
      case_id: test.id, kind: test.kind, request_hash: requestHash, schema_hash: schemaHash,
      prompt_schema_recomputed_with_current_grader: true,
      expected_points: test.expected_points,
      observations: group.length,
      has_mismatch: mismatched,
      all_exact_verdicts_match: group.every(row => row.value.exact_verdict_differences.length === 0),
      evidence: group.map(row => ({
        file: relative(row.file), sha256: row.sha256, model: row.value.model,
        transport: row.value.transport, matched: row.value.matched,
        score: row.value.result.score,
        verdict_differences: row.value.verdict_differences,
        exact_verdict_differences: row.value.exact_verdict_differences,
      })),
    });
  }
  rows.push({ plan_id: entry.plan_id, set_id: entry.set_id, package: entry.package,
    question: {file: entry.file, sha256: entry.sha256},
    selected_qa: {file: entry.qa_file, sha256: entry.qa_sha256},
    input_snapshots: inputs, required_cases: cases.length,
    actual_observations: records.length,
    live_model_attempts: records.filter(row => row.value.transport === 'live_model').length,
    production_empty_answer_attempts: records.filter(row => row.value.transport === 'production_empty_answer_no_model').length,
    mismatch_case_ids: cases.filter(row => row.has_mismatch).map(row => row.case_id),
    cases,
  });
}
ensure(rows.length === 18, 'Expected 18 sets');
const cases = rows.reduce((sum, row) => sum + row.required_cases, 0);
ensure(cases === 808, `Expected 808 mandatory QA cases, found ${cases}`);
const payload = {
  recorded_at: new Date().toISOString(), artifact_type: 'verified_author_qa_evidence_index',
  script: {file: relative(fileURLToPath(import.meta.url)), sha256: fileSha(fileURLToPath(import.meta.url))},
  api_calls_during_this_audit: 0,
  manifest: {file: manifestFile, sha256: fileSha(manifestFile)},
  runtime_lock: {file: lockFile, sha256: fileSha(lockFile)},
  grader_files: grader, grading_model: gradingModelName(), sets: rows.length, required_cases: cases,
  actual_observations: rows.reduce((sum, row) => sum + row.actual_observations, 0),
  live_model_attempts: rows.reduce((sum, row) => sum + row.live_model_attempts, 0),
  production_empty_answer_attempts: rows.reduce((sum, row) => sum + row.production_empty_answer_attempts, 0),
  mismatches: rows.flatMap(row => row.mismatch_case_ids.map(id => ({plan_id: row.plan_id, set_id: row.set_id, case_id: id}))),
  selected_case_policy: 'All 808 current mandatory QA cases. T02-A/T01-A/T04-B accepted sidecars; T16-A combines 33 new with 8 same-v4 cases/24 live observations. Earlier v3 evidence and exploratory regression cases are outside this denominator.',
  limitation: 'Author-QA evidence only; preserved variance is not converted into a full pass. Semantic review and generated-case grading remain separate.',
  records: rows,
};
const output = `${base}/n01/phase-two-v4/owned-author-qa-evidence-index.json`;
fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(Object.fromEntries(Object.entries(payload).filter(([key]) => !['records', 'grader_files'].includes(key))), null, 2));
