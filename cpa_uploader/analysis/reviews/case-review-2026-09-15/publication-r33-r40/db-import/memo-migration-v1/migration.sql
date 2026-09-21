-- cpa_get_question_version의 비용을 릴리스 누적과 무관하게 만든다.
--
-- 배경: 이 함수는 판본이 묶인 릴리스를 모두 순회하며 릴리스마다 저장 원문(현재 6.2MB)을
-- 통째로 sha256 해시하고 jsonb로 파싱한 뒤 배열을 훑어 세트 하나를 찾았다. 비용이 O(R × D)라
-- 릴리스가 쌓일수록 커졌고, 2026-09-21 릴리스 22개 시점에 가장 오래 유지된 판본 셋에서
-- statement timeout(57014)이 나 독립 검증이 멈췄다. 세트 수가 아니라 릴리스 누적이 원인이다.
--
-- 이 migration은 두 가지를 한다.
--   1. 판본별 저장 원문 조각과 릴리스별 위치를 미리 계산해 두는 표를 만들고 백필 함수를 둔다.
--   2. 함수가 그 표를 읽도록 바꾸어 저장 원문을 파싱하지 않게 한다. 표에 기록이 없으면
--      예전과 같은 경로로 계산하므로 백필 전에도 결과가 달라지지 않는다.
--
-- 제거한 검사 두 가지와 그 근거:
--   (a) 릴리스마다 sha256(source_document) = source_file_hash 재계산.
--       cpa_question_bank_releases의 열 정의에 같은 내용의 CHECK 제약이 이미 있어
--       모든 행에 대해 DB가 항상 보장한다. 호출마다 되풀이할 이유가 없다.
--   (b) 릴리스 간 normalized_source 동일성("ambiguous across releases").
--       모든 릴리스가 candidate_hash = v.content_hash를 통과해야 하고 candidate_hash는
--       normalized_source와 applicability에 대한 sha256이므로, 통과했다면 동일함이 따라온다.
--       sha256 충돌을 가정하지 않는 한 중복 검사다. 이 저장소는 같은 해시를 receipt와
--       source_file_hash의 결속 수단으로 이미 쓰고 있어 위협 모형이 일관된다.
--
-- 유지한 것: 위치(position) 일치, 판본 content_hash 일치, 봉인·상태·게시시각 결속,
-- 그리고 일반 필드·인용·물음·criterion·사실 대조는 그대로다.

begin;

create table public.cpa_question_set_version_source (
 set_version_id uuid primary key references public.cpa_question_set_versions(id) on delete cascade,
 set_id text not null,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 source_set jsonb not null,
 computed_at timestamptz not null default now()
);
comment on table public.cpa_question_set_version_source is
 '판본 하나에 대응하는 저장 원문 조각. 모든 릴리스의 조각이 같음은 content_hash가 보장하므로 판본당 한 행이면 된다.';

create table public.cpa_question_bank_release_item_source (
 release_id uuid not null references public.cpa_question_bank_releases(id) on delete cascade,
 set_version_id uuid not null references public.cpa_question_set_versions(id) on delete cascade,
 source_position bigint not null check(source_position>0),
 computed_at timestamptz not null default now(),
 primary key(release_id,set_version_id)
);
comment on table public.cpa_question_bank_release_item_source is
 '릴리스 저장 원문 배열에서 그 판본이 놓인 위치(1부터). release_items.position과 일치해야 한다.';

create index cpa_release_item_source_version on public.cpa_question_bank_release_item_source(set_version_id);

-- 백필: 릴리스마다 저장 원문을 한 번만 파싱해 그 릴리스의 모든 판본 행을 만든다.
-- p_release_id를 주면 그 릴리스만 처리한다. 새 릴리스를 올린 뒤 한 번 부른다.
create function public.cpa_backfill_release_item_source(p_release_id uuid default null) returns int
language plpgsql volatile security invoker set search_path=pg_catalog,public as $body$
declare rel record; el record; ver record; rows_written int:=0; doc jsonb; normalized jsonb; h text;
begin
 for rel in
  select rr.id,rr.source_document from public.cpa_question_bank_releases rr
  where rr.source_document is not null and (p_release_id is null or rr.id=p_release_id)
  order by rr.release_no
 loop
  doc:=rel.source_document::jsonb;
  if jsonb_typeof(doc) is distinct from 'array' then
   raise exception 'Release % source document must be an array',rel.id;
  end if;
  for el in select a.value,a.ordinality from jsonb_array_elements(doc) with ordinality a loop
   select ri.set_version_id,ri.set_id,ri.position,v.content_hash,v.applicability into ver
   from public.cpa_question_bank_release_items ri
   join public.cpa_question_set_versions v on v.id=ri.set_version_id
   where ri.release_id=rel.id and ri.set_id=el.value->>'id';
   if ver.set_version_id is null then continue; end if;
   if el.ordinality is distinct from ver.position::bigint then
    raise exception 'Release % set % position mismatch: document %, item %',rel.id,ver.set_id,el.ordinality,ver.position;
   end if;
   normalized:=jsonb_set(el.value-'status','{verification}',(el.value->'verification')-'review_status');
   h:=encode(sha256(convert_to(jsonb_build_object('question_set',normalized,'applicability',ver.applicability)::text,'UTF8')),'hex');
   if h is distinct from ver.content_hash then
    raise exception 'Release % set % content hash mismatch',rel.id,ver.set_id;
   end if;
   insert into public.cpa_question_set_version_source(set_version_id,set_id,content_hash,source_set)
    values(ver.set_version_id,ver.set_id,ver.content_hash,el.value)
    on conflict(set_version_id) do nothing;
   insert into public.cpa_question_bank_release_item_source(release_id,set_version_id,source_position)
    values(rel.id,ver.set_version_id,el.ordinality)
    on conflict(release_id,set_version_id) do nothing;
   rows_written:=rows_written+1;
  end loop;
 end loop;
 return rows_written;
end
$body$;

create or replace function public.cpa_get_question_version_with_source_metadata(p_version_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,public as $body$
declare
 v record; r record; item record; q record; c record; f record;
 result jsonb; source_set jsonb; candidate jsonb; normalized_source jsonb;
 source_q jsonb; source_c jsonb; source_f jsonb; source_ref jsonb;
 source_document jsonb; matches int; source_position bigint; document_count int:=0; candidate_hash text;
 target_path text[]; value jsonb; source_common jsonb; stored_common jsonb; memo_position bigint;
begin
 result:=public.cpa_get_question_version_document(p_version_id);
 if result is null then return null; end if;
 select s.set_id,s.content_hash,s.applicability,s.sealed_at into strict v
 from public.cpa_question_set_versions s where s.id=p_version_id;

 -- 이 판본이 묶인 모든 릴리스를 확인한다. 저장 원문의 바이트 무결성은 releases 표의
 -- CHECK 제약이 보장하므로 여기서 다시 해시하지 않는다. 위치는 미리 계산한 표에서 읽고,
 -- 기록이 없을 때만 예전처럼 저장 원문을 파싱한다.
 for r in
  select ri.release_id,ri.set_id,ri.position,rr.source_document,rr.status,rr.published_at
  from public.cpa_question_bank_release_items ri
  join public.cpa_question_bank_releases rr on rr.id=ri.release_id
  where ri.set_version_id=p_version_id and rr.source_document is not null
 loop
  if r.set_id is distinct from v.set_id or v.sealed_at is null
   or r.status not in ('active','retired') or r.published_at is null then
   raise exception 'Private source metadata requires an exact sealed release/version binding';
  end if;
  select s.source_position into memo_position
  from public.cpa_question_bank_release_item_source s
  where s.release_id=r.release_id and s.set_version_id=p_version_id;
  if memo_position is not null then
   if memo_position is distinct from r.position::bigint then
    raise exception 'Private source metadata release item position mismatch';
   end if;
  else
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
   source_set:=candidate;
  end if;
  document_count:=document_count+1;
 end loop;

 -- 문서가 하나도 없는 옛 판본은 예전처럼 정규화된 DTO를 그대로 돌려준다.
 if document_count=0 then return result; end if;

 -- 조각은 판본당 하나면 된다. 모든 릴리스의 조각이 같음은 content_hash 일치가 보장한다.
 if source_set is null then
  select s.source_set into source_set from public.cpa_question_set_version_source s
  where s.set_version_id=p_version_id and s.content_hash=v.content_hash;
 end if;
 if source_set is null then
  raise exception 'Private source metadata memo missing; run cpa_backfill_release_item_source()';
 end if;

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

alter table public.cpa_question_set_version_source enable row level security;
alter table public.cpa_question_bank_release_item_source enable row level security;
revoke all on table public.cpa_question_set_version_source,public.cpa_question_bank_release_item_source
 from public,anon,authenticated;
grant select on table public.cpa_question_set_version_source,public.cpa_question_bank_release_item_source
 to service_role;
revoke all on function public.cpa_backfill_release_item_source(uuid) from public,anon,authenticated;
grant execute on function public.cpa_backfill_release_item_source(uuid) to service_role;

commit;
