import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectLearningQuestionSet,learningUnitId} from '../../../../lib/learningUnits.ts';
import {CONTENT_CHECKS,EFFICIENT_RUNTIME_FILES} from '../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../questionReviewIdentity.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=x=>createHash('sha256').update(x).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const candidate=process.argv[2]??'candidate-v1',execution=process.argv[3]??'execution-v1';
assert(/^candidate-v\d+$/.test(candidate)&&/^execution-v\d+$/.test(execution));
const C=R+'/'+candidate,E=R+'/'+execution;
assert(!fs.existsSync(E),'Use a new execution; retain old inputs and observations');
const bank=read(C+'/bank.json'),catalog=read(C+'/catalog.json');
const retainedReview=read(R+'/subset-regrade-representatives.json');
const retainedIds=read(R+'/subset-regrade-required.json').sets.map(s=>s.set_id);
const targets=[...read(C+'/new-sets.json'),...retainedIds.map(id=>{const s=bank.find(s=>s.id===id);assert(s);return s;})];
assert.deepEqual(validateAuthoringBank(bank).errors,[]);
const reviews=read(C+'/content-reviews.json'),qa=read(C+'/representatives.json');
assert.deepEqual(retainedReview.questions.map(r=>r.set_id).sort(),[...retainedIds].sort());
for(const row of retainedReview.questions){
 const s=targets.find(s=>s.id===row.set_id),q=s.subquestions.find(q=>q.id===row.subquestion_id);assert(q);
 assert.deepEqual(row.model_answer,q.model_answer,'Retained model answer must be the stored answer');
 assert(row.source_review?.trim());
 reviews.push({set_id:s.id,subquestion_id:q.id,rationale:'기준서형 일부 삭제 후 잔존한 물음이며, 과거 소급 기록만으로 실측 근거를 계승하지 않고 원발문·저장 모범답안·배점·출처를 새로 대조하고 실측한다.',source_review:row.source_review});
 for(const kind of q.criteria.length>1?['partial','wrong']:['wrong']){
  const met=kind==='partial'?row.partial_met:[];
  assert(Array.isArray(met)&&met.every(i=>Number.isInteger(i)&&i>=0&&i<q.criteria.length));
  qa.push({set_id:s.id,subquestion_id:q.id,kind,answer:kind==='partial'?row.partial_answer:row.wrong_answer,met_criterion_ids:met.map(i=>q.criteria[i].id),expected_points:met.length,reason:'잔존 물음의 원기준 전체와 자연어 답안을 전수 대조한 대표 '+kind+' 답안.'});
 }
}
const checks=read(C+'/checks.json');
for(const p of checks.plan_files)assert.equal(ref(p.file).sha256,p.sha256,'plan changed after candidate');
const peer=read(R+'/implementation-content-checks.json');
assert.equal(peer.status,'pass');assert.deepEqual(peer.unresolved,[]);
assert.equal(peer.candidate_sha256,ref(C+'/bank.json').sha256);
const newIds=new Set(targets.map(s=>s.id));
assert(newIds.size===targets.length&&targets.length>0);
assert.deepEqual(reviews.map(r=>r.set_id+'/'+r.subquestion_id).sort(),targets.flatMap(s=>s.subquestions.map(q=>s.id+'/'+q.id)).sort());
fs.mkdirSync(E,{recursive:true});fs.mkdirSync(E+'/projections');fs.mkdirSync(E+'/runtime');
write(E+'/scope.json',{targets:targets.map(s=>({set_id:s.id,subquestion_ids:s.subquestions.map(q=>q.id)}))});
write(E+'/policy.json',{scope:ref(E+'/scope.json'),model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:0.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:null,budget_enforcement:'not_specified',provider_limit_errors_stop_all_workers:true,reuse_decision:'변경된 독립 기준서형 물음의 모범·대표 부분·오답만 새로 실측한다. 삭제만 한 원세트의 잔존 물음은 엄격한 파생 검증으로 기존 검수 근거와 실제 채점 계약의 동일성을 보존한다.'});
const evidence=[R+'/baseline.json',R+'/authorization.md',R+'/implementation-content-checks.json',R+'/subset-regrade-required.json',R+'/subset-regrade-representatives.json',C+'/content-reviews.json',C+'/lineage.json',C+'/representatives.json',...checks.plan_files.map(p=>p.file)];
const cases=[];
for(const row of qa){
 assert(newIds.has(row.set_id));const set=targets.find(s=>s.id===row.set_id),sub=set.subquestions.find(q=>q.id===row.subquestion_id);assert(sub);
 assert(new Set(row.met_criterion_ids).size===row.met_criterion_ids.length);
 assert(row.met_criterion_ids.every(id=>sub.criteria.some(c=>c.id===id)));
 const expected_verdicts=sub.criteria.map(c=>({criterion_id:c.id,verdict:row.met_criterion_ids.includes(c.id)?'met':'not_met',reason:row.reason+' 대상 명제: '+c.claim}));
 const points=expected_verdicts.reduce((sum,v)=>sum+(v.verdict==='met'?1:0),0);
 assert.equal(points,row.expected_points);assert(row.kind==='wrong'?points===0:points>0&&points<sub.criteria.length);
 cases.push({id:row.set_id+'--'+sub.id+'--'+row.kind,subquestion_id:sub.id,answer:row.answer,expected_points:points,expected_verdicts});
}
write(E+'/representatives.json',{cases});
const agentReviews=targets.map(set=>({set_id:set.id,content_hash:reviewedContentHash(set),reviewer_id:'topic owner and root integration review',reviewed_at:peer.reviewed_at,method:'agent_content_review',human_review_performed:false,evidence:evidence.map(ref),questions:set.subquestions.map(sub=>{const row=reviews.find(r=>r.set_id===set.id&&r.subquestion_id===sub.id);assert(row.rationale&&row.source_review);return {subquestion_id:sub.id,criterion_ids:sub.criteria.map(c=>c.id),source_ref_ids:[...new Set([...sub.requirements.map(r=>r.source_ref_id),...sub.criteria.flatMap(c=>c.source_ref_ids)])],checks:Object.fromEntries(CONTENT_CHECKS.map(c=>[c,'pass'])),rationale:row.rationale+' '+row.source_review};}),unresolved_content_findings:[]}));
write(E+'/agent-reviews.json',agentReviews);
const entries=[];
for(const [index,set] of targets.entries())for(const sub of set.subquestions){
 const metas=catalog.classifications.filter(c=>c.source_set_id===set.id&&c.subquestion_id===sub.id);
 const unit=learningUnitId(set.id,'standard',sub.id),projected=selectLearningQuestionSet(set,metas,unit);
 const file=E+'/projections/'+set.id+'--'+sub.id+'.json';write(file,projected);
 for(const kind of sub.criteria.length>1?['model','partial','wrong']:['model','wrong']){
  const sample=kind==='model'?{answer:sub.model_answer.join('\n'),expected_points:sub.criteria.length,expected_verdicts:sub.criteria.map(c=>({criterion_id:c.id,verdict:'met',reason:'직접 출처와 각 명제에 맞춰 대조한 저장 모범답안. '+c.claim}))}:cases.find(c=>c.id===set.id+'--'+sub.id+'--'+kind);
  assert(sample&&sample.answer.trim());
  entries.push({id:set.id+'--'+sub.id+'--'+kind,worker:['a','b','c'][index%3],source_set_id:set.id,learning_unit_id:unit,kind,projected_file:file,projected_sha256:ref(file).sha256,evaluated_subquestion_ids:[sub.id],answers:{[sub.id]:sample.answer},expected_by_subquestion:[{subquestion_id:sub.id,expected_points:sample.expected_points,expected_verdicts:sample.expected_verdicts}],selection_evidence:[{...ref(E+'/representatives.json'),subquestion_id:sub.id,case_id:kind==='model'?null:sample.id,kind,reason:kind==='model'?'저장 모범답안 바이트 그대로':'최종 명제의 독립 득점과 조건을 확인하는 사전 선정 대표답안'}]});
 }
}
const code=[...EFFICIENT_RUNTIME_FILES,R+'/run-efficient-grading.ts',R+'/accounting.ts',R+'/contract.ts',R+'/build-execution.mjs'];
const snapshots=code.map(file=>{const target=E+'/runtime/'+file;fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,fs.readFileSync(file),{flag:'wx'});return {...ref(target),runtime_file:file};});
write(E+'/runtime-snapshots.json',snapshots);
const inputs=[...new Set([...evidence,...targets.flatMap(s=>s.source_refs.map(r=>r.file)),E+'/representatives.json',E+'/agent-reviews.json',E+'/runtime-snapshots.json'])].map(ref);
write(E+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:ref(C+'/bank.json'),classifications:ref(C+'/catalog.json'),policy:ref(E+'/policy.json'),inputs,code_files:code.map(ref),entries});
console.log(JSON.stringify({execution:E,new_questions:targets.length,representatives:entries.length,manifest:ref(E+'/grading-manifest.json')},null,2));
