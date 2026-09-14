/** 구독·결제·추천 API 의 요청·응답 타입. 서버와 화면이 같은 모양을 공유한다. */


/** cpa_subscription 행의 상태 */
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'expired'

/** cpa_pro_reward.reason — 이용 기간이 왜 늘었는지 */
export type RewardReason = 'referral_given' | 'referral_received' | 'payment' | 'manual_admin'

/** cpa_payment_log.status */
export type PaymentStatus = 'success' | 'failed' | 'cancelled' | 'refunded'

// ── POST /api/billing/setup ────────────────────────────────────────────

export interface BillingSetupRequest {
    membershipVersion: number
    /** 토스 결제창이 successUrl 로 돌려준 일회성 인증 키 */
    authKey: string
    /** 결제창을 열 때 쓴 customerKey. 서버가 재계산해 본인 것인지 검증한다. */
    customerKey: string
    /** 추천인 닉네임 (선택). 첫 결제에 연결하고 보상 대기기간 후 양쪽에 +30일을 지급한다. */
    referrerNickname?: string
}

export interface BillingSetupResponse {
    success: true
    periodEnd: string
    /** 성공 결제에 추천 관계가 연결됐는지. 30일간 환불이 없으면 보상이 지급된다. */
    referralPending: boolean
    receiptUrl: string | null
}

// ── POST /api/billing/cancel ───────────────────────────────────────────

export interface BillingCancelResponse {
    success: true
    /** 이 시각까지는 pro 기능을 그대로 쓸 수 있다 */
    accessUntil: string
}

// ── GET /api/billing/status ────────────────────────────────────────────

export interface BillingStatusResponse {
    membershipVersion: number
    isActive: boolean
    status: SubscriptionStatus | null
    periodEnd: string | null
    cancelAtPeriodEnd: boolean
    /** 빌링키 보유 여부만 알려 준다 — 키 자체는 절대 내보내지 않는다 */
    hasBillingKey: boolean
    /** 내 추천 코드 대신 화면에 노출할 값. 추천은 닉네임으로 받는다. */
    nickname: string | null
    /** 내가 추천해 보상까지 완료된 사람 수 */
    referredCount: number
    rewardHistory: { reason: RewardReason; days: number; createdAt: string }[]
    payments: {
        status: PaymentStatus
        amount: number
        createdAt: string
        failureMessage: string | null
    }[]
}

// ── POST /api/referral/validate · register ─────────────────────────────

export interface ReferralRequest {
    membershipVersion?: number
    nickname: string
}

export interface ReferralRegisterRequest extends ReferralRequest {
    membershipVersion: number
}

export interface ReferralValidateResponse {
    valid: true
    referrerNickname: string
}

export interface ReferralRegisterResponse {
    success: true
    referrerNickname: string
}

