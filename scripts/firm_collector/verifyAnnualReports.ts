import fs from 'node:fs';
import path from 'node:path';
import { parseDocumentZip } from './dartXml.ts';
import { parseAnnualReport, PRIVATE_ANNUAL_TABLES } from './annualReportParse.ts';
import { annualPayload } from './collectAnnualReports.ts';
import { ANNUAL_COLLECTION_YEARS, selectAnnualFilings } from './annualReportSelection.ts';
import type { FirmFiling } from './dartClient.ts';
import { createStoreClient } from './store.ts';

const tableIds: Record<string, string> = {
    firm_profile_yearly: 'profile_id', firm_workforce_yearly: 'workforce_id',
    firm_personnel_cost_yearly: 'cost_id', firm_income_statement_line: 'line_id',
    firm_audit_record_yearly: 'record_id', firm_audit_client: 'audit_client_id',
    firm_cpa_tenure_yearly: 'tenure_id', firm_audit_input_yearly: 'input_id',
    firm_quality_staff: 'qstaff_id', firm_inspection_result: 'inspection_id',
    firm_director_discipline: 'discipline_id', firm_certification_yearly: 'cert_id',
    firm_director_profile_yearly: 'dprofile_id', firm_director: 'director_id',
    firm_director_pay: 'pay_id', firm_annual_form_cell: 'cell_id',
};

/** 캐시 재파싱과 DB의 적재 컬럼을 대조한다. 개인 이름/행 내용은 보고서에 출력하지 않는다. */
async function main() {
    const dir = process.env.DART_CACHE_DIR;
    if (!dir) throw new Error('DART_CACHE_DIR 필요');
    const localOnly = process.argv.includes('--local-only');
    const yearsAt = process.argv.indexOf('--years');
    const years = yearsAt < 0 ? [...ANNUAL_COLLECTION_YEARS] : [...new Set((process.argv[yearsAt + 1] ?? '').split(',').map(Number))];
    if (!years.length || years.some(y => !(ANNUAL_COLLECTION_YEARS as readonly number[]).includes(y))) throw new Error('--years는 2024,2025,2026 중 쉼표로 지정');
    const reportAt = process.argv.indexOf('--report');
    const reportPath = reportAt >= 0 ? process.argv[reportAt + 1] : 'docs/reports/annual/cache-verification.json';
    const filingsAt = process.argv.indexOf('--filings');
    const filings = JSON.parse(fs.readFileSync(filingsAt >= 0 ? process.argv[filingsAt + 1] : path.join(dir, 'filings-latest.json'), 'utf8')) as FirmFiling[];
    const db = localOnly ? null : createStoreClient();
    const masters = db ? await db.from('firm_registered').select('firm_id,dart_corp_code').limit(2000) : null;
    if (masters?.error) throw new Error(`masterRead:${masters.error.code}`);
    const checks: Record<string, unknown>[] = [];
    for (const year of years) {
        const selection = selectAnnualFilings(filings, year);
        for (const { filing, reason } of selection.excluded) checks.push({ year, corp_code: filing.corp_code, source: filing.rcept_no, status: 'excluded', reason });
        // 연도/테이블마다 한 번 읽고 법인별 분할. 개인 행은 메모리에서만 대조한다.
        const tableCache = new Map<string, Map<number, Record<string, unknown>[]>>();
        for (const f of selection.selected) {
            const check: Record<string, unknown> = { year, corp_code: f.corp_code, source: f.rcept_no };
            if (selection.multiplePeriods.some(p => p.corp_code === f.corp_code)) {
                checks.push({ ...check, status: 'held', reason: 'multipleFiscalPeriods' }); continue;
            }
            try {
                const doc = parseDocumentZip(fs.readFileSync(path.join(dir, 'documents', f.rcept_no + '.zip')));
                check.version = doc.formulaVersion; check.groups = doc.groups.size;
                const p = parseAnnualReport(doc, f.rcept_no);
                check.fy_start_year = Number(doc.fyStartDate!.slice(0, 4)); check.fy_start_date = doc.fyStartDate; check.fy_end_date = doc.fyEndDate;
                check.hardFailures = p.hardFailures; check.warnings = p.consistencyWarnings;
                if (p.hardFailures.length) { check.status = 'held'; checks.push(check); continue; }
                // 공개 레코드와 보고서에 개인 이름이 의도치 않게 섞였는지 검사한다.
                const names = p.tables.firm_director_pay.map(r => String(r.name)).filter(n => n.length >= 3 && !/[○●*]/.test(n));
                const publicJson = JSON.stringify(Object.fromEntries(Object.entries(p.tables).filter(([t]) => !(PRIVATE_ANNUAL_TABLES as readonly string[]).includes(t))));
                check.possibleNameMatches = names.filter(n => publicJson.includes(n)).length;
                check.rows = Object.fromEntries(Object.entries(p.tables).map(([t, rows]) => [t, rows.length]));
                if (!db) check.status = 'parsed';
                else {
                    const master = masters!.data!.find(m => m.dart_corp_code === f.corp_code);
                    if (!master) throw new Error('masterMissing');
                    const expected = annualPayload(p, master.firm_id, f);
                    const differences: string[] = [];
                    for (const [table, expectedRows] of Object.entries(expected.tables)) {
                        const keys = Object.keys(expectedRows[0] ?? { firm_id: 0 });
                        if (!tableCache.has(table)) {
                            if (!tableIds[table]) throw new Error(`unknownTable:${table}`);
                            const byFirm = new Map<number, Record<string, unknown>[]>();
                            for (let offset = 0; ; offset += 1000) {
                                const { data, error } = await db.from(table).select('*').eq('bsns_year', year)
                                    .order(tableIds[table]).range(offset, offset + 999);
                                if (error) throw new Error(`verifyRead:${table}:${error.code}`);
                                for (const row of data as Record<string, unknown>[]) {
                                    const id = Number(row.firm_id), rows = byFirm.get(id) ?? [];
                                    rows.push(row); byFirm.set(id, rows);
                                }
                                if (data.length < 1000) break;
                            }
                            tableCache.set(table, byFirm);
                        }
                        const actualRows = tableCache.get(table)!.get(master.firm_id) ?? [];
                        const canonical = (rows: Record<string, unknown>[]) => rows.map(row => JSON.stringify(Object.fromEntries(keys.sort().map(k => [k, row[k]])))).sort();
                        if (JSON.stringify(canonical(expectedRows)) !== JSON.stringify(canonical(actualRows))) differences.push(table);
                    }
                    check.differences = differences; check.status = differences.length ? 'mismatch' : 'matched';
                }
            } catch (error) {
                check.reason = error instanceof Error ? error.message : 'verifyError';
                check.status = String(check.reason).startsWith('지원하지 않는 서식 버전') ? 'held' : 'error';
            }
            checks.push(check);
        }
    }
    const summary = checks.reduce<Record<string, number>>((a, r) => { const key = `${r.year}:${r.status}`; a[key] = (a[key] ?? 0) + 1; return a; }, {});
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), localOnly, years, summary, checks }, null, 2));
    console.log(JSON.stringify({ localOnly, summary, reportPath }));
    if (checks.some(c => c.status === 'mismatch' || c.status === 'error' || Number(c.possibleNameMatches) > 0)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'verifyError'); process.exitCode = 1; });
