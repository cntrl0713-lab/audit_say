// 기준서형 수정·스포일러 전수 검토(2026-09-19)의 실제 채점 입력(execution-v<N>)을 만든다. 기존 출력이 있으면 쓰지 않는다.
//   npx tsx cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19/tools/build-execution.mts --version v1
// 입력: evidence-v1(correct_cpa_v3 evidence가 만든 부분 은행·카탈로그·검사 기록), plan-v1.json(물음별 agent 내용 대조),
// representatives-authored-v1.json(새로 쓴 부분정답·오답), representatives-reused-v1.json(기존 대표 답안 재사용 선택).
// 모범답안은 저장된 model_answer를 그대로 쓴다. 학습 단위(기준서형은 물음 하나, 혼합 세트의 사례형은 사례 단위)마다
// 모범·부분·오답을 한 요청씩 만든다. 부분정답이 없는 1점 물음은 부분 요청에서 빈 답안(맥락 전용)으로 둔다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { learningUnitId, selectLearningQuestionSet } from '../../../../../lib/learningUnits.ts';
import type { LearningClassification } from '../../../../../lib/learningUnits.ts';
import { computeSubquestionMaxPoints } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { CONTENT_CHECKS, EFFICIENT_RUNTIME_FILES } from '../../../../questionEfficientReview.ts';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';

const B = 'cpa_uploader/analysis/reviews/standard-spoiler-2026-09-19';
const E = `${B}/evidence-v1`;
const args = process.argv.slice(2);
assert(args.length === 2 && args[0] === '--version' && /^v\d+$/u.test(args[1]), 'Usage: --version vN');
const V = args[1], OUT = `${B}/execution-${V}`;
assert(!fs.existsSync(OUT), 'Use a new version for a retry; preserve previous evidence');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const ref = (file: string) => ({ file, sha256: hash(fs.readFileSync(file)) });
const write = (file: string, value: unknown) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const sorted = (values: string[]) => [...values].sort();
type Verdict = 'met' | 'not_met' | 'contradicted' | 'partial';

const bankFile = `${E}/correction-bank.json`, catalogFile = `${E}/correction-catalog.json`;
const bank = read<QuestionSetV3[]>(bankFile);
const catalog = read<{ source_file: string; source_file_sha256: string; classifications: LearningClassification[] }>(catalogFile);
assert.equal(catalog.source_file_sha256, ref(bankFile).sha256, 'Catalog must describe the exact partial bank');
const plan = read<{ entries: { set: string; sub: string; tier: string; issue?: string; review: string }[] }>(`${B}/plan-v1.json`).entries;
const authored = read<{ cases: { set_id: string; subquestion_id: string; kind: 'partial' | 'wrong'; answer: string; verdicts: Record<string, Verdict>; reason: string }[] }>(`${B}/representatives-authored-v1.json`).cases;
const reused = read<{ selections: { set_id: string; subquestion_id: string; kind: 'partial' | 'wrong'; source: { file: string; sha256: string }; source_index: number; source_case_id: string | null }[] }>(`${B}/representatives-reused-v1.json`).selections;
const corrections = read<{ files: string[] }>(`${B}/corrections-v1.json`).files;
const policyInput = read<{ budget_usd: null; budget_enforcement: 'not_specified' }>(`${B}/policy-input.json`);
assert.equal(policyInput.budget_enforcement, 'not_specified'); assert.equal(policyInput.budget_usd, null);

// ---------------------------------------------------------------- representatives
const reasonText: Record<Verdict, string> = {
    met: '실행 전 대조: 답안이 이 명제를 직접 제시한다.',
    partial: '실행 전 대조: 답안이 이 명제의 일부만 제시한다.',
    not_met: '실행 전 대조: 답안에 이 명제나 이를 함축하는 설명이 없다.',
    contradicted: '실행 전 대조: 답안이 이 명제와 반대되는 내용을 명시한다.',
};
interface Case { id: string; set_id: string; subquestion_id: string; kind: 'partial' | 'wrong'; answer: string; expected_points: number;
    expected_verdicts: { criterion_id: string; verdict: Verdict; reason: string }[]; expectation_review: string; human_review_performed: false; origin: Record<string, unknown> }
const cases: Case[] = [];
const subOf = (setId: string, subId: string) => {
    const set = bank.find((s) => s.id === setId); assert(set, `bank에 없는 세트 ${setId}`);
    const sub = set.subquestions.find((q) => q.id === subId); assert(sub, `bank에 없는 물음 ${setId}/${subId}`);
    return sub;
};
const finish = (setId: string, subId: string, kind: 'partial' | 'wrong', answer: string, verdicts: Case['expected_verdicts'], origin: Record<string, unknown>) => {
    const sub = subOf(setId, subId);
    assert.deepEqual(sorted(verdicts.map((v) => v.criterion_id)), sorted(sub.criteria.map((c) => c.id)), `${setId}/${subId}/${kind}: 기대 판정이 criterion과 다름`);
    const ordered = sub.criteria.map((c) => verdicts.find((v) => v.criterion_id === c.id)!);
    const points = sub.criteria.reduce((n, c) => { const s = c.scores[ordered.find((v) => v.criterion_id === c.id)!.verdict]; assert(Number.isSafeInteger(s)); return n + s!; }, 0);
    const max = computeSubquestionMaxPoints(sub);
    if (kind === 'partial') assert(points > 0 && points < max, `${setId}/${subId}: 부분정답 점수 ${points}/${max}`);
    else assert.equal(points, 0, `${setId}/${subId}: 오답 점수 ${points}`);
    assert(answer.trim() && answer.length <= 5000);
    cases.push({ id: `${setId}--${subId}--${kind}`, set_id: setId, subquestion_id: subId, kind, answer, expected_points: points, expected_verdicts: ordered,
        expectation_review: 'agent_content_review_before_execution', human_review_performed: false, origin });
};
for (const a of authored) {
    finish(a.set_id, a.subquestion_id, a.kind, a.answer,
        Object.entries(a.verdicts).map(([criterion_id, verdict]) => ({ criterion_id, verdict, reason: `${reasonText[verdict]} (${a.reason})` })),
        { file: `${B}/representatives-authored-v1.json`, authored_in_this_batch: true, reason: a.reason });
}
for (const r of reused) {
    assert.equal(ref(r.source.file).sha256, r.source.sha256, `재사용 원본이 바뀜: ${r.source.file}`);
    const source = read<unknown>(r.source.file) as Record<string, unknown> | unknown[];
    const rows = (Array.isArray(source) ? source : (source.cases ?? source.representatives ?? source.entries)) as Record<string, unknown>[];
    const row = rows[r.source_index];
    assert(row && row.set_id === r.set_id && row.subquestion_id === r.subquestion_id && (row.kind ?? row.role) === r.kind, `재사용 원본 행 불일치 ${r.set_id}/${r.subquestion_id}`);
    const sub = subOf(r.set_id, r.subquestion_id);
    let verdicts: Case['expected_verdicts'];
    if (Array.isArray(row.expected_verdicts)) {
        verdicts = (row.expected_verdicts as Case['expected_verdicts']).map((v) => ({ criterion_id: v.criterion_id, verdict: v.verdict, reason: v.reason }));
    } else {
        const met = row.met_criterion_ids as string[]; assert(Array.isArray(met));
        verdicts = sub.criteria.map((c) => met.includes(c.id)
            ? { criterion_id: c.id, verdict: 'met' as const, reason: `원 대표답안의 충족 판정(${r.source.file}): 답안이 이 명제를 제시한다.` }
            : { criterion_id: c.id, verdict: 'not_met' as const, reason: `원 대표답안의 판정(${r.source.file}): 답안에 이 명제가 없다.` });
    }
    finish(r.set_id, r.subquestion_id, r.kind, row.answer as string, verdicts,
        { file: r.source.file, sha256: r.source.sha256, index: r.source_index, case_id: r.source_case_id, reason: String(row.reason ?? '원 배치의 대표 답안') });
}

// ---------------------------------------------------------------- scope, reviews, runtime
fs.mkdirSync(OUT); fs.mkdirSync(`${OUT}/projections`); fs.mkdirSync(`${OUT}/runtime`);
write(`${OUT}/representatives.json`, { version: 1, purpose: '기준서형 수정·스포일러 전수 검토의 대표 부분정답·오답(실행 전 확정)', cases });
write(`${OUT}/scope.json`, { targets: bank.map((s) => ({ set_id: s.id, subquestion_ids: s.subquestions.map((q) => q.id) })) });
write(`${OUT}/policy.json`, { scope: ref(`${OUT}/scope.json`), model: 'gpt-5.6-luna', grading_point_tolerance: 1,
    minimum_within_tolerance_ratio: 0.95, content_error_tolerance: 0, statistical_confidence_claim: false,
    budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
    provider_limit_errors_stop_all_workers: true, monetary_limit_not_inferred_from_prior_batches: true,
    reuse_decision: `수정한 ${bank.length}세트의 모든 물음을 학습 단위로 실측한다. 발문·criterion이 바뀌어 이전 실측(다른 은행)은 재사용할 수 없다. 기존 대표 답안 문장은 criterion이 같은 경우에만 재사용하고 나머지는 새로 썼다. 부분 은행에는 수정한 세트만 담는다.` });
const reviewer = 'agent:claude-opus-5 (author agent; no independent peer review)';
const reviewedAt = new Date().toISOString();
const commonEvidence = [`${B}/authorization.md`, `${B}/policy-input.json`, `${B}/plan-v1.json`, `${E}/correction-check.json`,
    `${B}/representatives-authored-v1.json`, `${B}/representatives-reused-v1.json`, `${B}/tools/build-corrections.mts`];
const reviews = bank.map((set) => {
    const correction = corrections.find((file) => file.includes(`-${set.id}--`)); assert(correction, `correction 없음 ${set.id}`);
    return { set_id: set.id, content_hash: reviewedContentHash(set), reviewer_id: reviewer, reviewed_at: reviewedAt,
        method: 'agent_content_review', human_review_performed: false, evidence: [...commonEvidence, correction].map(ref),
        questions: set.subquestions.map((sub) => {
            const entry = plan.find((e) => e.set === set.id && e.sub === sub.id); assert(entry, `plan 항목 없음 ${set.id}/${sub.id}`);
            return { subquestion_id: sub.id, criterion_ids: sub.criteria.map((c) => c.id),
                source_ref_ids: [...new Set([...sub.requirements.map((r) => r.source_ref_id), ...sub.criteria.flatMap((c) => c.source_ref_ids)])],
                checks: Object.fromEntries(CONTENT_CHECKS.map((check) => [check, 'pass'])),
                rationale: entry.issue ? `발견: ${entry.issue} 확인: ${entry.review}` : `확인: ${entry.review}` };
        }), unresolved_content_findings: [] };
});
write(`${OUT}/agent-reviews.json`, reviews);
const codeFiles = [...new Set([...EFFICIENT_RUNTIME_FILES, ...['run-efficient-grading.ts', 'contract.ts', 'accounting.ts'].map((file) => `${B}/tools/${file}`)])];
const snapshots = codeFiles.map((file, index) => {
    const copied = `${OUT}/runtime/${String(index).padStart(2, '0')}-${path.basename(file)}`;
    fs.copyFileSync(file, copied, fs.constants.COPYFILE_EXCL); return { ...ref(copied), runtime_file: file };
});
write(`${OUT}/runtime-snapshots.json`, snapshots);

// ---------------------------------------------------------------- entries
interface Entry { id: string; worker: 'a' | 'b' | 'c'; learning_unit_id: string; source_set_id: string; projected_file: string; projected_sha256: string;
    kind: 'model' | 'partial' | 'wrong'; evaluated_subquestion_ids: string[]; answers: Record<string, string>;
    expected_by_subquestion: { subquestion_id: string; expected_points: number; expected_verdicts: Case['expected_verdicts'] }[];
    selection_evidence: { file: string; sha256: string; subquestion_id: string; case_id: string | null; kind: Entry['kind']; reason: string }[] }
const entries: Omit<Entry, 'worker'>[] = [];
for (const set of bank) {
    const metadata = catalog.classifications.filter((c) => c.source_set_id === set.id);
    assert.equal(metadata.length, set.subquestions.length, `분류 항목 수 ${set.id}`);
    const units = [...new Set(metadata.map((c) => learningUnitId(set.id, c.question_style, c.subquestion_id)))];
    for (const unit of units) {
        const unitMetadata = metadata.filter((c) => learningUnitId(set.id, c.question_style, c.subquestion_id) === unit);
        const projection = selectLearningQuestionSet(set, unitMetadata, unit);
        const projectedFile = `${OUT}/projections/${unit}.json`;
        write(projectedFile, projection);
        for (const kind of ['model', 'partial', 'wrong'] as const) {
            const evaluated = projection.subquestions.filter((sub) => kind !== 'partial' || computeSubquestionMaxPoints(sub) > 1).map((sub) => sub.id);
            if (!evaluated.length) continue;
            const answers: Record<string, string> = {}, expected: Entry['expected_by_subquestion'] = [], selection: Entry['selection_evidence'] = [];
            for (const sub of projection.subquestions) {
                if (!evaluated.includes(sub.id)) {
                    answers[sub.id] = '';
                    expected.push({ subquestion_id: sub.id, expected_points: 0, expected_verdicts: sub.criteria.map((c) => ({ criterion_id: c.id, verdict: 'not_met' as const, reason: '이 요청에서는 평가하지 않는 맥락 전용 빈 답안이다.' })) });
                    continue;
                }
                if (kind === 'model') {
                    answers[sub.id] = sub.model_answer.join('\n');
                    const verdicts = sub.criteria.map((c) => ({ criterion_id: c.id, verdict: 'met' as const, reason: '직접 출처·발문·독립 득점 조건을 대조한 저장 모범답안.' }));
                    expected.push({ subquestion_id: sub.id, expected_points: computeSubquestionMaxPoints(sub), expected_verdicts: verdicts });
                    selection.push({ ...ref(bankFile), subquestion_id: sub.id, case_id: null, kind, reason: '저장된 모범답안을 그대로 쓴 모범 대표.' });
                } else {
                    const row = cases.find((c) => c.set_id === set.id && c.subquestion_id === sub.id && c.kind === kind);
                    assert(row, `대표 답안 없음 ${set.id}/${sub.id}/${kind}`);
                    answers[sub.id] = row.answer;
                    expected.push({ subquestion_id: sub.id, expected_points: row.expected_points, expected_verdicts: row.expected_verdicts });
                    selection.push({ ...ref(`${OUT}/representatives.json`), subquestion_id: sub.id, case_id: row.id, kind,
                        reason: '원문과 현재 criterion에서 실행 전에 확정한 대표 답안. 같은 학습 단위의 같은 역할은 한 요청에 통합한다.' });
                }
            }
            entries.push({ id: `${unit}--${kind}`, learning_unit_id: unit, source_set_id: set.id, projected_file: projectedFile,
                projected_sha256: ref(projectedFile).sha256, kind, evaluated_subquestion_ids: evaluated, answers,
                expected_by_subquestion: expected, selection_evidence: selection });
        }
    }
}
const workers = ['a', 'b', 'c'] as const;
const withWorkers: Entry[] = entries.map((entry, index) => ({ ...entry, worker: workers[index % 3] }));
// 대표 역할 누락 확인(검증기와 같은 규칙).
for (const set of bank) for (const sub of set.subquestions) for (const kind of computeSubquestionMaxPoints(sub) > 1 ? ['model', 'partial', 'wrong'] : ['model', 'wrong']) {
    assert(withWorkers.some((e) => e.source_set_id === set.id && e.kind === kind && e.evaluated_subquestion_ids.includes(sub.id)), `대표 누락 ${set.id}/${sub.id}/${kind}`);
}
const evidenceFiles = [...new Set(reviews.flatMap((r) => r.evidence.map((e) => e.file)))];
const reusedSources = [...new Set(reused.map((r) => r.source.file))];
const inputFiles = [...new Set([...bank.flatMap((s) => s.source_refs.map((r) => r.file)), ...evidenceFiles, ...reusedSources,
    `${B}/tools/build-execution.mts`, `${E}/correction-classification-review.json`, bankFile, catalogFile,
    `${OUT}/scope.json`, `${OUT}/representatives.json`, `${OUT}/agent-reviews.json`, `${OUT}/runtime-snapshots.json`, ...snapshots.map((s) => s.file)])];
write(`${OUT}/grading-manifest.json`, { version: 1, artifact_type: 'efficient_grading_manifest', model: 'gpt-5.6-luna',
    budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
    bank: ref(bankFile), classifications: ref(catalogFile), policy: ref(`${OUT}/policy.json`),
    inputs: inputFiles.map(ref), code_files: codeFiles.map(ref), entries: withWorkers });
const count = (kind: string) => withWorkers.filter((e) => e.kind === kind).length;
console.log(JSON.stringify({ sets: bank.length, questions: bank.reduce((n, s) => n + s.subquestions.length, 0), cases: cases.length,
    requests: withWorkers.length, by_kind: { model: count('model'), partial: count('partial'), wrong: count('wrong') },
    by_worker: Object.fromEntries(workers.map((w) => [w, withWorkers.filter((e) => e.worker === w).length])),
    evaluated_answers: withWorkers.reduce((n, e) => n + e.evaluated_subquestion_ids.length, 0),
    manifest: ref(`${OUT}/grading-manifest.json`), actual_sdk_calls: 0 }, null, 2));
