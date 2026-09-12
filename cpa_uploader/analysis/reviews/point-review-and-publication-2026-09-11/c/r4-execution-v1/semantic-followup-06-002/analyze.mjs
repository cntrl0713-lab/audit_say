import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const load = file => import(pathToFileURL(path.resolve(file)));
const { prepareSemanticReview, buildReviewChunkInput, reviewChunkSchema, groundReviewChunk } = await load('cpa_uploader/questionSemanticReview.ts');
const { validateQuestionAuthoringPlan, authoringPlanHash } = await load('cpa_uploader/questionAuthoringPlan.ts');
const { buildGradingPrompt, buildGradingResponseSchema } = await load('lib/questionV3Grading.ts');
const { jsonHash } = await load('cpa_uploader/questionReviewIdentity.ts');
const { buildSourceCatalog } = await load('cpa_uploader/questionSourceCatalog.mjs');
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const own = `${D}/c/r4-execution-v1/semantic-followup-06-002`;
const base = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01/pending-semantic-a/pilot-06-002`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const snapshots = new Map();
const text = file => { const bytes = fs.readFileSync(file); snapshots.set(file, sha(bytes)); return bytes.toString('utf8'); };
const read = file => JSON.parse(text(file));
const desc = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (name, object) => { const file = `${own}/${name}`; fs.writeFileSync(file, `${JSON.stringify(object, null, 2)}\n`, { flag: 'wx' }); return desc(file); };
const receiptFile = `${base}/semantic.json`, requestFile = `${base}/request.json`, chunksFile = `${receiptFile}.chunks.jsonl`;
assert.equal(desc(receiptFile).sha256, '2dbe2089af565df5978be0a73290ff6670d698d85dee0639e0621dc79722c9d7');
const receipt = read(receiptFile).reviews[0], request = read(requestFile);
const arg = key => request.argv[request.argv.indexOf(key) + 1];
const relative = file => path.relative(process.cwd(), file).replaceAll('\\', '/');
const setFile = relative(arg('--file')), bankFile = relative(arg('--bank')), planFile = relative(arg('--plan'));
const value = read(setFile), set = Array.isArray(value) ? value[0] : value, bank = read(bankFile), plan = read(planFile);
assert.deepEqual(bank.find(item => item.id === set.id), set);
assert.deepEqual(receipt.context.authoring_plan, plan);
for (const input of request.frozen_files) assert.equal(desc(input.file).sha256, input.sha256);
const prepared = prepareSemanticReview(set, { bank, authoringPlan: plan, maxInputChars: 500000 });
assert.equal(receipt.content_hash, prepared.contentHash); assert.equal(receipt.bank_hash, prepared.bankHash);
assert.deepEqual(receipt.context, prepared.context); assert.deepEqual(receipt.source_files, prepared.sourceFiles);
const chunks = text(chunksFile).trim().split('\n').map(JSON.parse);
const originalInputs = prepared.units.map(unit => {
  const input = buildReviewChunkInput(prepared, unit), recorded = chunks.find(row => row.unit_id === unit.id && row.response);
  assert(recorded); assert.equal(recorded.model, 'gpt-5.6-luna'); assert.equal(recorded.transport, 'model');
  assert.equal(recorded.input_hash, sha(input)); assert.equal(recorded.schema_hash, jsonHash(reviewChunkSchema(unit)));
  const grounded = groundReviewChunk(recorded.response, prepared, unit);
  assert.deepEqual(receipt.units.find(row => row.id === unit.id), grounded.units[0]);
  return { unit_id: unit.id, actual_input_hash: recorded.input_hash, actual_schema_hash: recorded.schema_hash, reconstructed_exact: true, input_chars: input.length };
});
const sourceFile = set.source_refs[0].file, sourceText = text(sourceFile), sourceLines = sourceText.split(/\r?\n/);
const catalog = buildSourceCatalog({ repoDir: process.cwd() });
const sources = set.source_refs.map(ref => {
  const start = sourceText.indexOf(ref.source_quote); assert(start >= 0);
  const firstLine = sourceText.slice(0, start).split('\n').length;
  const lastLine = sourceText.slice(0, start + ref.source_quote.length - 1).split('\n').length;
  assert.equal(sha(ref.source_quote), ref.content_hash);
  const excerpt = prepared.requestContext.source_excerpts.find(x => x.id === ref.id);
  assert.equal(excerpt.source_quote_line_start, firstLine); assert.equal(excerpt.source_quote_line_end, lastLine);
  return { source_ref_id: ref.id, file: ref.file, file_sha256: desc(ref.file).sha256,
    title: ref.title, quote_sha256: ref.content_hash, exact_start_line: firstLine, exact_end_line: lastLine,
    source_quote: ref.source_quote, actual_request_excerpt: excerpt,
    catalog_units: catalog.units.filter(unit => plan.source_unit_ids.includes(unit.id) && unit.file === ref.file)
      .filter(unit => ref.id === 'src1' ? unit.paragraph === '14' : ['16', '17', '18'].includes(unit.paragraph))
      .map(unit => ({ id: unit.id, locator: unit.locator, quote_sha256: sha(unit.quote), startLine: unit.startLine, endLine: unit.endLine })) };
});
assert.deepEqual(sources.map(s => [s.exact_start_line, s.exact_end_line]), [[99, 109], [115, 122]]);
assert.equal(sourceLines[109], '기타 원천의 정보 ');
const policyFile = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md';
const policy = text(policyFile);
assert(policy.includes('2026년 1월 1일 개시 보고기간')); assert(plan.edition_assumption.includes('2026-01-01 개시 보고기간'));
const oldReviewFile = 'cpa_uploader/analysis/reviews/question-review-2027/06.json', oldReview = read(oldReviewFile);
const rootSources = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources';
const versions = [
  { year: '2025', text: `${rootSources}/kga-2025-pymupdf-pages.txt`, pdf: `${rootSources}/kga-2025.pdf`, pages: [195, 197, 198] },
  { year: '2026', text: `${rootSources}/kga-2026-pymupdf-pages.txt`, pdf: `${rootSources}/kga-2026-full.pdf`, pages: [220, 222, 223] },
];
function pageRange(full, first, last) {
  const start = full.indexOf(`## PDF page ${first}\n`) >= 0 ? full.indexOf(`## PDF page ${first}\n`) : full.indexOf(`## PDF page ${first}\r\n`);
  const next = new RegExp(`^## PDF page ${last + 1}\\r?$`, 'm').exec(full);
  assert(start >= 0 && next && next.index > start);
  return { text: full.slice(start, next.index), offset: start };
}
function extract(full, pageStart, pageEnd, para, endText) {
  const block = pageRange(full, pageStart, pageEnd);
  const startMatch = new RegExp(`^${para}\\.[ \\t]*\\r?$`, 'm').exec(block.text); assert(startMatch);
  const end = block.text.indexOf(endText, startMatch.index); assert(end > startMatch.index);
  const value = block.text.slice(startMatch.index, end);
  const start = block.offset + startMatch.index;
  return { first_page: pageStart, last_page: pageEnd, line_start: full.slice(0, start).split('\n').length,
    line_end: full.slice(0, start + value.length - 1).split('\n').length, quote: value, quote_sha256: sha(value) };
}
const normalize = value => value.split(/\r?\n/).filter(line => !/^## PDF page \d+$/.test(line)
  && !/^감사기준서 315 /.test(line) && !/^\d+ \/ \d+\s*$/.test(line)).join('\n').replace(/\s/g, '');
const editionEvidence = versions.map(version => {
  const full = text(version.text);
  const pdfInfo = desc(version.pdf); snapshots.set(version.pdf, pdfInfo.sha256);
  const historical = oldReview.sources.find(s => s.id.includes(version.year === '2025' ? 'effective2026' : '2026-compared'));
  assert.equal(pdfInfo.sha256, historical.sha256);
  return { year: version.year, text_file: desc(version.text), pdf_file: pdfInfo, original_url_from_record: historical.url,
    paragraph10: extract(full, version.pages[0], version.pages[0], 10, '목적'),
    paragraph14: extract(full, version.pages[1], version.pages[2], 14, '기타 원천의 정보'),
    paragraph16to18: extract(full, version.pages[2], version.pages[2], 16, '기업과 기업환경, 해당 재무보고체계') };
});
for (const key of ['paragraph10', 'paragraph14', 'paragraph16to18']) assert.equal(normalize(editionEvidence[0][key].quote), normalize(editionEvidence[1][key].quote));
assert.equal(normalize(sources[0].source_quote), normalize(editionEvidence[0].paragraph14.quote));
assert.equal(normalize(sources[1].source_quote), normalize(editionEvidence[0].paragraph16to18.quote));
const effectiveQuote = sourceLines.slice(7, 10).join('\r\n');
assert(sourceText.includes(effectiveQuote));
assert.equal(normalize(effectiveQuote), normalize(editionEvidence[0].paragraph10.quote));
const clarification = {
  source_file: sourceFile, source_file_sha256: desc(sourceFile).sha256,
  locations: [
    { source_ref_id: 'src1', source_quote_lines: 'L99–L109', catalog_paragraph_lines: 'L99–L110',
      note: '직접 인용은315.14(a)~(c)를 모두 포함하는 L99–L109이다. catalog의 L110은 다음 소제목 기타 원천의 정보이므로 카탈로그 문단 범위와 직접 인용 끝줄의 차이는 인용 누락이 아니다.' },
    { source_ref_id: 'src2', source_quote_lines: 'L115–L122', quotation_paragraphs: '315.16–18',
      requirement_direct_locations: [
        { requirement_id: 'req2', existing_source_span: '315.16', direct_paragraph_lines: '315.16; L115–L117', related_criteria: ['crit4', 'crit5'] },
        { requirement_id: 'req3', existing_source_span: '315.17–18', direct_paragraph_lines: '315.17–18; L119–L122', related_criteria: ['crit6', 'crit7', 'crit8'] },
      ], note: 'req2와req3의 source_span은 각 요구의 직접 담당 문단을 가리킨다. 두 requirement의 source_quote는 공유 문맥인315.16–18 전체이며, 그 전체 인용의 실제 위치는 L115–L122이다. 직접 담당 문단과 공유 인용 전체의 위치를 구별하며, 공유 인용을 잘라내거나 요구·배점을 추가하지 않는다.' },
  ],
  edition_evidence: { paragraph: 'KGA315.10', source_span: `${sourceFile}; L8–L10`, source_quote: effectiveQuote,
    source_quote_sha256: sha(effectiveQuote),
    note: '이 기존 배치의 적용 전제는2026-01-01개시 보고기간이며,315.10은2026-01-01이후 개시 보고기간부터 시행을 정한다. 보존2025/2026 전문의315.10·14·16–18을 공백·PDF페이지 표지 차이를 구분해 대조했으며 본문이 같다. 이는 기존 edition_assumption의 근거를 명료화하는 것이고,2027시험의 최종 별도 판본 지정을 확정하지 않는다.' },
};
const proposedPlan = structuredClone(plan);
proposedPlan.metadata.source_location_and_edition_clarification = clarification;
assert.deepEqual(validateQuestionAuthoringPlan(proposedPlan), []);
const undo = structuredClone(proposedPlan); delete undo.metadata.source_location_and_edition_clarification;
assert.deepEqual(undo, plan); assert.equal(authoringPlanHash(plan), authoringPlanHash(proposedPlan));
const proposed = prepareSemanticReview(set, { bank, authoringPlan: proposedPlan, maxInputChars: 500000 });
assert.deepEqual(prepared.units, proposed.units); assert.equal(prepared.bankHash, proposed.bankHash);
const comparisons = prepared.units.map((unit, index) => {
  const beforeInput = buildReviewChunkInput(prepared, unit), afterInput = buildReviewChunkInput(proposed, proposed.units[index]);
  const restored = JSON.parse(afterInput); delete restored.authoring_plan.metadata.source_location_and_edition_clarification;
  assert.equal(JSON.stringify(restored), beforeInput); assert(afterInput.length <= 500000);
  return { unit_id: unit.id, before_actual_input_hash: sha(beforeInput), proposed_input_hash: sha(afterInput),
    schema_unchanged: jsonHash(reviewChunkSchema(unit)), before_chars: beforeInput.length, after_chars: afterInput.length };
});
const masterFile = `${D}/a/execution-all-v9/manifest.json`, master = read(masterFile), job = master.jobs.find(j => j.set_id === set.id);
const qa = read(job.qa_file), cases = Array.isArray(qa.cases) ? qa.cases : qa.cases[set.id];
const gradingEquality = cases.map(item => {
  const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === item.subquestion_id ? item.answer : '']));
  const before = buildGradingPrompt(set, answers), after = buildGradingPrompt(proposed.set, answers);
  const schema = JSON.stringify(buildGradingResponseSchema(set, answers));
  assert.equal(before, after); assert.equal(schema, JSON.stringify(buildGradingResponseSchema(proposed.set, answers)));
  return { case_id: item.id, current_prompt_sha256: sha(before), current_schema_sha256: sha(schema), unchanged: true };
});
const planOutput = write('pilot-06-002-plan.json', proposedPlan);
const changesOutput = write('changes.json', { version: 1, status: 'proposed_not_activated', before: desc(planFile), after: planOutput,
  patch: [{ op: 'add', path: '/metadata/source_location_and_edition_clarification', value: clarification }],
  inverse_patch: [{ op: 'remove', path: '/metadata/source_location_and_edition_clarification' }], inverse_deep_equal: true,
  bank_or_requirement_changes: [], source_ref_changes: [], question_answer_criteria_points_changes: [],
  rationale: '내용·원문 위치 미확보는 발견하지 않았다. 카탈로그 범위 포함·직접 담당 문단과 공유 인용 범위·명시 판본 전제라는 기존 정보를 구분하고, 같은 원문315.10의 시행 근거를 계획에 명료화한다. 기존 fail/uncertain을 pass로 바꾸지 않는다.' });
const findings = [
  { unit_id: 'criterion:sub1:crit2', classification: 'model_misread_contained_locator_ranges',
    conclusion: 'source_quote L99–109는 catalog L99–110 안에 있다. L110은 다음 소제목이다. 실제 분석적절차 원문14(b)는 L102에 있으며, 인용·원문 끝줄 일치를 강제한 uncertain은 실제 지지 결함과 구별한다.' },
  { unit_id: 'subquestion:sub2', classification: 'locator_role_ambiguity_without_missing_source_content',
    conclusion: '315.16은req2가 직접 담당하는 정보 특성이고,315.17–18은req3가 직접 담당하는 토의·전달이다. 두 요구가 공유하는 인용은16–18 전체이다. source_span을전체 인용 위치로 읽으면 표기가 좁아 보이지만, 직접 명제 문단 지정으로는 맞다. 최소안은 두 역할을 계획에 구분하며 실제 source_support fail을 수동 제거하지 않는다.' },
  { unit_id: 'criterion:sub2:crit4', classification: 'model_conflates_explicit_edition_assumption_with_final_exam_designation',
    conclusion: '원계획은2026개시 보고기간/2027후속감사 가정을 이미 명시한다. 해당315.10·14·16–18은 보존2025/2026 전문 대조가 같고315.10은2026개시 시행을 직접 뒷받침한다. 최종2027시험 판본 미지정을 이 가정의 부적합성으로 자동 취급하지 않는다. 새 시험판본 확정이나 전문전체 동일성을 주장하지 않는다.' },
  { unit_id: 'criterion:sub2:crit6', classification: 'same_shared_quote_locator_role_ambiguity',
    conclusion: '직접 토의 의무는315.17 L119–120, req3의직접범위315.17–18은 맞다. 같은 source_quote의16문단은 연결된 공유 문맥이며 자료누락이 아니다. 위req2/req3역할 명료화와 함께 후속검수할 대상이다.' },
];
for (const [file, oldHash] of snapshots) assert.equal(desc(file).sha256, oldHash);
for (const input of request.frozen_files) assert.equal(desc(input.file).sha256, input.sha256);
const report = { version: 1, status: 'local_read_only_investigation_and_plan_proposal', checked_at: new Date().toISOString(),
  set_id: set.id, original_receipt: desc(receiptFile), original_verdict: receipt.verdict,
  original_nonpass: receipt.units.filter(unit => Object.values(unit.checks).some(check => check !== 'pass')),
  original_request: desc(requestFile), original_chunks: desc(chunksFile), original_actual_inputs: originalInputs,
  input_evidence_method: '실제 chunks의input/schema해시를 현 고정 코드·은행·출처·원계획으로 재구성해 전단위 일치시켰다. 별도 HTTP body 직접 캡처라고 주장하지 않는다.',
  sources, exact_registered_lines_99_124: sourceLines.slice(98, 124).map((line, index) => ({ line: 99 + index, text: line })),
  edition: { policy: desc(policyFile), historical_source_record: desc(oldReviewFile), versions: editionEvidence,
    paragraph10_14_16to18_equal: true, registered_quotes_equal_official_after_documented_normalization: true,
    normalization: '공백과 PDF page 표지·해당315페이지 머리말·페이지 분수행만 제외. 원 인용·각주·원 파일 바이트는 변경하지 않는다.',
    original_pdf_hashes_match_historical_record: true, new_downloads: 0, new_legal_or_exam_edition_determination: false,
    limitation: '로컬 보존본과 기존 적용 정책의 직접 대조이다. 이후 공고 전체의 현행성을 새로 검색하거나2027최종시험 판본을확정한 검토가 아니다.' },
  findings, proposed_plan: planOutput, changes: changesOutput,
  semantic_impact: { changed_units_in_this_set: comparisons.length, unit_comparisons: comparisons,
    only_changed_path: '/authoring_plan/metadata/source_location_and_edition_clarification',
    content_bank_sources_targets_response_schema_unchanged: true, original_context_hash: receipt.context_hash, proposed_context_hash: jsonHash(proposed.context),
    activation: '새 계획 선택/잠금/후속 출력이 필요하며 원receipt는 재해시하지 않는다. 다른118세트는peer plan을읽지 않으므로 이계획만교체하면 그입력은불변이다.' },
  grading_impact: { qa: desc(job.qa_file), cases: gradingEquality, actual_grading_calls: 0, current_payloads_equal: true },
  not_adopted: ['src1인용을L110까지늘려다음소제목을정답근거로추가하지않는다.', 'req2/req3인용을분할해공유문맥을삭제하지않는다.', '은행의source_span을변경하는안은직접담당문단/인용범위의구별로해소가능하므로이번최소안에포함하지않는다.', '2027최종시험판본확정또는source_support/edition_scope의강제pass문구를계획에넣지않는다.'],
  static_checks: { question_authoring_plan_validator_errors: [], original_plan_restored_exact: true,
    all_source_files_original_receipt_bank_code_qa_unchanged: true, request_frozen_files_checked: request.frozen_files.length,
    inputs: [...snapshots].map(([file, sha256]) => ({ file, sha256 })) },
  api_calls: 0, human_approval: false, activation: false, publication: false, errors: [] };
const reportOutput = write('investigation.json', report);
console.log(JSON.stringify({ plan: planOutput, changes: changesOutput, investigation: reportOutput,
  actual_units_hash_matched: originalInputs.length, source_lines: sources.map(s => [s.source_ref_id, s.exact_start_line, s.exact_end_line]),
  edition_paragraphs_equal: true, unchanged_grading_cases: cases.length, errors: [] }));
