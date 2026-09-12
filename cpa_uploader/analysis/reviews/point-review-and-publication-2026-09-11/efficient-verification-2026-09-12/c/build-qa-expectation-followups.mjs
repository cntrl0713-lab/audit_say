import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const E=`${D}/efficient-verification-2026-09-12/c`;
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const jobs=read(`${D}/a/execution-all-v9/manifest.json`).jobs;
const specs={
 'pilot-11-005':[
  {id:'sub1/boundary-1',contra:['sub1.crit1'],reason:'도출방법을 테스트하는 접근방법을 이미 선택한 이 사례에서 입력요소만으로 충분하지 않은 이유는 540.22가 점추정치 선택·관련 공시 개발방법까지 요구하기 때문이다. 범위 밖인 때에만 추가 테스트한다는 배타적 조건은 이 무조건적 범위 요구에 반한다. 구체 방법·가정·데이터의 선택/적용이나 점추정치·공시 테스트 내용은 답안에 없으므로 이웃 명제는 누락으로 둔다.'},
  {id:'sub3/boundary-1',contra:['sub3.crit1'],reason:'발문은 경영진 금액이 범위 안이고 540.29의 검증은 미수행이라고 명시한다. 범위 밖일 때에만 계속한다는 답은 현재 상황에서 종료할 수 없다는 판단을 명시적으로 배제한다. 충분한 증거·합리성·공시 절차의 구체 내용 자체는 제시하지 않아 나머지는 누락이다.'},
 ],
 'pilot-13-010':[
  {id:'sub3/boundary-1',contra:['sub3.crit1','sub3.crit2'],reason:'610.23~24는 활용할 내부감사업무 전체에 충분한 절차를 수행하면서 그중 일부 재수행을 포함하도록 한다. 활용하지 않을 업무만 검증한다는 배타적 범위는 활용할 업무 전체에 대한 검증과 그중 일부 재수행을 모두 배제한다. 절차의 성격·범위를 정하는 네 평가요소에는 답하지 않았으므로 그 네 명제는 누락이다.'},
 ],
};
const entries=[];
fs.mkdirSync(`${E}/qa-expectation-followups-v1`,{recursive:true});
for(const [id,changes] of Object.entries(specs)){
 const job=jobs.find(j=>j.set_id===id),before=read(job.qa_file),after=structuredClone(before);
 for(const change of changes){
  const original=before.cases.find(c=>c.id===change.id),c=after.cases.find(c=>c.id===change.id);assert(c);
  for(const v of c.expected_verdicts)if(change.contra.includes(v.criterion_id)){assert.equal(v.verdict,'not_met');v.verdict='contradicted';v.reason=change.reason;}
  c.note=`${c.note??''}\n후속 agent 대조: ${change.reason}`;
  assert.equal(c.expected_points,original.expected_points);assert.equal(c.answer,original.answer);
  entries.push({set_id:id,case_id:c.id,subquestion_id:c.subquestion_id,before_qa_file:job.qa_file,before_qa_sha256:hash(job.qa_file),before_case:original,after_case:c,reason:change.reason,question_unchanged:true,answer_unchanged:true,score_unchanged:true});
 }
 assert.deepEqual(after.cases.map(c=>[c.id,c.subquestion_id,c.answer]),before.cases.map(c=>[c.id,c.subquestion_id,c.answer]));
 const file=`${E}/qa-expectation-followups-v1/${id}.json`;fs.writeFileSync(file,JSON.stringify(after,null,2)+'\n');
 for(const e of entries.filter(e=>e.set_id===id)){e.after_qa_file=file;e.after_qa_sha256=hash(file);}
}
fs.writeFileSync(`${E}/qa-expectation-followups-v1/changes.json`,JSON.stringify({version:1,reviewer:'agent',api_calls:0,entries},null,2)+'\n');
console.log(JSON.stringify({sets:Object.keys(specs).length,cases:entries.length,question_changes:0,answer_changes:0,point_changes:0}));
