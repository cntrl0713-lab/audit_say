import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const D='cpa_uploader/drafts/case-trio-next-2026-09-14',C=D+'/c';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=v=>createHash('sha256').update(v).digest('hex');
const ref=f=>({file:f,sha256:hash(fs.readFileSync(f))});
const write=(n,x)=>fs.writeFileSync(C+'/'+n,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const bank=read(D+'/bank-before.json'),catalog=read(D+'/source-catalog.json');
const sourceIds=['src-3630d179e0bde987c3','src-49fe61eb277b0ed91a','src-9a9aa89c50c77dee4d','src-2b94c9d01ef9ce0cd3'];
const units=sourceIds.map(id=>catalog.units.find(u=>u.id===id));
assert(units.every(Boolean));
const locations=['2026 전문 PDF663 KGA610.16(a) 및 전체 금지조건','2026 전문 PDF663~664 KGA610.18 본문 및(a)~(d)','2026 전문 PDF660 KGA610.5 국내 추가문단·각주(*1)','2026 전문 PDF663 KGA610.14(b)'];
const quotes=units.map(u=>u.quote);
quotes[2]=quotes[2].slice(quotes[2].indexOf('우리나라의 회계감사기준'),quotes[2].indexOf('\n \n1 감사기준서'));
quotes[3]=quotes[3].slice(quotes[3].indexOf('(b) 직접적 보조'),quotes[3].indexOf('\n요구사항'));
const refs=units.map((u,i)=>({id:'src610'+['16','18','5kr','14b'][i],file:u.file,title:locations[i]+'; 기존 등록 전사와 현행 공식 PDF의 본문 대조',page:'KGA 610',source_quote:quotes[i],role:'standard',content_hash:hash(quotes[i])}));
refs.forEach(r=>assert(fs.readFileSync(r.file,'utf8').includes(r.source_quote)));
const pdf='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',pdfText=pdf.replace('full.pdf','pymupdf-pages.txt');
const rawText=fs.readFileSync(pdfText,'utf8');
const norm=s=>s.replace(/\s/g,'');
const cleaned=rawText.replace(/^## PDF page \d+\s*$/gm,'').replace(/^\d+ \/ 1001\s*$/gm,'').replace(/^감사기준서 610 ‘내부감사인이 수행한 업무의 활용’\s*$/gm,'');
refs.forEach(r=>assert(norm(cleaned).includes(norm(r.source_quote)),'2026 body differs: '+r.id));
const facts=[
 '한결회계법인은 서림기기의 2026년 1월 1일부터 12월 31일까지의 재무제표를 우리나라 회계감사기준에 따라 감사한다. 회사는 내부감사부가 수행한 업무를 활용하면 외부감사 시간을 줄일 수 있다고 설명하였다. 감사팀은 조직개편 전의 업무, 개편 후의 업무 활용계획, 연말 인력지원 제안을 차례로 검토하고 있다. 각 검토에서는 아래에 명시된 시점의 조직과 업무 조건을 적용한다.',
 '조직개편 전에는 영업이사가 내부감사부장을 겸직하면서 매출 목표 달성과 내부감사 계획을 함께 관리하였다. 내부감사보고서는 영업이사의 승인을 받아야 감사위원회에 전달되었고, 영업이사는 자신이 승인한 판매거래의 지적사항을 최종 보고서에서 삭제할 수 있었다. 내부감사인이 감사위원회에 직접 보고하거나 삭제된 사항을 알릴 별도의 통로도 없었다. 한편 부서원은 모두 관련 자격과 풍부한 감사경험을 갖췄고 업무 매뉴얼과 품질검토도 잘 갖추고 있었다. 팀원 갑은 부서원의 전문성이 높으므로 개편 전에 수행한 매출 내부감사업무를 활용할 수 있다고 제안하였다.',
 '7월 조직개편 후에는 영업이사가 내부감사업무에서 배제되고 감사위원회가 내부감사부장의 인사와 보고를 직접 관리하였다. 감사팀은 개편 후 기능의 객관성·적격성과 체계적 접근법이 기본 활용요건을 충족한다는 증거를 입수하였다. 이후 내부감사부는 정형적인 소액 경비승인 테스트와 장기 판매계약의 매출인식 통제 평가를 수행하였다. 경비 영역의 평가된 위험은 낮지만 장기계약 영역은 유의적 위험으로 식별되었고, 계약변경의 실질과 증거를 평가할 때 많은 판단이 필요하다. 팀원 을은 같은 내부감사부가 수행했다는 이유로 두 영역에서 내부감사업무의 활용 범위와 외부감사인의 직접 수행 범위를 동일하게 정하자고 제안하였다.',
 '연말에 회사는 새 내부감사부 직원 두 명을 외부감사팀에 지원하겠다고 제안하였다. 이 직원들은 내부감사부의 기존 업무계획과 별개로 외부감사인이 새로 선정한 거래를 검사하고, 외부감사인의 매일 지시와 감독을 받으며 작성한 조서를 외부감사인에게 검토받을 예정이다. 회사 대표자는 해당 업무에 간섭하지 않겠다는 동의서에 서명할 수 있고, 직원들도 비밀유지와 객관성 위협의 통지를 약속하겠다고 하였다. 팀원 병은 개편 후 직원들의 적격성과 객관성을 확인했고 동의서도 받을 수 있으므로 이 지원을 활용할 수 있다고 설명하였다.'
].map((text,i)=>({id:'fact'+(i+1),text,scoreable:false}));
const prompts=[
 '조직개편 전에 수행한 매출 내부감사업무에 관한 갑의 제안이 적절한지 판단하고, 보고체계와 영업이사의 권한을 근거로 설명하시오. 부서원의 높은 전문성이 이 판단에 미치는 영향도 같은 근거에 포함하시오.',
 '개편 후 장기계약 영역에 대해 을의 계획을 어떻게 조정해야 하는지 설명하시오. 소액 경비 영역과 비교하여 내부감사업무의 활용 범위와 외부감사인의 직접 수행 범위를 각각 제시하고, 사례의 위험과 판단 부담을 근거로 설명하시오.',
 '연말 인력지원 제안의 업무 수행방식이 어떤 활용 형태에 해당하는지 설명하고, 병이 제시한 조건 아래 우리나라 회계감사기준에 따른 이 감사에서 허용되는지 판단하시오.'
];
const answers=[
 ['갑의 제안은 부적절하며, 조직개편 전에 수행한 해당 매출 내부감사업무를 활용해서는 안 된다.','영업이사가 자신의 판매거래에 대한 지적사항을 삭제할 수 있고 감사위원회에 직접 알릴 통로도 없어 내부감사기능의 객관성을 적절히 지원하지 못한다. 부서원의 높은 전문성은 이러한 객관성 결함을 보완하지 못한다.'],
 ['장기계약 영역에서는 소액 경비 영역보다 내부감사기능이 수행한 업무의 활용을 줄이도록 계획한다.','장기계약 영역에서는 외부감사인이 직접 수행할 업무를 늘리도록 계획한다.','장기계약은 유의적 위험이 식별되었고 계약변경의 실질과 증거 평가에 많은 판단이 필요하므로, 같은 내부감사부가 수행했다는 이유로 낮은 위험의 정형적 경비업무와 같은 범위로 정할 수 없다.'],
 ['직원들이 기존 내부감사업무와 별개로 외부감사인의 지시·감독·검토 아래 새 감사절차를 수행하므로 내부감사인의 직접적 보조에 해당한다.','우리나라 회계감사기준에 따른 이 감사에서는 직접적 보조를 활용할 수 없다. 적격성·객관성을 확인하고 대표자 및 직원의 동의를 받더라도 국내 금지를 해제하지 못한다.']
];
const claims=[
 ['갑의 개편 전 매출 내부감사업무 활용 제안을 부적절하다고 판단한다. 적절한 근거가 활용 금지를 명확히 함축해도 인정하되 명시적으로 활용 가능하다고 쓰면 판단은 인정하지 않는다.','영업이사의 자기 업무에 관한 지적사항 삭제권과 직접 보고 통로 부재 때문에 객관성이 적절히 지원되지 않으며 높은 전문성이 그 결함을 보완하지 못함을 설명한다. 객관성 결함에 대한 사례 적용이 필요하며 독립적으로 옳은 이 근거는 판단의 정오와 별도로 인정한다.'],
 ['장기계약 영역에서 낮은 위험의 소액 경비 영역에 비하여 내부감사업무의 활용 범위를 줄이도록 계획한다고 제시한다.','장기계약 영역에서 낮은 위험의 소액 경비 영역에 비하여 외부감사인의 직접 수행업무를 늘리도록 계획한다고 제시한다.','장기계약의 유의적 위험과 계약변경 실질·증거 평가에 수반되는 많은 판단을 동일한 활용계획이 부적합한 근거로 연결한다. 위험 또는 판단 부담이라는 추상적인 명칭만 나열하면 인정하지 않으며 사례의 두 특성을 연결하면 한 문장으로도 인정한다.'],
 ['기존 내부감사업무 활용이 아니라 외부감사인이 선정한 새 절차를 그 지시·감독·검토 아래 수행하는 직접적 보조라고 사례 수행방식에 적용하여 설명한다. 명칭만 적고 제안된 수행방식과 연결하지 않으면 인정하지 않는다.','이 감사에는 국내의 직접적 보조 금지가 적용되어 활용할 수 없으며, 적격성·객관성과 서면동의로 허용되지 않는다고 판단한다. 동의를 받아도 허용되지 않는다는 이유가 결론을 명확히 함축하면 인정한다. 명시적으로 활용 가능하다고 하면 이 기준은 인정하지 않는다.']
];
const qRefs=[[0],[1],[3,2]];
const subquestions=prompts.map((prompt,i)=>{
 const id='sub'+(i+1),rs=qRefs[i].map(n=>refs[n]);
 const requirements=rs.map((r,j)=>({id:id+'.req'+(j+1),source_ref_id:r.id,source_quote:r.source_quote,source_span:locations[refs.indexOf(r)]}));
 return {id,type:'descriptive',question_style:'case',topic_ids:['13'],prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:null,answer_slots:[{id:id+'.answer',label:'답안',input:'textarea'}],model_answer:answers[i],requirements,criteria:claims[i].map((claim,j)=>({id:id+'.c'+(j+1),requirement_id:requirements[Math.min(j,requirements.length-1)].id,claim,critical_facts:[{id:id+'.c'+(j+1)+'.fact',type:i===0&&j===0?'conclusion':'condition',expected:answers[i][j]}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[rs[Math.min(j,rs.length-1)].id]}))};
});
const set={schema_version:'3.0',id:'case-13-internal-audit-boundaries-20260914',type:'linked_question_set',status:'needs_review',title:'내부감사부 조직개편과 업무 활용의 경계',classification:{topic_id:'13',part:'PART3',chapter:'타인이 수행한 업무의 활용',domain:'audit',standards:['KGA 610'],tags:['사례형','내부감사기능','객관성','유의적 위험','직접적 보조']},source_refs:refs,shared_context:{facts},learning_order:subquestions.map(q=>q.id),subquestions,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:['기출과 고급연습의 요구를 참고해 가상의 조직개편 및 지원 제안 사례를 작성했다. 실제 기출을 그대로 옮긴 문제가 아니다.','2026 공식 전문의610.5/14/15/16/18/A7~A9/A12~A13/A18~A21과 국내 각주를 대조했다. 2026.1.1 개시 보고기간에 적용되며 미래 시험 적용판본 확정과 구분한다.','기존 등록 인용의 본문을 현행2026PDF와 대조했다. 직접적 보조의 국내 금지 때문에33의 서면동의 요건을 국내 허용근거로 사용하지 않는다.']}};
const partial=[answers[0][0],answers[1][0],answers[2][0]];
const wrong=['갑의 제안은 적절하다. 전문성이 높으면 영업이사가 자신의 지적사항을 삭제하는 보고체계도 보완되므로 해당 업무를 활용할 수 있다.','장기계약 영역에서는 내부감사업무 활용을 더 늘리고 외부감사인의 직접 수행업무를 줄인다. 두 영역은 위험과 판단 부담이 동일하다.','이 지원은 내부감사부가 이미 수행한 업무의 활용에 해당하며 직접적 보조는 아니다. 자격을 확인하고 동의서를 받으면 국내 감사에서도 허용된다.'];
const qa=subquestions.flatMap((q,i)=>[
 {set_id:set.id,subquestion_id:q.id,kind:'partial',answer:partial[i],expected_points:1,met_criterion_ids:[q.criteria[0].id],reason:i===0?'금지 판단만 정답이며 구체적인 객관성 근거는 없다.':i===1?'내부감사업무 활용 축소만 제시하고 직접업무 확대와 사례의 근거는 없다.':'직접적 보조의 수행방식을 정확히 식별하였으나 국내 허용 판단이 없다.'},
 {set_id:set.id,subquestion_id:q.id,kind:'wrong',answer:wrong[i],expected_points:0,met_criterion_ids:[],reason:'발문이 요구한 결론·조치 또는 분류와 근거를 모두 반대로 서술하였다.'}
]);
const compared=bank.filter(s=>s.classification.standards.includes('KGA 610'));
const differences='현행610 물음은 기본 평가목록, 금지조건을 이미 준 상태의 판단, 위험이 높아질 때의 일반 조정, 직접적 보조의 국가별 조건을 묻는 기준서형이다. 신규는 삭제권·보고통로로 객관성 결함을 도출하고, 동일 기능의 두 업무 위험을 비교하며, 새 업무의 수행방식으로 직접적 보조를 식별한다. 과거pilot-13-010에 사실이 저장되어 있어도 현재 분류와 득점은 일반 기준서 요구이며 새 사례의 구체 적용과 다르다. 기존 사례70개와 명시적draft-inventory에서 같은 조직개편·인력지원 사실구조의 사례가 없음을 대조했다.';
const reasons=[
 '활용 금지 판단1점과 구체적인 객관성 결함의 근거1점이다. 전문성은 객관성 결함을 치유하지 못한다는 하나의 반론 검토에 포함하고 별도 중복점수를 주지 않는다. 보고 승인이나 경영진 보고만으로 자동 금지하지 않도록 삭제권과 별도 통로 부재를 함께 두었다.',
 '활용 축소1점·직접 수행 확대1점·두 업무의 위험과 판단 부담 차이를 적용한 근거1점이다. pilot-13-010/sub1의 일반 방향 명제와 같은 정수 원칙을 쓰며, 유의적 판단의 수행주체·유의적 위험에서 활용할 절차의 한계를 별도로 묻지 않아 요구를 과도하게 묶지 않는다.',
 '업무수행 방식으로 직접적 보조를 식별1점·국내 활용 불가판단1점이다. 명칭만 쓴 답에는 적용 점수를 주지 않는다. 서면동의4가지 목록은 묻지 않는다. 이는 기존13-003 일반판단을 실제 지원제안 분류로 확장한다.'
];
const books=[
 {file:'cpa_uploader/data/회계감사_통합학습자료/04_기출문제/기출문제_연도별_해설_A.md',pages:'29~32',lines:'913~944,1006~1035',original:'cpa_exam:2025:3:3',scope:'문제3물음3② 외주 내부감사업무의 유의적 위험 영역 활용 판단을 참고. 다른①③④와 그 해설은 범위 경계로 읽고 새 물음으로 옮기지 않았다. 제공 학습자료의 재수록이며 별도 공식 기출PDF를 확보한 것으로 표시하지 않는다.'},
 {file:'cpa_uploader/data/회계감사_통합학습자료/03_문제연습/고급_회계감사_연습.md',pages:'84~86',lines:'2677~2705,2741~2756',original:'mock:2025:GS1-3:1',scope:'2025 GS1 문제3물음1④ 영업이사의 내부감사 겸직과 개선안 참고. 원문은 실물자산 업무와 무관하다는 단서를 포함하므로 그대로 금지판단에 사용하지 않고 새 사례에 자신의 거래 지적사항 삭제권과 직접 보고 통로 부재를 추가했다. 기존 모의 원문을 실제 CPA 기출로 세지 않는다.'}
];
const design={set_id:set.id,plan:{version:1,topic_id:'13',mode:'adapt_existing_question',objective:'객관성 결함의 식별, 업무위험별 활용 조정, 직접적 보조의 국내 금지를 실제 조직·업무에 적용한다.',scope:{actors:['외부감사인','영업이사','내부감사부','감사위원회'],timing:['2026년 보고기간 감사의 조직개편 전·후 및 연말 제안'],conditions:facts.map(f=>f.text),exceptions:['높은 전문성은 객관성 결함을 치유하지 못함','직접적 보조의 해외 허용요건은 국내 금지 예외가 아님'],required_answers:prompts,exclusions:['서면동의의 일반 목록','개별 업무검증의 전체 절차','보고의견 결정','일률적 활용비율 산출']},question_types:['descriptive'],source_unit_ids:sourceIds,existing_question_difference:differences,edition_assumption:'2026.1.1 개시 재무제표감사로 설정하고 2026전문662의610.12 시행문단 및660의국내추가문단을 확인했다. 미래시험판본은 확정하지 않는다.',unresolved_items:[],status:'ready'},bank_sha256:ref(D+'/bank-before.json').sha256,source_catalog_sha256:ref(D+'/source-catalog.json').sha256,facts_chars:[...facts.map(f=>f.text).join('\n')].length,source_locations:books,compared_existing_sets:compared.map(s=>({set_id:s.id,title:s.title,sha256:hash(JSON.stringify(s)),questions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria}))})),point_rationales:reasons};
const checks=Object.fromEntries(['source','answer','prompt','points','style','topics','edition','nonduplication'].map(k=>[k,'pass']));
const review=subquestions.map((q,i)=>({set_id:set.id,subquestion_id:q.id,reviewer_id:'agent:/root',method:'agent_content_review',human_review_performed:false,actual_model_grading:'not_run',question_style:'case',topic_ids:q.topic_ids,case_fact_ids:['fact1','fact'+(i+2)],fact_ids:['fact1','fact'+(i+2)],rationale:reasons[i],point_decision:'유지: 독립 의미단위별 정수1점, 물음의 최소 충분 답안을 근거로 산정.',max_points:q.criteria.length,minimal_sufficient_answer:answers[i],checks,check_rationales:{source:locations[qRefs[i][0]],answer:'저장 모범답안과 부분·오답 및 함축 결론의 기대값을 내용에서 먼저 확정했다.',prompt:prompts[i],points:reasons[i],style:'보고구조·위험차이·새 업무수행방식 사실을 지우면 현재 완전답안의 적용 근거를 낼 수 없다.',topics:'요구는모두610 내부감사업무 활용이며 사례에 등장하는매출회계/일반통제를별도요구로세지않는다.',edition:'2026전문 PDF660,662~664,670~674 본문과 각주를 대조한다.660(*1)은5에귀속되어27~35/37/A32~A41 국내미적용이다.671A9의객관성/적격성 상호치유 불가 및672A13의집합고려를 적용하였다.',nonduplication:differences},unresolved:[],unresolved_content_findings:[],question_content_sha256:hash(JSON.stringify(q)),set_content_sha256:hash(JSON.stringify(set)),source_quote_hashes:Object.fromEntries(refs.map(r=>[r.id,hash(r.source_quote)]))}));
const boundaries=subquestions.flatMap((q,i)=>[{set_id:set.id,subquestion_id:q.id,kind:'blank',answer:'',expected_points:0,met_criterion_ids:[]},{set_id:set.id,subquestion_id:q.id,kind:'other_units',answer:answers[i].slice(1).join('\n'),expected_points:i===0?2:i===1?2:1,met_criterion_ids:i===0?q.criteria.map(c=>c.id):q.criteria.slice(1).map(c=>c.id),reason:i===0?'객관성 결함이 치유되지 않는다는 근거는 활용불가를 분명히 함축한다.':'첫번째 독립단위를 제외한 나머지 명제만 정답이다.'}]);
boundaries.push({set_id:set.id,subquestion_id:'sub1',kind:'wrong_conclusion_valid_reason',answer:'해당 업무를 활용할 수 있다. '+answers[0][1],expected_points:1,met_criterion_ids:['sub1.c2'],reason:'반대 결론은0점이지만 독립적으로 맞는 객관성 근거는1점이다.'});
write('sets.json',[set]);write('design.json',[design]);write('review.json',review);write('qa.json',qa);write('qa-boundaries.json',boundaries);
write('coverage-proposals.json',[{element_id:'element-9c2fb48c77c2ceeb',set_id:set.id,subquestion_id:'sub2',criterion_ids:['sub2.c1','sub2.c2','sub2.c3'],source_unit_ids:[sourceIds[1]],relationship:'partial',reason:'2025 문제3물음3②의 유의적 위험 업무 활용 판단을 장기계약과 경비업무 비교에 적용한다. 공정가치측정 금융자산과 외주 전문인력이라는 원조건을 동일하게 재현하지 않아 일부 대응이며, 객관성 결함과 직접적 보조 물음까지 이 기출의 출제로 세지 않는다.',source_locations:books,original_question_ids:['cpa_exam:2025:3:3'],reprint_treatment:'기출의 원물음 하나를 교재 재수록 횟수로 늘리지 않는다. 고급연습의2025GS1은 다른 모의 물음으로 구별한다.'}]);
const sourceFiles=[...new Set([...refs.map(r=>r.file),pdf,pdfText,...books.map(x=>x.file),'cpa_uploader/analysis/question-elements/question-elements.json',...fs.readdirSync(C+'/sources').filter(f=>f.endsWith('.png')).map(f=>C+'/sources/'+f)])];
write('source-files.json',sourceFiles.map(f=>({...ref(f),role:f.endsWith('.png')?'공식 PDF 페이지 시각 대조':'원발문·원문·내용·계보 대조'})));
write('source-comparison.json',{status:'passed',method:'root read official2026 full passage and source books; byte inclusion and whitespace-insensitive current body check',human_review_performed:false,quotes:refs.map((r,i)=>({id:r.id,quote_sha256:hash(r.source_quote),official_location:locations[i],current_pdf_content_equal:true})),source_files:sourceFiles.map(ref),footnote_review:['660 fn1 is610.3, fn2is610.5, domestic(*1)is610.5 and excludes27~35/37/A32~A41','663/664 page break splits610.18; nofootnote belongs within18','670(*3) repeats domesticrestriction withA4; 673fn17 concernsA14 not18'],model_api_calls:0,render_method:'pdftoppm -f660 -l664 and -f670 -l674 -scale-to1400 -png; PDF SHA verified separately'});
console.log({id:set.id,facts_chars:design.facts_chars,questions:3,points:7,qa:qa.length});
