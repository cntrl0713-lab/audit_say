import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SubscriptionValidationError } from './subscription';

export const SUBSCRIPTION_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'Referrer-Policy': 'no-referrer' };
export const SUBSCRIPTIONS_TABLE = 'cpa_kicpa_jobs_subscribers';
export const SUBSCRIPTION_STATUS_COLUMNS = 'is_active,boards,consent_version,consented_at';

export class SubscriptionRouteError extends Error {
    readonly status: number;
    constructor(code: string, status: number) {
        super(code);
        this.status = status;
    }
}

/** Real Auth validation is required even when a local test bypass exists elsewhere. */
export async function requireJobsSubscriptionMember() {
    const client = await getSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || user.is_anonymous) throw new SubscriptionRouteError('member_required', 401);
    const admin = getSupabaseAdmin();
    const { data: account, error: accountError } = await admin.from('common_profiles')
        .select('account_status').eq('id', user.id).maybeSingle();
    if (accountError) throw new SubscriptionRouteError('service_unavailable', 503);
    if (!account || account.account_status !== 'active') throw new SubscriptionRouteError('member_required', 401);
    const { data: member, error: profileError } = await admin.from('cpa_users')
        .select('id,role,membership_status,membership_version').eq('id', user.id).maybeSingle();
    if (profileError) throw new SubscriptionRouteError('service_unavailable', 503);
    if (!member || member.membership_status !== 'active' || !Number.isSafeInteger(member.membership_version)
        || member.membership_version < 1 || !['MEMBER', 'PRO', 'ADMIN'].includes(member.role)) throw new SubscriptionRouteError('member_required', 401);
    return { user, admin, membershipVersion: member.membership_version as number };
}

export function subscriptionRouteError(error: unknown) {
    const knownError = error instanceof SubscriptionRouteError || error instanceof SubscriptionValidationError;
    return Response.json({ error: knownError ? error.message : 'service_unavailable' }, {
        status: error instanceof SubscriptionRouteError ? error.status : error instanceof SubscriptionValidationError ? 400 : 503,
        headers: SUBSCRIPTION_PRIVATE_HEADERS,
    });
}
