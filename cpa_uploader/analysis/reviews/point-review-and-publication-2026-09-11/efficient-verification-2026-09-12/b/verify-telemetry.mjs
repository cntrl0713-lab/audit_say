import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { requestOpenAIStructured, withOpenAIUsageObserver } from '../../../../../../lib/ai/openaiStructured.ts';
const own = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(own, '../../../../../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const before = JSON.parse(fs.readFileSync(path.join(own, 'before/manifest.json')));
for (const entry of before.files) assert.equal(sha(fs.readFileSync(path.join(root, entry.snapshot))), entry.sha256);
const source = fs.readFileSync(path.join(own, 'before/openaiStructured.ts.txt'), 'utf8');
const folder = fs.mkdtempSync(path.join(own, 'telemetry-proof-'));
const legacyFile = path.join(folder, 'legacy.mjs');
fs.writeFileSync(legacyFile, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { flag: 'wx' });
const legacy = await import(pathToFileURL(legacyFile).href);
const request = { apiKey: 'synthetic-key-not-real', model: 'gpt-5.6-luna', name: 'audit_grading_judgment', instructions: '동일 지시', input: '합성 입력', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }, maxOutputTokens: 8000, timeoutMs: 45000, maxAttempts: 2, retryDelayMs: 0 };
const response = { id: 'resp_fixture', _request_id: 'req_fixture', model: request.model, service_tier: 'default', status: 'completed', output: [], output_text: '{"ok":true}', usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 3, output_tokens_details: { reasoning_tokens: 1 }, total_tokens: 13 } };
const outcomes = [];
for (const scenario of ['success', '503-then-success', 'in-progress-then-success', 'invalid-json', 'incomplete', 'refusal']) {
    async function run(fn, observed) {
        const params = [], usage = []; let count = 0, outcome;
        const invoke = () => fn(request, async (p, options) => {
            params.push({ params: structuredClone(p), options: structuredClone(options) }); count++;
            if (scenario === '503-then-success' && count === 1) throw Object.assign(Error('temporary'), { status: 503 });
            const value = structuredClone(response);
            if (scenario === 'in-progress-then-success' && count === 1) value.status = 'in_progress';
            if (scenario === 'invalid-json') value.output_text = 'bad';
            if (scenario === 'incomplete') value.status = 'incomplete';
            if (scenario === 'refusal') value.output = [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }];
            return value;
        });
        try { outcome = { result: observed ? await withOpenAIUsageObserver(e => usage.push(e), invoke) : await invoke() }; }
        catch (error) { outcome = { error: { name: error.name, message: error.message, code: error.code, status: error.status, retryable: error.retryable } }; }
        return { params, count, outcome, usage };
    }
    const old = await run(legacy.requestOpenAIStructured, false), current = await run(requestOpenAIStructured, false), observed = await run(requestOpenAIStructured, true);
    for (const actual of [current, observed]) { assert.deepEqual(actual.params, old.params); assert.deepEqual(actual.outcome, old.outcome); assert.equal(actual.count, old.count); }
    outcomes.push({ scenario, synthetic_creator_calls: old.count, request_bytes_equal: true, result_error_equal: true, observed_usage_responses: observed.usage.length, requests: old.params });
}
const report = { version: 1, mode: 'synthetic_fixture_only', actual_api_calls: 0, before_snapshots_unchanged: true, outcomes,
    shared_file: { file: 'lib/ai/openaiStructured.ts', sha256: sha(fs.readFileSync(path.join(root, 'lib/ai/openaiStructured.ts'))) },
    interpretation: 'No production grading params/schema/instructions/results changed. Telemetry changes code identity, so historical frozen manifests remain historical.' };
const output = path.join(folder, 'report.json'); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ file: rel(output), sha256: sha(fs.readFileSync(output)), scenarios: outcomes.length, actual_api_calls: 0 }));
