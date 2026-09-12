import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { validateQuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { validateQuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';
import { studyTopics } from '../../../../wiki/scripts/ox-study-order.mjs';

const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work = `${control}/question-style-v2`;
const output = `${control}/final-153-style-v2`;
const draftRoot = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/learning-style-v2';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const previousFile = `${control}/final-153-structure-v2/manifest.json`;
const previous = read(previousFile);
const sourceFiles = ['foundations', 'completion', 'procedures', 't08-c'].map(name => `${work}/${name}.json`);
const classification = sourceFiles.flatMap(file => read(file).entries.map(row => ({ ...row, review_file: file })));
assert.equal(classification.length, previous.collected_questions);
assert.equal(new Set(classification.map(row => `${row.set_id}/${row.subquestion_id}`)).size, classification.length);
assert(!fs.existsSync(output));
assert(!fs.existsSync(draftRoot));
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(draftRoot, { recursive: true });
const rows = [], entries = [], newSets = [], groups = [], changes = [];
for (const before of previous.entries) {
    for (const item of [{ file: before.file, sha256: before.sha256 }, ...before.plan_files,
        { file: before.qa_file, sha256: before.qa_sha256 }, ...before.source_files]) assert.equal(hash(item.file), item.sha256, item.file);
    const raw = read(before.file);
    const original = Array.isArray(raw) ? raw.find(set => set.id === before.set_id) : raw;
    const set = structuredClone(original), entry = structuredClone(before);
    const assigned = classification.filter(row => row.set_id === set.id);
    for (const sub of set.subquestions) {
        const row = assigned.find(row => row.subquestion_id === sub.id);
        assert(row && ['standard', 'case'].includes(row.style) && row.reason.trim().length > 10);
        assert(row.case_fact_ids.every(id => set.shared_context.facts.some(fact => fact.id === id)));
        assert(!row.mixed || row.style === 'case');
        if (row.style === 'standard') {
            assert(typeof row.standalone_prompt === 'string' && row.standalone_prompt.trim().length > 10);
            sub.prompt = row.standalone_prompt;
        } else assert.equal(row.standalone_prompt, null);
    }
    const changed = set.subquestions.some((sub, i) => sub.prompt !== original.subquestions[i].prompt);
    if (changed) {
        const folder = `${draftRoot}/${entry.plan_id.toLowerCase()}`;
        fs.mkdirSync(folder);
        const questionFile = `${folder}/question.json`, planFile = `${folder}/authoring-plan.json`, qaFile = `${folder}/qa-cases.json`;
        set.verification.notes.push('2026-09-11 사용자 확정: 사례 사실과의 연계가 필요한 물음은 사례형, 기준서만으로 답할 수 있는 물음은 기준서형. 기준서형은 사례 지문 없이 독립 발문으로 구성한다. 학습 묶음은 유형별로 분리한다. 정답·criterion·출처·ID·배점은 유지하며 모델 검증 완료로 승계하지 않는다.');
        write(questionFile, [set]);
        const sourcePlan = read(entry.plan_files[0].file);
        const plan = structuredClone(sourcePlan.plans?.find(plan => plan.set_id === set.id) || sourcePlan);
        plan.existing_question_difference += ' [독립 기준서형 발문] 기준서형 물음의 일반 적용조건과 요구를 사례 없이 명시했다. 특정 사례를 해석해야 하는 물음은 사례형으로 유지하며, 실제 정답·채점명제·배점·출처는 추가하거나 삭제하지 않는다. 학습 문제 묶음은 두 유형으로 분리한다.';
        assert.deepEqual(validateQuestionAuthoringPlan(plan), []);
        write(planFile, plan);
        const qa = read(entry.qa_file);
        qa.predecessor = { file: entry.qa_file, sha256: entry.qa_sha256 };
        qa.draft_sha256 = hash(questionFile);
        qa.live_model_grading = 'not_run';
        qa.human_approval = false;
        write(qaFile, qa);
        const lineage = { previous: before, current: { file: questionFile, sha256: hash(questionFile), plan_file: planFile, plan_sha256: hash(planFile), qa_file: qaFile, qa_sha256: hash(qaFile) },
            prompts: set.subquestions.filter((sub, i) => sub.prompt !== original.subquestions[i].prompt).map(sub => ({ subquestion_id: sub.id,
                before: original.subquestions.find(old => old.id === sub.id).prompt, after: sub.prompt,
                reason: assigned.find(row => row.subquestion_id === sub.id).reason })),
            preserved: ['set ID', 'subquestion IDs and order', 'source_refs', 'shared_context', 'model_answer', 'requirements', 'criteria', 'all QA case objects'], api_calls: 0 };
        write(`${folder}/lineage.json`, lineage);
        changes.push({ plan_id: entry.plan_id, file: `${folder}/lineage.json`, changed_prompts: lineage.prompts.length });
        Object.assign(entry, { stage: 'independent_standard_prompts_pending_model_revalidation', file: questionFile, sha256: hash(questionFile),
            plan_files: [{ file: planFile, sha256: hash(planFile) }], qa_file: qaFile, qa_sha256: hash(qaFile),
            followup: { kind: 'separate_standard_and_case_learning_groups', lineage_file: `${folder}/lineage.json`, model_revalidation: 'not_run' } });
        assert.deepEqual(read(qaFile).cases, read(before.qa_file).cases);
    }
    const shape = validateQuestionSetV3(set, { verifySourceQuotes: true });
    assert.deepEqual(shape.errors, []);
    assert.deepEqual(shape.warnings, []);
    for (const [i, sub] of set.subquestions.entries()) {
        const originalSub = original.subquestions[i];
        assert.deepEqual({ ...sub, prompt: originalSub.prompt }, originalSub);
    }
    assert.deepEqual(set.shared_context, original.shared_context);
    assert.deepEqual(set.source_refs, original.source_refs);
    for (const row of assigned) {
        const sub = set.subquestions.find(sub => sub.id === row.subquestion_id);
        rows.push({ ...row, plan_id: entry.plan_id, topic_id: entry.topic_id, question_file: entry.file, question_sha256: entry.sha256,
            display_number: set.subquestions.indexOf(sub) + 1, points: sub.criteria.reduce((sum, criterion) => sum + criterion.max_points, 0) });
    }
    for (const style of ['standard', 'case']) {
        const groupRows = assigned.filter(row => row.style === style);
        if (!groupRows.length) continue;
        const questions = set.subquestions.filter(sub => groupRows.some(row => row.subquestion_id === sub.id));
        groups.push({ id: `${set.id}--${style}`, source_set_id: set.id, plan_id: entry.plan_id, style, title: set.title, topic_id: entry.topic_id,
            shared_context: style === 'standard' ? { facts: [] } : set.shared_context,
            subquestions: questions, max_points: questions.flatMap(sub => sub.criteria).reduce((sum, c) => sum + c.max_points, 0) });
    }
    entries.push(entry); newSets.push(set);
}
assert.equal(groups.flatMap(group => group.subquestions).length, rows.length);
assert.equal(new Set(groups.flatMap(group => group.subquestions.map(sub => `${group.source_set_id}/${sub.id}`))).size, rows.length);
for (const group of groups) {
    if (group.style === 'standard') assert.deepEqual(group.shared_context.facts, []);
    for (const sub of group.subquestions) assert.equal(rows.find(row => row.set_id === group.source_set_id && row.subquestion_id === sub.id).style, group.style);
}
assert.equal(groups.reduce((sum, group) => sum + group.max_points, 0), previous.collected_points);
const oldBankFile = `${control}/final-153-structure-v2/comparison-bank.json`;
assert.equal(hash(oldBankFile), previous.comparison_bank_sha256);
const bank = read(oldBankFile).map(set => newSets.find(candidate => candidate.id === set.id) || set);
const validation = validateAuthoringBank(bank);
assert.deepEqual(validation.errors, []);
assert.equal(bank.length, 153);
assert.equal(hash(previous.bank_file), previous.bank_sha256);
write(`${output}/comparison-bank.json`, bank);
const manifest = { ...previous, created_at: new Date().toISOString(), predecessor: { file: previousFile, sha256: hash(previousFile) },
    comparison_bank_sha256: hash(`${output}/comparison-bank.json`), validation: { errors: [], warnings: [] }, entries };
write(`${output}/manifest.json`, manifest);
const counts = { source_sets: entries.length, questions: rows.length, learning_groups: groups.length,
    standard: rows.filter(row => row.style === 'standard').length, case: rows.filter(row => row.style === 'case').length,
    mixed_case: rows.filter(row => row.mixed).length, changed_sets: changes.length, changed_prompts: changes.reduce((sum, row) => sum + row.changed_prompts, 0) };
write(`${work}/learning-groups.json`, { purpose: 'separate_learning_groups', manifest_file: `${output}/manifest.json`, manifest_sha256: hash(`${output}/manifest.json`), groups });
write(`${work}/index.json`, { schema_version: 2, purpose: 'separate_standard_and_case_learning', manifest_file: `${output}/manifest.json`, manifest_sha256: hash(`${output}/manifest.json`),
    topic_order: studyTopics.map(topic => topic.id), source_files: sourceFiles.map(file => ({ file, sha256: hash(file) })),
    learning_groups_file: `${work}/learning-groups.json`, learning_groups_sha256: hash(`${work}/learning-groups.json`), counts,
    api_calls: 0, human_approval: false, review_status: 'editorial_classification', entries: rows });
write(`${work}/validation.json`, { counts, errors: [], warnings: [], changes,
    checks: ['All 132 questions classified exactly once', 'Original IDs, criteria, answers, sources, QA cases preserved', 'Every standard group has zero case facts', 'Every case group contains only case-classified questions', 'Source/shape/plan and 153-set comparison bank validation'],
    api_calls: 0, model_semantic_review: 'not_run', model_grading: 'not_run', resume_requires_new_execution_lock: true });
console.log(JSON.stringify(counts));
