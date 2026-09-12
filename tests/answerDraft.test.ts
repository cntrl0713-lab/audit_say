import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_DRAFT_TTL, answerDraftKey, createAnswerDraft, parseAnswerDraft } from '../app/quiz/answerDraft.ts';
import type { PublicLearningQuestionSetV3 } from '../lib/learningTypes.ts';

const questionSet = { id: 'demo--case', learning_unit_id: 'unit-1', set_version_id: 'version-1', classification_version_ids: ['class-1'], question_style: 'case',
  shared_context: { facts: [{ id: 'fact-1', text: '자료', scoreable: false }] }, subquestions: [{ id: 'sub1', prompt: '발문', max_points: 2 }] } as PublicLearningQuestionSetV3;
const time = 10_000_000;
const raw = JSON.stringify(createAnswerDraft('user-1', questionSet, { sub1: '작성한 원답안\n다음 문장' }, time));

test('작성 답안을 그대로 복원하고 다른 소유자의 답안은 복원하지 않는다', () => {
  assert.deepEqual(parseAnswerDraft(raw, 'user-1', questionSet, time)?.answers, { sub1: '작성한 원답안\n다음 문장' });
  assert.equal(parseAnswerDraft(raw, 'user-2', questionSet, time), null);
  assert.notEqual(answerDraftKey('user:1', 'unit'), answerDraftKey('user', '1:unit'));
});

test('문항·분류 판본 또는 발문·사실이 바뀌면 초안을 자동 적용하지 않는다', () => {
  for (const change of [
    { set_version_id: 'version-2' }, { classification_version_ids: ['class-2'] },
    { learning_unit_id: 'unit-2' }, { shared_context: { facts: [] } },
    { subquestions: [{ ...questionSet.subquestions[0], prompt: '개정 발문' }] },
  ]) assert.equal(parseAnswerDraft(raw, 'user-1', { ...questionSet, ...change }, time), null);
  assert.ok(parseAnswerDraft(raw, 'user-1', { ...questionSet, release_id: 'new-release' }, time));
});

test('만료·미래 시각·잘못된 JSON·다른 물음·과도한 답안을 거절한다', () => {
  assert.equal(parseAnswerDraft(raw, 'user-1', questionSet, time + ANSWER_DRAFT_TTL), null);
  assert.equal(parseAnswerDraft(raw, 'user-1', questionSet, time - 1), null);
  assert.equal(parseAnswerDraft('{', 'user-1', questionSet, time), null);
  for (const answers of [{ sub1: 'a', sub2: 'b' }, { sub2: 'b' }, { sub1: 'a'.repeat(5001) }, { sub1: 7 }, ['a']]) {
    const malformed = JSON.stringify({ ...JSON.parse(raw), answers });
    assert.equal(parseAnswerDraft(malformed, 'user-1', questionSet, time), null);
  }
});

test('빈 답안과 제한 길이의 답안도 손실 없이 보존한다', () => {
  for (const answer of ['', '가'.repeat(5000)]) {
    const draft = createAnswerDraft('user-1', questionSet, { sub1: answer }, time);
    assert.equal(parseAnswerDraft(JSON.stringify(draft), 'user-1', questionSet, time)?.answers.sub1, answer);
  }
});
