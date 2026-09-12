import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateQuestionSetV3, computeQuestionSetMaxPoints, compilePublicQuestionSet } from '../../../lib/questionV3.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../lib/questionV3.ts';
import { applyQuestionSetJudgment } from '../../../lib/questionV3Grading.ts';
import { validateQuestionAuthoringPlan } from '../../questionAuthoringPlan.ts';
import { readQuestionBank, draftConflicts, readPendingDrafts } from '../../questionDraftInventory.ts';
import { validateAuthoringBank } from '../../questionBankPublication.ts';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
const files = fs.readdirSync(base).filter(n => /^draft-\d{2}-\d{3}-\d{3}\.json$/.test(n));
const sets = files.map(n => read(n) as QuestionSetV3);
const bank = readQuestionBank();
const errors: string[] = [], warnings: string[] = [];
if (sets.length !== 9) errors.push(`Expected nine sets, got ${sets.length}`);
errors.push(...draftConflicts(sets, bank));
const catalog = buildSourceCatalog();
const unitIds = new Set(catalog.units.map((u: { id: string }) => u.id));
let qaCases = 0;
const perSet = [];
for (const set of sets) {
  const result = validateQuestionSetV3(set, { verifySourceQuotes: true, cwd: process.cwd() });
  errors.push(...result.errors.map(e => `${set.id}: ${e}`));
  warnings.push(...result.warnings.map(e => `${set.id}: ${e}`));
  if (set.status !== 'needs_review' || set.verification.review_status !== 'needs_human_review') errors.push(`${set.id}: draft state`);
  for (const ref of set.source_refs) {
    if (ref.content_hash !== hash(ref.source_quote)) errors.push(`${set.id}/${ref.id}: quote hash`);
    if (!fs.readFileSync(ref.file, 'utf8').includes(ref.source_quote)) errors.push(`${set.id}/${ref.id}: exact quote`);
  }
  const plan = read(`${set.id}.authoring-plan.json`);
  errors.push(...validateQuestionAuthoringPlan(plan).map(e => `${set.id}: plan ${e}`));
  if (plan.set_id !== set.id) errors.push(`${set.id}: plan set linkage`);
  for (const id of plan.source_unit_ids) if (!unitIds.has(id)) errors.push(`${set.id}: missing source unit ${id}`);
  const qa = read(`qa-${set.id.replace('draft-', '')}.json`);
  if (qa.set_id !== set.id || qa.human_approval !== false || qa.live_model_grading !== 'not_run') errors.push(`${set.id}: QA status or linkage`);
  if (qa.draft_sha256 && qa.draft_sha256 !== hash(fs.readFileSync(path.join(base, `${set.id}.json`)))) errors.push(`${set.id}: stale QA draft hash`);
  const caseIds = new Set();
  for (const test of qa.cases) {
    qaCases++;
    if (caseIds.has(test.id)) errors.push(`${set.id}: duplicate QA ${test.id}`);
    caseIds.add(test.id);
    const q = set.subquestions.find(q => q.id === test.subquestion_id);
    if (!q) { errors.push(`${set.id}/${test.id}: unknown subquestion`); continue; }
    const ids = test.expected_verdicts.map((v: CriterionVerdictV3) => v.criterion_id);
    if (new Set(ids).size !== ids.length || ids.length !== q.criteria.length || q.criteria.some(c => !ids.includes(c.id))) errors.push(`${set.id}/${test.id}: incomplete expected verdicts`);
    const verdicts = test.expected_verdicts.map((v: CriterionVerdictV3) => ({ ...v, ...(v.verdict !== 'not_met' ? { quote: test.answer } : {}) }));
    const scored = applyQuestionSetJudgment(set, { [q.id]: test.answer }, { subquestions: [{ subquestion_id: q.id, verdicts }] });
    if (!Number.isInteger(test.expected_points) || scored.score !== test.expected_points) errors.push(`${set.id}/${test.id}: declared expected verdict replay ${scored.score} != ${test.expected_points}`);
  }
  for (const q of set.subquestions) {
    if (!qa.cases.some((c: { subquestion_id: string; answer: string; expected_points: number }) => c.subquestion_id === q.id && c.answer === '' && c.expected_points === 0)) errors.push(`${set.id}/${q.id}: missing empty answer case`);
  }
  const publicSet = compilePublicQuestionSet(set);
  if (/"(?:model_answer|criteria|critical_facts|source_quote|correct)"\s*:/.test(JSON.stringify(publicSet))) errors.push(`${set.id}: private field in public conversion`);
  perSet.push({ set_id: set.id, subquestions: set.subquestions.length, criteria: set.subquestions.reduce((n, q) => n + q.criteria.length, 0), max_points: computeQuestionSetMaxPoints(set), qa_cases: qa.cases.length, sha256: hash(fs.readFileSync(path.join(base, `${set.id}.json`))) });
}
// Read-only prospective bank check: no canonical/public/DB write.
errors.push(...validateAuthoringBank([...bank, ...sets]).errors);
const pending = readPendingDrafts(process.cwd(), base);
for (const set of sets) if (pending.filter(s => s.id === set.id).length !== 1) errors.push(`${set.id}: pending inventory does not find exactly one draft`);
const frequency = read('frequency-links.json');
for (const input of [frequency.dataset, frequency.bank]) if (hash(fs.readFileSync(input.file)) !== input.sha256) errors.push(`Stale frequency input: ${input.file}`);
const dataset = JSON.parse(fs.readFileSync(frequency.dataset.file, 'utf8'));
for (const entry of frequency.sets) {
  if (!sets.some(s => s.id === entry.set_id)) errors.push(`Unknown frequency set ${entry.set_id}`);
  for (const link of entry.links) {
    const element = dataset.elements.find((e: { id: string }) => e.id === link.element_id);
    if (!element || element.exam_frequency !== link.exam_frequency || element.mock_frequency !== link.mock_frequency) errors.push(`Stale element frequency ${link.element_id}`);
    for (const record of link.source_records) if (!dataset.records.some((r: { id: string }) => r.id === record.record_id)) errors.push(`Unknown frequency record ${record.record_id}`);
  }
}
const report = { checked_at: '2026-09-10', scope: 'isolated_needs_review_drafts', sets: sets.length, subquestions: perSet.reduce((n, s) => n + s.subquestions, 0), criteria: perSet.reduce((n, s) => n + s.criteria, 0), points: perSet.reduce((n, s) => n + s.max_points, 0), qa_cases: qaCases, qa_execution: 'author_expected_verdicts_replayed_through_applyQuestionSetJudgment; no live semantic model measurement', live_model_grading: 'not_run', human_approval: false, canonical_bank_written: false, public_or_database_written: false, per_set: perSet, errors, warnings };
fs.writeFileSync(path.join(base, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
