// Historical rejected candidate; do not replay as final. Final snapshot: 14-followup-final.json
import fs from 'node:fs';
const file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file));
const s=bank.find(s=>s.id==='pilot-14-002'),q=s.subquestions.find(q=>q.id==='sub2');
const before='docs/reports/question-review-2027/grading-cases/14-followup-before.json';
if(!fs.existsSync(before))fs.writeFileSync(before,JSON.stringify(s,null,2)+'\n');
const claim='그룹업무팀이 부문감사인으로부터 받을 보고사항의 형식과 내용을 정하여 부문감사인에게 전달한다.';
q.model_answer[3]=claim;
const c=q.criteria.find(c=>c.id==='crit11');
c.claim=claim;
c.critical_facts=[
 {id:'cf11',type:'action',expected:'그룹업무팀이 보고사항의 형식과 내용을 정하여 부문감사인에게 전달함. 여기서 형식과 내용은 부문감사인이 그룹업무팀에 보고할 사항에 관한 것임.'},
 {id:'cf12',type:'condition',expected:'평가 대상은 그룹업무팀이 부문감사인으로부터 받을 보고사항의 형식과 내용을 정하여 전달하는 행위이다. 답안 전체에 이 요구가 있으면 met이다. 그룹업무팀 자신의 발견사항을 부문감사인에게 알린다는 별개의 행위를 함께 썼더라도 두 행위는 병행할 수 있으므로 met을 유지한다. 대상 보고의 형식·내용 지정은 전혀 쓰지 않고 자신의 발견사항 전달만 쓴 경우에는 요구 누락인 not_met이다.'},
 {id:'cf13',type:'condition',expected:'보고 형식·내용을 정할 필요가 없다고 하거나, 그룹업무팀이 아니라 부문감사인이 임의로 정하도록 해야 한다고 하거나, 부문감사인으로부터 보고받는 대신 그룹업무팀의 발견사항만 알리면 된다고 하면 해당 요구를 명시적으로 부정하므로 contradicted이다.'},
];
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');
console.log('Clarified pilot-14-002/sub2/crit11 subject and assessed action; points unchanged.');
