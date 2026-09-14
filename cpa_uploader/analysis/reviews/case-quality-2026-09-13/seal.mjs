import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../questionEfficientReview.ts';
const D='cpa_uploader/analysis/reviews/case-quality-2026-09-13',X=D+'/execution-v1',out=D+'/sealed-v1';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(name,x)=>fs.writeFileSync(out+'/'+name,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
assert(!fs.existsSync(out));const manifest=read(X+'/grading-manifest.json'),observations=[],summaries=[],all=[];
for(const worker of ['a','b','c']){
 const run=X+'/actual-'+worker,summary=read(run+'/summary.json');
 assert.equal(summary.status,'completed');assert.equal(summary.frozen_input_error,null);assert.deepEqual(summary.remaining_entry_ids,[]);
 assert.equal(summary.rows.length,manifest.entries.filter(e=>e.worker===worker).length);
 for(const row of summary.rows){assert(row.observation&&!row.error);assert.equal(ref(row.observation.file).sha256,row.observation.sha256);observations.push(row.observation);all.push(read(row.observation.file));}
 summaries.push({worker,...ref(run+'/summary.json')});
}
assert.equal(observations.length,manifest.entries.length);
const scores=all.flatMap(o=>o.subquestions.filter(q=>q.evaluated).map(q=>({entry_id:o.entry_id,source_set_id:o.source_set_id,kind:o.kind,...q})));
const outside=scores.filter(q=>!q.within_tolerance);
const findingsFile=D+'/residual-findings-v1.json';const findings=fs.existsSync(findingsFile)?read(findingsFile):[];
assert.equal(outside.length,findings.length,'Investigate every outside-tolerance result');
fs.mkdirSync(out);
const batch={version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(D+'/authorization.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:ref(X+'/grading-manifest.json'),observations,agent_reviews:read(X+'/agent-reviews.json'),runtime_snapshots:read(X+'/runtime-snapshots.json'),residual_grading_findings:findings};
write('batch.json',batch);const context=createEfficientValidationContext(),bank=read(manifest.bank.file);
const receipts=batch.agent_reviews.map(r=>createEfficientReviewReceipt(ref(out+'/batch.json'),bank.find(s=>s.id===r.set_id),context));
assertEfficientEvidenceUnchanged(context);write('receipts.json',receipts);
const usage=all.flatMap(o=>o.usage),costKnown=usage.every(u=>u.cost.status!=='unknown');
write('summary.json',{created_at:new Date().toISOString(),status:'passed',target_sets:receipts.length,target_questions:batch.agent_reviews.reduce((n,r)=>n+r.questions.length,0),requests:all.length,actual_sdk_calls:all.reduce((n,o)=>n+o.actual_sdk_calls,0),fixed_evaluated_answers:scores.length,exact_score_matches:scores.filter(q=>q.delta===0).length,within_tolerance:scores.filter(q=>q.within_tolerance).length,within_tolerance_ratio:scores.filter(q=>q.within_tolerance).length/scores.length,outside_tolerance:outside,scores,usage,known_cost:costKnown,estimated_cost_usd:costKnown?usage.reduce((n,u)=>n+(u.cost.usd??u.cost.max_usd),0):null,new_model_semantic_review_calls:0,statistical_confidence_claim:false,human_review_performed:false,run_summaries:summaries});
write('readiness.json',{ready:true,errors:[],batch:ref(out+'/batch.json'),receipt_count:receipts.length,validated_at:new Date().toISOString(),validated_files:[...context.files].map(([file,sha256])=>({file,sha256})),canonical_writes:0,db_writes:0,model_api_calls:0});
console.log(JSON.stringify({ready:true,receipts:receipts.length,evaluated:scores.length,exact:scores.filter(q=>q.delta===0).length,within:scores.filter(q=>q.within_tolerance).length}));
