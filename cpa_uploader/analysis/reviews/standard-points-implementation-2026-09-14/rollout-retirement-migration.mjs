import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const O=R+'/db-retirement-migration-v1';
const migration='supabase/migrations/20260914080000_cpa_reviewed_question_retirements.sql';
const mode=process.argv[2];assert(['--prepare','--apply'].includes(mode));
const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
assert.equal(project,'xvifzicrjmbfqaepcfpp');assert(process.env.SUPABASE_ACCESS_TOKEN);
const read=f=>JSON.parse(fs.readFileSync(f));
const sha=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,obj)=>fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});
const originalNames=['cpa_import_question_bank','cpa_import_learning_question_bank','cpa_get_question_version','cpa_get_question_version_with_source_metadata'];
const newNames=['cpa_assert_reviewed_question_retirements','cpa_import_question_bank_with_retirements','cpa_import_learning_question_bank_with_retirements'];
const inspection=`select jsonb_build_object(
 'active',(select jsonb_build_object('release_id',id,'source_file_hash',source_file_hash) from public.cpa_question_bank_releases where status='active'),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'name',p.proname,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'definition',pg_get_functiondef(p.oid),'security_definer',p.prosecdef,'acl',p.proacl::text,'public_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname)
 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${[...originalNames,...newNames].map(s=>"'"+s+"'").join(',')}))) as inspection`;
async function query(sql,readOnly){
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
  body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(30000)});
 assert(response.ok,`Management SQL request failed HTTP ${response.status}`);
 return response.json();
}
const state=async()=>(await query(inspection,true))[0].inspection;
if(mode==='--prepare'){
 assert(!fs.existsSync(O));
 const before=await state(),original=read(R+'/live-import-definitions-before.json'),plan=read(R+'/retirement-plan.json');
 assert.equal(before.functions.length,originalNames.length,'Retirement functions already exist; inspect prior rollout');
 for(const row of original.functions){const actual=before.functions.find(f=>f.signature===row.signature);assert(actual);assert.equal(actual.definition_sha256,row.definition_sha256);assert.equal(actual.acl,row.acl);}
 assert.equal(before.active.release_id,plan.expected_active_release_id);assert.equal(before.active.source_file_hash,plan.expected_active_source_file_hash);
 for(const f of before.functions)assert.equal(f.security_definer,false);
 fs.mkdirSync(O);write(O+'/before.json',before);
 fs.copyFileSync(migration,O+'/migration.sql',fs.constants.COPYFILE_EXCL);
 const guards=before.functions.map(f=>{assert(/^[a-f0-9]{64}$/.test(f.definition_sha256));assert(/^[a-z_]+\((jsonb|uuid)\)$/.test(f.signature));return `if encode(sha256(convert_to(pg_get_functiondef('public.${f.signature}'::regprocedure),'UTF8')),'hex') <> '${f.definition_sha256}' then raise exception 'Protected function changed after retirement preparation'; end if;`;}).join('\n');
 const sql=fs.readFileSync(migration,'utf8');
 assert.equal((sql.match(/^begin;$/gm)||[]).length,1);assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
 const guarded=`begin;\ndo $retirement_preflight$ begin\n${guards}\nif not exists(select 1 from public.cpa_question_bank_releases where status='active' and id='${before.active.release_id}'::uuid and source_file_hash='${before.active.source_file_hash}') then raise exception 'Active release changed before retirement DDL'; end if;\nend $retirement_preflight$;\n`+sql.replace(/^begin;$/m,'').replace(/^commit;$/m,'')+'\ncommit;\n';
 fs.writeFileSync(O+'/guarded-migration.sql',guarded,{flag:'wx'});
 write(O+'/preparation.json',{project,prepared_at:new Date().toISOString(),migration:ref(migration),snapshot:ref(O+'/migration.sql'),before:ref(O+'/before.json'),guarded_sql:ref(O+'/guarded-migration.sql'),retirement_plan:ref(R+'/retirement-plan.json'),read_only:true,ddl_applied:false,official_contract:'https://supabase.com/docs/reference/api/v1-run-a-query'});
 console.log(JSON.stringify({status:'prepared_read_only',project,preparation:ref(O+'/preparation.json'),migration:ref(migration)}));
}else{
 assert(!fs.existsSync(O+'/completion.json'),'Do not repeat a completed rollout');assert(!fs.existsSync(O+'/apply-started.json'),'Inspect an uncertain prior DDL attempt before retrying');
 const prep=read(O+'/preparation.json');assert.equal(prep.project,project);
 const inputs=[prep.migration,prep.snapshot,prep.before,prep.guarded_sql,prep.retirement_plan];
 const guard=()=>{for(const x of inputs)assert.equal(ref(x.file).sha256,x.sha256,'Changed prepared migration evidence');};guard();
 const before=read(prep.before.file),current=await state();assert.deepEqual(current,before,'Database functions or active release changed');
 write(O+'/apply-started.json',{started_at:new Date().toISOString(),project,prepared:ref(O+'/preparation.json'),migration:prep.migration});
 const response=await query(fs.readFileSync(prep.guarded_sql.file,'utf8'),false);
 write(O+'/ddl-response.json',{received_at:new Date().toISOString(),response});
 const after=await state();write(O+'/after.json',after);
 assert.deepEqual(after.active,before.active,'DDL must not publish content');
 for(const old of before.functions)assert.deepEqual(after.functions.find(f=>f.signature===old.signature),old,'Original import/getter definition or ACL changed');
 for(const name of newNames){const added=after.functions.filter(f=>f.name===name);assert.equal(added.length,1);assert.equal(added[0].security_definer,false);assert.equal(added[0].public_execute,false);assert.equal(added[0].authenticated_execute,false);assert.equal(added[0].service_execute,true);}
 guard();write(O+'/completion.json',{status:'retirement_rpc_installed_and_verified',completed_at:new Date().toISOString(),project,migration:prep.migration,before:prep.before,after:ref(O+'/after.json'),original_functions_unchanged:true,content_releases_unchanged:true,bank_rows_deleted:0,attempts_deleted:0});
 console.log(JSON.stringify({status:'retirement_rpc_installed_and_verified',completion:ref(O+'/completion.json')}));
}
