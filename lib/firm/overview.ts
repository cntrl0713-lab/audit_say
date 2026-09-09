import {
    buildHeadcounts,
    buildTenureSegments,
    summarizeTurnover,
    type TenureSegmentView,
    type TurnoverView,
} from './personnel.ts';
import type { FirmAnnualPeriodRef, FirmAnnualSummary, FirmCpaTenureRow, FirmHeadcountRow } from './types.ts';

export interface FirmGrowthView {
    /** 전년 대비 증감률. 0.1은 10%이며, 비교할 수 없으면 null이다. */
    rate: number | null;
    note: string;
}

export interface FirmRevenueMixView {
    segments: {
        key: 'audit' | 'tax' | 'advisory' | 'other';
        label: string;
        value: number | null;
        share: number | null;
    }[];
    canChart: boolean;
    note: string;
}

export interface FirmOverview {
    cpa: number | null;
    revenueGrowth: FirmGrowthView;
    cpaGrowth: FirmGrowthView;
    revenueMix: FirmRevenueMixView;
    tenure: TenureSegmentView | null;
    turnover: TurnoverView | null;
}

function finite(value: number | null): number | null {
    return value !== null && Number.isFinite(value) ? value : null;
}

/** 접수번호가 같아도 법인이나 정규화한 보고기간이 다르면 섞지 않는다. */
function samePeriod(a: FirmAnnualPeriodRef, b: FirmAnnualPeriodRef): boolean {
    return a.firm_id === b.firm_id && a.source_rcept_no === b.source_rcept_no
        && a.fy_start_year === b.fy_start_year
        && a.fy_start_date === b.fy_start_date && a.fy_end_date === b.fy_end_date;
}

function periodRows<T extends FirmAnnualPeriodRef>(rows: readonly T[], period: FirmAnnualSummary): T[] {
    return rows.filter(row => samePeriod(row, period));
}

function cpaCount(rows: readonly FirmHeadcountRow[], period: FirmAnnualSummary): number | null {
    return buildHeadcounts(periodRows(rows, period)).find(row => row.code === 'HR_CPA_ALL')?.count ?? null;
}

function revenueMix(summary: FirmAnnualSummary): FirmRevenueMixView {
    const segments: FirmRevenueMixView['segments'] = [
        { key: 'audit', label: '감사', value: finite(summary.revenue_audit), share: null },
        { key: 'tax', label: '세무', value: finite(summary.revenue_tax), share: null },
        { key: 'advisory', label: '경영자문', value: finite(summary.revenue_advisory), share: null },
        { key: 'other', label: '기타', value: finite(summary.revenue_other), share: null },
    ];
    const total = finite(summary.revenue_total);
    const unavailable = (note: string): FirmRevenueMixView => ({ segments, canChart: false, note });
    if ([summary.revenue_audit, summary.revenue_tax, summary.revenue_advisory, summary.revenue_other]
        .some(value => value !== null && !Number.isFinite(value))) {
        return unavailable('업무별 매출 수치를 확인할 수 없어 비중을 표시하지 않습니다.');
    }
    const missing = segments.filter(segment => segment.value === null);
    const observed = segments.filter((segment): segment is typeof segment & { value: number } => segment.value !== null);
    if (observed.length === 0) return unavailable('업무별 매출이 모두 미확보되어 비중을 표시하지 않습니다.');
    if (total === null) return unavailable('총매출이 미확보되어 업무별 비중을 확인할 수 없습니다.');
    if (total < 0 || observed.some(segment => segment.value < 0)) {
        return unavailable('음수 매출이 포함되어 원그래프로 표시할 수 없습니다.');
    }
    const sum = observed.reduce((acc, segment) => acc + segment.value, 0);
    // 금액은 원 단위다. 임의의 공시 반올림 허용치를 만들지 않고 부동소수점 덧셈 오차만 허용한다.
    const tolerance = Number.EPSILON * Math.max(Math.abs(total), Math.abs(sum), 1) * segments.length;
    if (!Number.isFinite(sum) || Math.abs(sum - total) > tolerance) {
        return unavailable(missing.length > 0
            ? `${missing.map(segment => segment.label).join('·')} 매출이 미확보되었고 확인된 합계와 총매출이 달라 비중을 표시하지 않습니다.`
            : '업무별 매출 합계와 총매출이 달라 비중을 표시하지 않습니다.');
    }
    if (total === 0 || sum === 0) return unavailable('총매출이 0원이라 업무별 비중을 계산할 수 없습니다.');
    return {
        // 확인된 금액이 총매출을 설명하면 그 항목만 그린다. 미확보 항목의 값·비중은 계속 null이다.
        segments: segments.map(segment => ({ ...segment, share: segment.value === null ? null : segment.value / total })),
        canChart: true,
        note: missing.length > 0
            ? `${missing.map(segment => segment.label).join('·')} 매출은 미확보입니다. 확인된 업무별 매출 합계가 총매출과 일치해 확인된 항목의 비중을 표시합니다.`
            : '업무별 매출 비중',
    };
}

const DAY = 24 * 60 * 60 * 1000;

function parseDate(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

/** 2월 말 결산은 28일/29일이 달라도 같은 결산시점이다. 종료일 다음 날로 비교한다. */
function nextYear(date: Date): number {
    const year = date.getUTCFullYear() + 1;
    const month = date.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay));
}

function periodDates(period: FirmAnnualSummary): { start: Date; endExclusive: Date } | null {
    const start = parseDate(period.fy_start_date);
    const end = parseDate(period.fy_end_date);
    if (!start || !end || start.getUTCFullYear() !== period.fy_start_year || start > end) return null;
    return { start, endExclusive: new Date(end.getTime() + DAY) };
}

function comparablePeriods(current: FirmAnnualSummary, previous: FirmAnnualSummary, annual: boolean): boolean {
    const a = periodDates(current);
    const b = periodDates(previous);
    if (!a || !b || nextYear(b.endExclusive) !== a.endExclusive.getTime()) return false;
    if (!annual) return true;
    return nextYear(a.start) === a.endExclusive.getTime()
        && nextYear(b.start) === b.endExclusive.getTime()
        && nextYear(b.start) === a.start.getTime();
}

function previousPeriod(current: FirmAnnualSummary, summaries: readonly FirmAnnualSummary[]): {
    previous: FirmAnnualSummary | null;
    note: string;
} {
    const sameFirm = summaries.filter(summary => summary.firm_id === current.firm_id);
    const currentPeriods = sameFirm.filter(summary => summary.fy_start_year === current.fy_start_year);
    const previousPeriods = sameFirm.filter(summary => summary.fy_start_year === current.fy_start_year - 1);
    if (currentPeriods.length > 1 || previousPeriods.length > 1) {
        return { previous: null, note: '같은 기준연도에 보고기간이 여러 개여서 전년 대비를 표시하지 않습니다.' };
    }
    if (currentPeriods.length !== 1 || !samePeriod(currentPeriods[0], current)) {
        return { previous: null, note: '현재 보고기간을 확인할 수 없어 전년 대비를 표시하지 않습니다.' };
    }
    if (previousPeriods.length === 0) {
        return { previous: null, note: '직전 기준연도 자료가 미확보되었습니다.' };
    }
    return { previous: previousPeriods[0], note: '' };
}

function growth(current: number | null, previous: number | null, label: string): FirmGrowthView {
    if (finite(current) === null || finite(previous) === null) {
        return { rate: null, note: `당기 또는 전기 ${label} 자료가 미확보되었습니다.` };
    }
    if (previous! <= 0) return { rate: null, note: `전기 ${label} 값이 0 이하라 성장률을 계산할 수 없습니다.` };
    const rate = (current! - previous!) / previous!;
    return Number.isFinite(rate)
        ? { rate, note: '전년 대비' }
        : { rate: null, note: '수치 확인이 필요해 성장률을 표시하지 않습니다.' };
}

/** 요약은 선택한 한 공시를 기준으로 하며 근속표 인원을 공인회계사 총수로 대체하지 않는다. */
export function buildFirmOverview(
    current: FirmAnnualSummary,
    summaries: readonly FirmAnnualSummary[],
    headcounts: readonly FirmHeadcountRow[],
    tenure: readonly FirmCpaTenureRow[],
): FirmOverview {
    const cpa = cpaCount(headcounts, current);
    const comparison = previousPeriod(current, summaries);
    const previous = comparison.previous;
    const revenueGrowth = previous
        ? comparablePeriods(current, previous, true)
            ? growth(current.revenue_total, previous.revenue_total, '총매출')
            : { rate: null, note: '동일한 1년 보고기간끼리 비교할 수 없어 매출 성장률을 표시하지 않습니다.' }
        : { rate: null, note: comparison.note };
    const cpaGrowth = previous
        ? comparablePeriods(current, previous, false)
            ? growth(cpa, cpaCount(headcounts, previous), '공인회계사 수')
            : { rate: null, note: '전년과 결산시점이 달라 인원 성장률을 표시하지 않습니다.' }
        : { rate: null, note: comparison.note };
    const totalTenureRows = periodRows(tenure, current).filter(row => row.segment === 'total');
    // 전체 행 중복은 임의로 하나를 채택하지 않는다. 부문 합으로 전체를 만들어 내지도 않는다.
    const totalRows = totalTenureRows.length === 1 ? totalTenureRows : [];
    return {
        cpa,
        revenueGrowth,
        cpaGrowth,
        revenueMix: revenueMix(current),
        tenure: buildTenureSegments(totalRows)[0] ?? null,
        turnover: summarizeTurnover(totalRows),
    };
}
