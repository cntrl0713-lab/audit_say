import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeAuditMembership, assertAccountOrigin, auditRole, validateEmail, validateExpectedVersion, validateNickname, validatePassword } from '../lib/accountPolicy.ts';
import type { AuditMembership, CommonProfile } from '../lib/accountPolicy.ts';
import { issueRecoveryGrant, verifyRecoveryGrant, RECOVERY_TTL_SECONDS } from '../lib/accountRecovery.ts';

const profile: CommonProfile = { id: 'member', nickname: '공통회원', account_status: 'active' };
const member: AuditMembership = { id: 'member', membership_status: 'active', membership_version: 1, is_service_admin: false, role: 'MEMBER', level: 1, exp: 0 };
test('an Auth account alone does not grant audit access; all inactive account/membership states fail closed', () => {
    assert.equal(activeAuditMembership(profile, member), member);
    assert.throws(() => activeAuditMembership(null, member));
    assert.throws(() => activeAuditMembership(profile, null));
    for (const status of ['locked', 'deleting'] as const) assert.throws(() => activeAuditMembership({ ...profile, account_status: status }, member));
    for (const status of ['suspended', 'withdrawing', 'withdrawn'] as const) assert.throws(() => activeAuditMembership(profile, { ...member, membership_status: status }));
    for (const version of [0, -1, NaN, 1.5]) assert.throws(() => activeAuditMembership(profile, { ...member, membership_version: version }));
});
test('paid status and even a legacy ADMIN label cannot grant service administration', () => {
    assert.equal(auditRole({ ...member, role: 'PRO' }), 'PRO');
    assert.equal(auditRole({ ...member, role: 'ADMIN' }), 'MEMBER');
    assert.equal(auditRole({ ...member, is_service_admin: true }), 'ADMIN');
});
test('account mutation origins require the exact site, including sibling services', () => {
    const origin = 'https://audit.example.test';
    assert.doesNotThrow(() => assertAccountOrigin(new Request(origin, { headers: { origin } })));
    for (const candidate of ['', 'null', 'https://tax.example.test', 'https://audit.example.test.evil.test']) {
        assert.throws(() => assertAccountOrigin(new Request(origin, { headers: candidate ? { origin: candidate } : {} })));
    }
    assert.throws(() => assertAccountOrigin(new Request(origin, { headers: { origin, 'sec-fetch-site': 'cross-site' } })));
});
test('global nickname cannot be a wildcard, email, or arbitrary SQL lookup; password preserves whitespace', () => {
    assert.equal(validateNickname(' 공통01 '), '공통01');
    for (const value of ['%', 'a_', 'a@b', 'x', 'a'.repeat(13), '공통 회원']) assert.throws(() => validateNickname(value));
    assert.equal(validateEmail(' MEMBER@Example.test '), 'member@example.test');
    assert.equal(validatePassword('  abcd12  '), '  abcd12  ');
    assert.throws(() => validatePassword('1234567'));
    assert.throws(() => validateExpectedVersion('1'));
});
test('password recovery proof is bound to the validated account, exact session, expiry and signing key', () => {
    const key = 'only-test-recovery-signing-key-at-least-32';
    const now = 1000000;
    const grant = issueRecoveryGrant('user-a', 'session-a', key, now);
    assert.equal(verifyRecoveryGrant(grant, 'user-a', 'session-a', key, now), true);
    assert.equal(verifyRecoveryGrant(grant, 'user-b', 'session-a', key, now), false);
    assert.equal(verifyRecoveryGrant(grant, 'user-a', 'session-b', key, now), false);
    assert.equal(verifyRecoveryGrant(grant, 'user-a', 'session-a', key, now + RECOVERY_TTL_SECONDS * 1000), false);
    assert.equal(verifyRecoveryGrant(grant, 'user-a', 'session-a', 'different-test-signing-key-at-least-32', now), false);
    assert.equal(verifyRecoveryGrant(grant + 'x', 'user-a', 'session-a', key, now), false);
    assert.equal(verifyRecoveryGrant('recovery=true', 'user-a', 'session-a', key, now), false);
});
