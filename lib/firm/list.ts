import type { FirmSummaryRow, RegisteredFirm } from './types.ts';

export const FIRM_SORTS = [
    { key: 'clients', label: '감사대상회사 수' },
    { key: 'client_revenue', label: '감사대상회사 평균 매출액' },
    { key: 'name', label: '이름순' },
] as const;
export type FirmSort = (typeof FIRM_SORTS)[number]['key'];

export function buildFirmList(firms: RegisteredFirm[], summaries: FirmSummaryRow[], q: string | undefined, sort: FirmSort) {
    const byId = new Map(summaries.map((summary) => [summary.firm_id, summary]));
    const search = q?.replace(/\s/g, '').toLocaleLowerCase('ko') ?? '';
    const rows = firms.filter((firm) => firm.firm_name.replace(/\s/g, '').toLocaleLowerCase('ko').includes(search))
        .map((firm) => ({ firm, summary: byId.get(firm.firm_id) ?? null }));
    return rows.sort((a, b) => {
        if (sort !== 'name') {
            const key = sort === 'clients' ? 'client_count' : 'avg_client_revenue';
            const av = a.summary?.[key] ?? null, bv = b.summary?.[key] ?? null;
            if (av === null && bv !== null) return 1;
            if (av !== null && bv === null) return -1;
            if (av !== null && bv !== null && av !== bv) return bv - av;
        }
        return a.firm.firm_name.localeCompare(b.firm.firm_name, 'ko');
    });
}
