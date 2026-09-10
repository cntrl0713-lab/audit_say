-- Read-only catalog checks after the coordinated shared-account migration.
select c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod) as type,a.attnotnull
from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
where n.nspname='public' and c.relname in ('common_profiles','cpa_users','cta_user','cta_subscription','cta_grading_attempt','cta_problem_assist')
  and a.attnum>0 and not a.attisdropped and a.attname in ('id','nickname','membership_status','membership_version','is_service_admin','account_status')
order by c.relname,a.attnum;

select p.oid::regprocedure as function,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'common_%' order by p.proname;
-- anon/authenticated must be false; common_legacy_* and the owner-only
-- common_resolve_withdrawn_order_no_charge must also be false for service_role.

select c.conrelid::regclass as relation,c.conname,pg_get_constraintdef(c.oid) as definition
from pg_constraint c where c.contype='f' and c.confrelid='public.cta_user'::regclass
order by c.conrelid::regclass::text,c.conname;
-- Finance/referral user references must be SET NULL, not CASCADE.

select t.tgrelid::regclass as relation,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t where not t.tgisinternal and (t.tgname like 'common_%' or t.tgname='on_auth_user_created')
order by t.tgrelid::regclass::text,t.tgname;
