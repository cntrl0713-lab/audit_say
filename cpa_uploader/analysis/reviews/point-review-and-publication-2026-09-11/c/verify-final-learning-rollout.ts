import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {learningCatalogForBank,inspectBankSnapshot} from '../../../../../scripts/import-question-bank-v3.ts';
import {compilePublicQuestionSet} from '../../../../../lib/questionV3.ts';
import type {QuestionSetV3} from '../../../../../lib/questionV3.ts';
import {contentHash} from '../../../../../lib/learningSubmission.ts';
import {publicLearningSet} from '../../../../../lib/learningPublic.ts';
import {buildLearningUnits,validateLearningClassification} from '../../../../../lib/learningUnits.ts';
import type {LearningClassification,LearningTopic} from '../../../../../lib/learningUnits.ts';

type Row=Record<string,unknown>;
export class VerificationError extends Error { constructor(readonly code:string){super(code);} }
export const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const obj=(x:unknown):Row=>{if(!x||typeof x!=='object'||Array.isArray(x))throw new VerificationError('INVALID_OBJECT');return x as Row;};
const array=(x:unknown):unknown[]=>{if(!Array.isArray(x))throw new VerificationError('INVALID_ARRAY');return x;};
const text=(x:unknown):string=>{if(typeof x!=='string')throw new VerificationError('INVALID_STRING');return x;};
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(s);
const digest=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{64}$/u.test(s);
const sorted=(x:string[])=>[...x].sort();
const equal=(a:unknown,b:unknown)=>contentHash(a)===contentHash(b);
const countPoints=(sets:QuestionSetV3[])=>sets.reduce((n,s)=>n+s.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0),0);
export const readRpcNames=['cpa_get_active_question_bank','cpa_get_learning_classifications','cpa_get_question_version'] as const;
type ReadRpc=typeof readRpcNames[number];

/** Literal SELECT only. There is no user-supplied SQL and no attempt/user/answer table is read. */
export const verificationQuery=`with active as (
 select id,status,published_at,source_document,source_file_hash,bank_content_hash,public_content_hash
 from public.cpa_question_bank_releases where status='active'
), items as (
 select ri.* from public.cpa_question_bank_release_items ri join active a on a.id=ri.release_id
)
select jsonb_build_object(
 'migration_source_sha256',(select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations where version='20260911030000'),
 'active_releases',coalesce((select jsonb_agg(to_jsonb(a) order by id) from active a),'[]'),
 'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'set_id',v.set_id,'content_hash',v.content_hash,'sealed_at',v.sealed_at,'position',i.position,
   'subquestions',(select jsonb_agg(jsonb_build_object('id',sq.id,'logical_id',s.id,'code',s.code,'position',sq.position) order by sq.position)
     from public.cpa_subquestion_versions sq join public.cpa_subquestions s on s.id=sq.subquestion_id where sq.set_version_id=v.id)) order by i.position)
   from items i join public.cpa_question_set_versions v on v.id=i.set_version_id),'[]'),
 'classification_versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'learning_question_id',v.learning_question_id,
   'logical_subquestion_id',l.source_subquestion_id,'source_set_version_id',v.source_set_version_id,'source_subquestion_version_id',v.source_subquestion_version_id,
   'source_set_id',v.source_set_id,'content_hash',v.content_hash,'sealed_at',v.sealed_at) order by v.id)
   from public.cpa_learning_question_versions v join public.cpa_learning_questions l on l.id=v.learning_question_id
   where exists(select 1 from items i where i.set_version_id=v.source_set_version_id)),'[]'),
 'topics',coalesce((select jsonb_agg(to_jsonb(t) order by position) from public.cpa_learning_topics t),'[]')
) as verification`;

export interface AppliedEvidence {applied:boolean;release_id:string;project_host:string;source_file_hash:string;bank_content_hash:string;public_content_hash:string}
export interface Expected {
 bankText:string;sets:QuestionSetV3[];compiled:ReturnType<typeof compilePublicQuestionSet>[];
 catalog:ReturnType<typeof learningCatalogForBank>;evidence:AppliedEvidence;applicability:unknown;
 hashes:{source_file:string;bank_content:string;public_content:string};
 counts:{sets:number;questions:number;criteria:number;points:number;standard_questions:number;case_questions:number;case_parents:number;learning_units:number;topic_links:number;topics:number};
}
export function prepareExpected(bankText:string,catalog:{topics:LearningTopic[];classifications:LearningClassification[]},evidence:AppliedEvidence,applicability:unknown={}):Expected{
 const sets=JSON.parse(bankText) as QuestionSetV3[];
 if(!Array.isArray(sets)||sets.length===0)throw new VerificationError('EMPTY_FINAL_BANK');
 const compiled=sets.map(compilePublicQuestionSet);
 const checked=inspectBankSnapshot(bankText,JSON.stringify(compiled),{applicability,verifySourceQuotes:false});
 if(!checked.report.ready)throw new VerificationError('FINAL_BANK_NOT_READY');
 const topicIds=catalog.topics.map(t=>t.id),positions=catalog.topics.map(t=>t.position);
 if(new Set(topicIds).size!==topicIds.length||new Set(positions).size!==positions.length||catalog.topics.some(t=>!/^\d{2}$/u.test(t.id)||!t.title||!t.part||!Number.isSafeInteger(t.position)))throw new VerificationError('INVALID_TOPIC_CATALOG');
 const compiledCatalog=learningCatalogForBank(sets,catalog),rows=compiledCatalog.learning_classifications;
 for(const r of rows){const set=sets.find(s=>s.id===r.set_id)!;
  if(r.question_style==='case'&&(!set.shared_context.facts.length||r.standalone_prompt!==null))throw new VerificationError('CASE_PARENT_REQUIRED');
  if(r.question_style==='standard'&&(!r.standalone_prompt?.trim()||r.case_fact_ids.length))throw new VerificationError('STANDARD_MUST_STAND_ALONE');
  if(new Set(r.case_fact_ids).size!==r.case_fact_ids.length||r.case_fact_ids.some(id=>!set.shared_context.facts.some(f=>f.id===id)))throw new VerificationError('INVALID_CASE_FACT_ID');
 }
 const hashes={source_file:sha(bankText),bank_content:contentHash({sets,applicability}),public_content:contentHash(compiled)};
 if(evidence.applied!==true||!uuid(evidence.release_id)||!evidence.project_host
   ||evidence.source_file_hash!==hashes.source_file||evidence.bank_content_hash!==hashes.bank_content||evidence.public_content_hash!==hashes.public_content)throw new VerificationError('APPLIED_EVIDENCE_DOES_NOT_MATCH_FINAL_INPUT');
 const standard=rows.filter(r=>r.question_style==='standard').length,cases=rows.filter(r=>r.question_style==='case');
 const caseParents=new Set(cases.map(r=>r.set_id)).size;
 return {bankText,sets,compiled,catalog:compiledCatalog,evidence,applicability,hashes,counts:{sets:sets.length,questions:rows.length,criteria:sets.reduce((n,s)=>n+s.subquestions.reduce((n,q)=>n+q.criteria.length,0),0),points:countPoints(sets),standard_questions:standard,case_questions:cases.length,case_parents:caseParents,learning_units:standard+caseParents,topic_links:rows.reduce((n,r)=>n+r.topic_ids.length,0),topics:catalog.topics.length}};
}

/** Mirrors the DB private DTO's documented optional-null cleanup and absent slots default, not a content filter. */
export function storageProjection(set:QuestionSetV3):unknown{
 const strip=(x:unknown):unknown=>Array.isArray(x)?x.map(strip):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([,v])=>v!==null).map(([k,v])=>[k,strip(v)])):x;
 const result=obj(strip(set));result.subquestions=array(result.subquestions).map(v=>{const q=obj(v);q.answer_slots??=[];obj(q.constraints).max_entries=null;obj(q.selection).n=null;return q;});return result;
}
function publicProjection(envelope:unknown):unknown{
 const e=obj(envelope);if(Object.keys(e).some(k=>!['release_id','set_version_id','question_set'].includes(k)))throw new VerificationError('UNEXPECTED_PUBLIC_ENVELOPE_FIELD');
 const q=structuredClone(obj(e.question_set));q.subquestions=array(q.subquestions).map(x=>{const sub={...obj(x)};delete sub.logical_subquestion_id;return sub;});return q;
}
function privateFields(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const forbidden=new Set(['model_answer','criteria','requirements','critical_facts','source_quote','source_refs','decision_correct','user_answer','api_key']);
 return Object.entries(value).some(([k,v])=>forbidden.has(k)||privateFields(v));
}
function unitProjection(unit:Row):unknown{
 const copy=structuredClone(unit);for(const k of ['release_id','set_version_id','classification_version_ids'])delete copy[k];
 copy.subquestions=array(copy.subquestions).map(x=>{const s={...obj(x)};for(const k of ['logical_subquestion_id','learning_question_id','classification_version_id'])delete s[k];if(Array.isArray(s.topic_ids))s.topic_ids=sorted(s.topic_ids as string[]);return s;});return copy;
}
export interface Live {database:Row;active_public:unknown[];active_classifications:unknown[];private_versions:Array<{id:string;question_set:unknown}>;after_database:Row}
function evaluateLiveStrict(expected:Expected,live:Live,migrationHash:string){
 const failures:string[]=[];const check=(ok:boolean,label:string)=>{if(!ok)failures.push(label);};
 const db=live.database;check(equal(db,live.after_database),'ACTIVE_RELEASE_OR_METADATA_CHANGED_DURING_READ');
 check(db.migration_source_sha256===migrationHash,'INSTALLED_MIGRATION_HASH');
 const releases=array(db.active_releases).map(obj),versions=array(db.versions).map(obj),storedClass=array(db.classification_versions).map(obj),topics=array(db.topics) as LearningTopic[];
 check(releases.length===1,'EXACTLY_ONE_ACTIVE_RELEASE');const release=releases[0];
 if(!release)return {status:'failed',failures,expected:expected.counts};
 check(release.id===expected.evidence.release_id&&release.status==='active'&&Boolean(release.published_at),'ACTIVE_RELEASE_ID_AND_SEAL');
 check(release.source_document===expected.bankText&&sha(text(release.source_document))===expected.hashes.source_file&&release.source_file_hash===expected.hashes.source_file,'SOURCE_DOCUMENT_EXACT_UTF8_HASH');
 check(release.bank_content_hash===expected.hashes.bank_content&&release.public_content_hash===expected.hashes.public_content,'RELEASE_CONTENT_HASHES');
 check(versions.length===expected.counts.sets&&new Set(versions.map(v=>v.set_id)).size===expected.counts.sets,'ACTIVE_SOURCE_SET_COUNT');
 check(equal(topics,[...expected.catalog.learning_topics].sort((a,b)=>a.position-b.position)),'EXACT_TOPIC_CATALOG');
 check(live.active_public.length===expected.counts.sets,'ACTIVE_PUBLIC_SET_COUNT');
 check(!privateFields(live.active_public),'NO_PRIVATE_FIELDS_IN_RAW_PUBLIC_PAYLOAD');
 check(equal(live.active_public.map(publicProjection),expected.compiled),'EXACT_RAW_PUBLIC_COMPILE_HASH');
 check(live.private_versions.length===expected.counts.sets&&new Set(live.private_versions.map(v=>v.id)).size===expected.counts.sets,'PRIVATE_SOURCE_VERSION_COUNT');
 const documents=expected.sets.map((s,index)=>{
  const v=versions.find(v=>v.set_id===s.id),pub=live.active_public[index]?obj(live.active_public[index]):undefined;
  check(Boolean(v&&v.sealed_at&&Number(v.position)===index+1),'SEALED_SOURCE_VERSION:'+s.id);
  check(Boolean(v&&pub&&pub.release_id===release.id&&pub.set_version_id===v.id),'PUBLIC_RELEASE_VERSION_BINDING:'+s.id);
  if(v&&pub){const pq=obj(pub.question_set);for(const q of array(pq.subquestions).map(obj)){
   const stored=array(v.subquestions).map(obj).find(x=>x.code===q.id);check(Boolean(stored&&q.logical_subquestion_id===stored.logical_id),'PUBLIC_LOGICAL_QUESTION_BINDING:'+s.id+'/'+String(q.id));
  }}
  const actual=v?live.private_versions.find(x=>x.id===v.id)?.question_set:undefined;
  const expectedPrivate=storageProjection(s),privateHash=actual===undefined?null:contentHash(actual);
  check(actual!==undefined&&equal(actual,expectedPrivate),'EXACT_PRIVATE_STORAGE_PROJECTION:'+s.id);
  return {set_id:s.id,source_version_id:v?.id??null,expected_storage_payload_hash:contentHash(expectedPrivate),actual_storage_payload_hash:privateHash,expected_public_payload_hash:contentHash(expected.compiled[index]),actual_public_payload_hash:pub?contentHash(publicProjection(pub)):null};
 });
 check(live.active_classifications.length===expected.counts.questions,'ACTIVE_CLASSIFICATION_COUNT');
 const rows=live.active_classifications.map(validateLearningClassification),seen=new Set<string>();
 for(const r of rows){const key=r.source_set_id+'/'+r.subquestion_id;check(!seen.has(key),'DUPLICATE_CLASSIFICATION:'+key);seen.add(key);
  const want=expected.catalog.learning_classifications.find(x=>x.set_id===r.source_set_id&&x.subquestion_id===r.subquestion_id);
  const v=versions.find(v=>v.set_id===r.source_set_id),sq=v?array(v.subquestions).map(obj).find(q=>q.code===r.subquestion_id):undefined;
  const sealed=storedClass.find(x=>x.id===r.classification_version_id);
  check(Boolean(v&&sq&&sealed&&sealed.sealed_at&&r.source_set_version_id===v.id&&r.source_content_hash===v.content_hash&&r.source_subquestion_version_id===sq.id&&sealed.logical_subquestion_id===sq.logical_id
    &&sealed.learning_question_id===r.learning_question_id&&sealed.source_set_version_id===v.id&&sealed.source_set_id===r.source_set_id&&sealed.source_subquestion_version_id===sq.id&&sealed.content_hash===r.content_hash&&digest(r.content_hash)),'SEALED_CLASSIFICATION_LINEAGE:'+key);
  check(Boolean(want&&r.question_style===want.question_style&&r.case_set_id===(want.question_style==='case'?want.set_id:null)&&r.standalone_prompt===want.standalone_prompt&&equal(sorted(r.topic_ids),sorted(want.topic_ids))&&equal(sorted(r.case_fact_ids??[]),sorted(want.case_fact_ids))),'EXACT_CLASSIFICATION_CONTENT:'+key);
 }
 const projected=live.active_public.map(publicLearningSet),units=buildLearningUnits(projected,rows,topics);
 const expectedRows=expected.catalog.learning_classifications.map(r=>validateLearningClassification({learning_question_id:'expected:'+r.set_id+'/'+r.subquestion_id,classification_version_id:'expected:'+r.set_id+'/'+r.subquestion_id,source_set_id:r.set_id,source_set_version_id:'expected:'+r.set_id,source_subquestion_version_id:'expected:'+r.set_id+'/'+r.subquestion_id,subquestion_id:r.subquestion_id,question_style:r.question_style,case_set_id:r.question_style==='case'?r.set_id:null,topic_ids:sorted(r.topic_ids),standalone_prompt:r.standalone_prompt,case_fact_ids:r.case_fact_ids,content_hash:'expected'}));
 const expectedUnits=buildLearningUnits(expected.compiled,expectedRows,expected.catalog.learning_topics);
 check(units.length===expected.counts.learning_units,'DERIVED_LEARNING_UNIT_COUNT');
 const byId=(a:Row,b:Row)=>String(a.id).localeCompare(String(b.id));
 check(equal(units.map(u=>unitProjection(u as unknown as Row)).sort((a,b)=>byId(obj(a),obj(b))),expectedUnits.map(u=>unitProjection(u as unknown as Row)).sort((a,b)=>byId(obj(a),obj(b)))),'EXACT_LEARNING_UNIT_PAYLOAD_HASH');
 for(const u of units){
  const wanted=expectedRows.filter(r=>r.source_set_id===u.source_set_id&&r.question_style===u.question_style&&(u.question_style==='case'||u.subquestions.some(q=>q.id===r.subquestion_id)));
  check(u.subquestions.every(q=>q.question_style===u.question_style),'NO_MIXED_STYLE_UNIT:'+u.id);
  check(u.question_style==='case'?u.case_set_id===u.source_set_id&&u.shared_context.facts.length>0&&equal(sorted(u.subquestions.map(q=>q.id)),sorted(wanted.map(r=>r.subquestion_id))):u.case_set_id===null&&u.shared_context.facts.length===0&&u.subquestions.length===1&&u.subquestions[0].prompt===wanted[0]?.standalone_prompt,'COMPLETE_CASE_OR_STANDALONE_STANDARD:'+u.id);
 }
 return {status:failures.length?'failed':'passed',failures,expected:expected.counts,actual:{sets:versions.length,questions:rows.length,standard_questions:rows.filter(r=>r.question_style==='standard').length,case_questions:rows.filter(r=>r.question_style==='case').length,learning_units:units.length,points:units.reduce((n,u)=>n+u.max_points,0),topics:topics.length,topic_links:rows.reduce((n,r)=>n+r.topic_ids.length,0)},documents,hashes:{expected_source_file:expected.hashes.source_file,expected_bank_content:expected.hashes.bank_content,expected_public_payload:expected.hashes.public_content,actual_public_payload:contentHash(live.active_public.map(publicProjection)),actual_classification_payload:contentHash(rows),actual_learning_unit_payload:contentHash(units.map(u=>unitProjection(u as unknown as Row))),database_snapshot:contentHash(db)}};
}
export function evaluateLive(expected:Expected,live:Live,migrationHash:string){
 try{return evaluateLiveStrict(expected,live,migrationHash);}
 catch(error){return {status:'failed',failures:[error instanceof VerificationError?error.code:'MALFORMED_REMOTE_PAYLOAD_OR_LEARNING_BINDING'],expected:expected.counts};}
}

export async function readRpc(fetcher:typeof fetch,endpoint:URL,key:string,name:ReadRpc,payload:unknown):Promise<unknown>{
 if(!(readRpcNames as readonly string[]).includes(name))throw new VerificationError('MUTATION_RPC_NOT_ALLOWED');
 const response=await fetcher(`${endpoint.origin}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new VerificationError('READ_RPC_FAILED_'+response.status);return response.json();
}
export async function collectLive(fetcher:typeof fetch,endpoint:URL,project:string,managementToken:string,serviceKey:string,expectedMigrationHash:string):Promise<Live>{
 if(endpoint.protocol!=='https:'||endpoint.hostname!==`${project}.supabase.co`||endpoint.port||endpoint.username||endpoint.password||! /^[a-z0-9]{20}$/u.test(project))throw new VerificationError('PROJECT_HOST_MISMATCH');
 const inspect=async()=>{const r=await fetcher(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${managementToken}`,'Content-Type':'application/json'},body:JSON.stringify({query:verificationQuery,read_only:true}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new VerificationError('READ_ONLY_QUERY_FAILED_'+r.status);const body=array(await r.json());const db=obj(obj(body[0]).verification);if(db.migration_source_sha256!==expectedMigrationHash)throw new VerificationError('INSTALLED_MIGRATION_HASH');return db;};
 const database=await inspect(),releases=array(database.active_releases).map(obj);if(releases.length!==1||!uuid(text(releases[0].id)))throw new VerificationError('ACTIVE_RELEASE_ID_REQUIRED');
 const releaseId=text(releases[0].id);
 const active_public=array(await readRpc(fetcher,endpoint,serviceKey,'cpa_get_active_question_bank',{}));
 const active_classifications=array(await readRpc(fetcher,endpoint,serviceKey,'cpa_get_learning_classifications',{p_release_id:releaseId,p_classification_version_ids:null}));
 const private_versions:Array<{id:string;question_set:unknown}>=[];
 // Sequential bounded read stream; no write, user submission, grading, retry or reset API.
 for(const v of array(database.versions).map(obj)){const id=text(v.id);if(!uuid(id))throw new VerificationError('INVALID_SOURCE_VERSION_ID');private_versions.push({id,question_set:await readRpc(fetcher,endpoint,serviceKey,'cpa_get_question_version',{p_version_id:id})});}
 const after_database=await inspect();return {database,active_public,active_classifications,private_versions,after_database};
}
export async function main(args=process.argv.slice(2)){
 const flags=new Set(['--read-live']);
 const values=new Set(['--bank','--learning-catalog','--evidence','--expected-bank-sha256','--expected-catalog-sha256','--expected-evidence-sha256','--applicability','--expected-applicability-sha256','--migration','--expected-migration-sha256','--expected-project','--output']);
 const options=new Map<string,string>();for(let i=0;i<args.length;i++){const k=args[i];if(flags.has(k)){if(options.has(k))throw new VerificationError('DUPLICATE_ARGUMENT');options.set(k,'true');continue;}if(!values.has(k)||options.has(k)||!args[i+1]||args[i+1].startsWith('--'))throw new VerificationError('INVALID_ARGUMENT');options.set(k,args[++i]);}
 const need=(key:string)=>{const v=options.get(key);if(!v)throw new VerificationError('MISSING_'+key.slice(2).toUpperCase());return v;};
 const inputs:Array<{file:string;sha256:string}>=[];
 const load=(key:string,hashKey:string)=>{const file=path.resolve(need(key)),bytes=fs.readFileSync(file),h=need(hashKey);if(!digest(h)||sha(bytes)!==h)throw new VerificationError('INPUT_HASH_MISMATCH');inputs.push({file,sha256:h});return bytes.toString('utf8');};
 const bank=load('--bank','--expected-bank-sha256'),catalog=JSON.parse(load('--learning-catalog','--expected-catalog-sha256')),evidence=JSON.parse(load('--evidence','--expected-evidence-sha256'));
 const applicability=options.has('--applicability')?JSON.parse(load('--applicability','--expected-applicability-sha256')):{};
 const expected=prepareExpected(bank,catalog,evidence,applicability);
 const output=path.resolve(need('--output'));if(fs.existsSync(output)||inputs.some(f=>f.file===output))throw new VerificationError('OUTPUT_EXISTS_OR_IS_INPUT');
 let report:Row={status:'prepared_not_executed',expected:expected.counts,expected_hashes:expected.hashes};
 let requestCount=0;
 if(options.has('--read-live')){
  const migrationText=load('--migration','--expected-migration-sha256');
  if(typeof process.loadEnvFile==='function'&&fs.existsSync('.env.local'))process.loadEnvFile('.env.local');
  const project=need('--expected-project'),endpoint=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'');
  if(evidence.project_host!==endpoint.hostname||endpoint.hostname!==`${project}.supabase.co`)throw new VerificationError('EVIDENCE_PROJECT_MISMATCH');
  const mt=process.env.SUPABASE_ACCESS_TOKEN,sk=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!mt||!sk)throw new VerificationError('READ_ONLY_CONNECTION_NOT_CONFIGURED');
  const fetcher:typeof fetch=async(input,init)=>{requestCount++;return fetch(input,init);};
  const live=await collectLive(fetcher,endpoint,project,mt,sk,sha(migrationText));report=evaluateLive(expected,live,sha(migrationText));
 }
 if(inputs.some(f=>sha(fs.readFileSync(f.file))!==f.sha256))throw new VerificationError('INPUT_CHANGED_DURING_READ');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const saved:Row={format:1,checked_at:new Date().toISOString(),...report,inputs,query_sha256:sha(verificationQuery),requests:requestCount,remote_write_queries:0,model_api_calls:0,note:'Read-only post-publication verification. No user attempts, answers, grading runs or XP records were selected or modified. Private source documents remained in memory; report contains hashes and identifiers only.'};
 fs.writeFileSync(output,JSON.stringify(saved,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,status:saved.status,expected:expected.counts,failures:report.failures??[],requests:requestCount,remote_write_queries:0,model_api_calls:0},null,2));if(saved.status==='failed')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error instanceof VerificationError?error.code:'LOCAL_INPUT_OR_RUNTIME_ERROR');process.exitCode=1;});
