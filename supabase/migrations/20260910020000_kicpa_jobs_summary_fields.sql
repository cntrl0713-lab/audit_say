-- Public job source data is limited to title, company, posted date and source URL.
-- Deploy the updated web query and scraper before applying: old clients select/send deadline.
-- Retain the legacy deadline column without exposing or updating it; no existing data is deleted.
begin;

revoke select on public.cpa_kicpa_jobs from anon, authenticated;
grant select (board,id,title,company,posted_at,source_url,firm_id,created_at)
  on public.cpa_kicpa_jobs to anon, authenticated;

create or replace function public.ingest_cpa_kicpa_jobs(p_board text, p_jobs jsonb)
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
    if v_job - array['board','id','title','company','posted_at','source_url','firm_id'] <> '{}'::jsonb then
      raise exception 'unsupported job fields';
    end if;
    if v_job ? 'board' and (v_job->>'board') is distinct from p_board then raise exception 'board mismatch'; end if;
    v_id := v_job->>'id';
    v_inserted_id := null;
    insert into public.cpa_kicpa_jobs(board,id,title,company,posted_at,source_url,firm_id,is_baseline)
    values(p_board, v_id, trim(v_job->>'title'), nullif(trim(v_job->>'company'),''),
      nullif(v_job->>'posted_at','')::date, v_job->>'source_url',
      nullif(v_job->>'firm_id','')::bigint, v_baseline)
    on conflict (board,id) do nothing returning id into v_inserted_id;
    if v_inserted_id is null then
      update public.cpa_kicpa_jobs set title=trim(v_job->>'title'), company=nullif(trim(v_job->>'company'),''),
        posted_at=nullif(v_job->>'posted_at','')::date,
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

revoke all on function public.ingest_cpa_kicpa_jobs(text,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_cpa_kicpa_jobs(text,jsonb) to service_role;
comment on column public.cpa_kicpa_jobs.deadline is 'Legacy only. Not collected or exposed by the current job listing; retained for migration compatibility.';
commit;
