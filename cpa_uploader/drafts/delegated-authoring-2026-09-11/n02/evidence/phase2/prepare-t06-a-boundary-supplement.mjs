import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/n02';
const file=base+'/pilot-06-006.json',set=JSON.parse(fs.readFileSync(file,'utf8'))[0];
const q=set.subquestions.find(q=>q.id==='sub3');
const make=(id,answer,verdicts,reason)=>({id,subquestion_id:'sub3',kind:'independent_proposition_boundary',answer,expected_points:verdicts.reduce((n,v,i)=>n+q.criteria[i].scores[v],0),expected_verdicts:q.criteria.map((c,i)=>({criterion_id:c.id,verdict:verdicts[i],reason})),note:'필수67개 QA와 별도인 조사용 제안이다. 원답안·원기대·원실측을 대체하지 않으며 아직 실제 모델로 채점하지 않았다.'});
const cases=[
 make('sub3-application-procedure-with-explicit-state-denial','담당자 질문에 추가하여 계좌 변경 승인기록과 대사 검토기록을 검사한다. 다만 이 통제가 실제 존재하고 사용되는지는 확인할 필요가 없다.',['met','contradicted'],'추가된 구체 검사절차는 명시되어 있다. 실제 존재·사용 상태의 확인 필요성만 반대로 말했으므로, 이웃한 절차 수행 명제를 자동으로 반대로 바꾸지 않는다.'),
 make('sub3-policy-only-no-application-verification','통제 규정에 필요한 문구가 적혀 있는지만 읽고, 실제 승인·대사 기록을 검사하거나 통제 적용을 관찰하지 않아도 실행되었다고 확정한다.',['contradicted','contradicted'],'실제 적용의 추가 절차와 실제 존재·사용 확인을 모두 명시적으로 배제한다. 통제 설계 문서의 기재만으로 실행을 확정할 수 없다는315.26(d)(ii),A176-A177에 반한다.'),
 make('sub3-existence-use-state-only','개선 통제가 문서상의 설계에만 머무르지 않고 실제 존재하며 기업에서 사용되고 있는지 확인해야 한다.',['not_met','met'],'확인하려는 상태를 정확히 설명했으나 질문 외 어떤 구체 절차를 수행할지는 제시하지 않는다.'),
 make('sub3-inquiry-only-with-correct-state','담당자에게 묻는 것만으로 해당 통제가 실제 존재하며 기업에서 사용되고 있는지 확인하고, 기록검사나 적용관찰 등 질문에 추가되는 절차는 생략한다.',['contradicted','met'],'확인하려는 상태는 맞지만 질문만으로 충분하다는 방법은315.A177에 반한다. 올바른 상태 명제가 독립이면 방법의 반대로 자동 감점하지 않는다.'),
 make('sub3-observe-application-and-state','담당자 질문에 추가하여 담당자가 실제 승인·대사 검토 통제를 적용하는 과정을 관찰하여, 해당 통제가 실제 존재하고 사용되고 있음을 확인한다.',['met','met'],'적용 관찰과 확인하려는 존재·사용 상태를 모두 명시한 정상 대조군이다.'),
];
const output=base+'/evidence/phase2/phase-two-v4-proposals/qa-supplement-t06-a-implementation-boundaries.json';
fs.writeFileSync(output,JSON.stringify({version:1,artifact_type:'author_expected_judgments',artifact_role:'supplement_needs_parent_adjudication',set_id:set.id,plan_id:'T06-A',draft_sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),status:'proposal_not_run',source_basis:['KGA315.26(d)(ii)','KGA315.A176','KGA315.A177'],policy_basis:'문장 분리 강제 금지; 한 문장 복수 독립 명제 허용; 방법과 확인 상태 및 명시적 반대의 범위를 각각 판단',cases},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,cases:cases.length,model_calls:0}));
