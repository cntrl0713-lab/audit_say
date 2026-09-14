import { authenticatedBilling, billingBody, billingFailure, billingResponse } from '@/lib/billing/server'
import { accountRateLimit } from '@/lib/accountServer'
import { lookupReferrer } from '@/lib/billing/referral'
import type { ReferralValidateResponse } from '@/lib/billing/types'

export async function POST(request: Request) {
    try {
        const body = await billingBody(request)
        const { user, admin } = await authenticatedBilling()
        await accountRateLimit(request, 'referral-validate', user.id, 30)
        const result = await lookupReferrer(admin, body.nickname, user.id)
        if (!result.ok) return billingResponse({ error: result.failure.code, message: result.failure.message }, { status: result.failure.status })
        const response: ReferralValidateResponse = { valid: true, referrerNickname: result.referrer.nickname }
        return billingResponse(response)
    } catch (error) { return billingFailure(error) }
}
