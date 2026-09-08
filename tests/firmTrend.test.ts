import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnualTrend } from '../lib/firm/trend.ts';
import type { FirmAnnualSummary, FirmHeadcountRow, FirmCpaTenureRow } from '../lib/firm/types.ts';

function summary(year: number, over: Partial<FirmAnnualSummary> = {}): FirmAnnualSummary {
    return {
        firm_id: 1,
        bsns_year: year,
        fy_start_year: year,
        fy_start_date: `${year}-01-01`,
        fy_end_date: `${year}-12-31`,
        fy_seq: 1,
        source_rcept_no: String(year),
        source_rcept_dt: `${year + 1}-03-31`,
        employee_total: null,
        director_count: null,
        revenue_total: null,
        operating_income: null,
        salary_total: null,
        revenue_per_employee: null,
        salary_per_employee: null,
        audit_revenue_ratio: null,
        employee_per_director: null,
        net_income: null,
        employee_audit: null,
        employee_tax: null,
        employee_advisory: null,
        employee_other: null,
        revenue_audit: null,
        revenue_tax: null,
        revenue_advisory: null,
        revenue_other: null,
        director_pay_total: null,
        director_pay_count: null,
        consistency_warnings: [],
        ...over,
    };
}

test('연도는 오름차순이고 누락 연도는 null 자리로 남는다', () => {
    const trend = buildAnnualTrend([summary(2025, { revenue_total: 20 }), summary(2023, { revenue_total: 10 })]);
    assert.deepEqual(trend.years, [2023, 2024, 2025, 2026]);
    assert.deepEqual(
        trend.series[0].points.map((p) => p.value),
        [10, null, 20, null],
    );
});

test('같은 시작연도의 복수 기수는 합산하지 않고 원문별 좌표와 기간을 남긴다', () => {
    const trend = buildAnnualTrend([
        summary(2024, { revenue_total: 10 }),
        summary(2024, { fy_end_date: '2024-06-30', source_rcept_no: 'B', revenue_total: 20 }),
    ]);
    const points = trend.series[0].points.filter((p) => p.value !== null);
    assert.deepEqual(trend.multiPeriodYears, [2024]);
    assert.deepEqual(
        points.map((p) => p.value),
        [20, 10],
    );
    assert.notEqual(points[0].x, points[1].x);
    assert.match(points[0].label, /2024-06-30/);
});

test('전 임직원·공인회계사·등록회계사는 접수번호별 독립 계열이다', () => {
    const s = summary(2025, { employee_total: 4263 });
    const headcount = {
        ...s,
        code: 'HR_CPA_ALL',
        occurrence: 1,
        raw_text: '3073',
        numeric_value: 3073,
        unit_multiplier: null,
    } satisfies FirmHeadcountRow;
    const tenure: FirmCpaTenureRow = {
        ...s, segment: 'total', total: 2813,
        under_1y: null, y1_3: null, y3_5: null, y5_10: null, y10_15: null, over_15y: null,
        hires: null, leavers: null, begin_count: null, end_count: null,
    };
    const trend = buildAnnualTrend(
        [s],
        [headcount, { ...headcount, source_rcept_no: 'other', numeric_value: 999 }],
        [tenure],
    );
    const val = (key: string) => trend.series.find((s) => s.key === key)?.points.find((p) => p.x === 2025)?.value;
    assert.equal(val('employee_total'), 4263);
    assert.equal(val('cpa'), 3073);
    assert.equal(val('registered'), 2813);
    assert.equal(
        buildAnnualTrend([s])
            .series.find((s) => s.key === 'cpa')
            ?.points.find((p) => p.x === 2025)?.value,
        null,
    );
});
