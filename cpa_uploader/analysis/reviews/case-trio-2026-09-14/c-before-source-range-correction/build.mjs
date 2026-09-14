import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash,sourceUnitHash} from '../../../analysis/coverage/build-coverage.mjs';
const D='cpa_uploader/drafts/case-trio-2026-09-14',C=D+'/c';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=v=>createHash('sha256').update(v).digest('hex');
const ref=f=>({file:f,sha256:hash(fs.readFileSync(f))});
const write=(name,data)=>fs.writeFileSync(C+'/'+name,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const bank=read(D+'/bank-before.json'),catalog=read(D+'/source-catalog.json');
const prior=bank.find(s=>s.id==='pilot-09-008'),nonresponse=bank.find(s=>s.id==='std-points-20260914-f5d37b0c8b8a');
const refs=[...['src50515head','src50515a','src50515b'].map(id=>structuredClone(prior.source_refs.find(s=>s.id===id))),structuredClone(nonresponse.source_refs[0])];
const locations=['KGA 505.15 본문; 2026 전문 PDF429, L18288~18291','KGA 505.15(a); 2026 전문 PDF430, L18300~18302','KGA 505.15(b); 2026 전문 PDF430, L18303~18305','KGA 505.A23; 2026 전문 PDF434~435, L18499~18500 및 L18510~18518'];
refs.forEach((r,i)=>{r.title=locations[i]+'; 기존 2025 등록 전사를 2026 공식 전문과 대조';r.source_span=locations[i]+'; 등록 전사: '+r.file;r.content_hash=hash(r.source_quote);assert(fs.readFileSync(r.file,'utf8').includes(r.source_quote));});
const pdfText='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt',lines=fs.readFileSync(pdfText,'utf8').split(/\r?\n/);
const cut=(a,b)=>lines.slice(a-1,b).join('\n'),norm=s=>s.replace(/\s/g,'');
const current=[cut(18288,18291),cut(18300,18302),cut(18303,18305),cut(18499,18500)+'\n'+cut(18510,18518)];
refs.forEach((r,i)=>assert.equal(norm(r.source_quote),norm(current[i]),'2026 body mismatch'));
const facts=[
 '나래회계법인은 가상의 한서은행의 2026년 12월 31일 재무제표를 감사한다. 감사팀은 예금부채 잔액에 대한 소극적 조회의 사용을 검토하고 있다. 다음의 개인예금 검토, 법인예금 검토, 무응답 증거 검토는 서로 독립적인 상황이며, 한 상황에서 입수한 통제증거를 다른 상황에 적용하지 않는다.',
 '개인예금 검토: 모집단은 같은 조건의 입출금예금 1만 4천 계좌이고 각 잔액은 10만~30만원이다. 팀원 갑은 관련 중요왜곡표시위험을 낮게 평가했고 불일치 발생률도 매우 낮을 것으로 예상하였다. 수신자가 조회요청을 무시할 상황은 알려진 바 없다. 감사팀은 시스템 설명서와 담당자 면담을 통해 관련 통제의 설계와 실행을 이해했지만, 그 통제가 연중 효과적으로 운영되었다는 충분하고 적합한 증거는 아직 확보하지 않았다. 갑은 이미 위험을 낮게 평가했으므로 소극적 조회만을 해당 잔액의 유일한 실증감사절차로 사용하자고 제안하였다.',
 '법인예금 검토: 별도 모집단은 18개 법인의 고액 예금으로, 계좌마다 금액·만기·중도해지 조건과 이자약정이 크게 다르다. 이 검토에서는 관련 위험이 낮고 관련 통제의 운영효과성에 관한 충분하고 적합한 증거도 확보되었다. 예상 불일치율은 매우 낮으며 요청이 무시될 상황도 알려져 있지 않다. 팀원 을은 이 세 가지 사정이 충족되므로 이 법인예금에도 소극적 조회만을 유일한 실증감사절차로 적용할 수 있다고 주장하였다.',
 '무응답 증거 검토: 감사팀은 별도로 예금부채가 실제보다 크게 표시되었을 가능성을 검토하려고 소극적 조회를 발송하였다. 전자 열람기록으로 의도한 예금주가 조회서를 열어 본 사실은 확인되지만, 잔액을 본인의 거래기록과 대조했는지는 알 수 없다. 기재잔액에 동의하지 않는 경우에만 감사인에게 회신하도록 요청했으며 회신은 없었다. 해당 예금주는 자신의 예금이 적게 기재되면 즉시 이의를 제기하지만, 크게 기재되면 자신에게 유리하다고 여겨 확인을 미루는 경향이 과거 문의기록에서 확인된다. 팀원 병은 열람 후 이의가 없으므로 예금부채가 과대표시되지 않았다는 증거가 충분하다고 설명하였다.'
].map((text,i)=>({id:'fact'+(i+1),text,scoreable:false}));
const prompts=[
 '개인예금에 관한 갑의 제안이 적절한지 판단하고, 현재 확보된 통제 관련 정보의 수준을 근거로 설명하시오.',
 '법인예금에 관한 을의 제안이 적절한지 판단하고, 해당 모집단의 특성을 근거로 설명하시오.',
 '무응답만으로 예금부채의 과대표시가 없다고 결론내리기 어려운 이유를 설명하시오. 조회서를 열람한 사실과 예금주의 이해관계를 각각 구체적인 근거에 연결하시오.'
];
const answers=[
 ['갑의 제안은 부적절하다. 현재 증거만으로 소극적 조회를 유일한 실증감사절차로 사용할 수 없다.','위험을 낮게 평가하고 통제의 설계·실행을 이해했더라도, 관련 통제가 실제로 효과적으로 운영되었다는 충분하고 적합한 증거를 아직 입수하지 못했으므로 필요한 조건이 충족되지 않았다.'],
 ['을의 제안은 부적절하다. 이 법인예금 모집단에 소극적 조회만을 유일한 실증감사절차로 적용할 수 없다.','법인예금은 소수의 고액 계좌이고 만기·해지·이자 조건도 크게 달라, 다수의 동질적인 소액 잔액이나 거래·조건으로 이루어진 모집단이라는 요건을 충족하지 않는다. 다른 조건이 충족되어도 이 결함을 대신할 수 없다.'],
 ['열람기록은 수령·열람 사실만 보여 줄 뿐, 예금주가 잔액의 정확성을 자신의 기록과 대조하여 검증했다는 뜻은 아니다. 따라서 열람 후 무응답을 잔액 확인으로 간주할 수 없다.','이 예금주는 잔액이 크게 기재되면 자신에게 유리하여 회신하지 않을 수 있다. 그러므로 예금부채의 과대표시를 찾으려는 목적에서는 이의가 없다는 결과의 설득력이 낮을 수 있다.']
];
const claims=[
 ['개인예금에 소극적 조회만을 유일한 실증감사절차로 적용하자는 갑의 제안을 부적절하다고 판단한다. 해당 결론을 분명히 함축하는 근거도 인정하되 명시적으로 반대 결론을 적으면 이 판단 점수는 주지 않는다.','낮은 위험 평가나 설계·실행의 이해만으로는 충분하지 않으며, 이 사례에서 관련 통제의 운영효과성에 관한 충분하고 적합한 증거가 미입수되어 505.15(a)의 조건을 충족하지 못했음을 설명한다. 판단의 정오와 별도로 이 올바른 근거가 의미상 성립하면 인정한다.'],
 ['법인예금에 소극적 조회만을 유일한 실증감사절차로 적용하자는 을의 제안을 부적절하다고 판단한다. 근거가 결론을 명확히 함축하면 별도 결론 문구를 요구하지 않으며 명시적 반대 결론은 인정하지 않는다.','소수의 고액·상이한 조건의 법인예금이 다수의 동질적 소액 모집단 요건을 충족하지 못함을 적용하여 설명한다. 열거된 모든 수식어를 반복하도록 요구하지 않으며 고액성 또는 조건의 이질성 등 실제 결격 특성과 요건의 불충족을 명확히 연결하면 인정한다.'],
 ['전자 열람 확인에도 이 예금주가 잔액의 정확성을 검증했다는 증거는 없으므로, 열람 후 무응답을 잔액의 확인으로 볼 수 없다고 설명한다. 수령하지 않았다고 주장하는 답은 주어진 사실에 반하므로 인정하지 않는다.','예금주에게 유리한 잔액 과대표시는 회신을 덜 하게 할 수 있으므로, 소극적 조회의 무응답은 이 사례의 예금부채 과대표시 탐색에 설득력이 낮을 수 있음을 연결한다. 모든 예금주가 반드시 무응답한다는 단정이나 은행의 이익만 설명한 답은 인정하지 않는다.']
];
const subquestions=prompts.map((prompt,i)=>{
 const qid='sub'+(i+1),sourceIds=i<2?[refs[0].id,refs[i+1].id]:[refs[3].id];
 const requirements=sourceIds.map((id,j)=>{const source=refs.find(r=>r.id===id);return {id:qid+'.req'+(j+1),source_ref_id:id,source_quote:source.source_quote,source_span:source.source_span};});
 return {id:qid,type:'descriptive',question_style:'case',topic_ids:['09'],prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:null,answer_slots:[{id:qid+'.answer',label:'답안',input:'textarea'}],model_answer:answers[i],requirements,criteria:claims[i].map((claim,j)=>({id:qid+'.c'+(j+1),requirement_id:requirements[Math.min(j,requirements.length-1)].id,claim,critical_facts:[{id:qid+'.c'+(j+1)+'.fact',type:j===0&&i<2?'conclusion':'condition',expected:answers[i][j]}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:i<2?(j===0?[refs[0].id]:[refs[i+1].id]):[refs[3].id]}))};
});
const set={schema_version:'3.0',id:'case-09-negative-confirmation-conditions-20260914',type:'linked_question_set',status:'needs_review',title:'예금 소극적 조회의 단독 사용과 무응답 증거',classification:{...prior.classification,standards:['KGA 505'],tags:['사례형','소극적 조회','통제증거','회신 유인']},source_refs:refs,shared_context:{facts},learning_order:subquestions.map(q=>q.id),subquestions,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:['가상의 은행 사례를 별도로 구성했다. 인용은 기존 등록 원문과 동일하며 2026 공식 전문 본문·하위 조건·A23 전체 및 페이지 경계·각주 귀속을 대조하였다.','기출·고급연습의 소극적 조회 일반 요건과 무응답의 증거 성격을 사실 적용으로 확장하였다. 외부 금융 규제나 예금 금액 계산은 요구하지 않는다.']}};
const partial=['갑의 제안은 부적절하다.','을의 제안은 부적절하다.',answers[2][0]];
const wrong=['위험을 낮게 평가했다면 통제의 설계와 실행을 이해한 것만으로 운영효과성의 증거도 충족되므로 갑의 단독 사용 제안은 적절하다.','위험과 예상 불일치율이 낮으면 소수의 고액 계좌이고 조건이 서로 달라도 모집단 요건을 충족하므로 을의 제안은 적절하다.','열람 확인은 잔액의 정확성을 검증했다는 증거이고, 예금주에게 유리하게 잔액이 크게 기재되면 반드시 더 적극적으로 이의를 제기하므로 무응답으로 과대표시가 없음을 확인할 수 있다.'];
const qa=subquestions.flatMap((q,i)=>[{set_id:set.id,subquestion_id:q.id,kind:'partial',answer:partial[i],expected_points:1,met_criterion_ids:[q.criteria[0].id],reason:'첫 독립 의미만 맞고 두 번째 적용 근거는 제시하지 않았다.',single_point_no_partial:false},{set_id:set.id,subquestion_id:q.id,kind:'wrong',answer:wrong[i],expected_points:0,met_criterion_ids:[],reason:'두 독립 명제를 모두 명시적으로 반대로 주장한다.',single_point_no_partial:false}]);
const sourceUnits=[catalog.units.find(u=>u.file.endsWith('point-review-b-source-followup-2026-09-11.txt')&&u.standard==='KGA 505'&&u.paragraph==='15'),catalog.units.find(u=>u.id==='src-415484ad81d98c5918'),catalog.units.find(u=>u.id==='src-39490171470b453a20-2')];assert(sourceUnits.every(Boolean));
const differences='pilot-09-008은 소극적 조회의 일반적 허용 조건, std-points-20260914-f5d37b0c8b8a는 무응답의 수령·검증 한계 일반론이다. 새 물음은 설계·실행까지만 이해한 개인예금, 고액·상이한 계약의 법인예금, 수령은 확인되지만 과대표시가 예금주에게 유리한 상황을 구별하여 적용한다. 후자의 수령 불확실성은 이미 제거하여 같은 일반론을 그대로 답할 수 없게 하였다. 기존 적극적 조회 거부·대체절차 사례와도 구별한다.';
const reasons=[
 '낮은 위험 판단과 관련 통제의 운영효과성 증거는 구별한다. 개인예금의 다수·동질·소액 및 예상 이탈·무시 여부 조건은 충족하지만 운영증거가 없다. 판단1점과 이 실제 결격 근거1점은 독립하며, 근거만 정확하게 쓰면 결론을 함축하므로2점이다.',
 '법인예금의 고액성·조건 이질성 때문에 505.15(b)가 충족되지 않는다. 다른 세 조건을 충족한 것으로 고정해 불필요한 추가목록을 묻지 않는다. 판단1점과 결격 특성을 조건에 연결하는 근거1점이다. 고액/이질성을 각각 추가점수로 기계적으로 나누지 않는다.',
 '2026 A23의 정확성 검증 한계와 자신에게 유리한 예금 과대표시의 회신 유인 차이를 실제 열람로그·문의기록에 적용한다. 수령은 사실로 확인되므로 수령 미확인을 정답으로 두지 않는다. 정확성 검증 한계1점과 목적에 따른 회신 유인1점이며 별도 부적절 판단은 중복 가산하지 않는다.'
];
const sourceRows=[{file:'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md',lines:'1733~1755, 1832~1844',pages:'55,58',original:'mock:2023:GS3-2:2',scope:'통제 운영효과성 등 조건의 일반 열거 중15(a)를 사례 sub1에 일부 대응. 같은 책 PART2 L11057~11068 및16473~16481은 재수록이므로 별도 빈도로 세지 않는다.'},{file:'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',lines:'14765~14804, 14955~14962',pages:'374,379',original:'cpa_exam:2018:2:4',scope:'일반 감사증거 보기 중 소극적 조회 무응답의 정황증거 성격을 참고. 기출 원발문의 해당 OCR 행은 일부 손상되어 교재 해설과 공식 A23로 내용을 대조하였다. 유인에 따른 예금 과대표시 효과성을 이 기출이 직접 출제했다고 주장하지 않는다.'}];
const design={set_id:set.id,plan:{version:1,topic_id:'09',mode:'adapt_existing_question',objective:set.title,scope:{actors:['은행 감사인','예금주'],timing:['2026년 재무제표 감사계획 및 증거평가'],conditions:facts.map(f=>f.text),exceptions:['505.15의 모든 조건 충족 예외와 A23의 증거 한계'],required_answers:prompts,exclusions:['조회 설계 목록','통제테스트의 구체 방법','감사의견 결정','금액 계산']},question_types:['descriptive'],source_unit_ids:sourceUnits.map(u=>u.id),existing_question_difference:differences,edition_assumption:'2026 공식 전문에서 505.15/A23 본문이 기존2025 등록 인용과 동일함을 확인했다. 시험 적용 판본 확정과 구별한다.',unresolved_items:[],status:'ready'},bank_sha256:ref(D+'/bank-before.json').sha256,source_catalog_sha256:ref(D+'/source-catalog.json').sha256,facts_chars:[...facts.map(f=>f.text).join('\n')].length,source_locations:sourceRows,compared_existing_sets:[prior,nonresponse].map(s=>({set_id:s.id,title:s.title,sha256:hash(JSON.stringify(s)),questions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria}))})),point_rationales:reasons};
const checks=Object.fromEntries(['source','answer','prompt','points','style','topics','edition','nonduplication'].map(k=>[k,'pass']));
const review=subquestions.map((q,i)=>({set_id:set.id,subquestion_id:q.id,reviewer_id:'agent:/root',method:'agent_content_review',human_review_performed:false,actual_model_grading:'not_run',question_style:'case',topic_ids:q.topic_ids,case_fact_ids:['fact1','fact'+(i+2)],fact_ids:['fact1','fact'+(i+2)],rationale:reasons[i],point_decision:'유지: 독립 의미 2개 각1점. 같은 결격 특성의 여러 수식어를 중복 배점하지 않는다.',max_points:2,minimal_sufficient_answer:answers[i],checks,check_rationales:{source:locations[i<2?i+1:3],answer:'저장 모범2점·대표부분1점·명시반대0점을 확정하고 함축판단 및 독립근거를 대조했다.',prompt:prompts[i],points:reasons[i],style:'해당 사실을 삭제하면 실제 결격 요건 또는 열람·회신유인에 맞는 완전 답안을 만들 수 없다.',topics:'모든 실제 요구는505외부조회 주제09이며 통제위험은 조건으로만 적용한다.',edition:'2026 전문429/430/434/435 원PDF를 시각대조했고 인용 본문을 공백만 제거한 기준으로 완전일치 확인했다. 429각주12·13은9, 434각주20·21·22는A19/A21 소속으로15/A23 의무에 합치지 않았다.',nonduplication:differences},unresolved:[],unresolved_content_findings:[],question_content_sha256:hash(JSON.stringify(q)),set_content_sha256:hash(JSON.stringify(set)),source_quote_hashes:Object.fromEntries(refs.map(r=>[r.id,hash(r.source_quote)]))}));
const boundary=subquestions.flatMap((q,i)=>[{set_id:set.id,subquestion_id:q.id,kind:'blank',answer:'',expected_points:0,met_criterion_ids:[]},{set_id:set.id,subquestion_id:q.id,kind:i<2?'implicit_conclusion':'other_half',answer:answers[i][1],expected_points:i<2?2:1,met_criterion_ids:i<2?q.criteria.map(c=>c.id):[q.criteria[1].id],reason:i<2?'이 근거는 단독사용 불가 결론을 분명히 함축한다.':'회신 유인에 관한 독립 이유만 맞았다.'},...(i<2?[{set_id:set.id,subquestion_id:q.id,kind:'wrong_conclusion_valid_reason',answer:'제안은 적절하다. '+answers[i][1],expected_points:1,met_criterion_ids:[q.criteria[1].id],reason:'명시적인 반대 결론은0점이나 독립적으로 맞는 결격 근거는1점이다.'}]:[])]);
write('sets.json',[set]);write('design.json',[design]);write('review.json',review);write('qa.json',qa);write('qa-boundaries.json',boundary);
const element=read('cpa_uploader/analysis/question-elements/question-elements.json').elements.find(e=>e.id==='element-d04509ff508fddec');
const coverageUnits=sourceUnits.slice(0,1),q=subquestions[0];
write('coverage-proposals.json',{version:1,links:[{id:'coverage-trio-20260914-03',element_id:element.id,source_unit_ids:coverageUnits.map(u=>u.id),target:{scope:'draft',file:C+'/sets.json',set_id:set.id,subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id)},relationship:'partial',reason:'2023 GS3 문제2물음2의 예시 제외 세 조건 중 관련 통제 운영효과성 증거 요건만 개인예금 상황에 적용한다. 나머지 조건과 새로운 회신 유인 물음을 이 요소의 직접 충족으로 세지 않는다.',review_status:'needs_review',snapshot:{element_sha256:hash(JSON.stringify(element)),question_sha256:questionHash(set,q),source_hashes:Object.fromEntries(coverageUnits.map(u=>[u.id,u.contentHash])),source_metadata_hashes:Object.fromEntries(coverageUnits.map(u=>[u.id,sourceUnitHash(u)]))},provenance:{source_locations:sourceRows,frequency_treatment:'확인된 mock1회, 기출0회는 현 요소 집계이며 2018 인접 기출과 재수록을 합산하지 않는다.'}}]});
const sourceFiles=[...new Set([...refs.map(r=>r.file),pdfText,'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',...sourceRows.map(r=>r.file),'cpa_uploader/analysis/question-elements/question-elements.json',...['429','430','434','435'].map(n=>'cpa_uploader/raw/originals/case-trio-2026-09-14/kga505-0'+n+'.png')])];
write('source-files.json',sourceFiles.map(f=>({...ref(f),role:f.endsWith('.png')?'직접 시각 대조':'내용·판본·인용·원발문 및 빈도 대조'})));
write('source-comparison.json',{status:'passed',method:'root manual PDF and text review plus whitespace-insensitive complete passage comparison',human_review_performed:false,source_files:sourceFiles.map(ref),quotes:refs.map((r,i)=>({id:r.id,quote_sha256:hash(r.source_quote),official_location:locations[i],current_pdf_content_equal:true})),footnotes_excluded_from_505_requirements:['429 fn12/13→505.9','434 fn20/21→A19','434 fn22→A21'],raw_render_method:'pdftoppm -scale-to 1400 -png; read-only source PDF; initial bundled PyMuPDF unavailable, no output from that attempt',model_api_calls:0});
console.log({id:set.id,questions:subquestions.length,facts_characters:design.facts_chars,points:6,qa:qa.length});
