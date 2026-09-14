import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {reviewedContentHash} from '../../../questionBankPublication.ts';

const R='cpa_uploader/analysis/reviews/case-deepening-2026-09-14';
const C='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c';
const out=R+'/publication-v1',stage=out+'/stage';
const planFile=R+'/resume-publication-plan.json';
const read=file=>JSON.parse(fs.readFileSync(file));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const verify=row=>assert.equal(ref(row.file).sha256,row.sha256,'Preserved input changed: '+row.file);
const mode=process.argv[2];assert.equal(process.argv.length,3);assert(['--check','--run'].includes(mode),'Use --check or --run');
const plan=read(planFile);assert.equal(plan.version,1);assert.equal(plan.status,'prepared_not_executed');
const planIdentity=ref(planFile);
assert.equal(ref(fileURLToPath(import.meta.url)).sha256,plan.resume_helper.sha256,'Resume helper changed after preparation');
const prep=read(out+'/preparation.json'),failureReview=read(R+'/publication-stage-failure-review.json');
const candidate=read(R+'/candidate-v1.json'),ids=read(R+'/changed-sets-v1.json');
const guard=()=>{
  verify(planIdentity);
  for(const row of plan.preserved_files)verify(row);
  for(const row of [...prep.originals,...prep.immutable,...failureReview.stage_inputs])verify(row);
  for(const row of prep.originals)verify({file:row.backup,sha256:row.sha256});
};
guard();
assert.deepEqual(prep.ids,ids);assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);
assert.equal(failureReview.canonical_originals_unchanged,true);
assert.equal(failureReview.immutable_inputs_unchanged,true);
assert.equal(failureReview.encryption_key_available_with_env_file,true);
assert.equal(failureReview.secret_value_recorded,false);
assert.deepEqual(failureReview.stage_inputs.map(row=>row.file).sort(),[stage+'/authoring.json',stage+'/promotions.json'].sort());
for(const id of ['02-verify-new','03-publish']){
  const result=read(out+'/'+id+'.result.json');assert.equal(result.exit_code,0);verify(result.log);
}
verify(failureReview.failure_result);
const originalFailure=read(failureReview.failure_result.file);assert.equal(originalFailure.id,'04-compile');assert.equal(originalFailure.exit_code,1);verify(originalFailure.log);
assert.equal(fs.readFileSync(originalFailure.log.file,'utf8').trim(),'CPA_QUESTION_V3_ENCRYPTION_KEY가 필요합니다.','Resume only the reviewed missing-key failure');
assert.equal(read(R+'/sealed-v1/readiness.json').ready,true);
const finalBefore=read(stage+'/authoring.json'),prior=read(out+'/backup/ledger.json'),next=read(stage+'/promotions.json');
assert.deepEqual(finalBefore.map(reviewedContentHash),candidate.map(reviewedContentHash));
assert(finalBefore.every(set=>set.status==='published'&&set.verification.review_status==='verified'));
assert.deepEqual(next.entries.slice(0,prior.entries.length),prior.entries);
assert.equal(next.entries.length-prior.entries.length,ids.length*2);

const steps=[
  ['04-compile-retry1',['scripts/compile-question-bank-v3.ts']],
  ['05-catalog',[C+'/rebind-final-catalog.ts','--bank',stage+'/authoring.json','--review',R+'/classification-v1.json','--output',stage+'/classification-review.json','--catalog-output',stage+'/catalog.json']],
  ['06-validate',['cpa_uploader/validate_cpa_v3.ts']],
  ['07-db-readiness',['scripts/import-question-bank-v3.ts','--learning-catalog',stage+'/catalog.json','--report',stage+'/readiness.json']],
];
assert(!steps.some(([,args])=>args.includes('--apply')),'Database application is outside stage resume');
const newFiles=[...steps.flatMap(([id])=>[out+'/'+id+'.log',out+'/'+id+'.result.json']),
  ...['public.json','encrypted.json','classification-review.json','catalog.json','readiness.json'].map(name=>stage+'/'+name),
  out+'/stage-completion.json',out+'/resume-stage-retry1-attempt.json',out+'/resume-stage-retry1-completion.json',out+'/resume-stage-retry1-failure.json'];
for(const file of newFiles)assert(!fs.existsSync(file),'Preserve earlier output; this resume is write-once: '+file);
if(mode==='--check'){
  guard();console.log(JSON.stringify({status:'resume_preflight_passed',steps:steps.map(([id])=>id),original_failure_preserved:true,stage_authoring_and_promotions_unchanged:true,subprocesses_run:0,canonical_writes:0,db_writes:0,model_api_calls:0},null,2));
}else{
  assert(process.execArgv.some(arg=>arg==='--env-file=.env.local'),'Invoke Node with --env-file=.env.local before --import tsx');
  assert(process.env.CPA_QUESTION_V3_ENCRYPTION_KEY,'Encryption key must be loaded; its value is never recorded');
  const env={...process.env};
  for(const key of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(key))delete env[key];
  delete env.NODE_OPTIONS;
  const stagedEnv={...env,CPA_QUESTION_V3_AUTHORING_PATH:path.resolve(stage+'/authoring.json'),CPA_QUESTION_V3_PROMOTIONS_PATH:path.resolve(stage+'/promotions.json'),CPA_QUESTION_V3_PUBLIC_PATH:path.resolve(stage+'/public.json'),CPA_QUESTION_V3_ENCRYPTED_PATH:path.resolve(stage+'/encrypted.json')};
  const attemptFile=out+'/resume-stage-retry1-attempt.json';
  write(attemptFile,{started_at:new Date().toISOString(),plan:ref(planFile),helper:ref(fileURLToPath(import.meta.url)),failure_review:ref(R+'/publication-stage-failure-review.json'),original_failure:failureReview.failure_result,stage_inputs:failureReview.stage_inputs,steps:steps.map(([id,args])=>({id,args})),env_file:'.env.local',encryption_key_present:true,secret_value_recorded:false,canonical_writes:0,db_writes:0,model_api_calls:0});
  try{
    for(const [id,args] of steps){
      guard();const log=out+'/'+id+'.log',fd=fs.openSync(log,'wx'),started=Date.now();let result;
      try{result=spawnSync(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),env:stagedEnv,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}
      catch(error){result={status:null,signal:null,error};}
      finally{fs.closeSync(fd);}
      write(out+'/'+id+'.result.json',{id,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-started,log:ref(log),...(result.error?{execution_error:{name:result.error.name,code:result.error.code??null}}:{})});
      guard();assert.equal(result.status,0,`${id} failed; preserve this retry and inspect ${log}`);console.log(id+' passed');
    }
    const final=read(stage+'/authoring.json'),ledger=read(stage+'/promotions.json');
    assert.deepEqual(final.map(reviewedContentHash),candidate.map(reviewedContentHash));
    assert(final.every(set=>set.status==='published'&&set.verification.review_status==='verified'));
    assert.deepEqual(ledger.entries.slice(0,prior.entries.length),prior.entries);
    assert.equal(ledger.entries.length-prior.entries.length,ids.length*2);
    guard();
    write(out+'/stage-completion.json',{status:'validated_isolated_published_stage',completed_at:new Date().toISOString(),files:['authoring.json','promotions.json','public.json','encrypted.json','classification-review.json','catalog.json','readiness.json'].map(name=>ref(stage+'/'+name)),canonical_writes:0,db_writes:0,model_api_calls:0});
    write(out+'/resume-stage-retry1-completion.json',{status:'resumed_stage_completed',completed_at:new Date().toISOString(),attempt:ref(attemptFile),plan:ref(planFile),original_failure:failureReview.failure_result,stage_completion:ref(out+'/stage-completion.json'),results:steps.map(([id])=>ref(out+'/'+id+'.result.json')),prior_records_preserved:true,canonical_writes:0,db_writes:0,model_api_calls:0});
  }catch(error){
    write(out+'/resume-stage-retry1-failure.json',{status:'resume_failed',failed_at:new Date().toISOString(),attempt:ref(attemptFile),reason:error.message,prior_failure_preserved:ref(originalFailure.log.file).sha256===originalFailure.log.sha256,canonical_writes:0,db_writes:0,model_api_calls:0});
    throw error;
  }
}
