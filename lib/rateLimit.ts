import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { consumeQuota } from './rateLimitPolicy';

export const GRADE_RATE_LIMIT = 10;
export const GRADE_RATE_WINDOW_SECONDS = 60;
export const SUBMISSION_RATE_LIMIT = 30;

function consume(key: string, limit: number): Promise<boolean> {
    return consumeQuota((args) => getSupabaseAdmin().rpc('consume_rate_limit', { ...args }), {
        p_key: key, p_limit: limit, p_window_seconds: GRADE_RATE_WINDOW_SECONDS,
    });
}

export function consumeGradeQuota(userId: string): Promise<boolean> {
    return consume(`cpa:grade:${userId}`, GRADE_RATE_LIMIT);
}

/** 빈 답안도 DB 기록을 생성하므로 AI 호출 한도와 별도로 제한한다. */
export function consumeSubmissionQuota(userId: string): Promise<boolean> {
    return consume(`cpa:submission:${userId}`, SUBMISSION_RATE_LIMIT);
}
