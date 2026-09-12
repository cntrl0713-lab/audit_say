import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { inspectBankSnapshot, learningCatalogForBank } from '../../../../scripts/import-question-bank-v3.ts';

// New candidate only. Preserve canonical, historical notes, manifests and receipts.
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous = `${base}/prepared-reviewed-v6`, output = `${base}/prepared-reviewed-v7`;
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = (file: string) => ({ file, sha256: sha(fs.readFileSync(file)) });
const serial = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
assert.equal(fs.existsSync(output), false, 'Use a new candidate version; never overwrite');
const canonicalFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const proposalFile = `${base}/c/resume-review-2026-09-12/notes-three-way-proposal.json`;
const scopeFile = `${base}/c/resume-review-2026-09-12/pilot-03-001-scope-proposal-v2.json`;
const inputs = [`${base}/canonical-before.json`, canonicalFile, `${previous}/candidate-authoring.json`,
    `${previous}/classification-review.json`, `${previous}/learning-question-classifications.json`,
    `${previous}/summary.json`, `${previous}/plan-overrides.json`, proposalFile, scopeFile].map(identity);
assert.equal(identity(proposalFile).sha256, '9e4622c75f6791181561170c840a3d879e173d5c0b9bfd67dfbb3cd49ac55b40');
const proposal = read(proposalFile);
for (const row of proposal.evidence) {
    assert.equal(identity(row.file).sha256, row.sha256);
    if (!inputs.some(input => input.file === row.file)) inputs.push(row);
}
assert.equal(identity(`${previous}/candidate-authoring.json`).sha256, 'e43cd491c08faebd70c02eb67bfe15198e669b66a6372b723ed539da229fd94a');
const original: QuestionSetV3[] = read(inputs[0].file), current: QuestionSetV3[] = read(canonicalFile);
const bank: QuestionSetV3[] = read(`${previous}/candidate-authoring.json`);
const oldBank = structuredClone(bank);
const scope = read(scopeFile);
assert.equal(identity(scopeFile).sha256, '378e062c1248b298f258ce5bb2903d8aaecbbf56030eaf6d5027a9b0994507d9');
assert.equal(scope.set_id, 'pilot-03-001'); assert.equal(scope.subquestion_id, 'sub1');
assert.equal(scope.changes.length, 5);
const questionChange = scope.changes.find((row: { artifact: string }) => row.artifact === 'question');
assert.equal(questionChange.field, 'prompt');
const changedSub = bank.find(set => set.id === 'pilot-03-001')!.subquestions.find(sub => sub.id === 'sub1')!;
assert.equal(changedSub.prompt, questionChange.before);
changedSub.prompt = questionChange.after;
const scopedChanges = [{ set_id: 'pilot-03-001', subquestion_id: 'sub1', field: 'prompt',
    before: questionChange.before, after: questionChange.after, proposal_file: scopeFile, proposal_sha256: identity(scopeFile).sha256 }];
assert.deepEqual(current.map(set => set.id), original.map(set => set.id));
const changes: { set_id: string; note_index: number; before: string; after: string }[] = [];
for (const old of original) {
    const now = current.find(set => set.id === old.id)!;
    const withoutNotes = structuredClone(now);
    withoutNotes.verification.notes = old.verification.notes;
    assert.deepEqual(withoutNotes, old, `${old.id}: canonical has additional changes requiring review`);
    assert.equal(now.verification.notes.length, old.verification.notes.length);
    const target = bank.find(set => set.id === old.id)!;
    for (const [index, prior] of old.verification.notes.entries()) {
        const currentNote = now.verification.notes[index];
        if (prior === currentNote) continue;
        const proposed = proposal.changes.find((row: { set_id: string; base_note_index: number }) => row.set_id === old.id && row.base_note_index === index);
        assert(proposed, `${old.id}: missing independent merge proposal`);
        assert.equal(proposed.before_note, prior); assert.equal(proposed.current_note, currentNote);
        assert.equal(proposed.proposed_note, prior.replace(proposed.old_path, proposed.proposed_path));
        assert(fs.existsSync(proposed.proposed_path), `${old.id}: proposed notes link does not exist`);
        const next: string = proposed.proposed_note;
        const matching = target.verification.notes.flatMap((note, i) => note === prior ? [i] : []);
        assert.equal(matching.length, 1, `${old.id}: ambiguous three-way notes merge`);
        target.verification.notes[matching[0]] = next;
        changes.push({ set_id: old.id, note_index: matching[0], before: prior, after: next });
    }
}
assert.equal(changes.length, 83, 'Independently identified path-only changes');
for (const [i, set] of bank.entries()) {
    const undo = structuredClone(set);
    for (const change of changes.filter(change => change.set_id === set.id)) undo.verification.notes[change.note_index] = change.before;
    if (set.id === 'pilot-03-001') undo.subquestions.find(sub => sub.id === 'sub1')!.prompt = questionChange.before;
    assert.deepEqual(undo, oldBank[i], 'Only reviewed notes paths and the explicit scope clarification may change');
}
const validation = validateAuthoringBank(bank);
assert.deepEqual(validation.errors, []);
const publicSets = bank.map(compilePublicQuestionSet);
const oldPublic = oldBank.map(compilePublicQuestionSet), undonePublic = structuredClone(publicSets);
undonePublic.find(set => set.id === 'pilot-03-001')!.subquestions.find(sub => sub.id === 'sub1')!.prompt = questionChange.before;
assert.deepEqual(undonePublic, oldPublic, 'Public content changes only the reviewed prompt');
const bankBytes = serial(bank), publicBytes = serial(publicSets);
const oldReview = read(`${previous}/classification-review.json`);
const classificationChange = scope.changes.find((row: { artifact: string; field: string }) => row.artifact === 'classification_review' && row.field === 'reason');
assert.equal(classificationChange.field, 'reason');
const classificationEntry = oldReview.entries.find((row: { set_id: string; subquestion_id: string }) => row.set_id === 'pilot-03-001' && row.subquestion_id === 'sub1');
assert.equal(classificationEntry.reason, classificationChange.before);
assert.equal(classificationEntry.standalone_prompt, null, 'Use the actual standalone question prompt');
classificationEntry.reason = classificationChange.after;
const standaloneChange = scope.changes.find((row: { artifact: string; field: string }) => row.artifact === 'classification_review' && row.field === 'standalone_prompt');
assert.equal(classificationEntry.standalone_prompt, standaloneChange.before);
assert.equal(standaloneChange.after, questionChange.after);
classificationEntry.standalone_prompt = standaloneChange.after;
const review = { ...oldReview, source_file: `${output}/candidate-authoring.json`, source_file_sha256: sha(bankBytes),
    predecessor_file: `${previous}/classification-review.json` };
const priorCatalog = read(`${previous}/learning-question-classifications.json`);
const compiled = compileLearningCatalog(bank, review.entries, priorCatalog.topics);
const catalog = { ...priorCatalog, source_file: review.source_file, source_file_sha256: sha(bankBytes),
    public_content_hash: contentHash(publicSets), review_file: `${output}/classification-review.json`,
    review_file_sha256: sha(serial(review)), classifications: compiled.classifications };
const inspection = inspectBankSnapshot(bankBytes, publicBytes);
assert.deepEqual(inspection.report.source_hash_mismatches, []);
const metadata = learningCatalogForBank(bank, catalog);
const priorOverrides = read(`${previous}/plan-overrides.json`);
const priorPlan = priorOverrides.entries.find((row: { set_id: string }) => row.set_id === 'pilot-03-001');
assert.equal(identity(priorPlan.file).sha256, priorPlan.sha256);
inputs.push({ file: priorPlan.file, sha256: priorPlan.sha256 });
const plan = read(priorPlan.file);
for (const change of scope.changes.filter((row: { artifact: string }) => row.artifact === 'plan')) {
    if (change.field === 'scope.conditions') {
        assert.deepEqual(plan.scope.conditions, change.before); plan.scope.conditions = change.after;
    } else if (change.field === 'scope.required_answers[0]') {
        assert.equal(plan.scope.required_answers[0], change.before); plan.scope.required_answers[0] = change.after;
    } else throw Error('Unapproved plan field');
}
plan.metadata.scope_clarification_followup = { predecessor: priorPlan, evidence: identity(scopeFile),
    bank: { file: review.source_file, sha256: sha(bankBytes) }, actual_model_review: 'not_run' };
assert.deepEqual(validateQuestionAuthoringPlan(plan), []);
for (const row of inputs) assert.equal(identity(row.file).sha256, row.sha256, `Input changed: ${row.file}`);
fs.mkdirSync(output);
const write = (file: string, value: unknown) => fs.writeFileSync(`${output}/${file}`, serial(value), { flag: 'wx' });
write('candidate-authoring.json', bank); write('candidate-public.json', publicSets);
write('classification-review.json', review); write('learning-question-classifications.json', catalog);
write('db-learning-metadata.json', metadata);
write('notes-merge.json', { created_at: new Date().toISOString(), inputs, changes,
    scoped_changes: scopedChanges, public_question_changes: 1, score_or_answer_changes: 0, actual_model_review: 'not_run',
    reason: 'Preserve the canonical documentation-path edits before accepting new receipts; verification.notes participates in reviewedContentHash.' });
const planFile = `${output}/pilot-03-001-plan.json`;
write('pilot-03-001-plan.json', plan);
write('plan-overrides.json', { ...priorOverrides, created_at: new Date().toISOString(),
    predecessor: identity(`${previous}/plan-overrides.json`), bank: { file: review.source_file, sha256: sha(bankBytes) },
    entries: priorOverrides.entries.map((row: { set_id: string }) => row.set_id === 'pilot-03-001' ? { set_id: row.set_id, file: planFile, sha256: sha(serial(plan)) } : row) });
const summary = read(`${previous}/summary.json`);
write('summary.json', { ...summary, created_at: new Date().toISOString(), predecessor: `${previous}/summary.json`,
    notes_merge: { sets: new Set(changes.map(change => change.set_id)).size, replacements: changes.length },
    validation: { ...summary.validation, import_preconditions: inspection.report }, actual_model_review: 'not_run' });
console.log(JSON.stringify({ output, bank_sha256: sha(bankBytes), note_replacements: changes.length,
    sets: bank.length, public_question_changes: 1, api_calls: 0 }));
