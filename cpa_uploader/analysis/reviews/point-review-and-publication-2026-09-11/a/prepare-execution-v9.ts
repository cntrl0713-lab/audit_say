import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema } from '../../../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3, QuestionSetGradeResultV3, GradingTraceV3 } from '../../../../../lib/questionV3Grading.ts';
import { buildReviewChunkInput, prepareSemanticReview } from '../../../../questionSemanticReview.ts';
import { buildSourceCatalog } from '../../../../questionSourceCatalog.mjs';
import { validateQuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import type { QuestionAuthoringPlan } from '../../../../questionAuthoringPlan.ts';
import { compileLearningCatalog } from '../../../../../scripts/build-learning-unit-catalog.ts';

// Local preflight and preservation of prior QA only. Changed grader and bank require new execution.
const BASE = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const PREVIOUS = `${BASE}/a/execution-all-v8/manifest.json`;
const CANDIDATE = `${BASE}/c/prepared-reviewed-v8`;
const OUTPUT = `${BASE}/a/execution-all-v9`;
const RUNTIME = `${BASE}/execution-runtime-v7.json`;
const B_FOLLOWUP = `${BASE}/b/canary-followup-v2`;
const SELF = fileURLToPath(import.meta.url);
const TARGET = 'pilot-03-001', LIMIT = 500000;
type Identity = { file: string; sha256: string };
type Job = { set_id: string; worker: string; file: string; sha256: string; plan_file: string; plan_sha256: string;
    qa_file: string; qa_sha256: string; author_qa_cases: number; source_files: Identity[]; questions: number; criteria: number; semantic_units: number };
type Manifest = { bank_file: string; bank_sha256: string; code_files: Identity[]; jobs: Job[]; model: string; review_model: string;
    max_input_chars: number; source_catalog_fingerprint: string; [key: string]: unknown };
type Plan = QuestionAuthoringPlan & { metadata?: Record<string, unknown> };
type Source = QuestionSetV3['source_refs'][number];
type Ledger = { predecessor: Identity; inputs: Identity[]; proposal: Identity;
    question_changes: ({ operation: 'append'; path: 'source_refs'; before_ids: string[]; value: Source } |
        { operation?: string; path: string; before: string[]; after: string[] })[];
    plan_changes: { path: string; before: unknown; after: unknown }[] };
type QaCase = { id: string; subquestion_id: string; answer: string; expected_points: number;
    expected_verdicts: { criterion_id: string; verdict: string }[] };
type Qa = { set_id: string; cases: QaCase[]; [key: string]: unknown };
type RuntimeChange = { file: string; before_sha256: string; after_sha256: string; snapshot: Identity };
type Runtime = { predecessor: Identity; grading_model: string; review_model: string; code_files: Identity[];
    preservation: Identity; changed_predecessor_files: RuntimeChange[]; policy_changes: RuntimeChange[] };
type RecordQa = { case_id: string; expected: QaCase; answers: Record<string, string>; model: string; transport: string;
    matched: boolean; request_hash: string; schema_hash: string; raw_judgment: QuestionSetJudgmentV3 | null;
    trace: GradingTraceV3[]; result: QuestionSetGradeResultV3; attempt: number };
const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')) as T;
const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const serial = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const identity = (f: string): Identity => ({ file: f, sha256: sha(fs.readFileSync(f)) });
const verify = (v: Identity) => assert.equal(identity(v.file).sha256, v.sha256, `Frozen input changed: ${v.file}`);
const pins: Identity[] = [
    { file: PREVIOUS, sha256: '0de5e7377689c31655dc020e234f3234b732cb9511ff74e11fccb44b137ce669' },
    { file: RUNTIME, sha256: '17e99d1dff7f6ecaba48658796788be0b1f47b03364cc23c348932474d18a250' },
    { file: `${CANDIDATE}/candidate-authoring.json`, sha256: '11618f57625ae6ec71630f6413411ad513291674573e4eb0f028d129c0eab90b' },
    { file: `${CANDIDATE}/pilot-03-001-plan.json`, sha256: 'bf52cb74adb543097264908f7489986c25da1413f8dd57a99471af552a5e7db8' },
    { file: `${CANDIDATE}/classification-review.json`, sha256: 'b6015ee65cdfeab8f71a9a31435851b05290fc54c63dacb79dd4a1dcb8088417' },
    { file: `${CANDIDATE}/learning-question-classifications.json`, sha256: 'd786f245a218d9837c1ccc0cbd08edf87aec844dafbb614544044c40c594b2e7' },
    { file: `${CANDIDATE}/changes.json`, sha256: 'adc34985711e6479c655f7bba0f84c57ed1b9f9a3352f56faa7306f64746d8e7' },
    { file: `${CANDIDATE}/summary.json`, sha256: '675609c2d4c62e22f97680194030a2dff4c647f4ecbd66d78fefb86d191a0b2f' },
    { file: `${CANDIDATE}/handoff.json`, sha256: 'e092c5f4f873d124136a1e1041ca254c61d8b0fe14c0fd33180435b9ac29aadc' },
    { file: `${CANDIDATE}/qa-grading-input-continuity.json`, sha256: 'e1ffe66a221155b43dd1a81bb67ce1004018eb125568a431fa8cf684ceea0531' },
    { file: `${B_FOLLOWUP}/qa-pilot-05-003.json`, sha256: '103672532d69880f85ad85d46608886320b5aba2226fa0e23eedbe92e6cdcf41' },
    { file: `${B_FOLLOWUP}/plan-pilot-05-003.json`, sha256: 'e2f2163a201d67f5cc0ba9db802164296188792fb601b30b5334f7596bd91910' },
    { file: `${B_FOLLOWUP}/changes.json`, sha256: 'b802d55aed2015fcc4c4884e6eb91a8109715ae155c19f82c78e0ea1ad373a9d' },
    { file: `${B_FOLLOWUP}/checks.json`, sha256: '99c94a5a6e591b0625665397bd32fe4f36210f6fd92d41afb7424e3d1f12db4c' },
];
function unique(rows: Identity[]) {
    const map = new Map<string, Identity>();
    for (const row of rows) { const key = path.resolve(row.file).toLowerCase();
        if (map.has(key)) assert.equal(map.get(key)!.sha256, row.sha256); else map.set(key, row); }
    return [...map.values()];
}
const loadPlan = (file: string, setId: string): Plan => {
    const raw = read<Plan | { plans: (Plan & { set_id: string })[] }>(file);
    const p = 'plans' in raw ? raw.plans.filter(x => x.set_id === setId) : [raw];
    assert.equal(p.length, 1); assert.deepEqual(validateQuestionAuthoringPlan(p[0]), []); return p[0];
};
export function verifyBankTransition(before: QuestionSetV3[], after: QuestionSetV3[], changes: Ledger['question_changes']) {
    assert.equal(changes.length, 4); assert.deepEqual(after.map(s => s.id), before.map(s => s.id));
    const append = changes[0]; assert(append.operation === 'append' && append.path === 'source_refs' && 'value' in append);
    const undo = structuredClone(after), old = before.find(s => s.id === TARGET), set = undo.find(s => s.id === TARGET); assert(old && set);
    assert.deepEqual(old.source_refs.map(s => s.id), append.before_ids);
    assert.deepEqual(set.source_refs.at(-1), append.value); assert.equal(set.source_refs.length, old.source_refs.length + 1);
    assert(!old.source_refs.some(s => s.id === append.value.id)); set.source_refs.pop();
    const seen = new Set<string>();
    for (const change of changes.slice(1)) {
        assert('before' in change && 'after' in change); const match = /^subquestions\/sub1\/criteria\/(crit[123])\/source_ref_ids$/.exec(change.path); assert(match);
        assert(!seen.has(match[1])); seen.add(match[1]); const c: QuestionSetV3['subquestions'][number]['criteria'][number] | undefined = set.subquestions.find(s => s.id === 'sub1')!.criteria.find(c => c.id === match[1]);
        const oldC: typeof c = old.subquestions.find(s => s.id === 'sub1')!.criteria.find(c => c.id === match[1]); assert(c && oldC);
        assert.deepEqual(oldC.source_ref_ids, change.before); assert.deepEqual(c.source_ref_ids, change.after);
        assert.deepEqual(change.after, [...change.before, append.value.id]); c.source_ref_ids = change.before;
    }
    assert.deepEqual([...seen].sort(), ['crit1', 'crit2', 'crit3']); assert.deepEqual(undo, before, 'Undeclared bank change');
    assert.equal(JSON.stringify(undo), JSON.stringify(before)); return append.value;
}
export function verifyPlanTransition(before: Plan, after: Plan, changes: Ledger['plan_changes']) {
    assert.deepEqual(changes.map(c => c.path).sort(), ['existing_question_difference', 'metadata/source_support_followup', 'source_unit_ids']);
    const undo = structuredClone(after);
    for (const change of changes) {
        if (change.path === 'metadata/source_support_followup') {
            assert.equal(before.metadata?.source_support_followup ?? null, change.before); assert.deepEqual(after.metadata?.source_support_followup, change.after);
            delete undo.metadata!.source_support_followup;
        } else {
            const key = change.path as 'source_unit_ids' | 'existing_question_difference'; assert.deepEqual(before[key], change.before); assert.deepEqual(after[key], change.after);
            Object.assign(undo, { [key]: change.before });
        }
    }
    assert.deepEqual(undo, before, 'Undeclared plan change');
}
export function verifyBFollowup(before: Plan, after: Plan, oldQa: Qa, qa: Qa) {
    const undo = structuredClone(after); assert.equal(after.scope.exceptions.length, before.scope.exceptions.length + 2);
    assert.deepEqual(after.scope.exceptions.slice(0, before.scope.exceptions.length), before.scope.exceptions);
    undo.scope.exceptions = before.scope.exceptions; assert(!before.metadata?.r3_followup && after.metadata?.r3_followup);
    delete undo.metadata!.r3_followup; assert.deepEqual(undo, before);
    assert.equal(qa.cases.length, oldQa.cases.length + 2); assert.deepEqual(qa.cases.slice(0, oldQa.cases.length), oldQa.cases);
    assert.deepEqual(qa.cases.slice(-2).map(c => c.id), ['pilot-05-003-sub1-identification-time-not-communication-time-preserved', 'pilot-05-003-sub2-details-explicit-negation-preserved']);
    for (const key of Object.keys(oldQa).filter(k => k !== 'cases')) assert.deepEqual(qa[key], oldQa[key]);
    assert.deepEqual(Object.keys(qa).filter(k => !(k in oldQa)), ['r3_followup_lineage']);
}
function selfTest() {
    pins.forEach(verify); const before = read<QuestionSetV3[]>(read<Manifest>(PREVIOUS).bank_file), after = read<QuestionSetV3[]>(`${CANDIDATE}/candidate-authoring.json`), ledger = read<Ledger>(`${CANDIDATE}/changes.json`);
    verifyBankTransition(before, after, ledger.question_changes); let rejected = 0;
    const reject = (fn: () => void) => { assert.throws(fn); rejected++; };
    const rogue = structuredClone(after); rogue.find(s => s.id === TARGET)!.subquestions[0].prompt += 'changed'; reject(() => verifyBankTransition(before, rogue, ledger.question_changes));
    const points = structuredClone(after); points[0].subquestions[0].criteria[0].max_points++; reject(() => verifyBankTransition(before, points, ledger.question_changes));
    reject(() => verifyBankTransition(before, after, ledger.question_changes.slice(1)));
    const source = structuredClone(after); source.find(s => s.id === TARGET)!.source_refs.at(-1)!.source_quote += 'changed'; reject(() => verifyBankTransition(before, source, ledger.question_changes));
    const plan = loadPlan(read<Manifest>(PREVIOUS).jobs.find(j => j.set_id === TARGET)!.plan_file, TARGET), next = loadPlan(`${CANDIDATE}/pilot-03-001-plan.json`, TARGET);
    verifyPlanTransition(plan, next, ledger.plan_changes); const hidden = structuredClone(next); hidden.scope.conditions.push('changed'); reject(() => verifyPlanTransition(plan, hidden, ledger.plan_changes));
    const b = read<Manifest>(PREVIOUS).jobs.find(j => j.set_id === 'pilot-05-003')!;
    const bPlan = loadPlan(b.plan_file, b.set_id), nextB = loadPlan(`${B_FOLLOWUP}/plan-pilot-05-003.json`, b.set_id);
    const bQa = read<Qa>(b.qa_file), nextQa = read<Qa>(`${B_FOLLOWUP}/qa-pilot-05-003.json`);
    verifyBFollowup(bPlan, nextB, bQa, nextQa);
    const rogueQa = structuredClone(nextQa); rogueQa.cases[0].answer += 'changed'; reject(() => verifyBFollowup(bPlan, nextB, bQa, rogueQa));
    const rogueB = structuredClone(nextB); rogueB.scope.conditions.push('changed'); reject(() => verifyBFollowup(bPlan, rogueB, bQa, nextQa));
    console.log(JSON.stringify({ accepted: 3, rejected, api_calls: 0, writes: 0 }));
}
function qaHistory(beforeBank: QuestionSetV3[], bank: QuestionSetV3[], master: Manifest, capture: (row: Identity) => void, captureHistorical: (row: Identity) => void) {
    const links: Record<string, unknown>[] = []; let live = 0, empty = 0, changedRequests = 0;
    for (const [worker, setId, count] of [['a', 'pilot-01-002', 35], ['b', 'pilot-05-003', 35], ['c', TARGET, 22]] as const) {
        const folder = `cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v3/canary/author-qa-${worker}`;
        const qaDir = `${folder}/${setId}/author-qa`, summaryFile = `${qaDir}/summary.json`, inputFile = `${qaDir}/inputs.json`;
        const overall = read<{ results: { outcome: string; receipt_sha256: string }[]; manifest_sha256: string; model: string; mock: boolean }>(`${folder}/summary.json`);
        capture(identity(`${folder}/summary.json`)); capture(identity(`${folder}/run.json`)); capture(identity(`${folder}/${setId}/request.json`));
        assert.equal(overall.manifest_sha256, 'dc2deafcd2804c55054ddbb7e405b3439ceef9de883a9ba59f5ee8f281e54452');
        assert.equal(overall.model, master.model); assert.equal(overall.mock, false); assert.equal(overall.results[0].outcome, 'pass');
        capture({ file: summaryFile, sha256: overall.results[0].receipt_sha256 }); capture(identity(inputFile));
        const summary = read<{ recorded_cases: number; planned_cases: number; actual_attempts: number; mismatched_case_ids: unknown[]; changed_inputs: unknown[]; records: { file: string; case_id: string; matched: boolean; error: unknown }[] }>(summaryFile);
        assert.deepEqual([summary.recorded_cases, summary.planned_cases, summary.actual_attempts], [count, count, count]);
        assert.deepEqual(summary.mismatched_case_ids, []); assert.deepEqual(summary.changed_inputs, []);
        const inputs = read<{ hashes: Record<string, string>; question_set: QuestionSetV3; qa: Qa; model: string; mock: boolean }>(inputFile);
        for (const [file, h] of Object.entries(inputs.hashes)) captureHistorical({ file, sha256: h });
        const old = beforeBank.find(s => s.id === setId)!, current = bank.find(s => s.id === setId)!, job = master.jobs.find(j => j.set_id === setId)!;
        const qa = read<Qa>(job.qa_file); assert.equal(qa.cases.length, count); assert.deepEqual(inputs.question_set, old); assert.deepEqual(inputs.qa, qa); assert.equal(inputs.model, master.model); assert.equal(inputs.mock, false);
        for (const test of qa.cases) {
            const row = summary.records.find(r => r.case_id === test.id); assert(row && row.matched && !row.error);
            const file = `${qaDir}/${row.file}`; capture(identity(file)); const raw = read<RecordQa>(file);
            assert.equal(raw.model, master.model); assert.equal(raw.attempt, 1); assert(raw.matched); assert.deepEqual(raw.expected, test);
            const answers = Object.fromEntries(current.subquestions.map(s => [s.id, s.id === test.subquestion_id ? test.answer : ''])); assert.deepEqual(raw.answers, answers);
            const prompt = buildGradingPrompt(current, answers), schema = JSON.stringify(buildGradingResponseSchema(current, answers));
            assert.equal(prompt, buildGradingPrompt(old, answers)); assert.equal(schema, JSON.stringify(buildGradingResponseSchema(old, answers)));
            const changed = sha(prompt) !== raw.request_hash; if (changed) changedRequests++;
            assert.equal(sha(schema), raw.schema_hash);
            assert(!raw.raw_judgment?.injection_detected && !raw.raw_judgment?.salad_detected);
            assert(!raw.raw_judgment?.subquestions.some(s => s.injection_detected || s.salad_detected)); assert.equal(raw.result.security_flag, 'none');
            assert(!raw.trace.some(t => t.error));
            let judgment = raw.raw_judgment;
            if (test.answer.trim()) { assert.equal(raw.transport, 'live_model'); assert(judgment); assert(raw.trace.some(t => t.response)); live++; }
            else { assert.equal(raw.transport, 'production_empty_answer_no_model'); assert.equal(judgment, null); assert.equal(raw.trace.length, 0); empty++;
                judgment = { subquestions: raw.result.subquestions.map(s => ({ subquestion_id: s.subquestion_id, verdicts: s.criteria.map(c => ({ criterion_id: c.criterion_id, verdict: c.verdict, reason: c.reason })) })) }; }
            const rescored = applyQuestionSetJudgment(current, answers, judgment!); assert.deepEqual(rescored, raw.result); assert.equal(rescored.score, test.expected_points);
            links.push({ set_id: setId, case_id: test.id, original: identity(file), model: raw.model, transport: raw.transport,
                original_request_hash: raw.request_hash, current_request_hash: sha(prompt), original_schema_hash: raw.schema_hash, current_schema_hash: sha(schema),
                source_only_bank_change_preserves_current_payload: true, request_changed_since_actual_run: changed,
                original_expected_unchanged: true, original_raw_security_false: true, local_arithmetic_replay_exact: true, points: rescored.score,
                new_model_call: false, accepted_as_current_model_validation: false, followup_execution: 'required_on_final_runtime' });
        }
    }
    assert.equal(links.length, 92); assert.equal(changedRequests, 92);
    return { cases: 92, live_model_records: live, empty_no_model_records: empty, changed_request_hashes: changedRequests, records: links,
        accepted_as_current_model_validation: false, new_api_calls: 0,
        scope: 'R3의 전체 세트 작성자 QA 92개에 대한 과거 원시·입력·기대·합산 보존 대조다. 출처만 보완한 은행은 같은 코드에서 학생 입력을 바꾸지 않지만 runtimev7의 판정 지침이 92개 입력 해시를 모두 바꾸므로 실측을 승계하지 않는다. 로컬 원시 합산 재생은 새 의미 판단이나 별도 선택 학습 단위 실측이 아니다.' };
}
function main() {
    globalThis.fetch = async () => { throw Error('No network is allowed in this preparation'); };
    if (process.argv.length === 3 && process.argv[2] === '--self-test') return selfTest();
    assert.equal(process.argv.length, 2); assert(!fs.existsSync(OUTPUT), 'Never overwrite an execution epoch'); pins.forEach(verify);
    const previous = read<Manifest>(PREVIOUS), ledger = read<Ledger>(`${CANDIDATE}/changes.json`), bankFile = `${CANDIDATE}/candidate-authoring.json`;
    const oldBank = read<QuestionSetV3[]>(previous.bank_file), bank = read<QuestionSetV3[]>(bankFile);
    assert.equal(previous.jobs.length, 119); assert.equal(bank.length, 153); assert.equal(previous.max_input_chars, LIMIT);
    const source = verifyBankTransition(oldBank, bank, ledger.question_changes); assert.deepEqual(ledger.predecessor, { file: previous.bank_file, sha256: previous.bank_sha256 });
    assert(fs.readFileSync(source.file, 'utf8').includes(source.source_quote)); assert.equal(source.content_hash, sha(source.source_quote));
    const runtime = read<Runtime>(RUNTIME); assert.equal(runtime.grading_model, previous.model); assert.equal(runtime.review_model, previous.review_model);
    assert.deepEqual(runtime.changed_predecessor_files.map(c => c.file).sort(), ['cpa_uploader/questionSemanticReview.ts', 'lib/questionV3Grading.ts']);
    const runtimeChanges = [...runtime.changed_predecessor_files, ...runtime.policy_changes];
    for (const change of runtimeChanges) { assert.equal(change.before_sha256, change.snapshot.sha256); verify(change.snapshot); verify({ file: change.file, sha256: change.after_sha256 }); }
    const changeFor = (file: string) => runtimeChanges.find(c => path.resolve(c.file).toLowerCase() === path.resolve(file).toLowerCase());
    const revisedCode = previous.code_files.map(row => { const c = changeFor(row.file); if (!c) return row;
        assert.equal(row.sha256, c.before_sha256); return { file: row.file, sha256: c.after_sha256 }; });
    for (const row of runtime.code_files) assert.deepEqual(revisedCode.find(c => c.file === row.file), row, 'Undeclared runtime code change');
    const snapshots = new Map<string, Identity>(); const capture = (row: Identity) => { verify(row); const key = path.resolve(row.file).toLowerCase();
        if (snapshots.has(key)) assert.equal(snapshots.get(key)!.sha256, row.sha256); else snapshots.set(key, row); };
    const historicalBindings = new Map<string, { original: Identity; preservation: Identity; current: Identity }>();
    const captureHistorical = (row: Identity) => { const change = changeFor(row.file);
        if (!change || row.sha256 === change.after_sha256) return capture(row);
        assert.equal(row.sha256, change.before_sha256); capture(change.snapshot);
        historicalBindings.set(path.resolve(row.file).toLowerCase(), { original: row, preservation: change.snapshot, current: { file: change.file, sha256: change.after_sha256 } }); };
    [...pins, identity(SELF), ...revisedCode, runtime.predecessor, runtime.preservation, ...runtimeChanges.flatMap(c => [c.snapshot, { file: c.file, sha256: c.after_sha256 }]), ledger.proposal,
        { file: previous.bank_file, sha256: previous.bank_sha256 }].forEach(capture);
    ledger.inputs.forEach(captureHistorical);
    const catalog = buildSourceCatalog(); assert.equal(catalog.fingerprint, previous.source_catalog_fingerprint);
    const review = read<{ entries: Parameters<typeof compileLearningCatalog>[1] }>(`${CANDIDATE}/classification-review.json`);
    const oldReview = read<typeof review>(`${BASE}/prepared-reviewed-v7/classification-review.json`);
    const classification = read<{ topics: Parameters<typeof compileLearningCatalog>[2]; classifications: ReturnType<typeof compileLearningCatalog>['classifications'] }>(`${CANDIDATE}/learning-question-classifications.json`);
    assert.deepEqual(review.entries, oldReview.entries); assert.deepEqual(compileLearningCatalog(bank, review.entries, classification.topics).classifications, classification.classifications);
    const history = qaHistory(oldBank, bank, previous, capture, captureHistorical);
    const jobs: Job[] = [], checks: Record<string, unknown>[] = [], errors: { set_id: string; error: string }[] = [];
    let questions = 0, criteria = 0, units = 0, qaCount = 0, largest = 0, newSetBody = '';
    for (const oldJob of previous.jobs) {
        try {
            const set = bank.find(s => s.id === oldJob.set_id)!; assert(set); const job = { ...oldJob };
            [{ file: oldJob.file, sha256: oldJob.sha256 }, { file: oldJob.plan_file, sha256: oldJob.plan_sha256 }, { file: oldJob.qa_file, sha256: oldJob.qa_sha256 }, ...oldJob.source_files].forEach(capture);
            if (set.id === TARGET) { job.plan_file = `${CANDIDATE}/pilot-03-001-plan.json`; job.plan_sha256 = identity(job.plan_file).sha256;
                newSetBody = serial(set); job.file = `${OUTPUT}/sets/${TARGET}.json`; job.sha256 = sha(newSetBody);
                verifyPlanTransition(loadPlan(oldJob.plan_file, TARGET), loadPlan(job.plan_file, TARGET), ledger.plan_changes); }
            else assert.deepEqual(set, read<QuestionSetV3>(oldJob.file));
            if (set.id === 'pilot-05-003') {
                job.plan_file = `${B_FOLLOWUP}/plan-pilot-05-003.json`; job.plan_sha256 = identity(job.plan_file).sha256;
                job.qa_file = `${B_FOLLOWUP}/qa-pilot-05-003.json`; job.qa_sha256 = identity(job.qa_file).sha256; job.author_qa_cases = 37;
                verifyBFollowup(loadPlan(oldJob.plan_file, set.id), loadPlan(job.plan_file, set.id), read<Qa>(oldJob.qa_file), read<Qa>(job.qa_file));
            }
            const plan = loadPlan(job.plan_file, set.id), prepared = prepareSemanticReview(set, { bank, authoringPlan: plan, maxInputChars: LIMIT });
            const context = prepared.requestContext as { source_excerpts: { id: string; line_start: number | null; source_quote_line_start: number | null; quote: string }[]; authoring_plan: unknown; existing_bank: { id: string }[] };
            assert.deepEqual(context.authoring_plan, plan); assert.deepEqual(context.existing_bank.map(p => p.id), bank.filter(p => p.id !== set.id).map(p => p.id).sort());
            assert.deepEqual(context.source_excerpts.map(s => s.id).sort(), set.source_refs.map(s => s.id).sort());
            for (const s of context.source_excerpts) { assert(s.line_start !== null && s.source_quote_line_start !== null); assert(s.quote.includes(set.source_refs.find(r => r.id === s.id)!.source_quote)); }
            const planFiles = plan.source_unit_ids.map(id => { const u = catalog.units.find(u => u.id === id); assert(u); return u.file; });
            const sourceFiles = [...new Set([...prepared.sourceFiles.map(f => f.file), ...planFiles])].map(identity).sort((a, b) => a.file.localeCompare(b.file, 'en'));
            assert.deepEqual(sourceFiles, [...oldJob.source_files].sort((a, b) => a.file.localeCompare(b.file, 'en')), 'Source file bytes/scope changed');
            const chunks = prepared.units.map(unit => { const input = buildReviewChunkInput(prepared, unit), x = JSON.parse(input); assert(input.length <= LIMIT);
                assert.deepEqual(x.authoring_plan, plan); assert.deepEqual(x.target_reference_requirements.required_source_ref_ids, unit.sources);
                assert.deepEqual(x.reference_catalog.sources.map((s: { id: string }) => s.id).sort(), [...unit.sources].sort()); assert.deepEqual(x.reference_catalog.fields, unit.fields);
                return { unit_id: unit.id, input_chars: input.length, input_sha256: sha(input) }; });
            assert.deepEqual([set.subquestions.length, set.subquestions.reduce((n, s) => n + s.criteria.length, 0), chunks.length], [job.questions, job.criteria, job.semantic_units]);
            const qa = read<Qa>(job.qa_file); assert.equal(qa.cases.length, job.author_qa_cases); assert.equal(qa.set_id, set.id);
            assert.equal(new Set(qa.cases.map(c => c.id)).size, qa.cases.length);
            for (const test of qa.cases) {
                const sub = set.subquestions.find(s => s.id === test.subquestion_id); assert(sub);
                assert.deepEqual(test.expected_verdicts.map(v => v.criterion_id).sort(), sub.criteria.map(c => c.id).sort());
                const points = test.expected_verdicts.reduce((n, v) => { const c = sub.criteria.find(c => c.id === v.criterion_id)!;
                    assert(['met', 'not_met', 'contradicted', 'partial'].includes(v.verdict)); if (v.verdict === 'partial') assert(c.scores.partial !== undefined);
                    return n + (v.verdict === 'met' ? c.scores.met : v.verdict === 'partial' ? c.scores.partial! : 0); }, 0);
                assert.equal(points, test.expected_points, `QA total: ${test.id}`);
            }
            if (set.id !== TARGET && set.id !== 'pilot-05-003') assert.deepEqual(job, oldJob);
            jobs.push(job); questions += job.questions; criteria += job.criteria; units += job.semantic_units; qaCount += job.author_qa_cases;
            const max = Math.max(...chunks.map(c => c.input_chars)); largest = Math.max(largest, max);
            checks.push({ set_id: set.id, units: chunks.length, max_chunk_chars: max, source_context_omissions: 0, bank_hash: prepared.bankHash, chunks });
        } catch (error) { errors.push({ set_id: oldJob.set_id, error: error instanceof Error ? error.message : String(error) }); }
        if ((checks.length + errors.length) % 10 === 0) console.log(`Local v9 preflight ${checks.length + errors.length}/119; errors ${errors.length}`);
    }
    [...snapshots.values()].forEach(verify); if (!errors.length) assert.deepEqual([jobs.length, questions, criteria, units, qaCount], [119, 280, 1113, 1393, 6040]);
    const preflight = { created_at: new Date().toISOString(), predecessor: identity(PREVIOUS), bank: identity(bankFile), runtime: identity(RUNTIME),
        selected_sets: 119, checked_sets: checks.length, questions, criteria, semantic_units: units, author_qa_cases: qaCount, largest_chunk_chars: largest,
        max_input_chars: LIMIT, source_context_omissions: 0, api_calls: 0, errors, checks, inputs: [...snapshots.values()],
        unchanged_jobs: 117, unchanged_question_files: 118, preserved_historical_qa_cases: history.cases, historical_file_bindings: [...historicalBindings.values()],
        new_semantic_epoch_required_for_all: true, new_grader_epoch_required_for_all: true };
    fs.mkdirSync(OUTPUT); const write = (name: string, value: unknown) => fs.writeFileSync(`${OUTPUT}/${name}`, serial(value), { flag: 'wx' });
    write('preflight.json', preflight); assert.equal(errors.length, 0, 'No manifest when local preflight fails');
    fs.mkdirSync(`${OUTPUT}/sets`); fs.writeFileSync(`${OUTPUT}/sets/${TARGET}.json`, newSetBody, { flag: 'wx' }); write('historical-qa92-preservation.json', history);
    const requirements = { created_at: new Date().toISOString(), api_calls: 0, runtime: identity(RUNTIME),
        previous_author_qa92_reused: false, author_qa_required: 6040, canary_author_qa_required: 94, semantic_sets_required: 119, semantic_units_required: 1393,
        semantic_receipts_reused: 0, reason: 'Comparison bank and semantic instructions changed; grader instructions changed. Original 92 actual author QA records and their outcomes remain historical evidence only.',
        generated_case_grading: 'Execute against new full-pass semantic receipts and current runtime; preserve original examples and mismatches.',
        jobs: jobs.map(j => ({ set_id: j.set_id, worker: j.worker, semantic_units: j.semantic_units, qa: { file: j.qa_file, sha256: j.qa_sha256 }, author_qa_cases: j.author_qa_cases,
            case_ids: read<Qa>(j.qa_file).cases.map(c => c.id), status: 'not_started_in_this_epoch' })) };
    write('execution-requirements.json', requirements);
    const manifest = { ...previous, created_at: new Date().toISOString(), purpose: 'v9_local_preflight_new_bank_runtime_not_model_validated', predecessor: identity(PREVIOUS), preparation_tool: identity(SELF), runtime: identity(RUNTIME),
        bank_file: bankFile, bank_sha256: identity(bankFile).sha256, code_files: unique([...revisedCode, ...pins, runtime.predecessor, runtime.preservation,
            ...runtimeChanges.flatMap(c => [c.snapshot, { file: c.file, sha256: c.after_sha256 }]), identity(ledger.proposal.file)]),
        jobs, preflight_file: `${OUTPUT}/preflight.json`, preflight_sha256: identity(`${OUTPUT}/preflight.json`).sha256,
        declared_changes: { question: ledger.question_changes, c_plan: ledger.plan_changes, b_plan_qa: identity(`${B_FOLLOWUP}/changes.json`),
            unchanged_jobs: 117, unchanged_question_files: 118, unchanged_qa_files: 118, original_qa_cases_preserved: 6038, new_qa_cases: 2,
            code_changes: runtime.changed_predecessor_files, policy_changes: runtime.policy_changes },
        source_followup: identity(`${CANDIDATE}/changes.json`), classification_contract: { review: identity(`${CANDIDATE}/classification-review.json`), catalog: identity(`${CANDIDATE}/learning-question-classifications.json`) },
        semantic_reuse: 'forbidden_by_changed_bank_and_instructions', author_qa_reuse: 'forbidden_by_changed_grader_instructions',
        historical_qa_preservation: identity(`${OUTPUT}/historical-qa92-preservation.json`), execution_requirements: identity(`${OUTPUT}/execution-requirements.json`) };
    [...snapshots.values()].forEach(verify); write('manifest.json', manifest);
    console.log(JSON.stringify({ manifest: identity(`${OUTPUT}/manifest.json`), sets: jobs.length, questions, criteria, units, qaCount, largest, historical_qa92_preserved: true, api_calls: 0 }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main();
