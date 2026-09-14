import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',D='cpa_uploader/drafts/case-trio-next-2026-09-14';
const S='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v1';
const bank='cpa_uploader/data/cpa_question_sets_v3.authoring.json',catalog='cpa_uploader/data/learning-question-classifications.json';
const out=R+'/integration-baseline',recordFile=R+'/integration-baseline.json',proofFile=R+'/integration-baseline-successor-evidence.json';
const EXPECTED_OLD='fe106741e3b8575f20b1be07786cd034c2ba2f3f4b1a823f2016a2e19a2a9293';
const EXPECTED_CURRENT='27ccb6455611e8ea92e1a3ffd8f76ca15a598931ef403177e0217cae14b3a37f';
const EXPECTED_RELEASE='3c521583-7698-4ac7-b247-0d53ae9223ac';
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const checkRef=identity=>assert.equal(ref(identity.file).sha256,identity.sha256,'Evidence changed: '+identity.file);
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=values=>[...values].sort();
assert.equal(process.argv.length,2);for(const file of [out,recordFile,proofFile])assert(!fs.existsSync(file),'Preserve earlier baseline output: '+file);

const changesFile=S+'/changes.json',installFile=S+'/publication-v1/install-completion.json',receiptFile=S+'/db-publication-v1/receipt.json',roundtripFile=S+'/db-publication-v1/roundtrip.json';
const current=read(bank),old=read(D+'/bank-before.json'),classes=read(catalog),oldClasses=read(D+'/catalog-before.json');
const review=classes.review_file,classification=read(review),changes=read(changesFile),install=read(installFile),receipt=read(receiptFile),roundtrip=read(roundtripFile),live=read(R+'/production-baseline-read.json');
const inputs=[bank,catalog,review,D+'/bank-before.json',D+'/catalog-before.json',D+'/classification-before.json',D+'/source-catalog.json',D+'/source-catalog-final.json',changesFile,installFile,receiptFile,roundtripFile,R+'/production-baseline-read.json',R+'/helpers/capture-integration-baseline.mjs',R+'/helpers/provenance.json',R+'/incremental-db-publication-v1/source-provenance.json',R+'/incremental-db-publication-v1/sources/installed-functions-after.json',R+'/capture-integration-baseline-successor.mjs'].map(ref);
assert.equal(ref(D+'/bank-before.json').sha256,EXPECTED_OLD);assert.equal(ref(bank).sha256,EXPECTED_CURRENT);
assert.equal(changes.baseline_bank.sha256,EXPECTED_OLD);assert.equal(ref(changes.baseline_bank.backup).sha256,EXPECTED_OLD);inputs.push(ref(changes.baseline_bank.backup));
checkRef(changes.edited_bank);assert.equal(changes.edited_bank.sha256,EXPECTED_CURRENT);assert(fs.readFileSync(bank).equals(fs.readFileSync(changes.edited_bank.file)));inputs.push(changes.edited_bank);
checkRef(changes.authorization);inputs.push(changes.authorization);
assert.equal(install.status,'canonical_installed_and_validated');for(const identity of install.files){checkRef(identity);inputs.push(identity);}
assert.equal(receipt.applied,true);assert.equal(receipt.project_host,'xvifzicrjmbfqaepcfpp.supabase.co');assert.equal(receipt.release_id,EXPECTED_RELEASE);assert.equal(receipt.source_file_hash,EXPECTED_CURRENT);assert.equal(receipt.source_bytes_identical,true);assert.equal(receipt.public_round_trip,true);assert.equal(receipt.content_review_performed,true);
for(const identity of [receipt.incremental_preparation,receipt.original_response,receipt.roundtrip]){checkRef(identity);inputs.push(identity);}
assert.equal(receipt.roundtrip.file,roundtripFile);assert.equal(roundtrip.status,'passed');assert.equal(roundtrip.after.active.release_id,EXPECTED_RELEASE);
for(const value of [roundtrip.source_file_hash,roundtrip.after.active.source_file_hash,roundtrip.after.active.source_document_sha256])assert.equal(value,EXPECTED_CURRENT);
for(const key of ['source_bytes_identical','public_round_trip','learning_classification_round_trip','learning_topic_round_trip','transaction_guarded_unchanged_versions_and_classifications_preserved','functions_and_acl_unchanged','default_role_and_database_settings_unchanged'])assert.equal(roundtrip[key],true,key);
assert.deepEqual(roundtrip.after.functions,read(R+'/incremental-db-publication-v1/sources/installed-functions-after.json').functions,'Frozen append function provenance no longer matches the latest completed roundtrip');
assert.equal(live.project,'xvifzicrjmbfqaepcfpp');assert.equal(live.read_only,true);assert.equal(live.active.release_id,EXPECTED_RELEASE);assert.equal(live.active.source_file_hash,EXPECTED_CURRENT);assert.equal(live.active.actual_source_hash,EXPECTED_CURRENT);

assert.equal(current.length,372);assert.equal(old.length,372);assert.equal(new Set(current.map(set=>set.id)).size,372);assert.deepEqual(current.map(set=>set.id),old.map(set=>set.id));
assert.equal(classes.source_file_sha256,EXPECTED_CURRENT);assert.equal(oldClasses.source_file_sha256,EXPECTED_OLD);assert.equal(classification.source_file_sha256,EXPECTED_CURRENT);assert.equal(classes.review_file_sha256,ref(review).sha256);
assert.deepEqual(classes.topics,oldClasses.topics);assert.equal(classes.classifications.length,555);assert.equal(classification.entries.length,555);
const changed=current.filter((set,index)=>!equal(set,old[index])).map(set=>set.id);assert.equal(changed.length,10);assert.deepEqual(sorted(changed),sorted(changes.changed_sets));assert.equal(new Set(changes.changed_sets).size,10);
assert.deepEqual(sorted(install.changed_sets),sorted(changed));assert.deepEqual(sorted(roundtrip.reviewed_sets_versioned_in_place),sorted(changed));
const expected=structuredClone(old),evidence=[];
for(const change of changes.changes){
 assert(changed.includes(change.set_id));const set=expected.find(set=>set.id===change.set_id),question=set.subquestions.find(question=>question.id===change.subquestion_id);assert(question);
 if(change.criterion_id){
  assert.deepEqual(change.fields,['criteria.claim']);const criterion=question.criteria.find(criterion=>criterion.id===change.criterion_id);assert(criterion);assert.equal(criterion.claim,change.before);criterion.claim=change.after;
 }else{
  assert.deepEqual(change.fields,['title','subquestions[0].prompt','learning classification standalone_prompt']);assert.equal(set.title,change.before);assert.equal(question.prompt,change.before);set.title=change.after;question.prompt=change.after;
 }
 evidence.push({set_id:change.set_id,subquestion_id:change.subquestion_id,criterion_id:change.criterion_id??null,finding:change.finding,fields:change.fields,before:change.before,after:change.after});
}
for(const id of changed){
 const before=old.find(set=>set.id===id),actual=current.find(set=>set.id===id),patched=expected.find(set=>set.id===id);
 assert.equal(actual.verification.notes.length,before.verification.notes.length+1);assert.deepEqual(actual.verification.notes.slice(0,-1),before.verification.notes);assert(actual.verification.notes.at(-1).includes(S+'/changes.json'));
 patched.verification.notes.push(actual.verification.notes.at(-1));
 const oldRows=oldClasses.classifications.filter(row=>row.source_set_id===id),newRows=classes.classifications.filter(row=>row.source_set_id===id);
 assert(oldRows.length&&newRows.length);assert.equal(oldRows.length,newRows.length);assert(oldRows.every(row=>row.question_style==='standard')&&newRows.every(row=>row.question_style==='standard'));
 for(const row of newRows){
  const beforeRow=oldRows.find(prior=>prior.subquestion_id===row.subquestion_id);assert(beforeRow);assert.equal(row.learning_question_id,beforeRow.learning_question_id);assert.equal(row.question_style,beforeRow.question_style);assert.deepEqual(row.topic_ids,beforeRow.topic_ids);assert.deepEqual(row.case_fact_ids,beforeRow.case_fact_ids);assert.equal(row.case_set_id,beforeRow.case_set_id);
  assert.equal(row.standalone_prompt,actual.subquestions.find(question=>question.id===row.subquestion_id).prompt);
 }
}
assert.deepEqual(current,expected,'Current bank contains changes beyond the exact documented ten-set text changes and appended review notes');
const caseIds=[...new Set(oldClasses.classifications.filter(row=>row.question_style==='case').map(row=>row.source_set_id))];assert.equal(caseIds.length,70);
assert.deepEqual([...new Set(classes.classifications.filter(row=>row.question_style==='case').map(row=>row.source_set_id))],caseIds);assert.equal(classes.classifications.filter(row=>row.question_style==='case').length,183);
for(const oldSet of old){
 const next=current.find(set=>set.id===oldSet.id);assert.deepEqual(next.source_refs,oldSet.source_refs);assert.deepEqual(next.subquestions.map(question=>({id:question.id,model_answer:question.model_answer,requirements:question.requirements,criteria:question.criteria.map(criterion=>({id:criterion.id,max_points:criterion.max_points,scores:criterion.scores}))})),oldSet.subquestions.map(question=>({id:question.id,model_answer:question.model_answer,requirements:question.requirements,criteria:question.criteria.map(criterion=>({id:criterion.id,max_points:criterion.max_points,scores:criterion.scores}))})));
 if(!changed.includes(oldSet.id)){
  assert.deepEqual(next,oldSet);assert.deepEqual(classes.classifications.filter(row=>row.source_set_id===oldSet.id),oldClasses.classifications.filter(row=>row.source_set_id===oldSet.id));
 }
}
for(const id of caseIds){assert(!changed.includes(id));assert.deepEqual(current.find(set=>set.id===id),old.find(set=>set.id===id));}
const counts={sets:current.length,questions:current.reduce((sum,set)=>sum+set.subquestions.length,0),points:current.reduce((sum,set)=>sum+set.subquestions.reduce((total,question)=>total+question.criteria.reduce((n,criterion)=>n+criterion.max_points,0),0),0)};
assert.deepEqual(counts,{sets:372,questions:555,points:1889});assert.deepEqual(install.counts,counts);assert.equal(receipt.set_count,counts.sets);assert.equal(receipt.learning_classification_count,counts.questions);assert.equal(live.active.sets,counts.sets);

const priorSource=read(D+'/source-catalog.json'),finalSource=read(D+'/source-catalog-final.json');assert.deepEqual(finalSource.units,priorSource.units);assert.deepEqual(finalSource.sources,priorSource.sources);
const selectedUnits=new Set();
for(const worker of ['a','b','c']){
 const file=D+'/'+worker+'/design.json';inputs.push(ref(file));for(const design of read(file))for(const id of design.plan.source_unit_ids)selectedUnits.add(id);
}
const unitEvidence=[...selectedUnits].map(id=>{
 const unit=finalSource.units.find(unit=>unit.id===id),prior=priorSource.units.find(unit=>unit.id===id);assert(unit&&prior);assert.deepEqual(unit,prior);
 const source=finalSource.sources.find(source=>source.id===unit.sourceId);assert(source&&source.file===unit.file);assert.equal(ref(source.file).sha256,source.contentHash,'Selected source file changed since catalogue capture');assert(fs.readFileSync(unit.file,'utf8').includes(unit.quote),'Selected unit quote missing from unchanged source');
 inputs.push(ref(source.file));return {id,file:unit.file,source_sha256:source.contentHash,unit_content_hash:unit.contentHash,unit_metadata_sha256:sha(JSON.stringify(unit))};
});
const unique=new Map();for(const identity of inputs){assert(!unique.has(identity.file)||unique.get(identity.file)===identity.sha256);unique.set(identity.file,identity.sha256);}
const identities=[...unique].map(([file,sha256])=>({file,sha256}));for(const identity of identities)checkRef(identity);
const refs=[['bank',bank],['catalog',catalog],['classification',review]].map(([name,file])=>({name,...ref(file),snapshot:out+'/'+name+'.json'}));
fs.mkdirSync(out);
for(const identity of refs){fs.copyFileSync(identity.file,identity.snapshot,fs.constants.COPYFILE_EXCL);checkRef(identity);assert.equal(ref(identity.snapshot).sha256,identity.sha256);}
for(const identity of identities)checkRef(identity);
write(proofFile,{status:'passed_concurrent_standard_update_reconciliation',checked_at:new Date().toISOString(),method:'Reconstruct the current bank from the preserved starting bank using the exact recorded ten-set field changes and one appended review note per changed set; verify completed installation, applied receipt, roundtrip and root live read without another API call.',inputs:identities,expected_start_sha256:EXPECTED_OLD,current_sha256:EXPECTED_CURRENT,active_release_id:EXPECTED_RELEASE,counts,original_sets_preserved:362,prior_set_ids_preserved:372,prior_set_order_preserved:true,concurrent_updated_set_ids:changed,documented_field_changes:evidence,all_case_sets_preserved:caseIds,case_questions_preserved:183,model_answers_requirements_sources_scores_preserved:true,all_original_source_units_preserved:priorSource.units.length,selected_source_units:unitEvidence,source_unit_changes:[],human_review_performed:false,root_review:'pending_review_of_this_successor_code_and_output',api_calls:0,canonical_writes:0,db_writes:0});
write(recordFile,{created_at:new Date().toISOString(),reason:'제작 시작 후 별도 standard-new-verification/fix-v1 작업이 완료한 기준서형10세트의 문구·채점 안내 및 후속 검토 메모를 현재 정본·운영 DB 증거와 대조하여 수용했다. 시작 D 원본과 H/N 봉인을 보존하고 최신 정본을 새 사례의 통합 기준으로 동결한다. 새 사례의 학습 주제·출처 단위에는 변화가 없다.',prior_snapshot:D+'/bank-before.json',original_sets_preserved:362,prior_set_ids_preserved:372,prior_set_order_preserved:true,concurrent_added_set_ids:[],concurrent_updated_set_ids:changed,case_sets_preserved:70,case_questions_preserved:183,counts,concurrent_update_evidence:ref(proofFile),root_read_only_active_release:ref(R+'/production-baseline-read.json'),active_release_id:EXPECTED_RELEASE,...Object.fromEntries(refs.map(identity=>[identity.name,identity]))});
for(const identity of identities)checkRef(identity);
console.log(JSON.stringify({status:'baseline_captured',counts,original_sets_preserved:362,prior_set_ids_preserved:372,concurrent_updated_sets:changed.length,case_sets_preserved:70,source_units_preserved:priorSource.units.length,selected_source_units:unitEvidence.length,record:ref(recordFile),proof:ref(proofFile),api_calls:0,canonical_writes:0,db_writes:0},null,2));
