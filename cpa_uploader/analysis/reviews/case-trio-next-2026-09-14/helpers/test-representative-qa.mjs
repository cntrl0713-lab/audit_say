import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQaBank, validateQuestionQa} from './representative-qa.mjs';

const criterion = id => ({id, max_points: 1, scores: {met: 1, partial: 0, not_met: 0, contradicted: 0}});
const one = {id: 'one', criteria: [criterion('one.c1')]};
const multi = {id: 'multi', criteria: [criterion('multi.c1'), criterion('multi.c2'), criterion('multi.c3')]};
const row = (question, kind, ids = []) => ({set_id: 'fixture', subquestion_id: question.id, kind,
  answer: kind === 'wrong' ? '부적절한 조치의 경계답안' : '독립 요소 하나만 충족한 답안', reason: 'Fixture expectation from independent criteria.',
  met_criterion_ids: ids, expected_points: ids.length});

test('one-point action retains 1/0 without an invented partial representative', () => {
  const scope = validateQaBank([{id: 'fixture', subquestions: [one, multi]}],
    [row(one, 'wrong'), row(multi, 'partial', ['multi.c1']), row(multi, 'wrong')]);
  assert.equal(scope.planned_evaluated_answers, 5);
  assert.equal(scope.partial_answers, 1);
  assert.equal(scope.one_point_questions, 1);
  assert.deepEqual(scope.questions[0].representative_kinds, ['model', 'wrong']);
  assert.equal(scope.questions[0].partial_representative_status, 'not_applicable_no_integer_score_between_zero_and_one');
});

test('fabricated zero/full/fractional partial answers for one-point questions are rejected', () => {
  for (const expected of [0, 0.5, 1]) {
    const artificial = {...row(one, 'partial'), expected_points: expected};
    assert.throws(() => validateQuestionQa('fixture', one, [row(one, 'wrong'), artificial]));
  }
});

test('missing, duplicate, unknown and score-inconsistent QA remain contract errors', () => {
  assert.throws(() => validateQuestionQa('fixture', multi, [row(multi, 'wrong')]));
  assert.throws(() => validateQuestionQa('fixture', one, [row(one, 'wrong'), row(one, 'wrong')]));
  assert.throws(() => validateQuestionQa('fixture', one, [{...row(one, 'wrong'), expected_points: 1}]));
  assert.throws(() => validateQuestionQa('fixture', multi, [row(multi, 'partial', ['unknown']), row(multi, 'wrong')]));
  assert.throws(() => validateQaBank([{id: 'fixture', subquestions: [one]}], [row(one, 'wrong'), row(multi, 'wrong')]));
});
