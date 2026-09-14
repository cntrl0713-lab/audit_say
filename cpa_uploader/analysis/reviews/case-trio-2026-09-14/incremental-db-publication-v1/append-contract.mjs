import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {learningCatalogForBank} from '../../../../../scripts/import-question-bank-v3.ts';
import {compilePublicQuestionSet,computeQuestionSetMaxPoints} from '../../../../../lib/questionV3.ts';
import {canonicalJson,contentHash} from '../../../../../lib/learningSubmission.ts';

export const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
export const N=R+'/incremental-db-publication-v1',STAGE=R+'/publication-v1/stage';
export const PROJECT='xvifzicrjmbfqaepcfpp',RPC='cpa_import_learning_question_bank';
export const read=file=>JSON.parse(fs.readFileSync(file));
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
export const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
export const guard=inputs=>{for(const row of inputs)assert.equal(ref(row.file).sha256,row.sha256,'Prepared input changed: '+row.file);};

export function buildLocal(){
 const completion=read(R+'/publication-v1/stage-completion.json');assert.equal(completion.status,'validated_isolated_published_stage');guard(completion.files);
 const baselineFile=R+'/integration-baseline/bank.json',baselineDocument=fs.readFileSync(baselineFile,'utf8'),baseline=JSON.parse(baselineDocument);
 const document=fs.readFileSync(STAGE+'/authoring.json','utf8'),sets=JSON.parse(document),ids=read(R+'/changed-sets-v1.json');
 const added=sets.slice(baseline.length),addedDocument=JSON.stringify(added,null,2)+'\n';
 assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.equal(added.length,3);
 assert.deepEqual(sets.slice(0,baseline.length),baseline,'Existing baseline objects or order changed');assert.deepEqual(added.map(s=>s.id),ids,'Only the three reviewed IDs may be appended');
 assert(added.every(set=>!baseline.some(old=>old.id===set.id)));
 assert(sets.every(set=>set.status==='published'&&set.verification.review_status==='verified'));
 assert(baselineDocument.endsWith('\n]\n'));assert(addedDocument.startsWith('[\n')&&addedDocument.endsWith('\n]\n'));
 assert.equal(baselineDocument.slice(0,-3)+',\n'+addedDocument.slice(2),document,'Append must preserve exact authored bytes');
 const readiness=read(STAGE+'/readiness.json'),compiled=sets.map(compilePublicQuestionSet),catalog=learningCatalogForBank(sets,read(STAGE+'/catalog.json'));
 assert.equal(readiness.ready,true);assert.equal(readiness.content_review_performed,true);assert.deepEqual(readiness.errors,[]);
 assert.equal(readiness.full_bank_validation.exit_code,0);assert.equal(readiness.full_bank_validation.signal,null);assert.equal(readiness.full_bank_validation.error_code,null);
 assert.equal(sha(document),readiness.source_file_hash);assert.equal(contentHash({sets,applicability:{}}),readiness.bank_content_hash);assert.equal(contentHash(compiled),readiness.public_content_hash);
 assert.equal(canonicalJson(read(STAGE+'/public.json')),canonicalJson(compiled));
 assert.equal(sets.length,readiness.set_count);assert.equal(sets.reduce((n,s)=>n+s.subquestions.length,0),readiness.subquestion_count);
 assert.equal(sets.reduce((n,s)=>n+computeQuestionSetMaxPoints(s),0),readiness.max_points);assert.equal(sets.reduce((n,s)=>n+s.subquestions.reduce((m,q)=>m+q.criteria.length,0),0),readiness.criterion_count);
 assert.equal(read(R+'/integration-baseline.json').bank.sha256,sha(baselineDocument));assert.equal(read(R+'/sealed-v1/readiness.json').ready,true);
 const metadata={applicability:{},...catalog,source_file_hash:readiness.source_file_hash,bank_content_hash:readiness.bank_content_hash,public_content_hash:readiness.public_content_hash,evidence:R+'/sealed-v1/batch.json',source_validation:'external-importer',actor_user_id:null};
 const payload={sets,...metadata,source_document:document};
 return {baselineFile,baselineDocument,baseline,document,sets,ids,added,addedDocument,readiness,compiled,catalog,metadata,payload,completion};
}

export function dollar(value){const tag='$append_'+sha(value).slice(0,20)+'$';assert(!value.includes(tag));return tag+value+tag;}
export function restoreCte(pack,baselineSql){
 return `with packed as materialized(select ${dollar(JSON.stringify(pack))}::jsonb as d),baseline as materialized(${baselineSql}),restored as materialized(select d,(left(source_document,char_length(source_document)-3)||E',\\n'||substring(d->>'added_document' from 3)) as document,source_document as prior_document from packed cross join baseline),payload as materialized(select d,document,prior_document,(d->'metadata')||jsonb_build_object('source_document',document,'sets',document::jsonb) as p from restored) `;
}
export function buildSql(pack,expected,functions,payloadHash,probe=false){
 assert(Number.isSafeInteger(expected.set_count)&&expected.set_count>0,'Positive integer baseline set count is required');
 assert(/^[a-f0-9]{64}$/.test(payloadHash));assert(/^[a-f0-9]{64}$/.test(expected.source_file_hash));assert(/^[a-f0-9-]{36}$/.test(expected.release_id));
 const functionGuards=functions.map(f=>{assert(/^[a-z_]+\((jsonb|uuid)\)$/.test(f.signature));assert(/^[a-f0-9]{64}$/.test(f.definition_sha256));return `if encode(sha256(convert_to(pg_get_functiondef('public.${f.signature}'::regprocedure),'UTF8')),'hex') is distinct from '${f.definition_sha256}' then raise exception 'Reviewed function changed'; end if;`;}).join('\n');
 const cte=restoreCte(pack,"select source_document from public.cpa_question_bank_releases where status='active'");
 const payloadGuard=`case when encode(sha256(convert_to(p::text,'UTF8')),'hex')='${payloadHash}' and encode(sha256(convert_to(document,'UTF8')),'hex')=p->>'source_file_hash' and p->'sets'=(prior_document::jsonb)||((d->>'added_document')::jsonb) then p else null::jsonb end`;
 const result=probe
  ? "select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,current_setting('transaction_read_only') as transaction_read_only,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash from payload"
  : `select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,public.${RPC}(${payloadGuard}) as receipt from payload`;
 const after=probe?'':`do $append_after$ declare new_id uuid; current_source text; actual jsonb; begin
select id,source_document into strict new_id,current_source from public.cpa_question_bank_releases where status='active' and source_file_hash='${pack.metadata.source_file_hash}' and bank_content_hash='${pack.metadata.bank_content_hash}' and public_content_hash='${pack.metadata.public_content_hash}';
if encode(sha256(convert_to(current_source,'UTF8')),'hex') is distinct from '${pack.metadata.source_file_hash}' then raise exception 'Final source identity mismatch'; end if;
if (select count(*) from public.cpa_question_bank_release_items where release_id='${expected.release_id}'::uuid) <> ${expected.set_count} or exists(select 1 from public.cpa_question_bank_release_items old where old.release_id='${expected.release_id}'::uuid and not exists(select 1 from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=old.set_id and next.set_version_id=old.set_version_id and next.position=old.position)) then raise exception 'Prior set versions changed'; end if;
if (select count(*) from public.cpa_question_bank_release_items where release_id=new_id) <> jsonb_array_length(current_source::jsonb) or exists(select 1 from jsonb_array_elements(current_source::jsonb) with ordinality item(s,ord) where not exists(select 1 from public.cpa_question_bank_release_items ri where ri.release_id=new_id and ri.set_id=item.s->>'id' and ri.position=item.ord)) then raise exception 'Final release IDs or order differ from reviewed source'; end if;
select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into actual from jsonb_array_elements(public.cpa_get_learning_classifications(new_id)) c where exists(select 1 from public.cpa_question_bank_release_items old where old.release_id='${expected.release_id}'::uuid and old.set_id=c->>'source_set_id');
if actual is distinct from current_setting('cpa.append_prior_classifications')::jsonb then raise exception 'Prior classification versions changed'; end if;
select jsonb_agg(to_jsonb(t) order by t.position) into actual from (select id,title,part,position from public.cpa_learning_topics) t;
if actual is distinct from current_setting('cpa.append_prior_topics')::jsonb then raise exception 'Existing learning topics changed'; end if;
end $append_after$;\n`;
 for(const key of ['source_file_hash','bank_content_hash','public_content_hash'])assert(/^[a-f0-9]{64}$/.test(pack.metadata[key]));
 return `begin${probe?' read only':''};\nset local role service_role;\nset local statement_timeout='120s';\ndo $append_guard$ declare active_id uuid; active_hash text; source text; topics jsonb; begin\nif current_user <> 'service_role' then raise exception 'Unexpected role'; end if;\nperform pg_advisory_xact_lock(7261202609080502);\n${functionGuards}\nselect id,source_file_hash,source_document into strict active_id,active_hash,source from public.cpa_question_bank_releases where status='active';\nif active_id is distinct from '${expected.release_id}'::uuid or active_hash is distinct from '${expected.source_file_hash}' or source is null or encode(sha256(convert_to(source,'UTF8')),'hex') is distinct from '${expected.source_file_hash}' then raise exception 'Active baseline changed'; end if;\nif right(source,3) <> E'\\n]\\n' or jsonb_typeof(source::jsonb) <> 'array' or jsonb_array_length(source::jsonb) <> ${expected.set_count} then raise exception 'Unexpected baseline source shape'; end if;\nperform set_config('cpa.append_prior_classifications',public.cpa_get_learning_classifications(active_id)::text,true);\nselect jsonb_agg(to_jsonb(t) order by t.position) into topics from (select id,title,part,position from public.cpa_learning_topics) t;\nperform set_config('cpa.append_prior_topics',topics::text,true);\nend $append_guard$;\n${cte}${result};\n${after}commit;\n`;
}

export async function localProof(built){
 const pack={metadata:built.metadata,added_document:built.addedDocument};
 const pg=await PGlite.create();
 try{
  const expected=(await pg.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h",[JSON.stringify(built.payload)])).rows[0].h;
  const sql=restoreCte(pack,'select $1::text as source_document')+"select document, p, encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,p->'sets'=(prior_document::jsonb)||((d->>'added_document')::jsonb) as prior_and_additions_unchanged from payload";
  const row=(await pg.query(sql,[built.baselineDocument])).rows[0];
  assert.equal(row.document,built.document);assert.deepEqual(row.p,built.payload);assert.equal(row.payload_jsonb_sha256,expected);assert.equal(row.source_file_hash,sha(built.document));assert.equal(row.prior_and_additions_unchanged,true);
  return {pack,payloadHash:expected,proof:{method:'Local PGlite PostgreSQL reconstruction; no production database or API',source_bytes_identical:true,complete_payload_equal:true,prior_objects_and_order_identical:true,only_added_ids:built.ids,baseline_bytes:Buffer.byteLength(built.baselineDocument),added_document_bytes:Buffer.byteLength(built.addedDocument),final_document_bytes:Buffer.byteLength(built.document),metadata_bytes:Buffer.byteLength(JSON.stringify(built.metadata)),payload_jsonb_sha256:expected,final_source_sha256:sha(built.document)}};
 }finally{await pg.close();}
}
