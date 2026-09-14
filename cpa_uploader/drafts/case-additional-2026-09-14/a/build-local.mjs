import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const D = 'cpa_uploader/drafts/case-additional-2026-09-14';
const out = `${D}/a/local`;
fs.mkdirSync(out, {recursive:true});
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const catalog = read(`${D}/source-catalog.json`);
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=read(bankFile);
const unit = id => {const u=catalog.units.find(u=>u.id===id);assert(u,id);return u;};
const source = (id, stop) => {
  const u=unit(id);assert.equal(u.authority,'official_transcription');
  const quote=(stop ? u.quote.slice(0,u.quote.indexOf(stop)) : u.quote).trimEnd();
  assert(quote && fs.readFileSync(u.file,'utf8').includes(quote));
  return {id,file:u.file,title:`${u.standard}: 공식 전문 문단 ${u.paragraph}`,page:u.standard,
    source_quote:quote,role:'standard',content_hash:hash(quote),
    source_span:`${u.locator}; 인용은 본문에 한정; 원자료 단위 ${id}`};
};
const refs={
  change:source('src-b964d8900e0497fc84'),
  lower:source('src-f00b4bd53d5bce0806','\r\n\r\n## PDF'),
  record:source('src-c0fa86a6f2b3fc69f8','\r\n\r\n## PDF'),
  reason:source('src-6511813449e64bf2f4','\r\n\r\n## PDF'),
  avoidance:source('src-f36e71f3e2c25186e5','검토 또는 관련 서비스로의 변경 요청'),
  reporting:source('src-4a6bcea8d9ef59ddd2','업무수임 때의 추가적인 고려사항'),
  refusal:source('src-32f27450c2d0f4b4a2','\n\n### PDF'),
  governance:source('src-ae9fdd747aceba7928','외부조회 절차의 결과'),
  positive:source('src-9df7a60acde69be92e','불일치사항'),
  necessary:source('src-d7c0dcd0f3e6fc9baf','불일치사항'),
};
function question(id,topic,prompt,answer,definitions){
  const used=[...new Set(definitions.flatMap(d=>d[1]))];
  const requirements=used.map((key,i)=>({id:`${id}.r${i+1}`,source_ref_id:refs[key].id,
    source_quote:refs[key].source_quote,source_span:refs[key].source_span}));
  return {id,type:'descriptive',question_style:'case',topic_ids:[topic],prompt,
    selection:{type:'all',n:null},constraints:{ordered:false,max_entries:null,overflow_policy:'none'},model_answer:answer,
    requirements,criteria:definitions.map(([claim,keys,type='action'],i)=>({id:`${id}.c${i+1}`,
      requirement_id:requirements.find(r=>r.source_ref_id===refs[keys[0]].id).id,claim,
      critical_facts:[{id:`${id}.c${i+1}.fact`,type,expected:claim}],max_points:1,
      scores:{met:1,not_met:0,contradicted:0},source_ref_ids:keys.map(k=>refs[k].id)}))};
}
function set(id,topic,title,texts,questions){
  const template=bank.find(s=>s.classification.topic_id===topic);
  const used=new Set(questions.flatMap(q=>q.criteria.flatMap(c=>c.source_ref_ids)));
  const source_refs=Object.values(refs).filter(r=>used.has(r.id));
  return {schema_version:'3.0',id,type:'linked_question_set',status:'needs_review',title,
    classification:{...template.classification,standards:[...new Set(source_refs.map(r=>r.page))],tags:topic==='03'?['업무조건 변경','검토보고서','합의된 절차']:['외부조회','경영진의 발송 거부','적극적 회신']},
    source_refs,shared_context:{facts:texts.map((text,i)=>({id:`fact${i+1}`,text,scoreable:false}))},
    learning_order:questions.map(q=>q.id),subquestions:questions,
    verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,
      notes:['2026-09-14 신규 사례형 제작. 기출·고급연습의 실제 발문과 해설을 읽고 새로운 사실 및 후속 판단으로 재구성하였다.',
      '2026년 1월 1일 개시 보고기간. 공식 2026 전문 해당 문단을 기존 등록 공식 2025 전사와 대조하여 동일함을 확인하였다. 학습자료의 옛 문단번호를 현행 공식 번호로 정정하여 근거를 연결하였다.',
      '작성자 agent 의미검수 기록은 a/review.json을 참조한다. 실제 모델 채점·사람 검수·정본 편입·게시 완료를 의미하지 않는다.']}};
}
const engagement=set('case-03-engagement-change-20260914','03','차입약정 변경 후 업무조건과 보고서 표현',[
  '다온회사는 2026년 재무제표에 관하여 채권은행의 대출약정 때문에 자발적으로 감사를 의뢰하였다. 이 사례에서는 법규상 감사의무가 없고, 해당 은행 외에 감사를 요구하는 이용자도 없다. 감사팀이 계약서와 입출금 자료를 검사하던 중 회사가 차입금을 모두 상환하였으며, 은행은 감사보고서 제출 조항을 해제한다는 서신을 감사인에게 직접 보냈다.',
  '회사는 정기적으로 재무정보를 받는 주주들이 검토보고서를 원한다는 의사록과 요청서를 제시하였다. 요청자료와 관계자에 대한 접근은 계속 제공되었고, 이미 실시한 매출채권 조회의 차이도 은행 입금자료와 거래처의 직접 회신으로 해소되었다. 경영진과 감사인은 새로운 검토업무의 범위와 책임 등에 구두로 합의했으나, 담당자는 종전 감사계약서의 파일명만 바꾸고 별도 합의 기록은 남기지 않으려 한다.',
  '검토업무를 수행한 후 작성할 보고서의 초안에는 “당초 본 회계법인이 연간 재무제표감사를 수임하였다”와 “그 감사에서 매출채권 외부조회를 실시하였다”라는 두 문구가 들어 있다. 담당자는 실제 있었던 일이고 이미 수행한 작업이므로 두 문구를 그대로 남기자고 한다.',
  '다음은 앞의 검토업무와 양립하지 않는 독립적인 대안이다. 같은 상황에서 회사와 주주들이 검토 대신 특정 매입증빙의 대조만 원하여, 감사인과 합의된 절차를 수행하는 업무로 적절히 변경하였다. 이미 수행한 세금계산서와 거래명세서의 금액 대조는 새로 합의한 절차 목록에도 포함된다. 보고서에는 당초 감사 수임 사실과, 해당 대조절차의 수행내용 및 발견사항을 각각 기재하려 한다.'
],[
  question('sub1','03','검토업무로 변경하려는 요청에 합리적 정당성이 있는지 판단하고, 차입약정과 실제 증거입수 상황을 연결하여 이유를 설명하시오. 이어 새 조건을 이미 구두로 합의한 상태에서 종전 계약서의 파일명만 바꾸려는 처리에 필요한 보완을 제시하시오.',[
    '변경 요청에는 합리적 정당성이 있다. 차입금 상환과 은행의 제출의무 해제로 감사의 필요성에 영향을 미치는 상황이 실제로 바뀌었고, 자료 접근과 조회 차이 해소 사실에 비추어 불충분한 감사정보를 피하려는 변경으로 보이지 않는다.',
    '구두로 합의한 새로운 검토업무 조건을 계약서 또는 기타 적절한 형태의 합의서에 기록해야 한다. 종전 감사계약서의 파일명 변경만으로는 그 기록을 대신할 수 없다.'
  ],[
    ['제시된 검토업무 변경 요청에는 합리적 정당성이 있다고 판단한다. 그 정당성을 명확히 설명한 이유도 판단을 함축할 수 있으나, 명시적 반대 결론에는 판단 점수를 주지 않는다.',['change','lower','reason'],'condition'],
    ['은행의 감사보고서 제출요구가 차입금 상환 후 실제로 해제된 상황 변화와, 정보 접근 및 조회 차이 해소를 연결하여 불만족스러운 감사정보 회피와 구별한다. 단순히 비용절감이나 경영진 요청만을 이유로 들면 부족하다.',['reason','avoidance'],'condition'],
    ['이미 합의한 새로운 검토업무 조건을 계약서 또는 기타 적절한 합의서에 기록한다. 파일명만 바꾸거나 구두 합의만 보존하는 것은 부족하다.',['record']],
  ]),
  question('sub2','03','검토보고서 초안의 두 문구를 각각 어떻게 처리해야 하는지 설명하고, 실제로 수행한 일을 보고서에 그대로 남길 수 없는 이유를 제시하시오. 변경일까지 입수한 증거의 내부적인 이용 가능성은 판단하지 마시오.',[
    '당초 연간 재무제표감사를 수임했다는 문구와 그 감사에서 매출채권 외부조회를 실시했다는 문구를 모두 제외한다.',
    '변경 후 보고서는 검토업무에 적합해야 하며, 당초 감사나 그 절차를 언급하면 독자가 제공된 업무와 확신 수준을 혼동할 수 있기 때문이다.'
  ],[
    ['검토보고서에서 당초 연간 재무제표감사를 수임했다는 언급을 제외한다.',['reporting']],
    ['검토보고서에서 당초 감사의 매출채권 외부조회 절차를 실시했다는 언급을 제외한다. 실제 실시했다는 이유로 유지하지 않는다.',['reporting']],
    ['변경 후 보고서는 검토업무에 적합해야 하며 당초 감사와 그 절차를 언급하면 독자가 업무의 성격 또는 제공되는 확신을 혼동할 수 있음을 이유로 설명한다. 단순히 규정에 따른다는 표현은 부족하다.',['reporting'],'condition'],
  ]),
  question('sub3','03','독립적인 대안인 합의된 절차 업무의 보고서에서 ① 당초 감사 수임 사실과 ② 세금계산서·거래명세서 대조절차의 수행내용을 각각 언급할 수 있는지 판단하고, 그 이유를 구별하여 설명하시오.',[
    '당초 감사 수임 사실은 언급하지 않는다. 합의된 절차 업무로 바뀌었어도 당초 감사 자체에 대한 언급은 독자의 혼란을 피하기 위해 제외해야 한다.',
    '세금계산서와 거래명세서의 대조절차 수행내용은 언급할 수 있다. 새로 합의한 절차에 포함된 수행내용을 보고하는 것은 합의된 절차 업무의 통상적인 보고에 해당하여 당초 감사절차 언급 금지의 예외가 적용되기 때문이다.'
  ],[
    ['합의된 절차 업무 보고서에서도 당초 감사 수임 사실에 대한 언급은 허용되지 않는다고 판단한다. 이유가 불허를 분명히 함축하면 판단도 인정하되 명시적 허용은 인정하지 않는다.',['reporting'],'condition'],
    ['당초 감사업무 자체의 언급은 변경 후 보고서 독자에게 업무 성격의 혼란을 줄 수 있으며, 합의된 절차의 예외는 그러한 감사 수임 사실에까지 확장되지 않음을 이유로 설명한다.',['reporting'],'condition'],
    ['제시된 세금계산서·거래명세서 대조절차의 수행내용에 대한 언급은 허용된다고 판단한다. 허용 이유가 결론을 명확히 함축하면 판단도 인정한다.',['reporting'],'condition'],
    ['그 대조가 새로 합의한 절차에 포함되며 수행내용을 보고하는 것이 합의된 절차 업무에서 통상적이라는 사실을, 당초 감사에서 수행한 절차 언급에 대한 예외와 연결한다. 단순히 과거 실제로 수행했기 때문이라는 이유는 부족하다.',['reporting'],'condition'],
  ]),
]);
const confirmation=set('case-09-confirmation-barrier-20260914','09','특별 판매약정의 조회 거부와 대체증거의 한계',[
  '한결회계법인은 라온회사의 2026년 재무제표를 감사하고 있다. 라온회사는 연말에 새 거래처와 체결한 특별 판매약정으로 거액의 매출과 매출채권을 기록하였다. 감사팀은 일반 판매계약과 다른 반품·대금지급 조건이 있는지 확인하려고 거래처에 적극적 조회를 계획하였다. 이 조건은 매출의 인식과 매출채권 회수권리를 판단하는 데 중요하다.',
  '재무담당이사는 “거래처가 잔액 확인을 싫어하므로 관계가 나빠질 것”이라며 발송을 거부했으나, 거래처의 항의나 조회 금지 요청을 보여 주는 문서는 제시하지 않았다. 감사팀은 연말 결산 직전 판매담당자와 재무담당이사가 동일한 관리자 계정으로 이 거래의 약정 요약파일을 여러 차례 바꾼 기록과, 담당자별 설명이 서로 다른 사실을 발견하였다.',
  '거래처는 최종 서명된 특별약정 원본을 보유하고 있지만 회사는 그 원본을 보관하지 않았다. 해당 약정의 조건을 확인할 다른 외부 기록도 없고, 회사의 요약파일에는 반품 및 지급 조건이 비어 있다. 팀원은 회사가 제시한 출고증과 일부 대금 입금내역이 있으므로, 거래처의 직접 확인 없이도 약정의 조건에 관한 증거가 충분하다고 제안하였다.',
  '그 후 감사팀은 출고증과 입금내역을 추가로 대조하였으나 특별약정의 조건을 확인하지 못했다. 재무담당이사는 처음의 설명을 반복하며 발송을 끝까지 허용하지 않았고 거래처의 적극적 회신도 입수하지 못하였다. 감사팀은 결론에 필요한 그 밖의 신뢰할 수 있는 증거를 확보하지 못한 채 업무 종결회의를 앞두고 있다. 지배기구에는 경영에 참여하지 않는 구성원이 있으며 커뮤니케이션을 금지하는 법규상 제한은 없다.'
],[
  question('sub1','09','발송 거부의 타당성·합리성을 확인하기 위해 보완할 증거입수와, 발견한 파일 변경기록 및 설명 불일치가 위험평가와 다른 감사절차에 미치는 시사점의 평가를 각각 사례에 맞게 설명하시오. 대체절차의 충분성이나 최종 의견은 여기서 요구하지 않는다.',[
    '조회가 거래관계에 문제를 일으킨다는 설명을 그대로 받아들이지 않고, 실제 거래처의 요청이나 관련 교신 등 거부사유의 타당성과 합리성을 뒷받침하는 감사증거를 구한다.',
    '관리자 계정의 공동 사용과 약정파일 변경·설명 불일치를 연결하여 공모나 통제무력화 등 관련 부정위험을 포함한 중요왜곡표시위험 평가에 대한 시사점을 평가한다.',
    '같은 내부 파일을 사용하는 다른 거래나 매출·매출채권에 대한 감사절차의 성격·시기·범위에 미치는 시사점을 평가한다. 회사 내부 문서에 의존한 절차를 유지할 수 있는지도 검토한다.'
  ],[
    ['거래관계 악화라는 발송 거부사유의 타당성과 합리성에 관하여 거래처의 요청·관련 교신 등 추가 감사증거를 구한다. 경영진의 설명을 기록하는 데 그치면 부족하다.',['refusal']],
    ['관리자 계정 공동 사용, 약정파일 변경 및 설명 불일치를 부정위험 등 관련 중요왜곡표시위험 평가에 대한 시사점과 연결한다. 단순히 위험이 있다는 명칭만 쓰면 부족하다.',['refusal'],'condition'],
    ['제시된 내부 정보의 신뢰성 의문 및 발송 거부가 관련 다른 감사절차의 성격·시기·범위에 미치는 시사점을 평가한다. 내부 약정파일에 의존하는 절차의 유지 여부 검토 등 사례에 맞는 설명을 인정한다.',['refusal']],
  ]),
  question('sub2','09','출고증과 일부 입금내역만으로 특별약정의 조건에 관한 증거를 충족할 수 있다는 제안을 평가하시오. 적극적 조회 회신의 필요성을 판단하고, 최종 약정의 보관 위치와 회사 자료의 생성·수정 상황을 각각 근거로 설명하시오.',[
    '제안은 부적절하며 특별약정의 조건을 확인하기 위한 적극적 조회 회신이 필요하다. 이 상황에서 출고증과 일부 입금내역은 그 회신에 필요한 증거를 대신하지 못한다.',
    '회사에 없는 최종 서명 약정의 조건은 거래처가 가진 원본 등 기업 외부에서만 확인할 수 있다.',
    '결산 직전 관리자 계정의 공동 사용·반복 수정과 상충하는 설명은 공모나 통제무력화의 위험을 시사하므로, 회사의 요약자료만으로 해당 조건을 신뢰하기 어렵다.'
  ],[
    ['이 상황에서는 특별약정 조건을 확인하는 적극적 조회 회신이 필요하다고 판단하며 출고증·일부 입금내역만으로 대체할 수 있다고 보지 않는다. 구체적 두 근거 중 하나가 그 필요성을 분명히 함축하면 판단을 인정하되, 명시적 대체 허용에는 인정하지 않는다.',['positive','necessary'],'condition'],
    ['최종 서명 약정은 거래처만 보관하며 다른 외부 기록도 없어, 관련 주장을 확인할 정보가 기업 외부에서만 입수 가능하다는 사실을 근거로 연결한다. 단순히 외부 증거는 신뢰성이 높다는 일반론은 부족하다.',['necessary'],'condition'],
    ['관리자 계정 공동 사용·반복적인 약정파일 수정과 서로 다른 설명을 공모나 통제무력화 등 특정 부정위험요소와 연결하여 회사 내부 증거를 신뢰하기 어렵다는 이유를 설명한다.',['necessary'],'condition'],
  ]),
  question('sub3','09','추가 확인 후에도 회신과 필요한 대체증거를 얻지 못한 후속 상황에서, 업무 종결 전에 필요한 커뮤니케이션과 해당 감사 및 감사의견에 관한 조치를 설명하시오. 구체적인 변형의견의 종류를 확정할 필요는 없다.',[
    '발송 거부와 관련 증거를 입수하지 못한 상황을 지배기구와 커뮤니케이션한다.',
    '특별약정에 관한 증거 공백이 해당 감사의 수행에 미치는 시사점을 결정한다.',
    '필요한 적극적 회신과 대체증거를 얻지 못했으므로 감사기준서 705에 따라 감사의견에 대한 시사점을 결정한다. 실제 왜곡표시를 확정하지 못했다는 이유만으로 적정의견으로 종결할 수 없다.'
  ],[
    ['추가절차로도 특별약정에 관한 관련성 있고 신뢰할 수 있는 증거를 얻지 못한 발송 거부 상황을 지배기구와 커뮤니케이션한다. 경영진에게만 통보하는 것은 부족하다.',['governance']],
    ['특별약정 조건에 관한 증거 공백과 적극적 회신 미입수가 해당 감사의 수행에 미치는 시사점을 결정한다. 감사의견의 종류만 제시하는 것으로는 별도의 감사 수행에 관한 판단을 충족하지 않는다.',['governance','positive']],
    ['필요한 회신과 대체증거를 얻지 못한 증거 부족을 근거로 감사기준서 705에 따른 감사의견의 시사점 또는 의견변형 필요성을 결정한다. 근거 없이 한정·거절 중 하나를 단정할 필요는 없으며, 왜곡표시가 확인되지 않았으니 적정이라고 하면 반대 의미이다.',['positive','governance']],
  ]),
]);
const sourceCompare=(id,comparison)=>{const u=unit(id);return {source_unit_id:id,file:u.file,locator:u.locator,
  file_sha256:hash(fs.readFileSync(u.file)),quote_sha256:u.contentHash,original_quote:u.quote,comparison};};
const source2026='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const designs=[
  {set:engagement,objective:'실제 정보수요 변화에 따른 업무변경 정당성과 합의기록을 판단하고, 변경 후 검토보고서와 합의된 절차 보고서의 감사 관련 표현을 구별한다.',
    difference:'pilot-03-006/sub1·exp1은 감사 성격의 오해/증거 부족 회피 및 변경 거부 뒤 원래 감사 차단의 해지·보고의무를 다룬다. 새 사례는 원인을 차입금 상환·은행 요구 해제로 바꾸고, 정당한 변경 이후의 합의기록 및 검토보고서 문구와 합의된 절차 예외를 구체 문안에 적용한다. pilot-03-003/sub2 및 현행 기준서형의 일반 조건 합의·기록 요구를 사례 적용으로 심화한다.',
    compared:['pilot-03-006','pilot-03-003','pilot-03-005'],
    exceptions:['검토업무와 합의된 절차 업무는 같은 회사에서 실제로 연속 수행되는 업무가 아니라 서로 양립하지 않는 독립 대안이다.','합의된 절차 보고서에서 통상적인 수행절차 언급은 예외지만, 당초 감사업무 자체 언급은 예외가 아니다.'],
    exclusions:['법규상 감사대상 여부, 차입 약정의 실제 법률해석, 검토기준/AUP 기준 전체, 검토 증거의 내부적 재사용 및 확신 문구 전체는 묻지 않는다.','새 조건은 이미 구두 합의된 사실이므로 합의 자체를 추가 점수로 반복하지 않는다.'],
    map:[['fact1',['sub1']],['fact2',['sub1']],['fact3',['sub2']],['fact4',['sub3']]],
    learning:[sourceCompare('src-a64feca907e456c351','2021년 문제8 물음1의 조회 차이 발생 뒤 검토로 변경하여 원래 감사를 차단한 사례를 대조하였다. 새 사례는 차이 해소 자료와 독립된 은행 서신을 제시하여 정보 부족 회피와 구별한다.'),
      sourceCompare('src-c4401b3265b9fd502a','2021년 문제8 물음1 해설의 투자자 요청 취소, 합리적인 상황 변화, 변경조건 기록 및 보고서 제외 문구를 읽었다. 의무 해지 요구는 기존 사례에 남기고 변경 이후의 문안 판단을 심화한다.'),
      sourceCompare('src-af9037255e01d0a94c','고급연습 23년 제1회 GS 문제3 물음1(p185)의 오해로 인한 검토변경, 수행절차와 보고서 제외내용의 발문을 대조하였다. 원문 한 물음의 다중요구를 정당성·기록/검토보고/합의된절차 대안의 3물음으로 구분하였다.'),
      sourceCompare('src-e0908986bf69beb7fe','고급연습 p187 답안의 새 조건 합의·기록과 당초 감사/감사절차 제외를 확인했다. 학습자료는 A34라고 표시하나 공식 2025·2026 전문의 직접 보고 근거는 A35이다. 소수 배점은 이식하지 않는다.')],
    editionLines:[{paragraph:'210.14–16',start_line:1400,end_line:1415,pages:[35,36]},{paragraph:'210.A31–A35',start_line:1824,end_line:1856,pages:[45,46]}],
    review:[
      '은행의 직접 서신·상환·거래처 직접 회신으로 오해나 불만족 정보 회피라는 기존 사례와 다른 변경 원인을 판단한다. 210.14·15/A32와16이 각각 판단/근거/기록을 지지한다. 이미 구두합의한 사실을 합의점수로 중복하지 않았다. 3점 중 결론만 맞는 1점과 기록만 맞는 1점이 독립적으로 가능하다.',
      '구체 초안의 감사 수임·외부조회 실시 두 문구는 210.A35(a)(b)의 제외 항목과 각각 대응하며, 혼동 방지가 별도 이유이다. 실제 실시 여부와 보고서 표시의 적합성은 별개이다. 두 삭제조치와 이유 3점이며 내부 증거 재사용은 발문에서 제외하여 범위를 한정했다.',
      '독립 대안에서 새 업무는 합의된 절차이고 대조는 그 합의 목록에 포함된다. 210.A35는 감사 자체를 말하는(a)를 예외로 하지 않고 (b)의 수행절차만 통상적인 보고에 예외를 둔다. 두 판단과 서로 다른 이유를 각1점으로 분리했다. 이유의 명백한 함축결론도 인정한다.'
    ],
    qa:[
      ['sub1','partial','변경 요청에는 합리적 정당성이 있다.',1,['sub1.c1'],'판단만 있으며 차입요구 해제와 정보입수 사실의 연결 및 합의기록 조치가 없다.'],
      ['sub1','wrong','감사를 시작한 뒤에는 사정이 달라져도 검토로 변경할 수 없다. 계약서의 파일명만 바꾸면 새 조건의 기록도 완료된다.',0,[],'정당한 변경 가능성과 합의 기록을 모두 반대로 서술한다.'],
      ['sub2','partial','검토보고서에서 당초 감사업무를 수임했다는 문구를 제외한다.',1,['sub2.c1'],'첫 문구 처리만 정확하며 외부조회 문구 처리와 혼동 방지 이유는 없다.'],
      ['sub2','wrong','실제로 수행한 일이므로 당초 감사 수임 사실과 외부조회 실시 문구를 모두 남겨야 한다. 독자는 이를 보면 검토와 감사를 혼동하지 않는다.',0,[],'두 제외사항과 혼동 방지 이유에 모두 반대된다.'],
      ['sub3','partial','당초 감사 수임 사실에 대한 언급은 허용되지 않는다.',1,['sub3.c1'],'첫 판단만 정확하며 그 이유와 대조절차 언급에 대한 판단·예외 근거는 없다.'],
      ['sub3','wrong','합의된 절차로 바꾸면 당초 감사를 수임했다는 사실은 자유롭게 기재한다. 반면 합의 목록에 포함된 증빙 대조라도 과거 감사에서 했던 절차이면 보고서에 언급할 수 없다.',0,[],'두 판단 모두 반대로 명시하고 독립적으로 옳은 이유도 없다.'],
    ]},
  {set:confirmation,objective:'경영진의 조회 발송 거부를 원인 증거·위험 시사점으로 평가하고, 적극적 회신이 필수인 증거 공백에서 대체절차와 감사종결의 한계를 판단한다.',
    difference:'pilot-09-003·004는 거부 시 일반 절차, pilot-09-005는 회신 신뢰성 의문·불신뢰의 대응, pilot-09-007은 조회 방법 관련 일반론이다. 현행 사례 pilot-07-008은 조회의 기준일·범위 수정이며 특별약정의 기업외부 정보 독점/공모 징후에 따른 회신 자체의 필수성을 묻지 않는다. 새 사례는 505.8의 일반 목록을 구체 사유·수정기록에 적용하고 13/A20의 두 조건과9의 종결 시사점을 연계한다.',
    compared:['pilot-09-003','pilot-09-004','pilot-09-005','pilot-09-007','pilot-07-008','case-05-management-override-20260913'],
    exceptions:['505.8의 일반 대체절차 수행과 505.13의 적극적 회신 자체가 필요한 상황을 구별한다. 출고·일부 입금은 실재성의 일부 증거일 수 있으나 본 사례가 묻는 특별약정 조건의 부족을 해소하지 못한다.','비합리적 거부와 적합한 대체증거 미입수는505.9의 대안 발동조건이다. 본 사례에서는 후자의 증거 공백이 실제로 확인된다.'],
    exclusions:['구체적인 한정의견/의견거절 중 하나의 확정, 개별 회계기준에 따른 매출인식 결론, 실제 불법행위·공모의 확정, 소극적 조회의 전체 요건 및 조회서 양식 전체는 요구하지 않는다.'],
    map:[['fact1',['sub1','sub2','sub3']],['fact2',['sub1','sub2']],['fact3',['sub2']],['fact4',['sub3']]],
    learning:[sourceCompare('src-80a120cf8dd7553698','2023년 문제2 물음4(p135)는 경영진 거부사유 질문·증거를 예시로 주고 위험평가/대체절차를 요구한다. 새 물음1은 사유 증거 미제시 및 공동 수정기록이라는 사실을 추가하여 증거확보와 두 시사점을 직접 적용한다.'),
      sourceCompare('src-00708988c49e37884f','2023년 같은 기출 p138 답안의 위험평가·다른 절차 시사점과 대체절차를 확인하였다. 해설의 단계 제목만 따라 대체절차를 무조건 충분하다고 보지 않는다.'),
      sourceCompare('src-d86e2825710dc2384e','고급연습 p55는 23년 제3회 GS 문제2의 시작 페이지로 확인했으며, 뒤 p56의 상황2와 물음3–5를 동일 원문에 연결한다.'),
      sourceCompare('src-b96973b29dd0a152ef','고급연습 p56의 고객 민감성을 이유로 한 발송 거부, 적극적 회신이 필요한 상황 및 조회서 설계 물음을 읽었다. 새 사례는 외부에만 있는 약정 원본과 의심스러운 회사 자료를 구체화하고 양식교정 요구는 제외하였다.'),
      sourceCompare('src-8c9464e9b0c9f8b1c9','고급연습 p58의505.9와A20 해설을 직접 대조하였다. 회신필수성을 추상적으로 열거시키는 대신 보관 위치/자료 수정 사실을 각각 판단 근거로 요구한다.')],
    editionLines:[{paragraph:'505.8–9',start_line:18240,end_line:18261,pages:[428,429]},{paragraph:'505.13',start_line:18277,end_line:18282,pages:[429]},{paragraph:'505.A20',start_line:18479,end_line:18487,pages:[434]}],
    review:[
      '505.8(a)의 타당성·합리성 증거확보와8(b)의 위험평가/다른절차 시사점이 회사 설명 미제시·동일계정수정·불일치라는 사실에 대응한다. 이미 알려준 CFO 설명을 다시 질문했다는 반복에는 점수를 주지 않는다. 3점은 추가증거/위험평가/다른절차로 분리하며 대체절차 충분성은 sub2에 맡긴다.',
      '505.13과A20 원문은 외부에서만 얻을 정보 및 특정 부정위험요소에 따른 기업증거 불신뢰를 회신 필요성의 예로 제시한다. 원본·기록상태와 공동 수정기록은 각각 두 이유를 구성한다. 양적 출고·입금자료로 약정의 조건을 충족했다는 주장은 부적합하다. 판단1점과 두 독립 이유 각1점, 이유가 결론을 명백히 함축할 때도 판단을 인정한다.',
      '추가절차 이후 특별약정 조건에 관한 증거를 확보하지 못했다는 후속 사실은505.9의 커뮤니케이션 및 감사/의견 시사점과13의 필요회신 미입수 조치에 직접 대응한다. 실제 왜곡표시 확정이나 특정 의견을 단정시키지 않는다. 지배기구/감사수행/의견형성의 세 명제를 각각1점으로 두며 일반적인 단어열거가 아닌 이 증거 공백에 대한 행위를 요구한다.'
    ],
    qa:[
      ['sub1','partial','관리자 계정의 공동 사용과 반복적인 파일 수정 및 설명 불일치를 공모나 통제무력화 등 부정위험을 포함한 중요왜곡표시위험 평가에 반영한다.',1,['sub1.c2'],'구체 사실에 관한 위험평가만 충족하고 거부사유 증거입수·다른 절차의 시사점은 쓰지 않았다.'],
      ['sub1','wrong','고객관계에 관한 경영진 설명은 항상 충분한 증거이므로 추가 확인할 필요가 없다. 파일 수정이나 설명 차이는 부정위험 평가와 다른 감사절차에 영향을 주지 않는다.',0,[],'증거입수와 두 시사점을 모두 부정한다.'],
      ['sub2','partial','이 특별약정의 조건을 확인하려면 적극적 조회 회신이 필요하다.',1,['sub2.c1'],'회신 필요성 판단만 명확하며 외부 원본 독점과 공모·통제무력화 징후의 독립 근거가 없다.'],
      ['sub2','wrong','출고증과 일부 입금내역만 있으면 최종 약정의 조건도 모두 확인된 것이므로 적극적 회신은 필요 없다. 약정 원본의 보관 위치와 요약파일 수정 경위는 증거 판단과 관계없다.',0,[],'대체 충분성을 명시하며 두 조건의 관련성도 부정한다.'],
      ['sub3','partial','조회 발송 거부와 그로 인한 특별약정 조건의 증거 공백을 지배기구와 커뮤니케이션한다.',1,['sub3.c1'],'커뮤니케이션만 충족하고 감사 수행이나 감사의견에 대한 후속 결정을 제시하지 않았다.'],
      ['sub3','wrong','지배기구에는 알릴 필요가 없고 감사 수행에 관한 추가 판단도 필요 없다. 실제 왜곡표시가 확인되지 않았으므로 적정의견으로 종결한다.',0,[],'지배기구 통지와 감사 시사점을 부정하고 증거 부족을 적정의견의 근거로 바꾸었다.'],
    ]}
];
const records=designs.map(d=>({set_id:d.set.id,plan:{version:1,topic_id:d.set.classification.topic_id,mode:'adapt_existing_question',objective:d.objective,
  scope:{actors:['사례에서 지정한 경영진·감사팀·거래처 및 지배기구'],timing:['2026년 1월1일 개시 보고기간의 감사 수행 중 및 업무변경 후 보고 단계'],
    conditions:d.set.shared_context.facts.map(f=>f.text),exceptions:d.exceptions,required_answers:d.set.subquestions.map(q=>`${q.id}: ${q.prompt}`),exclusions:d.exclusions},
  question_types:['descriptive'],source_unit_ids:[...new Set([...d.set.source_refs.map(r=>r.id),...d.learning.map(l=>l.source_unit_id)])],
  existing_question_difference:d.difference,edition_assumption:'2026년 개시 보고기간을 대상으로, 공식 2026 전문의 해당 문단을 아래 비교 위치에서 직접 읽고 기존 등록 공식 2025 전사와 동일함을 대조하였다. 기출·고급연습은 사례 설계 근거로만 사용하며 옛 교재의 문단번호·선택요구·소수 배점은 이식하지 않는다.',
  unresolved_items:[],status:'ready'},compared_existing_sets:d.compared.map(id=>{const s=bank.find(s=>s.id===id);assert(s,id);return {set_id:id,title:s.title,content_sha256:hash(JSON.stringify(s)),questions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,criterion_ids:q.criteria.map(c=>c.id)}))};}),
  bank_sha256:hash(fs.readFileSync(bankFile)),source_catalog_sha256:hash(fs.readFileSync(`${D}/source-catalog.json`)),
  facts_chars:Array.from(d.set.shared_context.facts.map(f=>f.text).join('\n')).length,
  fact_question_map:d.map.map(([fact_id,subquestion_ids])=>({fact_id,subquestion_ids})),learning_source_comparison:d.learning,
  official_edition_comparison:{file:source2026,sha256:hash(fs.readFileSync(source2026)),inspected:d.editionLines,method:'직접 문단·하위항목·조건 대조. 등록전사의 페이지 머리말·다음 절 소제목은 인용에서 제외하고 본문과 문단번호는 보존.'},
  new_case_points:d.set.subquestions.reduce((n,q)=>n+q.criteria.length,0)}));
const reviews=designs.flatMap(d=>d.set.subquestions.map((q,i)=>({set_id:d.set.id,subquestion_id:q.id,reviewer_id:'agent:/root/expand_a',
  rationale:d.review[i],point_decision:`${q.criteria.length}점: ${q.criteria.map(c=>c.id).join(', ')}에 독립 의미단위별 1점. 대표 부분답안은 실제 명제를 읽어 1점으로 판정했고 반대답안에는 독립적으로 맞는 근거가 없는지 확인했다.`,unresolved_content_findings:[]})));
const qa=designs.flatMap(d=>d.qa.map(([subquestion_id,kind,answer,expected_points,met_criterion_ids,reason])=>({set_id:d.set.id,subquestion_id,kind,answer,expected_points,met_criterion_ids,reason})));
const write=(name,value)=>fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2)+'\n');
write('sets',designs.map(d=>d.set));write('design',records);write('review',reviews);write('qa',qa);
write('source-evidence',designs.flatMap(d=>d.set.source_refs.map(r=>({set_id:d.set.id,source_ref_id:r.id,file:r.file,file_sha256:hash(fs.readFileSync(r.file)),quote_sha256:r.content_hash,quote:r.source_quote,source_unit_id:r.id,locator:r.source_span,verified:'direct_quote_read_and_exact_file_inclusion'}))));
for(const d of records)console.log(d.set_id,d.facts_chars,d.new_case_points);
