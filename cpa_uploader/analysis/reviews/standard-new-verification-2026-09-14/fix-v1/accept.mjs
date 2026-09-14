// 수정된 10세트의 담당 agent 내용 검토와 실제 Luna 관측 30건을 비용 통제 수락 batch로 묶고 승급 도구와 같은 검증을 미리 수행한다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v1/accept.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTENT_CHECKS,createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../../questionReviewIdentity.ts';
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v1',E=F+'/execution-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/batch.json'),'수락 batch가 이미 있다');
const manifestRef=ref(F+'/grading-manifest.json'),manifest=read(manifestRef.file),bank=read(manifest.bank.file),changes=read(F+'/changes.json'),review=read(V+'/content-review.json');
assert.equal(ref(manifest.bank.file).sha256,manifest.bank.sha256);
for(const r of read(F+'/baseline.json'))assert.equal(ref(r.file).sha256,r.sha256,'준비 후 정본이 바뀌었다: '+r.file);
// 세 worker가 모두 끝났고 관측 수가 manifest와 같아야 한다.
const observations=[];
for(const w of ['a','b','c']){const s=read(E+'/actual-'+w+'/summary.json');assert.equal(s.status,'completed');assert.equal(s.new_observations,s.selected_entries);assert.equal(s.frozen_input_error,null);
 for(const row of s.rows){assert.equal(row.status,'within_tolerance');observations.push(row.observation);}}
assert.equal(observations.length,manifest.entries.length);
const obs=observations.map(o=>read(o.file));
assert(obs.every(o=>o.transport==='model'&&o.response_injection===false&&o.model==='gpt-5.6-luna'&&o.security_findings.length===0));
const FINDING_TEXT={F1:'crit2의 셋째 문장을 "요구하지 않으며 덧붙여도 감점하지 않는다"는 안내로 바꾸었다. 제22조제7항은 법령 위반만 명시하므로 정답 명제는 같다.',F2:'기준 명제와 채점 안내 사이에 마침표만 넣었다. 명제·안내 내용은 같다.',F3:'발문의 KGA 약칭을 감사기준서로 바꾸었다(해당 문단 번호 표기 포함). 요구 범위·제외 범위는 같다.'};
const agentReviews=changes.changed_sets.map(id=>{
 const set=bank.find(s=>s.id===id),q=set.subquestions[0],prior=review.questions.find(x=>x.question===`${id}/${q.id}`);assert(prior,'전수 검증 판정 없음: '+id);
 const finding=changes.changes.find(c=>c.set_id===id).finding;
 const srcs=[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(c=>c.source_ref_ids)])];
 return{set_id:id,content_hash:reviewedContentHash(set),reviewer_id:'Claude Code 담당 agent — 신규 기준서형 전수 검증 및 F1–F3 문구 수정 재대조(2026-09-14)',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,
  evidence:[F+'/authorization.md',F+'/changes.json',V+'/content-review.json',V+'/mechanical-checks.json'].map(ref),
  questions:[{subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id),source_ref_ids:srcs,checks:Object.fromEntries(CONTENT_CHECKS.map(c=>[c,'pass'])),
   rationale:[prior.checks.source_and_answer.reason,prior.checks.point_validity.reason,FINDING_TEXT[finding],'수정본의 발문·모범답안·criterion을 원문 인용과 다시 대조했고 유형(기준서형)·주제·판본·중복 판단은 전수 검증과 같다.'].join(' ')}],
  unresolved_content_findings:[]};
});
const batch=write(F+'/batch.json',{version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(F+'/authorization.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:manifestRef,observations,agent_reviews:agentReviews,runtime_snapshots:read(F+'/runtime-snapshots.json'),residual_grading_findings:[]});
const context=createEfficientValidationContext(),receipts=changes.changed_sets.map(id=>createEfficientReviewReceipt(batch,bank.find(s=>s.id===id),context));assertEfficientEvidenceUnchanged(context);
const deltas=obs.map(o=>o.subquestions[0].delta),usage=obs.flatMap(o=>o.usage.map(u=>u.provider.usage??{}));
const tok=k=>usage.every(u=>Number.isSafeInteger(u[k]))?usage.reduce((n,u)=>n+u[k],0):null;
const cached=usage.every(u=>Number.isSafeInteger(u.input_tokens_details?.cached_tokens))?usage.reduce((n,u)=>n+u.input_tokens_details.cached_tokens,0):null;
const reasoning=usage.every(u=>Number.isSafeInteger(u.output_tokens_details?.reasoning_tokens))?usage.reduce((n,u)=>n+u.output_tokens_details.reasoning_tokens,0):null;
const accounting=['a','b','c'].map(w=>read(E+'/actual-'+w+'/summary.json').new_accounting);
write(F+'/acceptance-completion.json',{status:'accepted_for_reverification',batch,receipts,observations:obs.length,score_exact:deltas.filter(d=>d===0).length,within_tolerance:deltas.filter(d=>Math.abs(d)<=1).length,strict_matched:obs.filter(o=>o.strict_matched).length,strict_note:'오답 12건은 점수 0으로 같지만 Luna가 일부 기준을 not_met 대신 contradicted로 판정해 strict가 아니다.',actual_sdk_calls:obs.reduce((n,o)=>n+o.actual_sdk_calls,0),tokens:{input:tok('input_tokens'),cached_input:cached,output:tok('output_tokens'),reasoning_output:reasoning,total:tok('total_tokens')},response_ids:obs.flatMap(o=>o.usage.map(u=>u.provider.response_id)),usd_provider_usage_arithmetic:accounting.every(a=>typeof a.usd==='number')?accounting.reduce((n,a)=>n+a.usd,0):null,usd_note:'실행기의 고정 단가×반환 사용량 계산이며 청구서 금액이 아니다. 사용자 금액 상한은 지정되지 않았다.',human_review_performed:false});
console.log(JSON.stringify({status:'accepted_for_reverification',sets:receipts.length,observations:obs.length,score_exact:deltas.filter(d=>d===0).length,batch}));
