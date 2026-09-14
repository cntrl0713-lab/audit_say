import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {canonicalJson,contentHash} from '../../../../../lib/learningSubmission.ts';
import {publicLearningSet} from '../../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification} from '../../../../../lib/learningUnits.ts';
import {learningCatalogForBank} from '../../../../../scripts/import-question-bank-v3.ts';
import {R,N,STAGE,PROJECT,RPC,read,sha,ref,write,guard,buildLocal,buildSql,localProof} from './append-contract.mjs';

const P=N+'/preparation-v1',O=R+'/db-publication-v1';
const bank='cpa_uploader/data/cpa_question_sets_v3.authoring.json',publicFile='cpa_uploader/data/cpa_question_sets_v3.public.json',catalogFile='cpa_uploader/data/learning-question-classifications.json';
const verifier='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
const migration='supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const mode=process.argv[2],option=process.argv[3],value=process.argv[4];
assert.equal(process.argv.length,5);assert(['--prepare','--apply','--verify'].includes(mode));
const sourceProvenance=read(N+'/source-provenance.json');
const preserved=[...sourceProvenance.files.map(row=>({file:row.preserved_file,sha256:row.sha256})),...sourceProvenance.derived_files];guard(preserved);
const functions=read(N+'/sources/installed-functions-after.json').functions;
assert(functions.some(f=>f.name===RPC)&&functions.some(f=>f.name==='cpa_import_question_bank'));
const built=buildLocal();

async function query(sql,readOnly=true,parameters=[],timeout=30000){
 const response=await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly,...(parameters.length?{parameters}:{})}),signal:AbortSignal.timeout(timeout)});
 let body;try{body=await response.json();}catch{throw Object.assign(new Error('Management SQL returned an unreadable response; raw body omitted'),{http_status:response.status,sqlstate:null});}
 if(!response.ok){const text=typeof body?.message==='string'?body.message:'';throw Object.assign(new Error('Management SQL request failed; response omitted to protect source data'),{http_status:response.status,sqlstate:text.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??null});}
 assert(Array.isArray(body),'Unexpected Management SQL response shape');return body;
}
const functionNames=functions.map(f=>{assert(/^[a-z_]+$/.test(f.name));return "'"+f.name+"'";}).join(',');
const inspectSql=`select jsonb_build_object('active',(select jsonb_build_object('release_id',id,'source_file_hash',source_file_hash,'source_document_sha256',encode(sha256(convert_to(source_document,'UTF8')),'hex')) from public.cpa_question_bank_releases where status='active'),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',p.proacl::text,'security_definer',p.prosecdef) order by p.proname) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${functionNames})),'default_role_settings_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by setdatabase,setrole),'[]'::jsonb)::text,'UTF8')),'hex') from pg_db_role_setting s)) as inspection`;
const state=async()=>(await query(inspectSql))[0].inspection;

if(mode==='--prepare'){
 assert.equal(option,'--expected-active-release-id');assert(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value));
 assert(!fs.existsSync(P),'Preserve the existing preparation');assert(!fs.existsSync(O),'A DB attempt already exists; inspect it before preparing another');
 const reviewFile=N+'/independent-review.json',review=read(reviewFile);
 assert.equal(review.status,'passed_static_review');assert.equal(review.human_review_performed,false);assert.deepEqual(review.unresolved_findings,[]);
 for(const name of ['driver.mjs','append-contract.mjs','source-provenance.json'])assert(review.files.some(row=>row.file===N+'/'+name&&row.sha256===ref(N+'/'+name).sha256),'Independent reviewer must bind the exact current DB code and source provenance');
 guard(review.files);
 const expected={release_id:value,source_file_hash:sha(built.baselineDocument),set_count:built.baseline.length};
 const proof=await localProof(built),sql=buildSql(proof.pack,expected,functions,proof.payloadHash);
 const code=['driver.mjs','append-contract.mjs'].map(name=>N+'/'+name);
 const runtime=['scripts/import-question-bank-v3.ts','lib/questionV3.ts','lib/learningSubmission.ts','lib/learningPublic.ts','lib/learningUnits.ts',verifier,migration];
 const inputs=[...built.completion.files,...[R+'/publication-v1/stage-completion.json',R+'/integration-baseline.json',built.baselineFile,R+'/integration-baseline/catalog.json',R+'/changed-sets-v1.json',R+'/sealed-v1/batch.json',R+'/sealed-v1/readiness.json',N+'/source-provenance.json',reviewFile,...code,...runtime].map(ref),...preserved,...review.files];guard(inputs);
 fs.mkdirSync(P);write(P+'/append-pack.json',proof.pack);fs.writeFileSync(P+'/guarded-import.sql',sql,{flag:'wx'});
 write(P+'/local-proof.json',{...proof.proof,checked_at:new Date().toISOString(),sql_transport_bytes:Buffer.byteLength(JSON.stringify({query:sql,read_only:false})),expected_active_release_is_root_input_not_live_verified:true,api_calls:0,db_writes:0});
 write(P+'/readiness.json',{...built.readiness,reused_without_new_validation:true,prior_readiness:ref(STAGE+'/readiness.json'),recheck:{local_source_public_catalog_hashes_and_counts:true,exact_baseline_plus_three:true,preserve_source_used:false}});
 write(P+'/preparation.json',{version:1,status:'locally_prepared_not_applied',prepared_at:new Date().toISOString(),project:PROJECT,rpc:RPC,expected,inputs,pack:ref(P+'/append-pack.json'),sql:ref(P+'/guarded-import.sql'),proof:ref(P+'/local-proof.json'),readiness:ref(P+'/readiness.json'),payload_jsonb_sha256:proof.payloadHash,source_file_hash:sha(built.document),bank_content_hash:built.metadata.bank_content_hash,public_content_hash:built.metadata.public_content_hash,added_set_ids:built.ids,statement_timeout_ms:120000,transport:'management-sql-with-stored-baseline-and-exact-three-case-append',changes_to_default_role_or_database_policy:0,source_runtime_snapshots_not_other_task_success:true,api_calls:0,db_writes:0,model_api_calls:0});
 console.log(JSON.stringify({status:'locally_prepared_not_applied',preparation:ref(P+'/preparation.json'),local_proof:proof.proof,sql_transport_bytes:Buffer.byteLength(JSON.stringify({query:sql,read_only:false})),api_calls:0,db_writes:0},null,2));
}else{
 assert.equal(option,'--expected-preparation-sha256');assert.equal(value,ref(P+'/preparation.json').sha256,'Only the reviewed preparation may run');
 assert(process.execArgv.includes('--env-file=.env.local'),'Invoke root execution with --env-file=.env.local');
 const configuredUrl=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(configuredUrl.protocol,'https:');assert.equal(configuredUrl.hostname,PROJECT+'.supabase.co');assert.equal(configuredUrl.port,'');assert.equal(configuredUrl.username,'');assert.equal(configuredUrl.password,'');assert.equal(configuredUrl.search,'');assert.equal(configuredUrl.hash,'');assert.equal(configuredUrl.pathname,'/');
 assert(process.env.SUPABASE_ACCESS_TOKEN&&process.env.SUPABASE_SERVICE_ROLE_KEY,'Management and server credentials are required; values are never recorded');
 const prep=read(P+'/preparation.json');assert.equal(prep.project,PROJECT);assert.equal(prep.rpc,RPC);
 const installed=read(R+'/publication-v1/install-completion.json');assert.equal(installed.status,'canonical_installed_and_validated');guard(installed.files);
 assert.equal(ref(bank).sha256,prep.source_file_hash);assert.equal(canonicalJson(read(publicFile)),canonicalJson(built.compiled));assert.deepEqual(learningCatalogForBank(read(bank),read(catalogFile)),built.catalog);
 const inputs=[...prep.inputs,prep.pack,prep.sql,prep.proof,prep.readiness,ref(P+'/preparation.json'),ref(R+'/publication-v1/install-completion.json'),...installed.files];guard(inputs);
 const pack=read(prep.pack.file);assert.deepEqual(pack,{metadata:built.metadata,added_document:built.addedDocument});
 assert.equal(fs.readFileSync(prep.sql.file,'utf8'),buildSql(pack,prep.expected,functions,prep.payload_jsonb_sha256));
 const expectedFunctions=functions.map(({name,signature,definition_sha256,acl,security_definer})=>({name,signature,definition_sha256,acl,security_definer}));
 if(mode==='--apply'){
  assert(!fs.existsSync(O),'Prior attempt may have committed; inspect its response and state instead of retrying');
  const before=await state();assert.equal(before.active.release_id,prep.expected.release_id);assert.equal(before.active.source_file_hash,prep.expected.source_file_hash);assert.equal(before.active.source_document_sha256,prep.expected.source_file_hash);assert.deepEqual(before.functions,expectedFunctions);guard(inputs);
  fs.mkdirSync(O);write(O+'/before.json',{checked_at:new Date().toISOString(),...before});write(O+'/preparation.json',{prepared_at:new Date().toISOString(),inputs,authorization:R+'/authorization.md',incremental_preparation:ref(P+'/preparation.json')});
  fs.copyFileSync(P+'/readiness.json',O+'/readiness.json',fs.constants.COPYFILE_EXCL);
  write(O+'/apply-started.json',{started_at:new Date().toISOString(),preparation:ref(P+'/preparation.json'),sql:prep.sql,expected_active:prep.expected,transport:prep.transport,statement_timeout_ms:120000,automatic_retry:false});
  const started=Date.now();
  try{const response=await query(fs.readFileSync(prep.sql.file,'utf8'),false,[],150000);write(O+'/import-response.json',{received_at:new Date().toISOString(),elapsed_ms:Date.now()-started,response});}
  catch(error){write(O+'/import-failure.json',{failed_at:new Date().toISOString(),elapsed_ms:Date.now()-started,message:error.message,http_status:error.http_status??null,sqlstate:error.sqlstate??null,outcome:'uncertain_until_readback',automatic_retry:false});throw error;}
 }
 assert(!fs.existsSync(O+'/completion.json'),'Publication already completed');guard(read(O+'/preparation.json').inputs);
 const responseFile=O+'/import-response.json',response=read(responseFile).response;assert.equal(response.length,1);assert.equal(response[0].effective_role,'service_role');assert.equal(response[0].statement_timeout,'2min');
 const data=response[0].receipt;assert(data?.release_id);assert.equal(data.set_count,built.sets.length);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:active,error:publicError}=await db.rpc('cpa_get_active_question_bank');assert(!publicError&&Array.isArray(active),'Public roundtrip failed');assert.deepEqual([...new Set(active.map(s=>s.release_id))],[data.release_id]);
 const projected=active.map(publicLearningSet).map(s=>{delete s.release_id;delete s.set_version_id;for(const q of s.subquestions)delete q.logical_subquestion_id;return s;});assert.equal(canonicalJson(projected),canonicalJson(built.compiled));
 const {data:classes,error:classError}=await db.rpc('cpa_get_learning_classifications',{p_release_id:data.release_id});assert(!classError&&Array.isArray(classes),'Classification roundtrip failed');
 const rows=classes.map(validateLearningClassification),seen=new Set();assert.equal(rows.length,built.catalog.learning_classifications.length);
 for(const row of rows){const key=row.source_set_id+'/'+row.subquestion_id;assert(!seen.has(key));seen.add(key);const expected=built.catalog.learning_classifications.find(x=>x.set_id===row.source_set_id&&x.subquestion_id===row.subquestion_id);assert(expected);assert.equal(row.question_style,expected.question_style);assert.equal(row.case_set_id,expected.question_style==='case'?expected.set_id:null);assert.equal(row.standalone_prompt,expected.standalone_prompt);assert.deepEqual([...row.topic_ids].sort(),[...expected.topic_ids].sort());assert.deepEqual([...(row.case_fact_ids??[])].sort(),[...expected.case_fact_ids].sort());}
 const stored=(await query('select source_document,source_file_hash,bank_content_hash,public_content_hash from public.cpa_question_bank_releases where id=$1::uuid and status=\'active\'',true,[data.release_id]))[0];assert(stored);assert.equal(stored.source_document,built.document);assert.equal(sha(stored.source_document),prep.source_file_hash);for(const key of ['source_file_hash','bank_content_hash','public_content_hash'])assert.equal(stored[key],prep[key]);
 const topics=await query('select id,title,part,position from public.cpa_learning_topics order by position');assert.deepEqual(topics,[...built.catalog.learning_topics].sort((a,b)=>a.position-b.position));
 const units=buildLearningUnits(active.map(publicLearningSet),rows,built.catalog.learning_topics),after=await state(),before=read(O+'/before.json');
 assert.equal(after.active.release_id,data.release_id);assert.equal(after.active.source_file_hash,prep.source_file_hash);assert.equal(after.active.source_document_sha256,prep.source_file_hash);assert.deepEqual(after.functions,before.functions);assert.equal(after.default_role_settings_sha256,before.default_role_settings_sha256);guard(inputs);
 if(!fs.existsSync(O+'/roundtrip.json'))write(O+'/roundtrip.json',{status:'passed',checked_at:new Date().toISOString(),source_bytes_identical:true,public_round_trip:true,learning_classification_round_trip:true,learning_topic_round_trip:true,transaction_guarded_prior_versions_and_classifications_preserved:true,classification_count:rows.length,learning_unit_count:units.length,source_file_hash:prep.source_file_hash,public_content_hash:contentHash(projected),functions_and_acl_unchanged:true,default_role_and_database_settings_unchanged:true,after,original_response:ref(responseFile)});
 if(!fs.existsSync(O+'/receipt.json'))write(O+'/receipt.json',{applied_at:new Date().toISOString(),project_host:PROJECT+'.supabase.co',applied:true,...data,source_file_hash:prep.source_file_hash,bank_content_hash:prep.bank_content_hash,public_round_trip:true,source_bytes_identical:true,content_review_performed:true,progress_initialized:false,learning_classification_count:rows.length,learning_unit_count:units.length,transport:prep.transport,statement_timeout_ms:120000,reused_full_validation:prep.readiness,incremental_preparation:ref(P+'/preparation.json'),original_response:ref(responseFile),roundtrip:ref(O+'/roundtrip.json')});
 const receipt=read(O+'/receipt.json');assert.equal(receipt.release_id,data.release_id);assert.equal(receipt.source_file_hash,prep.source_file_hash);assert.equal(receipt.bank_content_hash,prep.bank_content_hash);
 const evidence=O+'/verification-evidence.json';if(!fs.existsSync(evidence))write(evidence,{applied:receipt.applied,release_id:receipt.release_id,project_host:receipt.project_host,source_file_hash:receipt.source_file_hash,bank_content_hash:receipt.bank_content_hash,public_content_hash:prep.public_content_hash,provenance:{receipt:ref(O+'/receipt.json'),readiness:ref(O+'/readiness.json'),incremental_preparation:ref(P+'/preparation.json')}});
 guard([read(evidence).provenance.receipt,read(evidence).provenance.readiness]);
 if(!fs.existsSync(O+'/verification.json')){
  const log=O+'/02-verify.log';assert(!fs.existsSync(log),'Prior independent verification requires separate reviewed continuation');const fd=fs.openSync(log,'wx'),started=Date.now();let result;
  const env={...process.env};for(const key of Object.keys(env))if(/OPENAI|ANTHROPIC/i.test(key))delete env[key];delete env.NODE_OPTIONS;
  try{result=spawnSync(process.execPath,['--import','tsx',verifier,'--read-live','--bank',bank,'--learning-catalog',catalogFile,'--evidence',evidence,'--expected-bank-sha256',ref(bank).sha256,'--expected-catalog-sha256',ref(catalogFile).sha256,'--expected-evidence-sha256',ref(evidence).sha256,'--migration',migration,'--expected-migration-sha256',ref(migration).sha256,'--expected-project',PROJECT,'--output',O+'/verification.json'],{shell:false,windowsHide:true,stdio:['ignore',fd,fd],env});}finally{fs.closeSync(fd);}
  write(O+'/02-verify.result.json',{id:'02-verify',exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-started,log:ref(log)});assert.equal(result.status,0,'Independent verification failed; inspect the preserved result');
 }
 const verification=read(O+'/verification.json');assert.equal(verification.status,'passed');guard(inputs);
 write(O+'/completion.json',{status:'production_published_and_independently_verified',completed_at:new Date().toISOString(),release_id:receipt.release_id,project_host:receipt.project_host,files:[bank,catalogFile,O+'/receipt.json',O+'/verification.json'].map(ref),counts:verification.actual,inputs_preserved:true,model_api_calls:0,incremental_preparation:ref(P+'/preparation.json')});
 console.log(JSON.stringify({status:'production_published_and_independently_verified',release_id:receipt.release_id,counts:verification.actual,output:path.resolve(O)},null,2));
}

// Direct invocation only; this script's --prepare mode performs no network calls.
assert.equal(path.resolve(process.argv[1]),fileURLToPath(import.meta.url));
