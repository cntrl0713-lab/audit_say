-- KICPA jobs: public announcements, private subscription preferences and delivery ledger.
-- Unapplied migration. Channel provider and phone verification are deliberately not connected.
begin;

create table public.cpa_kicpa_job_boards (
  board text primary key check (board in ('trainee_cpa', 'cpa')),
  initialized_at timestamptz,
  last_checked_at timestamptz
);

create table public.cpa_kicpa_jobs (
  board text not null references public.cpa_kicpa_job_boards(board),
  id text not null check (length(id) between 1 and 200),
  title text not null check (length(trim(title)) between 1 and 1000),
  company text,
  posted_at date,
  deadline text,
  source_url text not null check (source_url ~ '^https://(www\.)?kicpa\.or\.kr/[^[:space:]]*$'),
  firm_id bigint references public.cpa_firm_registered(firm_id) on delete set null,
  notified_at timestamptz,
  is_baseline boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (board, id)
);
create index cpa_kicpa_jobs_firm_latest on public.cpa_kicpa_jobs(firm_id, posted_at desc nulls last, created_at desc);
create index cpa_kicpa_jobs_latest on public.cpa_kicpa_jobs(posted_at desc nulls last, created_at desc);

create table public.cpa_kicpa_jobs_subscribers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.cpa_users(id) on delete cascade,
  is_active boolean not null default false,
  boards text[] not null default array['trainee_cpa','cpa'] check (
    boards = array['trainee_cpa'] or boards = array['cpa']
    or boards = array['trainee_cpa','cpa'] or boards = array['cpa','trainee_cpa']),
  consent_version text check (length(consent_version) between 1 and 80),
  consented_at timestamptz,
  -- Reserved for a future server-side verified-phone flow. Current settings never collect these.
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  notifications_since timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or (consent_version is not null and consented_at is not null)),
  check ((phone_e164 is null) = (phone_verified_at is null))
);

create table public.cpa_kicpa_job_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_board text not null,
  job_id text not null,
  subscriber_id uuid not null references public.cpa_kicpa_jobs_subscribers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','accepted','sent','failed','uncertain','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  error_code text,
  provider_message_id text check (length(provider_message_id) between 1 and 200),
  created_at timestamptz not null default now(),
  check (status <> 'accepted' or provider_message_id is not null),
  foreign key (job_board, job_id) references public.cpa_kicpa_jobs(board, id) on delete cascade,
  unique (job_board, job_id, subscriber_id)
);
create index cpa_kicpa_job_deliveries_pending on public.cpa_kicpa_job_deliveries(next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.cpa_kicpa_job_boards enable row level security;
alter table public.cpa_kicpa_jobs enable row level security;
alter table public.cpa_kicpa_jobs_subscribers enable row level security;
alter table public.cpa_kicpa_job_deliveries enable row level security;
revoke all on public.cpa_kicpa_job_boards, public.cpa_kicpa_jobs,
  public.cpa_kicpa_jobs_subscribers, public.cpa_kicpa_job_deliveries from public, anon, authenticated;
grant select on public.cpa_kicpa_jobs to anon, authenticated;
create policy cpa_kicpa_jobs_public_read on public.cpa_kicpa_jobs for select to anon, authenticated using (true);
grant all on public.cpa_kicpa_job_boards, public.cpa_kicpa_jobs,
  public.cpa_kicpa_jobs_subscribers, public.cpa_kicpa_job_deliveries to service_role;

-- Deliberate owner-rights projection: phone and delivery metadata stay inaccessible.
create view public.cpa_kicpa_jobs_subscription_status with (security_barrier=true) as
select user_id, is_active, boards,
  (consented_at is null or consent_version is distinct from '2026-09-09-v1') as consent_required
from public.cpa_kicpa_jobs_subscribers
where user_id = (select auth.uid())
  and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false';
revoke all on public.cpa_kicpa_jobs_subscription_status from public, anon, authenticated;
grant select on public.cpa_kicpa_jobs_subscription_status to authenticated, service_role;

-- A validated board snapshot and its delivery queue are committed together. A first snapshot
-- initializes the baseline without sending old announcements to newly connected members.
create function public.ingest_cpa_kicpa_jobs(p_board text, p_jobs jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_baseline boolean;
  v_job jsonb;
  v_id text;
  v_inserted_id text;
  v_inserted integer := 0;
  v_queued integer := 0;
  v_count integer;
begin
  if p_board is null or p_board not in ('trainee_cpa','cpa') then raise exception 'invalid board'; end if;
  if p_jobs is null or jsonb_typeof(p_jobs) <> 'array' then raise exception 'jobs must be an array'; end if;
  if jsonb_array_length(p_jobs) > 5000 then raise exception 'snapshot too large'; end if;
  insert into public.cpa_kicpa_job_boards(board) values (p_board) on conflict do nothing;
  select initialized_at is null into v_baseline from public.cpa_kicpa_job_boards where board = p_board for update;
  for v_job in select value from jsonb_array_elements(p_jobs) loop
    if jsonb_typeof(v_job) <> 'object' then raise exception 'invalid job'; end if;
    if v_job ? 'board' and (v_job->>'board') is distinct from p_board then raise exception 'board mismatch'; end if;
    v_id := v_job->>'id';
    v_inserted_id := null;
    insert into public.cpa_kicpa_jobs(board,id,title,company,posted_at,deadline,source_url,firm_id,is_baseline)
    values(p_board, v_id, trim(v_job->>'title'), nullif(trim(v_job->>'company'),''),
      nullif(v_job->>'posted_at','')::date, nullif(v_job->>'deadline',''), v_job->>'source_url',
      nullif(v_job->>'firm_id','')::bigint, v_baseline)
    on conflict (board,id) do nothing returning id into v_inserted_id;
    if v_inserted_id is null then
      update public.cpa_kicpa_jobs set title=trim(v_job->>'title'), company=nullif(trim(v_job->>'company'),''),
        posted_at=nullif(v_job->>'posted_at','')::date, deadline=nullif(v_job->>'deadline',''),
        source_url=v_job->>'source_url', firm_id=nullif(v_job->>'firm_id','')::bigint
      where board=p_board and id=v_id;
    else
      v_inserted := v_inserted + 1;
      if not v_baseline then
        insert into public.cpa_kicpa_job_deliveries(job_board,job_id,subscriber_id)
        select p_board, v_id, s.id from public.cpa_kicpa_jobs_subscribers s
        where s.is_active and s.notifications_since <= now()
          and s.phone_e164 is not null and s.phone_verified_at is not null
          and s.consented_at is not null and s.consent_version = '2026-09-09-v1'
          and p_board = any(s.boards)
        on conflict (job_board,job_id,subscriber_id) do nothing;
        get diagnostics v_count = row_count;
        v_queued := v_queued + v_count;
      end if;
    end if;
  end loop;
  update public.cpa_kicpa_job_boards set initialized_at=coalesce(initialized_at,now()), last_checked_at=now() where board=p_board;
  return jsonb_build_object('inserted',v_inserted,'queued',v_queued,'baseline',v_baseline);
end $$;

create function public.claim_cpa_kicpa_job_delivery()
returns setof public.cpa_kicpa_job_deliveries language plpgsql security definer set search_path = '' as $$
begin
  -- An interrupted send may already have reached Kakao. Never resend it automatically.
  update public.cpa_kicpa_job_deliveries set status='uncertain', error_code='interrupted_send'
  where status='sending' and claimed_at < now() - interval '15 minutes';
  update public.cpa_kicpa_job_deliveries d set status='cancelled', error_code='subscription_inactive'
  from public.cpa_kicpa_jobs_subscribers s, public.cpa_kicpa_jobs j
  where d.subscriber_id=s.id and d.job_board=j.board and d.job_id=j.id
    and d.status in ('pending','failed') and (not s.is_active or j.created_at < s.notifications_since
      or s.phone_e164 is null or s.phone_verified_at is null
      or s.consented_at is null or s.consent_version is distinct from '2026-09-09-v1'
      or not (d.job_board = any(s.boards)));
  return query
  with candidate as (
    select d.id from public.cpa_kicpa_job_deliveries d
    join public.cpa_kicpa_jobs_subscribers s on s.id=d.subscriber_id
    join public.cpa_kicpa_jobs j on j.board=d.job_board and j.id=d.job_id
    where d.status in ('pending','failed') and d.attempts < 5 and d.next_attempt_at <= now()
      and s.is_active and j.created_at >= s.notifications_since
      and s.phone_e164 is not null and s.phone_verified_at is not null
      and s.consented_at is not null and s.consent_version = '2026-09-09-v1'
      and d.job_board = any(s.boards)
    order by d.created_at, d.id for update of d skip locked limit 1
  )
  update public.cpa_kicpa_job_deliveries d set status='sending', claimed_at=now(), attempts=d.attempts+1, error_code=null
  from candidate c where d.id=c.id returning d.*;
end $$;

create function public.finish_cpa_kicpa_job_delivery(p_delivery_id uuid, p_status text,
  p_error_code text default null, p_retry_seconds integer default 300,
  p_provider_message_id text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_board text; v_job text;
begin
  if p_status is null or p_status not in ('accepted','sent','failed','uncertain','cancelled') then raise exception 'invalid delivery status'; end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,80}$' then raise exception 'invalid error code'; end if;
  if p_provider_message_id is not null and length(p_provider_message_id) not between 1 and 200 then raise exception 'invalid provider message id'; end if;
  if p_status = 'accepted' and p_provider_message_id is null then raise exception 'accepted requires provider message id'; end if;
  select job_board,job_id into v_board,v_job from public.cpa_kicpa_job_deliveries where id=p_delivery_id;
  if not found then return false; end if;
  -- Serialize completions for a job BEFORE updating its delivery: concurrent recipients
  -- must observe earlier committed results when computing the all-sent summary.
  perform 1 from public.cpa_kicpa_jobs where board=v_board and id=v_job for update;
  update public.cpa_kicpa_job_deliveries set status=p_status, error_code=p_error_code,
    sent_at=case when p_status='sent' then now() else null end,
    provider_message_id=p_provider_message_id,
    next_attempt_at=now()+make_interval(secs => greatest(60,least(coalesce(p_retry_seconds,300),86400)))
  where id=p_delivery_id and status='sending' returning job_board,job_id into v_board,v_job;
  if not found then return false; end if;
  if p_status='sent' then
    update public.cpa_kicpa_jobs j set notified_at=now() where j.board=v_board and j.id=v_job
      and not exists (select 1 from public.cpa_kicpa_job_deliveries d where d.job_board=v_board and d.job_id=v_job and d.status <> 'sent');
  end if;
  return true;
end $$;

revoke all on function public.ingest_cpa_kicpa_jobs(text,jsonb), public.claim_cpa_kicpa_job_delivery(),
  public.finish_cpa_kicpa_job_delivery(uuid,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.ingest_cpa_kicpa_jobs(text,jsonb), public.claim_cpa_kicpa_job_delivery(),
  public.finish_cpa_kicpa_job_delivery(uuid,text,text,integer,text) to service_role;
comment on table public.cpa_kicpa_jobs_subscribers is 'Server-only subscription and verified contact. Current UI saves preferences only; no phone collection or provider is connected.';
comment on column public.cpa_kicpa_jobs_subscribers.is_active is 'Desired subscription state, not proof of provider availability or recipient verification.';
comment on column public.cpa_kicpa_job_deliveries.provider_message_id is 'Provider receipt reference. accepted is not sent; final-result verification is added with the chosen provider.';
comment on column public.cpa_kicpa_jobs.notified_at is 'Compatibility summary only; per-subscriber delivery ledger is authoritative. Baseline/no-recipient jobs remain null.';
commit;
