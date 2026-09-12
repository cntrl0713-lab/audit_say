import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';

const directory='cpa_uploader/drafts/delegated-authoring-2026-09-11/n01';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const specs=[
  ['T02-A','pilot-02-006','sub1','foundations.skepticism-definition',['crit1','crit2','crit3'],'direct','의구심의 세 정의 요소를 직접 요구한다.'],
  ['T02-A','pilot-02-006','sub2','element-7daa8ad53b025a93',['crit4','crit5','crit6','crit7'],'direct','의구심을 유지할 네 상황을 독립 사례에 연결한다.'],
  ['T02-A','pilot-02-006','sub3','element-7daa8ad53b025a93',['crit8','crit9'],'adjacent','주의 상황의 원기출과 달리 상반 증거의 후속 조치와 과거 신뢰의 한계를 묻는다. 직접 빈도로 합산하지 않는다.'],
  ['T01-A','pilot-01-005','sub1','ethics.own-share-audit-fee',['crit1','crit2'],'direct','법인 자체의 직접 주식보유를 유지하는 수임 판단과 이유이다.'],
  ['T01-A','pilot-01-005','sub2','ethics.client-material-joint-business',['crit3','crit4'],'direct','긴밀한 사업관계 예외의 양측 중요성을 사례에 적용한다.'],
  ['T01-A','pilot-01-005','sub3','ethics.low-fee-required-safeguards',['crit6','crit7'],'direct','원기출의 안전장치 범위를 두 명제에 연결한다. crit5의 조건부 위협 설명은 이 직접 대응에서 제외한다.'],
  ['T03-A','pilot-03-005','sub1','element-b754f5cabfbd2b94',['crit1','crit2','crit3'],'direct','감사에 필요한 정보와 내부 관계자 접근의 세 범주를 직접 묻는다.'],
  ['T03-A','pilot-03-005','sub3','element-b754f5cabfbd2b94',['crit10','crit11'],'partial','원기출 정보·접근 요구를 CFO 재량 제한의 판단과 이유로 일부 적용한다.'],
  ['T03-A','pilot-03-005','sub2','element-666a5040f06c508d',['crit4','crit5','crit6','crit7','crit8','crit9'],'partial','기출의 세 항목 선택 요구와 신규 필수 여섯 항목 전부 요구의 범위가 다르다. 동일 요구 전체라고 확정하지 않는다.'],
  ['T04-B','pilot-04-006','sub1','element-b5399a9ff39b1cfc',['crit1','crit2'],'direct','최초 문서화를 최종 취합까지 미루는 처리를 적시 작성과 행정적 취합으로 구별한다.'],
  ['T04-B','pilot-04-006','sub2','element-66737d3274eb4426',['crit3','crit4','crit5','crit6'],'adjacent','원기출의 취합 후 수정 기록과 다른, 취합 중 가능한 행정적 변경 범주이다. 직접 빈도를 전용하지 않는다.'],
  ['T04-B','pilot-04-006','sub3','element-66737d3274eb4426',['crit7','crit8','crit9'],'direct','최종 취합 후 수정·추가의 이유, 수행자·시기, 검토자·시기를 직접 묻는다.'],
];
const catalog=buildSourceCatalog();
const links=specs.map(([planId,setId,subId,elementId,criterionIds,relationship,reason],index)=>{
  const file=`${directory}/draft-${setId}.json`;
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));const set=Array.isArray(raw)?raw[0]:raw;
  const sub=set.subquestions.find(q=>q.id===subId);
  const criteria=criterionIds.map(id=>{const c=sub.criteria.find(c=>c.id===id);if(!c)throw Error(`criterion 부재 ${setId}/${id}`);return c;});
  const sources=[...new Set(criteria.flatMap(c=>c.source_ref_ids))];
  for(const id of sources)if(!catalog.units.some(unit=>unit.id===id))throw Error(`실제 source ID 부재 ${id}`);
  return {id:`delegated-2026-09-11-n01-${String(index+1).padStart(2,'0')}`,plan_id:planId,element_id:elementId,source_unit_ids:sources,
    target:{scope:'draft',file,set_id:setId,subquestion_id:subId,criterion_ids:criterionIds},relationship,review_status:'needs_review',reason,
    provenance:{scope_file:`${directory}/scope-ledger.md`,scope_sha256:sha(`${directory}/scope-ledger.md`),
      frequency_file:`${directory}/frequency-evidence.json`,frequency_sha256:sha(`${directory}/frequency-evidence.json`),
      candidate_sha256:sha(file)}};
});
fs.writeFileSync(`${control}/coverage-proposal-n01.json`,JSON.stringify({created_at:new Date().toISOString(),
  artifact_type:'coverage_relationship_proposal',status:'pending_final_content',
  note:'현재 N01 발문·criterion과 담당자의 원출제 추적을 대조한 후보 관계. 최종 문항 이후 재대조·snapshot 확정 전 공통 links.json에 반영하지 않는다. 관계 검토와 문항 검수·사람 승인·게시를 구별한다.',links},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({links:links.length,common_links_modified:false}));
