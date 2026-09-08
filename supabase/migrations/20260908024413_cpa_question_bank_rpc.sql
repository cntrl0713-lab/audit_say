-- Server-only final-snapshot import and projection. Preserve the selected source
-- document verbatim; storage/relational checks do not constitute a content re-review.
begin;

create function public.cpa_json_text_array(p_value jsonb) returns text[]
language plpgsql immutable security invoker set search_path=pg_catalog,public as $body$
begin
 if jsonb_typeof(p_value) is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_value) v where jsonb_typeof(v)<>'string') then
  raise exception 'Expected an array of strings';
 end if;
 return array(select jsonb_array_elements_text(p_value));
end $body$;

-- Match ECMAScript whitespace removal used by normalizeCriticalFactKey,
-- including BOM/nonbreaking spaces which PostgreSQL POSIX space omits.
create function public.cpa_normalize_fact(p_value text) returns text
language sql immutable strict security invoker set search_path=pg_catalog,public as $body$
 select lower(regexp_replace(translate(p_value,
  chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279),''),'[[:space:]]','','g'))
$body$;

create function public.cpa_get_question_version(p_version_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $body$
 select jsonb_strip_nulls(jsonb_build_object(
  'schema_version',v.schema_version,'id',v.set_id,'type','linked_question_set','status',v.status,'title',v.title,
  'classification',jsonb_build_object('topic_id',v.topic_id,'part',v.part,'chapter',v.chapter,'domain',v.domain,'standards',v.standards,'tags',v.tags),
  'source_refs',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.code,'file',s.file_path,'title',s.title,'page',s.page_label,'source_quote',s.source_quote,'role',s.role,'content_hash',s.declared_quote_hash)) order by s.position),'[]') from public.cpa_question_sources s where s.set_version_id=v.id),
  'shared_context',jsonb_build_object('facts',v.shared_facts),
  'learning_order',(select jsonb_agg(l.code order by q.learning_position) from public.cpa_subquestion_versions q join public.cpa_subquestions l on l.id=q.subquestion_id where q.set_version_id=v.id),
  'subquestions',(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',l.code,'type',q.type,'prompt',q.prompt,
   'constraints',jsonb_build_object('ordered',q.ordered,'max_entries',q.max_entries,'overflow_policy',q.overflow_policy),
   'selection',jsonb_build_object('type',q.selection_type,'n',q.selection_n),
   'decision',case when q.decision_options is not null then jsonb_build_object('options',q.decision_options,'correct',a.decision_correct) end,
   'answer_slots',q.answer_slots,'model_answer',a.model_answer,
   'requirements',(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',r.code,'source_ref_id',s.code,'source_quote',r.source_quote,'source_span',r.source_span)) order by r.position) from public.cpa_requirements r join public.cpa_question_sources s on s.id=r.source_id where r.subquestion_version_id=q.id),
   'criteria',(select jsonb_agg(jsonb_build_object(
    'id',c.code,'requirement_id',r.code,'claim',c.claim,'max_points',c.max_points,
    'scores',jsonb_strip_nulls(jsonb_build_object('met',c.max_points,'partial',c.partial_points,'not_met',0,'contradicted',0)),
    'source_ref_ids',(select jsonb_agg(s.code order by cs.position) from public.cpa_criterion_sources cs join public.cpa_question_sources s on s.id=cs.source_id where cs.criterion_id=c.id),
    'critical_facts',(select coalesce(jsonb_agg(jsonb_build_object('id',f.code,'type',f.type,'expected',f.expected) order by f.position),'[]') from public.cpa_criterion_facts f where f.criterion_id=c.id)
   ) order by c.position) from public.cpa_criteria c join public.cpa_requirements r on r.id=c.requirement_id where c.subquestion_version_id=q.id)
  )) order by q.position) from public.cpa_subquestion_versions q join public.cpa_subquestions l on l.id=q.subquestion_id join public.cpa_subquestion_answers a on a.subquestion_version_id=q.id where q.set_version_id=v.id),
  'verification',jsonb_build_object('source_fidelity',v.source_fidelity,'review_status',v.review_status,'calculation_required',v.calculation_required,'notes',v.verification_notes)
 )) from public.cpa_question_set_versions v where v.id=p_version_id
$body$;

-- jsonb_strip_nulls must not remove required null policy fields in the v3 DTO.
-- Restore these after optional-field cleanup in the private reconstruction.
create function public.cpa_restore_v3_null_policy(p_set jsonb) returns jsonb
language sql immutable strict security invoker set search_path=pg_catalog,public as $body$
 select jsonb_set(p_set,'{subquestions}',(select jsonb_agg(
  jsonb_set(jsonb_set(q,'{constraints,max_entries}',coalesce(q#>'{constraints,max_entries}','null'::jsonb)),'{selection,n}','null') order by ordinal)
  from jsonb_array_elements(p_set->'subquestions') with ordinality a(q,ordinal)))
$body$;
alter function public.cpa_get_question_version(uuid) rename to cpa_get_question_version_document;
create function public.cpa_get_question_version(p_version_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $body$
 select public.cpa_restore_v3_null_policy(public.cpa_get_question_version_document(p_version_id))
$body$;

create function public.cpa_get_public_question_version(p_version_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $body$
 select jsonb_build_object(
  'id',v.set_id,'type','linked_question_set','title',v.title,
  'classification',jsonb_build_object('topic_id',v.topic_id,'part',v.part,'chapter',v.chapter,'domain',v.domain,'standards',v.standards,'tags',v.tags),
  'sources',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.code,
   'title',coalesce(nullif(s.title,''),regexp_replace(regexp_replace(s.file_path,'^.*[/\\]',''),'\.[^.]*$','')),
   'page',s.page_label,'role',s.role)) order by s.position),'[]') from public.cpa_question_sources s where s.set_version_id=v.id),
  'shared_context',jsonb_build_object('facts',v.shared_facts),
  'learning_order',(select jsonb_agg(l.code order by q.learning_position) from public.cpa_subquestion_versions q join public.cpa_subquestions l on l.id=q.subquestion_id where q.set_version_id=v.id),
  'subquestions',(select jsonb_agg(jsonb_build_object(
   'id',l.code,'logical_subquestion_id',l.id,'type',q.type,'prompt',q.prompt,
   'constraints',jsonb_build_object('ordered',q.ordered,'max_entries',q.max_entries,'overflow_policy',q.overflow_policy),
   'selection',jsonb_build_object('type',q.selection_type,'n',null),
   'answer_slots',case when jsonb_array_length(q.answer_slots)>0 then q.answer_slots else jsonb_build_array(jsonb_build_object('id',l.code||'.answer','label','답안','input','textarea')) end,
   'max_points',q.max_points
  ) || case when q.decision_options is not null then jsonb_build_object('decision',jsonb_build_object('options',q.decision_options)) else '{}'::jsonb end
  order by q.position) from public.cpa_subquestion_versions q join public.cpa_subquestions l on l.id=q.subquestion_id where q.set_version_id=v.id),
  'max_points',v.max_points
 ) from public.cpa_question_set_versions v where v.id=p_version_id and v.sealed_at is not null
$body$;

create function public.cpa_get_active_question_bank() returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $body$
 select coalesce(jsonb_agg(jsonb_build_object('release_id',r.id,'set_version_id',i.set_version_id,
  'question_set',public.cpa_get_public_question_version(i.set_version_id)) order by i.position),'[]')
 from public.cpa_question_bank_releases r join public.cpa_question_bank_release_items i on i.release_id=r.id where r.status='active'
$body$;

-- A future service writer must not be able to seal incomplete draft rows just
-- because its individual foreign keys happen to be valid.
create function public.cpa_validate_question_seal() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare sub_count int;
begin
 if new.sealed_at is null or (tg_op='UPDATE' and old.sealed_at is not null) then return new; end if;
 if tg_op='INSERT' then raise exception 'Insert question versions as drafts before sealing'; end if;
 if new.status<>'published' or new.review_status<>'verified'
  or not exists(select 1 from public.cpa_question_review_events e where e.set_version_id=new.id
   and e.event_type='review' and e.to_status='verified' and e.reviewed_content_hash=new.content_hash) then
  raise exception 'Sealing requires verified evidence for this content hash';
 end if;
 select count(*)::int into sub_count from public.cpa_subquestion_versions where set_version_id=new.id;
 if sub_count=0 or not exists(select 1 from public.cpa_question_sources where set_version_id=new.id)
  or (select coalesce(sum(max_points),0) from public.cpa_subquestion_versions where set_version_id=new.id)<>new.max_points
  or (select max(learning_position) from public.cpa_subquestion_versions where set_version_id=new.id)<>sub_count
  or (select max(position) from public.cpa_subquestion_versions where set_version_id=new.id)<>sub_count then
  raise exception 'Sealed set requires complete sources, order and point totals';
 end if;
 if exists(select 1 from public.cpa_subquestion_versions q left join public.cpa_subquestion_answers a on a.subquestion_version_id=q.id
  where q.set_version_id=new.id and (a.subquestion_version_id is null
   or (q.decision_options is null) is distinct from (a.decision_correct is null)
   or (q.decision_options is not null and not(a.decision_correct=any(q.decision_options)))
   or not exists(select 1 from public.cpa_requirements r where r.subquestion_version_id=q.id)
   or (select coalesce(sum(c.max_points),0) from public.cpa_criteria c where c.subquestion_version_id=q.id)<>q.max_points)) then
  raise exception 'Sealed subquestion requires answers, requirements and exact point totals';
 end if;
 if exists(select 1 from public.cpa_criteria c join public.cpa_requirements r on r.id=c.requirement_id
  where c.set_version_id=new.id and not exists(select 1 from public.cpa_criterion_sources cs where cs.criterion_id=c.id and cs.source_id=r.source_id)) then
  raise exception 'Sealed criterion must cite its requirement source';
 end if;
 if exists(select 1 from public.cpa_question_sources s where s.set_version_id=new.id and s.quote_hash is not null
  and s.quote_hash<>encode(sha256(convert_to(s.source_quote,'UTF8')),'hex')) then raise exception 'Sealed source hash mismatch'; end if;
 if exists(select 1 from public.cpa_criterion_facts f where f.set_version_id=new.id and f.normalized_expected<>public.cpa_normalize_fact(f.expected)) then raise exception 'Sealed critical fact normalization mismatch'; end if;
 return new;
end $body$;
create trigger cpa_validate_seal before insert or update of sealed_at on public.cpa_question_set_versions for each row execute function public.cpa_validate_question_seal();

create function public.cpa_import_question_bank(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $body$
#variable_conflict use_variable
declare
 bank jsonb; item record; sq record; source_item record; req_item record; crit_item record; fact_item record; cite_item record;
 s jsonb; q jsonb; c jsonb; version_id uuid; logical_id uuid; sub_version_id uuid; source_id uuid; requirement_id uuid; criterion_id uuid;
 release_id uuid; content_hash text; input_hash text; existing_report jsonb; source_document text; existing_document text; existing_file_hash text; set_points int; sub_points int; revision_no int;
 decision jsonb; facts jsonb; slots jsonb; actor_id uuid; evidence text; order_position int; review_hash text; versions jsonb;
begin
 bank:=p_payload->'sets'; evidence:=p_payload->>'evidence'; actor_id:=nullif(p_payload->>'actor_user_id','')::uuid;
 if jsonb_typeof(bank) is distinct from 'array' or jsonb_array_length(bank)=0 then raise exception 'Nonempty question bank required'; end if;
 if evidence is null or btrim(evidence)='' then raise exception 'Review evidence required'; end if;
 -- Supabase service_role has auth schema USAGE but need not have auth.users
 -- SELECT. The release/review actor FKs validate existence without broadening
 -- access to the authentication table or making this importer SECURITY DEFINER.
 if p_payload->>'source_file_hash' is null or p_payload->>'bank_content_hash' is null or p_payload->>'public_content_hash' is null then raise exception 'Import hashes required'; end if;
 -- Preserve the selected UTF-8 source verbatim. These checks establish file
 -- identity and JSON assembly only; they do not re-review question content.
 if p_payload->'source_document' is not null and p_payload->'source_document'<>'null'::jsonb then
  if jsonb_typeof(p_payload->'source_document') is distinct from 'string' then raise exception 'Source document must be text'; end if;
  source_document:=p_payload->>'source_document';
  if encode(sha256(convert_to(source_document,'UTF8')),'hex') is distinct from p_payload->>'source_file_hash' then raise exception 'Source document file hash mismatch'; end if;
  if source_document::jsonb is distinct from bank then raise exception 'Source document does not match imported sets'; end if;
 end if;
 input_hash:=encode(sha256(convert_to(jsonb_build_object('sets',bank,'applicability',coalesce(p_payload->'applicability','{}'))::text,'UTF8')),'hex');
 -- Serialize all imports, revision allocation and active-pointer replacement.
 perform pg_advisory_xact_lock(7261202609080502);
 select r.id,r.validation_report,r.source_document,r.source_file_hash into release_id,existing_report,existing_document,existing_file_hash from public.cpa_question_bank_releases r where r.bank_content_hash=p_payload->>'bank_content_hash';
 if found then
  if existing_report->>'input_hash' is distinct from input_hash then raise exception 'Import hash reused for different content'; end if;
  if source_document is not null and (existing_document is distinct from source_document or existing_file_hash is distinct from p_payload->>'source_file_hash') then raise exception 'Import content already exists with a different source document'; end if;
  return jsonb_build_object('release_id',release_id,'set_count',jsonb_array_length(bank),'reused',true,'question_versions',
   (select jsonb_agg(jsonb_build_object('set_id',i.set_id,'set_version_id',i.set_version_id) order by i.position) from public.cpa_question_bank_release_items i where i.release_id=release_id));
 end if;
 insert into public.cpa_question_bank_releases(release_no,status,source_file_hash,source_document,bank_content_hash,public_content_hash,validation_report,created_by)
 values((select coalesce(max(release_no),0)+1 from public.cpa_question_bank_releases),'draft',p_payload->>'source_file_hash',source_document,p_payload->>'bank_content_hash',p_payload->>'public_content_hash',jsonb_build_object('input_hash',input_hash,'hash_format','postgres-jsonb-sha256-v1','source_import','selected final snapshot; no content re-review','source_validation',coalesce(p_payload->>'source_validation','source import; no content re-review'),'quote_hash_policy','declared values preserved; actual UTF-8 SHA256 stored separately'),actor_id)
 returning id into release_id;

 for item in select value,ordinality::int as position from jsonb_array_elements(bank) with ordinality loop
  s:=item.value;
  if s->>'schema_version' is distinct from '3.0' or s->>'type' is distinct from 'linked_question_set'
   or s->>'status' is distinct from 'published' or s#>>'{verification,review_status}' is distinct from 'verified'
   or s#>'{verification,calculation_required}' is distinct from 'false'::jsonb then
   raise exception 'Only verified, published, non-calculation v3 content can be imported';
  end if;
  if jsonb_typeof(s->'subquestions') is distinct from 'array' or jsonb_array_length(s->'subquestions') not between 1 and 10
   or jsonb_typeof(s->'source_refs') is distinct from 'array' or jsonb_array_length(s->'source_refs')=0 then raise exception 'Incomplete set'; end if;
  facts:=s#>'{shared_context,facts}';
  if jsonb_typeof(facts) is distinct from 'array' then raise exception 'Invalid shared facts'; end if;
  if exists(select 1 from jsonb_array_elements(facts) f where jsonb_typeof(f)<>'object' or f->>'id' is null or jsonb_typeof(f->'text') is distinct from 'string' or f->'scoreable' is distinct from 'false'::jsonb or f-array['id','text','scoreable']<>'{}'::jsonb) then raise exception 'Shared facts contain nonpublic fields'; end if;
  if exists(select 1 from jsonb_array_elements_text(s#>'{classification,tags}') tag
   join lateral jsonb_array_elements(s->'subquestions') sub on true
   join lateral jsonb_array_elements_text(sub->'model_answer') answer on true
   where public.cpa_normalize_fact(tag)=public.cpa_normalize_fact(answer)) then raise exception 'Model answer leaked in public tags'; end if;
  perform public.cpa_json_text_array(s->'learning_order');
  if jsonb_array_length(s->'learning_order')<>jsonb_array_length(s->'subquestions')
   or (select count(distinct value) from jsonb_array_elements_text(s->'learning_order'))<>jsonb_array_length(s->'subquestions')
   or exists(select 1 from jsonb_array_elements_text(s->'learning_order') code where not exists(select 1 from jsonb_array_elements(s->'subquestions') sub where sub->>'id'=code)) then raise exception 'Learning order must be a complete permutation'; end if;
  -- Content address excludes only mutable publishing/review labels.
  content_hash:=encode(sha256(convert_to(jsonb_build_object('question_set',jsonb_set(s-'status','{verification}',(s->'verification')-'review_status'),
   'applicability',coalesce(p_payload->'applicability','{}'))::text,'UTF8')),'hex');
  insert into public.cpa_question_sets(id) values(s->>'id') on conflict(id) do nothing;
  select v.id into version_id from public.cpa_question_set_versions v where v.set_id=s->>'id' and v.content_hash=content_hash and v.sealed_at is not null order by v.revision desc limit 1;
  if version_id is not null then
   insert into public.cpa_question_bank_release_items(release_id,set_id,set_version_id,position) values(release_id,s->>'id',version_id,item.position);
   continue;
  end if;
  select sum((cr->>'max_points')::int)::int into set_points from jsonb_array_elements(s->'subquestions') sub cross join lateral jsonb_array_elements(sub->'criteria') cr;
  select coalesce(max(v.revision),0)+1 into revision_no from public.cpa_question_set_versions v where v.set_id=s->>'id';
  insert into public.cpa_question_set_versions(set_id,revision,schema_version,status,title,topic_id,part,chapter,domain,standards,tags,shared_facts,source_fidelity,review_status,calculation_required,verification_notes,applicability,content_hash,max_points)
  values(s->>'id',revision_no,'3.0','needs_review',s->>'title',s#>>'{classification,topic_id}',s#>>'{classification,part}',s#>>'{classification,chapter}',s#>>'{classification,domain}',public.cpa_json_text_array(s#>'{classification,standards}'),public.cpa_json_text_array(s#>'{classification,tags}'),facts,s#>>'{verification,source_fidelity}','needs_human_review',false,public.cpa_json_text_array(s#>'{verification,notes}'),coalesce(p_payload->'applicability','{}'),content_hash,set_points)
  returning id into version_id;

  for source_item in select value,ordinality::int as position from jsonb_array_elements(s->'source_refs') with ordinality loop
   insert into public.cpa_question_sources(set_version_id,code,position,file_path,title,page_label,role,source_quote,declared_quote_hash,quote_hash)
   values(version_id,source_item.value->>'id',source_item.position,source_item.value->>'file',source_item.value->>'title',source_item.value->>'page',source_item.value->>'role',source_item.value->>'source_quote',source_item.value->>'content_hash',encode(sha256(convert_to(source_item.value->>'source_quote','UTF8')),'hex'));
  end loop;
  if exists(select 1 from public.cpa_question_sources src where src.set_version_id=version_id group by public.cpa_normalize_fact(src.source_quote) having count(*)>1) then raise exception 'Duplicate source quote inside set'; end if;

  for sq in select value,ordinality::int as position from jsonb_array_elements(s->'subquestions') with ordinality loop
   q:=sq.value;
   if q#>>'{selection,type}' is distinct from 'all' or q#>'{selection,n}' is distinct from 'null'::jsonb then raise exception 'All-criterion selection required'; end if;
   if jsonb_typeof(q#>'{constraints,ordered}') is distinct from 'boolean'
    or jsonb_typeof(q#>'{constraints,max_entries}') is null
    or jsonb_typeof(q#>'{constraints,max_entries}') not in ('null','number')
    or q#>>'{constraints,overflow_policy}' is null or q#>>'{constraints,overflow_policy}' not in ('none','ignore_after_limit') then
    raise exception 'Invalid stored answer constraints'; end if;
   if jsonb_typeof(q->'requirements') is distinct from 'array' or jsonb_array_length(q->'requirements')=0
    or jsonb_typeof(q->'criteria') is distinct from 'array' or jsonb_array_length(q->'criteria')=0 then raise exception 'Requirements and criteria required'; end if;
   slots:=coalesce(q->'answer_slots','[]');
   if jsonb_typeof(slots) is distinct from 'array' then raise exception 'Invalid answer slots'; end if;
   if exists(select 1 from jsonb_array_elements(slots) a where jsonb_typeof(a)<>'object' or a->>'id' is null or jsonb_typeof(a->'label') is distinct from 'string' or a->>'input' not in ('text','textarea','choice') or a->>'input' is null or a-array['id','label','input']<>'{}'::jsonb) then raise exception 'Answer slots contain nonpublic fields'; end if;
   decision:=nullif(q->'decision','null');
   if decision is not null and (jsonb_typeof(decision) is distinct from 'object' or jsonb_typeof(decision->'options') is distinct from 'array') then raise exception 'Invalid decision'; end if;
   if decision is not null and (decision->>'correct' is null or not (decision->>'correct'=any(public.cpa_json_text_array(decision->'options')))) then raise exception 'Decision correct must belong to options'; end if;
   insert into public.cpa_subquestions(set_id,code) values(s->>'id',q->>'id') on conflict(set_id,code) do nothing;
   select l.id into logical_id from public.cpa_subquestions l where l.set_id=s->>'id' and l.code=q->>'id';
   select ordinal::int into order_position from jsonb_array_elements_text(s->'learning_order') with ordinality a(code,ordinal) where code=q->>'id';
   select sum((value->>'max_points')::int)::int into sub_points from jsonb_array_elements(q->'criteria');
   insert into public.cpa_subquestion_versions(set_version_id,set_id,subquestion_id,position,learning_position,type,prompt,ordered,max_entries,overflow_policy,selection_type,selection_n,decision_options,answer_slots,max_points)
   values(version_id,s->>'id',logical_id,sq.position,order_position,q->>'type',q->>'prompt',(q#>>'{constraints,ordered}')::boolean,(q#>>'{constraints,max_entries}')::int,q#>>'{constraints,overflow_policy}','all',null,case when decision is null then null else public.cpa_json_text_array(decision->'options') end,slots,sub_points) returning id into sub_version_id;
   insert into public.cpa_subquestion_answers(subquestion_version_id,model_answer,decision_correct) values(sub_version_id,public.cpa_json_text_array(q->'model_answer'),decision->>'correct');
   for req_item in select value,ordinality::int as position from jsonb_array_elements(q->'requirements') with ordinality loop
    select src.id into source_id from public.cpa_question_sources src where src.set_version_id=version_id and src.code=req_item.value->>'source_ref_id';
    insert into public.cpa_requirements(subquestion_version_id,set_version_id,code,position,source_id,source_quote,source_span)
    values(sub_version_id,version_id,req_item.value->>'id',req_item.position,source_id,req_item.value->>'source_quote',req_item.value->>'source_span');
   end loop;
   for crit_item in select value,ordinality::int as position from jsonb_array_elements(q->'criteria') with ordinality loop
    c:=crit_item.value;
    if c#>'{scores,met}' is distinct from c->'max_points' or c#>'{scores,not_met}' is distinct from '0'::jsonb or c#>'{scores,contradicted}' is distinct from '0'::jsonb then raise exception 'Invalid criterion score contract'; end if;
    select r.id into requirement_id from public.cpa_requirements r where r.subquestion_version_id=sub_version_id and r.code=c->>'requirement_id';
    insert into public.cpa_criteria(subquestion_version_id,set_version_id,code,position,requirement_id,claim,max_points,partial_points)
    values(sub_version_id,version_id,c->>'id',crit_item.position,requirement_id,c->>'claim',(c->>'max_points')::smallint,(c#>>'{scores,partial}')::smallint) returning id into criterion_id;
    perform public.cpa_json_text_array(c->'source_ref_ids');
    if jsonb_array_length(c->'source_ref_ids')=0 then raise exception 'Criterion sources required'; end if;
    for cite_item in select value,ordinality::int as position from jsonb_array_elements_text(c->'source_ref_ids') with ordinality loop
     select src.id into source_id from public.cpa_question_sources src where src.set_version_id=version_id and src.code=cite_item.value;
     insert into public.cpa_criterion_sources(criterion_id,subquestion_version_id,set_version_id,source_id,position) values(criterion_id,sub_version_id,version_id,source_id,cite_item.position);
    end loop;
    if not exists(select 1 from public.cpa_criterion_sources cs join public.cpa_requirements r on r.id=requirement_id where cs.criterion_id=criterion_id and cs.source_id=r.source_id) then raise exception 'Criterion must cite its requirement source'; end if;
    if jsonb_typeof(c->'critical_facts') is distinct from 'array' then raise exception 'Invalid critical facts'; end if;
    for fact_item in select value,ordinality::int as position from jsonb_array_elements(c->'critical_facts') with ordinality loop
     insert into public.cpa_criterion_facts(criterion_id,subquestion_version_id,set_version_id,code,position,type,expected,normalized_expected)
     values(criterion_id,sub_version_id,version_id,fact_item.value->>'id',fact_item.position,fact_item.value->>'type',fact_item.value->>'expected',public.cpa_normalize_fact(fact_item.value->>'expected'));
    end loop;
   end loop;
  end loop;
  insert into public.cpa_question_review_events(set_version_id,set_id,event_type,from_status,to_status,evidence,reviewed_content_hash,actor_user_id,occurred_at)
  values(version_id,s->>'id','review','needs_review','verified',evidence,content_hash,actor_id,now());
  select e.reviewed_content_hash into review_hash from public.cpa_question_review_events e where e.set_version_id=version_id and e.event_type='review' order by e.occurred_at desc limit 1;
  if review_hash is distinct from content_hash then raise exception 'Review content hash mismatch'; end if;
  update public.cpa_question_set_versions set status='published',review_status='verified',sealed_at=now() where id=version_id;
  insert into public.cpa_question_review_events(set_version_id,set_id,event_type,from_status,to_status,evidence,reviewed_content_hash,actor_user_id,occurred_at)
  values(version_id,s->>'id','publish','verified','published',evidence,content_hash,actor_id,now());
  insert into public.cpa_question_bank_release_items(release_id,set_id,set_version_id,position) values(release_id,s->>'id',version_id,item.position);
 end loop;
 -- Whole-bank publication must not silently remove an existing active set.
 if exists(select 1 from public.cpa_question_bank_release_items old_item join public.cpa_question_bank_releases old_release on old_release.id=old_item.release_id and old_release.status='active'
  where not exists(select 1 from public.cpa_question_bank_release_items new_item where new_item.release_id=release_id and new_item.set_id=old_item.set_id)) then raise exception 'Whole-bank import cannot omit an active set'; end if;
 if exists(select 1 from public.cpa_question_bank_release_items i join public.cpa_subquestion_versions q on q.set_version_id=i.set_version_id where i.release_id=release_id group by public.cpa_normalize_fact(q.prompt) having count(*)>1) then raise exception 'Duplicate prompt within release'; end if;
 update public.cpa_question_bank_releases set status='retired' where status='active';
 update public.cpa_question_bank_releases set status='active',published_at=now() where id=release_id;
 select jsonb_agg(jsonb_build_object('set_id',i.set_id,'set_version_id',i.set_version_id) order by i.position) into versions from public.cpa_question_bank_release_items i where i.release_id=release_id;
 return jsonb_build_object('release_id',release_id,'set_count',jsonb_array_length(bank),'reused',false,'question_versions',versions);
end $body$;

create function public.cpa_guard_published_release() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $body$
begin
 if old.published_at is not null then
  if tg_op='DELETE' then raise exception 'Published release is immutable'; end if;
  if current_setting('cpa.learning_initialization_write',true)='on'
   and (to_jsonb(new)-'validation_report')=(to_jsonb(old)-'validation_report')
   and not(old.validation_report ? 'learning_progress_initialized_at')
   and new.validation_report ? 'learning_progress_initialized_at'
   and (new.validation_report-'learning_progress_initialized_at')=old.validation_report then return new; end if;
  if (to_jsonb(new)-'status'-'created_by') is distinct from (to_jsonb(old)-'status'-'created_by')
   or new.status='draft' or (new.created_by is distinct from old.created_by and new.created_by is not null) then raise exception 'Published release metadata is immutable'; end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $body$;
create trigger cpa_release_immutable before update or delete on public.cpa_question_bank_releases for each row execute function public.cpa_guard_published_release();

-- Repoint the bank without deleting any attempt, revision, review or XP row.
create function public.cpa_reactivate_question_bank(p_release_id uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare target public.cpa_question_bank_releases; item_count int;
begin
 perform pg_advisory_xact_lock(7261202609080502);
 select * into target from public.cpa_question_bank_releases where id=p_release_id for update;
 if not found or target.published_at is null or target.status not in ('active','retired') then
  raise exception 'Only an already published question bank can be reactivated';
 end if;
 select count(*)::int into item_count from public.cpa_question_bank_release_items where release_id=p_release_id;
 if item_count=0 or exists(select 1 from public.cpa_question_bank_release_items i join public.cpa_question_set_versions v on v.id=i.set_version_id
  where i.release_id=p_release_id and (v.sealed_at is null or v.status<>'published' or v.review_status<>'verified')) then
  raise exception 'Reactivation requires a complete sealed bank';
 end if;
 update public.cpa_question_bank_releases set status='retired' where status='active' and id<>p_release_id;
 update public.cpa_question_bank_releases set status='active' where id=p_release_id;
 return jsonb_build_object('release_id',p_release_id,'set_count',item_count);
end $body$;

revoke all on function public.cpa_json_text_array(jsonb),public.cpa_normalize_fact(text),public.cpa_get_question_version_document(uuid),public.cpa_restore_v3_null_policy(jsonb),public.cpa_get_question_version(uuid),public.cpa_get_public_question_version(uuid),public.cpa_get_active_question_bank(),public.cpa_import_question_bank(jsonb),public.cpa_guard_published_release(),public.cpa_reactivate_question_bank(uuid),public.cpa_validate_question_seal() from public,anon,authenticated;
grant execute on function public.cpa_json_text_array(jsonb),public.cpa_normalize_fact(text),public.cpa_get_question_version_document(uuid),public.cpa_restore_v3_null_policy(jsonb),public.cpa_get_question_version(uuid),public.cpa_get_public_question_version(uuid),public.cpa_get_active_question_bank(),public.cpa_import_question_bank(jsonb),public.cpa_reactivate_question_bank(uuid) to service_role;
commit;
