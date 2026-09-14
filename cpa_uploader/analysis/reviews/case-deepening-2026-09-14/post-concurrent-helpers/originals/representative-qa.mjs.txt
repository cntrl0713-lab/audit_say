import assert from 'node:assert/strict';
import {computeSubquestionMaxPoints} from '../../../../../lib/questionV3.ts';

export function validateQuestionQa(setId, question, allRows) {
  const maximum = computeSubquestionMaxPoints(question);
  assert(Number.isSafeInteger(maximum) && maximum >= 1, 'Positive integer maximum required');
  const kinds = maximum > 1 ? ['partial', 'wrong'] : ['wrong'];
  const rows = allRows.filter(row => row.set_id === setId && row.subquestion_id === question.id);
  assert.deepEqual(rows.map(row => row.kind).sort(), kinds, 'Exactly the applicable representative roles are required');
  for (const row of rows) {
    assert(typeof row.answer === 'string' && row.answer.trim() && row.answer.length <= 5000);
    assert(typeof row.reason === 'string' && row.reason.trim());
    const ids = row.met_criterion_ids;
    assert(Array.isArray(ids) && new Set(ids).size === ids.length);
    assert(ids.every(id => question.criteria.some(criterion => criterion.id === id)));
    const points = question.criteria.reduce((sum, criterion) => sum + criterion.scores[ids.includes(criterion.id) ? 'met' : 'not_met'], 0);
    assert(Number.isSafeInteger(points));
    assert.equal(row.expected_points, points, 'Expected score must derive from the criteria');
    assert(row.kind === 'wrong' ? points === 0 : points > 0 && points < maximum, 'Representative role score range');
  }
  return {set_id: setId, subquestion_id: question.id, maximum_points: maximum,
    representative_kinds: ['model', ...kinds], partial_representative_required: maximum > 1,
    partial_representative_status: maximum > 1 ? 'required' : 'not_applicable_no_integer_score_between_zero_and_one',
    reason: maximum > 1
      ? '저장 모범답안과 독립 의미 단위를 일부 충족하는 대표 부분정답 및 대표 오답을 실측한다.'
      : '배점은 독립된 단일 조치 1점을 유지한다. 0점과 1점 사이의 정수 부분점수가 없으므로 부분정답을 만들지 않고 저장 모범답안과 정오 경계의 대표 오답(기대 0점)을 실측한다.'};
}

export function validateQaBank(sets, rows) {
  assert(Array.isArray(rows));
  const questions = sets.flatMap(set => set.subquestions.map(question => validateQuestionQa(set.id, question, rows)));
  const known = new Set(questions.map(question => question.set_id + '/' + question.subquestion_id));
  assert(rows.every(row => known.has(row.set_id + '/' + row.subquestion_id)), 'Unknown representative question');
  assert.equal(rows.length, questions.reduce((sum, question) => sum + question.representative_kinds.length - 1, 0));
  return {version: 1, method: 'criterion_derived_representative_role_scope', human_review_performed: false,
    questions, question_count: questions.length, supplied_qa_answers: rows.length,
    model_answers: questions.length, partial_answers: questions.filter(question => question.partial_representative_required).length,
    wrong_answers: questions.length, one_point_questions: questions.filter(question => question.maximum_points === 1).length,
    planned_evaluated_answers: rows.length + questions.length, actual_model_calls: 0};
}
