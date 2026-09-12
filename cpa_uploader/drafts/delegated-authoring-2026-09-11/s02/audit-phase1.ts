import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateQuestionSetV3, computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
import { prepareSemanticReview } from '../../../questionSemanticReview.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { draftConflicts } from '../../../questionDraftInventory.ts';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s02';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const manifest = read(`${folder}/draft-manifest.json`);
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const initialFile = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json';
const initial = read(initialFile);
const n02 = read('cpa_uploader/drafts/delegated-authoring-2026-09-11/n02/draft-manifest.json').sets.map((s: any) => read(s.file)[0]);
const n03 = read('cpa_uploader/drafts/delegated-authoring-2026-09-11/n03/draft-manifest.json').sets.map((s: any) => read(s.file)[0]);
const comparison = [...initial, ...n02, ...n03];
const sets = manifest.sets.map((s: any) => read(s.file)[0]);
const catalog = buildSourceCatalog();
const results = manifest.sets.map((m: any, i: number) => {
  const set = sets[i], plan = read(m.plan);
  let semanticPreparation;
  try { const p = prepareSemanticReview(set, { bank: [...comparison, ...sets.filter((_: any, j: number) => i !== j)], authoringPlan: plan, maxInputChars: 400000 }); semanticPreparation = { success: true, request_chars: p.requestChars, explicit_max_input_chars: 400000, bank_hash: p.bankHash, units: p.units.length, content_hash: p.contentHash }; }
  catch (error) { semanticPreparation = { success: false, error: String(error) }; }
  const qaFile = `${folder}/qa-cases-${m.plan_id.toLowerCase()}.json`;
  const qaErrors: string[] = [];
  let qaCount = 0, coverage = [];
  if (fs.existsSync(qaFile)) {
    const qa = read(qaFile); qaCount = qa.cases.length;
    if (qa.version !== 1 || qa.artifact_type !== 'author_expected_judgments' || qa.set_id !== set.id || qa.draft_sha256 !== hash(fs.readFileSync(m.file))) qaErrors.push('QA 형상·문항 해시 연결 오류');
    if (new Set(qa.cases.map((c: any) => c.id)).size !== qa.cases.length) qaErrors.push('중복 사례 ID');
    for (const sample of qa.cases) {
      const q = set.subquestions.find((q: any) => q.id === sample.subquestion_id);
      if (!q || typeof sample.answer !== 'string' || sample.expected_verdicts.length !== q.criteria.length || new Set(sample.expected_verdicts.map((v: any) => v.criterion_id)).size !== q.criteria.length) { qaErrors.push(`${sample.id}: QA 물음/criterion 형상`); continue; }
      const sum = sample.expected_verdicts.reduce((n: number, v: any) => n + (v.verdict === 'met' ? 1 : 0), 0);
      if (!Number.isInteger(sample.expected_points) || sum !== sample.expected_points || sample.expected_verdicts.some((v: any) => !q.criteria.some((c: any) => c.id === v.criterion_id) || !['met', 'not_met', 'contradicted'].includes(v.verdict))) qaErrors.push(`${sample.id}: 기대점수·명제 연결 오류`);
    }
    coverage = set.subquestions.flatMap((q: any) => q.criteria.map((c: any) => ({ subquestion_id: q.id, criterion_id: c.id,
      cases: qa.cases.filter((s: any) => s.subquestion_id === q.id && s.note.includes(`target=${c.id};`)).map((s: any) => ({ id: s.id, kind: s.kind })),
      full_and_empty_present: ['model_answer', 'empty_answer'].every(kind => qa.cases.some((s: any) => s.subquestion_id === q.id && s.kind === kind)) })));
    for (const item of coverage) if (!['paraphrase', 'omission', 'opposite', 'condition_boundary'].every(kind => item.cases.some((c: any) => c.kind === kind)) || !item.full_and_empty_present) qaErrors.push(`${item.subquestion_id}/${item.criterion_id}: 필수 종류 부족`);
  } else qaErrors.push('QA 파일 미작성');
  return { set_id: set.id, file: m.file, sha256: hash(fs.readFileSync(m.file)), plan: m.plan, plan_sha256: hash(fs.readFileSync(m.plan)),
    structural: validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: process.cwd() }), plan_errors: validateQuestionAuthoringPlan(plan),
    source_errors: set.source_refs.flatMap((r: any) => { const unit = catalog.units.find((u: any) => u.id === r.id); return !unit || unit.quote !== r.source_quote || unit.contentHash !== r.content_hash || !unit.topicIds.includes(set.classification.topic_id) ? [r.id] : []; }),
    semantic_preparation: semanticPreparation, qa_file: qaFile, qa_sha256: fs.existsSync(qaFile) ? hash(fs.readFileSync(qaFile)) : null, qa_count: qaCount, qa_errors: qaErrors, criterion_qa_coverage: coverage, points: computeQuestionSetMaxPoints(set) };
});
const inMemory = validateAuthoringBank([...bank, ...sets]);
const result = { checked_at: new Date().toISOString(), phase: 'phase1_no_model_calls', catalog_fingerprint: catalog.fingerprint,
  comparison_file: initialFile, comparison_sha256: hash(fs.readFileSync(initialFile)), initial_sets: initial.length, n02_additional_sets: n02.length, n03_additional_sets: n03.length, comparison_sets_before_own_peers: comparison.length, comparison_is_final: false,
  results, in_memory_bank: inMemory, conflicts: draftConflicts(sets, comparison),
  counts: { sets: sets.length, questions: sets.reduce((n: number, s: any) => n + s.subquestions.length, 0), criteria: results.reduce((n: number, r: any) => n + r.points, 0), points: results.reduce((n: number, r: any) => n + r.points, 0), qa_cases: results.reduce((n: number, r: any) => n + r.qa_count, 0) },
  model_review_executed: false, model_grading_executed: false, bank_written: false };
const file = `${folder}/evidence/phase1/static-${Date.now()}.json`;
fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(`${folder}/evidence/phase1/latest-static.json`, JSON.stringify({ file, sha256: hash(fs.readFileSync(file)) }, null, 2) + '\n');
console.log(JSON.stringify({ counts: result.counts, in_memory_errors: inMemory.errors, conflicts: result.conflicts, sets: results.map((r: any) => ({ id: r.set_id, errors: r.structural.errors, warnings: r.structural.warnings, plan_errors: r.plan_errors, source_errors: r.source_errors, qa_errors: r.qa_errors, semantic: r.semantic_preparation })) }, null, 2));
