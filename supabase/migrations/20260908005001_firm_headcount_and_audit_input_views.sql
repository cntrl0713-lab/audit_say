-- 공개 집계만 노출하며 접수번호로 원문과 보고기간을 연결한다.
begin;
create or replace view public.v_firm_headcount with (security_invoker=true) as
select f.firm_id,f.bsns_year,p.fy_start_date,p.fy_end_date,p.fy_seq,
 p.source_rcept_dt,f.source_rcept_no,f.code,f.occurrence,f.raw_text,f.numeric_value,f.unit_multiplier,
 extract(year from p.fy_start_date)::smallint as fy_start_year
from public.cpa_firm_annual_form_cell f
join public.cpa_firm_profile_yearly p on p.firm_id=f.firm_id and p.source_rcept_no=f.source_rcept_no
where f.source_table='TG_HR_TOT'
 and f.code in ('HR_CPA_ALL','HR_R_ALL','HR_P_ALL','HR_E_ALL','HR_W_ALL');
comment on view public.v_firm_headcount is
 'HR_* 인원은 정규화 컬럼이 아니라 공개 annual_form_cell의 TG_HR_TOT 행 값에 보존되어 있다. 공인회계사/등록회계사/수습/사원(출자자)/기타직원을 구분한다. occurrence 중복과 단위 이상은 표시 계층에서 미확보 처리하며 인원에는 unit_multiplier를 곱하지 않는다.';

create or replace view public.v_firm_audit_input with (security_invoker=true) as
select i.firm_id,i.bsns_year,p.fy_start_date,p.fy_end_date,p.fy_seq,
 p.source_rcept_dt,i.source_rcept_no,i.tenure_band,
 i.mid_headcount,i.mid_hours,i.end_headcount,i.end_hours,i.tot_headcount,i.tot_hours,
 extract(year from p.fy_start_date)::smallint as fy_start_year
from public.cpa_firm_audit_input_yearly i
join public.cpa_firm_profile_yearly p on p.firm_id=i.firm_id and p.source_rcept_no=i.source_rcept_no;
comment on view public.v_firm_audit_input is
 '감사 부문 투입 인력·시간으로 전체 근로시간이 아니다. mid/end/tot는 원문의 구분을 보존하며 근속표와 경력 구간 모집단이 다르다.';
grant select on public.v_firm_headcount,public.v_firm_audit_input to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
