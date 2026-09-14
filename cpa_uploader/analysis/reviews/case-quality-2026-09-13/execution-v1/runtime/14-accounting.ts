import type { OpenAIUsageEvent } from '../../../../../../lib/ai/openaiStructured.ts';
import type { CostAssessment } from './contract.ts';

export const PRICING = {
    checked_at: '2026-09-12', currency: 'USD', model: 'gpt-5.6-luna', service_tier: 'default',
    endpoint: 'https://api.openai.com/v1',
    urls: ['https://developers.openai.com/api/docs/models/gpt-5.6-luna', 'https://developers.openai.com/api/docs/pricing',
        'https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create'],
    per_million: { input: 0.20, cached: 0.02, cache_write: 0.25, output: 1.20 },
    long_context_above_input_tokens: 272000,
    long_context_per_million: { input: 0.40, cached: 0.04, cache_write: 0.50, output: 1.80 },
};
const integer = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/** Post-response arithmetic only. Unknown fields are never replaced by a made-up zero. */
export function assessUsageCost(event: OpenAIUsageEvent, standardEndpoint: boolean): CostAssessment {
    const unknown = (reason: string): CostAssessment => ({ status: 'unknown', usd: null, min_usd: null, max_usd: null, reason });
    if (!standardEndpoint || event.response_model !== PRICING.model || event.service_tier !== 'default') return unknown('Endpoint/model/actual service tier does not establish the pinned standard rate.');
    const u = event.usage, input = u?.input_tokens, output = u?.output_tokens, total = u?.total_tokens;
    const cached = u?.input_tokens_details?.cached_tokens, writes = u?.input_tokens_details?.cache_write_tokens;
    const reasoning = u?.output_tokens_details?.reasoning_tokens;
    if (!integer(input) || !integer(output) || !integer(total) || !integer(cached) || !integer(reasoning)
        || cached > input || reasoning > output || total !== input + output) return unknown('Missing or inconsistent provider usage.');
    const rate = input > PRICING.long_context_above_input_tokens ? PRICING.long_context_per_million : PRICING.per_million;
    // output_tokens already contains reasoning_tokens; never add reasoning a second time.
    const amount = (writeTokens: number) => ((input - cached - writeTokens) * rate.input + cached * rate.cached + writeTokens * rate.cache_write + output * rate.output) / 1e6;
    if (writes === undefined) return { status: 'bounded_missing_cache_write', usd: null, min_usd: amount(0), max_usd: amount(input - cached), reason: 'Provider omitted cache_write_tokens; preserve the full possible write-cost interval.' };
    if (!integer(writes) || cached + writes > input) return unknown('Cache write/read usage exceeds total input.');
    const usd = amount(writes);
    return { status: 'calculated', usd, min_usd: usd, max_usd: usd, reason: 'Actual provider tokens × pinned public standard rates; invoice/tax/account credits are separate.' };
}

export function safeError(error: unknown, secret = ''): Record<string, unknown> {
    const seen = new Set<unknown>();
    const visit = (value: unknown): unknown => {
        if (typeof value === 'string') return (secret ? value.split(secret).join('[REDACTED]') : value).replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]');
        if (value === null || typeof value !== 'object') return value;
        if (seen.has(value)) return '[circular]'; seen.add(value);
        const out: Record<string, unknown> = {}, source = value as Record<string, unknown>;
        for (const key of ['name', 'message', 'code', 'status', 'type', 'retryable', 'request_id', '_request_id', 'requestID', 'cause', 'error']) if (source[key] !== undefined) out[key] = visit(source[key]);
        return out;
    };
    return { error: visit(error) };
}
export function isQuotaOrRateLimit(error: unknown): boolean {
    const data = JSON.stringify(safeError(error));
    return /credit_balance_exhausted|insufficient_quota|"status":429/.test(data);
}
