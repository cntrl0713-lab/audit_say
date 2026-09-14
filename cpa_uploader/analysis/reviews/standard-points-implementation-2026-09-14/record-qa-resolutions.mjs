import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const range of ['15-19','01-05']){
 const raw=fs.readFileSync(dir+`plan-${range}.json`),plan=JSON.parse(raw),prior=JSON.parse(fs.readFileSync(dir+`qa-${range}.json`));
 const results=[];
 if(range==='15-19'){
  const a=plan.groups[14].outputs[1],b=plan.groups[17].outputs[0];
  assert.equal(a.partial_answer,'기타정보를 열람하고 고려할 책임이 있다.');assert.deepEqual(a.partial_met,[0,1]);
  assert(b.model_answer.join(' ').includes('평가기준일 현재'));assert(b.partial_answer.includes('평가기준일 현재'));
  results.push({group_index:14,output_index:1,base_key:a.base_key,status:'resolved',finding:'보고할 두 상황을 모두 쓴 부분답의 보고책임 함축',verification:'새 부분답은 기타정보의 열람·고려 책임만 서술하므로 [0,1]의 2점이고 보고책임·실제 보고상태는 충족하지 않는다.'});
  results.push({group_index:17,output_index:0,base_key:b.base_key,status:'resolved',finding:'통합감사 증거의 평가기준일 누락',verification:'모범답안과 대표부분답안 모두 평가기준일 현재의 내부회계관리제도 의견 증거임을 명시하여 KGA1100.10(a)의 시간범위와 일치한다.'});
 }else{
  const a=plan.groups[10].outputs[1],b=plan.groups[31].outputs[1];
  assert(a.prompt.startsWith('재무제표감사에서 KGA 265 문단 11(b)에 따라'));
  assert(b.prompt.includes('원칙의 선정절차와 어떤 차이'));
  assert(b.model_answer[1].includes('새로 선정하는 절차의 예외'));
  assert(b.criteria[1].claim.includes('새로 선정하는 절차의 예외'));
  assert(b.criteria[1].scope.includes('선임기한이나 보고의무까지 면제한다는 뜻은 아니다'));
  results.push({group_index:10,output_index:1,base_key:a.base_key,status:'resolved',finding:'내부통제 보고 목적의 재무제표감사 범위 미특정',verification:'발문에 재무제표감사와 KGA265.11(b)를 명시하여 내부회계관리제도감사 의견목적과 혼동할 여지를 해소했다.'});
  results.push({group_index:31,output_index:1,base_key:b.base_key,status:'resolved',finding:'직전 감사인 재선임 발문 조건 반복 1점',verification:'발문이 원칙 선정절차와의 차이를 묻고 모범답안·criterion이 새 선정절차 예외를 설명한다. 법10조4항2호 단서·가목 범위를 유지하고 다른 선임·보고의무까지 면제하는 확대를 배제했다.'});
 }
 const report={prior_qa:dir+`qa-${range}.json`,prior_plan_sha256:prior.plan_sha256,resolved_plan_sha256:hash(raw),reviewer:'/root/review_06_10',method:'선행 독립 전수 QA에서 발견한 두 건의 실제 수정 내용을 원 쟁점과 직접 대조한 후속 확인. 전수 모델 재채점 아님.',results,unresolved_issues:0};
 fs.writeFileSync(dir+`qa-${range}-resolution.json`,JSON.stringify(report,null,2)+'\n');
}
console.log('4 semantic QA fixes verified; prior QA evidence preserved.');
