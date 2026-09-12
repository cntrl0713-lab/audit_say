import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { createLearningUnitsDatabase, applyLearningUnitsMigration } from './helpers/cpaLearningUnitsDatabase.ts';
import { importQuestionBank, questionBankPayload, sampleQuestionSet, memberId, otherMemberId, guestId } from './helpers/cpaLearningDatabase.ts';
import type { ImportedQuestionBank } from './helpers/cpaLearningDatabase.ts';
import { applyQuestionSetJudgment } from '../lib/questionV3Grading.ts';
import type { QuestionSetGradeResultV3 } from '../lib/questionV3Grading.ts';

type Classification = {
  learning_question_id: string; classification_version_id: string;
  source_set_id: string; source_set_version_id: string; source_subquestion_version_id: string;
  source_content_hash: string; subquestion_id: string; question_style: 'case'|'standard';
  case_set_id: string|null; topic_ids: string[]; standalone_prompt: string|null; case_fact_ids: string[]; content_hash: string;
};
type Entry = {set_id:string;subquestion_id:string;source_content_hash:string;question_style:'case'|'standard';
  topic_ids:string[];standalone_prompt:string|null;case_fact_ids:string[];content_hash?:string};
type Attempt={attempt_id:string;status:string};
type Run={state:string;run_id:string;lease_token:string};
type Saved={result:QuestionSetGradeResultV3;learning_unit_id?:string;selected_subquestion_ids?:string[];classification_version_ids?:string[]};
const topics=[{id:'01',title:'감사기초',part:'PART1',position:1},{id:'02',title:'윤리',part:'PART1',position:2}];
const allAnswers={sub1:'독립성을 유지한다.',sub2:'전문가적 의구심을 유지한다.'};
const meta={engine_version:'local-database-test',grading_contract_hash:'selection-contract',provider:'local',model:'no-model-call'};
async function scalar<T>(db:PGlite,sql:string,params:unknown[]=[]):Promise<T> {
  return (await db.query<{value:T}>(`select ${sql} as value`,params)).rows[0].value;
}
async function classificationPayload(db:PGlite,bank:ImportedQuestionBank,styles:('case'|'standard')[]=['standard','case']) {
  const entries:Entry[]=[];
  for(const set of bank.question_versions) {
    const hash=await scalar<string>(db,'(select content_hash from cpa_question_set_versions where id=$1)',[set.set_version_id]);
    for(const [i,q] of sampleQuestionSet(set.set_id).subquestions.entries()) entries.push({set_id:set.set_id,subquestion_id:q.id,
      source_content_hash:hash,question_style:styles[i],topic_ids:i===0?['01','02']:['01'],
      standalone_prompt:styles[i]==='standard'?`${q.id}에 대응하는 일반 원칙을 설명하시오.`:null,
      case_fact_ids:styles[i]==='case'?['f1']:[]});
  }
  return {release_id:bank.release_id,topics,entries};
}
async function importClassifications(db:PGlite,input:Awaited<ReturnType<typeof classificationPayload>>) {
  return scalar<Classification[]>(db,'cpa_import_learning_classifications($1::jsonb)',[JSON.stringify(input)]);
}
async function setup(styles:('case'|'standard')[]=['standard','case']) {
  const db=await createLearningUnitsDatabase();
  try {
    const bank=await importQuestionBank(db); const input=await classificationPayload(db,bank,styles);
    const rows=await importClassifications(db,input); await scalar(db,'cpa_initialize_learning_progress()');
    return {db,bank,input,rows};
  } catch(error) {await db.close();throw error;}
}
async function submission(db:PGlite,bank:ImportedQuestionBank,rows?:Classification[],owner=memberId) {
  const submitted=await scalar<string>(db,'clock_timestamp()::text');
  const answers=rows?Object.fromEntries(rows.map(r=>[r.subquestion_id,allAnswers[r.subquestion_id as keyof typeof allAnswers]])):allAnswers;
  return {owner_user_id:owner,actor_kind:owner===guestId?'guest':'member',membership_version:owner===guestId?null:1,
    release_id:bank.release_id,set_id:bank.question_versions[0].set_id,set_version_id:bank.question_versions[0].set_version_id,
    submission_key:randomUUID(),answers_hash:createHash('sha256').update(JSON.stringify(answers)).digest('hex'),
    submitted_at:submitted,expires_at:owner===guestId?await scalar<string>(db,"($1::timestamptz+interval '168 hours')::text",[submitted]):null,
    answers,...(rows?{learning_unit_id:rows[0].question_style==='case'?`${rows[0].source_set_id}--case`:
      `${rows[0].source_set_id}--${rows[0].subquestion_id}--standard`,selected_subquestion_ids:rows.map(r=>r.subquestion_id),
      classification_version_ids:rows.map(r=>r.classification_version_id)}:{})};
}
const begin=(db:PGlite,payload:unknown)=>scalar<Attempt>(db,'cpa_begin_attempt($1::jsonb)',[JSON.stringify(payload)]);
const claim=(db:PGlite,a:Attempt,owner=memberId)=>scalar<Run>(db,'cpa_claim_grading_run($1,$2,$3)',[a.attempt_id,owner,JSON.stringify(meta)]);
const complete=(db:PGlite,a:Attempt,r:Run,result:unknown,owner=memberId)=>scalar<Saved>(db,'cpa_complete_grading_run($1,$2,$3,$4,$5)',
  [a.attempt_id,owner,r.run_id,r.lease_token,JSON.stringify(result)]);
// This exercises deterministic persistence/security arithmetic, not an actual
// semantic review or model grade. No API credentials or network are used.
function grade(ids=['sub1','sub2'],met=true):QuestionSetGradeResultV3 {
  const set=sampleQuestionSet();set.subquestions=set.subquestions.filter(q=>ids.includes(q.id));set.learning_order=ids;
  return applyQuestionSetJudgment(set,allAnswers,{subquestions:ids.map(id=>({subquestion_id:id,
    verdicts:[{criterion_id:'crit1',verdict:met?'met':'not_met',...(met?{quote:allAnswers[id as keyof typeof allAnswers]}:{})}]}))});
}

test('additive migration preserves already-completed attempts, published documents, XP and exact membership wrappers',async()=>{
  const db=await createLearningUnitsDatabase({applyLearningUnits:false});
  try {
    const bank=await importQuestionBank(db);await scalar(db,'cpa_initialize_learning_progress()');
    const p=await submission(db,bank);const a=await begin(db,p);const r=await claim(db,a);
    const saved=await complete(db,a,r,grade());
    const beforePrivate=await scalar(db,'cpa_get_question_version($1)',[bank.question_versions[0].set_version_id]);
    const beforePublic=await scalar(db,'cpa_get_active_question_bank()');
    const tables=['cpa_attempts','cpa_attempt_answers','cpa_grading_runs','cpa_subquestion_grade_results','cpa_criterion_grade_results','cpa_xp_events'];
    const snapshots=await Promise.all(tables.map(t=>scalar(db,`(select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from ${t} r)`)));
    const signatures=['cpa_begin_attempt(jsonb)','cpa_claim_grading_run(uuid,uuid,jsonb)','cpa_complete_grading_run(uuid,uuid,uuid,uuid,jsonb)'];
    const wrappers=await Promise.all(signatures.map(s=>scalar(db,'pg_get_functiondef($1::regprocedure)',[s])));
    await applyLearningUnitsMigration(db);
    assert.deepEqual(await scalar(db,'cpa_get_question_version($1)',[bank.question_versions[0].set_version_id]),beforePrivate);
    assert.deepEqual(await scalar(db,'cpa_get_active_question_bank()'),beforePublic);
    assert.deepEqual(await scalar(db,'cpa_get_attempt_result($1,$2)',[a.attempt_id,memberId]),saved);
    for(const [i,t] of tables.entries()) assert.deepEqual(await scalar(db,`(select jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text) from ${t} r)`),snapshots[i]);
    for(const [i,s] of signatures.entries()) assert.equal(await scalar(db,'pg_get_functiondef($1::regprocedure)',[s]),wrappers[i]);
    const metadata=await importClassifications(db,await classificationPayload(db,bank));
    assert.equal(metadata.length,2);assert.deepEqual(await scalar(db,'cpa_get_attempt_result($1,$2)',[a.attempt_id,memberId]),saved);
    assert.deepEqual(await complete(db,a,r,grade(['sub1'],false)),saved);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempt_learning_selections)'),0);
  } finally {await db.close();}
});

test('classification import is complete, source-bound, versioned and topic-normalized without modifying published v3 bytes',async()=>{
  const db=await createLearningUnitsDatabase();
  try {
    const bank=await importQuestionBank(db);
    const before=await scalar(db,'cpa_get_active_question_bank()');
    const input=await classificationPayload(db,bank);
    for(const mutate of [
      (p:typeof input)=>{p.entries.pop();},
      (p:typeof input)=>{p.entries[1]=structuredClone(p.entries[0]);},
      (p:typeof input)=>{p.entries[0].source_content_hash='0'.repeat(64);},
      (p:typeof input)=>{p.entries[0].topic_ids=['99'];},
      (p:typeof input)=>{p.entries[0].topic_ids=['01','01'];},
      (p:typeof input)=>{p.entries[0].standalone_prompt=null;},
      (p:typeof input)=>{p.entries[0].case_fact_ids=['f1'];},
      (p:typeof input)=>{p.entries[1].case_fact_ids=['missing'];},
      (p:typeof input)=>{p.entries[0].content_hash='f'.repeat(64);},
    ]) {const bad=structuredClone(input);mutate(bad);await assert.rejects(importClassifications(db,bad));
      assert.equal(await scalar(db,'(select count(*)::int from cpa_learning_question_versions)'),0);}
    input.entries[1].case_fact_ids=[]; // A case may put its concrete facts in the question prompt.
    const rows=await importClassifications(db,input);
    assert.equal(rows.length,2);assert.equal(rows[0].case_set_id,null);assert.deepEqual(rows[0].topic_ids,['01','02']);
    assert.equal(rows[1].case_set_id,rows[1].source_set_id);
    assert.deepEqual(await importClassifications(db,input),rows);
    assert.deepEqual(await scalar(db,'cpa_get_active_question_bank()'),before);
    const changed=structuredClone(input);changed.entries[0].standalone_prompt='개정한 독립 발문';
    const next=await importClassifications(db,changed);
    assert.equal(next[0].learning_question_id,rows[0].learning_question_id);
    assert.notEqual(next[0].classification_version_id,rows[0].classification_version_id);
    assert.equal(next[1].classification_version_id,rows[1].classification_version_id);
    assert.deepEqual(await scalar(db,'cpa_get_learning_classifications($1,$2)',[bank.release_id,rows.map(r=>r.classification_version_id)]),rows);
    const revert=await importClassifications(db,input);
    assert.notEqual(revert[0].classification_version_id,rows[0].classification_version_id);
    assert.equal(revert[0].standalone_prompt,rows[0].standalone_prompt);
    await assert.rejects(db.query("update cpa_learning_question_versions set standalone_prompt='tamper' where id=$1",[rows[0].classification_version_id]),/immutable/);
    await assert.rejects(db.query('delete from cpa_learning_question_topics where classification_version_id=$1',[rows[0].classification_version_id]),/immutable/);
    await assert.rejects(db.query('insert into cpa_learning_question_topics values($1,$2)',[rows[1].classification_version_id,'02']),/immutable/);
    await assert.rejects(db.query('update cpa_learning_questions set source_subquestion_id=source_subquestion_id where id=$1',[rows[0].learning_question_id]),/immutable/);
    await assert.rejects(db.query("update cpa_subquestion_versions set prompt='tamper' where id=$1",[rows[0].source_subquestion_version_id]),/immutable/);
  } finally {await db.close();}
});

test('standalone selection grades and awards only its one answer, freezes prompt/version, and preserves full-set compatibility',async()=>{
  const {db,bank,input,rows}=await setup();
  try {
    await db.exec('set role service_role');
    const p=await submission(db,bank,[rows[0]]);const a=await begin(db,p);assert.deepEqual(await begin(db,p),a);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempt_answers where attempt_id=$1)',[a.attempt_id]),1);
    const run=await claim(db,a);assert.equal(await scalar(db,'(select max_points from cpa_grading_runs where id=$1)',[run.run_id]),1);
    await assert.rejects(complete(db,a,run,grade()),/coverage mismatch/);
    const saved=await complete(db,a,run,grade(['sub1']));
    assert.equal(saved.result.max_points,1);assert.equal(saved.result.score,1);
    assert.equal(saved.result.subquestions[0].prompt,rows[0].standalone_prompt);
    assert.equal(saved.learning_unit_id,p.learning_unit_id);assert.deepEqual(saved.classification_version_ids,p.classification_version_ids);
    assert.deepEqual(await complete(db,a,run,grade(['sub1'],false)),saved);
    assert.equal(await scalar(db,'(select exp::int from cpa_users where id=$1)',[memberId]),18);
    const changed=structuredClone(input);changed.entries[0].standalone_prompt='나중 발문';const next=await importClassifications(db,changed);
    assert.deepEqual(await scalar(db,'cpa_get_attempt_result($1,$2)',[a.attempt_id,memberId]),saved);
    await assert.rejects(begin(db,{...p,classification_version_ids:[next[0].classification_version_id]}),/key conflict/);
    const history=await scalar<Array<{question_set_id:string;max_points:number}>>(db,'cpa_get_attempt_history($1)',[memberId]);
    assert.equal(history[0].question_set_id,p.learning_unit_id);assert.equal(history[0].max_points,1);
    const legacy=await submission(db,bank);const old=await begin(db,legacy);const oldRun=await claim(db,old);
    const oldSaved=await complete(db,old,oldRun,grade());assert.equal(oldSaved.result.max_points,2);
    assert.deepEqual(oldSaved.result,grade());
    assert.equal(oldSaved.result.subquestions.length,2);assert.equal(oldSaved.learning_unit_id,undefined);
    assert.equal(await scalar(db,'(select exp::int from cpa_users where id=$1)',[memberId]),20);
    await assert.rejects(begin(db,{...p,submission_key:legacy.submission_key,submitted_at:legacy.submitted_at,answers_hash:legacy.answers_hash}),/key conflict/);
    await assert.rejects(scalar(db,'cpa_get_attempt_result($1,$2)',[a.attempt_id,otherMemberId]),/Attempt not found/);
  } finally {await db.close();}
});

test('notebook opens the failed standalone question using latest metadata while its saved result stays frozen',async()=>{
  const {db,bank,input,rows}=await setup(['standard','standard']);
  try {
    const p=await submission(db,bank,[rows[1]]);const a=await begin(db,p);const run=await claim(db,a);
    const saved=await complete(db,a,run,grade(['sub2'],false));
    const changed=structuredClone(input);changed.entries[1].standalone_prompt='새로운 독립 물음 2';
    const next=await importClassifications(db,changed);
    const notes=await scalar<Array<{question_set_id:string;prompt:string;last_failed_attempt_id:string;classification_version_id:string}>>(db,'cpa_get_review_items($1)',[memberId]);
    assert.equal(notes[0].question_set_id,p.learning_unit_id);assert.equal(notes[0].prompt,'새로운 독립 물음 2');
    assert.equal(notes[0].classification_version_id,next[1].classification_version_id);
    assert.equal(notes[0].last_failed_attempt_id,a.attempt_id);
    assert.deepEqual(await scalar(db,'cpa_get_attempt_result($1,$2)',[a.attempt_id,memberId]),saved);
    assert.equal(saved.result.subquestions[0].prompt,rows[1].standalone_prompt);
    await assert.rejects(begin(db,await submission(db,bank,rows)),/Standard learning requires one question/);
  } finally {await db.close();}
});

test('retired source/version classification remains retrievable and usable; a foreign release/version cannot be substituted',async()=>{
  const {db,bank,rows}=await setup();
  try {
    const updated=sampleQuestionSet();updated.title='개정 원문';updated.subquestions[0].prompt='개정 원문 발문';
    const second=await importQuestionBank(db,[updated]);
    assert.notEqual(second.release_id,bank.release_id);
    const next=await importClassifications(db,await classificationPayload(db,second));
    assert.equal(next[0].learning_question_id,rows[0].learning_question_id);
    assert.deepEqual(await scalar(db,'cpa_get_learning_classifications($1,$2)',[bank.release_id,rows.map(r=>r.classification_version_id)]),rows);
    await assert.rejects(scalar(db,'cpa_get_learning_classifications($1,$2)',[second.release_id,[rows[0].classification_version_id]]),/does not belong/);
    const oldPayload=await submission(db,bank,[rows[0]]);const a=await begin(db,oldPayload);
    await assert.rejects(begin(db,{...oldPayload,submission_key:randomUUID(),classification_version_ids:[next[0].classification_version_id]}),/source selection mismatch/);
    const run=await claim(db,a);const saved=await complete(db,a,run,grade(['sub1']));
    assert.equal(saved.result.subquestions[0].prompt,rows[0].standalone_prompt);
  } finally {await db.close();}
});

test('anonymous selected submissions use the same retention and security boundary without member XP or review records',async()=>{
  const {db,bank,rows}=await setup();
  try {
    const p=await submission(db,bank,[rows[0]],guestId);const a=await begin(db,p);const run=await claim(db,a,guestId);
    const rejected=grade(['sub1'],false);rejected.security_flag='injection';
    const saved=await complete(db,a,run,rejected,guestId);assert.equal(saved.result.score,0);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_review_items)'),0);
    assert.equal(await scalar(db,"(select count(*)::int from cpa_xp_events where event_type='submission_award')"),0);
    await assert.rejects(begin(db,{...p,submission_key:randomUUID(),expires_at:null}),/retention/);
    await db.query('delete from auth.users where id=$1',[guestId]);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempt_learning_questions)'),0);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempt_learning_selections)'),0);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_learning_question_versions)'),2);
  } finally {await db.close();}
});

test('new one-question standard source preserves authored style and topics through private/public DB roundtrip',async()=>{
  const db=await createLearningUnitsDatabase();
  try {
    const set=sampleQuestionSet('pilot-01-standalone');set.subquestions=[set.subquestions[0]];set.learning_order=['sub1'];
    set.shared_context.facts=[];set.subquestions[0].question_style='standard';set.subquestions[0].topic_ids=['02','01'];
    const bank=await importQuestionBank(db,[set]);const version=bank.question_versions[0].set_version_id;
    const privateSet=await scalar<typeof set>(db,'cpa_get_question_version($1)',[version]);
    // Stored answer_slots are normalized by the pre-existing v3 importer.
    assert.equal(privateSet.subquestions[0].question_style,'standard');
    assert.deepEqual(privateSet.subquestions[0].topic_ids,['02','01']);assert.deepEqual(privateSet.shared_context.facts,[]);
    const publicSet=await scalar<{subquestions:Array<{question_style:string;topic_ids:string[]}>;max_points:number}>(db,'cpa_get_public_question_version($1)',[version]);
    assert.equal(publicSet.subquestions.length,1);assert.equal(publicSet.max_points,1);
    assert.equal(publicSet.subquestions[0].question_style,'standard');assert.deepEqual(publicSet.subquestions[0].topic_ids,['02','01']);
    assert.doesNotMatch(JSON.stringify(publicSet),/model_answer|source_quote|critical_facts/);
    const hash=await scalar<string>(db,'(select content_hash from cpa_question_set_versions where id=$1)',[version]);
    const input:{release_id:string;topics:typeof topics;entries:Entry[]}={release_id:bank.release_id,topics,entries:[{set_id:set.id,subquestion_id:'sub1',source_content_hash:hash,
      question_style:'standard',topic_ids:['01','02'],standalone_prompt:set.subquestions[0].prompt,case_fact_ids:[]}]};
    const rows=await importClassifications(db,input);assert.equal(rows[0].case_set_id,null);
    // Changing external learning metadata must not rewrite the authored source.
    input.entries[0].standalone_prompt='외부 학습 발문';await importClassifications(db,input);
    assert.deepEqual(await scalar(db,'cpa_get_question_version($1)',[version]),privateSet);
    await assert.rejects(db.query("update cpa_subquestion_versions set authored_question_style='case' where set_version_id=$1",[version]),/immutable/);
    input.entries[0].question_style='case';input.entries[0].standalone_prompt=null;
    await assert.rejects(importClassifications(db,input),/requires parent facts/);
  } finally {await db.close();}
});

test('atomic bank-and-catalog RPC rolls back an unclassified release and exposes a new standalone question completely',async()=>{
  const db=await createLearningUnitsDatabase();
  try {
    const oldSet=sampleQuestionSet();const oldBank=await importQuestionBank(db,[oldSet]);
    const oldInput=await classificationPayload(db,oldBank);await importClassifications(db,oldInput);
    const beforeBank=await scalar(db,'cpa_get_active_question_bank()');
    const fresh=sampleQuestionSet('pilot-02-new-standard');fresh.subquestions=[fresh.subquestions[0]];fresh.learning_order=['sub1'];
    fresh.shared_context.facts=[];fresh.subquestions[0].prompt='새 독립 물음의 원칙을 설명하시오.';
    fresh.subquestions[0].question_style='standard';fresh.subquestions[0].topic_ids=['01','02'];
    const oldEntries=oldInput.entries.map(({source_content_hash: omitted,...e})=>{assert.ok(omitted);return e;});
    const input={...questionBankPayload([oldSet,fresh]),learning_topics:topics,learning_classifications:[...oldEntries,
      {set_id:fresh.id,subquestion_id:'sub1',question_style:'standard',topic_ids:['01','02'],standalone_prompt:fresh.subquestions[0].prompt,case_fact_ids:[]}]};
    await db.exec('set role service_role');
    const incomplete={...input,learning_classifications:oldEntries};
    await assert.rejects(scalar(db,'cpa_import_learning_question_bank($1)',[JSON.stringify(incomplete)]),/Complete release classification coverage/);
    for (const mutate of [
      (p:typeof input)=>{p.learning_classifications[2].question_style='case';p.learning_classifications[2].standalone_prompt=null;},
      (p:typeof input)=>{p.learning_classifications[2].topic_ids=['01'];},
      (p:typeof input)=>{p.learning_classifications[2].standalone_prompt='다른 원문처럼 가장한 발문';},
    ]) {const invalid=structuredClone(input);mutate(invalid);
      await assert.rejects(scalar(db,'cpa_import_learning_question_bank($1)',[JSON.stringify(invalid)]),/differs from authored/);}
    assert.deepEqual(await scalar(db,'cpa_get_active_question_bank()'),beforeBank);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_question_bank_releases)'),1);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_question_sets where id=$1)',[fresh.id]),0);
    const result=await scalar<ImportedQuestionBank & {learning_classification_count:number}>(db,'cpa_import_learning_question_bank($1)',[JSON.stringify(input)]);
    assert.equal(result.set_count,2);assert.equal(result.learning_classification_count,3);
    const rows=await scalar<Classification[]>(db,'cpa_get_learning_classifications($1)',[result.release_id]);
    const standalone=rows.find(r=>r.source_set_id===fresh.id)!;assert.ok(standalone);assert.equal(standalone.case_set_id,null);
    assert.equal(standalone.standalone_prompt,fresh.subquestions[0].prompt);assert.deepEqual(standalone.topic_ids,['01','02']);
    assert.equal((await scalar<typeof result>(db,'cpa_import_learning_question_bank($1)',[JSON.stringify(input)])).reused,true);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(scalar(db,'cpa_import_learning_question_bank($1)',[JSON.stringify(input)]),/permission denied/);
  } finally {await db.close();}
});

test('source importer rejects inconsistent native learning contracts before any publication',async()=>{
  const db=await createLearningUnitsDatabase();
  try {
    const valid=sampleQuestionSet();valid.subquestions.forEach(q=>{q.question_style='case';q.topic_ids=['01'];});
    for (const mutate of [
      (s:typeof valid)=>{s.shared_context.facts=[];},
      (s:typeof valid)=>{s.subquestions.forEach(q=>{q.question_style='standard';});},
      (s:typeof valid)=>{s.subquestions[1].question_style='standard';},
      (s:typeof valid)=>{delete s.subquestions[0].topic_ids;},
      (s:typeof valid)=>{delete s.subquestions[0].question_style;},
      (s:typeof valid)=>{delete s.subquestions[1].question_style;delete s.subquestions[1].topic_ids;},
      (s:typeof valid)=>{s.subquestions[0].topic_ids=['99'];},
      (s:typeof valid)=>{s.subquestions[0].topic_ids=[];},
    ]) {const invalid=structuredClone(valid);mutate(invalid);await assert.rejects(importQuestionBank(db,[invalid]));
      assert.equal(await scalar(db,'(select count(*)::int from cpa_question_bank_releases)'),0);
      assert.equal(await scalar(db,'(select count(*)::int from cpa_question_set_versions)'),0);}
    const bank=await importQuestionBank(db,[valid]);assert.equal(bank.set_count,1);
    const privateSet=await scalar<typeof valid>(db,'cpa_get_question_version($1)',[bank.question_versions[0].set_version_id]);
    assert.ok(privateSet.subquestions.every(q=>q.question_style==='case' && q.topic_ids?.[0]==='01'));
  } finally {await db.close();}
});

test('selection rejects mixed styles, order/version swaps, outside answers and changes to frozen attempt children',async()=>{
  const {db,bank,rows}=await setup();
  try {
    const p=await submission(db,bank,[rows[0]]);
    const bad=[{...p,selected_subquestion_ids:[]},{...p,classification_version_ids:[]},
      {...p,selected_subquestion_ids:['sub1','sub1'],classification_version_ids:[rows[0].classification_version_id,rows[0].classification_version_id]},
      {...p,classification_version_ids:[rows[1].classification_version_id]},
      {...p,answers:allAnswers},{...p,learning_unit_id:'wrong'},
      await submission(db,bank,rows)];
    for(const invalid of bad)await assert.rejects(begin(db,invalid));
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempts)'),0);
    const a=await begin(db,p);
    await assert.rejects(db.query('update cpa_attempt_learning_selections set selected_subquestion_ids=$2 where attempt_id=$1',[a.attempt_id,['sub2']]),/immutable/);
    await assert.rejects(db.query('delete from cpa_attempt_learning_questions where attempt_id=$1',[a.attempt_id]),/immutable/);
    await assert.rejects(db.query('insert into cpa_attempt_answers values($1,$2,$3,$4)',[a.attempt_id,bank.question_versions[0].set_version_id,rows[1].source_subquestion_version_id,'extra']),/outside frozen/);
    await assert.rejects(db.query('delete from cpa_attempt_learning_selections where attempt_id=$1',[a.attempt_id]),/immutable/);
  } finally {await db.close();}
});

// The public learning UI issues the entire case group. This service-only RPC
// capability remains selection-aware for internal callers with signed scope.
test('internal case selections preserve explicit order, support subset scoring and create review records only for graded failures',async()=>{
  const {db,bank,rows}=await setup(['case','case']);
  try {
    const p=await submission(db,bank,[rows[1],rows[0]]);const a=await begin(db,p);
    await assert.rejects(begin(db,{...p,selected_subquestion_ids:[...p.selected_subquestion_ids!].reverse(),classification_version_ids:[...p.classification_version_ids!].reverse()}),/key conflict/);
    const run=await claim(db,a);const saved=await complete(db,a,run,grade(['sub1','sub2']));
    assert.deepEqual(saved.result.subquestions.map(q=>q.subquestion_id),['sub2','sub1']);
    const partial=await begin(db,await submission(db,bank,[rows[1]]));const partialRun=await claim(db,partial);
    const failed=await complete(db,partial,partialRun,grade(['sub2'],false));
    assert.equal(failed.result.max_points,1);assert.equal(failed.result.score,0);
    const notes=await scalar<Array<{subquestion_id:string}>>(db,'cpa_get_review_items($1)',[memberId]);assert.equal(notes.length,1);
    const expected=await scalar<string>(db,'(select subquestion_id from cpa_subquestion_versions where id=$1)',[rows[1].source_subquestion_version_id]);
    assert.equal(notes[0].subquestion_id,expected);
  } finally {await db.close();}
});

test('selected completion retains quote/security/points rollback and unchanged membership and browser-role boundaries',async()=>{
  const {db,bank,rows}=await setup();
  try {
    const p=await submission(db,bank,[rows[0]]);const a=await begin(db,p);const run=await claim(db,a);
    for(const mutate of [
      (r:QuestionSetGradeResultV3)=>{r.subquestions[0].criteria[0].quote='absent';},
      (r:QuestionSetGradeResultV3)=>{r.subquestions[0].criteria[0].awarded_points=0;},
      (r:QuestionSetGradeResultV3)=>{r.subquestions[0].criteria[0].verdict='partial';},
      (r:QuestionSetGradeResultV3)=>{r.security_flag='injection';},
    ]) {const bad=grade(['sub1']);mutate(bad);await assert.rejects(complete(db,a,run,bad));}
    assert.equal(await scalar(db,'(select count(*)::int from cpa_criterion_grade_results)'),0);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_review_items)'),0);
    assert.equal(await scalar(db,"(select count(*)::int from cpa_xp_events where event_type='submission_award')"),0);
    await assert.rejects(begin(db,{...p,membership_version:2}),/STALE_MEMBERSHIP/);
    await assert.rejects(begin(db,{...p,membership_version:null}),/MEMBERSHIP_VERSION_REQUIRED/);
    await scalar(db,'common_withdraw_service($1,$2,$3)',[memberId,'cpa',1]);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempt_learning_questions)'),0);
    assert.equal(await scalar(db,'(select count(*)::int from cpa_attempt_learning_selections)'),0);
    await scalar(db,'common_join_service($1,$2)',[memberId,'cpa']);
    await assert.rejects(begin(db,p),/STALE_MEMBERSHIP/);
    await assert.rejects(claim(db,a),/Attempt not found/);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      for(const table of ['cpa_learning_questions','cpa_learning_question_versions','cpa_learning_topics','cpa_learning_question_topics','cpa_attempt_learning_selections','cpa_attempt_learning_questions'])
        await assert.rejects(db.query(`select * from ${table}`),/permission denied/);
      await assert.rejects(scalar(db,'cpa_get_learning_classifications($1)',[bank.release_id]),/permission denied/);
      await assert.rejects(begin(db,p),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await scalar<Classification[]>(db,'cpa_get_learning_classifications($1)',[bank.release_id])).length,2);
    await assert.rejects(scalar(db,'common_legacy_cpa_begin_attempt($1)',[JSON.stringify(p)]),/permission denied/);
  } finally {await db.close();}
});
