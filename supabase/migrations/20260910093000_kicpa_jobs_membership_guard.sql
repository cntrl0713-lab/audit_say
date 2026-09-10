-- The jobs schema may be installed after the common-account migration in production.
-- Complete the same membership boundary without rerunning that shared migration.
begin;

do $$
declare
  v_subscriber record;
  v_version bigint;
begin
  if to_regclass('public.common_profiles') is null
    or to_regclass('public.cpa_users') is null
    or to_regprocedure('public.common_assert_service_access(uuid,text,bigint)') is null
    or to_regprocedure('public.common_guard_learning_membership()') is null then
    raise exception 'KICPA_COMMON_ACCOUNTS_REQUIRED';
  end if;
  if to_regclass('public.cpa_kicpa_jobs_subscribers') is null then
    raise exception 'KICPA_JOBS_SCHEMA_REQUIRED';
  end if;

  -- Keep writes blocked until backfill and trigger installation commit together.
  lock table public.cpa_kicpa_jobs_subscribers in access exclusive mode;
  alter table public.cpa_kicpa_jobs_subscribers add column if not exists membership_version bigint;
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.cpa_kicpa_jobs_subscribers'::regclass
      and attname='membership_version' and not attisdropped
      and (atttypid <> 'bigint'::regtype or attidentity <> '' or attgenerated <> '')
  ) then
    raise exception 'KICPA_INVALID_MEMBERSHIP_VERSION_COLUMN';
  end if;
  alter table public.cpa_kicpa_jobs_subscribers alter column membership_version drop default;

  -- Replacing the trigger under this transaction also supports the normal install order.
  drop trigger if exists common_learning_membership on public.cpa_kicpa_jobs_subscribers;
  for v_subscriber in
    select user_id,membership_version from public.cpa_kicpa_jobs_subscribers order by user_id
  loop
    -- Validate and lock the real account/membership. Existing non-null epochs must
    -- match; never relabel a stale or inactive subscription as a new membership.
    v_version := public.common_assert_service_access(v_subscriber.user_id,'cpa',v_subscriber.membership_version);
    if v_version is null or v_version < 1 then
      raise exception 'KICPA_INVALID_CURRENT_MEMBERSHIP_VERSION';
    end if;
    if v_subscriber.membership_version is null then
      -- A legacy row without an epoch cannot be attributed to a later rejoin.
      if v_version <> 1 then
        raise exception 'KICPA_AMBIGUOUS_LEGACY_MEMBERSHIP';
      end if;
      update public.cpa_kicpa_jobs_subscribers set membership_version=v_version
        where user_id=v_subscriber.user_id;
    end if;
  end loop;
  create trigger common_learning_membership before insert or update on public.cpa_kicpa_jobs_subscribers
    for each row execute function public.common_guard_learning_membership();
end $$;

comment on column public.cpa_kicpa_jobs_subscribers.membership_version is
  'CPA membership epoch captured at request start. No default; writes use the shared membership guard.';
commit;
