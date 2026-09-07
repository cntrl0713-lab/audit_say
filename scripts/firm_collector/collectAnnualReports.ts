import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DartClient, FirmFiling } from './dartClient.ts';
import { ANNUAL_COLLECTION_YEARS, filingPeriod, selectAnnualFilings } from './annualReportSelection.ts';
import { parseDocumentZip } from './dartXml.ts';
import { parseAnnualReport, type AnnualResult, type AnnualRow } from './annualReportParse.ts';
import { normalizeFirmName } from './normalize.ts';

export const ANNUAL_PARSER_VERSION = 'f004-v18-v6-20260908.2';
interface Master { firm_id: number; firm_name: string; dart_corp_code: string | null; }
export interface AnnualOutcome { corp_code: string; firm_name: string; year: number; status: 'loaded' | 'validated' | 'not_filed' | 'held' | 'error'; source?: string; fy_start_year?: number; fy_start_date?: string; fy_end_date?: string; reason?: string; warnings?: string[]; rows?: Record<string, number>; payload_hash?: string; }
export interface AnnualReport { year: number; startDate: string; endDate: string; parserVersion: string; dryRun: boolean; filingCount: number; discoveredFirms: number; masterReview: { corp_code: string; name: string; reason: string }[]; outcomes: AnnualOutcome[]; excludedFilings?: ReturnType<typeof selectAnnualFilings>['excluded']; }

export function annualPayload(result: AnnualResult, firmId: number, filing: FirmFiling) {
    const base = { firm_id: firmId, bsns_year: result.year, source_rcept_no: result.source };
    const sourceDate = `${filing.rcept_dt.slice(0, 4)}-${filing.rcept_dt.slice(4, 6)}-${filing.rcept_dt.slice(6)}`;
    const tables: Record<string, AnnualRow[]> = Object.fromEntries(Object.entries(result.tables).map(([table, rows]) => [table, rows.map(r => ({ ...r, ...base }))]));
    tables.firm_profile_yearly = [{ ...result.profile, ...base, source_rcept_dt: sourceDate }];
    tables.firm_workforce_yearly = [{ ...result.workforce, ...base, source_rcept_dt: sourceDate }];
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify({ tables, warnings: result.consistencyWarnings })).digest('hex');
    return { corpCode: result.corpCode, fyEndDate: result.fyEndDate, source: result.source, sourceDate, parserVersion: ANNUAL_PARSER_VERSION, payloadHash, warnings: result.consistencyWarnings, tables };
}

async function masterMap(db: SupabaseClient, dart: DartClient, filings: FirmFiling[], dryRun: boolean, review: AnnualReport['masterReview']) {
    const { data, error } = await db.from('firm_registered').select('firm_id,firm_name,dart_corp_code').order('firm_id').limit(2000);
    if (error) throw new Error(`masterRead:${error.code}`);
    const masters = data as Master[];
    const corpFilings = new Map<string, FirmFiling>();
    for (const f of [...filings].sort((a, b) => a.rcept_no.localeCompare(b.rcept_no))) corpFilings.set(f.corp_code, f);
    const byName = new Map<string, Set<string>>();
    for (const f of corpFilings.values()) { const key = normalizeFirmName(f.corp_name); byName.set(key, new Set([...(byName.get(key) ?? []), f.corp_code])); }
    const result = new Map<string, { firmId: number; accMt: number | null }>();
    for (const f of corpFilings.values()) {
        let master = masters.find(m => m.dart_corp_code === f.corp_code);
        const sameName = masters.filter(m => normalizeFirmName(m.firm_name) === normalizeFirmName(f.corp_name));
        if (!master && (sameName.some(m => m.dart_corp_code !== null) || sameName.length > 1 || (byName.get(normalizeFirmName(f.corp_name))?.size ?? 0) > 1)) {
            review.push({ corp_code: f.corp_code, name: f.corp_name, reason: '동명 법인 또는 코드 충돌: 자동 병합 보류' }); continue;
        }
        if (!master && sameName.length === 1) master = sameName[0];
        try {
            const company = await dart.company(f.corp_code);
            if (company.status !== '000' || company.corp_code !== f.corp_code) throw new Error('companyIdentity');
            const acc = /^\d{2}$/.test(company.acc_mt ?? '') && Number(company.acc_mt) >= 1 && Number(company.acc_mt) <= 12 ? Number(company.acc_mt) : null;
            if (!dryRun) {
                if (!master) {
                    const { data: added, error: addError } = await db.from('firm_registered').insert({ firm_name: f.corp_name, dart_corp_code: f.corp_code, status: 'active', acc_mt: acc, induty_code: company.induty_code || null }).select('firm_id,firm_name,dart_corp_code').single();
                    if (addError) throw new Error(`masterInsert:${addError.code}`);
                    master = added as Master; masters.push(master);
                } else {
                    const { error: updateError } = await db.from('firm_registered').update({ dart_corp_code: f.corp_code, acc_mt: acc, induty_code: company.induty_code || null }).eq('firm_id', master.firm_id).or(`dart_corp_code.is.null,dart_corp_code.eq.${f.corp_code}`);
                    if (updateError) throw new Error(`masterUpdate:${updateError.code}`);
                }
                // 이미 고객사 마스터에 존재하는 회사만 업종 백필. 회계법인을 고객사로 새로 만들지 않는다.
                if (company.induty_code) {
                    const { error: industryError } = await db.from('firm_company').update({ induty: company.induty_code }).eq('corp_code', f.corp_code).is('induty', null);
                    if (industryError) throw new Error(`industryUpdate:${industryError.code}`);
                }
            }
            if (master && normalizeFirmName(master.firm_name) !== normalizeFirmName(f.corp_name)) review.push({ corp_code: f.corp_code, name: f.corp_name, reason: `동일 코드의 명칭 변경: 기존 firm_id=${master.firm_id} 유지` });
            result.set(f.corp_code, { firmId: master?.firm_id ?? 0, accMt: acc });
        } catch (error) { review.push({ corp_code: f.corp_code, name: f.corp_name, reason: error instanceof Error ? error.message : 'masterError' }); }
    }
    return { result, corpFilings };
}

export async function collectAnnualReports(options: {
    db: SupabaseClient; dart: DartClient; year: number; startDate: string; endDate: string;
    reportPath: string; dryRun?: boolean; resume?: boolean; retryFrom?: string | null; corps?: string[]; limit?: number | null;
    onProgress?: (done: number, total: number) => void;
}): Promise<AnnualReport> {
    const { db, dart, year } = options;
    if (!(ANNUAL_COLLECTION_YEARS as readonly number[]).includes(year)) throw new Error('F004 대상 결산연도는 2024·2025·2026');
    if (options.retryFrom && (options.resume || path.resolve(options.retryFrom) === path.resolve(options.reportPath))) throw new Error('retry-from은 별도 보고서로 실행');
    const filings = await dart.listFilings(options.startDate, options.endDate);
    const selection = selectAnnualFilings(filings, year);
    const report: AnnualReport = { year, startDate: options.startDate, endDate: options.endDate, parserVersion: ANNUAL_PARSER_VERSION, dryRun: Boolean(options.dryRun), filingCount: filings.length, discoveredFirms: new Set(filings.map(f => f.corp_code)).size, masterReview: [], outcomes: [] };
    report.excludedFilings = selection.excluded;
    const { result: masters, corpFilings } = await masterMap(db, dart, filings, Boolean(options.dryRun), report.masterReview);
    let corps = [...corpFilings.keys()].sort();
    if (options.corps?.length) corps = corps.filter(c => options.corps!.includes(c));
    if (options.limit != null) corps = corps.slice(0, options.limit);
    if (options.retryFrom) {
        const prior = JSON.parse(fs.readFileSync(options.retryFrom, 'utf8')).report as AnnualReport;
        if (prior.year !== year) throw new Error('재처리 연도 불일치');
        const retry = new Set(prior.outcomes.filter(o => ['held', 'error'].includes(o.status)).map(o => o.corp_code));
        corps = corps.filter(c => retry.has(c));
    }
    // resume는 과거 보고서의 completed 배열만 믿지 않는다. 최신 공시와 현재 파서로 다시 확인하고 DB hash가 같을 때만 쓰기를 생략.
    const checkpoint = async () => {
        fs.mkdirSync(path.dirname(path.resolve(options.reportPath)), { recursive: true });
        fs.writeFileSync(`${options.reportPath}.tmp`, JSON.stringify({ name: 'annual-reports', generatedAt: new Date().toISOString(), report }, null, 2));
        for (let attempt = 0; ; attempt++) {
            try { fs.renameSync(`${options.reportPath}.tmp`, options.reportPath); break; }
            catch (error) {
                if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
                await delay(100 * (attempt + 1));
            }
        }
    };
    await checkpoint();
    for (const [index, corp] of corps.entries()) {
        const outcome: AnnualOutcome = { corp_code: corp, firm_name: corpFilings.get(corp)!.corp_name, year, status: 'error' };
        try {
            const f = selection.selected.find(f => f.corp_code === corp);
            if (selection.unclassified.some(f => f.corp_code === corp)) { outcome.status = 'held'; outcome.reason = '목록 결산월 미확인'; }
            else if (selection.multiplePeriods.some(f => f.corp_code === corp)) { outcome.status = 'held'; outcome.reason = '같은 결산연도에 여러 결산일: 기존 연도 키에 덮어쓰지 않음'; }
            else if (!f) outcome.status = 'not_filed';
            else if (!masters.has(corp)) { outcome.status = 'held'; outcome.reason = '법인 식별/기업개황 확인 보류'; }
            else {
                outcome.source = f.rcept_no;
                const doc = parseDocumentZip(await dart.fetchDocument(f.rcept_no, true));
                if (doc.corpCode !== corp || doc.fyEndDate !== filingPeriod(f)) throw new Error('표지 법인코드/결산일과 목록 불일치');
                const parsed = parseAnnualReport(doc, f.rcept_no);
                outcome.fy_end_date = doc.fyEndDate!;
                if (doc.fyStartDate) { outcome.fy_start_date = doc.fyStartDate; outcome.fy_start_year = Number(doc.fyStartDate.slice(0, 4)); }
                outcome.warnings = parsed.consistencyWarnings;
                const master = masters.get(corp)!;
                if (master.accMt !== null && master.accMt !== Number(doc.fyEndDate!.slice(5, 7))) outcome.warnings.push(`companyClosingMonth:${master.accMt}!=${doc.fyEndDate!.slice(5, 7)} (현재 기업개황과 과거 결산월 차이)`);
                outcome.rows = Object.fromEntries(Object.entries(parsed.tables).map(([t, r]) => [t, r.length]));
                if (parsed.hardFailures.length) { outcome.status = 'held'; outcome.reason = parsed.hardFailures.join(';'); }
                else {
                    const payload = annualPayload(parsed, master.firmId, f);
                    outcome.payload_hash = payload.payloadHash;
                    if (options.dryRun) outcome.status = 'validated';
                    else {
                        let unchanged = false;
                        if (options.resume) {
                            const { data, error } = await db.from('firm_annual_collection').select('payload_hash,parser_version,source_rcept_no').eq('firm_id', master.firmId).eq('bsns_year', year).maybeSingle();
                            if (error) throw new Error(`resumeRead:${error.code}`);
                            unchanged = data?.payload_hash === payload.payloadHash && data?.parser_version === ANNUAL_PARSER_VERSION && data?.source_rcept_no === f.rcept_no;
                        }
                        if (!unchanged) {
                            const { error } = await db.rpc('replace_firm_annual_report', { p_firm_id: master.firmId, p_year: year, p_payload: payload });
                            // DB 상세 오류에는 개인 행이 들어갈 수 있으므로 원문 error.message를 보고서에 쓰지 않는다.
                            if (error) throw new Error(`annualWrite:${error.code}`);
                        }
                        outcome.status = 'loaded';
                    }
                }
            }
        } catch (error) {
            outcome.reason = error instanceof Error ? error.message : 'collectionError';
            if (outcome.reason.startsWith('지원하지 않는 서식 버전')) outcome.status = 'held';
        }
        report.outcomes.push(outcome); await checkpoint(); options.onProgress?.(index + 1, corps.length);
    }
    return report;
}
