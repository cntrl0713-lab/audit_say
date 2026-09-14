// 미게시 기준서형 세 배치(27세트·43물음)의 비용 통제 수락 증거를 준비한다.
// 원 Luna 요청·응답을 현재 앱 투영·채점 코드로 재처리할 뿐 새 모델 호출은 하지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14/prepare.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTENT_CHECKS,EFFICIENT_RUNTIME_FILES,createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../questionReviewIdentity.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {compileLearningCatalog} from '../../../../scripts/build-learning-unit-catalog.ts';
import {selectLearningQuestionSet,learningUnitId} from '../../../../lib/learningUnits.ts';
import {buildGradingPrompt,buildGradingResponseSchema,groundJudgment,applyQuestionSetJudgment} from '../../../../lib/questionV3Grading.ts';
import {contentHash} from '../../../../lib/learningSubmission.ts';
const P='cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
const text=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,v,{flag:'wx'});return ref(file);};
assert(!fs.existsSync(P+'/batch.json'),'새 수락 증거를 덮어쓸 수 없음');
const BATCHES=[
 {prefix:'gap',dir:'cpa_uploader/drafts/standard-gap-2026-09-13',runFor:id=>id.startsWith('g09-sub1-')?'run-v2':id.startsWith('g08-sub1-')||id.startsWith('g10-sub1-')?'run-v3':'run-v1',runs:['run-v1','run-v2','run-v3'],
  evidence:['agent-review.json','verification-receipt.json','qa-representatives.json','coverage-before.json','coverage-added.json','sources/provenance.json','grading/correction-v2.json','grading/correction-v3.json']},
 {prefix:'exp',dir:'cpa_uploader/drafts/standard-expansion-2026-09-13',runFor:()=>'run-v1',runs:['run-v1'],
  evidence:['agent-review.json','verification-receipt.json','discrepancy-analysis.json','qa-representatives.json','research.json','comparison-inventory.json','coverage-review.json','sources/provenance.json','sources/visual-review.json']},
 {prefix:'fol',dir:'cpa_uploader/drafts/standard-followup-2026-09-13',runFor:()=>'run-v1',runs:['run-v1'],
  evidence:['agent-review.json','verification-receipt.json','discrepancy-analysis.json','source-boundary-review.json','qa-representatives.json','research.json','comparison-inventory.json','coverage-review.json','sources/provenance.json']},
];
const canonical={authoring:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',ledger:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json',encrypted:'data/cpa_question_sets_v3.authoring.enc.json',catalog:'cpa_uploader/data/learning-question-classifications.json'};
const dbBaseline=read(P+'/db-baseline.json'),rereview=read(P+'/current-review.json');
assert.equal(ref(canonical.authoring).sha256,dbBaseline.canonical.sha256,'운영 대조 후 정본 변경');
assert.equal(ref(canonical.authoring).sha256,rereview.bank.sha256,'재검토 후 정본 변경');
assert.equal(dbBaseline.release.source_file_hash,dbBaseline.canonical.sha256,'운영 릴리스와 정본이 다름');
const baseline=Object.entries(canonical).map(([name,file])=>{const copy=P+'/baseline/'+name+'.json';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{name,...ref(file),backup:copy};});
write(P+'/baseline.json',baseline);
const original=read(canonical.authoring),oldCatalog=read(canonical.catalog);
const files=[P+'/authorization.md',P+'/prepare.mjs',P+'/current-review.json',P+'/current-review.mjs',P+'/db-baseline.json',P+'/db-baseline.mjs'];
const additions=[],reviews=new Map(),qaByBatch=new Map(),originManifests=[];
for(const b of BATCHES){
 const index=read(b.dir+'/index.json'),review=read(b.dir+'/agent-review.json');
 // agent 검토 당시 입력(은행 제외)과 최종 receipt의 초안 파일이 현재 바이트와 같아야 재사용한다. 은행 변경은 current-review.json에서 재대조했다.
 const reviewedInputs={content:b.dir+'/content.mjs',source:b.dir+(b.prefix==='gap'?'/sources/kga-2026-excerpts.txt':'/sources/official-excerpts.txt'),research:b.dir+'/research.json',gap_evidence:'cpa_uploader/analysis/reviews/standard-question-gaps-2026-09-13/evidence.json'};
 for(const [name,hash] of Object.entries(review.input_hashes)){if(name==='bank')continue;assert(reviewedInputs[name],'알 수 없는 검토 입력: '+name);assert.equal(ref(reviewedInputs[name]).sha256,hash,'검토 후 입력 변경: '+name);}
 for(const h of read(b.dir+'/verification-receipt.json').input_hashes)assert.equal(ref(h.file).sha256,h.sha256,'실측 후 초안 변경: '+h.file);
 for(const run of b.runs){const m=b.dir+'/grading/'+run+'/manifest.json';originManifests.push(ref(m));for(const g of read(m).inputs.filter(g=>g.file.startsWith('lib/')||g.file==='package-lock.json'))assert.equal(ref(g.file).sha256,g.sha256,'채점 runtime 변경: '+g.file);}
 for(const row of index.sets){const set=read(row.file);assert(!original.some(s=>s.id===set.id));additions.push(set);files.push(row.file,row.file+'.authoring-plan.json');}
 for(const q of review.questions)reviews.set(q.question,{...q,batch:b});
 qaByBatch.set(b.prefix,read(b.dir+'/qa-representatives.json').cases);
 files.push(...b.evidence.map(f=>b.dir+'/'+f));
}
assert.equal(additions.length,27);assert.equal(additions.flatMap(s=>s.subquestions).length,43);
const bank=[...original,...additions];assert.deepEqual(validateAuthoringBank(bank).errors,[]);
const bankRef=write(P+'/evidence-bank.json',bank);
for(const s of original)for(const c of oldCatalog.classifications.filter(c=>c.source_set_id===s.id))assert.equal(c.source_content_hash,contentHash(s));
const entries=oldCatalog.classifications.map(c=>({set_id:c.source_set_id,subquestion_id:c.subquestion_id,question_style:c.question_style,topic_ids:c.topic_ids,standalone_prompt:c.standalone_prompt,case_fact_ids:c.case_fact_ids??[],reason:'내용이 동일한 기존 정본의 확인된 분류를 보존한다.'}));
const recheck=new Map(rereview.questions.map(q=>[q.question,q]));
for(const s of additions)for(const q of s.subquestions){
 const key=`${s.id}/${q.id}`,r=reviews.get(key),c=recheck.get(key);
 assert(r&&r.unresolved_items.length===0&&r.status==='content_reviewed'&&r.question_style==='standard'&&q.question_style==='standard');
 assert(c&&c.decision==='publish');assert.deepEqual(r.topics,q.topic_ids);
 entries.push({set_id:s.id,subquestion_id:q.id,question_style:q.question_style,topic_ids:q.topic_ids,standalone_prompt:q.prompt,case_fact_ids:[],reason:r.style_reason+' '+r.topic_reason});
}
const classificationReview=write(P+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries});
const compiled=compileLearningCatalog(bank,entries,oldCatalog.topics);
const catalogRef=write(P+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,review_file:classificationReview.file,review_file_sha256:classificationReview.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
const scope=write(P+'/scope.json',{targets:additions.map(s=>({set_id:s.id,subquestion_ids:s.subquestions.map(q=>q.id)}))});
const reprocessed=BATCHES.reduce((n,b)=>n+qaByBatch.get(b.prefix).length,0);
const policy=write(P+'/policy.json',{scope,model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:null,budget_enforcement:'not_specified',new_api_calls:0,original_model_responses_reprocessed:reprocessed,origin_manifests:originManifests});
const representatives=new Map(BATCHES.map(b=>[b.prefix,write(P+'/representatives-'+b.prefix+'.json',{origin:ref(b.dir+'/qa-representatives.json'),cases:qaByBatch.get(b.prefix).map(c=>({...c,expected_points:c.expected_score,expected_verdicts:c.expected_criteria}))})]));
const agentReviews=additions.map(s=>{
 const b=reviews.get(`${s.id}/${s.subquestions[0].id}`).batch;
 return{set_id:s.id,content_hash:reviewedContentHash(s),reviewer_id:'원 제작 agent 내용검토(2026-09-13) + Claude Code agent 게시 전 재검토(2026-09-14)',reviewed_at:'2026-09-14',method:'agent_content_review',human_review_performed:false,
  evidence:[...new Set([...b.evidence.map(f=>b.dir+'/'+f),P+'/current-review.json',P+'/authorization.md'])].map(ref),
  questions:s.subquestions.map(q=>{const key=`${s.id}/${q.id}`,r=reviews.get(key),c=recheck.get(key);
   return{subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id),source_ref_ids:[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(c=>c.source_ref_ids)])],checks:Object.fromEntries(CONTENT_CHECKS.map(c=>[c,'pass'])),
    rationale:[r.point_rationale,r.comparison.reason,r.style_reason,c.content_recheck,`게시 전 재대조: 이후 정본에 추가·변경된 같은 기준 물음 ${c.newer_bank_neighbors.length}개와 요구가 다름.`].join(' ')};}),
  unresolved_content_findings:[]};
});
write(P+'/agent-reviews.json',agentReviews);
const jobs=[];
for(const b of BATCHES)for(const c of qaByBatch.get(b.prefix)){
 const source=additions.find(s=>s.id===c.set_id),unit=learningUnitId(source.id,'standard',c.subquestion_id),id=b.prefix+'-'+c.id;
 const meta=compiled.classifications.filter(m=>m.source_set_id===source.id&&m.subquestion_id===c.subquestion_id);
 const set=selectLearningQuestionSet(source,meta,unit),old=b.dir+'/grading/'+b.runFor(c.id)+'/'+c.id;
 const oldInput=read(old+'.input.json');assert.deepEqual(oldInput.case,c);assert.deepEqual(oldInput.projected_set,set);assert.deepEqual(oldInput.answers,{[c.subquestion_id]:c.answer});
 const projected=write(P+'/projections/'+id+'.json',set),answers=oldInput.answers;
 const expected=[{subquestion_id:c.subquestion_id,expected_points:c.expected_score,expected_verdicts:c.expected_criteria}];
 const entry={id,source_set_id:source.id,learning_unit_id:unit,kind:c.role,projected_file:projected.file,projected_sha256:projected.sha256,evaluated_subquestion_ids:[c.subquestion_id],answers,expected_by_subquestion:expected,selection_evidence:[{...(c.role==='model'?bankRef:representatives.get(b.prefix)),subquestion_id:c.subquestion_id,case_id:c.role==='model'?null:c.id,kind:c.role,reason:c.selection_reason}]};
 const prompt=buildGradingPrompt(set,answers),schema=buildGradingResponseSchema(set,answers);
 assert(!fs.existsSync(old+'.request-2.json'),'재시도 요청은 이 재처리 범위 밖');
 const request=read(old+'.request-1.json'),wire=read(old+'.response-1.json'),traces=read(old+'.trace.json'),usage=read(old+'.usage.json');
 assert.equal(request.params.input,prompt);assert.deepEqual(request.params.text.format.schema,schema);
 const judgment=groundJudgment(traces.at(-1).response,set,answers),result=applyQuestionSetJudgment(set,answers,judgment);assert.deepEqual(result,read(old+'.result.json').result);
 const comparisons=result.subquestions.map(q=>{const e=expected.find(e=>e.subquestion_id===q.subquestion_id),delta=q.score-e.expected_points;return{subquestion_id:q.subquestion_id,evaluated:true,expected_points:e.expected_points,actual_points:q.score,delta,strict_matched:delta===0&&e.expected_verdicts.every(v=>q.criteria.find(k=>k.criterion_id===v.criterion_id).verdict===v.verdict),within_tolerance:Math.abs(delta)<=1};});
 const input=write(P+'/replayed/'+id+'.input.json',{entry,set,prompt,schema,model:'gpt-5.6-luna'});
 const transport=text(P+'/replayed/'+id+'.transport.jsonl',[{event:'request_started',sequence:1,params:request.params},{event:'response_received',response:wire.response,response_metadata:{request_id:wire.metadata.request_id}}].map(r=>JSON.stringify(r)).join('\n')+'\n');
 const trace=text(P+'/replayed/'+id+'.traces.jsonl',traces.map(t=>JSON.stringify(t)).join('\n')+'\n');
 const origin=['input','request-1','response-1','trace','usage','result'].map(suffix=>ref(old+'.'+suffix+'.json'));files.push(...origin.map(r=>r.file));
 jobs.push({entry,observation:{version:1,artifact_type:'efficient_grading_observation',transport:'model',response_injection:false,entry_id:id,model:'gpt-5.6-luna',source_set_id:source.id,learning_unit_id:unit,kind:c.role,projected_body_hash:contentHash(set),answers,original_expected:expected,prompt_sha256:sha(prompt),schema_hash:contentHash(schema),actual_sdk_calls:1,extra_quality_repeats:0,judgment,traces,result,files:{input,transport,traces:trace},security_findings:[],evaluated_subquestion_ids:[c.subquestion_id],strict_matched:comparisons.every(c=>c.strict_matched),within_tolerance:comparisons.every(c=>c.within_tolerance),subquestions:comparisons,usage:usage.map(provider=>({provider})),normalization:{new_api_calls:0,origin_files:origin,original_case_id:c.id,origin_batch:b.dir,method:'Immutable earlier provider request/response reprocessed; no new execution or expected-value substitution'}}});
}
assert.equal(jobs.length,reprocessed);
const snapshots=EFFICIENT_RUNTIME_FILES.map((file,i)=>{const copy=P+'/acceptance-runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
write(P+'/runtime-snapshots.json',snapshots);
const manifest=write(P+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs:[...new Set([...files,...originManifests.map(r=>r.file),...additions.flatMap(s=>s.source_refs.map(r=>r.file)),...representatives.values().map(r=>r.file),P+'/runtime-snapshots.json'])].map(ref),code_files:EFFICIENT_RUNTIME_FILES.map(ref),entries:jobs.map(j=>j.entry),normalization:{new_api_calls:0,original_model_responses_reprocessed:reprocessed,origin_manifests:originManifests,runtime_note:'원 실행의 runtime·해시는 각 origin manifest와 frozen 보존본에 있다. 본 목록은 동일 요청의 새 수락·재처리 시점 runtime이다.'}});
const observations=jobs.map(j=>write(P+'/replayed/'+j.entry.id+'.observation.json',{...j.observation,manifest}));
const batch=write(P+'/batch.json',{version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(P+'/authorization.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:manifest,observations,agent_reviews:agentReviews,runtime_snapshots:snapshots,residual_grading_findings:[]});
const context=createEfficientValidationContext(),receipts=additions.map(s=>createEfficientReviewReceipt(batch,s,context));assertEfficientEvidenceUnchanged(context);
for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업 변경');
const obs=jobs.map(j=>j.observation);
write(P+'/preparation-completion.json',{status:'evidence_reprocessed_and_validated',new_api_calls:0,reprocessed_model_responses:reprocessed,strict_matched:obs.filter(o=>o.strict_matched).length,within_tolerance:obs.filter(o=>o.within_tolerance).length,ids:additions.map(s=>s.id),counts:{sets:bank.length,questions:bank.flatMap(s=>s.subquestions).length,points:bank.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0),new_sets:additions.length,new_questions:43,new_points:additions.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0)},receipts});
console.log(JSON.stringify({status:'ready',sets:additions.length,questions:43,reprocessed,strict:obs.filter(o=>o.strict_matched).length,within:obs.filter(o=>o.within_tolerance).length,new_api_calls:0}));
