import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { prepareSemanticReview, buildReviewChunkInput, reviewChunkSchema, reviewQuestionDraft } from '../../../../questionSemanticReview.ts';
import { jsonHash } from '../../../../questionReviewIdentity.ts';
import type { OpenAIResponseCreator } from '../../../../../lib/ai/openaiStructured.ts';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const base = `${D}/api-availability-v2`, manifestFile = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01/pending-manifest.json`;
const rawFile = `${D}/a/resume-review-2026-09-12/r4/transport-retry-01/pending-semantic-a/pilot-10-002/semantic.json.chunks.jsonl`;
const output = `${base}/diagnosis.json`;
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
async function main() {
    assert(!fs.existsSync(output));
    const manifest = read(manifestFile), job = manifest.jobs.find((j: { set_id: string }) => j.set_id === 'pilot-10-002');
    const pins = [{ file: manifestFile, sha256: sha(fs.readFileSync(manifestFile)) },
        { file: rawFile, sha256: sha(fs.readFileSync(rawFile)) }, { file: job.file, sha256: job.sha256 },
        { file: job.plan_file, sha256: job.plan_sha256 }, { file: manifest.bank_file, sha256: manifest.bank_sha256 },
        ...manifest.code_files, ...job.source_files];
    const guard = () => { for (const row of pins) assert.equal(sha(fs.readFileSync(row.file)), row.sha256, row.file); };
    guard();
    const rawSet = read(job.file), set = Array.isArray(rawSet) ? rawSet[0] : rawSet;
    const rawBank = read(manifest.bank_file), bank = Array.isArray(rawBank) ? rawBank : rawBank.sets;
    const options = { bank, authoringPlan: read(job.plan_file), model: 'gpt-5.6-luna', maxInputChars: 500000 };
    const prepared = prepareSemanticReview(set, options);
    const target = prepared.units.find(unit => unit.id === 'criterion:sub3:crit13')!;
    const targetInputHash = sha(buildReviewChunkInput(prepared, target)), targetSchemaHash = jsonHash(reviewChunkSchema(target));
    const events = fs.readFileSync(rawFile, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
    const failures = events.filter(event => event.unit_id === target.id && event.error_status === 429);
    assert.equal(failures.length, 2); assert(failures.every(event => event.input_hash === targetInputHash && event.schema_hash === targetSchemaHash));
    const saved = new Map(events.filter(event => event.response && !event.error).map(event => [event.input_hash, event]));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
    let calls = 0, replays = 0, provider: unknown = null;
    const create: OpenAIResponseCreator = async params => {
        const hash = sha(String(params.input));
        if (saved.has(hash)) {
            replays++;
            return { status: 'completed', output: [], output_text: JSON.stringify(saved.get(hash).response) } as unknown as Awaited<ReturnType<OpenAIResponseCreator>>;
        }
        assert.equal(hash, targetInputHash, 'No new request outside the failed target');
        assert.equal(calls, 0, 'No second external diagnostic request');
        assert.equal(params.model, 'gpt-5.6-luna');
        assert.equal(jsonHash(params.text?.format && 'schema' in params.text.format ? params.text.format.schema : undefined), targetSchemaHash);
        calls++; guard();
        const started = new Date().toISOString();
        try {
            const response = await client.responses.create(params, { timeout: 45000 });
            provider = { status: 'provider_accepted_request', response_status: response.status, usage: response.usage,
                response: response.output_text, requested_at: started, finished_at: new Date().toISOString() };
            return response;
        } catch (error) {
            const value = error as { status?: number; code?: string; type?: string; headers?: Headers };
            const headers: Record<string, string> = {};
            for (const name of ['retry-after', 'x-ratelimit-limit-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-requests',
                'x-ratelimit-remaining-tokens', 'x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens']) {
                const valueString = value.headers?.get(name); if (valueString) headers[name] = valueString;
            }
            provider = { status: 'provider_error', http_status: value.status, code: value.code, type: value.type, headers,
                requested_at: started, finished_at: new Date().toISOString() };
            throw error;
        }
    };
    try { await reviewQuestionDraft(set, options, create); } catch { /* The bounded forwarding guard intentionally prevents further requests. */ }
    assert.equal(calls, 1); guard();
    fs.writeFileSync(output, JSON.stringify({ purpose: 'transport_diagnostic_only_not_a_formal_semantic_receipt',
        formal_semantic_receipt: false, set_id: set.id, unit_id: target.id, model: 'gpt-5.6-luna', actual_new_requests: calls,
        prior_responses_replayed_locally: replays, input_hash: targetInputHash, schema_hash: targetSchemaHash,
        provider, preserved_inputs: pins }, null, 2) + '\n', { flag: 'wx' });
    const publicStatus = provider as Record<string, unknown>;
    console.log(JSON.stringify({ actual_new_requests: calls, local_replays: replays, output: path.resolve(output),
        status: publicStatus.status, http_status: publicStatus.http_status, code: publicStatus.code, type: publicStatus.type,
        headers: publicStatus.headers, usage: publicStatus.usage }));
}
main().catch(error => { console.error(String(error)); process.exitCode = 1; });
