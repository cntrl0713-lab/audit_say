import fs from 'node:fs';
import crypto from 'node:crypto';
const D='cpa_uploader/drafts/case-applied-2026-09-14/';
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>digest(fs.readFileSync(p));
const expected='bad5b2ec07bc866c0ad0e7eb5e89f920bd750a54d67a1d709e96a6da2606439f';
if(hash(D+'a/sets.json')!==expected)throw Error('A final sets changed; read changed content before review');
const sets=read(D+'a/sets.json'), plans=read(D+'a/design.json'), qa=read(D+'a/qa.json');
const catalog=read(D+'source-catalog-final.json'), bank=read(D+'bank-before.json');
const hashes=Object.fromEntries(['sets','design','review','qa','coverage-proposals','source-files','validation'].map(k=>[k,hash(D+'a/'+k+'.json')]));
const sourceFile='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const commentRows=[
  [
    'KGA 500.6 및 A31의 목적에 관련된 후속지급 검사와 2017 기출 물음4의 해설 L17807~17808을 대조했다. 보고서일 근처까지의 기간 확대는 기출 적용근거이며 500 본문에 그 날짜가 직접 쓰였다고 표시하지 않는다.',
    '1월 20일 이후 접근 가능하고 12월 매입 일부가 2월 지급 예정이므로, 현장 철수를 증거 수집 종료와 같게 다루는 계획을 보완한다. 확대 조치와 늦은 지급의 누락 위험을 모두 답안이 반영한다.',
    '검사기간 보완과 그 이유만 요구한다. 전수통장 조회, 표본 수, 최종 의견이나 현장 재방문을 숨은 득점 요건으로 추가하지 않는다.',
    '유지 2점: 기간 확대 조치 1점, 30·60일 결제에서 생기는 미검사 지급의 의미 1점이다. 같은 부적절 판단을 별도로 가산하지 않으며 1~2문장으로 완성할 수 있다.',
    'fact1·fact2의 결제주기, 철수일 및 2월 지급예정을 삭제하면 이 날짜까지의 절차가 왜 부족한지 정할 수 없다. 단순한 증거 일반론은 사례 이유 1점을 충족하지 않는다.',
    '07은 위험에 대응한 절차 시기, 08은 완전성 목적에 관련된 지급증거다. 외부조회를 요구하지 않는 이 물음에 부모 대표 주제 09만 복제하지 않았다.',
    '500.3의 2026년 개시 적용(L16882~16885)을 확인했다. 2026 결산과 2027 후속지급의 관계가 분명하고 기존 2025 전사의 500.6/A31은 2026 L16931~16937, L17245~17252와 같은 요구다.',
    'pilot-08-001/sub2는 과소계상 검증에 관련되는 정보 일반론, pilot-08-007/sub3는 매출 인수기간에 따른 기간귀속 범위다. 이 물음은 매입 결제주기로 검사 종료일을 판단하는 적용 목표다.'
  ],
  [
    '2017 기출 해설 L17809 및 L17817~17820은 0잔액의 당기 주요 거래처도 고려하도록 한다. 505.7(b)의 대상자 선정과 500.A31의 증거 방향을 보충 근거로 대조했다.',
    '청솔은 기말 원장 0잔액이나 연간 주요 공급업체다. 제외 판단을 부정하고 거래내역으로 모집단을 보완하며, 원장 밖 누락 가능성을 설명하는 답안이 그 사실을 사용한다.',
    '제외 판단·선정 보완·두 정보원천의 차이를 명시적으로 요구하므로 세 명제가 발문에 대응한다. 조회 발송이나 회신 통제 전체 목록은 채점하지 않는다.',
    '유지 3점: 제외 판단, 당기 주요 공급업체를 반영한 선정, 원장에 없는 부채를 놓칠 수 있다는 이유를 각 1점으로 구분한다. 선정 조치는 판단을 함축할 수 있으나 모집단 이유까지 자동 충족하지 않는다.',
    'fact3의 0잔액과 연간 주요 거래를 함께 보아야 한다. 일반적으로 조회를 실시한다는 답안만으로 청솔의 선정과 모집단 한계까지 같은 만점을 얻지 못한다.',
    '09의 조회대상 선정과 08의 누락 탐색 방향에 해당한다. 07 일반 대응보다 실제 시험 요구를 직접 다루는 두 주제로 연결했다.',
    '505.4(L18187~18190)와 500.3의 2026 적용을 확인했다. 등록 505.7 및 500.A31은 2026 전문 L18226~18238, L17245~17252와 대상·절차 방향이 일치한다.',
    'pilot-08-001/sub2와 증거 방향은 인접하지만 신규는 0잔액 업체의 조회 선정까지 적용한다. case-08-selection-coverage는 매출채권 검사결과의 투영 문제여서 직접 중복이 아니다.'
  ],
  [
    '2024 제2회 GS 문제4의 지급 사실 L4149~4151 및 해설 L4215~4219를 대조했다. 1월 지급이 차기 매입일 수도 있어 귀속 절차가 필요하다는 직접 근거이며, 500.6/A31과도 충돌하지 않는다.',
    '한빛이 12월과 1월 모두 납품했다는 사실 때문에 1월 지급만으로 전기말 채무를 확정할 수 없다. 대응 세금계산서·납품·검수자료로 거래 발생기간을 확인한다는 답이 맞다.',
    '판단, 기간귀속 절차, 그 절차가 필요한 이유를 각각 요구한다. 증빙의 모든 명칭을 빠짐없이 나열하거나 누락 금액을 계산해야 하는 숨은 조건은 없다.',
    '유지 3점: 미확정 판단, 실제 거래귀속 확인 조치, 1월 매입일 수 있다는 이유가 독립적이다. 조치·이유가 판단을 함축하면 인정하고 반대 판단만 있더라도 맞는 독립 근거는 보존한다.',
    'fact4의 두 납품기간과 미대조 증빙이 필수다. 지급이 있었다는 사실의 반복은 절차나 귀속 이유를 충족하지 못하므로 사례형이다.',
    '07은 미흡한 절차 보완, 08은 후속지급 증거와 채무 발생기간의 관련성이다. 외부조회 조건을 채점하지 않아 09를 기계적으로 붙일 이유는 없다.',
    '2026 결산 이후 2027년 1월 지급임이 부모에서 정해진다. 2024 모의사례는 학습 적용 원천으로 표시하며 시행 판본의 근거는 2026 KGA 500 본문이다.',
    'pilot-08-007/sub3와 기간귀속이라는 기술은 공유하나 기존은 매출의 인수·기록시점과 운송기간 변화다. 신규는 지급일로 전기 채무를 확정하는 오류를 다룬다.'
  ],
  [
    '501.10의 직접 교신 의무와 금지 시 대안(L17786~17801), A23의 일반질문서 제약에서 세부질문서 선택(L18021~18033)을 대조했다. 두 금지의 범위를 구별한 답안이다.',
    '일반질문서만 제한되고 사건별 직접 회신은 허용되므로 모든 직접 교신을 포기할 이유는 없다. 법률고문이 허용된 범위에서 답변하겠다는 사실에 맞게 세부질문서를 선택한다.',
    '포기 판단 및 선택할 형태·근거가 요구이며 세부 포함내용은 다음 목표로 분리했다. 세부질문서 명칭만 적은 답안에 제한 범위를 설명한 점수까지 주지 않는다.',
    '유지 2점: 전면 포기 판단 1점, 제한범위에 맞는 세부질문서 선택 1점이다. 허용된 직접 질의를 계속한다는 이유·조치가 결론을 함축하면 판단 점수를 인정한다.',
    'fact1·fact2에서 교신 필요성과 전문직 규칙의 허용범위를 읽어야 한다. 회사명만 바꾼 일반론은 아니며 직접 교신 자체가 금지된 경우에는 정답이 달라진다.',
    '주제 09의 소송 관련 법률고문 교신 조건이다. 단체 규칙은 주어진 감사 증거 조건이며 법률자문이나 법률 판단을 학습목표로 추가하지 않는다.',
    '501.2의 2026 개시 적용(L17712~17715)을 확인했다. A23 등록 전사의 제한 조건·가능 표현은 2026 전문과 동일하며 A24와의 혼합 인용이 아니다.',
    'pilot-09-009/sub2의 501.10 일반 조건과 인접한 심화다. 기존이 묻는 직접 교신 전면 금지와 이 사례의 일반질문서 답변 제한을 구별하므로 차이를 공개적으로 기록한다.'
  ],
  [
    '501.A23 L18025~18033의 사건목록, 가능할 때 경영진의 결과평가·금전영향, 평가 확인·목록 보충정보를 대조했다. 이미 있는 목록과 발송 경로를 제외하고 빠진 정보만 배점한다.',
    '최종 fact3은 사건 진행 여부만 요청한 실제 질의서 문구와 별도 검토표를 제공한다. 내부 평가·금액을 편입하고 법률고문에게 평가 타당성과 누락·오류 보충을 요청하는 답이 그 차이를 메운다.',
    '발문은 현재 기재된 사건과 적절한 경로를 유지하면서 질의 내용을 보완하도록 한정한다. 실제 초안의 네 누락을 찾아야 하며 목록·작성자·발송자를 다시 쓰는 것은 득점하지 않는다.',
    '유지 4점: 결과평가, 재무영향, 평가 타당성 확인, 사건목록 추가정보는 서로 다른 정보목적이다. 네 가지를 한 물음으로 둬도 하나의 질의서 보완 목표이며 2~4문장의 간단한 수정으로 충분하다.',
    'fact3의 실제 질의서와 보관자료를 대조해야 무엇이 이미 포함되고 무엇이 빠졌는지 결정한다. 특정 사건에 새 결과나 금액을 지어낼 필요는 없고 일반 목록 전체를 무조건 반복하는 문제도 아니다.',
    '주제 09, 501.A23의 질의서 내용에 직접 대응한다. 경영진 추정치가 등장해도 회계추정치 감사 전체를 요구하지 않으므로 주제 11을 추가하지 않는다.',
    '2026 전문 A23의 가능한 경우 조건은 내부 검토표가 실제 있다는 사실로 충족한다. 기존 2025 발췌와 원천·정보 항목·법률고문에게 요청하는 행동이 같다.',
    'pilot-09-009/sub2는 누가 작성·발송하고 어떤 회신 경로를 요청하는지를 다룬다. 여기서는 그 경로를 적절하다고 고정하고 질의서 본문의 실제 누락을 보완한다.'
  ],
  [
    '501.A24 L18034~18044는 예상 결과 논의를 위한 회합의 예를 대안적으로 든다. 복잡성 또는 의견 불일치 중 하나를 목적에 연결해도 c2를 인정하도록 수정된 최종 claim을 재확인했다.',
    '서면 회신이 있어도 계약상 책임·결과 전망의 문제가 남으므로 회합 고려를 배제할 수 없다. 회합이 모든 사건에서 필수라는 주장과 구별하고, 결과 논의 목적에 연결하는 답이 적절하다.',
    '필요성 검토를 배제한 주장에 대한 판단과 회합 근거·목적만 묻는다. 경영진의 동의와 대리인 참석은 사실에서 가능하다고 고정하며 목록을 숨은 점수로 요구하지 않는다.',
    '유지 2점: 회합 고려 판단 1점, 실제 복잡성 또는 의견 불일치를 결과 논의 목적에 연결한 이유 1점이다. 언제나 의무는 아니라는 동일 판단을 중복 배점하지 않는다.',
    'fact4의 복잡한 조항·상이한 전망과 서면 회신 이후의 제안을 적용한다. 일반적인 회합 가능성만 말하면 판단 1점에 그치며 사례 근거·목적 점수는 남는다.',
    '주제 09의 법률고문과 추가 교신이다. 감사팀 내부 검토나 의견형성 최종 보고를 요구하지 않아 다른 대표 주제로 확장하지 않았다.',
    '2026 A24의 판단할 수도 있다는 가능 표현 및 일반적인 회합 방식이 보존된다. 2025 GS1 해설 L6475~6477의 필수 아님이라는 경계와도 일치한다.',
    '2025 GS1의 필수절차 단정 OX와는 인접하지만, 신규는 서면 회신 후 상충하는 실제 설명을 결과 논의의 목적에 연결한다. 기존 은행의 501.10 조건·발송 역할과도 목표가 다르다.'
  ],
  [
    '570.16과 A16의 제3자 지원 약정·적법성·강제성·재무능력, A19의 중요한 계속지원 및 서면조회 고려를 2026 L24328~24362, L24659~24706에서 대조했다. 서면조회만을 유일한 수단으로 강제하지 않는다.',
    '긍정적 검토 이메일은 확정 약정과 다르고 다른 계열사 채무 증가로 새봄의 제공능력도 별도 확인해야 한다. 존재·조건, 집행 가능성, 제공능력의 세 증거대상을 답안이 구별한다.',
    '지원약정과 자금제공능력에 관한 보완절차를 요구하므로 약정의 실제 효력도 그 범위에 있다. 예측표 계산·일반 감사절차 전부·최종 의견까지 추가하지 않는다.',
    '유지 3점: 약정 존재·내용이라는 하나의 대상, 약정의 법적 효력, 지원자의 재무능력은 독립적이다. 이메일 부적절 판단은 따로 더하지 않으며 각 대상의 적절한 증거 확인 1점이다.',
    'fact1·fact2의 지원 의존도, 조건 없는 이메일과 계열사 부담 증가가 증거대상을 결정한다. 자기자금만으로 존속 가능한 회사라면 같은 적용 답안이 성립하지 않는다.',
    '12의 계속기업 계획·근거 평가다. 제3자 확인이 적합한 방법이라고 해서 조회 발송 통제를 별도 채점하는 09 문제로 확대하지 않는다.',
    '570.8의 2026 개시 적용(L24245~24259)을 확인했다. 새 2026 A16·A19 직접 발췌의 파일과 해시를 확인했으며 기존 2025 문단16은 같은 조건이다. 20/A24~A25의 별도 시행대상은 이 요구에 쓰이지 않는다.',
    'pilot-12-001/exp1은 현금예측의 계획·데이터·가정 일반 평가를 적용한다. 신규는 모회사 지원의 실제 약정과 제공능력의 증거로 좁힌 적용이며 단순 데이터 신뢰성 반복이 아니다.'
  ],
  [
    '570.19(a)~(b) L24379~24391은 경영진 계획의 적절한 공시, 중요한 불확실성 및 자산회수·부채상환 불가 가능성의 명확한 공시를 요구한다. 최종 세 criterion이 이 정보목적에 각각 대응한다.',
    '현재 주석은 현금유출·만기와 지원 추진만 말하며 지원조건 미확정과 불확실성의 결과를 드러내지 않는다. 필요한 세 의미를 보완하는 모범답안은 이미 있는 정보를 반복하지 않는다.',
    '최종 fact3에서 누락 목록을 알려주는 문장 대신 실제 주석을 읽게 한다. 발문은 계획 상태와 계속기업 위험을 드러내도록 요구하며 감사의견 명칭은 다른 목표로 분리했다.',
    '유지 3점: 계획의 미확정 상태, 중요한 불확실성의 존재, 정상적 회수·상환을 하지 못할 수 있다는 의미가 각각 인정되는 독립 공시다. 정상 영업 전망의 단순 삭제에 별도 점수는 없다.',
    '실제 주석과 확인된 미확정 지원조건을 비교해야 한다. 부모를 삭제하면 기재된 주요 사건을 제외할 수 없고 무엇을 보완할지도 같지 않으므로 사례형이다.',
    '12의 570.19 공시 적절성이다. 의견의 종류를 요구하지 않는 이 물음에는 주제15를 붙이지 않고 다음 비교 물음에서 연결했다.',
    '2026 570.19와 등록 2025 인용은 같은 내용이다. 상황 가의 이후 증거 확보를 명시해 이전 fact2의 미확보 상태를 잘못 승계하지 않으며 결산연도와 2027년 만기도 명시되어 있다.',
    'draft-12-570-freq01/q2는 공시 부족이라는 결론을 전제로 가능한 의견계열을 열거한다. 신규는 실제 주석의 누락을 발견해 보완하므로 그 기준서형 발문을 되풀이하지 않는다.'
  ],
  [
    '570.23(a)의 공시 부족 보고와 705.5(a)(iii), .8, .9를 대조했다. 2026 L32138~32191의 알려진 전반적 왜곡과 가능한 전반적 영향이 서로 다른 의견을 직접 지지한다.',
    '가는 충분한 증거로 확인한 불확실성의 근본적 공시 누락이라 부적정, 나는 자산 대부분·주요 부채에 영향을 줄 수 있는 증거 부족이라 의견거절이다. 증거 부족을 파산 확정이나 전제 부적합으로 바꾸지 않는다.',
    '두 상황의 의견과 이유를 비교하는 목적이며 공시왜곡/증거부족 및 영향 범위를 발문이 명시한다. 보고서 전체 문구·통지를 제외하고 각 상황을 2문장으로 완성할 수 있다.',
    '유지 4점: 상황별 의견과 이유를 1점씩 구별한다. 두 독립 상황을 나란히 둔 것은 의견 원인 비교라는 하나의 목적을 위한 것이며 여러 후속 절차를 함께 묻지 않는다. 반대 의견도 독립적으로 올바른 원인 근거를 지우지 않는다.',
    'fact3·fact4를 함께 읽어 가의 증거확보와 실제 공시를 확인하고, 독립된 나의 증거미확보·영향 범위를 구별한다. 공통 계속기업 일반론만으로 두 의견을 정할 수 없다.',
    '12의 계속기업 공시와 15의 의견변형 원인·전반성에 직접 대응한다. 최종 design의 fact3·fact4 연결이 같은 정보 의존성을 반영한다.',
    '2026 570·705 전문과 직접 대조했다. 705 제목의 PDF None은 기존 등록 전사 표기로 정정되었고, 실제 2026 705.5는 PDF770, .8/.9는 PDF771임을 design과 함께 확인했다.',
    'draft-12-570-freq01/q2가 요구하지 않는 전반성 구별을 실제 공시와 자산·부채 범위로 판단한다. A sub2와는 공시 보완 대 의견형성의 다른 목표라 구체 누락 항목의 반복 배점을 하지 않는다.'
  ]
];
const names=['source','answer','prompt','points','style','topics','edition','nonduplication'];
const reviews=[]; let n=0;
for(const s of sets){
  const p=plans.find(x=>x.set_id===s.id);
  if(p.source_catalog_sha256!==hash(D+'source-catalog-final.json'))throw Error('catalog hash');
  for(const q of s.subquestions){
    const row=commentRows[n++], cases=qa.filter(x=>x.set_id===s.id&&x.subquestion_id===q.id);
    const refs=[...new Set(q.criteria.flatMap(c=>c.source_ref_ids))];
    const sourceChecks=refs.map(id=>{
      const ref=s.source_refs.find(x=>x.id===id), unit=catalog.units.find(x=>x.id===id);
      if(!ref||!unit||!fs.readFileSync(ref.file,'utf8').includes(ref.source_quote)||digest(ref.source_quote)!==ref.content_hash)throw Error('source '+id);
      if(!p.plan.source_unit_ids.includes(id))throw Error('plan missing '+id);
      return {source_ref_id:id,file:ref.file,file_sha256:hash(ref.file),quote_sha256:digest(ref.source_quote),exact_quote_in_file:true,registered_unit_found:true,source_span:ref.title};
    });
    for(const c of cases){const points=q.criteria.filter(x=>c.met_criterion_ids.includes(x.id)).reduce((v,x)=>v+x.max_points,0);if(points!==c.expected_points||c.kind==='wrong'&&points!==0)throw Error('QA '+s.id+'/'+q.id);}
    if(cases.length!==2||q.criteria.some(c=>c.max_points!==1))throw Error('shape');
    reviews.push({set_id:s.id,subquestion_id:q.id,reviewer_id:'agent:/root/next_cases_late',method:'independent_agent_content_review',checks:Object.fromEntries(names.map(x=>[x,'pass'])),check_rationales:Object.fromEntries(names.map((x,i)=>[x,row[i]])),max_points:q.criteria.length,criterion_ids:q.criteria.map(x=>x.id),fact_ids:p.fact_question_map.find(x=>x.subquestion_id===q.id).fact_ids,question_style:q.question_style,topic_ids:q.topic_ids,source_checks:sourceChecks,representative_expectations:cases.map(x=>({...x,semantic_verdict:'pass'})),blank_answer_expected_points:0,full_model_answer_expected_points:q.criteria.length,unresolved_items:[]});
  }
}
const sourcePaths=[...new Set(sets.flatMap(s=>s.source_refs.map(r=>r.file)))];
const comparedIds=[...new Set(plans.flatMap(p=>p.compared_existing_sets.map(s=>s.set_id)))];
const officialRanges=plans.flatMap(p=>p.official_edition_comparison.ranges.map(r=>({...r,set_id:p.set_id})));
officialRanges.push(...[
 [16882,16885,'KGA500.3 2026 시행일'],[17712,17715,'KGA501.2 2026 시행일'],[17786,17810,'KGA501.10~11 직접 교신·전면 금지 및 증거 부족 경계'],[18187,18190,'KGA505.4 2026 시행일'],[24245,24259,'KGA570.8 2026 시행일 및 별도 적용항목']
].map(([start_line,end_line,locator])=>({start_line,end_line,locator})));
const boundary={set_id:sets[1].id,subquestion_id:'sub3',answer:'경영진과 법률고문의 전망이 다르므로 예상 소송 결과를 직접 논의하기 위한 회합을 고려한다.',expected_points:2,met_criterion_ids:['sub3.c1','sub3.c2'],reason:'의견 불일치라는 하나의 충분한 사례 사유를 목적에 연결하며 회합 고려 판단도 함축한다. 복잡성까지 별도로 적을 필요는 없다.',execution:'not_run; independently reasoned content boundary'};
if(!sets[1].subquestions[2].criteria[1].claim.includes('모두 필수로 요구하지'))throw Error('A24 correction absent');
if(sets.some(s=>s.source_refs.some(r=>r.title.includes('None'))))throw Error('page correction absent');
if(hash(D+'a/sets.json')!==expected)throw Error('A changed during review');
const result={version:1,reviewed_at:new Date().toISOString(),reviewer_id:'agent:/root/next_cases_late',method:'independent_agent_content_review',scope:'A 3세트의 9물음 전수 독립 내용 교차검토. 작성 담당자의 검수 판정을 복사하지 않고 최종 사실·발문·답안·criterion, 2026 기준본문 및 기출·모의 원발문·해설을 대조하였다.',human_review_performed:false,model_api_review_performed:false,actual_model_grading:'not_run; parent batch responsibility',hashes,bank_sha256:hash(D+'bank-before.json'),source_catalog_sha256:hash(D+'source-catalog-final.json'),official_source:{file:sourceFile,sha256:hash(sourceFile),read_method:'2026 전문 전사에서 아래 본문·적용자료 및 시행일을 직접 읽어 기존 등록 인용과 비교. 본 교차검토는 PDF 렌더 자체의 별도 재검사를 뜻하지 않음.',ranges:officialRanges},source_files:sourcePaths.map(file=>({file,sha256:hash(file)})),compared_existing_sets:comparedIds.map(id=>({set_id:id,content_sha256:digest(JSON.stringify(bank.find(s=>s.id===id)))})),learning_source_read_ranges:[{file:'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',ranges:[[17582,17611],[17795,17840]],context:'2017 실제시험 물음4 원발문 및 해설; PDF446/451'}, {file:'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md',ranges:[[4126,4159],[4195,4246],[6398,6409],[6460,6484]],context:'2024 제2회 GS 문제4 및 2025 제1회 GS 문제5 원발문·해설; 실제시험 빈도와 합산하지 않음'}],resolved_findings:[{id:'A24-alternative-grounds',issue:'법률 sub3.c2의 및 표현이 두 사유 모두를 필수로 읽히게 함',resolution:'또는, 모두 필수로 요구하지 않는다는 최종 criterion을 확인',status:'resolved'},{id:'705-page-none',issue:'705.5/8/9 출처 title에 PDF None이 표시됨',resolution:'기존 등록 전사와 실제 행으로 정정, 2026 정확한 쪽은 design에 보존',status:'resolved'}],additional_boundary_expectations:[boundary],reviews,summary:{sets:3,subquestions:9,checks_per_question:8,total_points:reviews.reduce((t,r)=>t+r.max_points,0),representative_answers_reviewed:18,checks_passed:72,unresolved_content_findings:0,verdict:'pass'},unresolved_items:[],limits:['실제 Luna 채점은 이 독립 검토에서 호출하지 않았으며 별도 상위 배치에서 수행한다.','기출·모의·연습의 미출제 여부를 빈도 0이나 미연결만으로 단정하지 않는다.','게시·정본 변경·DB 반영·사람 검수를 이 문서로 완료 처리하지 않는다.']};
fs.writeFileSync(D+'a-peer-review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({file:D+'a-peer-review.json',sha256:hash(D+'a-peer-review.json'),summary:result.summary,sets_sha256:hashes.sets},null,2));
