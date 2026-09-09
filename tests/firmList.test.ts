import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildFirmList,
    clientCountChange,
    defaultFirmSortDirection,
    DEFAULT_FIRM_LIST_YEAR,
    resolveFirmListYear,
} from '../lib/firm/list.ts';
import type { FirmSummaryRow, RegisteredFirm } from '../lib/firm/types.ts';

function firm(id: number, name: string): RegisteredFirm {
    return { firm_id: id, firm_name: name, alias: [], status: 'active', tier: null, registration_no: null, dart_corp_code: null };
}

function summary(id: number, count: number, over: Partial<FirmSummaryRow> = {}): FirmSummaryRow {
    return {
        firm_id: id, firm_name: `법인${id}`, tier: null, status: 'active', bsns_year: 2025,
        client_count: count, listed_client_count: 0, unlisted_client_count: count,
        avg_client_revenue: null, avg_client_operating_profit: null, avg_client_net_income: null,
        opinion_unqualified_count: 0, opinion_qualified_count: 0, opinion_adverse_count: 0,
        opinion_disclaimer_count: 0, opinion_modified_count: 0, avg_kam_count: null,
        revenue_total: null, revenue_audit: null, operating_income: null, net_income: null,
        director_count: null, employee_total: null, salary_total: null, salary_avg: null,
        revenue_per_employee: null, salary_per_employee: null, employee_per_director: null,
        audit_revenue_ratio: null,
        ...over,
    };
}

const ids = (rows: ReturnType<typeof buildFirmList>) => rows.map(row => row.firm.firm_id);

test('최신 수집연도와 관계없이 목록 기본연도는 2025다', () => {
    assert.equal(DEFAULT_FIRM_LIST_YEAR, 2025);
    for (const years of [[2026, 2025, 2024], [2026], [2024], []]) {
        assert.equal(resolveFirmListYear(years), 2025);
        assert.equal(resolveFirmListYear(years, 0), 2025);
    }
});

test('명시한 사용 가능 연도는 존중하고 잘못되거나 미확보된 요청은 2025로 돌아간다', () => {
    assert.equal(resolveFirmListYear([2026, 2025, 2024], 2026), 2026);
    assert.equal(resolveFirmListYear([2026, 2025, 2024], 2024), 2024);
    assert.equal(resolveFirmListYear([], 2025), 2025);
    for (const requested of [2023, 2027, -1, Number.NaN, Number.POSITIVE_INFINITY, 2025.5]) {
        assert.equal(resolveFirmListYear([2026, 2025, 2024], requested), 2025);
    }
    assert.equal(resolveFirmListYear([2025], 2026), 2025);
});

test('정렬 방향을 생략하면 숫자는 내림차순, 법인명은 오름차순을 유지한다', () => {
    assert.equal(defaultFirmSortDirection('clients'), 'desc');
    assert.equal(defaultFirmSortDirection('client_revenue'), 'desc');
    assert.equal(defaultFirmSortDirection('name'), 'asc');
    const firms = [firm(1, '나'), firm(2, '가')];
    const summaries = [summary(1, 10, { avg_client_revenue: 100 }), summary(2, 20, { avg_client_revenue: 50 })];
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'clients')), [2, 1]);
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'client_revenue')), [1, 2]);
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'name')), [2, 1]);
});

test('감사대상회사 수 오름·내림차순에서 실제 0과 자료 없는 법인을 구분한다', () => {
    const firms = [firm(1, '가'), firm(2, '나'), firm(3, '다'), firm(4, '라')];
    const summaries = [summary(1, 10), summary(2, 0), summary(3, 20)];
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'clients', 'asc')), [2, 1, 3, 4]);
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'clients', 'desc')), [3, 1, 2, 4]);
    assert.equal(buildFirmList(firms, summaries, undefined, 'clients', 'asc')[3].summary, null);
});

test('평균 매출액은 음수·0·양수를 정렬하고 결측은 양방향 모두 뒤에 둔다', () => {
    const firms = [firm(1, '가'), firm(2, '나'), firm(3, '다'), firm(4, '라'), firm(5, '마')];
    const summaries = [
        summary(1, 10, { avg_client_revenue: null }), summary(2, 10, { avg_client_revenue: 0 }),
        summary(3, 10, { avg_client_revenue: -50 }), summary(4, 10, { avg_client_revenue: 100 }),
    ];
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'client_revenue', 'asc')), [3, 2, 4, 1, 5]);
    assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, 'client_revenue', 'desc')), [4, 2, 3, 1, 5]);
});

test('동점은 입력 순서와 무관하게 한국어 법인명, 같은 이름은 ID 순으로 고정한다', () => {
    const firms = [firm(9, '다'), firm(3, '가'), firm(2, '나'), firm(1, '가')];
    const summaries = firms.map(value => summary(value.firm_id, 10, { avg_client_revenue: 100 }));
    for (const sort of ['clients', 'client_revenue'] as const) {
        for (const direction of ['asc', 'desc'] as const) {
            assert.deepEqual(ids(buildFirmList(firms, summaries, undefined, sort, direction)), [1, 3, 2, 9]);
            assert.deepEqual(ids(buildFirmList([...firms].reverse(), summaries, undefined, sort, direction)), [1, 3, 2, 9]);
        }
    }
    assert.deepEqual(ids(buildFirmList(firms, [], undefined, 'name', 'asc')), [1, 3, 2, 9]);
    assert.deepEqual(ids(buildFirmList(firms, [], undefined, 'name', 'desc')), [9, 2, 1, 3]);
});

test('검색은 공백·대소문자를 정규화하고 정렬이 원래 입력 배열을 바꾸지 않는다', () => {
    const firms = [firm(1, 'ABC 회계법인'), firm(2, '가나다 회계법인'), firm(3, '가 나 다 파트너스')];
    const originalIds = firms.map(value => value.firm_id);
    assert.deepEqual(ids(buildFirmList(firms, [], ' a b c ', 'name', 'desc')), [1]);
    assert.deepEqual(ids(buildFirmList(firms, [], '가 나다', 'name', 'desc')).sort((a, b) => a - b), [2, 3]);
    assert.deepEqual(firms.map(value => value.firm_id), originalIds);
});

test('감사대상회사 수 전년 대비 증감은 양수·음수·보합·0건을 그대로 계산한다', () => {
    const prior = summary(1, 10, { bsns_year: 2024 });
    assert.equal(clientCountChange(summary(1, 15), prior), 5);
    assert.equal(clientCountChange(summary(1, 7), prior), -3);
    assert.equal(clientCountChange(summary(1, 10), prior), 0);
    assert.equal(clientCountChange(summary(1, 0), prior), -10);
    assert.equal(clientCountChange(summary(1, 10), { ...prior, client_count: 0 }), 10);
    assert.equal(clientCountChange(summary(1, 0), { ...prior, client_count: 0 }), 0);
});

test('누락된 전년 자료나 다른 법인·사업연도는 0건이나 증감으로 추정하지 않는다', () => {
    const current = summary(1, 10);
    const prior = summary(1, 5, { bsns_year: 2024 });
    assert.equal(clientCountChange(current, null), null);
    assert.equal(clientCountChange(current, undefined), null);
    assert.equal(clientCountChange(null, prior), null);
    assert.equal(clientCountChange(undefined, prior), null);
    assert.equal(clientCountChange(current, { ...prior, firm_id: 2 }), null);
    for (const year of [2023, 2025, 2026, 2024.5, Number.NaN]) {
        assert.equal(clientCountChange(current, { ...prior, bsns_year: year }), null);
    }
});

test('안전한 비음수 정수가 아닌 감사대상회사 수는 증감 계산에 사용하지 않는다', () => {
    const current = summary(1, 10);
    const prior = summary(1, 5, { bsns_year: 2024 });
    const invalidCounts = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, null, undefined];
    for (const value of invalidCounts) {
        const invalid = { ...current, client_count: value } as FirmSummaryRow;
        assert.equal(clientCountChange(invalid, prior), null);
        assert.equal(clientCountChange(current, { ...invalid, bsns_year: 2024 }), null);
    }
});
