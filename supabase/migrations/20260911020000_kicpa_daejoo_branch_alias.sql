begin;

update public.cpa_firm_registered
set alias = case
  when '대주회계법인 경남지사' = any(alias) then alias
  else array_append(alias, '대주회계법인 경남지사')
end,
updated_at = now()
where firm_name = '대주회계법인';

update public.cpa_kicpa_jobs
set firm_id = (
  select firm_id
  from public.cpa_firm_registered
  where firm_name = '대주회계법인'
)
where company = '대주회계법인 경남지사'
  and firm_id is null;

commit;
