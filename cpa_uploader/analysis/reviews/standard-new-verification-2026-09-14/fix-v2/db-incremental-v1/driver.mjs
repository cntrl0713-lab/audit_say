// KGA 약칭 수정 21세트의 운영 DB 반영. case-trio 추가 게시 driver를 교체 계약으로 옮겼다.
//   --inspect  : 읽기 전용으로 active release와 importer 함수 정의를 기록한다.
//   --prepare  : 로컬 복원 증명과 guarded SQL을 만든다(네트워크 없음).
//   --probe    : 같은 복원 SQL을 운영 DB의 read-only 트랜잭션에서 실행해 payload 해시만 대조한다(쓰기 없음).
//   --apply    : 검토한 SQL을 한 번 실행하고 왕복·독립 검증까지 수행한다. 실패 시 자동 재시도하지 않는다.
//   --verify   : 원 응답이 보존된 경우에만 남은 읽기 검사를 이어간다.
//   node --env-file=.env.local --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2/db-incremental-v1/driver.mjs <mode> [--expected-preparation-sha256 SHA]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {canonicalJson,contentHash} from '../../../../../../lib/learningSubmission.ts';
import {publicLearningSet} from '../../../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification} from '../../../../../../lib/learningUnits.ts';
import {learningCatalogForBank} from '../../../../../../scripts/import-question-bank-v3.ts';
import {F,N,PROJECT,RPC,read,sha,ref,write,guard,buildLocal,buildSql,localProof} from './replace-contract.mjs';

// fix-v1 driver와 같다. 읽기 전용 probe 방식(API·SQL 모두 read only)으로 시작한다.
const P=N+'/preparation-v1',O=F+'/db-publication-v1';
const bank='cpa_uploader/data/cpa_question_sets_v3.authoring.json',publicFile='cpa_uploader/data/cpa_question_sets_v3.public.json',catalogFile='cpa_uploader/data/learning-question-classifications.json';
const verifier='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts';
const migration='supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const reviewedFunctions='cpa_uploader/analysis/reviews/case-trio-2026-09-14/incremental-db-publication-v1/sources/installed-functions-after.json';
const mode=process.argv[2];assert(['--inspect','--prepare','--probe','--apply','--verify'].includes(mode));
if(['--apply','--verify'].includes(mode)){assert.equal(process.argv.length,5);assert.equal(process.argv[3],'--expected-preparation-sha256');}else assert.equal(process.argv.length,3);
const configured=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'https://invalid.local/');

async function query(sql,readOnly=true,parameters=[],timeout=30000){
 assert.equal(configured.protocol,'https:');assert.equal(configured.hostname,PROJECT+'.supabase.co');assert(process.env.SUPABASE_ACCESS_TOKEN,'Management token required; never recorded');
 const response=await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly,...(parameters.length?{parameters}:{})}),signal:AbortSignal.timeout(timeout)});
 let body;try{body=await response.json();}catch{throw Object.assign(new Error('Management SQL returned an unreadable response; raw body omitted'),{http_status:response.status,sqlstate:null});}
 if(!response.ok){const text=typeof body?.message==='string'?body.message:'';throw Object.assign(new Error('Management SQL request failed; response omitted to protect source data'),{http_status:response.status,sqlstate:text.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??null,exception:text.match(/ERROR:\s+[0-9A-Z]{5}:\s*([^\n]{0,120})/)?.[1]??null});}
 assert(Array.isArray(body),'Unexpected Management SQL response shape');return body;
}
const names=read(reviewedFunctions).functions.map(f=>{assert(/^[a-z_]+$/.test(f.name));return f.name;});
assert(names.includes(RPC));
const inspectSql=`select jsonb_build_object('active',(select jsonb_build_object('release_id',id,'source_file_hash',source_file_hash,'source_document_sha256',encode(sha256(convert_to(source_document,'UTF8')),'hex')) from public.cpa_question_bank_releases where status='active'),'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'signature',p.oid::regprocedure::text,'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'acl',p.proacl::text,'security_definer',p.prosecdef) order by p.proname) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (${names.map(n=>"'"+n+"'").join(',')})),'default_role_settings_sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by setdatabase,setrole),'[]'::jsonb)::text,'UTF8')),'hex') from pg_db_role_setting s)) as inspection`;
const state=async()=>(await query(inspectSql))[0].inspection;
const pick=f=>({name:f.name,signature:f.signature,definition_sha256:f.definition_sha256,acl:f.acl,security_definer:f.security_definer});

if(mode==='--inspect'){
 assert(!fs.existsSync(N+'/inspection.json'),'Preserve the existing inspection');
 const live=await state(),reviewed=read(reviewedFunctions).functions.map(pick);
 assert.deepEqual(live.functions.map(pick),reviewed,'Importer functions differ from the last independently reviewed roundtrip');
 const baseline=read(F+'/baseline.json').find(r=>r.name==='authoring');
 assert.equal(live.active.source_file_hash,baseline.sha256,'Active release does not hold the reviewed baseline source');assert.equal(live.active.source_document_sha256,baseline.sha256);
 write(N+'/inspection.json',{checked_at:new Date().toISOString(),read_only:true,...live,reviewed_functions:ref(reviewedFunctions),baseline_source:baseline});
 console.log(JSON.stringify({status:'inspected',active:live.active,functions:live.functions.length}));
}else if(mode==='--prepare'){
 assert(!fs.existsSync(P),'Preserve the existing preparation');assert(!fs.existsSync(O),'A DB attempt already exists; inspect it before preparing another');
 const inspection=read(N+'/inspection.json'),built=buildLocal();
 const expected={release_id:inspection.active.release_id,source_file_hash:sha(built.baselineDocument),set_count:built.baseline.length};
 assert.equal(inspection.active.source_file_hash,expected.source_file_hash);
 const proof=await localProof(built),functions=inspection.functions.map(pick);
 const sql=buildSql(proof.pack,expected,functions,proof.payloadHash),probeSql=buildSql(proof.pack,expected,functions,proof.payloadHash,'probe');
 const code=['driver.mjs','replace-contract.mjs'].map(name=>N+'/'+name),runtime=['scripts/import-question-bank-v3.ts','lib/questionV3.ts','lib/learningSubmission.ts','lib/learningPublic.ts','lib/learningUnits.ts',verifier,migration,reviewedFunctions];
 const inputs=[...built.completion.files,built.completion.catalog,built.completion.staged_catalog,...[F+'/publication-v1/stage-completion.json',F+'/baseline.json',built.baselineFile,F+'/changes.json',F+'/batch.json',F+'/acceptance-completion.json',N+'/inspection.json',...code,...runtime].map(ref)];guard(inputs);
 fs.mkdirSync(P);write(P+'/replace-pack.json',proof.pack);fs.writeFileSync(P+'/guarded-import.sql',sql,{flag:'wx'});fs.writeFileSync(P+'/probe.sql',probeSql,{flag:'wx'});
 write(P+'/local-proof.json',{...proof.proof,checked_at:new Date().toISOString(),sql_transport_bytes:Buffer.byteLength(JSON.stringify({query:sql,read_only:false})),api_calls:0,db_writes:0});
 write(P+'/preparation.json',{version:1,status:'locally_prepared_not_applied',prepared_at:new Date().toISOString(),project:PROJECT,rpc:RPC,expected,inputs,pack:ref(P+'/replace-pack.json'),sql:ref(P+'/guarded-import.sql'),probe_sql:ref(P+'/probe.sql'),proof:ref(P+'/local-proof.json'),payload_jsonb_sha256:proof.payloadHash,source_file_hash:sha(built.document),bank_content_hash:built.metadata.bank_content_hash,public_content_hash:built.metadata.public_content_hash,replaced_set_ids:built.ids,replaced_indices:built.indices,statement_timeout_ms:120000,transport:'management-sql-with-stored-baseline-and-exact-ten-set-replacement',changes_to_default_role_or_database_policy:0,api_calls:0,db_writes:0,model_api_calls:0});
 console.log(JSON.stringify({status:'locally_prepared_not_applied',preparation:ref(P+'/preparation.json'),local_proof:proof.proof,sql_transport_bytes:Buffer.byteLength(JSON.stringify({query:sql,read_only:false}))},null,2));
}else if(mode==='--probe'){
 const prep=read(P+'/preparation.json');guard([...prep.inputs,prep.pack,prep.sql,prep.probe_sql,prep.proof]);assert(!fs.existsSync(P+'/probe-result.json'));
 const built=buildLocal(),pack=read(prep.pack.file),inspection=read(N+'/inspection.json');
 assert.equal(fs.readFileSync(prep.probe_sql.file,'utf8'),buildSql(pack,prep.expected,inspection.functions.map(pick),prep.payload_jsonb_sha256,'probe'));
 const before=await state();assert.deepEqual(before.functions.map(pick),inspection.functions.map(pick));assert.equal(before.active.release_id,prep.expected.release_id);
 const started=Date.now();let result;
 try{result=await query(fs.readFileSync(prep.probe_sql.file,'utf8'),true,[],150000);}
 catch(error){write(P+'/probe-failure.json',{failed_at:new Date().toISOString(),elapsed_ms:Date.now()-started,message:error.message,http_status:error.http_status??null,sqlstate:error.sqlstate??null,exception:error.exception??null,api_read_only:true,sql_read_only:true,db_writes:0});throw error;}
 assert.equal(result.length,1);const row=result[0];
 assert.equal(row.statement_timeout,'2min');assert.equal(row.transaction_read_only,'on');
 assert.equal(row.payload_jsonb_sha256,prep.payload_jsonb_sha256,'Production reconstruction differs from the local payload');assert.equal(row.source_file_hash,sha(built.document));assert.equal(row.unchanged_sets_identical_and_reviewed_sets_changed,true);
 assert.deepEqual(await state(),before,'Database changed during read-only probe');
 write(P+'/probe-result.json',{checked_at:new Date().toISOString(),elapsed_ms:Date.now()-started,read_only_transaction:true,api_read_only:true,result:row,active_release_id:before.active.release_id,db_writes:0});
 console.log(JSON.stringify({status:'probe_passed',elapsed_ms:Date.now()-started,...row}));
}else{
 const value=process.argv[4];assert.equal(value,ref(P+'/preparation.json').sha256,'Only the reviewed preparation may run');
 assert(process.execArgv.includes('--env-file=.env.local'),'Invoke with --env-file=.env.local');
 assert.equal(configured.protocol,'https:');assert.equal(configured.hostname,PROJECT+'.supabase.co');assert.equal(configured.port,'');assert.equal(configured.username,'');assert.equal(configured.password,'');assert.equal(configured.search,'');assert.equal(configured.hash,'');assert.equal(configured.pathname,'/');
 assert(process.env.SUPABASE_ACCESS_TOKEN&&process.env.SUPABASE_SERVICE_ROLE_KEY,'Management and server credentials are required; values are never recorded');
 const prep=read(P+'/preparation.json');assert.equal(prep.project,PROJECT);assert.equal(prep.rpc,RPC);
 const probe=read(P+'/probe-result.json');assert.equal(probe.result.payload_jsonb_sha256,prep.payload_jsonb_sha256);
 const installed=read(F+'/publication-v1/install-completion.json');assert.equal(installed.status,'canonical_installed_and_validated');guard(installed.files);
 const built=buildLocal(),inspection=read(N+'/inspection.json');
 assert.equal(ref(bank).sha256,prep.source_file_hash);assert.equal(canonicalJson(read(publicFile)),canonicalJson(built.compiled));assert.deepEqual(learningCatalogForBank(read(bank),read(catalogFile)),built.catalog);
 const inputs=[...prep.inputs,prep.pack,prep.sql,prep.probe_sql,prep.proof,ref(P+'/preparation.json'),ref(P+'/probe-result.json'),ref(F+'/publication-v1/install-completion.json'),...installed.files];guard(inputs);
 const pack=read(prep.pack.file);assert.deepEqual(pack,{metadata:built.metadata,patches:built.patches.map(({index,set_id,start,end,text})=>({index,set_id,start,end,text}))});
 const functions=inspection.functions.map(pick);assert.equal(fs.readFileSync(prep.sql.file,'utf8'),buildSql(pack,prep.expected,functions,prep.payload_jsonb_sha256));
 if(mode==='--apply'){
  assert(!fs.existsSync(O),'Prior attempt may have committed; inspect its response and state instead of retrying');
  const before=await state();assert.equal(before.active.release_id,prep.expected.release_id);assert.equal(before.active.source_file_hash,prep.expected.source_file_hash);assert.equal(before.active.source_document_sha256,prep.expected.source_file_hash);assert.deepEqual(before.functions.map(pick),functions);guard(inputs);
  fs.mkdirSync(O);write(O+'/before.json',{checked_at:new Date().toISOString(),...before});write(O+'/preparation.json',{prepared_at:new Date().toISOString(),inputs,authorization:F+'/authorization.md',incremental_preparation:ref(P+'/preparation.json')});
  fs.copyFileSync(F+'/publication-v1/stage/db-readiness.json',O+'/readiness.json',fs.constants.COPYFILE_EXCL);
  write(O+'/apply-started.json',{started_at:new Date().toISOString(),preparation:ref(P+'/preparation.json'),sql:prep.sql,expected_active:prep.expected,transport:prep.transport,statement_timeout_ms:120000,automatic_retry:false});
  const started=Date.now();
  try{const response=await query(fs.readFileSync(prep.sql.file,'utf8'),false,[],150000);write(O+'/import-response.json',{received_at:new Date().toISOString(),elapsed_ms:Date.now()-started,response});}
  catch(error){write(O+'/import-failure.json',{failed_at:new Date().toISOString(),elapsed_ms:Date.now()-started,message:error.message,http_status:error.http_status??null,sqlstate:error.sqlstate??null,exception:error.exception??null,outcome:'uncertain_until_readback',automatic_retry:false});throw error;}
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
 for(const id of built.ids){const u=units.find(x=>x.id===id+'--'+built.sets.find(s=>s.id===id).subquestions[0].id+'--standard');assert(u,'Reviewed learning unit missing: '+id);assert.equal(u.subquestions[0].prompt,built.sets.find(s=>s.id===id).subquestions[0].prompt);}
 if(!fs.existsSync(O+'/roundtrip.json'))write(O+'/roundtrip.json',{status:'passed',checked_at:new Date().toISOString(),source_bytes_identical:true,public_round_trip:true,learning_classification_round_trip:true,learning_topic_round_trip:true,transaction_guarded_unchanged_versions_and_classifications_preserved:true,reviewed_sets_versioned_in_place:built.ids,classification_count:rows.length,learning_unit_count:units.length,source_file_hash:prep.source_file_hash,public_content_hash:contentHash(projected),functions_and_acl_unchanged:true,default_role_and_database_settings_unchanged:true,after,original_response:ref(responseFile)});
 if(!fs.existsSync(O+'/receipt.json'))write(O+'/receipt.json',{applied_at:new Date().toISOString(),project_host:PROJECT+'.supabase.co',applied:true,...data,source_file_hash:prep.source_file_hash,bank_content_hash:prep.bank_content_hash,public_round_trip:true,source_bytes_identical:true,content_review_performed:true,progress_initialized:false,learning_classification_count:rows.length,learning_unit_count:units.length,transport:prep.transport,statement_timeout_ms:120000,incremental_preparation:ref(P+'/preparation.json'),original_response:ref(responseFile),roundtrip:ref(O+'/roundtrip.json')});
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
assert.equal(path.resolve(process.argv[1]),fileURLToPath(import.meta.url));
