import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publicationPaths,reviewedContentHash,withPublicationLock,writePublicationFiles} from '../../../questionBankPublication.ts';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const C='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c';
const out=R+'/publication-v2',stage=out+'/stage',backup=out+'/backup';
const canonical={...publicationPaths(),catalog:path.resolve('cpa_uploader/data/learning-question-classifications.json')};
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(file,x)=>fs.writeFileSync(file,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const mode=process.argv[2];assert(['--stage','--install'].includes(mode));
const ids=read(R+'/changed-sets-v1.json');
const env={...process.env};for(const k of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(k))delete env[k];delete env.NODE_OPTIONS;
const stagedEnv={...env,CPA_QUESTION_V3_AUTHORING_PATH:path.resolve(stage+'/authoring.json'),CPA_QUESTION_V3_PROMOTIONS_PATH:path.resolve(stage+'/promotions.json'),CPA_QUESTION_V3_PUBLIC_PATH:path.resolve(stage+'/public.json'),CPA_QUESTION_V3_ENCRYPTED_PATH:path.resolve(stage+'/encrypted.json')};
function run(id,args,environment,guard){
 guard();const log=out+'/'+id+'.log',fd=fs.openSync(log,'wx'),start=Date.now();let result;
 try{result=spawnSync(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),env:environment,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 write(out+'/'+id+'.result.json',{id,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(log)});
 assert.equal(result.status,0,`${id} failed; inspect ${log}`);guard();console.log(id+' passed');
}
if(mode==='--stage'){
 assert(!fs.existsSync(out));assert.equal(read(R+'/sealed-v1/readiness.json').ready,true);
 for(const step of ['01-reverify','02-verify-new','03-publish'])assert.equal(read(R+'/publication-v1/'+step+'.result.json').exit_code,0);
 const current=read(canonical.authoring),currentCatalog=read(canonical.catalog),baseline=read(D+'/bank-before.json');
 assert.equal(currentCatalog.source_file_sha256,ref(canonical.authoring).sha256,'Latest catalog is not yet consistent with the current canonical bank');
 for(const old of baseline)assert.deepEqual(current.find(s=>s.id===old.id),old,'An existing set changed concurrently: '+old.id);
 const own=read(R+'/publication-v1/stage/authoring.json'),priorLedger=read(R+'/publication-v1/backup/ledger.json');
 const ownLedger=read(R+'/publication-v1/stage/promotions.json'),currentLedger=read(canonical.ledger);
 assert.deepEqual(ownLedger.entries.slice(0,priorLedger.entries.length),priorLedger.entries);
 assert.deepEqual(currentLedger.entries.slice(0,priorLedger.entries.length),priorLedger.entries);
 const increments=ownLedger.entries.slice(priorLedger.entries.length);assert.equal(increments.length,ids.length*2);
 assert(increments.every(e=>ids.includes(e.set_id)));
 const additions=own.filter(s=>ids.includes(s.id)&&!baseline.some(b=>b.id===s.id));
 assert(additions.every(s=>!current.some(c=>c.id===s.id)),'New set ID collision');
 const merged=current.map(s=>ids.includes(s.id)?own.find(n=>n.id===s.id):s);merged.push(...additions);
 assert(merged.every(s=>s.status==='published'&&s.verification.review_status==='verified'));
 for(const s of merged.filter(s=>ids.includes(s.id)))assert.equal(reviewedContentHash(s),reviewedContentHash(read(R+'/candidate-v1.json').find(n=>n.id===s.id)));
 fs.mkdirSync(out);fs.mkdirSync(stage);fs.mkdirSync(backup);
 const originals=Object.entries(canonical).map(([name,file])=>{const copy=backup+'/'+name+'.json';fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{name,...ref(file),backup:copy};});
 const immutable=[R+'/candidate-v1.json',R+'/classification-v1.json',R+'/sealed-v1/batch.json',R+'/sealed-v1/readiness.json',R+'/publication-v1/stage/authoring.json',R+'/publication-v1/stage/promotions.json'].map(ref);
 const guard=()=>{for(const r of [...originals,...immutable])assert.equal(ref(r.file).sha256,r.sha256,'Concurrent change: '+r.file);};
 write(out+'/preparation.json',{prepared_at:new Date().toISOString(),originals,immutable,ids});
 write(stage+'/authoring.json',merged);write(stage+'/promotions.json',{...currentLedger,entries:[...currentLedger.entries,...increments]});
 const ownEntries=read(R+'/classification-v1.json').entries.filter(e=>ids.includes(e.set_id));
 const preserved=currentCatalog.classifications.filter(c=>!ids.includes(c.source_set_id)).map(c=>({set_id:c.source_set_id,subquestion_id:c.subquestion_id,question_style:c.question_style,topic_ids:c.topic_ids,standalone_prompt:c.standalone_prompt,case_fact_ids:c.case_fact_ids??[],reason:'병행 작업이 게시한 현행 분류를 그대로 보존한다. 이번 사례 보강의 의미검수 범위로 새로 계상하지 않는다.',review_evidence:[ref(backup+'/catalog.json')]}));
 write(stage+'/classification-review.json',{source_file:stage+'/authoring.json',source_file_sha256:ref(stage+'/authoring.json').sha256,entries:[...preserved,...ownEntries]});
 const external=current.filter(s=>!baseline.some(b=>b.id===s.id));
 write(out+'/merge-evidence.json',{reason:'v1 isolated stage completed verified/published transitions, but a concurrent canonical update was detected after compile. No v1 canonical install occurred. Preserve the concurrent additions and append the already reviewed exact 96 staged transitions to the latest ledger.',preserved_external_sets:external.map(s=>({set_id:s.id,questions:s.subquestions.length,points:s.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0)})),external_count:external.length,external_questions:external.reduce((n,s)=>n+s.subquestions.length,0),before_sets:baseline.length,current_sets:current.length,merged_sets:merged.length,our_changed_sets:ids.length,our_new_ledger_entries:increments.length,existing_sets_unchanged:true,canonical_writes:0,new_model_calls:0,our_grading_batch:ref(R+'/sealed-v1/batch.json'),staged_transition_results:['01-reverify','02-verify-new','03-publish'].map(s=>ref(R+'/publication-v1/'+s+'.result.json'))});
 run('04-compile',['scripts/compile-question-bank-v3.ts'],stagedEnv,guard);
 run('05-catalog',['scripts/build-learning-unit-catalog.ts','--review',stage+'/classification-review.json','--output',stage+'/catalog.json'],stagedEnv,guard);
 run('06-validate',['cpa_uploader/validate_cpa_v3.ts'],stagedEnv,guard);
 run('07-db-readiness',['scripts/import-question-bank-v3.ts','--learning-catalog',stage+'/catalog.json','--report',stage+'/readiness.json'],stagedEnv,guard);
 guard();write(out+'/stage-completion.json',{status:'validated_isolated_published_stage',completed_at:new Date().toISOString(),files:['authoring.json','promotions.json','public.json','encrypted.json','classification-review.json','catalog.json','readiness.json'].map(f=>ref(stage+'/'+f)),canonical_writes:0,db_writes:0,model_api_calls:0});
}else{
 const prep=read(out+'/preparation.json'),completion=read(out+'/stage-completion.json');assert.equal(completion.status,'validated_isolated_published_stage');assert(!fs.existsSync(out+'/install-completion.json'));
 const guardOriginal=()=>{for(const r of [...prep.originals,...prep.immutable,...completion.files])assert.equal(ref(r.file).sha256,r.sha256,'Concurrent change: '+r.file);for(const r of prep.originals)assert.equal(ref(r.backup).sha256,r.sha256,'Backup changed: '+r.backup);};
 guardOriginal();const expected=new Map(prep.originals.map(r=>[r.file,r.sha256])),allowed=new Map(prep.originals.map(r=>[r.file,new Set([r.sha256])]));
 const guard=()=>{for(const r of [...prep.immutable,...completion.files])assert.equal(ref(r.file).sha256,r.sha256);for(const[file,sha]of expected)assert.equal(ref(file).sha256,sha,'Foreign edit: '+file);};
 const install=writes=>{guard();for(const w of writes)allowed.get(w.file).add(hash(w.content));writePublicationFiles(writes,[...expected].map(([file,hash])=>({file,hash})));for(const w of writes)expected.set(w.file,hash(w.content));guard();};
 withPublicationLock(canonical.authoring,()=>{
  guardOriginal();try{
   install(Object.entries({authoring:'authoring.json',ledger:'promotions.json',public:'public.json',encrypted:'encrypted.json'}).map(([name,file])=>({file:canonical[name],content:fs.readFileSync(stage+'/'+file,'utf8')})));
   run('08-canonical-catalog',[C+'/rebind-final-catalog.ts','--bank',canonical.authoring,'--review',stage+'/classification-review.json','--output',out+'/canonical-classification-review.json','--catalog-output',out+'/canonical-catalog.json'],env,guard);
   install([{file:canonical.catalog,content:fs.readFileSync(out+'/canonical-catalog.json','utf8')}]);
   run('09-catalog-check',['scripts/build-learning-unit-catalog.ts','--check'],env,guard);
   run('10-canonical-validate',['cpa_uploader/validate_cpa_v3.ts'],env,guard);
   write(out+'/install-completion.json',{status:'canonical_installed_and_validated',completed_at:new Date().toISOString(),files:Object.values(canonical).map(ref),preserved_history:true,new_ledger_entries:ids.length*2,preserved_concurrent_additions:ref(out+'/merge-evidence.json'),db_applied:false,model_api_calls:0});
  }catch(error){let rollback='refused_foreign_change_or_invalid_backup';if(prep.originals.every(r=>allowed.get(r.file).has(ref(r.file).sha256)&&fs.existsSync(r.backup)&&ref(r.backup).sha256===r.sha256)){writePublicationFiles(prep.originals.map(r=>({file:r.file,content:fs.readFileSync(r.backup,'utf8')})),prep.originals.map(r=>({file:r.file,hash:ref(r.file).sha256})));rollback='restored_exact_original_bytes';}write(out+'/install-failure.json',{reason:error.message,rollback});throw error;}
 });
}
