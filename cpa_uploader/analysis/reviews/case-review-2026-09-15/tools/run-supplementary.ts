// 절차 선택형 식별 기준의 표적 실측. 승급 receipt 분모와 별개인 보조 증거이며 운영 채점 경로(gradeQuestionSetV3)를 그대로 호출한다.
//   node --env-file=.env.local --import tsx <tools>/run-supplementary.ts --qa FILE --qa-sha256 SHA --projection FILE --projection-sha256 SHA --output NEW_DIR [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { OpenAIRequestError, withOpenAIUsageObserver } from '../../../../../lib/ai/openaiStructured.ts';
import type { OpenAIResponseCreator } from '../../../../../lib/ai/openaiStructured.ts';
import { gradeQuestionSetV3, applyQuestionSetJudgment, buildGradingPrompt, buildGradingResponseSchema, gradingModelName } from '../../../../../lib/questionV3Grading.ts';
import type { GradingTraceV3, QuestionSetJudgmentV3 } from '../../../../../lib/questionV3Grading.ts';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { contentHash } from '../../../../../lib/learningSubmission.ts';
import { compareResult, responseTransportRecord } from './run-efficient-grading.ts';
import { assessUsageCost, isQuotaOrRateLimit, PRICING, safeError } from './accounting.ts';
import type { ExpectedSubquestion, UsageObservation } from './contract.ts';

const MODEL = 'gpt-5.6-luna';
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const flags = ['--qa', '--qa-sha256', '--projection', '--projection-sha256', '--output'];
const args: Record<string, string> = {}; let dryRun = false;
for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--dry-run') { dryRun = true; continue; }
    assert(flags.includes(flag) && args[flag] === undefined && process.argv[i + 1], 'Unknown/duplicate/incomplete argument: ' + flag);
    args[flag] = process.argv[++i];
}
assert(flags.every(flag => args[flag]), 'Required: ' + flags.join(' '));
const readFrozen = (file: string, expected: string) => { const bytes = fs.readFileSync(file); assert.equal(sha(bytes), expected, 'Changed frozen input: ' + file); return bytes; };
const qa = JSON.parse(readFrozen(args['--qa'], args['--qa-sha256']).toString('utf8'));
const set = JSON.parse(readFrozen(args['--projection'], args['--projection-sha256']).toString('utf8')) as QuestionSetV3;
const output = path.resolve(args['--output']);
assert(!fs.existsSync(output), 'Output exists; old evidence cannot be overwritten');
assert.equal(gradingModelName(), MODEL, 'Runtime model changed');
const guard = () => { readFrozen(args['--qa'], args['--qa-sha256']); readFrozen(args['--projection'], args['--projection-sha256']); assert.equal(gradingModelName(), MODEL); };

const jobs = (qa.supplementary_cases as Array<{ id: string; purpose: string; answers: Record<string, string>; expected: Record<string, Omit<ExpectedSubquestion, 'subquestion_id'>> }>).map(row => {
    assert(/^[a-z0-9-]+$/.test(row.id) && row.purpose.trim());
    assert.deepEqual(Object.keys(row.answers).sort(), set.subquestions.map(q => q.id).sort(), 'Supplementary answers must cover the whole case unit');
    const expected: ExpectedSubquestion[] = set.subquestions.map(q => ({ subquestion_id: q.id, ...row.expected[q.id] }));
    const prompt = buildGradingPrompt(set, row.answers), schema = buildGradingResponseSchema(set, row.answers);
    return { row, expected, prompt, schema };
});
assert.equal(new Set(jobs.map(j => contentHash({ prompt: j.prompt, schema: j.schema }))).size, jobs.length, 'Duplicate requests');
fs.mkdirSync(output, { recursive: true });
const write = (file: string, value: unknown) => fs.writeFileSync(path.join(output, file), json(value), { flag: 'wx' });
write('preflight.json', { version: 1, mode: dryRun ? 'dry_run_no_model' : 'actual_sdk_forwarding', model: MODEL,
    qa: { file: args['--qa'], sha256: args['--qa-sha256'] }, projection: { file: args['--projection'], sha256: args['--projection-sha256'] },
    jobs: jobs.map(j => j.row.id), pricing: PRICING, extra_quality_repeats: 0, receipt_denominator: false,
    purpose: '절차 선택형 식별 기준의 표적 확인. 대표 실측(execution-v1)의 분모에 넣지 않는다.' });
async function main() {
if (dryRun) { write('summary.json', { status: 'dry_run_complete', actual_sdk_calls: 0 }); return; }
const apiKey = process.env.OPENAI_API_KEY ?? ''; assert(apiKey.trim(), 'OPENAI_API_KEY missing');
const client = new OpenAI({ apiKey, maxRetries: 0 });
let calls = 0; const costs: UsageObservation[] = [], rows: Record<string, unknown>[] = [];
for (const job of jobs) {
    guard();
    const folder = path.join(output, job.row.id); fs.mkdirSync(folder);
    const append = (file: string, value: unknown) => fs.appendFileSync(path.join(folder, file), JSON.stringify(value) + '\n');
    for (const file of ['transport.jsonl', 'traces.jsonl', 'usage.jsonl']) fs.writeFileSync(path.join(folder, file), '', { flag: 'wx' });
    fs.writeFileSync(path.join(folder, 'input.json'), json({ case: job.row, set, prompt: job.prompt, schema: job.schema, model: MODEL }), { flag: 'wx' });
    const traces: GradingTraceV3[] = [], judgments: QuestionSetJudgmentV3[] = [], usage: UsageObservation[] = []; let jobCalls = 0;
    const forward: OpenAIResponseCreator = async (params, requestOptions) => {
        assert.equal(params.model, MODEL); assert.equal(params.store, false);
        append('transport.jsonl', { event: 'request_started', at: new Date().toISOString(), sequence: ++jobCalls, params }); calls++;
        let response;
        try { response = await client.responses.create(params, requestOptions); }
        catch (error) {
            append('transport.jsonl', { event: 'request_error', at: new Date().toISOString(), ...safeError(error, apiKey) });
            if (isQuotaOrRateLimit(error)) throw new OpenAIRequestError('configuration', 'Provider quota/rate limit; stop', { cause: error });
            throw error;
        }
        append('transport.jsonl', responseTransportRecord(response));
        if (response.model !== MODEL) throw new OpenAIRequestError('configuration', 'Provider model identity changed');
        return response;
    };
    try {
        const result = await withOpenAIUsageObserver(provider => {
            const row = { provider, cost: assessUsageCost(provider, client.baseURL.replace(/\/$/, '') === PRICING.endpoint) };
            append('usage.jsonl', row); usage.push(row); costs.push(row);
        }, () => gradeQuestionSetV3(set, job.row.answers, apiKey, j => judgments.push(j), forward, t => { traces.push(t); append('traces.jsonl', t); }));
        assert.equal(judgments.length, 1);
        assert.deepEqual(applyQuestionSetJudgment(set, job.row.answers, judgments[0]), result, 'Production replay differs');
        const comparison = compareResult(set, job.expected, result, traces);
        fs.writeFileSync(path.join(folder, 'observation.json'), json({ version: 1, artifact_type: 'supplementary_grading_observation', transport: 'model',
            model: MODEL, case_id: job.row.id, purpose: job.row.purpose, projected_body_hash: contentHash(set), answers: job.row.answers,
            original_expected: job.expected, prompt_sha256: sha(job.prompt), schema_hash: contentHash(job.schema), actual_sdk_calls: jobCalls,
            judgment: judgments[0], traces, result, ...comparison, usage }), { flag: 'wx' });
        rows.push({ id: job.row.id, strict_matched: comparison.strict_matched, within_tolerance: comparison.within_tolerance, subquestions: comparison.subquestions, actual_sdk_calls: jobCalls });
        console.log(JSON.stringify({ case: job.row.id, strict_matched: comparison.strict_matched, within_tolerance: comparison.within_tolerance, actual_sdk_calls: jobCalls }));
    } catch (error) {
        fs.writeFileSync(path.join(folder, 'execution-error.json'), json({ status: 'execution_error', ...safeError(error, apiKey), actual_sdk_calls: jobCalls, scored: false }), { flag: 'wx' });
        rows.push({ id: job.row.id, status: 'execution_error' }); process.exitCode = 1; break;
    }
}
const known = costs.every(c => c.cost.status === 'calculated');
write('summary.json', { version: 1, status: rows.length === jobs.length && !process.exitCode ? 'completed' : 'stopped', actual_sdk_calls: calls, rows,
    usd: known ? costs.reduce((n, c) => n + c.cost.usd!, 0) : null, usage: costs, receipt_denominator: false,
    costs_are_provider_usage_arithmetic_not_invoice: true });
}
main().catch(error => { console.error(JSON.stringify(safeError(error, process.env.OPENAI_API_KEY ?? ''))); process.exitCode = 1; });
