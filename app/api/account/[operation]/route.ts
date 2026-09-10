import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { accountRpc, readAccountProfile, readAuditMembership } from '@/lib/accountRepository';
import { AccountError, validateEmail, validateExpectedVersion, validateNickname, validatePassword } from '@/lib/accountPolicy';
import { accountBody, accountFailure, accountRateLimit, accountResponse, authenticatedAccount, hasRecoveryPermission, reauthenticateAccount, siteOrigin } from '@/lib/accountServer';
import { RECOVERY_COOKIE } from '@/lib/accountRecovery';

// Login always returns the same public error; nickname-to-email resolution stays on the server.
async function login(request: Request, body: Record<string, unknown>) {
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
    if (!identifier || identifier.length > 254 || typeof body.password !== 'string' || !body.password || body.password.length > 128) {
        throw new AccountError('이메일 또는 닉네임과 비밀번호를 확인해 주세요.', 401);
    }
    await accountRateLimit(request, 'login-ip', undefined, 30);
    await accountRateLimit(request, 'login-identity', identifier);
    let email = identifier;
    if (!identifier.includes('@')) {
        validateNickname(identifier);
        const { data: profile, error } = await getSupabaseAdmin().from('common_profiles').select('id').ilike('nickname', identifier).maybeSingle();
        if (error) throw new AccountError('로그인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
        if (!profile) throw new AccountError('이메일 또는 닉네임과 비밀번호를 확인해 주세요.', 401);
        const { data, error: authError } = await getSupabaseAdmin().auth.admin.getUserById(profile.id);
        if (authError || !data.user?.email) throw new AccountError('이메일 또는 닉네임과 비밀번호를 확인해 주세요.', 401);
        email = data.user.email;
    } else email = validateEmail(email);
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password: body.password });
    if (error || !data.user) throw new AccountError('이메일 또는 닉네임과 비밀번호를 확인해 주세요. 이메일 인증도 확인해 주세요.', 401);
    const profile = await readAccountProfile(data.user.id);
    if (!profile || profile.account_status === 'locked' || !data.user.email_confirmed_at) {
        await client.auth.signOut({ scope: 'local' });
        throw new AccountError('통합 계정의 이메일 인증과 이용 상태를 확인해 주세요.', 403);
    }
    return accountResponse({ ok: true });
}

async function signup(request: Request, body: Record<string, unknown>) {
    const email = validateEmail(body.email);
    const nickname = validateNickname(body.nickname);
    const password = validatePassword(body.password);
    await accountRateLimit(request, 'signup', undefined, 5);
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.signUp({ email, password, options: {
        data: { nickname }, emailRedirectTo: `${siteOrigin(request)}/auth/callback`,
    } });
    if (error) throw new AccountError('가입하지 못했습니다. 닉네임 중복 또는 이미 가입한 계정인지 확인해 주세요.');
    return accountResponse({ ok: true, msg: data.session ? 'SUCCESS' : 'CHECK_EMAIL' });
}

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
    try {
        const { operation } = await context.params;
        if (!['login', 'signup', 'logout', 'recovery', 'email', 'password', 'service'].includes(operation)) {
            throw new AccountError('지원하지 않는 계정 요청입니다.', 404);
        }
        const body = await accountBody(request);
        if (operation === 'login') return await login(request, body);
        if (operation === 'signup') return await signup(request, body);
        if (operation === 'logout') {
            const client = await getSupabaseServerClient();
            const { error } = await client.auth.signOut({ scope: 'local' });
            if (error && error.name !== 'AuthSessionMissingError') throw new AccountError('로그아웃을 완료하지 못했습니다.', 503);
            (await cookies()).delete(RECOVERY_COOKIE);
            return accountResponse({ ok: true });
        }
        if (operation === 'recovery') {
            const email = validateEmail(body.email);
            await accountRateLimit(request, 'recovery-ip', undefined, 10);
            await accountRateLimit(request, 'recovery-email', email, 3);
            const client = await getSupabaseServerClient();
            // Never reveal whether the email belongs to an account.
            const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${siteOrigin(request)}/auth/callback` });
            if (error) throw new AccountError('재설정 메일을 요청하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
            return accountResponse({ ok: true, message: '가입된 이메일이면 비밀번호 재설정 안내를 보냈습니다. 메일을 요청한 브라우저에서 링크를 열어 주세요.' });
        }
        const { user, client, profile } = await authenticatedAccount(operation === 'password' && body.recovery === true);
        if (profile.account_status === 'locked') throw new AccountError('계정 잠금 상태를 확인해 주세요.', 403);
        await accountRateLimit(request, operation, user.id);
        if (operation === 'email') {
            const email = validateEmail(body.email);
            await reauthenticateAccount(user.id, user.email, body.currentPassword);
            const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: `${siteOrigin(request)}/auth/callback` });
            if (error) throw new AccountError('이메일 변경 요청을 완료하지 못했습니다. 주소를 확인해 주세요.');
            return accountResponse({ ok: true, message: '이메일 변경 확인 메일을 보냈습니다. 확인을 마치면 두 서비스에 적용됩니다.' });
        }
        if (operation === 'password') {
            const password = validatePassword(body.password);
            if (body.recovery === true) {
                if (!await hasRecoveryPermission(user.id, client)) throw new AccountError('재설정 링크가 만료되었습니다. 새 안내 메일을 요청해 주세요.', 403);
            } else await reauthenticateAccount(user.id, user.email, body.currentPassword);
            const { error } = await client.auth.updateUser({ password });
            if (error) throw new AccountError('비밀번호를 변경하지 못했습니다. 다른 비밀번호로 다시 시도해 주세요.');
            (await cookies()).delete(RECOVERY_COOKIE);
            await client.auth.signOut({ scope: 'others' });
            return accountResponse({ ok: true, message: '공통 비밀번호를 변경하고 다른 로그인 세션을 종료했습니다.' });
        }
        if (operation === 'service') {
            if (body.action === 'join') {
                await accountRpc('common_join_service', { p_user_id: user.id, p_service: 'cpa' });
                return accountResponse({ ok: true, message: '감사 서비스 이용을 시작했습니다.' });
            }
            if (body.action !== 'withdraw' || body.confirmation !== '감사 서비스 탈퇴') throw new AccountError('탈퇴 확인 문구를 정확히 입력해 주세요.');
            const version = validateExpectedVersion(body.membershipVersion);
            const member = await readAuditMembership(user.id);
            if (!member || member.membership_version !== version) throw new AccountError('가입 상태가 변경되었습니다. 새로고침한 뒤 다시 시도해 주세요.', 409);
            await reauthenticateAccount(user.id, user.email, body.currentPassword);
            const result = await accountRpc<{ cleanup_pending?: boolean; status?: string }>('common_withdraw_service', {
                p_user_id: user.id, p_service: 'cpa', p_expected_version: version,
            });
            return accountResponse({ ok: true, cleanupPending: result.cleanup_pending === true,
                message: result.cleanup_pending ? '탈퇴 후처리 중입니다. 잠시 후 상태를 확인해 주세요.' : '감사 서비스의 학습 기록과 이용권을 종료했습니다. 통합 계정과 세법 서비스는 유지됩니다.' });
        }
        throw new AccountError('지원하지 않는 계정 요청입니다.', 404);
    } catch (error) { return accountFailure(error); }
}
