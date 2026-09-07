export const ANNUAL_COLLECTION_YEARS = [2024, 2025, 2026] as const;
// 수집 CLI의 결산말 연도는 원문 탐색용. 분석·표시 연도는 실제 보고기간 시작연도다.
export const ANNUAL_DISPLAY_YEARS = [2026, 2025, 2024, 2023] as const;
export function isAnnualYear(year: number): boolean {
    return (ANNUAL_COLLECTION_YEARS as readonly number[]).includes(year);
}
export function isAnnualStartYear(year: number): boolean {
    return (ANNUAL_DISPLAY_YEARS as readonly number[]).includes(year);
}
export function selectAnnualYear(requested: number, available: readonly number[]): number {
    if (isAnnualStartYear(requested)) return requested;
    return ANNUAL_DISPLAY_YEARS.find(year => available.includes(year)) ?? ANNUAL_DISPLAY_YEARS[0];
}

export interface AnnualPeriod {
    bsns_year: number; fy_start_year: number; fy_start_date: string; fy_end_date: string;
}
/** 동일 시작연도의 기수는 합치지 않는다. 이전 fy_year 링크는 원래 결산기에서 시작연도를 찾는다. */
export function annualPeriodsForYear<T extends AnnualPeriod>(periods: readonly T[], requested: number, legacyEndYear = 0) {
    const legacy = periods.find(p => p.bsns_year === legacyEndYear);
    const year = selectAnnualYear(requested || legacy?.fy_start_year || 0, periods.map(p => p.fy_start_year));
    return { year, periods: periods.filter(p => p.fy_start_year === year).sort((a, b) => b.fy_end_date.localeCompare(a.fy_end_date)) };
}
