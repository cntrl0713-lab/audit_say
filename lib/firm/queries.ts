import 'server-only';
import { getSupabaseServerClient } from '../supabaseServer';
import type {
    AuditOpinion,
    CompanyAuditHistoryRow,
    CorpCls,
    FirmClientRow,
    FirmCompany,
    FirmKamRow,
    FirmSummaryRow,
    FirmAnnualSummary,
    FirmCpaTenureRow,
    FirmPersonnelCostRow,
    FirmHeadcountRow,
    FirmAuditInputRow,
    RegisteredFirm,
} from './types';

// 공시 도메인은 anon SELECT 가 열려 있으므로(PRD §8) 관리자 클라이언트를 쓰지 않는다.
// 로그인 여부와 무관하게 같은 결과가 나와야 하는 공개 데이터다.

export const PAGE_SIZE = 25;

export async function getFirmAnnualSummaries(firmId: number): Promise<FirmAnnualSummary[]> {
    const db = await getSupabaseServerClient();
    const { data, error } = await db.from('v_firm_annual_summary').select('*').eq('firm_id', firmId).order('fy_end_date', { ascending: false });
    // 마이그레이션 적용 전에는 기존 화면을 유지한다. 권한·네트워크 오류는 숨기지 않는다.
    if (error?.code === 'PGRST205' || error?.code === '42P01') return [];
    fail('회계법인 결산 지표 조회', error);
    return (data ?? []) as FirmAnnualSummary[];
}

/**
 * 공인회계사 근속 분포. 접수번호로 보고기간을 고를 수 있게 전 기간을 준다.
 * 모집단이 공인회계사라 v_firm_annual_summary 의 전 임직원 수와 다르다.
 */
export async function getFirmCpaTenure(firmId: number): Promise<FirmCpaTenureRow[]> {
    const db = await getSupabaseServerClient();
    const { data, error } = await db.from('v_firm_cpa_tenure').select('*').eq('firm_id', firmId);
    if (error?.code === 'PGRST205' || error?.code === '42P01') return [];
    fail('회계법인 근속 분포 조회', error);
    return (data ?? []) as FirmCpaTenureRow[];
}

/** 부문별 인건비와 함께 공시되는 비용. headcount 는 전 임직원 기준이다. */
export async function getFirmPersonnelCost(firmId: number): Promise<FirmPersonnelCostRow[]> {
    const db = await getSupabaseServerClient();
    const { data, error } = await db.from('v_firm_personnel_cost').select('*').eq('firm_id', firmId);
    if (error?.code === 'PGRST205' || error?.code === '42P01') return [];
    fail('회계법인 인건비 조회', error);
    return (data ?? []) as FirmPersonnelCostRow[];
}

export async function getFirmHeadcount(firmId: number): Promise<FirmHeadcountRow[]> {
    const db = await getSupabaseServerClient();
    const { data, error } = await db.from('v_firm_headcount').select('*').eq('firm_id', firmId);
    if (error?.code === 'PGRST205' || error?.code === '42P01') return [];
    fail('회계법인 인원 조회', error);
    return (data ?? []) as FirmHeadcountRow[];
}

export async function getFirmAuditInput(firmId: number): Promise<FirmAuditInputRow[]> {
    const db = await getSupabaseServerClient();
    const { data, error } = await db.from('v_firm_audit_input').select('*').eq('firm_id', firmId);
    if (error?.code === 'PGRST205' || error?.code === '42P01') return [];
    fail('회계법인 감사 투입 조회', error);
    return (data ?? []) as FirmAuditInputRow[];
}

export interface Page<T> {
    rows: T[];
    total: number;
    page: number;
    pageCount: number;
}

function toPage<T>(rows: T[], total: number, page: number): Page<T> {
    return {
        rows,
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
}

function fail(what: string, error: { message: string } | null): void {
    if (error) throw new Error(`${what} 실패: ${error.message}`);
}

/**
 * PostgREST 의 or() 필터는 값에 쉼표·괄호가 들어가면 구문이 깨진다.
 * 검색어는 사용자 입력이라 그대로 넘기면 안 된다.
 */
function sanitizeSearch(raw: string): string {
    return raw.replace(/[,()%\\]/g, ' ').trim().slice(0, 60);
}

// ── 회계법인 마스터 ─────────────────────────────────────────────────────────

export async function listRegisteredFirms(): Promise<RegisteredFirm[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('cpa_firm_registered')
        .select('firm_id, firm_name, registration_no, tier, alias, status, dart_corp_code')
        .eq('status', 'active')
        .order('firm_name');

    fail('등록회계법인 목록 조회', error);
    return data ?? [];
}

export async function getRegisteredFirm(firmId: number): Promise<RegisteredFirm | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('cpa_firm_registered')
        .select('firm_id, firm_name, registration_no, tier, alias, status, dart_corp_code')
        .eq('firm_id', firmId)
        .maybeSingle();

    fail('회계법인 조회', error);
    return data;
}

// ── 연도 축 ────────────────────────────────────────────────────────────────

/**
 * 데이터가 있는 가장 최근 사업연도. 아직 적재 전이면 null 이고,
 * 화면은 "수집 전" 상태로 떨어진다.
 */
export async function getLatestBsnsYear(firmId?: number): Promise<number | null> {
    const supabase = await getSupabaseServerClient();
    let query = supabase
        .from('v_firm_summary')
        .select('bsns_year')
        .order('bsns_year', { ascending: false })
        .limit(1);

    if (firmId !== undefined) query = query.eq('firm_id', firmId);

    const { data, error } = await query.maybeSingle();
    fail('최근 사업연도 조회', error);
    return data?.bsns_year ?? null;
}

/** 데이터가 있는 모든 사업연도 (내림차순). 목록 화면의 연도 선택에 쓴다. */
export async function listAllYears(): Promise<number[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_summary')
        .select('bsns_year')
        .order('bsns_year', { ascending: false });

    fail('사업연도 목록 조회', error);
    // 뷰는 법인×연도라 같은 연도가 여러 번 나온다
    return [...new Set((data ?? []).map((row) => row.bsns_year as number))];
}

export async function listAvailableYears(firmId: number): Promise<number[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_summary')
        .select('bsns_year')
        .eq('firm_id', firmId)
        .order('bsns_year', { ascending: false });

    fail('사업연도 목록 조회', error);
    return (data ?? []).map((row) => row.bsns_year as number);
}

// ── 회계법인 요약 ───────────────────────────────────────────────────────────

export async function listFirmSummaries(year: number): Promise<FirmSummaryRow[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from('v_firm_summary').select('*').eq('bsns_year', year);
    fail('회계법인 요약 조회', error);
    return (data ?? []) as FirmSummaryRow[];
}

export async function getFirmSummaries(firmId: number): Promise<FirmSummaryRow[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_summary')
        .select('*')
        .eq('firm_id', firmId)
        .order('bsns_year', { ascending: false });

    fail('회계법인 연도별 요약 조회', error);
    return (data ?? []) as FirmSummaryRow[];
}

// ── 감사대상회사 포트폴리오 ───────────────────────────────────────────────────────

export interface ClientFilters {
    firmId: number;
    year: number;
    page: number;
    market?: CorpCls;
    opinion?: AuditOpinion;
    /** true=상장만, false=비상장만, undefined=전체 */
    listed?: boolean;
    q?: string;
    sort?: 'revenue' | 'operating_profit' | 'name';
}

export async function listFirmClients(filters: ClientFilters): Promise<Page<FirmClientRow>> {
    const supabase = await getSupabaseServerClient();
    const from = (filters.page - 1) * PAGE_SIZE;

    let query = supabase
        .from('v_firm_clients')
        .select('*', { count: 'exact' })
        .eq('firm_id', filters.firmId)
        .eq('bsns_year', filters.year)
        // 매출 큰 감사대상회사부터. 결측(NULL)은 뒤로 민다.
        .order(filters.sort === 'name' ? 'corp_name' : (filters.sort ?? 'revenue'), { ascending: filters.sort === 'name', nullsFirst: false })
        .order('corp_name')
        .order('engagement_id')
        .range(from, from + PAGE_SIZE - 1);

    if (filters.market) query = query.eq('corp_cls', filters.market);
    if (filters.opinion) query = query.eq('adt_opinion', filters.opinion);
    if (filters.listed !== undefined) query = query.eq('listed_yn', filters.listed);

    const search = filters.q ? sanitizeSearch(filters.q) : '';
    if (search) query = query.ilike('corp_name', `%${search}%`);

    const { data, error, count } = await query;
    // PostgREST returns 416 for an offset beyond the filtered result. Recover its
    // count from page 1 so the page can redirect to the last available page.
    if (error?.code === 'PGRST103' && filters.page > 1) {
        return listFirmClients({ ...filters, page: 1 });
    }
    fail('감사대상회사 목록 조회', error);
    return toPage((data ?? []) as FirmClientRow[], count ?? 0, filters.page);
}

/** 의견 필터 칩에 붙일 건수. 필터를 걸기 전에 몇 건인지 보여 준다. */
export async function countFirmClientsByOpinion(
    firmId: number,
    year: number,
): Promise<Record<string, number>> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_clients')
        .select('adt_opinion')
        .eq('firm_id', firmId)
        .eq('bsns_year', year);

    fail('의견 분포 조회', error);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
        const key = (row.adt_opinion as string | null) ?? '미상';
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}

// ── KAM ────────────────────────────────────────────────────────────────────

export async function listFirmKam(options: {
    firmId: number;
    year: number;
    page: number;
}): Promise<Page<FirmKamRow>> {
    const supabase = await getSupabaseServerClient();
    const from = (options.page - 1) * PAGE_SIZE;

    const { data, error, count } = await supabase
        .from('v_firm_kam')
        .select('*', { count: 'exact' })
        .eq('firm_id', options.firmId)
        .eq('bsns_year', options.year)
        .order('kam_count', { ascending: false, nullsFirst: false })
        .order('corp_name')
        .order('engagement_id')
        .range(from, from + PAGE_SIZE - 1);

    if (error?.code === 'PGRST103' && options.page > 1) {
        return listFirmKam({ ...options, page: 1 });
    }
    fail('KAM 조회', error);
    return toPage((data ?? []) as FirmKamRow[], count ?? 0, options.page);
}

// ── 회사 ───────────────────────────────────────────────────────────────────

export async function getCompany(corpCode: string): Promise<FirmCompany | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('cpa_firm_company')
        .select('corp_code, corp_name, corp_cls, stock_code, listed_yn, induty')
        .eq('corp_code', corpCode)
        .maybeSingle();

    fail('회사 조회', error);
    return data;
}

export async function getCompanyAuditHistory(corpCode: string): Promise<CompanyAuditHistoryRow[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_company_audit_history')
        .select('*')
        .eq('corp_code', corpCode)
        .order('bsns_year', { ascending: false });

    fail('감사 이력 조회', error);
    return (data ?? []) as CompanyAuditHistoryRow[];
}

/** 회사의 연도별 재무·용역. v_firm_clients 를 회사 기준으로 뒤집어 쓴다. */
export async function getCompanyEngagements(corpCode: string): Promise<FirmClientRow[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_clients')
        .select('*')
        .eq('corp_code', corpCode)
        .order('bsns_year', { ascending: false });

    fail('회사 감사 계약 조회', error);
    return (data ?? []) as FirmClientRow[];
}

export async function getCompanyKam(corpCode: string): Promise<FirmKamRow[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
        .from('v_firm_kam')
        .select('*')
        .eq('corp_code', corpCode)
        .order('bsns_year', { ascending: false });

    fail('회사 KAM 조회', error);
    return (data ?? []) as FirmKamRow[];
}
