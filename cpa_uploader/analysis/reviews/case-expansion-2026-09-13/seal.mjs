import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../questionEfficientReview.ts';
const D='cpa_uploader/analysis/reviews/case-expansion-2026-09-13',X=D+'/execution-resume-v4',V=D+'/execution-v1',out=D+'/sealed-v1';
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
const batch={version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(D+'/authorization.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:ref(X+'/grading-manifest.json'),observations,agent_reviews:read(V+'/agent-reviews.json'),runtime_snapshots:read(X+'/runtime-snapshots.json'),residual_grading_findings:findings};
write('batch.json',batch);const context=createEfficientValidationContext(),bank=read(manifest.bank.file);
const receipts=batch.agent_reviews.map(r=>createEfficientReviewReceipt(ref(out+'/batch.json'),bank.find(s=>s.id===r.set_id),context));
assertEfficientEvidenceUnchanged(context);write('receipts.json',receipts);
const executionSummaries=[V,D+'/execution-resume-v2',X].flatMap(dir=>['a','b','c'].map(w=>({file:dir+'/actual-'+w+'/summary.json',...read(dir+'/actual-'+w+'/summary.json')})));
const usage=executionSummaries.flatMap(s=>s.new_usage),actualCalls=executionSummaries.reduce((n,s)=>n+s.actual_sdk_calls,0);
const unknown=usage.filter(u=>u.cost.status==='unknown').length,bounded=usage.filter(u=>u.cost.status==='bounded_missing_cache_write').length;
const unaccounted=actualCalls-usage.length;assert(unaccounted>=0);
const costKnown=unknown===0&&bounded===0&&unaccounted===0;
const accounting={actual_sdk_calls:actualCalls,requests_without_returned_usage:unaccounted,unknown_cost_responses:unknown,bounded_cost_responses:bounded,
 provider_token_totals:Object.fromEntries(['input_tokens','output_tokens','total_tokens'].map(k=>[k,usage.every(u=>Number.isSafeInteger(u.provider.usage?.[k]))?usage.reduce((n,u)=>n+u.provider.usage[k],0):null])),
 accounted_min_usd:unknown?null:usage.reduce((n,u)=>n+u.cost.min_usd,0),accounted_max_usd:unknown?null:usage.reduce((n,u)=>n+u.cost.max_usd,0)};
write('summary.json',{created_at:new Date().toISOString(),status:'passed',target_sets:receipts.length,target_questions:batch.agent_reviews.reduce((n,r)=>n+r.questions.length,0),requests:all.length,actual_sdk_calls:actualCalls,successful_observation_sdk_calls:all.reduce((n,o)=>n+o.actual_sdk_calls,0),execution_summaries:executionSummaries.map(s=>ref(s.file)),recovery:ref(X+'/recovery.json'),reused_observations:manifest.reused_observations.length,fixed_evaluated_answers:scores.length,exact_score_matches:scores.filter(q=>q.delta===0).length,within_tolerance:scores.filter(q=>q.within_tolerance).length,within_tolerance_ratio:scores.filter(q=>q.within_tolerance).length/scores.length,outside_tolerance:outside,scores,usage,known_cost:costKnown,estimated_cost_usd:costKnown?usage.reduce((n,u)=>n+u.cost.usd,0):null,accounting,new_model_semantic_review_calls:0,statistical_confidence_claim:false,human_review_performed:false,run_summaries:summaries});
write('readiness.json',{ready:true,errors:[],batch:ref(out+'/batch.json'),receipt_count:receipts.length,validated_at:new Date().toISOString(),validated_files:[...context.files].map(([file,sha256])=>({file,sha256})),canonical_writes:0,db_writes:0,model_api_calls:0});
console.log(JSON.stringify({ready:true,receipts:receipts.length,evaluated:scores.length,exact:scores.filter(q=>q.delta===0).length,within:scores.filter(q=>q.within_tolerance).length}));
