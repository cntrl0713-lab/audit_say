import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    assertBoundAnswers, contentHash, issueSubmissionToken, normalizeSubmissionAnswers,
    SUBMISSION_TTL_MS, verifySubmissionToken,
} from '../lib/learningSubmission.ts';
import { gradeLearningSubmission } from '../lib/learningService.ts';
import type { LearningServiceDependencies } from '../lib/learningService.ts';
import type { StoredAttemptResult } from '../lib/learningRepository.ts';
import { applyQuestionSetJudgment } from '../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import { publicGradeResult, publicLearningSet, publicLeaderboard, safeInteger } from '../lib/learningPublic.ts';
import { memberId, otherMemberId, sampleQuestionSet } from './helpers/cpaLearningDatabase.ts';

const key = 'test-only-submission-signing-key-32-characters';
const version = '00000000-0000-4000-8000-000000000010';
const release = '00000000-0000-4000-8000-000000000011';
const attemptId = '00000000-0000-4000-8000-000000000012';
const now = Date.parse('2026-09-08T02:00:00Z');
const set = sampleQuestionSet();
const answers = { sub1: ' 독립성 유지\n', sub2: '' };
const judgment = { subquestions: [
    { subquestion_id: 'sub1', verdicts: [{ criterion_id: 'crit1', verdict: 'met' as const, quote: '독립성 유지' }] },
    { subquestion_id: 'sub2', verdicts: [{ criterion_id: 'crit1', verdict: 'not_met' as const }] },
] };

function token(actor: 'member' | 'guest' = 'member', at = now, input = answers) {
    return issueSubmissionToken({ owner_user_id: memberId, actor_kind: actor, release_id: release, set_version_id: version, questionSet: set, answers: input }, key, at);
}

test('submission token binds owner, version, exact answer and original guest expiry; new submission is distinct', () => {
    const first = token('guest');
    const claims = verifySubmissionToken(first, memberId, [key], now);
    assert.equal(claims.expires_at, new Date(now + SUBMISSION_TTL_MS).toISOString());
    assert.equal(claims.actor_kind, 'guest');
    assert.deepEqual(assertBoundAnswers(claims, set, answers), answers);
    assert.throws(() => assertBoundAnswers(claims, set, { ...answers, sub1: answers.sub1.trim() }), /변경/);
    assert.throws(() => verifySubmissionToken(first, otherMemberId, [key], now));
    assert.throws(() => verifySubmissionToken(`${first.split('.')[0]}x.${first.split('.')[1]}`, memberId, [key], now));
    assert.throws(() => verifySubmissionToken(first, memberId, ['wrong-key-but-at-least-32-characters'], now));
    assert.notEqual(claims.submission_key, verifySubmissionToken(token('guest'), memberId, [key], now).submission_key);
    assert.equal(contentHash({ b: 1, a: 2 }), contentHash({ a: 2, b: 1 }));
    assert.deepEqual(normalizeSubmissionAnswers(set, { sub1: answers.sub1 }), answers);
    assert.throws(() => normalizeSubmissionAnswers(set, { sub1: '😀'.repeat(2501) }));
    assert.throws(() => normalizeSubmissionAnswers(set, { other: 'not a subquestion' }));
});

function service() {
    const counts = { begin: 0, grade: 0, quota: 0, complete: 0, fail: 0 };
    let stored: StoredAttemptResult | null = null;
    let exists = false;
    let leased = false;
    const result = applyQuestionSetJudgment(set, answers, judgment);
    const deps: LearningServiceDependencies = {
        signingKeys: [key], apiKey: 'test-key', now: () => now,
        loadSet: async () => set,
        findAttempt: async () => exists ? attemptId : null,
        begin: async () => { counts.begin++; exists = true; return { attempt_id: attemptId }; },
        readResult: async () => stored,
        claim: async () => { if (stored) return { state: 'completed' }; if (leased) return { state: 'busy' }; leased = true; return { state: 'claimed', run_id: version, lease_token: release }; },
        grade: async (_set, _answers, _key, callback) => { counts.grade++; callback?.(judgment); return result; },
        consumeQuota: async () => { counts.quota++; return true; },
        complete: async (_owner, _attempt, _run, _lease, value, raw) => {
            assert.deepEqual(raw, judgment);
            counts.complete++;
            stored = { attempt_id: attemptId, status: 'completed', submitted_at: new Date(now).toISOString(), completed_at: new Date(now).toISOString(), expires_at: null, result: value };
            return stored;
        },
        fail: async () => { counts.fail++; leased = false; },
    };
    return { deps, counts, getStored: () => stored };
}

test('persisted result retry does not call model or consume quota again', async () => {
    const { deps, counts } = service();
    const issued = token();
    assert.equal((await gradeLearningSubmission(memberId, set.id, issued, answers, deps)).ok, true);
    assert.equal((await gradeLearningSubmission(memberId, set.id, issued, answers, { ...deps, apiKey: '' })).ok, true);
    assert.deepEqual(counts, { begin: 1, grade: 1, quota: 1, complete: 1, fail: 0 });
});

test('deleted expired guest request cannot be recreated after membership conversion', async () => {
    const { deps, counts } = service();
    deps.now = () => now + SUBMISSION_TTL_MS;
    const response = await gradeLearningSubmission(memberId, set.id, token('guest'), answers, deps);
    assert.equal(response.ok, false);
    if (!response.ok) assert.equal(response.code, 'submission_expired');
    assert.deepEqual(counts, { begin: 0, grade: 0, quota: 0, complete: 0, fail: 0 });
});

test('changed answers never begin or grade the original submission', async () => {
    const { deps, counts } = service();
    const response = await gradeLearningSubmission(memberId, set.id, token(), { ...answers, sub2: 'changed' }, deps);
    assert.equal(response.ok, false);
    assert.equal(counts.begin + counts.grade + counts.complete, 0);
});

test('lost finalize response reads committed result without another award or failure marking', async () => {
    const { deps, counts } = service();
    const finalize = deps.complete;
    deps.complete = async (...args) => { await finalize(...args); throw new Error('response lost'); };
    const response = await gradeLearningSubmission(memberId, set.id, token(), answers, deps);
    assert.equal(response.ok, true);
    assert.equal(counts.complete, 1);
    assert.equal(counts.fail, 0);
});

test('model failure does not finalize and blank submissions do not need quota or key', async () => {
    const failed = service();
    failed.deps.grade = async () => { throw new Error('unavailable'); };
    assert.equal((await gradeLearningSubmission(memberId, set.id, token(), answers, failed.deps)).ok, false);
    assert.equal(failed.counts.complete, 0);
    assert.equal(failed.counts.fail, 1);
    const blank = service();
    blank.deps.apiKey = '';
    const blankAnswers = { sub1: '', sub2: '' };
    assert.equal((await gradeLearningSubmission(memberId, set.id, token('member', now, blankAnswers), blankAnswers, blank.deps)).ok, true);
    assert.equal(blank.counts.quota, 0);
});

test('public database projections discard private fields and reject unsafe numeric coercion', () => {
    const publicSet = compilePublicQuestionSet(set);
    const poisoned = {
        release_id: release, set_version_id: version, private: 'secret',
        question_set: { ...publicSet, model_answer: ['SECRET'], requirements: ['SECRET'], source_quote: 'SECRET',
            sources: publicSet.sources.map((source) => ({ ...source, file: 'SECRET', source_quote: 'SECRET' })),
            subquestions: publicSet.subquestions.map((sub) => ({ ...sub, logical_subquestion_id: version, decision: { options: ['a', 'b'], correct: 'SECRET' }, criteria: ['SECRET'] })),
        },
    };
    assert.doesNotMatch(JSON.stringify(publicLearningSet(poisoned)), /SECRET|source_quote|model_answer|requirements|criteria|correct/);
    const result = applyQuestionSetJudgment(set, answers, judgment);
    const safe = publicGradeResult({ ...result, raw_judgment: 'SECRET', source_quote: 'SECRET' });
    assert.doesNotMatch(JSON.stringify(safe), /SECRET|raw_judgment|source_quote/);
    const board = publicLeaderboard([{ id: memberId, email: 'SECRET', rank: '1', username: 'user', role: 'MEMBER', level: '2', exp: '100' }]);
    assert.deepEqual(board, [{ rank: 1, username: 'user', role: 'MEMBER', level: 2, exp: 100 }]);
    assert.throws(() => safeInteger('9007199254740993'));
    assert.throws(() => safeInteger(null));
});
