import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const base='cpa_uploader/analysis/reviews/case-quality-2026-09-13';
const out=base+'/db-publication-v1';
const bank='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const catalog='cpa_uploader/data/learning-question-classifications.json';
const migration='supabase/migrations/20260911030000_cpa_question_learning_units.sql';
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({file,sha256:sha(file)});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const installed=read(base+'/publication-v1/install-completion.json');
assert.equal(installed.status,'canonical_installed_and_validated');
assert(!fs.existsSync(out),'Publication attempt already exists; inspect its receipt before any retry');
const inputs=[...installed.files,ref(base+'/sealed-v1/batch.json')];
const guard=()=>{for(const input of inputs)assert.equal(sha(input.file),input.sha256,'Concurrent change: '+input.file);};
guard();fs.mkdirSync(out);
write(out+'/preparation.json',{prepared_at:new Date().toISOString(),inputs,authorization:base+'/authorization.md'});
function run(id,args){
 guard();const log=out+'/'+id+'.log',fd=fs.openSync(log,'wx'),start=Date.now();let result;
 try{result=spawnSync(process.execPath,['--import','tsx',...args],{shell:false,windowsHide:true,stdio:['ignore',fd,fd],env:process.env});}finally{fs.closeSync(fd);}
 write(out+'/'+id+'.result.json',{id,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(log)});
 assert.equal(result.status,0,`${id} failed; inspect receipt and ${log} before a retry`);guard();console.log(id+' passed');
}
run('01-import',['scripts/import-question-bank-v3.ts','--apply','--expected-hash',sha(bank),'--project-host','xvifzicrjmbfqaepcfpp.supabase.co','--learning-catalog',catalog,'--evidence',base+'/sealed-v1/batch.json','--report',out+'/readiness.json','--receipt',out+'/receipt.json']);
const receipt=read(out+'/receipt.json'),readiness=read(out+'/readiness.json');
assert.equal(receipt.applied,true);assert.equal(readiness.ready,true);
assert.equal(receipt.source_file_hash,readiness.source_file_hash);assert.equal(receipt.bank_content_hash,readiness.bank_content_hash);
const evidence=out+'/verification-evidence.json';
write(evidence,{applied:receipt.applied,release_id:receipt.release_id,project_host:receipt.project_host,source_file_hash:receipt.source_file_hash,bank_content_hash:receipt.bank_content_hash,public_content_hash:readiness.public_content_hash,provenance:{receipt:ref(out+'/receipt.json'),readiness:ref(out+'/readiness.json'),note:'Expected public hash is the validated compile hash; the independent verifier compares it to the actual release and public payload.'}});
run('02-verify',['cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/c/verify-final-learning-rollout.ts','--read-live','--bank',bank,'--learning-catalog',catalog,'--evidence',evidence,'--expected-bank-sha256',sha(bank),'--expected-catalog-sha256',sha(catalog),'--expected-evidence-sha256',sha(evidence),'--migration',migration,'--expected-migration-sha256','6e45c144bf661fa10afd0d001cd0879d3d09c0b2d67d91ef45c70801e96f837b','--expected-project','xvifzicrjmbfqaepcfpp','--output',out+'/verification.json']);
const verification=read(out+'/verification.json');assert.equal(verification.status,'passed');guard();
write(out+'/completion.json',{status:'production_published_and_independently_verified',completed_at:new Date().toISOString(),release_id:receipt.release_id,project_host:receipt.project_host,files:[bank,catalog,out+'/receipt.json',out+'/verification.json'].map(ref),counts:verification.actual,inputs_preserved:true,model_api_calls:0});
console.log(JSON.stringify({status:'production_published_and_independently_verified',release_id:receipt.release_id,counts:verification.actual,output:path.resolve(out)},null,2));
