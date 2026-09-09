import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPartnerStaffing } from '../lib/firm/partnerStaffing.ts';
import type { FirmAnnualPeriodRef, FirmHeadcountRow } from '../lib/firm/types.ts';

const PERIOD: FirmAnnualPeriodRef = {
    firm_id: 1,
    bsns_year: 2025,
    fy_start_year: 2024,
    fy_start_date: '2024-07-01',
    fy_end_date: '2025-06-30',
    fy_seq: 1,
    source_rcept_no: '20250901000001',
    source_rcept_dt: '2025-09-01',
};

function headcount(code: string, value: number | null, over: Partial<FirmHeadcountRow> = {}): FirmHeadcountRow {
    return { ...PERIOD, code, numeric_value: value, raw_text: null, occurrence: 1, unit_multiplier: 1, ...over };
}

test('출자사원을 분자에서 제외하고 출자사원 1인당 인원을 계산한다', () => {
    const value = buildPartnerStaffing(PERIOD, [headcount('HR_CPA_ALL', 100), headcount('HR_E_ALL', 20)]);
    assert.deepEqual(value, {
        cpa: 100, equityMembers: 20, nonMemberCpa: 80, perEquityMember: 4, note: '같은 보고기간 말 인원표 기준',
    });
});

test('소속 등록·수습·이사 인원을 대체하거나 별도로 차감하지 않는다', () => {
    const value = buildPartnerStaffing(PERIOD, [
        headcount('HR_CPA_ALL', 3073), headcount('HR_E_ALL', 301),
        headcount('HR_R_ALL', 2512), headcount('HR_P_ALL', 260), headcount('HR_D_ALL', 173),
    ]);
    assert.equal(value.nonMemberCpa, 2772);
    assert.equal(value.perEquityMember, 2772 / 301);
});

test('실제 비출자 인원 0명은 0으로 표시하고 인원 결측은 추정하지 않는다', () => {
    const zero = buildPartnerStaffing(PERIOD, [headcount('HR_CPA_ALL', 10), headcount('HR_E_ALL', 10)]);
    assert.equal(zero.nonMemberCpa, 0);
    assert.equal(zero.perEquityMember, 0);
    for (const rows of [
        [],
        [headcount('HR_CPA_ALL', 10)],
        [headcount('HR_E_ALL', 10)],
        [headcount('HR_CPA_ALL', null), headcount('HR_E_ALL', 10)],
        [headcount('HR_CPA_ALL', 10), headcount('HR_E_ALL', null)],
        [headcount('HR_R_ALL', 10), headcount('HR_D_ALL', 2)],
    ]) {
        const missing = buildPartnerStaffing(PERIOD, rows);
        assert.equal(missing.nonMemberCpa, null);
        assert.equal(missing.perEquityMember, null);
        assert.match(missing.note, /미확보/);
    }
});

test('출자사원이 실제 0명이면 비출자 인원은 남기되 1인당 수치는 만들지 않는다', () => {
    for (const cpa of [0, 100]) {
        const value = buildPartnerStaffing(PERIOD, [headcount('HR_CPA_ALL', cpa), headcount('HR_E_ALL', 0)]);
        assert.equal(value.equityMembers, 0);
        assert.equal(value.nonMemberCpa, cpa);
        assert.equal(value.perEquityMember, null);
        assert.match(value.note, /0명/);
    }
});

test('출자사원이 전체 공인회계사보다 많으면 음수 인원·비율을 만들지 않는다', () => {
    const value = buildPartnerStaffing(PERIOD, [headcount('HR_CPA_ALL', 10), headcount('HR_E_ALL', 11)]);
    assert.equal(value.cpa, 10);
    assert.equal(value.equityMembers, 11);
    assert.equal(value.nonMemberCpa, null);
    assert.equal(value.perEquityMember, null);
    assert.match(value.note, /보다 커서/);
});

test('분자·분모 원문 칸 중복은 값이 같아도 선택하지 않는다', () => {
    for (const code of ['HR_CPA_ALL', 'HR_E_ALL']) {
        for (const occurrence of [1, 2]) {
            const value = buildPartnerStaffing(PERIOD, [
                headcount('HR_CPA_ALL', 100), headcount('HR_E_ALL', 20),
                headcount(code, code === 'HR_CPA_ALL' ? 100 : 20, { occurrence }),
            ]);
            assert.equal(value.nonMemberCpa, null);
            assert.equal(value.perEquityMember, null);
            assert.match(value.note, /원문 칸 2개/);
        }
    }
});

test('잘못된 단위·출현번호·인원 수치는 분자와 분모 어느 쪽에서도 허용하지 않는다', () => {
    const invalid: Partial<FirmHeadcountRow>[] = [
        { unit_multiplier: 1000 }, { occurrence: 2 }, { numeric_value: -1 },
        { numeric_value: 1.5 }, { numeric_value: Number.NaN },
        { numeric_value: Number.POSITIVE_INFINITY }, { numeric_value: Number.MAX_SAFE_INTEGER + 1 },
    ];
    for (const code of ['HR_CPA_ALL', 'HR_E_ALL']) {
        for (const over of invalid) {
            const rows = [headcount('HR_CPA_ALL', 100), headcount('HR_E_ALL', 20)].map(row => row.code === code ? { ...row, ...over } : row);
            const value = buildPartnerStaffing(PERIOD, rows);
            assert.equal(value.nonMemberCpa, null);
            assert.equal(value.perEquityMember, null);
            assert.match(value.note, /확인|단위|출현번호/);
        }
    }
});

test('다른 법인·공시·보고기간의 인원은 중복 판단에도 계산에도 섞이지 않는다', () => {
    const mismatches: Partial<FirmHeadcountRow>[] = [
        { firm_id: 2 }, { source_rcept_no: 'other-report' }, { bsns_year: 2024 },
        { fy_start_year: 2023 }, { fy_start_date: '2024-01-01' }, { fy_end_date: '2024-12-31' },
    ];
    const value = buildPartnerStaffing(PERIOD, [
        headcount('HR_CPA_ALL', 100), headcount('HR_E_ALL', 20),
        ...mismatches.flatMap(over => [headcount('HR_CPA_ALL', 999, over), headcount('HR_E_ALL', 999, over)]),
    ]);
    assert.equal(value.nonMemberCpa, 80);
    assert.equal(value.perEquityMember, 4);
    for (const over of mismatches) {
        const mixed = buildPartnerStaffing(PERIOD, [headcount('HR_CPA_ALL', 100), headcount('HR_E_ALL', 20, over)]);
        assert.equal(mixed.equityMembers, null);
        assert.equal(mixed.perEquityMember, null);
    }
});

test('같은 시작연도에 여러 기수가 있어도 선택된 공시의 비율만 계산한다', () => {
    const secondPeriod: FirmAnnualPeriodRef = {
        ...PERIOD, fy_start_date: '2024-01-01', fy_end_date: '2024-06-30',
        bsns_year: 2024, source_rcept_no: '20240901000001',
    };
    const rows = [
        headcount('HR_CPA_ALL', 100), headcount('HR_E_ALL', 20),
        headcount('HR_CPA_ALL', 60, secondPeriod), headcount('HR_E_ALL', 10, secondPeriod),
    ];
    assert.equal(buildPartnerStaffing(PERIOD, rows).perEquityMember, 4);
    assert.equal(buildPartnerStaffing(secondPeriod, rows).perEquityMember, 5);
});
