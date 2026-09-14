import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const R='cpa_uploader/analysis/reviews/case-followup-2026-09-14';
const E=R+'/execution-v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const observations=[];
for(const batch of ['actual-a','actual-b']){
  for(const name of fs.readdirSync(E+'/'+batch)){
    const file=E+'/'+batch+'/'+name+'/observation.json';
    if(!fs.existsSync(file))continue;
    const bytes=fs.readFileSync(file),data=JSON.parse(bytes);
    observations.push({file,sha256:sha(bytes),data});
  }
}
assert.equal(observations.length,18,'아직 모든 원관측이 완료되지 않음');
assert.equal(observations.reduce((n,o)=>n+o.data.subquestions.length,0),54);
const nonzero=observations.flatMap(o=>o.data.subquestions.filter(q=>q.delta!==0).map(q=>({file:o.file,sha256:o.sha256,entry_id:o.data.entry_id,...q})));
assert.equal(nonzero.length,1,'새 편차의 추가 수동 검토 필요');
const target=nonzero[0];
assert.equal(target.entry_id,'case-08-selection-coverage-20260914--case--partial');
assert.equal(target.subquestion_id,'sub1');
assert.equal(target.expected_points,2);assert.equal(target.actual_points,1);assert.equal(target.delta,-1);
const sealedFile=R+'/sealed-v1/summary.json';
const sealedBytes=fs.readFileSync(sealedFile),sealed=JSON.parse(sealedBytes);
assert.equal(sealed.status,'passed');assert.equal(sealed.fixed_evaluated_answers,54);assert.equal(sealed.exact_score_matches,53);assert.equal(sealed.within_tolerance,54);assert.equal(sealed.actual_sdk_calls,18);
assert.equal(sealed.scores.filter(q=>q.delta!==0).length,1);
const sealedDeviation=sealed.scores.find(q=>q.entry_id===target.entry_id&&q.subquestion_id===target.subquestion_id);
for(const key of ['expected_points','actual_points','delta'])assert.equal(sealedDeviation[key],target[key]);
const labels=[];
for(const o of observations){
  for(const expected of o.data.original_expected){
    const actual=o.data.result.subquestions.find(q=>q.subquestion_id===expected.subquestion_id);
    const diffs=expected.expected_verdicts.filter(e=>actual.criteria.find(c=>c.criterion_id===e.criterion_id).verdict!==e.verdict).map(e=>({criterion_id:e.criterion_id,expected_verdict:e.verdict,actual_verdict:actual.criteria.find(c=>c.criterion_id===e.criterion_id).verdict,actual_reason:actual.criteria.find(c=>c.criterion_id===e.criterion_id).reason}));
    if(actual.score===expected.expected_points&&diffs.length){
      assert(diffs.every(d=>d.expected_verdict==='not_met'&&d.actual_verdict==='contradicted'),'상쇄된 점수 불일치 등 추가 수동 검토 필요');
      labels.push({entry_id:o.data.entry_id,subquestion_id:expected.subquestion_id,expected_points:expected.expected_points,actual_points:actual.score,delta:0,human_review_performed:false,answer:o.data.answers[expected.subquestion_id],criterion_differences:diffs,finding:'대표 오답 기대판정은 충족 여부에 따라 not_met로 구성되었고, 실제 모델은 명시적 반대 결론을 contradicted로 구분했다. 원답안과 실제 판정 이유를 대조했으며 두 판정의 배점은 모두 0점이다.',decision:'점수 및 정답 경계에 영향이 없는 레이블 차이로 분리한다. 기대값·원답안·원관측을 보존하고 점수 편차 또는 기대점수 내용 결함으로 집계하지 않는다.'});
    }
  }
}
const report={
  version:'within-tolerance-deviation-review-v1',status:'complete',reviewer_id:'agent:/root/followup_sources_a',human_review_performed:false,review_date:'2026-09-14',review_method:'완료된 실제 원관측의 원답안·기대판정·실제 criterion 판정·채점 이유를 동결된 발문·정답·배점 기준과 직접 대조',
  sealed_summary:{file:sealedFile,sha256:sha(sealedBytes),status:sealed.status,fixed_evaluated_answers:54,exact_score_matches:53,within_tolerance:54,actual_sdk_calls:18},
  scope:{completed_observations:observations.length,evaluated_answers:54,nonzero_score_deviations:nonzero.length,within_tolerance_nonzero_deviations:nonzero.filter(q=>Math.abs(q.delta)<=1).length,outside_tolerance_deviations:nonzero.filter(q=>Math.abs(q.delta)>1).length,zero_score_verdict_mismatch_answers:labels.length,additional_api_calls:0,frozen_files_modified:false},
  findings:[{
    entry_id:target.entry_id,subquestion_id:target.subquestion_id,expected_points:2,actual_points:1,delta:-1,human_review_performed:false,
    finding:'원답안은 “특정 항목의 추출”로 방법을 정확히 식별하고 전체 매출채권에 투영할 수 없다고 판단했다. 모델은 sub1.c1에서 표본감사와의 구별을 별도 문구로 명시하지 않았다는 이유로 1점을 주지 않았다. 발문은 추출방법 식별을 요구하고, 동결된 critical_facts는 특정항목선택 및 동등한 의미를 인정한다. 특정항목추출이라는 정확한 분류와 투영 불가를 제시한 답안에 부정문 재서술을 추가로 요구한 모델의 과소인정이다. 잔여 모집단에 증거가 없다는 이유를 생략한 sub1.c3의 0점은 적절하다.',
    decision:'정답·원답안·기대 2점은 유지한다. 미충족 근거 1점을 정확히 제외한 부분답안이므로 기반 내용이나 기대값의 결함은 없다. 전체 54개 대표 답안 중 이 물음에 한정된 -1점이며 허용범위 안이므로 원관측을 보존하고 동결 파일 수정이나 편차 제거를 위한 추가 호출을 하지 않는다.',
    classification:'model_undercredit_semantically_sufficient_classification',
    answer:'이 검사는 특정 항목의 추출이다. 전체 매출채권에 결과를 그대로 투영할 수 없다.',
    criterion_id:'sub1.c1',expected_verdict:'met',actual_verdict:'not_met',
    model_reason:'특정 항목의 추출이라고만 했고 표본감사와의 구별을 명시하지 않았다.',
    criterion_application:'특정항목선택/판단적으로 주요항목조사 등 의미가 같으면 인정하며 모든 비통계적 추출을 표본감사가 아니라고 일반화하지 않는다.',
    observation:{file:target.file,sha256:target.sha256}
  }],
  zero_score_verdict_mismatches:labels,
  observation_bindings:observations.map(o=>({file:o.file,sha256:o.sha256,entry_id:o.data.entry_id})),
  unresolved_content_findings:[]
};
fs.writeFileSync(R+'/within-tolerance-notes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file:R+'/within-tolerance-notes.json',sha256:sha(fs.readFileSync(R+'/within-tolerance-notes.json')),scope:report.scope}));
