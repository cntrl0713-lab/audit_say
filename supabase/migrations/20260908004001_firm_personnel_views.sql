-- 회계법인 인력 구성(공인회계사 근속·입퇴사)과 부문별 인건비를 보고기간에 붙여 노출한다.
-- 두 원천 테이블은 결산말 연도(bsns_year)만 갖고 있어 같은 해에 시작한 복수 보고기간을
-- 구분하지 못한다. 접수번호로 조인해 보고기간을 확정한다.
-- 접두어 전환 이후의 작업이므로 호환 뷰가 아니라 cpa_firm_* 물리 테이블을 참조한다.
-- 집계 뷰 이름은 기존 규칙대로 v_firm_* 를 유지한다.
begin;
create or replace view public.v_firm_cpa_tenure with (security_invoker=true) as
select t.firm_id,t.bsns_year,p.fy_start_date,p.fy_end_date,p.fy_seq,p.source_rcept_dt,t.source_rcept_no,
 t.segment,t.under_1y,t.y1_3,t.y3_5,t.y5_10,t.y10_15,t.over_15y,t.total,
 t.hires,t.leavers,t.begin_count,t.end_count,
 extract(year from p.fy_start_date)::smallint as fy_start_year
from public.cpa_firm_cpa_tenure_yearly t
join public.cpa_firm_profile_yearly p on p.firm_id=t.firm_id and p.source_rcept_no=t.source_rcept_no;
comment on view public.v_firm_cpa_tenure is
 '공인회계사 근속 분포와 입·퇴사. 모집단은 공인회계사이며 v_firm_annual_summary.employee_total(전 임직원)과 다르다. 입퇴사·기초기말은 total 세그먼트에만 있다.';

create or replace view public.v_firm_personnel_cost with (security_invoker=true) as
select c.firm_id,c.bsns_year,p.fy_start_date,p.fy_end_date,p.fy_seq,p.source_rcept_dt,c.source_rcept_no,
 c.concept,c.segment,c.amount,c.headcount,c.source_table,c.match_method,
 extract(year from p.fy_start_date)::smallint as fy_start_year
from public.cpa_firm_personnel_cost_yearly c
join public.cpa_firm_profile_yearly p on p.firm_id=c.firm_id and p.source_rcept_no=c.source_rcept_no;
comment on view public.v_firm_personnel_cost is
 '부문별 인건비와 관련 비용. headcount는 전 임직원 기준이라 공인회계사 근속표의 인원과 모집단이 다르다. match_method가 account_code/account_label인 행은 공시 표가 아니라 손익계산서 계정에서 유도한 값이다.';
notify pgrst,'reload schema';
commit;
