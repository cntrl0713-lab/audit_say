import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {questionHash,sourceUnitHash} from '../../coverage/build-coverage.mjs';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rows=read(R+'coverage-review-input.json').rows;
const bank=read(R+'candidate-v1/bank.json');
const qs=new Map(bank.flatMap(s=>s.subquestions.map(q=>[s.id+'/'+q.id,{s,q}])));
const unitMap=new Map(read(R+'coverage-source-units.snapshot.json').units.map(u=>[u.id,u]));
// Each row was read with its actual occurrence text, original linked claims and final candidate claims.
// A tuple names the candidate output, final relationship, explanation, optional exact criterion subset and source subset.
const decisions=[
 [[0,'broader','연습문제는 적정의견근거에서 서비스감사인 보고서 이용을 언급한 잘못의 수정이다. 새 연결은 그 비언급 원칙에 법규 요구 예외·책임 불경감 명시까지 포함하므로 상위 범위다. 통합된 변형의견 언급 기준은 이 원발문의 빈도로 연결하지 않는다.']],
 [[0,'partial','원발문은 감사 계속불가 시 세 절차를 요구하고 240.39는 책임결정·해지 고려·해지 시 후속조치를 규정한다. 수신 물음은 아직 해지하지 않은 39(a)~(b)의 두 절차만 묻는다. 기존 direct를 partial로 정정하며 해지 후 토의·보고까지 포괄한다고 보지 않는다.']],
 [[0,'partial','원발문은 부정 인지와 경영진 진술거부로 계속수행 능력에 의문이 생긴 경우 세 절차를 묻는다. 수신 물음은 240.39(a)~(b)의 책임 결정·해지 고려만 남기므로 부분 대응이다. 원 사례의 부정 판단이나 해지 후 절차를 이 두 기준의 빈도로 확장하지 않는다.']],
 [[0,'direct','KGA720.13 입수절차를 묻는 필수심화 물음27과 문서 결정·발행방식·시기·최종본 협의·서면진술 및 발행 전 제공이 직접 대응한다. 기존 관계가 누락한 세부 criterion도 포함해 실제 요구 전체를 연결한다. 부모의 상장·자산·적정의견 가정 삭제와 독립 발문 정리는 이 입수절차 답을 바꾸지 않는다.','all']],
 [[0,'broader','원발문은 효익 중 두 가지만 고르거나 정보입수 효익을 제외하지만 새 물음은 세 효익과 관계 발전 중 독립성·객관성까지 묻는다. 260.4의 같은 효익을 보존하되 상위 요구 관계를 유지한다.']],
 [[0,'partial','570.16의 추가절차 요소 중 경영진 평가요청·계획의 개선효과와 실행가능성·계획과 실행가능성의 서면진술에 대응한다. 현금흐름예측과 추가정보는 이 물음에 없으며 요소 전체 빈도를 개별 서면진술로 전용하지 않는다.']],
 [[0,'adjacent','2019 원발문의 발행 후 사실 인지 최초 대응(560.14)에 대하여 수신 물음은 경영진이 수정한 뒤의 수정절차·종전수령자 통보조치 검토·절차 연장(15)을 묻는 인접 요구다. 직접 기출로 올리지 않는다.',null,['src-adba73942fcd129869']],
  [1,'adjacent','동일 원발문에 대한 수신 물음은 수정된 재무제표의 새 보고서·일자·강조/기타사항 및 주석·종전보고서 언급(560.15~16)의 후속 보고다. 최초 인지 대응 자체와 구별하는 인접 관계를 보존한다.']],
 [[0,'adjacent','발행 후 사실 인지 최초 대응과 달리 경영진이 수정·통보조치를 하지 않는 560.17의 사전 통보와 이후 의존방지에 해당한다. 경영진/조건부 지배기구를 분리했어도 원 기출의 직접 요구로 바꾸지 않는다.']],
 [[0,'direct','필수암기106은 중요한 제3자 보관 재고에서 수행할 절차를 묻는다. 수량·상태 조회, 상황에 적합한 검사/기타절차, 하나 이상의 선택을 직접 연결하며 실재성·상태라는 목표의 별도 명칭 배점은 이 절차 요소에 추가하지 않는다.']],
 [[0,'direct','2022:2:6의 ④는 예외적 이탈 이유와 대체절차의 목적 달성방식 기록의 적절성을 묻는다. 통합 출력 중 두 문서화 기준만 연결하고 새로 합친 일반 이탈조건·대체절차 수행 자체는 이 빈도에 포함하지 않는다.']],
 [[0,'partial','2019:3:2의 선정주체 표 중 상장·대형비상장·금융회사의 위원회 설치/미설치 부분에 대응한다. 미설치의 감사 선정과 위원회 승인을 함께 유지한다. 그 밖 회사 부분은 다른 파생 관계에 있어 단일 출력에 direct를 유지하지 않는다.'],
  [1,'partial','동일 2019 선정주체 표 중 그 밖의 회사의 감사/감사위원회 선정 원칙에만 대응한다. 원발문에 없는 재선임 예외나 감사 없는 유한회사의 선정은 연결하지 않는다.']],
 [[0,'partial','2024:4:1 ① 상장회사 사례의 선정주체인 감사위원회에 대응한다. 선임기한 및 사례 적용은 수신 물음에서 요구하지 않으므로 partial을 유지한다.']],
 [[1,'partial','2024:4:1 ②의 감사위원회 없는 비상장회사에서 감사가 선정한다는 부분과 연결한다. 신규 외감대상 여부에 따른 선임기한은 포함하지 않는다.']],
 [[0,'partial','2024:4:1 ④ 대형비상장회사의 감사 선정과 감사인선임위원회 승인에 대응한다. 자산 7천억원의 규모분류 판단과 선임기한을 해당 기준의 빈도로 전용하지 않는다.']],
 [[1,'partial','2024:4:1 ③은 자본금12억원·감사 없는 유한회사로 사원총회 승인의 선정 규정과 관련된다. 일정규모 해당 판단·기한은 제외한다. 실제 원발문의 이 회사와 무관한 기타 감사 없는 유한회사 규정(crit6)은 연결에서 뺀다.',['crit5']]],
 [[0,'direct','2022:1:5(1)의 제3자 책임사유에 대한 중요한 보고서 누락/허위와 신뢰·이용한 제3자의 인과손해 두 명제를 연결한다. 회사 책임·연대책임은 포함하지 않는다.']],
 [[0,'direct','2022:1:5(2)의 면책사유인 임무를 게을리하지 않았다는 증명만 직접 연결한다. 선임회사·법정 금융기관 원고 예외는 같은 원발문의 빈도로 추가하지 않는다.']],
 [[1,'direct','2022:1:5(3)은 계약 연장이 없다고 명시하므로 안 날부터1년·보고서 제출부터8년만 연결한다. 배상보장과 계약 연장 기준은 제외한다.']],
 [[1,'adjacent','2022:1:6은 공동기금과 공인회계사법상 준비금의 차이를 묻지만 수신 기준은 공동기금/보험이라는 배상보장조치만 묻는다. 준비금 비교까지 포함하는 direct가 아니라 인접 관계다.']],
 [[1,'partial','2014:3:4의 민법·자본시장법·외감법 비교 중 외감법의 기간 및 기산점 학습에만 대응한다. 다른 법률·과거 판본의 숫자와 동일함을 확정하지 않으며 계약 연장 조건도 직접 요구로 새로 세지 않는다.',['crit5','crit6']]],
 [[0,'partial','2014:3:4 원고 비교의 외감법 부분으로 회사와 보고서를 신뢰·이용하여 손해를 입은 제3자를 연결한다. 보고서의 허위·누락이라는 별도 위법사유 기준은 원고 비교 자체가 아니어서 제외하고 다른 법률 비교도 포괄하지 않는다.',['crit1','crit2.sp2']]],
 [[0,'partial','2014:3:4의 세 법률 입증책임 비교 중 외감법의 감사인 증명 원칙과 선임회사·법정 금융기관 원고 예외만 대응한다. 다른 법률이나 당시 판본의 모든 예외가 동일하다는 검증은 아니다.']],
 [[1,'partial','2018:2:3의 의견형성 단계에서 증거미입수 영향에 따라 한정·해지·의견거절하는 부분에 연결한다. 수임단계와 해지 전 지배기구 통지까지 원발문이 직접 요구했다고 보지 않는다. 기존 source_unit_ids 부재를 보존하되 수신 문항의 공식705.11~14 직접 인용을 의미대조 근거로 사용했다.']],
 [[1,'direct','2024:10:2의 경영진 범위제한이 부정위험 평가 및 감사 계속 여부에 주는 두 시사점과 직접 대응한다. 합친 대체절차 충분 시 범위제한 아님 기준은 이 요소에 연결하지 않는다.',null,['src-a7adab453c1728047d']]],
 [[0,'adjacent','2024:10:1은 기업 통제 밖 상황이라는 원인을 이미 제시하고 두 예를 요구한다. 새 기준은 그 원인 명칭 자체이므로 예시 출제와 인접할 뿐이다.',null,['src-31cc9a2643cfe6546d']]],
 [[0,'adjacent','2024:10:1이 이미 제시한 업무 성격·시기 원인에 대한 두 예를 묻는 데 비해 새 기준은 원인만 요구한다. 예시를 충족한다고 보지 않는다.',null,['src-31cc9a2643cfe6546d']]],
 [[0,'adjacent','2024:10:1의 경영진 제한 원인은 발문에 주어졌으며 원출제는 그 두 예다. 새 원인 명칭 기준은 인접으로 유지한다.',null,['src-31cc9a2643cfe6546d']]],
 [[0,'partial','2019:6:1[B]의 유의사항 외 소통사항 중 감사인 책임과 계획 범위·시기(유의위험 포함)에 대응한다. 독립성 등 다른 선택 가능사항은 수신 물음 밖이다.']],
 [[1,'partial','2018:7:3의 연1회 보고서 발행 직전 소통 사례를 보완할 일반 적시성 원칙만 연결한다. 실제 사례판단·이유 전체를 대신하지 않으며 절차수립의 예정시기 소통과는 구별한다.',null,['src-7ad9b092202f76974e']]],
 [[1,'partial','2018:7:3의 전부 구두 소통 사례에 대한 유의사항의 조건부 서면·독립성 서면 두 규정만 연결한다. 실제 사례의 통지대상·시기 등 다른 오류를 포괄하지 않는다.',null,['src-470b90789e293bb2e7','src-150123f8ed45c46843']]],
 [[0,'partial','2015:6:3 계획단계 네 가지 열거의 후보 중 협조·윤리·한도기준·새 위험과 대응 통지 요청에 해당한다. 부문중요성·기존 식별 위험 등 다른 계획 요구는 별도 기존 물음에 남으며 이 출력 하나로 전체를 충족했다고 보지 않는다.'],
  [1,'partial','동일 원발문의 계획단계 후보 중 특수관계자 목록·기타 알려진 관계자 전달, 새 관계자 통지 요청, 다른 부문 전파 결정만 대응한다. 독립 출력으로 분리되어 전체 계획단계 직접 포괄 관계를 표시하지 않는다.']],
 [[0,'partial','2015:6:3은 종결단계 사항 중 네 가지를 고르게 한다. 분리된 이 출력은 윤리준수·업무팀요구 준수·보고대상·전반 결론의 네 후보를 제공하지만 전체 종결 목록은 다음 출력에 나뉘어 있다.'],
  [1,'partial','동일 원발문의 종결단계 후보 중 법규위반·미수정왜곡·편의징후·통제미비점·지배기구 유의사항·기타주의사항 여섯 요구에 연결한다. 원래의 선택 네 가지 빈도를 여섯 기준의 개별 출제빈도로 전용하지 않는다.']],
 [[0,'partial','2025:9:1 지침서한에는 협조·일정·방문·업무용도·관계자 목록이 이미 제시되어 있다. 윤리, 왜곡표시 한도, 새 유의위험과 대응 통지 요청만 관련시키고 기존 중요성/그룹팀 식별 위험의 별도 기준은 이 출력이 다루지 않는다.']],
 [[0,'partial','2025:9:2 확인서에 업무팀요구 준수·보고대상·전반 결론이 이미 있으므로 그 세 기준을 원발문의 누락 요구로 연결하지 않는다. 이 출력에서는 실제 빠진 윤리준수만 연결한다.',['crit1']],
  [1,'partial','같은 확인서에는 법규위반과 그룹감사 관련 기타주의사항이 이미 있다. 실제 빠진 후보인 미수정왜곡·경영진편의·유의통제미비점·지배기구 유의사항만 연결한다. 누락 세 가지를 고르는 원발문이 네 개 전부의 개별 빈도를 증명하지는 않는다.',['crit5','crit6','crit7','crit8']]]
];
assert.equal(decisions.length,rows.length);
const updates=rows.map((r,i)=>({link_id:r.link.id,old_target:r.link.target,prior_relationship:r.link.relationship,
 outputs:decisions[i].map(([candidate_index,relationship,reason,ids,sourceIds],n)=>{
  const t=r.candidates[candidate_index];assert(t);
  const criterion_ids=ids==='all'?t.criteria.map(c=>c.criterion_id):ids??t.criteria.filter(c=>c.lineage_matches).map(c=>c.criterion_id);
  assert(criterion_ids.length);for(const id of criterion_ids)assert(t.criteria.some(c=>c.criterion_id===id));
  const {s,q}=qs.get(t.set_id+'/'+t.subquestion_id);
  const source_unit_ids=sourceIds??r.link.source_unit_ids;
  return{id:n===0?r.link.id:`${r.link.id}-points-20260914-${n+1}`,target:{set_id:t.set_id,subquestion_id:t.subquestion_id,criterion_ids},relationship,review_status:'reviewed',reason,
   source_unit_ids,snapshot:{element_sha256:sha(JSON.stringify(r.element)),question_sha256:questionHash(s,q),
     source_hashes:Object.fromEntries(source_unit_ids.map(id=>[id,unitMap.get(id).contentHash])),
     source_metadata_hashes:Object.fromEntries(source_unit_ids.map(id=>[id,sourceUnitHash(unitMap.get(id))]))},
   evidence:{original_record_ids:r.question_records.map(x=>x.id),original_sources:r.question_records.map(x=>x.source),
     candidate_index,criterion_lineage:t.criteria.filter(c=>criterion_ids.includes(c.criterion_id)),
     source_authorities:source_unit_ids.map(id=>({id,authority:unitMap.get(id).authority,edition:unitMap.get(id).edition})),
     limitations:'관계에 대한 agent 의미 검토이며 사람 승인·실제 채점·과거 시험 정답 판본의 신규 전수 검증이 아니다. 학습자료 원자료 단위를 공식성 확인으로 승격하지 않는다.'}};
 })}));
const result={schema_version:1,reviewer:'/root/review_06_10',reviewed_at:'2026-09-14',
 source_links:R+'coverage-links.snapshot.json',source_links_sha256:sha(fs.readFileSync(R+'coverage-links.snapshot.json')),
 candidate_bank:R+'candidate-v1/bank.json',candidate_lineage:R+'candidate-v1/lineage.json',
 candidate_lineage_sha256:sha(fs.readFileSync(R+'candidate-v1/lineage.json')),
 review_input:R+'coverage-review-input.json',review_input_sha256:sha(fs.readFileSync(R+'coverage-review-input.json')),
 method:'영향받은34관계의 원발문·수신 발문·최종 criterion·기준서/학습자료 원문 단위 수동 의미대조. 동일 원기출 재수록은 추가 출제로 세지 않으며 분리·정수배점에 맞춰 관계만 재연결한다.',
 deleted_only_target_links:0,updates};
fs.writeFileSync(R+'coverage-update-plan.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({updated_links:updates.length,result_links:updates.reduce((n,u)=>n+u.outputs.length,0),new_links:updates.reduce((n,u)=>n+u.outputs.length-1,0)}));
