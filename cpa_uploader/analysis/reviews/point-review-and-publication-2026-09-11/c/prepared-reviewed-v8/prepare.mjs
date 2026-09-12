// New candidate only. This preparation uses pure local compilers and calls no API/DB.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { sha256, jsonHash, reviewedContentHash } from '../../../../../questionReviewIdentity.ts';
import { validateAuthoringBank } from '../../../../../questionBankPublication.ts';
import { validateQuestionAuthoringPlan } from '../../../../../questionAuthoringPlan.ts';
import { buildSourceCatalog } from '../../../../../questionSourceCatalog.mjs';
import { compilePublicQuestionSet } from '../../../../../../lib/questionV3.ts';
import { contentHash } from '../../../../../../lib/learningSubmission.ts';
import { publicLearningSet } from '../../../../../../lib/learningPublic.ts';
import { buildLearningUnits, selectLearningQuestionSet } from '../../../../../../lib/learningUnits.ts';
import { buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../lib/questionV3Grading.ts';
import { compileLearningCatalog } from '../../../../../../scripts/build-learning-unit-catalog.ts';
import { inspectBankSnapshot, learningCatalogForBank } from '../../../../../../scripts/import-question-bank-v3.ts';

globalThis.fetch = async () => { throw Error('This preparation prohibits network access'); };
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous = `${D}/prepared-reviewed-v7`, output = `${D}/c/prepared-reviewed-v8`;
const proposalFile = `${D}/c/resume-review-2026-09-12/r3-source-followup-proposal-v1/proposal.json`;
const manifestFile = `${D}/execution-resumes/resume-2026-09-12-v3/canary/manifest.json`;
const runtimeFile = `${D}/execution-runtime-v6.json`;
const qaDirectory = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v3/canary/author-qa-c/pilot-03-001/author-qa';
const serial = v => JSON.stringify(v, null, 2) + '\n';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const identity = f => ({ file: f, sha256: sha256(fs.readFileSync(f)) });
const snapshots = new Map();
const capture = (file, expected) => { const row = identity(file); if (expected) assert.equal(row.sha256, expected); const old = snapshots.get(file); if (old) assert.equal(old.sha256, row.sha256); snapshots.set(file, row); return read(file); };
for (const f of ['candidate-authoring.json', 'candidate-public.json', 'classification-review.json', 'learning-question-classifications.json', 'pilot-03-001-plan.json', 'changes.json']) assert(!fs.existsSync(`${output}/${f}`), 'Never overwrite a candidate');
const bank = capture(`${previous}/candidate-authoring.json`, '2867c39aead6225d2fdb46e1114a94abf323b275d48714e2c38dde12fb5d6f50');
const oldBank = structuredClone(bank), proposal = capture(proposalFile, '33ed4897c326ce26299fcfdfb9618779536b16e1493b947706261008d780eaa2');
const manifest = capture(manifestFile, 'dc2deafcd2804c55054ddbb7e405b3439ceef9de883a9ba59f5ee8f281e54452');
const runtime = capture(runtimeFile, '5965bfc11dd440298431c418585b335828a23b10ed56fdca6832e8728ed70ba7');
for (const row of manifest.code_files) { const actual = identity(row.file); assert.equal(actual.sha256, row.sha256); snapshots.set(row.file, actual); }
for (const row of runtime.code_files) assert.equal(identity(row.file).sha256, row.sha256);
const canonicalBefore = identity('cpa_uploader/data/cpa_question_sets_v3.authoring.json'); snapshots.set(canonicalBefore.file, canonicalBefore);
const job = manifest.jobs.find(x => x.set_id === 'pilot-03-001'), set = bank.find(x => x.id === job.set_id), oldSet = structuredClone(set);
assert.deepEqual(set, capture(job.file, job.sha256));
const plan = capture(job.plan_file, job.plan_sha256), oldPlan = structuredClone(plan), qa = capture(job.qa_file, job.qa_sha256);
assert.equal(qa.cases.length, 22);
const append = proposal.question_changes[0];
assert.equal(append.operation, 'append'); assert.equal(append.path, 'source_refs');
assert.deepEqual(set.source_refs.map(x => x.id), append.before_ids);
assert(!set.source_refs.some(x => x.id === append.value.id)); set.source_refs.push(structuredClone(append.value));
for (const change of proposal.question_changes.slice(1)) {
    const match = /^subquestions\/sub1\/criteria\/(crit[123])\/source_ref_ids$/.exec(change.path); assert(match);
    const criterion = set.subquestions.find(x => x.id === 'sub1').criteria.find(x => x.id === match[1]);
    assert.deepEqual(criterion.source_ref_ids, change.before); criterion.source_ref_ids = structuredClone(change.after);
}
assert.equal(proposal.question_changes.length, 4);
for (const change of proposal.plan_changes) {
    if (change.path === 'source_unit_ids' || change.path === 'existing_question_difference') { assert.deepEqual(plan[change.path], change.before); plan[change.path] = structuredClone(change.after); }
    else if (change.path === 'metadata/source_support_followup') { assert.equal(plan.metadata.source_support_followup ?? null, change.before); plan.metadata.source_support_followup = structuredClone(change.after); }
    else throw Error('Unapproved plan change');
}
assert.deepEqual(validateQuestionAuthoringPlan(plan), []);
const undoPlan = structuredClone(plan);
undoPlan.source_unit_ids = oldPlan.source_unit_ids; undoPlan.existing_question_difference = oldPlan.existing_question_difference;
delete undoPlan.metadata.source_support_followup;
assert.deepEqual(undoPlan, oldPlan, 'Only the three proposed plan fields may differ');
const source = append.value, sourceBytes = fs.readFileSync(source.file), sourceText = sourceBytes.toString('utf8');
snapshots.set(source.file, identity(source.file));
assert.equal(identity(source.file).sha256, proposal.inputs.source_file.sha256);
assert.equal(source.content_hash, sha256(source.source_quote));
const offset = sourceText.indexOf(source.source_quote); assert(offset >= 0); assert.equal(sourceText.indexOf(source.source_quote, offset + 1), -1);
const startLine = sourceText.slice(0, offset).split('\n').length, endLine = startLine + source.source_quote.split('\n').length - 1;
assert.equal(startLine, 325); assert.equal(endLine, 343);
assert(sourceBytes.includes(Buffer.from(source.source_quote, 'utf8')));
const catalog = buildSourceCatalog(), unit = catalog.units.find(x => x.id === 'src-fdfd62f7d764e46a4c');
assert(unit && unit.file === source.file && unit.quote.includes(source.source_quote));
for (const id of plan.source_unit_ids) assert(catalog.units.some(x => x.id === id), `Missing source unit ${id}`);

const undo = structuredClone(bank), undoSet = undo.find(x => x.id === set.id);
undoSet.source_refs.pop();
for (const change of proposal.question_changes.slice(1)) undoSet.subquestions[0].criteria.find(x => change.path.includes(`/${x.id}/`)).source_ref_ids = change.before;
assert.deepEqual(undo, oldBank, 'Only one source reference and three supporting-ref lists may differ');
const validation = validateAuthoringBank(bank); assert.deepEqual(validation.errors, []);
const publicSets = bank.map(compilePublicQuestionSet), oldPublic = oldBank.map(compilePublicQuestionSet), publicUndo = structuredClone(publicSets);
publicUndo.find(x => x.id === set.id).sources = oldPublic.find(x => x.id === set.id).sources;
assert.deepEqual(publicUndo, oldPublic, 'All public question/prompt/fact/point fields must remain identical');
const publicFieldErrors = [];
function inspectPublic(v, path = '$') { if (!v || typeof v !== 'object') return; for (const [k, child] of Object.entries(v)) {
    if (['model_answer', 'criteria', 'requirements', 'source_quote', 'source_refs'].includes(k)) publicFieldErrors.push(`${path}.${k}`);
    inspectPublic(child, `${path}.${k}`);
} }
inspectPublic(publicSets); assert.deepEqual(publicFieldErrors, []);
const bankBytes = serial(bank), publicBytes = serial(publicSets);
const oldReview = capture(`${previous}/classification-review.json`), oldCatalog = capture(`${previous}/learning-question-classifications.json`);
assert.equal(oldReview.entries.length, 350);
const review = { ...oldReview, source_file: `${output}/candidate-authoring.json`, source_file_sha256: sha256(bankBytes), predecessor_file: `${previous}/classification-review.json` };
assert.deepEqual(review.entries, oldReview.entries);
const compiled = compileLearningCatalog(bank, review.entries, oldCatalog.topics);
const nextCatalog = { ...oldCatalog, source_file: review.source_file, source_file_sha256: review.source_file_sha256,
    public_content_hash: contentHash(publicSets), review_file: `${output}/classification-review.json`, review_file_sha256: sha256(serial(review)), classifications: compiled.classifications };
const previousCompiled = compileLearningCatalog(oldBank, oldReview.entries, oldCatalog.topics);
assert.deepEqual(previousCompiled.classifications, oldCatalog.classifications);
const meaningFields = c => ({ learning_question_id: c.learning_question_id, source_set_id: c.source_set_id, subquestion_id: c.subquestion_id,
    question_style: c.question_style, case_set_id: c.case_set_id, topic_ids: c.topic_ids, standalone_prompt: c.standalone_prompt, case_fact_ids: c.case_fact_ids });
assert.deepEqual(compiled.classifications.map(meaningFields), oldCatalog.classifications.map(meaningFields));
const changedClassificationRows = compiled.classifications.filter((x, i) => jsonHash(x) !== jsonHash(oldCatalog.classifications[i]));
assert.equal(changedClassificationRows.length, 2); assert(changedClassificationRows.every(x => x.source_set_id === set.id));
const metadata = learningCatalogForBank(bank, nextCatalog);
assert.deepEqual(metadata, learningCatalogForBank(oldBank, oldCatalog), 'DB classification decisions must be identical');
// Use the public database envelope parser, then rebuild every standalone/case unit.
const safePublic = publicSets.map(s => publicLearningSet({ question_set: s, release_id: 'preparation-no-release',
    set_version_id: compiled.classifications.find(c => c.source_set_id === s.id).source_set_version_id }));
const units = buildLearningUnits(safePublic, compiled.classifications, nextCatalog.topics);
const seen = new Set();
for (const u of units) {
    const members = compiled.classifications.filter(c => c.source_set_id === u.source_set_id && (u.question_style === 'case' ? c.question_style === 'case' : c.subquestion_id === u.subquestions[0].id));
    assert.deepEqual(u.subquestions.map(s => s.id), members.map(c => c.subquestion_id));
    if (u.question_style === 'standard') { assert.equal(u.subquestions.length, 1); assert.equal(u.case_set_id, null); assert.equal(u.shared_context.facts.length, 0); assert.equal(u.subquestions[0].prompt, members[0].standalone_prompt); }
    else { assert.equal(u.case_set_id, u.source_set_id); assert(u.shared_context.facts.length); assert.deepEqual(u.shared_context.facts, bank.find(s => s.id === u.source_set_id).shared_context.facts); }
    for (const sub of u.subquestions) { const key = `${u.source_set_id}/${sub.id}`; assert(!seen.has(key)); seen.add(key); assert(sub.topic_ids.length); }
}
assert.equal(seen.size, 350); inspectPublic(units); assert.deepEqual(publicFieldErrors, []);
// Current native metadata and the reviewed sidecar must select the same style/topics.
const native = bank.flatMap(s => s.subquestions.filter(q => q.question_style).map(q => ({ set: s, q })));
for (const { set: s, q } of native) { const entry = compiled.classifications.find(c => c.source_set_id === s.id && c.subquestion_id === q.id); assert.equal(entry.question_style, q.question_style); assert.deepEqual(entry.topic_ids, q.topic_ids); }
const qaActual = capture(`${qaDirectory}/summary.json`); assert.equal(qaActual.recorded_cases, 22); assert.deepEqual(qaActual.mismatched_case_ids, []); assert.deepEqual(qaActual.changed_inputs, []);
const rawCases = fs.readdirSync(qaDirectory).filter(f => /^case-\d+-attempt-1\.json$/.test(f)).map(f => ({ file: `${qaDirectory}/${f}`, value: capture(`${qaDirectory}/${f}`) }));
assert.equal(rawCases.length, 22);
const actualLinks = [];
for (const test of qa.cases) {
    const raw = rawCases.find(r => r.value.case_id === test.id); assert(raw); assert(raw.value.matched);
    const answers = Object.fromEntries(set.subquestions.map(s => [s.id, s.id === test.subquestion_id ? test.answer : '']));
    assert.deepEqual(raw.value.answers, answers);
    const originalPrompt = sha256(buildGradingPrompt(oldSet, answers)), nextPrompt = sha256(buildGradingPrompt(set, answers));
    // run-author-qa records SHA(JSON.stringify(schema)), preserving key order.
    const originalSchema = sha256(JSON.stringify(buildGradingResponseSchema(oldSet, answers))), nextSchema = sha256(JSON.stringify(buildGradingResponseSchema(set, answers)));
    assert.equal(originalPrompt, nextPrompt); assert.equal(originalSchema, nextSchema);
    assert.equal(originalPrompt, raw.value.request_hash); assert.equal(originalSchema, raw.value.schema_hash);
    const unitId = units.find(u => u.source_set_id === set.id && u.subquestions.some(s => s.id === test.subquestion_id)).id;
    const oldMembers = oldCatalog.classifications.filter(c => c.source_set_id === set.id && c.subquestion_id === test.subquestion_id);
    const nextMembers = compiled.classifications.filter(c => c.source_set_id === set.id && c.subquestion_id === test.subquestion_id);
    const oldSelected = selectLearningQuestionSet(oldSet, oldMembers, unitId), selected = selectLearningQuestionSet(set, nextMembers, unitId);
    const singleAnswers = { [test.subquestion_id]: test.answer };
    const selectedPrompt = sha256(buildGradingPrompt(selected, singleAnswers)), selectedSchema = sha256(JSON.stringify(buildGradingResponseSchema(selected, singleAnswers)));
    assert.equal(selectedPrompt, sha256(buildGradingPrompt(oldSelected, singleAnswers)));
    assert.equal(selectedSchema, sha256(JSON.stringify(buildGradingResponseSchema(oldSelected, singleAnswers))));
    actualLinks.push({ case_id: test.id, actual_file: raw.file, actual_sha256: identity(raw.file).sha256, transport: raw.value.transport,
        raw_request_hash: raw.value.request_hash, raw_schema_hash: raw.value.schema_hash, proposed_full_set_request_hash: nextPrompt, proposed_full_set_schema_hash: nextSchema,
        unit_id: unitId, selected_unit_prompt_sha256: selectedPrompt, selected_unit_schema_sha256: selectedSchema,
        selected_unit_comparison: 'Before/after identical; this projection was not separately model-executed', matched: raw.value.matched });
}
const inspection = inspectBankSnapshot(bankBytes, publicBytes);
const expectedPendingPublication = bank.filter(s => s.status !== 'published' || s.verification.review_status !== 'verified').map(s => `${s.id}: 게시·검토 상태 미완료`);
assert.deepEqual(inspection.report.errors, expectedPendingPublication, 'No structural/import error beyond preserved unreviewed/unpublished state is allowed');
assert.equal(inspection.report.ready, false); assert.equal(expectedPendingPublication.length, 119);
assert.deepEqual(inspection.report.source_hash_mismatches, []);
for (const row of snapshots.values()) assert.equal(identity(row.file).sha256, row.sha256, `Changed during preparation: ${row.file}`);
const write = (name, value) => fs.writeFileSync(`${output}/${name}`, serial(value), { flag: 'wx' });
write('candidate-authoring.json', bank); write('candidate-public.json', publicSets); write('classification-review.json', review);
write('learning-question-classifications.json', nextCatalog); write('db-learning-metadata.json', metadata); write('pilot-03-001-plan.json', plan);
write('plan-override.json', { entries: [{ set_id: set.id, file: `${output}/pilot-03-001-plan.json`, sha256: sha256(serial(plan)) }], other_plans:'Use latest selected manifest; this file overrides only pilot-03-001.' });
write('qa-grading-input-continuity.json', { created_at: new Date().toISOString(), runtime: identity(runtimeFile), original_actual_summary: identity(`${qaDirectory}/summary.json`),
    original_qa: identity(job.qa_file), case_count: actualLinks.length, full_set_direct_actual_hash_matches: 22, selected_unit_before_after_matches: 22,
    selected_units: [...new Set(actualLinks.map(x => x.unit_id))], api_calls: 0, new_model_execution: false, records: actualLinks });
write('changes.json', { created_at: new Date().toISOString(), predecessor: identity(`${previous}/candidate-authoring.json`), proposal: identity(proposalFile),
    inputs: [...snapshots.values()], question_changes: proposal.question_changes, plan_changes: proposal.plan_changes,
    source_verification: { file: source.file, file_sha256: identity(source.file).sha256, quote_sha256: source.content_hash, exact_utf8_bytes: true, start_line: startLine, end_line: endLine,
        catalog_unit_id: unit.id, catalog_locator: unit.locator, catalog_contains_quote: true },
    preserved: { undo_bank_deep_equal: true, question_ids_facts_prompts_answers_claims_points_status: true, requirements: true, all_350_classification_decisions: true,
        public_question_payload_except_source_metadata: true, canonical_bytes: canonicalBefore, original_plan_except_listed_fields: true },
    classification_identity_changes: changedClassificationRows.map(x => ({ set_id: x.source_set_id, subquestion_id: x.subquestion_id, reason: 'source content hash/version changes; semantic classification and stable learning question IDs unchanged' })),
    before_reviewed_content_hash: reviewedContentHash(oldSet), after_reviewed_content_hash: reviewedContentHash(set),
    api_calls: 0, db_calls: 0, old_receipts_changed: false, actual_semantic_review_for_new_bank: 'not_run; new bank epoch requires all selected semantic reviews', human_approval_or_publication: false });
const counts = { sets: bank.length, questions: bank.reduce((n,s)=>n+s.subquestions.length,0), criteria: bank.reduce((n,s)=>n+s.subquestions.reduce((m,q)=>m+q.criteria.length,0),0),
    points: publicSets.reduce((n,s)=>n+s.max_points,0), classification_decisions: review.entries.length, learning_units: units.length,
    standard_questions: compiled.classifications.filter(x=>x.question_style==='standard').length, case_questions: compiled.classifications.filter(x=>x.question_style==='case').length, native_questions: native.length };
write('summary.json', { created_at: new Date().toISOString(), status: 'prepared_static_only', counts,
    validation: { authoring_errors: validation.errors, import_preconditions: inspection.report, public_field_leaks: publicFieldErrors,
        all_case_members_complete: true, all_standard_independent: true, native_metadata_consistent: true, exact_source_ref: true,
        undo_equals_v7: true, unchanged_qa_request_schema: 22, unchanged_selected_unit_request_schema: 22,
        import_readiness: false, preserved_pending_publication_sets: expectedPendingPublication.length, structural_import_errors_beyond_pending_status: 0 },
    files: ['candidate-authoring.json','candidate-public.json','classification-review.json','learning-question-classifications.json','db-learning-metadata.json','pilot-03-001-plan.json','plan-override.json','changes.json','qa-grading-input-continuity.json'].map(name=>identity(`${output}/${name}`)),
    api_calls: 0, db_mutations: 0, actual_semantic_review:'not_run_for_this_epoch', actual_grading:'prior_same_input_R3_QA22_linked; no new calls', production_publication:false });
console.log(JSON.stringify({ ...counts, bank_sha256: sha256(bankBytes), plan_sha256: sha256(serial(plan)), source_ref_added: 1, criterion_source_lists_changed: 3, api_calls: 0 }));
