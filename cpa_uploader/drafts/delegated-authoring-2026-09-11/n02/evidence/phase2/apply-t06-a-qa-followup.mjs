import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/n02';
const dir=base+'/evidence/phase2/phase-two-v4-proposals';
const original=base+'/qa-cases-t06-a.json',qa=JSON.parse(fs.readFileSync(original,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const changes=[];
for(const [id,cid,verdict,points,reason]of [
 ['sub3-crit9-paraphrase','crit10','met',2,'발문은 설계 적절성이 평가된 뒤의 실행 여부 확인이고 기간 운영효과성은 제외한다. 담당자의 답변에 그치지 않고 실제 절차의 수행을 관찰한다는 답은 통제가 실제 존재하고 사용되는지를 확인하는 상태도 함축한다. 별도 결론 문장을 요구하지 않는 계약과315.A176-A177에 따른다.'],
 ['sub3-crit10-opposite','crit9','contradicted',0,'규정 기재만으로 실제 사용 여부에 관계없이 실행을 확정한다는 답은 통제 적용을 확인할 추가 절차의 필요성도 배제한다.315.26(d)(ii),A176-A177에 반하며, 단순히 절차를 쓰지 않은 누락과 다르다.'],
]){const c=qa.cases.find(c=>c.id===id),v=c.expected_verdicts.find(v=>v.criterion_id===cid);changes.push({case_id:id,criterion_id:cid,answer_preserved:c.answer,before:{verdict:v.verdict,reason:v.reason,points:c.expected_points},after:{verdict,reason,points},parent_adjudication:'accepted 2026-09-11 after original prompt/criterion/answer review'});v.verdict=verdict;v.reason=reason;c.expected_points=points;}
qa.followup_interpretation='원 발문·criterion 및 원답안을 보존하고, 실제 수행 관찰의 상태 함축 및 규정만으로 실행확정의 반대 범위를 원문·계약에 따라 정정했다. 모델 결과에 맞춘 답안 교체가 아니다.';
const output=dir+'/qa-cases-t06-a.followup-01.json';fs.writeFileSync(output,JSON.stringify(qa,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(dir+'/t06-a-qa-followup-diff.json',JSON.stringify({created_at:new Date().toISOString(),status:'parent_accepted_expected_judgments_followup',original:{file:original,sha256:sha(original)},followup:{file:output,sha256:sha(output)},required_QA_count:67,changed_cases:2,changes,question_plan_bank_unchanged:true,original_answers_unchanged:true,original_files_preserved:true,source_refs:['src-8255896e6aab367667','src-4681a9523487688d86','src-69b976ccea32faf8a9'],source_basis_file:dir+'/t06-a-v3-eleven-case-investigation.json',source_summary:'315.26(d)(ii): 질문 외 추가 절차로 실행 여부 결정. A176: 통제의 실제 존재와 사용을 확인하여 실행을 결정. A177: 적용 관찰·문서 검사 등, 질문만으로 부족.',original_v3_results_preserved:true,new_followup_grading_not_run:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(output),cases:qa.cases.length,changes:changes.length}));
