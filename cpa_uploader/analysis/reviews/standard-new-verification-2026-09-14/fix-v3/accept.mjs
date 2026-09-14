// B1·B2를 고친 2세트(7물음)의 담당 agent 내용 검토와 실제 Luna 관측 21건을 비용 통제 수락 batch로 묶고 승급 도구와 같은 검증을 미리 수행한다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v3/accept.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTENT_CHECKS,createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../../questionReviewIdentity.ts';
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v3',E=F+'/execution-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/batch.json'),'수락 batch가 이미 있다');
const manifestRef=ref(F+'/grading-manifest.json'),manifest=read(manifestRef.file),bank=read(manifest.bank.file),changes=read(F+'/changes.json'),review=read(V+'/content-review.json');
assert.equal(ref(manifest.bank.file).sha256,manifest.bank.sha256);
for(const r of read(F+'/baseline.json'))assert.equal(ref(r.file).sha256,r.sha256,'준비 후 정본이 바뀌었다: '+r.file);
const CHANGE_TEXT={B1:'crit1에 발문 ①의 상황(사업적 이해관계·영업활동)은 반복하지 않아도 된다는 안내를 붙이고 핵심 사실을 ①의 통보 내용·상대방으로 한정했다. 윤리기준 220.3(1)의 통보·동의 요구는 그대로다.',B2:'crit2의 둘째 문장을 요건이 아닌 안내로 바꾸고 핵심 사실을 "일반적으로 적합하지 않다"로 한정했다. 보론 4(e)의 "일반적으로 사용될 수 없다"와 발문의 "절대 금지로 해석하지 말라"를 함께 반영하며, 언제나 금지된다는 단정은 인정하지 않는다.'};
const observations=[];
for(const w of ['a','b','c']){const s=read(E+'/actual-'+w+'/summary.json');assert.equal(s.status,'completed');assert.equal(s.new_observations,s.selected_entries);assert.equal(s.frozen_input_error,null);for(const row of s.rows)observations.push(row);}
assert.equal(observations.length,manifest.entries.length);
const obs=observations.map(r=>read(r.observation.file));
assert(obs.every(o=>o.transport==='model'&&o.response_injection===false&&o.model==='gpt-5.6-luna'&&o.security_findings.length===0&&o.within_tolerance));
const agentReviews=changes.changed_sets.map(id=>{const set=bank.find(s=>s.id===id);
 return{set_id:id,content_hash:reviewedContentHash(set),reviewer_id:'Claude Code 담당 agent — 신규 기준서형 전수 검증 및 B1·B2 문구 수정 재대조(2026-09-14)',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,
  evidence:[F+'/authorization.md',F+'/changes.json',V+'/content-review.json',V+'/mechanical-checks.json'].map(ref),
  questions:set.subquestions.map(q=>{const prior=review.questions.find(x=>x.question===`${id}/${q.id}`);assert(prior,'전수 검증 판정 없음: '+id+'/'+q.id);
   const c=changes.changes.find(x=>x.set_id===id&&x.subquestion_id===q.id);
   const srcs=[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(x=>x.source_ref_ids)])];
   return{subquestion_id:q.id,criterion_ids:q.criteria.map(x=>x.id),source_ref_ids:srcs,checks:Object.fromEntries(CONTENT_CHECKS.map(k=>[k,'pass'])),
    rationale:[prior.checks.source_and_answer.reason,prior.checks.point_validity.reason,c?CHANGE_TEXT[c.finding]:'이 물음의 발문·모범답안·criterion은 바뀌지 않았고 같은 세트의 다른 물음 수정으로 판본만 새로 결속했다.','유형(기준서형)·주제·판본·중복 판단은 전수 검증과 같다.'].join(' ')};}),
  unresolved_content_findings:[]};});
const batch=write(F+'/batch.json',{version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(F+'/authorization.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:manifestRef,observations:observations.map(r=>r.observation),agent_reviews:agentReviews,runtime_snapshots:read(F+'/runtime-snapshots.json'),residual_grading_findings:[]});
const context=createEfficientValidationContext(),receipts=changes.changed_sets.map(id=>createEfficientReviewReceipt(batch,bank.find(s=>s.id===id),context));assertEfficientEvidenceUnchanged(context);
const deltas=obs.map(o=>o.subquestions[0].delta),usage=obs.flatMap(o=>o.usage.map(u=>u.provider.usage??{}));
const tok=k=>usage.every(u=>Number.isSafeInteger(u[k]))?usage.reduce((n,u)=>n+u[k],0):null;
const cached=usage.every(u=>Number.isSafeInteger(u.input_tokens_details?.cached_tokens))?usage.reduce((n,u)=>n+u.input_tokens_details.cached_tokens,0):null;
const reasoning=usage.every(u=>Number.isSafeInteger(u.output_tokens_details?.reasoning_tokens))?usage.reduce((n,u)=>n+u.output_tokens_details.reasoning_tokens,0):null;
const accounting=['a','b','c'].map(w=>read(E+'/actual-'+w+'/summary.json').new_accounting);
const target=id=>obs.find(o=>o.entry_id===id).subquestions[0];
write(F+'/acceptance-completion.json',{status:'accepted_for_reverification',batch,receipts,observations:obs.length,score_exact:deltas.filter(d=>d===0).length,within_tolerance:deltas.filter(d=>Math.abs(d)<=1).length,strict_matched:obs.filter(o=>o.strict_matched).length,boundary_cases:{B1_partial:target('fix3-20260913-e01-sub1-partial'),B2_partial:target('fix3-20260913-s03-sub4-partial'),before:'수정 전 수락 관측: B1 부분답안 기대 3·실제 2, B2 부분답안 기대 2·실제 1'},actual_sdk_calls:obs.reduce((n,o)=>n+o.actual_sdk_calls,0),tokens:{input:tok('input_tokens'),cached_input:cached,output:tok('output_tokens'),reasoning_output:reasoning,total:tok('total_tokens')},response_ids:obs.flatMap(o=>o.usage.map(u=>u.provider.response_id)),usd_provider_usage_arithmetic:accounting.every(a=>typeof a.usd==='number')?accounting.reduce((n,a)=>n+a.usd,0):null,usd_note:'실행기의 고정 단가×반환 사용량 계산이며 청구서 금액이 아니다. 사용자 금액 상한은 지정되지 않았다.',human_review_performed:false});
console.log(JSON.stringify({status:'accepted_for_reverification',sets:receipts.length,observations:obs.length,score_exact:deltas.filter(d=>d===0).length,batch}));
