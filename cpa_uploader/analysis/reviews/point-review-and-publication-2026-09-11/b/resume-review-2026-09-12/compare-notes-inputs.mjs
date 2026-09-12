import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../lib/questionV3Grading.ts';
import { reviewedContentHash, jsonHash } from '../../../../../questionReviewIdentity.ts';
import { contentHash } from '../../../../../../lib/learningSubmission.ts';
import { selectLearningQuestionSet } from '../../../../../../lib/learningUnits.ts';

const own = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(own, '../../../../../..');
const batch = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const abs = file => path.resolve(root, file);
const read = file => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const files = { original: batch + '/canonical-before.json', current: 'cpa_uploader/data/cpa_question_sets_v3.authoring.json', candidate: batch + '/prepared-reviewed-v6/candidate-authoring.json', manifest: batch + '/execution-all-v6/manifest.json', smoke: batch + '/a/learning-unit-smoke-v3/manifest.json' };
const protectedFiles = [...Object.values(files), 'lib/questionV3Grading.ts', 'lib/learningUnits.ts', 'lib/learningSubmission.ts', 'cpa_uploader/questionReviewIdentity.ts', 'cpa_uploader/questionSemanticReview.ts'];
const beforeHashes = protectedFiles.map(file => ({ file, sha256: sha(fs.readFileSync(abs(file))) }));
const original = read(files.original), current = read(files.current), candidate = read(files.candidate), manifest = read(files.manifest), smoke = read(files.smoke);
const proposed = structuredClone(candidate), replacements = [], unmatched = [], unexpected = [];
for (const oldSet of original) {
  const currentSet = current.find(s => s.id === oldSet.id);
  if (!currentSet) throw Error('Current set missing: ' + oldSet.id);
  const a = structuredClone(oldSet), b = structuredClone(currentSet); a.verification.notes = []; b.verification.notes = [];
  if (!same(a, b)) unexpected.push(oldSet.id);
  if (oldSet.verification.notes.length !== currentSet.verification.notes.length) throw Error('Notes array size changed: ' + oldSet.id);
  const target = proposed.find(s => s.id === oldSet.id);
  if (!target) throw Error('Candidate set missing: ' + oldSet.id);
  oldSet.verification.notes.forEach((oldNote, index) => {
    const newNote = currentSet.verification.notes[index]; if (oldNote === newNote) return;
    const found = target.verification.notes.flatMap((note, i) => note === oldNote ? [i] : []);
    if (found.length !== 1) { unmatched.push({ set_id: oldSet.id, original_index: index, candidate_matches: found.length }); return; }
    target.verification.notes[found[0]] = newNote;
    replacements.push({ set_id: oldSet.id, original_index: index, candidate_index: found[0], before: oldNote, after: newNote });
  });
}
if (unexpected.length || unmatched.length) throw Error('Notes-only exact-match proposal blocked: ' + JSON.stringify({ unexpected, unmatched }));
const changedIds = new Set(replacements.map(x => x.set_id));
let qaCount = 0, promptChanged = 0, schemaChanged = 0, qaExpectedChanged = 0;
const jobs = manifest.jobs.map(job => {
  const before = candidate.find(s => s.id === job.set_id), after = proposed.find(s => s.id === job.set_id), qa = read(job.qa_file);
  const changes = [];
  for (const test of qa.cases) {
    const answers = Object.fromEntries(before.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
    const beforePrompt = buildGradingPrompt(before, answers), afterPrompt = buildGradingPrompt(after, answers);
    const pChanged = beforePrompt !== afterPrompt;
    const beforeSchema = buildGradingResponseSchema(before, answers), afterSchema = buildGradingResponseSchema(after, answers);
    const sChanged = !same(beforeSchema, afterSchema);
    const oldQ = before.subquestions.find(q => q.id === test.subquestion_id), newQ = after.subquestions.find(q => q.id === test.subquestion_id);
    const eChanged = !same(oldQ.criteria, newQ.criteria) || !same(oldQ.model_answer, newQ.model_answer);
    qaCount++; promptChanged += Number(pChanged); schemaChanged += Number(sChanged); qaExpectedChanged += Number(eChanged);
    if (pChanged || sChanged || eChanged) changes.push({ id: test.id, prompt_changed: pChanged, schema_changed: sChanged, expectation_contract_changed: eChanged });
  }
  return { set_id: job.set_id, notes_changed: changedIds.has(job.set_id), qa_cases: qa.cases.length, changed_cases: changes,
    review_content_hash_before: reviewedContentHash(before), review_content_hash_after: reviewedContentHash(after),
    review_bank_hash_changed: jsonHash(candidate.filter(s => s.id !== job.set_id).sort((a,b)=>a.id.localeCompare(b.id)).map(s=>({id:s.id,content_hash:reviewedContentHash(s)}))) !== jsonHash(proposed.filter(s => s.id !== job.set_id).sort((a,b)=>a.id.localeCompare(b.id)).map(s=>({id:s.id,content_hash:reviewedContentHash(s)}))) };
});
const units = smoke.entries.map(row => {
  const artifact = read(row.file), before = candidate.find(s => s.id === row.source_set_id), after = proposed.find(s => s.id === row.source_set_id);
  const originalProjection = selectLearningQuestionSet(before, artifact.classifications, row.learning_unit_id);
  const afterProjection = selectLearningQuestionSet(after, artifact.classifications, row.learning_unit_id);
  if (!same(originalProjection, artifact.projected_question_set)) throw Error('Current frozen projection differs: ' + row.learning_unit_id);
  const test = artifact.cases.find(c => c.kind === 'stored_model_answers');
  const beforePrompt = buildGradingPrompt(originalProjection, test.answers), afterPrompt = buildGradingPrompt(afterProjection, test.answers);
  const beforeSchema = buildGradingResponseSchema(originalProjection, test.answers), afterSchema = buildGradingResponseSchema(afterProjection, test.answers);
  return { learning_unit_id: row.learning_unit_id, source_set_id: row.source_set_id, selected_subquestion_ids: row.selected_subquestion_ids,
    notes_changed: changedIds.has(row.source_set_id), source_content_hash_changed: contentHash(before) !== contentHash(after),
    projected_body_hash_changed: contentHash(originalProjection) !== contentHash(afterProjection),
    prompt_changed: beforePrompt !== afterPrompt, prompt_sha256_before: sha(beforePrompt), prompt_sha256_after: sha(afterPrompt),
    schema_changed: !same(beforeSchema, afterSchema), schema_hash_before: contentHash(beforeSchema), schema_hash_after: contentHash(afterSchema),
    model_answers_criteria_changed: !same(originalProjection.subquestions, afterProjection.subquestions),
    old_metadata_source_hash_matches_after: artifact.classifications.every(meta => meta.source_content_hash === contentHash(after)) };
});
const protectedAfter = beforeHashes.map(x => ({ ...x, unchanged: sha(fs.readFileSync(abs(x.file))) === x.sha256 }));
const report = { version: 1, checked_at: new Date().toISOString(), mode: 'read_only_in_memory_notes_only_sensitivity_analysis', api_calls: 0,
  written_artifact: 'analysis report only; no successor question bank, metadata or QA created',
  input_files: protectedAfter, unexpected_non_notes_changes: unexpected, unmatched_note_replacements: unmatched,
  summary: { original_sets: original.length, note_changed_sets: changedIds.size, changed_notes: replacements.length, candidate_sets: candidate.length,
    target_sets: jobs.length, target_note_changed_sets: jobs.filter(j => j.notes_changed).length, review_peer_bank_hash_changed_target_sets: jobs.filter(j=>j.review_bank_hash_changed).length,
    author_qa_cases: qaCount, author_qa_prompt_changed: promptChanged, author_qa_schema_changed: schemaChanged, author_qa_expected_contract_changed: qaExpectedChanged,
    learning_units: units.length, learning_unit_body_hash_changed: units.filter(u=>u.projected_body_hash_changed).length,
    learning_prompt_changed: units.filter(u=>u.prompt_changed).length, learning_schema_changed: units.filter(u=>u.schema_changed).length, learning_answers_or_criteria_changed: units.filter(u=>u.model_answers_criteria_changed).length },
  notes_diff: replacements, target_jobs: jobs, learning_units: units,
  interpretation: [
    'reviewedContentHash excludes only status/review_status; notes-only edits change own reviewed identity and every peer-bank hash. This affects fresh semantic receipt acceptance.',
    'buildGradingPrompt and response schema do not contain verification.notes. Exact original author-QA answers and stored-model-answer app inputs retain identical prompts/schema and scoring contracts under this notes-only change.',
    'Source-file/manifest/QA runner and smoke artifact body guards still reject old serialized files after a notes edit. Input-level equality is not blanket runner/receipt acceptance or human approval.',
    'The same old classification rows were passed only to the pure in-memory selectLearningQuestionSet sensitivity check. No source-hash mismatch was sanctioned for the actual catalog; new source/metadata binding must be compiled and verified.',
    'Semantic generated cases may differ on future model calls. Reuse of a particular actual grading observation requires identical case answer/expectation/request/schema/instructions/model and production policy, not merely this notes-only result.',
    'No model call, question/QA/metadata mutation, source mutation, publication or DB write was performed by this analysis.'
  ] };
fs.writeFileSync(path.join(own, 'notes-only-input-comparison.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report.summary));
if (protectedAfter.some(x=>!x.unchanged) || promptChanged || schemaChanged || qaExpectedChanged || units.some(u=>u.prompt_changed||u.schema_changed||u.model_answers_criteria_changed)) process.exitCode=1;
