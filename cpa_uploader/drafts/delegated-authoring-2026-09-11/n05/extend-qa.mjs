export function extendQa(set,qa){
 const add=(qid,id,kind,answer,verdicts,note)=>{
  if(qa.cases.some(c=>c.id===id))return;
  const q=set.subquestions.find(q=>q.id===qid);
  qa.cases.push({id,kind,subquestion_id:qid,answer,expected_points:verdicts.filter(v=>v==='met').length,note,
   expected_verdicts:q.criteria.map((c,i)=>({criterion_id:c.id,verdict:verdicts[i],reason:note}))});
 };
 if(set.id==='pilot-14-007'){
  const implied=qa.cases.find(c=>c.id==='sub3/omit-1');
  if(!implied)throw Error('기존 선정 함축 사례 없음');
  implied.kind='implied_selection';
  implied.expected_points=7;
  implied.note='첫 선정문장을 지워도 C군에 관한 선택 변경 조치와 선정된 부문이라는 후속 답안이 최초 일부 선정을 함축한다. 독립 원문·정책 대조로 실제 모델 실행 전에 누락 분류를 정정했다.';
  implied.expected_verdicts=implied.expected_verdicts.map(v=>({...v,verdict:'met',reason:implied.note}));
  add('sub3','sub3/root-omits-selection-and-change','omission',
   '가능한 업무유형은 개별 부문의 재무정보 전체 감사, 하나 이상의 거래유형·계정잔액 또는 공시에 대한 감사, 개별 부문의 재무정보 전체 검토, 특정의 절차이다. 부문재무정보 전체에 대한 감사 또는 검토에는 부문중요성을 사용한다.',
   ['not_met','met','met','met','met','met','not_met'],
   '업무유형과 중요성만 제시하고 C군에서 일부를 추가 선정할 조치와 기간 경과에 따른 선택 변경을 모두 생략했다. 선택변경이 최초선정을 함축하므로 하나만 문장 삭제한 사례와 구별한다.');
 }
 for(const q of set.subquestions)add(q.id,`${q.id}/root-unrelated`,'omission','그룹에는 여러 부문의 재무정보가 포함되어 있다.',q.criteria.map(()=>'not_met'),'주어진 배경의 반복이며 해당 물음의 판단·조치·업무유형 또는 중요성 요구에 답하지 않았다. 다른 명제가 판단을 함축하는 사례와 구별한다.');
 const boundaries=set.id==='pilot-14-006'?{
  sub1:[
   'A의 독립성 결격이 해소되지 않았더라도 A의 산업경험이 풍부하면 A에게 해당 업무를 요청할 수 있다.',
   '그룹감사인은 해당 A 부문의 증거 대신 본사에 관한 증거만 확보하면 충분하다.',
  ],
  sub2:[
   'B의 경미한 우려에는 그룹업무팀 대신 B 부문의 경영진이 위험평가절차를 수행하면 그룹업무팀이 위험평가에 관여한 것으로 볼 수 있다.',
   'B의 경미한 우려에 대응할 감사문서 검토는 우려되는 산업의 중요한 계정과 무관한 사무실 임차료 조서만 검토하면 언제나 충분하다.',
   'C의 전문가적 적격성에 심각한 우려가 남아 있더라도 C의 감사보수가 저렴하면 업무를 요청할 수 있다.',
  ],
 }:{
  sub1:[
   'A처럼 재무적 유의성이 있는 부문도 재무정보 전체 대신 현금 한 계정만 감사하면 해당 부문에 필요한 업무를 충족한다.',
   'A의 부문재무정보 감사에서는 해당 부문의 중요성이 아니라 그룹의 수행중요성을 그대로 적용한다.',
  ],
  sub2:[
   'B의 전체 재무정보 감사는 현지 법정감사 의무가 있는 때에만 선택 가능한 대안이다.',
   'B에서는 유의적 위험이 공시에만 관련되는 경우에도 공시를 제외한 거래유형이나 계정잔액만 감사하면 이 대안을 충족한다.',
   'B의 특정 감사절차 대안은 감사인의 절차 대신 B의 경영진이 스스로 수행한 내부 검토만으로 갈음한다.',
   'B의 재무정보 전체를 감사하는 대안에는 부문중요성이 아니라 그룹의 수행중요성을 그대로 적용한다.',
   'B에서 유의적 위험이 여러 개 식별되어도 반드시 정확히 한 가지 업무유형만 수행하고 두 유형을 함께 선택해서는 안 된다.',
  ],
  sub3:[
   'C군에서 추가 업무할 부문은 그룹 수준 분석적절차를 전혀 수행하지 않았을 때에만 선정할 수 있다.',
   'C군에서 선정된 부문의 재무정보 전체 감사는 그 부문이 나중에 유의적 부문으로 재분류된 때에만 선택할 수 있다.',
   'C군에서 특정 항목 감사를 선택하려면 거래유형·계정잔액·공시 세 범주를 반드시 전부 동시에 감사해야 한다.',
   'C군에서 부문재무정보 전체 검토는 재무제표가 분기자료일 때에만 허용된다.',
   'C군에서 특정절차를 선택하려면 그 절차 자체가 부문재무정보 전체에 대한 감사의견을 표명하는 업무여야 한다.',
   'C군에서 선정된 부문의 전체감사와 검토에는 부문중요성 대신 그룹 수행중요성을 그대로 사용한다.',
   '기간이 경과해도 선정한 부문은 영구히 고정하고, 그 부문이 청산되는 경우에만 선택을 변경할 수 있다.',
  ],
 };
 for(const q of set.subquestions)for(const [i,answer] of boundaries[q.id].entries()){
  add(q.id,`${q.id}/root-boundary-${i+1}`,'condition_boundary',q.model_answer.map((s,j)=>j===i?answer:s).join('\n'),q.criteria.map((_,j)=>j===i?'contradicted':'met'),
   '대상·주체·발동조건·업무유형·중요성 또는 시점 조건을 실제로 바꾸었다. 나머지 독립 명제는 유지한다. 직접 기준서600.20/26/27/29와 관련 적용자료에서 임의로 추가한 제한 또는 대체를 허용하지 않는다.');
 }
 return qa;
}
