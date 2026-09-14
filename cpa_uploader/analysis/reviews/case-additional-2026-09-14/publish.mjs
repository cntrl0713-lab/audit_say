import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publicationPaths,reviewedContentHash,withPublicationLock,writePublicationFiles} from '../../../questionBankPublication.ts';
const D='cpa_uploader/analysis/reviews/case-additional-2026-09-14';
const C='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c';
const out=D+'/publication-v1',stage=out+'/stage',backup=out+'/backup';
const canonical={...publicationPaths(),catalog:path.resolve('cpa_uploader/data/learning-question-classifications.json')};
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(file,x)=>fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const mode=process.argv[2];assert(['--stage','--install'].includes(mode));
const ids=read(D+'/changed-sets-v1.json'),candidate=read(D+'/candidate-v1.json');
assert.equal(read(D+'/sealed-v1/readiness.json').ready,true);
const env={...process.env};for(const k of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(k))delete env[k];delete env.NODE_OPTIONS;
const stagedEnv={...env,CPA_QUESTION_V3_AUTHORING_PATH:path.resolve(stage+'/authoring.json'),CPA_QUESTION_V3_PROMOTIONS_PATH:path.resolve(stage+'/promotions.json'),CPA_QUESTION_V3_PUBLIC_PATH:path.resolve(stage+'/public.json'),CPA_QUESTION_V3_ENCRYPTED_PATH:path.resolve(stage+'/encrypted.json')};
function run(id,args,environment,guard=()=>{}){
 guard();const log=out+'/'+id+'.log',fd=fs.openSync(log,'wx');let result;const start=Date.now();
 try{result=spawnSync(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),env:environment,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 write(out+'/'+id+'.result.json',{id,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(log)});
 assert.equal(result.status,0,`${id} failed; inspect ${log}`);guard();console.log(id+' passed');
}
if(mode==='--stage'){
 assert(!fs.existsSync(out));assert.equal(ref(canonical.authoring).sha256,read(D+'/integration-baseline.json').bank.sha256,'Canonical changed during review');
 assert.equal(ref(canonical.catalog).sha256,read(D+'/integration-baseline.json').catalog.sha256,'Canonical classifications changed during review');
 fs.mkdirSync(out);fs.mkdirSync(stage);fs.mkdirSync(backup);
 const originals=Object.entries(canonical).map(([name,file])=>{const copy=backup+'/'+name+'.json';fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{name,...ref(file),backup:copy};});
 assert.equal(originals.find(r=>r.name==='authoring').sha256,read(D+'/integration-baseline.json').bank.sha256,'Canonical changed while creating backups');
 assert.equal(originals.find(r=>r.name==='catalog').sha256,read(D+'/integration-baseline.json').catalog.sha256,'Catalog changed while creating backups');
 for(const r of originals)assert.equal(ref(r.backup).sha256,r.sha256,'Backup changed while copying: '+r.file);
 const immutable=[D+'/candidate-v1.json',D+'/classification-v1.json',D+'/sealed-v1/batch.json',D+'/sealed-v1/readiness.json'].map(ref);
 const guard=()=>{for(const r of [...originals,...immutable])assert.equal(ref(r.file).sha256,r.sha256,'Concurrent change: '+r.file);};
 write(out+'/preparation.json',{prepared_at:new Date().toISOString(),originals,immutable,ids});
 fs.copyFileSync(D+'/candidate-v1.json',stage+'/authoring.json');fs.copyFileSync(canonical.ledger,stage+'/promotions.json');
 const newIds=ids;assert(newIds.every(id=>!read('cpa_uploader/drafts/case-additional-2026-09-14/bank-before.json').some(s=>s.id===id)));
 const evidence=D+'/sealed-v1/batch.json';
 run('02-verify-new',['cpa_uploader/promote_cpa_v3.ts','--to','verified','--sets',newIds.join(','),'--efficient-review',evidence,'--evidence',evidence],stagedEnv,guard);
 run('03-publish',['cpa_uploader/promote_cpa_v3.ts','--to','published','--sets',ids.join(','),'--evidence',evidence],stagedEnv,guard);
 run('04-compile',['scripts/compile-question-bank-v3.ts'],stagedEnv,guard);
 run('05-catalog',[C+'/rebind-final-catalog.ts','--bank',stage+'/authoring.json','--review',D+'/classification-v1.json','--output',stage+'/classification-review.json','--catalog-output',stage+'/catalog.json'],stagedEnv,guard);
 run('06-validate',['cpa_uploader/validate_cpa_v3.ts'],stagedEnv,guard);
 run('07-db-readiness',['scripts/import-question-bank-v3.ts','--learning-catalog',stage+'/catalog.json','--report',stage+'/readiness.json'],stagedEnv,guard);
 const final=read(stage+'/authoring.json');assert.deepEqual(final.map(reviewedContentHash),candidate.map(reviewedContentHash));
 assert(final.every(s=>s.status==='published'&&s.verification.review_status==='verified'));
 const prior=read(backup+'/ledger.json'),next=read(stage+'/promotions.json');assert.deepEqual(next.entries.slice(0,prior.entries.length),prior.entries);
 assert.equal(next.entries.length-prior.entries.length,ids.length*2);
 guard();write(out+'/stage-completion.json',{status:'validated_isolated_published_stage',completed_at:new Date().toISOString(),files:['authoring.json','promotions.json','public.json','encrypted.json','classification-review.json','catalog.json','readiness.json'].map(f=>ref(stage+'/'+f)),canonical_writes:0,db_writes:0,model_api_calls:0});
}else{
 const prep=read(out+'/preparation.json'),completion=read(out+'/stage-completion.json');assert.equal(completion.status,'validated_isolated_published_stage');
 assert(!fs.existsSync(out+'/install-completion.json'));
 const guardOriginal=()=>{for(const r of [...prep.originals,...prep.immutable,...completion.files])assert.equal(ref(r.file).sha256,r.sha256,'Concurrent change: '+r.file);for(const r of prep.originals){assert(fs.existsSync(r.backup),'Backup missing: '+r.backup);assert.equal(ref(r.backup).sha256,r.sha256,'Backup changed: '+r.backup);}};
 guardOriginal();
 const expected=new Map(prep.originals.map(r=>[r.file,r.sha256])),allowed=new Map(prep.originals.map(r=>[r.file,new Set([r.sha256])]));
 const guard=()=>{for(const r of [...prep.immutable,...completion.files])assert.equal(ref(r.file).sha256,r.sha256);for(const[file,sha]of expected)assert.equal(ref(file).sha256,sha,'Foreign edit: '+file);};
 const install=writes=>{guard();for(const w of writes)allowed.get(w.file).add(hash(w.content));writePublicationFiles(writes,[...expected].map(([file,hash])=>({file,hash})));for(const w of writes)expected.set(w.file,hash(w.content));guard();};
 withPublicationLock(canonical.authoring,()=>{
  guardOriginal();
  try{
   install(Object.entries({authoring:'authoring.json',ledger:'promotions.json',public:'public.json',encrypted:'encrypted.json'}).map(([name,file])=>({file:canonical[name],content:fs.readFileSync(stage+'/'+file,'utf8')})));
   run('08-canonical-catalog',[C+'/rebind-final-catalog.ts','--bank',canonical.authoring,'--review',D+'/classification-v1.json','--output',out+'/canonical-classification-review.json','--catalog-output',out+'/canonical-catalog.json'],env,guard);
   install([{file:canonical.catalog,content:fs.readFileSync(out+'/canonical-catalog.json','utf8')}]);
   run('09-catalog-check',['scripts/build-learning-unit-catalog.ts','--check'],env,guard);
   run('10-canonical-validate',['cpa_uploader/validate_cpa_v3.ts'],env,guard);
   write(out+'/install-completion.json',{status:'canonical_installed_and_validated',completed_at:new Date().toISOString(),files:Object.values(canonical).map(ref),preserved_history:true,new_ledger_entries:ids.length*2,db_applied:false,model_api_calls:0});
  }catch(error){
   let rollback='refused_foreign_change';
   if(prep.originals.every(r=>fs.existsSync(r.file)&&fs.existsSync(r.backup)&&allowed.get(r.file).has(ref(r.file).sha256)&&ref(r.backup).sha256===r.sha256)){writePublicationFiles(prep.originals.map(r=>({file:r.file,content:fs.readFileSync(r.backup,'utf8')})),prep.originals.map(r=>({file:r.file,hash:ref(r.file).sha256})));rollback='restored_exact_original_bytes';}
   write(out+'/install-failure.json',{reason:error.message,rollback});throw error;
  }
 });
}
