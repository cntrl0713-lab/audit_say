import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'openai/resources/responses/responses';
import { OpenAIRequestError, requestOpenAIStructured } from '../lib/ai/openaiStructured.ts';

const response = (value: unknown, status: Response['status'] = 'completed'): Response => ({
    status,
    output: [],
    output_text: JSON.stringify(value),
} as unknown as Response);

const request = {
    apiKey: 'test-key',
    model: 'gpt-test',
    name: 'test_schema',
    input: '테스트 입력',
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
    },
    maxAttempts: 1,
    retryDelayMs: 0,
};

test('requestOpenAIStructured sends strict JSON schema and parses output', async () => {
    let received: Record<string, unknown> | undefined;
    const result = await requestOpenAIStructured<{ ok: boolean }>(request, async (params) => {
        received = params as unknown as Record<string, unknown>;
        return response({ ok: true });
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(received?.store, false);
    assert.deepEqual((received?.text as { format: unknown }).format, {
        type: 'json_schema',
        name: 'test_schema',
        schema: request.schema,
        strict: true,
    });
});

test('requestOpenAIStructured surfaces refusals without treating them as JSON', async () => {
    await assert.rejects(
        () => requestOpenAIStructured(request, async () => ({
            status: 'completed',
            output: [{
                type: 'message',
                content: [{ type: 'refusal', refusal: '안전 정책상 거절' }],
            }],
            output_text: '',
        } as unknown as Response)),
        (error: unknown) => error instanceof OpenAIRequestError
            && error.code === 'refusal'
            && error.retryable === false,
    );
});

test('requestOpenAIStructured retries transient transport failures once', async () => {
    let attempts = 0;
    const result = await requestOpenAIStructured<{ ok: boolean }>({
        ...request,
        maxAttempts: 2,
    }, async () => {
        attempts += 1;
        if (attempts === 1) {
            throw Object.assign(new Error('temporary failure'), { status: 503 });
        }
        return response({ ok: true });
    });

    assert.equal(attempts, 2);
    assert.deepEqual(result, { ok: true });
});

test('requestOpenAIStructured retries rate limits', async () => {
    let attempts = 0;
    const result = await requestOpenAIStructured<{ ok: boolean }>({
        ...request,
        maxAttempts: 2,
    }, async () => {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error('rate limited'), { status: 429 });
        return response({ ok: true });
    });

    assert.equal(attempts, 2);
    assert.deepEqual(result, { ok: true });
});

test('requestOpenAIStructured does not retry authentication failures', async () => {
    let attempts = 0;
    await assert.rejects(
        () => requestOpenAIStructured({ ...request, maxAttempts: 3 }, async () => {
            attempts += 1;
            throw Object.assign(new Error('unauthorized'), { status: 401 });
        }),
        (error: unknown) => error instanceof OpenAIRequestError
            && error.code === 'transport'
            && error.status === 401
            && error.retryable === false,
    );
    assert.equal(attempts, 1);
});

test('requestOpenAIStructured rejects incomplete output without scoring it', async () => {
    await assert.rejects(
        () => requestOpenAIStructured(request, async () => response({}, 'incomplete')),
        (error: unknown) => error instanceof OpenAIRequestError
            && error.code === 'incomplete'
            && error.retryable === false,
    );
});

test('requestOpenAIStructured retries timeout failures', async () => {
    let attempts = 0;
    const result = await requestOpenAIStructured<{ ok: boolean }>({
        ...request,
        maxAttempts: 2,
    }, async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('request timeout');
        return response({ ok: true });
    });

    assert.equal(attempts, 2);
    assert.deepEqual(result, { ok: true });
});

test('requestOpenAIStructured rejects missing credentials before a network call', async () => {
    let called = false;
    await assert.rejects(
        () => requestOpenAIStructured({ ...request, apiKey: ' ' }, async () => {
            called = true;
            return response({ ok: true });
        }),
        (error: unknown) => error instanceof OpenAIRequestError && error.code === 'configuration',
    );
    assert.equal(called, false);
});
