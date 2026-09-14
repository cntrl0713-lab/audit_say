import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicationPaths,loadPromotionLedger,validateAuthoringBank,validatePromotionLedger,reviewedContentHash,writePublicationFiles,withPublicationLock} from '../../../questionBankPublication.ts';
import {createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../questionEfficientReview.ts';
import {createSubsetReviewReceipt} from '../../../questionSubsetReview.ts';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const json=x=>JSON.stringify(x,null,2)+'\n';
const paths=publicationPaths();
assert(paths.authoring.replaceAll('\\','/').includes('/'+R+'/publication-v1/stage/'),'Only isolated publication stage may be changed');
const routing=read(R+'/publication-review-routing.json');
const expectedIds=[...read(R+'/candidate-v3/new-sets.json').map(s=>s.id),...read(R+'/candidate-v3/retained-subsets.json').map(s=>s.set_id)].sort();
assert.deepEqual(routing.entries.map(r=>r.set_id).sort(),expectedIds);
assert(new Set(expectedIds).size===expectedIds.length);
const inputs=[ref(paths.authoring),ref(paths.ledger),ref(R+'/publication-review-routing.json'),...new Map(routing.entries.map(r=>[r.evidence.file,r.evidence])).values()];
const guard=()=>{for(const p of inputs)assert.equal(ref(p.file).sha256,p.sha256);};
withPublicationLock(paths.authoring,()=>{
 guard();const sets=read(paths.authoring),ledger=loadPromotionLedger(paths.ledger),originalEntries=structuredClone(ledger.entries);
 const context=createEfficientValidationContext(),date=new Date().toISOString().slice(0,10),receipts=[];
 for(const row of routing.entries){
  const set=sets.find(s=>s.id===row.set_id);assert(set);
  const efficient=row.method==='efficient',subset=row.method==='subset';assert(efficient||subset);
  const receipt=efficient?createEfficientReviewReceipt(row.evidence,set,context):createSubsetReviewReceipt(row.evidence,set,context);
  assert.equal(receipt.content_hash,reviewedContentHash(set));
  const summary=efficient?{units:receipt.reviewed_units,cases:receipt.observed_answers,method:receipt.method,verdict:'pass'}:{units:receipt.contracts.length,cases:0,method:receipt.method,verdict:'pass'};
  ledger.entries.push({set_id:set.id,from_status:set.status,to_status:'verified',date,evidence:row.evidence.file,content_hash:reviewedContentHash(set),...(efficient?{efficient_review:receipt}:{subset_review:receipt}),review_receipt_hash:receipt.receipt_hash,review_summary:summary});
  set.status='verified';set.verification.review_status='verified';
  receipts.push({set_id:set.id,receipt});
 }
 // Validate every new proof in the complete transaction before publishing any set.
 assert.deepEqual(validateAuthoringBank(sets).errors,[]);
 assert.deepEqual(validatePromotionLedger(sets,ledger,true,{efficientContext:context}),[]);
 for(const {set_id,receipt} of receipts){const set=sets.find(s=>s.id===set_id);ledger.entries.push({set_id,from_status:'verified',to_status:'published',date,evidence:receipt.method==='question_deletion_contract_derivation'?receipt.manifest.file:receipt.batch.file,content_hash:reviewedContentHash(set),review_receipt_hash:receipt.receipt_hash});set.status='published';}
 assert.deepEqual(ledger.entries.slice(0,originalEntries.length),originalEntries);
 assert.deepEqual(validatePromotionLedger(sets,ledger,true,{efficientContext:context}),[]);
 assert(sets.every(s=>s.status==='published'&&s.verification.review_status==='verified'));
 assertEfficientEvidenceUnchanged(context);guard();
 writePublicationFiles([{file:paths.authoring,content:json(sets)},{file:paths.ledger,content:json(ledger)}],inputs.slice(0,2).map(r=>({file:r.file,hash:r.sha256})));
 fs.writeFileSync(R+'/publication-v1/stage/receipt-transaction.json',json({status:'all_receipts_validated_before_atomic_stage_write',sets:receipts.length,entries_appended:receipts.length*2,original_entries_preserved:true,receipts}),{flag:'wx'});
 console.log(JSON.stringify({validated_sets:receipts.length,entries_appended:receipts.length*2,canonical_writes:0,db_writes:0}));
});
