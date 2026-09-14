/**
 * process-cpa-billing — pg_cron/service_role 전용 정기결제 worker.
 *
 * 결제 회차는 DB RPC가 원자적으로 선점하고 orderId를 먼저 영속화한다. Toss 응답이
 * 유실되면 같은 orderId와 Idempotency-Key로만 재시도하므로 새 청구가 생기지 않는다.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const PRO_MONTHLY_PRICE = 9900
const PRO_PERIOD_DAYS = 30
const PRO_ORDER_NAME = "Audit Say pro 구독 (1개월)"
const MAX_BILLING_RETRIES = 3
const CLAIM_LEASE_SECONDS = 120
// 승인과 orderId 조회가 모두 timeout 나도 DB lease보다 먼저 끝난다.
const BILLING_TIMEOUT_MS = 45_000

const TOSS_API_BASE = "https://api.tosspayments.com/v1"

interface BillingCandidate {
    id: number
}

interface ClaimedBillingKeyCleanup {
    id: number
    billing_key: string
}

interface ClaimedSubscription {
    id: number
    user_id: string | null
    membership_version: number
    billing_setup_state: "pending" | "review" | null
    status: string
    current_period_end: string
    toss_billing_key: string
    toss_customer_key: string
    retry_count: number
    order_id: string
    reconcile_only: boolean
    cancel_at_period_end: boolean
}

interface TossPaymentResponse {
    status?: string
    orderId?: string
    totalAmount?: number
    paymentKey?: string
    code?: string
    message?: string
    failure?: { code?: string; message?: string } | null
}

type ApprovalResult =
    | { outcome: "success"; orderId: string; paymentKey: string }
    | { outcome: "declined" | "unknown"; orderId: string; code: string; message: string }

const DEFINITIVE_BILLING_FAILURE_CODES = new Set([
    "INVALID_STOPPED_CARD", "INVALID_REJECT_CARD", "INVALID_CARD_EXPIRATION",
    "INVALID_CARD_NUMBER", "INVALID_BILL_KEY_REQUEST", "NOT_SUPPORTED_CARD_TYPE",
    "NOT_MATCHES_CUSTOMER_KEY", "NOT_REGISTERED_CARD_COMPANY", "REJECT_CARD_PAYMENT",
    "REJECT_ACCOUNT_PAYMENT", "REJECT_CARD_COMPANY", "EXCEED_MAX_AUTH_COUNT",
])
const TERMINAL_PAYMENT_STATUSES = new Set(["ABORTED", "CANCELED", "EXPIRED"])

function isDefinitiveDeclineCode(code: unknown): boolean {
    // DUPLICATED_ORDER_ID·5xx·network 오류는 이전 승인이 성립했을 수 있어 제외한다.
    return typeof code === "string" && DEFINITIVE_BILLING_FAILURE_CODES.has(code)
}

/** 결제 실패 후 다음 재시도 시각. 앱 상수와의 회귀 검증을 위해 유지한다. */
function calcNextRetryAt(retryCount: number, now: Date = new Date()): Date | null {
    const HOUR = 60 * 60 * 1000
    if (retryCount === 1) return new Date(now.getTime() + 1 * HOUR)
    if (retryCount === 2) return new Date(now.getTime() + 12 * HOUR)
    if (retryCount === 3) return new Date(now.getTime() + 24 * HOUR)
    return null
}

function authorizationHeader(secretKey: string): string {
    return `Basic ${btoa(`${secretKey}:`)}`
}

function approvedResultFromBody(body: TossPaymentResponse | null, sub: ClaimedSubscription): ApprovalResult | null {
    if (
        body?.status !== "DONE" ||
        body?.orderId !== sub.order_id ||
        body?.totalAmount !== PRO_MONTHLY_PRICE ||
        typeof body?.paymentKey !== "string" ||
        body.paymentKey.length === 0
    ) return null
    return { outcome: "success", orderId: sub.order_id, paymentKey: body.paymentKey }
}

async function recoverPaymentByOrderId(
    secretKey: string,
    sub: ClaimedSubscription,
): Promise<ApprovalResult | null> {
    try {
        const res = await fetch(`${TOSS_API_BASE}/payments/orders/${encodeURIComponent(sub.order_id)}`, {
            method: "GET",
            headers: { Authorization: authorizationHeader(secretKey) },
            signal: AbortSignal.timeout(BILLING_TIMEOUT_MS),
        })
        if (!res.ok) return null
        const body = await res.json().catch(() => null) as TossPaymentResponse | null
        const approved = approvedResultFromBody(body, sub)
        if (approved) return approved
        if (body?.orderId === sub.order_id && body.status && TERMINAL_PAYMENT_STATUSES.has(body.status)) {
            return {
                outcome: "declined",
                orderId: sub.order_id,
                code: `PAYMENT_${body.status}`,
                message: body.failure?.message || `결제가 ${body.status} 상태로 종료되었습니다.`,
            }
        }
        return null
    } catch {
        return null
    }
}

/** 길이도 내용도 일정한 루프로 비교해 고권한 bearer 값의 조기 불일치를 노출하지 않는다. */
function constantTimeEqual(left: string, right: string): boolean {
    const encoder = new TextEncoder()
    const a = encoder.encode(left)
    const b = encoder.encode(right)
    const size = Math.max(a.length, b.length)
    let difference = a.length ^ b.length
    for (let i = 0; i < size; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0)
    return difference === 0
}

async function approveBilling(
    secretKey: string,
    sub: ClaimedSubscription,
    customerEmail: string | null,
): Promise<ApprovalResult> {
    try {
        const res = await fetch(`${TOSS_API_BASE}/billing/${encodeURIComponent(sub.toss_billing_key)}`, {
            method: "POST",
            headers: {
                Authorization: authorizationHeader(secretKey),
                "Content-Type": "application/json",
                "Idempotency-Key": sub.order_id,
            },
            body: JSON.stringify({
                customerKey: sub.toss_customer_key,
                amount: PRO_MONTHLY_PRICE,
                orderId: sub.order_id,
                orderName: PRO_ORDER_NAME,
                ...(customerEmail ? { customerEmail } : {}),
            }),
            signal: AbortSignal.timeout(BILLING_TIMEOUT_MS),
        })

        const body = await res.json().catch(() => null) as TossPaymentResponse | null
        if (!res.ok) {
            const code = typeof body?.code === "string" ? body.code : `HTTP_${res.status}`
            if (!isDefinitiveDeclineCode(code)) {
                const recovered = await recoverPaymentByOrderId(secretKey, sub)
                if (recovered) return recovered
            }
            return {
                outcome: res.status < 500 && isDefinitiveDeclineCode(code) ? "declined" : "unknown",
                orderId: sub.order_id,
                code,
                message: typeof body?.message === "string" ? body.message : "결제 승인에 실패했습니다.",
            }
        }

        const approved = approvedResultFromBody(body, sub)
        if (!approved) {
            const recovered = await recoverPaymentByOrderId(secretKey, sub)
            if (recovered) return recovered
            return {
                outcome: "unknown",
                orderId: sub.order_id,
                code: "INVALID_TOSS_RESPONSE",
                message: "토스 승인 응답의 상태·주문번호·금액을 확인할 수 없습니다.",
            }
        }

        return approved
    } catch (err) {
        const recovered = await recoverPaymentByOrderId(secretKey, sub)
        if (recovered) return recovered
        return {
            outcome: "unknown",
            orderId: sub.order_id,
            code: "NETWORK_ERROR",
            message: err instanceof Error ? err.message : "결제 서버 응답을 확인하지 못했습니다.",
        }
    }
}

async function sendPaymentFailureNotification(
    userId: string,
    reason: string,
) {
    console.log(`[결제 실패 알림] userId=${userId} reason=${reason}`)
}

async function claimSubscription(
    admin: SupabaseClient,
    candidate: BillingCandidate,
    trigger: "cron" | "retry",
    claimToken: string,
): Promise<ClaimedSubscription | null> {
    const { data, error } = await admin
        .rpc("cpa_claim_subscription_billing", {
            p_subscription_id: candidate.id,
            p_trigger: trigger,
            p_claim_token: claimToken,
            p_lease_seconds: CLAIM_LEASE_SECONDS,
        })
        .maybeSingle()

    if (error) throw error
    return data as ClaimedSubscription | null
}

async function finalizeSuccess(
    admin: SupabaseClient,
    sub: ClaimedSubscription,
    claimToken: string,
    result: Extract<ApprovalResult, { outcome: "success" }>,
) {
    if (sub.billing_setup_state !== null) {
        const { data, error } = await admin.rpc("cpa_finalize_subscription_setup", {
            p_subscription_id: sub.id,
            p_claim_token: claimToken,
            p_order_id: result.orderId,
            p_payment_key: result.paymentKey,
            p_amount: PRO_MONTHLY_PRICE,
            p_days: PRO_PERIOD_DAYS,
            p_referral_id: null,
        })
        if (error) throw error
        if (data === null) throw new Error("BILLING_CLAIM_LOST")
        return
    }
    const { data, error } = await admin.rpc("cpa_finalize_billing_success", {
        p_subscription_id: sub.id,
        p_claim_token: claimToken,
        p_order_id: result.orderId,
        p_payment_key: result.paymentKey,
        p_amount: PRO_MONTHLY_PRICE,
        p_days: PRO_PERIOD_DAYS,
    })
    if (error) throw error
    if (data !== true) throw new Error("BILLING_CLAIM_LOST")
}

async function finalizeFailure(
    admin: SupabaseClient,
    sub: ClaimedSubscription,
    claimToken: string,
    result: Exclude<ApprovalResult, { outcome: "success" }>,
) {
    const definitive = result.outcome === "declined"
    if (sub.billing_setup_state !== null) {
        const { data, error } = await admin.rpc("cpa_abort_subscription_setup", {
            p_subscription_id: sub.id,
            p_claim_token: claimToken,
            p_order_id: result.orderId,
            p_definitive: definitive,
        })
        if (error) throw error
        if (data !== true) throw new Error("BILLING_CLAIM_LOST")
        return
    }
    const { data, error } = await admin.rpc("cpa_finalize_billing_failure", {
        p_subscription_id: sub.id,
        p_claim_token: claimToken,
        p_order_id: result.orderId,
        p_code: result.code,
        p_message: result.message,
        p_definitive: definitive,
    })
    if (error) throw error
    if (data !== true) throw new Error("BILLING_CLAIM_LOST")

    if (definitive && sub.user_id !== null) {
        const retryCount = sub.retry_count + 1
        const exhausted = retryCount > MAX_BILLING_RETRIES || calcNextRetryAt(retryCount) === null
        await sendPaymentFailureNotification(
            sub.user_id,
            exhausted
                ? `${result.code} (재시도 소진 — 구독 만료)`
                : `${result.code} (재시도 ${retryCount}회차)`,
        )
    }
}

async function processOne(
    admin: SupabaseClient,
    secretKey: string,
    candidate: BillingCandidate,
    trigger: "cron" | "retry",
): Promise<"success" | "failed" | "unknown" | "skipped" | "error"> {
    const claimToken = crypto.randomUUID()
    try {
        const sub = await claimSubscription(admin, candidate, trigger, claimToken)
        if (!sub) return "skipped"

        // The account may have ended after the claim. Recheck the captured service
        // epoch immediately before a fresh provider charge; retained anonymous
        // finance rows never call Auth or the approval endpoint.
        const { data: entitlementAllowed, error: membershipError } = sub.user_id === null
            ? { data: false, error: null }
            : await admin.rpc("common_cpa_entitlement_allowed", {
                p_user_id: sub.user_id,
                p_membership_version: sub.membership_version,
            })
        if (membershipError) throw membershipError
        let result: ApprovalResult
        if (sub.user_id === null || entitlementAllowed !== true || (sub.reconcile_only && sub.cancel_at_period_end)) {
            result = await recoverPaymentByOrderId(secretKey, sub) ?? {
                outcome: "unknown",
                orderId: sub.order_id,
                code: "ORDER_RECONCILIATION_PENDING",
                message: "기존 주문 결과를 아직 확인하지 못했습니다.",
            }
        } else {
            const { data: authUser } = await admin.auth.admin.getUserById(sub.user_id)
            result = await approveBilling(secretKey, sub, authUser?.user?.email ?? null)
        }

        if (result.outcome === "success") {
            await finalizeSuccess(admin, sub, claimToken, result)
            return "success"
        }

        await finalizeFailure(admin, sub, claimToken, result)
        return result.outcome === "declined" ? "failed" : "unknown"
    } catch (err) {
        console.error(`[process-cpa-billing] 구독 ${candidate.id} 처리 중 예외:`, err)
        return "error"
    }
}

async function expireRewardOnlySubscriptions(admin: SupabaseClient): Promise<number> {
    const { data, error } = await admin
        .from("cpa_subscription")
        .update({ status: "expired" })
        .is("toss_billing_key", null)
        .is("billing_setup_state", null)
        .eq("status", "active")
        .lte("current_period_end", new Date().toISOString())
        .select("id")

    if (error) throw error
    return data?.length ?? 0
}

async function grantMatureReferralRewards(admin: SupabaseClient): Promise<number> {
    const { data, error } = await admin.rpc("cpa_grant_mature_referral_rewards", { p_limit: 200 })
    if (error) throw error
    return typeof data === "number" ? data : 0
}

async function processBillingKeyCleanups(admin: SupabaseClient, secretKey: string): Promise<number> {
    let completed = 0
    for (let index = 0; index < 100; index++) {
        const claimToken = crypto.randomUUID()
        const { data, error } = await admin.rpc("cpa_claim_billing_key_cleanup", {
            p_claim_token: claimToken,
            p_lease_seconds: CLAIM_LEASE_SECONDS,
        }).maybeSingle()
        if (error) throw error
        const cleanup = data as ClaimedBillingKeyCleanup | null
        if (!cleanup) break

        let succeeded = false
        let failure: string | null = null
        try {
            const response = await fetch(`${TOSS_API_BASE}/billing/${encodeURIComponent(cleanup.billing_key)}`, {
                method: "DELETE",
                headers: { Authorization: authorizationHeader(secretKey) },
                signal: AbortSignal.timeout(BILLING_TIMEOUT_MS),
            })
            succeeded = response.ok || response.status === 404
            if (!succeeded) failure = `HTTP_${response.status}`
        } catch (error) {
            failure = error instanceof Error ? error.message : "cleanup request failed"
        }

        const { data: finalized, error: finalizeError } = await admin.rpc("cpa_finalize_billing_key_cleanup", {
            p_id: cleanup.id,
            p_claim_token: claimToken,
            p_succeeded: succeeded,
            p_error: failure,
        })
        if (finalizeError) throw finalizeError
        if (finalized !== true) throw new Error("BILLING_KEY_CLEANUP_CLAIM_LOST")
        if (succeeded) completed++
    }
    return completed
}

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { Allow: "POST" } })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
        return Response.json({ error: "SUPABASE_ENV_MISSING" }, { status: 500 })
    }

    const expectedAuthorization = `Bearer ${serviceRoleKey}`
    if (!constantTimeEqual(req.headers.get("authorization") ?? "", expectedAuthorization)) {
        return Response.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const tossSecretKey = Deno.env.get("CPA_TOSS_SECRET_KEY")
    if (!tossSecretKey) {
        return Response.json({ error: "CPA_TOSS_SECRET_KEY_MISSING" }, { status: 500 })
    }

    let trigger: "cron" | "retry"
    try {
        const body = await req.json()
        if (body?.trigger !== "cron" && body?.trigger !== "retry") throw new Error("invalid trigger")
        trigger = body.trigger
    } catch {
        return Response.json({ error: "INVALID_TRIGGER" }, { status: 400 })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })

    const nowIso = new Date().toISOString()
    let query = admin.from("cpa_subscription").select("id")
    if (trigger === "retry") {
        query = query
            .in("status", ["active", "past_due", "cancelled", "expired"])
            .not("next_retry_at", "is", null)
            .lte("next_retry_at", nowIso)
            .or('cancel_at_period_end.eq.false,billing_order_id.not.is.null')
    } else {
        query = query
            .in("status", ["active", "cancelled", "expired"])
            .or(`billing_order_id.not.is.null,and(cancel_at_period_end.eq.false,current_period_end.lte.${nowIso})`)
    }

    const { data: targets, error } = await query.limit(200)
    if (error) {
        console.error("[process-cpa-billing] 대상 조회 실패:", error)
        return Response.json({ error: "QUERY_FAILED" }, { status: 500 })
    }

    const tally = { success: 0, failed: 0, unknown: 0, skipped: 0, error: 0 }
    for (const candidate of (targets ?? []) as BillingCandidate[]) {
        tally[await processOne(admin, tossSecretKey, candidate, trigger)]++
    }

    let expired = 0
    let referralRewards = 0
    let billingKeysCleaned = 0
    try {
        expired = trigger === "cron" ? await expireRewardOnlySubscriptions(admin) : 0
        referralRewards = trigger === "cron" ? await grantMatureReferralRewards(admin) : 0
        billingKeysCleaned = await processBillingKeyCleanups(admin, tossSecretKey)
    } catch (expireError) {
        console.error("[process-cpa-billing] 만료·추천 보상 후처리 실패:", expireError)
        tally.error++
    }

    console.log(
        `[process-cpa-billing] trigger=${trigger} 후보=${targets?.length ?? 0} ` +
        `성공=${tally.success} 거절=${tally.failed} 불명=${tally.unknown} ` +
        `건너뜀=${tally.skipped} 오류=${tally.error} 보상만료=${expired} 추천확정=${referralRewards} 키정리=${billingKeysCleaned}`,
    )

    return Response.json({ trigger, candidates: targets?.length ?? 0, ...tally, expired, referralRewards, billingKeysCleaned })
})
