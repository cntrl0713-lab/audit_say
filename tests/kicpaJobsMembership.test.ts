import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const firstUser = '11111111-1111-4111-8111-111111111111';
const secondUser = '22222222-2222-4222-8222-222222222222';
const sql = (name: string) => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const common = sql('20260910090000_common_accounts');
const guard = sql('20260910093000_kicpa_jobs_membership_guard');

function commonFunction(name: string) {
    const start = common.indexOf(`create function public.${name}(`);
    assert.notEqual(start, -1, `${name} must come from the real common-account migration`);
    const end = common.indexOf('\nend $$;', start);
    assert.notEqual(end, -1);
    return common.slice(start, end + '\nend $$;'.length);
}

async function fixture(installCommonFunctions = true) {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role bypassrls;
            create schema auth;
            create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
            create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
            create table auth.users(id uuid primary key,is_anonymous boolean not null default false,email_confirmed_at timestamptz);
            create table public.common_profiles(id uuid primary key references auth.users(id),account_status text not null default 'active');
            create table public.cpa_users(id uuid primary key references auth.users(id),membership_status text not null default 'active',
                membership_version bigint not null default 1 check(membership_version>0));
            create table public.cta_user(id uuid primary key,membership_status text,membership_version bigint);
            create table public.cpa_firm_registered(firm_id bigint primary key);
            insert into auth.users(id,email_confirmed_at) values('${firstUser}',now()),('${secondUser}',now());
            insert into common_profiles(id) select id from auth.users;
            insert into cpa_users(id) select id from auth.users;
            grant usage on schema public,auth to anon,authenticated,service_role;
        `);
        if (installCommonFunctions) {
            await db.exec(commonFunction('common_assert_service_access'));
            await db.exec(commonFunction('common_guard_learning_membership'));
        }
        await db.exec(sql('20260909010000_kicpa_jobs'));
        await db.exec(sql('20260910020000_kicpa_jobs_summary_fields'));
        return db;
    } catch (error) { await db.close(); throw error; }
}

const save = (db: PGlite, user = firstUser, version = 1) => db.query(`
    insert into cpa_kicpa_jobs_subscribers(user_id,membership_version,is_active,consent_version,consented_at)
    values($1,$2,true,'2026-09-09-v1',now())
    on conflict(user_id) do update set membership_version=excluded.membership_version,is_active=excluded.is_active,
        consent_version=excluded.consent_version,consented_at=excluded.consented_at`, [user, version]);

async function assertFailedMigration(db: PGlite, pattern: RegExp) {
    await assert.rejects(db.exec(guard), pattern);
    await db.exec('rollback');
}

test('late jobs installation saves current subscriptions and supplies no default membership epoch', async () => {
    const db = await fixture();
    try {
        await db.exec(guard);
        const column = (await db.query<{ column_default: string | null }>(`select column_default from information_schema.columns
            where table_schema='public' and table_name='cpa_kicpa_jobs_subscribers' and column_name='membership_version'`)).rows[0];
        assert.equal(column.column_default, null);
        await db.exec('set role service_role');
        await assert.rejects(db.query('insert into cpa_kicpa_jobs_subscribers(user_id) values($1)', [firstUser]), /COMMON_MEMBERSHIP_VERSION_REQUIRED/);
        await assert.rejects(db.query('insert into cpa_kicpa_jobs_subscribers(user_id,membership_version) values($1,default)', [firstUser]), /COMMON_MEMBERSHIP_VERSION_REQUIRED/);
        await assert.rejects(db.query('insert into cpa_kicpa_jobs_subscribers(user_id,membership_version) values($1,null)', [firstUser]), /COMMON_MEMBERSHIP_VERSION_REQUIRED/);
        await save(db);
        await db.query('update cpa_kicpa_jobs_subscribers set is_active=false where user_id=$1', [firstUser]);
        assert.deepEqual((await db.query('select membership_version,is_active from cpa_kicpa_jobs_subscribers')).rows,
            [{ membership_version: 1, is_active: false }]);
        await db.exec('reset role; set role authenticated');
        await assert.rejects(db.query('select membership_version from cpa_kicpa_jobs_subscribers'), /permission denied/);
    } finally { await db.close(); }
});

test('the actual shared guard rejects stale insert, update and attempts to relabel an old subscription', async () => {
    const db = await fixture();
    try {
        await db.exec(guard);
        await save(db);
        await db.exec('update cpa_users set membership_version=2');
        await db.exec('set role service_role');
        await assert.rejects(save(db, secondUser, 1), /COMMON_STALE_MEMBERSHIP/);
        await assert.rejects(db.query('update cpa_kicpa_jobs_subscribers set is_active=false where user_id=$1', [firstUser]), /COMMON_STALE_MEMBERSHIP/);
        await assert.rejects(save(db, firstUser, 2), /COMMON_STALE_MEMBERSHIP/);
        await assert.rejects(db.query('update cpa_kicpa_jobs_subscribers set membership_version=null where user_id=$1', [firstUser]), /COMMON_STALE_MEMBERSHIP/);
        await save(db, secondUser, 2);
        assert.deepEqual((await db.query('select membership_version,is_active from cpa_kicpa_jobs_subscribers where user_id=$1', [firstUser])).rows,
            [{ membership_version: 1, is_active: true }]);
    } finally { await db.close(); }
});

test('withdrawn service, locked account and unverified identity cannot write subscriptions', async () => {
    const db = await fixture();
    try {
        await db.exec(guard);
        await save(db);
        await db.query("update cpa_users set membership_status='withdrawn' where id=$1", [firstUser]);
        await assert.rejects(db.query('update cpa_kicpa_jobs_subscribers set is_active=false where user_id=$1', [firstUser]), /COMMON_SERVICE_INACTIVE/);
        await db.query("update cpa_users set membership_status='withdrawn' where id=$1", [secondUser]);
        await assert.rejects(save(db, secondUser), /COMMON_SERVICE_INACTIVE/);
        await db.exec("update cpa_users set membership_status='active'; update common_profiles set account_status='locked'");
        await assert.rejects(save(db, secondUser), /COMMON_ACCOUNT_UNAVAILABLE/);
        await db.exec("update common_profiles set account_status='active'; update auth.users set email_confirmed_at=null");
        await assert.rejects(save(db, secondUser), /COMMON_ACCOUNT_UNAVAILABLE/);
    } finally { await db.close(); }
});

test('unambiguous legacy subscriptions backfill their verified first epoch while keeping existing records', async () => {
    const db = await fixture();
    try {
        await db.query(`insert into cpa_kicpa_jobs_subscribers(user_id,is_active,boards,consent_version,consented_at)
            values($1,true,array['cpa'],'2026-09-09-v1',now())`, [firstUser]);
        const before = (await db.query<Record<string, unknown>>('select * from cpa_kicpa_jobs_subscribers')).rows[0];
        await db.exec(guard);
        const after = (await db.query<Record<string, unknown>>('select * from cpa_kicpa_jobs_subscribers')).rows[0];
        assert.deepEqual(after, { ...before, membership_version: 1 });
        await db.exec(guard);
        assert.deepEqual((await db.query('select * from cpa_kicpa_jobs_subscribers')).rows[0], after);
    } finally { await db.close(); }
});

test('ambiguous legacy backfill fails atomically without deleting or relabelling data', async () => {
    const db = await fixture();
    try {
        await db.query('insert into cpa_kicpa_jobs_subscribers(user_id) values($1),($2)', [firstUser, secondUser]);
        const before = (await db.query('select * from cpa_kicpa_jobs_subscribers order by user_id')).rows;
        await db.query("update cpa_users set membership_status='withdrawn' where id=$1", [secondUser]);
        await assertFailedMigration(db, /COMMON_SERVICE_INACTIVE/);
        assert.deepEqual((await db.query('select * from cpa_kicpa_jobs_subscribers order by user_id')).rows, before);
        await db.exec("update cpa_users set membership_status='active'");
        await db.query('update cpa_users set membership_version=2 where id=$1', [firstUser]);
        await assertFailedMigration(db, /KICPA_AMBIGUOUS_LEGACY_MEMBERSHIP/);
        assert.deepEqual((await db.query('select * from cpa_kicpa_jobs_subscribers order by user_id')).rows, before);
        await db.exec('update cpa_users set membership_version=1; alter table cpa_kicpa_jobs_subscribers add column membership_version bigint');
        await db.query('update cpa_kicpa_jobs_subscribers set membership_version=1 where user_id=$1', [secondUser]);
        await db.query('update cpa_users set membership_version=2 where id=$1', [secondUser]);
        await assertFailedMigration(db, /COMMON_STALE_MEMBERSHIP/);
        assert.deepEqual((await db.query('select membership_version from cpa_kicpa_jobs_subscribers order by user_id')).rows,
            [{ membership_version: null }, { membership_version: 1 }]);
    } finally { await db.close(); }
});

test('normal common-account install order stays idempotent and removes any accidental insert default', async () => {
    const db = await fixture();
    try {
        await db.query('insert into cpa_kicpa_jobs_subscribers(user_id) values($1)', [firstUser]);
        const start = common.indexOf("do $$ declare t text;\nbegin\n  foreach t in array array['cpa_kicpa_jobs_subscribers'");
        assert.notEqual(start, -1);
        const end = common.indexOf('\nend $$;', start);
        await db.exec(common.slice(start, end + '\nend $$;'.length));
        await db.exec('alter table cpa_kicpa_jobs_subscribers alter column membership_version set default 1');
        await db.exec(guard);
        await db.exec(guard);
        const triggers = (await db.query<{ name: string; function_name: string; trigger_type: number }>(`select t.tgname as name,p.proname as function_name,t.tgtype::int as trigger_type
            from pg_trigger t join pg_proc p on p.oid=t.tgfoid
            where t.tgrelid='cpa_kicpa_jobs_subscribers'::regclass and not t.tgisinternal`)).rows;
        assert.deepEqual(triggers, [{ name: 'common_learning_membership', function_name: 'common_guard_learning_membership', trigger_type: 23 }]);
        await save(db);
        await assert.rejects(db.query('insert into cpa_kicpa_jobs_subscribers(user_id) values($1)', [secondUser]), /COMMON_MEMBERSHIP_VERSION_REQUIRED/);
    } finally { await db.close(); }
});

test('jobs membership migration requires the shared account functions before changing the schema', async () => {
    const db = await fixture(false);
    try {
        await assertFailedMigration(db, /KICPA_COMMON_ACCOUNTS_REQUIRED/);
        assert.equal((await db.query(`select column_name from information_schema.columns where table_schema='public'
            and table_name='cpa_kicpa_jobs_subscribers' and column_name='membership_version'`)).rows.length, 0);
    } finally { await db.close(); }
});
