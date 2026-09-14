import fs from 'node:fs';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
let text=fs.readFileSync(R+'/retry-db-publication.mjs','utf8');
const replace=(old,next)=>{assert.equal(text.split(old).length,2,'Unique replacement anchor required: '+old.slice(0,80));text=text.replace(old,next);};
replace("import {createClient} from '@supabase/supabase-js';","import {createClient} from '@supabase/supabase-js';\nimport {PGlite} from '@electric-sql/pglite';");
replace("O=R+'/db-publication-v2'","O=R+'/db-publication-v3'");
replace("const helper=R+'/retry-db-publication.mjs'","const helper=R+'/retry-db-publication-v3.mjs'");
replace('function buildSql(payload,before){','function buildSql(payload,before,payloadHash,probe=false){');
replace(" const body=JSON.stringify(payload);",` const {sets,source_document,...base}=payload;assert.deepEqual(sets,JSON.parse(source_document));
 const body=JSON.stringify({base,source_document});assert(/^[a-f0-9]{64}$/.test(payloadHash));
 const restore="with packed as materialized(select "+dollar(body,'reviewed_source_once')+"::jsonb as d),restored as materialized(select (d->'base')||jsonb_build_object('source_document',d->>'source_document','sets',(d->>'source_document')::jsonb) as p from packed) ";
 const payloadGuard="case when encode(sha256(convert_to(p::text,'UTF8')),'hex')='"+payloadHash+"' then p else null::jsonb end";
 const statement=probe
  ? restore+"select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,current_setting('transaction_read_only') as transaction_read_only,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(p->>'source_document','UTF8')),'hex') as source_file_hash,octet_length(p->>'source_document') as source_bytes,p->'sets'=(p->>'source_document')::jsonb as sets_equal_source,(select id from public.cpa_question_bank_releases where status='active') as active_release_id from restored"
  : restore+"select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,public."+rpc+"("+payloadGuard+") as receipt from restored";`);
const oldReturn=" return `begin;\\nset local role service_role;\\nset local statement_timeout='120s';\\ndo $retry_guard$ begin\\nif current_user <> 'service_role' then raise exception 'Unexpected import role'; end if;\\n${fguards}\\nend $retry_guard$;\\nselect current_user as effective_role,current_setting('statement_timeout') as statement_timeout,public.${rpc}(${dollar(body,'reviewed_payload')}::jsonb) as receipt;\\ncommit;\\n`;".replaceAll('\\n','\\n');
// Locate the entire generated return statement without touching any other SQL.
const start=text.indexOf(' return `begin;\\n'),end=text.indexOf('\n}',start);
assert(start>0&&end>start);const original=text.slice(start,end);assert(original.includes("dollar(body,'reviewed_payload')"));
text=text.slice(0,start)+" return `begin${probe?' read only':''};\\nset local role service_role;\\nset local statement_timeout='120s';\\ndo $retry_guard$ begin\\nif current_user <> 'service_role' then raise exception 'Unexpected import role'; end if;\\n${fguards}\\nend $retry_guard$;\\n${statement};\\ncommit;\\n`;"+text.slice(end);
replace(" const previous=read(V1+'/preparation.json'),result=read(V1+'/01-import.result.json'),stage=read(R+'/publication-v3/preparation.json');",` const failed=R+'/db-publication-v2';assert.equal(read(failed+'/import-failure.json').http_status,413);assert(!fs.existsSync(failed+'/import-response.json'));assert(!fs.existsSync(failed+'/receipt.json'));
 const previous=read(V1+'/preparation.json'),result=read(V1+'/01-import.result.json'),stage=read(R+'/publication-v3/preparation.json');`);
replace("const inputs=[...previous.inputs,...stage.immutable,...[helper,", "const inputs=[...read(failed+'/preparation.json').inputs,...[failed+'/preparation.json',failed+'/apply-started.json',failed+'/import-failure.json',failed+'/payload.json',failed+'/guarded-import.sql',R+'/build-db-retry-v3.mjs'].map(ref),...previous.inputs,...stage.immutable,...[helper,");
replace(" fs.mkdirSync(O);write(O+'/before.json'",` const pg=await PGlite.create();let pgHash;try{pgHash=(await pg.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h",[JSON.stringify(built.payload)])).rows[0].h;}finally{await pg.close();}
 const probeSql=buildSql(built.payload,before,pgHash,true);const probeResult=await query(probeSql,false,[],45000);assert.equal(probeResult.length,1);assert.equal(probeResult[0].effective_role,'service_role');assert.equal(probeResult[0].statement_timeout,'2min');assert.equal(probeResult[0].transaction_read_only,'on');assert.equal(probeResult[0].payload_jsonb_sha256,pgHash);assert.equal(probeResult[0].source_file_hash,built.payload.source_file_hash);assert.equal(probeResult[0].source_bytes,Buffer.byteLength(built.payload.source_document));assert.equal(probeResult[0].sets_equal_source,true);assert.equal(probeResult[0].active_release_id,before.active.release_id);assert.deepEqual(await state(),before);guard(inputs);
 fs.mkdirSync(O);write(O+'/transport-probe.json',{checked_at:new Date().toISOString(),sql_read_only:true,api_read_only:false,source_transmissions:1,postgres_payload_hash:pgHash,independent_local_hash_engine:'PGlite PostgreSQL sha256(payload::jsonb::text)',original_payload:ref(failed+'/payload.json'),sql_sha256:sha(probeSql),request_bytes:Buffer.byteLength(JSON.stringify({query:probeSql,read_only:false})),result:probeResult});write(O+'/before.json'`);
replace("buildSql(built.payload,before),{flag:'wx'}", "buildSql(built.payload,before,pgHash),{flag:'wx'}");
replace("project,rpc,inputs,payload:","project,rpc,inputs,transport_probe:ref(O+'/transport-probe.json'),payload_jsonb_sha256:pgHash,source_transmissions:1,payload:");
replace("const inputs=[...prep.inputs,prep.payload,prep.sql,prep.before,prep.readiness];","const inputs=[...prep.inputs,prep.payload,prep.sql,prep.before,prep.readiness,prep.transport_probe];");
replace("buildSql(payload,read(prep.before.file))","buildSql(payload,read(prep.before.file),prep.payload_jsonb_sha256)");
replace(" const data=response[0].receipt;", " const data=response[0].receipt;");
const target=R+'/retry-db-publication-v3.mjs';assert(!fs.existsSync(target));fs.writeFileSync(target,text,{flag:'wx'});console.log(target);
