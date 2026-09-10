import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasCurrentJobsConsent, isSameOrigin, JOBS_CONSENT_VERSION, jobsSubscriptionStatus,
    parseSubscriptionInput, subscriptionWrite, type JobsSubscriptionProjection } from '../lib/kicpa/subscription.ts';

const NOW = Date.parse('2026-09-09T01:00:00Z');
const CONSENTED_AT = new Date(NOW - 60_000).toISOString();
const validRow: JobsSubscriptionProjection = { is_active: true, boards: ['trainee_cpa'],
    consent_version: JOBS_CONSENT_VERSION, consented_at: CONSENTED_AT };

test('subscription validates explicit booleans and a non-empty unique board set', () => {
    assert.deepEqual(parseSubscriptionInput({ active: true, boards: ['cpa', 'trainee_cpa'], consent: true }),
        { active: true, boards: ['trainee_cpa', 'cpa'], consent: true });
    for (const body of [null, [], {}, { active: 'true', boards: ['cpa'], consent: true },
        { active: true, boards: ['cpa'], consent: 'true' }, { active: false, boards: [], consent: false },
        { active: true, boards: ['cpa', 'cpa'], consent: true }, { active: true, boards: ['unknown'], consent: true },
        { active: true, boards: ['cpa', null], consent: true }, { active: true, boards: 'cpa', consent: true }]) {
        assert.throws(() => parseSubscriptionInput(body), /invalid_request/);
    }
});

test('API input cannot inject a phone, verification, identity, consent version or provider field', () => {
    for (const key of ['phone_e164', 'phone_verified_at', 'user_id', 'consent_version', 'consented_at', 'provider', 'kakao_access_token']) {
        assert.throws(() => parseSubscriptionInput({ active: true, boards: ['cpa'], consent: true, [key]: 'untrusted' }), /invalid_request/);
    }
});

test('first activation and outdated/invalid consent require a new affirmative consent', () => {
    const input = { active: true, boards: ['trainee_cpa'] as const, consent: false };
    for (const row of [null, { ...validRow, consent_version: null }, { ...validRow, consent_version: 'old-version' },
        { ...validRow, consented_at: null }, { ...validRow, consented_at: 'invalid' },
        { ...validRow, consented_at: new Date(NOW + 1).toISOString() }]) {
        assert.equal(hasCurrentJobsConsent(row, NOW), false);
        assert.throws(() => subscriptionWrite({ ...input, boards: [...input.boards] }, row, NOW), /consent_required/);
    }
    assert.equal(hasCurrentJobsConsent(validRow, NOW), true);
    const saved = subscriptionWrite({ ...input, boards: [...input.boards], consent: true }, null, NOW);
    assert.equal(saved.consent_version, JOBS_CONSENT_VERSION);
    assert.equal(saved.consented_at, new Date(NOW).toISOString());
    assert.equal(saved.is_active, true);
});

test('inactive preferences can be saved without consent and do not fabricate a consent record', () => {
    const saved = subscriptionWrite({ active: false, boards: ['cpa'], consent: false }, null, NOW);
    assert.equal(saved.is_active, false);
    assert.equal(saved.consent_version, null);
    assert.equal(saved.consented_at, null);
});

test('resume or active board changes advance the watermark, but repeated save and mere ordering do not', () => {
    const input = { active: true, boards: ['trainee_cpa'] as const, consent: false };
    const resume = subscriptionWrite({ ...input, boards: [...input.boards] }, { ...validRow, is_active: false }, NOW);
    assert.equal(resume.notifications_since, new Date(NOW).toISOString());
    assert.equal(resume.consented_at, CONSENTED_AT);
    assert.equal(subscriptionWrite({ active: true, boards: ['cpa'], consent: false }, validRow, NOW).notifications_since, new Date(NOW).toISOString());
    assert.equal(Object.hasOwn(subscriptionWrite({ ...input, boards: [...input.boards] }, validRow, NOW), 'notifications_since'), false);
    assert.equal(Object.hasOwn(subscriptionWrite({ active: true, boards: ['cpa', 'trainee_cpa'], consent: false },
        { ...validRow, boards: ['trainee_cpa', 'cpa'] }, NOW), 'notifications_since'), false);
    assert.equal(Object.hasOwn(subscriptionWrite({ active: false, boards: ['cpa'], consent: false }, validRow, NOW), 'notifications_since'), false);
});

test('a fresh consent on an already requested but outdated subscription starts a fresh queue window', () => {
    const saved = subscriptionWrite({ active: true, boards: ['trainee_cpa'], consent: true }, { ...validRow, consent_version: 'old' }, NOW);
    assert.equal(saved.notifications_since, new Date(NOW).toISOString());
    assert.equal(saved.consent_version, JOBS_CONSENT_VERSION);
});

test('status always marks delivery as preparing and omits all phone and identity fields', () => {
    const privateRow = { ...validRow, phone_e164: '+821012345678', phone_verified_at: CONSENTED_AT, user_id: 'private-member-id' };
    assert.deepEqual(jobsSubscriptionStatus(privateRow, NOW), {
        saved: true, active: true, boards: ['trainee_cpa'], consentRequired: false, deliveryStatus: 'preparing',
    });
    assert.deepEqual(jobsSubscriptionStatus(null, NOW), {
        saved: false, active: false, boards: ['trainee_cpa', 'cpa'], consentRequired: true, deliveryStatus: 'preparing',
    });
});

test('mutation origin checking rejects missing/null/cross-site/sibling origins', () => {
    const origin = 'https://audit.example.test';
    const request = (headers: Record<string, string>) => new Request(`${origin}/api/jobs/subscription`, { method: 'PATCH', headers });
    assert.equal(isSameOrigin(request({ origin })), true);
    for (const headers of [{}, { origin: 'null' }, { origin: `${origin}/` }, { origin: 'https://evil.example.test' },
        { origin, 'sec-fetch-site': 'cross-site' }, { origin, 'sec-fetch-site': 'none' }]) {
        assert.equal(isSameOrigin(request(headers as Record<string, string>)), false);
    }
});
