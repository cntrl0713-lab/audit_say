export interface RateLimitRequest {
    p_key: string;
    p_limit: number;
    p_window_seconds: number;
}

type RateLimitRpc = (request: RateLimitRequest) => PromiseLike<{
    data: unknown;
    error: { code?: string } | null;
}>;

/** DB의 원자적 판정만 신뢰한다. 서버리스 로컬 메모리로 우회하지 않는다. */
export async function consumeQuota(rpc: RateLimitRpc, request: RateLimitRequest): Promise<boolean> {
    try {
        const { data, error } = await rpc(request);
        if (error) {
            console.error(`[rateLimit] request rejected (${error.code || 'unknown'})`);
            return false;
        }
        return data === true;
    } catch {
        console.error('[rateLimit] request rejected (unavailable)');
        return false;
    }
}
