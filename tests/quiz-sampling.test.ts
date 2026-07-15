import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AuditQuestion } from '../lib/db.ts';
import { getQuizSet } from '../lib/utils.ts';

const q = (id: number, part: string, chapter = 'C', standard = 'S'): AuditQuestion => ({
    id, part, chapter, standard,
    question_title: 't' + id, question_description: '', model_answer: '', explanation: '',
});

test('filters by part and returns only matching questions', () => {
    const data = [q(1, 'PART1'), q(2, 'PART2'), q(3, 'PART1')];
    const set = getQuizSet(data, 'PART1', '전체', '전체', 10, []);
    assert.deepEqual(set.map((x) => x.id).sort(), [1, 3]);
});

test('excludes already-solved ids', () => {
    const data = [q(1, 'PART1'), q(2, 'PART1'), q(3, 'PART1')];
    const set = getQuizSet(data, 'PART1', '전체', '전체', 10, ['2']);
    assert.deepEqual(set.map((x) => x.id).sort(), [1, 3]);
});

test('returns exactly N distinct questions when more candidates exist', () => {
    const data = Array.from({ length: 8 }, (_, i) => q(i + 1, 'PART1'));
    const set = getQuizSet(data, 'PART1', '전체', '전체', 3, []);
    assert.equal(set.length, 3);
    assert.equal(new Set(set.map((x) => x.id)).size, 3); // no duplicates from the shuffle
    for (const x of set) assert.ok(x.id >= 1 && x.id <= 8);
});

test('shuffle is a permutation: every candidate returned once when N >= pool size', () => {
    const data = Array.from({ length: 5 }, (_, i) => q(i + 1, 'PART1'));
    const set = getQuizSet(data, 'PART1', '전체', '전체', 5, []);
    assert.deepEqual(set.map((x) => x.id).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});
