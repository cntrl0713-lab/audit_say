import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFirmOverview } from '../lib/firm/overview.ts';
import type { FirmAnnualSummary, FirmCpaTenureRow, FirmHeadcountRow } from '../lib/firm/types.ts';

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

function headcount(period: FirmAnnualSummary, count: number | null, over: Partial<FirmHeadcountRow> = {}): FirmHeadcountRow {
    return { ...period, code: 'HR_CPA_ALL', occurrence: 1, raw_text: null, numeric_value: count, unit_multiplier: 1, ...over };
}

function tenure(period: FirmAnnualSummary, over: Partial<FirmCpaTenureRow> = {}): FirmCpaTenureRow {
    return {
        ...period,
        segment: 'total',
        under_1y: null,
        y1_3: null,
        y3_5: null,
        y5_10: null,
        y10_15: null,
        over_15y: null,
        total: null,
        hires: null,
        leavers: null,
        begin_count: null,
        end_count: null,
        ...over,
    };
}

test('직전 기준연도의 총매출과 공인회계사 수로 증가·감소·보합을 계산한다', () => {
    const previous = summary(2024, { revenue_total: 100 });
    const current = summary(2025, { revenue_total: 120 });
    const overview = buildFirmOverview(current, [previous, current], [headcount(previous, 100), headcount(current, 80)], []);
    assert.equal(overview.revenueGrowth.rate, 0.2);
    assert.equal(overview.cpaGrowth.rate, -0.2);
    const unchanged = buildFirmOverview({ ...current, revenue_total: 100 }, [previous, current], [headcount(previous, 100), headcount(current, 100)], []);
    assert.equal(unchanged.revenueGrowth.rate, 0);
    assert.equal(unchanged.cpaGrowth.rate, 0);
});

test('결측은 0으로 읽지 않고 실제 당기 0은 전년 대비 100% 감소다', () => {
    const previous = summary(2024, { revenue_total: 100 });
    const current = summary(2025, { revenue_total: 0 });
    const zero = buildFirmOverview(current, [previous, current], [headcount(previous, 20), headcount(current, 0)], []);
    assert.equal(zero.revenueGrowth.rate, -1);
    assert.equal(zero.cpa, 0);
    assert.equal(zero.cpaGrowth.rate, -1);
    const missing = buildFirmOverview({ ...current, revenue_total: null }, [previous, current], [headcount(previous, 20)], []);
    assert.equal(missing.revenueGrowth.rate, null);
    assert.equal(missing.cpa, null);
    assert.equal(missing.cpaGrowth.rate, null);
    assert.match(missing.revenueGrowth.note, /미확보/);
});

test('전년 수치 결측·0·음수와 유한하지 않은 수치는 성장률을 만들지 않는다', () => {
    const current = summary(2025, { revenue_total: 100 });
    for (const value of [null, 0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
        const previous = summary(2024, { revenue_total: value });
        const overview = buildFirmOverview(current, [previous, current], [headcount(current, 100), headcount(previous, value)], []);
        assert.equal(overview.revenueGrowth.rate, null);
        assert.equal(overview.cpaGrowth.rate, null);
    }
});

test('직전 기준연도 자료가 없으면 더 오래된 연도를 대신 비교하지 않는다', () => {
    const current = summary(2025, { revenue_total: 100 });
    const older = summary(2023, { revenue_total: 50 });
    const result = buildFirmOverview(current, [older, current], [headcount(older, 10), headcount(current, 20)], []);
    assert.equal(result.revenueGrowth.rate, null);
    assert.equal(result.cpaGrowth.rate, null);
    assert.match(result.revenueGrowth.note, /직전 기준연도/);
});

test('현재 또는 전년 시작연도의 여러 보고기간을 합치거나 임의로 선택하지 않는다', () => {
    const previous = summary(2024, { revenue_total: 50 });
    const current = summary(2025, { revenue_total: 100 });
    for (const extra of [
        { ...previous, source_rcept_no: 'previous-second', fy_end_date: '2024-06-30' },
        { ...current, source_rcept_no: 'current-second', fy_end_date: '2025-06-30' },
    ]) {
        const result = buildFirmOverview(current, [previous, current, extra], [headcount(previous, 10), headcount(current, 20)], []);
        assert.equal(result.revenueGrowth.rate, null);
        assert.equal(result.cpaGrowth.rate, null);
        assert.match(result.revenueGrowth.note, /여러 개/);
    }
});

test('선택한 현재 공시가 비교 자료에 없으면 성장률을 만들지 않는다', () => {
    const previous = summary(2024, { revenue_total: 50 });
    const current = summary(2025, { revenue_total: 100 });
    for (const reports of [[previous], [previous, { ...current, source_rcept_no: 'different' }]]) {
        const result = buildFirmOverview(current, reports, [], []);
        assert.equal(result.revenueGrowth.rate, null);
        assert.match(result.revenueGrowth.note, /현재 보고기간/);
    }
});

test('윤년이 포함된 정상 1년 보고기간은 달력상 같은 기간과 비교한다', () => {
    for (const dates of [
        ['2023-01-01', '2023-12-31', '2024-01-01', '2024-12-31'],
        ['2023-03-01', '2024-02-29', '2024-03-01', '2025-02-28'],
        ['2022-03-01', '2023-02-28', '2023-03-01', '2024-02-29'],
    ]) {
        const previous = summary(Number(dates[0].slice(0, 4)), { fy_start_date: dates[0], fy_end_date: dates[1], revenue_total: 100 });
        const current = summary(Number(dates[2].slice(0, 4)), { fy_start_date: dates[2], fy_end_date: dates[3], revenue_total: 110 });
        const result = buildFirmOverview(current, [previous, current], [headcount(previous, 10), headcount(current, 11)], []);
        assert.equal(result.revenueGrowth.rate, 0.1);
        assert.equal(result.cpaGrowth.rate, 0.1);
    }
});

test('짧은 보고기간 매출은 연간 성장률로 표시하지 않되 동일 결산시점의 인원은 비교한다', () => {
    const previous = summary(2024, { revenue_total: 100 });
    const current = summary(2025, { fy_start_date: '2025-07-01', revenue_total: 60 });
    const result = buildFirmOverview(current, [previous, current], [headcount(previous, 100), headcount(current, 110)], []);
    assert.equal(result.revenueGrowth.rate, null);
    assert.match(result.revenueGrowth.note, /1년 보고기간/);
    assert.equal(result.cpaGrowth.rate, 0.1);
});

test('결산시점 변경과 유효하지 않은 보고일자는 성장률 비교를 중단한다', () => {
    const previous = summary(2024, { revenue_total: 100 });
    for (const over of [
        { fy_start_date: '2025-04-01', fy_end_date: '2026-03-31' },
        { fy_end_date: '2025-12-30' },
        { fy_start_date: '2025-02-30' },
        { fy_start_date: '2025-12-31', fy_end_date: '2025-01-01' },
        { fy_start_date: '2024-01-01' },
    ]) {
        const current = summary(2025, { ...over, revenue_total: 110 });
        const result = buildFirmOverview(current, [previous, current], [headcount(previous, 10), headcount(current, 11)], []);
        assert.equal(result.revenueGrowth.rate, null);
        assert.equal(result.cpaGrowth.rate, null);
    }
});

test('공인회계사 총수·등록회계사 근속표·전 임직원은 서로 다른 모집단이다', () => {
    const previous = summary(2024, { employee_total: 400 });
    const current = summary(2025, { employee_total: 500 });
    const registered = [tenure(previous, { total: 80 }), tenure(current, { total: 120, under_1y: 20, y1_3: 100, hires: 10, leavers: 5 })];
    const result = buildFirmOverview(current, [previous, current], [
        headcount(previous, 100), headcount(current, 110), headcount(current, 120, { code: 'HR_R_ALL' }),
    ], registered);
    assert.equal(result.cpa, 110);
    assert.equal(result.cpaGrowth.rate, 0.1);
    assert.equal(result.tenure?.total, 120);
    assert.equal(result.turnover?.hires, 10);
    const missingCpa = buildFirmOverview(current, [previous, current], [headcount(current, 120, { code: 'HR_R_ALL' })], registered);
    assert.equal(missingCpa.cpa, null);
    assert.equal(missingCpa.cpaGrowth.rate, null);
});

test('공시·법인·보고기간이 다른 인원과 근속 행은 현재 요약에 섞이지 않는다', () => {
    const current = summary(2025);
    const mismatches = [
        { source_rcept_no: 'other' },
        { firm_id: 2 },
        { fy_start_date: '2025-04-01' },
        { fy_end_date: '2025-06-30' },
        { fy_start_year: 2024 },
    ];
    const result = buildFirmOverview(current, [current], [headcount(current, 10), ...mismatches.map(over => headcount(current, 999, over))], [
        tenure(current, { total: 8, under_1y: 8, hires: 2, leavers: 0 }),
        ...mismatches.map(over => tenure(current, { ...over, total: 999, hires: 999 })),
    ]);
    assert.equal(result.cpa, 10);
    assert.equal(result.tenure?.total, 8);
    assert.equal(result.turnover?.hires, 2);
    assert.equal(result.turnover?.leavers, 0);
});

test('중복 또는 단위가 잘못된 공인회계사 인원 칸과 중복 전체 근속 행은 채택하지 않는다', () => {
    const current = summary(2025);
    for (const rows of [
        [headcount(current, 10), headcount(current, 20, { occurrence: 2 })],
        [headcount(current, 10, { unit_multiplier: 1000 })],
    ]) assert.equal(buildFirmOverview(current, [current], rows, []).cpa, null);
    const duplicate = buildFirmOverview(current, [current], [], [tenure(current, { total: 10, hires: 1 }), tenure(current, { total: 20, hires: 2 })]);
    assert.equal(duplicate.tenure, null);
    assert.equal(duplicate.turnover, null);
    const onlySegment = buildFirmOverview(current, [current], [], [tenure(current, { segment: 'audit', total: 10, hires: 1 })]);
    assert.equal(onlySegment.tenure, null);
    assert.equal(onlySegment.turnover, null);
});

test('완전히 보고되어 총매출과 일치한 업무 매출만 원그래프 비중을 만든다', () => {
    const current = summary(2025, { revenue_total: 100, revenue_audit: 50, revenue_tax: 30, revenue_advisory: 20, revenue_other: 0 });
    const mix = buildFirmOverview(current, [current], [], []).revenueMix;
    assert.equal(mix.canChart, true);
    assert.deepEqual(mix.segments.map(segment => [segment.key, segment.value, segment.share]), [
        ['audit', 50, 0.5], ['tax', 30, 0.3], ['advisory', 20, 0.2], ['other', 0, 0],
    ]);
});

test('결측 업무 매출을 기타 잔액이나 0으로 추정하지 않는다', () => {
    for (const revenue_advisory of [10, 30]) {
        const current = summary(2025, { revenue_total: 100, revenue_audit: 50, revenue_tax: 30, revenue_advisory, revenue_other: null });
        const mix = buildFirmOverview(current, [current], [], []).revenueMix;
        assert.equal(mix.canChart, false);
        assert.equal(mix.segments[2].value, revenue_advisory);
        assert.equal(mix.segments[3].value, null);
        assert.ok(mix.segments.every(segment => segment.share === null));
        assert.match(mix.note, /미확보/);
        assert.match(mix.note, /총매출이 달라/);
    }
});

test('일부 업무가 결측이어도 확인된 매출이 총매출과 일치하면 확인된 항목만 비중을 만든다', () => {
    const current = summary(2025, { revenue_total: 100, revenue_audit: 50, revenue_tax: 30, revenue_advisory: 20, revenue_other: null });
    const mix = buildFirmOverview(current, [current], [], []).revenueMix;
    assert.equal(mix.canChart, true);
    assert.deepEqual(mix.segments.map(segment => [segment.value, segment.share]), [
        [50, 0.5], [30, 0.3], [20, 0.2], [null, null],
    ]);
    assert.match(mix.note, /기타 매출은 미확보/);
    assert.match(mix.note, /확인된 업무별 매출 합계가 총매출과 일치/);
});

test('여러 업무가 결측이면 항목별 결측을 보존하고 명시한다', () => {
    const current = summary(2025, { revenue_total: 100, revenue_audit: 100 });
    const mix = buildFirmOverview(current, [current], [], []).revenueMix;
    assert.equal(mix.canChart, true);
    assert.deepEqual(mix.segments.map(segment => segment.share), [1, null, null, null]);
    assert.match(mix.note, /세무·경영자문·기타 매출은 미확보/);
});

test('업무 매출이 모두 결측이면 총매출이 있어도 원그래프를 만들지 않는다', () => {
    const current = summary(2025, { revenue_total: 100 });
    const mix = buildFirmOverview(current, [current], [], []).revenueMix;
    assert.equal(mix.canChart, false);
    assert.ok(mix.segments.every(segment => segment.value === null && segment.share === null));
    assert.match(mix.note, /모두 미확보/);
});

test('매출 합계 불일치·음수·총매출 미확보·0원은 원금액을 남기고 그래프를 중단한다', () => {
    const base = { revenue_total: 100, revenue_audit: 50, revenue_tax: 30, revenue_advisory: 20, revenue_other: 0 };
    for (const [over, message] of [
        [{ revenue_total: 110 }, /달라/],
        [{ revenue_audit: -10 }, /음수/],
        [{ revenue_total: null }, /미확보/],
        [{ revenue_total: 0, revenue_audit: 0, revenue_tax: 0, revenue_advisory: 0 }, /0원/],
        [{ revenue_audit: Number.POSITIVE_INFINITY }, /수치를 확인/],
        [{ revenue_other: Number.POSITIVE_INFINITY }, /수치를 확인/],
    ] as const) {
        const current = summary(2025, { ...base, ...over });
        const mix = buildFirmOverview(current, [current], [], []).revenueMix;
        assert.equal(mix.canChart, false);
        assert.ok(mix.segments.every(segment => segment.share === null));
        assert.match(mix.note, message);
    }
    const current = summary(2025, { ...base, revenue_audit: -10 });
    assert.equal(buildFirmOverview(current, [current], [], []).revenueMix.segments[0].value, -10);
});

test('그래프 합계 검증은 부동소수점 연산 오차만 허용하며 원 단위 차이를 임의로 무시하지 않는다', () => {
    const decimal = summary(2025, { revenue_total: 0.3, revenue_audit: 0.1, revenue_tax: 0.2, revenue_advisory: 0, revenue_other: 0 });
    assert.equal(buildFirmOverview(decimal, [decimal], [], []).revenueMix.canChart, true);
    const large = summary(2025, { revenue_total: 1_000_000_000_000, revenue_audit: 1_000_000_000_001, revenue_tax: 0, revenue_advisory: 0, revenue_other: 0 });
    assert.equal(buildFirmOverview(large, [large], [], []).revenueMix.canChart, false);
});
