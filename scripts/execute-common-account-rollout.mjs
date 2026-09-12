import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Prepared executor. No mutation occurs without every explicit apply guard.
// Never logs account identifiers, emails, tokens, provider keys, or response bodies.
const argv=process.argv.slice(2);
function option(name){const index=argv.indexOf(name);return index>=0?argv[index+1]:undefined;}
const apply=argv.includes('--apply');
const phase=option('--phase');
const phases=new Set(['pause-cron','migrate','reset','resume-cron']);
if(!phases.has(phase))throw new Error('Use --phase pause-cron|migrate|reset|resume-cron');
const manifestPath=resolve(option('--manifest')??'tmp/common-account-rollout-manifest.json');
const expectedManifestHash=option('--manifest-sha256');
const expectedProject=option('--expected-project');
const digest=(text,algorithm='sha256')=>createHash(algorithm).update(text).digest('hex');
const manifestBytes=await readFile(manifestPath,'utf8');
if(!/^[a-f0-9]{64}$/.test(expectedManifestHash??'')||digest(manifestBytes)!==expectedManifestHash)throw new Error('Prepared manifest fingerprint mismatch');
const manifest=JSON.parse(manifestBytes);
process.loadEnvFile('.env.local');
const endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const project=endpoint.hostname.split('.')[0];
if(project!==expectedProject||project!==manifest.project||endpoint.origin!==manifest.endpoint||!/^[a-z0-9]{20}$/.test(project)
  ||endpoint.hostname!==`${project}.supabase.co`)throw new Error('Exact production project guard failed');
if(manifest.format!==1||manifest.migration_version!=='20260910090000')throw new Error('Unknown manifest version');
if(manifest.blockers.missing_functions.length||manifest.blockers.unexpected_public_auth_cascades.length||manifest.blockers.incomplete_jobs_schema)throw new Error('Unresolved preflight schema blockers');
const sql=await readFile(resolve('supabase/migrations/20260910090000_common_accounts.sql'),'utf8');
if(digest(sql)!==manifest.migration_sha256)throw new Error('Reviewed migration bytes changed; prepare a new manifest');
const ctaCopy=await readFile(resolve('../CTA_tax_law/supabase/migrations/20260910090000_common_accounts.sql'),'utf8');
if(sql!==ctaCopy)throw new Error('Two deployment migrations differ');
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token)throw new Error('Management token missing');
if(phase==='reset'&&!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Service-role key missing before any account preparation');
const outputDir=dirname(manifestPath);
const migrationReceipt=resolve(outputDir,'common-account-migration-receipt.json');
const checkpointPath=resolve(outputDir,'common-account-reset-checkpoint.json');
const literal=text=>`'${String(text).replaceAll("'","''")}'`;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function query(statement,write=false){
  if(write&&!apply)throw new Error('Mutation requires --apply');
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:statement,read_only:!write}),signal:AbortSignal.timeout(60000),
  });
  if(!response.ok){
    const body=await response.text();
    const safe=body.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,'[email]')
      .replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,'[uuid]').slice(0,1800);
    throw new Error(`Database request failed (${response.status}): ${safe}`);
  }
  const rows=await response.json();if(!Array.isArray(rows))throw new Error('Unexpected database response');return rows;
}
async function authIds(){
  const rows=await query('select id::text as id,coalesce(is_anonymous,false) as anonymous from auth.users order by id');
  if(rows.some(row=>!uuidPattern.test(row.id)))throw new Error('Unexpected account identifier');return rows;
}
async function assertSchema(){
  const expected=manifest.jobs_schema;
  if(!expected||!Array.isArray(expected.relations)||expected.relations.length!==5
    ||!Array.isArray(expected.functions)||expected.functions.length!==3)throw new Error('Jobs schema inventory missing; reprepare this manifest');
  const [row]=await query(`select jsonb_build_object(
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
  // Compare each named field: jsonb key serialization order is not contractual.
  for(const key of ['relations','columns','functions','view_hash']){
    if(JSON.stringify(row.jobs_schema[key])!==JSON.stringify(expected[key]))throw new Error(`Jobs schema changed (${key}); reprepare after reviewing the jobs deployment`);
  }
}
async function assertContent(){
  const [row]=await query(`select (select count(*) from public.cpa_question_sets) as cpa_sets,
    (select md5(coalesce(string_agg(id,',' order by id),'')) from public.cpa_question_sets) as cpa_set_fingerprint,
    (select count(*) from public.cta_problem) as cta_problems,
    (select md5(coalesce(string_agg(id::text,',' order by id),'')) from public.cta_problem) as cta_problem_fingerprint`);
  for(const key of Object.keys(manifest.content))if(String(row[key])!==String(manifest.content[key]))throw new Error(`Content identity changed (${key})`);
  if(!Array.isArray(manifest.protected_content_counts)||!manifest.protected_content_counts.length
    ||manifest.protected_content_counts.some(table=>!/^c(pa|ta)_[a-z0-9_]+$/.test(table.table_name)))throw new Error('Protected content table manifest missing/invalid');
  const counts=await query(manifest.protected_content_counts.map(table=>`select '${table.table_name}' as table_name,count(*) as row_count from public.${table.table_name}`).join(' union all '));
  for(const expected of manifest.protected_content_counts){
    const live=counts.find(table=>table.table_name===expected.table_name);
    if(!live||Number(live.row_count)!==Number(expected.row_count))throw new Error(`Protected content row count changed (${expected.table_name})`);
  }
}
async function cronState(){
  const ids=manifest.cron_jobs.map(job=>job.jobid);
  if(!ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<1))throw new Error('Invalid pinned cron ID');
  const rows=await query('select jobid,jobname,schedule,active,md5(command) as command_fingerprint from cron.job order by jobid');
  if(rows.length!==ids.length)throw new Error('Cron inventory changed; review new or removed jobs before reset');
  for(const expected of manifest.cron_jobs){
    const live=rows.find(row=>row.jobid===expected.jobid);
    if(!live||['jobname','schedule','command_fingerprint'].some(key=>live[key]!==expected[key]))throw new Error('Pinned cron definition changed');
  }return rows;
}
async function assertMaintenance(){
  if(!argv.includes('--maintenance-confirmed'))throw new Error('App requests must be quiesced: pass --maintenance-confirmed only after actual maintenance');
  const rows=await cronState();
  if(rows.some(row=>row.active))throw new Error('Pinned cron jobs must be paused before schema/reset');
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Auth maintenance read failed (${response.status})`);
  const config=await response.json();
  if(config.disable_signup!==true||config.external_anonymous_users_enabled!==false)throw new Error('Disable signup and anonymous signup in Auth before reset/migration');
}
async function assertPinnedAccounts(){
  const rows=await authIds();
  if(rows.length!==manifest.expected_auth_count||digest(rows.map(row=>row.id).join(','),'md5')!==manifest.auth_id_fingerprint)throw new Error('Pinned Auth account set changed; reprepare after maintenance');
  return rows;
}
async function assertNoPendingFinance(){
  const [row]=await query(`select
    (select count(*) from public.cta_subscription where toss_billing_key is not null or billing_order_id is not null or billing_setup_state is not null or billing_claim_token is not null) as subscriptions,
    (select count(*) from public.cta_billing_key_cleanup) as cleanup,
    (select count(*) from public.cta_verified_payment_cancellation) as cancellation_inbox`);
  if(Object.values(row).some(count=>Number(count)>0))throw new Error('Financial cleanup became pending; resolve through the reviewed policy, not bulk reset');
}
await assertSchema();
await assertContent();
await cronState();
if(!apply){
  console.log(JSON.stringify({mode:'read-only-preview',phase,project,manifest_sha256:expectedManifestHash,migration_sha256:manifest.migration_sha256,
    pinned_accounts:manifest.expected_auth_count,pinned_cron_jobs:manifest.cron_jobs.map(job=>({id:job.jobid,name:job.jobname,restore_active:job.active})),
    required_before_mutation:['--apply','--expected-project','--manifest-sha256',...(phase==='migrate'||phase==='reset'?['--maintenance-confirmed','Auth signup + anonymous signup disabled','Pinned cron inactive']:[])]},null,2));
  process.exit(0);
}
if(phase==='pause-cron'||phase==='resume-cron'){
  const resume=phase==='resume-cron';
  for(const job of manifest.cron_jobs)await query(`select cron.alter_job(${job.jobid},active:=${resume&&job.active?'true':'false'})`,true);
  console.log(JSON.stringify({phase,project,changed_jobs:manifest.cron_jobs.length}));
  process.exit(0);
}
await assertMaintenance();
await assertNoPendingFinance();
if(phase==='migrate'){
  await assertPinnedAccounts();
  const [presence]=await query(`select to_regclass('public.common_profiles') is not null as common_exists,
    exists(select 1 from supabase_migrations.schema_migrations where version='20260910090000') as version_exists`);
  if(presence.common_exists||presence.version_exists){
    const [history]=await query("select md5(statements[1]) as source_hash from supabase_migrations.schema_migrations where version='20260910090000'");
    if(!presence.common_exists||!presence.version_exists||history?.source_hash!==digest(sql,'md5'))throw new Error('Existing migration is not this exact prepared source; no reapply');
    await writeFile(migrationReceipt,JSON.stringify({project,manifest_sha256:expectedManifestHash,migration_sha256:manifest.migration_sha256,reconciled_at:new Date().toISOString()},null,2));
    console.log(JSON.stringify({phase:'migration-already-applied',project,receipt:migrationReceipt}));
    process.exit(0);
  }
  for(const fn of manifest.state.functions){
    const [live]=await query(`select md5(pg_get_functiondef(to_regprocedure(${literal('public.'+fn.signature)}))) as definition_hash`);
    if(live.definition_hash!==fn.definition_hash)throw new Error(`Prerequisite function changed: ${fn.signature}`);
  }
  const columns=await query("select column_name from information_schema.columns where table_schema='supabase_migrations' and table_name='schema_migrations'");
  if(!['version','name','statements'].every(column=>columns.some(row=>row.column_name===column)))throw new Error('Unexpected migration history schema');
  if(!/commit;\s*$/i.test(sql))throw new Error('Reviewed transaction terminator missing');
  const history=`insert into supabase_migrations.schema_migrations(version,name,statements) values('20260910090000','common_accounts',array[${literal(sql)}]);\ncommit;`;
  // SQL regexes contain JavaScript replacement tokens such as $'; keep literal bytes.
  await query(sql.replace(/commit;\s*$/i,()=>history),true);
  await assertSchema();
  await assertContent();
  await mkdir(outputDir,{recursive:true});
  await writeFile(migrationReceipt,JSON.stringify({project,manifest_sha256:expectedManifestHash,migration_sha256:manifest.migration_sha256,applied_at:new Date().toISOString()},null,2));
  console.log(JSON.stringify({phase,project,migration_sha256:manifest.migration_sha256,accounts_deleted:0,receipt:migrationReceipt}));
  process.exit(0);
}

const receipt=JSON.parse(await readFile(migrationReceipt,'utf8'));
if(receipt.project!==project||receipt.manifest_sha256!==expectedManifestHash||receipt.migration_sha256!==manifest.migration_sha256)throw new Error('Matching migration receipt required before reset');
const [foreignKeys]=await query(`select count(*) as unsafe_financial_cascades from pg_constraint
  where confrelid='public.cta_user'::regclass and contype='f' and confdeltype='c'
    and conrelid in ('public.cta_subscription'::regclass,'public.cta_payment_log'::regclass,'public.cta_referral'::regclass,'public.cta_pro_reward'::regclass)`);
if(Number(foreignKeys.unsafe_financial_cascades)!==0)throw new Error('Financial cascade preservation is not installed');
let checkpoint;
try{checkpoint=JSON.parse(await readFile(checkpointPath,'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;}
if(checkpoint){
  if(checkpoint.project!==project||checkpoint.manifest_sha256!==expectedManifestHash)throw new Error('Reset checkpoint belongs to another prepared run');
}else{
  const targets=await assertPinnedAccounts();
  checkpoint={project,manifest_sha256:expectedManifestHash,targets,completed:0,started_at:new Date().toISOString()};
  await writeFile(checkpointPath,JSON.stringify(checkpoint,null,2),{mode:0o600});
}
if(checkpoint.targets.some(row=>!uuidPattern.test(row.id))||checkpoint.targets.length!==manifest.expected_auth_count
  ||digest(checkpoint.targets.map(row=>row.id).sort().join(','),'md5')!==manifest.auth_id_fingerprint)throw new Error('Pinned reset checkpoint fingerprint mismatch');
const targetSet=new Set(checkpoint.targets.map(row=>row.id));
let remaining=await authIds();
if(remaining.some(row=>!targetSet.has(row.id)))throw new Error('A new account exists; bulk reset refuses to touch unpinned accounts');
const registered=remaining.filter(row=>!row.anonymous);
if(registered.length){
  const ids=registered.map(row=>literal(row.id)+'::uuid').join(',');
  const prepared=await query(`select result->>'ready_for_auth_delete' as ready from (
    select public.common_prepare_account_deletion(id) as result from auth.users where id=any(array[${ids}])
  ) prepared`,true);
  if(prepared.length!==registered.length||prepared.some(row=>row.ready!=='true'))throw new Error('Account cleanup requires attention; no Auth deletion started');
}
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!serviceKey)throw new Error('Service-role key missing');
const admin=createClient(endpoint.origin,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
while(remaining.length){
  if(remaining.some(row=>!targetSet.has(row.id)))throw new Error('New account detected during reset; unpinned accounts were not touched');
  const batch=remaining.slice(0,4);
  const results=await Promise.all(batch.map(async row=>{
    const {error}=await admin.auth.admin.deleteUser(row.id,false);
    return{ok:!error,status:error?.status??null,code:error?.code??null};
  }));
  checkpoint.completed+=results.filter(result=>result.ok).length;
  checkpoint.updated_at=new Date().toISOString();
  await writeFile(checkpointPath,JSON.stringify(checkpoint,null,2),{mode:0o600});
  if(results.some(result=>!result.ok))throw new Error(`Auth deletion stopped after ${checkpoint.completed} successful requests; failed statuses: ${results.filter(result=>!result.ok).map(result=>result.status).join(',')}`);
  if(checkpoint.completed%40===0)console.log(JSON.stringify({phase:'reset-progress',completed:checkpoint.completed,pinned_total:manifest.expected_auth_count}));
  remaining=await authIds();
}
await assertSchema();
await assertContent();
checkpoint.completed=manifest.expected_auth_count;checkpoint.finished_at=new Date().toISOString();
await writeFile(checkpointPath,JSON.stringify(checkpoint,null,2),{mode:0o600});
console.log(JSON.stringify({phase:'reset-complete',project,deleted_pinned_accounts:manifest.expected_auth_count,auth_remaining:0,content_preserved:true}));
