import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14',O=R+'/retirement-history-verification-v1';
const mode=process.argv[2];assert(['--before','--after'].includes(mode));
const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];assert.equal(project,'xvifzicrjmbfqaepcfpp');assert(process.env.SUPABASE_ACCESS_TOKEN);
const read=f=>JSON.parse(fs.readFileSync(f));const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
async function query(sql,parameters=[]){const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{
 method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},
 body:JSON.stringify({query:sql,parameters,read_only:true}),signal:AbortSignal.timeout(30000)});assert(response.ok,`Read-only verification failed HTTP ${response.status}`);return response.json();}
const tables={
 cpa_question_set_versions:['id','to_jsonb(t)'],cpa_subquestion_versions:['id','to_jsonb(t)'],
 cpa_subquestion_answers:['subquestion_version_id','to_jsonb(t)'],cpa_question_sources:['id','to_jsonb(t)'],
 cpa_requirements:['id','to_jsonb(t)'],cpa_criteria:['id','to_jsonb(t)'],cpa_criterion_facts:['id','to_jsonb(t)'],
 cpa_criterion_sources:["criterion_id::text||'/'||source_id::text",'to_jsonb(t)'],
 cpa_question_bank_release_items:["release_id::text||'/'||set_id",'to_jsonb(t)'],
 cpa_attempts:['id',"jsonb_build_object('id',id,'release_id',release_id,'set_version_id',set_version_id,'submission_key',submission_key,'answers_hash',answers_hash,'submitted_at',submitted_at)"],
 cpa_attempt_answers:["attempt_id::text||'/'||subquestion_version_id::text",'to_jsonb(t)'],
 cpa_question_bank_releases:['id',"jsonb_build_object('id',id,'source_document_hash',case when source_document is not null then encode(sha256(convert_to(source_document,'UTF8')),'hex') end,'source_file_hash',source_file_hash,'bank_content_hash',bank_content_hash,'public_content_hash',public_content_hash,'validation_report',validation_report)"]
};
async function tableSnapshot(table,keys=null){const[key,value]=tables[table];return(await query(`select coalesce(jsonb_agg(k order by k),'[]'::jsonb) as keys,count(*)::int as count,encode(sha256(convert_to(coalesce(jsonb_agg(v order by k),'[]'::jsonb)::text,'UTF8')),'hex') as rows_sha256 from (select (${key})::text as k,${value} as v from public.${table} t) rows where $1::jsonb is null or k in(select jsonb_array_elements_text(coalesce($1::jsonb,'[]'::jsonb)))`,[keys===null?null:JSON.stringify(keys)]))[0];}
async function active(){return(await query(`select jsonb_build_object('release_id',r.id,'source_file_hash',r.source_file_hash,'source_document_sha256',encode(sha256(convert_to(r.source_document,'UTF8')),'hex'),'retirement_authorization',r.validation_report->'retirement_authorization','items',(select jsonb_agg(jsonb_build_object('set_id',i.set_id,'set_version_id',i.set_version_id) order by i.position) from public.cpa_question_bank_release_items i where i.release_id=r.id)) as active from public.cpa_question_bank_releases r where r.status='active'`))[0].active;}
if(mode==='--before'){
 assert(!fs.existsSync(O));const plan=read(R+'/retirement-plan.json'),a=await active();
 assert.equal(a.release_id,plan.expected_active_release_id);assert.equal(a.source_file_hash,plan.expected_active_source_file_hash);assert.equal(a.source_document_sha256,a.source_file_hash);
 fs.mkdirSync(O);const snapshots={};for(const table of Object.keys(tables))snapshots[table]=await tableSnapshot(table);
 assert.equal((await active()).release_id,a.release_id,'Active release changed during history capture');
 write(O+'/before.json',{captured_at:new Date().toISOString(),project,read_only:true,active:a,tables:snapshots});
 write(O+'/preparation.json',{before:ref(O+'/before.json'),plan:ref(R+'/retirement-plan.json'),candidate:ref(R+'/candidate-v3/bank.json'),read_only:true});
 console.log(JSON.stringify({status:'historical_rows_captured',active_release_id:a.release_id,counts:Object.fromEntries(Object.entries(snapshots).map(([k,v])=>[k,v.count])),preparation:ref(O+'/preparation.json')}));
}else{
 assert(!fs.existsSync(O+'/after.json'));const prep=read(O+'/preparation.json');for(const input of [prep.before,prep.plan,prep.candidate])assert.equal(ref(input.file).sha256,input.sha256);
 const before=read(prep.before.file),plan=read(prep.plan.file),candidate=read(prep.candidate.file);
 const receiptFile=process.argv[3]??R+'/db-publication-v1/receipt.json',receipt=read(receiptFile);
 assert.equal(receipt.applied,true);assert(receipt.retirement_manifest_sha256);assert.equal(receipt.retirement_manifest.expected_active_release_id,before.active.release_id);
 assert.deepEqual([...receipt.retirement_manifest.retired_set_ids].sort(),[...plan.retired_set_ids].sort());
 const a=await active();assert.equal(a.release_id,receipt.release_id);assert.equal(a.source_file_hash,receipt.source_file_hash);assert.equal(a.source_document_sha256,a.source_file_hash);
 assert.equal(a.retirement_authorization.manifest_sha256,receipt.retirement_manifest_sha256);assert.deepEqual(JSON.parse(a.retirement_authorization.manifest_document),receipt.retirement_manifest);
 const expectedIds=candidate.map(s=>s.id),actualIds=a.items.map(s=>s.set_id);assert.deepEqual(actualIds,expectedIds);
 assert.deepEqual(before.active.items.filter(s=>!actualIds.includes(s.set_id)).map(s=>s.set_id).sort(),[...plan.retired_set_ids].sort());
 const baseline=read(R+'/concurrent-additions-v1/baseline.json');for(const item of baseline.concurrent_additions){const old=before.active.items.find(s=>s.set_id===item.set_id);assert.deepEqual(a.items.find(s=>s.set_id===item.set_id),old,'Concurrent case version changed');}
 const snapshots={};for(const table of Object.keys(tables)){snapshots[table]=await tableSnapshot(table,before.tables[table].keys);assert.deepEqual(snapshots[table],before.tables[table],'Historical rows changed: '+table);}
 assert.equal((await active()).release_id,a.release_id,'Active release changed during verification');
 write(O+'/after.json',{verified_at:new Date().toISOString(),project,read_only:true,status:'passed',active:a,historical_snapshots:snapshots,retired_set_count:plan.retired_set_ids.length,active_set_count:a.items.length,active_question_count:candidate.reduce((n,s)=>n+s.subquestions.length,0),before:prep.before,receipt:ref(receiptFile),all_previous_rows_preserved:true,concurrent_case_versions_preserved:true});
 console.log(JSON.stringify({status:'passed',retired_sets:plan.retired_set_ids.length,active_sets:a.items.length,previous_rows_preserved:true,verification:ref(O+'/after.json')}));
}
