import { isSameOrigin, jobsSubscriptionStatus, parseSubscriptionInput, subscriptionWrite } from '@/lib/kicpa/subscription';
import { requireJobsSubscriptionMember, SUBSCRIPTION_PRIVATE_HEADERS, SUBSCRIPTION_STATUS_COLUMNS,
    SUBSCRIPTIONS_TABLE, SubscriptionRouteError, subscriptionRouteError } from '@/lib/kicpa/subscriptionServer';

export const runtime = 'nodejs';

export async function GET() {
    try {
        const { user, admin } = await requireJobsSubscriptionMember();
        const { data, error } = await admin.from(SUBSCRIPTIONS_TABLE).select(SUBSCRIPTION_STATUS_COLUMNS).eq('user_id', user.id).maybeSingle();
        if (error) throw new SubscriptionRouteError('service_unavailable', 503);
        return Response.json(jobsSubscriptionStatus(data), { headers: SUBSCRIPTION_PRIVATE_HEADERS });
    } catch (error) { return subscriptionRouteError(error); }
}

export async function PATCH(request: Request) {
    try {
        if (!isSameOrigin(request)) throw new SubscriptionRouteError('forbidden', 403);
        const { user, admin, membershipVersion } = await requireJobsSubscriptionMember();
        if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
            throw new SubscriptionRouteError('invalid_request', 400);
        }
        // No provider or telephone fields are accepted, even from an authenticated member.
        const raw = await request.text();
        if (raw.length > 2048) throw new SubscriptionRouteError('invalid_request', 400);
        let body: unknown;
        try { body = JSON.parse(raw); } catch { throw new SubscriptionRouteError('invalid_request', 400); }
        const input = parseSubscriptionInput(body);
        const { data: existing, error } = await admin.from(SUBSCRIPTIONS_TABLE).select(SUBSCRIPTION_STATUS_COLUMNS).eq('user_id', user.id).maybeSingle();
        if (error) throw new SubscriptionRouteError('service_unavailable', 503);
        const changes = subscriptionWrite(input, existing);
        const { data, error: writeError } = await admin.from(SUBSCRIPTIONS_TABLE)
            .upsert({ user_id: user.id, membership_version: membershipVersion, ...changes }, { onConflict: 'user_id' })
            .select(SUBSCRIPTION_STATUS_COLUMNS).single();
        if (writeError || !data) throw new SubscriptionRouteError('service_unavailable', 503);
        return Response.json(jobsSubscriptionStatus(data), { headers: SUBSCRIPTION_PRIVATE_HEADERS });
    } catch (error) { return subscriptionRouteError(error); }
}

export async function DELETE(request: Request) {
    try {
        if (!isSameOrigin(request)) throw new SubscriptionRouteError('forbidden', 403);
        const { user, admin, membershipVersion } = await requireJobsSubscriptionMember();
        // Subscriber deletion also removes its delivery queue through the database FK cascade.
        const { error } = await admin.from(SUBSCRIPTIONS_TABLE).delete().eq('user_id', user.id).eq('membership_version', membershipVersion);
        if (error) throw new SubscriptionRouteError('service_unavailable', 503);
        return Response.json(jobsSubscriptionStatus(null), { headers: SUBSCRIPTION_PRIVATE_HEADERS });
    } catch (error) { return subscriptionRouteError(error); }
}
