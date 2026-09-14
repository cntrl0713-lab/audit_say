import 'server-only'
/**
 * 토스페이먼츠 자동결제(빌링) API 클라이언트. **서버 전용.**
 *
 * 이 파일은 `CPA_TOSS_SECRET_KEY` 를 읽는다 — 절대 클라이언트 컴포넌트에서 import 하지 말 것.
 * (`NEXT_PUBLIC_` 접두사가 없으므로 브라우저 번들에 들어가면 값이 undefined 가 되어
 * 조용히 실패하지만, 애초에 import 하지 않는 것이 규칙이다.)
 *
 * 연동 방식은 **결제창(SDK) 방식**이다:
 *   1. 브라우저: `payment.requestBillingAuth({ method: 'CARD', successUrl, failUrl })`
 *   2. 토스: `successUrl?customerKey=...&authKey=...` 로 리다이렉트
 *   3. 서버: authKey → 빌링키 발급(`issueBillingKey`)
 *   4. 서버: 빌링키로 즉시 첫 결제(`approveBillingPayment`)
 *   5. 이후 매월: pg_cron → Edge Function 이 같은 승인 API 를 호출
 *
 * 토스는 스케줄링을 제공하지 않는다 — 결제 시점은 전적으로 우리가 정한다.
 *
 * 참고: https://docs.tosspayments.com/guides/v2/billing/integration
 */

import { createHmac } from 'node:crypto'

const TOSS_API_BASE = 'https://api.tosspayments.com/v1'
const TOSS_REQUEST_TIMEOUT_MS = 8_000

/** 토스 API 가 실패 응답으로 주는 형태. `code` 로 분기하고 `message` 는 그대로 보여 준다. */
export interface TossErrorBody {
    code: string
    message: string
}

/**
 * 토스 API 호출 실패. `code` 는 토스의 에러 코드(예: `REJECT_CARD_COMPANY`)이고,
 * 네트워크 오류처럼 토스에 닿지 못한 경우에는 `NETWORK_ERROR` 다.
 */
export class TossApiError extends Error {
    readonly code: string
    readonly status: number

    constructor(code: string, message: string, status: number) {
        super(message)
        this.name = 'TossApiError'
        this.code = code
        this.status = status
    }
}

/** 빌링키 발급 응답 중 우리가 쓰는 필드 */
export interface BillingKeyResult {
    billingKey: string
    customerKey: string
    method: string | null
    cardCompany: string | null
    cardNumber: string | null
}

/** 자동결제 승인(Payment 객체) 중 우리가 쓰는 필드 */
export interface BillingPaymentResult {
    paymentKey: string
    orderId: string
    status: string
    totalAmount: number
    approvedAt: string | null
    receiptUrl: string | null
}

interface TossPaymentResponse {
    paymentKey?: string
    orderId?: string
    status?: string
    totalAmount?: number
    approvedAt?: string | null
    receipt?: { url?: string | null } | null
    failure?: { code?: string; message?: string } | null
}

// Toss 「카드 자동결제 승인」 문서에서 이번 주문이 결제로 바뀌지 않았다고 확정할 수
// 있는 사용자·결제수단 오류만 열거한다. DUPLICATED_ORDER_ID·5xx·network 오류는 이전
// 승인이 성립했을 수 있으므로 포함하지 않고 같은 orderId 조회로만 복구한다.
const DEFINITIVE_BILLING_FAILURE_CODES = new Set([
    'INVALID_STOPPED_CARD',
    'INVALID_REJECT_CARD',
    'INVALID_CARD_EXPIRATION',
    'INVALID_CARD_NUMBER',
    'INVALID_BILL_KEY_REQUEST',
    'NOT_SUPPORTED_CARD_TYPE',
    'NOT_MATCHES_CUSTOMER_KEY',
    'NOT_REGISTERED_CARD_COMPANY',
    'REJECT_CARD_PAYMENT',
    'REJECT_ACCOUNT_PAYMENT',
    'REJECT_CARD_COMPANY',
    'EXCEED_MAX_AUTH_COUNT',
])

const TERMINAL_PAYMENT_STATUSES = new Set(['ABORTED', 'CANCELED', 'EXPIRED'])

export function isDefinitiveBillingFailureCode(code: unknown): boolean {
    return typeof code === 'string' && (
        DEFINITIVE_BILLING_FAILURE_CODES.has(code) ||
        [...TERMINAL_PAYMENT_STATUSES].some((status) => code === `PAYMENT_${status}`)
    )
}

function terminalPaymentError(data: TossPaymentResponse | null, expectedOrderId: string): TossApiError | null {
    if (!data || data.orderId !== expectedOrderId || !data.status || !TERMINAL_PAYMENT_STATUSES.has(data.status)) {
        return null
    }
    return new TossApiError(
        `PAYMENT_${data.status}`,
        data.failure?.message || `결제가 ${data.status} 상태로 종료되었습니다.`,
        400
    )
}

/**
 * 시크릿 키로 Basic 인증 헤더를 만든다.
 *
 * **키 뒤의 콜론을 빠뜨리면 안 된다.** 토스는 「비밀번호 없음」을 콜론으로 표현하며,
 * 빠뜨리면 `UNAUTHORIZED_KEY` 로 거절한다.
 */
function authorizationHeader(): string {
    const secretKey = process.env.CPA_TOSS_SECRET_KEY
    if (!secretKey) {
        throw new TossApiError(
            'TOSS_NOT_CONFIGURED',
            '결제가 아직 설정되지 않았습니다. 잠시 후 다시 시도해 주세요.',
            503
        )
    }
    return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

/** 결제 기능이 환경변수 수준에서 사용 가능한지. 화면이 결제 버튼을 감출 때 쓴다. */
export function isBillingConfigured(): boolean {
    return Boolean(process.env.CPA_TOSS_SECRET_KEY && process.env.NEXT_PUBLIC_CPA_TOSS_CLIENT_KEY)
}

/**
 * 토스 API 를 호출하고 실패를 `TossApiError` 로 정규화한다.
 *
 * 실패 응답의 본문을 읽지 않고 status 만 보면 「카드 한도 초과」와 「키 설정 오류」가
 * 같은 500으로 뭉개진다. 둘은 사용자에게 해야 할 말이 완전히 다르므로 코드를 살린다.
 */
async function tossFetch<T>(
    path: string,
    init: { method: string; body?: unknown; idempotencyKey?: string }
): Promise<T> {
    const headers: Record<string, string> = {
        Authorization: authorizationHeader(),
        'Content-Type': 'application/json',
    }

    // 같은 키로 재요청하면 토스가 원래 결과를 그대로 돌려준다. 네트워크가 끊겨
    // 응답을 못 받은 뒤 재시도할 때 이중 결제를 막는 장치다.
    if (init.idempotencyKey) {
        headers['Idempotency-Key'] = init.idempotencyKey
    }

    let res: Response
    try {
        res = await fetch(`${TOSS_API_BASE}${path}`, {
            method: init.method,
            headers,
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            cache: 'no-store',
            signal: AbortSignal.timeout(TOSS_REQUEST_TIMEOUT_MS),
        })
    } catch (err) {
        throw new TossApiError(
            'NETWORK_ERROR',
            `결제 서버에 연결하지 못했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
            502
        )
    }

    const text = await res.text()
    let parsed: unknown = null
    try {
        parsed = text ? JSON.parse(text) : null
    } catch {
        // 본문이 JSON 이 아니면 아래에서 status 만으로 판단한다
    }

    if (!res.ok) {
        const body = parsed as Partial<TossErrorBody> | null
        throw new TossApiError(
            body?.code || 'TOSS_UNKNOWN_ERROR',
            body?.message || `결제 요청이 실패했습니다. (HTTP ${res.status})`,
            res.status
        )
    }

    return parsed as T
}

/**
 * 인증 정보(authKey)로 빌링키를 발급한다.
 *
 * **발급된 빌링키는 다시 조회할 수 없다.** 응답을 받는 즉시 저장해야 하며, 잃어버리면
 * 사용자에게 카드를 다시 등록받는 수밖에 없다.
 */
export async function issueBillingKey(
    authKey: string,
    customerKey: string
): Promise<BillingKeyResult> {
    const data = await tossFetch<{
        billingKey?: string
        customerKey?: string
        method?: string | null
        cardCompany?: string | null
        cardNumber?: string | null
    }>('/billing/authorizations/issue', {
        method: 'POST',
        body: { authKey, customerKey },
    })

    if (typeof data?.billingKey !== 'string' || !data.billingKey || data.customerKey !== customerKey) {
        throw new TossApiError(
            'BILLING_KEY_MISSING',
            '빌링키를 발급받지 못했습니다. 카드 등록을 다시 시도해 주세요.',
            502
        )
    }

    return {
        billingKey: data.billingKey,
        customerKey: data.customerKey || customerKey,
        method: data.method ?? null,
        cardCompany: data.cardCompany ?? null,
        cardNumber: data.cardNumber ?? null,
    }
}

/**
 * 빌링키로 자동결제를 승인한다. 구독 시작과 매월 갱신이 모두 이 경로를 탄다.
 *
 * `orderId` 는 호출자가 만들어 넘긴다 — 결제를 내기 **전에** 우리 DB 가 그 값을 알아야
 * 중복 승인을 막을 수 있기 때문이다(`cpa_payment_log.toss_order_id` UNIQUE).
 */
export async function approveBillingPayment(params: {
    billingKey: string
    customerKey: string
    amount: number
    orderId: string
    orderName: string
    customerEmail?: string | null
    customerName?: string | null
}): Promise<BillingPaymentResult> {
    let data: TossPaymentResponse
    try {
        data = await tossFetch<TossPaymentResponse>(
            `/billing/${encodeURIComponent(params.billingKey)}`,
            {
                method: 'POST',
                // orderId 는 한 결제에 하나뿐이므로 멱등키로 그대로 쓴다.
                idempotencyKey: params.orderId,
                body: {
                    customerKey: params.customerKey,
                    amount: params.amount,
                    orderId: params.orderId,
                    orderName: params.orderName,
                    ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
                    ...(params.customerName ? { customerName: params.customerName } : {}),
                },
            }
        )
    } catch (error) {
        if (error instanceof TossApiError && isDefinitiveBillingFailureCode(error.code)) throw error
        try {
            data = await getPaymentByOrderId(params.orderId)
            const terminal = terminalPaymentError(data, params.orderId)
            if (terminal) throw terminal
        } catch (lookupError) {
            if (lookupError instanceof TossApiError && isDefinitiveBillingFailureCode(lookupError.code)) {
                throw lookupError
            }
            throw error
        }
    }

    const terminal = terminalPaymentError(data, params.orderId)
    if (terminal) throw terminal

    if (
        !data?.paymentKey ||
        data.status !== 'DONE' ||
        data.orderId !== params.orderId ||
        data.totalAmount !== params.amount
    ) {
        throw new TossApiError(
            'INVALID_PAYMENT_RESPONSE',
            '결제 응답의 상태·주문번호·금액을 확인할 수 없습니다.',
            502
        )
    }

    return {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        status: data.status,
        totalAmount: data.totalAmount,
        approvedAt: data.approvedAt ?? null,
        receiptUrl: data.receipt?.url ?? null,
    }
}

/** 응답 유실·DUPLICATED_ORDER_ID 뒤 같은 회차의 승인 결과를 새 주문 없이 복구한다. */
export async function getPaymentByOrderId(orderId: string): Promise<TossPaymentResponse> {
    return tossFetch<TossPaymentResponse>(`/payments/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
    })
}

/**
 * 빌링키를 삭제한다. 구독 해지 시 호출한다.
 *
 * **실패해도 해지 자체는 성립한다** — 우리가 승인 API 를 부르지 않으면 결제는 나지 않기
 * 때문이다. 그래서 호출자는 이 함수의 실패를 로그로만 남기고 해지를 진행해야 한다.
 */
export async function deleteBillingKey(billingKey: string): Promise<void> {
    await tossFetch(`/billing/${encodeURIComponent(billingKey)}`, { method: 'DELETE' })
}

/** 단건 결제를 paymentKey 로 조회한다. 웹훅 본문을 그대로 믿지 않고 재확인할 때 쓴다. */
export async function getPayment(paymentKey: string): Promise<{
    paymentKey: string
    orderId: string | null
    status: string | null
    totalAmount: number | null
}> {
    const data = await tossFetch<TossPaymentResponse>(
        `/payments/${encodeURIComponent(paymentKey)}`,
        { method: 'GET' }
    )
    if (!data || data.paymentKey !== paymentKey) throw new TossApiError('INVALID_PAYMENT_RESPONSE', '결제 조회 응답을 확인할 수 없습니다.', 502)
    return {
        paymentKey: data.paymentKey,
        orderId: data?.orderId ?? null,
        status: data?.status ?? null,
        totalAmount: data?.totalAmount ?? null,
    }
}

/**
 * 사용자별 `customerKey` 를 만든다.
 *
 * **사용자 ID 를 그대로 쓰지 않는다.** customerKey 는 빌링키와 짝지어야만 결제가 나는
 * 값이라, 유추 가능하면 빌링키가 새는 순간 곧바로 결제로 이어진다. 토스도 "자동 증가하는
 * 숫자나 이메일처럼 유추 가능한 값은 안전하지 않다"고 못박고 있다.
 *
 * 그렇다고 무작위로 만들면 결제창을 띄운 브라우저와 콜백을 받는 서버가 같은 값을 알아야
 * 하는 문제가 생긴다. 그래서 **시크릿 키로 HMAC 한 결정적 값**을 쓴다 — 서버는 언제든
 * 다시 계산할 수 있고, 밖에서는 시크릿 키 없이 만들 수 없다. 덕분에 `/api/billing/setup`
 * 은 콜백이 들고 온 customerKey 가 그 사용자의 것인지 재계산만으로 검증할 수 있다.
 *
 * 토스 규격: 영문 대소문자·숫자와 `-_=.@` 로 2~300자. base64url 은 이 집합에 들어간다.
 */
export function customerKeyFor(userId: string): string {
    const secretKey = process.env.CPA_TOSS_SECRET_KEY
    if (!secretKey) {
        throw new TossApiError(
            'TOSS_NOT_CONFIGURED',
            '결제가 아직 설정되지 않았습니다.',
            503
        )
    }
    const digest = createHmac('sha256', secretKey).update(`cpa:customer:${userId}`).digest('base64url')
    return `cpa_${digest.slice(0, 40)}`
}
