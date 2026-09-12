import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const batch='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity=file=>({file,sha256:hash(file)});
const baseFile=`${root}/active-qa-overrides-v3-followup.json`,base=read(baseFile);
const manifestFile=`${root}/final-153-v3/manifest.json`,manifest=read(manifestFile);
const changes=[
 {plan_id:'T09-C',file:`${batch}/s03/phase-two-followup/t09-c-qa-v2/qa-cases-t09-c-v2.json`,
  expected_hash:'5ee133c83a0d9474cb0c8e124456b75e12383834270f1d5f9db18a213827ed31',
  lineage:`${batch}/s03/phase-two-followup/t09-c-qa-v2/lineage.json`,changed:['sub2/boundary-1'],
  basis:'발동조건의 오류와 별도 회신경로를 구별한다. 감사인 절차를 묻는 문맥에서 외부 법률고문에게 직접 회신을 요구한다는 답은 c5를 충족한다. c1/c2의 0점 경계 정책은 유지한다.'},
 {plan_id:'T07-C',file:`${batch}/s02/phase-two-followup/t07-c-qa-v2/qa-cases-t07-c.followup-01.json`,
  expected_hash:'a87c0fc426be5fdf8b1dd79135a5719ee11a5f9fa2d1704c0647b517d142e8a3',
  lineage:`${batch}/s02/phase-two-followup/t07-c-qa-v2/lineage-diff-and-observations.json`,changed:['sub1-crit2-omission','sub1-crit3-opposite','sub3-crit8-opposite'],
  basis:'긴 운송기간과 검사범위의 관계를 전면 부정한 답은 c2도 반대다. 이 문항의 정확성·완전성 증거가 어떤 방법으로도 불필요하다는 답은 생략 계획의 부적절성도 반대다. 종전 7일 밖의 인도 오류를 현 범위로 포착하지 못한다는 구체 이유는 기간조정 필요를 함축한다.'},
 {plan_id:'T10-B',file:`${batch}/s04/phase-two-followup/t10-b-qa-v2/qa-cases-t10-b.followup-01.json`,
  expected_hash:'eaa87d059cfe02633de437fcfe8fd5300d14c43bb90f78b56e888af1d369c86f',
  lineage:`${batch}/s04/phase-two-followup/t10-b-qa-v2/lineage-diff-and-observations.json`,changed:['sub1-numbers-only'],
  basis:'현재 발문은 동등한 분류 표현을 허용한다. 원기출 해설 427쪽과 연습 649쪽의 제1종=부당거부/기각, 제2종=부당수용 대응에 따라 번호만 쓴 올바른 분류도 충족한다. 번호를 유일 정답으로 제한하지 않는다는 계획을 번호 정답 배제로 해석하지 않는다.'},
];
for(const change of changes){
 if(hash(change.file)!==change.expected_hash)throw Error(`Changed followup QA: ${change.plan_id}`);
 const entry=manifest.entries.find(entry=>entry.plan_id===change.plan_id);
 if(!entry||base.overrides.some(row=>row.plan_id===change.plan_id))throw Error('Unexpected selection');
 if(hash(entry.file)!==entry.sha256||hash(entry.qa_file)!==entry.qa_sha256)throw Error('Frozen original changed');
 const before=read(entry.qa_file),after=read(change.file);
 if(before.cases.length!==after.cases.length)throw Error('Required case count changed');
 const modified=[];
 for(const oldCase of before.cases){
  const newCase=after.cases.find(item=>item.id===oldCase.id);
  if(!newCase||newCase.answer!==oldCase.answer||newCase.subquestion_id!==oldCase.subquestion_id)throw Error('Original answer or identity changed');
  const verdicts=item=>item.expected_verdicts.map(row=>[row.criterion_id,row.verdict]);
  if(oldCase.expected_points!==newCase.expected_points||JSON.stringify(verdicts(oldCase))!==JSON.stringify(verdicts(newCase)))modified.push({id:oldCase.id,
   old_points:oldCase.expected_points,new_points:newCase.expected_points,old_verdicts:verdicts(oldCase),new_verdicts:verdicts(newCase)});
 }
 if(JSON.stringify(modified.map(row=>row.id).sort())!==JSON.stringify([...change.changed].sort()))throw Error('Unapproved expectation diff');
 base.overrides.push({plan_id:change.plan_id,identity:identity(change.file),previous:identity(entry.qa_file),lineage:identity(change.lineage),
  basis:change.basis,changed_expectations:modified,original_answers_preserved:true,required_cases:after.cases.length,
  manual_reviewer:'root AI original source/prompt/criterion and existing actual observations review; not human approval'});
}
const output={...base,created_at:new Date().toISOString(),predecessor:identity(baseFile),manifest:identity(manifestFile),
 runtime_lock:identity(`${root}/runtime-v5-bank-v3-after-refill-02/runtime-lock.json`),
 note:'QA expectation selection only. Current question/plan/bank/source/code unchanged. Existing actual mismatches remain; no API calls by selection.'};
const file=`${root}/active-qa-overrides-v3-followup-02.json`;
fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file,overrides:output.overrides.length,newly_changed_cases:changes.reduce((n,c)=>n+c.changed.length,0),required_total:2389,api_calls:0}));
