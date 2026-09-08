-- Local-reviewed learning schema. Apply only during the coordinated learning cutover.
begin;
set local lock_timeout = '5s';

-- PostgreSQL cannot widen a column referenced by a view. Preserve the known
-- compatibility view and its grants; unknown dependent views deliberately fail.
create temporary table cpa_learning_legacy_view_grants on commit drop as
select x.grantee, x.privilege_type, x.is_grantable
from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
where c.oid=to_regclass('public.user_cpa') and c.relkind='v';
do $body$
begin
 if to_regclass('public.user_cpa') is not null then
  if (select relkind from pg_class where oid='public.user_cpa'::regclass) <> 'v'
   or obj_description('public.user_cpa'::regclass,'pg_class') is distinct from 'CPA table-name compatibility view for public.cpa_users' then
   raise exception 'Unexpected user_cpa object; apply CPA prefix migration first';
  end if;
  drop view public.user_cpa;
 end if;
end $body$;
alter table public.cpa_users alter column exp type bigint, alter column level type bigint;
alter table public.cpa_users add constraint cpa_users_learning_nonnegative check (exp >= 0 and level >= 1);
do $body$
declare g record; role_name text;
begin
 if exists(select 1 from cpa_learning_legacy_view_grants) then
  create view public.user_cpa with (security_invoker=true) as select * from public.cpa_users;
  comment on view public.user_cpa is 'CPA table-name compatibility view for public.cpa_users';
  -- Supabase default grants can include the owner and additional project roles.
  -- Clear every newly inherited ACL entry before restoring the original list.
  for g in select distinct x.grantee from pg_class c
   cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
   where c.oid='public.user_cpa'::regclass loop
   role_name := case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end;
   execute format('revoke all on public.user_cpa from %s',role_name);
  end loop;
  revoke all on public.user_cpa from public;
  for g in select * from cpa_learning_legacy_view_grants loop
   role_name := case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end;
   execute format('grant %s on public.user_cpa to %s%s',g.privilege_type,role_name,case when g.is_grantable then ' with grant option' else '' end);
  end loop;
 end if;
end $body$;

create function public.cpa_guard_profile_insert() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $body$
begin
 if new.role is distinct from 'MEMBER' or new.exp is distinct from 0 or new.level is distinct from 1 then
  raise exception 'A new profile must start with MEMBER, exp 0 and level 1';
 end if;
 return new;
end $body$;
create trigger cpa_profile_insert_defaults before insert on public.cpa_users
for each row execute function public.cpa_guard_profile_insert();

create table public.cpa_question_sets (
 id text primary key check (id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
 created_at timestamptz not null default now(), archived_at timestamptz
);
create table public.cpa_subquestions (
 id uuid primary key default gen_random_uuid(), set_id text not null references public.cpa_question_sets(id),
 code text not null check (code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
 created_at timestamptz not null default now(), archived_at timestamptz,
 unique(set_id,code), unique(id,set_id)
);
create table public.cpa_question_set_versions (
 id uuid primary key default gen_random_uuid(), set_id text not null references public.cpa_question_sets(id),
 revision int not null check(revision>0), schema_version text not null check(schema_version='3.0'),
 status text not null check(status in ('needs_review','verified','published')),
 title text not null check(btrim(title)<>''), topic_id text not null check(topic_id ~ '^[0-9]{2}$'),
 part text not null, chapter text not null,
 domain text not null check(domain in ('audit','ethics','law','internal_control','other')),
 standards text[] not null, tags text[] not null, shared_facts jsonb not null check(jsonb_typeof(shared_facts)='array'),
 source_fidelity text not null check(source_fidelity in ('exact','normalized','reconstructed','excerpt')),
 review_status text not null check(review_status in ('needs_human_review','verified','published')),
 calculation_required boolean not null check(not calculation_required), verification_notes text[] not null,
 applicability jsonb not null default '{}' check(jsonb_typeof(applicability)='object'),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'), max_points int not null check(max_points>0),
 created_at timestamptz not null default now(), sealed_at timestamptz,
 unique(set_id,revision), unique(id,set_id)
);
create table public.cpa_subquestion_versions (
 id uuid primary key default gen_random_uuid(), set_version_id uuid not null, set_id text not null,
 subquestion_id uuid not null, position int not null check(position>0), learning_position int not null check(learning_position>0),
 type text not null check(type in ('descriptive','enumeration','judgment')), prompt text not null check(btrim(prompt)<>''),
 ordered boolean not null, max_entries int check(max_entries is null or max_entries>0),
 overflow_policy text not null check(overflow_policy in ('none','ignore_after_limit')), selection_type text not null check(selection_type='all'),
 selection_n int check(selection_n is null), decision_options text[],
 answer_slots jsonb not null check(jsonb_typeof(answer_slots)='array'), max_points int not null check(max_points>0),
 foreign key(set_version_id,set_id) references public.cpa_question_set_versions(id,set_id),
 foreign key(subquestion_id,set_id) references public.cpa_subquestions(id,set_id),
 unique(set_version_id,subquestion_id), unique(set_version_id,position), unique(set_version_id,learning_position), unique(id,set_version_id)
);
create table public.cpa_subquestion_answers (
 subquestion_version_id uuid primary key references public.cpa_subquestion_versions(id),
 model_answer text[] not null check(cardinality(model_answer)>0), decision_correct text
);
create table public.cpa_question_sources (
 id uuid primary key default gen_random_uuid(), set_version_id uuid not null references public.cpa_question_set_versions(id),
 code text not null check(btrim(code)<>''), position int not null check(position>0), file_path text not null check(btrim(file_path)<>''),
 title text, page_label text, role text not null check(role in ('question','answer','standard','practice')),
 source_quote text not null check(btrim(source_quote)<>''), declared_quote_hash text,
 quote_hash text not null check(quote_hash ~ '^[a-f0-9]{64}$'),
 document_hash text check(document_hash ~ '^[a-f0-9]{64}$'), edition_metadata jsonb not null default '{}' check(jsonb_typeof(edition_metadata)='object'),
 unique(set_version_id,code), unique(set_version_id,position), unique(id,set_version_id)
);
create table public.cpa_requirements (
 id uuid primary key default gen_random_uuid(), subquestion_version_id uuid not null, set_version_id uuid not null,
 code text not null check(btrim(code)<>''), position int not null check(position>0), source_id uuid not null,
 source_quote text not null check(btrim(source_quote)<>''), source_span text,
 foreign key(subquestion_version_id,set_version_id) references public.cpa_subquestion_versions(id,set_version_id),
 foreign key(source_id,set_version_id) references public.cpa_question_sources(id,set_version_id),
 unique(subquestion_version_id,code), unique(subquestion_version_id,position), unique(id,subquestion_version_id,set_version_id)
);
create table public.cpa_criteria (
 id uuid primary key default gen_random_uuid(), subquestion_version_id uuid not null, set_version_id uuid not null,
 code text not null check(btrim(code)<>''), position int not null check(position>0), requirement_id uuid not null,
 claim text not null check(btrim(claim)<>''), max_points smallint not null check(max_points in (1,2,3)), partial_points smallint,
 check((max_points=1 and partial_points is null) or (max_points>1 and partial_points is not null and partial_points>0 and partial_points<max_points)),
 foreign key(requirement_id,subquestion_version_id,set_version_id) references public.cpa_requirements(id,subquestion_version_id,set_version_id),
 unique(subquestion_version_id,code), unique(subquestion_version_id,position), unique(id,subquestion_version_id,set_version_id)
);
create table public.cpa_criterion_sources (
 criterion_id uuid not null, subquestion_version_id uuid not null, set_version_id uuid not null, source_id uuid not null,
 position int not null check(position>0), primary key(criterion_id,source_id), unique(criterion_id,position),
 foreign key(criterion_id,subquestion_version_id,set_version_id) references public.cpa_criteria(id,subquestion_version_id,set_version_id),
 foreign key(source_id,set_version_id) references public.cpa_question_sources(id,set_version_id)
);
create table public.cpa_criterion_facts (
 id uuid primary key default gen_random_uuid(), criterion_id uuid not null, subquestion_version_id uuid not null, set_version_id uuid not null,
 code text not null check(btrim(code)<>''), position int not null check(position>0),
 type text not null check(type in ('actor','condition','action','conclusion','number','negation')),
 expected text not null check(btrim(expected)<>''), normalized_expected text not null check(normalized_expected<>''),
 foreign key(criterion_id,subquestion_version_id,set_version_id) references public.cpa_criteria(id,subquestion_version_id,set_version_id),
 unique(criterion_id,code), unique(criterion_id,position), unique(subquestion_version_id,type,normalized_expected)
);
create table public.cpa_question_review_events (
 id uuid primary key default gen_random_uuid(), set_version_id uuid, set_id text not null references public.cpa_question_sets(id),
 event_type text not null check(event_type in ('review','publish','import_legacy')),
 from_status text, to_status text not null, evidence text not null check(btrim(evidence)<>''),
 reviewed_content_hash text, actor_user_id uuid references auth.users(id) on delete set null,
 occurred_at timestamptz, legacy_date date, legacy_entry_key text unique, imported_at timestamptz not null default now(),
 foreign key(set_version_id,set_id) references public.cpa_question_set_versions(id,set_id),
 check((event_type='import_legacy' and set_version_id is null and legacy_date is not null)
   or (event_type<>'import_legacy' and set_version_id is not null and reviewed_content_hash is not null and reviewed_content_hash ~ '^[a-f0-9]{64}$' and occurred_at is not null))
);
create table public.cpa_question_bank_releases (
 id uuid primary key default gen_random_uuid(), release_no bigint not null unique,
 status text not null check(status in ('draft','active','retired')),
 source_file_hash text not null check(source_file_hash ~ '^[a-f0-9]{64}$'),
 source_document text check(source_document is null or encode(sha256(convert_to(source_document,'UTF8')),'hex')=source_file_hash),
 bank_content_hash text not null unique check(bank_content_hash ~ '^[a-f0-9]{64}$'),
 public_content_hash text not null check(public_content_hash ~ '^[a-f0-9]{64}$'),
 validation_report jsonb not null default '{}' check(jsonb_typeof(validation_report)='object'),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), published_at timestamptz
);
create unique index cpa_one_active_release on public.cpa_question_bank_releases((true)) where status='active';
create table public.cpa_question_bank_release_items (
 release_id uuid not null references public.cpa_question_bank_releases(id), set_id text not null,
 set_version_id uuid not null, position int not null check(position>0),
 primary key(release_id,set_id), unique(release_id,position), unique(release_id,set_id,set_version_id),
 foreign key(set_version_id,set_id) references public.cpa_question_set_versions(id,set_id)
);
create table public.cpa_attempts (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
 actor_kind text not null check(actor_kind in ('member','guest')), release_id uuid not null, set_id text not null, set_version_id uuid not null,
 submission_key uuid not null, answers_hash text not null check(answers_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'queued' check(status in ('queued','grading','completed','failed')),
 submitted_at timestamptz not null default now(), completed_at timestamptz, expires_at timestamptz, current_grading_run_id uuid,
 check((actor_kind='member' and expires_at is null) or (actor_kind='guest' and expires_at is not null and expires_at=submitted_at+interval '168 hours')),
 check(status<>'completed' or (completed_at is not null and current_grading_run_id is not null)),
 foreign key(release_id,set_id,set_version_id) references public.cpa_question_bank_release_items(release_id,set_id,set_version_id),
 unique(owner_user_id,submission_key), unique(id,set_version_id), unique(id,owner_user_id)
);
create table public.cpa_attempt_answers (
 attempt_id uuid not null, set_version_id uuid not null, subquestion_version_id uuid not null,
 answer_text text not null check(octet_length(answer_text)<=20000), primary key(attempt_id,subquestion_version_id),
 foreign key(attempt_id,set_version_id) references public.cpa_attempts(id,set_version_id) on delete cascade,
 foreign key(subquestion_version_id,set_version_id) references public.cpa_subquestion_versions(id,set_version_id)
);
create table public.cpa_grading_runs (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null, set_version_id uuid not null,
 run_no int not null check(run_no>0), run_kind text not null check(run_kind in ('initial','retry','regrade')),
 status text not null check(status in ('running','completed','failed')), lease_token uuid not null default gen_random_uuid(),
 lease_expires_at timestamptz not null, engine_version text not null, grading_contract_hash text not null,
 prompt_hash text, provider text, model text, raw_injection_detected boolean, raw_salad_detected boolean,
 security_flag text check(security_flag in ('none','injection','keyword_salad')), score int check(score>=0),
 max_points int not null check(max_points>0), error_code text, started_at timestamptz not null default now(), finished_at timestamptz,
 check(score is null or score<=max_points), check(status<>'completed' or (score is not null and finished_at is not null)),
 foreign key(attempt_id,set_version_id) references public.cpa_attempts(id,set_version_id) on delete cascade,
 unique(attempt_id,run_no), unique(id,attempt_id), unique(id,attempt_id,set_version_id)
);
create unique index cpa_one_running_grading on public.cpa_grading_runs(attempt_id) where status='running';
alter table public.cpa_attempts add constraint cpa_attempt_current_run_fk
 foreign key(current_grading_run_id,id,set_version_id) references public.cpa_grading_runs(id,attempt_id,set_version_id)
 deferrable initially deferred;
create table public.cpa_subquestion_grade_results (
 grading_run_id uuid not null, attempt_id uuid not null, set_version_id uuid not null, subquestion_version_id uuid not null,
 score int not null check(score>=0), max_points int not null check(max_points>0 and score<=max_points),
 raw_injection_detected boolean not null, raw_salad_detected boolean not null,
 effective_security_flag text not null check(effective_security_flag in ('none','injection','keyword_salad')),
 primary key(grading_run_id,subquestion_version_id), unique(grading_run_id,attempt_id,set_version_id,subquestion_version_id),
 foreign key(grading_run_id,attempt_id,set_version_id) references public.cpa_grading_runs(id,attempt_id,set_version_id) on delete cascade,
 foreign key(attempt_id,subquestion_version_id) references public.cpa_attempt_answers(attempt_id,subquestion_version_id) on delete cascade
);
create table public.cpa_criterion_grade_results (
 grading_run_id uuid not null, attempt_id uuid not null, set_version_id uuid not null, subquestion_version_id uuid not null, criterion_id uuid not null,
 raw_verdict text check(raw_verdict in ('met','partial','not_met','contradicted')), raw_quote text, raw_reason text,
 verdict text not null check(verdict in ('met','partial','not_met','contradicted')), quote text, quote_verified boolean not null,
 reason text, adjustment_code text, awarded_points smallint not null check(awarded_points>=0),
 max_points smallint not null check(max_points in (1,2,3) and awarded_points<=max_points),
 primary key(grading_run_id,criterion_id),
 foreign key(grading_run_id,attempt_id,set_version_id,subquestion_version_id)
  references public.cpa_subquestion_grade_results(grading_run_id,attempt_id,set_version_id,subquestion_version_id) on delete cascade,
 foreign key(criterion_id,subquestion_version_id,set_version_id) references public.cpa_criteria(id,subquestion_version_id,set_version_id),
 check((verdict='not_met' and awarded_points=0 and quote is null) or (verdict<>'not_met' and quote_verified and quote is not null)),
 check(verdict<>'contradicted' or awarded_points=0), check(verdict<>'met' or awarded_points=max_points)
);
create table public.cpa_review_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.cpa_users(id) on delete cascade,
 subquestion_id uuid not null references public.cpa_subquestions(id), status text not null check(status in ('open','resolved','removed')),
 origin text not null check(origin in ('auto','manual')), memo text not null default '',
 first_added_at timestamptz not null default now(), updated_at timestamptz not null default now(), state_changed_at timestamptz not null default now(),
 suppress_before timestamptz, last_result_run_id uuid, last_result_subquestion_version_id uuid, last_failed_run_id uuid, last_failed_subquestion_version_id uuid,
 unique(user_id,subquestion_id),
 check((last_result_run_id is null)=(last_result_subquestion_version_id is null)),
 check((last_failed_run_id is null)=(last_failed_subquestion_version_id is null)),
 foreign key(last_result_run_id,last_result_subquestion_version_id) references public.cpa_subquestion_grade_results(grading_run_id,subquestion_version_id) on delete set null,
 foreign key(last_failed_run_id,last_failed_subquestion_version_id) references public.cpa_subquestion_grade_results(grading_run_id,subquestion_version_id) on delete set null
);
create table public.cpa_xp_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.cpa_users(id) on delete cascade,
 event_type text not null check(event_type in ('opening_balance','submission_award','adjustment')), amount bigint not null,
 source_attempt_id uuid, source_grading_run_id uuid, related_event_id uuid, event_key text not null unique,
 reason text, created_by uuid references auth.users(id) on delete set null, credited_at timestamptz not null default now(), unique(id,user_id),
 foreign key(source_attempt_id,user_id) references public.cpa_attempts(id,owner_user_id) on delete cascade,
 foreign key(source_grading_run_id,source_attempt_id) references public.cpa_grading_runs(id,attempt_id) on delete cascade,
 foreign key(related_event_id,user_id) references public.cpa_xp_events(id,user_id) on delete cascade,
 check((event_type='opening_balance' and amount>=0 and source_attempt_id is null and source_grading_run_id is null and related_event_id is null)
  or (event_type='submission_award' and amount>=0 and source_attempt_id is not null and source_grading_run_id is not null and related_event_id is null)
  or (event_type='adjustment' and source_attempt_id is null and source_grading_run_id is null and related_event_id is not null and reason is not null))
);
create unique index cpa_xp_one_award on public.cpa_xp_events(source_attempt_id) where event_type='submission_award';
create unique index cpa_xp_one_opening_balance on public.cpa_xp_events(user_id) where event_type='opening_balance';
create index cpa_attempt_history on public.cpa_attempts(owner_user_id,submitted_at desc,id desc);
create index cpa_guest_expiry on public.cpa_attempts(expires_at,id) where actor_kind='guest';
create index cpa_run_leases on public.cpa_grading_runs(lease_expires_at) where status='running';
create index cpa_review_history on public.cpa_review_items(user_id,status,updated_at desc,id);
create index cpa_xp_history on public.cpa_xp_events(user_id,credited_at desc,id);
create index cpa_xp_period on public.cpa_xp_events(credited_at,user_id) include(amount) where event_type='submission_award';
create index cpa_user_ranking on public.cpa_users(exp desc,created_at,id);

-- Check both source and destination parents, including INSERT: a published
-- version must not acquire a new child or lose one by reparenting.
create function public.cpa_guard_sealed_content() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare row_data jsonb; version_id uuid; release_id uuid; direction int;
begin
 for direction in 1..2 loop
  if (direction=1 and tg_op='INSERT') or (direction=2 and tg_op='DELETE') then continue; end if;
  if direction=1 then row_data:=to_jsonb(old); else row_data:=to_jsonb(new); end if;
  if tg_table_name='cpa_question_set_versions' then
   if direction=1 and old.sealed_at is not null then
    if tg_op='DELETE' or (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
     raise exception 'Sealed question version is immutable';
    end if;
   end if;
  elsif tg_table_name='cpa_question_bank_release_items' then
   release_id:=(row_data->>'release_id')::uuid;
   if exists(select 1 from public.cpa_question_bank_releases r where r.id=release_id and r.published_at is not null) then
    raise exception 'Published release items are immutable';
   end if;
  else
   version_id:=(row_data->>'set_version_id')::uuid;
   if version_id is null then
    select s.set_version_id into version_id from public.cpa_subquestion_versions s where s.id=(row_data->>'subquestion_version_id')::uuid;
   end if;
   if exists(select 1 from public.cpa_question_set_versions v where v.id=version_id and v.sealed_at is not null) then
    raise exception 'Sealed question children are immutable';
   end if;
  end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end $body$;
create function public.cpa_guard_logical_identity() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $body$
begin
 if new.id is distinct from old.id or (tg_table_name='cpa_subquestions' and
  ((to_jsonb(new)->'set_id') is distinct from (to_jsonb(old)->'set_id') or (to_jsonb(new)->'code') is distinct from (to_jsonb(old)->'code'))) then
  raise exception 'Question logical identity is immutable';
 end if;
 return new;
end $body$;
create trigger cpa_set_identity before update on public.cpa_question_sets for each row execute function public.cpa_guard_logical_identity();
create trigger cpa_subquestion_identity before update on public.cpa_subquestions for each row execute function public.cpa_guard_logical_identity();
create function public.cpa_guard_review_event() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $body$
begin
 -- FK anonymisation on account deletion may clear only the actor.
 if tg_op='UPDATE' and old.actor_user_id is not null and new.actor_user_id is null and
  (to_jsonb(old)-'actor_user_id')=(to_jsonb(new)-'actor_user_id') then return new; end if;
 raise exception 'Question review events are append-only';
end $body$;
create trigger cpa_review_event_immutable before update or delete on public.cpa_question_review_events
for each row execute function public.cpa_guard_review_event();
do $body$
declare t text;
begin
 foreach t in array array['cpa_question_set_versions','cpa_subquestion_versions','cpa_subquestion_answers','cpa_question_sources','cpa_requirements','cpa_criteria','cpa_criterion_sources','cpa_criterion_facts','cpa_question_bank_release_items'] loop
  execute format('create trigger cpa_sealed_content before insert or update or delete on public.%I for each row execute function public.cpa_guard_sealed_content()',t);
 end loop;
 foreach t in array array['cpa_question_sets','cpa_subquestions','cpa_question_set_versions','cpa_subquestion_versions','cpa_subquestion_answers','cpa_question_sources','cpa_requirements','cpa_criteria','cpa_criterion_sources','cpa_criterion_facts','cpa_question_review_events','cpa_question_bank_releases','cpa_question_bank_release_items','cpa_attempts','cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results','cpa_review_items','cpa_xp_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $body$;
revoke all on function public.cpa_guard_profile_insert(), public.cpa_guard_sealed_content(), public.cpa_guard_logical_identity(), public.cpa_guard_review_event() from public,anon,authenticated;
commit;
