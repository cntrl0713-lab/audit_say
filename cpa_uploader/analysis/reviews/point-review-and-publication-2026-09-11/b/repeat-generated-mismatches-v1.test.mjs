import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, selectMismatchCases, verifyEventScope, safeError } from './repeat-generated-mismatches-v1.mjs';
import { jsonHash } from '../../../../../cpa_uploader/questionReviewIdentity.ts';

const set = { subquestions: [{ id: 'sub1', criteria: [{ id: 'c1' }, { id: 'c2' }] }, { id: 'sub2', criteria: [{ id: 'c3' }] }] };
const cases = [
    { unit_id: 'criterion:sub1:c1', kind: 'paraphrase', answer: '원답 그대로', expected: 'met' },
    { unit_id: 'criterion:sub1:c2', kind: 'condition_boundary', answer: '원답 그대로', expected: 'not_met' },
    { unit_id: 'criterion:sub2:c3', kind: 'full', answer: '타 물음 답안', expected: 'met' },
];
const expected = cases.slice(0, 2).map(c => ({ unit_id: c.unit_id, case_kind: c.kind, subquestion_id: 'sub1', criterion_id: c.unit_id.split(':')[2], verdict: c.expected }));
const answers = { sub1: '원답 그대로', sub2: '' };
const original = { id: jsonHash(answers), answers, expected, matched: false };
const otherAnswers = { sub1: '', sub2: '타 물음 답안' };
const other = { id: jsonHash(otherAnswers), answers: otherAnswers, expected: [{ unit_id: 'criterion:sub2:c3', case_kind: 'full', subquestion_id: 'sub2', criterion_id: 'c3', verdict: 'met' }], matched: true };
test('only original mismatch answers and every same-answer assertion are selected', () => {
    const result = selectMismatchCases(set, cases, [original, other]);
    assert.deepEqual(result.cases, cases.slice(0, 2)); assert.equal(result.plans.length, 1);
    assert.deepEqual(result.plans[0].answers, answers); assert.deepEqual(result.plans[0].expected, expected);
});
test('selection preserves originals and returns independent copies', () => {
    const before = JSON.stringify({ set, cases, original }); const result = selectMismatchCases(set, cases, [original, other]);
    result.cases[0].answer = '후속 변경'; result.plans[0].answers.sub1 = '다른 변경';
    assert.equal(JSON.stringify({ set, cases, original }), before);
});
test('altered answer with the old run id is rejected', () => {
    assert.throws(() => selectMismatchCases(set, cases, [{ ...original, answers: { ...answers, sub1: '변경 답' } }]));
});
test('altered or omitted expected targets are rejected', () => {
    assert.throws(() => selectMismatchCases(set, cases, [{ ...original, expected: expected.slice(0, 1) }]));
    assert.throws(() => selectMismatchCases(set, cases, [{ ...original, expected: [{ ...expected[0], verdict: 'not_met' }, expected[1]] }]));
});
test('duplicate original ids and unknown targets are rejected', () => {
    assert.throws(() => selectMismatchCases(set, cases, [original, original]));
    assert.throws(() => selectMismatchCases(set, [...cases, { ...cases[0], unit_id: 'criterion:sub9:c99' }], [original]));
});
test('all-pass and empty-branch mismatches are not repeatable model jobs', () => {
    assert.throws(() => selectMismatchCases(set, cases, [{ ...original, matched: true }]));
    assert.throws(() => selectMismatchCases(set, cases, [{ ...original, id: 'empty-answer' }]));
});
test('actual followup events must keep selected answers and expectations', () => {
    const { plans } = selectMismatchCases(set, cases, [original, other]);
    verifyEventScope(original, plans);
    assert.throws(() => verifyEventScope(other, plans));
    assert.throws(() => verifyEventScope({ ...original, answers: otherAnswers }, plans));
    assert.throws(() => verifyEventScope({ ...original, expected: [] }, plans));
});
test('empty event is explicitly permitted only with entirely blank answers', () => {
    verifyEventScope({ id: 'empty-answer', answers: { sub1: '', sub2: '' } }, []);
    assert.throws(() => verifyEventScope({ id: 'empty-answer', answers }, []));
});
test('strict CLI supports each worker and rejects extras or duplicate arguments', () => {
    const argv = ['--manifest', 'm', '--worker', 'c', '--set-id', 's', '--grading-directory', 'g', '--output', 'o'];
    assert.equal(parseArgs([...argv, '--dry-run'])['--worker'], 'c');
    assert.throws(() => parseArgs([...argv, '--execute']));
    assert.throws(() => parseArgs([...argv, '--worker', 'a']));
    assert.throws(() => parseArgs([...argv, '--dry-run', '--dry-run']));
});
test('safe errors retain nested quota metadata and omit secret messages', () => {
    const result = safeError({ name: 'Error', message: 'secret-value', code: 'transport', cause: { code: 'credit_balance_exhausted', status: 429, message: 'another-secret' } });
    assert.equal(result.cause.code, 'credit_balance_exhausted'); assert(!JSON.stringify(result).includes('secret'));
});
