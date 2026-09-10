-- Canonical shared-DB migration. The CTA repository carries an identical copy.
-- Apply once, after both services' 2026-09-09 schema, with both applications stopped.
-- No existing Auth account is deleted. See docs/common-account-database.md.
begin;
set local lock_timeout = '5s';

create table public.common_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (nickname ~ '^[가-힣A-Za-z0-9]{2,12}$'),
  account_status text not null default 'active' check (account_status in ('active','locked','deleting')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index common_profiles_nickname_ci on public.common_profiles(lower(nickname));
alter table public.common_profiles enable row level security;
revoke all on public.common_profiles from public,anon,authenticated;
grant select on public.common_profiles to authenticated;
grant all on public.common_profiles to service_role;
create policy common_profiles_own_read on public.common_profiles for select to authenticated using(id=(select auth.uid()));

alter table public.cpa_users
  add column membership_status text not null default 'active' check(membership_status in ('active','suspended','withdrawing','withdrawn')),
  add column membership_version bigint not null default 1 check(membership_version>0),
  add column is_service_admin boolean not null default false,
  add column rejoin_blocked boolean not null default false;
alter table public.cta_user
  add column membership_status text not null default 'active' check(membership_status in ('active','suspended','withdrawing','withdrawn')),
  add column membership_version bigint not null default 1 check(membership_version>0),
  add column is_service_admin boolean not null default false,
  add column rejoin_blocked boolean not null default false;
update public.cpa_users set is_service_admin=(role='ADMIN');
update public.cta_user set is_service_admin=(tier='admin');
-- Existing compatibility views inherit base-table permissions, so revoke writes at both layers.
revoke insert,update,delete on public.cpa_users,public.cta_user from public,anon,authenticated;
do $$ begin
  if to_regclass('public.user_cpa') is not null then
    revoke insert,update,delete on public.user_cpa from public,anon,authenticated;
  end if;
end $$;

create function public.common_ensure_profile(p_user_id uuid,p_nickname text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user auth.users%rowtype; v_profile public.common_profiles%rowtype; v_name text;
begin
  select * into v_user from auth.users where id=p_user_id for update;
  if not found or coalesce(v_user.is_anonymous,false) then raise exception 'COMMON_AUTH_REQUIRED'; end if;
  select * into v_profile from public.common_profiles where id=p_user_id;
  if found then return to_jsonb(v_profile); end if;
  v_name:=btrim(coalesce(p_nickname,v_user.raw_user_meta_data->>'nickname',v_user.raw_user_meta_data->>'username',''));
  if v_name='' then
    loop
      v_name:='user'||substr(md5(gen_random_uuid()::text),1,8);
      exit when not exists(select 1 from public.common_profiles where lower(nickname)=lower(v_name));
    end loop;
  end if;
  if v_name !~ '^[가-힣A-Za-z0-9]{2,12}$' then raise exception 'COMMON_INVALID_NICKNAME'; end if;
  insert into public.common_profiles(id,nickname) values(p_user_id,v_name) returning * into v_profile;
  return to_jsonb(v_profile);
end $$;

-- Keep existing users working without implicitly enrolling them in another service.
-- If the two old nickname namespaces collide, use a fresh common nickname for the
-- later account; record/export this mapping before rollout if keeping old accounts.
do $$ declare u record; v_name text;
begin
  for u in select a.id,coalesce(t.nickname,c.username,a.raw_user_meta_data->>'nickname') as nickname
    from auth.users a left join public.cta_user t on t.id=a.id left join public.cpa_users c on c.id=a.id
    where not coalesce(a.is_anonymous,false) order by a.created_at,a.id loop
    v_name:=btrim(u.nickname);
    if v_name is null or v_name !~ '^[가-힣A-Za-z0-9]{2,12}$'
      or exists(select 1 from public.common_profiles where lower(nickname)=lower(v_name)) then
      v_name:='user'||substr(md5(u.id::text),1,8);
      while exists(select 1 from public.common_profiles where lower(nickname)=lower(v_name)) loop
        v_name:='user'||substr(md5(gen_random_uuid()::text),1,8);
      end loop;
    end if;
    perform public.common_ensure_profile(u.id,v_name);
  end loop;
end $$;

-- The old Auth trigger function used to enroll every non-anonymous user into CTA.
-- Existing trigger attachments can remain; profile creation is idempotent.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not coalesce(new.is_anonymous,false) then perform public.common_ensure_profile(new.id,null); end if;
  return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgfoid='public.handle_new_user()'::regprocedure and not tgisinternal) then
    create trigger common_auth_profile_created after insert on auth.users for each row execute function public.handle_new_user();
  end if;
end $$;

-- Nickname/email copies are compatibility projections, never separately writable identities.
create function public.common_sync_profile()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.cpa_users set username=new.nickname where id=new.id and username is distinct from new.nickname;
  update public.cta_user set nickname=new.nickname where id=new.id and nickname is distinct from new.nickname;
  return new;
end $$;
create trigger common_profile_projection after update of nickname on public.common_profiles
for each row execute function public.common_sync_profile();
-- CTA nickname was globally unique in its old namespace. Two-phase projection also
-- handles users whose previous CPA/CTA names would otherwise swap during backfill.
update public.cta_user set nickname='x'||substr(md5(gen_random_uuid()::text),1,11);
update public.cpa_users set username='x'||substr(md5(gen_random_uuid()::text),1,11);
update public.cta_user t set nickname=p.nickname from public.common_profiles p where t.id=p.id;
update public.cpa_users c set username=p.nickname from public.common_profiles p where c.id=p.id;

create function public.common_update_nickname(p_user_id uuid,p_nickname text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.common_profiles%rowtype;
begin
  if btrim(p_nickname) is null or btrim(p_nickname) !~ '^[가-힣A-Za-z0-9]{2,12}$' then raise exception 'COMMON_INVALID_NICKNAME'; end if;
  update public.common_profiles set nickname=btrim(p_nickname),updated_at=now()
    where id=p_user_id and account_status='active' returning * into p;
  if not found then raise exception 'COMMON_ACCOUNT_UNAVAILABLE'; end if;
  return to_jsonb(p);
end $$;

create function public.common_sync_auth_email()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  update public.cta_user set email=new.email where id=new.id;
  return new;
end $$;
create trigger common_auth_email_projection after update of email on auth.users
for each row execute function public.common_sync_auth_email();

create function public.common_assert_service_access(p_user_id uuid,p_service text,p_membership_version bigint default null)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint; v_status text;
begin
  if p_service not in ('cpa','cta') or p_service is null then raise exception 'COMMON_INVALID_SERVICE'; end if;
  perform 1 from public.common_profiles p join auth.users a on a.id=p.id
    where p.id=p_user_id and p.account_status='active' and not coalesce(a.is_anonymous,false)
      and a.email_confirmed_at is not null for update of p;
  if not found then raise exception 'COMMON_ACCOUNT_UNAVAILABLE'; end if;
  if p_service='cpa' then
    select membership_status,membership_version into v_status,v_version from public.cpa_users where id=p_user_id for update;
  else
    select membership_status,membership_version into v_status,v_version from public.cta_user where id=p_user_id for update;
  end if;
  if v_status is distinct from 'active' then raise exception 'COMMON_SERVICE_INACTIVE'; end if;
  if p_membership_version is not null and p_membership_version<>v_version then raise exception 'COMMON_STALE_MEMBERSHIP'; end if;
  return v_version;
end $$;

create function public.common_join_service(p_user_id uuid,p_service text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.common_profiles%rowtype; v_row jsonb; v_code text;
begin
  if p_service not in ('cpa','cta') or p_service is null then raise exception 'COMMON_INVALID_SERVICE'; end if;
  select cp.* into p from public.common_profiles cp join auth.users a on a.id=cp.id
    where cp.id=p_user_id and cp.account_status='active' and not coalesce(a.is_anonymous,false)
      and a.email_confirmed_at is not null for update of cp;
  if not found then raise exception 'COMMON_VERIFIED_ACCOUNT_REQUIRED'; end if;
  if p_service='cpa' then
    select to_jsonb(c) into v_row from public.cpa_users c where id=p_user_id for update;
  else
    select to_jsonb(c) into v_row from public.cta_user c where id=p_user_id for update;
  end if;
  if v_row->>'membership_status'='active' then return v_row; end if;
  if v_row is not null and (v_row->>'membership_status'<>'withdrawn' or (v_row->>'rejoin_blocked')::boolean) then
    raise exception 'COMMON_REJOIN_UNAVAILABLE';
  end if;
  perform set_config('common.membership_write',p_user_id::text,true);
  if p_service='cpa' then
    insert into public.cpa_users(id,username,role,exp,level) values(p_user_id,p.nickname,'MEMBER',0,1)
      on conflict(id) do update set membership_status='active',membership_version=public.cpa_users.membership_version+1
      returning to_jsonb(cpa_users) into v_row;
  else
    loop
      v_code:=public.generate_referral_code();
      exit when not exists(select 1 from public.cta_user where referral_code=v_code);
    end loop;
    insert into public.cta_user(id,email,nickname,tier,exp,referral_code)
      select p_user_id,email,p.nickname,'member',0,v_code from auth.users where id=p_user_id
      on conflict(id) do update set membership_status='active',membership_version=public.cta_user.membership_version+1
      returning to_jsonb(cta_user) into v_row;
  end if;
  perform set_config('common.membership_write','',true);
  return v_row;
end $$;

create function public.common_guard_service_profile()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.common_profiles%rowtype;
begin
  select * into p from public.common_profiles where id=new.id;
  if not found then raise exception 'COMMON_PROFILE_REQUIRED'; end if;
  if tg_op='INSERT' or (new.membership_status,new.membership_version) is distinct from (old.membership_status,old.membership_version) then
    if current_setting('common.membership_write',true) is distinct from new.id::text then
      -- Explicit service suspension is an operational action, not a join.
      if tg_op='INSERT' or not (new.membership_status='suspended' and new.membership_version=old.membership_version) then
        raise exception 'COMMON_USE_MEMBERSHIP_RPC';
      end if;
    end if;
  end if;
  if new.membership_status='suspended' then new.rejoin_blocked:=true; end if;
  if tg_table_name='cpa_users' then
    new.username:=p.nickname;
    if new.membership_status<>'active' or p.account_status<>'active' then new.role:='MEMBER'; end if;
  else
    new.nickname:=p.nickname; select email into new.email from auth.users where id=new.id;
    if new.membership_status<>'active' or p.account_status<>'active' then new.tier:='member'; end if;
  end if;
  return new;
end $$;
create trigger common_service_profile_guard before insert or update on public.cpa_users for each row execute function public.common_guard_service_profile();
create trigger common_service_profile_guard before insert or update on public.cta_user for each row execute function public.common_guard_service_profile();

-- Financial rows survive final Auth removal, while service withdrawal retains the
-- membership row itself (including referral eligibility / suspension tombstones).
do $$ declare t text; c text; fk record;
begin
  for t,c in select * from (values ('cta_subscription','user_id'),('cta_payment_log','user_id'),
    ('cta_pro_reward','user_id'),('cta_referral','referrer_id'),('cta_referral','referee_id')) v(t,c) loop
    for fk in select k.conname from pg_constraint k join pg_attribute a
      on a.attrelid=k.conrelid and a.attnum=any(k.conkey)
      where k.conrelid=('public.'||t)::regclass and k.contype='f' and a.attname=c
        and k.confrelid='public.cta_user'::regclass loop
      execute format('alter table public.%I drop constraint %I',t,fk.conname);
    end loop;
    execute format('alter table public.%I alter column %I drop not null',t,c);
    execute format('alter table public.%I add constraint %I foreign key(%I) references public.cta_user(id) on delete set null',t,t||'_'||c||'_retained_fk',c);
  end loop;
end $$;

alter table public.cpa_attempts add column membership_version bigint;
alter table public.cta_grading_attempt add column membership_version bigint;
alter table public.cta_problem_assist add column membership_version bigint;
alter table public.cta_subscription add column membership_version bigint not null default 1,
  add column withdrawal_started_at timestamptz;
alter table public.cta_referral add column referrer_membership_version bigint not null default 1,
  add column referee_membership_version bigint not null default 1;
alter table public.cta_payment_log add column requires_refund_review boolean not null default false,
  add column membership_version bigint not null default 1;
alter table public.cpa_attempts disable trigger cpa_attempt_immutable;
update public.cpa_attempts set membership_version=1 where actor_kind='member';
alter table public.cpa_attempts enable trigger cpa_attempt_immutable;
update public.cta_grading_attempt g set membership_version=1 from auth.users a where a.id=g.user_id and not coalesce(a.is_anonymous,false);
update public.cta_problem_assist g set membership_version=1 from auth.users a where a.id=g.user_id and not coalesce(a.is_anonymous,false);

-- Minimal quota receipts contain no answers/notes. Withdraw/rejoin cannot replenish
-- the current quota window. They are removed on full Auth deletion.
create table public.cta_usage_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('grade','hint')), receipt_key text not null,
  used_at timestamptz not null, primary key(user_id,kind,receipt_key)
);
create index cta_usage_receipts_window on public.cta_usage_receipts(user_id,kind,used_at);
alter table public.cta_usage_receipts enable row level security;
revoke all on public.cta_usage_receipts from public,anon,authenticated;
grant all on public.cta_usage_receipts to service_role;

create function public.common_guard_learning_membership()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_owner uuid; v_service text; v_guest boolean; v_expected bigint;
begin
  if tg_table_name='cpa_attempts' then
    v_owner:=new.owner_user_id; v_service:='cpa'; v_guest:=new.actor_kind='guest';
  elsif tg_table_name in ('cpa_kicpa_jobs_subscribers','cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription') then
    v_owner:=new.user_id; v_service:='cpa'; v_guest:=false;
  else
    v_owner:=new.user_id; v_service:='cta';
    select coalesce(is_anonymous,false) into v_guest from auth.users where id=v_owner;
    if not found then raise exception 'COMMON_AUTH_REQUIRED'; end if;
  end if;
  if tg_op='UPDATE' and new.membership_version is distinct from old.membership_version then raise exception 'COMMON_STALE_MEMBERSHIP'; end if;
  if not coalesce(v_guest,false) then
    v_expected:=coalesce(new.membership_version,nullif(current_setting('common.operation_version',true),'')::bigint);
    if v_expected is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
    new.membership_version:=public.common_assert_service_access(v_owner,v_service,v_expected);
  else new.membership_version:=null;
  end if;
  return new;
end $$;
create trigger common_learning_membership before insert or update on public.cpa_attempts for each row execute function public.common_guard_learning_membership();
create trigger common_learning_membership before insert or update on public.cta_grading_attempt for each row execute function public.common_guard_learning_membership();
create trigger common_learning_membership before insert or update on public.cta_problem_assist for each row execute function public.common_guard_learning_membership();
do $$ declare t text;
begin
  foreach t in array array['cpa_kicpa_jobs_subscribers','cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I add column membership_version bigint',t);
      execute format('update public.%I set membership_version=1',t);
      -- No INSERT default: old clients cannot silently guess a membership epoch.
      execute format('create trigger common_learning_membership before insert or update on public.%I for each row execute function public.common_guard_learning_membership()',t);
    end if;
  end loop;
end $$;

-- Preserve the tested grading implementation behind a narrow membership boundary.
alter function public.cpa_begin_attempt(jsonb) rename to common_legacy_cpa_begin_attempt;
create function public.cpa_begin_attempt(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint; v_result jsonb;
begin
  if p_payload->>'actor_kind'='member' then
    v_version:=nullif(p_payload->>'membership_version','')::bigint;
    if v_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
    perform public.common_assert_service_access((p_payload->>'owner_user_id')::uuid,'cpa',v_version);
    perform set_config('common.operation_version',v_version::text,true);
  end if;
  v_result:=public.common_legacy_cpa_begin_attempt(p_payload);
  perform set_config('common.operation_version','',true);
  return v_result;
end $$;

create function public.common_assert_cpa_attempt(p_attempt_id uuid,p_owner_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare a public.cpa_attempts%rowtype;
begin
  select * into a from public.cpa_attempts where id=p_attempt_id and owner_user_id=p_owner_user_id;
  if not found then raise exception 'Attempt not found'; end if;
  if a.actor_kind='member' then perform public.common_assert_service_access(p_owner_user_id,'cpa',a.membership_version); end if;
end $$;

alter function public.cpa_claim_grading_run(uuid,uuid,jsonb) rename to common_legacy_cpa_claim_grading_run;
create function public.cpa_claim_grading_run(p_attempt_id uuid,p_owner_user_id uuid,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.common_assert_cpa_attempt(p_attempt_id,p_owner_user_id);
  return public.common_legacy_cpa_claim_grading_run(p_attempt_id,p_owner_user_id,p_metadata);
end $$;
alter function public.cpa_complete_grading_run(uuid,uuid,uuid,uuid,jsonb) rename to common_legacy_cpa_complete_grading_run;
create function public.cpa_complete_grading_run(p_attempt_id uuid,p_owner_user_id uuid,p_run_id uuid,p_lease_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.common_assert_cpa_attempt(p_attempt_id,p_owner_user_id);
  return public.common_legacy_cpa_complete_grading_run(p_attempt_id,p_owner_user_id,p_run_id,p_lease_token,p_result);
end $$;
alter function public.cpa_fail_grading_run(uuid,uuid,uuid,uuid,text) rename to common_legacy_cpa_fail_grading_run;
create function public.cpa_fail_grading_run(p_attempt_id uuid,p_owner_user_id uuid,p_run_id uuid,p_lease_token uuid,p_error_code text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.common_assert_cpa_attempt(p_attempt_id,p_owner_user_id);
  return public.common_legacy_cpa_fail_grading_run(p_attempt_id,p_owner_user_id,p_run_id,p_lease_token,p_error_code);
end $$;
alter function public.cpa_update_review_item(uuid,uuid,text,text) rename to common_legacy_cpa_update_review_item;
create function public.cpa_update_review_item(p_owner_user_id uuid,p_subquestion_id uuid,p_status text,p_memo text default null,p_membership_version bigint default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
  perform public.common_assert_service_access(p_owner_user_id,'cpa',p_membership_version);
  return public.common_legacy_cpa_update_review_item(p_owner_user_id,p_subquestion_id,p_status,p_memo);
end $$;

create function public.common_cta_hint_usage(p_user_id uuid)
returns integer language sql stable security definer set search_path=pg_catalog,public as $$
  select count(distinct problem_key)::integer from (
    select problem_id::text as problem_key from public.cta_problem_assist
      where user_id=p_user_id and hint_used_at >= date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'
    union
    select receipt_key from public.cta_usage_receipts where user_id=p_user_id and kind='hint'
      and used_at >= date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'
  ) q;
$$;
alter function public.consume_hint_quota(uuid,bigint,int) rename to common_legacy_consume_hint_quota;
create function public.consume_hint_quota(p_user_id uuid,p_problem_id bigint,p_limit integer,p_membership_version bigint default null)
returns table(allowed boolean,used_count integer,already_used boolean)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_today timestamptz:=date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'; v_used integer; v_already boolean;
begin
  if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
  perform public.common_assert_service_access(p_user_id,'cta',p_membership_version);
  if p_limit is not null and p_limit<0 then raise exception 'invalid hint limit'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||v_today::text,0));
  v_used:=public.common_cta_hint_usage(p_user_id);
  select exists(select 1 from public.cta_problem_assist where user_id=p_user_id and problem_id=p_problem_id and hint_used_at>=v_today)
    or exists(select 1 from public.cta_usage_receipts where user_id=p_user_id and kind='hint' and receipt_key=p_problem_id::text and used_at>=v_today) into v_already;
  if not v_already and p_limit is not null and v_used>=p_limit then return query select false,v_used,false; return; end if;
  insert into public.cta_problem_assist(user_id,problem_id,hint_used_at,membership_version)
    values(p_user_id,p_problem_id,now(),p_membership_version)
    on conflict(user_id,problem_id) do update set hint_used_at=excluded.hint_used_at;
  return query select true,case when v_already then v_used else v_used+1 end,v_already;
end $$;

alter function public.reserve_grading_attempt(uuid,bigint,jsonb,boolean,int,timestamptz) rename to common_legacy_reserve_grading_attempt;
create function public.reserve_grading_attempt(p_user_id uuid,p_problem_id bigint,p_answers_json jsonb,p_hint_used boolean,
  p_limit integer,p_window_start timestamptz,p_membership_version bigint default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_retained integer; v_result uuid; v_guest boolean;
begin
  select coalesce(is_anonymous,false) into v_guest from auth.users where id=p_user_id;
  if not found then raise exception 'COMMON_AUTH_REQUIRED'; end if;
  if not v_guest then
    if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
    perform public.common_assert_service_access(p_user_id,'cta',p_membership_version);
    perform set_config('common.operation_version',p_membership_version::text,true);
  end if;
  select count(*) into v_retained from public.cta_usage_receipts where user_id=p_user_id and kind='grade' and used_at>=p_window_start;
  if p_limit is not null and p_limit-v_retained<1 then return null; end if;
  v_result:=public.common_legacy_reserve_grading_attempt(p_user_id,p_problem_id,p_answers_json,p_hint_used,p_limit-v_retained,p_window_start);
  perform set_config('common.operation_version','',true);
  return v_result;
end $$;

create function public.common_cta_entitlement_allowed(p_user_id uuid,p_membership_version bigint)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.cta_user u join public.common_profiles p on p.id=u.id
    where u.id=p_user_id and u.membership_status='active' and u.membership_version=p_membership_version and p.account_status='active');
$$;

create function public.common_guard_subscription()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint;
begin
  if tg_op='INSERT' then
    new.membership_version:=coalesce(nullif(current_setting('common.operation_version',true),'')::bigint,new.membership_version);
  elsif new.membership_version is distinct from old.membership_version and
    nullif(current_setting('common.operation_version',true),'')::bigint is distinct from new.membership_version then
    raise exception 'COMMON_STALE_MEMBERSHIP';
  end if;
  if not public.common_cta_entitlement_allowed(new.user_id,new.membership_version) then
    -- Keep reconciliation order/lease fields and verified payment evidence, but a
    -- stale provider callback can never restore access or schedule a new charge.
    new.status:='expired'; new.cancel_at_period_end:=true;
    new.current_period_end:=least(new.current_period_end,now());
    new.cancelled_at:=coalesce(new.cancelled_at,now());
    if new.billing_order_id is null then new.next_retry_at:=null; end if;
  end if;
  return new;
end $$;
create trigger common_subscription_membership before insert or update on public.cta_subscription
for each row execute function public.common_guard_subscription();

create function public.common_queue_inactive_billing_key()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.toss_billing_key is not null and not public.common_cta_entitlement_allowed(new.user_id,new.membership_version) then
    perform public.enqueue_billing_key_cleanup(new.user_id,new.id,new.toss_billing_key);
  end if;
  return new;
end $$;
create trigger common_inactive_billing_key after insert or update of toss_billing_key,status on public.cta_subscription
for each row execute function public.common_queue_inactive_billing_key();

create function public.common_guard_payment_evidence()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint;
begin
  select membership_version into v_version from public.cta_subscription where id=new.subscription_id;
  if tg_op='INSERT' then new.membership_version:=coalesce(v_version,new.membership_version); end if;
  if new.status='success' and not public.common_cta_entitlement_allowed(new.user_id,v_version) then
    new.requires_refund_review:=true; new.referral_id:=null;
  end if;
  -- 'refunded' denotes a partial cancellation in the existing integration. It
  -- does not by itself settle a late payment's remaining refund review.
  if new.status='cancelled' then new.requires_refund_review:=false; end if;
  return new;
end $$;
create trigger common_payment_membership before insert or update of status on public.cta_payment_log
for each row execute function public.common_guard_payment_evidence();

-- Renewal keeps the old billing/idempotency logic. Ended memberships may only
-- reconcile a previously persisted order, including a pending initial setup.
alter function public.claim_subscription_billing(bigint,text,uuid,int) rename to common_legacy_claim_subscription_billing;
create function public.claim_subscription_billing(p_subscription_id bigint,p_trigger text,p_claim_token uuid,p_lease_seconds integer default 120)
returns table(id bigint,user_id uuid,status text,current_period_end timestamptz,toss_billing_key text,toss_customer_key text,
  retry_count integer,order_id text,reconcile_only boolean,cancel_at_period_end boolean,membership_version bigint,billing_setup_state text)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.cta_subscription%rowtype;
begin
  if p_trigger not in ('cron','retry') or p_lease_seconds not between 30 and 600 then raise exception 'invalid billing claim request'; end if;
  select * into s from public.cta_subscription where cta_subscription.id=p_subscription_id;
  if not found then return; end if;
  -- All membership-affecting paths lock account -> service -> subscription.
  perform 1 from public.common_profiles where common_profiles.id=s.user_id for update;
  perform 1 from public.cta_user where cta_user.id=s.user_id for update;
  select * into s from public.cta_subscription where cta_subscription.id=p_subscription_id for update;
  if not public.common_cta_entitlement_allowed(s.user_id,s.membership_version) then
    if s.billing_order_id is null or (s.billing_claim_token is not null and s.billing_claimed_until>=now())
      or (s.next_retry_at is not null and s.next_retry_at>now()) then return; end if;
    update public.cta_subscription set billing_claim_token=p_claim_token,
      billing_claimed_until=now()+make_interval(secs=>p_lease_seconds),
      billing_setup_state=case when s.billing_setup_state is not null then 'pending' else null end
      where cta_subscription.id=s.id returning * into s;
    return query select s.id,s.user_id,s.status,s.current_period_end,s.toss_billing_key,s.toss_customer_key,
      s.retry_count,s.billing_order_id,true,true,s.membership_version,s.billing_setup_state;
  else
    return query select b.*,s.membership_version,s.billing_setup_state
      from public.common_legacy_claim_subscription_billing(p_subscription_id,p_trigger,p_claim_token,p_lease_seconds) b;
  end if;
end $$;

alter function public.extend_pro(uuid,int,text,bigint) rename to common_legacy_extend_pro;
create function public.common_lock_cta_subscription(p_subscription_id bigint)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.cta_subscription where id=p_subscription_id;
  perform 1 from public.common_profiles where id=v_user for update;
  perform 1 from public.cta_user where id=v_user for update;
end $$;
alter function public.apply_verified_payment_cancellation(text,boolean) rename to common_legacy_apply_verified_payment_cancellation;
create function public.apply_verified_payment_cancellation(p_payment_key text,p_partial boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.cta_payment_log%rowtype; s public.cta_subscription%rowtype;
begin
  select * into p from public.cta_payment_log where toss_payment_key=p_payment_key;
  if not found then return false; end if;
  perform public.common_lock_cta_subscription(p.subscription_id);
  select * into s from public.cta_subscription where id=p.subscription_id for update;
  select * into p from public.cta_payment_log where toss_payment_key=p_payment_key for update;
  if s.id is not null and p.membership_version<>s.membership_version then
    -- A previous membership's refund settles only its own payment. Reusing the
    -- subscription PK on rejoin must not deduct new access or cancel new renewal.
    if p.status='cancelled' or (p.status='refunded' and p_partial) then return true; end if;
    update public.cta_payment_log set status=case when p_partial then 'refunded' else 'cancelled' end where id=p.id;
    update public.cta_referral set status='cancelled' where id=p.referral_id and status='pending';
    return true;
  end if;
  return public.common_legacy_apply_verified_payment_cancellation(p_payment_key,p_partial);
end $$;
alter function public.finalize_billing_success(bigint,uuid,text,text,int,int) rename to common_legacy_finalize_billing_success;
create function public.finalize_billing_success(p_subscription_id bigint,p_claim_token uuid,p_order_id text,p_payment_key text,p_amount integer,p_days integer)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.common_lock_cta_subscription(p_subscription_id);
  return public.common_legacy_finalize_billing_success(p_subscription_id,p_claim_token,p_order_id,p_payment_key,p_amount,p_days);
end $$;
alter function public.finalize_subscription_setup(bigint,uuid,text,text,int,int,bigint) rename to common_legacy_finalize_subscription_setup;
create function public.finalize_subscription_setup(p_subscription_id bigint,p_claim_token uuid,p_order_id text,p_payment_key text,p_amount integer,p_days integer,p_referral_id bigint default null)
returns timestamptz language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.common_lock_cta_subscription(p_subscription_id);
  return public.common_legacy_finalize_subscription_setup(p_subscription_id,p_claim_token,p_order_id,p_payment_key,p_amount,p_days,p_referral_id);
end $$;

create function public.extend_pro(p_user_id uuid,p_days integer,p_reason text,p_referral_id bigint default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_version bigint; v_current bigint;
begin
  -- A member lock serializes grant/withdraw. Inactive grants deliberately perform
  -- no writes so verified late payment finalizers can still preserve their logs.
  select u.membership_version into v_current from public.cta_user u join public.common_profiles p on p.id=u.id
    where u.id=p_user_id and u.membership_status='active' and p.account_status='active' for update of p,u;
  if not found then return; end if;
  if p_referral_id is not null then
    select case when referrer_id=p_user_id then referrer_membership_version
      when referee_id=p_user_id then referee_membership_version end into v_version
      from public.cta_referral where id=p_referral_id;
  else select membership_version into v_version from public.cta_subscription where user_id=p_user_id;
  end if;
  if v_version is not null and v_version<>v_current then return; end if;
  perform set_config('common.operation_version',v_current::text,true);
  perform public.common_legacy_extend_pro(p_user_id,p_days,p_reason,p_referral_id);
  perform set_config('common.operation_version','',true);
end $$;

alter function public.begin_subscription_setup(uuid,text,uuid,int) rename to common_legacy_begin_subscription_setup;
create function public.begin_subscription_setup(p_user_id uuid,p_order_id text,p_claim_token uuid,p_lease_seconds integer default 120,p_membership_version bigint default null)
returns table(action text,subscription_id bigint,order_id text,claim_token uuid,billing_key text)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
  perform public.common_assert_service_access(p_user_id,'cta',p_membership_version);
  perform set_config('common.operation_version',p_membership_version::text,true);
  -- A rejoin is allowed only after old payment/key cleanup completed.
  update public.cta_subscription s set membership_version=p_membership_version,withdrawal_started_at=null
    where s.user_id=p_user_id and s.membership_version<>p_membership_version
      and s.billing_order_id is null and s.billing_setup_state is null
      and s.toss_billing_key is null;
  return query select * from public.common_legacy_begin_subscription_setup(p_user_id,p_order_id,p_claim_token,p_lease_seconds);
  perform set_config('common.operation_version','',true);
end $$;

-- Capture both participants' service epochs. Direct insertion still has to provide
alter function public.cancel_subscription_renewal(uuid) rename to common_legacy_cancel_subscription_renewal;
create function public.cancel_subscription_renewal(p_user_id uuid,p_membership_version bigint default null)
returns table(id bigint,billing_key text,current_period_end timestamptz,reconciliation_pending boolean)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_membership_version is null then raise exception 'COMMON_MEMBERSHIP_VERSION_REQUIRED'; end if;
  perform public.common_assert_service_access(p_user_id,'cta',p_membership_version);
  return query select * from public.common_legacy_cancel_subscription_renewal(p_user_id);
end $$;

-- Capture both participants' service epochs. Direct insertion still has to provide
-- the referee's request epoch; automatic current-epoch guessing would admit stale tabs.
create function public.common_guard_referral()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_op='INSERT' then
    perform public.common_assert_service_access(new.referee_id,'cta',new.referee_membership_version);
    perform public.common_assert_service_access(new.referrer_id,'cta',new.referrer_membership_version);
  elsif (new.referrer_id,new.referee_id,new.referrer_membership_version,new.referee_membership_version)
    is distinct from (old.referrer_id,old.referee_id,old.referrer_membership_version,old.referee_membership_version)
    and not (new.referrer_id is null or new.referee_id is null) then
    raise exception 'COMMON_REFERRAL_IDENTITY_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger common_referral_membership before insert or update on public.cta_referral for each row execute function public.common_guard_referral();
alter function public.grant_referral_rewards(bigint) rename to common_legacy_grant_referral_rewards;
create function public.grant_referral_rewards(p_referral_id bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.cta_referral%rowtype; u record;
begin
  select * into r from public.cta_referral where id=p_referral_id;
  if not found or r.status<>'pending' then return false; end if;
  -- Canonical UUID order avoids opposite referral chains taking member locks backwards.
  for u in select id from public.common_profiles where id in(r.referrer_id,r.referee_id) order by id for update loop null; end loop;
  if not public.common_cta_entitlement_allowed(r.referrer_id,r.referrer_membership_version)
    or not public.common_cta_entitlement_allowed(r.referee_id,r.referee_membership_version) then
    update public.cta_referral set status='cancelled' where id=r.id and status='pending'; return false;
  end if;
  return public.common_legacy_grant_referral_rewards(p_referral_id);
end $$;

-- The immutable CPA guards and withdrawal functions are added below before COMMIT.
create or replace function public.cpa_guard_learning_records()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row jsonb; v_attempt uuid; v_owner uuid; v_run uuid; v_ptr record;
begin
  if tg_op='DELETE' then v_row:=to_jsonb(old); else v_row:=to_jsonb(new); end if;
  -- Only the service withdrawal RPC opens this one-user deletion boundary.
  if tg_op='DELETE' and tg_table_name in ('cpa_attempts','cpa_review_items','cpa_xp_events') then
    v_owner:=coalesce(v_row->>'owner_user_id',v_row->>'user_id')::uuid;
    if current_setting('common.withdraw_user',true)=v_owner::text and exists(
      select 1 from public.cpa_users where id=v_owner and membership_status='withdrawing') then return old; end if;
  end if;
  if tg_table_name='cpa_attempts' then
    if tg_op='DELETE' then
      if not exists(select 1 from auth.users where id=old.owner_user_id)
        or (old.actor_kind='guest' and old.expires_at<=clock_timestamp()) then return old; end if;
      raise exception 'Retained attempts cannot be deleted directly';
    end if;
    if (to_jsonb(new)-'status'-'completed_at'-'current_grading_run_id') is distinct from
      (to_jsonb(old)-'status'-'completed_at'-'current_grading_run_id') then raise exception 'Submitted identity and answers are immutable'; end if;
    if old.status='completed' and new is distinct from old then raise exception 'Completed attempt is immutable'; end if;
    if new.status='completed' and not exists(select 1 from public.cpa_grading_runs r
      where r.id=new.current_grading_run_id and r.attempt_id=new.id and r.status='completed')
      then raise exception 'Completed run required'; end if;
  elsif tg_table_name='cpa_attempt_answers' then
    v_attempt:=(v_row->>'attempt_id')::uuid;
    if tg_op='DELETE' and not exists(select 1 from public.cpa_attempts where id=v_attempt) then return old; end if;
    if tg_op<>'INSERT' or exists(select 1 from public.cpa_attempts where id=v_attempt and status<>'queued')
      then raise exception 'Submitted answer is immutable'; end if;
  elsif tg_table_name in ('cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results') then
    v_attempt:=(v_row->>'attempt_id')::uuid;
    if tg_op='DELETE' and not exists(select 1 from public.cpa_attempts where id=v_attempt) then return old; end if;
    if tg_table_name='cpa_grading_runs' then
      if tg_op='UPDATE' and ((to_jsonb(new)-'status'-'score'-'security_flag'-'raw_injection_detected'-'raw_salad_detected'-'error_code'-'finished_at'-'lease_expires_at')
        is distinct from (to_jsonb(old)-'status'-'score'-'security_flag'-'raw_injection_detected'-'raw_salad_detected'-'error_code'-'finished_at'-'lease_expires_at')) then
        raise exception 'Grading run identity is immutable'; end if;
      if tg_op<>'INSERT' and old.status in ('completed','failed') then raise exception 'Finished grading run is immutable'; end if;
    else
      v_run:=(v_row->>'grading_run_id')::uuid;
      if exists(select 1 from public.cpa_grading_runs where id=v_run and status<>'running')
        or (tg_op='UPDATE' and (to_jsonb(new)-'score') is distinct from (to_jsonb(old)-'score'))
        then raise exception 'Finished grading results are immutable'; end if;
    end if;
  elsif tg_table_name='cpa_review_items' then
    if tg_op='DELETE' then
      if not exists(select 1 from public.cpa_users where id=old.user_id)
        or not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
      raise exception 'Review removal must preserve its suppression state';
    end if;
    if tg_op='UPDATE' and (new.user_id,new.subquestion_id) is distinct from (old.user_id,old.subquestion_id) then
      raise exception 'Review identity is immutable'; end if;
    for v_ptr in select * from (values(new.last_result_run_id,new.last_result_subquestion_version_id),
      (new.last_failed_run_id,new.last_failed_subquestion_version_id)) pointers(run_id,sub_id) loop
      if v_ptr.run_id is not null and not exists(select 1 from public.cpa_subquestion_grade_results sr
        join public.cpa_attempts a on a.id=sr.attempt_id
        join public.cpa_subquestion_versions sv on sv.id=sr.subquestion_version_id
        where sr.grading_run_id=v_ptr.run_id and sv.id=v_ptr.sub_id and sv.subquestion_id=new.subquestion_id
          and a.owner_user_id=new.user_id and a.actor_kind='member') then raise exception 'Review result owner or question mismatch'; end if;
    end loop;
  elsif tg_table_name='cpa_xp_events' then
    if tg_op='DELETE' then
      if not exists(select 1 from public.cpa_users where id=old.user_id)
        or not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
      raise exception 'XP ledger is append-only';
    end if;
    if tg_op='UPDATE' then
      if old.created_by is not null and new.created_by is null and
        (to_jsonb(old)-'created_by')=(to_jsonb(new)-'created_by') then return new; end if;
      raise exception 'XP ledger is append-only';
    end if;
    if new.event_type='submission_award' and not exists(select 1 from public.cpa_attempts a
      join public.cpa_grading_runs r on r.id=a.current_grading_run_id
      where a.id=new.source_attempt_id and a.owner_user_id=new.user_id and a.actor_kind='member'
        and a.status='completed' and r.id=new.source_grading_run_id and r.score=new.amount) then
      raise exception 'XP award does not match a completed member result'; end if;
    if new.event_type='adjustment' and new.created_by is null then raise exception 'XP adjustment actor required'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create or replace function public.cpa_get_leaderboard(p_period text default 'all')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_start timestamptz; v_end timestamptz; v_result jsonb;
begin
  if p_period is null or p_period not in ('all','week','month') then raise exception 'Invalid ranking period'; end if;
  if p_period<>'all' then
    v_start := date_trunc(p_period,clock_timestamp() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
    v_end := ((v_start at time zone 'Asia/Seoul') + case when p_period='week' then interval '7 days' else interval '1 month' end) at time zone 'Asia/Seoul';
  end if;
  with totals as (
    select u.id,u.username,u.role,u.level,u.created_at,
      case when p_period='all' then u.exp else coalesce((select sum(e.amount) from public.cpa_xp_events e
        where e.user_id=u.id and e.event_type='submission_award' and e.credited_at>=v_start and e.credited_at<v_end),0) end as exp
    from public.cpa_users u join auth.users a on a.id=u.id
    where u.role in ('MEMBER','PRO','ADMIN') and not coalesce(a.is_anonymous,false)
      and u.membership_status='active' and exists(select 1 from public.common_profiles p where p.id=u.id and p.account_status='active')
  ), ranked as (
    select dense_rank() over(order by exp desc) as rank,username,role,level,exp,created_at,id
    from totals where p_period='all' or exp>0
  ), limited as (select * from ranked order by exp desc,created_at asc,id asc limit 10)
  select coalesce(jsonb_agg(jsonb_build_object('rank',rank,'username',username,'role',role,'level',level,'exp',exp)
    order by exp desc,created_at asc,id asc),'[]'::jsonb) into v_result from limited;
  return v_result;
end;
$$;

create function public.common_withdraw_service(p_user_id uuid,p_service text,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row jsonb; s public.cta_subscription%rowtype; v_pending integer:=0; v_review boolean:=false; v_status text; v_table text;
begin
  if p_service not in ('cpa','cta') or p_service is null then raise exception 'COMMON_INVALID_SERVICE'; end if;
  perform 1 from public.common_profiles where id=p_user_id for update;
  if not found then raise exception 'COMMON_PROFILE_REQUIRED'; end if;
  if p_service='cpa' then select to_jsonb(u) into v_row from public.cpa_users u where id=p_user_id for update;
  else select to_jsonb(u) into v_row from public.cta_user u where id=p_user_id for update; end if;
  if v_row is null then
    return jsonb_build_object('status','not_joined','membership_version',null,'cleanup_pending',false,'billing_review_required',false);
  end if;
  if p_expected_version is not null and p_expected_version<>(v_row->>'membership_version')::bigint then raise exception 'COMMON_STALE_MEMBERSHIP'; end if;
  perform set_config('common.membership_write',p_user_id::text,true);
  if p_service='cpa' then
    update public.cpa_users set membership_status='withdrawing',rejoin_blocked=rejoin_blocked or membership_status='suspended' where id=p_user_id;
    perform set_config('common.withdraw_user',p_user_id::text,true);
    delete from public.cpa_review_items where user_id=p_user_id;
    delete from public.cpa_xp_events where user_id=p_user_id;
    delete from public.cpa_attempts where owner_user_id=p_user_id;
    foreach v_table in array array['cpa_kicpa_jobs_subscribers','cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription'] loop
      if to_regclass('public.'||v_table) is not null then
        execute format('delete from public.%I where user_id=$1',v_table) using p_user_id;
      end if;
    end loop;
    perform set_config('cpa.learning_progress_write','on',true);
    update public.cpa_users set exp=0,level=1,role='MEMBER',is_service_admin=false,membership_status='withdrawn' where id=p_user_id;
    perform set_config('cpa.learning_progress_write','',true);
    perform set_config('common.withdraw_user','',true);
    v_status:='withdrawn';
  else
    update public.cta_user set membership_status='withdrawing',rejoin_blocked=rejoin_blocked or membership_status='suspended',
      tier='member',exp=0,is_service_admin=false where id=p_user_id;
    insert into public.cta_usage_receipts(user_id,kind,receipt_key,used_at)
      select user_id,'grade',id::text,created_at from public.cta_grading_attempt
      where user_id=p_user_id and (result_json is not null or reservation_expires_at>now())
        and created_at>=date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'
      on conflict(user_id,kind,receipt_key) do nothing;
    insert into public.cta_usage_receipts(user_id,kind,receipt_key,used_at)
      select user_id,'hint',problem_id::text,hint_used_at from public.cta_problem_assist
      where user_id=p_user_id and hint_used_at>=date_trunc('day',timezone('Asia/Seoul',now())) at time zone 'Asia/Seoul'
      on conflict(user_id,kind,receipt_key) do update set used_at=greatest(public.cta_usage_receipts.used_at,excluded.used_at);
    delete from public.cta_grading_attempt where user_id=p_user_id;
    delete from public.cta_problem_assist where user_id=p_user_id;
    update public.cta_referral set status='cancelled' where status='pending' and (referee_id=p_user_id or referrer_id=p_user_id);
    select * into s from public.cta_subscription where user_id=p_user_id for update;
    if found then
      -- Outstanding order/lease state is preserved for provider reconciliation.
      update public.cta_subscription set status='expired',cancel_at_period_end=true,
        withdrawal_started_at=coalesce(withdrawal_started_at,now()),
        cancelled_at=coalesce(cancelled_at,now()),current_period_end=least(current_period_end,now()),
        next_retry_at=case when billing_order_id is null then null else coalesce(next_retry_at,now()) end
        where id=s.id;
      if s.toss_billing_key is not null then perform public.enqueue_billing_key_cleanup(p_user_id,s.id,s.toss_billing_key); end if;
      v_review:=s.billing_order_id is not null or s.billing_setup_state is not null or s.billing_claim_token is not null;
    end if;
    select count(*) into v_pending from public.cta_billing_key_cleanup where user_id=p_user_id;
    v_status:=case when v_pending>0 or v_review then 'withdrawing' else 'withdrawn' end;
    update public.cta_user set membership_status=v_status where id=p_user_id;
    v_review:=v_review or exists(select 1 from public.cta_payment_log where user_id=p_user_id and requires_refund_review);
  end if;
  perform set_config('common.membership_write','',true);
  return jsonb_build_object('status',v_status,'membership_version',(v_row->>'membership_version')::bigint,
    'cleanup_pending',v_status='withdrawing','cleanup_count',v_pending,'billing_review_required',v_review);
end $$;

create function public.common_prepare_account_deletion(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_cpa jsonb; v_cta jsonb; v_ready boolean;
begin
  update public.common_profiles set account_status='deleting',updated_at=now() where id=p_user_id;
  if not found then raise exception 'COMMON_PROFILE_REQUIRED'; end if;
  v_cpa:=public.common_withdraw_service(p_user_id,'cpa');
  v_cta:=public.common_withdraw_service(p_user_id,'cta');
  v_ready:=v_cpa->>'status' in ('not_joined','withdrawn') and v_cta->>'status' in ('not_joined','withdrawn')
    and not (v_cta->>'billing_review_required')::boolean;
  return jsonb_build_object('cpa',v_cpa,'cta',v_cta,'ready_for_auth_delete',v_ready);
end $$;

create function public.common_guard_auth_deletion()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if coalesce(old.is_anonymous,false) then return old; end if;
  if not exists(select 1 from public.common_profiles where id=old.id and account_status='deleting')
    or exists(select 1 from public.cpa_users where id=old.id and membership_status<>'withdrawn')
    or exists(select 1 from public.cta_user where id=old.id and membership_status<>'withdrawn')
    or exists(select 1 from public.cta_billing_key_cleanup where user_id=old.id)
    or exists(select 1 from public.cta_subscription where user_id=old.id and
      (toss_billing_key is not null or billing_order_id is not null or billing_setup_state is not null or billing_claim_token is not null))
    or exists(select 1 from public.cta_payment_log where user_id=old.id and requires_refund_review) then
    raise exception 'COMMON_ACCOUNT_CLEANUP_REQUIRED';
  end if;
  return old;
end $$;
create trigger common_auth_deletion_guard before delete on auth.users for each row execute function public.common_guard_auth_deletion();

-- Provider 404/timeout is deliberately not proof that no payment happened. An
-- owner can resolve a never-submitted original order only after quiescing old
-- app/worker requests and independently checking provider transaction records.
-- This function is excluded from service_role grants; it has no app endpoint.
create table public.common_payment_resolution_log (
  id bigint generated always as identity primary key,
  subscription_id bigint not null, order_id text not null unique,
  resolution text not null check(resolution='provider_confirmed_no_charge'),
  evidence text not null check(length(btrim(evidence)) between 30 and 2000),
  resolved_by name not null default current_user, resolved_at timestamptz not null default now()
);
alter table public.common_payment_resolution_log enable row level security;
revoke all on public.common_payment_resolution_log from public,anon,authenticated,service_role;

create function public.common_resolve_withdrawn_order_no_charge(p_subscription_id bigint,p_order_id text,p_evidence text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare s public.cta_subscription%rowtype;
begin
  if p_evidence is null or length(btrim(p_evidence)) not between 30 and 2000 then raise exception 'COMMON_PROVIDER_EVIDENCE_REQUIRED'; end if;
  perform public.common_lock_cta_subscription(p_subscription_id);
  select * into s from public.cta_subscription where id=p_subscription_id for update;
  if not found or s.billing_order_id is distinct from p_order_id or p_order_id is null then raise exception 'COMMON_ORDER_MISMATCH'; end if;
  if not exists(select 1 from public.cta_user where id=s.user_id and membership_status in ('withdrawing','withdrawn')) then
    raise exception 'COMMON_SERVICE_MUST_BE_WITHDRAWING';
  end if;
  -- The elapsed interval is a minimum guard, never a replacement for the external
  -- evidence/explicit operator attestation required by this function's contract.
  if s.withdrawal_started_at is null or s.withdrawal_started_at>now()-interval '15 minutes'
    or (s.billing_claim_token is not null and (s.billing_claimed_until is null or s.billing_claimed_until>=now())) then
    raise exception 'COMMON_PAYMENT_MAY_BE_IN_FLIGHT';
  end if;
  if exists(select 1 from public.cta_payment_log where toss_order_id=p_order_id and status in ('success','refunded','cancelled')) then
    raise exception 'COMMON_KNOWN_PAYMENT_REQUIRES_RECONCILIATION';
  end if;
  insert into public.common_payment_resolution_log(subscription_id,order_id,resolution,evidence)
    values(s.id,p_order_id,'provider_confirmed_no_charge',btrim(p_evidence));
  insert into public.cta_payment_log(user_id,subscription_id,status,toss_order_id,failure_code,failure_message,membership_version)
    values(s.user_id,s.id,'failed',p_order_id,'OPERATOR_VERIFIED_NO_CHARGE','Provider original order and transaction records checked; see owner resolution log.',s.membership_version)
    on conflict(toss_order_id) do nothing;
  if s.toss_billing_key is not null then perform public.enqueue_billing_key_cleanup(s.user_id,s.id,s.toss_billing_key); end if;
  update public.cta_subscription set billing_order_id=null,billing_setup_state=null,billing_claim_token=null,billing_claimed_until=null,
    next_retry_at=null,status='expired',cancel_at_period_end=true where id=s.id;
  return jsonb_build_object('resolved',true,'subscription_id',s.id,'billing_key_cleanup_pending',s.toss_billing_key is not null);
end $$;

-- Every mutation/resolver is server-only. Renamed legacy implementations are not
-- callable even by service_role: only the new SECURITY DEFINER boundary calls them.
do $$ declare f record;
begin
  for f in select p.oid::regprocedure as signature,p.proname,p.prorettype
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and (p.proname like 'common_%' or p.proname in ('cpa_begin_attempt','cpa_claim_grading_run','cpa_complete_grading_run',
        'cpa_fail_grading_run','cpa_update_review_item','consume_hint_quota','reserve_grading_attempt','begin_subscription_setup','claim_subscription_billing',
        'finalize_billing_success','finalize_subscription_setup','apply_verified_payment_cancellation','cancel_subscription_renewal','extend_pro','grant_referral_rewards','handle_new_user')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.proname not like 'common_legacy_%' and f.proname<>'common_resolve_withdrawn_order_no_charge' and f.prorettype<>'trigger'::regtype then
      execute format('grant execute on function %s to service_role',f.signature);
    end if;
  end loop;
end $$;
comment on table public.common_profiles is 'Canonical account identity only; a row does not enroll the account in any service.';
comment on column public.cta_user.membership_version is 'Incremented only on explicit rejoin; async writes must carry the version captured at request start.';
comment on column public.cta_payment_log.requires_refund_review is 'Verified successful payment arrived after service access ended; access is not restored. Resolve separately before deleting Auth.';
commit;
