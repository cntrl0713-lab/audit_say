// 회계법인 리서치 플랫폼 도메인 타입.
// 테이블·뷰 정의는 supabase/migrations/20260907*_firm_platform_*.sql 이 정본이고,
// 여기 타입은 그 컬럼을 그대로 옮긴 것이다. 스키마를 고치면 이 파일도 같이 고친다.

export type FirmTier = '가군' | '나군';
export type FirmStatus = 'active' | 'closed';
export type CorpCls = 'Y' | 'K' | 'N' | 'E';
export type AuditOpinion = '적정' | '한정' | '부적정' | '의견거절';
export type FsDiv = 'CFS' | 'OFS';
export type FinancialDataStatus = 'ok' | 'missing' | 'financial_corp' | 'parse_failed';
export type ContractType = 'audit' | 'nonaudit';
export type SubscriptionPlan = 'free' | 'basic' | 'pro';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type EmploymentType = 'current' | 'former';
export type ReviewPosition = 'intern' | 'staff' | 'senior' | 'manager' | 'above';

export interface RegisteredFirm {
    firm_id: number;
    firm_name: string;
    registration_no: string | null;
    tier: FirmTier | null;
    alias: string[];
    status: FirmStatus;
    dart_corp_code: string | null;
}

export interface FirmCompany {
    corp_code: string;
    corp_name: string;
    corp_cls: CorpCls | null;
    stock_code: string | null;
    listed_yn: boolean;
    induty: string | null;
}

/** v_firm_summary — 회계법인 × 사업연도 */
export interface FirmSummaryRow {
    firm_id: number;
    firm_name: string;
    tier: FirmTier | null;
    status: FirmStatus;
    bsns_year: number;
    client_count: number;
    listed_client_count: number;
    unlisted_client_count: number;
    avg_client_revenue: number | null;
    opinion_unqualified_count: number;
    opinion_modified_count: number;
    avg_kam_count: number | null;
    revenue_total: number | null;
    employee_total: number | null;
    director_count: number | null;
    revenue_per_employee: number | null;
    salary_per_employee: number | null;
    employee_per_director: number | null;
    audit_revenue_ratio: number | null;
}

export const MARKET_LABEL: Record<CorpCls, string> = {
    Y: '유가증권',
    K: '코스닥',
    N: '코넥스',
    E: '기타',
};

export const POSITION_LABEL: Record<ReviewPosition, string> = {
    intern: '수습',
    staff: '스탭',
    senior: '시니어',
    manager: '매니저',
    above: '그 이상',
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
    current: '현직',
    former: '전직',
};
