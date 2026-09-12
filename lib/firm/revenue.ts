import { buildHeadcounts } from './personnel.ts';
import type { FirmAnnualSummary, FirmHeadcountRow } from './types.ts';

/**
 * 해당 보고기간 총매출 ÷ 같은 공시의 기말 공인회계사 수.
 * 분모는 사원·수습을 포함한 HR_CPA_ALL이며 전 임직원·소속 등록회계사 수로 대체하지 않는다.
 * 보고기간 길이를 12개월로 환산하지 않고, 결측과 실제 매출 0원을 구분한다.
 */
export function revenuePerCpa(period: FirmAnnualSummary, headcounts: readonly FirmHeadcountRow[]): number | null {
    const revenue = period.revenue_total;
    if (revenue === null || !Number.isFinite(revenue)) return null;
    const rows = headcounts.filter(row => row.firm_id === period.firm_id
        && row.source_rcept_no === period.source_rcept_no
        && row.bsns_year === period.bsns_year
        && row.fy_start_year === period.fy_start_year
        && row.fy_start_date === period.fy_start_date
        && row.fy_end_date === period.fy_end_date);
    const cpa = buildHeadcounts(rows).find(row => row.code === 'HR_CPA_ALL')?.count ?? null;
    if (cpa === null || cpa <= 0) return null;
    const value = revenue / cpa;
    return Number.isFinite(value) ? value : null;
}
