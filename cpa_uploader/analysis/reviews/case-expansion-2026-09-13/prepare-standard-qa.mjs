import fs from 'node:fs';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const P='cpa_uploader/analysis/reviews/case-quality-2026-09-13/execution-v1/representatives.json';
const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/candidate-v5/grading-manifest.json';
const read=f=>JSON.parse(fs.readFileSync(f));
const sets=read(R+'/standards.json'),lineage=read(R+'/standard-lineage.json'),prior=read(P).cases,manifest=read(E),qa=[];
for(const s of sets)for(const q of s.subquestions){
 const old=lineage.find(l=>l.target_set_id===s.id&&l.target_subquestion_id===q.id);
 for(const kind of q.criteria.length>1?['partial','wrong']:['wrong']){
  const p=prior.find(p=>p.set_id===old.source_set_id&&p.subquestion_id===q.id&&p.kind===kind);
  const e=manifest.entries.find(e=>e.source_set_id===old.source_set_id&&e.kind===kind&&e.evaluated_subquestion_ids.includes(q.id));
  assert(p||e,`${s.id}/${q.id}/${kind}`);
  const ex=p??e.expected_by_subquestion.find(x=>x.subquestion_id===q.id),answer=p?.answer??e.answers[q.id];
  assert.deepEqual(ex.expected_verdicts.map(c=>c.criterion_id).sort(),q.criteria.map(c=>c.id).sort());
  assert(kind==='wrong'?ex.expected_points===0:ex.expected_points>0&&ex.expected_points<q.criteria.length);
  qa.push({set_id:s.id,subquestion_id:q.id,kind,answer,expected_points:ex.expected_points,met_criterion_ids:ex.expected_verdicts.filter(v=>v.verdict==='met').map(v=>v.criterion_id),expected_verdicts:ex.expected_verdicts,reason:'기존 독립 발문·기준의 의미와 정수 배점을 보존한 이동. 원 답안 및 기대값을 계보로 가져와 현행 발문·정답과 대조한다. 실제 모델 observation은 재사용하지 않고 새 projection에서 실측한다.',origin:{file:p?P:E,source_set_id:old.source_set_id,subquestion_id:q.id,entry_id:p?.id??e.id}});
 }
}
fs.writeFileSync(R+'/standard-qa.json',JSON.stringify(qa,null,2)+'\n',{flag:'wx'});
for(const x of qa)console.log(JSON.stringify({id:x.set_id,q:x.subquestion_id,kind:x.kind,answer:x.answer,points:x.expected_points,met:x.met_criterion_ids}));
