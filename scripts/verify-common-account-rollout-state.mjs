import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Read-only post-reset verification. Every database request sets read_only=true;
// Auth configuration is GET-only. Never queries or prints account identifiers,
// emails, provider keys, tokens, raw cron commands, or Auth configuration secrets.
const argv=process.argv.slice(2);
const option=name=>{const index=argv.indexOf(name);return index<0?undefined:argv[index+1];};
const stage=option('--stage');
if(!['paused','live'].includes(stage))throw new Error('Use --stage paused|live only after account reset has completed');
if(argv.includes('--apply'))throw new Error('This verifier is read-only and does not accept --apply');
const sha=(value,algorithm='sha256')=>createHash(algorithm).update(value).digest('hex');
const manifestBytes=await readFile(resolve(option('--manifest')??'tmp/common-account-rollout-manifest.json'),'utf8');
const expectedHash=option('--manifest-sha256');
if(!/^[a-f0-9]{64}$/.test(expectedHash??'')||sha(manifestBytes)!==expectedHash)throw new Error('Prepared manifest fingerprint mismatch');
const manifest=JSON.parse(manifestBytes);
process.loadEnvFile('.env.local');
const endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const project=endpoint.hostname.split('.')[0];
if(project!==option('--expected-project')||project!==manifest.project||endpoint.origin!==manifest.endpoint
  ||!/^[a-z0-9]{20}$/.test(project)||endpoint.hostname!==`${project}.supabase.co`)throw new Error('Exact production project guard failed');
if(manifest.format!==1||manifest.migration_version!=='20260910090000')throw new Error('Unknown prepared migration');
const sql=await readFile(resolve('supabase/migrations/20260910090000_common_accounts.sql'),'utf8');
if(sha(sql)!==manifest.migration_sha256)throw new Error('Reviewed migration source changed');
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw new Error('Management token missing');
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
async function query(statement){
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:statement,read_only:true}),signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw new Error(`Read-only verification query failed (${response.status}); response omitted`);
  const rows=await response.json();if(!Array.isArray(rows))throw new Error('Unexpected database response');return rows;
}
const failures=[];
const check=(condition,label)=>{if(!condition)failures.push(label);};

const [installed]=await query(`select to_regclass('public.common_profiles') is not null as common_exists,
  (select md5(statements[1]) from supabase_migrations.schema_migrations where version='20260910090000') as source_hash`);
check(installed.common_exists,'Common profile schema absent');
check(installed.source_hash===sha(sql,'md5'),'Installed migration source hash differs from reviewed SQL');

const [coreContent]=await query(`select (select count(*) from public.cpa_question_sets) as cpa_sets,
  (select md5(coalesce(string_agg(id,',' order by id),'')) from public.cpa_question_sets) as cpa_set_fingerprint,
  (select count(*) from public.cta_problem) as cta_problems,
  (select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.cta_problem) as cta_problem_fingerprint`);
for(const [key,expected] of Object.entries(manifest.content))check(String(coreContent[key])===String(expected),`Protected content fingerprint/count changed: ${key}`);
const protectedTables=manifest.protected_content_counts;
if(!Array.isArray(protectedTables)||protectedTables.length<41
  ||protectedTables.some(item=>!/^c(pa|ta)_[a-z0-9_]+$/.test(item.table_name)))throw new Error('Protected content inventory missing or invalid');
const protectedCounts=await query(protectedTables.map(item=>`select ${literal(item.table_name)} as table_name,count(*) as row_count from public.${item.table_name}`).join(' union all '));
for(const expected of protectedTables)check(protectedCounts.some(item=>item.table_name===expected.table_name&&Number(item.row_count)===Number(expected.row_count)),`Protected content count changed: ${expected.table_name}`);

const accountTables=['common_profiles','cpa_users','cta_user'];
const personalTables=['cpa_attempts','cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results',
  'cpa_review_items','cpa_xp_events','cta_grading_attempt','cta_problem_assist','cta_usage_receipts',
  'cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription','cpa_kicpa_jobs_subscribers','cpa_kicpa_job_deliveries'];
const financialTables=['cta_subscription','cta_payment_log','cta_referral','cta_pro_reward','cta_billing_key_cleanup','cta_verified_payment_cancellation','common_payment_resolution_log'];
const optionalTables=new Set(['cpa_review_notes','cpa_firm_chat_message','cpa_firm_review','cpa_firm_subscription','cpa_kicpa_jobs_subscribers','cpa_kicpa_job_deliveries']);
const emptyTables=[...accountTables,...personalTables,...financialTables];
const presence=await query(`select v.name,to_regclass('public.'||v.name) is not null as present from (values ${emptyTables.map(name=>`(${literal(name)})`).join(',')}) v(name)`);
for(const table of presence)check(table.present||optionalTables.has(table.name),`Required account/personal/finance table missing: ${table.name}`);
const presentEmptyTables=presence.filter(item=>item.present).map(item=>item.name);
const emptyCounts=await query(["select 'auth.users' as table_name,count(*) as row_count from auth.users",...presentEmptyTables.map(name=>`select ${literal(name)} as table_name,count(*) as row_count from public.${name}`)].join(' union all '));
if(stage==='paused'){
  for(const table of emptyCounts)check(Number(table.row_count)===0,`Reset table not empty: ${table.table_name} (${table.row_count})`);
}
// Once live, new users and guest sessions are legitimate. Verify the pinned old
// identities are gone rather than requiring the reopened service to stay empty.
const checkpoint=JSON.parse(await readFile(resolve(option('--checkpoint')??'tmp/common-account-reset-checkpoint.json'),'utf8'));
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if(checkpoint.project!==project||checkpoint.manifest_sha256!==expectedHash||!Array.isArray(checkpoint.targets)
  ||checkpoint.targets.length!==manifest.expected_auth_count||checkpoint.targets.some(row=>!uuidPattern.test(row.id))
  ||sha(checkpoint.targets.map(row=>row.id).sort().join(','),'md5')!==manifest.auth_id_fingerprint)throw new Error('Pinned reset checkpoint fingerprint mismatch');
check(checkpoint.completed===manifest.expected_auth_count&&Boolean(checkpoint.finished_at),'Reset checkpoint is not complete');
const [pinned]=await query(`select count(*) as remaining from auth.users where id=any(array[${checkpoint.targets.map(row=>literal(row.id)+'::uuid').join(',')}])`);
check(Number(pinned.remaining)===0,'Previously pinned Auth identities remain after reset');
const [invariants]=await query(`select
  (select count(*) from auth.users a left join public.common_profiles p on p.id=a.id
    where not coalesce(a.is_anonymous,false) and p.id is null) as registered_without_common_profile,
  (select count(*) from public.common_profiles p join auth.users a on a.id=p.id where coalesce(a.is_anonymous,false)) as anonymous_common_profiles,
  (select count(*) from public.cpa_users s left join public.common_profiles p on p.id=s.id where p.id is null) as cpa_without_common_profile,
  (select count(*) from public.cta_user s left join public.common_profiles p on p.id=s.id where p.id is null) as cta_without_common_profile`);
for(const [name,count] of Object.entries(invariants))check(Number(count)===0,`New account invariant failed: ${name} (${count})`);

const jobRelations=manifest.jobs_schema?.relations;
if(!Array.isArray(jobRelations)||jobRelations.length!==5)throw new Error('Pinned jobs schema inventory missing');
const liveJobs=await query(`select v.name,c.relkind as kind from (values ${jobRelations.map(item=>`(${literal(item.name)})`).join(',')}) v(name)
  left join pg_class c on c.oid=to_regclass('public.'||v.name)`);
for(const expected of jobRelations)check(liveJobs.some(item=>item.name===expected.name&&item.kind===expected.kind),`Jobs schema changed: ${expected.name}`);

const serverNames=['cpa_begin_attempt','cpa_claim_grading_run','cpa_complete_grading_run','cpa_fail_grading_run','cpa_update_review_item',
  'consume_hint_quota','reserve_grading_attempt','begin_subscription_setup','claim_subscription_billing','finalize_billing_success',
  'finalize_subscription_setup','apply_verified_payment_cancellation','cancel_subscription_renewal','extend_pro','grant_referral_rewards','handle_new_user'];
const grants=await query(`select p.proname as name,p.oid::regprocedure::text as signature,p.prorettype='trigger'::regtype as is_trigger,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_allowed,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_allowed,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_allowed
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and (p.proname like 'common_%' or p.proname in (${serverNames.map(literal).join(',')})) order by p.proname,p.oid`);
const requiredCommon=['common_ensure_profile','common_update_nickname','common_join_service','common_assert_service_access',
  'common_withdraw_service','common_prepare_account_deletion','common_cta_hint_usage','common_resolve_withdrawn_order_no_charge'];
for(const name of [...serverNames,...requiredCommon])check(grants.some(fn=>fn.name===name),`Required account RPC missing: ${name}`);
for(const fn of grants){
  check(!fn.anon_allowed&&!fn.authenticated_allowed,`Browser can execute server-only function: ${fn.signature}`);
  const serverAllowed=!fn.is_trigger&&!fn.name.startsWith('common_legacy_')&&fn.name!=='common_resolve_withdrawn_order_no_charge';
  check(fn.service_allowed===serverAllowed,`Service-role grant incorrect: ${fn.signature}`);
}

const cronJobs=await query('select jobid,jobname,schedule,active,md5(command) as command_fingerprint from cron.job order by jobid');
const original=manifest.original_maintenance_state;
if(original?.project!==project||!Array.isArray(original.cron_jobs)||original.cron_jobs.length!==4)throw new Error('Original four-cron state missing');
check(cronJobs.length===original.cron_jobs.length,'Cron inventory changed');
for(const expected of original.cron_jobs){
  const live=cronJobs.find(job=>job.jobid===expected.jobid);
  check(live&&['jobname','schedule','command_fingerprint'].every(key=>live[key]===expected[key]),`Cron definition changed: ${expected.jobid}`);
  check(live?.active===(stage==='paused'?false:expected.active),`Cron active state incorrect: ${expected.jobid}`);
}
const authResponse=await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`,{
  headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000),
});
if(!authResponse.ok)throw new Error(`Read-only Auth config verification failed (${authResponse.status})`);
const auth=await authResponse.json();
const callbacks=String(auth.uri_allow_list??'').split(',').map(value=>value.trim());
for(const callback of ['https://audit-say.vercel.app/auth/callback','https://cta-tax-law.vercel.app/auth/callback'])check(callbacks.includes(callback),`Required Auth callback absent: ${callback}`);
check(Number(auth.password_min_length)>=8,'Auth password minimum below eight');
check(auth.disable_signup===(stage==='paused'?true:original.auth_settings.disable_signup),'Auth signup flag differs from desired stage');
check(auth.external_anonymous_users_enabled===(stage==='paused'?false:original.auth_settings.external_anonymous_users_enabled),'Anonymous signup flag differs from desired stage');

console.log(JSON.stringify({verified_at:new Date().toISOString(),project,stage,ok:failures.length===0,
  migration_source_sha256:manifest.migration_sha256,protected_content_tables_checked:protectedTables.length,
  core_content:{cpa_sets:coreContent.cpa_sets,cta_problems:coreContent.cta_problems},
  pinned_accounts_remaining:Number(pinned.remaining),current_table_counts:emptyCounts,account_invariants:invariants,
  server_function_grants_checked:grants.length,
  cron_jobs:cronJobs.map(job=>({id:job.jobid,name:job.jobname,active:job.active})),
  auth_settings:{password_min_length:auth.password_min_length,disable_signup:auth.disable_signup,anonymous_enabled:auth.external_anonymous_users_enabled},
  failures},null,2));
if(failures.length)process.exitCode=1;
