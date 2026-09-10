import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import * as policy from '../lib/accountPolicy.ts';
import * as recovery from '../lib/accountRecovery.ts';

const ORIGIN = 'https://audit.example.test';
const MEMBER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const AUTH_EMAIL = 'current-auth@example.test';
const STALE_EMAIL = 'stale-profile@example.test';
const PROVIDER_SECRET = 'private-provider-service-role-secret';
const ACCESS_TOKEN = 'verified-current-session-token';
const SIGNING_KEY = 'route-test-signing-key-with-at-least-thirty-two-bytes';
const CURRENT_PASSWORD = 'current-password';

type Call = { operation: string; args?: unknown };
type Options = {
    unauthenticated?: boolean;
    anonymous?: boolean;
    unverified?: boolean;
    authError?: boolean;
    accountStatus?: 'active' | 'locked' | 'deleting';
    missingProfile?: boolean;
    missingNickname?: boolean;
    nicknameAuthError?: boolean;
    loginError?: boolean;
    verifierId?: string;
    verifierError?: boolean;
    tableError?: string;
    rpcError?: string;
    updateError?: boolean;
    deleteError?: boolean;
    readyForDeletion?: boolean | 'missing';
    recoveryGrant?: string;
    membershipStatus?: 'active' | 'suspended' | 'withdrawing' | 'withdrawn' | 'missing';
    membershipVersion?: number;
};

const compiledModules = new Map<string, string>();
function source(path: string): string {
    if (!compiledModules.has(path)) {
        compiledModules.set(path, ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText);
    }
    return compiledModules.get(path)!;
}

function harness(options: Options = {}) {
    const calls: Call[] = [];
    const record = (operation: string, args?: unknown) => calls.push({ operation,
        ...(args === undefined ? {} : { args: JSON.parse(JSON.stringify(args)) }) });
    const authUser = { id: MEMBER, email: AUTH_EMAIL, is_anonymous: !!options.anonymous, email_confirmed_at: options.unverified ? undefined : '2026-01-01T00:00:00Z' };
    const providerError = { code: 'provider_failure', message: PROVIDER_SECRET };
    const cookieJar = new Map<string, string>();
    if (options.recoveryGrant) cookieJar.set(recovery.RECOVERY_COOKIE, options.recoveryGrant);

    const client = { auth: {
        async getUser() { record('session.getUser'); return { data: { user: options.unauthenticated ? null : authUser }, error: options.authError ? providerError : null }; },
        async getSession() { record('session.getSession'); return { data: { session: { access_token: ACCESS_TOKEN, user: authUser } } }; },
        async signInWithPassword(args: unknown) { record('session.signInWithPassword', args); return { data: { user: options.loginError ? null : authUser, session: options.loginError ? null : {} }, error: options.loginError ? providerError : null }; },
        async signOut(args: unknown) { record('session.signOut', args); return { error: null }; },
        async updateUser(args: unknown) { record('session.updateUser', args); return { error: options.updateError ? providerError : null }; },
        async signUp(args: unknown) { record('session.signUp', args); return { data: { session: null }, error: null }; },
        async resetPasswordForEmail(email: string, args: unknown) { record('session.resetPasswordForEmail', { email, args }); return { error: null }; },
    } };

    const admin = {
        from(table: string) {
            record('db.from', table);
            let nicknameLookup = false;
            let selectedId = MEMBER;
            const query = {
                select(columns: string) { record('db.select', { table, columns }); return query; },
                eq(column: string, value: string) { record('db.eq', { table, column, value }); if (column === 'id') selectedId = value; return query; },
                ilike(column: string, value: string) { record('db.ilike', { table, column, value }); nicknameLookup = true; return query; },
                async maybeSingle() {
                    if (table === options.tableError) return { data: null, error: providerError };
                    if (table === 'common_profiles') return { error: null, data: nicknameLookup
                        ? options.missingNickname ? null : { id: MEMBER, email: STALE_EMAIL }
                        : options.missingProfile ? null : { id: selectedId, nickname: 'StudyUser', account_status: options.accountStatus ?? 'active' } };
                    if (table === 'cpa_users') return { error: null, data: options.membershipStatus === 'missing' ? null : {
                        id: selectedId, membership_status: options.membershipStatus ?? 'active', membership_version: options.membershipVersion ?? 7,
                        is_service_admin: false, role: 'PRO', level: 4, exp: 300,
                    } };
                    throw new Error(`Unexpected table: ${table}`);
                },
            };
            return query;
        },
        async rpc(name: string, args: unknown) {
            record('db.rpc', { name, args });
            if (name === options.rpcError) return { data: null, error: providerError };
            if (name === 'consume_rate_limit') return { data: true, error: null };
            if (name === 'common_prepare_account_deletion') return { data: options.readyForDeletion === 'missing' ? {} : { ready_for_auth_delete: options.readyForDeletion ?? false }, error: null };
            if (name === 'common_withdraw_service') return { data: { status: 'withdrawn', cleanup_pending: false }, error: null };
            if (name === 'common_join_service' || name === 'common_update_nickname') return { data: {}, error: null };
            throw new Error(`Unexpected RPC: ${name}`);
        },
        auth: { admin: {
            async getUserById(id: string) { record('admin.getUserById', id); return { data: { user: options.nicknameAuthError ? null : authUser }, error: options.nicknameAuthError ? providerError : null }; },
            async deleteUser(id: string) { record('admin.deleteUser', id); return { error: options.deleteError ? providerError : null }; },
        } },
    };
    const deps: Record<string, unknown> = {
        'server-only': {}, 'node:crypto': crypto,
        './accountPolicy': policy, '@/lib/accountPolicy': policy,
        './accountRecovery': recovery, '@/lib/accountRecovery': recovery,
        './supabaseAdmin': { getSupabaseAdmin: () => admin }, '@/lib/supabaseAdmin': { getSupabaseAdmin: () => admin },
        './supabaseServer': { getSupabaseServerClient: async () => client }, '@/lib/supabaseServer': { getSupabaseServerClient: async () => client },
        'next/headers': { cookies: async () => ({
            get(name: string) { record('cookies.get', name); const value = cookieJar.get(name); return value ? { value } : undefined; },
            delete(name: string) { record('cookies.delete', name); cookieJar.delete(name); },
        }) },
        '@supabase/supabase-js': { createClient: (...args: unknown[]) => {
            record('verifier.createClient', args);
            return { auth: {
                async signInWithPassword(credentials: unknown) { record('verifier.signInWithPassword', credentials); return { data: { user: { id: options.verifierId ?? MEMBER }, session: {} }, error: options.verifierError ? providerError : null }; },
                async signOut(args: unknown) { record('verifier.signOut', args); return { error: null }; },
            } };
        } },
    };
    function load<T>(path: string): T {
        const exports = {};
        vm.runInNewContext(source(path), {
            exports, URL, Request, Response, Date,
            process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
                NEXT_PUBLIC_SITE_URL: ORIGIN, CPA_SUBMISSION_SIGNING_KEY: SIGNING_KEY, DANGEROUSLY_BYPASS_AUTH_FOR_TESTS: 'true' } },
            console: { error: (...args: unknown[]) => record('console.error', args) },
            fetch: () => { throw new Error('Account route tests must not access the network'); },
            require(name: string) { if (Object.hasOwn(deps, name)) return deps[name]; throw new Error(`Unexpected dependency: ${name}`); },
        });
        return exports as T;
    }
    const repository = load('../lib/accountRepository.ts');
    deps['./accountRepository'] = repository;
    deps['@/lib/accountRepository'] = repository;
    deps['@/lib/accountServer'] = load('../lib/accountServer.ts');
    const account = load<{ GET: () => Promise<Response>; PATCH: (request: Request) => Promise<Response>; DELETE: (request: Request) => Promise<Response> }>('../app/api/account/route.ts');
    const operations = load<{ POST: (request: Request, context: { params: Promise<{ operation: string }> }) => Promise<Response> }>('../app/api/account/[operation]/route.ts');
    return { calls, cookieJar, account,
        post(operation: string, body: unknown, origin: string | null = ORIGIN, extraHeaders: Record<string, string> = {}) {
            return operations.POST(mutation('POST', body, origin, extraHeaders, operation), { params: Promise.resolve({ operation }) });
        },
    };
}

function mutation(method: string, body: unknown, origin: string | null = ORIGIN, extraHeaders: Record<string, string> = {}, operation = '') {
    return new Request(`${ORIGIN}/api/account${operation ? `/${operation}` : ''}`, { method,
        headers: { ...(origin !== null ? { origin } : {}), 'content-type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) });
}
function rpcCalls(calls: Call[]) {
    return calls.filter(call => call.operation === 'db.rpc').map(call => call.args as { name: string; args: Record<string, unknown> });
}
function businessMutations(calls: Call[]) {
    return calls.filter(call => call.operation === 'session.updateUser' || call.operation === 'admin.deleteUser'
        || (call.operation === 'db.rpc' && (call.args as { name: string }).name !== 'consume_rate_limit'));
}
const withdrawal = { action: 'withdraw', confirmation: '감사 서비스 탈퇴', membershipVersion: 7, currentPassword: CURRENT_PASSWORD };
const deletion = { confirmation: '통합 계정 삭제', currentPassword: CURRENT_PASSWORD };

test('all account mutations reject cross-site requests before identity checks or database access', async () => {
    for (const origin of [null, 'null', 'https://attacker.example.test']) {
        const app = harness();
        const responses = [await app.account.PATCH(mutation('PATCH', { nickname: 'NewName' }, origin)),
            await app.account.DELETE(mutation('DELETE', deletion, origin))];
        for (const operation of ['login', 'signup', 'logout', 'recovery', 'email', 'password', 'service']) {
            responses.push(await app.post(operation, withdrawal, origin));
        }
        for (const response of responses) assert.equal(response.status, 403);
        assert.equal(app.calls.length, 0);
    }
    for (const fetchSite of ['cross-site', 'none']) {
        const app = harness();
        assert.equal((await app.post('service', withdrawal, ORIGIN, { 'sec-fetch-site': fetchSite })).status, 403);
        assert.equal(app.calls.length, 0);
    }
});

test('account mutations validate request shape and size before touching authenticated state', async () => {
    const invalidRequests = [mutation('PATCH', []), mutation('PATCH', null), mutation('PATCH', { nickname: 'NewName' }, ORIGIN, { 'content-type': 'text/plain' }),
        mutation('PATCH', { padding: 'a'.repeat(8193) }), mutation('PATCH', { nickname: 'NewName' }, ORIGIN, { 'content-length': '9000' }),
        new Request(`${ORIGIN}/api/account`, { method: 'PATCH', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{broken' })];
    for (const request of invalidRequests) {
        const app = harness();
        assert.ok([400, 413].includes((await app.account.PATCH(request)).status));
        assert.equal(app.calls.length, 0);
    }
});

test('verified nonanonymous Auth identity is required even when test bypass is set', async () => {
    for (const options of [{ unauthenticated: true }, { anonymous: true }, { authError: true }]) {
        const app = harness(options);
        const responses = [await app.account.GET(), await app.account.PATCH(mutation('PATCH', { nickname: 'NewName' })),
            await app.post('service', withdrawal), await app.account.DELETE(mutation('DELETE', deletion))];
        for (const response of responses) assert.equal(response.status, 401);
        assert.equal(app.calls.filter(call => call.operation === 'session.getUser').length, 4);
        assert.equal(app.calls.filter(call => call.operation === 'db.from').length, 0);
        assert.equal(businessMutations(app.calls).length, 0);
    }
});

test('password reauthentication must prove the same UUID before every sensitive mutation', async () => {
    for (const failure of [{ verifierId: OTHER }, { verifierError: true }]) {
        for (const operation of ['email', 'password', 'service', 'delete']) {
            const app = harness({ ...failure, readyForDeletion: true });
            const response = operation === 'delete'
                ? await app.account.DELETE(mutation('DELETE', deletion))
                : await app.post(operation, operation === 'service' ? withdrawal : { email: 'new@example.test', password: 'new-password', currentPassword: CURRENT_PASSWORD, userId: OTHER });
            assert.equal(response.status, 403);
            assert.equal(businessMutations(app.calls).length, 0);
            assert.deepEqual(app.calls.find(call => call.operation === 'verifier.signInWithPassword')?.args, { email: AUTH_EMAIL, password: CURRENT_PASSWORD });
            assert.deepEqual(app.calls.find(call => call.operation === 'verifier.signOut')?.args, { scope: 'local' });
            const verifierOptions = (app.calls.find(call => call.operation === 'verifier.createClient')?.args as unknown[])[2];
            assert.deepEqual(verifierOptions, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
            assert.equal(app.calls.filter(call => call.operation === 'session.signInWithPassword').length, 0);
        }
    }
});

test('nickname login resolves current Auth email privately and never enrolls a missing or withdrawn audit membership', async () => {
    for (const membershipStatus of ['missing', 'withdrawn'] as const) {
        const app = harness({ membershipStatus });
        const response = await app.post('login', { identifier: 'StudyUser', password: CURRENT_PASSWORD });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
        assert.deepEqual(app.calls.find(call => call.operation === 'session.signInWithPassword')?.args, { email: AUTH_EMAIL, password: CURRENT_PASSWORD });
        assert.deepEqual(app.calls.find(call => call.operation === 'admin.getUserById')?.args, MEMBER);
        assert.ok(app.calls.some(call => call.operation === 'db.select' && JSON.stringify(call.args) === JSON.stringify({ table: 'common_profiles', columns: 'id' })));
        assert.equal(app.calls.filter(call => call.operation === 'db.from' && call.args === 'cpa_users').length, 0);
        assert.equal(businessMutations(app.calls).length, 0);
        const publicText = JSON.stringify(await (await app.post('login', { identifier: 'StudyUser', password: CURRENT_PASSWORD })).json());
        assert.ok(!publicText.includes(AUTH_EMAIL) && !publicText.includes(STALE_EMAIL));
    }
});

test('nickname-login failures never disclose resolved emails or provider errors', async () => {
    for (const options of [{ missingNickname: true }, { nicknameAuthError: true }, { loginError: true }, { tableError: 'common_profiles' }]) {
        const app = harness(options);
        const response = await app.post('login', { identifier: 'StudyUser', password: CURRENT_PASSWORD });
        assert.ok([401, 503].includes(response.status));
        const body = await response.text();
        for (const privateValue of [AUTH_EMAIL, STALE_EMAIL, PROVIDER_SECRET, MEMBER]) assert.ok(!body.includes(privateValue));
        assert.equal(businessMutations(app.calls).length, 0);
    }
});

test('audit withdrawal uses session UUID, exact confirmation and current membership epoch, ignoring injected service and user IDs', async () => {
    const app = harness();
    const response = await app.post('service', { ...withdrawal, userId: OTHER, user_id: OTHER, service: 'cta', p_service: 'cta' });
    assert.equal(response.status, 200);
    assert.deepEqual(rpcCalls(app.calls).find(call => call.name === 'common_withdraw_service')?.args,
        { p_user_id: MEMBER, p_service: 'cpa', p_expected_version: 7 });
    assert.ok(app.calls.some(call => call.operation === 'db.eq' && JSON.stringify(call.args) === JSON.stringify({ table: 'cpa_users', column: 'id', value: MEMBER })));
    assert.equal(app.calls.filter(call => call.operation === 'db.from' && String(call.args).startsWith('cta')).length, 0);
    for (const body of [{ ...withdrawal, confirmation: '통합 계정 삭제' }, { ...withdrawal, membershipVersion: 6 },
        { ...withdrawal, membershipVersion: 7.5 }, { ...withdrawal, membershipVersion: undefined }]) {
        const invalid = harness();
        assert.ok([400, 409].includes((await invalid.post('service', body)).status));
        assert.equal(businessMutations(invalid.calls).length, 0);
        assert.equal(invalid.calls.filter(call => call.operation === 'verifier.signInWithPassword').length, 0);
    }
});

test('global deletion does not delete Auth until cleanup explicitly returns ready=true', async () => {
    for (const readyForDeletion of [false, 'missing'] as const) {
        const app = harness({ readyForDeletion });
        const response = await app.account.DELETE(mutation('DELETE', { ...deletion, userId: OTHER }));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).cleanupPending, true);
        assert.deepEqual(rpcCalls(app.calls).find(call => call.name === 'common_prepare_account_deletion')?.args, { p_user_id: MEMBER });
        assert.equal(app.calls.filter(call => call.operation === 'admin.deleteUser').length, 0);
        assert.equal(app.calls.filter(call => call.operation === 'session.signOut').length, 0);
    }
    const app = harness({ readyForDeletion: true, accountStatus: 'deleting' });
    const response = await app.account.DELETE(mutation('DELETE', deletion));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).cleanupPending, false);
    assert.deepEqual(app.calls.find(call => call.operation === 'admin.deleteUser')?.args, MEMBER);
    assert.deepEqual(app.calls.find(call => call.operation === 'session.signOut')?.args, { scope: 'local' });
    assert.ok(app.calls.findIndex(call => call.operation === 'admin.deleteUser') > app.calls.findIndex(call => call.operation === 'db.rpc' && (call.args as { name: string }).name === 'common_prepare_account_deletion'));
});

test('global deletion rejects wrong confirmation and locked accounts before cleanup starts', async () => {
    for (const options of [{ accountStatus: 'locked' as const }, {}]) {
        const app = harness({ ...options, readyForDeletion: true });
        const response = await app.account.DELETE(mutation('DELETE', options.accountStatus ? deletion : { ...deletion, confirmation: '감사 서비스 탈퇴' }));
        assert.ok([400, 403].includes(response.status));
        assert.equal(businessMutations(app.calls).length, 0);
    }
});

test('password recovery only bypasses password reauth with a signed grant bound to verified UUID and current token', async () => {
    const validGrant = recovery.issueRecoveryGrant(MEMBER, ACCESS_TOKEN, SIGNING_KEY);
    for (const grant of [undefined, 'unsigned-user-request', recovery.issueRecoveryGrant(OTHER, ACCESS_TOKEN, SIGNING_KEY),
        recovery.issueRecoveryGrant(MEMBER, 'another-session-token', SIGNING_KEY), `${validGrant.slice(0, -2)}zz`]) {
        const app = harness({ recoveryGrant: grant });
        const response = await app.post('password', { password: 'replacement-password', recovery: true, userId: MEMBER });
        assert.equal(response.status, 403);
        assert.equal(businessMutations(app.calls).length, 0);
        assert.equal(app.calls.filter(call => call.operation === 'verifier.signInWithPassword').length, 0);
    }
    const app = harness({ recoveryGrant: validGrant });
    const response = await app.post('password', { password: 'replacement-password', recovery: true });
    assert.equal(response.status, 200);
    assert.deepEqual(app.calls.find(call => call.operation === 'session.updateUser')?.args, { password: 'replacement-password' });
    assert.equal(app.cookieJar.has(recovery.RECOVERY_COOKIE), false);
    assert.deepEqual(app.calls.find(call => call.operation === 'session.signOut')?.args, { scope: 'others' });
    assert.equal(app.calls.filter(call => call.operation === 'verifier.signInWithPassword').length, 0);
});

test('account snapshot never creates missing memberships or grants inactive members paid access and progress', async () => {
    for (const membershipStatus of ['missing', 'withdrawn', 'suspended', 'withdrawing'] as const) {
        const app = harness({ membershipStatus });
        const response = await app.account.GET();
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.entitlement, { kind: 'free', expiresAt: null });
        assert.deepEqual(body.progress, { level: 1, exp: 0 });
        assert.equal(body.recoveryAllowed, false);
        assert.equal(body.membership?.status ?? null, membershipStatus === 'missing' ? null : membershipStatus);
        assert.equal(businessMutations(app.calls).length, 0);
        assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
        assert.equal(response.headers.get('vary'), 'Cookie');
    }
});

test('unverified users cannot manage accounts and global restrictions remove displayed entitlement', async () => {
    const unverified = harness({ unverified: true });
    assert.equal((await unverified.account.GET()).status, 401);
    assert.equal((await unverified.post('service', { action: 'join' })).status, 401);
    assert.equal(businessMutations(unverified.calls).length, 0);
    for (const accountStatus of ['locked', 'deleting'] as const) {
        const response = await harness({ accountStatus }).account.GET();
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.entitlement.kind, 'free');
        assert.deepEqual(body.progress, { level: 1, exp: 0 });
    }
});

test('verified recovery can finish a deleting account but cannot unlock a locked account', async () => {
    const grant = recovery.issueRecoveryGrant(MEMBER, ACCESS_TOKEN, SIGNING_KEY);
    const deleting = harness({ accountStatus: 'deleting', recoveryGrant: grant });
    assert.equal((await deleting.post('password', { password: 'replacement-password', recovery: true })).status, 200);
    assert.equal(deleting.calls.filter(call => call.operation === 'session.updateUser').length, 1);
    const locked = harness({ accountStatus: 'locked', recoveryGrant: grant });
    assert.equal((await locked.post('password', { password: 'replacement-password', recovery: true })).status, 403);
    assert.equal(locked.calls.filter(call => call.operation === 'session.updateUser').length, 0);
});

test('database, credential provider, and deletion failures return fixed safe errors instead of private details', async () => {
    const responses = [await harness({ tableError: 'common_profiles' }).account.GET(),
        await harness({ tableError: 'cpa_users' }).account.GET(),
        await harness({ rpcError: 'common_update_nickname' }).account.PATCH(mutation('PATCH', { nickname: 'NewName' })),
        await harness({ rpcError: 'consume_rate_limit' }).post('password', { password: 'replacement-password', currentPassword: CURRENT_PASSWORD }),
        await harness({ updateError: true }).post('email', { email: 'new@example.test', currentPassword: CURRENT_PASSWORD }),
        await harness({ updateError: true }).post('password', { password: 'replacement-password', currentPassword: CURRENT_PASSWORD }),
        await harness({ deleteError: true, readyForDeletion: true }).account.DELETE(mutation('DELETE', deletion))];
    for (const response of responses) {
        assert.ok(response.status >= 400);
        const body = await response.text();
        assert.ok(!body.includes(PROVIDER_SECRET));
        assert.ok(!body.includes('provider_failure'));
        assert.ok(!body.includes(AUTH_EMAIL));
    }
});
