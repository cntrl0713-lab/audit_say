import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPromotionLedger,publicationPaths,reviewedContentHash,withPublicationLock,writePublicationFiles} from '../../../questionBankPublication.ts';
import {assertPublicationEnvironment} from './helpers/publication-environment.mjs';

// Only the background bank is rebased. The original successful per-set
// transitions, receipts, model observations, and sealed inputs remain unchanged.
// Invoke with node --env-file=.env.local --import tsx <this file> --stage|--install.
const D='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14';
const C='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/c';
const out=D+'/publication-v2',stage=out+'/stage',backup=out+'/backup';
const names={candidate:D+'/candidate-publication-v2.json',classification:D+'/classification-publication-v2.json',promotions:D+'/promotions-publication-v2.json',baseline:D+'/integration-baseline-v2.json',reconciliation:D+'/publication-reconciliation-v2.json'};
const prior=D+'/publication-v1';
const canonical={...publicationPaths(),catalog:path.resolve('cpa_uploader/data/learning-question-classifications.json')};
const defaults={authoring:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json',encrypted:'data/cpa_question_sets_v3.authoring.enc.json',ledger:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',catalog:'cpa_uploader/data/learning-question-classifications.json'};
const key=file=>path.resolve(file).replaceAll('\\','/').toLowerCase();
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file));
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const mode=process.argv[2];
assert.equal(process.argv.length,3,'Exactly one stage/install mode is required');
assert(['--stage','--install'].includes(mode));
assertPublicationEnvironment(process.execArgv,process.env);
for(const [name,file] of Object.entries(canonical))assert.equal(key(file),key(defaults[name]),'Publication path override is not permitted: '+name);

const frozen=new Map();
function freeze(file,expected){
 const row=ref(file);
 if(expected!==undefined)assert.equal(row.sha256,expected,'Preserved file hash mismatch: '+file);
 const previous=frozen.get(key(file));
 if(previous)assert.equal(row.sha256,previous.sha256,'Input changed during verification: '+file);
 else frozen.set(key(file),row);
 return row;
}
function frozenJSON(file){freeze(file);return read(file);}
function checkRef(row){
 assert(row&&typeof row.file==='string'&&/^[a-f0-9]{64}$/.test(row.sha256),'Expected {file,sha256}');
 return freeze(row.file,row.sha256);
}
function requiredRef(rows,file){
 assert(Array.isArray(rows),'Expected a reference array');
 const matching=rows.filter(row=>key(row.file)===key(file));
 assert.equal(matching.length,1,'One required reference must identify '+file);
 checkRef(matching[0]);return matching[0];
}
function guardFrozen(){for(const row of frozen.values())assert.equal(ref(row.file).sha256,row.sha256,'Concurrent input change: '+row.file);}
function withoutLifecycle(set){const copy=structuredClone(set);delete copy.status;delete copy.verification.review_status;return copy;}
function withoutEntries(value){const copy=structuredClone(value);delete copy.entries;return copy;}

/* Input contract (additional documentary fields are allowed):
 integration-baseline-v2.json: bank/catalog/classification/ledger/public/encrypted
   each has {snapshot,sha256}; snapshots live in integration-baseline-v2/.
 publication-reconciliation-v2.json:
   status: reconciled_latest_baseline_with_original_case_transitions,
   files: refs for candidate/classification/promotions and one separate root proof,
   original_stage_results: refs for original 02/03 .result.json,
   original_stage_files: refs for original stage authoring/promotions,
   preserved_evidence: refs for original preparation, backup ledger, sealed batch/readiness,
   original_classification: ref for classification-v1.json,
   baseline: ref for integration-baseline-v2.json, new_set_ids: the original three IDs,
   reused_new_ledger_entries: 6, human_review_performed: false, model_api_calls: 0.
 The separate root proof has status: passed, new_set_ids, reused_new_ledger_entries: 6,
 human_review_performed: false, model_api_calls: 0. Assertions below independently
 establish every reused object/entry relationship, rather than trusting status labels.
 */
const reconciliation=frozenJSON(names.reconciliation);
assert.equal(reconciliation.status,'reconciled_latest_baseline_with_original_case_transitions');
assert.equal(reconciliation.human_review_performed,false);
assert.equal(reconciliation.model_api_calls,0);
assert.equal(reconciliation.reused_new_ledger_entries,6);
assert.equal(key(reconciliation.baseline.file),key(names.baseline));checkRef(reconciliation.baseline);
assert.equal(reconciliation.files.length,4);
for(const file of [names.candidate,names.classification,names.promotions])requiredRef(reconciliation.files,file);
for(const row of reconciliation.files)checkRef(row);
const extraProofs=reconciliation.files.filter(row=>![names.candidate,names.classification,names.promotions].some(file=>key(file)===key(row.file)));
assert.equal(extraProofs.length,1,'A separate root proof must accompany the three merged inputs');
assert(key(extraProofs[0].file).startsWith(key(D)+'/'),'Root proof must be in this review batch');
assert.notEqual(key(extraProofs[0].file),key(names.reconciliation),'Reconciliation must not refer to itself as its proof');
const rootProof=frozenJSON(extraProofs[0].file);
assert.equal(rootProof.status,'passed');assert.equal(rootProof.human_review_performed,false);assert.equal(rootProof.model_api_calls,0);
assert.equal(rootProof.reused_new_ledger_entries,6);
const ids=frozenJSON(D+'/changed-sets-v1.json');
assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
assert.deepEqual(reconciliation.new_set_ids,ids);assert.deepEqual(rootProof.new_set_ids,ids);
const baselineMeta=frozenJSON(names.baseline),baselineFiles={};
for(const name of ['bank','catalog','classification','ledger','public','encrypted']){
 const row=baselineMeta[name];assert(row&&typeof row.snapshot==='string','Baseline snapshot missing: '+name);
 assert(key(row.snapshot).startsWith(key(D+'/integration-baseline-v2')+'/'),'Baseline snapshot outside its immutable folder');
 checkRef({file:row.snapshot,sha256:row.sha256});baselineFiles[name]=row.snapshot;
}
assert.equal(new Set(Object.values(baselineFiles).map(key)).size,6,'Baseline snapshots must be distinct');
const baseline=frozenJSON(baselineFiles.bank),candidate=frozenJSON(names.candidate);
assert.equal(baseline.length,372);assert.equal(candidate.length,baseline.length+ids.length);
assert.equal(new Set(baseline.map(set=>set.id)).size,baseline.length);
assert.equal(new Set(candidate.map(set=>set.id)).size,candidate.length);
assert(ids.every(id=>!baseline.some(set=>set.id===id)),'Latest baseline already includes a target');
assert.deepEqual(candidate.slice(0,baseline.length),baseline,'Existing latest-baseline objects or ordering changed');
assert.deepEqual(candidate.slice(baseline.length).map(set=>set.id),ids,'Only the original three IDs may be appended');
assert(candidate.every(set=>set.status==='published'&&set.verification.review_status==='verified'),'Reconciled inputs must already be published/verified');

for(const file of [prior+'/preparation.json',prior+'/backup/ledger.json',D+'/sealed-v1/batch.json',D+'/sealed-v1/readiness.json'])requiredRef(reconciliation.preserved_evidence,file);
for(const row of reconciliation.preserved_evidence)checkRef(row);
const oldPrep=frozenJSON(prior+'/preparation.json');assert.deepEqual(oldPrep.ids,ids);
// Prior originals are historical paths. Check their backups, never require the
// live canonical files to retain the superseded baseline hashes.
for(const row of oldPrep.originals)checkRef({file:row.backup,sha256:row.sha256});
for(const row of oldPrep.immutable)checkRef(row);
requiredRef(oldPrep.immutable,D+'/candidate-v1.json');
requiredRef(oldPrep.immutable,D+'/sealed-v1/batch.json');
requiredRef(oldPrep.immutable,D+'/sealed-v1/readiness.json');
for(const id of ['02-verify-new','03-publish']){
 const file=prior+'/'+id+'.result.json';requiredRef(reconciliation.original_stage_results,file);
 const result=frozenJSON(file);assert.equal(result.id,id);assert.equal(result.exit_code,0);assert.equal(result.signal,null);
 assert.equal(key(result.log.file),key(prior+'/'+id+'.log'));checkRef(result.log);
}
for(const file of [prior+'/stage/authoring.json',prior+'/stage/promotions.json'])requiredRef(reconciliation.original_stage_files,file);
for(const row of reconciliation.original_stage_files)checkRef(row);
assert.equal(reconciliation.original_stage_results.length,2);
const oldFinal=frozenJSON(prior+'/stage/authoring.json'),oldCandidate=frozenJSON(D+'/candidate-v1.json');
const reusedSets=ids.map(id=>{
 const matches=oldFinal.filter(set=>set.id===id);assert.equal(matches.length,1);
 const final=matches[0],original=oldCandidate.find(set=>set.id===id);
 assert(original);assert.equal(original.status,'needs_review');assert.equal(original.verification.review_status,'needs_human_review');
 assert.equal(final.status,'published');assert.equal(final.verification.review_status,'verified');
 assert.deepEqual(withoutLifecycle(final),withoutLifecycle(original),'Original lifecycle promotion changed case content');
 assert.equal(reviewedContentHash(final),reviewedContentHash(original));
 assert.deepEqual(candidate.find(set=>set.id===id),final,'The published case object was not copied exactly');
 return {set_id:id,object_sha256:hash(JSON.stringify(final)),reviewed_content_hash:reviewedContentHash(final)};
});
const oldLedger=loadPromotionLedger(prior+'/backup/ledger.json'),oldPromotions=loadPromotionLedger(prior+'/stage/promotions.json');
assert.deepEqual(withoutEntries(oldPromotions),withoutEntries(oldLedger));
assert.deepEqual(oldPromotions.entries.slice(0,oldLedger.entries.length),oldLedger.entries,'Original transition ledger prefix changed');
const reusedEntries=oldPromotions.entries.slice(oldLedger.entries.length);
assert.equal(reusedEntries.length,6);assert(reusedEntries.every(row=>ids.includes(row.set_id)));
const readiness=frozenJSON(D+'/sealed-v1/readiness.json');assert.equal(readiness.ready,true);assert.deepEqual(readiness.errors,[]);
assert.equal(key(readiness.batch.file),key(D+'/sealed-v1/batch.json'));checkRef(readiness.batch);
assert(Array.isArray(readiness.validated_files)&&readiness.validated_files.length>0);
for(const row of readiness.validated_files)checkRef(row);
for(const row of reusedSets){
 assert(!oldLedger.entries.some(entry=>entry.set_id===row.set_id),'Target already occurs in the original baseline ledger');
 const entries=reusedEntries.filter(entry=>entry.set_id===row.set_id);assert.equal(entries.length,2);
 assert.equal(entries[0].from_status,'needs_review');assert.equal(entries[0].to_status,'verified');
 assert.equal(entries[1].from_status,'verified');assert.equal(entries[1].to_status,'published');
 for(const entry of entries){assert.equal(entry.content_hash,row.reviewed_content_hash);assert.equal(key(entry.evidence),key(D+'/sealed-v1/batch.json'));}
 const receipt=entries[0].efficient_review;assert(receipt,'Expected the original efficient review receipt');
 assert.equal(receipt.content_hash,row.reviewed_content_hash);assert.equal(receipt.set_id,row.set_id);
 assert.equal(key(receipt.batch.file),key(D+'/sealed-v1/batch.json'));checkRef(receipt.batch);
 assert.equal(entries[0].review_receipt_hash,receipt.receipt_hash);assert.equal(entries[1].review_receipt_hash,receipt.receipt_hash);
}
const latestLedger=loadPromotionLedger(baselineFiles.ledger),mergedLedger=loadPromotionLedger(names.promotions);
assert(!latestLedger.entries.some(entry=>ids.includes(entry.set_id)),'Latest ledger already includes a target');
assert.deepEqual(withoutEntries(mergedLedger),withoutEntries(latestLedger));
assert.deepEqual(mergedLedger.entries,[...latestLedger.entries,...reusedEntries],'Latest ledger and original six entries must be preserved exactly');

assert.equal(key(reconciliation.original_classification.file),key(D+'/classification-v1.json'));checkRef(reconciliation.original_classification);
const oldClassification=frozenJSON(D+'/classification-v1.json'),latestClassification=frozenJSON(baselineFiles.classification),classification=frozenJSON(names.classification);
assert.equal(oldClassification.source_file_sha256,ref(D+'/candidate-v1.json').sha256);
assert.equal(latestClassification.source_file_sha256,baselineMeta.bank.sha256);
assert.equal(key(classification.source_file),key(names.candidate));assert.equal(classification.source_file_sha256,ref(names.candidate).sha256);
const newClassifications=oldClassification.entries.filter(row=>ids.includes(row.set_id));
assert.equal(newClassifications.length,9);
assert.deepEqual(classification.entries,[...latestClassification.entries,...newClassifications],'Latest and original target classification entries must be preserved exactly');
const questionKeys=candidate.flatMap(set=>set.subquestions.map(q=>set.id+'/'+q.id));
const classifiedKeys=classification.entries.map(row=>row.set_id+'/'+row.subquestion_id);
assert.equal(new Set(classifiedKeys).size,classifiedKeys.length);assert.deepEqual([...classifiedKeys].sort(),[...questionKeys].sort());
const latestCatalog=frozenJSON(baselineFiles.catalog);assert.equal(latestCatalog.source_file_sha256,baselineMeta.bank.sha256);
for(const file of [fileURLToPath(import.meta.url),D+'/helpers/publish.mjs',D+'/helpers/publication-environment.mjs',C+'/rebind-final-catalog.ts',
 'cpa_uploader/questionBankPublication.ts','cpa_uploader/questionReviewIdentity.ts','scripts/compile-question-bank-v3.ts','scripts/build-learning-unit-catalog.ts',
 'cpa_uploader/validate_cpa_v3.ts','scripts/import-question-bank-v3.ts'])freeze(file);
guardFrozen();

const env={...process.env};
for(const k of Object.keys(env))if(/OPENAI|ANTHROPIC|SUPABASE/i.test(k))delete env[k];
delete env.NODE_OPTIONS;
for(const k of ['CPA_QUESTION_V3_AUTHORING_PATH','CPA_QUESTION_V3_PROMOTIONS_PATH','CPA_QUESTION_V3_PUBLIC_PATH','CPA_QUESTION_V3_ENCRYPTED_PATH'])delete env[k];
const stagedEnv={...env,CPA_QUESTION_V3_AUTHORING_PATH:path.resolve(stage+'/authoring.json'),CPA_QUESTION_V3_PROMOTIONS_PATH:path.resolve(stage+'/promotions.json'),CPA_QUESTION_V3_PUBLIC_PATH:path.resolve(stage+'/public.json'),CPA_QUESTION_V3_ENCRYPTED_PATH:path.resolve(stage+'/encrypted.json')};
function run(id,args,environment,guard){
 guard();const log=out+'/'+id+'.log',fd=fs.openSync(log,'wx');let result;const start=Date.now();
 try{result=spawnSync(process.execPath,['--import','tsx',...args],{cwd:process.cwd(),env:environment,shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 write(out+'/'+id+'.result.json',{id,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(log),...(result.error?{spawn_error:result.error.message}:{})});
 assert.equal(result.status,0,`${id} failed; inspect ${log}`);guard();console.log(id+' passed');
}
function checkFinalStage(){
 assert.deepEqual(read(stage+'/authoring.json'),candidate,'Compilation changed the merged authoring objects');
 assert.deepEqual(read(stage+'/promotions.json'),mergedLedger,'Compilation changed the reused ledger');
 const finalCatalog=read(stage+'/catalog.json');
 assert.deepEqual(finalCatalog.topics,latestCatalog.topics,'Latest topic definitions or ordering changed');
 assert.deepEqual(finalCatalog.classifications.filter(row=>!ids.includes(row.source_set_id)),latestCatalog.classifications,'An existing compiled classification changed');
 assert.deepEqual(read(stage+'/classification-review.json').entries,classification.entries);
}
if(mode==='--stage'){
 assert(!fs.existsSync(out),'Do not overwrite an earlier publication-v2 attempt');
 for(const [name,file] of Object.entries(canonical))assert.equal(ref(file).sha256,baselineMeta[name==='authoring'?'bank':name].sha256,'Canonical changed since the latest baseline: '+name);
 fs.mkdirSync(out);fs.mkdirSync(stage);fs.mkdirSync(backup);
 const originals=Object.entries(canonical).map(([name,file])=>{const copy=backup+'/'+name+'.json';fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return {name,...ref(file),backup:copy};});
 for(const row of originals){assert.equal(row.sha256,baselineMeta[row.name==='authoring'?'bank':row.name].sha256);assert.equal(ref(row.backup).sha256,row.sha256,'Backup changed while copying: '+row.file);}
 const immutable=[...frozen.values()];
 const guard=()=>{for(const row of [...originals,...immutable])assert.equal(ref(row.file).sha256,row.sha256,'Concurrent change: '+row.file);};
 guard();write(out+'/preparation.json',{prepared_at:new Date().toISOString(),originals,immutable,ids,reconciliation:ref(names.reconciliation)});
 fs.copyFileSync(names.candidate,stage+'/authoring.json',fs.constants.COPYFILE_EXCL);
 fs.copyFileSync(names.promotions,stage+'/promotions.json',fs.constants.COPYFILE_EXCL);
 guard();write(out+'/01-reused-original-transitions.json',{status:'original_verified_and_published_transitions_reused',created_at:new Date().toISOString(),reconciliation:ref(names.reconciliation),original_stage_results:reconciliation.original_stage_results,original_stage_files:reconciliation.original_stage_files,reused_sets:reusedSets,reused_ledger_entries:6,reused_ledger_entries_sha256:hash(JSON.stringify(reusedEntries)),skipped_steps:['02-verify-new','03-publish'],promotion_commands_executed:0,model_api_calls:0});
 // compile and validate invoke the full ledger validator without any pending-
 // reverification bypass. No model/network call or promotion command is made.
 run('04-compile',['scripts/compile-question-bank-v3.ts'],stagedEnv,guard);
 run('05-catalog',[C+'/rebind-final-catalog.ts','--bank',stage+'/authoring.json','--review',names.classification,'--output',stage+'/classification-review.json','--catalog-output',stage+'/catalog.json'],stagedEnv,guard);
 run('06-validate',['cpa_uploader/validate_cpa_v3.ts'],stagedEnv,guard);
 run('07-db-readiness',['scripts/import-question-bank-v3.ts','--learning-catalog',stage+'/catalog.json','--report',stage+'/readiness.json'],stagedEnv,guard);
 checkFinalStage();guard();write(out+'/stage-completion.json',{status:'validated_isolated_published_stage',completed_at:new Date().toISOString(),files:['authoring.json','promotions.json','public.json','encrypted.json','classification-review.json','catalog.json','readiness.json'].map(file=>ref(stage+'/'+file)),canonical_writes:0,db_writes:0,model_api_calls:0,reused_transitions:ref(out+'/01-reused-original-transitions.json')});
}else{
 const prep=read(out+'/preparation.json'),completion=read(out+'/stage-completion.json');assert.equal(completion.status,'validated_isolated_published_stage');
 assert(!fs.existsSync(out+'/install-completion.json'),'Installation is already complete');
 assert(!fs.existsSync(out+'/install-failure.json'),'A failed install must be reviewed in a new version, not retried');
 assert.deepEqual(prep.ids,ids);assert.deepEqual(prep.reconciliation,ref(names.reconciliation));
 assert.deepEqual(prep.originals.map(row=>[row.name,key(row.file)]),Object.entries(canonical).map(([name,file])=>[name,key(file)]));
 for(const row of prep.originals){assert.equal(row.sha256,baselineMeta[row.name==='authoring'?'bank':row.name].sha256);assert.equal(key(row.backup),key(backup+'/'+row.name+'.json'));}
 for(const row of frozen.values())requiredRef(prep.immutable,row.file);
 assert.deepEqual(completion.files.map(row=>key(row.file)),['authoring.json','promotions.json','public.json','encrypted.json','classification-review.json','catalog.json','readiness.json'].map(file=>key(stage+'/'+file)));
 assert.equal(key(completion.reused_transitions.file),key(out+'/01-reused-original-transitions.json'));
 const installEvidence=[ref(out+'/preparation.json'),ref(out+'/stage-completion.json'),completion.reused_transitions];
 const guardOriginal=()=>{for(const row of [...prep.originals,...prep.immutable,...completion.files,...installEvidence])assert.equal(ref(row.file).sha256,row.sha256,'Concurrent change: '+row.file);for(const row of prep.originals)assert.equal(ref(row.backup).sha256,row.sha256,'Backup changed: '+row.backup);};
 guardOriginal();checkFinalStage();
 const expected=new Map(prep.originals.map(row=>[row.file,row.sha256])),allowed=new Map(prep.originals.map(row=>[row.file,new Set([row.sha256])]));
 const guard=()=>{for(const row of [...prep.immutable,...completion.files,...installEvidence])assert.equal(ref(row.file).sha256,row.sha256,'Immutable changed: '+row.file);for(const [file,sha] of expected)assert.equal(ref(file).sha256,sha,'Foreign edit: '+file);};
 const install=writes=>{guard();for(const row of writes)allowed.get(row.file).add(hash(row.content));writePublicationFiles(writes,[...expected].map(([file,hash])=>({file,hash})));for(const row of writes)expected.set(row.file,hash(row.content));guard();};
 withPublicationLock(canonical.authoring,()=>{
  guardOriginal();
  try{
   install(Object.entries({authoring:'authoring.json',ledger:'promotions.json',public:'public.json',encrypted:'encrypted.json'}).map(([name,file])=>({file:canonical[name],content:fs.readFileSync(stage+'/'+file,'utf8')})));
   run('08-canonical-catalog',[C+'/rebind-final-catalog.ts','--bank',canonical.authoring,'--review',names.classification,'--output',out+'/canonical-classification-review.json','--catalog-output',out+'/canonical-catalog.json'],env,guard);
   install([{file:canonical.catalog,content:fs.readFileSync(out+'/canonical-catalog.json','utf8')}]);
   run('09-catalog-check',['scripts/build-learning-unit-catalog.ts','--check'],env,guard);
   run('10-canonical-validate',['cpa_uploader/validate_cpa_v3.ts'],env,guard);
   write(out+'/install-completion.json',{status:'canonical_installed_and_validated',completed_at:new Date().toISOString(),files:Object.values(canonical).map(ref),preserved_history:true,new_ledger_entries:ids.length*2,db_applied:false,model_api_calls:0,reused_transitions:completion.reused_transitions});
  }catch(error){
   let rollback='refused_foreign_change';
   if(prep.originals.every(row=>fs.existsSync(row.file)&&fs.existsSync(row.backup)&&allowed.get(row.file).has(ref(row.file).sha256)&&ref(row.backup).sha256===row.sha256)){
    writePublicationFiles(prep.originals.map(row=>({file:row.file,content:fs.readFileSync(row.backup,'utf8')})),prep.originals.map(row=>({file:row.file,hash:ref(row.file).sha256})));
    rollback='restored_exact_original_bytes';
   }
   write(out+'/install-failure.json',{reason:error.message,rollback});throw error;
  }
 });
}
