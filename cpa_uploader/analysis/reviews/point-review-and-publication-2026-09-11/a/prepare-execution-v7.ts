import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { buildReviewChunkInput, prepareSemanticReview } from '../../../../questionSemanticReview.ts';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { validateQuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import type { QuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import { compileLearningCatalog } from '../../../../../scripts/build-learning-unit-catalog.ts';

// Local preparation only. Never calls a model, starts a worker, or changes prior artifacts.
const BASE = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const OUTPUT = `${BASE}/a/execution-all-v7`;
const BANK = `${BASE}/prepared-reviewed-v7/candidate-authoring.json`;
const LEDGER = `${BASE}/prepared-reviewed-v7/notes-merge.json`;
const PREVIOUS = `${BASE}/execution-all-v6/manifest.json`;
const PLAN_OVERRIDES = `${BASE}/prepared-reviewed-v7/plan-overrides.json`;
const QA_MANIFEST = `${BASE}/qa-prepared-v5/manifest.json`;
const CLASSIFICATION_REVIEW = `${BASE}/prepared-reviewed-v7/classification-review.json`;
const CLASSIFICATION_CATALOG = `${BASE}/prepared-reviewed-v7/learning-question-classifications.json`;
const SELF = fileURLToPath(import.meta.url);
const MAXIMUM = 500000;
type Identity = { file: string; sha256: string };
type NoteChange = { set_id: string; note_index: number; before: string; after: string };
type ScopeChange = { set_id: string; subquestion_id: string; field: string; before: string; after: string;
    proposal_file: string; proposal_sha256: string };
type Job = { set_id: string; worker: 'a' | 'b' | 'c'; file: string; sha256: string;
    plan_file: string; plan_sha256: string; qa_file: string; qa_sha256: string; source_files: Identity[];
    semantic_units: number; questions: number; criteria: number; author_qa_cases: number };
type Manifest = { bank_file: string; bank_sha256: string; code_files: Identity[]; jobs: Job[];
    model: string; review_model: string; max_input_chars: number; source_catalog_fingerprint: string;
    max_concurrent_workers: number };
type Merge = { inputs: Identity[]; changes: NoteChange[]; scoped_changes?: ScopeChange[];
    classification_contract_files?: Identity[] };
type Entry = Identity & { set_id: string; cases?: number };
type PlanFile = QuestionAuthoringPlan | { plans: (QuestionAuthoringPlan & { set_id?: string })[] };
type ClassificationReview = { source_file: string; source_file_sha256: string; entries: Parameters<typeof compileLearningCatalog>[1] };
type ClassificationCatalog = { source_file: string; source_file_sha256: string; review_file: string; review_file_sha256: string;
    topics: Parameters<typeof compileLearningCatalog>[2]; classifications: ReturnType<typeof compileLearningCatalog>['classifications'] };
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const serial = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const identity = (file: string): Identity => ({ file, sha256: sha(fs.readFileSync(file)) });
const verify = (row: Identity) => assert.equal(identity(row.file).sha256, row.sha256, `Frozen input changed: ${row.file}`);
const unique = (rows: Identity[]) => {
    const result = new Map<string, Identity>();
    for (const row of rows) {
        const key = path.resolve(row.file).toLowerCase();
        if (result.has(key)) assert.equal(result.get(key)!.sha256, row.sha256, `Conflicting hashes: ${row.file}`);
        else result.set(key, row);
    }
    return [...result.values()];
};
const actualPlan = (file: string, setId: string): QuestionAuthoringPlan => {
    const raw = read<PlanFile>(file);
    const matches = 'plans' in raw ? raw.plans.filter(plan => plan.set_id === setId) : [raw];
    assert.equal(matches.length, 1, 'Exactly one frozen plan is required');
    assert.deepEqual(validateQuestionAuthoringPlan(matches[0]), []);
    return matches[0];
};
function only03Override(before: Entry[], after: Entry[], allowed: boolean, label: string) {
    assert.deepEqual(after.map(row => row.set_id), before.map(row => row.set_id), `${label}: membership/order changed`);
    assert.equal(new Set(after.map(row => row.set_id)).size, after.length, `${label}: duplicate ID`);
    for (const [i, next] of after.entries()) {
        if (allowed && next.set_id === 'pilot-03-001') { verify(next); continue; }
        assert.deepEqual(next, before[i], `${label}: undeclared override`);
    }
}

export function verifyTransition(before: QuestionSetV3[], after: QuestionSetV3[], merge: Pick<Merge, 'changes' | 'scoped_changes'>) {
    assert.deepEqual(after.map(set => set.id), before.map(set => set.id), 'Bank ID/order changes are not allowed');
    assert.equal(new Set(after.map(set => set.id)).size, after.length, 'Duplicate bank ID');
    const undo = structuredClone(after);
    const noteKeys = new Set<string>();
    for (const change of merge.changes) {
        assert.equal(typeof change.before, 'string'); assert.equal(typeof change.after, 'string');
        assert.notEqual(change.before, change.after, 'No-op notes change');
        assert(Number.isSafeInteger(change.note_index) && change.note_index >= 0, 'Invalid note index');
        const key = `${change.set_id}/${change.note_index}`;
        assert(!noteKeys.has(key), 'Duplicate notes target'); noteKeys.add(key);
        const old = before.find(set => set.id === change.set_id), next = undo.find(set => set.id === change.set_id);
        assert(old && next, 'Unknown note set');
        assert.equal(old.verification.notes[change.note_index], change.before, `${key}: before note mismatch`);
        assert.equal(next.verification.notes[change.note_index], change.after, `${key}: after note mismatch`);
        next.verification.notes[change.note_index] = change.before;
    }
    const scopeKeys = new Set<string>();
    for (const change of merge.scoped_changes ?? []) {
        assert.equal(change.set_id, 'pilot-03-001', 'Only the separately reviewed 03-001 scope may change');
        assert.equal(change.subquestion_id, 'sub1'); assert.equal(change.field, 'prompt');
        assert.equal(typeof change.before, 'string'); assert.equal(typeof change.after, 'string');
        assert(change.before.trim() && change.after.trim() && change.before !== change.after, 'Invalid scope wording');
        const key = `${change.set_id}/${change.subquestion_id}/${change.field}`;
        assert(!scopeKeys.has(key), 'Duplicate scope target'); scopeKeys.add(key);
        const old = before.find(set => set.id === change.set_id)?.subquestions.find(sub => sub.id === change.subquestion_id);
        const next = undo.find(set => set.id === change.set_id)?.subquestions.find(sub => sub.id === change.subquestion_id);
        assert(old && next, 'Scope target missing');
        assert.equal(old.prompt, change.before, 'Scope before mismatch');
        assert.equal(next.prompt, change.after, 'Scope after mismatch'); next.prompt = change.before;
    }
    assert.deepEqual(undo, before, 'Undeclared question/answer/criterion/source/metadata change');
    assert.equal(JSON.stringify(undo), JSON.stringify(before), 'Restored JSON structure/order differs from v6');
    return { note_replacements: noteKeys.size, scoped_prompt_changes: scopeKeys.size,
        changed_note_sets: new Set(merge.changes.map(change => change.set_id)).size,
        restored_v6_json_sha256: sha(JSON.stringify(undo)) };
}

function selfTest() {
    const original = read<QuestionSetV3[]>(`${BASE}/prepared-reviewed-v6/candidate-authoring.json`);
    const target = original.find(set => set.id === 'pilot-03-001')!;
    assert(target.verification.notes.length > 0);
    const note: NoteChange = { set_id: target.id, note_index: 0, before: target.verification.notes[0], after: '후속 문서 경로' };
    const after = structuredClone(original); after.find(set => set.id === target.id)!.verification.notes[0] = note.after;
    verifyTransition(original, after, { changes: [note] });
    let rejected = 0;
    const reject = (run: () => void) => { assert.throws(run); rejected++; };
    reject(() => verifyTransition(original, after, { changes: [] }));
    reject(() => verifyTransition(original, after, { changes: [note, note] }));
    reject(() => verifyTransition(original, after, { changes: [{ ...note, before: '다른 원문' }] }));
    reject(() => verifyTransition(original, after, { changes: [{ ...note, note_index: -1 }] }));
    const rogue = structuredClone(after); rogue[0].subquestions[0].criteria[0].max_points++;
    reject(() => verifyTransition(original, rogue, { changes: [note] }));
    const sourceRogue = structuredClone(after); sourceRogue[0].source_refs[0].source_quote += '숨은 변경';
    reject(() => verifyTransition(original, sourceRogue, { changes: [note] }));
    const scope: ScopeChange = { set_id: target.id, subquestion_id: 'sub1', field: 'prompt',
        before: target.subquestions.find(sub => sub.id === 'sub1')!.prompt, after: '승인된 범위 한정의 형상 검사용 문구',
        proposal_file: 'fixture-only', proposal_sha256: '0'.repeat(64) };
    const scoped = structuredClone(after); scoped.find(set => set.id === target.id)!.subquestions.find(sub => sub.id === 'sub1')!.prompt = scope.after;
    verifyTransition(original, scoped, { changes: [note], scoped_changes: [scope] });
    reject(() => verifyTransition(original, scoped, { changes: [note], scoped_changes: [{ ...scope, field: 'model_answer' }] }));
    reject(() => verifyTransition(original, scoped, { changes: [note], scoped_changes: [scope, scope] }));
    console.log(JSON.stringify({ mode: 'self_test', accepted: 2, rejected, api_calls: 0, files_written: 0 }));
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--self-test') return selfTest();
    assert.equal(args.length, 0, 'Use no arguments for preparation or --self-test for read-only guard tests');
    assert(!fs.existsSync(OUTPUT), 'Execution output already exists; never overwrite');
    assert([BANK, LEDGER, PLAN_OVERRIDES, QA_MANIFEST, CLASSIFICATION_REVIEW, CLASSIFICATION_CATALOG].every(file => fs.existsSync(file)), 'v7 candidate/notes-merge/plan/QA/classification is not ready; no output created');
    const previous = read<Manifest>(PREVIOUS), merge = read<Merge>(LEDGER);
    assert.equal(identity(PREVIOUS).sha256, '6511a119245a0e6fd80a1f361ce1f7709da112bd1b1dfb54849f84a32e1dc791');
    assert.equal(previous.bank_sha256, 'e43cd491c08faebd70c02eb67bfe15198e669b66a6372b723ed539da229fd94a');
    assert.equal(previous.max_input_chars, MAXIMUM); assert.equal(previous.max_concurrent_workers, 3);
    const before = read<QuestionSetV3[]>(previous.bank_file), bank = read<QuestionSetV3[]>(BANK);
    const transition = verifyTransition(before, bank, merge);
    const scoped03 = (merge.scoped_changes ?? []).length === 1;
    const beforePlans = read<{ entries: Entry[] }>(`${BASE}/prepared-reviewed-v6/plan-overrides.json`);
    const nextPlans = read<{ entries: Entry[]; bank: Identity }>(PLAN_OVERRIDES);
    const beforeQa = read<{ entries: Entry[] }>(`${BASE}/qa-prepared-v4/manifest.json`);
    const nextQa = read<{ entries: Entry[]; bank_file: string; bank_sha256: string }>(QA_MANIFEST);
    only03Override(beforePlans.entries, nextPlans.entries, scoped03, 'plan');
    only03Override(beforeQa.entries, nextQa.entries, scoped03, 'QA');
    assert.equal(nextPlans.bank.file, BANK); assert.equal(nextPlans.bank.sha256, identity(BANK).sha256);
    assert.equal(nextQa.bank_file, BANK); assert.equal(nextQa.bank_sha256, identity(BANK).sha256);
    const priorClassification = read<ClassificationReview>(`${BASE}/prepared-reviewed-v6/classification-review.json`);
    const classification = read<ClassificationReview>(CLASSIFICATION_REVIEW);
    const learningCatalog = read<ClassificationCatalog>(CLASSIFICATION_CATALOG);
    assert.equal(classification.source_file, BANK); assert.equal(classification.source_file_sha256, identity(BANK).sha256);
    assert.equal(learningCatalog.source_file, BANK); assert.equal(learningCatalog.source_file_sha256, identity(BANK).sha256);
    assert.equal(learningCatalog.review_file, CLASSIFICATION_REVIEW);
    assert.equal(learningCatalog.review_file_sha256, identity(CLASSIFICATION_REVIEW).sha256);
    assert.equal(classification.entries.length, priorClassification.entries.length);
    for (const [i, next] of classification.entries.entries()) {
        const prior = priorClassification.entries[i];
        if (scoped03 && next.set_id === 'pilot-03-001' && next.subquestion_id === 'sub1') {
            const fixed = (entry: typeof next) => Object.fromEntries(Object.entries(entry).filter(([key]) => !['reason', 'standalone_prompt'].includes(key)));
            assert.deepEqual(fixed(next), fixed(prior), '03 classification changed style/topic/facts/lineage');
            assert.equal(next.question_style, 'standard'); assert.deepEqual(next.topic_ids, ['03']);
            assert(next.reason.trim());
            const prompt = bank.find(set => set.id === next.set_id)!.subquestions.find(sub => sub.id === next.subquestion_id)!.prompt;
            assert(next.standalone_prompt === null || next.standalone_prompt === prompt, '03 independent prompt differs from reviewed scope');
        } else assert.deepEqual(next, prior, 'Undeclared classification change');
    }
    const recompiled = compileLearningCatalog(bank, classification.entries, learningCatalog.topics);
    assert.deepEqual(recompiled.classifications, learningCatalog.classifications, 'v7 classification/source identity mismatch');
    assert.equal(bank.length, 153); assert.equal(previous.jobs.length, 119);
    assert.equal(new Set(previous.jobs.map(job => job.set_id)).size, 119);
    const predecessorInputs = previous.jobs.flatMap(job => [{ file: job.file, sha256: job.sha256 },
        { file: job.plan_file, sha256: job.plan_sha256 }, { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files]);
    const followupInputs = [identity(PLAN_OVERRIDES), identity(QA_MANIFEST), identity(CLASSIFICATION_REVIEW), identity(CLASSIFICATION_CATALOG),
        identity('scripts/build-learning-unit-catalog.ts'),
        ...nextPlans.entries, ...nextQa.entries, ...(merge.scoped_changes ?? []).map(change => ({ file: change.proposal_file, sha256: change.proposal_sha256 }))];
    const inputs = unique([identity(PREVIOUS), identity(BANK), identity(LEDGER), identity(SELF),
        { file: previous.bank_file, sha256: previous.bank_sha256 }, ...previous.code_files, ...predecessorInputs,
        ...merge.inputs, ...(merge.classification_contract_files ?? []), ...followupInputs]);
    inputs.forEach(verify);
    const catalog = buildSourceCatalog();
    assert.equal(catalog.fingerprint, previous.source_catalog_fingerprint, 'Source catalog changed');
    const checks: Record<string, unknown>[] = [], errors: { set_id: string; error: string }[] = [];
    const jobs: Job[] = []; const bodies = new Map<string, string>();
    let questionCount = 0, criterionCount = 0, unitCount = 0, largest = 0;
    for (const oldJob of previous.jobs) {
        try {
            const set = bank.find(set => set.id === oldJob.set_id); assert(set, 'Assigned set is absent from v7');
            const job = { ...oldJob };
            const selectedQa = nextQa.entries.find(row => row.set_id === set.id); assert(selectedQa, 'Missing QA selection');
            const priorPlan = actualPlan(oldJob.plan_file, set.id);
            if (scoped03 && set.id === 'pilot-03-001') {
                const selectedPlan = nextPlans.entries.find(row => row.set_id === set.id); assert(selectedPlan, 'Missing scope plan');
                assert.notEqual(selectedPlan.file, oldJob.plan_file, 'Scope plan must preserve predecessor');
                assert.notEqual(selectedQa.file, oldJob.qa_file, 'Scope QA must preserve predecessor');
                assert.equal(selectedQa.cases, oldJob.author_qa_cases + 5, 'Exactly five scoped counterexamples are authorized');
                Object.assign(job, { plan_file: selectedPlan.file, plan_sha256: selectedPlan.sha256,
                    qa_file: selectedQa.file, qa_sha256: selectedQa.sha256, author_qa_cases: selectedQa.cases });
                const priorCases = read<{ cases: { id: string }[] }>(oldJob.qa_file).cases;
                const currentCases = read<{ cases: { id: string; subquestion_id: string }[] }>(job.qa_file).cases;
                assert.equal(new Set(currentCases.map(row => row.id)).size, currentCases.length, 'Duplicate followup QA ID');
                for (const test of priorCases) assert.deepEqual(currentCases.find(row => row.id === test.id), test, 'Historical QA answer/expectation changed');
                const added = currentCases.filter(row => !priorCases.some(prior => prior.id === row.id));
                assert.equal(added.length, 5); assert(added.every(row => row.subquestion_id === 'sub1'), 'New QA outside sub1');
            } else {
                assert.equal(selectedQa.file, oldJob.qa_file); assert.equal(selectedQa.sha256, oldJob.qa_sha256);
                assert.equal(selectedQa.cases, oldJob.author_qa_cases);
            }
            const originalFile = read<QuestionSetV3 | QuestionSetV3[]>(oldJob.file);
            const originalSet = Array.isArray(originalFile) ? originalFile[0] : originalFile;
            assert.deepEqual(originalSet, before.find(row => row.id === set.id), 'v6 job differs from v6 comparison bank');
            const plan = actualPlan(job.plan_file, set.id);
            if (scoped03 && set.id === 'pilot-03-001') {
                const withoutScope = (value: QuestionAuthoringPlan) => Object.fromEntries(Object.entries(value).filter(([key]) => !['scope', 'metadata'].includes(key)));
                assert.deepEqual(withoutScope(plan), withoutScope(priorPlan), 'Followup plan changed fields outside scope/metadata');
                assert(plan.scope.required_answers.join('\n').includes(set.subquestions.find(sub => sub.id === 'sub1')!.prompt), 'Followup plan omits exact new prompt');
            } else assert.deepEqual(plan, priorPlan);
            const planSources = plan.source_unit_ids.map(id => { const unit = catalog.units.find(unit => unit.id === id);
                assert(unit, `Missing registered plan source: ${id}`); return unit.file; });
            const qa = read<{ set_id: string; cases: unknown[] }>(job.qa_file);
            assert.equal(qa.set_id, set.id); assert.equal(qa.cases.length, job.author_qa_cases);
            const prepared = prepareSemanticReview(set, { bank, authoringPlan: plan, maxInputChars: MAXIMUM });
            const context = prepared.requestContext as { source_excerpts: { id: string; line_start: number | null;
                source_quote_line_start: number | null; quote: string }[]; authoring_plan: unknown; existing_bank: { id: string }[] };
            assert.deepEqual(context.authoring_plan, plan, 'Plan context missing/changed');
            assert.deepEqual(context.existing_bank.map(peer => peer.id), bank.filter(peer => peer.id !== set.id).map(peer => peer.id).sort(), 'Peer context omitted');
            assert.deepEqual(context.source_excerpts.map(row => row.id).sort(), set.source_refs.map(row => row.id).sort(), 'Source context omitted');
            for (const row of context.source_excerpts) {
                assert(row.line_start !== null && row.source_quote_line_start !== null, `Missing exact source location: ${row.id}`);
                assert(row.quote.includes(set.source_refs.find(source => source.id === row.id)!.source_quote), 'Direct quote not in source context');
            }
            const sourceFiles = [...new Set([...prepared.sourceFiles.map(row => row.file), ...planSources])].map(identity).sort((a, b) => a.file.localeCompare(b.file, 'en'));
            assert.deepEqual(sourceFiles, [...oldJob.source_files].sort((a, b) => a.file.localeCompare(b.file, 'en')), 'Frozen source-file set changed');
            const chunkChecks = prepared.units.map(unit => {
                const input = buildReviewChunkInput(prepared, unit); assert(input.length <= MAXIMUM, 'Chunk exceeds 500000 characters');
                const chunk = JSON.parse(input);
                assert.deepEqual(chunk.target_reference_requirements.required_source_ref_ids, unit.sources);
                assert.deepEqual(chunk.reference_catalog.sources.map((row: { id: string }) => row.id).sort(), [...unit.sources].sort(), 'Unit source omitted');
                assert.deepEqual(chunk.reference_catalog.fields, unit.fields, 'Unit field omitted');
                assert.deepEqual(chunk.authoring_plan, plan, 'Unit plan omitted');
                return { unit_id: unit.id, input_chars: input.length, input_sha256: sha(input) };
            });
            const chunkMax = Math.max(...chunkChecks.map(row => row.input_chars));
            const criteria = set.subquestions.reduce((n, sub) => n + sub.criteria.length, 0);
            assert.equal(set.subquestions.length, oldJob.questions); assert.equal(criteria, oldJob.criteria);
            assert.equal(prepared.units.length, oldJob.semantic_units);
            const body = serial(set), file = `${OUTPUT}/sets/${set.id}.json`; bodies.set(file, body);
            jobs.push({ ...job, file, sha256: sha(body) });
            questionCount += set.subquestions.length; criterionCount += criteria; unitCount += prepared.units.length;
            largest = Math.max(largest, chunkMax);
            checks.push({ set_id: set.id, status: 'local_preflight_pass', request_chars: prepared.requestChars,
                max_chunk_chars: chunkMax, units: prepared.units.length, source_locations: 'exact_file_positions',
                source_context_omissions: 0, source_files: prepared.sourceFiles, plan_file: job.plan_file,
                author_qa_cases: qa.cases.length, chunks: chunkChecks, semantic_review: 'not_run', model_grading: 'not_run' });
        } catch (error) { errors.push({ set_id: oldJob.set_id, error: error instanceof Error ? error.message : String(error) }); }
        if ((checks.length + errors.length) % 10 === 0) console.log(`Local preflight ${checks.length + errors.length}/119; errors ${errors.length}`);
    }
    inputs.forEach(verify);
    if (!errors.length) assert.deepEqual([jobs.length, questionCount, criterionCount, unitCount], [119, 280, 1113, 1393]);
    const preflight = { created_at: new Date().toISOString(), bank: identity(BANK), predecessor: identity(PREVIOUS),
        notes_merge: identity(LEDGER), transition, classification_contract: { review: identity(CLASSIFICATION_REVIEW),
            catalog: identity(CLASSIFICATION_CATALOG), verified_rows: recompiled.classifications.length },
        preparation_inputs: inputs, source_catalog_fingerprint: catalog.fingerprint,
        selected_sets: previous.jobs.length, checked_sets: checks.length, questions: questionCount, criteria: criterionCount,
        semantic_units: unitCount, largest_chunk_chars: largest, max_input_chars: MAXIMUM, api_calls: 0, errors, checks };
    fs.mkdirSync(OUTPUT); const write = (file: string, value: unknown) => fs.writeFileSync(file, serial(value), { flag: 'wx' });
    write(`${OUTPUT}/preflight.json`, preflight);
    assert.equal(errors.length, 0, 'Preflight failed; partial local evidence saved, no execution manifest/API calls');
    fs.mkdirSync(`${OUTPUT}/sets`);
    for (const [file, body] of bodies) fs.writeFileSync(file, body, { flag: 'wx' });
    const workers = ['a', 'b', 'c'].map(id => ({ id, units: jobs.filter(job => job.worker === id).reduce((n, job) => n + job.semantic_units, 0) }));
    const manifest = { created_at: new Date().toISOString(), purpose: 'v7_followup_mandatory_actual_verification_not_yet_run',
        predecessor: identity(PREVIOUS), preparation_tool: identity(SELF), notes_merge: identity(LEDGER), transition,
        user_authorization: '필수 전수검증을 진행하고 통과 후 DB 반영', bank_file: BANK, bank_sha256: identity(BANK).sha256,
        code_files: unique([...previous.code_files, identity(LEDGER), identity(PLAN_OVERRIDES), identity(QA_MANIFEST),
            identity(CLASSIFICATION_REVIEW), identity(CLASSIFICATION_CATALOG),
            ...(merge.classification_contract_files ?? []), ...(merge.scoped_changes ?? []).map(change => ({ file: change.proposal_file, sha256: change.proposal_sha256 }))]),
        model: previous.model, review_model: previous.review_model,
        max_input_chars: MAXIMUM, source_catalog_fingerprint: catalog.fingerprint,
        preflight_file: `${OUTPUT}/preflight.json`, preflight_sha256: identity(`${OUTPUT}/preflight.json`).sha256,
        max_concurrent_workers: 3, workers, jobs };
    inputs.forEach(verify); write(`${OUTPUT}/manifest.json`, manifest);
    console.log(JSON.stringify({ output: OUTPUT, sets: jobs.length, questions: questionCount, criteria: criterionCount,
        semantic_units: unitCount, largest_chunk_chars: largest, workers, api_calls: 0 }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main();
