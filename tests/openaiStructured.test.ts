import { test } from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import type { Response } from 'openai/resources/responses/responses';
import { OpenAIRequestError, requestOpenAIStructured, withOpenAIUsageObserver } from '../lib/ai/openaiStructured.ts';
import type { OpenAIUsageEvent } from '../lib/ai/openaiStructured.ts';
import { gradeQuestionSetV3 } from '../lib/questionV3Grading.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

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
    await assert.rejects(
        () => requestOpenAIStructured(request, async () => ({
            ...response({}, 'incomplete'), incomplete_details: { reason: 'max_output_tokens' },
        } as unknown as Response)),
        /incomplete: max_output_tokens/u,
        'the cutoff reason is kept so a token-budget failure can be told apart',
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

test('requestOpenAIStructured retries actual SDK connection and timeout errors', async () => {
    for (const failure of [
        new OpenAI.APIConnectionError({ cause: new Error('fetch failed') }),
        new OpenAI.APIConnectionTimeoutError(),
    ]) {
        let attempts = 0;
        const result = await requestOpenAIStructured<{ ok: boolean }>({ ...request, maxAttempts: 2 }, async () => {
            attempts++;
            if (attempts === 1) throw failure;
            return response({ ok: true });
        });
        assert.equal(attempts, 2, failure.name);
        assert.deepEqual(result, { ok: true });
    }
});

test('requestOpenAIStructured preserves SDK connection retryability after its own budget is exhausted', async () => {
    let attempts = 0;
    await assert.rejects(requestOpenAIStructured(request, async () => {
        attempts++;
        throw new OpenAI.APIConnectionError({});
    }), (error: unknown) => error instanceof OpenAIRequestError && error.code === 'transport' && error.retryable);
    assert.equal(attempts, 1, 'the caller owns any subsequent retry');
});

test('requestOpenAIStructured does not retry SDK abort or permanent HTTP errors with transient wording', async () => {
    for (const failure of [
        new OpenAI.APIUserAbortError({ message: 'Network request was aborted.' }),
        new OpenAI.AuthenticationError(401, undefined, 'network authentication failed', new Headers()),
        new OpenAI.BadRequestError(400, undefined, 'request timeout configuration is invalid', new Headers()),
    ]) {
        let attempts = 0;
        await assert.rejects(requestOpenAIStructured({ ...request, maxAttempts: 3 }, async () => {
            attempts++;
            throw failure;
        }), (error: unknown) => error instanceof OpenAIRequestError && error.code === 'transport' && !error.retryable);
        assert.equal(attempts, 1, failure.name);
    }
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

const accountedResponse = (): Response => ({
    ...response({ ok: true }), id: 'resp_test', _request_id: 'req_test', model: 'gpt-test', service_tier: 'default',
    usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 10 }, output_tokens: 30,
        output_tokens_details: { reasoning_tokens: 25 }, total_tokens: 130 },
} as unknown as Response);

test('usage observer records actual provider identity and reasoning/cache detail without changing request/response', async () => {
    const events: OpenAIUsageEvent[] = [], value = accountedResponse();
    const out = await requestOpenAIStructured({ ...request, onUsage(event) { events.push(structuredClone(event)); event.usage!.output_tokens = 999; } }, async params => {
        assert.equal('onUsage' in params, false); return value;
    });
    assert.deepEqual(out, { ok: true });
    assert.deepEqual(events[0], { request_name: request.name, requested_model: request.model, attempt: 1,
        response_id: 'resp_test', request_id: 'req_test', response_model: 'gpt-test', service_tier: 'default',
        response_status: 'completed', usage: accountedResponse().usage });
    assert.equal(value.usage!.output_tokens, 30);
});

test('accounting includes returned invalid/refused/incomplete responses and preserves missing usage', async () => {
    for (const value of [
        { ...accountedResponse(), output_text: 'invalid' },
        { ...accountedResponse(), status: 'incomplete' as const },
        { ...accountedResponse(), output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] } as Response,
    ]) {
        let seen = 0;
        await assert.rejects(requestOpenAIStructured({ ...request, onUsage: () => { seen++; } }, async () => value));
        assert.equal(seen, 1);
    }
    let event: OpenAIUsageEvent | undefined;
    await requestOpenAIStructured({ ...request, onUsage: value => { event = value; } }, async () => response({ ok: true }));
    assert.equal(event?.usage, null); assert.equal(event?.request_id, null);
});

test('usage callbacks are never retried and async failures remain configuration errors for production callers', async () => {
    let calls = 0;
    await assert.rejects(requestOpenAIStructured({ ...request, maxAttempts: 3, onUsage: async () => {
        throw Object.assign(new Error('storage timeout'), { status: 503 });
    } }, async () => { calls++; return accountedResponse(); }), error => error instanceof OpenAIRequestError && error.code === 'configuration' && !error.retryable);
    assert.equal(calls, 1);
});

test('scoped usage observers isolate concurrent production callers and snapshot each observer', async () => {
    const left: string[] = [], right: string[] = [];
    await Promise.all([
        withOpenAIUsageObserver(event => { left.push(event.response_id!); event.usage!.input_tokens = 999; }, () => requestOpenAIStructured({
            ...request, onUsage: event => { assert.equal(event.usage!.input_tokens, 100); },
        }, async () => { await new Promise(resolve => setTimeout(resolve, 4)); return { ...accountedResponse(), id: 'left' }; })),
        withOpenAIUsageObserver(event => { right.push(event.response_id!); }, () => requestOpenAIStructured(request, async () => ({ ...accountedResponse(), id: 'right' }))),
    ]);
    await requestOpenAIStructured(request, async () => accountedResponse());
    assert.deepEqual(left, ['left']); assert.deepEqual(right, ['right']);
});

test('usage counts only actual responses on an existing retry and includes intermediate noncompleted responses', async () => {
    const seen: OpenAIUsageEvent[] = []; let calls = 0;
    await requestOpenAIStructured({ ...request, maxAttempts: 3, onUsage: event => { seen.push(event); } }, async () => {
        calls++; if (calls === 1) throw Object.assign(new Error('temporary'), { status: 503 });
        return { ...accountedResponse(), status: calls === 2 ? 'in_progress' : 'completed' };
    });
    assert.equal(calls, 3); assert.deepEqual(seen.map(e => e.attempt), [2, 3]);
});

test('scoped accounting storage failure stops production grader protocol retry', async () => {
    const set = { id: 'fixture', shared_context: { facts: [] }, subquestions: [{ id: 'q1', prompt: '문항', model_answer: ['답안'],
        criteria: [{ id: 'c1', claim: '답안', scores: { met: 1, not_met: 0, contradicted: 0 }, max_points: 1, critical_facts: [] }] }] } as unknown as QuestionSetV3;
    let calls = 0;
    await assert.rejects(withOpenAIUsageObserver(() => { throw Error('storage'); }, () => gradeQuestionSetV3(set, { q1: '답안' }, 'fixture-key', undefined, async () => {
        calls++; return accountedResponse();
    })), error => error instanceof OpenAIRequestError && error.code === 'configuration');
    assert.equal(calls, 1);
});
