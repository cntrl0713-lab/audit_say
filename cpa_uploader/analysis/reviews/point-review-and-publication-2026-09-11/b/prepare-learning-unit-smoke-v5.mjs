/** Local preparation only. Nonempty answers are NEVER submitted to a grader.
 * Run: node --import tsx <this file>
 * Only the production empty-answer branch is executed, with an explicit empty key.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { buildLearningUnits, selectLearningQuestionSet } from '../../../../../lib/learningUnits.ts';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints } from '../../../../../lib/questionV3.ts';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import { gradeQuestionSetV3, buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../../../lib/questionV3Grading.ts';

const self = fileURLToPath(import.meta.url);
const owned = path.dirname(self), root = path.resolve(owned, '../../../../..');
const review = path.resolve(owned, '..'), prepared = path.join(review, 'prepared-reviewed-v7');
const output = path.join(owned, 'learning-unit-smoke-v5');
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const sha = value => createHash('sha256').update(value).digest('hex');
const serialize = value => JSON.stringify(value, null, 2) + '\n';
const snapshots = new Map();
function frozen(file) {
    file = path.resolve(root, file);
    if (!snapshots.has(file)) {
        const bytes = fs.readFileSync(file);
        snapshots.set(file, { file: relative(file), sha256: sha(bytes), bytes });
    }
    return snapshots.get(file);
}
const read = file => JSON.parse(frozen(file).bytes.toString('utf8'));
function assertFrozen() {
    for (const [file, input] of snapshots) assert.equal(sha(fs.readFileSync(file)), input.sha256, `Frozen input changed: ${input.file}`);
}
const fileRecord = (file, value) => ({ file: relative(file), sha256: sha(serialize(value)) });

assert.equal(process.argv.length, 2, 'This preparation takes no options and has no live grading mode.');
assert.equal(fs.existsSync(output), false, 'Preserve an existing smoke bundle; do not overwrite it.');
frozen(self);
const codeFiles = ['lib/learningUnits.ts', 'lib/learningSubmission.ts', 'lib/questionV3.ts', 'lib/questionV3Grading.ts',
    'lib/questionV3Evidence.ts', 'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts'];
for (const file of codeFiles) frozen(file);
const bankFile = path.join(prepared, 'candidate-authoring.json');
const catalogFile = path.join(prepared, 'learning-question-classifications.json');
const summaryFile = path.join(prepared, 'summary.json');
const originalFile = path.join(review, 'canonical-before.json');
const bank = read(bankFile), catalog = read(catalogFile), summary = read(summaryFile), original = read(originalFile);
assert.equal(frozen(bankFile).sha256, '2867c39aead6225d2fdb46e1114a94abf323b275d48714e2c38dde12fb5d6f50', 'Approved v7 bank identity');
const runtimeFile = path.join(review, 'execution-runtime-v6.json');
const runtime = read(runtimeFile);
assert.equal(frozen(runtimeFile).sha256, '5965bfc11dd440298431c418585b335828a23b10ed56fdca6832e8728ed70ba7', 'Approved runtime v6');
assert.equal(runtime.grading_model, gradingModelName(), 'Runtime/model binding');
assert.equal(path.resolve(root, runtime.source_question_bank.file), bankFile);
assert.equal(runtime.source_question_bank.sha256, frozen(bankFile).sha256);
for (const item of runtime.code_files) assert.equal(frozen(item.file).sha256, item.sha256, `Runtime code identity: ${item.file}`);
for (const item of [runtime.preservation, ...runtime.changed_predecessor_files.map(item => item.snapshot)])
    assert.equal(frozen(item.file).sha256, item.sha256, `Preserved old runtime code: ${item.file}`);
const predecessorFile = path.join(review, 'b', 'learning-unit-smoke-v4', 'manifest.json');
const predecessor = read(predecessorFile);
assert.equal(frozen(predecessorFile).sha256, 'a4045abe6110a9816f242ad92f6676c6e0eebf49e9dbb9a601b75431114b03e2', 'Preserve v7 smoke-v4 evidence');
for (const row of predecessor.entries) {
    assert.equal(frozen(row.file).sha256, row.sha256, `Preserve prior artifact: ${row.file}`);
    const prior = read(row.file);
    assert.equal(frozen(prior.source_snapshot.file).sha256, prior.source_snapshot.sha256, 'Prior source snapshot identity');
}
// Preserve every predecessor bundle file, including any execution evidence that exists.
// These are historical inputs only: none is relabeled as a new model observation.
function collectPreservedFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        assert(!entry.isSymbolicLink(), `Unexpected symbolic predecessor artifact: ${file}`);
        return entry.isDirectory() ? collectPreservedFiles(file) : [frozen(file)];
    });
}
const preservedPredecessorFiles = collectPreservedFiles(path.dirname(predecessorFile))
    .map(({ file, sha256 }) => ({ file, sha256 }));
frozen(path.join(review, 'b', 'run-learning-unit-smoke-v4.ts'));
frozen(path.join(review, 'b', 'run-learning-unit-smoke-v4.test.ts'));
const inheritedGenerator = frozen(path.join(review, 'b', 'prepare-learning-unit-smoke-v4.mjs'));
const codeChangesSincePredecessor = predecessor.code_files.filter(row => row.file.startsWith('lib/'))
    .map(row => ({ file: row.file, before_sha256: row.sha256, after_sha256: frozen(row.file).sha256 }))
    .filter(row => row.before_sha256 !== row.after_sha256);
assert.deepEqual(codeChangesSincePredecessor, [{ file: 'lib/questionV3Grading.ts',
    before_sha256: '6a3033f9a5a6e408ebb8251787a5daeef3b478e287b5ae5c0aecc94d967a2dd7',
    after_sha256: '0f685328ffa59248ed56e9ff77fafb84e1f5913a3b6e5d1c6c6a208f1f49e124' }], 'Only the approved grading policy code changes');
assert.equal(path.resolve(root, catalog.source_file), bankFile, 'Catalog source path must bind the selected bank');
assert.equal(catalog.source_file_sha256, frozen(bankFile).sha256, 'Catalog source hash');
assert.equal(catalog.review_file_sha256, frozen(catalog.review_file).sha256, 'Catalog review hash');
assert.equal(catalog.public_content_hash, contentHash(bank.map(compilePublicQuestionSet)), 'Catalog public content hash');
const originalIds = new Set(original.map(set => set.id));
const changedIds = summary.canonical.changed_sets;
const newIds = bank.filter(set => !originalIds.has(set.id)).map(set => set.id);
assert.equal(new Set(changedIds).size, changedIds.length);
assert.equal(changedIds.length, 70, 'This task selects exactly the 70 changed canonical sets');
assert.equal(newIds.length, summary.new.sets);
assert.equal(newIds.length, 49, 'This task selects exactly the 49 new sets');
const selectedIds = new Set([...changedIds, ...newIds]);
assert.equal(selectedIds.size, 119, 'Do not expand the smoke to the full bank');
const sets = bank.filter(set => selectedIds.has(set.id));
assert.equal(sets.length, selectedIds.size, 'Missing selected source set');
const classifications = catalog.classifications.filter(row => selectedIds.has(row.source_set_id));
for (const row of classifications) {
    const source = sets.find(set => set.id === row.source_set_id);
    assert.equal(row.source_content_hash, contentHash(source), `Classification/source mismatch: ${row.source_set_id}`);
}
for (const source of sets) for (const ref of source.source_refs) frozen(ref.file);
const initialSourceBodies = new Map(sets.map(set => [set.id, JSON.stringify(set)]));
const initialClassifications = JSON.stringify(classifications);
const units = buildLearningUnits(sets.map(compilePublicQuestionSet), classifications, catalog.topics);
assert.equal(units.reduce((sum, unit) => sum + unit.subquestions.length, 0), classifications.length);

const artifacts = [], rows = [];
for (const source of sets) artifacts.push({ file: path.join(output, 'source-sets', `${source.id}.json`), value: source });
let emptyCalls = 0;
for (const unit of units) {
    const source = sets.find(set => set.id === unit.source_set_id);
    assert(source, unit.id);
    const selectedSubquestionIds = unit.subquestions.map(sub => sub.id);
    const metadata = unit.classification_version_ids.map(id => {
        const row = classifications.find(row => row.classification_version_id === id);
        assert(row, `Missing classification: ${id}`); return row;
    });
    assert.deepEqual(metadata.map(row => row.subquestion_id), selectedSubquestionIds);
    if (unit.question_style === 'case') {
        const everyCase = source.subquestions.filter(sub => classifications.some(row => row.source_set_id === source.id && row.subquestion_id === sub.id && row.question_style === 'case')).map(sub => sub.id);
        assert.deepEqual(selectedSubquestionIds, everyCase, 'Case smoke must include every case sibling');
        assert(unit.shared_context.facts.length > 0, 'Case must retain its parent facts');
        assert.equal(unit.case_set_id, source.id);
    } else {
        assert.equal(selectedSubquestionIds.length, 1);
        assert.deepEqual(unit.shared_context.facts, []);
        assert.equal(unit.case_set_id, null);
        assert.equal(unit.subquestions[0].prompt, metadata[0].standalone_prompt);
    }
    const projected = selectLearningQuestionSet(source, metadata, unit.id);
    assert.equal(projected.id, source.id, 'The private engine keeps source lineage, not a synthetic source ID');
    assert.deepEqual(projected.subquestions.map(sub => sub.id), selectedSubquestionIds);
    assert.deepEqual(projected.shared_context, unit.shared_context);
    assert.deepEqual(projected.learning_order, unit.learning_order);
    assert.deepEqual(projected.subquestions.map(sub => sub.prompt), unit.subquestions.map(sub => sub.prompt));
    const maxPoints = computeQuestionSetMaxPoints(projected);
    assert.equal(maxPoints, unit.max_points, 'Public unit and actual grading projection points');
    for (const sub of projected.subquestions) {
        const before = source.subquestions.find(item => item.id === sub.id);
        assert.deepEqual(sub.criteria, before.criteria, 'Projection preserves rubric');
        assert.deepEqual(sub.requirements, before.requirements, 'Projection preserves direct requirements');
        assert.deepEqual(sub.model_answer, before.model_answer, 'Projection preserves stored answer');
    }
    const completeAnswers = Object.fromEntries(projected.subquestions.map(sub => [sub.id, sub.model_answer.join('\n')]));
    assert(Object.values(completeAnswers).every(answer => answer.trim().length > 0 && answer.length <= 5000), 'Stored answer must fit the actual grader contract');
    const emptyAnswers = Object.fromEntries(projected.subquestions.map(sub => [sub.id, '']));
    const expected = (verdict, points) => ({ score: points, max_points: maxPoints, security_flag: 'none',
        subquestions: projected.subquestions.map(sub => ({ subquestion_id: sub.id,
            expected_points: verdict === 'met' ? sub.criteria.reduce((sum, criterion) => sum + criterion.scores.met, 0) : 0,
            expected_verdicts: sub.criteria.map(criterion => ({ criterion_id: criterion.id, verdict,
                reason: verdict === 'met' ? '현재 저장 모범답안 전체에 대한 만점 기대. 실제 모델 판정 전이다.' : '빈 답안의 생산 무호출 경로는 모든 기준에 not_met/0점이다.' })) })) });
    let judgments = 0; const trace = [];
    // No createResponse injection and no applyQuestionSetJudgment of authored expectations.
    const emptyResult = await gradeQuestionSetV3(projected, emptyAnswers, '', () => { judgments++; }, undefined, event => trace.push(event));
    emptyCalls++;
    assert.equal(judgments, 0); assert.equal(trace.length, 0);
    assert.equal(emptyResult.score, 0); assert.equal(emptyResult.max_points, maxPoints);
    assert.equal(emptyResult.security_flag, 'none'); assert.equal(emptyResult.question_set_id, source.id);
    assert.deepEqual(emptyResult.subquestions.map(sub => sub.subquestion_id), selectedSubquestionIds);
    for (const sub of emptyResult.subquestions) {
        assert.equal(sub.score, 0);
        assert(sub.criteria.every(criterion => criterion.verdict === 'not_met' && criterion.awarded_points === 0), 'Empty criterion must be not_met/0');
    }
    const prompt = buildGradingPrompt(projected, completeAnswers);
    const schema = buildGradingResponseSchema(projected, completeAnswers);
    const formalAnswers = Object.fromEntries(source.subquestions.map(sub => [sub.id, completeAnswers[sub.id] ?? '']));
    const formalPrompt = buildGradingPrompt(source, formalAnswers);
    const formalSchema = buildGradingResponseSchema(source, formalAnswers);
    const reasons = [];
    const removedIds = source.subquestions.filter(sub => !selectedSubquestionIds.includes(sub.id)).map(sub => sub.id);
    const changedPrompts = projected.subquestions.filter(sub => sub.prompt !== source.subquestions.find(item => item.id === sub.id).prompt).map(sub => sub.id);
    if (removedIds.length) reasons.push('Source-level QA includes sibling questions that the selected learning unit omits.');
    if (JSON.stringify(source.shared_context) !== JSON.stringify(projected.shared_context)) reasons.push('Standalone learning removes parent facts from the actual grading input.');
    if (changedPrompts.length) reasons.push('The frozen standalone_prompt replaces the original source prompt.');
    const promptDiffers = sha(prompt) !== sha(formalPrompt), schemaDiffers = contentHash(schema) !== contentHash(formalSchema);
    if (unit.question_style === 'case' && selectedSubquestionIds.length > 1) reasons.push('The full case smoke answers all case siblings together; individual source QA answers may only exercise one sibling.');
    const sourceSnapshot = fileRecord(path.join(output, 'source-sets', `${source.id}.json`), source);
    const document = {
        version: 1, artifact_type: 'learning_unit_smoke_preparation', learning_unit_id: unit.id, source_set_id: source.id,
        question_style: unit.question_style, selected_subquestion_ids: selectedSubquestionIds,
        classification_version_ids: metadata.map(row => row.classification_version_id), learning_question_ids: metadata.map(row => row.learning_question_id),
        source_snapshot: { ...sourceSnapshot, content_hash: contentHash(source), bank_file: relative(bankFile), bank_sha256: frozen(bankFile).sha256 },
        classifications: metadata, classifications_hash: contentHash(metadata), public_learning_unit: unit,
        public_unit_hash: contentHash(unit), projected_question_set: projected, projected_body_hash: contentHash(projected),
        cases: [
            { id: `${unit.id}:stored-model-answers`, kind: 'stored_model_answers', answers: completeAnswers,
                expected: expected('met', maxPoints), request: { prompt, prompt_sha256: sha(prompt), schema, schema_hash: contentHash(schema) },
                execution: { status: 'not_run', model_calls: 0, author_expectations_only: true } },
            { id: `${unit.id}:empty`, kind: 'empty', answers: emptyAnswers, expected: expected('not_met', 0),
                execution: { status: 'completed', method: 'production_gradeQuestionSetV3_empty_answer', transport: 'production_empty_answer_no_model',
                    explicit_api_key: 'empty', injected_response: false, model_calls: 0, judgment_callbacks: judgments, trace_events: trace.length }, result: emptyResult },
        ],
        formal_source_qa_comparison: {
            answer_mapping: formalAnswers, prompt_sha256: sha(formalPrompt), schema_hash: contentHash(formalSchema),
            request_differs: promptDiffers, schema_differs: schemaDiffers, removed_subquestion_ids: removedIds,
            standalone_prompt_changed_subquestion_ids: changedPrompts, reasons,
            full_case_multi_answer: unit.question_style === 'case' && selectedSubquestionIds.length > 1,
            receipt_reuse_approved: false,
            note: 'Comparison uses the same selected stored answers in the full source, with omitted siblings blank. It does not claim that formal source QA actually executed this answer mapping. Existing receipts require per-request identity review before any reuse.',
        },
    };
    const artifactFile = path.join(output, 'units', `${unit.id}.json`);
    artifacts.push({ file: artifactFile, value: document });
    rows.push({ learning_unit_id: unit.id, source_set_id: source.id, source_group: originalIds.has(source.id) ? 'changed_canonical' : 'new',
        question_style: unit.question_style, selected_subquestion_ids: selectedSubquestionIds, classification_version_ids: unit.classification_version_ids,
        points: maxPoints, projected_body_hash: contentHash(projected), source_content_hash: contentHash(source),
        classifications_hash: contentHash(metadata), prompt_sha256: sha(prompt), schema_hash: contentHash(schema),
        formal_request_differs: promptDiffers, formal_schema_differs: schemaDiffers,
        full_case_multi_answer: unit.question_style === 'case' && selectedSubquestionIds.length > 1,
        stored_answer_model_execution: 'not_run', empty_execution: 'passed_without_model', ...fileRecord(artifactFile, document) });
}
for (const source of sets) assert.equal(JSON.stringify(source), initialSourceBodies.get(source.id), 'Source objects mutated');
assert.equal(JSON.stringify(classifications), initialClassifications, 'Classification objects mutated');
assert.equal(new Set(rows.map(row => row.learning_unit_id)).size, rows.length);
assert.equal(new Set(rows.map(row => row.source_set_id)).size, selectedIds.size);
assert.equal(emptyCalls, rows.length);
assertFrozen();
const counts = { source_sets: sets.length, changed_canonical_sets: changedIds.length, new_sets: newIds.length,
    selected_questions: classifications.length, learning_units: rows.length, standard_units: rows.filter(row => row.question_style === 'standard').length,
    case_units: rows.filter(row => row.question_style === 'case').length,
    case_questions: rows.filter(row => row.question_style === 'case').reduce((n, row) => n + row.selected_subquestion_ids.length, 0),
    total_points: rows.reduce((n, row) => n + row.points, 0), stored_model_answer_cases_prepared: rows.length,
    stored_model_answer_cases_executed: 0, empty_cases_passed: emptyCalls,
    formal_request_changed_units: rows.filter(row => row.formal_request_differs).length,
    formal_schema_changed_units: rows.filter(row => row.formal_schema_differs).length,
    multi_question_case_units: rows.filter(row => row.full_case_multi_answer).length, model_api_calls: 0 };
let commonInstructionDelta = null;
const deltas = rows.map(row => {
    const prior = predecessor.entries.find(item => item.learning_unit_id === row.learning_unit_id);
    assert(prior, `Unexpected new learning unit: ${row.learning_unit_id}`);
    const previousArtifact = read(prior.file);
    const currentArtifact = artifacts.find(item => relative(item.file) === row.file).value;
    const studentView = value => ({
        question_style: value.question_style,
        selected_subquestion_ids: value.selected_subquestion_ids,
        shared_context: value.projected_question_set.shared_context,
        learning_order: value.projected_question_set.learning_order,
        subquestions: value.projected_question_set.subquestions.map(sub => ({ id: sub.id, type: sub.type, prompt: sub.prompt,
            constraints: sub.constraints, selection: sub.selection,
            topic_ids: value.classifications.find(meta => meta.subquestion_id === sub.id).topic_ids })),
        max_points: value.public_learning_unit.max_points,
    });
    const studentInputChanged = JSON.stringify(studentView(previousArtifact)) !== JSON.stringify(studentView(currentArtifact));
    assert.deepEqual(currentArtifact.cases[0].answers, previousArtifact.cases[0].answers, 'Stored model answers unchanged');
    assert.deepEqual(currentArtifact.projected_question_set.subquestions.map(sub => sub.criteria),
        previousArtifact.projected_question_set.subquestions.map(sub => sub.criteria), 'All grading criteria unchanged');
    assert.deepEqual(currentArtifact.cases[0].expected, previousArtifact.cases[0].expected, 'Full-answer expectation unchanged');
    assert.deepEqual(currentArtifact.projected_question_set, previousArtifact.projected_question_set, 'Projected private body unchanged');
    assert.deepEqual(currentArtifact.public_learning_unit, previousArtifact.public_learning_unit, 'Public learning-unit body unchanged');
    assert.deepEqual(currentArtifact.classifications, previousArtifact.classifications, 'Classification versions unchanged');
    assert.deepEqual(currentArtifact.cases[1].result, previousArtifact.cases[1].result, 'Production empty-answer result unchanged');
    const previousPrompt = previousArtifact.cases[0].request.prompt, currentPrompt = currentArtifact.cases[0].request.prompt;
    const marker = '<<<GRADING_PAYLOAD_START>>>';
    const oldOffset = previousPrompt.indexOf(marker), newOffset = currentPrompt.indexOf(marker);
    assert(oldOffset >= 0 && newOffset >= 0, 'Actual production grading-data marker');
    assert.equal(previousPrompt.slice(oldOffset), currentPrompt.slice(newOffset), 'Payload, answers, evidence and output example unchanged');
    const oldInstructions = previousPrompt.slice(0, oldOffset).split('\n');
    const newInstructions = currentPrompt.slice(0, newOffset).split('\n');
    const addedInstructions = newInstructions.filter(line => !oldInstructions.includes(line));
    assert.equal(addedInstructions.length, 2, 'Only the two approved inference instructions were added');
    assert.deepEqual(newInstructions.filter(line => !addedInstructions.includes(line)), oldInstructions, 'Prior instructions retained byte for byte');
    if (commonInstructionDelta === null) commonInstructionDelta = addedInstructions;
    else assert.deepEqual(addedInstructions, commonInstructionDelta, 'Same policy delta in all 249 requests');
    return { learning_unit_id: row.learning_unit_id, source_set_id: row.source_set_id,
        grading_payload_and_output_example_changed: false, added_instruction_lines: addedInstructions.length,
        before_points: prior.points, after_points: row.points, student_input_changed: studentInputChanged,
        before_artifact: { file: prior.file, sha256: prior.sha256 }, after_artifact: { file: row.file, sha256: row.sha256 },
        student_input_difference: studentInputChanged ? { before: studentView(previousArtifact), after: studentView(currentArtifact) } : null,
        request_identity: { before_prompt_sha256: prior.prompt_sha256, after_prompt_sha256: row.prompt_sha256,
            before_schema_hash: prior.schema_hash, after_schema_hash: row.schema_hash },
        stored_answers_changed: false, criteria_changed: false, full_answer_expectations_changed: false,
        projected_body_changed: row.projected_body_hash !== prior.projected_body_hash,
        source_body_changed: row.source_content_hash !== prior.source_content_hash,
        classifications_changed: row.classifications_hash !== prior.classifications_hash,
        prompt_changed: row.prompt_sha256 !== prior.prompt_sha256, schema_changed: row.schema_hash !== prior.schema_hash };
});
assert.equal(predecessor.entries.length, rows.length, 'Learning units added or removed unexpectedly');
const substantiveDeltas = deltas.filter(row => row.projected_body_changed || row.source_body_changed || row.prompt_changed || row.schema_changed || row.before_points !== row.after_points);
const studentDeltas = deltas.filter(row => row.student_input_changed);
assert.equal(studentDeltas.length, 0, 'No student input changes in grader-only followup');
assert.equal(deltas.filter(row => row.prompt_changed).length, 249, 'All grading requests receive the two approved instruction lines');
assert(deltas.every(row => !row.projected_body_changed && !row.source_body_changed && !row.classifications_changed), 'Source, projection and classification bodies unchanged');
assert(deltas.every(row => !row.schema_changed && row.before_points === row.after_points), 'Schema and points are unchanged');
assert.equal(rows.length, 249, 'All 249 selected learning units prepared');
assert.equal(counts.selected_questions, 280);
assert.equal(counts.standard_units, 209);
assert.equal(counts.case_units, 40);
const corrected = sets.find(set => set.id === 'pilot-08-007');
assert.deepEqual(corrected.subquestions.map(sub => sub.criteria.reduce((sum, criterion) => sum + criterion.scores.met, 0)), [4, 5, 3]);
assert.equal(counts.total_points, 1113);
const manifest = { version: 5, created_at: new Date().toISOString(), status: 'app_projection_and_empty_path_checked_nonempty_model_smoke_not_run',
    runtime: { file: relative(runtimeFile), sha256: frozen(runtimeFile).sha256, grading_model: runtime.grading_model, review_model: runtime.review_model },
    predecessor: { file: relative(predecessorFile), sha256: frozen(predecessorFile).sha256, artifact_bytes_preserved: true, preserved_files: preservedPredecessorFiles },
    predecessor_comparison: { compared_learning_units: deltas.length, substantive_changed_units: substantiveDeltas, all_classification_changed_units: deltas.filter(row => row.classifications_changed).length,
        old_points: predecessor.counts.total_points, new_points: counts.total_points, prior_nonempty_execution_reused: false,
        student_input_changed_units: studentDeltas, grading_prompt_changed_units: deltas.filter(row => row.prompt_changed),
        schema_changed_units: deltas.filter(row => row.schema_changed), code_changes_since_predecessor: codeChangesSincePredecessor,
        added_grading_instruction_lines: commonInstructionDelta,
        interpretation: 'The v7 bank, classification versions, projected bodies, stored model answers, expectations and schema are unchanged. All 249 grading prompts add exactly the two runtime-v6 inference instructions; the actual grading payload and output example remain byte-identical. Old evidence is preserved, not relabeled as current model observations.' },
    inherited_preparation_code: { file: inheritedGenerator.file, sha256: inheritedGenerator.sha256 },
    nonempty_execution_queue: { status: 'prepared_not_executed', entries: rows.length, execution_owner: 'root',
        prerequisite: 'The root must bind the current runtime lock and verify every input/artifact hash before real execution.',
        case_selector: 'cases[kind=stored_model_answers]', api_calls_in_preparation: 0, prior_receipt_reuse_approved: false },
    method: 'actual_buildLearningUnits_selectLearningQuestionSet_and_production_empty_grader', api_calls: 0,
    configured_grading_model_at_preparation: gradingModelName(), model_invoked: false, counts,
    selected_source_set_ids: [...selectedIds], inputs: [...snapshots.values()].map(({ file, sha256 }) => ({ file, sha256 })),
    code_files: [relative(self), ...codeFiles].map(file => ({ file, sha256: frozen(file).sha256 })), entries: rows,
    limitations: ['No nonempty answer was submitted to any model or replayed as an authored judgment.',
        'Empty-result success is not evidence of stored-answer semantic correctness, full model scores, signed token/DB/XP behavior, or formal semantic-review completion.',
        'Formal source QA and learning-unit projections have different prompts/scopes where indicated; receipt reuse is not assumed.'] };
fs.mkdirSync(output);
fs.mkdirSync(path.join(output, 'source-sets')); fs.mkdirSync(path.join(output, 'units'));
for (const artifact of artifacts) fs.writeFileSync(artifact.file, serialize(artifact.value), { flag: 'wx' });
fs.writeFileSync(path.join(output, 'manifest.json'), serialize(manifest), { flag: 'wx' });
fs.writeFileSync(path.join(output, 'smoke-v4-v5-comparison.json'), serialize({ version: 1, api_calls: 0, source_bank_sha256: frozen(bankFile).sha256, deltas }), { flag: 'wx' });
fs.writeFileSync(path.join(output, 'README.md'), `# runtime v6 학습 투영 smoke-v5 준비

변경 기존 ${changedIds.length}세트와 신규 ${newIds.length}세트의 ${rows.length}학습 단위(${counts.standard_units} 기준서형, ${counts.case_units} 사례형)를 실제 앱 함수로 투영했다. v4와 은행·분류·독립 발문·부모 사실·모범답안·criterion·배점·응답schema가 동일하다.

249개 실제 채점 prompt에는 새 runtime의 조건부 절차 및 독립 부정목적에 대한 지시 두 줄만 추가된다. 채점 데이터 marker 이후의 실제 payload·답안·근거 구간·출력 예시는 byte 단위로 동일하다. smoke-v4-v5-comparison.json에 249단위별 비교를 기록했다.

빈 답안 ${emptyCalls}개는 명시적인 빈 키로 생산 함수를 실행해 0점·정상 보안 결과가 v4와 동일함을 확인했다. 비빈 저장 모범답안 ${rows.length}개는 요청과 기대값 준비만 했고 모델 호출은 0회다. 과거 모델 관측을 새 결과로 승계하지 않았다.

manifest에는 확정 execution-runtime-v6와 16개 코드 및 이전 코드 보존 증거의 hash를 묶었다. 기존 b/learning-unit-smoke-v4 전체 파일과 v4 준비기·실행기·검사는 원래 바이트로 보존했다. 서명·DB·XP·UI 상호작용이나 실제 모델 만점은 이 준비로 검증한 것이 아니다. 새로운 실제 실행은 총괄 잠금 및 지시에 따른다.
`, { flag: 'wx' });
assertFrozen();
console.log(JSON.stringify({ output: relative(output), ...counts, errors: 0, manifest_sha256: sha(fs.readFileSync(path.join(output, 'manifest.json'))) }, null, 2));
