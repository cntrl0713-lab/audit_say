import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const self=R+'/reaccept-preserved-observations.mjs';
const mode=process.argv[2];assert(['--prepare','--run'].includes(mode));
const expectedConsumerSha='1f4893633012b5acb72235ece2dbceff9ada0b6410dc14eb8a31661c152cb770';
const read=f=>JSON.parse(fs.readFileSync(f));const sha=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const gradingFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3.ts','lib/questionV3Answer.ts','lib/ai/openaiStructured.ts','lib/learningUnits.ts','lib/learningSubmission.ts','scripts/build-learning-unit-catalog.ts'];
const pairs=[{original:1,current:4},{original:2,current:5},{original:3,current:6}];
const assertConsumer=()=>assert.equal(ref('cpa_uploader/questionEfficientReview.ts').sha256,expectedConsumerSha,'Final acceptance code changed');
assertConsumer();
if(mode==='--prepare'){
 for(const pair of pairs)assert(!fs.existsSync(R+'/execution-v'+pair.current),'New executions must preserve existing evidence');
 const originalGuards=[];
 for(const pair of pairs){
  const origin=R+'/execution-v'+pair.original,dest=R+'/execution-v'+pair.current;
  const originManifest=ref(origin+'/grading-manifest.json'),manifest=read(originManifest.file);
  const originalBatch=read(R+'/sealed-v'+pair.original+'/batch.json');
  assert.deepEqual(originalBatch.grading_manifest,originManifest);
  assert.equal(ref(R+'/sealed-v'+pair.original+'/batch.json').sha256,read(R+'/sealed-v'+pair.original+'/readiness.json').batch.sha256);
  assert.equal(manifest.reused_observations?.length??0,0,'These origins must be actual measured executions');
  const codeFiles=manifest.code_files.map(row=>ref(row.file));
  for(const file of gradingFiles){const old=manifest.code_files.find(row=>row.file===file);assert(old);assert.deepEqual(ref(file),old,'Grading behavior changed: '+file);}
  const changed=manifest.code_files.filter(row=>row.sha256!==ref(row.file).sha256);
  assert.deepEqual(changed.map(row=>row.file),['cpa_uploader/questionEfficientReview.ts']);
  const summaries=[...new Set(manifest.entries.map(entry=>entry.worker))].map(worker=>({worker,...ref(origin+'/actual-'+worker+'/summary.json')}));
  const observed=new Map();
  for(const summaryRef of summaries){const summary=read(summaryRef.file);assert.equal(summary.status,'completed');assert.equal(summary.frozen_input_error,null);assert.deepEqual(summary.remaining_entry_ids,[]);
   for(const row of summary.rows){assert(row.observation&&!row.error&&!row.reused);assert(!observed.has(row.id));assert.equal(ref(row.observation.file).sha256,row.observation.sha256);const observation=read(row.observation.file);assert.deepEqual(observation.manifest,originManifest);observed.set(row.id,{entry_id:row.id,worker:summaryRef.worker,observation:row.observation,origin_manifest:originManifest});}}
  assert.deepEqual([...observed.keys()].sort(),manifest.entries.map(entry=>entry.id).sort());
  for(const input of [originManifest,...manifest.inputs,manifest.bank,manifest.classifications,manifest.policy,...summaries,...originalBatch.observations]){assert.equal(ref(input.file).sha256,input.sha256);originalGuards.push(input);}
  fs.mkdirSync(dest);fs.mkdirSync(dest+'/runtime');
  codeFiles.push(ref(self));
  const snapshots=codeFiles.map(code=>{const file=dest+'/runtime/'+code.file;fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(code.file,file,fs.constants.COPYFILE_EXCL);return{...ref(file),runtime_file:code.file};});
  write(dest+'/runtime-snapshots.json',snapshots);
  write(dest+'/reuse-proof.json',{created_at:new Date().toISOString(),original_execution:originManifest,original_batch:ref(R+'/sealed-v'+pair.original+'/batch.json'),original_summaries:summaries,
   reason:'보조 분석의 보존본을 해석하는 검수 소비자 코드 변경 후 새 수락. 실제 채점 8파일, 원 bank/catalog/policy, 선택 entry, 답안·기대값·프롬프트·schema는 모두 보존한다.',
   grading_files_unchanged:gradingFiles.map(ref),changed_consumer:{before:changed[0],after:ref(changed[0].file)},
   original_residual_findings:originalBatch.residual_grading_findings,original_observations_preserved:true,new_api_calls:0,new_cost_usd:0,
   accounting_policy:'원 실행의 실제 usage·비용은 원summary에서 한 번만 합산하며 재사용 summary의 new_usage는 비어 있어야 한다.'});
  const next={...structuredClone(manifest),inputs:[...manifest.inputs,ref(dest+'/runtime-snapshots.json'),ref(dest+'/reuse-proof.json'),originManifest],code_files:codeFiles,
   reused_observations:manifest.entries.map(entry=>observed.get(entry.id))};
  assert.deepEqual(next.bank,manifest.bank);assert.deepEqual(next.classifications,manifest.classifications);assert.deepEqual(next.policy,manifest.policy);assert.deepEqual(next.entries,manifest.entries);
  write(dest+'/grading-manifest.json',next);
 }
 const deduplicated=[...new Map(originalGuards.map(g=>[g.file,g])).values()];for(const guard of deduplicated)assert.equal(ref(guard.file).sha256,guard.sha256);
 write(R+'/reuse-acceptance-preparation.json',{created_at:new Date().toISOString(),consumer:ref('cpa_uploader/questionEfficientReview.ts'),generator:ref(self),pairs,
  manifests:pairs.map(pair=>ref(R+'/execution-v'+pair.current+'/grading-manifest.json')),protected_originals:deduplicated,api_calls:0});
 console.log(JSON.stringify({status:'prepared',executions:pairs.map(pair=>pair.current),entries:pairs.map(pair=>read(R+'/execution-v'+pair.current+'/grading-manifest.json').entries.length),api_calls:0}));
}else{
 const prep=read(R+'/reuse-acceptance-preparation.json');assert.deepEqual(prep.pairs,pairs);assert.equal(ref(self).sha256,prep.generator.sha256);
 const guard=()=>{assertConsumer();for(const input of [...prep.protected_originals,...prep.manifests])assert.equal(ref(input.file).sha256,input.sha256,'Frozen original changed: '+input.file);};guard();
 const env={...process.env};for(const key of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(key))delete env[key];delete env.NODE_OPTIONS;
 const run=(logFile,args)=>{guard();const fd=fs.openSync(logFile,'wx');let result;
  try{result=spawnSync(process.execPath,['--import','tsx',...args],{env,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
  write(logFile+'.result.json',{exit_code:result.status,signal:result.signal,log:ref(logFile),model_credentials_removed:true});assert.equal(result.status,0,'Reacceptance failed; preserve logs and inspect '+logFile);guard();};
 for(const pair of pairs){
  const dest=R+'/execution-v'+pair.current,manifestRef=ref(dest+'/grading-manifest.json'),manifest=read(manifestRef.file);
  assert.equal(manifest.entries.length,manifest.reused_observations.length);assert(!fs.existsSync(R+'/sealed-v'+pair.current));
  for(const worker of [...new Set(manifest.entries.map(entry=>entry.worker))]){
   run(dest+'/reuse-'+worker+'.log',[R+'/run-efficient-grading.ts','--manifest',manifestRef.file,'--manifest-sha256',manifestRef.sha256,'--worker',worker,'--output',dest+'/actual-'+worker,'--stop-file',dest+'/STOP.json']);
   const summary=read(dest+'/actual-'+worker+'/summary.json');assert.equal(summary.actual_sdk_calls,0);assert.equal(summary.new_observations,0);assert.deepEqual(summary.new_usage,[]);assert.equal(summary.new_accounting.usd,0);assert(summary.rows.every(row=>row.reused));
   console.log(JSON.stringify({execution:pair.current,worker,reused:summary.reused_observations,new_api_calls:0}));
  }
  run(dest+'/seal.log',[R+'/seal.mjs','--execution','execution-v'+pair.current,'--output','sealed-v'+pair.current,'--prior-executions','execution-v'+pair.original,'--findings','residual-findings-v'+pair.original+'.json']);
  assert.deepEqual(read(R+'/sealed-v'+pair.current+'/batch.json').observations,read(R+'/sealed-v'+pair.original+'/batch.json').observations);
  assert.deepEqual(read(R+'/sealed-v'+pair.current+'/batch.json').residual_grading_findings,read(R+'/sealed-v'+pair.original+'/batch.json').residual_grading_findings);
  console.log(JSON.stringify({execution:pair.current,sealed:ref(R+'/sealed-v'+pair.current+'/batch.json'),ready:true}));
 }
 const originalSummaries=pairs.flatMap(pair=>{const m=read(R+'/execution-v'+pair.original+'/grading-manifest.json');return[...new Set(m.entries.map(e=>e.worker))].map(w=>ref(R+'/execution-v'+pair.original+'/actual-'+w+'/summary.json'));});
 const summaries=originalSummaries.map(s=>read(s.file));const totalCalls=summaries.reduce((n,s)=>n+s.actual_sdk_calls,0);assert.equal(totalCalls,582);
 const usage=summaries.flatMap(s=>s.new_usage);assert.equal(usage.length,totalCalls);assert.equal(new Set(usage.map(u=>u.provider.request_id)).size,totalCalls,'Original requests counted more than once');
 const final={status:'passed',completed_at:new Date().toISOString(),new_actual_sdk_calls:0,new_cost_usd:0,original_actual_sdk_calls:totalCalls,
  original_cost_usd:summaries.reduce((n,s)=>n+s.usd,0),original_summaries:originalSummaries,original_usage:usage,
  batches:pairs.map(pair=>({original:pair.original,current:pair.current,batch:ref(R+'/sealed-v'+pair.current+'/batch.json'),receipts:ref(R+'/sealed-v'+pair.current+'/receipts.json'),readiness:ref(R+'/sealed-v'+pair.current+'/readiness.json')})),
  retained_v1_outside_tolerance:read(R+'/sealed-v4/batch.json').residual_grading_findings,protected_originals_unchanged:true};
 guard();write(R+'/reuse-acceptance-completion.json',final);console.log(JSON.stringify({...final,original_usage:undefined,retained_v1_outside_tolerance:final.retained_v1_outside_tolerance.length}));
}
