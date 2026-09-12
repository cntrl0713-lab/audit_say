import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revenuePerCpa } from '../lib/firm/revenue.ts';
import type { FirmAnnualSummary, FirmHeadcountRow } from '../lib/firm/types.ts';

function period(over: Partial<FirmAnnualSummary> = {}): FirmAnnualSummary {
    return {
        firm_id: 1, bsns_year: 2025, fy_start_year: 2024,
        fy_start_date: '2024-07-01', fy_end_date: '2025-06-30', fy_seq: 1,
        source_rcept_no: '20250901000001', source_rcept_dt: '2025-09-01',
        employee_total: 4263, director_count: 173,
        revenue_total: 1_109_366_384_939, operating_income: null, salary_total: null,
        revenue_per_employee: null, salary_per_employee: null, audit_revenue_ratio: null,
        employee_per_director: null, net_income: null,
        employee_audit: null, employee_tax: null, employee_advisory: null, employee_other: null,
        revenue_audit: null, revenue_tax: null, revenue_advisory: null, revenue_other: null,
        director_pay_total: null, director_pay_count: null, consistency_warnings: [],
        ...over,
    };
}

function headcount(value: number | null, over: Partial<FirmHeadcountRow> = {}): FirmHeadcountRow {
    return { ...period(), code: 'HR_CPA_ALL', numeric_value: value, raw_text: null, occurrence: 1, unit_multiplier: 1, ...over };
}

test('총매출을 사원·수습 포함 공인회계사 수로 나누고 다른 인원 집계로 대체하지 않는다', () => {
    const current = period();
    const value = revenuePerCpa(current, [
        headcount(3073), headcount(2512, { code: 'HR_R_ALL' }),
        headcount(260, { code: 'HR_P_ALL' }), headcount(301, { code: 'HR_E_ALL' }),
    ]);
    assert.equal(value, 1_109_366_384_939 / 3073);
    assert.notEqual(value, 1_109_366_384_939 / 4263);
    assert.notEqual(value, 1_109_366_384_939 / (3073 - 301));
    assert.equal(revenuePerCpa(current, [headcount(2512, { code: 'HR_R_ALL' }), headcount(260, { code: 'HR_P_ALL' })]), null);
});

test('매출 0원과 음수는 보존하고 미확보·유한하지 않은 매출은 계산하지 않는다', () => {
    assert.equal(revenuePerCpa(period({ revenue_total: 0 }), [headcount(10)]), 0);
    assert.equal(revenuePerCpa(period({ revenue_total: -100 }), [headcount(10)]), -10);
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assert.equal(revenuePerCpa(period({ revenue_total: value }), [headcount(10)]), null);
    }
});

test('공인회계사 인원이 미확보 또는 0명이면 임직원 수가 있어도 계산하지 않는다', () => {
    const current = period({ employee_total: 100 });
    assert.equal(revenuePerCpa(current, []), null);
    assert.equal(revenuePerCpa(current, [headcount(null)]), null);
    assert.equal(revenuePerCpa(current, [headcount(0)]), null);
});

test('분모의 중복·출현번호·단위·인원 검증을 적용하고 단위를 곱하지 않는다', () => {
    const current = period({ revenue_total: 100 });
    assert.equal(revenuePerCpa(current, [headcount(10, { unit_multiplier: null })]), 10);
    assert.equal(revenuePerCpa(current, [headcount(10), headcount(10)]), null);
    for (const over of [
        { occurrence: 2 }, { unit_multiplier: 1000 }, { numeric_value: -1 },
        { numeric_value: 1.5 }, { numeric_value: Number.NaN },
        { numeric_value: Number.POSITIVE_INFINITY }, { numeric_value: Number.MAX_SAFE_INTEGER + 1 },
    ]) assert.equal(revenuePerCpa(current, [headcount(10, over)]), null);
    // 다른 모집단의 중복 칸을 이유로 정상 공인회계사 수를 버리지 않는다.
    assert.equal(revenuePerCpa(current, [headcount(10), headcount(2, { code: 'HR_E_ALL' }), headcount(2, { code: 'HR_E_ALL' })]), 10);
});

test('법인·접수번호·보고기간이 일치하지 않는 인원은 계산과 중복 판단에서 제외한다', () => {
    const current = period({ revenue_total: 100 });
    const mismatches: Partial<FirmHeadcountRow>[] = [
        { firm_id: 2 }, { source_rcept_no: 'other-report' }, { bsns_year: 2024 },
        { fy_start_year: 2023 }, { fy_start_date: '2024-01-01' }, { fy_end_date: '2024-12-31' },
    ];
    assert.equal(revenuePerCpa(current, [headcount(10), ...mismatches.map(over => headcount(999, over))]), 10);
    for (const over of mismatches) assert.equal(revenuePerCpa(current, [headcount(10, over)]), null);
});

test('짧은 보고기간 매출을 연간 환산하거나 다른 기수와 합산하지 않는다', () => {
    const shorter = period({ bsns_year: 2024, fy_start_date: '2024-01-01', fy_end_date: '2024-06-30', source_rcept_no: 'shorter', revenue_total: 600 });
    const current = period({ revenue_total: 1000 });
    const rows = [headcount(10, shorter), headcount(20, current)];
    assert.equal(revenuePerCpa(shorter, rows), 60);
    assert.equal(revenuePerCpa(current, rows), 50);
});
