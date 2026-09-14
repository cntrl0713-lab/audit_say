import type { AuditMembership } from './accountPolicy.ts';

export interface AuditSubscription {
    status: string;
    current_period_end: string;
    membership_version: number;
}

/** Subscription expiry is checked on every read, even when the scheduled worker is delayed. */
export function auditEntitlement(member: AuditMembership, subscription: AuditSubscription | null, now = Date.now()) {
    if (member.membership_status !== 'active') return { kind: 'free' as const, expiresAt: null };
    // Existing administrator grants are migrated into a separate service-only flag.
    if (member.manual_pro === true) return { kind: 'pro' as const, expiresAt: null };
    if (!subscription) return { kind: 'free' as const, expiresAt: null };
    const active = subscription.membership_version === member.membership_version
        && ['active', 'cancelled'].includes(subscription.status)
        && Date.parse(subscription.current_period_end) > now;
    return { kind: active ? 'pro' as const : 'free' as const, expiresAt: active ? subscription.current_period_end : null };
}
