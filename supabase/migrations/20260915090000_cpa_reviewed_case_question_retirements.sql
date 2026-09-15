-- Extend reviewed retirement to completely classified case-question sets.
-- Only the style guard of cpa_assert_reviewed_question_retirements changes. The
-- *_with_retirements importers call this function by name, and the original import
-- RPCs, private-source getters, historical releases, versions and attempts stay intact.
begin;

create or replace function public.cpa_assert_reviewed_question_retirements(p_payload jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare
 envelope jsonb; manifest jsonb; document text; active_release record;
 approved text[]; missing text[]; actual_classifications jsonb; retired_id text;
begin
 -- Same transaction lock as the importer: compare-and-swap cannot race another
 -- import between checking the original active release and replacing its pointer.
 perform pg_advisory_xact_lock(7261202609080502);
 envelope:=p_payload->'retirement';
 if jsonb_typeof(envelope) is distinct from 'object'
  or jsonb_typeof(envelope->'manifest_document') is distinct from 'string'
  or coalesce(envelope->>'manifest_sha256','') !~ '^[a-f0-9]{64}$'
  then raise exception 'Exact retirement manifest document and SHA256 required'; end if;
 document:=envelope->>'manifest_document';
 if encode(sha256(convert_to(document,'UTF8')),'hex') is distinct from envelope->>'manifest_sha256'
  then raise exception 'Retirement manifest SHA256 mismatch'; end if;
 manifest:=document::jsonb;
 if manifest->>'version' is distinct from '1'
  or manifest->>'artifact_type' is distinct from 'question_bank_retirement_manifest'
  or jsonb_typeof(manifest->'authorization') is distinct from 'string'
  or btrim(manifest->>'authorization')=''
  or manifest->>'historical_versions_and_learning_attempts' is distinct from 'preserve'
  or coalesce(manifest->>'expected_active_source_file_hash','') !~ '^[a-f0-9]{64}$'
  or coalesce(manifest->>'candidate_source_file_hash','') !~ '^[a-f0-9]{64}$'
  or manifest->>'candidate_source_file_hash' is distinct from p_payload->>'source_file_hash'
  or jsonb_typeof(p_payload->'source_document') is distinct from 'string'
  then raise exception 'Invalid or unbound retirement authorization'; end if;
 select r.id,r.source_file_hash into active_release from public.cpa_question_bank_releases r where r.status='active';
 if not found or active_release.id::text is distinct from manifest->>'expected_active_release_id'
  or active_release.source_file_hash is distinct from manifest->>'expected_active_source_file_hash'
  then raise exception 'Active question release changed; retirement compare-and-swap refused'; end if;
 if jsonb_typeof(manifest->'retired_set_ids') is distinct from 'array'
  or jsonb_array_length(manifest->'retired_set_ids')=0
  or exists(select 1 from jsonb_array_elements(manifest->'retired_set_ids') j where jsonb_typeof(j)<>'string' or btrim(j#>>'{}')='')
  then raise exception 'Nonempty exact retired set IDs required'; end if;
 select array_agg(j order by j) into approved from jsonb_array_elements_text(manifest->'retired_set_ids') j;
 if cardinality(approved)<>(select count(distinct j) from unnest(approved) j)
  then raise exception 'Duplicate retired set IDs'; end if;
 if jsonb_typeof(p_payload->'sets') is distinct from 'array'
  then raise exception 'Retirement target bank required'; end if;
 select coalesce(array_agg(i.set_id order by i.set_id),array[]::text[]) into missing
 from public.cpa_question_bank_release_items i where i.release_id=active_release.id
 and not exists(select 1 from jsonb_array_elements(p_payload->'sets') s where s->>'id'=i.set_id);
 if missing is distinct from approved then raise exception 'Retired set IDs must exactly equal omitted active sets'; end if;
 actual_classifications:=public.cpa_get_learning_classifications(active_release.id);
 foreach retired_id in array approved loop
  -- A standard row has no case set; a case row belongs to the retired set itself.
  if not exists(select 1 from jsonb_array_elements(actual_classifications) c where c->>'source_set_id'=retired_id)
   or exists(select 1 from jsonb_array_elements(actual_classifications) c where c->>'source_set_id'=retired_id
      and not ((c->>'question_style'='standard' and c->>'case_set_id' is null)
            or (c->>'question_style'='case' and c->>'case_set_id'=retired_id)))
   or (select count(*) from jsonb_array_elements(actual_classifications) c where c->>'source_set_id'=retired_id)
      <>(select count(*) from public.cpa_question_bank_release_items i join public.cpa_subquestion_versions q on q.set_version_id=i.set_version_id where i.release_id=active_release.id and i.set_id=retired_id)
   then raise exception 'Only completely classified standard or case sets may use reviewed retirement'; end if;
 end loop;
end $body$;

revoke all on function public.cpa_assert_reviewed_question_retirements(jsonb) from public,anon,authenticated;
grant execute on function public.cpa_assert_reviewed_question_retirements(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
