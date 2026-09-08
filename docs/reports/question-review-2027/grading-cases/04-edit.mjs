// One-time local topic 04 correction; baseline is preserved separately.
import fs from 'node:fs';
import crypto from 'node:crypto';
const file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file));
const sets=bank.filter(s=>s.classification.topic_id==='04');
const [s1,s2,s3,s4,s5]=sets;
function source(s,id,start,end,span) {
  const r=s.source_refs.find(r=>r.id===id), text=fs.readFileSync(r.file,'utf8');
  const a=text.indexOf(start), b=text.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error('Source span not found');
  r.source_quote=text.slice(a,b).trim();
  for(const q of s.subquestions)for(const req of q.requirements)if(req.source_ref_id===id){req.source_quote=r.source_quote;req.source_span=span;}
}
source(s4,'src2','8. 감사인은 이전에 해당 감사에 관여되지','9. 감사인은 수행한 감사절차','KGA 230 문단 8(a)-(c)');
source(s5,'src2','14. 감사인은 다음의 금액','---','KGA 320 문단 14(a)-(d)');
s1.classification.tags=['전반감사전략','감사계획','중요성','수행중요성'];
s1.subquestions[0].model_answer=['전반감사전략과 세부적인 감사계획은 반드시 개별적이거나 순차적인 과정으로 수립할 필요는 없다. 한쪽이 변경되면 다른 쪽도 변경될 수 있으므로 서로 밀접하게 관련되어 있기 때문이다.'];
s1.subquestions[1].type='descriptive';
s1.subquestions[1].prompt='감사인이 재무제표 전체에 대한 중요성(해당되는 경우 특정 거래유형·계정잔액·공시의 중요성 수준 포함)을 최초에 결정한 금액보다 낮추는 것이 적합하다고 결정하였다. 이 경우 수행해야 할 후속 조치를 모두 서술하시오.';
s1.subquestions[1].model_answer=['감사인은 수행중요성을 수정할 필요가 있는지, 그리고 추가감사절차의 성격·시기·범위가 여전히 적합한지를 결정해야 한다.'];
s1.subquestions[1].criteria[0].claim='수행중요성을 수정할 필요가 있는지 결정함(자동으로 낮추어야 한다는 의미가 아님)';
s2.subquestions[1].criteria[0].critical_facts[0].expected='전반감사전략 자체의 문서화. 중요한 변경내용만 기록한다고 한 경우 변경 대상 명칭에 전반감사전략이 포함되어 있다는 이유로 별도 항목인 전략 자체의 문서화에 득점하지 않음';
s2.subquestions[1].criteria[1].critical_facts[0].expected='감사계획 자체의 문서화. 중요한 변경내용만 기록한다고 한 경우 변경 대상 명칭에 감사계획이 포함되어 있다는 이유로 별도 항목인 계획 자체의 문서화에 득점하지 않음';
s3.subquestions[0].prompt='전반감사전략을 수립할 때 감사인이 확인해야 하는 감사 수행에 필요한 자원의 세 가지 측면을 모두 제시하시오.';
s3.subquestions[1].criteria[1].critical_facts[0].expected='경영진주장 수준에서 계획된 추가감사절차 포함';
s3.subquestions[1].criteria[0].claim='계획된 위험평가절차의 범주를 제시함';
s3.subquestions[1].criteria[0].critical_facts[0].expected='계획된 위험평가절차. 범주를 묻는 발문이므로 기준서 315라는 번호 자체는 필수 아님';
s3.subquestions[1].criteria[1].claim='경영진주장 수준에서 계획된 추가감사절차의 범주를 제시함';
s3.subquestions[1].criteria[1].critical_facts[0].expected='경영진주장 수준에서 계획된 추가감사절차. 범주를 묻는 발문이므로 기준서 330이라는 번호 자체는 필수 아님';
s4.subquestions[0].prompt='감사문서는 언제 작성해야 하는지 감사기준서의 요구사항을 서술하시오.';
s4.subquestions[1].model_answer[2]='감사 중 발생한 유의적 사항, 그에 대해 도달한 결론 및 결론에 도달할 때 행한 유의적인 전문가적 판단';
s5.title='최종감사파일의 보존과 중요성의 문서화';
s5.shared_context.facts[0].text='다음 각 물음은 서로 독립된 상황이다. 각 물음에 제시된 상황을 기준으로 답하시오.';
s5.subquestions[0].prompt='회계법인이 저장 공간 확보를 이유로 최종감사파일의 취합이 완료된 지난 감사의 일부 감사문서를 삭제하려고 한다. 보존기간이 끝나기 전에 이러한 삭제가 허용되는지 판단하고, 금지 대상 감사문서의 범위를 근거로 설명하시오.';
s5.subquestions[0].criteria[0].critical_facts[0].expected='보존기간 종료 전 삭제·폐기 금지. 기간 숫자나 기산점의 기재 자체를 요구하지 않지만, 외부감사법상 감사의 법정 보존기간을 명시하는 경우 감사종료 시점부터이며 취합완료일부터라고 바꾸면 금지 조건을 훼손한 반대 의미이다';
s5.subquestions[1].prompt='중요성과 관련하여 감사문서에 포함해야 하는 네 가지 금액·수정 사항을 적용 조건과 함께 모두 제시하고, 그 금액 외에 함께 문서화해야 하는 내용도 서술하시오.';
s5.subquestions[1].model_answer=['재무제표 전체에 대한 중요성 금액과 그 금액을 결정할 때 고려한 요소','해당되는 경우 특정 거래유형·계정잔액·공시에 대한 중요성 수준과 그 금액을 결정할 때 고려한 요소','수행중요성 금액과 그 금액을 결정할 때 고려한 요소','감사의 진행에 따른 위 세 금액의 수정내용과 수정된 금액을 결정할 때 고려한 요소'];
const expected=['재무제표 전체에 대한 중요성 금액 및 결정 시 고려한 요소','해당되는 경우 특정 거래유형·계정잔액·공시의 중요성 수준 및 결정 시 고려한 요소','수행중요성 금액 및 결정 시 고려한 요소','감사 진행에 따른 앞의 세 금액 수정내용 및 수정된 금액 결정 시 고려한 요소'];
s5.subquestions[1].criteria.forEach((c,i)=>{c.claim=expected[i]+'의 문서화를 제시함. 금액 명칭만으로는 충족하지 않으며, 고려 요소에 대한 공통 서술은 각 항목에 함께 적용할 수 있음';c.critical_facts[0].expected=expected[i];});
const spans=[['300 A10','320 13'],['300 6(a)-(c)','300 12(a)-(c)'],['300 7-8(e)','300 9(a)-(c)'],['230 7','230 8(a)-(c)'],['230 15','320 14(a)-(d)']];
sets.forEach((s,i)=>{
  s.subquestions.forEach(q=>{q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};if(q.type==='enumeration'&&!q.prompt.includes('모두'))q.prompt=q.prompt.replace('제시하시오.','모두 제시하시오.');});
  s.source_refs.forEach((r,j)=>{r.page='KGA '+spans[i][j].split(' ')[0];r.content_hash=crypto.createHash('sha256').update(r.source_quote).digest('hex');});
  const note='2026-09-08 주제04 로컬 수정. source_fidelity=exact는 연결된 로컬 원문과의 일치를 뜻함. 공식 PDF 대조·채점 실측·미확인 범위는 docs/reports/question-review-2027/04.md 및 04.json 참조. 기존 게시/검수 상태는 승급하지 않음.';
  if(!s.verification.notes.includes(note))s.verification.notes.push(note);
});
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');
console.log('Updated topic 04: 5 sets, 10 questions, 26 criteria; points unchanged.');
