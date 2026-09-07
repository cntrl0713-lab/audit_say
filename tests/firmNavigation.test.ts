import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientDetailHref, firmReturnHref } from '../lib/firm/navigation.ts';
import { buildFirmList } from '../lib/firm/list.ts';
import { buildFilterQuery, buildQuery, readInt } from '../lib/firm/params.ts';
import type { FirmSummaryRow, RegisteredFirm } from '../lib/firm/types.ts';

test('고객사 상세 왕복 시 선택 법인·연도·검색·정렬·페이지를 보존한다', () => {
    const state = { q: '삼성 & 전자', tab: 'clients', sort: 'name', page: '2', market: 'Y' };
    const detail = new URL(clientDetailHref('00126380', 2, 2024, state), 'http://localhost');
    assert.equal(detail.searchParams.get('firm_id'), '2');
    assert.equal(detail.searchParams.get('year'), '2024');
    const back = new URL(firmReturnHref(2, 2024, Object.fromEntries(detail.searchParams)), 'http://localhost');
    assert.equal(back.pathname, '/firms/2');
    for (const [key, value] of Object.entries(state)) assert.equal(back.searchParams.get(key), value);
    assert.equal(back.searchParams.get('year'), '2024');
    assert.equal(back.searchParams.has('firm_id'), false);
});

test('외부 복귀 URL·임의 쿼리는 고객사 링크에 전달하지 않는다', () => {
    const result = clientDetailHref('00126380', 2, 2024, { returnTo: 'https://outside.example', firm_id: '3', year: '2025' });
    assert.equal(result, '/companies/00126380?firm_id=2&year=2024');
});

test('페이지 이동은 2쪽으로 가고 필터 변경만 페이지를 초기화한다', () => {
    const query = { year: '2024', tab: 'kam', page: '1' };
    assert.equal(new URLSearchParams(buildQuery(query, { page: 2 })).get('page'), '2');
    assert.equal(new URLSearchParams(buildFilterQuery(query, { year: 2025 })).get('page'), null);
    assert.equal(readInt({ page: '9007199254740992' }, 'page', 1), 1);
});

const firm = (id: number, name: string): RegisteredFirm => ({ firm_id: id, firm_name: name,
    alias: [], status: 'active', tier: null, registration_no: null, dart_corp_code: null });
const summary = (id: number, count: number, revenue: number | null) => ({ firm_id: id,
    client_count: count, avg_client_revenue: revenue }) as FirmSummaryRow;

test('공시 없는 법인도 검색되며 고객사 수 0으로 만들지 않는다', () => {
    const rows = buildFirmList([firm(1, '삼일회계법인'), firm(2, '삼정회계법인')], [summary(1, 0, 0)], '삼 정', 'clients');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firm.firm_id, 2);
    assert.equal(rows[0].summary, null);
});

test('고객사 금액 정렬은 0·음수·미확보를 구분하고 미확보를 뒤로 둔다', () => {
    const firms = [firm(1, '가'), firm(2, '나'), firm(3, '다'), firm(4, '라')];
    const rows = buildFirmList(firms, [summary(1, 1, null), summary(2, 2, -5), summary(3, 0, 0)], undefined, 'client_revenue');
    assert.deepEqual(rows.map((r) => r.firm.firm_id), [3, 2, 1, 4]);
    assert.deepEqual(buildFirmList(firms, [summary(1, 1, null), summary(2, 2, -5), summary(3, 0, 0)], undefined, 'clients').map((r) => r.firm.firm_id), [2, 1, 3, 4]);
});
