import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash,sourceUnitHash} from '../../coverage/build-coverage.mjs';
const R='cpa_uploader/analysis/reviews/case-deepening-2026-09-14',D='cpa_uploader/drafts/case-deepening-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=x=>createHash('sha256').update(x).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const write=(f,x)=>fs.writeFileSync(R+'/'+f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const elements=read('cpa_uploader/analysis/question-elements/question-elements.json').elements,units=read(D+'/source-catalog-final.json').units;
const links=[];
for(const worker of ['a','b']){
 const file=D+'/'+worker+'/coverage-proposals.json';
 const sets=read(D+'/'+worker+'/sets.json');
 for(const p of read(file)){
  const set=sets.find(s=>s.id===p.set_id),q=set.subquestions.find(q=>q.id===p.subquestion_id),element=elements.find(e=>e.id===p.element_id);
  assert(element&&q);const sourceIds=[...new Set(q.criteria.filter(c=>p.criterion_ids.includes(c.id)).flatMap(c=>c.source_ref_ids))];
  const sources=sourceIds.map(id=>{const u=units.find(u=>u.id===id);assert(u,id);return u;});
  links.push({id:'coverage-deepening-20260914-'+String(links.length+1).padStart(2,'0'),element_id:p.element_id,source_unit_ids:sourceIds,
   target:{scope:'draft',file:D+'/'+worker+'/sets.json',set_id:set.id,subquestion_id:q.id,criterion_ids:p.criterion_ids},relation:p.relation,reason:p.reason,review_status:'needs_review',
   snapshot:{element_sha256:hash(JSON.stringify(element)),question_sha256:questionHash(set,q),source_hashes:Object.fromEntries(sources.map(u=>[u.id,u.contentHash])),source_metadata_hashes:Object.fromEntries(sources.map(u=>[u.id,sourceUnitHash(u)]))},
   provenance:{author_proposal:ref(file),source_locations:p.source_locations,original_question_ids:p.original_question_ids,frequency_treatment:p.reprint_treatment,scope:'선택한 대표 물음의 실제 criterion에 필요한 공식 단위로 범위를 좁혔다. 다른 물음의 출처나 인접 기출을 직접 득점요건으로 합치지 않는다.'}});
 }
}
write('coverage-proposals.json',{version:1,artifact_type:'six_case_representative_coverage_proposals',created_at:new Date().toISOString(),human_review_performed:false,links});
const reasons=[
 '2023 GS2 문제4물음4의 필수기록3요소 중 항목 식별만 대상으로 하므로 partial이다. 실제 송장 및 전부검사 모집단 식별을 각criterion에 연결하고 작성·검토자까지 포괄했다고 세지 않는다.',
 '2025 GS1 문제3물음2의 비문서 통제 증거입수 요구를 구두출고 승인에 적용한다. 질문과 관찰의 독립criterion이 직접 대응하며 인접2025기출을 이모의의 추가빈도로 세지 않는다.',
 '2018 문제7물음3은 상대방·시기·형태를 보완한다. 신규sub1은 수신확인만으로 실질소통이 적절한지 판단하는 심화여서 adjacent로 유지하며 직접 기출충족으로 집계하지 않는다.',
 '2023 문제6물음1의 장소별 관리·상품 및 다른 실사일·팀이라는 두 이유와 판단을 새sub2의3criterion이 직접 요구한다. 일반501 장소원칙으로 사실의 이질성을 지우지 않았다.',
 '2017 문제4물음4의 입증된 미수정 변이를 모집단 수용판단에 반영하는 처리와 새sub2가 직접 대응한다. 이후2022 근거부족 후속조치는 인접문맥이며 이요소의 기출빈도를 늘리지 않는다.',
 '2016 문제9물음1(원문502쪽 L19939~19954, 해설503쪽 L19985~19991)의 제한수정 후 최초일자 유지·추가절차 종료일 표시는 새sub2의 실제날짜·범위와 직접 대응한다. 2025문제4물음3도 원발문·해설을 읽었다. 이대표연결을 다른연도의 전체소문항이나 모든보고대안의 전수충족 주장으로 확장하지 않는다.'
];
write('coverage-root-review.json',{method:'agent_relationship_review',human_review_performed:false,reviewed_at:new Date().toISOString(),proposal_sha256:ref(R+'/coverage-proposals.json').sha256,links:links.map((l,i)=>({id:l.id,decision:'accept',reason:reasons[i]})),unresolved_findings:[]});
console.log({coverage_proposals:links.length});
