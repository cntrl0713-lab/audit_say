/** Supplemental legacy-answer regression. This does not replace the 49 author QA cases. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
    gradeQuestionSetV3, gradingModelName, buildGradingPrompt, buildGradingResponseSchema,
} from '../../../../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3, GradingTraceV3 } from '../../../../../../lib/questionV3Grading.ts';
import type { QuestionSetV3, CriterionVerdictNameV3 } from '../../../../../../lib/questionV3.ts';

interface HistoricalCase {
    id: string; subquestion_id: string; answer: string; expected_points: number;
    expected_verdicts: Array<{ criterion_id: string; verdict: CriterionVerdictNameV3 }>;
}
interface ExploratoryCase {
    id: string; subquestion_id: string; kind: string; answer: string; expected_points: number;
    required_target: { criterion_id: string; verdict: CriterionVerdictNameV3 };
    non_target_acceptable_verdicts: Record<string, CriterionVerdictNameV3[]>;
    historical_author_expectation: HistoricalCase;
}
interface RuntimeLock {
    manifest_file: string; manifest_sha256: string;
    settings: { grading_model: string };
    comparison_bank: { file: string; sha256: string };
    code_files: Array<{ file: string; sha256: string }>;
    source_files: Array<{ file: string; sha256: string }>;
}

const args: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (key === '--validate-only' && !args[key]) { args[key] = 'true'; continue; }
    if (!['--file', '--cases', '--original-qa', '--runtime-lock', '--output', '--only'].includes(key)
        || !process.argv[i + 1] || args[key]) throw Error('지원 인자: --file --cases --original-qa --runtime-lock --output [--only 사례ID] [--validate-only]');
    args[key] = process.argv[++i];
}
for (const key of ['--file', '--cases', '--original-qa', '--runtime-lock']) {
    if (!args[key]) throw Error(`${key} 필요`);
}
if (!args['--validate-only'] && !args['--output']) throw Error('--output 필요');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const raw = read(args['--file']);
if (Array.isArray(raw) && raw.length !== 1) throw Error('한 세트 파일만 허용');
const set: QuestionSetV3 = Array.isArray(raw) ? raw[0] : raw;
const cases = read(args['--cases']) as { version: number; artifact_type: string; set_id: string; cases: ExploratoryCase[] };
const original = read(args['--original-qa']) as { set_id: string; cases: HistoricalCase[] };
if (set.id !== 'pilot-02-006' || original.set_id !== set.id || cases.set_id !== set.id
    || cases.version !== 1 || cases.artifact_type !== 'exploratory_regression_expectations'
    || cases.cases.length !== 3 || new Set(cases.cases.map(test => test.id)).size !== 3) {
    throw Error('N01 기존 넓은 답안 세 건의 별도 회귀 자료여야 함');
}
for (const test of cases.cases) {
    const q = set.subquestions.find(q => q.id === test.subquestion_id);
    const prior = original.cases.find(prior => prior.id === test.historical_author_expectation.id);
    if (!q || !prior || prior.answer !== test.answer || test.answer.trim() === ''
        || prior.subquestion_id !== test.subquestion_id
        || JSON.stringify(prior) !== JSON.stringify(test.historical_author_expectation)) {
        throw Error(`${test.id}: 역사 입력의 원문·기대값이 보존되지 않음`);
    }
    const target = test.required_target;
    const nonTargets = test.non_target_acceptable_verdicts;
    if (target.verdict !== 'contradicted' || test.expected_points !== 0
        || !q.criteria.some(c => c.id === target.criterion_id)
        || target.criterion_id in nonTargets
        || Object.keys(nonTargets).length !== q.criteria.length - 1
        || q.criteria.some(c => c.id !== target.criterion_id && !nonTargets[c.id])) {
        throw Error(`${test.id}: 대상 명시 반대·비대상 범위·0점 계약 오류`);
    }
    for (const [id, verdicts] of Object.entries(nonTargets)) {
        if (!q.criteria.some(c => c.id === id) || verdicts.length !== 2
            || new Set(verdicts).size !== 2
            || !verdicts.includes('not_met') || !verdicts.includes('contradicted')) {
            throw Error(`${test.id}/${id}: 비대상 허용값은 not_met와 contradicted뿐`);
        }
    }
}
const jobs = cases.cases.filter(test => !args['--only'] || test.id === args['--only']);
if (!jobs.length) throw Error('실행할 사례 없음');
const lock = read(args['--runtime-lock']) as RuntimeLock;
const requiredCode = [
    'lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3Answer.ts',
    'lib/questionV3.ts', 'lib/ai/openaiStructured.ts',
];
if (requiredCode.some(file => !lock.code_files.some(row => row.file === file))) throw Error('실측 코드 잠금 누락');
const locked = [
    ...lock.code_files, ...lock.source_files, lock.comparison_bank,
    { file: lock.manifest_file, sha256: lock.manifest_sha256 },
];
const manifest = read(lock.manifest_file) as {
    entries: Array<{ set_id: string; file: string; sha256: string; qa_file: string; qa_sha256: string }>;
};
const entry = manifest.entries.find(row => row.set_id === set.id);
if (!entry || path.resolve(entry.file) !== path.resolve(args['--file'])
    || path.resolve(entry.qa_file) !== path.resolve(args['--original-qa'])
    || sha(fs.readFileSync(args['--file'])) !== entry.sha256
    || sha(fs.readFileSync(args['--original-qa'])) !== entry.qa_sha256) {
    throw Error('고정 manifest 문항·원QA 경로 또는 해시 불일치');
}
const lockChanges = locked.filter(row => sha(fs.readFileSync(row.file)) !== row.sha256).map(row => row.file);
if (args['--validate-only']) {
    console.log(JSON.stringify({
        status: 'case_contract_validated_without_model', api_calls: 0, case_count: jobs.length,
        planned_repetitions_per_case: 3, runtime_lock_changes: lockChanges,
        eligible_to_execute: lockChanges.length === 0 && gradingModelName() === lock.settings.grading_model,
        policy: '대상은 contradicted 엄격 일치. 비대상은 지정된0점분류만 허용하며 역사 exact 차이를 별도 기록한다.',
    }));
    process.exit(0);
}
if (lockChanges.length) throw Error(`새 공통 코드 고정 필요: ${lockChanges.join(', ')}`);
const model = gradingModelName();
if (model !== lock.settings.grading_model) throw Error('실제 모델과 잠금 모델 불일치');
const output = path.resolve(args['--output']);
const owner = path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/n01') + path.sep;
if (!output.toLowerCase().startsWith(owner.toLowerCase()) || fs.existsSync(output)) throw Error('N01 전용의 새 출력 폴더 필요');
const hashFiles = [...new Set([
    args['--file'], args['--cases'], args['--original-qa'], args['--runtime-lock'],
    fileURLToPath(import.meta.url), ...locked.map(row => row.file), ...set.source_refs.map(ref => ref.file),
])];
const hashes = Object.fromEntries(hashFiles.map(file => [file, sha(fs.readFileSync(file))]));
const changedInputs = () => hashFiles.filter(file => sha(fs.readFileSync(file)) !== hashes[file]);
fs.mkdirSync(output, { recursive: true });
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
write('inputs.json', {
    created_at: new Date().toISOString(), model, question_set: set, exploratory_cases: cases, selected_case_id: args['--only'] || null,
    hashes, transport: 'production_gradeQuestionSetV3', mock: false,
    policy: '49개 필수 작성자QA에 추가하는 원답안 회귀3개. 각3회 실행. 원기대값 exact와 허용범위 일치를 별도로 기록한다.',
});
void (async () => {
    const records: Array<Record<string, unknown>> = [];
    let stopped: Record<string, unknown> | null = null;
    for (let index = 0; index < jobs.length && !stopped; index++) {
        const test = jobs[index];
        const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.id === test.subquestion_id ? test.answer : '']));
        for (let attempt = 1; attempt <= 3; attempt++) {
            const changes = changedInputs();
            if (changes.length || gradingModelName() !== model) {
                stopped = { reason: 'input_code_or_model_changed', changed_inputs: changes };
                break;
            }
            let rawJudgment: QuestionSetJudgmentV3 | null = null;
            const trace: GradingTraceV3[] = [];
            const startedAt = new Date().toISOString();
            const identity = {
                set_id: set.id, case_id: test.id, attempt, model, answers, expected: test,
                started_at: startedAt, transport: 'live_model',
                request_hash: sha(buildGradingPrompt(set, answers)),
                schema_hash: sha(JSON.stringify(buildGradingResponseSchema(set, answers))),
            };
            let record: Record<string, unknown>;
            try {
                const result = await gradeQuestionSetV3(set, answers, process.env.OPENAI_API_KEY || '',
                    value => { rawJudgment = value; }, undefined, event => { trace.push(event); });
                const actual = result.subquestions.find(q => q.subquestion_id === test.subquestion_id)!;
                const target = actual.criteria.find(c => c.criterion_id === test.required_target.criterion_id);
                const nonTargetResults = Object.entries(test.non_target_acceptable_verdicts).map(([id, accepted]) => {
                    const observed = actual.criteria.find(c => c.criterion_id === id)?.verdict;
                    return { criterion_id: id, accepted, observed, matched: observed !== undefined && accepted.includes(observed) };
                });
                const historicalDifferences = test.historical_author_expectation.expected_verdicts.filter(value =>
                    actual.criteria.find(c => c.criterion_id === value.criterion_id)?.verdict !== value.verdict);
                const strictTargetMatched = target?.verdict === 'contradicted';
                const matched = strictTargetMatched && nonTargetResults.every(value => value.matched)
                    && result.score === 0 && result.security_flag === 'none';
                record = {
                    ...identity, finished_at: new Date().toISOString(), raw_judgment: rawJudgment, trace, result,
                    strict_target_matched: strictTargetMatched, non_target_results: nonTargetResults,
                    historical_exact_verdict_differences: historicalDifferences,
                    historical_exact_matched: historicalDifferences.length === 0 && result.score === 0 && result.security_flag === 'none',
                    exploratory_contract_matched: matched,
                };
            } catch (error) {
                const value = error as Error & { code?: string; status?: number };
                record = { ...identity, finished_at: new Date().toISOString(), raw_judgment: rawJudgment, trace,
                    exploratory_contract_matched: false,
                    error: { name: value.name, message: value.message, code: value.code, status: value.status } };
                stopped = { reason: 'execution_error', case_id: test.id, attempt };
            }
            const file = `case-${String(index + 1).padStart(4, '0')}-attempt-${attempt}.json`;
            write(file, record);
            const compact = { file, case_id: test.id, attempt, matched: record.exploratory_contract_matched,
                historical_exact_matched: record.historical_exact_matched, error: record.error || null };
            records.push(compact);
            console.log(JSON.stringify(compact));
            if (stopped) break;
        }
    }
    const changes = changedInputs();
    write('summary.json', {
        finished_at: new Date().toISOString(), model, set_id: set.id, planned_cases: jobs.length,
        planned_attempts: jobs.length * 3, actual_attempts: records.length, records, stopped, changed_inputs: changes,
        mismatched_case_ids: [...new Set(records.filter(row => !row.matched).map(row => row.case_id))],
        note: '보충 탐색회귀 결과이며 정식49개QA나과거정확기대값통과로합산하지않는다.',
    });
    if (stopped || changes.length || records.some(row => !row.matched)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
