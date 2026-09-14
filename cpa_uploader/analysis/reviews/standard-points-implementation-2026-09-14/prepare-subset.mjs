import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSubsetReviewReceipt} from '../../../questionSubsetReview.ts';
import {createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../questionEfficientReview.ts';
import {reviewedContentHash,sha256} from '../../../questionReviewIdentity.ts';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const dest=R+'/subset-batch-v1';
fs.mkdirSync(dest,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const identity=file=>({file,sha256:sha256(fs.readFileSync(file))});
const write=(name,value)=>fs.writeFileSync(dest+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const original=read(R+'/bank.snapshot.json'),candidate=read(R+'/candidate-v1/bank.json');
const excluded=new Set(read(R+'/subset-regrade-required.json').sets.map(s=>s.set_id));
const subsets=read(R+'/candidate-v1/retained-subsets.json').filter(s=>!excluded.has(s.set_id));
const manifest={version:1,artifact_type:'question_deletion_derivation_manifest',bank:identity(R+'/bank.snapshot.json'),catalog:identity(R+'/catalog.snapshot.json'),promotions:identity(R+'/promotions.snapshot.json'),authorization:{evidence:identity(R+'/baseline.json'),statement:read(R+'/baseline.json').authorization,question_deletion_and_publication:true},targets:subsets.map(row=>({set_id:row.set_id,source_content_hash:reviewedContentHash(original.find(s=>s.id===row.set_id)),content_hash:reviewedContentHash(candidate.find(s=>s.id===row.set_id)),removed_subquestion_ids:row.removed_subquestion_ids}))};
write('manifest.json',manifest);
const context=createEfficientValidationContext(),receipts=[],failures=[];
for(const target of manifest.targets){
 try {const receipt=createSubsetReviewReceipt(identity(dest+'/manifest.json'),candidate.find(s=>s.id===target.set_id),context);receipts.push(receipt); console.log('PASS '+target.set_id);}
 catch(error){failures.push({set_id:target.set_id,error:String(error)});console.log('FAIL '+target.set_id+' '+String(error));}
}
assertEfficientEvidenceUnchanged(context);
write('receipts.json',{version:1,artifact_type:'question_deletion_derivation_preflight',new_model_calls:0,new_human_review:false,receipts,failures});
write('checks.json',{targets:manifest.targets.length,passed:receipts.length,failed:failures.length,excluded:[...excluded],evidence_files:[...context.files].map(([file,sha256])=>({file,sha256})),publication_performed:false});
assert.equal(failures.length,0,JSON.stringify(failures));
