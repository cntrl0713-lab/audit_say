// 설치된 정본을 운영 학습 DB에 등록하고 운영 데이터를 독립적으로 다시 읽어 검증한다.
//   node --env-file=.env.local --import tsx cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1/deploy.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const base='cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1',out=base+'/db-publication-v1';
const bank='cpa_uploader/data/cpa_question_sets_v3.authoring.json',catalog='cpa_uploader/data/learning-question-classifications.json';
const migration='supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const read=file=>JSON.parse(fs.readFileSync(file)),sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),ref=file=>({file,sha256:sha(file)});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const installed=read(base+'/install-completion.json'),before=read(base+'/db-baseline.json');
assert.equal(installed.status,'canonical_installed_and_validated');
assert(!fs.existsSync(out),'이미 등록 시도가 있음. 영수증을 확인한 뒤 재시도한다');
const inputs=[...installed.files,ref(base+'/batch.json'),ref(base+'/authorization.md')];
const guard=()=>{for(const input of inputs)assert.equal(sha(input.file),input.sha256,'동시 변경: '+input.file);};
guard();
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;assert(url&&key,'운영 DB 접속 설정 필요');
const host=new URL(url).hostname;assert.equal(host,before.project_host);
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const{data,error}=await client.rpc('cpa_get_active_question_bank');assert(!error&&Array.isArray(data)&&data.length);
assert(data.every(s=>s.release_id===before.release.id),'대조 후 다른 운영 릴리스가 게시됨');
fs.mkdirSync(out);
write(out+'/preparation.json',{prepared_at:new Date().toISOString(),inputs,active_release_before:before.release.id,authorization:base+'/authorization.md'});
function run(id,args){
 guard();const log=out+'/'+id+'.log',fd=fs.openSync(log,'wx'),start=Date.now();let result;
 try{result=spawnSync(process.execPath,['--import','tsx',...args],{shell:false,windowsHide:true,stdio:['ignore',fd,fd],env:process.env});}finally{fs.closeSync(fd);}
 write(out+'/'+id+'.result.json',{id,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(log)});
 assert.equal(result.status,0,`${id} 실패; ${log}와 영수증을 확인한 뒤 재시도한다`);guard();console.log(id+' passed');
}
run('01-import',['scripts/import-question-bank-v3.ts','--apply','--expected-hash',sha(bank),'--project-host',host,'--learning-catalog',catalog,'--evidence',base+'/authorization.md; '+base+'/batch.json','--report',out+'/readiness.json','--receipt',out+'/receipt.json']);
const receipt=read(out+'/receipt.json'),readiness=read(out+'/readiness.json');
assert.equal(receipt.applied,true);assert.equal(readiness.ready,true);
assert.equal(receipt.source_file_hash,readiness.source_file_hash);assert.equal(receipt.bank_content_hash,readiness.bank_content_hash);
const evidence=out+'/verification-evidence.json';
write(evidence,{applied:receipt.applied,release_id:receipt.release_id,project_host:receipt.project_host,source_file_hash:receipt.source_file_hash,bank_content_hash:receipt.bank_content_hash,public_content_hash:readiness.public_content_hash,provenance:{receipt:ref(out+'/receipt.json'),readiness:ref(out+'/readiness.json'),note:'Expected public hash is the validated compile hash; the independent verifier compares it to the actual release and public payload.'}});
run('02-verify',['cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts','--read-live','--bank',bank,'--learning-catalog',catalog,'--evidence',evidence,'--expected-bank-sha256',sha(bank),'--expected-catalog-sha256',sha(catalog),'--expected-evidence-sha256',sha(evidence),'--migration',migration,'--expected-migration-sha256','6e45c144bf661fa10afd0d001cd0879d3d09c0b2d67d91ef45c70801e96f837b','--expected-project',host.split('.')[0],'--output',out+'/verification.json']);
const verification=read(out+'/verification.json');assert.equal(verification.status,'passed');guard();
write(out+'/completion.json',{status:'production_published_and_independently_verified',completed_at:new Date().toISOString(),release_id:receipt.release_id,previous_release_id:before.release.id,project_host:receipt.project_host,files:[bank,catalog,out+'/receipt.json',out+'/verification.json'].map(ref),counts:verification.actual,inputs_preserved:true,model_api_calls:0});
console.log(JSON.stringify({status:'production_published_and_independently_verified',release_id:receipt.release_id,counts:verification.actual,output:path.resolve(out)},null,2));
