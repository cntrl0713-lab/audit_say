import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const set=f=>{const d=read(f);return Array.isArray(d)?d[0]:d;};
const make=(s,id,qid,kind,answer,met=[],contra=[],reason='')=>{const q=s.subquestions.find(q=>q.id===qid);return {id,subquestion_id:qid,kind,answer,expected_points:q.criteria.filter(c=>met.includes(c.id)).reduce((n,c)=>n+c.scores.met,0),expected_verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:met.includes(c.id)?'met':contra.includes(c.id)?'contradicted':'not_met',reason})),note:'총괄 원문·발문 독립 판정에 따른 후속 회귀. 원래 필수 QA 수에 포함하지 않는다. 실제 모델 결과는 별도 증거에 기록한다.'};};
const validate=(s,q)=>{if(q.set_id!==s.id||q.version!==1||q.artifact_type!=='author_expected_judgments')throw Error('QA shape');for(const c of q.cases){const sq=s.subquestions.find(x=>x.id===c.subquestion_id);if(!sq||c.expected_verdicts.length!==sq.criteria.length||new Set(c.expected_verdicts.map(x=>x.criterion_id)).size!==sq.criteria.length)throw Error(c.id);const sum=c.expected_verdicts.reduce((n,v)=>{const cr=sq.criteria.find(x=>x.id===v.criterion_id);if(!cr||!['met','not_met','contradicted'].includes(v.verdict))throw Error(c.id);return n+(v.verdict==='met'?cr.scores.met:0);},0);if(sum!==c.expected_points)throw Error('Points '+c.id);}};
const t07root=base+'n03/phase-two-followup/t07-a-qa-v2';
if(fs.existsSync(t07root))throw Error('Fresh followup required');fs.mkdirSync(t07root,{recursive:true});
const oldFile=base+'n03/qa-cases-t07-a.json',old=read(oldFile),next=structuredClone(old),s07=set(base+'n03/pilot-07-006.json');
fs.copyFileSync(oldFile,t07root+'/qa-cases-t07-a.original.json',fs.constants.COPYFILE_EXCL);
const changed=[];
for(const id of ['sub2-crit6-opposite','sub3-crit12-condition-boundary']){
 const c=next.cases.find(c=>c.id===id),before=structuredClone(c);
 if(id==='sub2-crit6-opposite'){
  const v=c.expected_verdicts.find(v=>v.criterion_id==='crit5');v.verdict='contradicted';v.reason='상황 B는 당기 해당 통제에 의존한다는 전제를 준다. 당기 테스트를 금지하고 다음 감사로 미루겠다는 답은 현재 전기 결과만 이용하는 계획이 충분하지 않다는 판단과도 양립하지 않는다.';
 }else{
  const c8=c.expected_verdicts.find(v=>v.criterion_id==='crit8');c8.verdict='contradicted';c8.reason='테스트 이후 통제변경과 관계없이 추가 증거를 면제한다고 명시하여 변경의 고려를 부정한다. 다른 요소를 개별 부정했다고 확대하지 않는다.';
  const c12=c.expected_verdicts.find(v=>v.criterion_id==='crit12');c12.verdict='met';c12.reason='현재 발문은 330.A34의 고려요소를 열거하도록 요구한다. 통제환경을 식별하여 사용한 부분은 추가증거 전체 면제라는 틀린 효과와 독립적으로 인정한다.';c.expected_points=1;
 }
 c.note+=' 총괄 독립 원문·발문 판정 승인에 따른 기대 정정. 원답안은 유지하였다.';changed.push({case_id:id,before,after:structuredClone(c)});
}
next.followup={created_at:new Date().toISOString(),source_file:oldFile,source_sha256:hash(oldFile),authorization:'parent approved two expectation corrections after source/prompt independent review; no human approval claimed',required_QA_count:73,original_answers_preserved:true,question_plan_bank_changed:false};
validate(s07,next);if(next.cases.length!==73||next.cases.some((c,i)=>c.answer!==old.cases[i].answer))throw Error('Required answer preservation');
const qaFile=t07root+'/qa-cases-t07-a.followup-01.json';write(qaFile,next);
const supp07={version:1,artifact_type:'author_expected_judgments',set_id:s07.id,plan_id:'T07-A',draft_sha256:hash(base+'n03/pilot-07-006.json'),cases:[
 make(s07,'sub3-all-six-factors-valid','sub3','normal_enumeration','경영진주장 수준 위험의 유의성, 중간에 테스트한 특정 통제 및 이후 유의적 변경, 이미 입수한 운영효과성 증거의 정도, 잔여기간의 길이, 실증절차를 줄이기 위한 통제 의존 정도, 기업의 통제환경을 고려한다.',['crit7','crit8','crit9','crit10','crit11','crit12'],[],'330.A34 여섯 관련 요소를 모두 제시한다. 명칭의 정상 열거이며 보안 이상이 아니다.'),
 make(s07,'sub3-control-environment-explicitly-excluded','sub3','opposite','잔여기간에 필요한 추가 증거를 결정할 때 기업의 통제환경은 고려하지 않아도 된다.',[],['crit12'],'통제환경 고려의 의무를 명시적으로 부정한다. 다른 요소는 언급하지 않았으므로 별도 반대로 확대하지 않는다.')
]};validate(s07,supp07);write(t07root+'/qa-supplement-t07-a-factors.json',supp07);
write(t07root+'/lineage-and-change-record.json',{created_at:new Date().toISOString(),status:'approved_QA_followup_ready_for_actual_grading',original:{file:oldFile,sha256:hash(oldFile),preserved_copy:t07root+'/qa-cases-t07-a.original.json'},followup:{file:qaFile,sha256:hash(qaFile),count:73},supplement:{file:t07root+'/qa-supplement-t07-a-factors.json',sha256:hash(t07root+'/qa-supplement-t07-a-factors.json'),count:2,minimum_repeats:3},changed,question_file:base+'n03/pilot-07-006.json',question_sha256:hash(base+'n03/pilot-07-006.json'),question_plan_bank_changes:0,all_73_original_answers_preserved:true,source_basis:['KGA330.15 src-3839a593a5ba230eb2','KGA330.A34 src-15d06b1c85e6eb9944','n03/evidence/phase2/t07-a-v4-reasoned-adjudication.md'],actual_API_calls_by_preparation:0});
const t06root=base+'n02/phase-two-followup/t06-b-approval-boundary';if(fs.existsSync(t06root))throw Error('Fresh T06-B followup required');fs.mkdirSync(t06root,{recursive:true});
const s06=set(base+'n02/pilot-06-007.json'),supp06={version:1,artifact_type:'author_expected_judgments',set_id:s06.id,plan_id:'T06-B',draft_sha256:hash(base+'n02/pilot-06-007.json'),cases:[
 make(s06,'sub1-explicit-independent-approval-and-test-absent','sub1','paraphrase','독립적인 사전 변경 승인과 시험 없이 프로그램을 수정하여 운영환경에 반영하므로, 승인되지 않았거나 잘못된 변경이 자동계산과 금액검증의 오류로 이어질 수 있다.',['crit2'],[],'발문의 변경 승인·테스트 축에서 독립 승인과 시험 없는 수정 및 관련 오류 위험을 명확히 연결한다.'),
 make(s06,'sub1-test-absent-but-independent-approval-reversed','sub1','opposite','프로그램 변경은 독립된 사전 승인을 적정하게 받고 있으나 사전시험을 하지 않아 잘못된 변경이 자동계산을 틀리게 만들 수 있다.',[],['crit2'],'사례의 독립 승인 부재를 적정한 승인으로 명시적으로 뒤집는다. 승인·테스트 결함 및 위험을 결합한 1점 criterion에는 부분점수 계약이 없다.')
]};validate(s06,supp06);write(t06root+'/qa-supplement-t06-b-approval-boundary.json',supp06);
write(t06root+'/root-adjudication.json',{created_at:new Date().toISOString(),decision:'sub1-all-paraphrases와 sub1-crit2-paraphrase의 원 met 기대를 유지한다.',reason:'발문이 변경 승인·테스트라는 평가축을 이미 지정하고 지문이 독립 사전 승인 부재를 제시한다. 이 문맥에서 검토와 시험을 거치지 않은 수정이 운영 프로그램의 자동계산·검증 오류로 이어진다는 답은 결함과 위험을 연결한다. 승인 정확어 재진술을 필수로 삼지 않는다. 검토=승인의 일반 등식은 주장하지 않는다.',original_QA_file:base+'n02/qa-cases-t06-b.json',original_QA_sha256:hash(base+'n02/qa-cases-t06-b.json'),required_QA_count:54,required_QA_changes:0,question_plan_changes:0,supplement_file:t06root+'/qa-supplement-t06-b-approval-boundary.json',supplement_sha256:hash(t06root+'/qa-supplement-t06-b-approval-boundary.json'),supplement_count:2,minimum_repeats:3,API_calls_by_preparation:0,supersedes_pending_adjudication:'n02/evidence/phase2/phase-two-v4-proposals/t06-b-v4-reasoned-adjudication.json'});
console.log(JSON.stringify({t07_qa_file:qaFile,t07_qa_sha256:hash(qaFile),required:73,t07_supplement:2,t06_supplement:2,all_static_shape_and_points_pass:true}));
