import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BatchItem } from '../lib/serverUtils.ts';
import { hydrateModelAnswers, stringifyModelAnswer } from '../lib/quizGrading.ts';

const item = (id: number, qid: number): BatchItem => ({
    id, qid, q: '', a: '', m: 'undefined', k: [], r: '',
});

test('hydrates each item by real question id (qid), not by array index', () => {
    const items = [item(0, 45), item(1, 12)];
    const questions = [
        { id: 0, model_answer: 'WRONG-if-matched-by-index' }, // id equals item[0].id -> must NOT match
        { id: 12, model_answer: ['B-one', 'B-two'] },
        { id: 45, model_answer: 'A-answer' },
    ];

    hydrateModelAnswers(items, questions);

    assert.equal(items[0].m, 'A-answer');       // matched by qid 45, not index 0
    assert.equal(items[1].m, 'B-one\nB-two');   // array joined with newlines
});

test('falls back to empty string when no question matches (so the UI fallback shows)', () => {
    const items = [item(0, 45), item(1, 12)];
    hydrateModelAnswers(items, [{ id: 999, model_answer: 'nope' }]);
    assert.equal(items[0].m, '');
    assert.equal(items[1].m, '');
});

test('stringifyModelAnswer normalizes arrays, scalars, and nullish values', () => {
    assert.equal(stringifyModelAnswer(['a', 'b']), 'a\nb');
    assert.equal(stringifyModelAnswer('x'), 'x');
    assert.equal(stringifyModelAnswer(null), '');
    assert.equal(stringifyModelAnswer(undefined), '');
});
