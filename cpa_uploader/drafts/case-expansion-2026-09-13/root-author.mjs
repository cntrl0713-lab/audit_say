import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const catalog=JSON.parse(fs.readFileSync(D+'/source-catalog.json'));
const bank=JSON.parse(fs.readFileSync(D+'/bank-before.json'));
const out=D+'/root';fs.mkdirSync(out,{recursive:true});
const get=id=>{const u=catalog.units.find(u=>u.id===id);assert(u,id);return u;};
const ref=id=>{const u=get(id);return{id:u.id,file:u.file,title:u.title+' 문단 '+u.paragraph,page:u.standard,source_quote:u.quote,content_hash:createHash('sha256').update(u.quote).digest('hex'),role:'standard',source_span:`${u.file} L${u.startLine}–L${u.endLine}; 문단 ${u.paragraph}; ${u.page==null?'PDF 쪽수는 원 등록에 미기록':`PDF ${u.page}쪽`}`};};
const units={override:'src-1b715c89d513066f1f',procedures:'src-0f694d630bc4ad46c3',undisclosed:'src-22db8d82c8137cc21d',contract:'src-156f65591335b4c1ac',arm:'src-24814cd1f5353b0386',terms:'src-c95a547d765e6b17bf'};
let serial=0;
function q(id,topic,type,prompt,models,claims,sourceIds){
 const requirements=sourceIds.map((s,i)=>({id:`req-${id}-${i+1}`,source_ref_id:s,source_quote:get(s).quote,source_span:`${get(s).file} L${get(s).startLine}–L${get(s).endLine}; 원문 직접 인용`}));
 return{id,type,question_style:'case',topic_ids:[topic],prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},model_answer:models,requirements,criteria:claims.map((claim,i)=>({id:`crit-${id}-${i+1}`,requirement_id:requirements[0].id,claim,critical_facts:[{id:`cf-${++serial}`,type:'action',expected:claim}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:sourceIds}))};
}
function make(id,topic,title,facts,questions){
 const template=bank.find(s=>s.classification.topic_id===topic);
 return{schema_version:'3.0',id,type:'linked_question_set',status:'needs_review',title,classification:{...template.classification,standards:[topic==='05'?'KGA 240':'KGA 550'],tags:topic==='05'?['통제무력화','분개','추정치 편의']:['특수관계자','미공개 거래','정상거래조건']},source_refs:[...new Set(questions.flatMap(q=>q.requirements.map(r=>r.source_ref_id)))].map(ref),shared_context:{facts:facts.map((text,i)=>({id:`fact${i+1}`,text,scoreable:false}))},learning_order:questions.map(q=>q.id),subquestions:questions,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:['2026-09-13 사용자 요청에 따른 신규 사례 초안. 기출·고급회계감사연습의 요구를 참고하되 사실관계는 새로 구성하고 공식 기준서 원문으로 정답을 확인함. agent 의미검수·실제 채점·게시 상태는 별도 실행 증거로 관리.']}};
}
const fraud=make('case-05-management-override-20260913','05','특별 권한 분개와 낙관적인 추정치에 대한 대응',[
 '한빛회사의 당기 재무제표를 감사하는 업무팀은 구매·매출의 정상 승인통제에 대한 운영효과성 테스트에서 이탈을 발견하지 못했다. 그러나 재무담당이사는 일반 직원과 달리 승인자를 거치지 않고 분개를 입력하는 특별 계정을 보유하고 있다. 업무팀원은 정상 거래의 통제가 효과적이므로 이 특별 계정과 관련한 부정위험도 낮게 평가하여 유의적 위험에서 제외하자고 제안했다.',
 '특별 계정의 사용기록에는 3월·6월·9월 말과 12월 말에 수동으로 입력한 매출 조정이 있다. 12월의 일부 분개에는 작성자의 설명이 비어 있고, 결산 담당자는 재무담당이사가 별도로 보낸 파일을 보고 입력했다고 말했다. 업무팀원은 12월 말에 자동 생성된 정규분개만 추출하여 증빙을 확인하고 특별 계정의 수동 조정분개는 제외하려 한다. 결산 담당자에게 추가 질문을 하거나 다른 분기의 조정을 검토할 필요도 없다고 생각한다.',
 '회사는 당기에 대손률, 반품률 및 제품보증비율을 모두 낮췄다. 각 추정치는 개별적으로 가능한 범위 안에 있으나 세 변경 모두 당기이익을 높이는 방향이다. 전기에 유의적이었던 제품보증 추정액은 당기 실제 지출액보다 상당히 작았고, 당시 추정에 사용한 고장률 자료와 판단 근거도 보관되어 있다. 업무팀원은 당기 추정치가 각각 합리적인 범위에 있다는 이유로 편의 검토를 종료하고 전기 판단은 다시 살펴보지 않으려 한다.'
],[
 q('sub1','05','judgment','정상 승인통제의 테스트 결과를 근거로 특별 계정에 관한 경영진의 통제무력화 위험을 유의적 위험에서 제외하려는 제안을 평가하고, 사례의 권한 구조와 연결하여 이유를 서술하시오.',[
 '제안은 적절하지 않으며 경영진의 통제무력화로 인한 부정위험을 유의적 위험으로 다루어야 한다.',
 '재무담당이사는 정상 승인통제를 우회하여 분개를 입력할 수 있다. 정상 거래 통제가 효과적이어도 이를 무력화할 수 있는 경영진의 독특한 지위와 예측 불가능한 방식의 위험은 남는다.'
 ],['특별 계정의 통제무력화 위험을 유의적 위험에서 제외하는 제안을 부적절하다고 판단하거나 유의적 위험으로 다루어야 한다고 제시한다. 근거가 이 결론을 명확히 함축하면 인정하되 명시적 반대 결론은 인정하지 않는다.','재무담당이사가 승인 없이 분개하는 특별 권한 때문에 정상 통제의 효과성과 관계없이 통제를 우회할 수 있고 그 방법을 예측하기 어렵다는 이유를 설명한다. 사례 권한과 연결하지 않은 일반론만으로는 인정하지 않는다.'],[units.override]),
 q('sub2','05','descriptive','업무팀원의 분개 테스트 계획을 보완하시오. 이 사례에서 필요한 추가 질문, 보고기간말의 추출 대상, 보고기간 전체로 테스트를 확대할 필요성에 관한 검토를 각각 구체적으로 서술하시오.',[
 '결산 담당자 등 재무보고절차 관여자에게 재무담당이사의 별도 파일과 설명 없는 분개의 처리 과정에서 부적합하거나 비경상적인 행위가 있었는지 질문한다.',
 '12월 말에 특별 계정으로 입력한 매출 조정 등 보고기간말 분개와 기타 조정사항을 추출하여 테스트한다.',
 '3월·6월·9월에도 같은 특별 계정의 매출 조정이 있으므로 12월만으로 범위를 확정하지 말고 보고기간 전체의 분개·조정사항을 테스트할 필요가 있는지 고려한다.'
 ],['결산 담당자 등 관여자에게 별도 파일·설명 없는 특별 계정 분개의 부적합하거나 비경상적인 처리 여부를 질문한다.','12월 말 특별 계정 매출 조정 등 사례의 보고기간말 분개·조정사항을 추출하여 테스트한다.','3·6·9월에도 특별 계정 조정이 있다는 사실을 근거로 보고기간 전체의 분개·조정사항을 테스트할 필요성을 고려한다. 전 기간의 모든 분개를 무조건 전수검사한다는 요구로 한정하지 않는다.'],[units.procedures]),
 q('sub3','05','descriptive','대손률·반품률·제품보증비율의 변경에 대한 편의 검토를 어떻게 보완해야 하는지 서술하시오. 당기 판단들의 방향과 부정위험에 대한 평가, 편의 가능성이 나타난 경우의 대응, 전기 제품보증 추정에 관한 재검토를 구분하시오.',[
 '각 추정치가 가능한 범위에 있어도 세 변경이 모두 이익을 높이는 방향이라는 점을 함께 보아 경영진의 편의 가능성과 그 환경이 부정으로 인한 중요왜곡표시위험을 나타내는지 평가한다.',
 '그러한 편의 가능성이 나타나면 회계추정치를 전반적으로 다시 평가한다.',
 '전기 제품보증 추정과 실제 지출의 차이를 고려하여 전기 유의적 추정에 쓰인 고장률 및 경영진의 판단·가정을 소급하여 재검토한다. 당기 결과만으로 전기 판단을 자동으로 오류라고 단정하지 않는다.'
 ],['대손률·반품률·제품보증비율이 모두 이익을 높이는 방향임을 함께 보아, 개별적 합리성과 별개로 편의 가능성 및 부정 중요왜곡표시위험을 평가한다.','사례에서 그러한 편의 가능성이 나타나면 회계추정치를 전반적으로 다시 평가한다.','전기 제품보증 추정과 실제 지출 차이에 연결하여 전기의 유의적 추정에 쓰인 고장률 등 판단·가정을 소급하여 재검토한다.'],[units.procedures])
]);
const related=make('case-11-undisclosed-related-party-20260913','11','누락된 특수관계자 보증과 정상거래조건 주장',[
 '새움회사의 재무보고체계는 특수관계자와 그 거래의 공시를 요구한다. 경영진은 감사인에게 특수관계자 명단을 제출했으나, 은행조회 회신에서 명단에 없는 다온회사의 차입금에 대한 새움회사의 중요한 지급보증이 발견되었다. 감사인은 주주명부와 관계 자료를 추가 확인하여 다온회사가 해당 체계상 특수관계자라는 사실을 확정했다. 이 발견은 아직 다른 업무팀원에게 전달되지 않았다. 경영진은 보증 외에는 거래가 없다고 말했으며, 회사는 매년 담당 임원의 신고서만 취합해 명단을 관리해 왔다.',
 '회사는 금융업을 하지 않으며 이 보증은 정상 영업과정을 벗어난 유의적 거래이다. 경영진은 보증료를 받는 통상적인 거래라서 회사에도 이익이 있다고 설명했다. 감사인이 입수한 계약서 초안에는 보증료가 없는 것으로 되어 있고, 재무담당 임원의 서명만 있다. 업무팀은 최종 계약조건, 거래의 사업상 이유 및 회사 내 필요한 승인 여부에 관한 증거를 아직 확보하지 않았다.',
 '한편 기존에 식별한 다른 특수관계자에 대한 대여금에 대해 경영진은 재무제표 주석에 독립 당사자 간 정상거래조건과 동일하다고 기재했다. 근거로 제시한 자료는 은행의 연 4% 금리표뿐이다. 회사의 대여금도 연 4%이지만 무담보 5년 만기 일시상환이고, 금리표는 담보를 제공하는 1년 만기 대출에 적용된다. 업무팀원은 이자율 숫자가 같으므로 정상거래조건이라는 주장에 충분한 증거가 있다고 판단했다.'
],[
 q('sub1','11','descriptive','다온회사가 미공개 특수관계자임을 확인한 직후, 업무팀 내 정보 공유와 경영진에 대한 추가 정보 요청·질문을 어떻게 해야 하는지 서술하시오. 후속 실증절차와 감사의견은 여기서 요구하지 않는다.',[
 '다온회사와 보증을 새로 식별한 정보를 다른 업무팀원에게 즉시 전달한다.',
 '경영진에게 다온회사와 이루어진 모든 거래를 식별하여 제공하도록 요청한다. 보증 외에는 없다는 설명만으로 범위를 확정하지 않는다.',
 '임원 신고서를 취합하는 통제가 다온회사와 보증을 식별하거나 공개하지 못한 이유를 경영진에게 질문한다.'
 ],['다온회사와 지급보증을 새로 식별한 정보를 다른 업무팀원에게 즉시 전달한다.','경영진에게 다온회사와의 모든 거래를 식별하여 제공하도록 요청한다.','임원 신고서 중심의 기존 통제가 다온회사·보증을 식별하거나 공개하지 못한 이유를 경영진에게 질문한다.'],[units.undisclosed]),
 q('sub2','11','descriptive','정상 영업과정을 벗어난 지급보증에 관하여, 계약 검사를 통한 사업상 이유의 평가, 경영진 설명과 계약조건의 일치 여부, 승인에 관한 감사증거의 세 측면에서 필요한 절차를 사례와 연결하여 서술하시오.',[
 '보증 계약을 검사하여 금융업을 하지 않는 회사가 다온회사 차입금을 보증하는 사업상 이유 또는 그 결여가 부정한 재무보고나 자산횡령 은폐를 시사하는지 평가한다.',
 '최종 보증 계약조건을 확인하여 보증료를 받는다는 경영진의 설명과 보증료가 없는 초안 사이의 불일치를 조사한다.',
 '재무담당 임원의 서명만으로 적절한 승인이라고 단정하지 않고, 회사의 승인 권한에 따라 보증이 적합하게 인가·승인되었다는 감사증거를 입수한다.'
 ],['다온회사 지급보증 계약을 검사하여 사업상 이유 또는 그 결여가 부정한 재무보고나 자산횡령 은폐를 시사하는지 평가한다.','보증료를 받는다는 설명과 초안의 무보수 조건을 대조하고 최종 계약조건이 경영진 설명과 일치하는지 평가한다.','재무담당 임원의 서명만으로 충분하다고 단정하지 않고 해당 보증에 대한 적합한 인가·승인의 증거를 입수한다.'],[units.contract]),
 q('sub3','11','judgment','대여금의 정상거래조건 주장에 충분한 증거가 있다는 업무팀원의 판단을 평가하고, 제시된 비교자료에서 어떤 거래조건을 추가로 검토해야 하는지 이유와 함께 서술하시오.',[
 '이자율이 같다는 금리표만으로 정상거래조건 주장에 충분하고 적합한 감사증거를 입수했다고 볼 수 없다.',
 '회사의 무담보·5년 만기 일시상환 조건과 은행의 담보부·1년 만기 조건이 다르므로 담보, 신용위험, 만기·상환조건 등을 비교하여 동일한 조건이라는 주장까지 뒷받침할 증거를 입수해야 한다.'
 ],['같은 4% 금리표만으로 정상거래조건 주장을 뒷받침하기에 충분하다는 판단을 부적절하다고 판단한다. 추가 증거가 필요하다는 근거가 결론을 명확히 함축하면 인정한다. 명시적 반대 결론에는 점수를 주지 않는다.','무담보 5년과 담보부 1년이라는 차이를 연결해 담보·신용위험·만기·상환조건 등 금리 외의 거래조건을 비교·검토하여 주장에 대한 증거를 입수해야 함을 설명한다.'],[units.arm,units.terms])
]);
const sets=[fraud,related];
const references=[['src-136c133b38f8844f95','src-08f220e3e3964d5e40','src-77779b6f06b9fd9e36','src-8d4b10c3f9e8ea2dbd','src-0ed1cb0ce2576d414a'],['src-355ccaed90b86691f8','src-e851232ffe83bb6ffd','src-0dc5f3097ae46e8a0a','src-b477090651417dbdcc','src-df70b961045429234a']];
const design=sets.map((s,i)=>({set_id:s.id,plan:{version:1,topic_id:s.classification.topic_id,mode:'new_from_standard',objective:s.title,scope:{actors:['재무제표 감사인과 사례에 명시된 경영진·업무팀원'],timing:['당기 재무제표 감사 수행 중'],conditions:[s.shared_context.facts.map(f=>f.text).join('\n')],exceptions:[i===0?'정상 통제가 효과적이어도 통제무력화 대응을 생략하는 예외는 없음. 개별적으로 합리적인 추정도 전체의 편의 검토 대상.':'특수관계자 공시 요구가 있는 재무보고체계를 전제로 함. 정상거래조건이라는 주장은 재무제표에 기재된 상태.'],required_answers:s.subquestions.map(q=>q.prompt),exclusions:[i===0?'감사의견·경영진 부정 확정·전기 오류의 자동 판정은 요구하지 않음.':'관계의 회계기준상 정의, 후속 실증절차 전체 목록 및 감사의견은 요구하지 않음. 지급보증 물음은 세 측면으로 범위를 한정하고 회계처리·공시 검사는 별도 점수를 주지 않음.']},question_types:[...new Set(s.subquestions.map(q=>q.type))],source_unit_ids:[...s.source_refs.map(r=>r.id),...references[i]],existing_question_difference:i===0?'pilot-05-002·05-006·05-009의 일반론을 특별 계정의 분기별 분개와 동일 방향의 추정 변경·전기 결과에 적용하는 심화 사례로 신규 구성. 같은 지식의 의도된 적용 연습이며 미출제 주장 없음.':'기존 주제11 기준서형 요구를 미공개 보증 발견→계약 검토→가격 외 조건 비교에 적용하는 사례. 2018년 문제6 물음3은 직접 대응, 고급 2023 제2회 GS 문제4 물음3의 정상거래조건 절차는 인접 요구로 참고하고 동일 출제로 집계하지 않음.',edition_assumption:'공식 2025 전문의 해당 KGA 240·550 원문과 로컬 보존 2026년 7월 전문의 해당 요구 문단을 직접 대조. 여기에서 사용한 규정의 의미가 같음을 확인하며 특정 2027 시험 적용 가정은 두지 않음.',unresolved_items:[],status:'ready'},source_evidence:[...s.source_refs.map(r=>r.id),...references[i]].map(id=>{const u=get(id);return{source_unit_id:id,file:u.file,page:u.page,start_line:u.startLine,end_line:u.endLine,quote_sha256:createHash('sha256').update(u.quote).digest('hex'),role:s.source_refs.some(r=>r.id===id)?'direct_official_answer_basis':'past_or_advanced_question_and_answer_read',catalog_fingerprint:catalog.fingerprint};}),fact_links:s.subquestions.map((q,j)=>({subquestion_id:q.id,fact_ids:[`fact${j+1}`],reason:'해당 사실의 제안·증거 또는 거래조건을 평가·보완해야 하며 일반론만으로 사례 적용 점수를 모두 얻을 수 없음.'}))}));
const review=sets.flatMap(s=>s.subquestions.map(q=>({set_id:s.id,subquestion_id:q.id,reviewer_id:'Codex root author',question_style:'case',topic_ids:q.topic_ids,rationale:`${q.prompt} 모범답안과 ${q.criteria.length}개 독립 기준을 직접 대조함. ${q.criteria.map(c=>c.claim).join(' ')} 최소 충분 답안은 저장 모범답안이며 독립 의미별 정수 1점으로 부분답안을 합산. 비교대상 기존 기준서형과 동일한 의미 단위당 1점 원칙을 유지하고 사례 적용 때문에 문장 수로 점수를 늘리지 않음. 한 물음은 한 판단 또는 명시된 하나의 절차 묶음으로 제한. 질문별 사실 연결과 직접 공식 원문 요구를 확인함.`,point_decision:'신규 독립 의미 단위별 1점',unresolved_content_findings:[]})));
const qa=sets.flatMap(s=>s.subquestions.flatMap(q=>[{set_id:s.id,subquestion_id:q.id,kind:'partial',answer:q.model_answer[0],expected_points:1,met_criterion_ids:[q.criteria[0].id],reason:'첫 독립 판단/절차만 충족. 후속 근거·다른 절차는 답안에 없으며 첫 문장이 나머지를 함축하지 않음을 확인.'},{set_id:s.id,subquestion_id:q.id,kind:'wrong',answer:s.id===fraud.id?(q.id==='sub1'?'정상 통제에서 이탈이 없으므로 특별 계정의 통제무력화 위험은 유의적 위험에서 제외한다.':q.id==='sub2'?'별도 파일을 그대로 신뢰하고 특별 계정 분개는 기간말에도 추출하지 않으며 담당자 질문이나 다른 분기 검토는 모두 생략한다.':'각 추정치가 개별적으로 가능한 범위에 있으면 전체의 방향과 관계없이 검토를 종료하며 전기 판단은 당기 감사에서 재검토할 필요가 없다.'):(q.id==='sub1'?'경영진이 보증 외 거래는 없다고 말했으므로 추가 요청과 통제 질문은 생략하고 다른 팀원에게도 알리지 않는다.':q.id==='sub2'?'임원 서명이 있으므로 보증료 설명을 그대로 믿고 계약의 사업상 이유와 조건 및 승인 근거를 검토하지 않는다.':'이자율이 4%로 같으므로 충분한 증거가 있다. 담보와 만기의 차이는 정상거래조건 평가에서 검토할 필요가 없다.'),expected_points:0,met_criterion_ids:[],reason:'각 요구와 반대되는 결론/절차 생략을 명시하며 독립적으로 맞는 근거가 없는 답안.'}]));
for(const s of sets){assert([...s.shared_context.facts.map(f=>f.text).join('\n')].length>=400);assert(!bank.some(b=>b.id===s.id));}
for(const [file,v] of Object.entries({'sets.json':sets,'design.json':design,'review.json':review,'qa.json':qa}))fs.writeFileSync(out+'/'+file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
console.log(sets.map(s=>({id:s.id,facts_chars:[...s.shared_context.facts.map(f=>f.text).join('\n')].length,questions:s.subquestions.length,points:s.subquestions.reduce((n,q)=>n+q.criteria.length,0)})));
