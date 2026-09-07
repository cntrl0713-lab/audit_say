import 'server-only';
import { assertAdmin } from '../supabaseServer';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { annualPeriodsForYear, isAnnualStartYear, isAnnualYear } from './annualYears';
import type { FirmAnnualSummary } from './types';

/** year는 기존 명세 조인용 결산말 키다. 화면의 시작연도는 getFirmDirectorReport에서 변환한다. */
export async function getFirmDirectorDetails(firmId: number, year: number, page = 1) {
    await assertAdmin();
    if (!Number.isSafeInteger(firmId) || firmId < 1 || !isAnnualYear(year) || !Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('Invalid parameters');
    const db = getSupabaseAdmin();
    const size = 100;
    const [directors, pay] = await Promise.all([
        db.from('firm_director').select('seq_no,name,position,duty,segment,tenure_months,practice_months,invest_rate,source_rcept_no', { count: 'exact' }).eq('firm_id', firmId).eq('bsns_year', year).order('seq_no').range((page - 1) * size, page * size - 1),
        db.from('firm_director_pay').select('seq_no,name,position,employer,pay_kind,amount,masked,source_rcept_no', { count: 'exact' }).eq('firm_id', firmId).eq('bsns_year', year).order('seq_no').range((page - 1) * size, page * size - 1),
    ]);
    if (directors.error || pay.error) throw new Error('개인 명세 조회 실패');
    return { directors: directors.data, directorCount: directors.count, pay: pay.data, payCount: pay.count, page, pageSize: size };
}

/** 시작연도 아래 여러 기수가 있으면 각 기간을 보존하고 선택한 기수의 명세만 조회한다. */
export async function getFirmDirectorReport(firmId: number, startYear: number, page = 1, endDate?: string, legacyEndYear = 0) {
    await assertAdmin();
    if (!Number.isSafeInteger(firmId) || firmId < 1 || (startYear !== 0 && !isAnnualStartYear(startYear)) || !Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('Invalid parameters');
    const { data, error } = await getSupabaseAdmin().from('v_firm_annual_summary').select('*').eq('firm_id', firmId).order('fy_end_date', { ascending: false });
    if (error) throw new Error('보고기간 조회 실패');
    const { year, periods } = annualPeriodsForYear((data ?? []) as FirmAnnualSummary[], startYear, legacyEndYear);
    const requestedEnd = endDate ?? (startYear === 0 && legacyEndYear ? periods.find(p => p.bsns_year === legacyEndYear)?.fy_end_date : undefined);
    const period = requestedEnd ? periods.find(p => p.fy_end_date === requestedEnd) : periods[0];
    if (endDate && !period) throw new Error('Invalid parameters');
    const details = period ? await getFirmDirectorDetails(firmId, period.bsns_year, page)
        : { directors: [], directorCount: 0, pay: [], payCount: 0, page, pageSize: 100 };
    return { ...details, basisYear: year, periods, period: period ?? null };
}
