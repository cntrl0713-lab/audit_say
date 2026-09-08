import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/** 이 배치의 추가 마이그레이션만 실행. 기존 프로젝트 마이그레이션은 재실행하지 않는다. */
async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL이 .env.local에 필요합니다.');
    const connection = new URL(process.env.DATABASE_URL);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
    if (!connection.hostname.includes(project) && !decodeURIComponent(connection.username).includes(project)) throw new Error('DATABASE_URL이 현재 Supabase 프로젝트를 가리키는지 확인하세요.');
    const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, query_timeout: 60000 });
    try {
        await db.connect();
        const renamed = await db.query("select to_regclass('public.cpa_firm_annual_collection') as table_name");
        if (renamed.rows[0].table_name) {
            console.log('CPA-prefixed schema is installed; historical F004 migrations must not be replayed. Use new forward migrations.');
            return;
        }
        const existing = await db.query("select to_regclass('public.firm_annual_collection') as table_name");
        if (!existing.rows[0].table_name) {
            const backupDir = path.resolve('.cache/firm_collector/annual-2026-09-08/backups', new Date().toISOString().replace(/[:.]/g, '-'));
            fs.mkdirSync(backupDir, { recursive: true });
            for (const table of ['firm_registered', 'firm_profile_yearly', 'firm_workforce_yearly']) {
                const rows = await db.query(`select * from public.${table}`);
                fs.writeFileSync(path.join(backupDir, `${table}-before-annual.json`), JSON.stringify(rows.rows), { flag: 'wx', mode: 0o600 });
            }
            await db.query(fs.readFileSync('supabase/migrations/20260908000002_firm_annual_reports.sql', 'utf8'));
            console.log('F004 migration applied.');
        }
        const definition = await db.query("select pg_get_functiondef('public.replace_firm_annual_report(bigint,smallint,jsonb)'::regprocedure) as sql");
        if (!definition.rows[0].sql.includes('p_year not in (2024,2025,2026)')) {
            await db.query(fs.readFileSync('supabase/migrations/20260908000003_firm_annual_2026.sql', 'utf8'));
            console.log('F004 2026 migration applied.');
        } else console.log('F004 schema supports 2026; no additional migration needed.');
        const startYear = await db.query("select 1 from information_schema.columns where table_schema='public' and table_name='v_firm_annual_summary' and column_name='fy_start_year'");
        if (!startYear.rows.length) {
            await db.query(fs.readFileSync('supabase/migrations/20260908000004_firm_annual_start_year.sql', 'utf8'));
            console.log('F004 start-year view migration applied.');
        }
    } finally { await db.end(); }
}
main().catch(error => { console.error(`F004 migration failed: ${error instanceof Error && !('code' in error) ? error.message : (error as { code?: string }).code ?? 'connection error'}`); process.exitCode = 1; });
