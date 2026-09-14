import { authenticatedBilling, billingBody, billingFailure, billingResponse, assertBillingVersion } from '@/lib/billing/server'
import { accountRateLimit } from '@/lib/accountServer'
import { lookupReferrer } from '@/lib/billing/referral'
import type { ReferralRegisterResponse } from '@/lib/billing/types'

/** Create an immutable pending relation; qualifying payment and maturity are enforced in SQL. */
export async function POST(request: Request) {
    try {
        const body = await billingBody(request)
        const { user, membership, admin } = await authenticatedBilling()
        assertBillingVersion(body.membershipVersion, membership.membership_version)
        await accountRateLimit(request, 'referral-register', user.id, 10)
        const result = await lookupReferrer(admin, body.nickname, user.id)
        if (!result.ok) return billingResponse({ error: result.failure.code, message: result.failure.message }, { status: result.failure.status })
        const { error } = await admin.from('cpa_referral').insert({
            referrer_id: result.referrer.id, referee_id: user.id,
            referrer_membership_version: result.referrer.membership_version,
            referee_membership_version: membership.membership_version, status: 'pending',
        })
        if (error) {
            return billingResponse({ error: error.code === '23505' ? 'ALREADY_REFERRED' : 'REFERRAL_INSERT_FAILED',
                message: error.code === '23505' ? '이미 추천인이 등록되어 있습니다.' : '추천인 등록에 실패했습니다.' },
            { status: error.code === '23505' ? 409 : 503 })
        }
        const response: ReferralRegisterResponse = { success: true, referrerNickname: result.referrer.nickname }
        return billingResponse(response)
    } catch (error) { return billingFailure(error) }
}
