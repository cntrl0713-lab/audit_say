-- 실적 기준연도: 보고기간 시작연도. 기존 명세 키와 원문 수치는 보존.
begin;
create or replace view public.v_firm_annual_summary with (security_invoker=true) as
select p.firm_id,p.bsns_year,p.fy_start_date,p.fy_end_date,p.fy_seq,p.source_rcept_no,p.source_rcept_dt,
 p.revenue_total,p.revenue_audit,p.revenue_tax,p.revenue_advisory,p.revenue_other,p.operating_income,p.net_income,
 w.employee_total,w.employee_audit,w.employee_tax,w.employee_advisory,w.employee_other,w.director_count,w.salary_total,w.director_pay_total,w.director_pay_count,
 p.revenue_total/nullif(w.employee_total,0) as revenue_per_employee,
 w.salary_total/nullif(w.employee_total,0) as salary_per_employee,
 w.employee_total::numeric/nullif(w.director_count,0) as employee_per_director,
 p.revenue_audit/nullif(p.revenue_total,0) as audit_revenue_ratio,
 c.consistency_warnings, extract(year from p.fy_start_date)::smallint as fy_start_year
from public.firm_profile_yearly p
join public.firm_workforce_yearly w on w.firm_id=p.firm_id and w.bsns_year=p.bsns_year and w.fy_end_date=p.fy_end_date
join public.firm_annual_collection c on c.firm_id=p.firm_id and c.bsns_year=p.bsns_year;
comment on view public.v_firm_annual_summary is '회계법인 자체 실적은 fy_start_year(보고기간 시작연도) 기준. 동일 연도의 복수 기간은 합산하지 않음. bsns_year는 기존 명세 조인용 결산말 키.';
notify pgrst,'reload schema';
commit;
