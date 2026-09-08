import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLineSeries, buildStackedBars, niceTicks } from '../lib/firm/chart.ts';
import { buildTenureSegments } from '../lib/firm/personnel.ts';
import type { FirmCpaTenureRow } from '../lib/firm/types.ts';

test('중간 결측은 선을 끊고 0은 원래 수치로 남는다', () => {
    const result = buildLineSeries([1, null, 0, 4].map((value, x) => ({ x, label: String(x), value })));
    assert.equal(result.segments.length, 2);
    assert.deepEqual(
        result.dots.map((p) => p.value),
        [1, 0, 4],
    );
    assert.ok(result.segments.every((s) => !/NaN|Infinity/.test(s)));
});

test('빈 계열·전부 결측·단일 점에서도 유한한 좌표를 만든다', () => {
    assert.deepEqual(buildLineSeries([]).segments, []);
    assert.deepEqual(buildLineSeries([{ x: 2024, label: '2024', value: null }]).segments, []);
    const single = buildLineSeries([{ x: 2024, label: '2024', value: 5 }]);
    assert.equal(single.dots.length, 1);
    assert.ok(Number.isFinite(single.dots[0].cx) && Number.isFinite(single.dots[0].cy));
});

test('눈금은 음수·상수·소수 범위를 포함하며 오름차순이다', () => {
    for (const [min, max] of [
        [-12, 25],
        [-5, -5],
        [0, 0],
        [10, 10],
        [0.001, 0.009],
    ]) {
        const ticks = niceTicks(min, max);
        assert.ok(ticks.length >= 2);
        assert.ok(ticks[0] <= min && ticks.at(-1)! >= max);
        assert.ok(ticks.every((value, index) => Number.isFinite(value) && (index === 0 || value > ticks[index - 1])));
    }
});

test('막대는 확인된 구간 비중만 쓰며 공시 합계와 불일치해도 재계산하지 않는다', () => {
    const rows = buildTenureSegments([
        {
            segment: 'total',
            under_1y: 10,
            y1_3: 30,
            y3_5: null,
            y5_10: null,
            y10_15: null,
            over_15y: null,
            total: 50,
        } as FirmCpaTenureRow,
    ]);
    const result = buildStackedBars(rows);
    assert.equal(result.bars.length, 2);
    assert.equal(result.bars[0].width / result.bars[1].width, 1 / 3);
    assert.equal(rows[0].total, 50);
    assert.equal(rows[0].observed, 40);
    assert.equal(rows[0].totalMismatch, true);
    assert.deepEqual(buildStackedBars([]).bars, []);
});
