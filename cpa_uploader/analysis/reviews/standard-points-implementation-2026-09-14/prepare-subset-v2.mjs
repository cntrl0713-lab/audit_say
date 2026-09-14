import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSubsetReviewReceipt} from '../../../questionSubsetReview.ts';
import {createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../questionEfficientReview.ts';
import {sha256} from '../../../questionReviewIdentity.ts';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14',dest=R+'/subset-batch-v2';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const identity=file=>({file,sha256:sha256(fs.readFileSync(file))});
const v1=read(R+'/subset-batch-v1/receipts.json'),manifest=read(R+'/subset-batch-v1/manifest.json');
const passed=new Set(v1.receipts.map(r=>r.set_id));
assert.equal(passed.size,50);assert.equal(v1.failures.length,1);
manifest.targets=manifest.targets.filter(t=>passed.has(t.set_id));
assert.equal(manifest.targets.length,50);
fs.mkdirSync(dest,{recursive:true});
const write=(name,value)=>fs.writeFileSync(dest+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('manifest.json',manifest);
const candidate=read(R+'/candidate-v1/bank.json'),context=createEfficientValidationContext(),receipts=[],failures=[];
for(const target of manifest.targets){
 try{receipts.push(createSubsetReviewReceipt(identity(dest+'/manifest.json'),candidate.find(s=>s.id===target.set_id),context));console.log('PASS '+target.set_id);}
 catch(error){failures.push({set_id:target.set_id,error:String(error)});console.log('FAIL '+target.set_id+' '+String(error));}
}
assertEfficientEvidenceUnchanged(context);
write('receipts.json',{version:1,artifact_type:'question_deletion_derivation_preflight',new_model_calls:0,new_human_review:false,receipts,failures});
write('checks.json',{targets:manifest.targets.length,passed:receipts.length,failed:failures.length,
 prior_preflight:identity(R+'/subset-batch-v1/receipts.json'),excluded_after_preflight:v1.failures,
 candidate:identity(R+'/candidate-v1/bank.json'),implementation_files:['cpa_uploader/questionSubsetReview.ts','cpa_uploader/questionBankPublication.ts','cpa_uploader/promote_cpa_v3.ts','tests/questionSubsetReview.test.ts'].map(identity),
 evidence_files:[...context.files].map(([file,sha256])=>({file,sha256})),publication_performed:false});
assert.equal(failures.length,0,JSON.stringify(failures));
