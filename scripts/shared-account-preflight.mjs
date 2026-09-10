import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Read-only metadata snapshot: never selects user rows or prints credentials.
process.loadEnvFile('.env.local');
const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const project = host.split('.')[0];
const query = `select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(c)) from (select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and (table_name like 'cta_%' or table_name in ('cpa_users','cpa_attempts','cpa_review_items','cpa_xp_events')) order by table_name,ordinal_position) c),
 'constraints',(select jsonb_agg(to_jsonb(c)) from (select r.relname table_name,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class r on r.oid=k.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname='public' and (r.relname like 'cta_%' or r.relname in ('cpa_users','cpa_attempts','cpa_review_items','cpa_xp_events')) order by r.relname,k.conname) c),
 'triggers',(select jsonb_agg(to_jsonb(t)) from (select n.nspname schema_name,r.relname table_name,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class r on r.oid=t.tgrelid join pg_namespace n on n.oid=r.relnamespace where not t.tgisinternal and ((n.nspname='auth' and r.relname='users') or (n.nspname='public' and (r.relname like 'cta_%' or r.relname like 'cpa_%'))) order by n.nspname,r.relname,t.tgname) t)
) as metadata`;
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
 method:'POST', headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
 body:JSON.stringify({query,read_only:true}),signal:AbortSignal.timeout(30000),
});
if(!response.ok) throw new Error(`Read-only schema preflight failed (${response.status})`);
const rows=await response.json();
if(!Array.isArray(rows) || !rows[0]?.metadata) throw new Error('Unexpected metadata response');
const metadata=rows[0].metadata;
const output=resolve('tmp/shared-account-schema.json');
await mkdir(resolve('tmp'),{recursive:true});
await writeFile(output,JSON.stringify(metadata,null,2));
console.log(JSON.stringify({project,output,columns:metadata.columns?.length,constraints:metadata.constraints?.length,triggers:metadata.triggers?.length}));
const authResponse = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
 headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}, signal:AbortSignal.timeout(30000),
});
if(!authResponse.ok) throw new Error(`Auth configuration read failed (${authResponse.status})`);
const auth=await authResponse.json();
const publicSettings=Object.fromEntries(['site_url','uri_allow_list','mailer_autoconfirm','password_min_length','security_update_password_require_reauthentication','mailer_secure_email_change_enabled','external_anonymous_users_enabled'].map(key=>[key,auth[key]]));
await writeFile(resolve('tmp/shared-account-auth-settings.json'),JSON.stringify(publicSettings,null,2));
console.log(JSON.stringify({authSettings:publicSettings}));
