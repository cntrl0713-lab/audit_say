import { ANNUAL_DISPLAY_YEARS, annualPeriodsForYear } from './annualYears.ts';
import { buildHeadcounts, rowsForReceipt } from './personnel.ts';
import { revenuePerCpa } from './revenue.ts';
import type { FirmAnnualSummary, FirmCpaTenureRow, FirmHeadcountRow } from './types.ts';
import type { Point } from './chart.ts';

export interface TrendSeries {
    key: string;
    label: string;
    unit: 'krw' | 'people' | 'ratio';
    points: Point[];
}

/** 정규화된 보고기간만 사용한다. 같은 시작연도의 복수 기수는 원문별 점으로 보존한다. */
export function buildAnnualTrend(
    summaries: readonly FirmAnnualSummary[],
    headcounts: readonly FirmHeadcountRow[] = [],
    tenure: readonly FirmCpaTenureRow[] = [],
) {
    const years = [...ANNUAL_DISPLAY_YEARS].sort((a, b) => a - b);
    const grouped = years.map((year) => annualPeriodsForYear(summaries, year).periods.slice().reverse());
    const multiPeriodYears = years.filter((_, index) => grouped[index].length > 1);
    const definitions = [
        {
            key: 'revenue_total',
            label: '회계법인 자체 매출액',
            unit: 'krw',
            value: (p: FirmAnnualSummary) => p.revenue_total,
        },
        {
            key: 'employee_total',
            label: '전 임직원',
            unit: 'people',
            value: (p: FirmAnnualSummary) => p.employee_total,
        },
        {
            key: 'cpa',
            label: '공인회계사',
            unit: 'people',
            value: (p: FirmAnnualSummary) =>
                buildHeadcounts(rowsForReceipt(headcounts, p.source_rcept_no)).find((row) => row.code === 'HR_CPA_ALL')
                    ?.count ?? null,
        },
        {
            key: 'registered',
            label: '등록회계사 (근속표)',
            unit: 'people',
            value: (p: FirmAnnualSummary) =>
                rowsForReceipt(tenure, p.source_rcept_no).find((row) => row.segment === 'total')?.total ?? null,
        },
        {
            key: 'revenue_per_employee',
            label: '임직원 1인당 매출액',
            unit: 'krw',
            value: (p: FirmAnnualSummary) => p.revenue_per_employee,
        },
        {
            key: 'revenue_per_cpa',
            label: '공인회계사 1인당 매출액',
            unit: 'krw',
            value: (p: FirmAnnualSummary) => revenuePerCpa(p, headcounts),
        },
        {
            key: 'employee_per_director',
            label: '이사 1인당 직원 수',
            unit: 'people',
            value: (p: FirmAnnualSummary) => p.employee_per_director,
        },
    ] as const;
    const series: TrendSeries[] = definitions.map((def) => ({
        key: def.key,
        label: def.label,
        unit: def.unit,
        points: grouped.flatMap((periods, index) =>
            periods.length
                ? periods.map((period, position) => ({
                      x: years[index] + (periods.length > 1 ? (position / (periods.length - 1) - 0.5) * 0.32 : 0),
                      label: `${years[index]}년 · ${period.fy_seq == null ? '' : `제${period.fy_seq}기 · `}${period.fy_start_date} ~ ${period.fy_end_date} · 접수 ${period.source_rcept_no}`,
                      value: def.value(period) ?? null,
                  }))
                : [{ x: years[index], label: `${years[index]}년 · 미확보`, value: null }],
        ),
    }));
    return { years, series, multiPeriodYears };
}
