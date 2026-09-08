import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { indexDartXml } from '../scripts/firm_collector/dartXml.ts';
import { parseAnnualReport } from '../scripts/firm_collector/annualReportParse.ts';
import { annualPayload } from '../scripts/firm_collector/collectAnnualReports.ts';

test('실제 SQL: 원자적 교체·구 공시 거부·재실행·비공개 RLS·함수 권한', async () => {
    const db = new PGlite();
    try {
        await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
        await db.exec("create schema auth; create table auth.users(id uuid primary key,created_at timestamptz default now()); insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');");
        const old = fs.readFileSync(new URL('../supabase/migrations/20260907000001_firm_platform_schema.sql', import.meta.url), 'utf8');
        for (const table of ['firm_registered', 'firm_company', 'firm_engagement', 'firm_audit_opinion', 'firm_financials', 'firm_service_contract', 'firm_profile_yearly', 'firm_workforce_yearly', 'firm_review']) {
            const ddl = old.match(new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`));
            assert.ok(ddl); await db.exec(ddl[0]);
        }
        await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260907000002_firm_platform_views.sql', import.meta.url), 'utf8'));
        await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260908000002_firm_annual_reports.sql', import.meta.url), 'utf8'));
        await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260908000003_firm_annual_2026.sql', import.meta.url), 'utf8'));
        await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260908000004_firm_annual_start_year.sql', import.meta.url), 'utf8'));
        await db.exec("insert into firm_registered(firm_name,dart_corp_code) values('삼일회계법인','00260295'); grant all on firm_registered,firm_company,firm_profile_yearly,firm_workforce_yearly to service_role;");
        const doc = indexDartXml(fs.readFileSync(new URL('./fixtures/firm-annual/samil.xml', import.meta.url), 'utf8'));
        const parsed = parseAnnualReport(doc, '20250930000188');
        parsed.tables.firm_director.push({ seq_no: 1, name: '테스트전용', position: null, duty: null, segment: 'unclassified', tenure_months: null, practice_months: null, invest_rate: null });
        const payload = annualPayload(parsed, 1, { corp_code: '00260295', corp_name: '삼일회계법인', rcept_no: '20250930000188', rcept_dt: '20250930', report_nm: '회계법인사업보고서 (2025.06)' });
        const write = (value: typeof payload) => db.query('select public.replace_firm_annual_report($1,$2::smallint,$3::jsonb)', [1, 2025, JSON.stringify(value)]);
        await db.exec('set role service_role'); await write(payload); await write(payload);
        const basis = await db.query<{ fy_start_year: number; bsns_year: number }>('select fy_start_year,bsns_year from v_firm_annual_summary where firm_id=1');
        assert.equal(basis.rows[0].fy_start_year, 2024);
        assert.equal(basis.rows[0].bsns_year, 2025);
        const count = await db.query<{ count: number }>('select count(*)::int as count from firm_director'); assert.equal(count.rows[0].count, 1);
        const broken = structuredClone(payload); broken.tables.firm_director[0].segment = 'invalid';
        await assert.rejects(write(broken));
        assert.equal((await db.query<{ name: string }>('select name from firm_director')).rows[0].name, '테스트전용');
        await assert.rejects(write({ ...payload, sourceDate: '2024-01-01' }), /older receipt/);
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`reset role; set role ${role}`);
            assert.equal((await db.query('select * from firm_director')).rows.length, 0);
            assert.equal((await db.query('select * from firm_director_pay')).rows.length, 0);
            assert.ok((await db.query('select * from firm_personnel_cost_yearly')).rows.length > 0);
            await assert.rejects(write(payload), /permission denied/);
        }
        await db.exec('reset role');
        // 확장된 2026 결산연도는 허용하되 범위 밖 연도와 행 연도 불일치는 거부한다.
        const nextDoc = { ...doc, fyStartDate: '2025-07-01', fyEndDate: '2026-06-30' };
        const nextPayload = annualPayload(parseAnnualReport(nextDoc, '20260908000001'), 1, { corp_code: '00260295', corp_name: '삼일회계법인', rcept_no: '20260908000001', rcept_dt: '20260908', report_nm: '회계법인사업보고서 (2026.06)' });
        await db.query('select public.replace_firm_annual_report($1,$2::smallint,$3::jsonb)', [1, 2026, JSON.stringify(nextPayload)]);
        assert.equal((await db.query('select * from firm_annual_collection where bsns_year=2026')).rows.length, 1);
        await assert.rejects(db.query('select public.replace_firm_annual_report($1,$2::smallint,$3::jsonb)', [1, 2023, JSON.stringify(nextPayload)]), /Unsupported fiscal year/);
        const badYear = structuredClone(nextPayload); badYear.tables.firm_profile_yearly[0].bsns_year = 2025;
        await assert.rejects(db.query('select public.replace_firm_annual_report($1,$2::smallint,$3::jsonb)', [1, 2026, JSON.stringify(badYear)]), /Row identity mismatch/);
        assert.equal((await db.query("select * from pg_policies where tablename in ('firm_director','firm_director_pay')")).rows.length, 0);
        await db.exec(fs.readFileSync(new URL('../supabase/verification/verify_firm_views.sql', import.meta.url), 'utf8'));
        assert.equal((await db.query<{ count: number }>('select count(*)::int as count from firm_registered')).rows[0].count, 1);
        // 실제 적재된 공개 원문으로 새 뷰를 검증한다. 운영 DB에는 쓰지 않는다.
        await db.exec('alter table public.firm_annual_form_cell rename to cpa_firm_annual_form_cell; alter table public.firm_profile_yearly rename to cpa_firm_profile_yearly; alter table public.firm_audit_input_yearly rename to cpa_firm_audit_input_yearly;');
        const viewSql = fs.readFileSync(new URL('../supabase/migrations/20260908005001_firm_headcount_and_audit_input_views.sql', import.meta.url), 'utf8');
        await db.exec(viewSql);
        await db.exec(viewSql); // 재실행 가능
        // 이 테스트는 기본 스키마의 CREATE TABLE만 읽으므로 공개 profile의 기본 권한을 복원한다.
        await db.exec('grant select on cpa_firm_profile_yearly to anon,authenticated; set role anon');
        const headcounts = await db.query<{ numeric_value: string; source_rcept_no: string }>("select numeric_value,source_rcept_no from v_firm_headcount where code='HR_CPA_ALL' and bsns_year=2025");
        assert.equal(headcounts.rows.length, 1);
        assert.equal(Number(headcounts.rows[0].numeric_value), 3073);
        assert.equal(headcounts.rows[0].source_rcept_no, '20250930000188');
        assert.ok((await db.query('select * from v_firm_audit_input where bsns_year=2025')).rows.length > 0);
        for (const name of ['v_firm_headcount', 'v_firm_audit_input']) {
            const options = await db.query<{ reloptions: string[] }>('select reloptions from pg_class where relname=$1', [name]);
            assert.ok(options.rows[0].reloptions.includes('security_invoker=true'));
        }
        // 같은 결산연도라도 다른 접수번호는 조인되지 않는다.
        await db.exec('reset role');
        await db.exec("update cpa_firm_annual_form_cell set source_rcept_no='unmatched' where bsns_year=2025 and code='HR_CPA_ALL'");
        assert.equal((await db.query("select * from v_firm_headcount where bsns_year=2025 and code='HR_CPA_ALL'")).rows.length, 0);
    } finally { await db.close(); }
});
