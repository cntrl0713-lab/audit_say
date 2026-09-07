import fs from 'node:fs';
import path from 'node:path';
import { createStoreClient } from './store.ts';
import { parseDocumentZip } from './dartXml.ts';
import { parseAnnualReport } from './annualReportParse.ts';
import { ANNUAL_COLLECTION_YEARS, selectAnnualFilings } from './annualReportSelection.ts';
import type { FirmFiling } from './dartClient.ts';

/** 이름 대조는 검토 후보만 생성한다. FK나 engagement를 자동 생성/수정하지 않는다. */
async function main() {
    const dir = process.env.DART_CACHE_DIR;
    if (!dir) throw new Error('DART_CACHE_DIR 필요');
    const db = createStoreClient();
    const firms = await db.from('firm_registered').select('firm_id,dart_corp_code').limit(2000);
    if (firms.error) throw new Error(firms.error.code);
    const known: { corp_code: string; corp_name: string; firm_id: number; bsns_year: number }[] = [];
    for (let page = 0; ; page++) {
        const { data, error } = await db.from('v_firm_clients').select('corp_code,corp_name,firm_id,bsns_year,engagement_id').order('engagement_id').range(page * 1000, page * 1000 + 999);
        if (error) throw new Error(error.code);
        known.push(...data); if (data.length < 1000) break;
    }
    const key = (name: string) => name.replace(/\(주\)|㈜|주식회사|\s/g, '');
    const filings = JSON.parse(fs.readFileSync(path.join(dir, 'filings-latest.json'), 'utf8')) as FirmFiling[];
    const comparisons: Record<string, unknown>[] = [], skipped: Record<string, unknown>[] = [];
    for (const year of ANNUAL_COLLECTION_YEARS) for (const f of selectAnnualFilings(filings, year).selected) {
        try {
            if (selectAnnualFilings(filings, year).multiplePeriods.some(p => p.corp_code === f.corp_code)) throw new Error('multipleFiscalPeriods');
            const doc = parseDocumentZip(fs.readFileSync(path.join(dir, 'documents', f.rcept_no + '.zip')));
            const parsed = parseAnnualReport(doc, f.rcept_no);
            if (parsed.hardFailures.length) throw new Error('정합성 검증 보류');
            const firm = firms.data.find(m => m.dart_corp_code === f.corp_code);
            for (const client of parsed.tables.firm_audit_client) {
                const candidates = known.filter(c => key(c.corp_name) === key(String(client.client_name)));
                comparisons.push({ firm_corp_code: f.corp_code, firm_fy_start_year: Number(doc.fyStartDate!.slice(0, 4)), firm_fy_start_date: doc.fyStartDate, firm_fy_end_date: doc.fyEndDate, source: f.rcept_no, client_name: client.client_name,
                    candidate_corp_codes: [...new Set(candidates.map(c => c.corp_code))],
                    observed_client_years_with_same_firm: [...new Set(candidates.filter(c => c.firm_id === firm?.firm_id).map(c => c.bsns_year))],
                    automatic_link: false });
            }
        } catch (error) { skipped.push({ corp_code: f.corp_code, source: f.rcept_no, reason: error instanceof Error ? error.message : 'compareError' }); }
    }
    const report = { generatedAt: new Date().toISOString(), note: '회계법인 결산기간과 고객사 사업연도는 동일 기간으로 간주하지 않음. 이름 대조 후보만 제시하며 자동 연결 없음.',
        counts: { rows: comparisons.length, singleCandidate: comparisons.filter(r => (r.candidate_corp_codes as string[]).length === 1).length, multipleCandidates: comparisons.filter(r => (r.candidate_corp_codes as string[]).length > 1).length, noCandidate: comparisons.filter(r => (r.candidate_corp_codes as string[]).length === 0).length }, skipped, comparisons };
    fs.mkdirSync('docs/reports/annual', { recursive: true });
    fs.writeFileSync('docs/reports/annual/client-comparison.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.counts));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'compareError'); process.exitCode = 1; });
