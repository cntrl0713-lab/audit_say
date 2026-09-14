import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';
import { validateQuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import { computeQuestionSetMaxPoints } from '../../../../../lib/questionV3.ts';

const directory = 'cpa_uploader/drafts/case-additional-2026-09-14/a/materiality';
const read = file => JSON.parse(fs.readFileSync(`${directory}/${file}`, 'utf8'));
const sets = read('sets.json'), designs = read('design.json'), reviews = read('review.json'), qa = read('qa.json');
const bank = JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('cpa_uploader/drafts/case-additional-2026-09-14/source-catalog.json', 'utf8'));
const result = validateAuthoringBank([...bank, ...sets]);
const errors = [...result.errors];
const hash = value => createHash('sha256').update(value).digest('hex');
for (const design of designs) {
  errors.push(...validateQuestionAuthoringPlan(design.plan).map(error => `${design.set_id}: ${error}`));
  for (const id of design.plan.source_unit_ids) if (!catalog.units.some(u => u.id === id)) errors.push(`Unknown source unit: ${id}`);
}
for (const set of sets) {
  const count = Array.from(set.shared_context.facts.map(f => f.text).join('\n')).length;
  if (count < 400 || set.subquestions.length < 2 || set.subquestions.length > 4) errors.push('Case length or question count');
  if (new Set(set.subquestions.map(q => q.question_style)).size !== 1 || set.subquestions[0].question_style !== 'case') errors.push('Case-only style');
  for (const q of set.subquestions) {
    const reviewed = reviews.filter(r => r.set_id === set.id && r.subquestion_id === q.id);
    if (reviewed.length !== 1 || reviewed[0].unresolved_content_findings.length) errors.push(`Incomplete content review: ${q.id}`);
    const rows = qa.filter(row => row.set_id === set.id && row.subquestion_id === q.id);
    if (rows.length !== 2 || !rows.some(r => r.kind === 'partial') || !rows.some(r => r.kind === 'wrong')) errors.push(`Representative QA coverage: ${q.id}`);
    for (const row of rows) {
      if (row.met_criterion_ids.some(id => !q.criteria.some(c => c.id === id))) errors.push(`Unknown expected criterion: ${q.id}`);
      const expected = q.criteria.filter(c => row.met_criterion_ids.includes(c.id)).reduce((sum, c) => sum + c.max_points, 0);
      if (expected !== row.expected_points) errors.push(`Expected points mismatch: ${q.id}/${row.kind}`);
      if (row.kind === 'wrong' && expected !== 0) errors.push(`Wrong representative must score zero: ${q.id}`);
      if (row.kind === 'partial' && !(expected > 0 && expected < q.criteria.reduce((sum, c) => sum + c.max_points, 0))) errors.push(`Invalid partial representative: ${q.id}`);
    }
  }
}
const output = { executed_at: new Date().toISOString(), checks: ['in-memory authoring bank validation', 'version1 official authoring plan shape', 'actual source-unit identities', 'case-only facts and question count', 'flat content-review coverage', 'representative QA IDs and integer score sums'],
  set_count: sets.length, question_count: sets.flatMap(s => s.subquestions).length, points: sets.map(s => ({ set_id: s.id, max_points: computeQuestionSetMaxPoints(s) })),
  file_sha256: Object.fromEntries(['sets.json', 'design.json', 'review.json', 'qa.json'].map(file => [file, hash(fs.readFileSync(`${directory}/${file}`))])),
  errors, warnings: result.warnings, actual_model_grading: 'not_run', production_publication: 'not_performed' };
fs.writeFileSync(`${directory}/validation.json`, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (errors.length) process.exitCode = 1;
