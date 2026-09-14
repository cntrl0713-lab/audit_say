// KGA 약칭을 고친 21세트의 담당 agent 내용 검토와 실제 Luna 관측을 비용 통제 수락 batch로 묶고 승급 도구와 같은 검증을 미리 수행한다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2/accept.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CONTENT_CHECKS,createEfficientReviewReceipt,createEfficientValidationContext,assertEfficientEvidenceUnchanged} from '../../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../../questionReviewIdentity.ts';
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v2',E=F+'/execution-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/batch.json'),'수락 batch가 이미 있다');
const manifestRef=ref(F+'/grading-manifest.json'),manifest=read(manifestRef.file),bank=read(manifest.bank.file),changes=read(F+'/changes.json');
assert.equal(ref(manifest.bank.file).sha256,manifest.bank.sha256);
for(const r of read(F+'/baseline.json'))assert.equal(ref(r.file).sha256,r.sha256,'준비 후 정본이 바뀌었다: '+r.file);
const P='std-points-20260914-';
// 담당 agent가 수정본 발문·모범답안·criterion을 연결 원문 인용과 대조한 요지. 요구 범위·정답 명제·배점은 직전 수락본과 같다.
const REVIEW={
 'pilot-18-001':'감사기준서 1200 문단 3(소규모기업이 아닌 기업에는 적용 불가, 일반목적 재무제표 감사에는 감사기준서 200~720 적용)과 판단·근거 2점이 일치한다.',
 'pilot-18-003':'감사기준서 1200 문단 4(전체 준수 기술·일반 감사기준서 언급 금지)와 문단 5(서면 합의 시 일반 감사기준서 대체 적용)가 네 기준과 일치한다.',
 [P+'2108b997b5da']:'감사기준서 265 문단 11(b)(i)–(iii)의 감사 목적, 내부통제 고려 목적과 제외 목적, 보고 범위가 네 기준과 일치한다.',
 [P+'cd4c5fa077a8']:'감사기준서 240 문단 39(a)(b)의 책임 결정(보고 요구 포함)과 법규상 가능 시 해지 고려가 두 기준과 일치한다.',
 [P+'1d4a862d1757']:'감사기준서 240 문단 39(c)(i)의 적합한 수준의 경영진·지배기구와 해지 사실·이유 토의가 세 기준과 일치한다.',
 [P+'b2e0749e7e9b']:'감사기준서 240 문단 39(c)(ii)의 보고 요구 존재 결정과 해지 사실·이유가 세 기준과 일치한다.',
 [P+'cdd18f0167e1']:'감사기준서 260 문단 16(a)의 회계실무 질적 측면 견해와 최적이 아니라고 볼 때의 이유 설명이 두 기준과 일치한다.',
 [P+'72f9a91627b4']:'감사기준서 260 문단 16(b)–(e)와 16(c)의 적용 조건(지배기구 전원 경영참여가 아닌 경우)이 다섯 기준과 일치한다.',
 [P+'d6a4bdf3b543']:'감사기준서 200 문단 A26의 중요성·감사위험, 감사절차 성격·시기·범위 결정이 다섯 기준과 일치한다.',
 [P+'e200ab1e2614']:'감사기준서 200 문단 A26의 증거 충분성·추가 수행사항 평가, 경영진 판단 평가, 결론 도출이 네 기준과 일치한다.',
 [P+'7e4d0729cd29']:'감사기준서 210 문단 19(a)(b)(i)(ii)의 추가공시 동의, 강조사항문단, 법규상 예외를 둔 의견문구 제외가 세 기준과 일치한다.',
 [P+'314b990cde78']:'감사기준서 210 문단 20(a)(b)의 오도 성격 영향 평가와 업무조건 언급이 두 기준과 일치한다.',
 [P+'1f185dbcb15a']:'감사기준서 1200 문단 6·7(a)(c)의 일반 감사기준서 적용, 전진 적용, 업무조건 재합의, 추가 절차 설계·수행과 문서화가 여섯 기준과 일치한다.',
 [P+'15c4192496ff']:'감사기준서 1200 문단 7(b)(i)–(iii)의 위험평가절차·추가감사절차·문서화 평가가 세 기준과 일치한다.',
 [P+'d1d89ea9818e']:'감사기준서 1200 문단 27(a)(b)의 두 목적과 문단 28의 숙련된 감사인 기준이 세 기준과 일치한다.',
 [P+'dacecd7e7ab8']:'감사기준서 1200 문단 28(a)(b)의 절차 성격·시기·범위와 결과·증거가 다섯 기준과 일치한다.',
 [P+'1b0434136b2c']:'감사기준서 1200 문단 28(c)의 유의적 사안, 결론, 유의적 전문가적 판단이 세 기준과 일치한다.',
 [P+'b014c2599fa2']:'감사기준서 1200 문단 28(a)(i)–(iii)의 식별 특성, 수행자·완료일, 검토자·검토일·범위가 여섯 기준과 일치한다.',
 [P+'5c0adea400e4']:'감사기준서 1200 문단 29의 논의 사안 성격, 시기, 상대자가 세 기준과 일치한다.',
 [P+'681e4da36d6a']:'감사기준서 1200 문단 30·31 본문의 파일 취합, 적시 완료, 보존기간 중 삭제·폐기 금지가 세 기준과 일치한다.',
 [P+'1bf3a2b9fe97']:'감사기준서 1200 문단 31(a)(b)의 구체적 이유와 수정·추가자, 검토자 및 각 시기가 다섯 기준과 일치한다.',
};
assert.deepEqual(Object.keys(REVIEW).sort(),[...changes.changed_sets].sort());
const observations=[];
for(const w of ['a','b','c']){const s=read(E+'/actual-'+w+'/summary.json');assert.equal(s.status,'completed');assert.equal(s.new_observations,s.selected_entries);assert.equal(s.frozen_input_error,null);for(const row of s.rows)observations.push(row);}
assert.equal(observations.length,manifest.entries.length);
const obs=observations.map(r=>read(r.observation.file));
assert(obs.every(o=>o.transport==='model'&&o.response_injection===false&&o.model==='gpt-5.6-luna'&&o.security_findings.length===0));
const residual=obs.filter(o=>!o.within_tolerance);assert.equal(residual.length,0,'허용 범위 밖 결과는 원인 조사 후 별도 기록이 필요하다: '+residual.map(o=>o.entry_id).join(','));
const priorBatches=['cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/sealed-v4/batch.json','cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/sealed-results-v4/batch.json'].map(ref);
const agentReviews=changes.changed_sets.map(id=>{
 const set=bank.find(s=>s.id===id),q=set.subquestions[0],c=changes.changes.find(x=>x.set_id===id);
 const srcs=[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(x=>x.source_ref_ids)])];
 return{set_id:id,content_hash:reviewedContentHash(set),reviewer_id:'Claude Code 담당 agent — 범위 밖 KGA 약칭 수정본 재대조(2026-09-14)',reviewed_at:new Date().toISOString(),method:'agent_content_review',human_review_performed:false,
  evidence:[ref(F+'/authorization.md'),ref(F+'/changes.json'),...priorBatches],
  questions:[{subquestion_id:q.id,criterion_ids:q.criteria.map(x=>x.id),source_ref_ids:srcs,checks:Object.fromEntries(CONTENT_CHECKS.map(k=>[k,'pass'])),
   rationale:[REVIEW[id],`바뀐 곳은 ${c.fields.map(f=>f.field).join(', ')}의 약칭 표기뿐이다(KGA NNN→감사기준서 NNN, 문단 번호 띄어쓰기).`,'유형(사실관계 없는 기준서형)·주제·판본(KICPA 2026년 7월 전문 추출본)·중복 판단은 직전 수락본과 같다.'].join(' ')}],
  unresolved_content_findings:[]};
});
const batch=write(F+'/batch.json',{version:1,artifact_type:'cost_controlled_review_batch',created_at:new Date().toISOString(),authorization:{evidence:ref(F+'/authorization.md'),agent_review_and_representative_grading:true,production_publication:true},grading_manifest:manifestRef,observations:observations.map(r=>r.observation),agent_reviews:agentReviews,runtime_snapshots:read(F+'/runtime-snapshots.json'),residual_grading_findings:[]});
const context=createEfficientValidationContext(),receipts=changes.changed_sets.map(id=>createEfficientReviewReceipt(batch,bank.find(s=>s.id===id),context));assertEfficientEvidenceUnchanged(context);
const deltas=obs.map(o=>o.subquestions[0].delta),usage=obs.flatMap(o=>o.usage.map(u=>u.provider.usage??{}));
const tok=k=>usage.every(u=>Number.isSafeInteger(u[k]))?usage.reduce((n,u)=>n+u[k],0):null;
const cached=usage.every(u=>Number.isSafeInteger(u.input_tokens_details?.cached_tokens))?usage.reduce((n,u)=>n+u.input_tokens_details.cached_tokens,0):null;
const reasoning=usage.every(u=>Number.isSafeInteger(u.output_tokens_details?.reasoning_tokens))?usage.reduce((n,u)=>n+u.output_tokens_details.reasoning_tokens,0):null;
const accounting=['a','b','c'].map(w=>read(E+'/actual-'+w+'/summary.json').new_accounting);
write(F+'/acceptance-completion.json',{status:'accepted_for_reverification',batch,receipts,observations:obs.length,score_exact:deltas.filter(d=>d===0).length,within_tolerance:deltas.filter(d=>Math.abs(d)<=1).length,strict_matched:obs.filter(o=>o.strict_matched).length,deltas:obs.filter(o=>o.subquestions[0].delta!==0).map(o=>({entry_id:o.entry_id,expected:o.subquestions[0].expected_points,actual:o.subquestions[0].actual_points})),actual_sdk_calls:obs.reduce((n,o)=>n+o.actual_sdk_calls,0),tokens:{input:tok('input_tokens'),cached_input:cached,output:tok('output_tokens'),reasoning_output:reasoning,total:tok('total_tokens')},response_ids:obs.flatMap(o=>o.usage.map(u=>u.provider.response_id)),usd_provider_usage_arithmetic:accounting.every(a=>typeof a.usd==='number')?accounting.reduce((n,a)=>n+a.usd,0):null,usd_note:'실행기의 고정 단가×반환 사용량 계산이며 청구서 금액이 아니다. 사용자 금액 상한은 지정되지 않았다.',human_review_performed:false});
console.log(JSON.stringify({status:'accepted_for_reverification',sets:receipts.length,observations:obs.length,score_exact:deltas.filter(d=>d===0).length,within:deltas.filter(d=>Math.abs(d)<=1).length,batch}));
