// 운영 active release에 저장된 원문을 그대로 두고, 수정된 세트 객체의 텍스트만 같은 위치에 바꿔 끼워 최종 원문을 복원한다.
// case-trio-2026-09-14/incremental-db-publication-v1/append-contract.mjs의 추가(append) 계약을 교체(replace) 계약으로 옮긴 것이다.
// fix-v3 판본을 관찰 O1–O3 수정 10세트(v3 수락본)에 맞게 옮겼다.
// 최종 원문 바이트와 정식 importer 전체 payload가 stage와 같은지는 로컬 PostgreSQL 엔진 PGlite로 먼저 증명한다.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {learningCatalogForBank} from '../../../../../../scripts/import-question-bank-v3.ts';
import {compilePublicQuestionSet,computeQuestionSetMaxPoints} from '../../../../../../lib/questionV3.ts';
import {canonicalJson,contentHash} from '../../../../../../lib/learningSubmission.ts';

export const F='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4',W=F+'/v3';
export const N=F+'/db-incremental-v1',STAGE=F+'/publication-v1/stage';
export const PROJECT='xvifzicrjmbfqaepcfpp',RPC='cpa_import_learning_question_bank';
export const read=file=>JSON.parse(fs.readFileSync(file));
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
export const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
export const guard=inputs=>{for(const row of inputs)assert.equal(ref(row.file).sha256,row.sha256,'Prepared input changed: '+row.file);};

// JSON.stringify(sets,null,2)+'\n' 문서에서 각 최상위 세트 객체의 [start,end) 위치를 계산하고 문서 전체를 다시 만들어 확인한다.
export function elementSpans(document,sets){
 const texts=sets.map(set=>JSON.stringify(set,null,2).split('\n').map(line=>'  '+line).join('\n'));
 assert.equal('[\n'+texts.join(',\n')+'\n]\n',document,'Document is not the canonical pretty-printed array');
 let at=2;return texts.map(text=>{const span={start:at,end:at+text.length};at=span.end+2;return span;});
}
export function applyPatches(baseline,patches){let out='',at=0;for(const p of patches){assert(p.start>=at&&p.end>=p.start);out+=baseline.slice(at,p.start)+p.text;at=p.end;}return out+baseline.slice(at);}

export function buildLocal(){
 const completion=read(F+'/publication-v1/stage-completion.json');assert.equal(completion.status,'staged_and_validated');guard(completion.files);guard([completion.catalog,completion.staged_catalog]);
 const baselineFile=F+'/baseline/authoring.json',baselineDocument=fs.readFileSync(baselineFile,'utf8'),baseline=JSON.parse(baselineDocument);
 const document=fs.readFileSync(STAGE+'/authoring.json','utf8'),sets=JSON.parse(document),ids=read(W+'/changes.json').changed_sets;
 assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);
 assert.deepEqual(sets.map(s=>s.id),baseline.map(s=>s.id),'Set IDs or order changed');
 const indices=sets.map((s,i)=>ids.includes(s.id)?i:-1).filter(i=>i>=0);assert.equal(indices.length,10);
 for(const [i,s] of sets.entries()){if(indices.includes(i))assert.notDeepEqual(s,baseline[i],'Reviewed set did not change');else assert.deepEqual(s,baseline[i],'Unreviewed set changed');}
 assert(sets.every(set=>set.status==='published'&&set.verification.review_status==='verified'));
 // PostgreSQL substr는 문자 단위, JS는 UTF-16 단위다. 서로게이트 쌍이 없으면 둘이 같다.
 assert(!/[\uD800-\uDFFF]/.test(baselineDocument)&&!/[\uD800-\uDFFF]/.test(document),'Astral characters would break character offsets');
 const before=elementSpans(baselineDocument,baseline),after=elementSpans(document,sets);
 const patches=indices.map(i=>({index:i,set_id:sets[i].id,start:before[i].start,end:before[i].end,text:document.slice(after[i].start,after[i].end)}));
 assert.equal(applyPatches(baselineDocument,patches),document,'Replacement must reproduce exact authored bytes');
 for(const p of patches)assert.deepEqual(JSON.parse(p.text),sets[p.index]);
 const readiness=read(STAGE+'/db-readiness.json'),compiled=sets.map(compilePublicQuestionSet),catalog=learningCatalogForBank(sets,read(completion.staged_catalog.file));
 assert.equal(readiness.ready,true);assert.equal(readiness.content_review_performed,true);assert.deepEqual(readiness.errors,[]);
 assert.equal(readiness.full_bank_validation.exit_code,0);assert.equal(readiness.full_bank_validation.signal,null);assert.equal(readiness.full_bank_validation.error_code,null);
 assert.equal(sha(document),readiness.source_file_hash);assert.equal(contentHash({sets,applicability:{}}),readiness.bank_content_hash);assert.equal(contentHash(compiled),readiness.public_content_hash);
 assert.equal(canonicalJson(read(STAGE+'/public.json')),canonicalJson(compiled));
 assert.equal(sets.length,readiness.set_count);assert.equal(sets.reduce((n,s)=>n+s.subquestions.length,0),readiness.subquestion_count);
 assert.equal(sets.reduce((n,s)=>n+computeQuestionSetMaxPoints(s),0),readiness.max_points);assert.equal(sets.reduce((n,s)=>n+s.subquestions.reduce((m,q)=>m+q.criteria.length,0),0),readiness.criterion_count);
 assert.equal(read(F+'/baseline.json').find(r=>r.name==='authoring').sha256,sha(baselineDocument));
 const metadata={applicability:{},...catalog,source_file_hash:readiness.source_file_hash,bank_content_hash:readiness.bank_content_hash,public_content_hash:readiness.public_content_hash,evidence:W+'/batch.json',source_validation:'external-importer',actor_user_id:null};
 const payload={sets,...metadata,source_document:document};
 return {baselineFile,baselineDocument,baseline,document,sets,ids,indices,patches,readiness,compiled,catalog,metadata,payload,completion};
}

export function dollar(value){const tag='$replace_'+sha(value).slice(0,20)+'$';assert(!value.includes(tag));return tag+value+tag;}
export function restoreCte(pack,baselineSql){
 return `with packed as materialized(select ${dollar(JSON.stringify(pack))}::jsonb as d),baseline as materialized(${baselineSql}),patches as materialized(select (x.p->>'start')::int as s,(x.p->>'end')::int as e,x.p->>'text' as t,x.ord from packed cross join jsonb_array_elements(packed.d->'patches') with ordinality as x(p,ord)),pieces as materialized(select ord,substr(b.source_document,coalesce(lag(e) over (order by ord),0)+1,s-coalesce(lag(e) over (order by ord),0))||t as piece from patches cross join baseline b),restored as materialized(select packed.d,(select string_agg(piece,'' order by ord) from pieces)||substr(b.source_document,(select max(e) from patches)+1) as document,b.source_document as prior_document from packed cross join baseline b),payload as materialized(select d,document,prior_document,(d->'metadata')||jsonb_build_object('source_document',document,'sets',document::jsonb) as p from restored) `;
}
const idList=ids=>'array['+ids.map(id=>{assert(/^[a-z0-9-]+$/.test(id));return "'"+id+"'";}).join(',')+']::text[]';
const indexList=indices=>'array['+indices.map(i=>{assert(Number.isSafeInteger(i)&&i>=0);return String(i);}).join(',')+']::int[]';
export function buildSql(pack,expected,functions,payloadHash,mode='apply'){
 assert(['apply','probe'].includes(mode));
 assert(Number.isSafeInteger(expected.set_count)&&expected.set_count>0);assert(/^[a-f0-9]{64}$/.test(payloadHash));assert(/^[a-f0-9]{64}$/.test(expected.source_file_hash));assert(/^[a-f0-9-]{36}$/.test(expected.release_id));
 const ids=pack.patches.map(p=>p.set_id),indices=pack.patches.map(p=>p.index);
 const functionGuards=functions.map(f=>{assert(/^[a-z_]+\((jsonb|uuid)\)$/.test(f.signature));assert(/^[a-f0-9]{64}$/.test(f.definition_sha256));return `if encode(sha256(convert_to(pg_get_functiondef('public.${f.signature}'::regprocedure),'UTF8')),'hex') is distinct from '${f.definition_sha256}' then raise exception 'Reviewed function changed'; end if;`;}).join('\n');
 const cte=restoreCte(pack,"select source_document from public.cpa_question_bank_releases where status='active'");
 const unchangedEqual=`jsonb_array_length(prior_document::jsonb)=jsonb_array_length(p->'sets') and not exists(select 1 from jsonb_array_elements(prior_document::jsonb) with ordinality o(v,i) where ((i-1)::int<>all(${indexList(indices)}) and (p->'sets')->((i-1)::int) is distinct from v) or ((i-1)::int=any(${indexList(indices)}) and ((p->'sets')->((i-1)::int)->>'id' is distinct from v->>'id' or (p->'sets')->((i-1)::int)=v)))`;
 const payloadGuard=`case when encode(sha256(convert_to(p::text,'UTF8')),'hex')='${payloadHash}' and encode(sha256(convert_to(document,'UTF8')),'hex')=p->>'source_file_hash' and ${unchangedEqual} then p else null::jsonb end`;
 const result=mode==='probe'
  ? `select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,current_setting('transaction_read_only') as transaction_read_only,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,${unchangedEqual} as unchanged_sets_identical_and_reviewed_sets_changed from payload`
  : `select current_user as effective_role,current_setting('statement_timeout') as statement_timeout,public.${RPC}(${payloadGuard}) as receipt from payload`;
 const after=mode==='probe'?'':`do $replace_after$ declare new_id uuid; current_source text; actual jsonb; prior jsonb; begin
select id,source_document into strict new_id,current_source from public.cpa_question_bank_releases where status='active' and source_file_hash='${pack.metadata.source_file_hash}' and bank_content_hash='${pack.metadata.bank_content_hash}' and public_content_hash='${pack.metadata.public_content_hash}';
if encode(sha256(convert_to(current_source,'UTF8')),'hex') is distinct from '${pack.metadata.source_file_hash}' then raise exception 'Final source identity mismatch'; end if;
if (select count(*) from public.cpa_question_bank_release_items where release_id='${expected.release_id}'::uuid) <> ${expected.set_count} or exists(select 1 from public.cpa_question_bank_release_items old where old.release_id='${expected.release_id}'::uuid and old.set_id<>all(${idList(ids)}) and not exists(select 1 from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=old.set_id and next.set_version_id=old.set_version_id and next.position=old.position)) then raise exception 'Prior set versions changed'; end if;
if exists(select 1 from public.cpa_question_bank_release_items old where old.release_id='${expected.release_id}'::uuid and old.set_id=any(${idList(ids)}) and not exists(select 1 from public.cpa_question_bank_release_items next where next.release_id=new_id and next.set_id=old.set_id and next.position=old.position and next.set_version_id<>old.set_version_id)) or (select count(*) from public.cpa_question_bank_release_items old where old.release_id='${expected.release_id}'::uuid and old.set_id=any(${idList(ids)})) <> ${ids.length} then raise exception 'Reviewed sets were not versioned in place'; end if;
if (select count(*) from public.cpa_question_bank_release_items where release_id=new_id) <> jsonb_array_length(current_source::jsonb) or exists(select 1 from jsonb_array_elements(current_source::jsonb) with ordinality item(s,ord) where not exists(select 1 from public.cpa_question_bank_release_items ri where ri.release_id=new_id and ri.set_id=item.s->>'id' and ri.position=item.ord)) then raise exception 'Final release IDs or order differ from reviewed source'; end if;
select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into actual from jsonb_array_elements(public.cpa_get_learning_classifications(new_id)) c where c->>'source_set_id'<>all(${idList(ids)});
select jsonb_agg(c order by c->>'source_set_id',c->>'subquestion_id') into prior from jsonb_array_elements(current_setting('cpa.replace_prior_classifications')::jsonb) c where c->>'source_set_id'<>all(${idList(ids)});
if actual is distinct from prior then raise exception 'Prior classification versions changed'; end if;
select jsonb_agg(to_jsonb(t) order by t.position) into actual from (select id,title,part,position from public.cpa_learning_topics) t;
if actual is distinct from current_setting('cpa.replace_prior_topics')::jsonb then raise exception 'Existing learning topics changed'; end if;
end $replace_after$;\n`;
 for(const key of ['source_file_hash','bank_content_hash','public_content_hash'])assert(/^[a-f0-9]{64}$/.test(pack.metadata[key]));
 // probe는 읽기 전용 API 연결에서 실행한다. 역할 전환·잠금·함수 실행 없이 active 원문과 함수 정의만 읽고 복원 해시를 계산한다.
 if(mode==='probe')return `begin read only;\nset local statement_timeout='120s';\ndo $replace_probe$ declare active_id uuid; active_hash text; source text; begin\n${functionGuards}\nselect id,source_file_hash,source_document into strict active_id,active_hash,source from public.cpa_question_bank_releases where status='active';\nif active_id is distinct from '${expected.release_id}'::uuid or active_hash is distinct from '${expected.source_file_hash}' or source is null or encode(sha256(convert_to(source,'UTF8')),'hex') is distinct from '${expected.source_file_hash}' then raise exception 'Active baseline changed'; end if;\nif right(source,3) <> E'\\n]\\n' or jsonb_typeof(source::jsonb) <> 'array' or jsonb_array_length(source::jsonb) <> ${expected.set_count} then raise exception 'Unexpected baseline source shape'; end if;\nend $replace_probe$;\n${cte}${result};\ncommit;\n`;
 return `begin;\nset local role service_role;\nset local statement_timeout='120s';\ndo $replace_guard$ declare active_id uuid; active_hash text; source text; topics jsonb; begin\nif current_user <> 'service_role' then raise exception 'Unexpected role'; end if;\nperform pg_advisory_xact_lock(7261202609080502);\n${functionGuards}\nselect id,source_file_hash,source_document into strict active_id,active_hash,source from public.cpa_question_bank_releases where status='active';\nif active_id is distinct from '${expected.release_id}'::uuid or active_hash is distinct from '${expected.source_file_hash}' or source is null or encode(sha256(convert_to(source,'UTF8')),'hex') is distinct from '${expected.source_file_hash}' then raise exception 'Active baseline changed'; end if;\nif right(source,3) <> E'\\n]\\n' or jsonb_typeof(source::jsonb) <> 'array' or jsonb_array_length(source::jsonb) <> ${expected.set_count} then raise exception 'Unexpected baseline source shape'; end if;\nperform set_config('cpa.replace_prior_classifications',public.cpa_get_learning_classifications(active_id)::text,true);\nselect jsonb_agg(to_jsonb(t) order by t.position) into topics from (select id,title,part,position from public.cpa_learning_topics) t;\nperform set_config('cpa.replace_prior_topics',topics::text,true);\nend $replace_guard$;\n${cte}${result};\n${after}commit;\n`;
}

export async function localProof(built){
 const pack={metadata:built.metadata,patches:built.patches.map(({index,set_id,start,end,text})=>({index,set_id,start,end,text}))};
 const pg=await PGlite.create();
 try{
  const expected=(await pg.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as h",[JSON.stringify(built.payload)])).rows[0].h;
  const indices=pack.patches.map(p=>p.index);
  const sql=restoreCte(pack,'select $1::text as source_document')+`select document,p,encode(sha256(convert_to(p::text,'UTF8')),'hex') as payload_jsonb_sha256,encode(sha256(convert_to(document,'UTF8')),'hex') as source_file_hash,jsonb_array_length(prior_document::jsonb)=jsonb_array_length(p->'sets') and not exists(select 1 from jsonb_array_elements(prior_document::jsonb) with ordinality o(v,i) where ((i-1)::int<>all(${indexList(indices)}) and (p->'sets')->((i-1)::int) is distinct from v) or ((i-1)::int=any(${indexList(indices)}) and ((p->'sets')->((i-1)::int)->>'id' is distinct from v->>'id' or (p->'sets')->((i-1)::int)=v))) as unchanged_sets_identical_and_reviewed_sets_changed from payload`;
  const row=(await pg.query(sql,[built.baselineDocument])).rows[0];
  assert.equal(row.document,built.document);assert.deepEqual(row.p,built.payload);assert.equal(row.payload_jsonb_sha256,expected);assert.equal(row.source_file_hash,sha(built.document));assert.equal(row.unchanged_sets_identical_and_reviewed_sets_changed,true);
  // 부정 사례: 기준 원문이 한 글자라도 다르면 복원 원문 해시가 달라져야 한다.
  const tampered=(await pg.query(sql,[built.baselineDocument.replace('"schema_version": "3.0"','"schema_version": "3.1"')])).rows[0];
  assert.notEqual(tampered.source_file_hash,sha(built.document));
  return {pack,payloadHash:expected,proof:{method:'Local PGlite PostgreSQL reconstruction; no production database or API',source_bytes_identical:true,complete_payload_equal:true,unchanged_objects_and_order_identical:true,reviewed_set_ids:built.ids,reviewed_indices:indices,tampered_baseline_detected:true,baseline_bytes:Buffer.byteLength(built.baselineDocument),patch_text_bytes:pack.patches.reduce((n,p)=>n+Buffer.byteLength(p.text),0),final_document_bytes:Buffer.byteLength(built.document),metadata_bytes:Buffer.byteLength(JSON.stringify(built.metadata)),payload_jsonb_sha256:expected,final_source_sha256:sha(built.document)}};
 }finally{await pg.close();}
}
