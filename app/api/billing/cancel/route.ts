import { authenticatedBilling, billingBody, billingFailure, billingResponse, assertBillingVersion } from '@/lib/billing/server'
import type { BillingCancelResponse } from '@/lib/billing/types'

interface CancellationRow {
    id: number
    billing_key: string | null
    current_period_end: string
    reconciliation_pending: boolean
}

/**
 * POST /api/billing/cancel — 자동 갱신을 끈다.
 *
 * **등급을 즉시 내리지 않는다.** 이미 낸 돈에 해당하는 기간은 끝까지 쓸 수 있어야 하므로
 * `cancel_at_period_end = true` 만 세우고, 만료일이 지나면 pg_cron 의
 * `cpa_downgrade_expired_pro` 가 MEMBER 로 되돌린다.
 *
 * 토스에는 「구독 해지」라는 개념이 없다 — 다음 결제일에 승인 API 를 부르지 않으면 그것이
 * 해지다. 그래서 해지의 본질은 위 플래그이고, 빌링키 삭제는 정리 작업일 뿐이다.
 * 삭제가 실패해도 해지는 이미 성립하므로 로그만 남기고 진행한다.
 */
export async function POST(req: Request) {
    try { return await cancel(req) } catch (error) { return billingFailure(error) }
}

async function cancel(req: Request) {
    const body = await billingBody(req)
    const { user, membership, admin } = await authenticatedBilling()
    assertBillingVersion(body.membershipVersion, membership.membership_version)
    const { data: cancellationData, error: cancelErr } = await admin
        .rpc('cpa_cancel_subscription_renewal', { p_user_id: user.id, p_membership_version: membership.membership_version })
        .maybeSingle()

    if (cancelErr) {
        console.error('[billing/cancel] 해지 반영 실패:', cancelErr)
        return billingResponse(
            { error: 'CANCEL_FAILED', message: '구독 해지에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
            { status: 500 }
        )
    }
    const cancellation = cancellationData as CancellationRow | null
    if (!cancellation) {
        return billingResponse(
            { error: 'NO_ACTIVE_SUBSCRIPTION', message: '해지할 구독이 없습니다.' },
            { status: 404 }
        )
    }

    // 해지 RPC가 삭제 outbox를 같은 transaction에서 기록한다. 실제 삭제는 worker가 재시도한다.
    const keyCleanupPending = cancellation.billing_key !== null

    const response: BillingCancelResponse & {
        reconciliation_pending: boolean
        key_cleanup_pending: boolean
    } = {
        success: true,
        accessUntil: cancellation.current_period_end,
        reconciliation_pending: cancellation.reconciliation_pending,
        key_cleanup_pending: keyCleanupPending,
    }
    return billingResponse(response)
}
