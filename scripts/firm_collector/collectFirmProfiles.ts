import type { SupabaseClient } from '@supabase/supabase-js';
import { DartClient, DartError } from './dartClient.ts';
import type { CorpCodeEntry } from './dartClient.ts';
import {
    aggregateEmployeesBySegment,
    countRegisteredDirectors,
    pickFinancials,
    type EmpRow,
    type ExctvRow,
    type FnlttRow,
} from './normalize.ts';
import {
    backfillFirmCorpCode,
    upsertFirmProfile,
    upsertFirmWorkforce,
} from './store.ts';
import { firmCorpCandidates } from './responseMapping.ts';

/**
 * 회계법인 자체 인력·재무 파이프라인 (PRD §4.2-B, M1).
 *
 * 회계법인 자체 고유번호로 임원·직원·재무 API 제공 여부를 확인한다.
 * 회계법인 사업보고서 제출 사실만으로 일반 사업보고서 API 제공을 가정하지 않는다.
 */

export interface FirmProfileReport {
    year: number;
    processed: number;
    /** corpCode.xml 에서 DART 고유번호를 찾지 못한 법인 */
    corpCodeMissing: string[];
    /** 고유번호는 있으나 세 API 모두 조회 데이터가 없는 법인 (공시 원문 부재와 다름) */
    noReport: string[];
    /** 부문별 인원을 하나도 못 나눈 법인 (직원 현황에 사업부문이 안 왔다) */
    segmentsUnavailable: string[];
    errors: { firm_name: string; message: string }[];
}

export interface CollectFirmProfilesOptions {
    db: SupabaseClient;
    dart: DartClient;
    year: number;
    /** corpCode.xml 전체 목록. 법인 고유번호를 이름으로 찾는 데 쓴다. */
    corpCodes: CorpCodeEntry[];
    onProgress?: (done: number, total: number) => void;
}

export async function collectFirmProfiles(
    options: CollectFirmProfilesOptions,
): Promise<FirmProfileReport> {
    const { db, dart, year, corpCodes, onProgress } = options;
    const report: FirmProfileReport = {
        year,
        processed: 0,
        corpCodeMissing: [],
        noReport: [],
        segmentsUnavailable: [],
        errors: [],
    };

    const { data: firms, error } = await db
        .from('firm_registered')
        .select('firm_id, firm_name, alias, dart_corp_code')
        .eq('status', 'active');
    if (error) throw new Error(`등록회계법인 조회 실패: ${error.message}`);

    const rows = (firms ?? []) as {
        firm_id: number;
        firm_name: string;
        alias: string[];
        dart_corp_code: string | null;
    }[];

    // 법인명 → firm_id 색인으로 corpCode.xml 을 훑어 고유번호를 찾는다.
    // 회계법인은 DART 에서 "기타법인" 이라 stock_code 가 없고, 이름 말고는 단서가 없다.
    const corpCodeByFirmId = new Map<number, string>();
    for (const firm of rows) {
        const candidates = firmCorpCandidates(firm, corpCodes);
        if (candidates.length === 1) corpCodeByFirmId.set(firm.firm_id, candidates[0]);
    }

    for (const [i, firm] of rows.entries()) {
        try {
            const corpCode = firm.dart_corp_code ?? corpCodeByFirmId.get(firm.firm_id) ?? null;
            if (corpCode === null) {
                report.corpCodeMissing.push(firm.firm_name);
                continue;
            }
            if (firm.dart_corp_code === null) {
                await backfillFirmCorpCode(db, firm.firm_id, corpCode);
            }

            const accounts = (await dart.majorAccounts(corpCode, year)) as FnlttRow[];
            const employees = (await dart.employees(corpCode, year)) as EmpRow[];
            const executives = (await dart.executives(corpCode, year)) as ExctvRow[];

            if (accounts.length === 0 && employees.length === 0 && executives.length === 0) {
                report.noReport.push(firm.firm_name);
                continue;
            }

            const financials = pickFinancials(accounts);
            const workforce = aggregateEmployeesBySegment(employees);

            if (
                workforce.employee_audit === null &&
                workforce.employee_tax === null &&
                workforce.employee_advisory === null
            ) {
                report.segmentsUnavailable.push(firm.firm_name);
            }

            await upsertFirmProfile(db, {
                firm_id: firm.firm_id,
                bsns_year: year,
                revenue_total: financials.revenue,
                // 부문별 매출은 구조화 API 에 없다. 사업보고서 원문 파싱은 P2 몫이라
                // 지금은 비워 둔다 (PRD §4.3, §13-2).
                revenue_audit: null,
                revenue_tax: null,
                revenue_advisory: null,
                operating_income: financials.operating_profit,
                net_income: financials.net_income,
                source_rcept_no: null,
            });

            await upsertFirmWorkforce(db, {
                firm_id: firm.firm_id,
                bsns_year: year,
                director_count: countRegisteredDirectors(executives),
                employee_total: workforce.employee_total,
                employee_audit: workforce.employee_audit,
                employee_tax: workforce.employee_tax,
                employee_advisory: workforce.employee_advisory,
                salary_total: workforce.salary_total,
                salary_avg: workforce.salary_avg,
                source_rcept_no: null,
            });

            report.processed += 1;
        } catch (err) {
            if (err instanceof DartError && ['010', '011', '012', '020', '901'].includes(err.status)) {
                throw err;
            }
            report.errors.push({
                firm_name: firm.firm_name,
                message: err instanceof Error ? err.message : String(err),
            });
        } finally {
            onProgress?.(i + 1, rows.length);
        }
    }

    return report;
}
