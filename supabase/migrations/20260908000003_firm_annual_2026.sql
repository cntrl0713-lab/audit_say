-- 사용자 승인: 2026 결산분 추가. 기존 RPC 권한/원자성 유지.
begin;
create or replace function public.replace_firm_annual_report(p_firm_id bigint, p_year smallint, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
 t text; rows jsonb; cols text; updates text; existing public.firm_annual_collection;
 allowed text[] := array['firm_profile_yearly','firm_workforce_yearly','firm_personnel_cost_yearly','firm_income_statement_line','firm_audit_record_yearly','firm_audit_client','firm_cpa_tenure_yearly','firm_audit_input_yearly','firm_quality_staff','firm_inspection_result','firm_director_discipline','firm_certification_yearly','firm_director_profile_yearly','firm_director','firm_director_pay','firm_annual_form_cell'];
begin
 if p_year not in (2024,2025,2026) then raise exception 'Unsupported fiscal year'; end if;
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
notify pgrst,'reload schema';
commit;
