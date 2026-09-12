import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Read-only: prepares a reviewable manifest. No SQL mutation, Auth deletion,
// provider request, deployment, cron change, or Auth config update occurs here.
process.loadEnvFile('.env.local');
const endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const project=endpoint.hostname.split('.')[0];
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token || !/^[a-z0-9]{20}$/.test(project) || endpoint.hostname!==`${project}.supabase.co`) throw new Error('Unexpected Supabase project configuration');
const sqlFile=resolve('supabase/migrations/20260910090000_common_accounts.sql');
const sql=await readFile(sqlFile,'utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
async function query(statement){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:statement,read_only:true}),signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw new Error(`Read-only database query failed (${response.status}); response omitted to protect data`);
  const rows=await response.json();if(!Array.isArray(rows))throw new Error('Unexpected query response');return rows;
}
const prerequisiteSignatures=[...sql.matchAll(/alter function public\.([a-z_]+)\(([^)]*)\) rename to/g)].map(match=>`${match[1]}(${match[2]})`);
const signatureValues=prerequisiteSignatures.map(signature=>`('${signature}')`).join(',');
const [facts]=await query(`select jsonb_build_object(
 'auth',(select jsonb_build_object('total',count(*),'anonymous',count(*) filter(where coalesce(is_anonymous,false)),
   'registered',count(*) filter(where not coalesce(is_anonymous,false)),'verified',count(*) filter(where email_confirmed_at is not null),
   'id_fingerprint',md5(coalesce(string_agg(id::text,',' order by id),''))) from auth.users),
 'cpa_roles',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select role,count(*) as count from public.cpa_users group by role order by role) r),
 'cta_roles',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select tier::text as tier,count(*) as count from public.cta_user group by tier order by tier) r),
 'subscriptions',(select jsonb_build_object('total',count(*),'billing_keys',count(*) filter(where toss_billing_key is not null),
   'open_orders',count(*) filter(where billing_order_id is not null),'open_setups',count(*) filter(where billing_setup_state is not null),
   'active_leases',count(*) filter(where billing_claim_token is not null and billing_claimed_until>=now())) from public.cta_subscription),
 'subscription_states',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select status,count(*) as count from public.cta_subscription group by status order by status) r),
 'payment_states',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select status,count(*) as count from public.cta_payment_log group by status order by status) r),
 'billing_cleanup',(select jsonb_build_object('pending',count(*),'leased',count(*) filter(where claim_token is not null and claimed_until>=now())) from public.cta_billing_key_cleanup),
 'payment_cancellation_inbox',(select count(*) from public.cta_verified_payment_cancellation),
 'referral_states',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select status,count(*) as count from public.cta_referral group by status order by status) r),
 'reward_rows',(select count(*) from public.cta_pro_reward),
 'personal_learning',jsonb_build_object('cpa_attempts',(select count(*) from public.cpa_attempts),'cta_attempts',(select count(*) from public.cta_grading_attempt),
   'cpa_reviews',(select count(*) from public.cpa_review_items),'cpa_xp_events',(select count(*) from public.cpa_xp_events),'cta_assists',(select count(*) from public.cta_problem_assist),
   'cpa_legacy_review_notes',(select count(*) from public.cpa_review_notes),'cpa_firm_chats',(select count(*) from public.cpa_firm_chat_message),
   'cpa_firm_reviews',(select count(*) from public.cpa_firm_review),'cpa_firm_subscriptions',(select count(*) from public.cpa_firm_subscription)),
 'content',jsonb_build_object('cpa_sets',(select count(*) from public.cpa_question_sets),'cpa_set_fingerprint',(select md5(coalesce(string_agg(id,',' order by id),'')) from public.cpa_question_sets),
   'cta_problems',(select count(*) from public.cta_problem),'cta_problem_fingerprint',(select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.cta_problem)),
 'objects',jsonb_build_object('common_profiles_exists',to_regclass('public.common_profiles') is not null,
   'jobs_subscribers_exists',to_regclass('public.cpa_kicpa_jobs_subscribers') is not null,'cron_exists',to_regclass('cron.job') is not null),
 'functions',(select jsonb_agg(jsonb_build_object('signature',v.signature,'exists',p.oid is not null,'security_definer',p.prosecdef,
   'definition_hash',case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end) order by v.signature)
   from (values ${signatureValues}) v(signature) left join pg_proc p on p.oid=to_regprocedure('public.'||v.signature)),
 'auth_dependencies',(select jsonb_agg(jsonb_build_object('table',k.conrelid::regclass::text,'constraint',k.conname,'definition',pg_get_constraintdef(k.oid)) order by k.conrelid::regclass::text,k.conname)
   from pg_constraint k where k.contype='f' and k.confrelid='auth.users'::regclass),
 'migration_history',(select coalesce(jsonb_agg(version order by version),'[]') from supabase_migrations.schema_migrations)
) as facts`);
if(!facts?.facts)throw new Error('Missing preflight aggregate facts');
const state=facts.facts;
const cronJobs=state.objects.cron_exists?await query(`select jobid,jobname,schedule,active,
  case when command ilike '%process-billing%' or command ilike '%trigger_process_billing%' then 'process-billing'
    when jobname='downgrade-expired-pro' then 'cta-entitlement-expiry'
    when command ilike '%cpa_purge_expired_attempts%' then 'cpa-guest-retention'
    else 'other' end as purpose,md5(command) as command_fingerprint
  from cron.job order by jobid`):[];
const jobs=state.objects.jobs_subscribers_exists?(await query(`select jsonb_build_object(
  'subscribers',(select count(*) from public.cpa_kicpa_jobs_subscribers),
  'active_subscribers',(select count(*) from public.cpa_kicpa_jobs_subscribers where is_active),
  'pending_deliveries',(select count(*) from public.cpa_kicpa_job_deliveries where status in ('pending','sending','accepted','uncertain','failed')),
  'public_jobs',(select count(*) from public.cpa_kicpa_jobs)) as jobs`))[0].jobs:null;
// Jobs may be released independently. Pin their existence and base schema so a
// concurrent deployment cannot create an unreviewed cascade or content table.
const [jobsSchemaRow]=await query(`select jsonb_build_object(
  'relations',(select jsonb_agg(jsonb_build_object('name',v.name,'kind',c.relkind) order by v.name)
    from (values ('cpa_kicpa_job_boards'),('cpa_kicpa_jobs'),('cpa_kicpa_jobs_subscribers'),
      ('cpa_kicpa_job_deliveries'),('cpa_kicpa_jobs_subscription_status')) v(name)
    left join pg_class c on c.oid=to_regclass('public.'||v.name)),
  'columns',(select coalesce(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,
    'type',udt_name,'nullable',is_nullable,'default',column_default) order by table_name,ordinal_position),'[]')
    from information_schema.columns where table_schema='public' and table_name in
      ('cpa_kicpa_job_boards','cpa_kicpa_jobs','cpa_kicpa_jobs_subscribers','cpa_kicpa_job_deliveries')
      and column_name<>'membership_version'),
  'functions',(select jsonb_agg(jsonb_build_object('signature',v.signature,
    'definition_hash',case when p.oid is not null then md5(pg_get_functiondef(p.oid)) end) order by v.signature)
    from (values ('ingest_cpa_kicpa_jobs(text,jsonb)'),('claim_cpa_kicpa_job_delivery()'),
      ('finish_cpa_kicpa_job_delivery(uuid,text,text,integer,text)')) v(signature)
    left join pg_proc p on p.oid=to_regprocedure('public.'||v.signature)),
  'view_hash',(select md5(pg_get_viewdef(c.oid)) from pg_class c where c.oid=to_regclass('public.cpa_kicpa_jobs_subscription_status'))
  ) as jobs_schema`);
const jobsSchema=jobsSchemaRow.jobs_schema;
const additionalPersonalSchema=await query(`select table_name,column_name,data_type,is_nullable from information_schema.columns
  where table_schema='public' and table_name in ('cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription') order by table_name,ordinal_position`);
const protectedTables=await query(`select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and (
    c.relname in ('cta_subject','cta_problem','cta_subquestion','cta_subquestion_rubric','cta_issue',
      'cpa_question_sets','cpa_question_set_versions','cpa_subquestions','cpa_subquestion_versions','cpa_subquestion_answers',
      'cpa_question_sources','cpa_requirements','cpa_criteria','cpa_criterion_sources','cpa_criterion_facts',
      'cpa_question_review_events','cpa_question_bank_releases','cpa_question_bank_release_items',
      'cpa_kicpa_job_boards','cpa_kicpa_jobs')
    or (c.relname like 'cpa_firm_%' and c.relname not in ('cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription'))
  ) order by c.relname`);
if(protectedTables.some(table=>!/^c(pa|ta)_[a-z0-9_]+$/.test(table.name)))throw new Error('Unexpected protected table name');
const protectedCounts=await query(protectedTables.map(table=>`select '${table.name}' as table_name,count(*) as row_count from public.${table.name}`).join(' union all '));
const authResponse=await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`,{
  headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000),
});
if(!authResponse.ok)throw new Error(`Auth config read failed (${authResponse.status})`);
const auth=await authResponse.json();
const authSettings=Object.fromEntries(['site_url','uri_allow_list','password_min_length','mailer_autoconfirm','disable_signup','external_anonymous_users_enabled'].map(key=>[key,auth[key]]));
// Preserve the pre-maintenance switches even when account pinning is refreshed
// after signup/cron has been paused. This snapshot contains no secrets or user IDs.
const originalStatePath=resolve('tmp/common-account-original-state.json');
await mkdir(resolve('tmp'),{recursive:true});
let originalState;
try{originalState=JSON.parse(await readFile(originalStatePath,'utf8'));}
catch(error){
  if(error.code!=='ENOENT')throw error;
  originalState={project,migration_version:'20260910090000',captured_at:new Date().toISOString(),auth_settings:authSettings,cron_jobs:cronJobs};
  await writeFile(originalStatePath,JSON.stringify(originalState,null,2)+'\n',{flag:'wx'});
}
if(originalState.project!==project||originalState.migration_version!=='20260910090000')throw new Error('Original maintenance state belongs to another rollout');
const restoreCronJobs=cronJobs.map(job=>{
  const original=originalState.cron_jobs.find(item=>item.jobid===job.jobid);
  if(!original||original.command_fingerprint!==job.command_fingerprint||original.schedule!==job.schedule||original.jobname!==job.jobname)throw new Error('Cron changed since original maintenance snapshot');
  return{...job,active:original.active,live_active:job.active};
});
const missingFunctions=state.functions.filter(fn=>!fn.exists).map(fn=>fn.signature);
const knownPublicCascadeTables=new Set(['public.cpa_users','public.cpa_attempts','public.cta_user','public.cta_grading_attempt','public.cta_problem_assist',
  'cpa_users','cpa_attempts','cta_user','cta_grading_attempt','cta_problem_assist',
  'cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription']);
const unexpectedPublicCascades=state.auth_dependencies.filter(item=>item.definition.includes('ON DELETE CASCADE')
  && !item.table.startsWith('auth.')&&!item.table.startsWith('storage.')&&!knownPublicCascadeTables.has(item.table));
const manifest={format:1,prepared_at:new Date().toISOString(),project,endpoint:endpoint.origin,migration_version:'20260910090000',
  migration_sha256:sha256(sql),auth_id_fingerprint:state.auth.id_fingerprint,expected_auth_count:state.auth.total,
  content:state.content,protected_content_counts:protectedCounts,cron_jobs:restoreCronJobs,state:{...state,jobs},jobs_schema:jobsSchema,additional_personal_schema:additionalPersonalSchema,auth_settings:authSettings,
  original_maintenance_state:originalState,original_maintenance_state_path:originalStatePath,
  blockers:{missing_functions:missingFunctions,unexpected_public_auth_cascades:unexpectedPublicCascades,
    migration_already_present:state.objects.common_profiles_exists,
    incomplete_jobs_schema:jobsSchema.relations.some(item=>item.kind!==null)
      && (jobsSchema.relations.some(item=>item.kind===null)||jobsSchema.functions.some(item=>item.definition_hash===null)),
    pending_financial_cleanup:state.subscriptions.open_orders+state.subscriptions.open_setups+state.billing_cleanup.pending+state.payment_cancellation_inbox,
    missing_audit_callback:!String(authSettings.uri_allow_list).includes('audit-say.vercel.app/auth/callback'),
    weak_password_minimum:Number(authSettings.password_min_length)<8},
};
const file=resolve('tmp/common-account-rollout-manifest.json');
const serialized=JSON.stringify(manifest,null,2)+'\n';
await mkdir(resolve('tmp'),{recursive:true});await writeFile(file,serialized);
console.log(JSON.stringify({manifest:file,manifest_sha256:sha256(serialized),project,counts:state,cron_jobs:cronJobs,jobs,auth_settings:authSettings,blockers:manifest.blockers},null,2));
