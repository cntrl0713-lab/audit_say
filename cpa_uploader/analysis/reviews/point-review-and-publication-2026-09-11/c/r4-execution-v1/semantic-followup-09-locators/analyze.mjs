import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const load = file => import(pathToFileURL(path.resolve(file)));
const { prepareSemanticReview, buildReviewChunkInput, reviewChunkSchema, groundReviewChunk } = await load('cpa_uploader/questionSemanticReview.ts');
const { validateQuestionAuthoringPlan, authoringPlanHash } = await load('cpa_uploader/questionAuthoringPlan.ts');
const { buildGradingPrompt, buildGradingResponseSchema } = await load('lib/questionV3Grading.ts');
const { jsonHash } = await load('cpa_uploader/questionReviewIdentity.ts');
const { buildSourceCatalog } = await load('cpa_uploader/questionSourceCatalog.mjs');
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const own = `${D}/c/r4-execution-v1/semantic-followup-09-locators`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const snapshots = new Map();
const text = file => { const bytes = fs.readFileSync(file); snapshots.set(file, sha(bytes)); return bytes.toString('utf8'); };
const read = file => JSON.parse(text(file));
const desc = file => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (name, value) => { const file = `${own}/${name}`; fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return desc(file); };
const sourceFile = 'cpa_uploader/data/official/kga501-505-510-2025-review09.txt';
const sourceText = text(sourceFile), lines = sourceText.split(/\r?\n/);
const catalog = buildSourceCatalog({ repoDir: process.cwd() });
const sourceUnits = catalog.units.filter(u => u.file === sourceFile && u.standard === 'KGA 505' && ['8', '10', '11'].includes(u.paragraph));
assert.equal(lines[351], '### 직접 문단 발췌');
assert.equal(lines.slice(328, 352).filter(l => /PDF/.test(l)).length, 0);
assert(!lines.slice(351, 396).some(l => /^### PDF/.test(l)));
const normalize = value => value.replace(/\s/g, '');
const rawRoot = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources';
function page(full, n) {
  const start = new RegExp(`^## PDF page ${n}\\r?$`, 'm').exec(full), end = new RegExp(`^## PDF page ${n + 1}\\r?$`, 'm').exec(full);
  assert(start && end); const value = full.slice(start.index, end.index);
  return { page: n, text: value, line_start: full.slice(0, start.index).split('\n').length, line_end: full.slice(0, end.index - 1).split('\n').length, sha256: sha(value) };
}
function paragraph(block, n, endToken) {
  const start = new RegExp(`^${n}\\.[ \\t]*\\r?$`, 'm').exec(block.text); assert(start);
  const end = endToken ? block.text.indexOf(endToken, start.index + start[0].length) : block.text.length;
  assert(end > start.index); return block.text.slice(start.index, end).trim();
}
const editions = [
  { year: 2025, text: `${rawRoot}/kga-2025-pymupdf-pages.txt`, pdf: `${rawRoot}/kga-2025.pdf`, pages: [402, 403, 409] },
  { year: 2026, text: `${rawRoot}/kga-2026-pymupdf-pages.txt`, pdf: `${rawRoot}/kga-2026-full.pdf`, pages: [428, 429, 435] },
].map(v => {
  const full = text(v.text), blocks = v.pages.map(n => page(full, n)); snapshots.set(v.pdf, desc(v.pdf).sha256);
  return { year: v.year, raw_file: desc(v.text), pdf_file: desc(v.pdf), pages: blocks,
    paragraphs: { '8': paragraph(blocks[0], 8), '10': paragraph(blocks[1], 10, '11.'), '11': paragraph(blocks[1], 11, '미회신') } };
});
for (const n of ['8', '10', '11']) assert.equal(normalize(editions[0].paragraphs[n]), normalize(editions[1].paragraphs[n]));
const exactOriginalParagraphs = { '8': lines.slice(246, 254).join('\n'), '10': lines.slice(264, 267).join('\n'), '11': lines.slice(267, 270).join('\n') };
for (const n of ['8', '10', '11']) assert.equal(normalize(exactOriginalParagraphs[n]), normalize(editions[0].paragraphs[n]));
for (const u of sourceUnits) {
  const unitText = lines.slice(u.startLine - 1, u.endLine).join('\n');
  assert(normalize(unitText).includes(normalize(exactOriginalParagraphs[u.paragraph])));
}
const catalogEvidence = sourceUnits.map(u => ({ id: u.id, paragraph: u.paragraph, registered_page: u.page, startLine: u.startLine, endLine: u.endLine,
  locator: u.locator, quote_sha256: sha(u.quote), expected_original_pdf_page: u.paragraph === '8' ? 402 : 403,
  role: u.startLine >= 352 ? 'repeated_direct_excerpt_without_own_page_marker' : 'original_page_transcription',
  normalized_contains_same_original_paragraph: true }));
const master = read(`${D}/a/execution-all-v9/manifest.json`);
const results = [];
for (const id of ['pilot-09-003', 'pilot-09-005']) {
  const base = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01/pending-semantic-a/${id}`;
  const receiptFile = `${base}/semantic.json`, requestFile = `${base}/request.json`, chunksFile = `${receiptFile}.chunks.jsonl`;
  const receipt = read(receiptFile).reviews[0], request = read(requestFile), job = master.jobs.find(j => j.set_id === id);
  const setValue = read(job.file), set = Array.isArray(setValue) ? setValue[0] : setValue;
  const bank = read(master.bank_file), plan = read(job.plan_file);
  assert.deepEqual(bank.find(s => s.id === id), set); assert.deepEqual(receipt.context.authoring_plan, plan);
  for (const input of request.frozen_files) assert.equal(desc(input.file).sha256, input.sha256);
  const before = prepareSemanticReview(set, { bank, authoringPlan: plan, maxInputChars: 500000 });
  assert.deepEqual(receipt.context, before.context); assert.equal(receipt.content_hash, before.contentHash); assert.equal(receipt.bank_hash, before.bankHash);
  const chunks = text(chunksFile).trim().split('\n').map(JSON.parse);
  const actual = before.units.map(unit => {
    const input = buildReviewChunkInput(before, unit), row = chunks.find(c => c.unit_id === unit.id && c.response);
    assert(row); assert.equal(row.input_hash, sha(input)); assert.equal(row.schema_hash, jsonHash(reviewChunkSchema(unit)));
    assert.equal(row.model, 'gpt-5.6-luna'); assert.equal(row.transport, 'model');
    assert.deepEqual(receipt.units.find(u => u.id === unit.id), groundReviewChunk(row.response, before, unit).units[0]);
    return { unit_id: unit.id, actual_input_hash: row.input_hash, actual_schema_hash: row.schema_hash, reconstructed_exact: true };
  });
  const sourceEvidence = set.source_refs.map(ref => {
    const i = sourceText.indexOf(ref.source_quote); assert(i >= 0); assert.equal(sha(ref.source_quote), ref.content_hash);
    const start = sourceText.slice(0, i).split('\n').length, end = sourceText.slice(0, i + ref.source_quote.length - 1).split('\n').length;
    const excerpt = before.requestContext.source_excerpts.find(s => s.id === ref.id);
    assert.equal(excerpt.source_quote_line_start, start); assert.equal(excerpt.source_quote_line_end, end);
    return { source_ref_id: ref.id, file: ref.file, quote_sha256: ref.content_hash, exact_start_line: start, exact_end_line: end,
      source_quote: ref.source_quote, actual_request_excerpt: excerpt,
      actual_matched_units: receipt.context.source_metadata.find(s => s.source_ref_id === ref.id).matched_units };
  });
  const clarification = {
    purpose: '확인된 원전 쪽수와 뒤쪽 반복 발췌의 카탈로그 상속 쪽수를 구분하는 후속 위치 설명이다. 기존 uncertain을 통과로 재작성하지 않는다.',
    official_file: sourceFile, official_file_sha256: desc(sourceFile).sha256,
    direct_locations: [
      { paragraph: 'KGA 505.8(a)–(c)', official_pdf_2025_page: 402, registered_quote_lines: 'L247–254', repeated_quote_lines: 'L365–372' },
      { paragraph: 'KGA 505.10', official_pdf_2025_page: 403, registered_quote_lines: 'L265–267', repeated_quote_lines: ['L381–383', 'L389–391'] },
      { paragraph: 'KGA 505.11', official_pdf_2025_page: 403, registered_quote_lines: 'L268–270', repeated_quote_lines: ['L384–386', 'L394–396'] },
    ],
    registration_limitation: 'L352 직접 문단 발췌 이후 같은 문단이 다시 수록되었으나 새 PDF 쪽 표지가 없다. 따라서 반복 단위의 catalog page=409는 앞선 L328의 PDF409를 상속한 부정확한 메타데이터이다. 원전 PDF409에는 A23의 계속과 A24–A25가 있으며 본문8·10·11이 있지 않다. 같은 출처 인용의 본문 차이나 판본 차이를 뜻하지 않는다.',
    catalog_unit_ids_preserved: catalogEvidence.map(u => u.id),
    original_pdf: editions[0].pdf_file, original_extract: editions[0].raw_file,
    edition_limit: '원문8·10·11은 보존2025/2026 전문에서 공백을 제외한 내용이 같다. 2026년 개시 보고기간이라는 기존 적용 가정은 그대로이며, 전문 전체 동일성 또는 2027시험 최종 판본 지정을 새로 주장하지 않는다.',
    source_mapping_note: '아래 source_mapping_evidence의 page는 확인된 원전 쪽수로 명료화하고 registered_page는 당시 카탈로그 값을 보존한다. catalog ID·원파일·quote·receipt·현재 등록정보를 이 제안에서 바꾸지 않는다.',
  };
  const proposed = structuredClone(plan), patches = [];
  for (let i = 0; i < proposed.metadata.source_mapping_evidence.length; i++) {
    const group = proposed.metadata.source_mapping_evidence[i];
    for (let j = 0; j < group.units.length; j++) {
      const u = group.units[j]; if (u.file !== sourceFile || u.page !== 409 || !['8', '10', '11'].includes(u.paragraph)) continue;
      const pointer = `/metadata/source_mapping_evidence/${i}/units/${j}`;
      const old = structuredClone(u); u.registered_page = 409; u.page = u.paragraph === '8' ? 402 : 403;
      u.page_evidence = '동일 파일의 앞선 PDF402/403 본문 및 보존2025 전문 직접대조; 뒤쪽 반복발췌에 새 PDF 쪽표시 없음';
      patches.push({ op: 'replace', path: pointer, before: old, after: structuredClone(u) });
    }
  }
  proposed.metadata.source_location_clarification = clarification;
  patches.push({ op: 'add', path: '/metadata/source_location_clarification', after: clarification });
  assert.deepEqual(validateQuestionAuthoringPlan(proposed), []); assert.equal(authoringPlanHash(plan), authoringPlanHash(proposed));
  function restore(value) { for (const patch of [...patches].reverse()) { const keys = patch.path.split('/').slice(1); let obj = value; for (const key of keys.slice(0, -1)) obj = obj[key]; if (patch.op === 'add') delete obj[keys.at(-1)]; else obj[keys.at(-1)] = structuredClone(patch.before); } return value; }
  assert.deepEqual(restore(structuredClone(proposed)), plan);
  const after = prepareSemanticReview(set, { bank, authoringPlan: proposed, maxInputChars: 500000 });
  assert.deepEqual(before.units, after.units); assert.equal(before.bankHash, after.bankHash); assert.deepEqual(before.sourceFiles, after.sourceFiles);
  const comparisons = before.units.map((unit, i) => {
    const oldInput = buildReviewChunkInput(before, unit), newInput = buildReviewChunkInput(after, after.units[i]);
    const restoredInput = JSON.parse(newInput); restore(restoredInput.authoring_plan);
    assert.equal(JSON.stringify(restoredInput), oldInput); assert(newInput.length <= 500000);
    return { unit_id: unit.id, before_hash: sha(oldInput), after_hash: sha(newInput), before_chars: oldInput.length, after_chars: newInput.length,
      schema_sha256: jsonHash(reviewChunkSchema(unit)), only_authoring_plan_metadata_changed: true };
  });
  const qa = read(job.qa_file), grading = qa.cases.map(c => {
    const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === c.subquestion_id ? c.answer : '']));
    const prompt = buildGradingPrompt(set, answers), schema = JSON.stringify(buildGradingResponseSchema(set, answers));
    assert.equal(prompt, buildGradingPrompt(after.set, answers)); assert.equal(schema, JSON.stringify(buildGradingResponseSchema(after.set, answers)));
    return { case_id: c.id, prompt_sha256: sha(prompt), schema_sha256: sha(schema), unchanged: true };
  });
  const outputPlan = write(`${id}-plan.json`, proposed);
  results.push({ set_id: id, original_receipt: desc(receiptFile), original_verdict: receipt.verdict, original_request: desc(requestFile), original_chunks: desc(chunksFile),
    nonpass: receipt.units.filter(u => Object.values(u.checks).some(v => v !== 'pass')).map(u => ({ id: u.id, checks: u.checks, rationale: u.rationale })),
    original_actual_input_checks: actual, source_evidence: sourceEvidence, original_plan: desc(job.plan_file), proposed_plan: outputPlan, patches,
    inverse_deep_equal: true, semantic_unit_comparisons: comparisons, current_context_hash: receipt.context_hash, proposed_context_hash: jsonHash(after.context),
    author_qa: desc(job.qa_file), unchanged_grading_payloads: grading });
}
for (const [file, hash] of snapshots) assert.equal(desc(file).sha256, hash);
const report = { version: 1, status: 'local_evidence_and_inactive_plan_proposals', checked_at: new Date().toISOString(),
  conclusion: '실제 등록 메타데이터의 쪽수 상속 오류이다. 모델이 없던 충돌을 발명한 것이 아니며 원문 요구·답안의 지지 결함도 아니다. 본문8은PDF402,10·11은PDF403이다. 기존 source_span은 정확하다.',
  source: desc(sourceFile), catalog_evidence: catalogEvidence, edition_evidence: editions,
  source_normalization: '공백만 제거하여 직접 본문을 대조했다. 원PDF·전문추출·등록파일·인용 바이트는 변경하지 않았다.',
  results, followup_scope: '본 제안은 두 계획의 metadata만 수정하고 source_unit_ids 및 실질 plan 요구를 보존한다. 정식 선택과 새 잠금 후 해당 두 세트 의미검수의 새 입력이 필요하며 원 receipt는 재해시/승계하지 않는다. 학생채점 payload 및 다른117세트 semantic 입력은 이 계획에 의존하지 않는다.',
  residual_registration_issue: '현재 catalog의 반복 발췌 page=409는 그대로 남는다. 향후 공통 소유자가 원문·ID·기존receipt를 보존하는 별도 위치 메타데이터 보완을 검토해야 한다. 이번 파일은 이 오류를 은폐하지 않고 명시적 원전대조 정보로 제공한다.',
  actual_input_method: '원 chunks의 input/schema 해시를 현행 동결 코드·은행·출처·계획으로 재구성하고 원 모델 응답을 재ground하여 전21단위 동일성 확인. 별도 직접 HTTP 요청 캡처라고 주장하지 않는다.',
  immutable_inputs: [...snapshots].map(([file, sha256]) => ({ file, sha256 })),
  static_errors: [], api_calls: 0, activated: false, human_approval: false, publication: false, db_writes: 0 };
const evidence = write('investigation.json', report);
const changes = write('changes.json', { version: 1, status: 'proposed_not_activated', evidence, entries: results.map(r => ({ set_id: r.set_id, before: r.original_plan, after: r.proposed_plan, patches: r.patches, inverse_deep_equal: true })), bank_changes: [], source_changes: [], source_unit_id_changes: [], question_answer_criterion_point_changes: [] });
console.log(JSON.stringify({ evidence, changes, plans: results.map(r => r.proposed_plan), actual_units_checked: results.reduce((n, r) => n + r.original_actual_input_checks.length, 0), unchanged_qa_payloads: results.reduce((n, r) => n + r.unchanged_grading_payloads.length, 0), errors: [] }));
