import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFirmDetailView } from '../lib/firm/detailView.ts';
import { clientDetailHref, firmReturnHref } from '../lib/firm/navigation.ts';
import { buildFilterQuery, buildQuery, type SearchParams } from '../lib/firm/params.ts';

test('기본 진입은 주요정보이며 회계법인 보고기간 연도를 사용한다', () => {
    assert.deepEqual(resolveFirmDetailView({}), {
        tab: 'overview', clientView: 'list', group: 'overview', isFirmOwnTab: true,
    });
});

test('상세 메뉴는 사업·고객과 인력·보수로 구분하고 고객 화면만 고객사 사업연도를 사용한다', () => {
    for (const [tab, group, isFirmOwnTab] of [
        ['overview', 'overview', true],
        ['revenue', 'business', true],
        ['clients', 'business', false],
        ['compensation', 'internal', true],
        ['people', 'internal', true],
        ['jobs', 'jobs', false],
    ] as const) {
        assert.deepEqual(resolveFirmDetailView({ tab }), { tab, clientView: 'list', group, isFirmOwnTab });
    }
});

test('채용공고는 독립 메뉴이며 보고기간·사업연도·기존 의견 필터에 종속되지 않는다', () => {
    for (const query of [
        { tab: 'jobs' },
        { tab: 'jobs', year: '2024', fy_start_year: '2025', opinion: '한정' },
        { tab: ['jobs', 'clients'], year: 'unknown', fy_year: 'unknown' },
    ]) {
        assert.deepEqual(resolveFirmDetailView(query), {
            tab: 'jobs', clientView: 'list', group: 'jobs', isFirmOwnTab: false,
        });
    }
});

test('기존 재무·인력·KAM 공유 링크는 대응하는 새 메뉴로 열리며 KAM 선택을 보존한다', () => {
    assert.deepEqual(resolveFirmDetailView({ tab: 'workforce' }), {
        tab: 'revenue', clientView: 'list', group: 'business', isFirmOwnTab: true,
    });
    assert.deepEqual(resolveFirmDetailView({ tab: 'personnel' }), {
        tab: 'compensation', clientView: 'list', group: 'internal', isFirmOwnTab: true,
    });
    assert.deepEqual(resolveFirmDetailView({ tab: 'kam', client_view: 'opinions' }), {
        tab: 'clients', clientView: 'kam', group: 'business', isFirmOwnTab: false,
    });
});

test('감사대상회사의 회사 목록·감사의견·KAM 보기를 각각 직접 열 수 있다', () => {
    for (const clientView of ['list', 'opinions', 'kam'] as const) {
        assert.deepEqual(resolveFirmDetailView({ tab: 'clients', client_view: clientView }), {
            tab: 'clients', clientView, group: 'business', isFirmOwnTab: false,
        });
    }
});

test('기존 의견 필터 링크와 명시적인 목록 보기는 유효한 의견 필터가 있으면 감사의견 보기로 열린다', () => {
    for (const opinion of ['적정', '한정', '부적정', '의견거절']) {
        for (const client_view of [undefined, 'list', '', 'unknown']) {
            const query = { tab: 'clients', client_view, opinion };
            assert.deepEqual(resolveFirmDetailView(query), {
                tab: 'clients', clientView: 'opinions', group: 'business', isFirmOwnTab: false,
            });
            assert.equal(query.opinion, opinion);
        }
    }
});

test('의견 필터는 KAM 선택이나 회계법인 자체 메뉴를 변경하지 않는다', () => {
    for (const query of [
        { tab: 'kam', opinion: '한정' },
        { tab: 'kam', client_view: 'list', opinion: '한정' },
        { tab: 'clients', client_view: 'kam', opinion: '한정' },
    ]) {
        assert.equal(resolveFirmDetailView(query).tab, 'clients');
        assert.equal(resolveFirmDetailView(query).clientView, 'kam');
    }
    for (const tab of ['overview', 'revenue', 'compensation', 'people', 'workforce', 'personnel']) {
        assert.deepEqual(resolveFirmDetailView({ tab, opinion: '한정' }), resolveFirmDetailView({ tab }));
    }
});

test('의견 필터가 비었거나 잘못되면 회사 목록을 유지하고 정상 의견 보기를 되돌리지 않는다', () => {
    for (const opinion of [undefined, '', 'unknown', 'https://outside.example', ['unknown', '한정']]) {
        assert.equal(resolveFirmDetailView({ tab: 'clients', client_view: 'list', opinion }).clientView, 'list');
        assert.equal(resolveFirmDetailView({ tab: 'clients', client_view: 'opinions', opinion }).clientView, 'opinions');
    }
    assert.equal(resolveFirmDetailView({ tab: 'clients', opinion: ['한정', 'unknown'] }).clientView, 'opinions');
});

test('기존 의견 필터 링크는 고객사 왕복 뒤에도 필터를 노출하고 회사 목록 선택으로 해제할 수 있다', () => {
    const legacy = { tab: 'clients', opinion: '한정', year: '2024', fy_start_year: '2025', page: '3' };
    const view = resolveFirmDetailView(legacy);
    const canonical = { ...legacy, tab: view.tab, client_view: view.clientView };
    const company = new URL(clientDetailHref('00126380', 17, 2024, canonical), 'http://localhost');
    const back = new URL(firmReturnHref(17, 2024, Object.fromEntries(company.searchParams)), 'http://localhost');
    const returned = Object.fromEntries(back.searchParams);
    assert.equal(resolveFirmDetailView(returned).clientView, 'opinions');
    assert.equal(returned.opinion, '한정');
    assert.equal(returned.page, '3');
    assert.equal(returned.fy_start_year, '2025');
    const list = new URLSearchParams(buildFilterQuery(returned, { tab: 'clients', client_view: 'list', opinion: null }));
    assert.equal(resolveFirmDetailView(Object.fromEntries(list)).clientView, 'list');
    assert.equal(list.has('opinion'), false);
    assert.equal(list.has('page'), false);
});

test('없는 메뉴·빈 값은 기본 보기로 돌아가며 중복 쿼리는 첫 번째 값만 선택한다', () => {
    for (const tab of ['', 'unknown', 'opinions', 'https://outside.example/menu']) {
        assert.deepEqual(resolveFirmDetailView({ tab, client_view: 'unknown' }), {
            tab: 'overview', clientView: 'list', group: 'overview', isFirmOwnTab: true,
        });
    }
    assert.deepEqual(resolveFirmDetailView({ tab: ['clients', 'people'], client_view: ['opinions', 'kam'] }), {
        tab: 'clients', clientView: 'opinions', group: 'business', isFirmOwnTab: false,
    });
    assert.equal(resolveFirmDetailView({ tab: 'clients', client_view: '' }).clientView, 'list');
    assert.equal(resolveFirmDetailView({ tab: 'clients', client_view: 'external' }).clientView, 'list');
});

test('감사의견·KAM에서 고객사 상세 왕복 시 보기·두 연도·필터·정렬·페이지가 유지된다', () => {
    for (const clientView of ['opinions', 'kam']) {
        const state: SearchParams = {
            tab: 'clients', client_view: clientView, year: '2024', fy_start_year: '2025',
            q: '삼성 & 전자 + 반도체', market: 'Y', listed: 'false', opinion: '한정', sort: 'name', page: '3',
        };
        const company = new URL(clientDetailHref('00126380', 17, 2024, state), 'http://localhost');
        assert.equal(company.pathname, '/companies/00126380');
        assert.equal(company.searchParams.get('firm_id'), '17');
        const back = new URL(firmReturnHref(17, 2024, Object.fromEntries(company.searchParams)), 'http://localhost');
        assert.equal(back.pathname, '/firms/17');
        for (const [key, value] of Object.entries(state)) {
            assert.equal(company.searchParams.get(key), value);
            assert.equal(back.searchParams.get(key), value);
        }
        assert.equal(back.searchParams.has('firm_id'), false);
        assert.equal(resolveFirmDetailView(Object.fromEntries(back.searchParams)).clientView, clientView);
    }
});

test('고객사 연도 변경과 페이지 이동은 회계법인 보고기간 및 선택 보기를 덮어쓰지 않는다', () => {
    const state = { tab: 'clients', client_view: 'opinions', year: '2024', fy_start_year: '2025', page: '3', opinion: '한정' };
    const nextPage = new URLSearchParams(buildQuery(state, { page: 4 }));
    assert.equal(nextPage.get('page'), '4');
    assert.equal(nextPage.get('client_view'), 'opinions');
    assert.equal(nextPage.get('year'), '2024');
    assert.equal(nextPage.get('fy_start_year'), '2025');
    const nextYear = new URLSearchParams(buildFilterQuery(state, { year: 2023 }));
    assert.equal(nextYear.get('year'), '2023');
    assert.equal(nextYear.get('fy_start_year'), '2025');
    assert.equal(nextYear.get('client_view'), 'opinions');
    assert.equal(nextYear.get('opinion'), '한정');
    assert.equal(nextYear.has('page'), false);
    const annualSelection = new URLSearchParams(buildFilterQuery(state, { tab: 'revenue', fy_start_year: 2024 }));
    assert.equal(annualSelection.get('year'), '2024');
    assert.equal(annualSelection.get('fy_start_year'), '2024');
});

test('고객사 왕복은 허용한 화면 상태만 전달하고 외부 URL·임의 법인과 연도를 채택하지 않는다', () => {
    const state = {
        tab: 'clients', client_view: 'kam', fy_start_year: '2025', page: '2',
        firm_id: '999', year: '2099', returnTo: 'https://outside.example', next: '//outside.example',
        redirect: 'https://outside.example', arbitrary: 'unexpected',
    };
    const company = new URL(clientDetailHref('00126380', 17, 2024, state), 'http://localhost');
    assert.equal(company.searchParams.get('firm_id'), '17');
    assert.equal(company.searchParams.get('year'), '2024');
    const back = new URL(firmReturnHref(17, 2023, { ...state, ...Object.fromEntries(company.searchParams) }), 'http://localhost');
    assert.equal(back.searchParams.get('year'), '2023');
    assert.equal(back.searchParams.get('fy_start_year'), '2025');
    assert.equal(back.searchParams.get('client_view'), 'kam');
    assert.equal(back.searchParams.get('page'), '2');
    assert.equal(back.searchParams.has('firm_id'), false);
    for (const key of ['returnTo', 'next', 'redirect', 'arbitrary']) {
        assert.equal(company.searchParams.has(key), false);
        assert.equal(back.searchParams.has(key), false);
    }
});
