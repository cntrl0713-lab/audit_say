-- The existing project has pg_cron. Keep retention in PostgreSQL so it does not
-- depend on an open browser or app deployment. The function only deletes expired
-- guest attempts and their own descendants, never member learning history.
begin;
do $body$
begin
    if not exists(select 1 from pg_extension where extname='pg_cron') then
        raise exception 'pg_cron must be installed before CPA guest retention is enabled';
    end if;
    perform cron.schedule(
        'cpa-learning-guest-retention',
        '0 * * * *',
        'select public.cpa_purge_expired_attempts(5000);'
    );
end
$body$;
commit;
