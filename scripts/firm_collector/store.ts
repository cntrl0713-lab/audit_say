import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 수집 결과 적재.
 *
 * 전부 service_role 로 쓴다 — firm_* 테이블에는 쓰기 RLS 정책이 없고, 클라이언트
 * 역할로는 INSERT 가 막혀 있다 (docs/회계법인-리서치-플랫폼-스키마-설계-기록.md §2).
 *
 * 모든 쓰기는 자연키 기준 upsert 라 같은 사업연도를 다시 수집해도 행이 늘지 않는다
 * (PRD §11 신뢰성: "동일 사업연도 재수집 시 중복 방지").
 */

export function createStoreClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error(
            'NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. ' +
            '.env.local 을 확인하고 `tsx --env-file=.env.local` 로 실행하세요.',
        );
    }

    return createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function fail(what: string, error: { message: string } | null): void {
    if (error) throw new Error(`${what} 실패: ${error.message}`);
}

export interface FirmRow {
    firm_id: number;
    firm_name: string;
    alias: string[];
}

export async function loadRegisteredFirms(db: SupabaseClient): Promise<FirmRow[]> {
    const { data, error } = await db
        .from('cpa_firm_registered')
        .select('firm_id, firm_name, alias')
        .eq('status', 'active');

    fail('등록회계법인 조회', error);
    return (data ?? []) as FirmRow[];
}

export interface CompanyInput {
    corp_code: string;
    corp_name: string;
    corp_cls: string | null;
    stock_code: string | null;
    listed_yn: boolean;
    induty: string | null;
}

export async function upsertCompany(db: SupabaseClient, company: CompanyInput): Promise<void> {
    const { error } = await db
        .from('cpa_firm_company')
        .upsert({ ...company, updated_at: new Date().toISOString() }, { onConflict: 'corp_code' });
    fail(`회사 적재(${company.corp_code})`, error);
}

/** engagement 를 만들거나 찾아 engagement_id 를 준다. */
export async function upsertEngagement(
    db: SupabaseClient,
    input: { firm_id: number; corp_code: string; bsns_year: number; rcept_no: string | null },
): Promise<number> {
    const { data, error } = await db
        .from('cpa_firm_engagement')
        .upsert(input, { onConflict: 'firm_id,corp_code,bsns_year' })
        .select('engagement_id')
        .single();

    fail(`engagement 적재(${input.corp_code}/${input.bsns_year})`, error);
    return (data as { engagement_id: number }).engagement_id;
}

export interface AuditOpinionInput {
    engagement_id: number;
    adt_opinion: string | null;
    adt_opinion_raw: string | null;
    emph_matter: string | null;
    kam_text: string | null;
    kam_count: number | null;
}

export async function upsertAuditOpinion(db: SupabaseClient, input: AuditOpinionInput): Promise<void> {
    const { error } = await db
        .from('cpa_firm_audit_opinion')
        .upsert(input, { onConflict: 'engagement_id' });
    fail(`감사의견 적재(engagement ${input.engagement_id})`, error);
}

export interface FinancialsInput {
    engagement_id: number;
    revenue: number | null;
    operating_profit: number | null;
    net_income: number | null;
    fs_div: string | null;
    fallback_yn: boolean;
    data_status: string;
}

export async function upsertFinancials(db: SupabaseClient, input: FinancialsInput): Promise<void> {
    const { error } = await db
        .from('cpa_firm_financials')
        .upsert(input, { onConflict: 'engagement_id' });
    fail(`재무 적재(engagement ${input.engagement_id})`, error);
}

export interface ServiceContractInput {
    engagement_id: number;
    contract_type: 'audit' | 'nonaudit';
    contract_date: string | null;
    service_content: string | null;
    service_period: string | null;
    service_fee: number | null;
}

/**
 * 용역 계약은 자연키가 없다 — 같은 날 같은 내용의 계약이 여러 건일 수 있어
 * 무엇으로도 한 행을 특정할 수 없다. 그래서 upsert 대신 engagement 단위로 지우고
 * 다시 넣는다. 재수집이 곧 교체라 중복이 쌓이지 않는다.
 */
export async function replaceServiceContracts(
    db: SupabaseClient,
    engagementId: number,
    contracts: ServiceContractInput[],
): Promise<void> {
    const { error: deleteError } = await db
        .from('cpa_firm_service_contract')
        .delete()
        .eq('engagement_id', engagementId);
    fail(`용역 삭제(engagement ${engagementId})`, deleteError);

    if (contracts.length === 0) return;

    const { error: insertError } = await db.from('cpa_firm_service_contract').insert(contracts);
    fail(`용역 적재(engagement ${engagementId})`, insertError);
}

export interface FirmProfileInput {
    firm_id: number;
    bsns_year: number;
    revenue_total: number | null;
    revenue_audit: number | null;
    revenue_tax: number | null;
    revenue_advisory: number | null;
    operating_income: number | null;
    net_income: number | null;
    source_rcept_no: string | null;
}

export async function upsertFirmProfile(db: SupabaseClient, input: FirmProfileInput): Promise<void> {
    const { error } = await db
        .from('cpa_firm_profile_yearly')
        .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'firm_id,bsns_year' });
    fail(`법인 재무 적재(firm ${input.firm_id}/${input.bsns_year})`, error);
}

export interface FirmWorkforceInput {
    firm_id: number;
    bsns_year: number;
    director_count: number | null;
    employee_total: number | null;
    employee_audit: number | null;
    employee_tax: number | null;
    employee_advisory: number | null;
    salary_total: number | null;
    salary_avg: number | null;
    source_rcept_no: string | null;
}

export async function upsertFirmWorkforce(db: SupabaseClient, input: FirmWorkforceInput): Promise<void> {
    const { error } = await db
        .from('cpa_firm_workforce_yearly')
        .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'firm_id,bsns_year' });
    fail(`법인 인력 적재(firm ${input.firm_id}/${input.bsns_year})`, error);
}

/** 회계법인 마스터의 DART 고유번호 백필. 이름이 정확히 맞는 행만 채운다. */
export async function backfillFirmCorpCode(
    db: SupabaseClient,
    firmId: number,
    corpCode: string,
): Promise<void> {
    const { error } = await db
        .from('cpa_firm_registered')
        .update({ dart_corp_code: corpCode, updated_at: new Date().toISOString() })
        .eq('firm_id', firmId)
        .is('dart_corp_code', null);
    fail(`법인 DART 코드 백필(firm ${firmId})`, error);
}
