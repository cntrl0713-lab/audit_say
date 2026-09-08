import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendHistoryPage } from '../app/history/historyPagination.ts';

test('overlapping history pages retain existing rows and append each older attempt once', () => {
    const current = [{ id: '3', title: '최근 풀이' }, { id: '2', title: '이전 풀이' }];
    const next = [{ id: '2', title: '겹치는 풀이' }, { id: '1', title: '오래된 풀이' }, { id: '1', title: '중복 응답' }];
    assert.deepEqual(appendHistoryPage(current, next), [...current, next[1]]);
    assert.equal(current.length, 2);
    assert.equal(next.length, 3);
});

test('same-time history records remain distinct by ID and an empty final page preserves them', () => {
    const sameTime = '2026-09-08T02:00:00.123456+00:00';
    const first = [{ id: 'b', submitted_at: sameTime }];
    const second = [{ id: 'a', submitted_at: sameTime }];
    const combined = appendHistoryPage(first, second);
    assert.deepEqual(combined, [...first, ...second]);
    assert.deepEqual(appendHistoryPage(combined, []), combined);
});
