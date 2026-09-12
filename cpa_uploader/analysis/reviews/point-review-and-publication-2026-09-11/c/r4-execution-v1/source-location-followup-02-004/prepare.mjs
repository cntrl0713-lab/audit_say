import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const loadModule = file => import(pathToFileURL(path.resolve(file)));
const { prepareSemanticReview, buildReviewChunkInput, reviewChunkSchema, groundReviewChunk } = await loadModule('cpa_uploader/questionSemanticReview.ts');
const { validateQuestionAuthoringPlan, authoringPlanHash } = await loadModule('cpa_uploader/questionAuthoringPlan.ts');
const { buildGradingPrompt, buildGradingResponseSchema } = await loadModule('lib/questionV3Grading.ts');
const { buildSourceCatalog } = await loadModule('cpa_uploader/questionSourceCatalog.mjs');
const { jsonHash } = await loadModule('cpa_uploader/questionReviewIdentity.ts');
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const R = `${D}/execution-resumes/resume-2026-09-12-v4`;
const own = `${D}/c/r4-execution-v1/source-location-followup-02-004`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const desc = file => ({ file, sha256: hash(file) });
const write = (name, value) => {
  const file = `${own}/${name}`;
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return desc(file);
};
const freezeFile = `${R}/frozen-inputs.json`;
const freeze = read(freezeFile);
assert.equal(hash(freezeFile), '2d037253d8fc7955906f141014a9e3a1caf5b47e65dad436d940b7abc181deef');
for (const item of freeze.files) assert.equal(hash(item.file), item.sha256);
const manifestFile = `${R}/remaining/manifest.json`;
assert.equal(hash(manifestFile), '4779c9882a4c54bda3b3e3344e5962a7e5508ea0b8482b868043eaca56ad4f2b');
const manifest = read(manifestFile);
const job = manifest.jobs.find(item => item.set_id === 'pilot-02-004');
const value = read(job.file), set = Array.isArray(value) ? value[0] : value;
const bank = read(manifest.bank_file);
const originalPlan = read(job.plan_file);
assert.equal(hash(job.plan_file), job.plan_sha256);
assert.deepEqual(set, bank.find(item => item.id === set.id));
const ref = set.source_refs.find(item => item.id === 'src-point-a-200-a49');
const sourceText = fs.readFileSync(ref.file, 'utf8');
const offset = sourceText.indexOf(ref.source_quote);
assert(offset >= 0);
assert.equal(sourceText.indexOf(ref.source_quote, offset + 1), -1);
const lastOffset = offset + ref.source_quote.length - 1;
const startLine = sourceText.slice(0, offset).split('\n').length;
const endLine = sourceText.slice(0, lastOffset).split('\n').length;
assert.equal(startLine, 47); assert.equal(endLine, 59);
assert.equal(sha(ref.source_quote), ref.content_hash);
assert.equal(sourceText.split('\n').slice(46, 59).join('\n').replace(/\r$/, ''), ref.source_quote);
const sub = set.subquestions.find(item => item.id === 'sub2');
const requirement = sub.requirements.find(item => item.source_ref_id === ref.id);
assert(requirement);
assert.equal(requirement.source_quote.replace(/\r\n/g, '\n'), ref.source_quote.replace(/\r\n/g, '\n'));
const catalog = buildSourceCatalog({ repoDir: process.cwd() });
const catalogUnits = ['src-a3433555bf0ebb247e', 'src-1ed8588c41aa44d8af'].map(id => {
  const unit = catalog.units.find(item => item.id === id);
  assert(unit && unit.file === ref.file && ref.source_quote.includes(unit.quote));
  return { id, file: unit.file, locator: unit.locator, quote_sha256: sha(unit.quote) };
});
const preparedBefore = prepareSemanticReview(set, { bank, authoringPlan: originalPlan, maxInputChars: 500000 });
const receiptFile = `${R}/remaining/semantic-a/${set.id}/semantic.json`;
const chunksFile = `${receiptFile}.chunks.jsonl`;
const requestFile = `${R}/remaining/semantic-a/${set.id}/request.json`;
const chunks = fs.readFileSync(chunksFile, 'utf8').trim().split('\n').map(JSON.parse);
const receipt = read(receiptFile).reviews[0];
const targetId = 'criterion:sub2:crit5';
const targetUnit = preparedBefore.units.find(item => item.id === targetId);
const originalInput = buildReviewChunkInput(preparedBefore, targetUnit);
const excerpt = JSON.parse(originalInput).source_excerpts.find(item => item.id === ref.id);
assert.equal(excerpt.source_quote_line_start, 47); assert.equal(excerpt.source_quote_line_end, 59);
const targetChunk = chunks.find(item => item.unit_id === targetId && item.response);
assert.equal(sha(originalInput), targetChunk.input_hash);
assert.equal(targetChunk.response.checks.source_support, 'uncertain');
assert.equal(receipt.verdict, 'uncertain');
const addition = {
  source_ref_id: ref.id,
  file: ref.file,
  source_quote_sha256: ref.content_hash,
  source_quote_line_start: 47,
  source_quote_line_end: 59,
  location_note: '기존 source_excerpts의 이 source_ref에는 실제 인용 위치 source_quote_line_start=47, source_quote_line_end=59가 이미 제공된다. 같은 파일 L47–59의 연속 인용은 KGA 200 A49의 PDF 22–23쪽에 걸친 본문·각주·페이지 표지를 포함하며, L47–52와 L55–59의 카탈로그 단위는 그 인용의 부분 위치이므로 개별 단위 끝을 전체 인용 끝으로 해석하지 않는다.'
};
const nextPlan = structuredClone(originalPlan);
assert(!Object.hasOwn(nextPlan.metadata, 'source_location_clarification'));
nextPlan.metadata.source_location_clarification = addition;
const undo = structuredClone(nextPlan);
delete undo.metadata.source_location_clarification;
assert.deepEqual(undo, originalPlan);
assert.deepEqual(validateQuestionAuthoringPlan(nextPlan), []);
assert.equal(authoringPlanHash(nextPlan), authoringPlanHash(originalPlan));
const preparedAfter = prepareSemanticReview(set, { bank, authoringPlan: nextPlan, maxInputChars: 500000 });
assert.equal(preparedAfter.contentHash, preparedBefore.contentHash);
assert.equal(preparedAfter.bankHash, preparedBefore.bankHash);
assert.deepEqual(preparedAfter.units, preparedBefore.units);
assert.deepEqual(preparedAfter.sourceFiles, preparedBefore.sourceFiles);
assert.deepEqual(preparedAfter.sources, preparedBefore.sources);
const contextUndo = structuredClone(preparedAfter.requestContext);
delete contextUndo.authoring_plan.metadata.source_location_clarification;
assert.deepEqual(contextUndo, preparedBefore.requestContext);
const unitComparisons = preparedBefore.units.map((unit, index) => {
  const beforeInput = buildReviewChunkInput(preparedBefore, unit);
  const afterUnit = preparedAfter.units[index];
  const afterInput = buildReviewChunkInput(preparedAfter, afterUnit);
  const original = chunks.find(item => item.unit_id === unit.id && item.response);
  assert(original);
  assert.equal(original.transport, 'model'); assert.equal(original.model, 'gpt-5.6-luna');
  assert.equal(sha(beforeInput), original.input_hash);
  assert.equal(jsonHash(reviewChunkSchema(unit)), original.schema_hash);
  groundReviewChunk(original.response, preparedBefore, unit);
  assert.deepEqual(reviewChunkSchema(unit), reviewChunkSchema(afterUnit));
  const restoredInput = JSON.parse(afterInput);
  delete restoredInput.authoring_plan.metadata.source_location_clarification;
  assert.equal(JSON.stringify(restoredInput), beforeInput);
  assert.notEqual(sha(beforeInput), sha(afterInput));
  assert(afterInput.length <= 500000);
  return { unit_id: unit.id, original_actual_input_hash: original.input_hash,
    original_reconstructed_input_hash: sha(beforeInput), proposed_input_hash: sha(afterInput),
    schema_hash_unchanged: original.schema_hash, before_chars: beforeInput.length,
    after_chars: afterInput.length, only_changed_path: '/authoring_plan/metadata/source_location_clarification' };
});
const qa = read(job.qa_file);
const cases = Array.isArray(qa.cases) ? qa.cases : qa.cases[set.id];
assert(Array.isArray(cases));
const gradingComparisons = cases.map(item => {
  const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === item.subquestion_id ? item.answer : '']));
  const beforePrompt = buildGradingPrompt(set, answers), afterPrompt = buildGradingPrompt(preparedAfter.set, answers);
  const beforeSchema = JSON.stringify(buildGradingResponseSchema(set, answers));
  const afterSchema = JSON.stringify(buildGradingResponseSchema(preparedAfter.set, answers));
  assert.equal(beforePrompt, afterPrompt); assert.equal(beforeSchema, afterSchema);
  return { case_id: item.id, prompt_sha256: sha(beforePrompt), schema_sha256: sha(beforeSchema), unchanged: true };
});
const planOutput = write('pilot-02-004-plan.json', nextPlan);
const changeOutput = write('changes.json', {
  version: 1, status: 'proposed_plan_only_not_activated', set_id: set.id,
  before: desc(job.plan_file), after: planOutput,
  patch: [{ op: 'add', path: '/metadata/source_location_clarification', value: addition }],
  inverse_patch: [{ op: 'remove', path: '/metadata/source_location_clarification' }],
  inverse_deep_equal: true, authoring_plan_core_hash_unchanged: authoringPlanHash(nextPlan),
  note: 'authoringPlanHash는 metadata를 제외하지만 formal semantic context_hash와 모든 이 세트의 chunk input_hash는 달라진다. 기존 receipt의 해시를 갱신하거나 pass로 승계하지 않는다.',
  immutable: { bank: desc(manifest.bank_file), set: desc(job.file), qa: desc(job.qa_file), original_receipt: desc(receiptFile) }
});
for (const item of freeze.files) assert.equal(hash(item.file), item.sha256);
const report = {
  version: 1, status: 'api0_local_location_check_and_proposed_plan', checked_at: new Date().toISOString(),
  set_id: set.id, target_unit_id: targetId,
  finding: '실제 입력에 이미 전달된 줄 위치를 모델이 놓쳤다. 원자료 미확보·인용 누락 또는 문항의 정답/배점 결함으로 분류하지 않는다.',
  original_evidence: { manifest: desc(manifestFile), request: desc(requestFile), receipt: desc(receiptFile), chunks: desc(chunksFile),
    verdict: receipt.verdict, source_support: targetChunk.response.checks.source_support, rationale: targetChunk.response.rationale,
    input_hash: targetChunk.input_hash, model: targetChunk.model, transport: targetChunk.transport },
  actual_input_evidence_method: '실행 당시 raw에 기록된 input_hash/schema_hash와 고정 코드·은행·문항·계획·원문으로 재구성한 입력의 exact hash를 전7단위에서 일치시켰다. 아래 excerpt는 그 해시 결속 재구성에서 추출했으며 별도 HTTP body 직접 캡처라고 주장하지 않는다.',
  source: { ...desc(ref.file), source_ref_id: ref.id, source_quote_sha256: ref.content_hash,
    utf8_exact_substring: true, occurrence_count: 1, line_start: startLine, line_end: endLine,
    full_lines_exact: true, source_quote: ref.source_quote,
    requirement_id: requirement.id, requirement_source_span: requirement.source_span,
    requirement_quote_newline_only_difference: requirement.source_quote !== ref.source_quote,
    requirement_quote_lf_normalized_equal: true, catalog_units: catalogUnits,
    catalog_scope_note: '두 실제 단위는 전체 인용의 부분이다. 원문 각주·페이지 경계·연속 결론을 삭제하지 않는다. 새 권위·판본 또는 시험 적용일 판단은 하지 않았다.' },
  preexisting_actual_request_excerpt: excerpt,
  proposed_plan: planOutput, changes: changeOutput,
  semantic_impact: { units: unitComparisons, changed_units: unitComparisons.length,
    unchanged_units_in_this_set: 0, only_plan_metadata_changed: true, content_hash_unchanged: preparedBefore.contentHash,
    comparison_bank_hash_unchanged: preparedBefore.bankHash,
    old_context_hash: jsonHash(preparedBefore.context), proposed_context_hash: jsonHash(preparedAfter.context),
    source_files_sources_targets_required_fields_response_schema_unchanged: true,
    other_sets: '다른 세트는 peer plan을 입력하지 않으므로 이 계획의 선택만 바뀌면 다른118세트의 입력은 바뀌지 않는다. 현재 manifest/선택은 수정하지 않았다.',
    followup_boundary: '제안 채택 시 새 계획 경로·SHA와 새 실행 잠금/출력으로 후속 의미검수해야 한다. 원 uncertain 및 원 사례는 별도로 보존한다. 1점 허용은 source_support 판정을 대신하지 않는다.' },
  grading_impact: { qa_file: desc(job.qa_file), cases: gradingComparisons, total_cases: cases.length,
    original_answers_expectations_unchanged: true, current_prompt_schema_identical: true,
    no_new_model_observations: true, statement: '문항/학생답안/채점코드가 같고 plan은 학생 grader 입력에 쓰이지 않는다. 이는 입력 동일성 검사이며 현재 QA의 실측 통과를 새로 주장하지 않는다.' },
  invariance: { freeze: desc(freezeFile), files_checked_before_and_after: freeze.files.length,
    validator_errors: [], original_plan_undo_exact: true, bank_source_question_answer_criteria_points_qa_runtime_receipts_unchanged: true },
  api_calls: 0, activated: false, human_review: false, publication: false, errors: []
};
const reportOutput = write('verification.json', report);
console.log(JSON.stringify({ plan: planOutput, changes: changeOutput, verification: reportOutput,
  actual_source_lines: [47, 59], actual_input_hash_matched: true, changed_semantic_units: unitComparisons.length,
  unchanged_grading_cases: cases.length, frozen_files_preserved: freeze.files.length, errors: [] }));
