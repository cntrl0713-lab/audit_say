import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14',D='cpa_uploader/drafts/case-trio-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const notes={
 a:[
  '2018 문제2 물음5의 종결 목적과 KGA520.6/A17/A19를 원발문·해설 및 2026 PDF450/454/455 본문에서 대조했다. 상반기 분석·세부테스트 완료가 생략 사유가 되지 않는 판단1과 도매→직영 변화에 비추어 최종 관계의 일관성을 평가하는 적용목적1이다. 단계 전체 일반목록은 기존 std82e 문항에 있으며 신규는 기업 이해의 변화가 필요하다. 모범2·판단만1·반대0이 타당하고 근거만 명확하면 판단을 인정한다.',
  'KGA520.A18의 새 위험과 각주10의 315.37을 현재 전문의 본문·각주에서 확인했다. 단가불변/출하감소/기말집중매출 관계로 발생 또는 기간귀속 위험을 추론하는1과 집중거래의 인수일/출하일/기록일 등 구체 절차1이다. 위험을 이미 제시한 기존 기타정보 재고사례와 달리 원인을 추론해야 한다. 두 위험을 모두 요구하거나 오류확정을 요구하지 않는다. 주제06/08/10은 위험식별·증거절차·분석요구를 나타내며 부분1·오답0 기대값이 일치한다.',
  '2024 GS2 문제2 물음2는 520.7 일반 조사목록이며 새 sub3는 A20의 이미 입수한 다른 증거 활용을 적용한다. 기존 이자감면 case10-007의 설명 미지지·추가증거 경계와 반대 상황이다. 항상 새 외부증거 필요라는 주장 배척1과 6월 종료·7월 자체배송자료를 감소시점에 연결하는1이다. 운송비 전체 감사완료를 단정하지 않으며 모범2·판단만1·반대0, 근거가 함축하는 판단인정이 타당하다.'
 ],
 b:[
  '2021 문제3 물음2의 전문가 적격성/역량/객관성 평가와 620.9/A14/A17~A20를 2026 전문으로 대조했다. 토지·건물15년을 바이오 세부전문성으로 대신할 수 없어 추가평가1, 계속자문 관계를 전문가에게 질문1, 제시한 분리/검토의 위협감소 효과평가1이다. 역량은 인력·시간으로 충족시켜 숨은목록을 없앴다. 이전 전문가 보고서 오류 사례는 12/13 후속대응이고 이번은 선정 전 평가다. 모범3·전문성만1·세요구반대0이 타당하다.',
  '620.10/A21/A22 본문 및 2026 PDF691을 확인했다. 사용료 절감 평가방법과 가정의 의미·재무보고 적합성 이해1, 내부 사업계획과 외부 계약자료의 성격 이해1로 분리한다. 계산이나 아직 없는 평가결과 적합성 확정·원천자료 정확성테스트는 요구하지 않는다. 고급연습 p155~156은 회사 의뢰 경영진측 전문가임을 구별해 500의 의무를 620으로 잘못 이전하지 않았다. 모범2·방법이해만1·전문가일임0이 타당하다.',
  '620.11(c)(d)와 A23~A31을 대조했다. 3월10일 검토에 맞춘 전달시점1, 최종금액 구두만이 아닌 가정/방법/발견사항을 읽어 검토할 자료1, 회사 비밀유지·목적외 사용제한의 합의1이다. 모든 합의가 서면이라는 보편의무로 확대하지 않는다. 2021 문제3 물음3은 커뮤니케이션을 예시로 제외하므로 연결은 비밀유지 c3만 부분관계이다. 모범3·시점만1·세요구반대0이며 형식·내용 낱말을 중복배점하지 않는다.'
 ],
 c:[
  '2026 PDF429~430의505.15(a)를 등록전사·원PDF·완결 문장과 대조했다. 위험낮음과 설계/실행 이해는 운영효과성에 대한 충분하고 적합한 증거를 대신하지 않는다. 갑의 단독사용 부적절 판단1과 실제 미입수 증거라는 결격근거1이다. 기존 일반조건 열거와 달리 사실을 적용해야 하며 근거만 써도 결론이 함축되면2, 판단만1, 반대결론과 독립참근거는1이다. 고급연습2023GS3-2-2의 예시제외 조건 중15(a)만 부분연결한다.',
  '505.15(b)의 다수 동질 소액 조건을 별도 법인예금의 소수 고액·상이 계약에 적용한다. 다른 세조건은 충족 사실로 고정했다. 단독사용 부적절 판단1과 실제 결격특성을 조건에 연결하는1이며 고액/이질성 수식어마다 가점하지 않는다. 개인예금과 통제증거를 섞지 않는 독립상황 설명이 있다. 모범2·판단만1·반대0과 근거함축 판단2를 대조했고 주제09의 사실의존 물음이다.',
  '2026 PDF434~435 A23 전체를 열람했다. 이 사례는 열람이 확인되어 수령불명확 일반론이 정답이 아니다. 정확성 검증미확인1과 예금주에게 유리한 과대표시에서 회신유인이 약해 증거설득력이 낮음1을 독립 인정한다. 2018 기출2-4의 일부 OCR 손상은 해설14955~14963과 공식본문으로 한계를 확인하며 예금유인 적용이 직접기출이라고 주장하지 않는다. 모범2·각절반1·두명제반대0, 공란0이 타당하다. 가상 사실의 fidelity는 reconstructed로 실측 전 정정했다.'
 ]};
const checks=Object.fromEntries(['source','answer','prompt','points','style','topics','edition','nonduplication'].map(key=>[key,'pass']));
for(const worker of ['a','b','c']){
 const set=read(D+'/'+worker+'/sets.json')[0];assert.equal(set.subquestions.length,3);
 fs.writeFileSync(R+'/root-review-notes-'+worker+'.json',JSON.stringify(set.subquestions.map((q,i)=>({set_id:set.id,subquestion_id:q.id,checks,rationale:notes[worker][i]})),null,2)+'\n',{flag:'wx'});
}
const catalogue=buildSourceCatalog();assert.deepEqual(catalogue.units,read(D+'/source-catalog.json').units,'Reconcile any changed source registration before freezing');
fs.writeFileSync(D+'/source-catalog-final.json',JSON.stringify(catalogue,null,2)+'\n',{flag:'wx'});
console.log({manual_questions:9,source_units:catalogue.units.length});
