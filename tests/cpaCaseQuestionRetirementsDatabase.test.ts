import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import type {QuestionSetV3} from '../lib/questionV3.ts';
import {createLearningUnitsDatabase} from './helpers/cpaLearningUnitsDatabase.ts';
import {sampleQuestionSet,memberId} from './helpers/cpaLearningDatabase.ts';
const standardRetirement=fs.readFileSync(new URL('../supabase/migrations/20260914080000_cpa_reviewed_question_retirements.sql',import.meta.url),'utf8');
const caseRetirement=fs.readFileSync(new URL('../supabase/migrations/20260915090000_cpa_reviewed_case_question_retirements.sql',import.meta.url),'utf8');
const metadataMigration=fs.readFileSync(new URL('../supabase/migrations/20260912060000_cpa_private_source_metadata.sql',import.meta.url),'utf8');
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
async function scalar<T>(db:PGlite,sql:string,params:unknown[]=[]):Promise<T>{return (await db.query<{v:T}>(`select ${sql} as v`,params)).rows[0].v;}
function standardSet(id:string){
 const s=sampleQuestionSet(id);s.subquestions=[s.subquestions[0]];s.learning_order=['sub1'];s.shared_context.facts=[];
 const q=s.subquestions[0];q.type='descriptive';q.question_style='standard';q.topic_ids=['01'];q.prompt=id+'의 원칙을 설명하시오.';
 return s;
}
function caseSet(id:string){
 const s=sampleQuestionSet(id);s.title=id+' 사례';
 for(const q of s.subquestions){q.question_style='case';q.topic_ids=['01'];q.prompt=id+'의 '+q.id+' 사실을 판단하시오.';}
 return s;
}
const topics=[{id:'01',title:'감사기초',part:'PART1',position:1}];
function payload(sets:QuestionSetV3[]){
 const document=JSON.stringify(sets,null,2)+'\n';
 return {sets,source_document:document,source_file_hash:sha(document),bank_content_hash:sha(JSON.stringify(sets)),public_content_hash:sha(JSON.stringify(sets)),evidence:'isolated case retirement database test',
  learning_topics:topics,learning_classifications:sets.flatMap(s=>s.subquestions.map(q=>({set_id:s.id,subquestion_id:q.id,question_style:q.question_style,topic_ids:q.topic_ids,standalone_prompt:q.question_style==='standard'?q.prompt:null,case_fact_ids:[]})))};
}
type Imported={release_id:string;question_versions:{set_id:string;set_version_id:string}[];retirement_manifest_sha256?:string;retirement_manifest?:unknown};
const call=(db:PGlite,p:unknown,rpc='cpa_import_learning_question_bank_with_retirements')=>scalar<Imported>(db,`${rpc}($1::jsonb)`,[JSON.stringify(p)]);
function manifest(old:Imported,oldPayload:ReturnType<typeof payload>,next:ReturnType<typeof payload>,ids:string[]){return {
 version:1,artifact_type:'question_bank_retirement_manifest',authorization:'TEST explicit case retirement approval',
 expected_active_release_id:old.release_id,expected_active_source_file_hash:oldPayload.source_file_hash,candidate_source_file_hash:next.source_file_hash,
 retired_set_ids:ids,historical_versions_and_learning_attempts:'preserve',retirement_count:ids.length};}
function attach(p:ReturnType<typeof payload>,m:ReturnType<typeof manifest>){const document=JSON.stringify(m,null,2)+'\n';return {...p,retirement:{manifest_document:document,manifest_sha256:sha(document)}};}
const definition=(db:PGlite,fn:string)=>scalar(db,"(select jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text,'security_definer',prosecdef) from pg_proc where oid=$1::regprocedure)",[fn]);

test('case retirement migration changes only the style guard and retires completely classified case sets while preserving history',async()=>{
 const db=await createLearningUnitsDatabase();
 try{
  await db.exec(metadataMigration);
  const retiredCase=caseSet('retire-case'),retiredStandard=standardSet('retire-standard'),kept=standardSet('keep-standard'),keptCase=caseSet('keep-case'),fresh=caseSet('replacement-case');
  const before=payload([retiredCase,kept,retiredStandard,keptCase]);const original=await call(db,before,'cpa_import_learning_question_bank');
  const oldCaseVersion=original.question_versions.find(v=>v.set_id===retiredCase.id)!.set_version_id;
  const submitted=await scalar<string>(db,'clock_timestamp()::text');
  const attempt=await scalar<{attempt_id:string}>(db,'cpa_begin_attempt($1::jsonb)',[JSON.stringify({owner_user_id:memberId,actor_kind:'member',membership_version:1,release_id:original.release_id,set_id:retiredCase.id,set_version_id:oldCaseVersion,submission_key:randomUUID(),answers_hash:sha('answer'),submitted_at:submitted,expires_at:null,answers:{sub1:'독립성을 유지한다.',sub2:'의구심을 유지한다.'}})]);
  const oldAttempt=await scalar(db,'(select to_jsonb(a) from cpa_attempts a where id=$1)',[attempt.attempt_id]);
  const oldItems=await scalar(db,'(select jsonb_agg(to_jsonb(i) order by position) from cpa_question_bank_release_items i where release_id=$1)',[original.release_id]);
  const oldClassifications=await scalar<unknown[]>(db,'cpa_get_learning_classifications($1)',[original.release_id]);
  await db.exec(standardRetirement);
  const next=payload([kept,keptCase,fresh]),ids=[retiredCase.id,retiredStandard.id].sort(),valid=attach(next,manifest(original,before,next,ids));
  await db.exec('set role service_role');
  await assert.rejects(call(db,valid),/Only completely classified standard sets/);
  await db.exec('reset role');
  const unchanged=['cpa_import_question_bank(jsonb)','cpa_import_learning_question_bank(jsonb)','cpa_get_question_version(uuid)','cpa_get_question_version_with_source_metadata(uuid)','cpa_begin_attempt(jsonb)','cpa_import_question_bank_with_retirements(jsonb)','cpa_import_learning_question_bank_with_retirements(jsonb)'];
  const definitions=await Promise.all(unchanged.map(fn=>definition(db,fn)));
  const assertBefore=await definition(db,'cpa_assert_reviewed_question_retirements(jsonb)') as {acl:string;security_definer:boolean};
  await db.exec(caseRetirement);
  for(const[i,fn]of unchanged.entries())assert.deepEqual(await definition(db,fn),definitions[i],fn);
  const assertAfter=await definition(db,'cpa_assert_reviewed_question_retirements(jsonb)') as {definition:string;acl:string;security_definer:boolean};
  assert.equal(assertAfter.acl,assertBefore.acl);assert.equal(assertAfter.security_definer,false);assert.match(assertAfter.definition,/standard or case sets/);
  await db.exec('set role service_role');
  // Exact omission, compare-and-swap and completeness guards still apply to case sets.
  for(const changed of [
   {...manifest(original,before,next,ids),retired_set_ids:[retiredCase.id]},
   {...manifest(original,before,next,ids),retired_set_ids:[...ids,keptCase.id]},
   {...manifest(original,before,next,ids),expected_active_release_id:randomUUID()},
  ])await assert.rejects(call(db,attach(next,changed)),/Retired set IDs|compare-and-swap/);
  const incomplete=structuredClone(valid);incomplete.learning_classifications.pop();
  await assert.rejects(call(db,incomplete),/Complete release classification coverage/);
  assert.equal(await scalar(db,"(select id from cpa_question_bank_releases where status='active')"),original.release_id);
  const imported=await call(db,valid);
  assert.deepEqual(imported.retirement_manifest,manifest(original,before,next,ids));
  assert.deepEqual(imported.question_versions.map(v=>v.set_id).sort(),[kept.id,keptCase.id,fresh.id].sort());
  for(const id of [kept.id,keptCase.id])assert.equal(imported.question_versions.find(v=>v.set_id===id)!.set_version_id,original.question_versions.find(v=>v.set_id===id)!.set_version_id);
  const nextClassifications=await scalar<{source_set_id:string;question_style:string;case_set_id:string|null}[]>(db,'cpa_get_learning_classifications($1)',[imported.release_id]);
  assert(nextClassifications.every(c=>!ids.includes(c.source_set_id)));
  assert(nextClassifications.filter(c=>c.source_set_id===fresh.id).every(c=>c.question_style==='case'&&c.case_set_id===fresh.id));
  assert.deepEqual(await scalar(db,'cpa_get_learning_classifications($1)',[original.release_id]),oldClassifications);
  assert.deepEqual(await scalar(db,'(select jsonb_agg(to_jsonb(i) order by position) from cpa_question_bank_release_items i where release_id=$1)',[original.release_id]),oldItems);
  assert.deepEqual(await scalar(db,'(select to_jsonb(a) from cpa_attempts a where id=$1)',[attempt.attempt_id]),oldAttempt);
  assert.equal(await scalar(db,"(select status from cpa_question_bank_releases where id=$1)",[original.release_id]),'retired');
  await assert.rejects(call(db,valid),/compare-and-swap/);
  for(const role of ['anon','authenticated']){
   await db.exec('reset role; set role '+role);
   await assert.rejects(scalar(db,'cpa_assert_reviewed_question_retirements($1::jsonb)',[JSON.stringify(valid)]),/permission denied/);
  }
 }finally{await db.close();}
});
