import 'server-only';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from './supabaseAdmin';
import { getSupabaseServerClient } from './supabaseServer';
import { AccountError, assertAccountOrigin, auditRole, type AccountSnapshot } from './accountPolicy';
import { readAccountProfile, readAuditMembership } from './accountRepository';
import { RECOVERY_COOKIE, verifyRecoveryGrant } from './accountRecovery';

export function accountResponse(value: unknown, status = 200): Response {
    return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } });
}
export function accountFailure(error: unknown): Response {
    if (error instanceof AccountError) return accountResponse({ error: error.message }, error.status);
    console.error('[account] operation unavailable');
    return accountResponse({ error: '계정 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503);
}
export async function accountBody(request: Request): Promise<Record<string, unknown>> {
    assertAccountOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccountError('올바르지 않은 요청입니다.');
    if (Number(request.headers.get('content-length') ?? 0) > 8192) throw new AccountError('요청 내용이 너무 큽니다.', 413);
    const raw = await request.text();
    if (raw.length > 8192) throw new AccountError('요청 내용이 너무 큽니다.', 413);
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        return value;
    } catch { throw new AccountError('올바르지 않은 요청입니다.'); }
}
export async function accountRateLimit(request: Request, action: string, identity?: string, limit = 10): Promise<void> {
    // The host platform supplies this header; no identifier/password is stored in a quota key.
    const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || 'unknown';
    const bucket = createHash('sha256').update(identity?.toLowerCase() || ip).digest('hex');
    const { data, error } = await getSupabaseAdmin().rpc('consume_rate_limit', {
        p_key: `cpa:account:${action}:${bucket}`, p_limit: limit, p_window_seconds: 600,
    });
    if (error) throw new AccountError('계정 보호 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
    if (data !== true) throw new AccountError('요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429);
}
export async function authenticatedAccount(allowInactive = false) {
    const client = await getSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous || !user.email_confirmed_at) throw new AccountError('이메일 인증을 마친 회원 로그인이 필요합니다.', 401);
    const profile = await readAccountProfile(user.id);
    if (!profile) throw new AccountError('통합 계정 프로필을 준비하지 못했습니다. 다시 로그인해 주세요.', 409);
    if (!allowInactive && profile.account_status !== 'active') throw new AccountError('통합 계정이 잠겨 있거나 삭제 처리 중입니다.', 403);
    return { user, client, profile };
}
export async function reauthenticateAccount(userId: string, email: string | undefined, password: unknown) {
    if (!email || typeof password !== 'string' || !password || password.length > 128) throw new AccountError('현재 비밀번호를 입력해 주세요.');
    const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    try {
        if (error || data.user?.id !== userId) throw new AccountError('현재 비밀번호를 확인해 주세요.', 403);
    } finally { if (data.session) await verifier.auth.signOut({ scope: 'local' }); }
}
export function recoveryKey(): string { return process.env.CPA_SUBMISSION_SIGNING_KEY || process.env.CPA_QUESTION_V3_ENCRYPTION_KEY || ''; }
export async function hasRecoveryPermission(userId: string, client: Awaited<ReturnType<typeof getSupabaseServerClient>>): Promise<boolean> {
    // Identity was already verified by getUser. getSession is used only for the raw binding token.
    const { data: { session } } = await client.auth.getSession();
    return Boolean(session && verifyRecoveryGrant((await cookies()).get(RECOVERY_COOKIE)?.value, userId, session.access_token, recoveryKey()));
}
export async function accountSnapshot(): Promise<AccountSnapshot> {
    const { user, profile, client } = await authenticatedAccount(true);
    const member = await readAuditMembership(user.id);
    const active = profile.account_status === 'active' && member?.membership_status === 'active';
    return {
        user: { id: user.id, email: user.email ?? '', nickname: profile.nickname }, accountStatus: profile.account_status,
        membership: member ? { status: member.membership_status, version: member.membership_version, isAdmin: member.is_service_admin, role: auditRole(member) } : null,
        entitlement: { kind: active && member?.role === 'PRO' ? 'pro' : 'free', expiresAt: null },
        progress: active && member ? { level: member.level, exp: member.exp } : { level: 1, exp: 0 },
        recoveryAllowed: await hasRecoveryPermission(user.id, client),
    };
}
export function siteOrigin(request: Request): string {
    const configured = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
    if (configured) return new URL(configured).origin;
    if (process.env.NODE_ENV === 'production') return 'https://audit-say.vercel.app';
    return new URL(request.url).origin;
}
