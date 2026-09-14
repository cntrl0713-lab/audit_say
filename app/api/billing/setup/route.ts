import type { SupabaseClient } from '@supabase/supabase-js'
import { authenticatedBilling, billingBody, billingFailure, billingResponse, assertBillingVersion } from '@/lib/billing/server'
import { requireAuditMembership } from '@/lib/accountRepository'
import { AccountError } from '@/lib/accountPolicy'
import {
    approveBillingPayment,
    customerKeyFor,
    getPaymentByOrderId,
    issueBillingKey,
    isDefinitiveBillingFailureCode,
    TossApiError,
} from '@/lib/toss'
import {
    PRO_MONTHLY_PRICE,
    PRO_PERIOD_DAYS,
    PRO_ORDER_NAME,
    generateOrderId,
} from '@/lib/billing/plan'
import { committedReferralPending, lookupReferrer, referralEligibilityFailure } from '@/lib/billing/referral'
import type { BillingSetupResponse } from '@/lib/billing/types'

// 토스 API 를 두 번(빌링키 발급 → 결제 승인) 호출하므로 기본 타임아웃을 넉넉히 잡는다.
export const maxDuration = 30


/** 결제 실패를 이력에 남긴다. 남기지 못해도 사용자 응답을 막지는 않는다. */
async function logFailure(
    admin: SupabaseClient,
    userId: string,
    orderId: string,
    code: string,
    message: string
) {
    const { error } = await admin.from('cpa_payment_log').insert({
        user_id: userId,
        status: 'failed',
        amount: PRO_MONTHLY_PRICE,
        toss_order_id: orderId,
        failure_code: code,
        failure_message: message,
    })
    if (error) console.error('[billing/setup] 실패 이력 기록 실패:', error)
}

/** Card authentication callback: persist one order before any external charge. */
export async function POST(req: Request) {
    try { return await setup(req) } catch (error) { return billingFailure(error) }
}

async function setup(req: Request) {
    const body = await billingBody(req)
    const { user, membership, admin } = await authenticatedBilling()
    assertBillingVersion(body.membershipVersion, membership.membership_version)
    const { authKey, customerKey, referrerNickname } = body
    if (typeof authKey !== 'string' || !authKey || authKey.length > 512 || typeof customerKey !== 'string' || customerKey.length > 300) {
        return billingResponse(
            { error: 'INVALID_REQUEST', message: '카드 등록 정보가 올바르지 않습니다.' },
            { status: 400 }
        )
    }

    // customerKey 는 빌링키와 짝을 이뤄야만 결제가 나는 값이다. 남의 customerKey 로
    // 발급을 시도하는 경로를 여기서 닫는다 — 서버가 같은 값을 다시 계산해 대조한다.
    let expectedCustomerKey: string
    try {
        expectedCustomerKey = customerKeyFor(user.id)
    } catch (err) {
        const code = err instanceof TossApiError ? err.code : 'TOSS_NOT_CONFIGURED'
        return billingResponse(
            { error: code, message: '결제가 아직 설정되지 않았습니다.' },
            { status: 503 }
        )
    }

    if (customerKey !== expectedCustomerKey) {
        return billingResponse(
            { error: 'CUSTOMER_KEY_MISMATCH', message: '카드 등록 정보가 올바르지 않습니다.' },
            { status: 400 }
        )
    }

    // 2. Toss 호출 전에 사용자별 setup을 선점하고 회차 orderId를 DB에 고정한다.
    const requestedOrderId = generateOrderId()
    const requestedClaimToken = crypto.randomUUID()
    const { data: claimData, error: claimErr } = await admin
        .rpc('cpa_begin_subscription_setup', {
            p_user_id: user.id,
            p_order_id: requestedOrderId,
            p_claim_token: requestedClaimToken,
            p_lease_seconds: 120,
            p_membership_version: membership.membership_version,
        })
        .maybeSingle()

    if (claimErr || !claimData) {
        console.error('[billing/setup] setup 선점 실패:', claimErr)
        return billingResponse(
            { error: 'SETUP_CLAIM_FAILED', message: '결제 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
            { status: 500 }
        )
    }

    const claim = claimData as {
        action: string
        subscription_id: number
        order_id: string | null
        claim_token: string | null
        billing_key: string | null
    }
    if (claim.action !== 'started' && claim.action !== 'resumed') {
        const already = claim.action === 'already_subscribed'
        return billingResponse(
            {
                error: already ? 'ALREADY_SUBSCRIBED' : 'BILLING_IN_PROGRESS',
                message: already
                    ? '이미 구독 중입니다.'
                    : '이전 결제 결과를 확인하고 있습니다. 잠시 후 다시 시도해 주세요.',
            },
            { status: 409 }
        )
    }
    if (!claim.order_id || !claim.claim_token) {
        return billingResponse(
            { error: 'INVALID_SETUP_CLAIM', message: '결제 준비 상태를 확인하지 못했습니다.' },
            { status: 500 }
        )
    }

    const abortSetup = async (definitive: boolean) => {
        const { error } = await admin.rpc('cpa_abort_subscription_setup', {
            p_subscription_id: claim.subscription_id,
            p_claim_token: claim.claim_token,
            p_order_id: claim.order_id,
            p_definitive: definitive,
        })
        if (error) console.error('[billing/setup] setup 해제 실패:', error)
    }

    // 추천 관계는 결제 전에 준비하고, 성공 원장과 같은 DB transaction에서만 결속한다.
    let referralId: number | null
    try {
        referralId = await prepareReferralIfAny(admin, user.id, membership.membership_version, referrerNickname, claim.order_id)
    } catch (error) {
        await abortSetup(claim.action !== 'resumed')
        throw error
    }

    // 3. 재시도된 setup이면 저장된 빌링키를 쓴다. 새 발급 결과는 결제 전에 저장한다.
    let billingKey = claim.billing_key
    if (!billingKey) {
        try {
            const billing = await issueBillingKey(authKey, customerKey)
            billingKey = billing.billingKey
            const { data: attached, error: attachErr } = await admin.rpc('cpa_set_subscription_setup_billing_key', {
                p_subscription_id: claim.subscription_id,
                p_claim_token: claim.claim_token,
                p_order_id: claim.order_id,
                p_billing_key: billingKey,
                p_customer_key: customerKey,
            })
            if (attachErr || attached !== true) throw attachErr ?? new Error('SETUP_CLAIM_LOST')
        } catch (err) {
            if (billingKey) {
                const { error: cleanupErr } = await admin.rpc('cpa_enqueue_billing_key_cleanup', {
                    p_user_id: user.id,
                    p_subscription_id: claim.subscription_id,
                    p_billing_key: billingKey,
                })
                if (cleanupErr) console.error('[billing/setup] 고아 빌링키 cleanup 기록 실패:', cleanupErr)
            }
            await abortSetup(true)
            const e = err instanceof TossApiError ? err : null
            console.error('[billing/setup] 빌링키 발급·저장 실패:', err)
            return billingResponse(
                {
                    error: e?.code || 'BILLING_KEY_FAILED',
                    message: e?.message || '카드 등록에 실패했습니다. 다시 시도해 주세요.',
                },
                { status: e && e.status < 500 ? 400 : 502 }
            )
        }
    }

    // 4. 첫 결제. review 재개에서는 새 authKey/카드로 다시 승인하지 않고 기존 주문만 조회한다.
    if (claim.action !== 'resumed') {
        try {
            const beforeCharge = await requireAuditMembership(user.id)
            assertBillingVersion(membership.membership_version, beforeCharge.membership_version)
        } catch (error) {
            // Withdrawal may happen while Toss issues the key; do not initiate another charge.
            const { error: cleanupError } = await admin.rpc('cpa_enqueue_billing_key_cleanup', {
                p_user_id: user.id, p_subscription_id: claim.subscription_id, p_billing_key: billingKey,
            })
            if (cleanupError) console.error('[billing/setup] 카드 정리 등록 실패:', cleanupError)
            await abortSetup(true)
            throw error
        }
    }
    let payment: Awaited<ReturnType<typeof approveBillingPayment>>
    if (claim.action === 'resumed') {
        try {
            const recovered = await getPaymentByOrderId(claim.order_id)
            if (!recovered.paymentKey || recovered.status !== 'DONE'
                || recovered.orderId !== claim.order_id || recovered.totalAmount !== PRO_MONTHLY_PRICE) {
                throw new TossApiError('PAYMENT_RECONCILIATION_PENDING', '이전 결제 결과를 아직 확인할 수 없습니다.', 503)
            }
            payment = {
                paymentKey: recovered.paymentKey,
                orderId: recovered.orderId,
                status: recovered.status,
                totalAmount: recovered.totalAmount,
                approvedAt: recovered.approvedAt ?? null,
                receiptUrl: recovered.receipt?.url ?? null,
            }
        } catch (err) {
            await abortSetup(false)
            console.error('[billing/setup] 이전 첫 결제 조회 실패:', err)
            return billingResponse(
                { error: 'PAYMENT_RECONCILIATION_PENDING', message: '이전 결제 결과를 확인하고 있습니다. 새 카드로 다시 청구하지 않았습니다.' },
                { status: 409 }
            )
        }
    } else try {
        payment = await approveBillingPayment({
            billingKey,
            customerKey,
            amount: PRO_MONTHLY_PRICE,
            orderId: claim.order_id,
            orderName: PRO_ORDER_NAME,
            customerEmail: user.email ?? null,
        })
    } catch (err) {
        const e = err instanceof TossApiError ? err : null
        const definitive = isDefinitiveBillingFailureCode(e?.code)
        await abortSetup(definitive)
        console.error('[billing/setup] 첫 결제 실패:', err)
        if (definitive) {
            await logFailure(admin, user.id, claim.order_id, e?.code || 'PAYMENT_FAILED', e?.message || '결제에 실패했습니다.')
        }
        return billingResponse(
            {
                error: definitive ? (e?.code || 'PAYMENT_FAILED') : 'PAYMENT_RESULT_UNKNOWN',
                message: definitive
                    ? (e?.message || '결제에 실패했습니다. 카드 정보를 확인해 주세요.')
                    : '결제 결과를 확인하고 있습니다. 다시 결제하지 말고 잠시 후 재시도해 주세요.',
            },
            { status: definitive ? 400 : 503 }
        )
    }

    // 5. 구독·기간·등급·성공 원장을 한 DB transaction으로 확정한다.
    const { data: periodEnd, error: finalizeErr } = await admin.rpc('cpa_finalize_subscription_setup', {
        p_subscription_id: claim.subscription_id,
        p_claim_token: claim.claim_token,
        p_order_id: claim.order_id,
        p_payment_key: payment.paymentKey,
        p_amount: payment.totalAmount,
        p_days: PRO_PERIOD_DAYS,
        p_referral_id: referralId,
    })
    if (finalizeErr || typeof periodEnd !== 'string') {
        console.error('[billing/setup] 결제 후 원자 확정 실패:', finalizeErr)
        return billingResponse(
            { error: 'SUBSCRIPTION_FINALIZE_FAILED', message: '결제는 완료되었으나 구독 반영을 확인하지 못했습니다. 문의해 주세요.' },
            { status: 500 }
        )
    }

    const response: BillingSetupResponse = {
        success: true,
        periodEnd,
        referralPending: await committedReferralPending(admin, user.id, claim.order_id, payment.paymentKey),
        receiptUrl: payment.receiptUrl,
    }
    return billingResponse(response)
}

/**
 * 추천 관계를 결제 전에 준비한다. 실제 결제 결속은 finalize_subscription_setup 안에서
 * 성공 원장 INSERT와 함께 수행하므로 프로세스 중단으로 둘 중 하나만 남지 않는다.
 */
async function prepareReferralIfAny(
    admin: SupabaseClient,
    userId: string,
    membershipVersion: number,
    referrerNickname: unknown,
    orderId: string
): Promise<number | null> {
    const { data: existing, error: lookupError } = await admin.from('cpa_referral')
        .select('id,status,referee_membership_version').eq('referee_id', userId).maybeSingle()
    if (lookupError) throw new AccountError('추천인 등록 상태를 확인하지 못했습니다.', 503)
    const hasNickname = referrerNickname !== undefined && referrerNickname !== null && referrerNickname !== ''
    if (existing) {
        if (existing.status !== 'pending' || existing.referee_membership_version !== membershipVersion) {
            if (hasNickname) throw new AccountError('이미 추천인이 등록되어 있습니다.', 409)
            return null
        }
        const failure = await referralEligibilityFailure(admin, userId, orderId)
        if (failure) {
            // An unused pending referral must not prevent normal resubscription.
            if (!hasNickname && failure.code === 'REFERRAL_NOT_ELIGIBLE') return null
            throw new AccountError(failure.message, failure.status)
        }
        return existing.id
    }
    if (!hasNickname) return null
    const lookup = await lookupReferrer(admin, referrerNickname, userId)
    if (!lookup.ok) throw new AccountError(lookup.failure.message, lookup.failure.status)
    const { data: created, error } = await admin.from('cpa_referral').insert({
        referrer_id: lookup.referrer.id, referee_id: userId,
        referrer_membership_version: lookup.referrer.membership_version,
        referee_membership_version: membershipVersion, status: 'pending',
    }).select('id').single()
    if (error || !created) {
        // A simultaneous register may have won. Reuse its immutable relation only.
        if (error?.code === '23505') {
            const { data: winner, error: winnerError } = await admin.from('cpa_referral')
                .select('id,status,referee_membership_version').eq('referee_id', userId).maybeSingle()
            if (!winnerError && winner?.status === 'pending' && winner.referee_membership_version === membershipVersion) return winner.id
        }
        throw new AccountError('추천인 등록에 실패했습니다. 다시 확인해 주세요.', 409)
    }
    return created.id
}
