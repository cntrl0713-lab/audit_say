import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv';
import { gradeQuestionSetV3, buildGradingPrompt, buildGradingResponseSchema } from '../../../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3 } from '../../../../../lib/questionV3Grading.ts';
import type { QuestionSetV3, CriterionVerdictNameV3 } from '../../../../../lib/questionV3.ts';
import type { OpenAIResponseCreator } from '../../../../../lib/ai/openaiStructured.ts';

type Expected = { criterion_id: string; verdict: CriterionVerdictNameV3; reason?: string };
type Case = { id: string; subquestion_id: string; kind: string; answer: string; expected_points: number;
    expected_verdicts: Expected[]; expected_by_subquestion?: Array<{ subquestion_id: string; expected_points: number; expected_verdicts: Expected[] }> };
type Observation = { case_id: string; set_id: string; attempt: number; model: string; transport: string;
    answers: Record<string, string>; expected: Case; request_hash: string; schema_hash: string;
    raw_judgment: QuestionSetJudgmentV3 | null; trace: Array<{ stage: string; attempt: number; response?: unknown; error?: string }>;
    result: Awaited<ReturnType<typeof gradeQuestionSetV3>>; matched: boolean;
    exact_verdict_differences: Expected[]; verdict_differences: Expected[]; error?: unknown };
type Job = { set_id: string; worker: string; file: string; sha256: string; qa_file: string; qa_sha256: string; source_files: Identity[] };
type Identity = { file: string; sha256: string };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)])) : value;
const equal = (a: unknown, b: unknown, reason: string) => assert.equal(JSON.stringify(stable(a)), JSON.stringify(stable(b)), reason);
const identity = (file: string): Identity => ({ file, sha256: sha(fs.readFileSync(file)) });
const checkIdentity = (row: Identity) => assert.equal(sha(fs.readFileSync(row.file)), row.sha256, `Input changed: ${row.file}`);
const zero = new Set(['not_met', 'contradicted']);
const ajv = new Ajv({ allErrors: true });
const requiredProducerCode = ['lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts',
    'lib/questionV3Answer.ts', 'lib/ai/openaiStructured.ts',
    'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts'];
const loadedGraderPins = requiredProducerCode.slice(0, 5).map(identity);

function expectedPoints(set: QuestionSetV3, subId: string, expected: Expected[]): number {
    const sub = set.subquestions.find(row => row.id === subId);
    assert(sub, 'Unknown expected subquestion');
    equal(expected.map(row => row.criterion_id).sort(), sub.criteria.map(row => row.id).sort(), 'Incomplete/duplicate expected criterion IDs');
    return expected.reduce((sum, row) => {
        const criterion = sub.criteria.find(item => item.id === row.criterion_id)!;
        assert(['met', 'partial', 'not_met', 'contradicted'].includes(row.verdict));
        const points = row.verdict === 'met' ? criterion.scores.met : row.verdict === 'partial' ? criterion.scores.partial : 0;
        assert(Number.isSafeInteger(points), 'Invalid expected integer score');
        return sum + points!;
    }, 0);
}

/** Local replay only: a supplied creator prevents any network request. This is
 * an assessment of preserved actual observations, never a new model receipt. */
export async function assessObservation(set: QuestionSetV3, test: Case, record: Observation) {
    loadedGraderPins.forEach(checkIdentity);
    assert(!record.error, 'Execution error cannot be accepted as score deviation');
    assert.equal(record.set_id, set.id); assert.equal(record.case_id, test.id);
    assert.equal(record.model, 'gpt-5.6-luna');
    assert(Number.isSafeInteger(record.attempt) && record.attempt >= 1);
    equal(record.expected, test, 'Original expectation changed');
    assert.equal(expectedPoints(set, test.subquestion_id, test.expected_verdicts), test.expected_points);
    const answers = Object.fromEntries(set.subquestions.map(sub => [sub.id, sub.id === test.subquestion_id ? test.answer : '']));
    equal(record.answers, answers, 'Original answer changed');
    const wholeExpected = set.subquestions.map(sub => ({ subquestion_id: sub.id,
        expected_points: sub.id === test.subquestion_id ? test.expected_points : 0 }));
    if (test.expected_by_subquestion !== undefined) {
        equal(test.expected_by_subquestion.map(sub => sub.subquestion_id).sort(), wholeExpected.map(sub => sub.subquestion_id).sort(), 'Full expectation IDs differ');
        for (const row of test.expected_by_subquestion) {
            assert.equal(expectedPoints(set, row.subquestion_id, row.expected_verdicts), row.expected_points);
            assert.equal(row.expected_points, wholeExpected.find(sub => sub.subquestion_id === row.subquestion_id)!.expected_points);
            if (row.subquestion_id === test.subquestion_id) equal(row.expected_verdicts, test.expected_verdicts, 'Full target expectation differs');
            else assert(row.expected_verdicts.every(v => v.verdict === 'not_met'), 'Blank answer expectation is not zero/not_met');
        }
    }
    assert.equal(record.request_hash, sha(buildGradingPrompt(set, answers)));
    const schema = buildGradingResponseSchema(set, answers);
    assert.equal(record.schema_hash, sha(JSON.stringify(schema)));
    assert(Array.isArray(record.trace), 'Trace is missing');
    // A recovered protocol failure needs its own review. This tool does not
    // waive such failures using a matching or near-matching final score.
    assert(record.trace.every(event => !event.error), 'Protocol/transport trace error requires separate review');
    assert(record.trace.every(event => event.stage === 'judgment'), 'Security review cannot be waived by score tolerance');
    const nonempty = test.answer.trim().length > 0;
    assert.equal(record.transport, nonempty ? 'live_model' : 'production_empty_answer_no_model');
    assert.equal(record.trace.length, nonempty ? 1 : 0, 'Unexpected number of production response events');
    let replayJudgment: QuestionSetJudgmentV3 | null = null, replayCalls = 0;
    const create: OpenAIResponseCreator = async params => {
        const event = record.trace[replayCalls++];
        assert(event && event.attempt === 1, 'Missing or unexpected response');
        assert.equal(params.model, 'gpt-5.6-luna', 'Replay model configuration differs');
        equal(params.input, buildGradingPrompt(set, answers), 'Replay input differs');
        const validate = ajv.compile(schema);
        assert(validate(event.response), `Stored response schema invalid: ${ajv.errorsText(validate.errors)}`);
        const raw = event.response as { subquestions: Array<{ injection_detected?: boolean; salad_detected?: boolean }>;
            injection_detected?: boolean; salad_detected?: boolean };
        assert(!raw.injection_detected && !raw.salad_detected && raw.subquestions.every(sub => !sub.injection_detected && !sub.salad_detected), 'Raw security flag cannot be waived');
        return { status: 'completed', output: [], output_text: JSON.stringify(event.response) } as unknown as Awaited<ReturnType<OpenAIResponseCreator>>;
    };
    const replayed = await gradeQuestionSetV3(set, answers, 'local-replay-no-network', value => { replayJudgment = value; }, create);
    assert.equal(replayCalls, nonempty ? 1 : 0);
    equal(replayJudgment, record.raw_judgment, 'Raw trace and grounded judgment differ');
    equal(replayed, record.result, 'Production replay and recorded result differ');
    loadedGraderPins.forEach(checkIdentity);
    assert.equal(replayed.security_flag, 'none', 'Final security flag cannot be waived');
    const actual = replayed.subquestions.find(sub => sub.subquestion_id === test.subquestion_id)!;
    const exactDifferences = test.expected_verdicts.filter(row => actual.criteria.find(c => c.criterion_id === row.criterion_id)?.verdict !== row.verdict);
    const boundary = ['condition_boundary', 'condition-boundary'].includes(test.kind);
    const differences = exactDifferences.filter(row => !(boundary && zero.has(row.verdict) && zero.has(actual.criteria.find(c => c.criterion_id === row.criterion_id)?.verdict || '')));
    equal(record.exact_verdict_differences, exactDifferences, 'Stored exact differences changed');
    equal(record.verdict_differences, differences, 'Stored policy differences changed');
    const strict = differences.length === 0 && replayed.score === test.expected_points && replayed.security_flag === 'none';
    assert.equal(record.matched, strict, 'Stored strict match flag is inconsistent');
    const deltas = wholeExpected.map(expected => {
        const sub = replayed.subquestions.find(row => row.subquestion_id === expected.subquestion_id)!;
        if (!answers[sub.subquestion_id].trim()) assert.equal(sub.score, 0, 'Blank answer score must remain zero');
        return { ...expected, actual_points: sub.score, absolute_delta: Math.abs(sub.score - expected.expected_points) };
    });
    return { strict_match: strict, status: strict ? 'strict_match' : deltas.every(row => row.absolute_delta <= 1)
        ? 'accepted_with_grading_deviation' : 'outside_authorized_tolerance', deltas, replay_calls: replayCalls, network_calls: 0 };
}

async function main() {
    const args: Record<string, string> = {};
    for (let i = 2; i < process.argv.length; i += 2) {
        const key = process.argv[i], value = process.argv[i + 1];
        assert(['--manifest', '--qa-root', '--output', '--policy'].includes(key) && value && !args[key], 'Expected --manifest --qa-root --policy --output');
        args[key] = value;
    }
    for (const key of ['--manifest', '--qa-root', '--output', '--policy']) assert(args[key], key);
    assert(!fs.existsSync(args['--output']), 'Use a new assessment output');
    const manifest = read(args['--manifest']), policy = read(args['--policy']);
    assert.equal(manifest.model, 'gpt-5.6-luna'); assert.equal(policy.grading_model, manifest.model);
    assert.equal(policy.authorization.confirmed_text, '물음당 1점 이내 수용');
    assert.equal(policy.max_absolute_score_delta_per_subquestion, 1); assert.equal(policy.global_default_policy, false);
    const pins: Identity[] = [identity(args['--manifest']), identity(args['--policy']), identity(process.argv[1]),
        { file: manifest.bank_file, sha256: manifest.bank_sha256 }];
    const rows = [];
    for (const job of manifest.jobs as Job[]) {
        const folder = path.join(args['--qa-root'], `author-qa-${job.worker}`, job.set_id, 'author-qa');
        if (!fs.existsSync(path.join(folder, 'summary.json'))) { rows.push({ set_id: job.set_id, status: 'not_completed' }); continue; }
        const inputFile = path.join(folder, 'inputs.json'), summaryFile = path.join(folder, 'summary.json');
        const inputs = read(inputFile), summary = read(summaryFile);
        const inputHash = (file: string) => {
            const found = Object.entries(inputs.hashes as Record<string, string>).filter(([key]) => path.resolve(key).toLowerCase() === path.resolve(file).toLowerCase());
            assert.equal(found.length, 1, `Missing or duplicate producer input: ${file}`);
            return found[0][1];
        };
        for (const code of requiredProducerCode) {
            const declared = manifest.code_files.find((row: Identity) => row.file === code);
            assert(declared && inputHash(code) === declared.sha256, `Missing or different producer code identity: ${code}`);
        }
        assert.equal(inputHash(job.file), job.sha256); assert.equal(inputHash(job.qa_file), job.qa_sha256);
        for (const source of job.source_files) assert.equal(inputHash(source.file), source.sha256);
        const localPins = [identity(inputFile), identity(summaryFile), { file: job.file, sha256: job.sha256 },
            { file: job.qa_file, sha256: job.qa_sha256 }, ...job.source_files,
            ...Object.entries(inputs.hashes as Record<string, string>).map(([file, hash]) => ({ file, sha256: hash }))];
        localPins.forEach(checkIdentity); pins.push(...localPins);
        const rawSet = read(job.file), set: QuestionSetV3 = Array.isArray(rawSet) ? rawSet[0] : rawSet, qa = read(job.qa_file);
        equal(inputs.question_set, set, 'QA snapshot differs from frozen set'); equal(inputs.qa, qa, 'QA snapshot differs from frozen expectations');
        assert.equal(inputs.model, manifest.model); assert.equal(inputs.transport, 'production_gradeQuestionSetV3'); assert.equal(inputs.mock, false); assert.equal(inputs.selected, null);
        assert.equal(summary.set_id, job.set_id); assert.equal(summary.model, manifest.model); assert.equal(summary.stopped_on_execution_error, false);
        equal(summary.changed_inputs, [], 'Producer recorded input drift');
        assert.equal(summary.planned_cases, qa.cases.length); assert.equal(summary.recorded_cases, qa.cases.length);
        const listed = summary.records.map((record: { file: string }) => record.file);
        equal(listed.slice().sort(), fs.readdirSync(folder).filter(file => /^case-.*\.json$/.test(file)).sort(), 'Producer omitted or added observations');
        assert.equal(new Set(listed).size, listed.length); assert.equal(summary.actual_attempts, listed.length);
        const observations: Array<{ case_id: string; attempt: number; observation: Identity } & Awaited<ReturnType<typeof assessObservation>>> = [];
        for (const entry of summary.records) {
            assert(typeof entry.file === 'string' && /^case-\d+-attempt-\d+\.json$/.test(entry.file), 'Unsafe record filename');
            const file = path.join(folder, entry.file), record = read(file) as Observation;
            const test = qa.cases.find((test: Case) => test.id === record.case_id);
            assert(test, 'Unknown QA case'); assert.equal(entry.case_id, record.case_id); assert.equal(entry.attempt, record.attempt);
            assert.equal(entry.matched, record.matched); assert(!entry.error);
            const pin = identity(file); pins.push(pin);
            observations.push({ case_id: record.case_id, attempt: record.attempt, observation: pin, ...await assessObservation(set, test, record) });
        }
        for (const test of qa.cases) {
            const attempts = observations.filter(row => row.case_id === test.id).map(row => row.attempt).sort();
            assert(attempts.length > 0); equal(attempts, Array.from({ length: attempts.length }, (_, i) => i + 1), 'Observation attempt sequence differs');
        }
        equal(summary.mismatched_case_ids.slice().sort(), [...new Set(observations.filter(row => !row.strict_match).map(row => row.case_id))].sort(), 'Producer mismatch list differs');
        rows.push({ set_id: set.id, status: observations.some(row => row.status === 'outside_authorized_tolerance') ? 'outside_authorized_tolerance' : 'assessed',
            unique_cases: qa.cases.length, strict_unique_cases: qa.cases.filter((test: Case) => observations.filter(row => row.case_id === test.id).every(row => row.strict_match)).length,
            observations });
    }
    pins.forEach(checkIdentity);
    const output = { artifact_type: 'author_qa_preserved_observation_assessment', created_at: new Date().toISOString(),
        complete: rows.every(row => row.status === 'assessed'), actual_new_model_calls: 0, production_acceptance_sidecar: false,
        human_confirmation: false, semantic_verification: 'separate', policy: identity(args['--policy']), manifest: identity(args['--manifest']),
        unchanged_input_files: pins, rows };
    fs.writeFileSync(args['--output'], JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ complete: output.complete, sets: rows.length, unique_cases: rows.reduce((s, r) => s + (r.unique_cases ?? 0), 0),
        observations: rows.reduce((s, r) => s + (r.observations?.length ?? 0), 0), actual_new_model_calls: 0 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(String(error)); process.exitCode = 1; });
