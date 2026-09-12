import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateQuestionSetV3, computeQuestionSetMaxPoints, compilePublicQuestionSet } from '../../../lib/questionV3.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../lib/questionV3.ts';
import { applyQuestionSetJudgment } from '../../../lib/questionV3Grading.ts';
import { readQuestionAuthoringPlans } from '../../questionAuthoringPlan.ts';
import { readQuestionBank, draftConflicts, readPendingDrafts } from '../../questionDraftInventory.ts';
import { validateAuthoringBank } from '../../questionBankPublication.ts';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
const files = fs.readdirSync(base).filter(n => /^draft-\d{2}-\d{3}-freq01\.json$/u.test(n));
const sets = files.map(n => read(n) as QuestionSetV3);
const bank = readQuestionBank(root);
const errors: string[] = [], warnings: string[] = [];
if (sets.length !== 6) errors.push(`Expected six sets, got ${sets.length}`);
errors.push(...draftConflicts(sets, bank));
const otherDrafts = readPendingDrafts(root, path.join(root, 'cpa_uploader/drafts')).filter(s => !sets.some(n => n.id === s.id));
errors.push(...draftConflicts(sets, otherDrafts));
const catalog = buildSourceCatalog();
const unitIds = new Set(catalog.units.map((u: { id: string }) => u.id));
let qaCases = 0;
const perSet = [];
for (const set of sets) {
  const result = validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: root });
  errors.push(...result.errors.map(e => `${set.id}: ${e}`));
  warnings.push(...result.warnings.map(e => `${set.id}: ${e}`));
  if (set.status !== 'needs_review' || set.verification.review_status !== 'needs_human_review') errors.push(`${set.id}: draft state`);
  for (const ref of set.source_refs) {
    if (ref.content_hash !== hash(ref.source_quote)) errors.push(`${set.id}/${ref.id}: quote hash`);
    if (!fs.readFileSync(path.join(root, ref.file), 'utf8').includes(ref.source_quote)) errors.push(`${set.id}/${ref.id}: exact quote`);
  }
  const plans = readQuestionAuthoringPlans(path.join(base, `${set.id}.json.authoring-plan.json`));
  if (plans.length !== 1 || plans[0].topic_id !== set.classification.topic_id) errors.push(`${set.id}: plan linkage`);
  for (const id of plans[0].source_unit_ids) if (!unitIds.has(id)) errors.push(`${set.id}: unknown source unit ${id}`);
  const qa = read(`qa-${set.id.replace('draft-', '')}.json`);
  if (qa.set_id !== set.id || qa.human_approval !== false || qa.live_model_grading !== 'not_run') errors.push(`${set.id}: QA state`);
  if (qa.draft_sha256 !== hash(fs.readFileSync(path.join(base, `${set.id}.json`)))) errors.push(`${set.id}: stale QA hash`);
  const caseIds = new Set();
  for (const test of qa.cases) {
    qaCases++;
    if (caseIds.has(test.id)) errors.push(`${set.id}: duplicate QA ${test.id}`);
    caseIds.add(test.id);
    const q = set.subquestions.find(q => q.id === test.subquestion_id);
    if (!q) { errors.push(`${set.id}/${test.id}: unknown subquestion`); continue; }
    const ids = test.expected_verdicts.map((v: CriterionVerdictV3) => v.criterion_id);
    if (new Set(ids).size !== ids.length || ids.length !== q.criteria.length || q.criteria.some(c => !ids.includes(c.id))) errors.push(`${set.id}/${test.id}: incomplete verdicts`);
    const verdicts = test.expected_verdicts.map((v: CriterionVerdictV3) => ({ ...v, ...(v.verdict !== 'not_met' ? { quote: test.answer } : {}) }));
    const score = applyQuestionSetJudgment(set, { [q.id]: test.answer }, { subquestions: [{ subquestion_id: q.id, verdicts }] }).score;
    if (!Number.isInteger(test.expected_points) || score !== test.expected_points) errors.push(`${set.id}/${test.id}: expected verdict replay ${score} != ${test.expected_points}`);
  }
  for (const q of set.subquestions) {
    const cases = qa.cases.filter((c: { subquestion_id: string }) => c.subquestion_id === q.id);
    for (const kind of ['model', 'equivalent', 'reverse-order', 'single-paragraph', 'empty', 'opposite', 'condition-boundary']) {
      if (!cases.some((c: { kind: string }) => c.kind === kind)) errors.push(`${set.id}/${q.id}: missing ${kind}`);
    }
    if (q.criteria.some(c => c.max_points !== 1) || q.selection.type !== 'all' || q.selection.n !== null
      || q.constraints.ordered || q.constraints.max_entries !== null || q.constraints.overflow_policy !== 'none') errors.push(`${set.id}/${q.id}: policy`);
  }
  if (/"(?:model_answer|criteria|critical_facts|source_quote|correct)"\s*:/u.test(JSON.stringify(compilePublicQuestionSet(set)))) errors.push(`${set.id}: public field leak`);
  perSet.push({ set_id: set.id, subquestions: set.subquestions.length, points: computeQuestionSetMaxPoints(set), qa_cases: qa.cases.length,
    sha256: hash(fs.readFileSync(path.join(base, `${set.id}.json`))) });
}
errors.push(...validateAuthoringBank([...bank, ...sets]).errors);
const pending = readPendingDrafts(root, base);
for (const set of sets) if (pending.filter(s => s.id === set.id).length !== 1) errors.push(`${set.id}: pending inventory count`);
for (const input of read('inputs.json').files) if (hash(fs.readFileSync(path.join(root, input.file))) !== input.sha256) errors.push(`Stale input ${input.file}`);
const frequency = read('frequency-links.json');
const dataset = JSON.parse(fs.readFileSync(path.join(root, frequency.dataset.file), 'utf8'));
for (const entry of frequency.sets) for (const link of entry.links) {
  const element = dataset.elements.find((e: { id: string }) => e.id === link.element_id);
  if (!element || element.exam_frequency !== link.exam_frequency || element.mock_frequency !== link.mock_frequency) errors.push(`Stale frequency ${link.element_id}`);
  if (new Set(link.exam_questions).size !== link.exam_frequency) errors.push(`Frequency unit mismatch ${link.element_id}`);
  for (const r of link.source_records) {
    const source = fs.readFileSync(path.join(root, r.source.file), 'utf8');
    if (hash(fs.readFileSync(path.join(root, r.source.file))) !== r.source_file_sha256) errors.push(`Stale original ${r.record_id}`);
    if (source.split(/\r?\n/u).slice(r.source.start_line - 1, r.source.end_line).join('\n') !== r.source_range_text) errors.push(`Original range ${r.record_id}`);
    const original = dataset.records.find((d: { id: string }) => d.id === r.record_id);
    const occurrence = dataset.occurrences.find((o: { id: string }) => o.id === r.occurrence_id);
    if (!original || original.text !== r.original_text || !occurrence?.countable || occurrence.element_id !== link.element_id) errors.push(`Original mapping ${r.record_id}`);
  }
}
const report = { checked_at: new Date().toISOString(), scope: 'isolated_needs_review_drafts', sets: sets.length,
  subquestions: perSet.reduce((n, s) => n + s.subquestions, 0), points: perSet.reduce((n, s) => n + s.points, 0), qa_cases: qaCases,
  qa_execution: 'author_expected_verdicts_replayed_through_applyQuestionSetJudgment; no live semantic model measurement',
  live_model_grading: fs.existsSync(path.join(base, 'live-grading-summary.json')) ? 'recorded_separately_not_executed_by_this_verifier' : 'not_run',
  live_model_record: fs.existsSync(path.join(base, 'live-grading-summary.json')) ? 'live-grading-summary.json' : null,
  human_approval: false, canonical_bank_written: false, public_or_database_written: false,
  compared_other_draft_instances: otherDrafts.length, per_set: perSet, errors, warnings };
fs.writeFileSync(path.join(base, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
