// 관찰 O1–O3을 고친 10세트(12물음)의 담당 agent 내용 검토와 v3 실제 Luna 관측 36건을 비용 통제 수락 batch로 묶고 승급 도구와 같은 검증을 미리 수행한다.
// v1·v2 관측은 채택하지 않은 1cae 병합본의 판단 근거로만 쓰고 이 batch에는 넣지 않는다(decision-o3-v3.md).
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/accept.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTENT_CHECKS,createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../../questionReviewIdentity.ts';
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v4',W=F+'/v3',E=W+'/execution';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(W+'/batch.json'),'수락 batch가 이미 있다');
const manifestRef=ref(W+'/grading-manifest.json'),manifest=read(manifestRef.file),bank=read(manifest.bank.file),changes=read(W+'/changes.json'),review=read(V+'/content-review.json');
assert.equal(ref(manifest.bank.file).sha256,manifest.bank.sha256);
for(const r of read(F+'/baseline.json'))assert.equal(ref(r.file).sha256,r.sha256,'준비 후 정본이 바뀌었다: '+r.file);
const observations=[];
for(const w of ['a','b','c']){const s=read(E+'/actual-'+w+'/summary.json');assert.equal(s.status,'completed');assert.equal(s.new_observations,s.selected_entries);assert.equal(s.frozen_input_error,null);for(const row of s.rows)observations.push(row);}
assert.equal(observations.length,manifest.entries.length);
const obs=observations.map(r=>read(r.observation.file));
assert(obs.every(o=>o.transport==='model'&&o.response_injection===false&&o.model==='gpt-5.6-luna'&&o.security_findings.length===0&&o.within_tolerance));
const TEXT={
 O1:c=>`세트 제목을 "${c.fields[0].before}"에서 "${c.fields[0].after}"로 바꾸어 재편 뒤 남은 물음만 가리키게 했다. 발문·모범답안·criterion·배점·분류 태그는 같고, 제목은 채점 입력(발문·모범답안·criterion·답안)에 들어가지 않는다.`,
 O2:()=>'경영진주장 여섯 범주의 명칭만 요구하고 정의를 제외하므로 답안 형식을 descriptive에서 enumeration으로 바꾸었다. 명칭 하나당 1점인 6개 criterion과 selection(all)·ordered=false·overflow none은 열거형 규약과 같다. 퀴즈 화면 표시가 "열거형"이 된다.',
 O3:()=>'315 문단 21(a)(iv)의 유치·육성·유지는 발문이 따로 묻지 않은 한 열거 항목 안의 행위이므로 3개 criterion을 crit4 1점으로 합쳤다(4점→2점). 합친 기준은 일부 행위만 써도 인정 항목이 드러나면 인정하고 세 행위를 따로 점수화하지 않는다. (v) 개인 책임은 1점 그대로다. requirement 중복 인용(req-2·req-3)을 삭제했다. 원문·발문·모범답안은 같다. 같은 관찰의 1cae16e579d0은 성격·범위가 발문이 직접 든 독립 특성이라 분할을 유지했다(decision-o3-v3.md).',
};
const POINTS={O3:'조정 2점: 열거형은 요구한 독립 요소마다 1점이므로 (iv) 인력관리 항목 1점, (v) 개인 책임 1점으로 둔다. 발문이 세 행위를 따로 묻지 않고, 일부 행위만 쓴 답안도 항목을 식별한 것으로 인정한다.'};
const agentReviews=changes.changed_sets.map(id=>{const set=bank.find(s=>s.id===id),c=changes.changes.find(x=>x.set_id===id);
 return{set_id:id,content_hash:reviewedContentHash(set),reviewer_id:'Claude Code 담당 agent — 신규 기준서형 전수 검증 및 관찰 O1–O3 수정 재대조(2026-09-14)',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,
  evidence:[F+'/authorization.md',F+'/decision-o3-v3.md',W+'/changes.json',V+'/content-review.json',V+'/mechanical-checks.json'].map(ref),
  questions:set.subquestions.map(q=>{const prior=review.questions.find(x=>x.question===`${id}/${q.id}`);assert(prior,'전수 검증 판정 없음: '+id+'/'+q.id);
   const srcs=[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(x=>x.source_ref_ids)])];
   return{subquestion_id:q.id,criterion_ids:q.criteria.map(x=>x.id),source_ref_ids:srcs,checks:Object.fromEntries(CONTENT_CHECKS.map(k=>[k,'pass'])),
    rationale:[prior.checks.source_and_answer.reason,POINTS[c.observation]??prior.checks.point_validity.reason,TEXT[c.observation](c),'유형(기준서형)·주제·판본·중복 판단은 전수 검증과 같다.'].join(' ')};}),
  unresolved_content_findings:[]};});
const batch=write(W+'/batch.json',{version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(F+'/authorization.md'),decision:ref(F+'/decision-o3-v3.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:manifestRef,observations:observations.map(r=>r.observation),agent_reviews:agentReviews,runtime_snapshots:read(W+'/runtime-snapshots.json'),residual_grading_findings:[]});
const context=createEfficientValidationContext(),receipts=changes.changed_sets.map(id=>createEfficientReviewReceipt(batch,bank.find(s=>s.id===id),context));assertEfficientEvidenceUnchanged(context);
// 사용량: 채택한 v3 관측과 보존한 v1·v2 관측을 모두 센다.
const summarize=(dir,count)=>{const rows=['a','b','c'].flatMap(w=>read(dir+'/actual-'+w+'/summary.json').rows.map(r=>read(r.observation.file)));assert.equal(rows.length,count);
 const usage=rows.flatMap(o=>o.usage.map(u=>u.provider.usage??{})),sum=f=>usage.every(u=>Number.isSafeInteger(f(u)))?usage.reduce((n,u)=>n+f(u),0):null;
 const accounting=['a','b','c'].map(w=>read(dir+'/actual-'+w+'/summary.json').new_accounting);
 return{observations:rows.length,score_exact:rows.filter(o=>o.subquestions[0].delta===0).length,within_tolerance:rows.filter(o=>o.within_tolerance).length,strict_matched:rows.filter(o=>o.strict_matched).length,actual_sdk_calls:rows.reduce((n,o)=>n+o.actual_sdk_calls,0),
  tokens:{input:sum(u=>u.input_tokens),cached_input:sum(u=>u.input_tokens_details?.cached_tokens),output:sum(u=>u.output_tokens),reasoning_output:sum(u=>u.output_tokens_details?.reasoning_tokens),total:sum(u=>u.total_tokens)},
  response_ids:rows.flatMap(o=>o.usage.map(u=>u.provider.response_id)),usd_provider_usage_arithmetic:accounting.every(a=>typeof a.usd==='number')?accounting.reduce((n,a)=>n+a.usd,0):null};};
const runs={v1:{...summarize(F+'/execution-v1',39),status:'preserved_not_accepted',manifest:ref(F+'/grading-manifest.json')},v2:{...summarize(F+'/v2/execution',39),status:'preserved_not_accepted',manifest:ref(F+'/v2/grading-manifest.json')},v3:{...summarize(E,36),status:'accepted',manifest:manifestRef}};
const total=k=>Object.values(runs).every(r=>r.tokens[k]!=null)?Object.values(runs).reduce((n,r)=>n+r.tokens[k],0):null;
write(W+'/acceptance-completion.json',{status:'accepted_for_reverification',batch,receipts,observations:obs.length,score_exact:runs.v3.score_exact,within_tolerance:runs.v3.within_tolerance,strict_matched:runs.v3.strict_matched,strict_mismatch_note:'세 오답 모두 점수(0점)는 같고 일부 criterion의 판정 종류(not_met/contradicted)만 다르다. 기대값은 수락 당시 원 대표답안의 값을 그대로 썼다.',runs,all_runs:{actual_sdk_calls:Object.values(runs).reduce((n,r)=>n+r.actual_sdk_calls,0),tokens:{input:total('input'),cached_input:total('cached_input'),output:total('output'),reasoning_output:total('reasoning_output'),total:total('total')},usd_provider_usage_arithmetic:Object.values(runs).every(r=>typeof r.usd_provider_usage_arithmetic==='number')?Object.values(runs).reduce((n,r)=>n+r.usd_provider_usage_arithmetic,0):null},usd_note:'실행기의 고정 단가×반환 사용량 계산이며 청구서 금액이 아니다. 사용자 금액 상한은 지정되지 않았다.',human_review_performed:false});
console.log(JSON.stringify({status:'accepted_for_reverification',sets:receipts.length,observations:obs.length,score_exact:runs.v3.score_exact,strict:runs.v3.strict_matched,all_calls:Object.values(runs).reduce((n,r)=>n+r.actual_sdk_calls,0),batch}));
