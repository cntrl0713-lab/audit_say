import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { extendQa } from '../../../drafts/delegated-authoring-2026-09-11/n05/extend-qa.mjs';
const directory='cpa_uploader/drafts/delegated-authoring-2026-09-11/n05';
const file=directory+'/qa-cases-t14-b.json';
const before=fs.readFileSync(file);
const sha=value=>createHash('sha256').update(value).digest('hex');
const backup=directory+'/evidence/qa-before-root-implied-selection';
fs.mkdirSync(backup,{recursive:true});
fs.writeFileSync(backup+'/qa-cases-t14-b.json',before,{flag:'wx'});
const qa=JSON.parse(before.toString('utf8'));
const previous=structuredClone(qa.cases.find(c=>c.id==='sub3/omit-1'));
extendQa(JSON.parse(fs.readFileSync(directory+'/pilot-14-007.json','utf8')),qa);
const content=JSON.stringify(qa,null,2)+'\n';
fs.writeFileSync(file,content);
const output='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/n05-implied-selection-followup.json';
fs.writeFileSync(output,JSON.stringify({created_at:new Date().toISOString(),qa_file:file,previous_sha256:sha(before),current_sha256:sha(content),
 previous_case:previous,current_case:qa.cases.find(c=>c.id==='sub3/omit-1'),new_case:qa.cases.find(c=>c.id==='sub3/root-omits-selection-and-change'),
 cases:qa.cases.length,reason:'원문600.29와 답안 전체의 함축을 root 및 독립 담당자가 실제 모델 실행 전에 대조했다. 모델 판정에 맞춘 변경이 아니며 전후 원문을 보존했다.',model_calls_before_correction:0},null,2)+'\n',{flag:'wx'});
fs.appendFileSync(directory+'/qa-followup-root.md','\n## 선정 조치의 함축을 보존한 후속 정정\n\nT14-B sub3/omit-1은 첫 문장을 지워도 선택 변경 조치가 최초 일부 선정을 함축하므로 7점의 implied_selection 사례로 정정했다. root와 독립 담당자가600.29·답안 전체를 실제 모델 실행 전에 대조했다. 두 선정 관련 명제를 생략하고 업무유형·중요성만 남긴5점 누락사례도 추가했다. 이전 QA는 evidence/qa-before-root-implied-selection에 보존했고 세트·발문·정답·배점은 바꾸지 않았다. 현재 T14-B QA69개이며 N05합계101개다.\n');
console.log(JSON.stringify({output,cases:qa.cases.length,expected_points:7}));
