/**
 * searchParams 읽기·쓰기 도우미.
 *
 * 탐색 화면의 상태(검색어·필터·정렬·페이지·탭)는 전부 URL 에 둔다. 그래야 서버에서
 * 렌더하면서 그대로 공유·북마크할 수 있고, 필터마다 클라이언트 상태를 들 필요가 없다.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

export function readString(params: SearchParams, key: string): string | undefined {
    const value = first(params[key])?.trim();
    return value === '' ? undefined : value;
}

export function readInt(params: SearchParams, key: string, fallback: number): number {
    const raw = first(params[key]);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function readEnum<T extends string>(
    params: SearchParams,
    key: string,
    allowed: readonly T[],
): T | undefined {
    const raw = first(params[key]);
    return allowed.includes(raw as T) ? (raw as T) : undefined;
}

/** "true"/"false" 만 받는다. 그 밖의 값은 전체(undefined)로 본다. */
export function readBool(params: SearchParams, key: string): boolean | undefined {
    const raw = first(params[key]);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return undefined;
}

/**
 * 현재 파라미터에 patch 를 얹어 쿼리 문자열을 만든다.
 * 값이 null 이면 그 키를 지운다 — 필터 해제 링크에 쓴다.
 */
export function buildQuery(current: SearchParams, patch: Record<string, string | number | null>): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(current)) {
        const single = first(value);
        if (single !== undefined && single !== '') next.set(key, single);
    }

    for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, String(value));
    }

    const query = next.toString();
    return query === '' ? '' : `?${query}`;
}

/** 필터를 바꾸면 페이지는 1로 되돌린다. 3페이지에서 필터를 바꿔 빈 화면이 뜨면 버그처럼 보인다. */
export function buildFilterQuery(
    current: SearchParams,
    patch: Record<string, string | number | null>,
): string {
    return buildQuery(current, { ...patch, page: null });
}
