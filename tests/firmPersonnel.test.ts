import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCostConcepts,
    buildPersonnelCostSegments,
    buildTenureSegments,
    rowsForReceipt,
    splitCostSegments,
    splitTenureSegments,
    summarizeTurnover,
} from '../lib/firm/personnel.ts';
import type { FirmCpaTenureRow, FirmPersonnelCostRow, FirmSegment } from '../lib/firm/types.ts';

const PERIOD = {
    firm_id: 1,
    bsns_year: 2025,
    fy_start_year: 2025,
    fy_start_date: '2025-01-01',
    fy_end_date: '2025-12-31',
    fy_seq: 30,
    source_rcept_no: '20260101000001',
    source_rcept_dt: '2026-01-01',
};

function tenure(segment: FirmSegment, over: Partial<FirmCpaTenureRow> = {}): FirmCpaTenureRow {
    return {
        ...PERIOD,
        segment,
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

function cost(over: Partial<FirmPersonnelCostRow> = {}): FirmPersonnelCostRow {
    return {
        ...PERIOD,
        concept: 'personnel_total',
        segment: 'total',
        amount: null,
        headcount: null,
        source_table: 'TG_BSAL',
        match_method: 'form_table',
        ...over,
    };
}

describe('buildTenureSegments', () => {
    test('비중의 분모는 구간 값이 확인된 인원이다', () => {
        const [view] = buildTenureSegments([
            tenure('audit', { under_1y: 25, y1_3: 75, total: 100 }),
        ]);
        assert.equal(view.observed, 100);
        assert.equal(view.bands[0].share, 0.25);
        assert.equal(view.bands[1].share, 0.75);
    });

    test('결측 구간은 0 이 아니라 결측으로 남고 분모에서도 빠진다', () => {
        // 공시가 구간을 비워 둔 것과 인원이 0 인 것은 다르다.
        const [view] = buildTenureSegments([tenure('other', { y5_10: 2, over_15y: 6, total: 8 })]);
        assert.equal(view.bands[0].count, null);
        assert.equal(view.bands[0].share, null);
        assert.equal(view.observed, 8);
        assert.equal(view.bands[1].share, null);
        assert.equal(view.bands[3].share, 0.25);
    });

    test('구간이 하나도 없으면 합도 비중도 결측이다', () => {
        const [view] = buildTenureSegments([tenure('tax')]);
        assert.equal(view.observed, null);
        assert.ok(view.bands.every((band) => band.count === null && band.share === null));
        assert.equal(view.totalMismatch, false);
    });

    test('구간 합과 공시 합계가 어긋나면 값을 고치지 않고 표시한다', () => {
        const [view] = buildTenureSegments([tenure('audit', { under_1y: 10, y1_3: 10, total: 25 })]);
        assert.equal(view.observed, 20);
        assert.equal(view.total, 25);
        assert.equal(view.totalMismatch, true);
    });

    test('부문은 전체를 먼저 두고 공시 순서를 따른다', () => {
        const views = buildTenureSegments([tenure('other'), tenure('audit'), tenure('total'), tenure('tax')]);
        assert.deepEqual(
            views.map((view) => view.segment),
            ['total', 'audit', 'tax', 'other'],
        );
    });
});

describe('splitTenureSegments', () => {
    test('값이 하나도 없는 부문은 표에서 빼되 이름은 남긴다', () => {
        const views = buildTenureSegments([
            tenure('total', { under_1y: 2, total: 83 }),
            tenure('tax'),
            tenure('advisory'),
        ]);
        const { shown, omitted } = splitTenureSegments(views);
        assert.deepEqual(shown.map((view) => view.segment), ['total']);
        assert.deepEqual(omitted.map((view) => view.segment), ['tax', 'advisory']);
    });

    test('구간은 비어도 공시 합계가 있으면 남긴다', () => {
        // 합계만 적어 둔 공시를 "미공시"로 지워 버리면 안 된다.
        const { shown, omitted } = splitTenureSegments(buildTenureSegments([tenure('audit', { total: 12 })]));
        assert.equal(shown.length, 1);
        assert.equal(omitted.length, 0);
    });
});

describe('summarizeTurnover', () => {
    test('입·퇴사는 전체 세그먼트에서만 읽는다', () => {
        // 부문별 행에는 입퇴사가 공시되지 않는다. 다른 부문에서 끌어오면 안 된다.
        const view = summarizeTurnover([
            tenure('audit', { begin_count: 900, hires: 100, leavers: 50, end_count: 950 }),
            tenure('total', { begin_count: 2742, hires: 308, leavers: 237, end_count: 2813 }),
        ]);
        assert.equal(view?.begin, 2742);
        assert.equal(view?.end, 2813);
        assert.equal(view?.net, 71);
        assert.equal(view?.reconciles, true);
    });

    test('퇴사율의 분모는 기초 인원이고 0 이면 계산하지 않는다', () => {
        assert.equal(summarizeTurnover([tenure('total', { begin_count: 200, leavers: 40 })])?.leaverRate, 0.2);
        assert.equal(summarizeTurnover([tenure('total', { begin_count: 0, leavers: 3 })])?.leaverRate, null);
    });

    test('기초 + 입사 − 퇴사가 기말과 다르면 알리고, 하나라도 없으면 판정하지 않는다', () => {
        const off = summarizeTurnover([tenure('total', { begin_count: 100, hires: 10, leavers: 5, end_count: 120 })]);
        assert.equal(off?.reconciles, false);
        const partial = summarizeTurnover([tenure('total', { begin_count: 100, end_count: 120 })]);
        assert.equal(partial?.reconciles, null);
        assert.equal(partial?.net, 20);
    });

    test('전체 세그먼트가 없거나 네 값이 모두 결측이면 null 이다', () => {
        assert.equal(summarizeTurnover([tenure('audit', { total: 10 })]), null);
        assert.equal(summarizeTurnover([tenure('total', { total: 10 })]), null);
    });
});

describe('buildPersonnelCostSegments', () => {
    test('1인당 인건비는 같은 표의 인원으로 나누고 인원이 없으면 계산하지 않는다', () => {
        const views = buildPersonnelCostSegments([
            cost({ segment: 'audit', amount: 400, headcount: 8 }),
            cost({ segment: 'tax', amount: 300, headcount: null }),
            cost({ segment: 'other', amount: 100, headcount: 0 }),
        ]);
        assert.equal(views.find((view) => view.segment === 'audit')?.perHead, 50);
        assert.equal(views.find((view) => view.segment === 'tax')?.perHead, null);
        assert.equal(views.find((view) => view.segment === 'other')?.perHead, null);
    });

    test('같은 부문이 겹치면 공시 표에서 읽은 행을 쓴다', () => {
        // 손익계산서에서 유도한 값보다 공시 표의 값이 원문에 가깝다.
        const views = buildPersonnelCostSegments([
            cost({ segment: 'audit', amount: 111, match_method: 'account_label' }),
            cost({ segment: 'audit', amount: 222, match_method: 'form_table' }),
        ]);
        assert.equal(views.length, 1);
        assert.equal(views[0].amount, 222);
        assert.equal(views[0].note, null);
    });

    test('유도한 값은 출처를 밝힌다', () => {
        const [view] = buildPersonnelCostSegments([cost({ segment: 'total', amount: 9, match_method: 'account_code' })]);
        assert.match(view.note ?? '', /손익계산서/);
    });

    test('인건비가 아닌 개념은 부문 표에 넣지 않는다', () => {
        assert.deepEqual(buildPersonnelCostSegments([cost({ concept: 'welfare', amount: 5 })]), []);
    });
});

describe('splitCostSegments', () => {
    test('금액도 인원도 없는 부문만 뺀다', () => {
        const views = buildPersonnelCostSegments([
            cost({ segment: 'audit', amount: 100, headcount: 5 }),
            cost({ segment: 'tax', amount: null, headcount: 3 }),
            cost({ segment: 'advisory', amount: null, headcount: null }),
        ]);
        const { shown, omitted } = splitCostSegments(views);
        // 인원만 공시한 부문은 남긴다. 금액이 없다는 사실도 정보다.
        assert.deepEqual(shown.map((view) => view.segment), ['audit', 'tax']);
        assert.deepEqual(omitted.map((view) => view.segment), ['advisory']);
    });
});

describe('buildCostConcepts', () => {
    test('인건비를 뺀 전체 기준 비용만, 정해진 순서로 낸다', () => {
        const views = buildCostConcepts([
            cost({ concept: 'entertainment', amount: 3 }),
            cost({ concept: 'welfare', amount: 2 }),
            cost({ concept: 'quality_personnel', amount: 1 }),
            cost({ concept: 'personnel_total', amount: 99 }),
        ]);
        assert.deepEqual(
            views.map((view) => view.concept),
            ['quality_personnel', 'welfare', 'entertainment'],
        );
    });

    test('금액이 없는 항목과 부문별 행은 내보내지 않는다', () => {
        const views = buildCostConcepts([
            cost({ concept: 'training', amount: null }),
            cost({ concept: 'travel', segment: 'audit', amount: 7 }),
        ]);
        assert.deepEqual(views, []);
    });
});

describe('rowsForReceipt', () => {
    test('같은 해에 시작한 보고기간이 둘이면 접수번호로 갈라 낸다', () => {
        // 결산말 연도로 고르면 두 기간이 한 화면에 섞인다.
        const rows = [
            cost({ source_rcept_no: 'A', amount: 1 }),
            cost({ source_rcept_no: 'B', amount: 2 }),
            cost({ source_rcept_no: 'A', amount: 3, segment: 'audit' }),
        ];
        assert.deepEqual(
            rowsForReceipt(rows, 'A').map((row) => row.amount),
            [1, 3],
        );
    });
});
