-- Additive learning metadata. Source v3 content, published releases, membership
-- wrappers and historical full-set attempts retain their identities and bytes.
begin;

create table public.cpa_learning_questions (
  id uuid primary key default gen_random_uuid(),
  source_subquestion_id uuid not null unique references public.cpa_subquestions(id),
  created_at timestamptz not null default clock_timestamp()
);
create table public.cpa_learning_question_versions (
  id uuid primary key default gen_random_uuid(),
  learning_question_id uuid not null references public.cpa_learning_questions(id),
  revision integer not null check (revision > 0),
  source_set_id text not null,
  source_set_version_id uuid not null,
  source_subquestion_version_id uuid not null,
  question_style text not null check (question_style in ('case','standard')),
  case_set_id text references public.cpa_question_sets(id),
  standalone_prompt text,
  case_fact_ids text[] not null default '{}',
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  sealed_at timestamptz,
  unique(learning_question_id,revision),
  unique(id,source_subquestion_version_id,source_set_version_id),
  foreign key(source_set_version_id,source_set_id) references public.cpa_question_set_versions(id,set_id),
  foreign key(source_subquestion_version_id,source_set_version_id) references public.cpa_subquestion_versions(id,set_version_id),
  check ((question_style='standard' and case_set_id is null and nullif(btrim(standalone_prompt),'') is not null and cardinality(case_fact_ids)=0)
    or (question_style='case' and case_set_id=source_set_id and case_set_id is not null and standalone_prompt is null))
);
create table public.cpa_learning_topics (
  id text primary key check(id ~ '^[0-9]{2}$'),
  title text not null check(nullif(btrim(title),'') is not null),
  part text not null check(nullif(btrim(part),'') is not null),
  position integer not null check(position>0)
);
create table public.cpa_learning_question_topics (
  classification_version_id uuid not null references public.cpa_learning_question_versions(id),
  topic_id text not null references public.cpa_learning_topics(id),
  primary key(classification_version_id,topic_id)
);
create index cpa_learning_topics_lookup on public.cpa_learning_question_topics(topic_id,classification_version_id);

create table public.cpa_attempt_learning_selections (
  attempt_id uuid primary key references public.cpa_attempts(id) on delete cascade,
  learning_unit_id text not null,
  selected_subquestion_ids text[] not null check (cardinality(selected_subquestion_ids)>0),
  classification_version_ids uuid[] not null,
  sealed_at timestamptz,
  check(cardinality(selected_subquestion_ids)=cardinality(classification_version_ids))
);
create table public.cpa_attempt_learning_questions (
  attempt_id uuid not null references public.cpa_attempt_learning_selections(attempt_id) on delete cascade,
  position integer not null check(position>0),
  set_version_id uuid not null,
  subquestion_version_id uuid not null,
  classification_version_id uuid not null,
  primary key(attempt_id,position),
  unique(attempt_id,subquestion_version_id),
  foreign key(attempt_id,set_version_id) references public.cpa_attempts(id,set_version_id) on delete cascade,
  foreign key(classification_version_id,subquestion_version_id,set_version_id)
    references public.cpa_learning_question_versions(id,source_subquestion_version_id,source_set_version_id)
);

create function public.cpa_guard_learning_metadata()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_source record; v_hash text; v_topics text[];
begin
  if tg_table_name='cpa_learning_questions' then
    raise exception 'Learning question identity is immutable';
  elsif tg_table_name='cpa_learning_question_topics' then
    if tg_op<>'INSERT' and exists(select 1 from public.cpa_learning_question_versions where id=old.classification_version_id and sealed_at is not null)
      then raise exception 'Sealed learning classification is immutable'; end if;
    if tg_op<>'DELETE' and exists(select 1 from public.cpa_learning_question_versions where id=new.classification_version_id and sealed_at is not null)
      then raise exception 'Sealed learning classification is immutable'; end if;
  else
    if tg_op<>'INSERT' and old.sealed_at is not null then raise exception 'Sealed learning classification is immutable'; end if;
    if tg_op<>'DELETE' then
      select sq.subquestion_id,q.shared_facts,q.sealed_at,q.content_hash into v_source
        from public.cpa_subquestion_versions sq join public.cpa_question_set_versions q on q.id=sq.set_version_id
        where sq.id=new.source_subquestion_version_id and sq.set_version_id=new.source_set_version_id and q.set_id=new.source_set_id;
      if not found or v_source.sealed_at is null or not exists(select 1 from public.cpa_learning_questions
        where id=new.learning_question_id and source_subquestion_id=v_source.subquestion_id)
        then raise exception 'Learning classification source lineage mismatch'; end if;
      if new.question_style='case' and jsonb_array_length(v_source.shared_facts)=0
        then raise exception 'Case learning question requires parent facts'; end if;
      if exists(select 1 from unnest(new.case_fact_ids) f where f is null or not exists(
        select 1 from jsonb_array_elements(v_source.shared_facts) j where j->>'id'=f))
        or cardinality(new.case_fact_ids)<>(select count(distinct f) from unnest(new.case_fact_ids) f)
        then raise exception 'Invalid case fact selection'; end if;
      if new.sealed_at is not null and not exists(select 1 from public.cpa_learning_question_topics where classification_version_id=new.id)
        then raise exception 'Learning classification requires topics'; end if;
      if new.sealed_at is not null then
        select array_agg(topic_id order by topic_id) into v_topics from public.cpa_learning_question_topics where classification_version_id=new.id;
        v_hash:=encode(sha256(convert_to(jsonb_build_object('source_set_version_id',new.source_set_version_id,
          'source_subquestion_version_id',new.source_subquestion_version_id,'source_content_hash',v_source.content_hash,
          'question_style',new.question_style,'case_set_id',new.case_set_id,'standalone_prompt',new.standalone_prompt,
          'topic_ids',to_jsonb(v_topics),'case_fact_ids',to_jsonb(new.case_fact_ids))::text,'UTF8')),'hex');
        if new.content_hash is distinct from v_hash then raise exception 'Learning metadata sealing hash mismatch'; end if;
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger cpa_learning_identity before update or delete on public.cpa_learning_questions
  for each row execute function public.cpa_guard_learning_metadata();
create trigger cpa_learning_version_guard before insert or update or delete on public.cpa_learning_question_versions
  for each row execute function public.cpa_guard_learning_metadata();
create trigger cpa_learning_topics_guard before insert or update or delete on public.cpa_learning_question_topics
  for each row execute function public.cpa_guard_learning_metadata();

create function public.cpa_get_learning_classifications(p_release_id uuid,p_classification_version_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_rows jsonb;
begin
  if not exists(select 1 from public.cpa_question_bank_releases where id=p_release_id and status in ('active','retired') and published_at is not null)
    then raise exception 'Published release required'; end if;
  if p_classification_version_ids is not null and (cardinality(p_classification_version_ids)=0
    or cardinality(p_classification_version_ids)<>(select count(distinct v) from unnest(p_classification_version_ids) v))
    then raise exception 'Invalid classification version selection'; end if;
  with candidates as (
    select v.*,s.code,q.content_hash as source_content_hash,
      row_number() over(partition by v.source_subquestion_version_id order by v.revision desc) as latest
    from public.cpa_learning_question_versions v
    join public.cpa_question_bank_release_items ri on ri.set_version_id=v.source_set_version_id and ri.release_id=p_release_id
    join public.cpa_question_set_versions q on q.id=v.source_set_version_id
    join public.cpa_subquestion_versions sq on sq.id=v.source_subquestion_version_id
    join public.cpa_subquestions s on s.id=sq.subquestion_id where v.sealed_at is not null
  ) select coalesce(jsonb_agg(jsonb_build_object(
    'learning_question_id',c.learning_question_id,'classification_version_id',c.id,
    'source_set_id',c.source_set_id,'source_set_version_id',c.source_set_version_id,
    'source_subquestion_version_id',c.source_subquestion_version_id,'source_content_hash',c.source_content_hash,
    'subquestion_id',c.code,'question_style',c.question_style,'case_set_id',c.case_set_id,
    'topic_ids',(select jsonb_agg(t.topic_id order by t.topic_id) from public.cpa_learning_question_topics t where t.classification_version_id=c.id),
    'standalone_prompt',c.standalone_prompt,'case_fact_ids',to_jsonb(c.case_fact_ids),'content_hash',c.content_hash
  ) order by c.source_set_id,c.code),'[]'::jsonb) into v_rows from candidates c
    where (p_classification_version_ids is null and c.latest=1) or c.id=any(p_classification_version_ids);
  if p_classification_version_ids is not null and jsonb_array_length(v_rows)<>cardinality(p_classification_version_ids)
    then raise exception 'Classification version does not belong to release'; end if;
  return v_rows;
end $$;

create function public.cpa_import_learning_classifications(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_release uuid := (p_payload->>'release_id')::uuid;
  v_entries jsonb := p_payload->'entries'; v_entry jsonb; v_source record;
  v_question uuid; v_version uuid; v_revision integer; v_topics text[]; v_facts text[];
  v_content jsonb; v_hash text; v_topic jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(v_entries) is distinct from 'array'
    then raise exception 'Invalid learning classification payload'; end if;
  -- Serialize imports, including releases sharing immutable source versions.
  lock table public.cpa_learning_questions in share row exclusive mode;
  perform 1 from public.cpa_question_bank_releases where id=v_release and status in ('active','retired') and published_at is not null for update;
  if not found then raise exception 'Published release required'; end if;
  if jsonb_array_length(v_entries)=0 or jsonb_array_length(v_entries)<>(select count(*) from public.cpa_question_bank_release_items ri
    join public.cpa_subquestion_versions sq on sq.set_version_id=ri.set_version_id where ri.release_id=v_release)
    or (select count(distinct (j->>'set_id',j->>'subquestion_id')) from jsonb_array_elements(v_entries) j)<>jsonb_array_length(v_entries)
    then raise exception 'Complete release classification coverage required'; end if;
  if jsonb_typeof(p_payload->'topics') is distinct from 'array' or jsonb_array_length(p_payload->'topics')=0
    or (select count(distinct j->>'id') from jsonb_array_elements(p_payload->'topics') j)<>jsonb_array_length(p_payload->'topics')
    then raise exception 'Learning topic registry required'; end if;
  for v_topic in select j from jsonb_array_elements(p_payload->'topics') j loop
    if jsonb_typeof(v_topic) is distinct from 'object' or jsonb_typeof(v_topic->'id') is distinct from 'string'
      or jsonb_typeof(v_topic->'title') is distinct from 'string' or jsonb_typeof(v_topic->'part') is distinct from 'string'
      or jsonb_typeof(v_topic->'position') is distinct from 'number' or (v_topic->>'position') !~ '^[1-9][0-9]*$'
      then raise exception 'Invalid learning topic registry'; end if;
    insert into public.cpa_learning_topics(id,title,part,position)
      values(v_topic->>'id',v_topic->>'title',v_topic->>'part',(v_topic->>'position')::integer)
      on conflict(id) do update set title=excluded.title,part=excluded.part,position=excluded.position;
  end loop;
  for v_entry in select j from jsonb_array_elements(v_entries) j loop
    select sq.id,sq.subquestion_id,sq.set_version_id,ri.set_id,q.content_hash,q.shared_facts into v_source
      from public.cpa_question_bank_release_items ri join public.cpa_question_set_versions q on q.id=ri.set_version_id
      join public.cpa_subquestion_versions sq on sq.set_version_id=q.id
      join public.cpa_subquestions s on s.id=sq.subquestion_id
      where ri.release_id=v_release and ri.set_id=v_entry->>'set_id' and s.code=v_entry->>'subquestion_id' and q.sealed_at is not null;
    if not found then raise exception 'Unknown learning source question'; end if;
    if v_entry->>'source_content_hash' is distinct from v_source.content_hash then raise exception 'Learning source content hash mismatch'; end if;
    if v_entry->>'question_style' is null or v_entry->>'question_style' not in ('case','standard')
      or jsonb_typeof(v_entry->'topic_ids') is distinct from 'array'
      or jsonb_array_length(v_entry->'topic_ids')=0
      or exists(select 1 from jsonb_array_elements(v_entry->'topic_ids') j where jsonb_typeof(j)<>'string'
        or not exists(select 1 from public.cpa_learning_topics where id=j#>>'{}'))
      or jsonb_typeof(v_entry->'case_fact_ids') is distinct from 'array'
      or exists(select 1 from jsonb_array_elements(v_entry->'case_fact_ids') j where jsonb_typeof(j)<>'string')
      then raise exception 'Invalid learning style, topics or facts'; end if;
    select array_agg(t order by t) into v_topics from jsonb_array_elements_text(v_entry->'topic_ids') t;
    if cardinality(v_topics)<>(select count(distinct t) from unnest(v_topics) t) then raise exception 'Duplicate learning topics'; end if;
    select coalesce(array_agg(f order by f),'{}') into v_facts from jsonb_array_elements_text(v_entry->'case_fact_ids') f;
    if (v_entry->>'question_style'='standard' and (jsonb_typeof(v_entry->'standalone_prompt') is distinct from 'string'
      or nullif(btrim(v_entry->>'standalone_prompt'),'') is null or cardinality(v_facts)<>0))
      or (v_entry->>'question_style'='case' and nullif(v_entry->'standalone_prompt','null'::jsonb) is not null)
      then raise exception 'Learning parent or standalone prompt mismatch'; end if;
    insert into public.cpa_learning_questions(source_subquestion_id) values(v_source.subquestion_id)
      on conflict(source_subquestion_id) do nothing;
    select id into v_question from public.cpa_learning_questions where source_subquestion_id=v_source.subquestion_id;
    v_content:=jsonb_build_object('source_set_version_id',v_source.set_version_id,'source_subquestion_version_id',v_source.id,
      'source_content_hash',v_source.content_hash,'question_style',v_entry->>'question_style',
      'case_set_id',case when v_entry->>'question_style'='case' then v_source.set_id end,
      'standalone_prompt',v_entry->>'standalone_prompt','topic_ids',to_jsonb(v_topics),'case_fact_ids',to_jsonb(v_facts));
    v_hash:=encode(sha256(convert_to(v_content::text,'UTF8')),'hex');
    if v_entry ? 'content_hash' and v_entry->>'content_hash' is distinct from v_hash then raise exception 'Learning metadata content hash mismatch'; end if;
    select id into v_version from public.cpa_learning_question_versions where source_subquestion_version_id=v_source.id
      and content_hash=v_hash and revision=(select max(revision) from public.cpa_learning_question_versions where source_subquestion_version_id=v_source.id);
    if not found then
      select coalesce(max(revision),0)+1 into v_revision from public.cpa_learning_question_versions where learning_question_id=v_question;
      insert into public.cpa_learning_question_versions(learning_question_id,revision,source_set_id,source_set_version_id,
        source_subquestion_version_id,question_style,case_set_id,standalone_prompt,case_fact_ids,content_hash)
      values(v_question,v_revision,v_source.set_id,v_source.set_version_id,v_source.id,v_entry->>'question_style',
        case when v_entry->>'question_style'='case' then v_source.set_id end,v_entry->>'standalone_prompt',v_facts,v_hash)
      returning id into v_version;
      insert into public.cpa_learning_question_topics select v_version,t from unnest(v_topics) t;
      update public.cpa_learning_question_versions set sealed_at=clock_timestamp() where id=v_version;
    end if;
  end loop;
  return public.cpa_get_learning_classifications(v_release);
end $$;

create function public.cpa_guard_attempt_learning_selection()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare v_attempt public.cpa_attempts%rowtype; v_header public.cpa_attempt_learning_selections%rowtype; v_id uuid;
begin
  v_id:=case when tg_op='DELETE' then old.attempt_id else new.attempt_id end;
  select * into v_attempt from public.cpa_attempts where id=v_id;
  if tg_op='DELETE' and not found then return old; end if;
  if tg_op='DELETE' or tg_op='UPDATE' and tg_table_name='cpa_attempt_learning_questions'
    then raise exception 'Learning attempt selection is immutable'; end if;
  if not found or v_attempt.status<>'queued' then raise exception 'Learning attempt selection must be queued'; end if;
  if tg_table_name='cpa_attempt_learning_selections' then
    if tg_op='INSERT' and exists(select 1 from public.cpa_attempt_answers where attempt_id=v_id)
      then raise exception 'Cannot attach learning metadata to an existing answer set'; end if;
    if tg_op='UPDATE' and (old.sealed_at is not null or (to_jsonb(new)-'sealed_at') is distinct from (to_jsonb(old)-'sealed_at'))
      then raise exception 'Learning attempt selection is immutable'; end if;
    if new.sealed_at is not null and (
      (select count(*) from public.cpa_attempt_learning_questions where attempt_id=v_id)<>cardinality(new.classification_version_ids)
      or (select count(*) from public.cpa_attempt_answers where attempt_id=v_id)<>cardinality(new.classification_version_ids))
        then raise exception 'Learning attempt selection coverage mismatch'; end if;
    if new.sealed_at is not null and (
      (select count(distinct v.question_style) from public.cpa_attempt_learning_questions l
        join public.cpa_learning_question_versions v on v.id=l.classification_version_id where l.attempt_id=v_id)<>1
      or exists(select 1 from public.cpa_attempt_learning_questions l join public.cpa_learning_question_versions v on v.id=l.classification_version_id
        join public.cpa_subquestion_versions sq on sq.id=l.subquestion_version_id join public.cpa_subquestions s on s.id=sq.subquestion_id
        where l.attempt_id=v_id and (v.sealed_at is null or new.learning_unit_id is distinct from
          case v.question_style when 'case' then v.source_set_id||'--case' else v.source_set_id||'--'||s.code||'--standard' end
          or (v.question_style='standard' and cardinality(new.classification_version_ids)<>1))))
      then raise exception 'Learning attempt unit contract mismatch'; end if;
  else
    select * into v_header from public.cpa_attempt_learning_selections where attempt_id=v_id;
    if v_header.sealed_at is not null then raise exception 'Learning attempt selection is immutable'; end if;
    if new.classification_version_id is distinct from v_header.classification_version_ids[new.position]
      or not exists(select 1 from public.cpa_subquestion_versions sq join public.cpa_subquestions s on s.id=sq.subquestion_id
        where sq.id=new.subquestion_version_id and s.code=v_header.selected_subquestion_ids[new.position])
      then raise exception 'Learning attempt selection lineage mismatch'; end if;
  end if;
  return new;
end $$;
create trigger cpa_attempt_selection_guard before insert or update or delete on public.cpa_attempt_learning_selections
  for each row execute function public.cpa_guard_attempt_learning_selection();
create trigger cpa_attempt_selection_question_guard before insert or update or delete on public.cpa_attempt_learning_questions
  for each row execute function public.cpa_guard_attempt_learning_selection();

create function public.cpa_guard_selected_attempt_answer()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if exists(select 1 from public.cpa_attempt_learning_selections where attempt_id=new.attempt_id) and
    (exists(select 1 from public.cpa_attempt_learning_selections where attempt_id=new.attempt_id and sealed_at is not null)
      or not exists(select 1 from public.cpa_attempt_learning_questions where attempt_id=new.attempt_id and subquestion_version_id=new.subquestion_version_id))
    then raise exception 'Answer is outside frozen learning selection'; end if;
  return new;
end $$;
create trigger cpa_selected_answer_guard before insert on public.cpa_attempt_answers
  for each row execute function public.cpa_guard_selected_attempt_answer();

-- Selection-aware legacy cores are defined below. Public common-account wrappers
-- still enforce the original membership epoch before invoking these cores.

create or replace function public.common_legacy_cpa_begin_attempt(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_owner uuid := (p_payload->>'owner_user_id')::uuid;
  v_actor text := p_payload->>'actor_kind';
  v_set uuid := (p_payload->>'set_version_id')::uuid;
  v_key uuid := (p_payload->>'submission_key')::uuid;
  v_submitted timestamptz := (p_payload->>'submitted_at')::timestamptz;
  v_expires timestamptz := (p_payload->>'expires_at')::timestamptz;
  v_answers jsonb := p_payload->'answers';
  v_attempt public.cpa_attempts%rowtype;
  v_anonymous boolean;
  v_new boolean;
  v_selected boolean := p_payload ? 'selected_subquestion_ids' or p_payload ? 'classification_version_ids' or p_payload ? 'learning_unit_id';
  v_codes text[]; v_classes uuid[]; v_unit text; v_style text; v_selection record; v_saved public.cpa_attempt_learning_selections%rowtype;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
    or v_owner is null or v_set is null or v_key is null
    or v_submitted is null or v_submitted > clock_timestamp() + interval '30 seconds'
    or v_actor not in ('member','guest') or v_actor is null
    or jsonb_typeof(v_answers) is distinct from 'object'
    or not coalesce(p_payload->>'answers_hash' ~ '^[a-f0-9]{64}$',false) then
    raise exception 'Invalid submission payload';
  end if;
  select coalesce(is_anonymous,false) into v_anonymous from auth.users where id=v_owner;
  if not found then raise exception 'Unknown submission owner'; end if;
  if v_actor='member' and (v_anonymous or not exists(
    select 1 from public.cpa_users where id=v_owner and role in ('MEMBER','PRO','ADMIN')
  )) then raise exception 'Member profile required'; end if;
  -- A signed token issued while anonymous may be retried after account conversion.
  -- The server verifies that token and its original actor before calling this RPC.
  if (v_actor='member' and v_expires is not null)
    or (v_actor='guest' and (v_expires is null or v_expires <> v_submitted+interval '168 hours'
      or v_expires <= clock_timestamp())) then raise exception 'Submission expired or invalid retention'; end if;
  if not exists(select 1 from public.cpa_question_bank_release_items ri
    join public.cpa_question_bank_releases r on r.id=ri.release_id
    join public.cpa_question_set_versions sv on sv.id=ri.set_version_id
    where ri.release_id=(p_payload->>'release_id')::uuid and ri.set_id=p_payload->>'set_id'
      and ri.set_version_id=v_set and r.status in ('active','retired')
      and r.published_at is not null and sv.sealed_at is not null)
  then raise exception 'Submission version is not published'; end if;
  if exists(select 1 from jsonb_each(v_answers) a where jsonb_typeof(a.value)<>'string'
    or public.cpa_answer_utf16_length(a.value#>>'{}') > 5000
    or not exists(select 1 from public.cpa_subquestion_versions sv
      join public.cpa_subquestions s on s.id=sv.subquestion_id
      where sv.set_version_id=v_set and s.code=a.key))
  then raise exception 'Invalid answer or subquestion code'; end if;

  if v_selected then
    -- Public preparation issues all case siblings, including on topic searches.
    -- The trusted RPC also supports internal subsets; only server-signed ordered
    -- codes/classification IDs can reach it from the application, never browser
    -- table access. An old signed group is not rebuilt using later metadata.
    if jsonb_typeof(p_payload->'selected_subquestion_ids') is distinct from 'array'
      or jsonb_typeof(p_payload->'classification_version_ids') is distinct from 'array'
      or jsonb_array_length(p_payload->'selected_subquestion_ids')=0
      or jsonb_array_length(p_payload->'selected_subquestion_ids')<>jsonb_array_length(p_payload->'classification_version_ids')
      or exists(select 1 from jsonb_array_elements(p_payload->'selected_subquestion_ids') j where jsonb_typeof(j)<>'string')
      or exists(select 1 from jsonb_array_elements(p_payload->'classification_version_ids') j where jsonb_typeof(j)<>'string')
      then raise exception 'Invalid learning selection'; end if;
    select array_agg(c order by ord) into v_codes from jsonb_array_elements_text(p_payload->'selected_subquestion_ids') with ordinality t(c,ord);
    select array_agg(c::uuid order by ord) into v_classes from jsonb_array_elements_text(p_payload->'classification_version_ids') with ordinality t(c,ord);
    if cardinality(v_codes)<>(select count(distinct c) from unnest(v_codes) c)
      or cardinality(v_classes)<>(select count(distinct c) from unnest(v_classes) c)
      or exists(select 1 from jsonb_object_keys(v_answers) k where not(k=any(v_codes)))
      then raise exception 'Duplicate or outside learning selection'; end if;
    for v_selection in select c.code,c.ordinality,v.question_style,v.case_set_id,sq.id as subquestion_version_id
      from unnest(v_codes) with ordinality c(code,ordinality)
      left join public.cpa_learning_question_versions v on v.id=v_classes[c.ordinality]
      left join public.cpa_subquestion_versions sq on sq.id=v.source_subquestion_version_id
      left join public.cpa_subquestions s on s.id=sq.subquestion_id
      where v.id is null or (v.sealed_at is not null and v.source_set_version_id=v_set and s.code=c.code)
    loop
      if v_selection.question_style is null then raise exception 'Invalid classification source selection'; end if;
      if v_style is null then v_style:=v_selection.question_style; end if;
      if v_style<>v_selection.question_style then raise exception 'Mixed learning styles are not allowed'; end if;
      if v_style='standard' and cardinality(v_codes)<>1 then raise exception 'Standard learning requires one question'; end if;
    end loop;
    if (select count(*) from unnest(v_codes) with ordinality c(code,ordinality)
      join public.cpa_learning_question_versions v on v.id=v_classes[c.ordinality]
      join public.cpa_subquestion_versions sq on sq.id=v.source_subquestion_version_id
      join public.cpa_subquestions s on s.id=sq.subquestion_id
      where v.sealed_at is not null and v.source_set_version_id=v_set and s.code=c.code)<>cardinality(v_codes)
      then raise exception 'Classification source selection mismatch'; end if;
    v_unit:=case v_style when 'case' then (p_payload->>'set_id')||'--case'
      else (p_payload->>'set_id')||'--'||v_codes[1]||'--standard' end;
    if p_payload ? 'learning_unit_id' and p_payload->>'learning_unit_id' is distinct from v_unit
      then raise exception 'Learning unit identity mismatch'; end if;
  end if;

  insert into public.cpa_attempts(owner_user_id,actor_kind,release_id,set_id,set_version_id,
    submission_key,answers_hash,status,submitted_at,expires_at)
  values(v_owner,v_actor,(p_payload->>'release_id')::uuid,p_payload->>'set_id',v_set,
    v_key,p_payload->>'answers_hash','queued',v_submitted,v_expires)
  on conflict(owner_user_id,submission_key) do nothing returning * into v_attempt;
  v_new := found;
  if not v_new then
    select * into v_attempt from public.cpa_attempts
      where owner_user_id=v_owner and submission_key=v_key for update;
    if v_attempt.expires_at <= clock_timestamp() then raise exception 'Submission expired'; end if;
    select * into v_saved from public.cpa_attempt_learning_selections where attempt_id=v_attempt.id;
    if v_selected is distinct from found or (v_selected and
      (v_saved.learning_unit_id is distinct from v_unit or v_saved.selected_subquestion_ids is distinct from v_codes
        or v_saved.classification_version_ids is distinct from v_classes))
      then raise exception 'Submission key conflict: learning selection'; end if;
    if v_attempt.set_version_id <> v_set or v_attempt.release_id<>(p_payload->>'release_id')::uuid
      or v_attempt.set_id<>p_payload->>'set_id' or v_attempt.answers_hash<>p_payload->>'answers_hash'
      or v_attempt.actor_kind<>v_actor or v_attempt.submitted_at<>v_submitted
      or v_attempt.expires_at is distinct from v_expires
      or exists(select 1 from public.cpa_attempt_answers a
        join public.cpa_subquestion_versions sv on sv.id=a.subquestion_version_id
        join public.cpa_subquestions s on s.id=sv.subquestion_id
        where a.attempt_id=v_attempt.id and a.answer_text<>coalesce(v_answers->>s.code,''))
    then raise exception 'Submission key conflict'; end if;
  else
    if v_selected then
      insert into public.cpa_attempt_learning_selections(attempt_id,learning_unit_id,selected_subquestion_ids,classification_version_ids)
        values(v_attempt.id,v_unit,v_codes,v_classes);
      insert into public.cpa_attempt_learning_questions(attempt_id,position,set_version_id,subquestion_version_id,classification_version_id)
        select v_attempt.id,c.ordinality::integer,v_set,v.source_subquestion_version_id,v.id
        from unnest(v_classes) with ordinality c(id,ordinality) join public.cpa_learning_question_versions v on v.id=c.id;
    end if;
    insert into public.cpa_attempt_answers(attempt_id,set_version_id,subquestion_version_id,answer_text)
      select v_attempt.id,v_set,sv.id,coalesce(v_answers->>s.code,'')
      from public.cpa_subquestion_versions sv join public.cpa_subquestions s on s.id=sv.subquestion_id
      where sv.set_version_id=v_set and (not v_selected or s.code=any(v_codes));
    if v_selected then update public.cpa_attempt_learning_selections set sealed_at=clock_timestamp() where attempt_id=v_attempt.id; end if;
  end if;
  return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,
    'current_grading_run_id',v_attempt.current_grading_run_id);
end;
$$;

create or replace function public.common_legacy_cpa_claim_grading_run(
  p_attempt_id uuid,p_owner_user_id uuid,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_attempt public.cpa_attempts%rowtype;
  v_run public.cpa_grading_runs%rowtype;
  v_run_no integer;
begin
  select * into v_attempt from public.cpa_attempts
    where id=p_attempt_id and owner_user_id=p_owner_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at <= clock_timestamp() then raise exception 'Submission expired'; end if;
  if v_attempt.status='completed' then
    return jsonb_build_object('state','completed','run_id',v_attempt.current_grading_run_id);
  end if;
  select * into v_run from public.cpa_grading_runs
    where attempt_id=p_attempt_id and status='running' for update;
  if found and v_run.lease_expires_at>clock_timestamp() then
    return jsonb_build_object('state','busy');
  end if;
  if v_run.id is not null then
    update public.cpa_grading_runs set status='failed',error_code='lease_expired',finished_at=clock_timestamp()
      where id=v_run.id;
  end if;
  if jsonb_typeof(p_metadata) is distinct from 'object'
    or nullif(p_metadata->>'engine_version','') is null
    or nullif(p_metadata->>'grading_contract_hash','') is null then
    raise exception 'Grading metadata required';
  end if;
  select coalesce(max(run_no),0)+1 into v_run_no from public.cpa_grading_runs where attempt_id=p_attempt_id;
  insert into public.cpa_grading_runs(attempt_id,set_version_id,run_no,run_kind,status,
    lease_token,lease_expires_at,engine_version,grading_contract_hash,prompt_hash,provider,model,max_points,started_at)
  select p_attempt_id,v_attempt.set_version_id,v_run_no,case when v_run_no=1 then 'initial' else 'retry' end,
    'running',gen_random_uuid(),clock_timestamp()+interval '3 minutes',p_metadata->>'engine_version',
    p_metadata->>'grading_contract_hash',p_metadata->>'prompt_hash',p_metadata->>'provider',p_metadata->>'model',
    (select sum(sq.max_points)::integer from public.cpa_attempt_answers a
      join public.cpa_subquestion_versions sq on sq.id=a.subquestion_version_id where a.attempt_id=p_attempt_id),
    clock_timestamp() from public.cpa_question_set_versions sv where sv.id=v_attempt.set_version_id
  returning * into v_run;
  update public.cpa_attempts set status='grading' where id=p_attempt_id;
  return jsonb_build_object('state','claimed','run_id',v_run.id,'lease_token',v_run.lease_token);
end;
$$;

create or replace function public.cpa_get_attempt_result(p_attempt_id uuid,p_owner_user_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_attempt public.cpa_attempts%rowtype; v_result jsonb;
begin
  select * into v_attempt from public.cpa_attempts where id=p_attempt_id and owner_user_id=p_owner_user_id;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at<=clock_timestamp() then raise exception 'Submission expired'; end if;
  if v_attempt.status='completed' then
    select jsonb_build_object('question_set_id',v_attempt.set_id,'score',gr.score,'max_points',gr.max_points,
      'security_flag',gr.security_flag,'subquestions',coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('subquestion_id',s.code,'prompt',coalesce(lv.standalone_prompt,sv.prompt),
          'learning_question_id',lv.learning_question_id,'classification_version_id',lv.id,'question_style',lv.question_style,'user_answer',a.answer_text,
          'score',sr.score,'max_points',sr.max_points,'model_answer',to_jsonb(ma.model_answer),
          'criteria',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'criterion_id',c.code,'verdict',cr.verdict,'quote',cr.quote,'reason',cr.reason,
            'claim',c.claim,'max_points',cr.max_points,'awarded_points',cr.awarded_points)) order by c.position)
            from public.cpa_criterion_grade_results cr join public.cpa_criteria c on c.id=cr.criterion_id
            where cr.grading_run_id=gr.id and cr.subquestion_version_id=sv.id),'[]'::jsonb))) order by coalesce(lq.position,sv.position))
        from public.cpa_subquestion_grade_results sr
        join public.cpa_subquestion_versions sv on sv.id=sr.subquestion_version_id
        join public.cpa_subquestions s on s.id=sv.subquestion_id
        join public.cpa_attempt_answers a on a.attempt_id=sr.attempt_id and a.subquestion_version_id=sv.id
        join public.cpa_subquestion_answers ma on ma.subquestion_version_id=sv.id
        left join public.cpa_attempt_learning_questions lq on lq.attempt_id=a.attempt_id and lq.subquestion_version_id=sv.id
        left join public.cpa_learning_question_versions lv on lv.id=lq.classification_version_id
        where sr.grading_run_id=gr.id),'[]'::jsonb)) into v_result
      from public.cpa_grading_runs gr where gr.id=v_attempt.current_grading_run_id and gr.status='completed';
    if v_result is null then raise exception 'Completed grading result missing'; end if;
  end if;
  return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.status,
    'submitted_at',v_attempt.submitted_at,'completed_at',v_attempt.completed_at,
    'expires_at',v_attempt.expires_at,'result',v_result) || coalesce((select jsonb_build_object(
      'learning_unit_id',learning_unit_id,'selected_subquestion_ids',to_jsonb(selected_subquestion_ids),
      'classification_version_ids',to_jsonb(classification_version_ids)) from public.cpa_attempt_learning_selections where attempt_id=p_attempt_id),'{}'::jsonb);
end;
$$;

create or replace function public.common_legacy_cpa_complete_grading_run(
  p_attempt_id uuid,p_owner_user_id uuid,p_run_id uuid,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_attempt public.cpa_attempts%rowtype;
  v_run public.cpa_grading_runs%rowtype;
  v_note public.cpa_review_items%rowtype;
  v_sub record;
  v_criterion record;
  v_jsub jsonb;
  v_jcriterion jsonb;
  v_raw jsonb := p_result->'raw_judgment';
  v_raw_sub jsonb;
  v_raw_criterion jsonb;
  v_verdict text;
  v_quote text;
  v_points integer;
  v_sub_score integer;
  v_total integer := 0;
  v_security text := p_result->>'security_flag';
  v_sub_security text;
  v_raw_injection boolean;
  v_raw_salad boolean;
  v_old_submitted timestamptz;
  v_old_attempt uuid;
  v_last_result_newer boolean;
  v_last_failure_newer boolean;
  v_reopen boolean;
  v_existing_exp bigint;
  v_event uuid;
  v_now timestamptz;
begin
  select * into v_attempt from public.cpa_attempts
    where id=p_attempt_id and owner_user_id=p_owner_user_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if v_attempt.expires_at<=clock_timestamp() then raise exception 'Submission expired'; end if;
  -- A duplicated completion never re-runs notebook processing or XP writes.
  if v_attempt.status='completed' then
    if v_attempt.current_grading_run_id<>p_run_id then raise exception 'Stale grading run'; end if;
    if not exists(select 1 from public.cpa_grading_runs where id=p_run_id and lease_token=p_lease_token)
      then raise exception 'Invalid grading lease'; end if;
    return public.cpa_get_attempt_result(p_attempt_id,p_owner_user_id);
  end if;
  select * into v_run from public.cpa_grading_runs where id=p_run_id and attempt_id=p_attempt_id for update;
  if not found or v_run.status<>'running' or v_run.lease_token is distinct from p_lease_token
    or v_run.lease_expires_at<=clock_timestamp() then raise exception 'Stale grading lease'; end if;
  if jsonb_typeof(p_result) is distinct from 'object'
    or p_result->>'question_set_id' is distinct from v_attempt.set_id
    or jsonb_typeof(p_result->'subquestions') is distinct from 'array'
    or v_security is null or v_security not in ('none','injection','keyword_salad') then
    raise exception 'Invalid grading result';
  end if;
  if jsonb_array_length(p_result->'subquestions')<>(select count(*) from public.cpa_attempt_answers where attempt_id=p_attempt_id)
    or (select count(distinct j->>'subquestion_id') from jsonb_array_elements(p_result->'subquestions') j)
      <>jsonb_array_length(p_result->'subquestions') then raise exception 'Grading subquestion coverage mismatch'; end if;
  if p_result->'max_points' is distinct from to_jsonb(v_run.max_points)
    or (coalesce((v_raw->>'injection_detected')::boolean,false) and v_security<>'injection') then
    raise exception 'Grading maximum or security mismatch';
  end if;
  if v_attempt.actor_kind='member' then
    if not exists(select 1 from public.cpa_question_bank_releases where validation_report ? 'learning_progress_initialized_at') then
      raise exception 'Learning progress requires initialization'; end if;
    -- The same user-row lock is used by manual notebook edits and all completions.
    -- It also serializes opening balance initialization and cache increments.
    select exp into v_existing_exp from public.cpa_users where id=p_owner_user_id for update;
    if not found then raise exception 'Member profile required'; end if;
    if not exists(select 1 from public.cpa_xp_events where user_id=p_owner_user_id and event_type='opening_balance') then
      if v_existing_exp<>0 then raise exception 'Learning progress requires initialization'; end if;
      insert into public.cpa_xp_events(user_id,event_type,amount,event_key,credited_at)
        values(p_owner_user_id,'opening_balance',0,'opening:'||p_owner_user_id::text,clock_timestamp());
    end if;
  end if;
  for v_sub in select sv.*,s.code,a.answer_text from public.cpa_subquestion_versions sv
    join public.cpa_subquestions s on s.id=sv.subquestion_id
    join public.cpa_attempt_answers a on a.subquestion_version_id=sv.id and a.attempt_id=p_attempt_id
    where sv.set_version_id=v_attempt.set_version_id order by sv.position
  loop
    select j into v_jsub from jsonb_array_elements(p_result->'subquestions') j where j->>'subquestion_id'=v_sub.code;
    if v_jsub is null or jsonb_typeof(v_jsub->'criteria') is distinct from 'array'
      or v_jsub->'user_answer' is distinct from to_jsonb(v_sub.answer_text)
      or v_jsub->'max_points' is distinct from to_jsonb(v_sub.max_points) then
      raise exception 'Answer or subquestion maximum mismatch'; end if;
    if jsonb_array_length(v_jsub->'criteria')<>(select count(*) from public.cpa_criteria where subquestion_version_id=v_sub.id)
      or (select count(distinct j->>'criterion_id') from jsonb_array_elements(v_jsub->'criteria') j)
        <>jsonb_array_length(v_jsub->'criteria') then raise exception 'Criterion coverage mismatch'; end if;
    v_raw_sub := null;
    if jsonb_typeof(v_raw->'subquestions')='array' then
      select j into v_raw_sub from jsonb_array_elements(v_raw->'subquestions') j where j->>'subquestion_id'=v_sub.code;
    end if;
    v_raw_injection := coalesce((v_raw_sub->>'injection_detected')::boolean,false);
    v_raw_salad := coalesce((v_raw_sub->>'salad_detected')::boolean,false);
    v_sub_security := case when v_security='injection' or v_raw_injection then 'injection'
      when v_security='keyword_salad' or v_raw_salad then 'keyword_salad' else 'none' end;
    -- Parent result rows exist before their criterion children. Values are checked
    -- before completion and the whole call rolls back if any later check fails.
    insert into public.cpa_subquestion_grade_results(grading_run_id,attempt_id,set_version_id,
      subquestion_version_id,score,max_points,raw_injection_detected,raw_salad_detected,effective_security_flag)
    values(p_run_id,p_attempt_id,v_attempt.set_version_id,v_sub.id,0,v_sub.max_points,
      v_raw_injection,v_raw_salad,v_sub_security);
    v_sub_score := 0;
    for v_criterion in select * from public.cpa_criteria where subquestion_version_id=v_sub.id order by position loop
      select j into v_jcriterion from jsonb_array_elements(v_jsub->'criteria') j where j->>'criterion_id'=v_criterion.code;
      if v_jcriterion is null then raise exception 'Unknown or missing criterion'; end if;
      v_verdict := v_jcriterion->>'verdict';
      v_quote := nullif(v_jcriterion->>'quote','');
      if v_verdict is null or v_verdict not in ('met','partial','not_met','contradicted')
        or (v_verdict='partial' and v_criterion.partial_points is null)
        or (v_sub_security='injection' and v_verdict<>'not_met') then
        raise exception 'Criterion verdict violates grading contract'; end if;
      v_points := case v_verdict when 'met' then v_criterion.max_points when 'partial' then v_criterion.partial_points else 0 end;
      if v_jcriterion->'max_points' is distinct from to_jsonb(v_criterion.max_points)
        or v_jcriterion->'awarded_points' is distinct from to_jsonb(v_points) then
        raise exception 'Criterion points mismatch'; end if;
      if v_verdict='not_met' then
        if v_quote is not null then raise exception 'Unmet criterion must not retain a quote'; end if;
      elsif v_quote is null or public.cpa_normalize_answer_quote(v_quote)=''
        or strpos(public.cpa_normalize_answer_quote(v_sub.answer_text),public.cpa_normalize_answer_quote(v_quote))=0 then
        raise exception 'Criterion quote is not present in the submitted answer';
      end if;
      v_raw_criterion := null;
      if jsonb_typeof(v_raw_sub->'verdicts')='array' then
        select j into v_raw_criterion from jsonb_array_elements(v_raw_sub->'verdicts') j where j->>'criterion_id'=v_criterion.code;
      end if;
      insert into public.cpa_criterion_grade_results(grading_run_id,attempt_id,set_version_id,subquestion_version_id,
        criterion_id,raw_verdict,raw_quote,raw_reason,verdict,quote,quote_verified,reason,adjustment_code,awarded_points,max_points)
      values(p_run_id,p_attempt_id,v_attempt.set_version_id,v_sub.id,v_criterion.id,
        v_raw_criterion->>'verdict',v_raw_criterion->>'quote',coalesce(v_raw_criterion->>'reason',
          case when v_jcriterion->>'reason' not in ('이 criterion은 부분점수를 허용하지 않음','AI가 제시한 인용을 사용자 답안에서 확인할 수 없음') then v_jcriterion->>'reason' end),
        v_verdict,v_quote,v_quote is not null,
        case when v_verdict='not_met' and v_jcriterion->>'reason' in
          ('이 criterion은 부분점수를 허용하지 않음','AI가 제시한 인용을 사용자 답안에서 확인할 수 없음') then v_jcriterion->>'reason' end,
        case when v_raw_criterion is not null and (v_raw_criterion->>'verdict') is distinct from v_verdict
          then 'server_validation' else null end,v_points,v_criterion.max_points);
      v_sub_score := v_sub_score+v_points;
    end loop;
    if v_jsub->'score' is distinct from to_jsonb(v_sub_score) or v_sub_score>v_sub.max_points then
      raise exception 'Subquestion total mismatch'; end if;
    update public.cpa_subquestion_grade_results set score=v_sub_score where grading_run_id=p_run_id and subquestion_version_id=v_sub.id;
    v_total := v_total+v_sub_score;
  end loop;
  if p_result->'score' is distinct from to_jsonb(v_total) or v_total>v_run.max_points
    or (select count(*) from public.cpa_subquestion_grade_results where grading_run_id=p_run_id)
      <>(select count(*) from public.cpa_attempt_answers where attempt_id=p_attempt_id)
  then raise exception 'Set total or answer coverage mismatch'; end if;

  v_now := clock_timestamp();
  update public.cpa_grading_runs set status='completed',score=v_total,security_flag=v_security,
    raw_injection_detected=(v_raw->>'injection_detected')::boolean,
    raw_salad_detected=(v_raw->>'salad_detected')::boolean,finished_at=v_now where id=p_run_id;
  update public.cpa_attempts set status='completed',completed_at=v_now,current_grading_run_id=p_run_id where id=p_attempt_id;

  if v_attempt.actor_kind='member' then
    for v_sub in select sv.id,sv.subquestion_id,sr.score,sr.max_points from public.cpa_subquestion_grade_results sr
      join public.cpa_subquestion_versions sv on sv.id=sr.subquestion_version_id where sr.grading_run_id=p_run_id loop
      if v_sub.score<v_sub.max_points then
        insert into public.cpa_review_items(user_id,subquestion_id,status,origin,memo,first_added_at,updated_at,state_changed_at)
        values(p_owner_user_id,v_sub.subquestion_id,'open','auto','',v_now,v_now,v_now)
        on conflict(user_id,subquestion_id) do nothing;
      end if;
      select * into v_note from public.cpa_review_items where user_id=p_owner_user_id and subquestion_id=v_sub.subquestion_id for update;
      if not found then continue; end if;
      select a.submitted_at,a.id into v_old_submitted,v_old_attempt from public.cpa_grading_runs r
        join public.cpa_attempts a on a.id=r.attempt_id where r.id=v_note.last_result_run_id;
      v_last_result_newer := not found or (v_attempt.submitted_at,v_attempt.id)>(v_old_submitted,v_old_attempt);
      select a.submitted_at,a.id into v_old_submitted,v_old_attempt from public.cpa_grading_runs r
        join public.cpa_attempts a on a.id=r.attempt_id where r.id=v_note.last_failed_run_id;
      v_last_failure_newer := v_sub.score<v_sub.max_points and
        (not found or (v_attempt.submitted_at,v_attempt.id)>(v_old_submitted,v_old_attempt));
      v_reopen := v_sub.score<v_sub.max_points and v_note.status<>'open' and
        (v_note.suppress_before is null or v_attempt.submitted_at>v_note.suppress_before);
      if v_last_result_newer or v_last_failure_newer or v_reopen then
        update public.cpa_review_items set
          last_result_run_id=case when v_last_result_newer then p_run_id else last_result_run_id end,
          last_result_subquestion_version_id=case when v_last_result_newer then v_sub.id else last_result_subquestion_version_id end,
          last_failed_run_id=case when v_last_failure_newer then p_run_id else last_failed_run_id end,
          last_failed_subquestion_version_id=case when v_last_failure_newer then v_sub.id else last_failed_subquestion_version_id end,
          status=case when v_reopen then 'open' else status end,
          state_changed_at=case when v_reopen then v_now else state_changed_at end,updated_at=v_now
        where id=v_note.id;
      end if;
    end loop;
    insert into public.cpa_xp_events(user_id,event_type,amount,source_attempt_id,source_grading_run_id,event_key,credited_at)
      values(p_owner_user_id,'submission_award',v_total,p_attempt_id,p_run_id,'submission:'||p_attempt_id::text,v_now)
      on conflict do nothing returning id into v_event;
    if v_event is null then raise exception 'Unexpected duplicate submission award'; end if;
    perform set_config('cpa.learning_progress_write','on',true);
    update public.cpa_users set exp=exp+v_total,level=1+(exp+v_total)/100 where id=p_owner_user_id;
    perform set_config('cpa.learning_progress_write','off',true);
  end if;
  return public.cpa_get_attempt_result(p_attempt_id,p_owner_user_id);
end;
$$;

create or replace function public.cpa_get_attempt_history(
  p_owner_user_id uuid,p_limit integer default 50,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language sql security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(h) order by h.submitted_at desc,h.id desc),'[]'::jsonb)
  from (select a.id,coalesce(ls.learning_unit_id,a.set_id) as question_set_id,a.set_id as source_set_id,sv.title,
    ls.learning_unit_id,ls.selected_subquestion_ids,ls.classification_version_ids,a.submitted_at,a.status,r.score,
    coalesce((select sum(sq.max_points)::integer from public.cpa_attempt_answers aa join public.cpa_subquestion_versions sq
      on sq.id=aa.subquestion_version_id where aa.attempt_id=a.id),sv.max_points) as max_points,a.expires_at from public.cpa_attempts a
    join public.cpa_question_set_versions sv on sv.id=a.set_version_id
    left join public.cpa_attempt_learning_selections ls on ls.attempt_id=a.id
    left join public.cpa_grading_runs r on r.id=a.current_grading_run_id
    where a.owner_user_id=p_owner_user_id and (a.expires_at is null or a.expires_at>clock_timestamp())
      and (p_before is null or (p_before_id is null and a.submitted_at<p_before)
        or (p_before_id is not null and (a.submitted_at,a.id)<(p_before,p_before_id)))
    order by a.submitted_at desc,a.id desc limit greatest(1,least(coalesce(p_limit,50),100))) h;
$$;

-- Notebook links use the current learning catalog. Result/failure run pointers
-- and their historical source/answer versions remain unchanged.
create or replace function public.cpa_get_review_items(p_owner_user_id uuid,p_status text default 'open')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_result jsonb;
begin
  if p_status is null or p_status not in ('open','resolved','removed','all') then raise exception 'Invalid review state'; end if;
  if not exists(select 1 from public.cpa_users u join auth.users a on a.id=u.id
    where u.id=p_owner_user_id and not coalesce(a.is_anonymous,false) and u.role in ('MEMBER','PRO','ADMIN'))
    then raise exception 'Member profile required'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc,q.id),'[]'::jsonb) into v_result
  from (select n.id,n.subquestion_id,case live.question_style when 'case' then s.set_id||'--case' when 'standard' then s.set_id||'--'||s.code||'--standard' else s.set_id end as question_set_id,
      coalesce(live.current_title,display.title) as title,coalesce(live.standalone_prompt,live.current_prompt,display.prompt) as prompt,
      live.learning_question_id,live.id as classification_version_id,live.question_style,
      n.status,n.memo,n.updated_at,r.attempt_id as last_attempt_id,failed.attempt_id as last_failed_attempt_id
    from public.cpa_review_items n join public.cpa_subquestions s on s.id=n.subquestion_id
    left join public.cpa_grading_runs r on r.id=n.last_result_run_id
    left join public.cpa_grading_runs failed on failed.id=n.last_failed_run_id
    join lateral (select sv.prompt,qv.title from public.cpa_subquestion_versions sv
      join public.cpa_question_set_versions qv on qv.id=sv.set_version_id
      where sv.subquestion_id=n.subquestion_id and qv.sealed_at is not null
      order by (sv.id=n.last_failed_subquestion_version_id) desc nulls last,
        (sv.id=n.last_result_subquestion_version_id) desc nulls last,qv.revision desc limit 1) display on true
    left join lateral (select lv.*,sq.prompt as current_prompt,qv.title as current_title
      from public.cpa_learning_questions lq join public.cpa_learning_question_versions lv on lv.learning_question_id=lq.id
      join public.cpa_question_bank_release_items ri on ri.set_version_id=lv.source_set_version_id
      join public.cpa_question_bank_releases br on br.id=ri.release_id and br.status='active' and br.published_at is not null
      join public.cpa_subquestion_versions sq on sq.id=lv.source_subquestion_version_id
      join public.cpa_question_set_versions qv on qv.id=lv.source_set_version_id
      where lq.source_subquestion_id=n.subquestion_id and lv.sealed_at is not null order by lv.revision desc limit 1) live on true
    where n.user_id=p_owner_user_id and (p_status='all' or n.status=p_status)) q;
  return v_result;
end;
$$;


-- Optional authored fields belong to the immutable source document. Editorial
-- learning metadata never backfills these columns on historical source rows.
alter table public.cpa_subquestion_versions
  add column authored_question_style text check(authored_question_style in ('standard','case')),
  add column authored_topic_ids text[] check(authored_topic_ids is null or cardinality(authored_topic_ids)>0);

create or replace function public.cpa_get_question_version_document(p_version_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $body$
 select jsonb_strip_nulls(jsonb_build_object(
  'schema_version',v.schema_version,'id',v.set_id,'type','linked_question_set','status',v.status,'title',v.title,
  'classification',jsonb_build_object('topic_id',v.topic_id,'part',v.part,'chapter',v.chapter,'domain',v.domain,'standards',v.standards,'tags',v.tags),
  'source_refs',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.code,'file',s.file_path,'title',s.title,'page',s.page_label,'source_quote',s.source_quote,'role',s.role,'content_hash',s.declared_quote_hash)) order by s.position),'[]') from public.cpa_question_sources s where s.set_version_id=v.id),
  'shared_context',jsonb_build_object('facts',v.shared_facts),
  'learning_order',(select jsonb_agg(l.code order by q.learning_position) from public.cpa_subquestion_versions q join public.cpa_subquestions l on l.id=q.subquestion_id where q.set_version_id=v.id),
  'subquestions',(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',l.code,'type',q.type,'prompt',q.prompt,'question_style',q.authored_question_style,'topic_ids',q.authored_topic_ids,
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

create or replace function public.cpa_get_public_question_version(p_version_id uuid) returns jsonb
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
  ) || jsonb_strip_nulls(jsonb_build_object('question_style',q.authored_question_style,'topic_ids',q.authored_topic_ids))
  || case when q.decision_options is not null then jsonb_build_object('decision',jsonb_build_object('options',q.decision_options)) else '{}'::jsonb end
  order by q.position) from public.cpa_subquestion_versions q join public.cpa_subquestions l on l.id=q.subquestion_id where q.set_version_id=v.id),
  'max_points',v.max_points
 ) from public.cpa_question_set_versions v where v.id=p_version_id and v.sealed_at is not null
$body$;

create or replace function public.cpa_import_question_bank(p_payload jsonb) returns jsonb
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
  if exists(select 1 from jsonb_array_elements(s->'subquestions') sub where sub ? 'question_style' or sub ? 'topic_ids') then
    if exists(select 1 from jsonb_array_elements(s->'subquestions') sub where
      jsonb_typeof(sub->'question_style') is distinct from 'string' or sub->>'question_style' not in ('standard','case')
      or jsonb_typeof(sub->'topic_ids') is distinct from 'array')
      then raise exception 'Every authored question requires style and topics'; end if;
    if (select count(distinct sub->>'question_style') from jsonb_array_elements(s->'subquestions') sub)<>1
      then raise exception 'Authored source cannot mix learning styles'; end if;
    if (s#>>'{subquestions,0,question_style}'='case' and jsonb_array_length(facts)=0)
      or (s#>>'{subquestions,0,question_style}'='standard' and jsonb_array_length(facts)<>0)
      then raise exception 'Authored question style and shared facts mismatch'; end if;
  end if;
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
   if q ? 'question_style' and (jsonb_typeof(q->'question_style') is distinct from 'string'
     or q->>'question_style' not in ('standard','case')) then raise exception 'Invalid authored question style'; end if;
   if q ? 'topic_ids' then
     perform public.cpa_json_text_array(q->'topic_ids');
     if jsonb_array_length(q->'topic_ids')=0
       or exists(select 1 from jsonb_array_elements_text(q->'topic_ids') t where t !~ '^(0[1-9]|1[0-9])$')
       or jsonb_array_length(q->'topic_ids')<>(select count(distinct t) from jsonb_array_elements_text(q->'topic_ids') t)
       then raise exception 'Invalid authored question topics'; end if;
   end if;
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
   insert into public.cpa_subquestion_versions(set_version_id,set_id,subquestion_id,position,learning_position,type,prompt,ordered,max_entries,overflow_policy,selection_type,selection_n,decision_options,answer_slots,max_points,authored_question_style,authored_topic_ids)
   values(version_id,s->>'id',logical_id,sq.position,order_position,q->>'type',q->>'prompt',(q#>>'{constraints,ordered}')::boolean,(q#>>'{constraints,max_entries}')::int,q#>>'{constraints,overflow_policy}','all',null,case when decision is null then null else public.cpa_json_text_array(decision->'options') end,slots,sub_points,q->>'question_style',case when q ? 'topic_ids' then public.cpa_json_text_array(q->'topic_ids') end) returning id into sub_version_id;
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

-- The new CLI uses one atomic RPC: a source import must not leave an active
-- release lacking its learning catalog when metadata validation fails.
create function public.cpa_import_learning_question_bank(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_bank jsonb; v_entry jsonb; v_hash text; v_entries jsonb:='[]'; v_rows jsonb; v_native record;
begin
  if jsonb_typeof(p_payload->'learning_classifications') is distinct from 'array'
    or jsonb_typeof(p_payload->'learning_topics') is distinct from 'array'
    then raise exception 'Complete learning catalog required with bank import'; end if;
  v_bank:=public.cpa_import_question_bank(p_payload);
  for v_entry in select j from jsonb_array_elements(p_payload->'learning_classifications') j loop
    select q.content_hash into v_hash from public.cpa_question_bank_release_items ri
      join public.cpa_question_set_versions q on q.id=ri.set_version_id
      where ri.release_id=(v_bank->>'release_id')::uuid and ri.set_id=v_entry->>'set_id';
    if not found then raise exception 'Learning source not present in imported release'; end if;
    if v_entry ? 'source_content_hash' and v_entry->>'source_content_hash' is distinct from v_hash
      then raise exception 'Learning source content hash mismatch'; end if;
    select sq.authored_question_style,sq.authored_topic_ids,sq.prompt into v_native
      from public.cpa_question_bank_release_items ri join public.cpa_subquestion_versions sq on sq.set_version_id=ri.set_version_id
      join public.cpa_subquestions s on s.id=sq.subquestion_id
      where ri.release_id=(v_bank->>'release_id')::uuid and ri.set_id=v_entry->>'set_id' and s.code=v_entry->>'subquestion_id';
    if not found then raise exception 'Learning source question not present in imported release'; end if;
    if v_native.authored_question_style is not null then
      if v_entry->>'question_style' is distinct from v_native.authored_question_style
        or (select array_agg(t order by t) from jsonb_array_elements_text(v_entry->'topic_ids') t)
          is distinct from (select array_agg(t order by t) from unnest(v_native.authored_topic_ids) t)
        or (v_native.authored_question_style='standard' and v_entry->>'standalone_prompt' is distinct from v_native.prompt)
        then raise exception 'Learning catalog differs from authored question metadata'; end if;
    end if;
    v_entries:=v_entries||jsonb_build_array(v_entry||jsonb_build_object('source_content_hash',v_hash));
  end loop;
  v_rows:=public.cpa_import_learning_classifications(jsonb_build_object('release_id',v_bank->>'release_id',
    'topics',p_payload->'learning_topics','entries',v_entries));
  return v_bank||jsonb_build_object('learning_classification_count',jsonb_array_length(v_rows));
end $$;

-- Default privileges in some existing projects grant browser roles table access;
-- remove those grants explicitly, in addition to enabling policy-free RLS.
do $$
declare t text;
begin
  foreach t in array array['cpa_learning_questions','cpa_learning_question_versions','cpa_learning_topics',
    'cpa_learning_question_topics','cpa_attempt_learning_selections','cpa_attempt_learning_questions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;
revoke all on function public.cpa_guard_learning_metadata(),public.cpa_guard_attempt_learning_selection(),
  public.cpa_guard_selected_attempt_answer() from public,anon,authenticated,service_role;
revoke all on function public.common_legacy_cpa_begin_attempt(jsonb),
  public.common_legacy_cpa_claim_grading_run(uuid,uuid,jsonb),
  public.common_legacy_cpa_complete_grading_run(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.cpa_import_learning_classifications(jsonb),
  public.cpa_get_learning_classifications(uuid,uuid[]),public.cpa_import_learning_question_bank(jsonb) from public,anon,authenticated;
grant execute on function public.cpa_import_learning_classifications(jsonb),
  public.cpa_get_learning_classifications(uuid,uuid[]),public.cpa_import_learning_question_bank(jsonb) to service_role;
commit;
