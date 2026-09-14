import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {review,dropFacts} from './decisions.mjs';
const D='cpa_uploader/analysis/reviews/case-quality-2026-09-13/';
const read=f=>JSON.parse(fs.readFileSync(D+f));
const before=read('bank-before.json'), bank=structuredClone(before), oldClass=read('classification-before.json');
const entries=structuredClone(oldClass.entries), lineage=[];
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const get=id=>bank.find(s=>s.id===id), q=(id,qid)=>get(id).subquestions.find(q=>q.id===qid);
const cls=(id,qid)=>entries.find(e=>e.set_id===id&&e.subquestion_id===qid);
const fact=(id,fid,text)=>{const s=get(id),f=s.shared_context.facts.find(f=>f.id===fid);if(f)f.text=text;else s.shared_context.facts.push({id:fid,text,scoreable:false});};
function record(id,old,parts){lineage.push({source_set_id:id,source_subquestion_id:old.id,before_points:old.criteria.reduce((n,c)=>n+c.max_points,0),targets:parts.map(p=>({set_id:p.set_id??id,subquestion_id:p.id,criterion_ids:p.criteria.map(c=>c.id),points:p.criteria.reduce((n,c)=>n+c.max_points,0)}))});}
function part(old,id,ids,prompt,answer,type=old.type){
 const result={...structuredClone(old),id,type,prompt,model_answer:answer,criteria:old.criteria.filter(c=>ids.includes(c.id))};
 assert.equal(result.criteria.length,ids.length);
 result.requirements=old.requirements.filter(r=>result.criteria.some(c=>c.requirement_id===r.id));
 if(result.decision)delete result.decision;
 return result;
}
function split(id,qid,specs){
 const s=get(id),old=q(id,qid),base=structuredClone(cls(id,qid));
 const parts=specs.map(sp=>part(old,sp.id,sp.ids,sp.prompt,sp.answer,sp.type));
 assert.deepEqual(parts.flatMap(p=>p.criteria.map(c=>c.id)).sort(),old.criteria.map(c=>c.id).sort());
 s.subquestions.splice(s.subquestions.indexOf(old),1,...parts);
 for(let i=0;i<parts.length;i++){
   const sp=specs[i],p=parts[i],metadata={...structuredClone(base),subquestion_id:p.id,question_style:sp.style??base.question_style,standalone_prompt:sp.style==='standard'?p.prompt:null,case_fact_ids:sp.style==='standard'?[]:base.case_fact_ids,reason:sp.reason??review[id][1][qid]};
   const at=entries.findIndex(e=>e.set_id===id&&e.subquestion_id===p.id);if(at>=0)entries[at]=metadata;else entries.push(metadata);
 }
 record(id,old,parts);
 return parts;
}
for(const [id,fids]of Object.entries(dropFacts))get(id).shared_context.facts=get(id).shared_context.facts.filter(f=>!fids.includes(f.id));
fact('pilot-04-005','fact2','회계법인은 저장 공간을 확보하기 위해 최종감사파일의 취합이 끝난 지난 감사의 일부 문서를 삭제하려고 한다. 해당 감사문서의 보존기간은 아직 끝나지 않았다.');
q('pilot-04-005','sub1').prompt='회계법인의 감사문서 삭제 계획이 허용되는지 판단하고, 삭제·폐기 금지 대상 문서의 범위를 근거로 설명하시오.';
fact('pilot-12-001','fact1','12월 31일이 재무제표일인 회사의 감사를 마무리하고 있다. 경영진이 제출한 계속기업 평가자료는 재무제표일 다음 날부터 다음 해 10월 31일까지의 10개월을 대상으로 한다. 재무보고체계나 법규가 이 사례에서 더 긴 평가기간을 요구하는 상황은 아니다.');
q('pilot-12-001','subq2').prompt='제시된 경영진의 계속기업 평가기간에 대하여 감사인이 요청해야 할 조치를, 최소 평가기간에 관한 근거와 함께 설명하시오.';
cls('pilot-12-001','subq2').case_fact_ids=['fact1'];
fact('pilot-13-007','fact1','A사는 급여 계산과 지급업무를 서비스조직 C사에 위탁하고 있다.');
fact('draft-04-320-freq01','f0','이 사례의 감사대상 보고기간은 2026년 1월 1일부터 12월 31일까지이다.');
fact('draft-09-501-freq01','f0','이 사례의 감사대상 보고기간은 2026년 1월 1일부터 12월 31일까지이다.');
fact('pilot-01-005','f1','한결회계법인은 2026년 2월 1일, 2026년 1월 1일 개시하는 보고기간의 재무제표감사 수임을 검토하고 있다. 갑과 을은 서로 다른 회사이고 두 상황은 독립적이다. 네트워크 회계법인이나 업무팀원의 개인적 관계는 고려하지 않는다.');
fact('pilot-04-006','f1','한결회계법인은 2026년 1월 1일 개시하는 한빛회사의 재무제표를 감사한다. 감사보고서일은 2027년 3월 15일이고 최종감사파일 취합 완료 예정일은 2027년 4월 20일이다.');
fact('pilot-07-006','fact2','계속감사의 감사팀은 다음 두 독립 상황을 검토한다. 통제의 설계와 실행 자체를 처음 이해하는 단계는 마쳤으며 통제의 운영효과성에 관한 증거 이용이 쟁점이다.');
fact('pilot-07-006','fact3','상황 A: 유의적 위험에 대응하는 통제는 아닌 매출승인 통제에 의존하려 한다. 팀원은 담당자에게 변경된 사항이 없다는 설명만 듣고, 직전 감사의 통제테스트 결과를 당기에도 이용하자고 제안했다. 아직 변경 여부를 뒷받침하는 관찰이나 검사는 하지 않았다.');
fact('pilot-11-005','f2','상황 가: 경영진은 비상장 투자주식의 가치평가에 사용한 방법·유의적 가정·데이터에 관한 자료를 제공하였다. 감사인은 경영진의 회계추정치 도출방법을 테스트하는 접근방법을 선택했다. 팀원의 계획은 그 방법·가정·데이터의 선택과 적용에 관한 위험 테스트만 포함한다. 팀원은 이 입력요소를 모두 테스트하면 도출방법에 대한 감사범위가 충분하다고 주장한다.');
fact('pilot-11-005','f4','상황 나(가와 독립): 감사인은 자체 범위추정치를 도출하는 접근방법을 사용한다. 현재까지 확인한 것은 경영진의 점추정치가 검토 중인 범위의 최솟값과 최댓값 사이에 들어간다는 사실뿐이다. 그 외의 범위추정치 검증이나 관련 공시에 대한 절차는 수행하지 않았다.');
q('pilot-11-005','sub3').prompt='상황 나에서 경영진의 점추정치가 범위 안에 있다는 이유만으로 검증을 종료할 수 있는지 판단하시오. 범위에 포함할 금액의 두 요건과 추정불확실성 공시에 대하여 추가로 수행할 절차를 설명하시오.';
cls('pilot-11-005','sub3').case_fact_ids=['f1','f4'];
fact('pilot-16-011','f1','한결회계법인은 2025년 말 자산총액이 8천억원인 주권상장법인 다온회사의 2026년 1월 1일 개시하는 재무제표를 감사한다. 재무제표와 그 감사증거에는 별도의 문제가 없으며 기타정보의 오류로 감사증거 전반의 신뢰성에 의문이 생긴 드문 상황은 아니다.');
fact('pilot-03-006','f3','을: 매출채권에 관한 충분하고 적합한 감사증거를 입수할 수 없게 되자, 의뢰인은 한정의견이나 의견거절을 피하기 위해 감사에서 검토로 변경해 달라고 요청한다.');
const reclass=q('pilot-03-006','sub3');
reclass.prompt='감사업무가 합리적 정당성에 따라 관련 서비스로 변경되었고 법률·계약상 검토와 새 조건의 합의·기록을 마친 경우, 변경 후 업무와 보고서가 따라야 할 범위를 설명하시오. 관련 서비스 보고서에 당초 감사업무와 수행 절차를 언급하는 원칙을 설명하고, 합의된 절차 업무로 변경된 경우의 예외를 구별하시오.';
reclass.model_answer[3]=reclass.model_answer[3].replace('병-2','경우');
reclass.criteria.find(c=>c.id==='crit7').claim=reclass.criteria.find(c=>c.id==='crit7').claim.replace('병-2','경우');
for(const c of reclass.criteria)for(const f of c.critical_facts)f.expected=f.expected.replace('병-2','경우');
Object.assign(cls('pilot-03-006','sub3'),{question_style:'standard',standalone_prompt:reclass.prompt,case_fact_ids:[],reason:review['pilot-03-006'][1].sub3});
fact('pilot-04-007','f1','한결회계법인은 2026년 1월 1일 개시하는 재무제표의 감사를 계획하고 있다. 수행중요성을 재무제표 전체 중요성을 기준으로 결정하려는 상황이다.');
fact('pilot-04-007','f2','팀원 을은 기업의 사정과 무관하게 모든 기업에 동일한 고정 비율을 곱하는 기계적인 계산만으로 수행중요성을 정하자고 제안한다.');
q('pilot-08-008','sub1').prompt='자격증만 확인한 상태에서 해당 전문가에 관하여 추가로 평가해야 할 사항을 적격성·역량·객관성으로 나누어 설명하시오. 각각 산업경험, 시간·인력, 보수 약정의 사실과 연결하시오.';
fact('pilot-06-008','fact2','반도체 부품을 생산하는 회사는 새 기술에 대응하여 거액의 생산설비를 취득했다. 기술 발전과 경쟁사의 신제품 출시가 빨라졌고, 회사는 제품 불량 때문에 일정 기간 가동을 중단했다. 감사인은 설비의 손상 및 재고 진부화와 관련한 자산 평가 주장의 고유위험을 평가하고 있다.');
fact('pilot-13-011','f1','온유회사의 2026년 1월 1일부터 12월 31일까지의 재무제표를 감사한다. 회사는 급여처리를 서비스조직에 맡기고 있으며 감사인은 통제의 운영효과성 증거로 해당 서비스조직의 유형 2 보고서를 이용할 계획이다.');
fact('pilot-13-011','f3','이용하려는 유형 2 보고서는 급여데이터 처리를 맡은 하위서비스조직의 통제를 범위에서 제외한다. 감사인은 그 하위서비스가 온유회사의 재무제표감사와 관련이 있다고 판단했다.');
q('pilot-13-011','sub2').prompt='하위서비스조직의 통제가 보고서 범위에서 제외되었다는 이유로 해당 서비스에 관한 검토를 생략할 수 있는지 판단하고, 제시된 관련성 조건에서 적용해야 할 기준서 요구를 설명하시오.';
fact('pilot-10-006','fact2','감사팀은 매출채권의 특정 주장에 관한 세부테스트를 위해 전체항목보다 적은 표본을 검사하였다. A와 B는 서로 독립된 가상 상황이다. 금액·표본수 계산은 요구하지 않는다.');
fact('pilot-10-007','fact2','회사는 차입거래가 많고 이자비용이 중요하다. 감사팀은 이자비용에 관한 실증적 분석절차를 설계하고 있다. 금액·평균·비율 계산은 요구하지 않는다.');
// The scope excludes the reliability checklist; explicitly distinguish that exclusion from a claim it is optional.
fact('pilot-10-007','fact4','특정 이자비용 주장에 대하여 평가된 중요왜곡표시위험과 관련 세부테스트를 고려한 결과 실증적 분석절차가 적합하다고 판단하였다. 기초자료의 신뢰성에 관한 평가도 별도로 마쳤다. 이후 회사가 제공한 평균차입금·평균이자율 자료로 단순 계산한 값이 장부금액과 비슷하다는 이유로 절차를 마치려 한다. 계산한 값의 기대치로서의 정확성은 아직 평가하지 않았고, 추가조사 없이 수용할 차이의 기준도 정하지 않았다.');
fact('pilot-15-006','f3','별도의 의견거절근거 단락에는 증거를 입수하지 못한 이유가 적절히 기재되어 있다. 이번 물음은 의견 단락만 대상으로 하며 다른 단락의 작성은 요구하지 않는다.');
fact('pilot-14-008','f1','다온그룹의 2026년 개시 보고기간에 관한 그룹감사를 2027년에 수행한다. 국내 KGA 600의 그룹업무팀·부문감사인 구분을 적용한다. 아래 보고한도와 부문중요성 합계에 관한 제안은 독립적이며 금액 계산은 요구하지 않는다.');
fact('pilot-19-005','f2','현재까지 수행한 검토절차에서 중요한 수정이나 변형된 검토의견을 필요로 하는 사항은 발견하지 않았다. 다만 경영진 서면진술의 입수 등 종결 절차는 아직 남아 있다.');

{
const id='pilot-16-008',old=q(id,'sub1');split(id,'sub1',[
 {id:'sub1',ids:['crit1','crit2','crit2.p2'],prompt:'상황 가에서 당기재무제표의 감사의견을 변형해야 하는지 판단하고, 변형근거문단에 언급할 재무수치의 범위를 설명하시오. 구체적인 변형의견 유형은 선택하지 않아도 된다.',answer:old.model_answer.slice(0,2)},
 {id:'sub4',ids:['crit3','crit4'],prompt:'상황 나에서 당기수치에 미치는 영향이 중요하지 않더라도 당기 감사의견을 변형해야 하는지 판단하고, 변형근거문단에 설명할 이유를 제시하시오.',answer:old.model_answer.slice(2)}]);}
{
const id='pilot-08-007',a=q(id,'sub2'),b=q(id,'sub3'),original=structuredClone(a),moved=a.criteria.find(c=>c.id==='crit5');
a.criteria=a.criteria.filter(c=>c.id!=='crit5');a.model_answer.pop();
a.prompt='미기록 매출의 완전성을 검증하기 위해 출발할 모집단과 추적 방향을 설명하시오. 선정한 기초자료를 감사증거로 이용하기 전에 확인할 관련성과 신뢰성도 제시하시오.';
b.criteria.unshift(moved);b.model_answer.unshift(original.model_answer.at(-1));
for(const r of a.requirements)if(moved.requirement_id===r.id&&!b.requirements.some(x=>x.id===r.id))b.requirements.push(r);
a.requirements=a.requirements.filter(r=>a.criteria.some(c=>c.requirement_id===r.id));
b.prompt='국외 매출의 기간귀속을 검증할 때 대조할 증빙·인식시점·회계기간을 설명하시오. 이어 종전 결산일 전후 7일의 검사 범위를 그대로 사용하는 계획을 평가하고, 운송·인수기간의 변화에 맞게 대상기간을 어떻게 보완할지 이유와 함께 설명하시오.';
record(id,original,[a,{id:b.id,criteria:[moved]}]);}
{
const id='pilot-07-006',old=q(id,'sub1');split(id,'sub1',[
 {id:'sub1',ids:['crit1','crit13','crit14'],prompt:'상황 A에서 전기 통제증거를 당기에 이용하기 전에 확인할 관련성과 신뢰성을 설명하시오. 담당자의 설명에 추가하여 수행할 증거입수 방법도 제시하시오.',answer:old.model_answer.slice(0,3)},
 {id:'sub4',ids:['crit2','crit3','crit4'],style:'standard',prompt:'유의적 위험에 대응하는 통제가 아닌 통제의 전기 운영효과성 증거를 재사용하려 한다. 증거의 계속적 관련성에 영향을 주는 변화가 있을 때와 없을 때의 재테스트 요구를 구별하고, 매 감사에 통제테스트를 배분하는 원칙을 설명하시오. 주기는 감사 횟수로 제시하시오.',answer:old.model_answer.slice(3)}]);}
{
const id='pilot-11-005',s=get(id),old=q(id,'sub1'),newId=id+'-input-tests';
const casePart=part(old,'sub1',['sub1.crit1','sub1.crit8','sub1.crit9'],'상황 가의 팀원 계획만으로 도출방법에 대한 감사범위가 충분한지 판단하고, 입력요소 테스트 외에 누락된 두 검증대상을 설명하시오.',[old.model_answer[0],...old.model_answer.slice(7)],'judgment');
s.subquestions[s.subquestions.indexOf(old)]=casePart;
const labels=[['방법',2,3],['유의적 가정',4,5],['데이터',6,7]];
const standard=structuredClone(s);standard.id=newId;standard.title='회계추정치 입력요소의 선택과 적용 테스트';standard.shared_context.facts=[];
standard.status='needs_review';standard.verification.review_status='needs_human_review';
standard.verification.notes=[s.verification.notes[0],'2026-09-13 pilot-11-005/sub1의 일반 입력요소 테스트 6점을 분리한 기준서형 묶음이다. 원 criterion ID·정수 배점·공식 출처를 보존하며 신규 쟁점을 추가하지 않는다. 계보와 검수는 case-quality-2026-09-13 장부에서 확인한다.'];
standard.subquestions=labels.map(([label,a,b],i)=>{
 const out=part(old,'input'+(i+1),['sub1.crit'+a,'sub1.crit'+b],`경영진의 회계추정치 도출방법을 테스트하는 접근방법에서 ${label}에 관하여 다루어야 할 중요왜곡표시위험의 두 측면을, 선택과 적용으로 구별하여 설명하시오.`,[old.model_answer[a-1],old.model_answer[b-1]],'descriptive');
 out.question_style='standard';out.topic_ids=['11'];
 entries.push({set_id:newId,subquestion_id:out.id,question_style:'standard',topic_ids:['11'],standalone_prompt:out.prompt,case_fact_ids:[],reason:review[id][1].sub1});return out;
});
standard.source_refs=standard.source_refs.filter(r=>r.id==='std-540-22');standard.classification.standards=['KGA 540'];
bank.push(standard);record(id,old,[casePart,...standard.subquestions.map(p=>({...p,set_id:newId}))]);
}
{
const id='pilot-14-006',old=q(id,'sub2');split(id,'sub2',[
 {id:'sub2',ids:['sub2.crit1','sub2.crit2'],prompt:'B의 산업지식 부족에 관한 대응을 설명하시오.',answer:old.model_answer.slice(0,2)},
 {id:'sub3',ids:['sub2.crit3'],prompt:'C에게 업무를 요청할 수 있는지 판단하시오.',answer:old.model_answer.slice(2),type:'judgment'}]);
q(id,'sub2').prompt='B의 산업지식 부족에 관한 우려를 다루기 위하여 그룹업무팀이 취할 수 있는 관여를, 위험평가절차 수행과 관련 감사문서 검토의 각 측면에서 설명하시오.';
q(id,'sub3').prompt='전문가적 적격성에 대한 우려가 해소되지 않은 C에게 부문재무정보에 관한 업무를 요청할 수 있는지 판단하시오.';
cls(id,'sub3').case_fact_ids=['f4'];cls(id,'sub2').case_fact_ids=['f3'];}
{
const id='pilot-14-007',old=q(id,'sub3');split(id,'sub3',[
 {id:'sub3',ids:['sub3.crit1','sub3.crit7'],prompt:'C군의 상황에서 그룹업무팀이 추가 업무를 위해 취할 부문 선정 조치를 설명하시오. 이후 기간이 경과할 때 그 부문 선택에 적용할 원칙도 제시하시오.',answer:[old.model_answer[0],old.model_answer[6]]},
 {id:'sub4',ids:['sub3.crit2','sub3.crit3','sub3.crit4','sub3.crit5','sub3.crit6'],style:'standard',prompt:'그룹감사의견을 위한 충분하고 적합한 증거를 얻기 어려울 것으로 예상하여 유의적이지 않은 부문 중 일부를 추가 업무 대상으로 선정하였다. 감사기준서 600 문단 29에 따라 해당 부문에서 선택할 수 있는 네 업무유형과, 부문재무정보 전체의 감사 또는 검토에 사용할 중요성을 제시하시오.',answer:old.model_answer.slice(1,6)}]);}
{
const id='pilot-17-005',old=q(id,'sub3');split(id,'sub3',[
 {id:'sub3',ids:['crit6','crit11','crit7','crit12'],prompt:'병의 내부회계관리제도 의견거절 보고서에 기술할 감사범위와 실질적 사유를 설명하시오. 보고서에서 제외해야 할 수행절차·감사특성에 관한 문구도 제시하시오.',answer:old.model_answer.slice(0,4)},
 {id:'sub4',ids:['crit8','crit13'],style:'standard',prompt:'감사범위 제한으로 내부회계관리제도감사를 만족스럽게 완료할 수 없을 때, 감사완료 불가 사실을 누구에게 어떤 형식으로 커뮤니케이션해야 하는지 모두 제시하시오.',answer:old.model_answer.slice(4)}]);}
{
const id='pilot-04-007',old=q(id,'sub2');split(id,'sub2',[
 {id:'sub2',ids:['crit4','crit10'],prompt:'을의 수행중요성 결정방식이 적절한지 판단하고, 기계적인 계산 외에 필요한 판단의 성격을 설명하시오.',answer:old.model_answer.slice(0,2)},
 {id:'sub4',ids:['crit5','crit6','crit7'],style:'standard',prompt:'재무제표 전체 중요성을 기준으로 수행중요성을 결정할 때 영향을 주는 기업 이해, 과거 왜곡표시 및 당기 예상에 관한 고려사항을 각각 설명하시오. 비율이나 금액의 계산은 요구하지 않는다.',answer:old.model_answer.slice(2)}]);}
{
const id='pilot-09-010',old=q(id,'sub2');split(id,'sub2',[
 {id:'sub2',ids:['sub2.crit1','sub2.crit2','sub2.crit3','sub2.crit4','sub2.crit5'],prompt:'당기에 회수한 기초매출채권으로 보고기간 개시일의 어떤 주장에 관한 증거를 얻을 수 있는지 감사기준서 510 문단 A6에 따라 모두 제시하고, 이 회수내역만으로 얻는 증거의 범위 한계를 설명하시오.',answer:old.model_answer.slice(0,5)},
 {id:'sub4',ids:['sub2.crit6','sub2.crit7'],prompt:'기초재고의 감사증거를 얻기 위하여, 제시된 당기 실사·수량변동 자료와 기초재고 평가자료를 각각 어떻게 이용할지 설명하시오. 매출총이익·기간귀속 절차는 이번 물음의 범위에서 제외한다.',answer:old.model_answer.slice(5),type:'descriptive'}]);}
{
const id='pilot-10-007',old=q(id,'sub2');split(id,'sub2',[
 {id:'sub2',ids:['crit4','crit6','crit7'],prompt:'계산값과 장부금액이 비슷하다는 이유로 절차를 종료하려는 계획을 평가하시오. 계산값을 감사인의 기대치로 이용하기 위해 보완할 정확성 평가와 추가조사 없이 수용할 차이에 관한 결정을 설명하시오.',answer:old.model_answer.slice(0,3)},
 {id:'sub4',ids:['crit15','crit16','crit17'],style:'standard',prompt:'실증적 분석절차에서 추가조사 없이 수용할 수 있는 기록금액과 기대치의 차이금액을 결정할 때 고려할 요소를, 감사기준서 520 문단 A16의 범위에서 모두 제시하시오.',answer:old.model_answer.slice(3)}]);}
{
const id='pilot-17-006',old=q(id,'sub1');split(id,'sub1',[
 {id:'sub1',ids:['crit1','crit7','crit8'],prompt:'갑에서 팀원 A의 통제테스트 생략 제안을 평가하고, 실증절차 결과의 한계와 선정 통제에 대해 수행할 절차를 설명하시오.',answer:old.model_answer.slice(0,3)},
 {id:'sub4',ids:['crit2','crit9'],prompt:'갑에서 팀원 B가 말한 개별 통제별 효과성 의견에 대한 책임이 있는지 판단하시오. 각각의 관련경영진주장에 대하여 선정된 통제의 증거입수 책임과 구별하여 설명하시오.',answer:old.model_answer.slice(3)}]);}
{
const id='pilot-18-005',old=q(id,'sub3');split(id,'sub3',[
 {id:'sub3',ids:['crit11','crit17','crit12','crit18'],prompt:'A와 B가 각각 감사기준서 1200의 소규모기업 적용대상에 해당하는지 판단하고, 자산·매출의 양적 조건과 연결하여 결정적인 이유를 설명하시오.',answer:old.model_answer.slice(0,4)},
 {id:'sub4',ids:['crit13','crit19','crit14','crit20'],prompt:'C와 D가 각각 감사기준서 1200의 소규모기업 적용대상에 해당하는지 판단하고, C는 양적 조건의 경계값에, D는 연결재무제표 작성 사실에 연결하여 이유를 설명하시오.',answer:old.model_answer.slice(4)}]);}

// Keep the existing source-set identities and legacy classification sidecar. New standalone output has explicit metadata.
// Refer to stable situation names because case and standard learning units have different display numbers.
for(const id of ['pilot-16-008','pilot-09-010']){
 for(const f of get(id).shared_context.facts)f.text=f.text.replace(/물음\s*[13]의\s*/g,'');
 for(const p of get(id).subquestions)if(cls(id,p.id)?.question_style==='case')p.prompt=p.prompt.replace(/물음\s*3의\s*/g,'');
}
for(const f of get('pilot-14-008').shared_context.facts)f.text=f.text.replace('물음 2:', '상황 가:').replace('물음 3:', '상황 나:');
q('pilot-14-008','sub2').prompt='상황 가의 제안이 적절한지 판단하고, 그 판단의 근거로 보고한도를 최종 결정할 책임 주체를 제시하시오.';
q('pilot-14-008','sub3').prompt='상황 나의 제안이 적절한지 판단하고, 부문중요성의 설정과 그 합계가 그룹재무제표 전체 중요성에 대해 가질 수 있는 관계를 이유로 설명하시오.';
q('pilot-07-006','sub1').prompt='상황 A의 증거 이용 계획을 검토하시오. 계속적 관련성과 신뢰성에 관하여 추가로 확인할 사항, 그 확인에 사용할 증거입수 방법을 설명하시오.';
q('pilot-09-010','sub2').prompt='제시된 기초매출채권 관련 자료가 보고기간 개시일의 어떤 주장에 관한 증거를 제공할 수 있는지 감사기준서 510 문단 A6에 따라 모두 제시하고, 이 자료만으로 얻는 증거의 범위 한계를 설명하시오.';
fact('pilot-09-010','case-team-plan','팀장은 전임감사인의 조서를 볼 수 없다는 이유만으로 기초잔액 증거 입수가 불가능하다고 결론 내리고 곧바로 의견을 변형하려 한다.');
const opening=get('pilot-09-010');
opening.shared_context.facts.find(f=>f.id==='f3').text='앞선 계획 검토와 독립된 후속 상황 A와 B는 다음과 같다. '+opening.shared_context.facts.find(f=>f.id==='f3').text;
opening.shared_context.facts.sort((a,b)=>['f1','case-team-plan','f2','f3'].indexOf(a.id)-['f1','case-team-plan','f2','f3'].indexOf(b.id));
q('pilot-09-010','sub1').prompt='팀장의 계획이 적절한지 판단하고, 감사기준서 510 문단 6(c)에서 전임조서 검토 외에 고려할 두 증거경로를 모두 제시하시오.';
cls('pilot-09-010','sub1').case_fact_ids.push('case-team-plan');
cls('pilot-16-008','sub1').case_fact_ids=['scope','case1'];
cls('pilot-16-008','sub4').case_fact_ids=['scope','case2'];
cls('pilot-08-007','sub2').case_fact_ids=['fact2'];
cls('pilot-18-005','sub3').case_fact_ids=['f2','f3'];
cls('pilot-18-005','sub4').case_fact_ids=['f2','f3','f4'];
// Keep the source requirements unchanged, but remove stale situation labels from the standalone answer.
const standalone=q('pilot-16-011','sub2');
standalone.model_answer=standalone.model_answer.map(t=>t.replaceAll('을-1','①').replaceAll('을-2','②'));
for(const c of standalone.criteria){c.claim=c.claim.replaceAll('을-1','①').replaceAll('을-2','②');for(const f of c.critical_facts)f.expected=f.expected.replaceAll('을-1','①').replaceAll('을-2','②');}
const changed=[];
for(const s of bank){
 s.learning_order=s.subquestions.map(q=>q.id);
 const original=before.find(x=>x.id===s.id);
 if(!original||JSON.stringify(s)!==JSON.stringify(original)){
  s.verification.notes.push('2026-09-13 사례형 전수 검토 후속본: 사실 활용·요구 범위 수정. 최종 검수·게시 여부는 새 실행 장부로 확인.');
  changed.push(s.id);
 }
}
for(const e of entries){
 const s=get(e.set_id);assert(s);
 if(e.question_style==='case'){
  e.case_fact_ids=e.case_fact_ids.filter(id=>s.shared_context.facts.some(f=>f.id===id));
  assert(s.shared_context.facts.length>0);
  if(review[e.set_id])e.reason=review[e.set_id][1][e.subquestion_id]??e.reason;
 }
}
const ledger=Object.entries(review).flatMap(([id,[setReason,questions]])=>Object.entries(questions).map(([qid,reason])=>{
 const s=before.find(s=>s.id===id),old=s.subquestions.find(q=>q.id===qid),now=q(id,qid);
 return {set_id:id,subquestion_id:qid,reviewer:'Codex agent',method:'agent_content_review',human_review_performed:false,set_rationale:setReason,rationale:reason,
 source_content_hash:hash(s),before_points:old.criteria.reduce((n,c)=>n+c.max_points,0),before_criterion_ids:old.criteria.map(c=>c.id),
 source_ref_ids:[...new Set(old.criteria.flatMap(c=>c.source_ref_ids))],before_model_answer:old.model_answer,
 after_style:cls(id,qid).question_style,after_points:now.criteria.reduce((n,c)=>n+c.max_points,0),
 criterion_disposition:old.criteria.map(c=>({criterion_id:c.id,targets:bank.flatMap(s=>s.subquestions.filter(q=>q.criteria.some(n=>n.id===c.id)&& (s.id===id||s.id===id+'-input-tests')).map(q=>({set_id:s.id,subquestion_id:q.id}))),decision:'independent meaning and integer weight retained'})),
 minimum_sufficient_answer:now.model_answer,changed:JSON.stringify(old)!==JSON.stringify(now)||JSON.stringify(s.shared_context)!==JSON.stringify(get(id).shared_context)};
}));
assert.equal(ledger.length,72);
const candidate='candidate-v1.json';fs.writeFileSync(D+candidate,JSON.stringify(bank,null,2)+'\n');
fs.writeFileSync(D+'classification-v1.json',JSON.stringify({source_file:D+candidate,source_file_sha256:hash(fs.readFileSync(D+candidate,'utf8')),entries},null,2)+'\n');
for(const [file,data]of [['audit-v1.json',ledger],['lineage-v1.json',lineage],['changed-sets-v1.json',changed]])fs.writeFileSync(D+file,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({sets:bank.length,questions:bank.flatMap(s=>s.subquestions).length,changed_sets:changed.length,reviewed:ledger.length,points_before:before.flatMap(s=>s.subquestions.flatMap(q=>q.criteria)).reduce((n,c)=>n+c.max_points,0),points_after:bank.flatMap(s=>s.subquestions.flatMap(q=>q.criteria)).reduce((n,c)=>n+c.max_points,0),case_after:entries.filter(e=>e.question_style==='case').length},null,2));
