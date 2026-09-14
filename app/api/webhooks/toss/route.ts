import { createHmac } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { AccountError } from '@/lib/accountPolicy'
import { verifyTossSignature } from '@/lib/billing/webhook'
import { getPayment } from '@/lib/toss'
import { readBillingText } from '@/lib/billing/http'

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024

/**
 * Billing approval is recorded by the setup route/worker. Later cancellations are
 * re-read from Toss before any database mutation because payment webhooks are unsigned.
 * https://docs.tosspayments.com/reference/using-api/webhook-events
 */
interface TossWebhookBody {
    eventType?: string
    createdAt?: string
    billingKey?: string
    data?: {
        paymentKey?: string
        orderId?: string
        status?: string
        billingKey?: string
        reason?: string
    }
}

function webhookIpActor(req: Request): string {
    const forwarded =
        req.headers.get('x-vercel-forwarded-for') ||
        req.headers.get('cf-connecting-ip') ||
        req.headers.get('x-real-ip') ||
        req.headers.get('x-forwarded-for') ||
        'unknown'
    const ip = forwarded.split(',')[0].trim().slice(0, 100)
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw new Error('RATE_LIMIT_SECRET_MISSING')
    return `ip:${createHmac('sha256', secret).update(ip).digest('hex')}`
}

/** 결제가 취소·환불됐을 때: 이력을 고치고 구독을 끊고 등급을 즉시 내린다. */
async function handlePaymentCancelled(
    admin: SupabaseClient,
    paymentKey: string,
    status: string,
    actualOrderId: string | null,
    actualTotalAmount: number | null
) {
    const { data: log, error: logLookupErr } = await admin
        .from('cpa_payment_log')
        .select('id, user_id, subscription_id, toss_order_id, amount')
        .eq('toss_payment_key', paymentKey)
        .maybeSingle()

    if (logLookupErr) throw logLookupErr

    // 성공 원장이 아직 커밋 전일 수 있으므로, Toss에서 확인한 identity를 inbox에 보관한다.
    if (!log) {
        if (!actualOrderId || actualTotalAmount === null) throw new Error('TOSS_PAYMENT_MISMATCH')
        // Shared Supabase / merchant credentials must never create records for the CTA service.
        if (!actualOrderId.startsWith('cpa_')) return
        const { data: recorded, error: recordErr } = await admin.rpc('cpa_record_verified_payment_cancellation', {
            p_payment_key: paymentKey,
            p_order_id: actualOrderId,
            p_amount: actualTotalAmount,
            p_partial: status === 'PARTIAL_CANCELED',
        })
        if (recordErr) throw recordErr
        if (recorded !== true) throw new Error('PAYMENT_CANCELLATION_NOT_RECORDED')
        return
    }

    if (actualOrderId !== log.toss_order_id || actualTotalAmount !== log.amount) {
        throw new Error('TOSS_PAYMENT_MISMATCH')
    }

    const partial = status === 'PARTIAL_CANCELED'
    const { data: applied, error: applyErr } = await admin.rpc('cpa_apply_verified_payment_cancellation', {
        p_payment_key: paymentKey,
        p_partial: partial,
    })
    if (applyErr) throw applyErr
    if (applied !== true) throw new Error('PAYMENT_LOG_NOT_FOUND')

    console.log(`[webhooks/toss] 결제 ${partial ? 'refunded' : 'cancelled'} 처리 — user=${log.user_id}`)
}

/**
 * 빌링키가 삭제됐을 때: 그 키로는 더 이상 결제를 낼 수 없으므로 구독에서 지우고
 * 자동 갱신을 끈다. 남은 기간은 그대로 두며 만료되면 pg_cron 이 강등한다.
 *
 * 우리가 해지 처리 중에 삭제한 경우에도 이 웹훅이 온다. 그때는 이미 같은 상태라
 * 아래 UPDATE 가 사실상 무해한 재적용이 된다(멱등).
 */
async function handleBillingDeleted(admin: SupabaseClient, billingKey: string) {
    const { error } = await admin
        .from('cpa_subscription')
        .update({
            toss_billing_key: null,
            cancel_at_period_end: true,
            next_retry_at: null,
        })
        .eq('toss_billing_key', billingKey)
    if (error) throw error
}

export async function POST(req: Request) {
    // 서명 검증은 원문 문자열이어야 한다 — JSON 을 파싱했다가 다시 문자열로 만들면
    // 키 순서·공백이 달라져 해시가 어긋난다.
    let rawBody: string
    try { rawBody = await readBillingText(req, MAX_WEBHOOK_BODY_BYTES) }
    catch (error) {
        return NextResponse.json({ error: 'INVALID_WEBHOOK_BODY' }, { status: error instanceof AccountError ? error.status : 400 })
    }

    const signature = req.headers.get('tosspayments-webhook-signature')
    const transmissionTime = req.headers.get('tosspayments-webhook-transmission-time')

    if (signature && (!transmissionTime || !verifyTossSignature(rawBody, signature, transmissionTime, process.env.CPA_TOSS_WEBHOOK_SECRET))) {
        console.warn('[webhooks/toss] 서명 검증 실패 — 요청을 버립니다.')
        return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
    }

    let body: TossWebhookBody
    try {
        body = JSON.parse(rawBody) as TossWebhookBody
    } catch {
        // 재전송해도 같은 본문이 온다 — 200 으로 끊는다.
        console.warn('[webhooks/toss] JSON 이 아닌 본문')
        return NextResponse.json({ received: true })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        console.warn('[webhooks/toss] JSON 객체가 아닌 본문')
        return NextResponse.json({ received: true })
    }

    const eventType = body.eventType
    try {
        const admin = getSupabaseAdmin()
        if (eventType === 'PAYMENT_STATUS_CHANGED' || eventType === 'CANCEL_STATUS_CHANGED') {
            const paymentKey = body.data?.paymentKey
            if (typeof paymentKey !== 'string' || !paymentKey || paymentKey.length > 200) return NextResponse.json({ received: true })

            // 서명 없는 결제 이벤트가 무제한 Toss 조회를 유발하지 못하도록 공유 DB에서
            // 발신 IP별 외부 조회 횟수를 제한한다. limiter 장애도 비용 경계를 열지 않는다.
            const { data: allowed, error: rateError } = await admin.rpc('consume_rate_limit', {
                p_key: `cpa:billing:webhook:${webhookIpActor(req)}`,
                p_limit: 120, p_window_seconds: 60,
            })
            if (rateError) throw rateError
            if (allowed !== true) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })

            // **본문의 status 를 믿지 않는다.** 결제 웹훅에는 서명이 없으므로 토스에
            // 직접 물어 확인된 상태로만 판단한다.
            const actual = await getPayment(paymentKey)
            if (actual.paymentKey !== paymentKey) throw new Error('TOSS_PAYMENT_MISMATCH')

            if (actual.status === 'CANCELED' || actual.status === 'PARTIAL_CANCELED') {
                await handlePaymentCancelled(
                    admin,
                    paymentKey,
                    actual.status,
                    actual.orderId,
                    actual.totalAmount
                )
            }
            // DONE·기타 상태는 우리 쪽에서 할 일이 없다. 자동결제 성공은 승인 API 응답으로
            // 이미 기록됐고, 웹훅으로 다시 오지도 않는다.
            return NextResponse.json({ received: true })
        }

        if (eventType === 'BILLING_DELETED') {
            // 결제 웹훅에는 Toss 서명이 붙지 않는다. billingKey만으로 service-role UPDATE를
            // 수행하면 노출된 키를 가진 제3자가 자동 갱신을 끌 수 있으므로, 서명이 실제로
            // 검증된 요청 외에는 알림으로만 소비한다.
            if (!signature || !transmissionTime) {
                console.warn('[webhooks/toss] 서명 없는 BILLING_DELETED는 DB를 변경하지 않는다')
                return NextResponse.json({ received: true })
            }
            const billingKey = body.billingKey ?? body.data?.billingKey
            if (typeof billingKey === 'string' && billingKey.length <= 200) await handleBillingDeleted(admin, billingKey)
            return NextResponse.json({ received: true })
        }

        // 우리가 쓰지 않는 이벤트(가상계좌·브랜드페이·지급대행 등). 재전송이 무의미하므로 200.
        return NextResponse.json({ received: true })
    } catch (err) {
        // DB·네트워크 실패는 재전송으로 회복될 수 있다. 500 으로 재전송을 유도한다.
        console.error(`[webhooks/toss] ${eventType} 처리 실패:`, err)
        return NextResponse.json({ error: 'WEBHOOK_PROCESSING_FAILED' }, { status: 500 })
    }
}
