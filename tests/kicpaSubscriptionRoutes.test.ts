import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as subscription from '../lib/kicpa/subscription.ts';

const ORIGIN = 'https://audit.example.test';
const MEMBER = 'member-a';
const CONSENTED_AT = '2026-01-01T00:00:00Z';
type DbCall = { table: string; method: string; value?: unknown };
type Options = { anonymous?: boolean; unauthenticated?: boolean; authError?: boolean; profileRole?: string;
    missingProfile?: boolean; databaseError?: boolean; row?: Record<string, unknown> | null; accountStatus?: string; membershipStatus?: string };

function harness(options: Options = {}) {
    const calls: DbCall[] = [];
    let verifiedUsers = 0;
    let row = options.row ?? null;
    const admin = {
        from(table: string) {
            const query = {
                select(value: string) { calls.push({ table, method: 'select', value }); return query; },
                eq(column: string, value: unknown) { calls.push({ table, method: 'eq', value: { column, value } }); return query; },
                upsert(value: Record<string, unknown>) { calls.push({ table, method: 'upsert', value }); row = { ...row, ...value }; return query; },
                delete() { calls.push({ table, method: 'delete' }); row = null; return query; },
                async maybeSingle() { return { error: options.databaseError ? { message: 'private-database-+821012345678' } : null,
                    data: table === 'common_profiles' ? { account_status: options.accountStatus ?? 'active' }
                        : table === 'cpa_users' ? options.missingProfile ? null : { id: MEMBER, role: options.profileRole ?? 'MEMBER', membership_status: options.membershipStatus ?? 'active', membership_version: 1 } : row }; },
                async single() { return { error: null, data: row }; },
                then(resolve: (value: { error: null }) => unknown) { return Promise.resolve({ error: null }).then(resolve); },
            };
            return query;
        },
    };
    const deps: Record<string, unknown> = {
        'server-only': {}, '@/lib/kicpa/subscription': subscription, './subscription': subscription,
        '@/lib/supabaseServer': { getSupabaseServerClient: async () => ({ auth: { getUser: async () => {
            verifiedUsers += 1;
            return { data: { user: options.unauthenticated ? null : { id: MEMBER, is_anonymous: Boolean(options.anonymous) } }, error: options.authError ? {} : null };
        } } }) },
        '@/lib/supabaseAdmin': { getSupabaseAdmin: () => admin },
    };
    function load<T>(path: string): T {
        const compiled = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const exports = {};
        vm.runInNewContext(compiled, {
            exports, URL, Request, Response, Date, process: { env: { DANGEROUSLY_BYPASS_AUTH_FOR_TESTS: 'true' } },
            fetch: () => { throw new Error('Subscription settings must never contact a messaging provider'); },
            require(name: string) {
                if (Object.hasOwn(deps, name)) return deps[name];
                throw new Error(`Unexpected dependency: ${name}`);
            },
        });
        return exports as T;
    }
    deps['@/lib/kicpa/subscriptionServer'] = load('../lib/kicpa/subscriptionServer.ts');
    return { calls, get verifiedUsers() { return verifiedUsers; }, get row() { return row; },
        route: load<{ GET: () => Promise<Response>; PATCH: (request: Request) => Promise<Response>; DELETE: (request: Request) => Promise<Response> }>('../app/api/jobs/subscription/route.ts'),
    };
}

function mutation(method: string, body?: unknown, origin: string | null = ORIGIN, contentType = 'application/json') {
    return new Request(`${ORIGIN}/api/jobs/subscription`, { method,
        headers: { ...(origin !== null ? { origin } : {}), 'content-type': contentType },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

const currentRow = { is_active: true, boards: ['trainee_cpa'], consent_version: subscription.JOBS_CONSENT_VERSION,
    consented_at: CONSENTED_AT, phone_e164: '+821012345678', phone_verified_at: CONSENTED_AT };

test('GET/PATCH/DELETE require a verified nonanonymous member even when test bypass is set', async () => {
    for (const options of [{ anonymous: true }, { unauthenticated: true }, { authError: true }, { profileRole: 'GUEST' }, { missingProfile: true },
        { accountStatus: 'locked' }, { accountStatus: 'deleting' }, { membershipStatus: 'withdrawn' }, { membershipStatus: 'suspended' }]) {
        const app = harness(options);
        const responses = [await app.route.GET(), await app.route.PATCH(mutation('PATCH', { active: true, boards: ['cpa'], consent: true })),
            await app.route.DELETE(mutation('DELETE'))];
        for (const response of responses) assert.equal(response.status, 401);
        assert.equal(app.verifiedUsers, 3);
        assert.equal(app.calls.filter((call) => call.table === 'cpa_kicpa_jobs_subscribers').length, 0);
    }
});

test('mutation routes reject CSRF before checking identity or accessing subscriber data', async () => {
    const app = harness();
    for (const origin of [null, 'null', 'https://evil.example.test']) {
        assert.equal((await app.route.PATCH(mutation('PATCH', { active: true, boards: ['cpa'], consent: true }, origin))).status, 403);
        assert.equal((await app.route.DELETE(mutation('DELETE', undefined, origin))).status, 403);
    }
    assert.equal(app.verifiedUsers, 0);
    assert.equal(app.calls.length, 0);
});

test('GET never selects or returns phone fields and always scopes to the verified member', async () => {
    const app = harness({ row: currentRow });
    const response = await app.route.GET();
    assert.deepEqual(await response.json(), { saved: true, active: true, boards: ['trainee_cpa'], consentRequired: false, deliveryStatus: 'preparing' });
    assert.equal(app.calls.find((call) => call.table === 'cpa_kicpa_jobs_subscribers' && call.method === 'select')?.value,
        'is_active,boards,consent_version,consented_at');
    assert.ok(app.calls.some((call) => call.table === 'cpa_kicpa_jobs_subscribers' && JSON.stringify(call.value) === JSON.stringify({ column: 'user_id', value: MEMBER })));
    assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
    assert.equal(response.headers.get('vary'), 'Cookie');
});

test('GET missing subscription returns disabled defaults, not an active or deliverable subscription', async () => {
    const response = await harness().route.GET();
    assert.deepEqual(await response.json(), { saved: false, active: false, boards: ['trainee_cpa', 'cpa'], consentRequired: true, deliveryStatus: 'preparing' });
});

test('PATCH blocks first/outdated consent activation until explicitly agreed', async () => {
    for (const row of [null, { ...currentRow, consent_version: 'old-version' }]) {
        const app = harness({ row });
        const response = await app.route.PATCH(mutation('PATCH', { active: true, boards: ['cpa'], consent: false }));
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'consent_required' });
        assert.equal(app.calls.filter((call) => call.method === 'upsert').length, 0);
    }
});

test('PATCH stores explicit preferences/current consent but cannot collect or overwrite a phone', async () => {
    const app = harness({ row: { ...currentRow, is_active: false } });
    const response = await app.route.PATCH(mutation('PATCH', { active: true, boards: ['cpa'], consent: true }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { saved: true, active: true, boards: ['cpa'], consentRequired: false, deliveryStatus: 'preparing' });
    const patch = app.calls.find((call) => call.method === 'upsert')?.value as Record<string, unknown>;
    assert.equal(patch.user_id, MEMBER);
    assert.equal(patch.consent_version, subscription.JOBS_CONSENT_VERSION);
    assert.ok(Date.parse(String(patch.consented_at)) <= Date.now());
    assert.ok(patch.notifications_since);
    assert.equal(Object.hasOwn(patch, 'phone_e164'), false);
    assert.equal(Object.hasOwn(patch, 'phone_verified_at'), false);
    assert.equal(app.row?.phone_e164, currentRow.phone_e164);
});

test('PATCH validates content type, strict schema, board selection, body size and private-field injection', async () => {
    const bodies = [{ active: false, boards: [], consent: false }, { active: true, boards: ['cpa', 'cpa'], consent: true },
        { active: true, boards: ['cpa'], consent: true, user_id: 'member-b' },
        { active: true, boards: ['cpa'], consent: true, phone_e164: '+821012345678' },
        { active: true, boards: ['cpa'], consent: true, phone_verified_at: CONSENTED_AT },
        { active: true, boards: ['invalid'], consent: true }, { active: 'true', boards: ['cpa'], consent: true },
        { active: true, boards: ['cpa'], consent: true, extra: 'x'.repeat(2050) }];
    for (const body of bodies) {
        const app = harness();
        assert.equal((await app.route.PATCH(mutation('PATCH', body))).status, 400);
        assert.equal(app.calls.filter((call) => call.method === 'upsert').length, 0);
    }
    assert.equal((await harness().route.PATCH(mutation('PATCH', {}, ORIGIN, 'text/plain'))).status, 400);
    assert.equal((await harness().route.PATCH(new Request(`${ORIGIN}/api/jobs/subscription`, {
        method: 'PATCH', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{invalid-json',
    }))).status, 400);
});

test('DELETE removes only the current member subscription and returns safe inactive defaults', async () => {
    const app = harness({ row: currentRow });
    const response = await app.route.DELETE(mutation('DELETE'));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).active, false);
    const deletion = app.calls.findIndex((call) => call.method === 'delete');
    assert.ok(deletion >= 0);
    assert.equal(JSON.stringify(app.calls[deletion + 1].value), JSON.stringify({ column: 'user_id', value: MEMBER }));
});

test('database failures return a fixed error without exposing private database contents', async () => {
    const response = await harness({ databaseError: true }).route.GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'service_unavailable' });
});
