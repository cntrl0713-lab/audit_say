import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const norm=s=>s.replace(/\s+/gu,' ').trim();
const ledger=read(root+'/id-ledger.json'),catalog=buildSourceCatalog();
const rows=[
 ['R01','T04-A','q1','materiality.one-off-loss',[1,2],'direct','일시적 이익 감소의 정상화 수치와 근거를 직접 묻는다.'],
 ['R01','T04-A','q2','materiality.user-needs',[1,2],'direct','이용자 집단 공통수요와 특정개인 영향을 구별한다.'],
 ['R01','T09-A','q1','inventory.different-date',[1],'partial','원기출의 실사입회·추가절차 중 실사일과 재무제표일 사이 변동에 한정한다.'],
 ['R01','T09-A','q2','inventory.different-date-controls',[1,2,3,4],'direct','설계·실행·유지의 효과성과 실사법/계속기록법 적용을 묻는다.'],
 ['R01','T09-B','q1','confirmation.blank-positive',[1,2,3],'direct','공란형 작성방식·무검증회신 위험·회신율 한계와 이유를 묻는다.'],
 ['R01','T09-B','q2','element-611b85a03689277a',[1,2],'direct','특정 회신 자체가 필요한 경우의 대체 불가와 감사·의견 시사점이다.'],
 ['R01','T10-A','q1','sampling.control-reliance-size',[1,2],'partial','원출제 방향 요구에 이유를 추가한 심화이다. 다른 요소의 빈도와 합산하지 않는다.'],
 ['R01','T10-A','q1','sampling.control-confidence-size',[3,4],'partial','원출제 방향 요구에 이유를 추가한 심화이다. 다른 조건은 고정한다.'],
 ['R01','T10-A','q2','sampling.substantive-other-procedures-size',[1,2],'partial','동일 주장 다른 실증절차 의존 변화의 방향·이유이다.'],
 ['R01','T10-A','q2','sampling.expected-misstatement-size',[3,4],'partial','예상왜곡표시 증가의 방향과 이유이다.'],
 ['R01','T12-A','q1','subsequent.restricted-date-extension',[1,2],'partial','한정 후속절차의 두 법규·재무보고체계 조건을 분리한다.'],
 ['R01','T12-A','q2','subsequent.restricted-date-extension',[1,2,3,4,5],'partial','한정 후속절차의 두 보고 방법과 택일을 별도 물음으로 설명한다.'],
 ['R01','T12-B','q1','going-concern.uncertainty-disclosed',[1,2,3,4,5],'direct','적합한 계속기업전제·충분한 증거·적정 공시 사례의 의견과 별도 단락이다.'],
 ['R01','T12-B','q2','going-concern.uncertainty-undisclosed',[1,2,3],'direct','적합한 계속기업전제에서 미흡 공시에 따른 의견계열과 근거단락 내용이다.'],
 ['N05','T14-A','sub1','group.independence-not-remedied-by-review',[1,2],'direct','독립성 결격을 조서검토 강화로 해소할 수 없음과 그룹감사인의 증거 확보이다.'],
 ['N05','T14-A','sub2','element-f2abc19ef137fa24',[1,2],'direct','경미한 우려에 대한 위험평가 관여·관련 문서 검토라는 요청 범위이다.'],
 ['N05','T14-A','sub2','element-f2abc19ef137fa24',[3],'adjacent','심각한 우려의 미요청 판단은 경미한 우려를 다루는 원요구의 적용 경계로 직접빈도에서 제외한다.'],
 ['N05','T14-B','sub1','element-303383e8241e1fc5',[1],'direct','재무적 유의성 부문의 업무유형. 중요성 명칭의 복습을 별도 직접빈도로 더하지 않는다.'],
 ['N05','T14-B','sub2','element-07e32d98036a4aee',[1,2,3],'direct','고유위험상 유의적인 부문의 세 업무유형이다. 중요성 명칭·하나 이상 선택 설명을 별도 출제로 가산하지 않는다.'],
 ['N05','T14-B','sub3','element-82a95cff37dabedd',[1,2,3,4,5,7],'direct','충분한 증거 미입수 예상시 비유의적 부문 추가선정·유형·시간경과 선택변경이다. 중요성 명칭 복습은 별도 빈도가 아니다.'],
];
const links=rows.map(([pkg,plan,qid,elementId,numbers,relationship,reason],index)=>{
 const entry=ledger.entries.find(e=>e.plan_id===plan);
 const file=entry.output_directory+'/'+entry.set_id+'.json',set=read(file),q=set.subquestions.find(q=>q.id===qid);
 const criteria=numbers.map(n=>q.criteria[n-1]);
 if(criteria.some(c=>!c))throw Error(plan+' criterion범위');
 const sources=criteria.flatMap(c=>c.source_ref_ids).map(id=>set.source_refs.find(s=>s.id===id));
 const ids=[...new Set(sources.flatMap(ref=>{
  const units=catalog.units.filter(u=>u.file===ref.file&&(norm(u.quote).includes(norm(ref.source_quote))||norm(ref.source_quote).includes(norm(u.quote))));
  if(!units.length)throw Error(plan+' 실제 source mapping부재 '+ref.id);
  return units.map(u=>u.id);
 }))];
 const directory=entry.output_directory;
 return {id:`delegated-2026-09-11-${pkg.toLowerCase()}-${String(index+1).padStart(2,'0')}`,plan_id:plan,element_id:elementId,source_unit_ids:ids,
  target:{scope:'draft',file,set_id:set.id,subquestion_id:qid,criterion_ids:criteria.map(c=>c.id)},relationship,review_status:'needs_review',reason,
  provenance:{scope_file:directory+'/scope-and-sources.md',scope_sha256:sha(directory+'/scope-and-sources.md'),frequency_file:directory+'/frequency-evidence.json',frequency_sha256:sha(directory+'/frequency-evidence.json'),candidate_sha256:sha(file)}};
});
fs.writeFileSync(root+'/coverage-proposal-r01-n05.json',JSON.stringify({artifact_type:'coverage_relationship_proposal',status:'pending_final_content',created_at:new Date().toISOString(),links,
 note:'사전 원문·발문 대조에 따른 후속 초안 관계 제안이다. R01 기존 관계의 의미와 계보를 최종 입력으로 다시 대조한 뒤 적용하며 현재 공통 links는 수정하지 않는다.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({links:links.length,root_proposal_only:true}));
