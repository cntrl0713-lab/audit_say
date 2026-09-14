-- Restore two optional private metadata fields from the immutable, content-bound
-- source document. Normalized rows, source documents and public DTOs stay intact.
begin;

create function public.cpa_get_question_version_with_source_metadata(p_version_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $body$
declare
 v record; r record; item record; q record; c record; f record;
 result jsonb; source_set jsonb; candidate jsonb; normalized_source jsonb;
 previous_source jsonb; source_q jsonb; source_c jsonb; source_f jsonb; source_ref jsonb;
 source_document jsonb; matches int; source_position bigint; document_count int:=0; candidate_hash text;
 target_path text[]; value jsonb; source_common jsonb; stored_common jsonb;
begin
 result:=public.cpa_get_question_version_document(p_version_id);
 if result is null then return null; end if;
 select s.set_id,s.content_hash,s.applicability,s.sealed_at into strict v
 from public.cpa_question_set_versions s where s.id=p_version_id;

 -- Do not select the newest release. Every document attached to this exact
 -- version must be valid and agree, including retained historical releases.
 for r in
  select ri.set_id,ri.position,rr.source_document,rr.source_file_hash,rr.status,rr.published_at
  from public.cpa_question_bank_release_items ri
  join public.cpa_question_bank_releases rr on rr.id=ri.release_id
  where ri.set_version_id=p_version_id and rr.source_document is not null
 loop
  if r.set_id is distinct from v.set_id or v.sealed_at is null
   or r.status not in ('active','retired') or r.published_at is null then
   raise exception 'Private source metadata requires an exact sealed release/version binding';
  end if;
  if encode(sha256(convert_to(r.source_document,'UTF8')),'hex') is distinct from r.source_file_hash then
   raise exception 'Private source metadata source file hash mismatch';
  end if;
  source_document:=r.source_document::jsonb;
  if jsonb_typeof(source_document) is distinct from 'array' then
   raise exception 'Private source metadata source document must be an array';
  end if;
  select count(*)::int,jsonb_agg(s.value)->0,min(s.ordinality) into matches,candidate,source_position
  from jsonb_array_elements(source_document) with ordinality s(value,ordinality) where s.value->>'id'=v.set_id;
  if matches<>1 then raise exception 'Private source metadata needs exactly one source set ID'; end if;
  if source_position is distinct from r.position::bigint then
   raise exception 'Private source metadata release item position mismatch';
  end if;
  normalized_source:=jsonb_set(candidate-'status','{verification}',(candidate->'verification')-'review_status');
  candidate_hash:=encode(sha256(convert_to(jsonb_build_object('question_set',normalized_source,
   'applicability',v.applicability)::text,'UTF8')),'hex');
  if candidate_hash is distinct from v.content_hash then
   raise exception 'Private source metadata version content hash mismatch';
  end if;
  if document_count>0 and normalized_source is distinct from previous_source then
   raise exception 'Private source metadata is ambiguous across releases';
  end if;
  previous_source:=normalized_source;
  source_set:=candidate;
  document_count:=document_count+1;
 end loop;
 -- Truly document-less legacy versions keep their historical normalized DTO.
 -- A present but broken document never takes this fallback.
 if document_count=0 then return result; end if;

 -- The source hash binds the archived document to the version. It does not by
 -- itself prove that reconstructed ordinary fields still match normalized rows.
 -- Check those fields without replacing them, allowing only lifecycle labels
 -- and the private DTO's documented optional-null/default normalization.
 source_common:=jsonb_strip_nulls(jsonb_set(source_set-'source_refs'-'subquestions'-'status',
  '{verification}',(source_set->'verification')-'review_status'));
 stored_common:=jsonb_strip_nulls(jsonb_set(result-'source_refs'-'subquestions'-'status',
  '{verification}',(result->'verification')-'review_status'));
 if source_common is distinct from stored_common then
  raise exception 'Private source metadata ordinary set fields mismatch';
 end if;

 if jsonb_typeof(source_set->'source_refs') is distinct from 'array'
  or jsonb_typeof(source_set->'subquestions') is distinct from 'array' then
  raise exception 'Private source metadata source arrays are invalid';
 end if;
 if jsonb_array_length(source_set->'source_refs')<>jsonb_array_length(result->'source_refs')
  or jsonb_array_length(source_set->'subquestions')<>jsonb_array_length(result->'subquestions') then
  raise exception 'Private source metadata source ID coverage mismatch';
 end if;
 for item in select a.value,a.ordinality from jsonb_array_elements(result->'source_refs') with ordinality a loop
  select count(*)::int,jsonb_agg(s.value)->0 into matches,source_ref
  from jsonb_array_elements(source_set->'source_refs') s(value) where s.value->>'id'=item.value->>'id';
  if matches<>1 then raise exception 'Private source metadata source reference ID mismatch'; end if;
  if jsonb_strip_nulls(source_ref-'source_span') is distinct from jsonb_strip_nulls(item.value-'source_span') then
   raise exception 'Private source metadata ordinary source reference fields mismatch';
  end if;
  value:=source_ref->'source_span';
  if value is not null and value<>'null'::jsonb then
   if jsonb_typeof(value)<>'string' then raise exception 'Private source_span must be a string'; end if;
   if item.value ? 'source_span' and item.value->'source_span' is distinct from value then
    raise exception 'Private source_span would overwrite normalized metadata';
   end if;
   result:=jsonb_set(result,array['source_refs',(item.ordinality-1)::text,'source_span'],value);
  end if;
 end loop;

 for q in select a.value,a.ordinality from jsonb_array_elements(result->'subquestions') with ordinality a loop
  select count(*)::int,jsonb_agg(s.value)->0 into matches,source_q
  from jsonb_array_elements(source_set->'subquestions') s(value) where s.value->>'id'=q.value->>'id';
  if matches<>1 then raise exception 'Private source metadata subquestion ID mismatch'; end if;
  source_common:=jsonb_strip_nulls(source_q-'criteria');
  source_common:=jsonb_set(source_common,'{answer_slots}',coalesce(source_common->'answer_slots','[]'::jsonb));
  if source_common is distinct from jsonb_strip_nulls(q.value-'criteria') then
   raise exception 'Private source metadata ordinary subquestion fields mismatch';
  end if;
  if jsonb_typeof(source_q->'criteria') is distinct from 'array'
   or jsonb_array_length(source_q->'criteria')<>jsonb_array_length(q.value->'criteria') then
   raise exception 'Private source metadata criterion ID coverage mismatch';
  end if;
  for c in select a.value,a.ordinality from jsonb_array_elements(q.value->'criteria') with ordinality a loop
   select count(*)::int,jsonb_agg(s.value)->0 into matches,source_c
   from jsonb_array_elements(source_q->'criteria') s(value) where s.value->>'id'=c.value->>'id';
   if matches<>1 then raise exception 'Private source metadata criterion ID mismatch'; end if;
   if jsonb_strip_nulls(source_c-'critical_facts') is distinct from jsonb_strip_nulls(c.value-'critical_facts') then
    raise exception 'Private source metadata ordinary criterion fields mismatch';
   end if;
   if jsonb_typeof(source_c->'critical_facts') is distinct from 'array'
    or jsonb_array_length(source_c->'critical_facts')<>jsonb_array_length(c.value->'critical_facts') then
    raise exception 'Private source metadata fact ID coverage mismatch';
   end if;
   for f in select a.value,a.ordinality from jsonb_array_elements(c.value->'critical_facts') with ordinality a loop
    select count(*)::int,jsonb_agg(s.value)->0 into matches,source_f
    from jsonb_array_elements(source_c->'critical_facts') s(value) where s.value->>'id'=f.value->>'id';
    if matches<>1 then raise exception 'Private source metadata fact ID mismatch'; end if;
    if jsonb_strip_nulls(source_f-'scope') is distinct from jsonb_strip_nulls(f.value-'scope') then
     raise exception 'Private source metadata ordinary fact fields mismatch';
    end if;
    value:=source_f->'scope';
    if value is not null and value<>'null'::jsonb then
     if jsonb_typeof(value)<>'string' then raise exception 'Private fact scope must be a string'; end if;
     if f.value ? 'scope' and f.value->'scope' is distinct from value then
      raise exception 'Private scope would overwrite normalized metadata';
     end if;
     target_path:=array['subquestions',(q.ordinality-1)::text,'criteria',(c.ordinality-1)::text,
      'critical_facts',(f.ordinality-1)::text,'scope'];
     result:=jsonb_set(result,target_path,value);
    end if;
   end loop;
  end loop;
 end loop;
 return result;
end
$body$;

create or replace function public.cpa_get_question_version(p_version_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $body$
 select public.cpa_restore_v3_null_policy(public.cpa_get_question_version_with_source_metadata(p_version_id))
$body$;

revoke all on function public.cpa_get_question_version_with_source_metadata(uuid),public.cpa_get_question_version(uuid)
 from public,anon,authenticated;
grant execute on function public.cpa_get_question_version_with_source_metadata(uuid),public.cpa_get_question_version(uuid)
 to service_role;

commit;
