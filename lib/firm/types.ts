// 회계법인 리서치 플랫폼 도메인 타입.
// 테이블·뷰 정의는 supabase/migrations/20260907*_firm_platform_*.sql 이 정본이고,
// 여기 타입은 그 컬럼을 그대로 옮긴 것이다. 스키마를 고치면 이 파일도 같이 고친다.

export type FirmTier = '가군' | '나군' | '다군' | '라군';
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

/** 실적 기준연도는 fy_start_year. bsns_year는 명세 조인용 기존 결산말 연도 키다. 고객사 연도와 독립적이다. */
export interface FirmAnnualSummary {
    firm_id: number; bsns_year: number; fy_start_year: number; fy_start_date: string; fy_end_date: string;
    fy_seq: number | null; source_rcept_no: string; source_rcept_dt: string;
    employee_total: number | null; director_count: number | null;
    revenue_total: number | null; operating_income: number | null;
    salary_total: number | null; revenue_per_employee: number | null;
    salary_per_employee: number | null; audit_revenue_ratio: number | null;
    consistency_warnings: string[];
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
    avg_client_operating_profit: number | null;
    avg_client_net_income: number | null;
    opinion_unqualified_count: number;
    opinion_qualified_count: number;
    opinion_adverse_count: number;
    opinion_disclaimer_count: number;
    opinion_modified_count: number;
    avg_kam_count: number | null;
    revenue_total: number | null;
    revenue_audit: number | null;
    operating_income: number | null;
    net_income: number | null;
    director_count: number | null;
    employee_total: number | null;
    salary_total: number | null;
    salary_avg: number | null;
    revenue_per_employee: number | null;
    salary_per_employee: number | null;
    employee_per_director: number | null;
    audit_revenue_ratio: number | null;
}

/** v_firm_clients — 고객사 상세 */
export interface FirmClientRow {
    engagement_id: number;
    firm_id: number;
    firm_name: string;
    bsns_year: number;
    rcept_no: string | null;
    corp_code: string;
    corp_name: string;
    corp_cls: CorpCls | null;
    market: string | null;
    listed_yn: boolean;
    stock_code: string | null;
    induty: string | null;
    revenue: number | null;
    operating_profit: number | null;
    net_income: number | null;
    fs_div: FsDiv | null;
    fallback_yn: boolean;
    data_status: FinancialDataStatus;
    adt_opinion: AuditOpinion | null;
    kam_count: number | null;
    audit_fee_total: number | null;
    nonaudit_fee_total: number | null;
    nonaudit_contract_count: number;
}

/** v_firm_kam — KAM 원문 */
export interface FirmKamRow {
    engagement_id: number;
    firm_id: number;
    firm_name: string;
    bsns_year: number;
    corp_code: string;
    corp_name: string;
    corp_cls: CorpCls | null;
    induty: string | null;
    adt_opinion: AuditOpinion | null;
    kam_count: number | null;
    kam_text: string | null;
    emph_matter: string | null;
}

/** v_firm_company_audit_history — 회사별 감사인 변천 */
export interface CompanyAuditHistoryRow {
    corp_code: string;
    corp_name: string;
    corp_cls: CorpCls | null;
    listed_yn: boolean;
    induty: string | null;
    bsns_year: number;
    firm_id: number;
    firm_name: string;
    adt_opinion: AuditOpinion | null;
    kam_count: number | null;
    prev_firm_name: string | null;
    prev_adt_opinion: AuditOpinion | null;
    /** 첫 연도는 비교 대상이 없어 null 이다. false 와 구분해서 다뤄야 한다. */
    auditor_changed: boolean | null;
    opinion_changed: boolean | null;
}

/** 사업보고서가 인력·매출을 나누는 부문 축. */
export type FirmSegment = 'total' | 'audit' | 'tax' | 'advisory' | 'other';

/** firm_personnel_cost_yearly.concept — 인건비와 그에 준해 함께 공시되는 비용. */
export type PersonnelCostConcept =
    | 'personnel_total'
    | 'quality_personnel'
    | 'training'
    | 'travel'
    | 'welfare'
    | 'entertainment';

/** 수치를 어디서 얻었는지. 공시 표(form_table)와 손익계산서 유도값은 신뢰도가 다르다. */
export type CostMatchMethod = 'form_table' | 'account_code' | 'account_label';

/** 인력·인건비 행이 공통으로 갖는 보고기간 식별자. */
export interface FirmAnnualPeriodRef {
    firm_id: number;
    /** 결산말 연도. 원문 조인 키이며 표시 기준연도가 아니다. */
    bsns_year: number;
    fy_start_year: number;
    fy_start_date: string;
    fy_end_date: string;
    fy_seq: number | null;
    source_rcept_no: string;
    source_rcept_dt: string;
}

/** v_firm_cpa_tenure — 공인회계사 근속 분포. 모집단이 전 임직원이 아니라 공인회계사다. */
export interface FirmCpaTenureRow extends FirmAnnualPeriodRef {
    segment: FirmSegment;
    under_1y: number | null;
    y1_3: number | null;
    y3_5: number | null;
    y5_10: number | null;
    y10_15: number | null;
    over_15y: number | null;
    total: number | null;
    /** 입·퇴사와 기초·기말은 total 세그먼트에만 공시된다. 부문별 행에서는 null 이다. */
    hires: number | null;
    leavers: number | null;
    begin_count: number | null;
    end_count: number | null;
}

/** v_firm_personnel_cost — 부문별 인건비. headcount 는 전 임직원 기준이다. */
export interface FirmPersonnelCostRow extends FirmAnnualPeriodRef {
    concept: PersonnelCostConcept;
    segment: FirmSegment;
    amount: number | null;
    headcount: number | null;
    source_table: string;
    match_method: CostMatchMethod;
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

export const AUDIT_OPINIONS: AuditOpinion[] = ['적정', '한정', '부적정', '의견거절'];

/** 재무 결측 사유. 화면에서 "-" 옆에 이유를 적어 준다. */
export const DATA_STATUS_LABEL: Record<FinancialDataStatus, string> = {
    ok: '',
    missing: 'API 데이터 미확보',
    financial_corp: '금융사 결측',
    parse_failed: '금액 확인 보류',
};
