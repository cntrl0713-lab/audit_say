import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compilePublicQuestionSet} from '../../../../../lib/questionV3.ts';
import type {QuestionSetV3} from '../../../../../lib/questionV3.ts';
import {contentHash} from '../../../../../lib/learningSubmission.ts';
import {learningCatalogForBank} from '../../../../../scripts/import-question-bank-v3.ts';
import {prepareExpected,evaluateLive,storageProjection,collectLive,readRpc,verificationQuery,sha} from './verify-final-learning-rollout.ts';
import type {Live,AppliedEvidence} from './verify-final-learning-rollout.ts';

const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){
 const original=JSON.parse(fs.readFileSync('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/canonical-before.json','utf8')) as QuestionSetV3[];
 const sets=[structuredClone(original[0]),structuredClone(original[0])];sets[0].id='postcheck-case-fixture';sets[1].id='postcheck-standard-fixture';
 for(const [si,s]of sets.entries())for(const q of s.subquestions){q.question_style=si===0?'case':'standard';q.topic_ids=si===0?['01','02']:['02'];}
 sets[1].shared_context.facts=[];
 const topics=[{id:'02',title:'topic two',part:'PART1',position:1},{id:'01',title:'topic one',part:'PART1',position:2}];
 const catalog={topics,classifications:[]};const bankText=JSON.stringify(sets,null,2)+'\n';
 const evidence:AppliedEvidence={applied:true,release_id:id(1),project_host:'abcdefghijklmnopqrst.supabase.co',source_file_hash:sha(bankText),bank_content_hash:contentHash({sets,applicability:{}}),public_content_hash:contentHash(sets.map(compilePublicQuestionSet))};
 const expected=prepareExpected(bankText,catalog,evidence);const migrationHash=sha('isolated migration fixture');
 const versions=sets.map((s,si)=>({id:id(2+si),set_id:s.id,content_hash:contentHash(s),sealed_at:'2026-09-11T00:00:00Z',position:si+1,subquestions:s.subquestions.map((q,qi)=>({id:id(10+si*10+qi),logical_id:id(30+si*10+qi),code:q.id,position:qi+1}))}));
 const classifications=learningCatalogForBank(sets,catalog).learning_classifications.map((r,i)=>{const v=versions.find(v=>v.set_id===r.set_id)!,sq=v.subquestions.find(q=>q.code===r.subquestion_id)!;return {learning_question_id:id(50+i),classification_version_id:id(60+i),source_set_id:r.set_id,source_set_version_id:v.id,source_content_hash:v.content_hash,source_subquestion_version_id:sq.id,subquestion_id:r.subquestion_id,question_style:r.question_style,case_set_id:r.question_style==='case'?r.set_id:null,topic_ids:[...r.topic_ids].sort(),standalone_prompt:r.standalone_prompt,case_fact_ids:r.case_fact_ids,content_hash:contentHash(r)};});
 const db={migration_source_sha256:migrationHash,active_releases:[{id:id(1),status:'active',published_at:'2026-09-11T00:00:00Z',source_document:bankText,source_file_hash:evidence.source_file_hash,bank_content_hash:evidence.bank_content_hash,public_content_hash:evidence.public_content_hash}],versions,topics,classification_versions:classifications.map(r=>({id:r.classification_version_id,learning_question_id:r.learning_question_id,logical_subquestion_id:versions.flatMap(v=>v.subquestions).find(q=>q.id===r.source_subquestion_version_id)!.logical_id,source_set_version_id:r.source_set_version_id,source_subquestion_version_id:r.source_subquestion_version_id,source_set_id:r.source_set_id,content_hash:r.content_hash,sealed_at:'2026-09-11T00:00:00Z'}))};
 const live:Live={database:db,after_database:structuredClone(db),active_classifications:classifications,private_versions:sets.map((s,i)=>({id:versions[i].id,question_set:storageProjection(s)})),active_public:sets.map((s,i)=>({release_id:id(1),set_version_id:versions[i].id,question_set:{...compilePublicQuestionSet(s),subquestions:compilePublicQuestionSet(s).subquestions.map((q,j)=>({...q,logical_subquestion_id:versions[i].subquestions[j].logical_id}))}}))};
 return {sets,expected,live,migrationHash,catalog,evidence,bankText};
}

test('counts derive from final inputs and all case questions/independent standards survive',()=>{
 const {expected,live,migrationHash}=fixture();const r=evaluateLive(expected,live,migrationHash);assert.deepEqual(r.failures,[]);assert.equal(r.status,'passed');assert.equal(expected.counts.sets,2);assert.equal(expected.counts.questions,4);assert.equal(expected.counts.learning_units,3);assert.equal(expected.counts.topic_links,6);
});
test('byte-identical source document is required even when JSON content matches',()=>{
 const {expected,live,migrationHash}=fixture();const release=(live.database.active_releases as Array<Record<string,unknown>>)[0];release.source_document=expected.bankText.trim();live.after_database=structuredClone(live.database);assert.ok(evaluateLive(expected,live,migrationHash).failures.includes('SOURCE_DOCUMENT_EXACT_UTF8_HASH'));
});
test('raw public leakage cannot be hidden by safe client projection',()=>{
 const {expected,live,migrationHash}=fixture();const env=live.active_public[0] as {question_set:Record<string,unknown>};env.question_set.model_answer=['synthetic private answer'];const r=evaluateLive(expected,live,migrationHash);assert.ok(r.failures.includes('NO_PRIVATE_FIELDS_IN_RAW_PUBLIC_PAYLOAD'));assert.ok(r.failures.includes('EXACT_RAW_PUBLIC_COMPILE_HASH'));
});
test('private criterion corruption is detected even if source document and public max points match',()=>{
 const {expected,live,migrationHash}=fixture();const q=live.private_versions[0].question_set as QuestionSetV3;q.subquestions[0].criteria[0].claim='synthetic corrupted rule';assert.ok(evaluateLive(expected,live,migrationHash).failures.some(s=>s.startsWith('EXACT_PRIVATE_STORAGE_PROJECTION:')));
});
test('missing case question or unrelated source lineage is rejected',()=>{
 for(const kind of ['missing','wrong-lineage']){const {expected,live,migrationHash}=fixture();if(kind==='missing'){const env=live.active_public[0] as {question_set:{subquestions:unknown[]}};env.question_set.subquestions.pop();}else{(live.active_classifications[0] as Record<string,unknown>).source_subquestion_version_id=id(999);}assert.equal(evaluateLive(expected,live,migrationHash).status,'failed');}
});
test('standard parent, standalone wording, topic and fact changes are rejected independently',()=>{
 for(const patch of [{case_set_id:'postcheck-standard-fixture'},{standalone_prompt:'altered standalone prompt'},{topic_ids:['01']},{case_fact_ids:['nonexistent']}]){const {expected,live,migrationHash}=fixture();Object.assign(live.active_classifications[2] as object,patch);assert.equal(evaluateLive(expected,live,migrationHash).status,'failed');}
});
test('active pointer or metadata changes during the read and wrong expected evidence are rejected',()=>{
 const {expected,live,migrationHash,bankText,catalog,evidence}=fixture();(live.after_database.topics as Array<Record<string,unknown>>)[0].title='changed in flight';assert.ok(evaluateLive(expected,live,migrationHash).failures.includes('ACTIVE_RELEASE_OR_METADATA_CHANGED_DURING_READ'));assert.throws(()=>prepareExpected(bankText,catalog,{...evidence,source_file_hash:'0'.repeat(64)}));
});
test('mock transport uses only literal read_only SELECT and allowed read RPCs; mutation calls never reach fetch',async()=>{
 const {live,migrationHash}=fixture();const calls:Array<{url:string;body:Record<string,unknown>}>=[];
 const fetcher:typeof fetch=async(input,init)=>{const url=String(input),body=JSON.parse(String(init?.body)) as Record<string,unknown>;calls.push({url,body});let payload:unknown;if(url.includes('/database/query')){assert.equal(body.read_only,true);assert.equal(body.query,verificationQuery);payload=[{verification:live.database}];}else if(url.endsWith('cpa_get_active_question_bank'))payload=live.active_public;else if(url.endsWith('cpa_get_learning_classifications'))payload=live.active_classifications;else if(url.endsWith('cpa_get_question_version'))payload=live.private_versions.find(v=>v.id===body.p_version_id)!.question_set;else throw new Error('unexpected request');return new Response(JSON.stringify(payload),{status:200});};
 const fetched=await collectLive(fetcher,new URL('https://abcdefghijklmnopqrst.supabase.co'),'abcdefghijklmnopqrst','fake-management','fake-service',migrationHash);assert.equal(fetched.private_versions.length,2);assert.equal(calls.length,6);assert.equal(calls.filter(c=>c.body.read_only===true).length,2);
 await assert.rejects(readRpc(fetcher,new URL('https://abcdefghijklmnopqrst.supabase.co'),'fake','cpa_import_question_bank' as never,{}),/MUTATION_RPC_NOT_ALLOWED/);assert.equal(calls.length,6);
 assert.ok(!/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|cpa_attempts|cpa_attempt_answers|cpa_grading_runs|cpa_xp_events)\b/iu.test(verificationQuery));
});
