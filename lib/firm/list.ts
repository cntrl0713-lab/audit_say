import type { FirmSummaryRow, RegisteredFirm } from './types.ts';

export const FIRM_SORTS = [
    { key: 'clients', label: '외부감사법 감사대상회사 수' },
    { key: 'client_revenue', label: '감사대상회사 평균 매출액' },
    { key: 'name', label: '법인명' },
] as const;
export type FirmSort = (typeof FIRM_SORTS)[number]['key'];
export type FirmSortDirection = 'asc' | 'desc';

export const DEFAULT_FIRM_LIST_YEAR = 2025;

/** 목록 기본연도는 수집 상황에 따라 바뀌지 않는다. 미확보 연도도 2025 화면에서 안내한다. */
export function resolveFirmListYear(years: readonly number[], requested = 0): number {
    return Number.isSafeInteger(requested) && requested > 0 && years.includes(requested)
        ? requested
        : DEFAULT_FIRM_LIST_YEAR;
}

export function defaultFirmSortDirection(sort: FirmSort): FirmSortDirection {
    return sort === 'name' ? 'asc' : 'desc';
}

/** 감사대상회사 수 증감은 같은 법인의 바로 전 사업연도와만 비교한다. */
export function clientCountChange(
    current: FirmSummaryRow | null | undefined,
    prior: FirmSummaryRow | null | undefined,
): number | null {
    if (!current || !prior || current.firm_id !== prior.firm_id
        || !Number.isSafeInteger(current.bsns_year) || current.bsns_year <= 0
        || prior.bsns_year !== current.bsns_year - 1) return null;
    if (!Number.isSafeInteger(current.client_count) || current.client_count < 0
        || !Number.isSafeInteger(prior.client_count) || prior.client_count < 0) return null;
    return current.client_count - prior.client_count;
}

function finite(value: number | null | undefined): number | null {
    return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

export function buildFirmList(
    firms: RegisteredFirm[],
    summaries: FirmSummaryRow[],
    q: string | undefined,
    sort: FirmSort,
    direction: FirmSortDirection = defaultFirmSortDirection(sort),
) {
    const byId = new Map(summaries.map((summary) => [summary.firm_id, summary]));
    const search = q?.replace(/\s/g, '').toLocaleLowerCase('ko') ?? '';
    const rows = firms.filter((firm) => firm.firm_name.replace(/\s/g, '').toLocaleLowerCase('ko').includes(search))
        .map((firm) => ({ firm, summary: byId.get(firm.firm_id) ?? null }));
    return rows.sort((a, b) => {
        const nameOrder = a.firm.firm_name.localeCompare(b.firm.firm_name, 'ko');
        if (sort !== 'name') {
            const key = sort === 'clients' ? 'client_count' : 'avg_client_revenue';
            const av = finite(a.summary?.[key]), bv = finite(b.summary?.[key]);
            if (av === null && bv !== null) return 1;
            if (av !== null && bv === null) return -1;
            if (av !== null && bv !== null && av !== bv) return direction === 'asc' ? av - bv : bv - av;
            return nameOrder || a.firm.firm_id - b.firm.firm_id;
        }
        return (direction === 'asc' ? nameOrder : -nameOrder) || a.firm.firm_id - b.firm.firm_id;
    });
}
