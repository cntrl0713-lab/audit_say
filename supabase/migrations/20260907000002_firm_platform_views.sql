-- audit_say v2 — 조회 뷰 5종 (PRD §7)
--
-- 전부 security_invoker = true 다. 뷰가 호출자 권한으로 실행되므로 기반 테이블의
-- RLS 가 그대로 적용된다 — 뷰를 우회 통로로 만들지 않는다.

begin;

-- ---------------------------------------------------------------------------
-- v_firm_summary — 회계법인 × 사업연도 요약
-- ---------------------------------------------------------------------------
drop view if exists public.v_firm_summary;
create view public.v_firm_summary with (security_invoker = true) as
with firm_years as (
  select firm_id, bsns_year from public.firm_engagement
  union
  select firm_id, bsns_year from public.firm_profile_yearly
  union
  select firm_id, bsns_year from public.firm_workforce_yearly
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
  p.revenue_total,
  p.revenue_audit,
  p.operating_income,
  p.net_income,
  w.director_count,
  w.employee_total,
  w.salary_total,
  w.salary_avg,
  -- 파생 지표 (PRD §4.2-C). 분모가 0/NULL 이면 NULL 이 된다.
  p.revenue_total / nullif(w.employee_total, 0)                as revenue_per_employee,
  coalesce(w.salary_total / nullif(w.employee_total, 0), w.salary_avg) as salary_per_employee,
  w.employee_total::numeric / nullif(w.director_count, 0)      as employee_per_director,
  p.revenue_audit / nullif(p.revenue_total, 0)                 as audit_revenue_ratio
from firm_years y
join public.firm_registered f on f.firm_id = y.firm_id
left join engagement_agg ea
       on ea.firm_id = y.firm_id and ea.bsns_year = y.bsns_year
left join public.firm_profile_yearly p
       on p.firm_id = y.firm_id and p.bsns_year = y.bsns_year
left join public.firm_workforce_yearly w
       on w.firm_id = y.firm_id and w.bsns_year = y.bsns_year;

comment on view public.v_firm_summary is '회계법인 × 사업연도 요약. 연도 축은 engagement/profile/workforce 중 하나라도 있으면 나온다.';

-- ---------------------------------------------------------------------------
-- v_firm_clients — 회계법인별 고객사 상세
-- ---------------------------------------------------------------------------
drop view if exists public.v_firm_clients;
create view public.v_firm_clients with (security_invoker = true) as
select
  e.engagement_id,
  e.firm_id,
  f.firm_name,
  e.bsns_year,
  e.rcept_no,
  c.corp_code,
  c.corp_name,
  c.corp_cls,
  case c.corp_cls
    when 'Y' then '유가증권'
    when 'K' then '코스닥'
    when 'N' then '코넥스'
    when 'E' then '기타'
  end                     as market,
  c.listed_yn,
  c.stock_code,
  c.induty,
  fin.revenue,
  fin.operating_profit,
  fin.net_income,
  fin.fs_div,
  fin.fallback_yn,
  fin.data_status,
  o.adt_opinion,
  o.kam_count,
  sc.audit_fee_total,
  sc.nonaudit_fee_total,
  coalesce(sc.nonaudit_contract_count, 0) as nonaudit_contract_count
from public.firm_engagement e
join public.firm_registered f on f.firm_id   = e.firm_id
join public.firm_company    c on c.corp_code = e.corp_code
left join public.firm_financials    fin on fin.engagement_id = e.engagement_id
left join public.firm_audit_opinion o   on o.engagement_id   = e.engagement_id
left join (
  select
    engagement_id,
    sum(service_fee)  filter (where contract_type = 'audit')    as audit_fee_total,
    sum(service_fee)  filter (where contract_type = 'nonaudit') as nonaudit_fee_total,
    count(*)          filter (where contract_type = 'nonaudit') as nonaudit_contract_count
  from public.firm_service_contract
  group by engagement_id
) sc on sc.engagement_id = e.engagement_id;

-- ---------------------------------------------------------------------------
-- v_firm_kam — 회계법인별 KAM 원문 및 집계
-- ---------------------------------------------------------------------------
drop view if exists public.v_firm_kam;
create view public.v_firm_kam with (security_invoker = true) as
select
  e.engagement_id,
  e.firm_id,
  f.firm_name,
  e.bsns_year,
  c.corp_code,
  c.corp_name,
  c.corp_cls,
  c.induty,
  o.adt_opinion,
  o.kam_count,
  o.kam_text,
  o.emph_matter
from public.firm_audit_opinion o
join public.firm_engagement e on e.engagement_id = o.engagement_id
join public.firm_registered f on f.firm_id       = e.firm_id
join public.firm_company    c on c.corp_code     = e.corp_code
where o.kam_text is not null or o.emph_matter is not null;

-- ---------------------------------------------------------------------------
-- v_firm_company_audit_history — 회사별 감사인 변천 및 의견 변화
--   PRD 의 v_company_audit_history. 뷰 이름은 v_firm_ 접두어로 통일했다.
-- ---------------------------------------------------------------------------
drop view if exists public.v_firm_company_audit_history;
create view public.v_firm_company_audit_history with (security_invoker = true) as
select
  c.corp_code,
  c.corp_name,
  c.corp_cls,
  c.listed_yn,
  c.induty,
  e.bsns_year,
  f.firm_id,
  f.firm_name,
  o.adt_opinion,
  o.kam_count,
  lag(f.firm_name)    over w as prev_firm_name,
  lag(o.adt_opinion)  over w as prev_adt_opinion,
  -- 첫 연도는 비교 대상이 없으므로 true/false 가 아니라 NULL 이다
  case when lag(f.firm_name) over w is null then null
       else f.firm_name is distinct from lag(f.firm_name) over w end   as auditor_changed,
  case when lag(o.adt_opinion) over w is null then null
       else o.adt_opinion is distinct from lag(o.adt_opinion) over w end as opinion_changed
from public.firm_engagement e
join public.firm_company    c on c.corp_code = e.corp_code
join public.firm_registered f on f.firm_id   = e.firm_id
left join public.firm_audit_opinion o on o.engagement_id = e.engagement_id
window w as (partition by c.corp_code order by e.bsns_year);

-- ---------------------------------------------------------------------------
-- v_firm_reviews_summary — 회계법인별 평점 요약
--   숨김 리뷰는 집계에서 제외한다. 최근 후기에 user_id 는 담지 않는다.
-- ---------------------------------------------------------------------------
drop view if exists public.v_firm_reviews_summary;
create view public.v_firm_reviews_summary with (security_invoker = true) as
select
  f.firm_id,
  f.firm_name,
  count(r.review_id)                                     as review_count,
  count(r.review_id) filter (where r.is_verified)        as verified_review_count,
  round(avg(r.score_wlb),      2)                        as avg_score_wlb,
  round(avg(r.score_growth),   2)                        as avg_score_growth,
  round(avg(r.score_pay),      2)                        as avg_score_pay,
  round(avg(r.score_culture),  2)                        as avg_score_culture,
  round(avg(r.score_workload), 2)                        as avg_score_workload,
  round(avg(r.score_overall),  2)                        as avg_score_overall,
  pd.position_distribution,
  rr.recent_reviews
from public.firm_registered f
left join public.firm_review r
       on r.firm_id = f.firm_id and r.is_hidden = false
left join lateral (
  select jsonb_object_agg(s.position, s.cnt) as position_distribution
  from (
    select r2.position, count(*) as cnt
    from public.firm_review r2
    where r2.firm_id = f.firm_id and r2.is_hidden = false
    group by r2.position
  ) s
) pd on true
left join lateral (
  select jsonb_agg(to_jsonb(s) order by s.created_at desc) as recent_reviews
  from (
    select r3.review_id, r3.employment_type, r3.position, r3.join_year, r3.leave_year,
           r3.score_overall, r3.review_text, r3.is_verified, r3.created_at
    from public.firm_review r3
    where r3.firm_id = f.firm_id and r3.is_hidden = false
    order by r3.created_at desc
    limit 5
  ) s
) rr on true
group by f.firm_id, f.firm_name, pd.position_distribution, rr.recent_reviews;

comment on view public.v_firm_reviews_summary is '법인별 평점 요약. recent_reviews 는 최근 5건이며 user_id 를 담지 않는다.';

grant select on
  public.v_firm_summary,
  public.v_firm_clients,
  public.v_firm_kam,
  public.v_firm_company_audit_history,
  public.v_firm_reviews_summary
to anon, authenticated;

commit;
