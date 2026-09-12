import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {extendQa as r01} from '../../../drafts/delegated-authoring-2026-09-11/r01/extend-qa.mjs';
import {extendQa as n05} from '../../../drafts/delegated-authoring-2026-09-11/n05/extend-qa.mjs';
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ledger=read(root+'/id-ledger.json');
const rows=[];
for(const e of ledger.entries.filter(e=>['R01','N05'].includes(e.package))){
 const file=e.output_directory+'/'+e.set_id+'.json';
 const qaFile=e.output_directory+'/qa-cases-'+e.plan_id.toLowerCase()+'.json';
 const backup=e.output_directory+'/evidence/qa-before-root-followup/'+path.basename(qaFile);
 if(fs.existsSync(backup))throw Error('기존 후속 증거 보존');
 const oldHash=sha(qaFile),set=read(file),qa=read(qaFile),oldCount=qa.cases.length;
 fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(qaFile,backup,fs.constants.COPYFILE_EXCL);
 (e.package==='R01'?r01:n05)(set,qa);
 fs.writeFileSync(qaFile,JSON.stringify(qa,null,2)+'\n');
 rows.push({plan_id:e.plan_id,set_id:e.set_id,file,unchanged_set_sha256:sha(file),qa_file:qaFile,previous_file:backup,previous_sha256:oldHash,
  current_sha256:sha(qaFile),previous_cases:oldCount,current_cases:qa.cases.length,added_cases:qa.cases.filter(c=>c.id.includes('/root-')).map(c=>c.id)});
}
const record={created_at:new Date().toISOString(),author:'root',artifact_type:'pre_model_qa_followup',model_calls:0,existing_expectations_changed:false,
 reason:'R01 한 문장의 복수명제·실제 기간만 반복하는 비빈 누락, N05 비빈 무관답안·criterion별 실제 조건 경계. 과거 QA 바이트와 기대값 보존, 문항 내용 불변. 담당 생성기에 동일 extendQa 호출을 연결하여 후속 재작성 일치 유지.',rows};
fs.writeFileSync(root+'/qa-followup-r01-n05.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
for(const name of ['r01','n05']){
 const dir='cpa_uploader/drafts/delegated-authoring-2026-09-11/'+name;
 fs.writeFileSync(dir+'/qa-followup-root.md',`# 총괄의 작성자 QA 후속 보완\n\n문항·발문·답안·배점은 변경하지 않았다. 기존 QA 및 인계의 과거 해시는 evidence/qa-before-root-followup에 보존했다. 현행 QA 해시는 [총괄 후속 장부](../../../analysis/reviews/delegated-authoring-2026-09-11/qa-followup-r01-n05.json)의 해당 계획을 따른다. 모델 호출은0회이며 이 보완만으로 실제 검증 완료가 아니다.\n\n${name==='r01'?'모든 물음에 한 문장으로 연결한 정답을 추가하고, T09-A-Q1에는 주어진 기간만 반복하여 목적·행동이 빠진 비어 있지 않은 누락 답안을 추가했다.':'모든 물음에 요구사항이 없는 비어 있지 않은 답안을 추가하고,19개criterion마다 실제 조건·주체·대상·시점 또는 대안의 범위를 바꾼 경계 답안을 추가했다. 부문 선택이나 업무유형이 다른 문장에 함축되는지 최종 독립 의미검수·실제 채점의 불일치 분석에서도 확인한다.'}\n`,{flag:'wx'});
 fs.appendFileSync(dir+'/README.md','\n작성자 QA의 후속 보완과 현재 해시는 [총괄 QA 후속 기록](qa-followup-root.md)을 함께 읽는다. 이전 인계의 수치·해시는 당시 기록으로 보존한다.\n');
}
console.log(JSON.stringify(rows.map(r=>({plan:r.plan_id,before:r.previous_cases,after:r.current_cases}))));
