import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BatchItem } from '../lib/serverUtils.ts';
import { hydrateModelAnswers, stringifyModelAnswer } from '../lib/quizGrading.ts';

const item = (id: number, qid: number): BatchItem => ({
    id, qid, q: '', a: '', m: 'undefined', k: [], r: '',
});

test('hydrates each item by real question id (qid), not by array index', () => {
    const items = [item(0, 45), item(1, 12)];
    const questionsV2 = [
        {
            id: 0,
            model_answer: 'WRONG-if-matched-by-index',
            rubric: [
                { sub: 1, label: '물음 1', points: 10, mode: 'all', items: [{ id: '1-1', item: 'A', points: 10, variants: ['A-variant'] }] }
            ]
        },
        {
            id: 12,
            model_answer: ['B-one', 'B-two'],
            rubric: [
                { sub: 1, label: '물음 1', points: 10, mode: 'all', items: [{ id: '1-1', item: 'B', points: 10, variants: ['B-variant'] }] }
            ]
        },
        {
            id: 45,
            model_answer: 'A-answer',
            rubric: [
                { sub: 1, label: '물음 1', points: 10, mode: 'all', items: [{ id: '1-1', item: 'C', points: 10, variants: ['C-variant'] }] }
            ]
        },
    ];

    hydrateModelAnswers(items, questionsV2);

    assert.equal(items[0].m, 'A-answer');       // matched by qid 45, not index 0
    assert.equal(items[1].m, 'B-one\nB-two');   // array joined with newlines
    assert.equal(items[0].invalid, false);
    assert.equal(items[1].invalid, false);
});

test('falls back to invalid flag when no question matches', () => {
    const items = [item(0, 45), item(1, 12)];
    hydrateModelAnswers(items, [{
        id: 999,
        model_answer: 'nope',
        rubric: [
            { sub: 1, label: '물음 1', points: 10, mode: 'all', items: [{ id: '1-1', item: 'D', points: 10, variants: ['D-variant'] }] }
        ]
    }]);
    assert.equal(items[0].invalid, true);
    assert.equal(items[1].invalid, true);
    assert.equal(items[0].errorMsg, '해당 문항의 v2 루브릭 데이터를 찾을 수 없습니다.');
    // 클라이언트가 보낸 m('undefined' placeholder)이 그대로 노출되면 안 된다.
    assert.equal(items[0].m, '');
    assert.deepEqual(items[0].k, []);
});

test('falls back to invalid flag when validation fails', () => {
    const items = [item(0, 45)];
    hydrateModelAnswers(items, [{
        id: 45,
        model_answer: 'nope',
        rubric: [
            { sub: 1, label: '물음 1', points: 8 /* total points != sum items(10) */, mode: 'all', items: [{ id: '1-1', item: 'E', points: 10, variants: ['E-variant'] }] }
        ]
    }]);
    assert.equal(items[0].invalid, true);
    assert.equal(items[0].errorMsg?.includes('루브릭 검증 실패'), true);
    assert.equal(items[0].m, '');
    assert.deepEqual(items[0].k, []);
});

test('stringifyModelAnswer normalizes arrays, scalars, and nullish values', () => {
    assert.equal(stringifyModelAnswer(['a', 'b']), 'a\nb');
    assert.equal(stringifyModelAnswer('x'), 'x');
    assert.equal(stringifyModelAnswer(null), '');
    assert.equal(stringifyModelAnswer(undefined), '');
});
