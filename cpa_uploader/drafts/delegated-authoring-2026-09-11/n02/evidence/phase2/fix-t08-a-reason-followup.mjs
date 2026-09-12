import fs from 'node:fs';
import {createHash} from 'node:crypto';
const dir='cpa_uploader/drafts/delegated-authoring-2026-09-11/n02/evidence/phase2/phase-two-v4-proposals';
const file=dir+'/qa-cases-t08-a.followup-01.json';
const qa=JSON.parse(fs.readFileSync(file,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const replacements=[['sub3-crit5-opposite','crit6','모든 모듈의 총액 일치만으로 추가 증거 없이 신뢰성을 확정해도 된다는 포괄적 결론은, 공통 원천의 누락·오류가 내부 대사로 해소되지 않을 수 있다는 한계도 배제한다. 총괄이 수용한 단방향 반대 범위에 따라 contradicted로 기대한다.'],['sub3-crit6-opposite','crit5','공통 원천 오류가 제거된다는 특정 이유의 잘못된 주장만으로, 전체 신뢰성 확정 또는 모든 추가 증거 불필요라는 결론까지 명시적으로 부정했다고 보지 않는다. 총괄이 수용한 단방향 범위에 따라 결론 crit5는 not_met으로 기대한다.']];
const changes=[];
for(const [id,cid,reason]of replacements){const i=qa.cases.findIndex(c=>c.id===id),j=qa.cases[i].expected_verdicts.findIndex(v=>v.criterion_id===cid);changes.push({path:`/cases/${i}/expected_verdicts/${j}/reason`,before:qa.cases[i].expected_verdicts[j].reason,after:reason});qa.cases[i].expected_verdicts[j].reason=reason;}
const output=dir+'/qa-cases-t08-a.followup-02-reasons.json';
fs.writeFileSync(output,JSON.stringify(qa,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(dir+'/t08-a-reason-only-followup-diff.json',JSON.stringify({created_at:new Date().toISOString(),original:{file,sha256:sha(file)},followup:{file:output,sha256:sha(output)},changes,answers_verdicts_points_cases_unchanged:true,required_cases:47,model_prompt_schema_unchanged:true,actual_model_calls:0,old_files_preserved:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sha256:sha(output),changes:changes.length}));
