import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../../../lib/questionV3.ts';
import { computeQuestionSetMaxPoints, computeSubquestionMaxPoints, compilePublicQuestionSet } from '../../../../../lib/questionV3.ts';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import { learningUnitId, selectLearningQuestionSet } from '../../../../../lib/learningUnits.ts';
import type { LearningTopic, QuestionStyle } from '../../../../../lib/learningUnits.ts';
import { compileLearningCatalog } from '../../../../../scripts/build-learning-unit-catalog.ts';
import { reviewedContentHash, sha256 } from '../../../../questionReviewIdentity.ts';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';
import { CONTENT_CHECKS, EFFICIENT_RUNTIME_FILES } from '../../../../questionEfficientReview.ts';
import type { AgentSetReview, ReviewFile } from '../../../../questionEfficientReview.ts';
import type { EfficientEntry, EfficientManifest, ExpectedSubquestion } from './b/contract.ts';

const ROOT = process.cwd(), HERE = path.dirname(fileURLToPath(import.meta.url));
const D = path.dirname(HERE), BASE = path.join(D, 'c/prepared-reviewed-v8');
const rel = (file: string) => path.relative(ROOT, path.resolve(file)).replace(/\\/g, '/');
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const readSet = (file: string): QuestionSetV3 => {
    const value = read<QuestionSetV3 | QuestionSetV3[]>(file);
    if (Array.isArray(value)) { assert.equal(value.length, 1, 'Selected draft must contain exactly one set'); return value[0]; }
    return value;
};
const identity = (file: string): ReviewFile => ({ file: rel(file), sha256: sha256(fs.readFileSync(file)) });
const same = (a: unknown, b: unknown, reason: string) => assert.equal(contentHash(a), contentHash(b), reason);
interface Selected { set_id: string; file: string; sha256: string; plan_file: string; plan_sha256: string; qa_file: string; qa_sha256: string }
interface ReviewRow {
    set_id: string; subquestion_id: string; status: string; reviewer_agent?: string; reviewed_at: string;
    file: string; file_sha256: string; review_reason: string;
    checks: Record<typeof CONTENT_CHECKS[number], string>;
    source_evidence: { source_ref_id: string; file: string; file_sha256: string; quote_sha256: string; exact_in_source: boolean }[];
    question_style: QuestionStyle; topic_ids: string[]; standalone_prompt: string | null; case_fact_ids: string[];
    point_review: { decision: string; before_points: number; after_points: number; reason: string; split_decision: string; [key: string]: unknown };
}
interface Representative {
    set_id: string; subquestion_id: string; role: string; reason: string; qa_file: string; case_id: string;
    case: { id: string; subquestion_id: string; answer: string; expected_points: number;
        expected_verdicts: { criterion_id: string; verdict: CriterionVerdictV3['verdict']; reason?: string }[] };
}
interface ClassificationEntry { set_id: string; subquestion_id: string; question_style: QuestionStyle;
    topic_ids: string[]; standalone_prompt: string | null; case_fact_ids: string[]; reason: string }

function main() {
    const output = path.join(HERE, 'candidate-v1'); assert(!fs.existsSync(output), 'Use a new output; no overwrite');
    const inputs = new Map<string, ReviewFile>();
    const freeze = (file: string, expected?: string) => {
        const id = identity(file); if (expected) assert.equal(id.sha256, expected, `Changed input: ${file}`);
        const old = inputs.get(id.file); assert(!old || old.sha256 === id.sha256); inputs.set(id.file, id); return id;
    };
    const readFrozen = <T>(file: string, expected?: string): T => {
        const bytes = fs.readFileSync(file), id = { file: rel(file), sha256: sha256(bytes) };
        if (expected) assert.equal(id.sha256, expected, `Changed baseline input: ${file}`);
        const old = inputs.get(id.file); assert(!old || old.sha256 === id.sha256); inputs.set(id.file, id);
        return JSON.parse(bytes.toString('utf8')) as T;
    };
    const baseline = readFrozen<QuestionSetV3[]>(path.join(BASE, 'candidate-authoring.json'), '11618f57625ae6ec71630f6413411ad513291674573e4eb0f028d129c0eab90b');
    const master = readFrozen<{ jobs: Selected[] }>(path.join(D, 'a/execution-all-v9/manifest.json'), '0f53ec0878acff9a0c1045679df374ab2eea8021d2d8224e6a6bd0fd1077ef37');
    const selections: Selected[] = [], reviews: ReviewRow[] = [], reps: Representative[] = [];
    const additionalEvidence = read<{ by_set: Record<string, ReviewFile[]> }>(path.join(HERE, 'additional-evidence.json'));
    freeze(path.join(HERE, 'additional-evidence.json'));
    const owner = new Map<string, string>();
    for (const worker of ['a', 'c']) {
        const folder = path.join(HERE, worker);
        for (const name of ['selected-files.json', 'question-reviews.json', 'representative-cases.json', 'local-checks.json', 'handoff.json']) freeze(path.join(folder, name));
        const selected = read<{ entries: Selected[] }>(path.join(folder, 'selected-files.json'));
        const reviewed = read<{ entries: ReviewRow[] }>(path.join(folder, 'question-reviews.json'));
        const representative = read<{ entries: Representative[] }>(path.join(folder, 'representative-cases.json'));
        for (const s of selected.entries) {
            assert(!owner.has(s.set_id), 'Overlapping ownership'); owner.set(s.set_id, worker);
            freeze(s.file, s.sha256); freeze(s.plan_file, s.plan_sha256); freeze(s.qa_file, s.qa_sha256);
        }
        selections.push(...selected.entries); reviews.push(...reviewed.entries); reps.push(...representative.entries);
    }
    const derivativeIds = ['pilot-10-007-standards'];
    same([...owner.keys()].sort(), [...master.jobs.map(j => j.set_id), ...derivativeIds].sort(), 'Original scope and declared requirement split changed');
    const final = baseline.map(set => {
        const selected = selections.find(s => s.set_id === set.id); if (!selected) return set;
        const next = readSet(selected.file); assert.equal(next.id, set.id); return next;
    });
    for (const id of derivativeIds) {
        assert(!baseline.some(s => s.id === id));
        const next = readSet(selections.find(s => s.set_id === id)!.file);
        assert.equal(next.id, id); assert.equal(next.subquestions.length, 1);
        assert.equal(next.subquestions[0].question_style, 'standard'); assert.deepEqual(next.shared_context.facts, []);
        final.push(next);
    }
    const validation = validateAuthoringBank(final); assert.deepEqual(validation.errors, []);
    const classification = readFrozen<{ entries: ClassificationEntry[] }>(path.join(BASE, 'classification-review.json'));
    const oldCatalog = readFrozen<{ topics: LearningTopic[] }>(path.join(BASE, 'learning-question-classifications.json'));
    const agentReviews: AgentSetReview[] = [];
    for (const selected of selections) {
        const set = final.find(s => s.id === selected.set_id)!;
        const rows = reviews.filter(q => q.set_id === set.id);
        same(rows.map(q => q.subquestion_id).sort(), set.subquestions.map(q => q.id).sort(), 'Content review scope');
        const questions = rows.map(row => {
            assert.equal(row.status, 'pass'); assert.equal(row.file_sha256, selected.sha256);
            for (const check of CONTENT_CHECKS) assert.equal(row.checks[check], 'pass', `${set.id}/${row.subquestion_id}/${check}`);
            const sub = set.subquestions.find(q => q.id === row.subquestion_id)!;
            assert.equal(row.point_review.after_points, computeSubquestionMaxPoints(sub));
            assert(row.point_review.reason.trim() && row.point_review.split_decision.trim());
            const required = [...new Set([...sub.requirements.map(r => r.source_ref_id), ...sub.criteria.flatMap(c => c.source_ref_ids)])];
            for (const id of required) {
                const source = set.source_refs.find(r => r.id === id)!;
                const evidence = row.source_evidence.find(e => e.source_ref_id === id); assert(evidence, `${set.id}/${sub.id}: Missing source ${id}`);
                freeze(evidence.file, evidence.file_sha256); assert(evidence.exact_in_source);
                assert.equal(evidence.quote_sha256, sha256(source.source_quote));
                assert(fs.readFileSync(source.file, 'utf8').includes(source.source_quote), 'Direct source quote differs');
            }
            const prior = classification.entries.find(q => q.set_id === set.id && q.subquestion_id === sub.id);
            const entry = { set_id: set.id, subquestion_id: sub.id, question_style: row.question_style,
                topic_ids: row.topic_ids, standalone_prompt: row.question_style === 'standard' ? row.standalone_prompt ?? sub.prompt : null,
                case_fact_ids: row.case_fact_ids, reason: row.review_reason };
            if (prior) Object.assign(prior, entry); else classification.entries.push(entry);
            return { subquestion_id: sub.id, criterion_ids: sub.criteria.map(c => c.id), source_ref_ids: required,
                checks: row.checks as Record<typeof CONTENT_CHECKS[number], 'pass'>, rationale: row.review_reason };
        });
        const worker = owner.get(set.id)!;
        agentReviews.push({ set_id: set.id, content_hash: reviewedContentHash(set), reviewer_id: rows[0].reviewer_agent ?? `plan_${worker}`,
            reviewed_at: rows[0].reviewed_at, method: 'agent_content_review', human_review_performed: false,
            evidence: [freeze(path.join(HERE, worker, 'question-reviews.json')), freeze(selected.file), freeze(selected.plan_file), freeze(selected.qa_file),
                ...(additionalEvidence.by_set[set.id] ?? []).map(e => freeze(e.file, e.sha256))],
            questions, unresolved_content_findings: [] });
        for (const source of set.source_refs) freeze(source.file);
    }
    const { classifications, units } = compileLearningCatalog(final, classification.entries, oldCatalog.topics);
    assert.equal(classifications.length, final.reduce((n, s) => n + s.subquestions.length, 0));
    // Reject any selection/expected-score mismatch before creating even a partial candidate.
    for (const representative of reps) {
        const set = final.find(s => s.id === representative.set_id)!;
        const sub = set.subquestions.find(q => q.id === representative.subquestion_id)!;
        const qa = read<{ cases: Representative['case'][] }>(representative.qa_file).cases.find(c => c.id === representative.case_id);
        assert(qa, 'Selected original QA missing');
        assert.equal(qa.subquestion_id, sub.id);
        for (const field of ['answer', 'expected_points', 'expected_verdicts'] as const)
            same(qa[field], representative.case[field], `${set.id}/${sub.id}: selected QA differs`);
        same(qa.expected_verdicts.map(v => v.criterion_id).sort(), sub.criteria.map(c => c.id).sort(), 'Expected criterion coverage');
        const score = qa.expected_verdicts.reduce((n, v) => n + sub.criteria.find(c => c.id === v.criterion_id)!.scores[v.verdict]!, 0);
        assert.equal(score, qa.expected_points);
        if (representative.role === 'stored_model_answer') {
            assert.equal(qa.answer, sub.model_answer.join('\n'), `${set.id}/${sub.id}: stored model answer bytes differ`);
            assert(qa.expected_verdicts.every(v => v.verdict === 'met'));
        } else if (representative.role === 'partial_answer') assert(score > 0 && score < computeSubquestionMaxPoints(sub));
        else { assert.equal(representative.role, 'wrong_or_boundary_answer'); assert.equal(score, 0); }
    }
    // All reads and semantic checks finish before creating new output files.
    fs.mkdirSync(output);
    const write = (name: string, value: unknown) => {
        const file = path.join(output, name); fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return freeze(file);
    };
    const bankFile = write('candidate-authoring.json', final);
    const classReview = write('classification-review.json', { schema_version: 1, source_file: bankFile.file, source_file_sha256: bankFile.sha256,
        predecessor_file: rel(path.join(BASE, 'classification-review.json')), entries: classification.entries });
    const catalogFile = write('learning-question-classifications.json', { schema_version: 1, source_file: bankFile.file, source_file_sha256: bankFile.sha256,
        public_content_hash: contentHash(final.map(compilePublicQuestionSet)), review_file: classReview.file, review_file_sha256: classReview.sha256,
        topics: oldCatalog.topics, classifications });
    write('agent-reviews.json', agentReviews);
    write('point-reviews.json', reviews.map(r => ({ set_id: r.set_id, subquestion_id: r.subquestion_id, question_style: r.question_style,
        topic_ids: r.topic_ids, ...r.point_review })));
    const entries: EfficientEntry[] = [];
    const roleKind = { stored_model_answer: 'model', partial_answer: 'partial', wrong_or_boundary_answer: 'wrong' } as const;
    const normalized = new Map<string, { identity: ReviewFile; expected: ExpectedSubquestion; answer: string; kind: 'model' | 'partial' | 'wrong'; reason: string; caseId: string | null }>();
    for (const representative of reps) {
        const set = final.find(s => s.id === representative.set_id)!;
        const sub = set.subquestions.find(q => q.id === representative.subquestion_id)!;
        const kind = roleKind[representative.role as keyof typeof roleKind]; assert(kind, 'Unknown representative role');
        const row = reviews.find(r => r.set_id === set.id && r.subquestion_id === sub.id)!;
        const original = freeze(representative.qa_file);
        const selectedCase = read<{ cases: Representative['case'][] }>(representative.qa_file).cases.find(c => c.id === representative.case_id);
        assert(selectedCase, 'Original selected QA missing');
        for (const field of ['answer', 'expected_points', 'expected_verdicts'] as const) same(selectedCase[field], representative.case[field], 'Agent selection changed');
        const expected: ExpectedSubquestion = { subquestion_id: sub.id, expected_points: representative.case.expected_points,
            expected_verdicts: representative.case.expected_verdicts.map(v => ({ ...v,
                reason: v.reason?.trim() || `담당 agent의 원문 대조 결론(${kind} 답안): ${row.review_reason} 해당 기준 ${v.criterion_id}의 원 판정 ${v.verdict}를 보존한다.` })) };
        let selectedIdentity: ReviewFile;
        if (kind === 'model') {
            assert.equal(representative.case.answer, sub.model_answer.join('\n'));
            assert(expected.expected_verdicts.every(v => v.verdict === 'met'));
            selectedIdentity = freeze(selections.find(s => s.set_id === set.id)!.file);
        } else selectedIdentity = write(`selected-qa/${set.id}-${sub.id}-${kind}.json`, { version: 1, set_id: set.id,
            origin: { ...original, case_id: representative.case_id }, normalization: 'Only absent verdict reasons are supplied from the actual agent review; answer, verdict and expected score are unchanged.',
            cases: [{ ...representative.case, expected_verdicts: expected.expected_verdicts }] });
        const key = `${set.id}/${sub.id}/${kind}`; assert(!normalized.has(key));
        normalized.set(key, { identity: selectedIdentity, expected, answer: representative.case.answer, kind,
            reason: representative.reason, caseId: kind === 'model' ? null : representative.case_id });
    }
    for (const unit of units.filter(u => owner.has(u.source_set_id!))) {
        const source = final.find(s => s.id === unit.source_set_id)!;
        const meta = classifications.filter(c => c.source_set_id === source.id && learningUnitId(source.id, c.question_style, c.subquestion_id) === unit.id);
        const projected = selectLearningQuestionSet(source, meta, unit.id);
        const projectedFile = write(`projected/${unit.id}.json`, projected);
        for (const kind of ['model', 'partial', 'wrong'] as const) {
            const selected = projected.subquestions.map(sub => normalized.get(`${source.id}/${sub.id}/${kind}`));
            if (!selected.some(Boolean)) continue;
            const evaluated = projected.subquestions.filter((_, i) => selected[i]).map(s => s.id);
            const expected = projected.subquestions.map((sub, i): ExpectedSubquestion => selected[i]?.expected ?? {
                subquestion_id: sub.id, expected_points: 0,
                expected_verdicts: sub.criteria.map(c => ({ criterion_id: c.id, verdict: 'not_met', reason: '이 회차의 평가 대상이 아닌 사례형 물음은 빈 답안으로 유지한다.' })) });
            const entry: EfficientEntry = { id: `${unit.id}--${kind}`, worker: (['a', 'b', 'c'] as const)[entries.length % 3],
                learning_unit_id: unit.id, source_set_id: source.id, kind,
                projected_file: projectedFile.file, projected_sha256: projectedFile.sha256, evaluated_subquestion_ids: evaluated,
                answers: Object.fromEntries(projected.subquestions.map((sub, i) => [sub.id, selected[i]?.answer ?? ''])), expected_by_subquestion: expected,
                selection_evidence: projected.subquestions.flatMap((sub, i) => selected[i] ? [{ ...selected[i]!.identity,
                    subquestion_id: sub.id, case_id: selected[i]!.caseId, kind, reason: selected[i]!.reason }] : []) };
            entries.push(entry);
        }
    }
    const targetScope = write('target-scope.json', { version: 1, origin_manifest: identity(path.join(D, 'a/execution-all-v9/manifest.json')),
        scope_change_reason: 'pilot-10-007의 일반 기준서 요구를 별도 기준서형 pilot-10-007-standards/sub4로 분리한다. 기존119개와 분리1개를 전수 검토하며 새 학습목표를 추가하지 않는다.',
        targets: selections.map(s => ({ set_id: s.set_id, subquestion_ids: final.find(b => b.id === s.set_id)!.subquestions.map(q => q.id) })) });
    const policy: Record<string, unknown> = { ...read<Record<string, unknown>>(path.join(HERE, 'policy.json')), scope: targetScope };
    const policyFile = write('policy.json', policy);
    const codePaths = [...new Set([...EFFICIENT_RUNTIME_FILES, 'cpa_uploader/questionBankPublication.ts', 'cpa_uploader/promote_cpa_v3.ts',
        rel(path.join(HERE, 'b/run-efficient-grading.ts')), rel(path.join(HERE, 'b/contract.ts')), rel(path.join(HERE, 'b/accounting.ts')), rel(fileURLToPath(import.meta.url))])];
    const code = codePaths.map(identity);
    const runtimeSnapshots = code.map(c => {
        const file = path.join(output, 'runtime', c.file + '.txt'); fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.copyFileSync(path.resolve(ROOT, c.file), file, fs.constants.COPYFILE_EXCL);
        return { ...identity(file), runtime_file: c.file };
    });
    write('runtime-snapshots.json', runtimeSnapshots);
    const manifest: EfficientManifest = { version: 1, artifact_type: 'efficient_grading_manifest', model: 'gpt-5.6-luna', budget_usd: 20,
        budget_enforcement: 'provider_limit', bank: bankFile, classifications: catalogFile, policy: policyFile,
        inputs: [...inputs.values()], code_files: code, entries };
    // The manifest does not list itself; output observations never mutate these inputs.
    const manifestFile = write('grading-manifest.json', manifest);
    const changes = final.flatMap((s, i) => baseline[i] && reviewedContentHash(s) === reviewedContentHash(baseline[i]) ? [] : [{ set_id: s.id,
        before_points: baseline[i] ? computeQuestionSetMaxPoints(baseline[i]) : null, after_points: computeQuestionSetMaxPoints(s),
        before_questions: baseline[i]?.subquestions.length ?? 0, after_questions: s.subquestions.length,
        before_content_hash: baseline[i] ? reviewedContentHash(baseline[i]) : null, after_content_hash: reviewedContentHash(s) }]);
    write('summary.json', { execution_version: policy.execution_version, status: 'prepared_not_model_verified', manifest: manifestFile,
        selected_sets: selections.length, selected_questions: reviews.length, selected_points: selections.reduce((n, s) => n + computeQuestionSetMaxPoints(final.find(b => b.id === s.set_id)!), 0),
        bank_sets: final.length, bank_questions: classifications.length, bank_points: final.reduce((n, s) => n + computeQuestionSetMaxPoints(s), 0),
        grading_requests: entries.length, evaluated_answers: entries.reduce((n, e) => n + e.evaluated_subquestion_ids.length, 0),
        changes, api_calls: 0, production_db_writes: 0 });
    for (const input of inputs.values()) assert.equal(identity(input.file).sha256, input.sha256, 'Input changed during preparation');
    console.log(JSON.stringify({ output: rel(output), manifest: manifestFile, requests: entries.length, content_reviews: reviews.length }));
}
main();
