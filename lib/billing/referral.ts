/**
 * 추천인 조회·검증. `/api/referral/validate` · `/api/referral/register` ·
 * `/api/billing/setup` 이 같은 판정을 쓰도록 한 곳에 모았다.
 *
 * **UX 는 닉네임, 내부는 referral_code 다.** 사용자는 외우기 쉬운 닉네임을 입력하고,
 * 서버가 그 닉네임의 `referral_code` 를 확인해 추천 관계를 만든다. 화면에 코드를
 * 노출하지 않으므로 사용자는 코드의 존재를 알 필요가 없다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { AccountError, validateNickname } from '../accountPolicy.ts'

/** 추천인 조회 실패 사유. 라우트가 HTTP 상태로 옮긴다. */
export type ReferralFailure =
    | { code: 'LOOKUP_FAILED'; status: 503; message: string }
    | { code: 'INVALID_NICKNAME'; status: 400; message: string }
    | { code: 'SELF_REFERRAL'; status: 400; message: string }
    | { code: 'REFERRER_NOT_FOUND'; status: 404; message: string }
    | { code: 'REFERRER_HAS_NO_CODE'; status: 500; message: string }
    | { code: 'ALREADY_REFERRED'; status: 409; message: string }
    | { code: 'REFERRAL_NOT_ELIGIBLE'; status: 409; message: string }

export interface ReferrerRow {
    id: string
    nickname: string
    referral_code: string | null
    membership_version: number
}

export type ReferralLookup =
    | { ok: true; referrer: ReferrerRow }
    | { ok: false; failure: ReferralFailure }

/** Matches the SQL finalizer's first-successful-payment rule. The current order
 * may be excluded only when recovering an already registered pending relation. */
export async function referralEligibilityFailure(
    admin: SupabaseClient,
    userId: string,
    recoveringOrderId?: string
): Promise<ReferralFailure | null> {
    let query = admin.from('cpa_payment_log').select('id').eq('user_id', userId).eq('status', 'success')
    if (recoveringOrderId) {
        // SQL inequality alone would also discard historical rows with NULL order ids.
        // Setup order ids come from the validated database claim, never request input.
        query = query.or(`toss_order_id.is.null,toss_order_id.neq.${recoveringOrderId}`)
    }
    const { data, error } = await query.limit(1).maybeSingle()
    if (error) return { code: 'LOOKUP_FAILED', status: 503, message: '추천인 등록 가능 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
    if (data) return { code: 'REFERRAL_NOT_ELIGIBLE', status: 409, message: '추천인은 첫 결제 전에만 등록할 수 있습니다.' }
    return null
}

/** A prepared relation is not proof of a reward. Read the actual committed
 * payment link because the SQL finalizer may reject or replace its eligibility. */
export async function committedReferralPending(admin: SupabaseClient, userId: string, orderId: string, paymentKey: string): Promise<boolean> {
    const { data: payment, error } = await admin.from('cpa_payment_log')
        .select('status,referral_id').eq('user_id', userId).eq('toss_order_id', orderId).eq('toss_payment_key', paymentKey).maybeSingle()
    if (error || !payment) throw new AccountError('결제는 완료되었으나 추천 보상 반영을 확인하지 못했습니다. 구독 관리에서 결제 결과를 확인해 주세요.', 503)
    if (payment.status !== 'success' || payment.referral_id === null) return false
    const { data: referral, error: referralError } = await admin.from('cpa_referral')
        .select('status').eq('id', payment.referral_id).eq('referee_id', userId).maybeSingle()
    if (referralError) throw new AccountError('결제는 완료되었으나 추천 보상 상태를 조회하지 못했습니다. 잠시 후 다시 확인해 주세요.', 503)
    return referral?.status === 'pending'
}

/**
 * 닉네임으로 추천인을 찾고, 그 사람을 이 사용자의 추천인으로 삼을 수 있는지까지 본다.
 *
 * 검사 순서가 곧 사용자에게 보여 줄 메시지의 우선순위다: 형식 → 존재 → 자기추천 →
 * 코드 유무 → 이미 추천받음. 자기추천을 존재 확인보다 먼저 보면 "없는 닉네임"인지
 * "내 닉네임"인지 구분이 흐려진다.
 *
 * @param userId 추천을 받으려는 사람. 사용자를 지정하지 않는 내부 조회에서는 null.
 */
export async function lookupReferrer(
    admin: SupabaseClient,
    rawNickname: unknown,
    userId: string | null
): Promise<ReferralLookup> {
    let nickname: string | null
    try { nickname = validateNickname(rawNickname) } catch { nickname = null }
    if (!nickname) {
        return {
            ok: false,
            failure: {
                code: 'INVALID_NICKNAME',
                status: 400,
                message: '추천인 닉네임 형식이 올바르지 않습니다.',
            },
        }
    }

    // This is only the current authenticated user's payment history; do not
    // reveal another member's billing or account details in the error response.
    if (userId) {
        const failure = await referralEligibilityFailure(admin, userId)
        if (failure) return { ok: false, failure }
    }

    // 닉네임은 대소문자를 무시해 찾는다(가입 시 중복 검사와 같은 기준). 위에서 형식을
    // 통과시켰으므로 ilike 패턴 문자가 섞여 들어올 수 없다.
    const { data: profile, error: profileError } = await admin
        .from('common_profiles')
        .select('id, nickname')
        .ilike('nickname', nickname)
        .eq('account_status', 'active')
        .maybeSingle()

    const { data: service, error: serviceError } = profile
        ? await admin.from('cpa_users').select('id, referral_code, membership_version')
            .eq('id', profile.id).eq('membership_status', 'active').maybeSingle()
        : { data: null, error: null }
    const error = profileError || serviceError
    const referrer = service && profile ? { ...service, nickname: profile.nickname } : null

    if (error) {
        console.error('[referral] 추천인 조회 실패:', error)
        return {
            ok: false,
            failure: {
                code: 'LOOKUP_FAILED',
                status: 503,
                message: '추천인을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            },
        }
    }

    if (!referrer) {
        return {
            ok: false,
            failure: {
                code: 'REFERRER_NOT_FOUND',
                status: 404,
                message: '해당 닉네임의 회원을 찾을 수 없습니다.',
            },
        }
    }

    if (userId && referrer.id === userId) {
        return {
            ok: false,
            failure: {
                code: 'SELF_REFERRAL',
                status: 400,
                message: '본인을 추천인으로 지정할 수 없습니다.',
            },
        }
    }

    if (!referrer.referral_code) {
        return {
            ok: false,
            failure: {
                code: 'REFERRER_HAS_NO_CODE',
                status: 500,
                message: '추천인의 추천 코드가 없습니다. 관리자에게 문의해 주세요.',
            },
        }
    }

    if (userId) {
        const { data: existing, error: existingError } = await admin
            .from('cpa_referral')
            .select('id, status')
            .eq('referee_id', userId)
            .maybeSingle()

        if (existingError) return { ok: false, failure: { code: 'LOOKUP_FAILED', status: 503, message: '추천인 등록 상태를 확인하지 못했습니다.' } }

        // pending 도 막는다 — 추천인을 바꿔 가며 여러 번 등록하면 보상 대상이 흔들린다.
        if (existing) {
            return {
                ok: false,
                failure: {
                    code: 'ALREADY_REFERRED',
                    status: 409,
                    message: '이미 추천인이 등록되어 있습니다.',
                },
            }
        }
    }

    return { ok: true, referrer: referrer as ReferrerRow }
}
