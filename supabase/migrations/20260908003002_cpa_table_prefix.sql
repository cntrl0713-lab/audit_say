-- Rename project-owned tables without copying/deleting rows. Existing cpa_* and cta_* stay intact.
-- Old names remain security-invoker views for deployed clients; new code uses physical cpa_* tables.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temporary table cpa_table_rename_map(old_name text primary key, new_name text unique not null) on commit drop;
insert into cpa_table_rename_map values
  ('user_cpa','cpa_users'),
  ('firm_annual_collection','cpa_firm_annual_collection'),
  ('firm_annual_form_cell','cpa_firm_annual_form_cell'),
  ('firm_audit_client','cpa_firm_audit_client'),
  ('firm_audit_input_yearly','cpa_firm_audit_input_yearly'),
  ('firm_audit_opinion','cpa_firm_audit_opinion'),
  ('firm_audit_record_yearly','cpa_firm_audit_record_yearly'),
  ('firm_certification_yearly','cpa_firm_certification_yearly'),
  ('firm_chat_message','cpa_firm_chat_message'),
  ('firm_company','cpa_firm_company'),
  ('firm_cpa_tenure_yearly','cpa_firm_cpa_tenure_yearly'),
  ('firm_director','cpa_firm_director'),
  ('firm_director_discipline','cpa_firm_director_discipline'),
  ('firm_director_pay','cpa_firm_director_pay'),
  ('firm_director_profile_yearly','cpa_firm_director_profile_yearly'),
  ('firm_engagement','cpa_firm_engagement'),
  ('firm_financials','cpa_firm_financials'),
  ('firm_income_statement_line','cpa_firm_income_statement_line'),
  ('firm_inspection_result','cpa_firm_inspection_result'),
  ('firm_personnel_cost_yearly','cpa_firm_personnel_cost_yearly'),
  ('firm_profile_yearly','cpa_firm_profile_yearly'),
  ('firm_quality_staff','cpa_firm_quality_staff'),
  ('firm_registered','cpa_firm_registered'),
  ('firm_review','cpa_firm_review'),
  ('firm_service_contract','cpa_firm_service_contract'),
  ('firm_subscription','cpa_firm_subscription'),
  ('firm_workforce_yearly','cpa_firm_workforce_yearly');
do $migration$
declare
 m record; old_oid oid; new_oid oid; old_kind "char"; new_kind "char";
 a record; grantee_name text;
begin
 for m in select * from cpa_table_rename_map order by old_name loop
  old_oid := to_regclass(format('public.%I',m.old_name));
  new_oid := to_regclass(format('public.%I',m.new_name));
  select relkind into old_kind from pg_class where oid=old_oid;
  select relkind into new_kind from pg_class where oid=new_oid;
  if old_kind in ('r','p') and new_oid is null then
   execute format('alter table public.%I rename to %I',m.old_name,m.new_name);
   new_oid := old_oid;
  elsif new_kind in ('r','p') and (old_oid is null or
    (old_kind='v' and obj_description(old_oid,'pg_class')='CPA table-name compatibility view for public.'||m.new_name)) then
   null; -- repeat application; never rename an unrelated object
  else
   raise exception 'CPA rename conflict or missing table: % -> %',m.old_name,m.new_name;
  end if;
  execute format('create or replace view public.%I with (security_invoker=true) as select * from public.%I',m.old_name,m.new_name);
  execute format('comment on view public.%I is %L',m.old_name,'CPA table-name compatibility view for public.'||m.new_name);
  -- New objects can inherit Supabase default grants. Remove them, then copy only existing DML grants.
  for a in select distinct x.grantee from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
    where c.oid=to_regclass(format('public.%I',m.old_name)) loop
   grantee_name := case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
   execute format('revoke all privileges on public.%I from %s',m.old_name,grantee_name);
  end loop;
  execute format('revoke all privileges on public.%I from public',m.old_name);
  for a in select x.* from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
    where c.oid=new_oid and x.privilege_type in ('SELECT','INSERT','UPDATE','DELETE') loop
   grantee_name := case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end;
   execute format('grant %s on public.%I to %s%s',a.privilege_type,m.old_name,grantee_name,case when a.is_grantable then ' with grant option' else '' end);
  end loop;
 end loop;
end $migration$;

-- SQL strings/dynamic identifiers in PL/pgSQL do not follow a table rename automatically.
-- Preserve the existing RPC name, ACL and legacy payload keys (also used by cached collector runs).
create or replace function public.replace_firm_annual_report(p_firm_id bigint, p_year smallint, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $fn$
declare
 t text; target_table text; rows jsonb; cols text; updates text; existing public.cpa_firm_annual_collection;
 allowed text[] := array['firm_profile_yearly','firm_workforce_yearly','firm_personnel_cost_yearly','firm_income_statement_line','firm_audit_record_yearly','firm_audit_client','firm_cpa_tenure_yearly','firm_audit_input_yearly','firm_quality_staff','firm_inspection_result','firm_director_discipline','firm_certification_yearly','firm_director_profile_yearly','firm_director','firm_director_pay','firm_annual_form_cell'];
begin
 if p_year not in (2024,2025,2026) then raise exception 'Unsupported fiscal year'; end if;
 perform 1 from public.cpa_firm_registered where firm_id=p_firm_id and dart_corp_code=p_payload->>'corpCode' for update;
 if not found then raise exception 'Firm identity mismatch'; end if;
 if extract(year from (p_payload->>'fyEndDate')::date) <> p_year then raise exception 'Fiscal date mismatch'; end if;
 if jsonb_typeof(p_payload->'tables') <> 'object' or (select count(*) from jsonb_object_keys(p_payload->'tables')) <> cardinality(allowed) then raise exception 'Incomplete payload'; end if;
 select * into existing from public.cpa_firm_annual_collection where firm_id=p_firm_id and bsns_year=p_year;
 if found and (existing.fy_end_date <> (p_payload->>'fyEndDate')::date or (existing.source_rcept_dt::text || existing.source_rcept_no) > ((p_payload->>'sourceDate') || (p_payload->>'source'))) then raise exception 'Conflicting period or older receipt'; end if;
 foreach t in array allowed loop
  target_table := 'cpa_' || t;
  rows := p_payload->'tables'->t;
  if rows is null or jsonb_typeof(rows) <> 'array' then raise exception 'Missing table %',t; end if;
  if t in ('firm_profile_yearly','firm_workforce_yearly') and jsonb_array_length(rows) <> 1 then raise exception 'Missing annual aggregate'; end if;
  if exists(select 1 from jsonb_array_elements(rows) r where (r->>'firm_id')::bigint is distinct from p_firm_id or (r->>'bsns_year')::smallint is distinct from p_year or r->>'source_rcept_no' is distinct from p_payload->>'source') then raise exception 'Row identity mismatch'; end if;
  if t not in ('firm_profile_yearly','firm_workforce_yearly') then execute format('delete from public.%I where firm_id=$1 and bsns_year=$2',target_table) using p_firm_id,p_year; end if;
  if jsonb_array_length(rows)=0 then continue; end if;
  select string_agg(format('%I', k),',' order by k), string_agg(format('%I=excluded.%I',k,k),',' order by k)
    into cols,updates from jsonb_object_keys(rows->0) k;
  if exists(select 1 from jsonb_array_elements(rows) r where (select array_agg(k order by k) from jsonb_object_keys(r) k) is distinct from (select array_agg(k order by k) from jsonb_object_keys(rows->0) k)) then raise exception 'Inconsistent row keys %',t; end if;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)%s',target_table,cols,cols,target_table,
    case when t in ('firm_profile_yearly','firm_workforce_yearly') then ' on conflict(firm_id,bsns_year) do update set '||updates||',updated_at=now()' else '' end) using rows;
 end loop;
 insert into public.cpa_firm_annual_collection(firm_id,bsns_year,fy_end_date,source_rcept_no,source_rcept_dt,parser_version,payload_hash,consistency_warnings)
 values(p_firm_id,p_year,(p_payload->>'fyEndDate')::date,p_payload->>'source',(p_payload->>'sourceDate')::date,p_payload->>'parserVersion',p_payload->>'payloadHash',coalesce(p_payload->'warnings','[]'::jsonb))
 on conflict(firm_id,bsns_year) do update set fy_end_date=excluded.fy_end_date,source_rcept_no=excluded.source_rcept_no,source_rcept_dt=excluded.source_rcept_dt,parser_version=excluded.parser_version,payload_hash=excluded.payload_hash,consistency_warnings=excluded.consistency_warnings,collected_at=now();
end $fn$;

notify pgrst,'reload schema';
commit;
