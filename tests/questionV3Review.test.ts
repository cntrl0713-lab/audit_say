import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyQuestionSetJudgment, gradeQuestionSetV3 } from '../lib/questionV3Grading.ts';
import { computeQuestionSetMaxPoints } from '../lib/questionV3.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

const bank = JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json', 'utf8')) as QuestionSetV3[];

test('shared quotes preserve independent criteria across the bank and existing score caps', () => {
    // Mock verdicts test code behavior only; this is not semantic validation of unreviewed topics.
    for (const set of bank) {
        const answers = Object.fromEntries(set.subquestions.map(q => [q.id, q.model_answer.join('\n')]));
        const judgment = {
            salad_detected: true,
            subquestions: set.subquestions.map(q => ({
                subquestion_id: q.id,
                salad_detected: true,
                verdicts: q.criteria.map(c => ({ criterion_id: c.id, verdict: 'met' as const, quote: answers[q.id] })),
            })),
        };
        const result = applyQuestionSetJudgment(set, answers, judgment);
        assert.equal(result.score, computeQuestionSetMaxPoints(set), set.id);
        assert.equal(result.subquestions.reduce((n, q) => n + q.score, 0), result.score);
        for (const q of result.subquestions) assert.ok(q.criteria.every(c => c.verdict === 'met'));
    }
});

test('empty topic 04 answers skip the model without credentials', async () => {
    for (const set of bank.filter(s => s.classification.topic_id === '04')) {
        const result = await gradeQuestionSetV3(set, Object.fromEntries(set.subquestions.map(q => [q.id, ' \n\t'])), '');
        assert.equal(result.score, 0);
        assert.ok(result.subquestions.every(q => q.criteria.every(c => c.verdict === 'not_met' && !c.quote)));
    }
});
