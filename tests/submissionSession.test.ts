import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canResumeSubmissionVersion, parseSubmissionSession, sameSubmissionAnswers, submissionSessionKey } from '../app/quiz/submissionSession.ts';

const now = Date.UTC(2026, 8, 8);
const saved = {
    release_id: 'release-1', set_version_id: 'version-1', submission_token: 'signed-token',
    answers: { 'q1.answer': '답안' }, saved_at: now, attempt_id: 'attempt-1', completed: true,
};

test('submission recovery is isolated by user and question set, including delimiters', () => {
    assert.notEqual(submissionSessionKey('member-a', 'set-1'), submissionSessionKey('member-b', 'set-1'));
    assert.notEqual(submissionSessionKey('a:b', 'c'), submissionSessionKey('a', 'b:c'));
});

test('retry only matches the exact answers, independent of entry order', () => {
    assert.equal(sameSubmissionAnswers({ first: 'a', second: 'b' }, { second: 'b', first: 'a' }), true);
    assert.equal(sameSubmissionAnswers({ first: 'a' }, { first: 'a ' }), false);
    assert.equal(sameSubmissionAnswers({ first: '' }, {}), false);
});

test('publishing a new bank release preserves the retry token for an unchanged question version', () => {
    const restored = parseSubmissionSession(JSON.stringify(saved), now)!;
    assert.equal(canResumeSubmissionVersion(restored, { release_id: 'release-2', set_version_id: saved.set_version_id }), true);
    assert.equal(restored.release_id, saved.release_id);
    assert.equal(restored.submission_token, saved.submission_token);
});

test('a revised question cannot reuse old answers and the old submission remains available for history', () => {
    const raw = JSON.stringify(saved);
    const restored = parseSubmissionSession(raw, now)!;
    assert.equal(canResumeSubmissionVersion(restored, { release_id: 'release-2', set_version_id: 'version-2' }), false);
    assert.equal(canResumeSubmissionVersion(restored, {}), false);
    assert.deepEqual(restored, saved);
    assert.equal(JSON.stringify(restored), raw);
});

test('recovery retains completed attempt reference but expires at seven days', () => {
    assert.deepEqual(parseSubmissionSession(JSON.stringify(saved), now), saved);
    assert.ok(parseSubmissionSession(JSON.stringify(saved), now + 7 * 86400000 - 1));
    assert.equal(parseSubmissionSession(JSON.stringify(saved), now + 7 * 86400000), null);
    assert.equal(parseSubmissionSession(JSON.stringify(saved), now - 1), null);
});

test('damaged or unrelated browser storage cannot become a retry token', () => {
    for (const value of [null, '{', 'null', '{}', JSON.stringify({ ...saved, submission_token: '' }),
        JSON.stringify({ ...saved, answers: ['a'] }), JSON.stringify({ ...saved, answers: { answer: 1 } }),
        JSON.stringify({ ...saved, answers: { answer: 'x'.repeat(5001) } }),
        JSON.stringify({ ...saved, completed: 'yes' })]) {
        assert.equal(parseSubmissionSession(value, now), null);
    }
});
