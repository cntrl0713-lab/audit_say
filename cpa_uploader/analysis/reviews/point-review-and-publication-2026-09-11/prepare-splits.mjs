import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(directory,'root');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const clone=structuredClone;
const owners=['b','c'].map(owner=>({file:path.join(directory,owner,'sets.json'),sets:read(path.join(directory,owner,'sets.json'))}));
const all=owners.flatMap(owner=>owner.sets);
const classificationFile='cpa_uploader/analysis/reviews/question-unit-migration-2026-09-11/canonical-classification.json';
const classifications=read(classificationFile).entries;
const sets=[],lineage=[],entries=[];
function splitSet(id,sourceId,groups,order,reason){
  const set=clone(all.find(set=>set.id===id));
  if(!set)throw Error(`Missing ${id}`);
  const before=clone(set), source=set.subquestions.find(q=>q.id===sourceId);
  const ids=groups.flatMap(group=>group.criteria);
  if(new Set(ids).size!==ids.length || ids.length!==source.criteria.length || ids.some(id=>!source.criteria.some(c=>c.id===id)))throw Error(`Incomplete criterion partition ${id}`);
  const parts=groups.map(group=>{
    const q=clone(source);q.id=group.id;q.prompt=group.prompt;q.model_answer=group.answer;
    q.criteria=group.criteria.map(id=>clone(source.criteria.find(c=>c.id===id)));
    q.requirements=q.requirements.filter(r=>q.criteria.some(c=>c.requirement_id===r.id));
    // Every split is independently answerable, with the complete requested scope in its prompt.
    q.answer_slots=[{id:'answer',label:'답안',input:'textarea'}];
    return q;
  });
  set.subquestions=[...set.subquestions.filter(q=>q.id!==sourceId),...parts];
  set.subquestions=order.map(id=>set.subquestions.find(q=>q.id===id));
  if(set.subquestions.some(q=>!q)||set.subquestions.length>4)throw Error('Invalid learning order');
  set.learning_order=order;
  set.shared_context.facts=[];
  set.status='needs_review';set.verification.review_status='needs_human_review';
  set.verification.source_fidelity='reconstructed';
  for(const q of set.subquestions){
    const previous=classifications.find(row=>row.set_id===id&&row.subquestion_id===(groups.some(group=>group.id===q.id)?sourceId:q.id));
    if(!previous||previous.question_style!=='standard')throw Error('Split requires reviewed standard classification');
    q.question_style='standard';q.topic_ids=previous.topic_ids;
    entries.push({set_id:id,subquestion_id:q.id,question_style:'standard',topic_ids:q.topic_ids,
      case_fact_ids:[],standalone_prompt:null,
      reason:groups.some(group=>group.id===q.id)?`기준서의 명시 범위를 독립적으로 재현한다. ${reason}`:previous.reason,
      predecessor:{review_file:classificationFile,subquestion_id:previous.subquestion_id}});
  }
  sets.push(set);
  lineage.push({set_id:id,source_subquestion_id:sourceId,reason,
    before_points:source.criteria.reduce((n,c)=>n+c.max_points,0),after_points:parts.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0),
    owner_file:owners.find(owner=>owner.sets.some(set=>set.id===id)).file.replaceAll('\\','/'),
    original_source_questions:before.subquestions.map(q=>q.id),new_source_questions:order,
    parts:parts.map(q=>({subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id),points:q.criteria.reduce((n,c)=>n+c.max_points,0),prompt:q.prompt,model_answer:q.model_answer})),
    no_requirement_added_or_removed:true,original_source_snapshot:'../canonical-before.json',
    old_generic_facts:'Removed from the new standard-only version; preserved in original and agent snapshots.'});
}
const q10=all.find(s=>s.id==='pilot-10-002').subquestions.find(q=>q.id==='sub1');
splitSet('pilot-10-002','sub1',[
 {id:'sub1',criteria:['crit1','crit7','crit8'],prompt:'실증적 분석절차를 설계하고 수행할 때, 적용하려는 특정 분석절차에 관하여 먼저 내려야 할 결정과 이를 위한 두 가지 고려사항을 설명하시오.',answer:[q10.model_answer[0]]},
 {id:'sub3',criteria:['crit2','crit9','crit10','crit11','crit12','crit13'],prompt:'실증적 분석절차에서 기록된 금액이나 비율의 기대치 도출에 사용할 데이터에 대해 수행할 평가와 그 평가 시 고려할 사항을 모두 설명하시오.',answer:[q10.model_answer[1]]},
 {id:'sub4',criteria:['crit3','crit14','crit4'],prompt:'실증적 분석절차에서 기록된 금액이나 비율의 기대치와 수용 가능한 차이금액에 관하여 감사인이 수행해야 할 사항을 설명하시오. 기대치에 요구되는 정확성 수준을 포함하시오.',answer:q10.model_answer.slice(2)},
],['sub1','sub3','sub4','sub2'],'적합성, 데이터 신뢰성, 기대치·허용차이는 각각 완결된 수행 영역이며 12점의 요구를 3·6·3점으로 분리한다. 기존 차이 조사 물음은 유지한다.');
const q15=all.find(s=>s.id==='pilot-15-002').subquestions.find(q=>q.id==='sub1');
splitSet('pilot-15-002','sub1',[
 {id:'sub1',criteria:['crit1','crit1.p2','crit1.p3','crit2','crit2.p2','crit3','crit3.p2'],prompt:'재무제표가 해당 재무보고체계에 따라 작성되었는지 평가할 때, 회계정책의 공시와 선택·적용된 회계정책, 회계추정치 및 관련 공시에 관하여 평가할 사항을 모두 설명하시오. 회계정책의 공시를 평가할 때 고려할 사항도 포함하시오.',answer:q15.model_answer.slice(0,3)},
 {id:'sub3',criteria:['crit4','crit4.p2','crit4.p3','crit4.p4','crit4.p5','crit4.p6','crit4.p7','crit4.p8','crit4.p9'],prompt:'감사기준서 700 문단 13(d)에 따라 재무제표에 표시된 정보에 대한 평가사항과 그 평가 시 고려사항을 모두 서술하시오.',answer:[q15.model_answer[3]]},
 {id:'sub4',criteria:['crit5','crit6'],prompt:'재무제표가 해당 재무보고체계에 따라 작성되었는지 평가할 때, 의도된 이용자의 이해를 위한 공시와 재무제표에 사용된 용어에 관하여 평가할 두 가지 사항을 설명하시오.',answer:q15.model_answer.slice(4)},
],['sub1','sub3','sub4','sub2'],'회계정책·추정, 정보의 질과 표시, 공시·용어로 18점을 7·9·2점으로 나누고 공정표시 추가평가 물음은 유지한다.');
const q18=all.find(s=>s.id==='pilot-18-003').subquestions.find(q=>q.id==='sub2');
splitSet('pilot-18-003','sub2',[
 {id:'sub2',criteria:['crit4','crit9','crit5','crit10','crit10.p2','crit10.p3','crit11','crit11.p2','crit12','crit12.p2','crit12.p3'],
  prompt:'KGA 1200 문단 27–28(a) 본문·(b)·(c)에 따른 감사문서의 작성 목적, 이해 기준 및 기본 작성 내용을 모두 설명하시오. 문단 28(a)(i)~(iii)의 개별 테스트 항목과 업무 수행·검토의 추적 기록은 제외하시오.',
  answer:[q18.model_answer[0],q18.model_answer[5],q18.model_answer[1],'수행한 감사절차의 성격·시기·범위를 기록한다.',q18.model_answer[7],q18.model_answer[8]]},
 {id:'sub3',criteria:['crit10.p4','crit10.p5','crit10.p6','crit10.p7','crit10.p8','crit10.p9','crit13','crit13.p2','crit13.p3'],
  prompt:'KGA 1200 문단 28(a)와 29에 따라 감사문서에 남겨야 할 추적 기록을 설명하시오. 테스트한 특정 항목이나 사안, 업무의 수행과 검토, 유의적 사안을 관련자와 논의한 경우에 각각 기록해야 할 사항을 모두 포함하시오.',
  answer:['테스트한 특정 항목이나 사안을 식별할 수 있는 특성을 기록한다.','감사업무 수행자와 완료일을 기록한다.','수행한 감사업무의 검토자·검토일·검토 범위를 기록한다.',q18.model_answer[9]]},
 {id:'sub4',criteria:['crit6','crit7','crit8','crit14','crit15','crit15.p2','crit15.p3','crit15.p4'],
  prompt:'KGA 1200 문단 30–31에 따른 최종감사파일의 취합과 완료 시점, 취합 후 문서의 삭제·폐기 제한을 설명하시오. 또한 취합 후 기존 문서의 수정이나 새 문서의 추가가 필요한 경우 기록해야 할 사항을 모두 제시하시오.',
  answer:[q18.model_answer[2],q18.model_answer[3],q18.model_answer[4],q18.model_answer[10],q18.model_answer[11]]},
],['sub1','sub2','sub3','sub4'],'문서 작성 목적·기본 내용, 수행·검토 및 논의의 추적 기록, 최종파일 취합·변경을 구분하여 28점을 11·9·8점으로 나눈다.');
if(lineage.some(row=>row.before_points!==row.after_points))throw Error('Split changed total points');
fs.mkdirSync(output,{recursive:true});
for(const [name,value] of [['sets.json',sets],['classification-overrides.json',{entries}],['lineage.json',{
  created_at:new Date().toISOString(),reviewer:'root',status:'local_split_review_pending_model_validation',
  inputs:owners.map(owner=>({file:owner.file.replaceAll('\\','/'),sha256:sha(owner.file)})),entries:lineage}]] ) {
 fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({sets:sets.length,added_questions:lineage.reduce((n,row)=>n+row.new_source_questions.length-row.original_source_questions.length,0),splits:lineage.map(row=>({set_id:row.set_id,before:row.before_points,after:row.parts.map(part=>part.points)}))}));
