import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import type {QuestionSetV3} from '../lib/questionV3.ts';
import {createLearningUnitsDatabase} from './helpers/cpaLearningUnitsDatabase.ts';
import {sampleQuestionSet,memberId} from './helpers/cpaLearningDatabase.ts';
import {validateRetirementManifest} from '../scripts/import-question-bank-v3.ts';
const migration=fs.readFileSync(new URL('../supabase/migrations/20260914080000_cpa_reviewed_question_retirements.sql',import.meta.url),'utf8');
const metadataMigration=fs.readFileSync(new URL('../supabase/migrations/20260912060000_cpa_private_source_metadata.sql',import.meta.url),'utf8');
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
async function scalar<T>(db:PGlite,sql:string,params:unknown[]=[]):Promise<T>{return (await db.query<{v:T}>(`select ${sql} as v`,params)).rows[0].v;}
function set(id:string,style:'standard'|'case'='standard'){
 const s=sampleQuestionSet(id);s.subquestions=[s.subquestions[0]];s.learning_order=['sub1'];
 const q=s.subquestions[0];q.type='descriptive';q.question_style=style;q.topic_ids=['01'];q.prompt=id+'의 원칙을 설명하시오.';
 if(style==='standard')s.shared_context.facts=[];
 Object.assign(q.criteria[0].critical_facts[0],{scope:'발문에 주어진 전제는 반복하지 않아도 된다.'});
 return s;
}
const topics=[{id:'01',title:'감사기초',part:'PART1',position:1}];
const scope=(s:QuestionSetV3)=>(s.subquestions[0].criteria[0].critical_facts[0] as {scope?:string}).scope;
function payload(sets:QuestionSetV3[]){
 const document=JSON.stringify(sets,null,2)+'\n';
 return {sets,source_document:document,source_file_hash:sha(document),bank_content_hash:sha(JSON.stringify(sets)),public_content_hash:sha(JSON.stringify(sets)),evidence:'isolated retirement database test',
  learning_topics:topics,learning_classifications:sets.flatMap(s=>s.subquestions.map(q=>({set_id:s.id,subquestion_id:q.id,question_style:q.question_style,topic_ids:q.topic_ids,standalone_prompt:q.question_style==='standard'?q.prompt:null,case_fact_ids:[]})))};
}
type Imported={release_id:string;question_versions:{set_id:string;set_version_id:string}[];retirement_manifest_sha256?:string;retirement_manifest?:unknown};
const call=(db:PGlite,p:unknown,rpc='cpa_import_learning_question_bank_with_retirements')=>scalar<Imported>(db,`${rpc}($1::jsonb)`,[JSON.stringify(p)]);
function manifest(old:Imported,oldPayload:ReturnType<typeof payload>,next:ReturnType<typeof payload>,ids:string[]){return {
 version:1,artifact_type:'question_bank_retirement_manifest',authorization:'TEST explicit retirement approval',
 expected_active_release_id:old.release_id,expected_active_source_file_hash:oldPayload.source_file_hash,candidate_source_file_hash:next.source_file_hash,
 retired_set_ids:ids,historical_versions_and_learning_attempts:'preserve',retirement_count:ids.length};}
function attach(p:ReturnType<typeof payload>,m:ReturnType<typeof manifest>){const document=JSON.stringify(m,null,2)+'\n';return {...p,retirement:{manifest_document:document,manifest_sha256:sha(document)}};}

test('reviewed retirement uses locked exact omissions, preserves old RPCs, private scopes and historical attempts, and rolls back failed imports',async()=>{
 const db=await createLearningUnitsDatabase();
 try{
  await db.exec(metadataMigration);
  const protectedFunctions=['cpa_import_question_bank(jsonb)','cpa_import_learning_question_bank(jsonb)','cpa_get_question_version(uuid)','cpa_get_question_version_with_source_metadata(uuid)','cpa_begin_attempt(jsonb)'];
  const definitions=await Promise.all(protectedFunctions.map(fn=>scalar(db,"(select jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) from pg_proc where oid=$1::regprocedure)",[fn])));
  const retired=set('retire-standard'),kept=set('keep-case','case'),fresh=set('replacement-standard');
  const before=payload([retired,kept]);const original=await call(db,before,'cpa_import_learning_question_bank');
  const oldVersion=original.question_versions.find(v=>v.set_id===retired.id)!.set_version_id;
  const oldPrivate=await scalar<QuestionSetV3>(db,'cpa_get_question_version($1)',[oldVersion]);
  assert.equal(scope(oldPrivate),scope(retired));
  const submitted=await scalar<string>(db,'clock_timestamp()::text');
  const attempt=await scalar<{attempt_id:string}>(db,'cpa_begin_attempt($1::jsonb)',[JSON.stringify({owner_user_id:memberId,actor_kind:'member',membership_version:1,release_id:original.release_id,set_id:retired.id,set_version_id:oldVersion,submission_key:randomUUID(),answers_hash:sha('answer'),submitted_at:submitted,expires_at:null,answers:{sub1:'독립성을 유지한다.'}})]);
  const oldAttempt=await scalar(db,'(select to_jsonb(a) from cpa_attempts a where id=$1)',[attempt.attempt_id]);
  const oldItems=await scalar(db,'(select jsonb_agg(to_jsonb(i) order by position) from cpa_question_bank_release_items i where release_id=$1)',[original.release_id]);
  await db.exec(migration);
  for(const[i,fn]of protectedFunctions.entries())assert.deepEqual(await scalar(db,"(select jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) from pg_proc where oid=$1::regprocedure)",[fn]),definitions[i],fn);
  const next=payload([kept,fresh]),m=manifest(original,before,next,[retired.id]),valid=attach(next,m);
  await db.exec('set role service_role');
  await assert.rejects(call(db,valid,'cpa_import_learning_question_bank'),/Whole-bank import cannot omit/);
  await assert.rejects(call(db,next),/manifest document/);
  for(const mutate of [
   (v:typeof valid)=>{v.retirement.manifest_sha256='0'.repeat(64);},
   (v:typeof valid)=>{v.source_document=undefined as unknown as string;},
  ]){const bad=structuredClone(valid);mutate(bad);await assert.rejects(call(db,bad),/manifest SHA256|authorization/);}
  for(const changed of [
   {...m,expected_active_release_id:randomUUID()},
   {...m,expected_active_source_file_hash:'0'.repeat(64)},
   {...m,candidate_source_file_hash:'0'.repeat(64)},
   {...m,retired_set_ids:[]},
   {...m,retired_set_ids:[retired.id,retired.id]},
   {...m,retired_set_ids:[retired.id,'not-active']},
   {...m,retired_set_ids:[kept.id]},
  ])await assert.rejects(call(db,attach(next,changed)),/compare-and-swap|authorization|retired set IDs|Retired set IDs/);
  const caseRemoved=payload([retired,fresh]);await assert.rejects(call(db,attach(caseRemoved,manifest(original,before,caseRemoved,[kept.id]))),/Only completely classified standard/);
  const incomplete=structuredClone(valid);incomplete.learning_classifications.pop();
  await assert.rejects(call(db,incomplete),/Complete release classification coverage/);
  assert.equal(await scalar(db,"(select id from cpa_question_bank_releases where status='active')"),original.release_id);
  assert.equal(await scalar(db,'(select count(*)::int from cpa_question_bank_releases)'),1);
  assert.equal(await scalar(db,"(select count(*)::int from cpa_question_sets where id='replacement-standard')"),0);
  const imported=await call(db,valid);
  assert.equal(imported.retirement_manifest_sha256,valid.retirement.manifest_sha256);assert.deepEqual(imported.retirement_manifest,m);
  assert.deepEqual(await scalar(db,'(select validation_report->\'retirement_authorization\' from cpa_question_bank_releases where id=$1)',[imported.release_id]),valid.retirement);
  assert.deepEqual(await scalar(db,'(select jsonb_agg(to_jsonb(i) order by position) from cpa_question_bank_release_items i where release_id=$1)',[original.release_id]),oldItems);
  assert.deepEqual(await scalar(db,'(select to_jsonb(a) from cpa_attempts a where id=$1)',[attempt.attempt_id]),oldAttempt);
  assert.deepEqual(await scalar(db,'cpa_get_question_version($1)',[oldVersion]),oldPrivate);
  const replacementVersion=imported.question_versions.find(v=>v.set_id===fresh.id)!.set_version_id;
  assert.equal(scope(await scalar<QuestionSetV3>(db,'cpa_get_question_version($1)',[replacementVersion])),scope(fresh));
  assert.equal(imported.question_versions.find(v=>v.set_id===kept.id)!.set_version_id,original.question_versions.find(v=>v.set_id===kept.id)!.set_version_id);
  await assert.rejects(call(db,valid),/compare-and-swap/);
  for(const role of ['anon','authenticated']){
   await db.exec('reset role; set role '+role);
   await assert.rejects(call(db,valid),/permission denied/);
   await assert.rejects(scalar(db,'cpa_assert_reviewed_question_retirements($1::jsonb)',[JSON.stringify(valid)]),/permission denied/);
  }
 }finally{await db.close();}
});

test('importer retirement manifest is explicit, byte-bound, and cannot list an included set',()=>{
 const next=payload([set('retained')]);const m=manifest({release_id:randomUUID(),question_versions:[]},next,next,['retired']);
 const doc=JSON.stringify(m);assert.deepEqual(validateRetirementManifest(doc,sha(doc),next.source_file_hash,next.sets),m);
 assert.throws(()=>validateRetirementManifest(doc,'0'.repeat(64),next.source_file_hash,next.sets),/SHA-256/);
 assert.throws(()=>validateRetirementManifest(doc,sha(doc),'0'.repeat(64),next.sets),/계약/);
 for(const change of [{...m,retired_set_ids:['retained']},{...m,retired_set_ids:['retired','retired']},{...m,authorization:''},{...m,historical_versions_and_learning_attempts:'delete'}]){
  const invalid=JSON.stringify(change);assert.throws(()=>validateRetirementManifest(invalid,sha(invalid),next.source_file_hash,next.sets),/계약/);
 }
});
