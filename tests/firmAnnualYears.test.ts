import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annualPeriodsForYear, isAnnualStartYear, isAnnualYear, selectAnnualYear } from '../lib/firm/annualYears.ts';

test('자체 결산연도는 최신 확보 자료로 시작하고 사용자의 명시적 결측 연도 선택도 보존한다', () => {
    assert.equal(selectAnnualYear(0, [2024, 2026, 2025]), 2026);
    assert.equal(selectAnnualYear(0, [2025, 2024]), 2025);
    assert.equal(selectAnnualYear(2026, [2025]), 2026);
    assert.equal(selectAnnualYear(2030, []), 2026);
    assert.equal(isAnnualYear(2026), true);
    assert.equal(isAnnualYear(2023), false);
    assert.equal(isAnnualStartYear(2023), true);
});

test('시작연도는 단순히 결산연도에서 1을 빼지 않으며 동일 시작연도 두 기수를 보존한다', () => {
    const periods = [
        { bsns_year: 2024, fy_start_year: 2024, fy_start_date: '2024-01-01', fy_end_date: '2024-06-30' },
        { bsns_year: 2025, fy_start_year: 2024, fy_start_date: '2024-07-01', fy_end_date: '2025-06-30' },
        { bsns_year: 2026, fy_start_year: 2025, fy_start_date: '2025-07-01', fy_end_date: '2026-06-30' },
    ];
    const selected = annualPeriodsForYear(periods, 2024);
    assert.equal(selected.periods.length, 2);
    assert.deepEqual(selected.periods.map(p => p.fy_end_date), ['2025-06-30', '2024-06-30']);
    assert.equal(annualPeriodsForYear(periods, 0).year, 2025);
    assert.equal(annualPeriodsForYear(periods, 0, 2025).year, 2024);
    assert.equal(annualPeriodsForYear(periods, 2023, 2025).periods.length, 0);
});
