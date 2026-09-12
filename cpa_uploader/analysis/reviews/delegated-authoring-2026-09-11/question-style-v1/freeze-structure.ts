import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateQuestionSetV3 } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { validateQuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const output = `${control}/final-153-structure-v2`;
const work = `${control}/question-style-v1`;
const draft = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s02/structure-v2/t08-c';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const predecessorFile = `${control}/final-153-point-policy-v1/manifest.json`;
const previous = read(predecessorFile);
const checks: string[] = [];
for (const entry of previous.entries) {
    for (const item of [{ file: entry.file, sha256: entry.sha256 }, ...entry.plan_files,
        { file: entry.qa_file, sha256: entry.qa_sha256 }, ...entry.source_files]) {
        assert.equal(hash(item.file), item.sha256, `Previous bytes changed: ${item.file}`);
    }
}
assert.equal(hash(previous.bank_file), previous.bank_sha256);
checks.push('All predecessor selected drafts/plans/QA/sources and canonical bytes unchanged');
const set = read(`${draft}/pilot-08-008.json`)[0] as QuestionSetV3;
const shape = validateQuestionSetV3(set, { verifySourceQuotes: true });
assert.deepEqual(shape.errors, []);
assert.deepEqual(validateQuestionAuthoringPlan(read(`${draft}/pilot-08-008.authoring-plan.json`)), []);
const qa = read(`${draft}/qa-cases-t08-c.json`);
assert.equal(qa.draft_sha256, hash(`${draft}/pilot-08-008.json`));
assert.equal(new Set(qa.cases.map((sample: { id: string }) => sample.id)).size, qa.cases.length);
for (const sample of qa.cases) {
    const sub = set.subquestions.find(sub => sub.id === sample.subquestion_id)!;
    assert(sub);
    assert.deepEqual(sample.expected_verdicts.map((v: { criterion_id: string }) => v.criterion_id).sort(), sub.criteria.map(c => c.id).sort());
    let sum = 0;
    for (const verdict of sample.expected_verdicts) {
        assert(['met', 'not_met', 'contradicted'].includes(verdict.verdict));
        const criterion = sub.criteria.find(c => c.id === verdict.criterion_id)!;
        sum += criterion.scores[verdict.verdict as 'met' | 'not_met' | 'contradicted'];
    }
    assert.equal(sum, sample.expected_points, sample.id);
    if (sample.target_criterion_id) assert(sub.criteria.some(c => c.id === sample.target_criterion_id));
}
checks.push(`Source/shape/plan validation and ${qa.cases.length} local expected-verdict sums`);
const entries = structuredClone(previous.entries);
const entry = entries.find((item: { plan_id: string }) => item.plan_id === 'T08-C');
const oldEntry = structuredClone(entry);
Object.assign(entry, {
    stage: 'structure_split_pending_model_revalidation', file: `${draft}/pilot-08-008.json`, sha256: hash(`${draft}/pilot-08-008.json`),
    output_directory: `${draft}/`, question_ids: set.subquestions.map(sub => sub.id), actual_questions: set.subquestions.length,
    question_mapping: set.subquestions.map((sub, i) => ({ plan_question_id: `T08-C-Q${sub.id.replace('sub', '')}`, actual_id: sub.id, display_number: i + 1, current_points: sub.criteria.reduce((sum, c) => sum + c.max_points, 0) })),
    questions: set.subquestions.map((sub, i) => ({ plan_question_id: `T08-C-Q${sub.id.replace('sub', '')}`, suggested_id: sub.id, display_number: i + 1, current_points: sub.criteria.reduce((sum, c) => sum + c.max_points, 0) })),
    plan_files: [{ file: `${draft}/pilot-08-008.authoring-plan.json`, sha256: hash(`${draft}/pilot-08-008.authoring-plan.json`) }],
    qa_file: `${draft}/qa-cases-t08-c.json`, qa_sha256: hash(`${draft}/qa-cases-t08-c.json`), qa_cases: qa.cases.length,
    followup: { kind: 'split_standard_requirements', previous_entry: oldEntry, lineage_file: `${draft}/lineage.json`, model_revalidation: 'not_run' },
});
const bank: QuestionSetV3[] = read(`${control}/final-153-point-policy-v1/comparison-bank.json`);
assert.equal(hash(`${control}/final-153-point-policy-v1/comparison-bank.json`), previous.comparison_bank_sha256);
const combined = bank.map(item => item.id === set.id ? set : item);
const validation = validateAuthoringBank(combined);
assert.deepEqual(validation.errors, []);
assert.equal(combined.length, 153);
const totals = { sets: entries.length, questions: entries.reduce((n: number, e: { actual_questions: number }) => n + e.actual_questions, 0),
    points: entries.reduce((n: number, e: { points: number }) => n + e.points, 0), qa_cases: entries.reduce((n: number, e: { qa_cases: number }) => n + e.qa_cases, 0) };
assert.equal(totals.questions, 132);
assert.equal(totals.points, 521);
assert(!fs.existsSync(output));
fs.mkdirSync(output);
write(`${output}/comparison-bank.json`, combined);
const manifest = { created_at: new Date().toISOString(), purpose: 'fixed_comparison_bank',
    predecessor: { file: predecessorFile, sha256: hash(predecessorFile) }, bank_file: previous.bank_file, bank_sha256: previous.bank_sha256,
    planned_sets: 49, planned_questions: 132, collected_sets: totals.sets, collected_questions: totals.questions, collected_points: totals.points,
    comparison_sets: 153, comparison_bank_sha256: hash(`${output}/comparison-bank.json`), author_qa_cases: totals.qa_cases,
    errors: [], validation: { errors: [], warnings: shape.warnings },
    execution: { api_calls: 0, model_semantic_review: 'not_run', model_grading: 'not_run', resume_requires_new_execution_lock: true }, entries };
write(`${output}/manifest.json`, manifest);
write(`${work}/structure-validation.json`, { recorded_at: new Date().toISOString(), totals, checks, errors: [], warnings: shape.warnings,
    manifest: { file: `${output}/manifest.json`, sha256: hash(`${output}/manifest.json`) }, api_calls: 0,
    interpretation: 'Static source/shape/identity and stored expected-verdict checks; no model judgment or human approval' });
console.log(JSON.stringify({ ...totals, errors: [], warnings: shape.warnings, manifest: `${output}/manifest.json` }));
