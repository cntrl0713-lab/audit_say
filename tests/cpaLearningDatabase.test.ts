import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { applyQuestionSetJudgment } from '../lib/questionV3Grading.ts';
import type { QuestionSetGradeResultV3, QuestionSetJudgmentV3 } from '../lib/questionV3Grading.ts';
import {
    createLearningDatabase, importQuestionBank, sampleQuestionSet, memberId, otherMemberId, guestId,
} from './helpers/cpaLearningDatabase.ts';
import type { ImportedQuestionBank } from './helpers/cpaLearningDatabase.ts';
import { gradeLearningSubmission } from '../lib/learningService.ts';
import type { LearningServiceDependencies } from '../lib/learningService.ts';
import { issueSubmissionToken, SUBMISSION_TTL_MS } from '../lib/learningSubmission.ts';
import type { StoredAttemptResult } from '../lib/learningRepository.ts';
import type { QuestionSetV3 } from '../lib/questionV3.ts';

interface Attempt { attempt_id: string; status: string; current_grading_run_id: string | null }
interface Claim { state: 'claimed' | 'completed' | 'busy'; run_id?: string; lease_token?: string }
interface Saved { attempt_id: string; status: string; result: QuestionSetGradeResultV3 | null }
interface Note { id: string; subquestion_id: string; prompt: string; status: string; memo: string; last_attempt_id: string | null; last_failed_attempt_id: string | null }
interface Ranking { rank: number; username: string; exp: number; level: number }
const answers = { sub1: '독립성을 유지한다.', sub2: '전문가적 의구심을 유지한다.' };
const metadata = { engine_version: 'v3-test', grading_contract_hash: 'contract-test', provider: 'test', model: 'test-model' };

async function scalar<T>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
    return (await db.query<{ value: T }>(`select ${sql} as value`, params)).rows[0].value;
}
async function clock(db: PGlite) { return scalar<string>(db, 'clock_timestamp()::text'); }
async function payload(db: PGlite, bank: ImportedQuestionBank, options: {
    owner?: string; actor?: 'member' | 'guest'; answers?: Record<string, string>; submitted?: string;
} = {}) {
    const submitted = options.submitted ?? await clock(db);
    const raw = options.answers ?? answers;
    return {
        owner_user_id: options.owner ?? memberId, actor_kind: options.actor ?? 'member',
        release_id: bank.release_id, set_id: bank.question_versions[0].set_id,
        set_version_id: bank.question_versions[0].set_version_id, submission_key: randomUUID(),
        answers_hash: createHash('sha256').update(JSON.stringify(raw)).digest('hex'), submitted_at: submitted,
        expires_at: options.actor === 'guest'
            ? await scalar<string>(db, "($1::timestamptz+interval '168 hours')::text", [submitted]) : null,
        answers: raw,
    };
}
async function begin(db: PGlite, input: Awaited<ReturnType<typeof payload>>) {
    return scalar<Attempt>(db, 'public.cpa_begin_attempt($1::jsonb)', [JSON.stringify(input)]);
}
async function claim(db: PGlite, attempt: Attempt, owner = memberId) {
    return scalar<Claim>(db, 'public.cpa_claim_grading_run($1,$2,$3::jsonb)', [attempt.attempt_id, owner, JSON.stringify(metadata)]);
}
function grade(raw = answers, met = true, judgment?: QuestionSetJudgmentV3) {
    return applyQuestionSetJudgment(sampleQuestionSet(), raw, judgment ?? {
        subquestions: ['sub1', 'sub2'].map((id) => ({ subquestion_id: id,
            verdicts: [{ criterion_id: 'crit1', verdict: met ? 'met' : 'not_met', ...(met ? { quote: raw[id as keyof typeof raw] } : {}) }],
        })),
    });
}
async function complete(db: PGlite, attempt: Attempt, run: Claim, result: QuestionSetGradeResultV3 & { raw_judgment?: QuestionSetJudgmentV3 }, owner = memberId) {
    return scalar<Saved>(db, 'public.cpa_complete_grading_run($1,$2,$3,$4,$5::jsonb)',
        [attempt.attempt_id, owner, run.run_id, run.lease_token, JSON.stringify(result)]);
}
async function finish(db: PGlite, bank: ImportedQuestionBank, met = true, owner = memberId) {
    const input = await payload(db, bank, { owner });
    const attempt = await begin(db, input);
    const run = await claim(db, attempt, owner);
    const result = await complete(db, attempt, run, grade(answers, met), owner);
    return { input, attempt, run, result };
}
async function setup() {
    const db = await createLearningDatabase({ learningRpc: true });
    const bank = await importQuestionBank(db);
    await scalar(db, 'public.cpa_initialize_learning_progress()');
    return { db, bank };
}

test('learning cutover preserves balances, blocks old direct EXP writes and finalizes a submission once', async () => {
    const db = await createLearningDatabase({ learningRpc: true });
    try {
        const bank = await importQuestionBank(db);
        await db.exec(`set role service_role; update cpa_users set exp=18 where id='${memberId}'`);
        const input = await payload(db, bank);
        const attempt = await begin(db, input);
        assert.deepEqual(await begin(db, input), attempt);
        const run = await claim(db, attempt);
        assert.equal((await claim(db, attempt)).state, 'busy');
        await assert.rejects(complete(db, attempt, run, grade()), /requires initialization/);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_subquestion_grade_results)'), 0);
        assert.equal(await scalar(db, 'public.cpa_initialize_learning_progress()'), 2);
        assert.equal(await scalar(db, 'public.cpa_initialize_learning_progress()'), 0);
        await assert.rejects(db.exec(`update cpa_users set exp=999 where id='${memberId}'`), /XP ledger/);
        await assert.rejects(db.exec(`update user_cpa set exp=999 where id='${memberId}'`), /XP ledger/);
        const saved = await complete(db, attempt, run, grade());
        assert.deepEqual(saved.result, grade());
        assert.deepEqual(await complete(db, attempt, run, grade(answers, false)), saved);
        assert.equal((await claim(db, attempt)).state, 'completed');
        assert.equal(await scalar(db, `(select exp::int from cpa_users where id='${memberId}')`), 20);
        assert.equal(await scalar(db, "(select count(*)::int from cpa_xp_events where event_type='submission_award')"), 1);
        const changed = { ...input, answers: { ...answers, sub1: '변경 답안' } };
        await assert.rejects(begin(db, changed), /Submission key conflict/);
        await assert.rejects(begin(db, { ...input, submission_key: randomUUID(), answers: { unknown: '답안' } }), /subquestion code/);
        await assert.rejects(begin(db, { ...input, submission_key: randomUUID(), answers: { sub1: '😀'.repeat(2501) } }), /Invalid answer/);
        await assert.rejects(scalar(db, 'public.cpa_get_attempt_result($1,$2)', [attempt.attempt_id, otherMemberId]), /Attempt not found/);
        const next = await finish(db, bank);
        assert.notEqual(next.attempt.attempt_id, attempt.attempt_id);
        assert.equal(await scalar(db, `(select exp::int from cpa_users where id='${memberId}')`), 22);
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`reset role; set role ${role}`);
            await assert.rejects(scalar(db, 'public.cpa_get_attempt_result($1,$2)', [attempt.attempt_id, memberId]), /permission denied/);
            await assert.rejects(scalar(db, "public.cpa_get_leaderboard('all')"), /permission denied/);
            await assert.rejects(db.query('select * from cpa_attempt_answers'), /permission denied/);
        }
    } finally { await db.close(); }
});

test('database checks criterion coverage, exact points, raw answer quotes and scoped injection before atomic completion', async () => {
    const { db, bank } = await setup();
    try {
        const raw = { sub1: '독립성\u00a0유지', sub2: '전문가적 의구심을 유지한다.' };
        const input = await payload(db, bank, { answers: raw });
        const attempt = await begin(db, input);
        const run = await claim(db, attempt);
        const valid = grade(raw);
        valid.subquestions[0].criteria[0].quote = '독립성 유지';
        const variants = [
            (v: QuestionSetGradeResultV3) => { v.score = 99; },
            (v: QuestionSetGradeResultV3) => { v.subquestions[0].criteria[0].quote = '답안에 없는 근거'; },
            (v: QuestionSetGradeResultV3) => { v.subquestions[0].criteria[0].awarded_points = 0; },
            (v: QuestionSetGradeResultV3) => { v.subquestions[0].criteria[0].verdict = 'partial'; },
            (v: QuestionSetGradeResultV3) => { v.subquestions[0].criteria.push(v.subquestions[0].criteria[0]); },
            (v: QuestionSetGradeResultV3) => { v.subquestions[0].user_answer = '다른 답안'; },
        ];
        for (const mutate of variants) {
            const invalid = structuredClone(valid); mutate(invalid);
            await assert.rejects(complete(db, attempt, run, invalid));
            assert.equal(await scalar(db, '(select count(*)::int from cpa_criterion_grade_results)'), 0);
            assert.equal(await scalar(db, '(select count(*)::int from cpa_review_items)'), 0);
            assert.equal(await scalar(db, `(select exp::int from cpa_users where id='${memberId}')`), 17);
        }
        valid.subquestions[0].criteria[0].reason = 'PRIVATE SOURCE QUOTE FROM MODEL';
        const clean = await complete(db, attempt, run, valid);
        assert.equal(clean.result?.score, 2);
        assert.doesNotMatch(JSON.stringify(clean), /PRIVATE SOURCE QUOTE/);
        assert.equal(await scalar(db, `(select count(*)::int from cpa_criterion_grade_results where raw_reason='PRIVATE SOURCE QUOTE FROM MODEL')`), 1);
        const second = await begin(db, await payload(db, bank));
        const secondRun = await claim(db, second);
        const rawJudgment: QuestionSetJudgmentV3 = { injection_detected: false, salad_detected: false,
            subquestions: [
                { subquestion_id: 'sub1', injection_detected: true, verdicts: [{ criterion_id: 'crit1', verdict: 'met', quote: answers.sub1, reason: 'private trace' }] },
                { subquestion_id: 'sub2', verdicts: [{ criterion_id: 'crit1', verdict: 'met', quote: answers.sub2 }] },
            ] };
        await assert.rejects(complete(db, second, secondRun, { ...grade(), raw_judgment: rawJudgment }), /grading contract/);
        const saved = await complete(db, second, secondRun, { ...grade(answers, true, rawJudgment), raw_judgment: rawJudgment });
        assert.equal(saved.result?.score, 1);
        assert.doesNotMatch(JSON.stringify(saved), /private trace|raw_quote|raw_verdict|raw_judgment/);
        assert.equal(await scalar(db, `(select count(*)::int from cpa_subquestion_grade_results where grading_run_id='${secondRun.run_id}' and effective_security_flag='injection')`), 1);
        await assert.rejects(db.exec(`update cpa_criterion_grade_results set quote='변조' where grading_run_id='${secondRun.run_id}'`), /immutable/);
        await assert.rejects(db.exec(`update cpa_attempt_answers set answer_text='변조' where attempt_id='${second.attempt_id}'`), /immutable/);
    } finally { await db.close(); }
});

test('manual notebook resolution survives full scores and older completion, while a later failed submission reopens it', async () => {
    const { db, bank } = await setup();
    try {
        const delayed = await begin(db, await payload(db, bank));
        const delayedRun = await claim(db, delayed);
        const initialFailure = await finish(db, bank, false);
        const notes = await scalar<Note[]>(db, 'public.cpa_get_review_items($1,$2)', [memberId, 'open']);
        assert.equal(notes.length, 2);
        const note = notes[0];
        await scalar(db, 'public.cpa_update_review_item($1,$2,$3,$4)', [memberId, note.subquestion_id, 'resolved', '내가 작성한 메모']);
        const revised = sampleQuestionSet();
        for (const sub of revised.subquestions) sub.prompt += ' 새로운 버전';
        const revisedBank = await importQuestionBank(db, [revised]);
        await finish(db, revisedBank, true);
        await complete(db, delayed, delayedRun, grade(answers, false));
        const resolved = await scalar<Note[]>(db, 'public.cpa_get_review_items($1,$2)', [memberId, 'resolved']);
        assert.equal(resolved.length, 1);
        assert.equal(resolved[0].memo, '내가 작성한 메모');
        assert.notEqual(resolved[0].last_attempt_id, delayed.attempt_id);
        assert.equal(resolved[0].last_failed_attempt_id, initialFailure.attempt.attempt_id);
        assert.equal(resolved[0].prompt, note.prompt, 'the notebook still displays the failed-version prompt');
        const pending = await begin(db, await payload(db, bank));
        const pendingRun = await claim(db, pending);
        const beforeMemoSave = await scalar(db, '(select jsonb_build_array(suppress_before,state_changed_at) from cpa_review_items where id=$1)', [note.id]);
        await scalar(db, 'public.cpa_update_review_item($1,$2,$3,$4)', [memberId, note.subquestion_id, 'resolved', '수정한 개인 메모']);
        assert.deepEqual(await scalar(db, '(select jsonb_build_array(suppress_before,state_changed_at) from cpa_review_items where id=$1)', [note.id]), beforeMemoSave);
        await complete(db, pending, pendingRun, grade(answers, false));
        const failed = { attempt: pending, run: pendingRun };
        const reopened = (await scalar<Note[]>(db, 'public.cpa_get_review_items($1,$2)', [memberId, 'open'])).find((n) => n.id === note.id)!;
        assert.equal(reopened.memo, '수정한 개인 메모');
        assert.equal(reopened.last_attempt_id, failed.attempt.attempt_id);
        await scalar(db, 'public.cpa_update_review_item($1,$2,$3,$4)', [memberId, note.subquestion_id, 'removed', null]);
        await complete(db, failed.attempt, failed.run, grade(answers, false));
        assert.equal((await scalar<Note[]>(db, 'public.cpa_get_review_items($1,$2)', [memberId, 'removed'])).length, 1);
        const other = await finish(db, bank, false, otherMemberId);
        await assert.rejects(db.query('update cpa_review_items set last_result_run_id=$1 where id=$2', [other.run.run_id, note.id]), /owner or question mismatch/);
        const manual = await scalar<Note>(db, 'public.cpa_update_review_item($1,$2,$3,$4)', [otherMemberId, note.subquestion_id, 'open', '수동']);
        assert.equal(manual.memo, '수동');
    } finally { await db.close(); }
});

test('failed and expired leases retry the same submission, reject stale completion and create one award', async () => {
    const { db, bank } = await setup();
    try {
        const attempt = await begin(db, await payload(db, bank));
        const first = await claim(db, attempt);
        await scalar(db, 'public.cpa_fail_grading_run($1,$2,$3,$4,$5)', [attempt.attempt_id, memberId, first.run_id, first.lease_token, 'service_unavailable']);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_review_items)'), 0);
        const second = await claim(db, attempt);
        assert.notEqual(second.run_id, first.run_id);
        await assert.rejects(complete(db, attempt, first, grade()), /Stale grading lease/);
        await db.query("update cpa_grading_runs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1", [second.run_id]);
        const third = await claim(db, attempt);
        await assert.rejects(complete(db, attempt, second, grade()), /Stale grading lease/);
        await complete(db, attempt, third, grade());
        assert.equal(await scalar(db, "(select count(*)::int from cpa_xp_events where event_type='submission_award')"), 1);
        assert.equal(await scalar(db, "(select count(*)::int from cpa_grading_runs where status='failed')"), 2);
        const blankInput = await payload(db, bank, { answers: {} });
        const blankAttempt = await begin(db, blankInput);
        const blankRun = await claim(db, blankAttempt);
        const blank = grade({ sub1: '', sub2: '' }, false);
        await complete(db, blankAttempt, blankRun, blank);
        assert.equal(await scalar(db, "(select count(*)::int from cpa_xp_events where event_type='submission_award' and amount=0)"), 1);
    } finally { await db.close(); }
});

test('guest results expire with all descendants, keep guest rewards after conversion, and account deletion removes member data', async () => {
    const { db, bank } = await setup();
    try {
        const input = await payload(db, bank, { owner: guestId, actor: 'guest' });
        const attempt = await begin(db, input);
        const run = await claim(db, attempt, guestId);
        await db.query('update auth.users set is_anonymous=false where id=$1', [guestId]);
        assert.equal((await begin(db, input)).attempt_id, attempt.attempt_id);
        await complete(db, attempt, run, grade(answers, false), guestId);
        assert.equal(await scalar(db, `(select count(*)::int from cpa_users where id='${guestId}')`), 0);
        assert.equal(await scalar(db, `(select count(*)::int from cpa_xp_events where user_id='${guestId}')`), 0);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_review_items)'), 0);
        // Time travel is restricted to this isolated fixture; production guards
        // prevent modifying the retention timestamps themselves.
        await db.exec('alter table cpa_attempts disable trigger cpa_attempt_immutable');
        await db.query("with boundary as(select clock_timestamp() as t) update cpa_attempts set submitted_at=t-interval '168 hours',expires_at=t from boundary where id=$1", [attempt.attempt_id]);
        await db.exec('alter table cpa_attempts enable trigger cpa_attempt_immutable');
        await assert.rejects(scalar(db, 'public.cpa_get_attempt_result($1,$2)', [attempt.attempt_id, guestId]), /expired/);
        assert.deepEqual(await scalar(db, 'public.cpa_get_attempt_history($1)', [guestId]), []);
        await assert.rejects(complete(db, attempt, run, grade(), guestId), /expired/);
        assert.equal(await scalar(db, 'public.cpa_purge_expired_attempts(10)'), 1);
        for (const table of ['cpa_attempts','cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results']) {
            assert.equal(await scalar(db, `(select count(*)::int from ${table})`), 0);
        }
        const old = await payload(db, bank, { owner: guestId, actor: 'guest', submitted: await scalar(db, "(clock_timestamp()-interval '168 hours')::text") });
        await assert.rejects(begin(db, old), /expired/);
        await finish(db, bank, false);
        await db.query('delete from auth.users where id=$1', [memberId]);
        for (const table of ['cpa_attempts','cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results','cpa_review_items']) {
            assert.equal(await scalar(db, `(select count(*)::int from ${table})`), 0);
        }
        assert.equal(await scalar(db, `(select count(*)::int from cpa_xp_events where user_id='${memberId}')`), 0);
    } finally { await db.close(); }
});

test('rankings exclude opening balances from periods, share ties, hide UUIDs and survive publishing another release', async () => {
    const { db, bank } = await setup();
    try {
        await finish(db, bank, true, memberId);
        await finish(db, bank, true, otherMemberId);
        const all = await scalar<Ranking[]>(db, "public.cpa_get_leaderboard('all')");
        assert.deepEqual(all.map((r) => r.exp), [19, 2]);
        const week = await scalar<Ranking[]>(db, "public.cpa_get_leaderboard('week')");
        const month = await scalar<Ranking[]>(db, "public.cpa_get_leaderboard('month')");
        assert.deepEqual(week.map((r) => [r.rank, r.exp]), [[1, 2], [1, 2]]);
        assert.deepEqual(month, week);
        assert.doesNotMatch(JSON.stringify(all), /00000000-|user_id|email/);
        await db.exec("set timezone='America/Los_Angeles'");
        assert.deepEqual(await scalar(db, "public.cpa_get_leaderboard('week')"), week);
        const changed = sampleQuestionSet(); changed.title += ' 개정';
        const next = await importQuestionBank(db, [changed]);
        await finish(db, next, true, otherMemberId);
        assert.equal(await scalar(db, `(select exp::int from cpa_users where id='${otherMemberId}')`), 4);
        await assert.rejects(db.exec(`update cpa_users set exp=100 where id='${memberId}'`), /XP ledger/);
        assert.equal(await scalar(db, 'public.cpa_initialize_learning_progress()'), 0);
    } finally { await db.close(); }
});

test('a late XP failure rolls back results and notebook together, then the same lease can recover', async () => {
    const { db, bank } = await setup();
    try {
        const attempt = await begin(db, await payload(db, bank));
        const run = await claim(db, attempt);
        await db.exec(`create function reject_test_award() returns trigger language plpgsql as $$
            begin if new.event_type='submission_award' then raise exception 'simulated ledger outage'; end if; return new; end $$;
            create trigger reject_test_award before insert on cpa_xp_events for each row execute function reject_test_award();`);
        await assert.rejects(complete(db, attempt, run, grade(answers, false)), /simulated ledger outage/);
        for (const table of ['cpa_subquestion_grade_results', 'cpa_criterion_grade_results', 'cpa_review_items']) {
            assert.equal(await scalar(db, `(select count(*)::int from ${table})`), 0);
        }
        assert.equal(await scalar(db, '(select status from cpa_attempts where id=$1)', [attempt.attempt_id]), 'grading');
        assert.equal(await scalar(db, '(select status from cpa_grading_runs where id=$1)', [run.run_id]), 'running');
        assert.equal(await scalar(db, `(select exp::int from cpa_users where id='${memberId}')`), 17);
        await db.exec('drop trigger reject_test_award on cpa_xp_events; drop function reject_test_award()');
        await complete(db, attempt, run, grade(answers, false));
        assert.equal(await scalar(db, '(select count(*)::int from cpa_review_items)'), 2);
    } finally { await db.close(); }
});

test('partial points follow the stored criterion contract and history cursors retain timestamp ties', async () => {
    const { db, bank } = await setup();
    try {
        const changed = sampleQuestionSet();
        changed.subquestions[0].criteria[0].max_points = 2;
        changed.subquestions[0].criteria[0].scores = { met: 2, partial: 1, not_met: 0, contradicted: 0 };
        const next = await importQuestionBank(db, [changed]);
        const input = await payload(db, next);
        const attempt = await begin(db, input);
        const run = await claim(db, attempt);
        const partial = applyQuestionSetJudgment(changed, answers, { subquestions: [
            { subquestion_id: 'sub1', verdicts: [{ criterion_id: 'crit1', verdict: 'partial', quote: answers.sub1 }] },
            { subquestion_id: 'sub2', verdicts: [{ criterion_id: 'crit1', verdict: 'met', quote: answers.sub2 }] },
        ] });
        const wrong = structuredClone(partial); wrong.subquestions[0].criteria[0].awarded_points = 2;
        await assert.rejects(complete(db, attempt, run, wrong), /points mismatch/);
        assert.equal((await complete(db, attempt, run, partial)).result?.score, 2);
        const sameTime = await clock(db);
        for (let i = 0; i < 55; i++) await begin(db, await payload(db, bank, { owner: otherMemberId, submitted: sameTime }));
        type History = { id: string; submitted_at: string };
        const page1 = await scalar<History[]>(db, 'public.cpa_get_attempt_history($1,$2,$3,$4)', [otherMemberId, 50, null, null]);
        assert.equal(page1.length, 50);
        const cursor = page1[page1.length - 1];
        const page2 = await scalar<History[]>(db, 'public.cpa_get_attempt_history($1,$2,$3,$4)', [otherMemberId, 50, cursor.submitted_at, cursor.id]);
        assert.equal(page2.length, 5);
        assert.equal(new Set([...page1, ...page2].map((a) => a.id)).size, 55);
    } finally { await db.close(); }
});

test('period ranking uses inclusive Korean period start and exclusive next-period start', async () => {
    const { db, bank } = await setup();
    try {
        const completed = [];
        for (let i = 0; i < 4; i++) completed.push(await finish(db, bank));
        // Only the isolated fixture clock is moved. The real writer always records
        // server completion time and prevents editing ledger rows afterward.
        await db.exec('alter table cpa_xp_events disable trigger cpa_learning_record_guard');
        for (const period of ['week', 'month']) {
            const interval = period === 'week' ? '7 days' : '1 month';
            const bounds = await db.query<{ start: string; end: string }>(`select
                (date_trunc('${period}',clock_timestamp() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')::text as start,
                ((date_trunc('${period}',clock_timestamp() at time zone 'Asia/Seoul')+interval '${interval}') at time zone 'Asia/Seoul')::text as end`);
            const { start, end } = bounds.rows[0];
            const times = [
                await scalar(db, "($1::timestamptz-interval '1 microsecond')::text", [start]), start,
                await scalar(db, "($1::timestamptz-interval '1 microsecond')::text", [end]), end,
            ];
            for (let i = 0; i < 4; i++) await db.query('update cpa_xp_events set credited_at=$1::timestamptz where source_attempt_id=$2', [times[i], completed[i].attempt.attempt_id]);
            assert.deepEqual((await scalar<Ranking[]>(db, 'public.cpa_get_leaderboard($1)', [period])).map((r) => r.exp), [4]);
        }
        await db.exec('alter table cpa_xp_events enable trigger cpa_learning_record_guard');
    } finally { await db.close(); }
});

test('real submission orchestration and SQL agree on guest conversion, replay and new-member XP', async () => {
    const { db, bank } = await setup();
    try {
        const signingKey = 'local-integration-test-signing-key-32-bytes';
        const version = bank.question_versions[0].set_version_id;
        let modelCalls = 0;
        let quotaCalls = 0;
        const deps: LearningServiceDependencies = {
            signingKeys: [signingKey], apiKey: 'test-only-no-network',
            loadSet: async (_release, id) => scalar<QuestionSetV3>(db, 'public.cpa_get_question_version($1)', [id]),
            findAttempt: async (owner, key) => scalar<string | null>(db, '(select id from public.cpa_attempts where owner_user_id=$1 and submission_key=$2)', [owner, key]),
            begin: async (claims, raw) => scalar<Attempt>(db, 'public.cpa_begin_attempt($1::jsonb)', [JSON.stringify({ ...claims, answers: raw })]),
            readResult: async (owner, id) => scalar<StoredAttemptResult>(db, 'public.cpa_get_attempt_result($1,$2)', [id, owner]),
            claim: async (owner, id, actualMetadata) => scalar(db, 'public.cpa_claim_grading_run($1,$2,$3::jsonb)', [id, owner, JSON.stringify(actualMetadata)]),
            complete: async (owner, id, run, lease, result, raw) => scalar<StoredAttemptResult>(db, 'public.cpa_complete_grading_run($1,$2,$3,$4,$5::jsonb)',
                [id, owner, run, lease, JSON.stringify({ ...result, raw_judgment: raw })]),
            fail: async (owner, id, run, lease, code) => { await scalar(db, 'public.cpa_fail_grading_run($1,$2,$3,$4,$5)', [id, owner, run, lease, code]); },
            consumeQuota: async () => { quotaCalls++; return true; },
            consumeSubmissionQuota: async () => true,
            grade: async (set, raw, _key, onJudgment) => {
                modelCalls++;
                const judgment: QuestionSetJudgmentV3 = { subquestions: set.subquestions.map((sub) => ({
                    subquestion_id: sub.id,
                    verdicts: sub.criteria.map((criterion) => ({ criterion_id: criterion.id, verdict: 'met', quote: raw[sub.id] })),
                })) };
                onJudgment?.(judgment);
                return applyQuestionSetJudgment(set, raw, judgment);
            },
        };
        const issuedAt = Date.now();
        const guestToken = issueSubmissionToken({ owner_user_id: guestId, actor_kind: 'guest',
            release_id: bank.release_id, set_version_id: version, questionSet: sampleQuestionSet(), answers }, signingKey, issuedAt);
        // The token was issued as a guest. Linking the same auth identity does not
        // retroactively turn that submitted work into member rewards.
        await db.query('update auth.users set is_anonymous=false where id=$1', [guestId]);
        await db.query("insert into cpa_users(id,username) values($1,'converted')", [guestId]);
        const first = await gradeLearningSubmission(guestId, 'pilot-01-001', guestToken, answers, deps);
        assert.equal(first.ok, true);
        assert.equal(await scalar(db, '(select exp::int from cpa_users where id=$1)', [guestId]), 0);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_xp_events where user_id=$1)', [guestId]), 0);
        assert.equal((await gradeLearningSubmission(guestId, 'pilot-01-001', guestToken, answers, deps)).ok, true);
        assert.equal(modelCalls, 1); assert.equal(quotaCalls, 1);
        const memberToken = issueSubmissionToken({ owner_user_id: guestId, actor_kind: 'member',
            release_id: bank.release_id, set_version_id: version, questionSet: sampleQuestionSet(), answers }, signingKey);
        assert.equal((await gradeLearningSubmission(guestId, 'pilot-01-001', memberToken, answers, deps)).ok, true);
        assert.equal(await scalar(db, '(select exp::int from cpa_users where id=$1)', [guestId]), 2);
        assert.equal(await scalar(db, "(select count(*)::int from cpa_xp_events where user_id=$1 and event_type='opening_balance')", [guestId]), 1);
        const expired = await gradeLearningSubmission(guestId, 'pilot-01-001', guestToken, answers,
            { ...deps, now: () => issuedAt + SUBMISSION_TTL_MS });
        assert.equal(expired.ok, false);
        if (!expired.ok) assert.equal(expired.code, 'submission_expired');
        assert.equal(modelCalls, 2); assert.equal(quotaCalls, 2);
        assert.equal(await scalar(db, '(select count(*)::int from cpa_attempts where owner_user_id=$1)', [guestId]), 2);
    } finally { await db.close(); }
});
