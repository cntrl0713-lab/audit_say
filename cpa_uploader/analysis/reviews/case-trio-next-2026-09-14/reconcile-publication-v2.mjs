import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewedContentHash,publicationPaths} from '../../../questionBankPublication.ts';
const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',D='cpa_uploader/drafts/case-trio-next-2026-09-14',S='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2';
const pending=new Map();
const read=f=>JSON.parse(fs.readFileSync(f)),hash=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:hash(pending.get(file)??fs.readFileSync(file))});
const check=r=>assert.equal(ref(r.file).sha256,r.sha256,'Changed input: '+r.file);
const write=(file,v)=>{assert(!pending.has(file)&&!fs.existsSync(file));pending.set(file,Buffer.from(JSON.stringify(v,null,2)+'\n'));};
const B=R+'/integration-baseline-v2',canonical={...publicationPaths(),catalog:'cpa_uploader/data/learning-question-classifications.json'};
assert(!fs.existsSync(B));assert(!fs.existsSync(R+'/publication-reconciliation-v2.json'));
const initialFiles=[...Object.values(canonical),S+'/changes.json',S+'/publication-v1/install-completion.json',S+'/db-publication-v1/receipt.json',S+'/db-publication-v1/roundtrip.json',R+'/production-baseline-read-v2.json',R+'/integration-baseline/bank.json',R+'/integration-baseline/catalog.json',R+'/publication-v1/preparation.json',R+'/publication-v1/stage/authoring.json',R+'/publication-v1/stage/promotions.json',R+'/publication-v1/backup/ledger.json',R+'/publication-v1/02-verify-new.result.json',R+'/publication-v1/03-publish.result.json',R+'/sealed-v1/batch.json',R+'/sealed-v1/readiness.json',R+'/sealed-v1/receipts.json',R+'/changed-sets-v1.json',R+'/candidate-v1.json',R+'/classification-v1.json',R+'/reconcile-publication-v2.mjs'].map(ref);
const originalPreparation=read(R+'/publication-v1/preparation.json'),sealedReady=read(R+'/sealed-v1/readiness.json');
assert.equal(sealedReady.ready,true);check(sealedReady.batch);assert.equal(sealedReady.batch.file,R+'/sealed-v1/batch.json');
const protectedEvidence=[...originalPreparation.immutable,...sealedReady.validated_files];protectedEvidence.forEach(check);
const guardInitial=()=>{initialFiles.forEach(check);protectedEvidence.forEach(check);};
const changes=read(S+'/changes.json'),installed=read(S+'/publication-v1/install-completion.json'),receipt=read(S+'/db-publication-v1/receipt.json'),roundtrip=read(S+'/db-publication-v1/roundtrip.json');
const latest=read(canonical.authoring),old=read(R+'/integration-baseline/bank.json'),classes=read(canonical.catalog),oldClasses=read(R+'/integration-baseline/catalog.json');
initialFiles.push(ref(classes.review_file));
assert.equal(classes.review_file_sha256,ref(classes.review_file).sha256);
const live=read(R+'/production-baseline-read-v2.json');
assert.equal(changes.baseline_bank.sha256,ref(R+'/integration-baseline/bank.json').sha256);
assert.equal(changes.edited_bank.sha256,'67a8738f4f9dc959ca52a213c7e07b224836fc3a94effe1f20b56090d01f9da7');
check(changes.edited_bank);assert.equal(ref(canonical.authoring).sha256,changes.edited_bank.sha256);
assert.equal(installed.status,'canonical_installed_and_validated');installed.files.forEach(check);
assert.equal(receipt.applied,true);assert.equal(receipt.source_file_hash,changes.edited_bank.sha256);assert.equal(roundtrip.status,'passed');
assert.equal(roundtrip.after.active.release_id,receipt.release_id);assert.equal(roundtrip.source_file_hash,receipt.source_file_hash);
assert.equal(live.project,'xvifzicrjmbfqaepcfpp');assert.equal(live.read_only,true);assert.equal(live.active.release_id,receipt.release_id);assert.equal(live.active.source_file_hash,receipt.source_file_hash);assert.equal(live.active.actual_source_hash,receipt.source_file_hash);
assert.equal(latest.length,372);assert.deepEqual(latest.map(s=>s.id),old.map(s=>s.id));
assert.equal(changes.changed_sets.length,21);const changed=latest.filter((s,i)=>JSON.stringify(s)!==JSON.stringify(old[i])).map(s=>s.id);
assert.deepEqual([...changed].sort(),[...changes.changed_sets].sort());
const patched=structuredClone(old),fieldChanges=[];
for(const row of changes.changes){
 const s=patched.find(s=>s.id===row.set_id),q=s.subquestions.find(q=>q.id===row.subquestion_id);assert(q);assert.equal(s.subquestions.length,1);
 for(const f of row.fields){
  let obj,key,match;
  if(f.field==='title'){obj=s;key='title';}
  else if(f.field==='subquestions[0].prompt'){obj=q;key='prompt';}
  else if((match=/^model_answer\[(\d+)\]$/.exec(f.field))){obj=q.model_answer;key=Number(match[1]);}
  else if((match=/^criteria\.(.+)\.critical_facts\.(.+)$/.exec(f.field))){const c=q.criteria.find(c=>c.id===match[1]);assert(c);obj=c.critical_facts.find(c=>c.id===match[2]);assert(obj);key='expected';}
  else if((match=/^criteria\.(.+)\.claim$/.exec(f.field))){obj=q.criteria.find(c=>c.id===match[1]);assert(obj);key='claim';}
  else assert.fail('Undocumented field shape '+f.field);
  assert.equal(obj[key],f.before);obj[key]=f.after;fieldChanges.push({set_id:s.id,...f});
 }
 const current=latest.find(x=>x.id===s.id);assert.equal(current.verification.notes.length,s.verification.notes.length+1);assert.deepEqual(current.verification.notes.slice(0,-1),s.verification.notes);assert(current.verification.notes.at(-1).includes('fix-v2'));s.verification.notes.push(current.verification.notes.at(-1));
}
assert.deepEqual(patched,latest,'More than the exact documented wording edits changed');
assert.equal(classes.source_file_sha256,ref(canonical.authoring).sha256);assert.equal(classes.classifications.length,555);assert.deepEqual(classes.topics,oldClasses.topics);
const caseIds=[...new Set(oldClasses.classifications.filter(c=>c.question_style==='case').map(c=>c.source_set_id))];assert.equal(caseIds.length,70);
for(const id of caseIds){assert(!changed.includes(id));assert.deepEqual(latest.find(s=>s.id===id),old.find(s=>s.id===id));}
for(const row of classes.classifications){const prior=oldClasses.classifications.find(c=>c.source_set_id===row.source_set_id&&c.subquestion_id===row.subquestion_id);assert(prior);for(const key of ['question_style','topic_ids','case_set_id','case_fact_ids','learning_question_id'])assert.deepEqual(row[key],prior[key]);if(changed.includes(row.source_set_id)){assert.equal(row.question_style,'standard');assert.equal(row.standalone_prompt,latest.find(s=>s.id===row.source_set_id).subquestions.find(q=>q.id===row.subquestion_id).prompt);}else assert.deepEqual(row,prior);}
const totals=s=>({sets:s.length,questions:s.flatMap(s=>s.subquestions).length,points:s.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0)});assert.deepEqual(totals(latest),{sets:372,questions:555,points:1889});
assert.deepEqual(read(D+'/source-catalog-final.json').units,read(D+'/source-catalog.json').units);
const proofInputs=[S+'/changes.json',S+'/publication-v1/install-completion.json',S+'/db-publication-v1/receipt.json',S+'/db-publication-v1/roundtrip.json',R+'/production-baseline-read-v2.json',R+'/reconcile-publication-v2.mjs'].map(ref);
guardInitial();const refs=[];
for(const [name,file] of [...Object.entries(canonical),['classification',classes.review_file]]){const r={name,...ref(file),snapshot:B+'/'+(name==='authoring'?'bank':name)+'.json'};assert(!pending.has(r.snapshot)&&!fs.existsSync(r.snapshot));pending.set(r.snapshot,fs.readFileSync(file));check(r);assert.equal(ref(r.snapshot).sha256,r.sha256);refs.push(r);}
write(R+'/integration-baseline-v2.json',{created_at:new Date().toISOString(),reason:'実측 후 별도 작업이 완료한21세트의 약칭·문단표기 수정을 정확한 필드별로 재구성하여 보존한 새 게시 기준이다. 이전10세트 수정도 이 은행에 포함된다. 최초 실행·승급·검토 기록은 변경하지 않는다.',counts:totals(latest),prior_snapshot:R+'/integration-baseline/bank.json',original_sets_preserved:351,prior_set_ids_preserved:372,concurrent_updated_set_ids:changed,case_sets_preserved:70,active_release_id:receipt.release_id,source_evidence:proofInputs,...Object.fromEntries(refs.map(r=>[r.name==='authoring'?'bank':r.name,r]))});
write(R+'/integration-baseline-v2-root-review.json',{status:'accepted',method:'agent_manual_concurrent_edit_review',human_review_performed:false,reviewed_at:new Date().toISOString(),baseline:ref(R+'/integration-baseline-v2.json'),evidence:proofInputs,field_changes:fieldChanges,reason:'KGA 약칭을 감사기준서로 풀고1200 첫언급의 공식제목 및 문단띄어쓰기를 맞춘21세트다. pilot18두개는 동일표현을 모범답안·기준에도 일치시킨다. 정확한문자열변경과후속메모 이외의차이가없고 요구·배점·출처·유형·모든70사례가불변임을 확인했다. 사용자의 이 작업 범위에 속하지 않는 다른 수정은 현재 게시상태 그대로 보존한다.',unresolved_findings:[]});
const original=R+'/publication-v1',results=['02-verify-new','03-publish'].map(n=>{const f=original+'/'+n+'.result.json',r=read(f);assert.equal(r.exit_code,0);check(r.log);return ref(f);});
const originalBank=read(original+'/stage/authoring.json'),originalLedger=read(original+'/stage/promotions.json'),originalPrior=read(original+'/backup/ledger.json');
assert.deepEqual(originalLedger.entries.slice(0,originalPrior.entries.length),originalPrior.entries);
const ids=read(R+'/changed-sets-v1.json'),graded=read(R+'/candidate-v1.json'),add=ids.map(id=>originalBank.find(s=>s.id===id)),entries=originalLedger.entries.slice(originalPrior.entries.length);
assert.equal(ids.length,3);assert.equal(entries.length,6);assert(entries.every(e=>ids.includes(e.set_id)));assert(ids.every(id=>!latest.some(s=>s.id===id)));
const sealedReceipts=read(R+'/sealed-v1/receipts.json');
for(const s of add){assert(s);assert.equal(s.status,'published');assert.equal(s.verification.review_status,'verified');assert.equal(reviewedContentHash(s),reviewedContentHash(graded.find(g=>g.id===s.id)));const rows=entries.filter(e=>e.set_id===s.id);assert.deepEqual(rows.map(e=>[e.from_status,e.to_status]),[['needs_review','verified'],['verified','published']]);const receipt=sealedReceipts.find(r=>r.set_id===s.id);assert(receipt);assert.equal(receipt.content_hash,reviewedContentHash(s));assert.deepEqual(receipt.batch,sealedReady.batch);check(receipt.batch);assert.deepEqual(rows[0].efficient_review,receipt);assert(rows.every(e=>e.content_hash===reviewedContentHash(s)&&e.review_receipt_hash===receipt.receipt_hash));}
const candidate=[...latest,...add],ledger=read(canonical.ledger);const newLedger=structuredClone(ledger);newLedger.entries.push(...entries);
const candidateFile=R+'/candidate-publication-v2.json',classificationFile=R+'/classification-publication-v2.json',promotionsFile=R+'/promotions-publication-v2.json';
write(candidateFile,candidate);write(promotionsFile,newLedger);
const newClassifications=read(R+'/classification-v1.json').entries.filter(e=>ids.includes(e.set_id));assert.equal(newClassifications.length,9);
write(classificationFile,{source_file:candidateFile,source_file_sha256:ref(candidateFile).sha256,entries:[...read(classes.review_file).entries,...newClassifications]});
const originalFiles=['stage/authoring.json','stage/promotions.json','backup/ledger.json','preparation.json'].map(f=>ref(original+'/'+f));
const rootProof=R+'/publication-reconciliation-v2-root-proof.json';
write(rootProof,{status:'passed',new_set_ids:ids,reused_new_ledger_entries:6,human_review_performed:false,model_api_calls:0,baseline_review:ref(R+'/integration-baseline-v2-root-review.json'),reason:'최신372개 원문과 분류를 그대로 보존하고 기존03 성공결과의 동일한3개 게시문항·6개 세트별 전이를 추가했다. 동일 sealed-v1 검토내용 해시이며 재채점하거나 과거 실행판정을 변경하지 않는다.'});
guardInitial();proofInputs.forEach(check);refs.forEach(check);
write(R+'/publication-reconciliation-v2.json',{status:'reconciled_latest_baseline_with_original_case_transitions',created_at:new Date().toISOString(),files:[candidateFile,classificationFile,promotionsFile,rootProof].map(ref),original_stage_results:results,original_stage_files:originalFiles,baseline:ref(R+'/integration-baseline-v2.json'),original_classification:ref(R+'/classification-v1.json'),preserved_evidence:[original+'/preparation.json',original+'/backup/ledger.json',R+'/sealed-v1/batch.json',R+'/sealed-v1/readiness.json',R+'/integration-baseline-v2-root-review.json'].map(ref),new_set_ids:ids,reused_new_ledger_entries:6,counts:totals(candidate),human_review_performed:false,model_api_calls:0,reason:'원 격리게시본의 성공한 세트별 검증·게시 전이6행과3개최종문항 객체를 바이트/내용해시로 대조하여 최신372세트와승급장부에 추가한다. 입력문항/실제Luna/기존receipt는 그대로이며 배경은행변경만 반영한다. 원stage의후속CAS중단은 별도기록이고 전체검증은새publication-v2에서 수행한다.'});
guardInitial();fs.mkdirSync(B);for(const [file,bytes] of pending)fs.writeFileSync(file,bytes,{flag:'wx'});
for(const [file,bytes] of pending)assert.equal(hash(fs.readFileSync(file)),hash(bytes));guardInitial();
console.log({reconciled:true,counts:totals(candidate),new_set_ids:ids,active_release_id:receipt.release_id,field_changes:fieldChanges.length});
