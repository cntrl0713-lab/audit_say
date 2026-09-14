/** Browser-only billing requests: keep the provider's human-readable error. */
export class BillingRequestError extends Error {
    constructor(message: string, readonly status: number, readonly code: string | null) {
        super(message);
        this.name = 'BillingRequestError';
    }
}

export async function billingRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000),
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) {
        throw new BillingRequestError(
            typeof value?.message === 'string' ? value.message
                : typeof value?.error === 'string' ? value.error : '요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            response.status,
            typeof value?.code === 'string' ? value.code
                : typeof value?.message === 'string' && typeof value?.error === 'string' ? value.error : null,
        );
    }
    if (!value || typeof value !== 'object') throw new BillingRequestError('서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.', response.status, null);
    return value as T;
}

export function billingErrorMessage(error: unknown): string {
    return error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'AbortError'
        ? error.message : '응답을 기다리는 시간이 길어지고 있습니다. 결제 결과를 다시 확인해 주세요.';
}

export function formatBillingDate(value: string): string {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : '확인 중';
}

/** A different service membership must never reuse an old referral selection. */
export function referrerStorageKey(customerKey: string, membershipVersion: number): string {
    return `cpa.billing.referrer.${customerKey}.${membershipVersion}`;
}

export function safeReceiptUrl(value: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}
