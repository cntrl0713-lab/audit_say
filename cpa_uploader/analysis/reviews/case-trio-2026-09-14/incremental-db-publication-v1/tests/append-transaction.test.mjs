import assert from 'node:assert/strict';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {buildSql,sha} from '../append-contract.mjs';

// Full generated transaction, local synthetic schema only. The mock importer
// deliberately exposes faults; this does not test or certify the real importer.
const oldId='11111111-1111-4111-8111-111111111111';
const newId='22222222-2222-4222-8222-222222222222';
const wrongId='33333333-3333-4333-8333-333333333333';
const prior=[{id:'old-a'},{id:'old-b'}];
const added=Array.from({length:3},(_,i)=>({id:`new-${i+1}`}));
const document=value=>JSON.stringify(value,null,2)+'\n';
const priorText=document(prior),finalText=document([...prior,...added]);
const oldVersions=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const initialClasses=prior.map((set,i)=>({source_set_id:set.id,subquestion_id:'q1',classification_version_id:`old-class-${i}`,source_set_version_id:oldVersions[i]}));

async function fixture(fault='none'){
 const pg=await PGlite.create();
 try{
  await pg.exec(`
create role service_role;
create table public.cpa_question_bank_releases(id uuid primary key,status text,source_document text,source_file_hash text,bank_content_hash text,public_content_hash text);
create table public.cpa_question_bank_release_items(release_id uuid,set_id text,set_version_id uuid,position integer);
create table public.cpa_learning_topics(id text,title text,part text,position integer);
create table public.mock_classifications(release_id uuid,classification jsonb);
create table public.mock_fault(mode text);
create sequence public.rpc_calls;
create function public.cpa_get_learning_classifications(p_release_id uuid) returns jsonb language sql as $$
 select coalesce(jsonb_agg(classification order by classification->>'source_set_id',classification->>'subquestion_id'),'[]'::jsonb)
 from public.mock_classifications where release_id=p_release_id;
$$;
create function public.cpa_import_learning_question_bank(p_payload jsonb) returns jsonb language plpgsql as $$
declare r record; v_mode text; result_versions jsonb;
begin
 perform nextval('public.rpc_calls');
 if p_payload is null then raise exception 'Null guarded payload'; end if;
 if encode(sha256(convert_to(p_payload->>'source_document','UTF8')),'hex') is distinct from p_payload->>'source_file_hash'
  or (p_payload->>'source_document')::jsonb is distinct from p_payload->'sets' then raise exception 'Bad mock payload'; end if;
 select mode into strict v_mode from public.mock_fault;
 update public.cpa_question_bank_releases set status='retired' where status='active';
 insert into public.cpa_question_bank_releases values('${newId}','active',p_payload->>'source_document',p_payload->>'source_file_hash',p_payload->>'bank_content_hash',p_payload->>'public_content_hash');
 for r in select value,ordinality::integer as position from jsonb_array_elements(p_payload->'sets') with ordinality loop
  insert into public.cpa_question_bank_release_items values('${newId}',r.value->>'id',coalesce(
   (select set_version_id from public.cpa_question_bank_release_items where release_id='${oldId}' and set_id=r.value->>'id'),
   md5(r.value->>'id')::uuid),r.position);
 end loop;
 insert into public.mock_classifications select '${newId}',classification from public.mock_classifications where release_id='${oldId}';
 if v_mode='version' then update public.cpa_question_bank_release_items set set_version_id='${wrongId}' where release_id='${newId}' and set_id='old-a'; end if;
 if v_mode='classification' then update public.mock_classifications set classification=jsonb_set(classification,'{classification_version_id}','"changed-class"') where release_id='${newId}' and classification->>'source_set_id'='old-a'; end if;
 if v_mode='position' then update public.cpa_question_bank_release_items set position=99 where release_id='${newId}' and set_id='old-a'; end if;
 if v_mode='missing-addition' then delete from public.cpa_question_bank_release_items where release_id='${newId}' and set_id='new-3'; end if;
 select jsonb_agg(jsonb_build_object('set_id',set_id,'set_version_id',set_version_id) order by position) into result_versions from public.cpa_question_bank_release_items where release_id='${newId}';
 return jsonb_build_object('release_id','${newId}','set_count',jsonb_array_length(p_payload->'sets'),'reused',false,'question_versions',result_versions);
end;
$$;
grant usage on schema public to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
`);
  await pg.query('insert into public.cpa_question_bank_releases values($1,\'active\',$2,$3,$4,$5)',[oldId,priorText,sha(priorText),'a'.repeat(64),'b'.repeat(64)]);
  for(const [i,set] of prior.entries()){
   await pg.query('insert into public.cpa_question_bank_release_items values($1,$2,$3,$4)',[oldId,set.id,oldVersions[i],i+1]);
   await pg.query('insert into public.mock_classifications values($1,$2::jsonb)',[oldId,JSON.stringify(initialClasses[i])]);
  }
  await pg.query('insert into public.mock_fault values($1)',[fault]);
  await pg.exec("insert into public.cpa_learning_topics values('topic-1','합성 주제','part-1',1)");
  const metadata={source_file_hash:sha(finalText),bank_content_hash:'c'.repeat(64),public_content_hash:'d'.repeat(64),applicability:{},learning_topics:[],learning_classifications:[],evidence:'synthetic-local-transaction-test',actor_user_id:null};
  const pack={metadata,added_document:document(added)};
  const payload={...metadata,sets:[...prior,...added],source_document:finalText};
  const payloadHash=(await pg.query("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') as hash",[JSON.stringify(payload)])).rows[0].hash;
  const definitionHash=(await pg.query("select encode(sha256(convert_to(pg_get_functiondef('public.cpa_import_learning_question_bank(jsonb)'::regprocedure),'UTF8')),'hex') as hash")).rows[0].hash;
  const expected={release_id:oldId,source_file_hash:sha(priorText),set_count:prior.length};
  const functions=[{signature:'cpa_import_learning_question_bank(jsonb)',definition_sha256:definitionHash}];
  return {pg,pack,payloadHash,expected,functions};
 }catch(error){await pg.close();throw error;}
}

async function calls(pg){const r=(await pg.query('select last_value,is_called from public.rpc_calls')).rows[0];return r.is_called?Number(r.last_value):0;}
async function state(pg){return {
 releases:(await pg.query('select * from public.cpa_question_bank_releases order by id')).rows,
 items:(await pg.query('select * from public.cpa_question_bank_release_items order by release_id,position')).rows,
 classifications:(await pg.query('select * from public.mock_classifications order by release_id,classification::text')).rows,
 topics:(await pg.query('select * from public.cpa_learning_topics order by position')).rows,
};}
async function rejectAndRollback(pg,sql,pattern){
 await assert.rejects(pg.exec(sql),pattern);
 await pg.exec('rollback');
}

test('generated transaction commits the exact source append and preserves existing versions/classifications',async()=>{
 const f=await fixture();
 try{
  const results=await f.pg.exec(buildSql(f.pack,f.expected,f.functions,f.payloadHash));
  assert.equal(await calls(f.pg),1);
  const receipt=results.flatMap(r=>r.rows??[]).find(r=>r.receipt)?.receipt;
  assert.equal(receipt.release_id,newId);assert.equal(receipt.set_count,5);
  const active=(await f.pg.query("select * from public.cpa_question_bank_releases where status='active'")).rows;
  assert.equal(active.length,1);assert.equal(active[0].id,newId);assert.equal(active[0].source_document,finalText);
  const versions=(await f.pg.query('select set_id,set_version_id,position from public.cpa_question_bank_release_items where release_id=$1 order by position',[newId])).rows;
  assert.deepEqual(versions.map(r=>r.set_id),[...prior,...added].map(s=>s.id));
  assert.deepEqual(versions.slice(0,2).map(r=>r.set_version_id),oldVersions);
  assert.deepEqual((await f.pg.query('select public.cpa_get_learning_classifications($1::uuid) as rows',[newId])).rows[0].rows,initialClasses);
  assert.equal((await f.pg.query('select status from public.cpa_question_bank_releases where id=$1',[oldId])).rows[0].status,'retired');
 }finally{await f.pg.close();}
});

test('active ID or source hash mismatch refuses before the importer executes',async t=>{
 for(const mismatch of ['release_id','source_file_hash'])await t.test(mismatch,async()=>{
  const f=await fixture();
  try{
   const before=await state(f.pg);
   const expected={...f.expected,[mismatch]:mismatch==='release_id'?wrongId:'e'.repeat(64)};
   await rejectAndRollback(f.pg,buildSql(f.pack,expected,f.functions,f.payloadHash),/Active baseline changed/);
   assert.equal(await calls(f.pg),0);assert.deepEqual(await state(f.pg),before);
  }finally{await f.pg.close();}
 });
});

test('an invalid final version, classification, order or addition rolls back the importer and active pointer',async t=>{
 for(const fault of ['version','classification','position','missing-addition'])await t.test(fault,async()=>{
  const f=await fixture(fault);
  try{
   const before=await state(f.pg);
   const pattern=fault==='classification'?/Prior classification versions changed/:fault==='missing-addition'?/Final release IDs or order differ from reviewed source/:/Prior set versions changed/;
   await rejectAndRollback(f.pg,buildSql(f.pack,f.expected,f.functions,f.payloadHash),pattern);
   // nextval is deliberately nontransactional, proving the RPC ran even though
   // all release, version-link, classification and topic mutations rolled back.
   assert.equal(await calls(f.pg),1);assert.deepEqual(await state(f.pg),before);
  }finally{await f.pg.close();}
 });
});
