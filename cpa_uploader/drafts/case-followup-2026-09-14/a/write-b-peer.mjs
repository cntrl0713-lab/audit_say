import fs from 'node:fs';
import crypto from 'node:crypto';

const dir = 'cpa_uploader/drafts/case-followup-2026-09-14';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const read = name => JSON.parse(fs.readFileSync(`${dir}/b/${name}.json`, 'utf8'));
const sets = read('sets');
const design = read('design');
const qa = read('qa');
const reviews = read('review');
const source = 'src-04ef65747b44e066ee';
const q14 = sets[2].subquestions[1];
if (!q14.topic_ids.includes('09') || !q14.criteria[0].source_ref_ids.includes(source) || !sets[2].source_refs.some(r => r.id === source)) {
  throw new Error('B14 보충 출처와 주제 수정이 아직 확인되지 않아 최종 peer 기록을 생성하지 않음');
}

const notes = [
  ['case-10-control-sample-frame-20260914', 'sub1',
    '승인완료 항목만 추출하면 사전승인을 위반한 출고가 빠진다는 실제 위험을 이용해 모집단을 다시 설계해야 한다. 승인 여부와 무관한 전 발행번호 대장 및 출고기록이 완전성 대사의 구체적 자료로 쓰인다.',
    '누락 원인 설명, 적절한 모집단 범위, 완전성 확인 절차는 서로 다른 설계요소이며 각 1점으로 3점을 유지한다. 포괄적인 감사절차 일반론만으로 만점에 도달하지 않는다.',
    '부분답안은 올바른 범위와 대사만 제시해 2점이며, 승인완료만 유지하고 대사를 거부하는 오답은 0점이다.',
    ['KGA530.6', 'KGA530.A5'],
    '고급연습 2023 GS1 문제8 물음1의 승인된 출고지시서 모집단 오류와 직접 대응한다. 2015 기출 문제7 물음1은 감사목적·표본단위 및 결과평가의 인접 요구이며 같은 출제로 합산하지 않는다.'],
  ['case-10-control-sample-frame-20260914', 'sub2',
    '가의 적법한 취소와 실제 출고 부재, 나의 실제 출고 및 설계절차·적절한 대체절차 모두 불능이라는 서로 다른 증거상태가 처리 결론을 바꾼다.',
    '가의 적절한 대체항목 선정과 나의 통제이탈 처리를 각 1점으로 구별한다. 두 항목을 모두 정상 승인 항목으로 바꾸는 것은 가에서도 적절한 표본선정 조건을 만족하지 않는다.',
    '부분답안은 가의 처리와 근거만 맞아 1점이고, 양쪽을 정상 승인된 항목으로 임의 교체하는 오답은 0점이다.',
    ['KGA530.10', 'KGA530.11', 'KGA530.A14', 'KGA530.A15'],
    '고급연습 2023 GS1 문제8 물음2의 기준서 구별을 취소기록과 분실기록의 실제 조건에 적용했다. 기존 pilot-10-003의 일반적 두 경우 설명과 달리 부모 사실이 처리대상을 정한다.'],
  ['case-10-control-sample-frame-20260914', 'sub3',
    '8%의 실제 표본이탈률, 예상 1%, 허용 5%, 최초 낮은 위험평가를 입증할 추가 증거가 없다는 조건이 위험평가 상향을 요구한다. 작은 거래금액이라는 담당자의 반론은 승인 통제의 이탈평가를 대체하지 않는다.',
    '낮은 위험평가 유지 불가·위험 증가라는 판단 1점과 실제 이탈률 및 추가증거 부재라는 근거 1점을 인정한다. 통제이탈을 곧 확정된 재무제표 왜곡표시로 간주하지 않는다.',
    '위험 증가만 답한 부분답안은 1점, 금액이 작으니 기존 평가를 유지한다는 오답은 0점이다.',
    ['KGA530.15', 'KGA530.A21'],
    '2015 문제7 물음1 및 고급연습 2023 GS1 문제8의 최대이탈률·표본위험 허용치 요구와 새 사례의 예상 밖 높은 이탈률에 대한 위험평가를 구별했다. 새 문항은 표본계산이나 무조건적인 모집단 수용여부 계산을 요구하지 않는다.'],
  ['case-11-estimate-lookback-20260914', 'sub1',
    '3년 보증 중 미종결 의무가 남았지만 전기 추정, 당기 지급내역과 현재 재추정이 존재하므로 최종 결과가 나올 때까지 검토를 미룰 수 없다. 비교대상과 당기 위험평가 목적을 함께 적용해야 한다.',
    '지연 불가 판단, 비교 검토 조치, 과거 추정과정의 효과성을 이용한 당기 위험평가 목적을 각 1점으로 3점 유지한다. 비교하겠다는 분명한 조치가 지연 불가 판단을 함축하면 판단도 인정한다.',
    '현재 전기 추정과 재추정을 비교한다는 부분답안은 판단 및 조치 2점, 전 보증 만료까지 기다리겠다는 오답은 0점이다.',
    ['KGA540.14', 'KGA540.A55', 'KGA540.A56'],
    '2022년 문제8 물음2 항목②의 원발문 끝 [기출변형]을 직접 확인했다. 교재 변형 수록이며 공식 시험 PDF 원본으로 취급하지 않는다. 고급연습 2025 GS1 문제5 물음1 요구1은 소급검토 정보의 직접 근거이지만 장기 미종결이라는 적용조건은 새로 구성했다.'],
  ['case-11-estimate-lookback-20260914', 'sub2',
    '전기 확정 후 새로 발생한 공급중단과 부품가격 상승, 당시 이용가능하거나 합리적으로 입수했어야 하는 정보를 적절히 반영했다는 사실이 차액만으로 전기 오류를 단정하는 논리를 배제한다.',
    '전기 오류를 자동 확정할 수 없다는 판단과 사후 새로운 정보·당시 적정한 정보 반영의 이유를 각 1점으로 구별한다. 전기 오류수정 또는 감사의견 등 제시되지 않은 후속 요구를 숨겨 채점하지 않는다.',
    '자동 오류 확정 불가만 쓰면 1점이고 실제 결과와 반드시 같아야 한다는 오답은 0점이다.',
    ['KGA540.14', 'KGA540.A60'],
    '소급검토 목적에 관한 학습자료를 인접 설계자료로 사용하되, 사후판단 금지와 전기 정보 이용가능성의 정답 경계는 2026 공식 540.14/A60에서 직접 검증했다.'],
  ['case-11-estimate-lookback-20260914', 'sub3',
    '보증충당부채와 대손충당금은 낮게, 당기손익 공정가치측정 비상장투자자산은 높게 선택하는 추정집합을 3기간 관찰했다는 사실로 손익 방향의 일관성을 추론한다. 개별 추정치의 합리성과 집합 편의징후를 구별한다.',
    '개별 합리성에도 편의 평가가 필요하다는 판단, 집합의 동일한 이익증가 방향이라는 적용 근거, 징후 자체가 모든 추정치의 왜곡표시라는 결론은 아니라는 경계를 각 1점으로 3점 유지한다. 지문은 이익증가 방향을 직접 알려주지 않고 FVTPL 분류로 추론근거를 제공한다.',
    '편의평가 필요성과 징후 자체로 오류를 확정할 수 없다는 부분답안은 2점, 평가 생략과 전부 오류 확정을 함께 주장하는 오답은 0점이다.',
    ['KGA540.32', 'KGA540.A133', 'KGA540.A134'],
    '2020 문제7의 교재 기출변형과 고급연습 p193의 2018 기출응용 표기를 보존한다. 양자를 새 독립 기출로 합산하지 않는다. 2026 공식 본문의 개별 합리성·집합·여러 기간 관찰 및 징후/왜곡표시 경계를 직접 대조했다.'],
  ['case-14-component-evidence-gap-20260914', 'sub1',
    '부문 완료보고의 충분하다는 결론과 내부 목록만 있다는 요약의 불일치가 토의사항과 문서검토 필요성을 정한다. 부문감사인의 독립성·적격성·접근가능성을 이미 충족하여 인적 결격 문제와 구별했다.',
    '불일치에 관한 적합한 대상과의 토의 및 관련 부문 감사문서 검토 필요성 결정은 별도 행동으로 각 1점이다. 모든 부문조서를 무조건 재수행하라는 요구는 없다.',
    '보고와 근거의 차이를 토의하는 부분답안은 1점, 완료보고 결론만 수용하는 오답은 0점이다.',
    ['KGA600.42', 'KGA600.A61'],
    '고급연습 2023 GS3 문제7 물음2의 커뮤니케이션 평가 두 절차를 창고증거 불일치에 적용한다. 기존 pilot-14-004의 일반 목록이나 14-006의 독립성 결격과 같은 사례를 반복하지 않는다.'],
  ['case-14-component-evidence-gap-20260914', 'sub2',
    '부문업무 불충분이 확정되었고 제3자 창고의 조회 협조·현장 접근이 가능하므로 책임 문구만으로 종료할 수 없다. 실재성에 대한 실제 절차 내용과 가능한 두 수행자 중 담당 결정을 요구한다.',
    '창고 직접조회 또는 현장 실재성 검사 등 구체적 추가절차 1점과 수행자 결정 1점이다. 양 대안을 모두 하도록 요구하지 않으며, 어느 수행자만 항상 허용된다고 고정하지 않는다. 재고 증거를 실제로 채점하여 주제09를 보조 연결했다.',
    '부문감사인에게 추가업무를 맡긴다는 수행자 결정만 답하면 1점이고, 책임 문구만 더하여 종료하는 오답은 0점이다.',
    ['KGA600.43', 'KGA501.8'],
    '2017 문제7 물음4(1)의 추가절차/수행자 결정 두 요구를 재고창고 접근가능성에 적용했다. 검토 중 직접 절차 출처가 600.43만 연결된 점을 발견하여 501.8 연결을 요청했고 최종 파일에서 해결을 확인했다.'],
  ['case-14-component-evidence-gap-20260914', 'sub3',
    '동일 방향의 두 미수정 매출 과대계상과 다른 부문의 소송충당부채 증거 미입수를 서로 다른 상태로 해석해야 한다. 부문별 적정의견이라는 사유만으로 그룹 수준 평가를 생략할 수 없다.',
    '그룹 수준 평가 생략 불가의 판단, 확인된 미수정왜곡표시의 총영향 평가, 확인되지 않은 증거 부족의 의견 영향 평가를 각 1점으로 구별한다. 증거 부족 금액을 확정 오류에 단순 가산하거나 명시되지 않은 최종 의견을 요구하지 않는다.',
    '그룹 평가 필요성과 매출왜곡표시 집계만 답한 부분답안은 2점이고 부문 적정의견으로 두 평가 모두 생략하는 오답은 0점이다.',
    ['KGA600.44', 'KGA600.45', 'KGA600.A63'],
    '2017 문제7 물음4(2) 원발문 L18002-L18004 및 해설 L18130-L18141까지 직접 확인하여 총영향 요구를 확인했다. 이번 소송충당부채 증거 부족과의 구별은 600.45의 별도 요구와 결합한 새 적용조건이다.']
];

const file_bindings = Object.fromEntries(['sets', 'design', 'review', 'qa'].map(n => [n, {file:`${dir}/b/${n}.json`, sha256:sha(fs.readFileSync(`${dir}/b/${n}.json`))}]));
const evidence=[];
for (const d of design) {
  for (const [kind, rows] of [['learning',d.learning_source_reading], ['official_2026',d.official_current_edition_comparison]]) {
    for (const row of rows) {
      const bytes=fs.readFileSync(row.file);
      const text=bytes.toString('utf8').split(/\r?\n/).slice(row.start_line-1,row.end_line).join('\n');
      if (text !== row.quote) throw new Error(`Source range mismatch: ${row.file}:${row.start_line}`);
      if (sha(bytes)!==row.file_sha256) throw new Error(`Source file hash mismatch: ${row.file}`);
      evidence.push({set_id:d.set_id,kind,file:row.file,file_sha256:sha(bytes),start_line:row.start_line,end_line:row.end_line,quote_sha256:sha(row.quote),description:row.description??row.paragraphs,check:'directly_read_and_compared'});
    }
  }
}
const question_reviews=notes.map(([set_id,subquestion_id,fact_dependency,point_rationale,qa_rationale,paragraphs,learning_comparison])=>{
  const set=sets.find(s=>s.id===set_id),q=set.subquestions.find(q=>q.id===subquestion_id);
  const cases=qa.filter(c=>c.set_id===set_id&&c.subquestion_id===subquestion_id);
  if(cases.length!==2||!cases.some(c=>c.kind==='partial')||!cases.some(c=>c.kind==='wrong'))throw new Error('QA coverage');
  for(const c of cases){ const actual=q.criteria.filter(k=>c.met_criterion_ids.includes(k.id)).reduce((n,k)=>n+k.max_points,0);if(actual!==c.expected_points)throw new Error('QA expected points');}
  if(!reviews.some(r=>r.set_id===set_id&&r.subquestion_id===subquestion_id))throw new Error('Review coverage');
  return {set_id,subquestion_id,question_sha256:sha(JSON.stringify(q)),question_style:'case',topic_ids:q.topic_ids,max_points:q.criteria.reduce((n,c)=>n+c.max_points,0),status:'pass',fact_dependency,content_and_model_answer_check:'부모 사실·발문·모범답안·모든 requirement/criterion을 직접 읽고 아래 공식 문단의 조건과 대조함',point_rationale,qa_rationale,source_paragraphs:paragraphs,source_unit_ids:[...new Set(q.criteria.flatMap(c=>c.source_ref_ids))],learning_comparison,qa_inputs:cases.map(c=>({kind:c.kind,answer_sha256:sha(c.answer),expected_points:c.expected_points,met_criterion_ids:c.met_criterion_ids})),remaining_content_findings:[]};
});
const report={version:'independent-agent-content-review-v1',reviewer_id:'agent:/root/followup_sources_a',method:'independent_agent_manual_content_review',human_review_performed:false,paid_api_semantic_review_performed:false,actual_model_grading:'not_performed_by_this_reviewer; root workflow retains separate Luna evidence',review_date:'2026-09-14',status:'pass',file_bindings,scope:{case_count:sets.length,subquestion_count:question_reviews.length,qa_count:qa.length,fact_character_counts:sets.map(s=>({set_id:s.id,characters:s.shared_context.facts.map(f=>f.text).join('\n').length})),all_questions_fact_dependent:true,minimum_fact_characters:400},resolved_findings:[{id:'B14-SOURCE-TOPIC-01',set_id:sets[2].id,subquestion_id:'sub2',finding:'구체적인 제3자 재고 실재성 절차의 보충 직접 출처 및 실제 요구 주제 연결이 필요함',resolution:'최종 source_refs와 sub2.c1.source_ref_ids에 KGA501.8을 연결하고 sub2.topic_ids에 09를 추가한 사실을 확인함'}],question_reviews,source_evidence:evidence,additional_source_reading:[{file:'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',start_line:18002,end_line:18004,purpose:'2017 문제7 물음4(2) 원발문 종료까지 확인'}, {file:'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',start_line:18140,end_line:18141,purpose:'같은 해설 문장 종료 확인'}],limitations:['기출 교재의 원발문과 [기출변형]/[기출응용] 표시는 확인했으며 공식 시험 원본 PDF 무변형 수록으로 인정하지 않는다.','원문·내용·배점·기대값 검토이며 실제 채점 성능 또는 사람 승인을 나타내지 않는다.','공식 사이트 최신 목록의 2026-09-14 확인은 부모 agent의 별도 수집 증거를 이용하며 이 reviewer는 저장된 2026 공식 전문의 실제 문단을 직접 읽었다.'],unresolved_content_findings:[]};
fs.writeFileSync(`${dir}/b-peer-review.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({file:`${dir}/b-peer-review.json`,sha256:sha(fs.readFileSync(`${dir}/b-peer-review.json`)),file_bindings,count:question_reviews.length}));
