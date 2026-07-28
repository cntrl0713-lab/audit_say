import { getSupabaseAdmin } from './supabaseAdmin.ts';

// 채점 레이트 리밋.
//
// 예전에는 app/actions.ts의 모듈 스코프 Map 하나로 제한을 걸었다. Vercel 같은 서버리스
// 환경에서는 요청마다 다른 인스턴스가 처리할 수 있고 콜드 스타트마다 메모리가 비므로,
// 그 Map은 실질적으로 아무것도 막지 못했다. 카운터를 Postgres에 두고 원자적으로 증가시켜
// 인스턴스와 무관하게 동작하게 한다 (SQL은 supabase-rls.md 부록 참고).

export const GRADE_RATE_LIMIT = 10;
export const GRADE_RATE_WINDOW_SECONDS = 60;

interface Bucket {
    count: number;
    resetAt: number;
}

/**
 * 인스턴스 로컬 폴백 버킷. RPC가 아직 배포되지 않은 구간에서만 쓴다.
 * 순수 함수로 두어 테스트가 시간을 직접 넣을 수 있게 한다.
 * @returns 허용되면 true, 한도를 넘었으면 false
 */
export function consumeInMemory(
    buckets: Map<string, Bucket>,
    key: string,
    limit: number,
    windowMs: number,
    now: number
): boolean {
    // 만료된 항목을 정리한다. 한 번 채점한 사용자의 엔트리가 영구히 남아 있으면
    // 장수명 서버 인스턴스에서 Map이 사용자 수만큼 무한히 커진다.
    for (const [k, entry] of buckets) {
        if (now >= entry.resetAt) buckets.delete(k);
    }

    const bucket = buckets.get(key);
    if (bucket && now < bucket.resetAt) {
        if (bucket.count >= limit) return false;
        bucket.count++;
        return true;
    }

    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
}

const fallbackBuckets = new Map<string, Bucket>();

/** RPC가 아직 DB에 없는 경우인지 판별한다. */
function isMissingRpc(error: { code?: string; message?: string }): boolean {
    // PGRST202: PostgREST 스키마 캐시에 함수 없음 / 42883: undefined_function
    if (error.code === 'PGRST202' || error.code === '42883') return true;
    const message = (error.message || '').toLowerCase();
    return message.includes('could not find the function') || message.includes('does not exist');
}

/**
 * 사용자 한 명의 채점 요청 한도를 소비한다.
 *
 * 실패 처리 방침:
 * - RPC 자체가 없으면(마이그레이션 전) 경고를 남기고 인스턴스 로컬 폴백을 쓴다.
 *   그래야 SQL 적용 전에 배포해도 채점이 멈추지 않는다.
 * - 그 밖의 오류는 fail closed — 한도 관리가 불가능한 상태에서 무제한 통과시키지 않는다.
 *
 * @returns 허용되면 true, 한도를 넘었거나 판정 불가면 false
 */
export async function consumeGradeQuota(userId: string): Promise<boolean> {
    try {
        const adminSupabase = getSupabaseAdmin();
        const { data, error } = await adminSupabase.rpc('consume_rate_limit', {
            p_key: `grade:${userId}`,
            p_limit: GRADE_RATE_LIMIT,
            p_window_seconds: GRADE_RATE_WINDOW_SECONDS,
        });

        if (error) {
            if (isMissingRpc(error)) {
                console.error(
                    '[rateLimit] consume_rate_limit RPC를 찾을 수 없습니다. ' +
                    'supabase-rls.md 부록의 SQL을 적용하기 전까지 인스턴스 로컬 폴백으로 동작합니다 ' +
                    '(서버리스에서는 실효성이 없습니다).'
                );
                return consumeInMemory(
                    fallbackBuckets,
                    userId,
                    GRADE_RATE_LIMIT,
                    GRADE_RATE_WINDOW_SECONDS * 1000,
                    Date.now()
                );
            }
            console.error('[rateLimit] 레이트 리밋 조회 실패 (요청을 거절합니다):', error.message);
            return false;
        }

        return data === true;
    } catch (err) {
        console.error('[rateLimit] 레이트 리밋 처리 중 예외 (요청을 거절합니다):', err);
        return false;
    }
}
