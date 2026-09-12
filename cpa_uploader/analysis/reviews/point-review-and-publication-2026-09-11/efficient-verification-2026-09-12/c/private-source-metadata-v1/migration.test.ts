import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createLearningUnitsDatabase} from '../../../../../../../tests/helpers/cpaLearningUnitsDatabase.ts';
import {questionBankPayload,sampleQuestionSet} from '../../../../../../../tests/helpers/cpaLearningDatabase.ts';
import {storageProjection} from '../../../c/verify-final-learning-rollout.ts';
import {buildGradingPrompt} from '../../../../../../../lib/questionV3Grading.ts';
import type {QuestionSetV3} from '../../../../../../../lib/questionV3.ts';

const migration=fs.readFileSync(path.resolve('supabase/migrations/20260912060000_cpa_private_source_metadata.sql'),'utf8');
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
type Row=Record<string,unknown>;
const versionId='10000000-0000-4000-8000-000000000001';
const releaseId='20000000-0000-4000-8000-000000000001';
const scalar=async<T>(db:PGlite,sql:string,params:unknown[]=[])=>
 (await db.query<{value:T}>(`select ${sql} as value`,params)).rows[0].value;
const get=(db:PGlite,id=versionId)=>scalar<QuestionSetV3|null>(db,'public.cpa_get_question_version($1)',[id]);
function promptParts(prompt:string) {
 const start='<<<GRADING_PAYLOAD_START>>>',end='<<<GRADING_PAYLOAD_END>>>';
 const left=prompt.indexOf(start),right=prompt.indexOf(end,left+start.length);
 assert(left>=0&&right>left,'exact production grading payload markers');
 assert.equal(prompt.indexOf(start,left+start.length),-1);
 assert.equal(prompt.indexOf(end,right+end.length),-1);
 return {before:prompt.slice(0,left+start.length),payload:JSON.parse(prompt.slice(left+start.length,right)),after:prompt.slice(right)};
}
function assertSameGradingInformation(actual:QuestionSetV3,source:QuestionSetV3) {
 const answers=Object.fromEntries(source.subquestions.map(q=>[q.id,q.model_answer.join('\n')]));
 const expected=promptParts(buildGradingPrompt(source,answers));
 const restored=promptParts(buildGradingPrompt(actual,answers));
 // JSONB changes object-key order. Compare parsed values/array order strictly,
 // and every byte of instructions and output example outside the JSON exactly.
 assert.deepEqual(restored.payload,expected.payload,`${source.id}: entire grading payload`);
 assert.equal(restored.before,expected.before,`${source.id}: instructions before payload`);
 assert.equal(restored.after,expected.after,`${source.id}: instructions/output after payload`);
}
function withoutMetadata(set:QuestionSetV3):QuestionSetV3 {
 const result=structuredClone(set);
 for(const ref of result.source_refs)delete (ref as unknown as Row).source_span;
 for(const q of result.subquestions)for(const c of q.criteria)for(const f of c.critical_facts)delete (f as unknown as Row).scope;
 return result;
}
function fixtureSet() {
 const set=sampleQuestionSet();
 const extra=structuredClone(set.source_refs[0]);extra.id='src2';extra.title='두 번째 원전';set.source_refs.push(extra);
 for(const [i,ref] of set.source_refs.entries())Object.assign(ref,{source_span:`원전 위치 ${i+1}`});
 for(const [qi,q] of set.subquestions.entries()){
  const extraCriterion=structuredClone(q.criteria[0]);extraCriterion.id='crit2';extraCriterion.claim+=' 추가 명제';extraCriterion.critical_facts[0].expected+=' 추가 명제';q.criteria.push(extraCriterion);
  for(const [ci,c] of q.criteria.entries()){
   const extraFact=structuredClone(c.critical_facts[0]);extraFact.id='fact2';extraFact.expected+=' 두 번째';c.critical_facts.push(extraFact);
   for(const [fi,f] of c.critical_facts.entries())Object.assign(f,{scope:`물음${qi+1}/기준${ci+1}/사실${fi+1}의 허용범위`});
  }
 }
 return set;
}
const contentHashSql=`encode(sha256(convert_to(jsonb_build_object('question_set',jsonb_set($1::jsonb-'status','{verification}',($1::jsonb->'verification')-'review_status'),'applicability',$2::jsonb)::text,'UTF8')),'hex')`;

/** Synthetic minimal relations permit deliberate corrupt bindings that the real
 * immutable tables ordinarily reject. The production SQL function is unchanged. */
async function minimal(source=fixtureSet(),normalized=withoutMetadata(storageProjection(source) as QuestionSetV3),applicability:Row={year:2027}) {
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
  create table cpa_question_set_versions(id uuid primary key,set_id text,content_hash text,applicability jsonb,sealed_at timestamptz,document jsonb);
  create table cpa_question_bank_releases(id uuid primary key,source_document text,source_file_hash text,status text,published_at timestamptz);
  create table cpa_question_bank_release_items(release_id uuid,set_id text,set_version_id uuid,position int);
  create function cpa_get_question_version_document(uuid) returns jsonb language sql stable as $$select document from cpa_question_set_versions where id=$1$$;
  create function cpa_restore_v3_null_policy(jsonb) returns jsonb language sql immutable strict as $$select $1$$;
  create function cpa_get_question_version(uuid) returns jsonb language sql stable as $$select cpa_get_question_version_document($1)$$;
  grant usage on schema public to service_role,anon,authenticated;
  grant select on all tables in schema public to service_role;
  grant execute on function cpa_get_question_version_document(uuid),cpa_restore_v3_null_policy(jsonb) to service_role;`);
 const text=JSON.stringify([source]);
 const h=await scalar<string>(db,contentHashSql,[JSON.stringify(source),JSON.stringify(applicability)]);
 await db.query('insert into cpa_question_set_versions values($1,$2,$3,$4,now(),$5)',[versionId,source.id,h,JSON.stringify(applicability),JSON.stringify(normalized)]);
 await db.query("insert into cpa_question_bank_releases values($1,$2,$3,'active',now())",[releaseId,text,sha(text)]);
 await db.query('insert into cpa_question_bank_release_items values($1,$2,$3,1)',[releaseId,source.id,versionId]);
 await db.exec(migration);
 return db;
}
async function replaceSource(db:PGlite,source:unknown,updateVersionHash=false,applicability:Row={year:2027}){
 const text=JSON.stringify(source);
 await db.query('update cpa_question_bank_releases set source_document=$1,source_file_hash=$2',[text,sha(text)]);
 if(updateVersionHash){const first=(source as QuestionSetV3[])[0];const h=await scalar<string>(db,contentHashSql,[JSON.stringify(first),JSON.stringify(applicability)]);await db.query('update cpa_question_set_versions set content_hash=$1',[h]);}
}

test('actual current154 and retired104 banks: production import and SQL wrapper restore every private field without row/public changes',async(t)=>{
 const db=await createLearningUnitsDatabase();
 try{
  const text=fs.readFileSync(path.resolve('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),'utf8');
  assert.equal(sha(text),'4891f97bcfc98cdeda77567b59657577da184317df199fd53c859004728acd80');
  const sets=JSON.parse(text) as QuestionSetV3[];assert.equal(sets.length,154);
  const oldText=fs.readFileSync(path.resolve('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/live-before-publication-v3/live-source.json'),'utf8');
  const oldSets=JSON.parse(oldText) as QuestionSetV3[];assert.equal(oldSets.length,104);
  const oldImported=await scalar<{release_id:string;question_versions:Array<{set_id:string;set_version_id:string}>}>(db,'cpa_import_question_bank($1::jsonb)',[JSON.stringify({...questionBankPayload(oldSets),source_document:oldText,source_file_hash:sha(oldText),applicability:{}})]);
  const imported=await scalar<{question_versions:Array<{set_id:string;set_version_id:string}>}>(db,'cpa_import_question_bank($1::jsonb)',[JSON.stringify({...questionBankPayload(sets),source_document:text,source_file_hash:sha(text),applicability:{}})]);
  const beforePublic=await scalar(db,'cpa_get_active_question_bank()');
  const tableNames=['cpa_question_bank_releases','cpa_question_bank_release_items','cpa_question_set_versions','cpa_question_sources','cpa_subquestion_versions','cpa_criteria','cpa_criterion_facts','cpa_subquestion_answers'];
  const tableHash=(table:string)=>scalar<string>(db,`encode(sha256(convert_to(coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from ${table} t),'[]')::text,'UTF8')),'hex')`);
  const tableBefore=await Promise.all(tableNames.map(tableHash));
  const protectedFunctions=['cpa_get_question_version_document(uuid)','cpa_get_public_question_version(uuid)','cpa_get_active_question_bank()','cpa_begin_attempt(jsonb)','cpa_claim_grading_run(uuid,uuid,jsonb)','cpa_complete_grading_run(uuid,uuid,uuid,uuid,jsonb)'];
  const definitions=await Promise.all(protectedFunctions.map(name=>scalar<string>(db,'pg_get_functiondef($1::regprocedure)',[name])));
  let originalMismatch=0;
  for(const v of imported.question_versions){const expected=storageProjection(sets.find(s=>s.id===v.set_id)!);const actual=await get(db,v.set_version_id);assert.deepEqual(actual,withoutMetadata(expected as QuestionSetV3));if(JSON.stringify(withoutMetadata(expected as QuestionSetV3))!==JSON.stringify(expected))originalMismatch++;}
  assert.equal(originalMismatch,37);
  await db.exec(migration);
  for(const v of imported.question_versions){const set=sets.find(s=>s.id===v.set_id)!;const actual=await get(db,v.set_version_id);assert.deepEqual(actual,storageProjection(set),set.id);assertSameGradingInformation(actual!,set);}
  assert.equal(await scalar<string>(db,'(select status from cpa_question_bank_releases where id=$1)',[oldImported.release_id]),'retired');
  for(const v of oldImported.question_versions){const set=oldSets.find(s=>s.id===v.set_id)!;const actual=await get(db,v.set_version_id);assert.deepEqual(actual,storageProjection(set),`retired/${v.set_id}`);assertSameGradingInformation(actual!,set);}
  assert.deepEqual(await scalar(db,'cpa_get_active_question_bank()'),beforePublic);
  for(const [i,name] of tableNames.entries())assert.equal(await tableHash(name),tableBefore[i],name);
  for(const [i,name] of protectedFunctions.entries())assert.equal(await scalar(db,'pg_get_functiondef($1::regprocedure)',[name]),definitions[i],name);
  assert.equal(await scalar<boolean>(db,"has_function_privilege('anon','cpa_get_question_version(uuid)','execute')"),false);
  assert.equal(await scalar<boolean>(db,"has_function_privilege('authenticated','cpa_get_question_version_with_source_metadata(uuid)','execute')"),false);
  await db.exec('set role service_role');assert.deepEqual(await get(db,imported.question_versions[0].set_version_id),storageProjection(sets[0]));await db.exec('reset role');
  assert.equal(await get(db,'00000000-0000-4000-8000-000000000099'),null);
  const sourceSpans=sets.flatMap(s=>s.source_refs).filter(r=>typeof (r as unknown as Row).source_span==='string').length;
  const scopes=sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).flatMap(c=>c.critical_facts).filter(f=>typeof (f as unknown as Row).scope==='string').length;
  assert.equal(sourceSpans,319);assert.equal(scopes,13);
  t.diagnostic(JSON.stringify({current_sets:sets.length,retired_sets:oldSets.length,affected_current_sets:originalMismatch,restored_source_spans:sourceSpans,restored_scopes:scopes,full_private_projection_comparisons:sets.length+oldSets.length,grading_payload_and_outer_text_comparisons:sets.length+oldSets.length,normalized_source_tables_unchanged:tableNames.length,protected_functions_unchanged:protectedFunctions.length,public_payload_unchanged:true,remote_database_calls:0,model_api_calls:0}));
 }finally{await db.close();}
});

test('ID restoration does not use nested array positions',async()=>{
 const source=fixtureSet(),normalized=withoutMetadata(storageProjection(source) as QuestionSetV3);
 source.source_refs.reverse();source.subquestions.reverse();for(const q of source.subquestions){q.criteria.reverse();for(const c of q.criteria)c.critical_facts.reverse();}
 const db=await minimal(source,normalized);
 try{const actual=await get(db);assert(actual);assert.deepEqual(withoutMetadata(actual),normalized);const original=fixtureSet();
  for(const ref of actual.source_refs)assert.equal((ref as unknown as Row).source_span,(original.source_refs.find(s=>s.id===ref.id) as unknown as Row).source_span);
  for(const q of actual.subquestions)for(const c of q.criteria)for(const f of c.critical_facts)assert.equal((f as unknown as Row).scope,(original.subquestions.find(s=>s.id===q.id)!.criteria.find(s=>s.id===c.id)!.critical_facts.find(s=>s.id===f.id) as unknown as Row).scope);
 }finally{await db.close();}
});

test('ordinary normalized fields must match the archive and are never overwritten to hide loss',async(t)=>{
 const mutations:Array<[string,(s:QuestionSetV3)=>void,RegExp]>=[
  ['title',s=>{s.title='정규화 행의 다른 제목';},/ordinary set fields mismatch/],
  ['source quote',s=>{s.source_refs[0].source_quote='다른 원문';},/ordinary source reference fields mismatch/],
  ['prompt',s=>{s.subquestions[0].prompt='다른 발문';},/ordinary subquestion fields mismatch/],
  ['requirement span',s=>{s.subquestions[0].requirements[0].source_span='다른 위치';},/ordinary subquestion fields mismatch/],
  ['claim',s=>{s.subquestions[0].criteria[0].claim='다른 명제';},/ordinary criterion fields mismatch/],
  ['points',s=>{s.subquestions[0].criteria[0].max_points=2;},/ordinary criterion fields mismatch/],
  ['fact expected',s=>{s.subquestions[0].criteria[0].critical_facts[0].expected='다른 요구';},/ordinary fact fields mismatch/],
 ];
 for(const [name,mutate,error] of mutations)await t.test(name,async()=>{const source=fixtureSet(),normalized=withoutMetadata(storageProjection(source) as QuestionSetV3);mutate(normalized);const db=await minimal(source,normalized);try{await assert.rejects(get(db),error);}finally{await db.close();}});
});

test('document-less legacy stays exact; null optional fields are absent and empty strings remain exact',async()=>{
 const source=fixtureSet();Object.assign(source.source_refs[0],{source_span:null});Object.assign(source.subquestions[0].criteria[0].critical_facts[0],{scope:''});
 const db=await minimal(source);
 try{assert.deepEqual(await get(db),storageProjection(source));await db.query('update cpa_question_bank_releases set source_document=null');assert.deepEqual(await get(db),withoutMetadata(storageProjection(source) as QuestionSetV3));}finally{await db.close();}
});

test('all linked archives must agree: lifecycle-only changes pass; broken second archive is never ignored',async()=>{
 const source=fixtureSet(),db=await minimal(source);
 try{const second=structuredClone(source);second.status='verified';second.verification.review_status='needs_human_review';const text=JSON.stringify([second]);
  await db.query("insert into cpa_question_bank_releases values('20000000-0000-4000-8000-000000000002',$1,$2,'retired',now())",[text,sha(text)]);
  await db.query("insert into cpa_question_bank_release_items values('20000000-0000-4000-8000-000000000002',$1,$2,1)",[source.id,versionId]);
  assert.deepEqual(await get(db),storageProjection(source));Object.assign(second.subquestions[0].criteria[0].critical_facts[0],{scope:'충돌하는 다른 범위'});const bad=JSON.stringify([second]);
  await db.query("update cpa_question_bank_releases set source_document=$1,source_file_hash=$2 where status='retired'",[bad,sha(bad)]);
  await assert.rejects(get(db),/content hash mismatch/);
 }finally{await db.close();}
});

test('reject source bytes, set/version/position, publication state and applicability binding errors',async(t)=>{
 const cases:Array<[string,(db:PGlite)=>Promise<unknown>,RegExp]>=[
  ['file hash',db=>db.query("update cpa_question_bank_releases set source_file_hash=repeat('0',64)"),/source file hash mismatch/],
  ['linked set',db=>db.query("update cpa_question_bank_release_items set set_id='another-set'"),/exact sealed release/],
  ['position',db=>db.query('update cpa_question_bank_release_items set position=2'),/position mismatch/],
  ['unsealed version',db=>db.query('update cpa_question_set_versions set sealed_at=null'),/exact sealed release/],
  ['draft archive',db=>db.query("update cpa_question_bank_releases set status='draft'"),/exact sealed release/],
  ['unpublished archive',db=>db.query('update cpa_question_bank_releases set published_at=null'),/exact sealed release/],
  ['applicability',db=>db.query("update cpa_question_set_versions set applicability='{}'"),/content hash mismatch/],
  ['unrelated latest source',async db=>{const s=fixtureSet();s.id='different-set';await replaceSource(db,[s]);},/exactly one source set/],
  ['duplicate source set',db=>replaceSource(db,[fixtureSet(),fixtureSet()]),/exactly one source set/],
  ['non-array document',db=>replaceSource(db,{sets:[fixtureSet()]}),/must be an array/],
  ['malformed document',db=>db.query('update cpa_question_bank_releases set source_document=$1,source_file_hash=$2',['{',sha('{')]),/invalid input syntax/],
  ['changed ordinary point',async db=>{const s=fixtureSet();s.subquestions[0].criteria[0].max_points=2;await replaceSource(db,[s]);},/content hash mismatch/],
  ['changed source quote',async db=>{const s=fixtureSet();s.source_refs[0].source_quote+=' 다른 인용';await replaceSource(db,[s]);},/content hash mismatch/],
  ['changed requirement locator',async db=>{const s=fixtureSet();s.subquestions[0].requirements[0].source_span='다른 문단';await replaceSource(db,[s]);},/content hash mismatch/],
 ];
 for(const [name,mutate,error] of cases)await t.test(name,async()=>{const db=await minimal();try{await mutate(db);await assert.rejects(get(db),error);}finally{await db.close();}});
});

test('reject duplicate/missing nested IDs and non-string optional metadata, even in self-consistent archive hashes',async(t)=>{
 const cases:Array<[string,(s:QuestionSetV3)=>void,RegExp]>=[
  ['duplicate source ref',s=>{s.source_refs[1]=structuredClone(s.source_refs[0]);},/source reference ID mismatch/],
  ['missing source ref',s=>{s.source_refs[0].id='missing';},/source reference ID mismatch/],
  ['duplicate question',s=>{s.subquestions[1]=structuredClone(s.subquestions[0]);},/subquestion ID mismatch/],
  ['duplicate criterion',s=>{s.subquestions[0].criteria[1]=structuredClone(s.subquestions[0].criteria[0]);},/criterion ID mismatch/],
  ['duplicate fact',s=>{s.subquestions[0].criteria[0].critical_facts[1]=structuredClone(s.subquestions[0].criteria[0].critical_facts[0]);},/fact ID mismatch/],
  ['missing fact',s=>{s.subquestions[0].criteria[0].critical_facts[0].id='absent';},/fact ID mismatch/],
  ['invalid source span',s=>{Object.assign(s.source_refs[0],{source_span:{not:'text'}});},/source_span must be a string/],
  ['invalid scope',s=>{Object.assign(s.subquestions[0].criteria[0].critical_facts[0],{scope:12});},/fact scope must be a string/],
 ];
 for(const [name,mutate,error] of cases)await t.test(name,async()=>{const source=fixtureSet(),db=await minimal(source);try{mutate(source);await replaceSource(db,[source],true);await assert.rejects(get(db),error);}finally{await db.close();}});
});

test('existing normalized metadata may match but cannot be overwritten by a different archive value',async(t)=>{
 await t.test('equal fields',async()=>{const source=fixtureSet(),db=await minimal(source,storageProjection(source) as QuestionSetV3);try{assert.deepEqual(await get(db),storageProjection(source));}finally{await db.close();}});
 for(const field of ['source_span','scope'])await t.test(field+' collision',async()=>{const source=fixtureSet(),normalized=storageProjection(source) as QuestionSetV3;
  if(field==='source_span')Object.assign(normalized.source_refs[0],{source_span:'정규화 저장값'});else Object.assign(normalized.subquestions[0].criteria[0].critical_facts[0],{scope:'정규화 저장값'});
  const db=await minimal(source,normalized);try{await assert.rejects(get(db),/overwrite normalized metadata/);}finally{await db.close();}});
});
