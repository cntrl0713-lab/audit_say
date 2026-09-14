begin;
do $retirement_preflight$ begin
if encode(sha256(convert_to(pg_get_functiondef('public.cpa_get_question_version(uuid)'::regprocedure),'UTF8')),'hex') <> 'b0ac20592fa6603420a4c9fc129b7af4a15ae2f94a44bf0ab3be2925fa80b2f4' then raise exception 'Protected function changed after retirement preparation'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.cpa_get_question_version_with_source_metadata(uuid)'::regprocedure),'UTF8')),'hex') <> '74697d51accd5f6e9c8cd03e9b0d2ffbd2e3df5467c24e6d1565104ba47e9401' then raise exception 'Protected function changed after retirement preparation'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.cpa_import_learning_question_bank(jsonb)'::regprocedure),'UTF8')),'hex') <> '00ea299c46a0d4c4fd7e8e28f60e3de1dd2c9c5e3341bd2f5187286d73739983' then raise exception 'Protected function changed after retirement preparation'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.cpa_import_question_bank(jsonb)'::regprocedure),'UTF8')),'hex') <> 'a95ae21fe483c2eb3eac9ec8198803028a8e206c468ce50850472bb8e54a6b42' then raise exception 'Protected function changed after retirement preparation'; end if;
if not exists(select 1 from public.cpa_question_bank_releases where status='active' and id='9fde77ff-c4ed-4b4c-b383-8f632d6caf93'::uuid and source_file_hash='0626b0396ae96d1fd0d05cd95afe7335b6a0b7ba28007923504a6c796a206624') then raise exception 'Active release changed before retirement DDL'; end if;
end $retirement_preflight$;
-- Explicit retirement of reviewed standard-question sets. Existing import RPCs,
-- private-source metadata getters, historical releases and attempts stay intact.


create function public.cpa_assert_reviewed_question_retirements(p_payload jsonb)
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
  if not exists(select 1 from jsonb_array_elements(actual_classifications) c where c->>'source_set_id'=retired_id)
   or exists(select 1 from jsonb_array_elements(actual_classifications) c where c->>'source_set_id'=retired_id and c->>'question_style'<>'standard')
   or (select count(*) from jsonb_array_elements(actual_classifications) c where c->>'source_set_id'=retired_id)
      <>(select count(*) from public.cpa_question_bank_release_items i join public.cpa_subquestion_versions q on q.set_version_id=i.set_version_id where i.release_id=active_release.id and i.set_id=retired_id)
   then raise exception 'Only completely classified standard sets may use reviewed retirement'; end if;
 end loop;
end $body$;

-- Clone the installed importer, replacing only its omission guard. Refuse an
-- unexpected definition rather than dropping any validator or metadata wrapper.
do $migration$
declare original text; changed text; old_guard text; lock_line text; new_name text;
begin
 original:=pg_get_functiondef('public.cpa_import_question_bank(jsonb)'::regprocedure);
 if (select prosecdef from pg_proc where oid='public.cpa_import_question_bank(jsonb)'::regprocedure)
  then raise exception 'Expected security-invoker original import'; end if;
 old_guard:=$guard$if exists(select 1 from public.cpa_question_bank_release_items old_item join public.cpa_question_bank_releases old_release on old_release.id=old_item.release_id and old_release.status='active'
  where not exists(select 1 from public.cpa_question_bank_release_items new_item where new_item.release_id=release_id and new_item.set_id=old_item.set_id)) then raise exception 'Whole-bank import cannot omit an active set'; end if;$guard$;
 lock_line:='perform pg_advisory_xact_lock(7261202609080502);';
 if (length(original)-length(replace(original,old_guard,'')))<>length(old_guard)
  or (length(original)-length(replace(original,lock_line,'')))<>length(lock_line)
  then raise exception 'Unexpected original import guard; manual migration review required'; end if;
 changed:=replace(original,'CREATE OR REPLACE FUNCTION public.cpa_import_question_bank(p_payload jsonb)',
  'CREATE FUNCTION public.cpa_import_question_bank_with_retirements(p_payload jsonb)');
 if changed=original then raise exception 'Unexpected import signature'; end if;
 changed:=replace(changed,lock_line,lock_line||E'\n perform public.cpa_assert_reviewed_question_retirements(p_payload);');
 changed:=replace(changed,old_guard,'perform public.cpa_assert_reviewed_question_retirements(p_payload);');
 -- Preserve the exact authorization with the immutable release evidence.
 changed:=replace(changed,'''quote_hash_policy'',''declared values preserved; actual UTF-8 SHA256 stored separately''',
  '''retirement_authorization'',p_payload->''retirement'',''quote_hash_policy'',''declared values preserved; actual UTF-8 SHA256 stored separately''');
 if position('''retirement_authorization'',p_payload->''retirement''' in changed)=0
  then raise exception 'Unexpected import evidence layout'; end if;
 execute changed;
 original:=pg_get_functiondef('public.cpa_import_learning_question_bank(jsonb)'::regprocedure);
 if (select prosecdef from pg_proc where oid='public.cpa_import_learning_question_bank(jsonb)'::regprocedure)
  then raise exception 'Expected security-invoker original learning import'; end if;
 changed:=replace(original,'CREATE OR REPLACE FUNCTION public.cpa_import_learning_question_bank(p_payload jsonb)',
  'CREATE FUNCTION public.cpa_import_learning_question_bank_with_retirements(p_payload jsonb)');
 if changed=original or (length(original)-length(replace(original,'public.cpa_import_question_bank(p_payload)','')))<>length('public.cpa_import_question_bank(p_payload)')
  then raise exception 'Unexpected atomic learning import layout'; end if;
 changed:=replace(changed,'public.cpa_import_question_bank(p_payload)','public.cpa_import_question_bank_with_retirements(p_payload)');
 changed:=replace(changed,'return v_bank||jsonb_build_object(''learning_classification_count'',jsonb_array_length(v_rows));',
  'return v_bank||jsonb_build_object(''learning_classification_count'',jsonb_array_length(v_rows),''retirement_manifest_sha256'',p_payload#>>''{retirement,manifest_sha256}'',''retirement_manifest'',(p_payload#>>''{retirement,manifest_document}'')::jsonb);');
 if position('''retirement_manifest_sha256''' in changed)=0 then raise exception 'Unexpected learning import return layout'; end if;
 execute changed;
end $migration$;

revoke all on function public.cpa_assert_reviewed_question_retirements(jsonb),
 public.cpa_import_question_bank_with_retirements(jsonb),public.cpa_import_learning_question_bank_with_retirements(jsonb)
 from public,anon,authenticated;
grant execute on function public.cpa_assert_reviewed_question_retirements(jsonb),
 public.cpa_import_question_bank_with_retirements(jsonb),public.cpa_import_learning_question_bank_with_retirements(jsonb) to service_role;
notify pgrst,'reload schema';


commit;
