import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/s05';
const backup=base+'/evidence/before-independent-clarity-fix';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files=fs.readdirSync(backup).map(name=>({file:path.posix.join(base,name),previous_file:path.posix.join(backup,name),
 previous_sha256:sha(path.posix.join(backup,name)),current_sha256:sha(path.posix.join(base,name))}));
const result={created_at:new Date().toISOString(),status:'draft_ready_not_live_verified',reviewer:'독립 담당자 plan_foundations와 총괄 root',
 sets:4,questions:9,points:27,author_qa_cases:150,model_calls:0,files,
 changes:[
  {question:'T14-C-Q2',reason:'지문에 이미 제공한 보고한도 정의를 발문·criterion에서 별도 득점요건으로 요구하지 않도록 수정했다. 원계획의 부적절 판단 및 그룹업무팀의 최종 결정 책임을2점으로 유지한다.'},
  {question:'T16-C-Q2',reason:'둘째 명제의 위 각 사항을 유의적 감사인 주의가 필요한 것으로 결정된 각 사항으로 명시해 첫 명제의 누락·반대 QA에서 지시대상이 바뀌지 않도록 했다.'},
  {question:'T14-C-Q1',reason:'수행중요성 검증에 관한 경계답안이 별도 부문 전체 중요성 검증까지 부정하지 않도록 잘못된 대체 대상을 명시했다.'},
  {question:'모든 S05 물음 QA',reason:'기존 무관한 비빈답안을 omission으로 명확히 분류했다. 판단의 근거가 결론을 함축하면 결론문장 삭제만으로 누락을 만들지 않고 두 명제가 모두 없는 사례와 함께 확인한다.'},
 ],validation:'static-validation-02-independent-clarity.json: 149비교세트,4세트9물음27점QA150,오류0. 후속 최종고정·실제검수는 별도다.'};
fs.writeFileSync(base+'/independent-clarity-followup.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const note='\n## 독립 교차검토 후속본\n\n[후속 변경·전후 해시](independent-clarity-followup.json)가 기존 1차 인계 이후의 현행 상태다. T14-C의 주어진 한도 정의 재득점과 두 QA 문구의 지시대상·범위를 보강했다.4세트9물음27점·QA150은 유지하며 [lineage.json](lineage.json)의 새 문항·계획·QA 해시를 사용한다. 이전 파일은 evidence/before-independent-clarity-fix에 그대로 보존했다. 정적검사 오류0이며 실제 모델 검증은 아직 전이다.\n';
fs.appendFileSync(base+'/README.md',note);
fs.appendFileSync(base+'/handoff.md',note);
console.log(JSON.stringify({changed:files.filter(file=>file.previous_sha256!==file.current_sha256).length,output:base+'/independent-clarity-followup.json'}));
