import { authenticatedBilling, billingFailure, billingResponse } from '@/lib/billing/server'
import type { BillingStatusResponse, RewardReason, SubscriptionStatus } from '@/lib/billing/types'

/**
 * GET /api/billing/status — 구독 현황·보상 이력·결제 이력.
 *
 * **빌링키는 절대 내보내지 않는다.** 화면이 알아야 할 것은 「등록된 카드가 있는가」뿐이라
 * `hasBillingKey` 불리언으로만 준다. 컬럼 자체도 anon·authenticated 로부터 권한이
 * 회수돼 있지만(마이그레이션 §4), 이 라우트는 service_role 로 읽으므로 여기서 한 번 더
 * 의식적으로 걸러야 한다.
 */
export async function GET() {
    try { return await status() } catch (error) { return billingFailure(error) }
}

async function status() {
    const { user, membership, admin } = await authenticatedBilling()
    const [subRes, rewardRes, paymentRes, userRes, referredRes] = await Promise.all([
        admin
            .from('cpa_subscription')
            .select('status, current_period_end, cancel_at_period_end, toss_billing_key')
            .eq('user_id', user.id)
            .eq('membership_version', membership.membership_version)
            .maybeSingle(),
        admin
            .from('cpa_pro_reward')
            .select('reason, reward_days, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20),
        admin
            .from('cpa_payment_log')
            .select('status, amount, created_at, failure_message')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(12),
        admin
            .from('common_profiles')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle(),
        admin
            .from('cpa_referral')
            .select('id', { count: 'exact', head: true })
            .eq('referrer_id', user.id)
            .eq('status', 'rewarded'),
    ])

    if (subRes.error || rewardRes.error || paymentRes.error || userRes.error || referredRes.error) {
        console.error('[billing/status] 구독 조회 실패:', subRes.error)
        return billingResponse(
            { error: 'STATUS_LOOKUP_FAILED', message: '구독 정보를 조회하지 못했습니다.' },
            { status: 500 }
        )
    }

    const sub = subRes.data
    const periodEnd = sub?.current_period_end ?? null

    // 「지금 pro 인가」는 상태와 기간을 함께 봐야 한다. cancelled 도 만료일 전까지는
    // 이용 가능하고(이미 낸 돈), active 라도 만료일이 지났으면 강등 대기 중이다.
    const isActive =
        !!sub &&
        (sub.status === 'active' || sub.status === 'cancelled') &&
        !!periodEnd &&
        new Date(periodEnd) > new Date()

    const response: BillingStatusResponse = {
        membershipVersion: membership.membership_version,
        isActive,
        status: (sub?.status as SubscriptionStatus | undefined) ?? null,
        periodEnd,
        cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
        hasBillingKey: !!sub?.toss_billing_key,
        nickname: userRes.data?.nickname ?? null,
        referredCount: referredRes.count ?? 0,
        rewardHistory: (rewardRes.data ?? []).map((r) => ({
            reason: r.reason as RewardReason,
            days: r.reward_days,
            createdAt: r.created_at,
        })),
        payments: (paymentRes.data ?? []).map((p) => ({
            status: p.status,
            amount: p.amount,
            createdAt: p.created_at,
            failureMessage: p.failure_message,
        })),
    }

    return billingResponse(response)
}
