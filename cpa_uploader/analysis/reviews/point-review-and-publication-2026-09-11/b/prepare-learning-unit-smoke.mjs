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
const review = path.resolve(owned, '..'), prepared = path.join(review, 'prepared-reviewed-v3');
const output = path.join(owned, 'learning-unit-smoke-v1');
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
const manifest = { version: 1, created_at: new Date().toISOString(), status: 'app_projection_and_empty_path_checked_nonempty_model_smoke_not_run',
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
fs.writeFileSync(path.join(output, 'README.md'), `# 실제 학습 단위의 최소 smoke 준비\n\n대상은 변경 기존 ${changedIds.length}세트와 신규 ${newIds.length}세트, 총 ${sets.length}세트이다. 전체 은행 ${summary.combined.learning_units}단위로 확대하지 않았다. 실제 앱 함수로 ${rows.length}학습 단위(${counts.standard_units} 기준서형, ${counts.case_units} 사례형)를 투영했다.\n\n각 units 파일에는 원 세트 snapshot 연결, 분류 판본, 실제 앱 채점 body, 모든 선택 물음에 저장 모범답안을 채운 기대값, 빈 답안의 생산 실행 결과가 있다. 사례형은 같은 부모의 모든 case 물음을 함께 담고 기준서형은 한 물음·부모 사실 없음·독립 발문을 확인했다.\n\n빈 답안 ${emptyCalls}개는 명시적인 빈 API 키로 생산 채점기를 실행하여 0점·보안 플래그 없음·전체 criterion not_met를 확인했다. 모델 호출은 0회다. 비빈 모범답안 ${rows.length}개는 준비만 했으며 모델 만점을 확인한 결과가 아니다.\n\nformal source 전체 입력과 비교하여 ${counts.formal_request_changed_units}단위의 buildGradingPrompt, ${counts.formal_schema_changed_units}단위의 응답 schema가 달라진다. ${counts.multi_question_case_units}사례 단위는 여러 물음에 동시에 답하는 조합이므로 물음별 단독 QA와 구분한다. 기존 receipt의 재사용을 승인하지 않았고 후속 실제 호출 대상을 manifest에 남겼다.\n\n이 묶음은 서명 토큰·DB 저장·경험치·실제 UI 상호작용 검증이 아니다. 원문·카탈로그·현재 실행 manifest·공통 코드는 변경하지 않았다.\n`, { flag: 'wx' });
assertFrozen();
console.log(JSON.stringify({ output: relative(output), ...counts, errors: 0, manifest_sha256: sha(fs.readFileSync(path.join(output, 'manifest.json'))) }, null, 2));
