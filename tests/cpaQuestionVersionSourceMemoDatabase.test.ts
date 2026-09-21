import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import type {QuestionSetV3} from '../lib/questionV3.ts';
import {createLearningUnitsDatabase} from './helpers/cpaLearningUnitsDatabase.ts';
import {sampleQuestionSet} from './helpers/cpaLearningDatabase.ts';
// 판본 조회 메모 migration(20260921120000)의 로컬 증명. 운영 순서대로 사적 메타데이터·퇴역 migration 위에 적용한다.
const migration=(name:string)=>fs.readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const priorMigrations=['20260912060000_cpa_private_source_metadata.sql','20260914080000_cpa_reviewed_question_retirements.sql','20260915090000_cpa_reviewed_case_question_retirements.sql'].map(migration);
const memoMigration=migration('20260921120000_cpa_question_version_source_memo.sql');
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
async function scalar<T>(db:PGlite,sql:string,params:unknown[]=[]):Promise<T>{return (await db.query<{v:T}>(`select ${sql} as v`,params)).rows[0].v;}
/** 저장 원문에만 남는 사적 출처 메타데이터(source_span·scope)를 가진 사례 세트. */
function privateSet(id:string){
 const s=sampleQuestionSet(id);s.title=id+' 사례';
 for(const q of s.subquestions){q.question_style='case';q.topic_ids=['01'];q.prompt=id+'의 '+q.id+' 사실을 판단하시오.';}
 (s.source_refs[0] as {source_span?:string}).source_span='L10-L12';
 (s.subquestions[0].criteria[0].critical_facts[0] as {scope?:string}).scope='독립성 유지 여부';
 return s;
}
const topics=[{id:'01',title:'감사기초',part:'PART1',position:1}];
function payload(sets:QuestionSetV3[]){
 const document=JSON.stringify(sets,null,2)+'\n';
 return {sets,source_document:document,source_file_hash:sha(document),bank_content_hash:sha(JSON.stringify(sets)),public_content_hash:sha(JSON.stringify(sets)),evidence:'isolated version source memo test',
  learning_topics:topics,learning_classifications:sets.flatMap(s=>s.subquestions.map(q=>({set_id:s.id,subquestion_id:q.id,question_style:q.question_style,topic_ids:q.topic_ids,standalone_prompt:null,case_fact_ids:[]})))};
}
type Imported={release_id:string;question_versions:{set_id:string;set_version_id:string}[]};
type Dto={source_refs:{source_span?:string}[];subquestions:{id:string;criteria:{critical_facts:{scope?:string}[]}[]}[]};
const call=(db:PGlite,p:unknown)=>scalar<Imported>(db,'cpa_import_learning_question_bank($1::jsonb)',[JSON.stringify(p)]);
const definition=(db:PGlite,fn:string)=>scalar<{definition:string;acl:string;security_definer:boolean}>(db,"(select jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text,'security_definer',prosecdef) from pg_proc where oid=$1::regprocedure)",[fn]);
const executable=(db:PGlite,fn:string)=>scalar(db,"(select jsonb_build_object('anon',has_function_privilege('anon',$1::regprocedure,'execute'),'authenticated',has_function_privilege('authenticated',$1::regprocedure,'execute'),'service_role',has_function_privilege('service_role',$1::regprocedure,'execute'),'security_definer',(select prosecdef from pg_proc where oid=$1::regprocedure)))",[fn]);
const readable=(db:PGlite,table:string)=>scalar(db,"(select jsonb_build_object('anon',has_table_privilege('anon',$1::regclass,'select'),'authenticated',has_table_privilege('authenticated',$1::regclass,'select'),'service_role',has_table_privilege('service_role',$1::regclass,'select'),'rls',(select relrowsecurity from pg_class where oid=$1::regclass)))",[table]);
const memoRows=(db:PGlite)=>scalar<{versions:number;items:number}>(db,"(select jsonb_build_object('versions',(select count(*) from cpa_question_set_version_source),'items',(select count(*) from cpa_question_bank_release_item_source)))");
const dto=(db:PGlite,id:string)=>scalar<Dto>(db,'cpa_get_question_version($1::uuid)',[id]);

test('version source memo migration keeps the private DTO identical before and after the backfill, confines the memo to service_role and rejects memo drift',async()=>{
 const db=await createLearningUnitsDatabase();
 try{
  for(const sql of priorMigrations)await db.exec(sql);
  const a=privateSet('memo-a'),b=privateSet('memo-b'),c=privateSet('memo-c');
  const first=await call(db,payload([a,b]));
  const second=await call(db,payload([a,b,c]));
  const versionOf=(imported:Imported,id:string)=>imported.question_versions.find(v=>v.set_id===id)!.set_version_id;
  assert.equal(versionOf(second,a.id),versionOf(first,a.id),'unchanged sets keep their version across releases');
  const unchanged=['cpa_import_question_bank(jsonb)','cpa_import_learning_question_bank(jsonb)','cpa_get_question_version(uuid)','cpa_get_question_version_document(uuid)','cpa_assert_reviewed_question_retirements(jsonb)','cpa_import_question_bank_with_retirements(jsonb)','cpa_import_learning_question_bank_with_retirements(jsonb)'];
  const definitions=await Promise.all(unchanged.map(fn=>definition(db,fn)));
  const metadataBefore=await definition(db,'cpa_get_question_version_with_source_metadata(uuid)');
  const versions=second.question_versions.map(v=>v.set_version_id);
  const original=await Promise.all(versions.map(id=>dto(db,id)));
  await db.exec(memoMigration);
  for(const[i,fn]of unchanged.entries())assert.deepEqual(await definition(db,fn),definitions[i],fn);
  const metadataAfter=await definition(db,'cpa_get_question_version_with_source_metadata(uuid)');
  assert.notEqual(metadataAfter.definition,metadataBefore.definition);assert.equal(metadataAfter.acl,metadataBefore.acl);assert.equal(metadataAfter.security_definer,false);
  assert.deepEqual(await executable(db,'cpa_backfill_release_item_source(uuid)'),{anon:false,authenticated:false,service_role:true,security_definer:false});
  for(const table of ['cpa_question_set_version_source','cpa_question_bank_release_item_source'])assert.deepEqual(await readable(db,'public.'+table),{anon:false,authenticated:false,service_role:true,rls:true},table);
  // 백필 전: 표에 기록이 없으므로 예전 경로(저장 원문 파싱)로 같은 DTO를 만든다.
  assert.deepEqual(await memoRows(db),{versions:0,items:0});
  assert.deepEqual(await Promise.all(versions.map(id=>dto(db,id))),original);
  // 백필: 릴리스마다 저장 원문을 한 번 파싱해 항목 수만큼 행을 만든다(2 + 3).
  assert.equal(await scalar(db,'cpa_backfill_release_item_source()'),5);
  assert.deepEqual(await memoRows(db),{versions:3,items:5});
  const memoized=await Promise.all(versions.map(id=>dto(db,id)));
  assert.deepEqual(memoized,original,'memo path must return the same private DTO');
  for(const row of memoized){
   assert.equal(row.source_refs[0].source_span,'L10-L12');
   assert.equal(row.subquestions.find(q=>q.id==='sub1')!.criteria[0].critical_facts[0].scope,'독립성 유지 여부');
  }
  // 멱등: 다시 불러도 행이 늘지 않고, 릴리스 하나만 지정할 수도 있다.
  assert.equal(await scalar(db,'cpa_backfill_release_item_source($1::uuid)',[first.release_id]),2);
  assert.equal(await scalar(db,'cpa_backfill_release_item_source()'),5);
  assert.deepEqual(await memoRows(db),{versions:3,items:5});
  // 메모의 위치가 항목과 어긋나면 조회를 거절한다(저장 원문 파싱으로 조용히 넘어가지 않는다).
  const aVersion=versionOf(second,a.id);
  await db.query('update cpa_question_bank_release_item_source set source_position=source_position+1 where release_id=$1 and set_version_id=$2',[second.release_id,aVersion]);
  await assert.rejects(dto(db,aVersion),/position mismatch/);
  await db.query('update cpa_question_bank_release_item_source set source_position=source_position-1 where release_id=$1 and set_version_id=$2',[second.release_id,aVersion]);
  // 위치 메모만 있고 판본 조각이 없으면 백필을 요구한다.
  await db.query('delete from cpa_question_set_version_source where set_version_id=$1',[aVersion]);
  await assert.rejects(dto(db,aVersion),/memo missing/);
  assert.equal(await scalar(db,'cpa_backfill_release_item_source()'),5);
  assert.deepEqual(await dto(db,aVersion),original[versions.indexOf(aVersion)]);
  // migration 뒤에 올린 릴리스: 백필 전에는 예전 경로, 릴리스 지정 백필 뒤에는 메모 경로로 같은 DTO를 만든다.
  const d=privateSet('memo-d');const third=await call(db,payload([a,b,c,d]));
  const dVersion=versionOf(third,d.id);
  const fresh=await dto(db,dVersion);
  assert.equal(await scalar(db,'cpa_backfill_release_item_source($1::uuid)',[third.release_id]),4);
  assert.deepEqual(await memoRows(db),{versions:4,items:9});
  assert.deepEqual(await dto(db,dVersion),fresh);
  assert.deepEqual(await dto(db,aVersion),original[versions.indexOf(aVersion)]);
 }finally{await db.close();}
});
