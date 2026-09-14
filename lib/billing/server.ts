import 'server-only';
import { AccountError, assertAccountOrigin, validateExpectedVersion } from '@/lib/accountPolicy';
import { authenticatedAccount } from '@/lib/accountServer';
import { requireAuditMembership } from '@/lib/accountRepository';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { readBillingText } from './http';

export async function authenticatedBilling() {
    const account = await authenticatedAccount();
    const membership = await requireAuditMembership(account.user.id);
    return { ...account, membership, admin: getSupabaseAdmin() };
}

export function billingResponse(value: unknown, options?: { status?: number }): Response {
    return Response.json(value, {
        status: options?.status ?? 200,
        headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' },
    });
}

export function billingFailure(error: unknown): Response {
    if (error instanceof AccountError) return billingResponse({ error: 'ACCOUNT_REQUIRED', message: error.message }, { status: error.status });
    console.error('[billing] request failed');
    return billingResponse({ error: 'BILLING_UNAVAILABLE', message: '결제 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
}

export async function billingBody(request: Request): Promise<Record<string, unknown>> {
    assertAccountOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccountError('올바르지 않은 요청입니다.');
    const raw = await readBillingText(request, 8192);
    try {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        return value as Record<string, unknown>;
    } catch { throw new AccountError('올바르지 않은 요청입니다.'); }
}

export function assertBillingVersion(value: unknown, current: number): void {
    if (validateExpectedVersion(value) !== current) throw new AccountError('서비스 가입 상태가 변경되었습니다. 요금제 화면에서 다시 시작해 주세요.', 409);
}
