import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import * as policy from '../lib/accountPolicy.ts';
import * as http from '../lib/billing/http.ts';
import * as plan from '../lib/billing/plan.ts';
import * as webhook from '../lib/billing/webhook.ts';
import * as referrals from '../lib/billing/referral.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const ORIGIN = 'https://audit.example.test';
const ORDER = 'cpa_existing_order';
const PERIOD_END = '2026-10-13T00:00:00Z';
const compiled = new Map<string, string>();
function load<T>(path: string, deps: Record<string, unknown>, fetcher?: typeof fetch): T {
    if (!compiled.has(path)) compiled.set(path, ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    const exports = {};
    vm.runInNewContext(compiled.get(path)!, {
        exports, Response, Request, Buffer, AbortSignal, TextDecoder, crypto,
        console: { log() {}, warn() {}, error() {} },
        process: { env: { CPA_TOSS_SECRET_KEY: 'test-cpa-secret', NEXT_PUBLIC_CPA_TOSS_CLIENT_KEY: 'test-public', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key' } },
        fetch: fetcher ?? (() => { throw new Error('Unexpected network request'); }),
        require(name: string) {
            if (Object.hasOwn(deps, name)) return deps[name];
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return exports as T;
}

type Route = { POST: (request: Request) => Promise<Response>; GET: () => Promise<Response> };
type Rpc = { name: string; args: Record<string, unknown> };
type Options = {
    inactive?: boolean; withdrawBeforeCharge?: boolean; resumed?: boolean; claimAction?: string;
    chargeFailure?: 'REJECT_CARD_COMPANY' | 'NETWORK_ERROR'; referralReadError?: boolean;
    actualPayment?: { paymentKey: string; orderId: string; status: string; totalAmount: number };
    paymentLog?: Record<string, unknown>; rateAllowed?: boolean;
    priorSuccess?: boolean; priorSuccessOrderId?: string; pendingReferral?: boolean;
    committedReferralId?: number | null; committedReferralStatus?: string; committedReadError?: boolean;
};

function harness(options: Options = {}) {
    const rpcs: Rpc[] = [];
    const external: string[] = [];
    const tables: string[] = [];
    let membershipReads = 0;
    let finalized = false;
    const member = { id: 'member-1', membership_status: 'active' as const, membership_version: 7, is_service_admin: false, role: 'MEMBER', level: 1, exp: 0 };
    const response = (data: unknown, error: unknown = null) => ({ data, error });
    const query = (value: { data: unknown; error: unknown } | (() => { data: unknown; error: unknown })) => {
        const result = () => typeof value === 'function' ? value() : value;
        return {
        select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; },
        insert() { return this; }, update() { return this; },
        maybeSingle: async () => result(), single: async () => result(),
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise.resolve(resolve(result())),
    }; };
    const admin = {
        from(table: string) {
            tables.push(table);
            if (table === 'cpa_referral') return query(response(finalized && options.committedReferralId
                ? { id: options.committedReferralId, status: options.committedReferralStatus ?? 'pending', referee_membership_version: 7 }
                : options.pendingReferral ? { id: 4, status: 'pending', referee_membership_version: 7 } : null,
                options.referralReadError ? { code: 'DB_ERROR' } : null));
            if (table === 'cpa_payment_log') {
                let columns = '';
                let excludedOrder: unknown;
                const base = query(() => {
                    if (columns === 'id') return response(options.priorSuccess && excludedOrder !== (options.priorSuccessOrderId ?? 'previous_order') ? { id: 99 } : null);
                    if (columns === 'status,referral_id') return response(finalized ? { status: 'success', referral_id: options.committedReferralId ?? null } : null,
                        options.committedReadError ? { code: 'DB_ERROR' } : null);
                    return response(options.paymentLog ?? null);
                });
                const paymentQuery = { ...base,
                    select(value: string) { columns = value; return paymentQuery; },
                    or(value: string) { excludedOrder = value.split('toss_order_id.neq.')[1]; return paymentQuery; },
                };
                return paymentQuery;
            }
            if (table === 'cpa_subscription') return query(response(null));
            throw new Error(`Unexpected table ${table}`);
        },
        rpc(name: string, args: Record<string, unknown>) {
            rpcs.push({ name, args });
            if (name === 'cpa_begin_subscription_setup') return query(response({ action: options.claimAction ?? (options.resumed ? 'resumed' : 'started'),
                subscription_id: 10, order_id: ORDER, claim_token: 'claim-1', billing_key: options.resumed ? 'saved-billing-key' : null }));
            if (name === 'cpa_finalize_subscription_setup') { finalized = true; return query(response(PERIOD_END)); }
            if (name === 'cpa_cancel_subscription_renewal') return query(response({ id: 10, billing_key: 'secret-key', current_period_end: PERIOD_END, reconciliation_pending: true }));
            if (name === 'consume_rate_limit') return query(response(options.rateAllowed ?? true));
            return query(response(true));
        },
    };
    const deps: Record<string, unknown> = {
        'server-only': {}, 'node:crypto': crypto, '@/lib/accountPolicy': policy, '../accountPolicy.ts': policy,
        './http': http, '@/lib/billing/http': http, '@/lib/billing/plan': plan, '@/lib/billing/webhook': webhook,
        '@/lib/supabaseAdmin': { getSupabaseAdmin: () => admin },
        '@/lib/accountServer': { accountRateLimit: async () => {}, authenticatedAccount: async () => {
            if (options.inactive) throw new policy.AccountError('계정 상태 오류', 403);
            return { user: { id: member.id, email: 'member@example.test' }, profile: { nickname: '회원01' } };
        } },
        '@/lib/accountRepository': { requireAuditMembership: async () => {
            membershipReads++;
            if (options.withdrawBeforeCharge && membershipReads > 1) throw new policy.AccountError('탈퇴한 회원', 403);
            return member;
        } },
        'next/server': { NextResponse: { json: Response.json.bind(Response) } },
        '@/lib/billing/referral': referrals,
    };
    const actualToss = load<typeof import('../lib/toss.ts')>('../lib/toss.ts', deps);
    deps['@/lib/toss'] = {
        ...actualToss,
        customerKeyFor: () => 'cpa_customer',
        issueBillingKey: async () => { external.push('issue'); return { billingKey: 'new-billing-key' }; },
        approveBillingPayment: async () => {
            external.push('approve');
            if (options.chargeFailure) throw new actualToss.TossApiError(options.chargeFailure, 'test failure', 502);
            return { paymentKey: 'payment-1', orderId: ORDER, status: 'DONE', totalAmount: 9900, approvedAt: null, receiptUrl: null };
        },
        getPaymentByOrderId: async (id: string) => {
            external.push(`lookup:${id}`);
            return { paymentKey: 'payment-1', orderId: ORDER, status: 'DONE', totalAmount: 9900 };
        },
        getPayment: async () => {
            external.push('getPayment');
            return options.actualPayment ?? { paymentKey: 'payment-1', orderId: ORDER, status: 'DONE', totalAmount: 9900 };
        },
    };
    deps['@/lib/billing/server'] = load('../lib/billing/server.ts', deps);
    return { rpcs, external, tables, route: (path: string) => load<Route>(`../app/api/${path}/route.ts`, deps) };
}

function request(body: unknown = { authKey: 'auth-1', customerKey: 'cpa_customer', membershipVersion: 7 }, origin = ORIGIN): Request {
    return new Request(`${ORIGIN}/api/billing/setup`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('billing requests reject cross-origin, inactive membership, stale epoch, and mismatched customer before any charge', async () => {
    const cases = [
        { options: {}, req: request(undefined, 'https://cta.example.test'), status: 403 },
        { options: { inactive: true }, req: request(), status: 403 },
        { options: {}, req: request({ authKey: 'auth', customerKey: 'cpa_customer', membershipVersion: 6 }), status: 409 },
        { options: {}, req: request({ authKey: 'auth', customerKey: 'other-customer', membershipVersion: 7 }), status: 400 },
    ];
    for (const scenario of cases) {
        const h = harness(scenario.options);
        const res = await h.route('billing/setup').POST(scenario.req);
        assert.equal(res.status, scenario.status);
        assert.deepEqual(h.external, []);
        assert.deepEqual(h.rpcs, []);
        assert.match(res.headers.get('cache-control') ?? '', /private.*no-store/);
    }
});

test('setup persists claim and billing key, then atomically finalizes the fixed order and price', async () => {
    const h = harness();
    const res = await h.route('billing/setup').POST(request());
    assert.equal(res.status, 200);
    assert.deepEqual(h.external, ['issue', 'approve']);
    assert.deepEqual(h.rpcs.map(({ name }) => name), ['cpa_begin_subscription_setup', 'cpa_set_subscription_setup_billing_key', 'cpa_finalize_subscription_setup']);
    assert.equal(h.rpcs[0].args.p_membership_version, 7);
    assert.equal(h.rpcs[1].args.p_order_id, ORDER);
    assert.equal(h.rpcs[2].args.p_order_id, ORDER);
    assert.equal(h.rpcs[2].args.p_amount, 9900);
    assert.equal(h.rpcs[2].args.p_days, 30);
    assert.deepEqual(await res.json(), { success: true, periodEnd: PERIOD_END, referralPending: false, receiptUrl: null });
});

test('resuming an uncertain first charge only looks up its stored order, without issuing or charging a new card', async () => {
    const h = harness({ resumed: true });
    assert.equal((await h.route('billing/setup').POST(request())).status, 200);
    assert.deepEqual(h.external, [`lookup:${ORDER}`]);
    assert.equal(h.rpcs.at(-1)?.args.p_order_id, ORDER);
});

test('pending or active setup claims never initiate additional payments', async () => {
    for (const claimAction of ['busy', 'already_subscribed']) {
        const h = harness({ claimAction });
        assert.equal((await h.route('billing/setup').POST(request())).status, 409);
        assert.deepEqual(h.external, []);
    }
});

test('ambiguous charge failures retain reconciliation, definitive card rejection can release the order', async () => {
    for (const chargeFailure of ['NETWORK_ERROR', 'REJECT_CARD_COMPANY'] as const) {
        const h = harness({ chargeFailure });
        const res = await h.route('billing/setup').POST(request());
        assert.equal(res.status, chargeFailure === 'NETWORK_ERROR' ? 503 : 400);
        assert.equal(h.rpcs.find(({ name }) => name === 'cpa_abort_subscription_setup')?.args.p_definitive, chargeFailure !== 'NETWORK_ERROR');
        assert.ok(!h.rpcs.some(({ name }) => name === 'cpa_finalize_subscription_setup'));
    }
});

test('withdrawal during card issuance enqueues key cleanup and prevents a new payment', async () => {
    const h = harness({ withdrawBeforeCharge: true });
    assert.equal((await h.route('billing/setup').POST(request())).status, 403);
    assert.deepEqual(h.external, ['issue']);
    assert.ok(h.rpcs.some(({ name }) => name === 'cpa_enqueue_billing_key_cleanup'));
    assert.equal(h.rpcs.at(-1)?.args.p_definitive, true);
});

test('referral database errors prevent charging instead of silently losing the promised reward', async () => {
    const h = harness({ referralReadError: true });
    assert.equal((await h.route('billing/setup').POST(request())).status, 503);
    assert.deepEqual(h.external, []);
});

test('previously paid users cannot validate, register or submit a new referral, but normal resubscription remains available', async () => {
    for (const path of ['referral/validate', 'referral/register', 'billing/setup']) {
        const h = harness({ priorSuccess: true });
        const body = path === 'billing/setup'
            ? { authKey: 'auth-1', customerKey: 'cpa_customer', membershipVersion: 7, referrerNickname: '추천인01' }
            : { nickname: '추천인01', membershipVersion: 7 };
        const res = await h.route(path).POST(request(body));
        assert.equal(res.status, 409);
        assert.match(await res.text(), /첫 결제 전에만/);
        assert.deepEqual(h.external, []);
        assert.ok(!h.tables.includes('common_profiles'), 'other members must not be looked up when this user is already ineligible');
    }
    for (const pendingReferral of [false, true]) {
        const h = harness({ priorSuccess: true, pendingReferral });
        const res = await h.route('billing/setup').POST(request());
        assert.equal(res.status, 200);
        assert.equal((await res.json()).referralPending, false);
        assert.equal(h.rpcs.find(({ name }) => name === 'cpa_finalize_subscription_setup')?.args.p_referral_id, null);
    }
});

test('referral outcome follows committed payment linkage even when finalization drops or replaces the attempted relation', async () => {
    for (const committedReferralId of [null, 8]) {
        const h = harness({ pendingReferral: true, committedReferralId });
        const res = await h.route('billing/setup').POST(request());
        assert.equal(res.status, 200);
        assert.equal(h.rpcs.at(-1)?.args.p_referral_id, 4);
        assert.equal((await res.json()).referralPending, committedReferralId !== null);
    }
    const cancelled = harness({ pendingReferral: true, committedReferralId: 4, committedReferralStatus: 'cancelled' });
    assert.equal((await (await cancelled.route('billing/setup').POST(request())).json()).referralPending, false);
});

test('recovery of an already successful current order preserves its pending referral and never recharges', async () => {
    const h = harness({ resumed: true, priorSuccess: true, priorSuccessOrderId: ORDER, pendingReferral: true, committedReferralId: 4 });
    const res = await h.route('billing/setup').POST(request());
    assert.equal(res.status, 200);
    assert.equal((await res.json()).referralPending, true);
    assert.deepEqual(h.external, [`lookup:${ORDER}`]);
});

test('a failed post-payment referral read reports the successful payment explicitly, never inventing pending rewards', async () => {
    const h = harness({ committedReadError: true });
    const res = await h.route('billing/setup').POST(request());
    assert.equal(res.status, 503);
    assert.match(await res.text(), /결제는 완료되었으나/);
    assert.deepEqual(h.external, ['issue', 'approve']);
});

test('cancellation preserves paid access, passes the membership version, and never returns its billing key', async () => {
    const h = harness();
    const res = await h.route('billing/cancel').POST(request({ membershipVersion: 7 }));
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /2026-10-13/);
    assert.ok(!body.includes('secret-key'));
    assert.equal(h.rpcs[0].name, 'cpa_cancel_subscription_renewal');
    assert.equal(h.rpcs[0].args.p_membership_version, 7);
});

test('forged cancellation payload cannot override Toss verified DONE state', async () => {
    const h = harness();
    const res = await h.route('webhooks/toss').POST(request({ eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: 'payment-1', status: 'CANCELED' } }));
    assert.equal(res.status, 200);
    assert.deepEqual(h.external, ['getPayment']);
    assert.deepEqual(h.rpcs.map(({ name }) => name), ['consume_rate_limit']);
});

test('verified early cancellation uses the inbox only for CPA orders, isolating sibling CTA payments', async () => {
    for (const orderId of [ORDER, 'cta_existing_order']) {
        const h = harness({ actualPayment: { paymentKey: 'payment-1', orderId, status: 'CANCELED', totalAmount: 9900 } });
        const res = await h.route('webhooks/toss').POST(request({ eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: 'payment-1' } }));
        assert.equal(res.status, 200);
        assert.equal(h.rpcs.some(({ name }) => name === 'cpa_record_verified_payment_cancellation'), orderId === ORDER);
    }
});

test('unsigned billing-key deletion and rate-limited webhooks cannot mutate subscriptions or call Toss', async () => {
    const unsigned = harness();
    assert.equal((await unsigned.route('webhooks/toss').POST(request({ eventType: 'BILLING_DELETED', data: { billingKey: 'leaked-key' } }))).status, 200);
    assert.deepEqual(unsigned.tables, []);
    const limited = harness({ rateAllowed: false });
    assert.equal((await limited.route('webhooks/toss').POST(request({ eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: 'payment-1' } }))).status, 429);
    assert.deepEqual(limited.external, []);
});

test('Toss transport recovers a lost approval response through the same order id and idempotency key', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const toss = load<typeof import('../lib/toss.ts')>('../lib/toss.ts', { 'server-only': {}, 'node:crypto': crypto }, async (input, init) => {
        calls.push({ url: String(input), init });
        if (calls.length === 1) throw new Error('Connection reset after approval');
        return Response.json({ paymentKey: 'payment-1', orderId: ORDER, status: 'DONE', totalAmount: 9900 });
    });
    const result = await toss.approveBillingPayment({ billingKey: 'key', customerKey: 'customer', orderId: ORDER, amount: 9900, orderName: 'Audit Say' });
    assert.equal(result.paymentKey, 'payment-1');
    assert.equal(calls.length, 2);
    assert.equal(new Headers(calls[0].init?.headers).get('idempotency-key'), ORDER);
    assert.match(calls[1].url, new RegExp(`/payments/orders/${ORDER}$`));
    assert.equal(calls[1].init?.method, 'GET');
    assert.match(toss.customerKeyFor('member-1'), /^cpa_[A-Za-z0-9_-]{40}$/);
    assert.notEqual(toss.customerKeyFor('member-1'), toss.customerKeyFor('member-2'));
});

test('Toss approval rejects wrong order, amount and incomplete status', async () => {
    for (const payment of [{ orderId: 'different', totalAmount: 9900, status: 'DONE' }, { orderId: ORDER, totalAmount: 1, status: 'DONE' }, { orderId: ORDER, totalAmount: 9900, status: 'IN_PROGRESS' }]) {
        const toss = load<typeof import('../lib/toss.ts')>('../lib/toss.ts', { 'server-only': {}, 'node:crypto': crypto }, async () => Response.json({ paymentKey: 'payment-1', ...payment }));
        await assert.rejects(toss.approveBillingPayment({ billingKey: 'key', customerKey: 'customer', orderId: ORDER, amount: 9900, orderName: 'Audit Say' }), { code: 'INVALID_PAYMENT_RESPONSE' });
    }
});

test('webhook signature binds exact body and timestamp, accepts rotation and rejects unversioned input', () => {
    const raw = '{"eventType":"test"}';
    const timestamp = '2026-09-13T00:00:00Z';
    const sig = crypto.createHmac('sha256', 'test-secret').update(`${raw}:${timestamp}`).digest('base64');
    assert.equal(webhook.verifyTossSignature(raw, `v1:bad,v1:${sig}`, timestamp, 'test-secret'), true);
    assert.equal(webhook.verifyTossSignature(`${raw} `, `v1:${sig}`, timestamp, 'test-secret'), false);
    assert.equal(webhook.verifyTossSignature(raw, `v1:${sig}`, `${timestamp}x`, 'test-secret'), false);
    assert.equal(webhook.verifyTossSignature(raw, sig, timestamp, 'test-secret'), false);
});

test('body limits count actual UTF-8 bytes even without Content-Length', async () => {
    const oversized = new Request(ORIGIN, { method: 'POST', body: '한'.repeat(100) });
    await assert.rejects(http.readBillingText(oversized, 100), { status: 413 });
    assert.equal(await http.readBillingText(new Request(ORIGIN, { method: 'POST', body: '한글' }), 6), '한글');
});

test('referral lookup requires the common profile and Audit service to both be active, and blocks self or duplicate referral', async () => {
    for (const scenario of ['valid', 'self', 'duplicate', 'missing-service', 'db-error', 'invalid'] as const) {
        const filters: string[] = [];
        const admin = {
            from(table: string) {
                const query = {
                    select() { return query; },
                    limit() { return query; },
                    ilike(column: string, value: string) { filters.push(`${table}.${column}=${value}`); return query; },
                    eq(column: string, value: unknown) { filters.push(`${table}.${column}=${value}`); return query; },
                    async maybeSingle() {
                        if (scenario === 'db-error') return { data: null, error: { code: 'unavailable' } };
                        if (table === 'cpa_payment_log') return { data: null, error: null };
                        if (table === 'common_profiles') return { data: { id: scenario === 'self' ? 'current' : 'referrer', nickname: '추천인01' }, error: null };
                        if (table === 'cpa_users') return { data: scenario === 'missing-service' ? null : { id: scenario === 'self' ? 'current' : 'referrer', referral_code: 'private-code', membership_version: 3 }, error: null };
                        if (table === 'cpa_referral') return { data: scenario === 'duplicate' ? { id: 1, status: 'pending' } : null, error: null };
                        throw new Error(`Unexpected table ${table}`);
                    },
                };
                return query;
            },
        };
        const result = await referrals.lookupReferrer(admin as unknown as SupabaseClient, scenario === 'invalid' ? '%' : ' 추천인01 ', 'current');
        assert.equal(result.ok, scenario === 'valid');
        if (scenario === 'valid') {
            assert.ok(filters.includes('common_profiles.account_status=active'));
            assert.ok(filters.includes('cpa_users.membership_status=active'));
        }
        if (scenario === 'self' && !result.ok) assert.equal(result.failure.code, 'SELF_REFERRAL');
        if (scenario === 'duplicate' && !result.ok) assert.equal(result.failure.code, 'ALREADY_REFERRED');
        if (scenario === 'db-error' && !result.ok) assert.equal(result.failure.status, 503);
        if (scenario === 'invalid') assert.equal(filters.length, 0);
    }
});

test('checkout constants agree with the recurring worker and preserve retry delays', () => {
    const worker = fs.readFileSync(new URL('../supabase/functions/process-cpa-billing/index.ts', import.meta.url), 'utf8');
    assert.match(worker, new RegExp(`const PRO_MONTHLY_PRICE = ${plan.PRO_MONTHLY_PRICE}\\b`));
    assert.match(worker, new RegExp(`const PRO_PERIOD_DAYS = ${plan.PRO_PERIOD_DAYS}\\b`));
    assert.ok(worker.includes(plan.PRO_ORDER_NAME));
    const now = new Date('2026-09-13T00:00:00Z');
    assert.equal(plan.calcNextRetryAt(1, now)?.getTime(), now.getTime() + 3600000);
    assert.equal(plan.calcNextRetryAt(2, now)?.getTime(), now.getTime() + 12 * 3600000);
    assert.equal(plan.calcNextRetryAt(3, now)?.getTime(), now.getTime() + 24 * 3600000);
    assert.equal(plan.calcNextRetryAt(4, now), null);
});
