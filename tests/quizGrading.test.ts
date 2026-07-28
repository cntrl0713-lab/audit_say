import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GradeRequestItem } from '../lib/serverUtils.ts';
import { hydrateModelAnswers, stringifyModelAnswer } from '../lib/quizGrading.ts';

const request = (id: number, qid: number, a = 'answer'): GradeRequestItem => ({ id, qid, a });

const validRubric = (itemText: string, variant: string) => ([
    { sub: 1, label: '물음 1', points: 10, mode: 'all', items: [{ id: '1-1', item: itemText, points: 10, variants: [variant] }] }
]);

test('hydrates each item by real question id (qid), not by array index', () => {
    const questionsV2 = [
        { id: 0, model_answer: 'WRONG-if-matched-by-index', rubric: validRubric('A', 'A-variant') },
        { id: 12, model_answer: ['B-one', 'B-two'], rubric: validRubric('B', 'B-variant') },
        { id: 45, model_answer: 'A-answer', rubric: validRubric('C', 'C-variant') },
    ];

    const items = hydrateModelAnswers([request(0, 45), request(1, 12)], questionsV2);

    assert.equal(items[0].m, 'A-answer');       // matched by qid 45, not index 0
    assert.equal(items[1].m, 'B-one\nB-two');   // array joined with newlines
    assert.equal(items[0].invalid, false);
    assert.equal(items[1].invalid, false);
});

test('question text comes from the DB row, never from the request', () => {
    // 클라이언트는 질문 본문을 보낼 방법이 없다 (GradeRequestItem에 필드 자체가 없다).
    // 서버는 qid로 조회한 행의 제목·지문만으로 프롬프트에 넣을 질문을 만든다.
    const items = hydrateModelAnswers([request(0, 7)], [{
        id: 7,
        question_title: '감사증거의 충분성',
        question_description: '아래 상황에서 감사인이 수행할 절차를 서술하시오.',
        model_answer: 'M',
        rubric: validRubric('F', 'F-variant'),
    }]);

    assert.equal(items[0].q, '감사증거의 충분성 - 아래 상황에서 감사인이 수행할 절차를 서술하시오.');
    assert.equal(items[0].a, 'answer');
});

test('question text tolerates a missing title or description', () => {
    const rubric = validRubric('G', 'G-variant');

    const onlyTitle = hydrateModelAnswers([request(0, 1)], [
        { id: 1, question_title: '제목만', question_description: null, model_answer: 'M', rubric }
    ]);
    assert.equal(onlyTitle[0].q, '제목만');

    const onlyDesc = hydrateModelAnswers([request(0, 2)], [
        { id: 2, question_description: '지문만', model_answer: 'M', rubric }
    ]);
    assert.equal(onlyDesc[0].q, '지문만');

    const neither = hydrateModelAnswers([request(0, 3)], [
        { id: 3, model_answer: 'M', rubric }
    ]);
    assert.equal(neither[0].q, '');
});

test('falls back to invalid flag when no question matches', () => {
    const items = hydrateModelAnswers([request(0, 45), request(1, 12)], [{
        id: 999,
        model_answer: 'nope',
        rubric: validRubric('D', 'D-variant'),
    }]);

    assert.equal(items[0].invalid, true);
    assert.equal(items[1].invalid, true);
    assert.equal(items[0].errorMsg, '해당 문항의 v2 루브릭 데이터를 찾을 수 없습니다.');
    // 프롬프트에 들어갈 값은 전부 서버가 빈 값으로 확정한다.
    assert.equal(items[0].m, '');
    assert.equal(items[0].q, '');
    assert.deepEqual(items[0].k, []);
});

test('falls back to invalid flag when validation fails', () => {
    const items = hydrateModelAnswers([request(0, 45)], [{
        id: 45,
        question_title: '제목',
        question_description: '지문',
        model_answer: 'nope',
        rubric: [
            { sub: 1, label: '물음 1', points: 8 /* total points != sum items(10) */, mode: 'all', items: [{ id: '1-1', item: 'E', points: 10, variants: ['E-variant'] }] }
        ]
    }]);

    assert.equal(items[0].invalid, true);
    assert.equal(items[0].errorMsg?.includes('루브릭 검증 실패'), true);
    assert.equal(items[0].m, '');
    assert.equal(items[0].q, '');
    assert.deepEqual(items[0].k, []);
});

test('stringifyModelAnswer normalizes arrays, scalars, and nullish values', () => {
    assert.equal(stringifyModelAnswer(['a', 'b']), 'a\nb');
    assert.equal(stringifyModelAnswer('x'), 'x');
    assert.equal(stringifyModelAnswer(null), '');
    assert.equal(stringifyModelAnswer(undefined), '');
});
