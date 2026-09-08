import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { indexDartXml } from '../scripts/firm_collector/dartXml.ts';
import { parseAnnualReport } from '../scripts/firm_collector/annualReportParse.ts';
import { annualPayload } from '../scripts/firm_collector/collectAnnualReports.ts';

const migration = fs.readFileSync(new URL('../supabase/migrations/20260908003002_cpa_table_prefix.sql', import.meta.url), 'utf8');
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';

test('CPA table rename preserves data, OIDs, FKs, RLS, old clients and annual RPC; repeat is safe', async () => {
    const db = new PGlite();
    try {
        await db.exec(`
            create role anon; create role authenticated; create role service_role bypassrls;
            grant usage on schema public to anon,authenticated,service_role;
            alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
            create schema auth; grant usage on schema auth to anon,authenticated,service_role;
            create table auth.users(id uuid primary key, created_at timestamptz default now());
            create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
            insert into auth.users(id) values('${user}'),('${other}');
            create table user_cpa(id uuid primary key references auth.users(id),username text,role text default 'MEMBER',exp integer default 0,level integer default 1);
            alter table user_cpa enable row level security;
            create policy own_select on user_cpa for select to authenticated using(id=auth.uid());
            create policy own_insert on user_cpa for insert to authenticated with check(id=auth.uid());
            insert into user_cpa(id,username,exp) values('${user}','test',7);
            create table cpa_review_notes(id integer primary key,user_id uuid references user_cpa(id));
            insert into cpa_review_notes values(1,'${user}');
            create table cta_user(id integer primary key); insert into cta_user values(1);
        `);
        for (const file of ['20260907000001_firm_platform_schema.sql','20260907000002_firm_platform_views.sql','20260908000002_firm_annual_reports.sql','20260908000003_firm_annual_2026.sql','20260908000004_firm_annual_start_year.sql']) {
            await db.exec(fs.readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
        }
        await db.exec("grant usage,select on all sequences in schema public to service_role; insert into firm_registered(firm_name,dart_corp_code) values('테스트 법인','00260295');");
        const snapshot = await db.query<{ oid: number; relname: string; relfilenode: number; relacl: unknown; relrowsecurity: boolean }>("select oid,relname,relfilenode,relacl::text,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and (relname='user_cpa' or left(relname,5)='firm_') order by oid");
        assert.equal(snapshot.rows.length,27);
        const constraints = await db.query("select oid,conrelid,confrelid,conkey,confkey from pg_constraint where connamespace='public'::regnamespace order by oid");
        const policies = await db.query("select oid,polrelid,polcmd,polroles,polqual::text,polwithcheck::text from pg_policy order by oid");
        await db.exec(migration);
        await db.exec(migration);
        for (const before of snapshot.rows) {
            const after = (await db.query<typeof before>('select oid,relname,relfilenode,relacl::text,relrowsecurity from pg_class where oid=$1',[before.oid])).rows[0];
            assert.deepEqual(after,{...before,relname:before.relname==='user_cpa'?'cpa_users':`cpa_${before.relname}`});
        }
        assert.deepEqual((await db.query("select oid,conrelid,confrelid,conkey,confkey from pg_constraint where connamespace='public'::regnamespace order by oid")).rows,constraints.rows);
        assert.deepEqual((await db.query("select oid,polrelid,polcmd,polroles,polqual::text,polwithcheck::text from pg_policy order by oid")).rows,policies.rows);
        assert.equal((await db.query("select * from pg_class where relnamespace='public'::regnamespace and relkind in ('r','p') and (relname='user_cpa' or left(relname,5)='firm_')")).rows.length,0);
        assert.equal((await db.query("select * from cta_user")).rows.length,1);
        await db.exec(`set role authenticated; set request.jwt.claim.sub='${other}';`);
        assert.equal((await db.query('select * from cpa_users')).rows.length,0);
        assert.equal((await db.query('select * from user_cpa')).rows.length,0);
        await db.exec(`insert into user_cpa(id,username) values('${other}','legacy client');`);
        await assert.rejects(db.exec(`insert into cpa_users(id,username) values('${user}','other user')`));
        await db.exec(`update user_cpa set exp=999 where id='${other}';`);
        assert.equal((await db.query<{ exp: number }>('select exp from user_cpa')).rows[0].exp,0);
        await db.exec('reset role;');
        const parsed = parseAnnualReport(indexDartXml(fs.readFileSync(new URL('./fixtures/firm-annual/samil.xml',import.meta.url),'utf8')),'20250930000188');
        parsed.tables.firm_director.push({seq_no:1,name:'비공개 테스트',position:null,duty:null,segment:'unclassified',tenure_months:null,practice_months:null,invest_rate:null});
        const payload = annualPayload(parsed,1,{corp_code:'00260295',corp_name:'테스트 법인',rcept_no:'20250930000188',rcept_dt:'20250930',report_nm:'회계법인사업보고서 (2025.06)'});
        await db.exec('set role service_role');
        const write = (value: typeof payload) => db.query('select public.replace_firm_annual_report($1,$2::smallint,$3::jsonb)',[1,2025,JSON.stringify(value)]);
        await write(payload); await write(payload);
        assert.equal((await db.query('select * from cpa_firm_annual_collection')).rows.length,1);
        assert.equal((await db.query('select * from cpa_firm_director')).rows.length,1);
        const broken=structuredClone(payload);broken.tables.firm_director[0].segment='invalid';
        await assert.rejects(write(broken));
        assert.equal((await db.query<{ name:string }>('select name from cpa_firm_director')).rows[0].name,'비공개 테스트');
        assert.ok((await db.query('select * from v_firm_annual_summary')).rows.length);
        // Legacy upsert path must keep working across the rollout, without a second data copy.
        await db.exec("insert into firm_registered(firm_name,dart_corp_code) values('업데이트','00260295') on conflict(dart_corp_code) do update set firm_name=excluded.firm_name;");
        assert.equal((await db.query<{ firm_name:string }>('select firm_name from cpa_firm_registered where firm_id=1')).rows[0].firm_name,'업데이트');
        for (const role of ['anon','authenticated']) {
            await db.exec(`reset role; set role ${role};`);
            for (const name of ['firm_director','firm_director_pay','cpa_firm_director','cpa_firm_director_pay']) {
                assert.equal((await db.query(`select * from ${name}`)).rows.length,0);
            }
            await assert.rejects(write(payload),/permission denied/);
        }
        await db.exec('reset role');
        assert.equal((await db.query<{ exp:number }>(`select exp from cpa_users where id='${user}'`)).rows[0].exp,7);
    } finally { await db.close(); }
});

test('CPA rename rejects a target collision and rolls back every rename', async () => {
    const db=new PGlite();
    try {
        await db.exec('create table firm_annual_collection(id integer); insert into firm_annual_collection values(1); create table cpa_firm_annual_collection(id integer); insert into cpa_firm_annual_collection values(2);');
        await assert.rejects(db.exec(migration),/rename conflict/);
        await db.exec('rollback');
        assert.deepEqual((await db.query('select * from firm_annual_collection')).rows,[{id:1}]);
        assert.deepEqual((await db.query('select * from cpa_firm_annual_collection')).rows,[{id:2}]);
    } finally { await db.close(); }
});
