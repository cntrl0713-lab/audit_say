import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gradeQuestionSetV3 } from '../lib/questionV3Grading.ts';
import { isQuestionSetAnswerPayloadV3 } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { QUESTION_V3_ANSWER_MAX_LENGTH } from '../lib/questionV3Answer.ts';

test('payload and grader share the input limit; blank answers never need a model key or network', async () => {
    const set = (JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'utf8')) as QuestionSetV3[])
        .find(s => s.id === 'pilot-05-001')!;
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Blank answers must not call a model'); };
    try {
        const valid = { sub1: ' '.repeat(QUESTION_V3_ANSWER_MAX_LENGTH), sub2: '' };
        assert.equal(isQuestionSetAnswerPayloadV3(valid), true);
        const result = await gradeQuestionSetV3(set, valid, '');
        assert.equal(result.score, 0);
        assert.equal(result.subquestions.length, 2);
        const tooLong = { sub1: ' '.repeat(QUESTION_V3_ANSWER_MAX_LENGTH + 1) };
        assert.equal(isQuestionSetAnswerPayloadV3(tooLong), false);
        await assert.rejects(gradeQuestionSetV3(set, tooLong, ''), /5,000자/);
        await assert.rejects(gradeQuestionSetV3(set, { other: '' }, ''), /알 수 없는/);
        assert.equal(calls, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
