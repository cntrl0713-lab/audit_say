import fs from 'node:fs';
import { createHash } from 'node:crypto';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sets=JSON.parse(fs.readFileSync(`${D}/b/sets.json`,'utf8'));
const notes={
  'pilot-13-007':'유형1의 설계·실행 이해와 운영효과성 증거 부재(402.A22)를 구별했다. exp1은 통제의존 유지, 유형2·타감사인 업무 이용불가, 직접 접근 가능이 명시되어 402.16(b) 직접 테스트를 선택해야 한다. 단순 의무목록이 아니라 실제 선택 가능성을 해석한다.',
  'pilot-13-011':'급여코드 변환의 재무제표 관련성이 주어져 제외된 하위서비스에도 402.18이 적용된다. exp1의 보충이용자 통제는 관련성·설계·실행·운영효과성이 분리되고 담당자 퇴사·미입수 기록이 실제 실행을 추정하지 못하게 한다. 402.17(b)의 조건과 모두 일치한다.',
  'pilot-12-001':'재무제표일부터10개월은570.13의 최소12개월 미달이며 확장요청과 미달판단이 별도 득점이다. 자금계획의 개선효과·실행가능성, 유의적인 현금흐름예측의 데이터 신뢰성·가정 근거는570.16(b)(c)의 독립4명제이다. 만기연장 미승인과 신규계약 협의가 이 적용을 뒷받침한다.',
  'pilot-12-009':'경영진 조사수정 완료 뒤에도450.7의 잔존왜곡표시 확인이 필요하다. exp1은 실제이익에 따른 중요성 재평가(10), 차입약정 충족에 대한 성격·상황(11(a)), 전기미수정 오류의 당기영향(11(b))을 구체적으로 대응하여 독립3점이 타당하다.',
  'pilot-12-010':'어떤 진술의 미제공인지 알 수 없는 A는 자동의견거절로 확정하지 않고 필수책임진술 여부와 성실성 의문의 정도를 확인해야 한다. B는 취임 전 기간의 필수 거래완전성 진술 거절이어서580.A18·20(b)·A26에 따라 전기간요청과 의견거절이 맞다. 최종 exp1의 대상기간·책임근거·의견거절·필수진술 미제공 및 대체불가 근거4점을 원문과 대조하였다. 기간·책임만 쓴 대표부분답안2점이 타당하며 의견거절을 함축하지 않는다.',
  'pilot-08-008':'경영진측 전문가의 산업경험·시간인력·성과연동보수가500.8/A48/A51/A54의 적격성·역량·객관성 평가에 대응한다. exp1은 같은계약·같은평가기준일의 반대자료를 해소하도록 절차변경/추가를 정하고 다른 자산의 동일자료 이용에 미치는 영향을 고려하는500.11의2명제를 적용한다.',
  'pilot-06-008':'기술변화와 관측자료 부족은315.12(f)/A7/보론2의 변화·불확실성이며, 가능성과 규모를31/A207~A213에 맞게 각각 검토한다. 신규위험 누락은315.23(a)의 기대위험종류 판단과 조건부 누락원인 이해,23(b)→22(b)의 기업위험평가절차 적합성 평가 시사점으로 구분한다. 단독사례에 남았던 상황B 표기가 제거되었음을 확인하였다.',
  'draft-09-501-freq01':'11/30실사~12/31재무제표일 사이 변동의 적정기록 증거는501.5의1개 조건부 조치다. 계속기록법은501.A9의 통제효과성 검토를 면제하지 않는다. 최종 exp1은 부적절판단·설계·실제실행·기간말까지 유지라는4독립점수이며 기존 같은원문 배점과 일치한다. 실제12월 거래가 발생한 과거시제로 정리되어 퇴사후 미입수기록과 충돌하지 않는다.'
};
const report={version:1,reviewer:'Codex C 담당 agent (B 작성자와 별도)',execution_kind:'independent_agent_content_review',input_files:Object.fromEntries(['sets.json','design.json','review.json','qa.json'].map(name=>[`${D}/b/${name}`,sha(`${D}/b/${name}`)])),scope:'8세트16물음의 모든 지문·발문·저장 모범답안·criterion·대표 QA를 직접 읽었다. 기존·신규 criterion의 직접 공식 인용을 대조했고 315.23의 의존22(b)까지 확인하였다. 원자료 정본의 전체 판본 재검증이나 별도 유료API 의미검수는 수행하지 않았다.',sets:sets.map(s=>({set_id:s.id,question_count:s.subquestions.length,fact_characters:s.shared_context.facts.map(f=>f.text).join('\n').length,points:s.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0),question_ids:s.subquestions.map(q=>q.id),result:'pass',reason:notes[s.id],unresolved:[]})),changes_checked:[{set_id:'draft-09-501-freq01',issue:'12월 입출고 예정과 이미 퇴사 후 기록검토 상태의 시제 불일치',resolution:'12월 입출고가 발생하였다는 과거시제로 작성자 수정 확인'},{set_id:'pilot-06-008',issue:'기준서형 분리 후 단독 사례의 상황B 잔존',resolution:'이 상황·제시된 상황으로 작성자 수정 확인'},{set_id:'draft-09-501-freq01',issue:'root가 요청한 설계·실행·유지와 판단 배점 분리',resolution:'최종4criterion·각1점과 모범·QA 동기화 확인'},{set_id:'pilot-12-010',issue:'root가 요청한 기간·책임 및 의견·미제공근거 분리',resolution:'최종4criterion·각1점과 모범·QA 동기화 확인'}],result:'pass',actual_model_grading:'not_run_by_cross_reviewer',unresolved:[]};
fs.writeFileSync(`${D}/c/cross-review-b.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sets:sets.length,questions:report.sets.reduce((n,s)=>n+s.question_count,0),result:report.result,hash:sha(`${D}/b/sets.json`)}));
