export function extendQa(set,qa){
 const add=(q,id,kind,answer,verdicts,note)=>{
  if(qa.cases.some(c=>c.id===id))return;
  qa.cases.push({id,kind,subquestion_id:q.id,answer,expected_points:verdicts.filter(v=>v==='met').length,note,
   expected_verdicts:q.criteria.map((c,i)=>({criterion_id:c.id,verdict:verdicts[i],reason:note}))});
 };
 for(const q of set.subquestions)add(q,`${q.id}/root-single-sentence`,'single-sentence',q.model_answer.map(s=>s.replace(/[.。]\s*$/u,'')).join('; ')+'.',q.criteria.map(()=>'met'),'여러 독립 명제를 세미콜론으로 연결한 한 문장이다. 순서·문장 수로 득점을 제한하지 않는다.');
 if(set.id==='draft-09-501-freq01'){
  const q=set.subquestions.find(q=>q.id==='q1');
  add(q,'q1/root-period-only','omission','대상 기간은 11월 30일부터 12월 31일까지이다.',['not_met'],'501.5는 해당 기간의 재고변동이 적절하게 기록되었는지 증거를 얻을 절차를 요구한다. 주어진 날짜만 반복했고 목적·행동은 모두 빠졌다. 기존 빈 문자열 누락과 별도의 비어 있지 않은 누락 사례다.');
 }
 return qa;
}
