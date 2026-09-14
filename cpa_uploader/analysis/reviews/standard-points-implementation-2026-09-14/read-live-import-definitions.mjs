import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
assert.equal(project,'xvifzicrjmbfqaepcfpp');
assert(process.env.SUPABASE_ACCESS_TOKEN,'Management token is required');
const query=`select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,
encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') as definition_sha256,
p.prosecdef as security_definer,p.proacl::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('cpa_import_question_bank','cpa_import_learning_question_bank') order by p.proname`;
const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
 method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
 body:JSON.stringify({query,read_only:true}),signal:AbortSignal.timeout(30000)});
assert(response.ok,`Read-only management request failed HTTP ${response.status}`);
const rows=await response.json();
assert.equal(rows.length,2);
const file='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/live-import-definitions-before.json';
fs.writeFileSync(file,JSON.stringify({project,read_only:true,queried_at:new Date().toISOString(),official_http_contract:'https://supabase.com/docs/reference/api/v1-run-a-query',functions:rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({project,read_only:true,functions:rows.map(({signature,definition_sha256,security_definer,acl})=>({signature,definition_sha256,security_definer,acl})),file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
