import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditEntitlement } from '../lib/subscriptionEntitlement.ts';
import type { AuditMembership } from '../lib/accountPolicy.ts';

const now = Date.parse('2026-09-13T00:00:00Z');
const member: AuditMembership = { id: 'member', membership_status: 'active', membership_version: 3,
    is_service_admin: false, role: 'PRO', level: 1, exp: 0 };
const subscription = { status: 'active', membership_version: 3, current_period_end: '2026-09-14T00:00:00Z' };

test('paid and cancelled subscriptions retain access only until their exact expiry', () => {
    for (const status of ['active', 'cancelled']) {
        assert.equal(auditEntitlement(member, { ...subscription, status }, now).kind, 'pro');
        assert.equal(auditEntitlement(member, { ...subscription, status, current_period_end: new Date(now).toISOString() }, now).kind, 'free');
    }
    for (const status of ['past_due', 'expired']) assert.equal(auditEntitlement(member, { ...subscription, status }, now).kind, 'free');
    assert.equal(auditEntitlement(member, { ...subscription, current_period_end: 'invalid' }, now).kind, 'free');
});
test('a new membership never inherits a previous subscription or stale PRO role', () => {
    assert.equal(auditEntitlement(member, { ...subscription, membership_version: 2 }, now).kind, 'free');
    assert.equal(auditEntitlement({ ...member, membership_status: 'withdrawn' }, subscription, now).kind, 'free');
});
test('manual PRO grants are separate from expired subscriptions and stale role labels', () => {
    assert.deepEqual(auditEntitlement({ ...member, manual_pro: true }, null, now), { kind: 'pro', expiresAt: null });
    assert.equal(auditEntitlement({ ...member, manual_pro: true }, { ...subscription, status: 'expired' }, now).kind, 'pro');
    assert.equal(auditEntitlement(member, null, now).kind, 'free');
    assert.equal(auditEntitlement({ ...member, manual_pro: false }, subscription, now).kind, 'pro');
});
