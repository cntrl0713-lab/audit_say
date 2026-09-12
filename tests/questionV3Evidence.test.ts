import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerEvidence, resolveAnswerEvidence } from '../lib/questionV3Evidence.ts';

test('evidence offsets preserve Korean particles, CRLF, emoji and inter-sentence whitespace', () => {
    const answer = '통제가 효과적이다.\r\n😀 설계와 실행을 본다.  유지도 확인한다.';
    const evidence = answerEvidence('q1', answer);
    assert.ok(evidence.length > 2);
    for (const part of evidence) {
        assert.equal(answer.slice(part.start, part.end), part.text);
        assert.equal(resolveAnswerEvidence('q1', answer, [part.id]), part.text);
    }
    const parts = evidence.slice(1);
    assert.equal(resolveAnswerEvidence('q1', answer, parts.map(p => p.id)), answer);
    for (const ids of [[], ['q2/e0'], ['q1/e0', 'q1/e0'], ['q1/e999']]) {
        assert.throws(() => resolveAnswerEvidence('q1', answer, ids));
    }
    assert.deepEqual(answerEvidence('q1', ' \n'), []);
});
