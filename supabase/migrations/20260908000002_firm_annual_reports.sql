-- F004 회계법인 사업보고서. 공개 집계와 관리자 전용 개인 명세 분리.
begin;
alter table public.firm_profile_yearly add column if not exists fy_end_date date, add column if not exists fy_start_date date, add column if not exists fy_seq smallint, add column if not exists source_rcept_dt date;
alter table public.firm_workforce_yearly add column if not exists fy_end_date date, add column if not exists fy_start_date date, add column if not exists fy_seq smallint, add column if not exists source_rcept_dt date;
alter table public.firm_profile_yearly add column if not exists revenue_other numeric;
alter table public.firm_workforce_yearly add column if not exists employee_other integer, add column if not exists director_pay_total numeric, add column if not exists director_pay_count integer;
alter table public.firm_registered add column if not exists acc_mt smallint check (acc_mt between 1 and 12), add column if not exists induty_code text;
create table public.firm_personnel_cost_yearly (
  cost_id      bigint generated always as identity primary key,
  firm_id      bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year    smallint not null,
  concept      text     not null check (concept in
                 ('personnel_total','welfare','travel','training','entertainment','quality_personnel')),
  segment      text not null check (segment in ('audit','tax','advisory','other','total')),
  amount       numeric,                 -- 원 단위로 환산해 저장
  headcount    integer,                 -- personnel_total 의 부문별 인원
  source_table text     not null,       -- 'TG_BSAL' | 'TG_COST' | 'KCIS'
  match_method text     not null check (match_method in ('form_table','account_code','account_label')),
  source_rcept_no text  not null,
  constraint firm_personnel_cost_key unique (firm_id, bsns_year, concept, segment)
);
create table public.firm_income_statement_line (
  line_id       bigint generated always as identity primary key,
  firm_id       bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year     smallint not null,
  ord           integer  not null,   -- 원문 행 순서 = 계정 계층
  account_code  text     not null,   -- 표준계정코드. 비표준은 '99999999999999'
  is_standard   boolean  not null,
  account_label text     not null,   -- 원문 계정명 그대로
  amount        numeric,
  source_rcept_no text   not null,
  constraint firm_is_line_key unique (firm_id, bsns_year, ord)
);
create table public.firm_audit_record_yearly (
  record_id    bigint generated always as identity primary key,
  firm_id      bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year    smallint not null,
  fs_div       text     not null check (fs_div in ('separate','consolidated')),
  market       text     not null check (market in
                 ('kospi','kosdaq','konex','other_reporting','other')),
  client_count integer  check (client_count >= 0),
  opinion_unqualified integer, opinion_qualified  integer,
  opinion_adverse     integer, opinion_disclaimer integer,
  source_rcept_no text not null,
  constraint firm_audit_record_key unique (firm_id, bsns_year, fs_div, market)
);
create table public.firm_audit_client (
  audit_client_id  bigint generated always as identity primary key,
  firm_id          bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year        smallint not null,
  seq_no           integer  not null,
  client_name      text     not null,   -- 원문 그대로
  subsidiary_count integer  check (subsidiary_count >= 0),
  adt_opinion      text     check (adt_opinion in ('적정','한정','부적정','의견거절')),
  adt_opinion_raw  text,
  source_rcept_no  text     not null,
  constraint firm_audit_client_key unique (firm_id, bsns_year, seq_no)
);
create table public.firm_cpa_tenure_yearly (
  tenure_id bigint generated always as identity primary key,
  firm_id   bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year smallint not null,
  segment   text     not null check (segment in ('audit','tax','advisory','other','total')),
  under_1y integer, y1_3 integer, y3_5 integer, y5_10 integer, y10_15 integer, over_15y integer,
  total    integer,
  hires    integer, leavers integer, begin_count integer, end_count integer,
  source_rcept_no text not null,
  constraint firm_cpa_tenure_key unique (firm_id, bsns_year, segment)
);
create table public.firm_audit_input_yearly (
  input_id    bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  tenure_band text     not null check (tenure_band in
                ('trainee','under_1y','y1_3','y3_5','y5_10','y10_15','over_15y','total')),
  mid_headcount integer, mid_hours numeric,
  end_headcount integer, end_hours numeric,
  tot_headcount integer, tot_hours numeric,
  source_rcept_no text not null,
  constraint firm_audit_input_key unique (firm_id, bsns_year, tenure_band)
);
create table public.firm_quality_staff (
  qstaff_id   bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  seq_no      integer  not null,
  dept_name   text,      -- QLT_NM
  duty        text,      -- QLT_WK
  headcount   integer,   -- QLT_CNT
  career_band text, staff_kind text, residency text, dedication text,
  source_rcept_no text not null,
  constraint firm_quality_staff_key unique (firm_id, bsns_year, seq_no)
);
create table public.firm_inspection_result (
  inspection_id   bigint generated always as identity primary key,
  firm_id         bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year       smallint not null,
  kind            text     not null check (kind in ('audit_report','auditor_quality')),
  seq_no          integer  not null,
  action_date     date,     -- 조치일자
  authority       text,     -- ADRV_NM '증권선물위원회'
  target_company  text,     -- ADRV_CP_NM (감사인 감리에는 없다)
  target_fy       text,     -- ADRV_FY '2014년12월말~2019년12월말' 원문 그대로
  qc_element      text,     -- ADQLT: 리더십/윤리/수용유지/인적자원/업무수행/모니터링
  finding_text    text,     -- ADRV_PO 또는 ADQLT_ADV_*
  action_text     text,     -- ADRV_ACP_STEP 또는 ADQLT_PFM_*
  cpa_action_text text,     -- ADRV_CPA_STEP
  source_rcept_no text not null,
  constraint firm_inspection_key unique (firm_id, bsns_year, kind, seq_no)
);
create table public.firm_director_discipline (
  discipline_id   bigint generated always as identity primary key,
  firm_id         bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year       smallint not null,
  seq_no          integer  not null,
  position        text,   -- DCP_PST
  discipline_date date,   -- DCP_DAY
  detail          text,   -- DCP_DTL
  note            text,
  source_rcept_no text not null,
  constraint firm_director_discipline_key unique (firm_id, bsns_year, seq_no)
);
create table public.firm_certification_yearly (
  cert_id   bigint generated always as identity primary key,
  firm_id   bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year smallint not null,
  scope     text     not null check (scope in ('domestic','foreign')),
  cert_name text     not null,   -- 원문 그대로 '세무사(또는 세무대리업무)'
  headcount integer,
  source_rcept_no text not null,
  constraint firm_certification_key unique (firm_id, bsns_year, scope, cert_name)
);
create table public.firm_director_profile_yearly (
  dprofile_id bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  segment     text     not null check (segment in
                ('audit','tax','advisory','other','unclassified','total')),
  director_count       integer,
  tenure_months_avg    numeric, tenure_months_median numeric,
  practice_months_avg  numeric,
  invest_rate_max      numeric, invest_rate_top3     numeric,
  source_rcept_no text not null,
  constraint firm_director_profile_key unique (firm_id, bsns_year, segment)
);
create table public.firm_director (
  director_id bigint generated always as identity primary key,
  firm_id     bigint   not null references public.firm_registered(firm_id) on delete cascade,
  bsns_year   smallint not null,
  seq_no      integer  not null,
  name        text     not null,  -- ED_NM 원문 그대로
  position    text,               -- ED_PST '이사(대표이사)' / '사원'
  duty        text,               -- ED_BSN 원문
  segment     text check (segment in ('audit','tax','advisory','other','unclassified')),
  tenure_months   integer,        -- ED_WK_YM '36년 0개월' → 432
  practice_months integer,        -- ED_OP_YM
  invest_rate     numeric,        -- ED_IVST_RT (%)
  source_rcept_no text not null,
  constraint firm_director_key unique (firm_id, bsns_year, seq_no)
);
create table public.firm_director_pay (
 pay_id bigint generated always as identity primary key,
 firm_id bigint not null references public.firm_registered(firm_id) on delete cascade,
 bsns_year smallint not null, seq_no integer not null,
 source_table text not null check(source_table in ('TG_SAL','NTG_SAL')),
 name text not null, position text, employer text, pay_kind text, amount numeric,
 masked boolean not null, source_rcept_no text not null,
 unique(firm_id,bsns_year,seq_no)
);
create table public.firm_annual_form_cell (
 cell_id bigint generated always as identity primary key,
 firm_id bigint not null references public.firm_registered(firm_id) on delete cascade,
 bsns_year smallint not null, source_table text not null check(source_table in ('TG_RVN_DTL','TG_HR_TOT','TG_HR_CHG','TG_HR_CR','TG_BSAL','TG_COST','TG_ARCD_TOT','TG_ARCD_SA','TG_ARCD_SRA','TG_ARCD_SADO','TG_PUT')),
 code text not null, occurrence integer not null, raw_text text, numeric_value numeric,
 unit_raw text, unit_multiplier numeric, source_rcept_no text not null,
 unique(firm_id,bsns_year,source_table,code,occurrence)
);
create table public.firm_annual_collection (
 firm_id bigint not null references public.firm_registered(firm_id),
 bsns_year smallint not null, fy_end_date date not null, source_rcept_no text not null,
 source_rcept_dt date not null, parser_version text not null, payload_hash text not null,
 consistency_warnings jsonb not null default '[]', collected_at timestamptz not null default now(), primary key(firm_id,bsns_year)
);
alter table public.firm_personnel_cost_yearly enable row level security;
grant select on public.firm_personnel_cost_yearly to anon, authenticated;
grant all on public.firm_personnel_cost_yearly to service_role;
create policy firm_personnel_cost_yearly_public_read on public.firm_personnel_cost_yearly for select to anon, authenticated using (true);
alter table public.firm_income_statement_line enable row level security;
grant select on public.firm_income_statement_line to anon, authenticated;
grant all on public.firm_income_statement_line to service_role;
create policy firm_income_statement_line_public_read on public.firm_income_statement_line for select to anon, authenticated using (true);
alter table public.firm_audit_record_yearly enable row level security;
grant select on public.firm_audit_record_yearly to anon, authenticated;
grant all on public.firm_audit_record_yearly to service_role;
create policy firm_audit_record_yearly_public_read on public.firm_audit_record_yearly for select to anon, authenticated using (true);
alter table public.firm_audit_client enable row level security;
grant select on public.firm_audit_client to anon, authenticated;
grant all on public.firm_audit_client to service_role;
create policy firm_audit_client_public_read on public.firm_audit_client for select to anon, authenticated using (true);
alter table public.firm_cpa_tenure_yearly enable row level security;
grant select on public.firm_cpa_tenure_yearly to anon, authenticated;
grant all on public.firm_cpa_tenure_yearly to service_role;
create policy firm_cpa_tenure_yearly_public_read on public.firm_cpa_tenure_yearly for select to anon, authenticated using (true);
alter table public.firm_audit_input_yearly enable row level security;
grant select on public.firm_audit_input_yearly to anon, authenticated;
grant all on public.firm_audit_input_yearly to service_role;
create policy firm_audit_input_yearly_public_read on public.firm_audit_input_yearly for select to anon, authenticated using (true);
alter table public.firm_quality_staff enable row level security;
grant select on public.firm_quality_staff to anon, authenticated;
grant all on public.firm_quality_staff to service_role;
create policy firm_quality_staff_public_read on public.firm_quality_staff for select to anon, authenticated using (true);
alter table public.firm_inspection_result enable row level security;
grant select on public.firm_inspection_result to anon, authenticated;
grant all on public.firm_inspection_result to service_role;
create policy firm_inspection_result_public_read on public.firm_inspection_result for select to anon, authenticated using (true);
alter table public.firm_director_discipline enable row level security;
grant select on public.firm_director_discipline to anon, authenticated;
grant all on public.firm_director_discipline to service_role;
create policy firm_director_discipline_public_read on public.firm_director_discipline for select to anon, authenticated using (true);
alter table public.firm_certification_yearly enable row level security;
grant select on public.firm_certification_yearly to anon, authenticated;
grant all on public.firm_certification_yearly to service_role;
create policy firm_certification_yearly_public_read on public.firm_certification_yearly for select to anon, authenticated using (true);
alter table public.firm_director_profile_yearly enable row level security;
grant select on public.firm_director_profile_yearly to anon, authenticated;
grant all on public.firm_director_profile_yearly to service_role;
create policy firm_director_profile_yearly_public_read on public.firm_director_profile_yearly for select to anon, authenticated using (true);
alter table public.firm_director enable row level security;
grant select on public.firm_director to anon, authenticated;
grant all on public.firm_director to service_role;
alter table public.firm_director_pay enable row level security;
grant select on public.firm_director_pay to anon, authenticated;
grant all on public.firm_director_pay to service_role;
alter table public.firm_annual_form_cell enable row level security;
grant select on public.firm_annual_form_cell to anon, authenticated;
grant all on public.firm_annual_form_cell to service_role;
create policy firm_annual_form_cell_public_read on public.firm_annual_form_cell for select to anon, authenticated using (true);
alter table public.firm_annual_collection enable row level security;
grant select on public.firm_annual_collection to anon, authenticated;
grant all on public.firm_annual_collection to service_role;
create policy firm_annual_collection_public_read on public.firm_annual_collection for select to anon, authenticated using (true);

-- 법인·결산기 단위로 모든 표를 한 트랜잭션에서 교체. 실패 시 기존 데이터를 유지.
create function public.replace_firm_annual_report(p_firm_id bigint, p_year smallint, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
 t text; rows jsonb; cols text; updates text; existing public.firm_annual_collection;
 allowed text[] := array['firm_profile_yearly','firm_workforce_yearly','firm_personnel_cost_yearly','firm_income_statement_line','firm_audit_record_yearly','firm_audit_client','firm_cpa_tenure_yearly','firm_audit_input_yearly','firm_quality_staff','firm_inspection_result','firm_director_discipline','firm_certification_yearly','firm_director_profile_yearly','firm_director','firm_director_pay','firm_annual_form_cell'];
begin
 if p_year not in (2024,2025) then raise exception 'Unsupported fiscal year'; end if;
 perform 1 from public.firm_registered where firm_id=p_firm_id and dart_corp_code=p_payload->>'corpCode' for update;
 if not found then raise exception 'Firm identity mismatch'; end if;
 if extract(year from (p_payload->>'fyEndDate')::date) <> p_year then raise exception 'Fiscal date mismatch'; end if;
 if jsonb_typeof(p_payload->'tables') <> 'object' or (select count(*) from jsonb_object_keys(p_payload->'tables')) <> cardinality(allowed) then raise exception 'Incomplete payload'; end if;
 select * into existing from public.firm_annual_collection where firm_id=p_firm_id and bsns_year=p_year;
 if found and (existing.fy_end_date <> (p_payload->>'fyEndDate')::date or (existing.source_rcept_dt::text || existing.source_rcept_no) > ((p_payload->>'sourceDate') || (p_payload->>'source'))) then raise exception 'Conflicting period or older receipt'; end if;
 foreach t in array allowed loop
  rows := p_payload->'tables'->t;
  if rows is null or jsonb_typeof(rows) <> 'array' then raise exception 'Missing table %',t; end if;
  if t in ('firm_profile_yearly','firm_workforce_yearly') and jsonb_array_length(rows) <> 1 then raise exception 'Missing annual aggregate'; end if;
  if exists(select 1 from jsonb_array_elements(rows) r where (r->>'firm_id')::bigint is distinct from p_firm_id or (r->>'bsns_year')::smallint is distinct from p_year or r->>'source_rcept_no' is distinct from p_payload->>'source') then raise exception 'Row identity mismatch'; end if;
  if t not in ('firm_profile_yearly','firm_workforce_yearly') then execute format('delete from public.%I where firm_id=$1 and bsns_year=$2',t) using p_firm_id,p_year; end if;
  if jsonb_array_length(rows)=0 then continue; end if;
  select string_agg(format('%I', k),',' order by k), string_agg(format('%I=excluded.%I',k,k),',' order by k)
    into cols,updates from jsonb_object_keys(rows->0) k;
  if exists(select 1 from jsonb_array_elements(rows) r where (select array_agg(k order by k) from jsonb_object_keys(r) k) is distinct from (select array_agg(k order by k) from jsonb_object_keys(rows->0) k)) then raise exception 'Inconsistent row keys %',t; end if;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)%s',t,cols,cols,t,
    case when t in ('firm_profile_yearly','firm_workforce_yearly') then ' on conflict(firm_id,bsns_year) do update set '||updates||',updated_at=now()' else '' end) using rows;
 end loop;
 insert into public.firm_annual_collection(firm_id,bsns_year,fy_end_date,source_rcept_no,source_rcept_dt,parser_version,payload_hash,consistency_warnings)
 values(p_firm_id,p_year,(p_payload->>'fyEndDate')::date,p_payload->>'source',(p_payload->>'sourceDate')::date,p_payload->>'parserVersion',p_payload->>'payloadHash',coalesce(p_payload->'warnings','[]'::jsonb))
 on conflict(firm_id,bsns_year) do update set fy_end_date=excluded.fy_end_date,source_rcept_no=excluded.source_rcept_no,source_rcept_dt=excluded.source_rcept_dt,parser_version=excluded.parser_version,payload_hash=excluded.payload_hash,consistency_warnings=excluded.consistency_warnings,collected_at=now();
end $fn$;
revoke all on function public.replace_firm_annual_report(bigint,smallint,jsonb) from public,anon,authenticated;
grant execute on function public.replace_firm_annual_report(bigint,smallint,jsonb) to service_role;
comment on table public.firm_director_pay is '관리자 전용 이사 보수 명세. 2026-09-08 사용자 지시로 원문 실명 보존. 공개 조회 정책 없음.';
comment on table public.firm_annual_form_cell is '공개 집계 서식키 원문. 개인 명세 표는 CHECK allowlist에서 제외. 숫자값은 원문 단위이며 unit_multiplier로 환산.';
comment on column public.firm_profile_yearly.bsns_year is '회계법인 결산기준일의 연도. 고객사 사업연도와 동일 기간으로 해석하지 않는다.';
create or replace view public.v_firm_summary with (security_invoker = true) as
with firm_years as (
  select distinct firm_id, bsns_year from public.firm_engagement

),
engagement_agg as (
  select
    e.firm_id,
    e.bsns_year,
    count(*)                                              as client_count,
    count(*) filter (where c.listed_yn)                   as listed_client_count,
    count(*) filter (where not c.listed_yn)               as unlisted_client_count,
    -- 금융회사 결측·파싱 실패 행은 평균을 왜곡하므로 정상 행만 센다
    avg(fin.revenue)          filter (where fin.data_status = 'ok') as avg_client_revenue,
    avg(fin.operating_profit) filter (where fin.data_status = 'ok') as avg_client_operating_profit,
    avg(fin.net_income)       filter (where fin.data_status = 'ok') as avg_client_net_income,
    count(*) filter (where o.adt_opinion = '적정')        as opinion_unqualified_count,
    count(*) filter (where o.adt_opinion = '한정')        as opinion_qualified_count,
    count(*) filter (where o.adt_opinion = '부적정')      as opinion_adverse_count,
    count(*) filter (where o.adt_opinion = '의견거절')    as opinion_disclaimer_count,
    count(*) filter (where o.adt_opinion is not null
                       and o.adt_opinion <> '적정')       as opinion_modified_count,
    avg(o.kam_count)                                      as avg_kam_count
  from public.firm_engagement e
  join public.firm_company c on c.corp_code = e.corp_code
  left join public.firm_financials    fin on fin.engagement_id = e.engagement_id
  left join public.firm_audit_opinion o   on o.engagement_id   = e.engagement_id
  group by e.firm_id, e.bsns_year
)
select
  f.firm_id,
  f.firm_name,
  f.tier,
  f.status,
  y.bsns_year,
  coalesce(ea.client_count, 0)           as client_count,
  coalesce(ea.listed_client_count, 0)    as listed_client_count,
  coalesce(ea.unlisted_client_count, 0)  as unlisted_client_count,
  ea.avg_client_revenue,
  ea.avg_client_operating_profit,
  ea.avg_client_net_income,
  coalesce(ea.opinion_unqualified_count, 0) as opinion_unqualified_count,
  coalesce(ea.opinion_qualified_count, 0)   as opinion_qualified_count,
  coalesce(ea.opinion_adverse_count, 0)     as opinion_adverse_count,
  coalesce(ea.opinion_disclaimer_count, 0)  as opinion_disclaimer_count,
  coalesce(ea.opinion_modified_count, 0)    as opinion_modified_count,
  ea.avg_kam_count,
  -- 회계법인 자체 지표
  null::numeric as revenue_total,
  null::numeric as revenue_audit,
  null::numeric as operating_income,
  null::numeric as net_income,
  null::integer as director_count,
  null::integer as employee_total,
  null::numeric as salary_total,
  null::numeric as salary_avg,
  -- 파생 지표 (PRD §4.2-C). 분모가 0/NULL 이면 NULL 이 된다.
  null::numeric as revenue_per_employee,
  null::numeric as salary_per_employee,
  null::numeric as employee_per_director,
  null::numeric as audit_revenue_ratio
from firm_years y
join public.firm_registered f on f.firm_id = y.firm_id
left join engagement_agg ea
       on ea.firm_id = y.firm_id and ea.bsns_year = y.bsns_year;


create view public.v_firm_annual_summary with (security_invoker=true) as
select p.firm_id,p.bsns_year,p.fy_start_date,p.fy_end_date,p.fy_seq,p.source_rcept_no,p.source_rcept_dt,
 p.revenue_total,p.revenue_audit,p.revenue_tax,p.revenue_advisory,p.revenue_other,p.operating_income,p.net_income,
 w.employee_total,w.employee_audit,w.employee_tax,w.employee_advisory,w.employee_other,w.director_count,w.salary_total,w.director_pay_total,w.director_pay_count,
 p.revenue_total/nullif(w.employee_total,0) as revenue_per_employee,
 w.salary_total/nullif(w.employee_total,0) as salary_per_employee,
 w.employee_total::numeric/nullif(w.director_count,0) as employee_per_director,
 p.revenue_audit/nullif(p.revenue_total,0) as audit_revenue_ratio,
 c.consistency_warnings
from public.firm_profile_yearly p
join public.firm_workforce_yearly w on w.firm_id=p.firm_id and w.bsns_year=p.bsns_year and w.fy_end_date=p.fy_end_date
join public.firm_annual_collection c on c.firm_id=p.firm_id and c.bsns_year=p.bsns_year;
grant select on public.v_firm_annual_summary to anon,authenticated,service_role;
comment on view public.v_firm_annual_summary is '회계법인 결산기간별 자체 지표. 고객사 사업연도와 조인하지 않는다.';
comment on view public.v_firm_summary is '고객사 사업연도 기준 포트폴리오. 자체 지표는 v_firm_annual_summary에서 별도 조회.';
notify pgrst,'reload schema';
commit;
