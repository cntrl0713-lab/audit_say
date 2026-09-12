import OpenAI from 'openai';
import { AsyncLocalStorage } from 'node:async_hooks';
import type {
    Response,
    ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';

export type OpenAIStructuredSchema = Record<string, unknown>;

export type OpenAIRequestFailureCode =
    | 'configuration'
    | 'refusal'
    | 'incomplete'
    | 'empty'
    | 'invalid_json'
    | 'transport';

export class OpenAIRequestError extends Error {
    readonly code: OpenAIRequestFailureCode;
    readonly status?: number;
    readonly retryable: boolean;

    constructor(
        code: OpenAIRequestFailureCode,
        message: string,
        options: { status?: number; retryable?: boolean; cause?: unknown } = {},
    ) {
        super(message, { cause: options.cause });
        this.name = 'OpenAIRequestError';
        this.code = code;
        this.status = options.status;
        this.retryable = options.retryable ?? false;
    }
}

export interface OpenAIStructuredRequest {
    apiKey: string;
    model: string;
    name: string;
    instructions?: string;
    input: string;
    schema: OpenAIStructuredSchema;
    maxOutputTokens?: number;
    timeoutMs?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    onUsage?: OpenAIUsageObserver;
}

/** Provider accounting metadata, never a token estimate or a grading verdict. */
export interface OpenAIUsageEvent {
    request_name: string;
    requested_model: string;
    attempt: number;
    response_id: string | null;
    request_id: string | null;
    response_model: string | null;
    service_tier: Response['service_tier'] | null;
    response_status: Response['status'];
    usage: Response['usage'] | null;
}

export type OpenAIUsageObserver = (event: OpenAIUsageEvent) => void | Promise<void>;
const usageObservers = new AsyncLocalStorage<OpenAIUsageObserver>();

/** Attach accounting to unchanged production callers; concurrent scopes stay isolated. */
export function withOpenAIUsageObserver<T>(observer: OpenAIUsageObserver, operation: () => T): T {
    return usageObservers.run(observer, operation);
}

async function notifyUsage(request: OpenAIStructuredRequest, response: Response, attempt: number): Promise<void> {
    const observers = new Set([usageObservers.getStore(), request.onUsage]);
    observers.delete(undefined);
    if (!observers.size) return;
    const event: OpenAIUsageEvent = {
        request_name: request.name,
        requested_model: request.model,
        attempt,
        response_id: response.id ?? null,
        request_id: (response as Response & { _request_id?: string })._request_id ?? null,
        response_model: response.model ?? null,
        service_tier: response.service_tier ?? null,
        response_status: response.status,
        usage: response.usage ?? null,
    };
    for (const observer of observers) {
        try { await observer!(structuredClone(event)); }
        catch (cause) {
            // An accounting/storage failure must also stop caller-owned protocol retries.
            throw new OpenAIRequestError('configuration', 'OpenAI 사용량 기록에 실패했습니다.', { cause });
        }
    }
}

export type OpenAIResponseCreator = (
    params: ResponseCreateParamsNonStreaming,
    options?: { timeout?: number },
) => Promise<Response>;

function responseFormat(name: string, schema: OpenAIStructuredSchema): NonNullable<ResponseCreateParamsNonStreaming['text']>['format'] {
    return {
        type: 'json_schema',
        name,
        schema,
        strict: true,
    };
}

function responseRefusal(response: Response): string | null {
    for (const item of response.output) {
        if (item.type !== 'message') continue;
        for (const content of item.content) {
            if (content.type === 'refusal') return content.refusal;
        }
    }
    return null;
}

function statusOf(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
}

function isRetryable(error: unknown): boolean {
    // The SDK wraps fetch/socket failures in APIConnectionError with the generic
    // message "Connection error.". Classify it by type, not its underlying text.
    if (error instanceof OpenAI.APIUserAbortError) return false;
    const status = statusOf(error);
    if (status !== undefined) return status === 408 || status === 409 || status === 429 || status >= 500 && status < 600;
    if (error instanceof OpenAI.APIConnectionError) return true;
    if (error instanceof Error && /timeout|timed out|fetch failed|network/i.test(error.message)) return true;
    return false;
}

function parseStructuredJson(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) {
        throw new OpenAIRequestError('empty', 'OpenAI 응답에 구조화된 출력이 없습니다.');
    }
    try {
        return JSON.parse(trimmed);
    } catch (cause) {
        throw new OpenAIRequestError('invalid_json', 'OpenAI 응답이 유효한 JSON이 아닙니다.', { cause });
    }
}

function defaultCreator(apiKey: string): OpenAIResponseCreator {
    const client = new OpenAI({ apiKey, maxRetries: 0 });
    return (params, options) => client.responses.create(params, options);
}

export async function requestOpenAIStructured<T = unknown>(
    request: OpenAIStructuredRequest,
    createResponse?: OpenAIResponseCreator,
): Promise<T> {
    if (!request.apiKey.trim()) {
        throw new OpenAIRequestError('configuration', 'OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    if (!request.model.trim()) {
        throw new OpenAIRequestError('configuration', 'OpenAI 모델이 설정되지 않았습니다.');
    }

    const maxAttempts = Math.max(1, Math.min(request.maxAttempts ?? 3, 3));
    const timeoutMs = request.timeoutMs ?? 45_000;
    const retryDelayMs = request.retryDelayMs ?? 750;
    const create = createResponse ?? defaultCreator(request.apiKey);
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        let response: Response | undefined;
        try {
            response = await create({
                model: request.model,
                instructions: request.instructions,
                input: request.input,
                store: false,
                max_output_tokens: request.maxOutputTokens,
                text: { format: responseFormat(request.name, request.schema), verbosity: 'low' },
            }, { timeout: timeoutMs });
        } catch (error) {
            lastError = error;
        }
        if (response) {
            // Record even a refusal, truncation or invalid JSON response. This observer
            // is outside both request/parse retry boundaries and gets an isolated copy.
            await notifyUsage(request, response, attempt);
            try {
                const refusal = responseRefusal(response);
                if (refusal) {
                    throw new OpenAIRequestError('refusal', `OpenAI가 요청을 거절했습니다: ${refusal}`);
                }
                if (response.status !== 'completed') {
                    const reason = response.incomplete_details?.reason;
                    throw new OpenAIRequestError(
                        'incomplete',
                        `OpenAI 응답이 완료되지 않았습니다 (${response.status}${reason ? `: ${reason}` : ''}).`,
                        { retryable: response.status === 'queued' || response.status === 'in_progress' },
                    );
                }
                return parseStructuredJson(response.output_text) as T;
            } catch (error) {
                lastError = error;
            }
        }
        const retryable = lastError instanceof OpenAIRequestError ? lastError.retryable : isRetryable(lastError);
        if (attempt >= maxAttempts || !retryable) break;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }

    if (lastError instanceof OpenAIRequestError) throw lastError;
    throw new OpenAIRequestError(
        'transport',
        'OpenAI API 요청에 실패했습니다.',
        { status: statusOf(lastError), retryable: isRetryable(lastError), cause: lastError },
    );
}
