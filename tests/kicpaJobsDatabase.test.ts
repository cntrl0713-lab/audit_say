import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const firstUser = '11111111-1111-4111-8111-111111111111';
const secondUser = '22222222-2222-4222-8222-222222222222';
const source = 'https://www.kicpa.or.kr/portal/default/kicpa/gnb/kr_pc/menu05/menu09/menu07.page';
const job = (id: string) => ({ id, title: `수습CPA 모집 ${id}`, company: '테스트회계법인', posted_at: '2026-09-10', source_url: `${source}?id=${id}`, firm_id: 1 });

async function fixture() {
    const db = new PGlite();
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
        create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
        grant usage on schema public, auth to anon,authenticated,service_role;
        create table public.cpa_users(id uuid primary key);
        create table public.cpa_firm_registered(firm_id bigint primary key);
        insert into public.cpa_users values ('${firstUser}'),('${secondUser}');
        insert into public.cpa_firm_registered values (1);
    `);
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260909010000_kicpa_jobs.sql', import.meta.url), 'utf8'));
    await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260910020000_kicpa_jobs_summary_fields.sql', import.meta.url), 'utf8'));
    await db.exec(`insert into public.cpa_kicpa_jobs_subscribers(user_id,is_active,consent_version,consented_at,phone_e164,phone_verified_at)
        select id,true,'2026-09-09-v1',now(),'+821000000000',now() from public.cpa_users;`);
    return db;
}

async function ingest(db: PGlite, board: string, jobs: object[]) {
    const result = await db.query<{ result: { inserted: number; queued: number; baseline: boolean } }>(
        'select public.ingest_cpa_kicpa_jobs($1,$2::jsonb) as result', [board, JSON.stringify(jobs)]);
    return result.rows[0].result;
}

test('KICPA board baselines, composite identities and delivery enqueue commit atomically', async () => {
    const db = await fixture();
    try {
        assert.deepEqual(await ingest(db, 'trainee_cpa', [job('1')]), { inserted: 1, queued: 0, baseline: true });
        assert.deepEqual(await ingest(db, 'trainee_cpa', [job('1'), job('2')]), { inserted: 1, queued: 2, baseline: false });
        assert.deepEqual(await ingest(db, 'trainee_cpa', [job('2'), job('2')]), { inserted: 0, queued: 0, baseline: false });
        assert.deepEqual(await ingest(db, 'cpa', [job('1')]), { inserted: 1, queued: 0, baseline: true });
        assert.equal((await db.query('select * from cpa_kicpa_jobs where id=$1', ['1'])).rows.length, 2);
        await assert.rejects(ingest(db, 'trainee_cpa', [job('3'), { ...job('4'), source_url: 'https://kicpa.or.kr.evil.test/job' }]));
        assert.equal((await db.query("select * from cpa_kicpa_jobs where id in ('3','4')")).rows.length, 0);
        assert.equal((await db.query('select * from cpa_kicpa_job_deliveries')).rows.length, 2);
        await assert.rejects(ingest(db, 'cpa', [{ ...job('3'), board: 'trainee_cpa' }]), /board mismatch/);
        await assert.rejects(ingest(db, 'invalid', []), /invalid board/);
    } finally { await db.close(); }
});

test('KICPA public readers cannot read phone numbers, delivery metadata or invoke private RPCs', async () => {
    const db = await fixture();
    try {
        await ingest(db, 'trainee_cpa', [job('1')]);
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`set role ${role}`);
            assert.equal((await db.query('select title from public.cpa_kicpa_jobs')).rows.length, 1);
            assert.deepEqual((await db.query('select title,company,posted_at::text,source_url from public.cpa_kicpa_jobs')).rows,
                [{ title: job('1').title, company: job('1').company, posted_at: '2026-09-10', source_url: job('1').source_url }]);
            for (const column of ['deadline','notified_at','is_baseline']) {
                await assert.rejects(db.query(`select ${column} from public.cpa_kicpa_jobs`), /permission denied/);
            }
            for (const table of ['cpa_kicpa_jobs_subscribers', 'cpa_kicpa_job_deliveries', 'cpa_kicpa_job_boards']) {
                await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
            }
            await assert.rejects(ingest(db, 'cpa', []), /permission denied/);
            await assert.rejects(db.query('select * from public.claim_cpa_kicpa_job_delivery()'), /permission denied/);
            await assert.rejects(db.query("select public.finish_cpa_kicpa_job_delivery($1,'sent')", [firstUser]), /permission denied/);
            await assert.rejects(db.query('delete from public.cpa_kicpa_jobs'), /permission denied/);
            await db.exec('reset role');
        }
        await db.query("select set_config('test.uid',$1,false)", [firstUser]);
        await db.exec('set role authenticated');
        const rows = (await db.query('select * from cpa_kicpa_jobs_subscription_status')).rows;
        assert.deepEqual(rows, [{ user_id: firstUser, is_active: true, boards: ['trainee_cpa','cpa'], consent_required: false }]);
        await db.query("select set_config('test.jwt',$1,false)", [JSON.stringify({ is_anonymous: true })]);
        assert.equal((await db.query('select * from cpa_kicpa_jobs_subscription_status')).rows.length, 0);
        await db.exec('reset role; set role service_role');
        assert.equal((await db.query('select phone_e164 from cpa_kicpa_jobs_subscribers')).rows.length, 2);
        await ingest(db, 'cpa', []);
    } finally { await db.close(); }
});

test('KICPA summary ingestion rejects additional source fields and leaves new deadline values empty', async () => {
    const db = await fixture();
    try {
        await ingest(db, 'trainee_cpa', [job('1')]);
        for (const field of ['deadline','body','email','contact_phone','attachments']) {
            await assert.rejects(ingest(db, 'trainee_cpa', [job('2'), { ...job('3'), [field]: 'excluded source data' }]), /unsupported job fields/);
            assert.equal((await db.query("select id from cpa_kicpa_jobs where id in ('2','3')")).rows.length, 0);
            assert.equal((await db.query('select id from cpa_kicpa_job_deliveries')).rows.length, 0);
        }
        await ingest(db, 'trainee_cpa', [{ ...job('1'), title: '수정된 수습CPA 공고', posted_at: '2026-09-11' }]);
        assert.deepEqual((await db.query('select title,company,posted_at::text,deadline from cpa_kicpa_jobs')).rows,
            [{ title: '수정된 수습CPA 공고', company: job('1').company, posted_at: '2026-09-11', deadline: null }]);
    } finally { await db.close(); }
});

test('KICPA saved preferences cannot enqueue before contact verification and current consent', async () => {
    const db = await fixture();
    try {
        await ingest(db, 'trainee_cpa', []);
        await ingest(db, 'cpa', []);
        await db.exec('update cpa_kicpa_jobs_subscribers set phone_e164=null,phone_verified_at=null');
        assert.equal((await ingest(db, 'trainee_cpa', [job('1')])).queued, 0);
        await db.query("update cpa_kicpa_jobs_subscribers set phone_e164='+821000000000',phone_verified_at=now(),boards=array['cpa'] where user_id=$1", [firstUser]);
        assert.equal((await ingest(db, 'trainee_cpa', [job('2')])).queued, 0);
        assert.equal((await ingest(db, 'cpa', [job('1')])).queued, 1);
        await db.query("update cpa_kicpa_jobs_subscribers set consent_version='outdated' where user_id=$1", [firstUser]);
        assert.equal((await ingest(db, 'cpa', [job('2')])).queued, 0);
        assert.equal((await db.query('select * from claim_cpa_kicpa_job_delivery()')).rows.length, 0);
        assert.deepEqual((await db.query('select status from cpa_kicpa_job_deliveries')).rows, [{ status: 'cancelled' }]);
        await assert.rejects(db.exec("update cpa_kicpa_jobs_subscribers set boards=array[]::text[]"), /check constraint/);
        await assert.rejects(db.exec("update cpa_kicpa_jobs_subscribers set boards=array['cpa','cpa']"), /check constraint/);
        await assert.rejects(db.exec('update cpa_kicpa_jobs_subscribers set consented_at=null'), /check constraint/);
        await assert.rejects(db.exec('update cpa_kicpa_jobs_subscribers set phone_e164=null where phone_verified_at is not null'), /check constraint/);
    } finally { await db.close(); }
});

test('KICPA provider acceptance remains distinct from confirmed delivery and is never retried', async () => {
    const db = await fixture();
    try {
        await ingest(db, 'trainee_cpa', []);
        await ingest(db, 'trainee_cpa', [job('1')]);
        const a = (await db.query<{ id: string }>('select * from claim_cpa_kicpa_job_delivery()')).rows[0];
        const b = (await db.query<{ id: string }>('select * from claim_cpa_kicpa_job_delivery()')).rows[0];
        await assert.rejects(db.query("select finish_cpa_kicpa_job_delivery($1,'accepted')", [a.id]), /requires provider message id/);
        await db.query("select finish_cpa_kicpa_job_delivery($1,'accepted',null,300,'receipt-1')", [a.id]);
        await db.query("select finish_cpa_kicpa_job_delivery($1,'sent',null,300,'receipt-2')", [b.id]);
        assert.equal((await db.query<{ notified_at: string | null }>('select notified_at from cpa_kicpa_jobs')).rows[0].notified_at, null);
        assert.equal((await db.query('select * from claim_cpa_kicpa_job_delivery()')).rows.length, 0);
        assert.deepEqual((await db.query('select status,provider_message_id,sent_at from cpa_kicpa_job_deliveries where id=$1', [a.id])).rows,
            [{ status: 'accepted', provider_message_id: 'receipt-1', sent_at: null }]);
        assert.equal((await db.query<{ result: boolean }>("select finish_cpa_kicpa_job_delivery($1,'sent') as result", [a.id])).rows[0].result, false);
    } finally { await db.close(); }
});

test('KICPA claims isolate recipients, bound retries and require all successful sends for notified_at', async () => {
    const db = await fixture();
    try {
        await ingest(db, 'trainee_cpa', []);
        await ingest(db, 'trainee_cpa', [job('1')]);
        const a = (await db.query<{ id: string; subscriber_id: string }>('select * from claim_cpa_kicpa_job_delivery()')).rows[0];
        const b = (await db.query<{ id: string; subscriber_id: string }>('select * from claim_cpa_kicpa_job_delivery()')).rows[0];
        assert.notEqual(a.subscriber_id, b.subscriber_id);
        assert.equal((await db.query('select * from claim_cpa_kicpa_job_delivery()')).rows.length, 0);
        await db.query("select finish_cpa_kicpa_job_delivery($1,'sent')", [a.id]);
        assert.equal((await db.query<{ notified_at: string | null }>('select notified_at from cpa_kicpa_jobs')).rows[0].notified_at, null);
        await db.query("select finish_cpa_kicpa_job_delivery($1,'failed','rate_limited',300)", [b.id]);
        assert.equal((await db.query('select * from claim_cpa_kicpa_job_delivery()')).rows.length, 0);
        await db.query("update cpa_kicpa_job_deliveries set next_attempt_at=now()-interval '1 minute' where id=$1", [b.id]);
        assert.equal((await db.query<{ id: string }>('select * from claim_cpa_kicpa_job_delivery()')).rows[0].id, b.id);
        await db.query("select finish_cpa_kicpa_job_delivery($1,'sent')", [b.id]);
        assert.ok((await db.query<{ notified_at: string | null }>('select notified_at from cpa_kicpa_jobs')).rows[0].notified_at);
        assert.equal((await db.query<{ result: boolean }>("select finish_cpa_kicpa_job_delivery($1,'failed') as result", [b.id])).rows[0].result, false);
        await ingest(db, 'trainee_cpa', [job('2')]);
        await db.exec("update cpa_kicpa_job_deliveries set status='failed',attempts=5 where job_id='2'");
        assert.equal((await db.query('select * from claim_cpa_kicpa_job_delivery()')).rows.length, 0);
    } finally { await db.close(); }
});

test('KICPA paused backlog and interrupted sends never automatically resend; unlink cascades deliveries', async () => {
    const db = await fixture();
    try {
        await ingest(db, 'trainee_cpa', []);
        await ingest(db, 'trainee_cpa', [job('1')]);
        const claimed = (await db.query<{ id: string }>('select * from claim_cpa_kicpa_job_delivery()')).rows[0];
        await db.query("update cpa_kicpa_job_deliveries set claimed_at=now()-interval '16 minutes' where id=$1", [claimed.id]);
        await db.exec("update cpa_kicpa_jobs_subscribers set notifications_since=now()+interval '1 second'");
        assert.equal((await db.query('select * from claim_cpa_kicpa_job_delivery()')).rows.length, 0);
        const statuses = (await db.query<{ status: string }>('select status from cpa_kicpa_job_deliveries order by status')).rows.map(row => row.status);
        assert.deepEqual(statuses, ['cancelled', 'uncertain']);
        await db.exec('delete from cpa_kicpa_jobs_subscribers');
        assert.equal((await db.query('select * from cpa_kicpa_job_deliveries')).rows.length, 0);
        assert.equal((await db.query('select * from cpa_kicpa_jobs')).rows.length, 1);
    } finally { await db.close(); }
});
