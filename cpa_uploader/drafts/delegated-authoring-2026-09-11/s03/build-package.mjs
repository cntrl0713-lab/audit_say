/** Manual S03 draft writer: dedicated folder only; no models or shared mutations. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import {specifications} from './content.mjs';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/s03');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const sha=f=>hash(fs.readFileSync(f));
const write=(f,v)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n');
const rel=f=>path.relative(process.cwd(),f).replaceAll('\\','/');
const sourceFile='cpa_uploader/data/official/delegated-s03-kga-2025.txt',sourceText=fs.readFileSync(sourceFile,'utf8'),catalog=buildSourceCatalog();
const investigation=read(path.join(base,'sources/official-investigation.json')),frequency=read(path.join(base,'frequency-evidence.json'));
const ledger=Object.values(read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json')).find(Array.isArray);
const unit=key=>{const [st,p]=key.split('.');const u=catalog.units.find(x=>x.file===sourceFile&&x.standard===`KGA ${st}`&&x.paragraph===p);if(!u)throw Error(`Unregistered ${key}`);return u;};
const block=key=>{const [st,p]=key.split('.');return investigation.blocks[st]['2025'][p];};
const srcId=key=>'std-'+key.replace('.','-');
const policy='2027년 CPA 시험 대비. 기본 사례는2026년1월1일 개시·12월31일 종료 보고기간의 재무제표를2027년에 감사한다. 공식2025 전문을 선택하고2026 전문의 대응 본문·적용자료를 직접 대조했다. 501.2/510.2/610.12/402.6은2026년1월1일 이후 개시 보고기간 시행을 명시한다. 금융위원회2027 시험범위 공고는 기준서별 판본을 지정하지 않았으므로 시험당국의 판본확정이라고 표현하지 않는다. 총괄 edition-policy.md의 제한된 사례설계 정책을 적용한다.';
const lawPolicy='250.10은 확보한 공식2025/2026 전문 모두 시행연도를202X년12월15일 이후 종료 재무제표라고 표기한다. 개별 확정 시행공고는 아직 확인하지 못했으며 X를 추정하지 않는다. T05-C는 공식250.6/14~16의 두 법규 유형과 책임 요구 자체를 적용하는 가상 사례로 한정한다. 실제 법령의 시행일·유형·위반 여부나 외부보고 의무를 판단하지 않는다. 이 한정으로 정답범위를 확정한 것이며250 전체의 법적 시행일을 공식 확인했다는 뜻이 아니다.';
const domain={
 '09':{part:'PART3',chapter:'특정항목에 대한 감사증거',actors:['재무제표감사를 수행하는 감사인','기업 경영진','필요한 경우 지배기구·내외부 법률고문']},
 '05':{part:'PART2',chapter:'법규준수 관련 감사책임',actors:['감사인','기업 경영진','적절한 경우 지배기구']},
 '13':{part:'PART3',chapter:'타인이 수행한 업무의 활용',actors:['외부감사인 또는 이용자기업 감사인','수행된 내부감사업무 또는 서비스조직의 서비스감사인']}
};
const changes={
 'T09-C':['질문할 두 상대와 검토할 두 문서군은 각각 누락 가능한 요구다. 법률비용 계정과 함께5점으로 분리한다.','501.10의 독립 OR 발동조건2개와 작성·발송·회신요청의 서로 다른 행위3개, 금지시 대안1개를 구별한다. 두 발동조건의 OR는 각각의 조건범위에 포함하고 연결어 자체를 추가1점으로 만들지 않는다.','방법 이해·공시가능성 평가·조건부 적용테스트·분석적 또는 기타절차4개 유지.'],
 'T09-D':['즉시 변형 계획의 판단과 원문의 두 다른 증거경로를3점으로 구별한다. 조치가 판단을 함축하면 판단문장 삭제를 누락으로 처리하지 않는다.','원기출의 계정별1절차를 넘어 네 기초주장 및 일부증거 한계를 명시적으로 묻는다. 재고는 기초수량 조정과 기초평가2개로 한정한다. 네 주장 안의 일부증거 표현으로 한계가 충족되면 한계문장을 별도로 쓰도록 강요하지 않는다.','광범위성 자료가 없으므로 판단형에서 가능한 의견계열의 완전열거형으로 변경한다. 증거부족과 입증된 당기 중요영향 미수정오류라는 두 조건마다 의견계열1점씩 유지한다.'],
 'T05-C':['직접영향 법규 준수증거와 기타법규 중요위반 식별절차 목적의2점 유지. 유형 정의는 주어진 사실이므로 득점 아님.','경영진 질문과 적절한 경우 지배기구 질문은 서로 다른 상대에게 수행할 수 있는 증거절차이므로 분리한다. 존재시 왕복문서 검사, 다른절차 중 위반식별 가능성에 주의와 합쳐4점이다. 대상의 이름·조건·동사를 기계적으로 추가 배점하지 않는다.'],
 'T13-B':['모든 유의적판단의 담당자, 판단증가시 업무배분, 위험증가시 업무배분, 유의적위험의 제한된 판단 경계를4점으로 명시한다. 활용축소/직접업무확대는 같은 배분결정의 양면이라1점이다.','계획·수행·감독·검토·문서화의 각 적절성은 별개로 충족할 수 있어5점, 결론의 증거·결론 자체·보고서와 결과 일관성3점을 분리한다.','검증대상 전체범위·일부재수행2점, 판단·위험·객관성지원·적격성에 따른 검증절차 설계4점. Q1의 활용량 결정과 Q3의 외부 검증절차 설계는 서로 다른 판단대상이다.'],
 'T13-C':['보고서의 통제 일자/기간1점, 보충통제의 관련성·조건부 설계·실제실행·운영테스트4점, 실제 테스트 대상기간·테스트 이후 경과시간2점, 테스트/결과의 주장관련성·위험평가 뒷받침 증거2점. 보고서1~9월과 실제테스트7~9월,9월30일 이후를 사례에서 구별해 시간평가3개를 같은 요구의 반복으로 만들지 않는다.','감사 관련성이 있는 제외서비스의 생략불가 판단과402 적용행위2점 유지. 적용행위가 판단을 함축하면 판단문장 삭제를 진짜 누락으로 처리하지 않는다.']
};
const original={'T09-C':[3,3,4],'T09-D':[2,3,2],'T05-C':[2,3],'T13-B':[2,3,3],'T13-C':[4,2]};
const lineage=[],coverage=[];
for(const s of specifications){
 const assigned=ledger.find(x=>x.plan_id===s.plan_id);if(!assigned||assigned.set_id!==s.id||assigned.package!=='S03')throw Error('ID ledger mismatch');
 const refs=s.source_keys.map(key=>{const u=unit(key),q=block(key).quote;if(!sourceText.includes(q))throw Error('Inexact quote '+key);return {id:srcId(key),file:sourceFile,title:`KGA ${key}; 공식2025 전문 PDF ${block(key).pdf_start_page}쪽부터; ${u.locator}`,page:'KGA '+key.split('.')[0],source_quote:q,content_hash:hash(q),role:'standard'};});
 const set={schema_version:'3.0',id:s.id,type:'linked_question_set',status:'needs_review',title:s.title,classification:{topic_id:s.topic_id,part:domain[s.topic_id].part,chapter:domain[s.topic_id].chapter,domain:'audit',standards:[...new Set(s.source_keys.map(k=>'KGA '+k.split('.')[0]))],tags:[s.title,'공식 문단 적용','조건과 예외']},source_refs:refs,shared_context:{facts:s.facts.map((text,i)=>({id:'f'+(i+1),text,scoreable:false}))},learning_order:s.questions.map((_,i)=>'sub'+(i+1)),subquestions:s.questions.map((q,qi)=>({id:'sub'+(qi+1),type:q.type,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:q.type==='judgment'?{options:q.decision_options,correct:q.decision_correct}:null,answer_slots:[{id:`sub${qi+1}.answer`,label:'답안',input:'textarea'}],model_answer:q.claims.map(c=>c.claim),requirements:q.claims.map((c,i)=>({id:`sub${qi+1}.req${i+1}`,source_ref_id:srcId(c.key),source_quote:block(c.key).quote,source_span:unit(c.key).locator})),criteria:q.claims.map((c,i)=>({id:`sub${qi+1}.crit${i+1}`,requirement_id:`sub${qi+1}.req${i+1}`,claim:c.claim,critical_facts:[{id:`sub${qi+1}.crit${i+1}.fact`,type:'action',expected:c.claim},...(c.scope?[{id:`sub${qi+1}.crit${i+1}.scope`,type:'condition',expected:c.scope}]:[])],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[srcId(c.key)]}))})),verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[policy,...(s.topic_id==='05'?[lawPolicy]:[]),'총괄 배정ID로 수동 제작했다. exact 인용 검사는 의미검수의 대체가 아니다. source_refs에 직접 요구와 필요한 적용자료를 연결했다.','stage=draft_ready 이전 정적 준비물. 실제 의미검수와 모델 채점은 전체49 비교은행 고정 후 재개한다. 정본편입·게시·배포하지 않았다.','수동 evidence-packet은 자동 생성기의 source packet이 아니며 생성 해시마커나 자동 의존패킷 complete 표시를 만들지 않는다.']}};
 const filename=s.id+'.json';write(filename,set);
 const prior=frequency.elements.filter(e=>e.plan_id===s.plan_id);
 const exceptions=[policy,...(s.topic_id==='05'?[lawPolicy]:[]),'독립명제마다1점이며 조건·대상·시점은 해당 행위의 결합범위다. 같은 동의어를 중복 배점하지 않고 주어진 사실은 점수화하지 않는다. 요구의 일부 문장을 삭제해도 다른 문장에서 해당 의미가 충족되면 득점을 유지한다.',...changes[s.plan_id],...s.questions.flatMap(q=>q.claims.filter(c=>c.scope).map(c=>c.scope)),...prior.map(e=>`실제 학습자료 관계 ${e.element_id}: ${e.relationship}. ${e.relationship_limit} E=${e.exam_frequency}, M=${e.mock_frequency}, 비OX연습=${e.practice_non_ox}, 필수암기/OX교재수록=${e.ox_book_occurrences}, 이외원출처미확정=${e.unresolved_nonpractice_occurrences.length}. 원기출키=${e.exam_questions.join(',')||'확인된 기출키 없음'}. 공식근거와 구별한다.`)];
 if(s.plan_id==='T09-C')exceptions.push('501.A23에서 일반질문서에 대한 답변을 금지하는 것은 모든 직접 커뮤니케이션 금지와 다르며 세부질문서가 가능할 수 있다.501.A26의 부문정보는 전체 재무제표 감사의 일부이며 개별부문 의견이 아니다. A27은 예시이고 모든 항목의 항상 필수절차 목록이 아니다.');
 if(s.plan_id==='T09-D')exceptions.push('510.6(c)는 세 경로 중 하나 이상이며 현재 발문은 조서 외 두 경로의 회상을 요구한다. A6의 회수증거는 일부 증거이다.510.10/11 의견계열에서 광범위성에 대한 사실 없이 한 종류를 확정하지 않는다. 한국의A8 분리의견 예외와710 비교정보는 범위 밖이다.');
 if(s.plan_id==='T13-B')exceptions.push('공식610은23/24이며 통합학습자료의 종전22/23 표시와 구별한다. 610.5의 국내 직접적 보조 금지를 적용한다.610.A21은 유의적위험에 관한 수행된 업무의 활용을 제한된 판단 절차로 한정하며 전면활용금지가 아니다.610.A30의 재수행은 독립수행이며 이미 조사한 항목 또는 그 항목을 이용할 수 없으면 다른 유사항목으로 가능하다. 모든영역 전수재수행을 필수로 만들지 않는다.');
 if(s.plan_id==='T13-C')exceptions.push('402.A31~35의 보고기간과 실제테스트/경과시간·나머지기간의 증거 필요성을 보존한다. A38 예외사항 또는 변형의견이 있다고 항상 보고서 전체이용을 금지하지 않는다.18/A40은 감사와 관련되는 하위서비스에402 요구를 적용하며 모든 무관서비스에 같은 절차를 요구하지 않는다. N02 통제설계/실제실행/운영효과성 구별을 선행으로 삼고620 전문가나600 부문감사와 혼합하지 않는다.');
 const plan={version:1,set_id:s.id,topic_id:s.topic_id,mode:s.mode,status:'ready',objective:s.title,scope:{actors:domain[s.topic_id].actors,timing:[s.facts[0]],conditions:s.facts.slice(1),exceptions,required_answers:s.questions.map(q=>q.prompt),exclusions:s.exclusions},question_types:[...new Set(s.questions.map(q=>q.type))],source_unit_ids:[...new Set([...s.source_keys.map(k=>unit(k).id),...prior.flatMap(e=>e.source_unit_ids)])],existing_question_difference:s.difference,edition_assumption:policy+(s.topic_id==='05'?' '+lawPolicy:''),unresolved_items:[]};
 write(filename+'.authoring-plan.json',{version:1,artifact_type:'question_authoring_plan',plans:[plan]});
 write('evidence-packet-'+s.plan_id.toLowerCase()+'.json',{artifact_type:'manual_source_evidence_packet',set_id:s.id,plan_id:s.plan_id,automatic_packet_completeness:'not_claimed',not_generated_source_packet:true,model_input:'이 파일 자체는 자동 의미검수 입력이 아니다. 정답을 좌우하는 공식본문/적용자료는 실제source_refs에, 조건·판본한계는 실제version1 plan에 포함했다.',source_file:sourceFile,source_sha256:sha(sourceFile),bindings:set.subquestions.map(q=>({subquestion_id:q.id,prompt:q.prompt,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim,points:1,requirement:q.requirements.find(r=>r.id===c.requirement_id)}))})),source_units:s.source_keys.map(k=>({key:k,id:unit(k).id,locator:unit(k).locator,quote: block(k).quote,quote_sha256:hash(block(k).quote),pdf_start_page:block(k).pdf_start_page})),edition_comparison:'sources/edition-comparison.json'});
 const cases=[];
 for(let qi=0;qi<s.questions.length;qi++){
  const q=s.questions[qi],sq=set.subquestions[qi],n=q.claims.length,clauses=q.claims.map(c=>c.claim),yes=()=>Array(n).fill('met'),no=()=>Array(n).fill('not_met');
  const add=(id,kind,answer,vs,note='')=>{cases.push({id:`${sq.id}/${id}`,subquestion_id:sq.id,kind,answer,expected_points:vs.filter(x=>x==='met').length,expected_verdicts:vs.map((v,i)=>({criterion_id:sq.criteria[i].id,verdict:v,reason:v==='met'?'답안 전체에서 독립 요구를 충족한다.':v==='contradicted'?'대상 요구를 명시적으로 부정한다.':'해당 의미가 없거나 주체·목적·대상·조건·시점·증거수준이 다르다.'})),note});return `${sq.id}/${id}`;};
  const full=add('model-answer','model_answer',clauses.join('\n'),yes()),eq=add('equivalent','equivalent',q.equivalent,yes());add('reverse','reverse',clauses.toReversed().join('\n'),yes());add('single-sentence','single_sentence',clauses.map(c=>c.replace(/\.$/,'')).join('; ')+'.',yes());add('irrelevant-prefix','irrelevant_prefix','감사조서는 수행한 업무를 기록한다.\n'+q.equivalent,yes());add('empty','empty','',no());
  for(let i=0;i<n;i++){
   const vs=yes();vs[i]='not_met';let note='답안 전체에서 해당 요구의 의미가 남아 있는지 판단한다.';
   if((s.plan_id==='T09-D'&&qi===0&&i===0)||(s.plan_id==='T09-D'&&qi===1&&i===4)||(s.plan_id==='T13-C'&&qi===1&&i===0)){vs[i]='met';note='다른 문장의 조치 또는 일부증거 표현에서 판단/한계가 함축된다. 문장삭제를 진짜 명제 누락으로 오표시하지 않는다.';}
   const omission=add(`omit-${i+1}`,'omission',clauses.filter((_,j)=>j!==i).join('\n'),vs,note),contra=yes();contra[i]='contradicted';
   const opposite=add(`opposite-${i+1}`,'opposite',clauses.map((x,j)=>j===i?q.claims[i].opposite:x).join('\n'),contra,'반대명제 이외 독립적으로 충족한 요구는 득점한다.');
   const boundary=add(`boundary-${i+1}`,'condition_boundary',q.claims[i].boundary,no(),`target=${sq.criteria[i].id}; 반대문장 재분류가 아니라 주체·목적·대상·시점·적용조건 또는 증거수준을 바꾼 입력이다. 정답에 없는 추가요구를 만들지 않는다.`);
   coverage.push({plan_id:s.plan_id,set_id:s.id,subquestion_id:sq.id,criterion_id:sq.criteria[i].id,model_answer:full,equivalent:eq,omission,omission_is_genuine:vs[i]!=='met',opposite,condition_boundary:boundary,boundary_answer:q.claims[i].boundary});
  }
  if(s.plan_id==='T09-C'&&qi===1){const v=yes();v[0]=v[1]='contradicted';add('and-trigger','condition_boundary',clauses.slice(2).join('\n')+'\n식별된 소송의 중요왜곡표시위험과 다른 중요한 소송 가능성이 반드시 동시에 있어야 직접 커뮤니케이션을 모색한다.',v,'두 원문 OR 조건을 AND로 제한한 경계다. 작성·발송·회신·금지시 대안은 별개 득점.');}
  if(s.plan_id==='T09-C'&&qi===2){add('alternative-other-procedure','condition_boundary',clauses.slice(0,3).join('\n')+'\n이 상황에 적합한 기타 감사절차를 수행하며 분석적절차와 반드시 둘 다 수행할 의무는 아니다.',yes(),'원문의 또는 대안을 인정한다.');}
  if(s.plan_id==='T09-D'&&qi===0){const v=no();v[0]='met';v[2]='met';add('one-route-suffices-but-incomplete-list','condition_boundary','즉시 변형은 부적절하다. 기초잔액 특정절차를 수행할 수 있다. 510.6(c)는 하나 이상이므로 모든 감사에서 두 대체경로를 반드시 모두 할 의무는 아니다.',v,'한 경로로 충분할 수 있다는 조건은 맞지만 발문의 완전열거 중 당기절차 평가 명제는 누락.');}
  if(s.plan_id==='T09-D'&&qi===1){const v=no();v[0]='met';add('existence-without-scope-limit','condition_boundary','당기 회수내역은 개시일 채권의 실재성에 관한 증거가 된다.',v,'실재성 대상만 맞고 다른 주장·일부증거 한계·재고절차가 없는 부분답안.');}
  if(s.plan_id==='T13-B'&&qi===0){const v=no();v[2]='met';v[3]='met';add('significant-risk-limited-judgment','condition_boundary','유의적 위험이 높으므로 내부감사업무 활용을 줄이고 외부감사인의 직접 수행을 늘린다. 이미 수행된 절차가 제한된 판단만 수반하는 경우에는 그 업무를 활용할 수 있다.',v,'유의적 위험에서 일률적 전면금지로 확대하지 않는 부분답안.');}
  if(s.plan_id==='T13-B'&&qi===2){const v=no();v[1]='met';add('similar-item-reperformance','condition_boundary','활용할 업무 중 일부를 독립적으로 재수행한다. 내부감사인이 조사했던 항목을 다시 조사할 수 없다면 다른 유사항목을 독립적으로 조사할 수 있다.',v,'A30의 허용대안이며 원래 항목만을 다시 조사해야 한다는 숨은제약을 만들지 않는다.');}
  if(s.plan_id==='T13-C'&&qi===0){
   for(const [idx,label,answer]of [[0,'report-period-only','보고서가 기술한 통제의 설계와 운영효과성이 감사목적에 맞는 기간의 것인지 평가한다.'],[2,'complementary-design-only','관련된 보충적인 이용자기업 통제를 회사가 설계했는지 이해한다.'],[5,'test-coverage-only','실제 통제테스트의 대상이7~9월이므로 그 테스트 대상기간이 감사목적상 적절한지 평가한다.'],[6,'test-recency-only','9월30일 테스트 수행 후 경과된 시간이 감사목적상 적절한지 평가한다.']]){const v=no();v[idx]='met';add(label,'condition_boundary',answer,v,'서로 다른 시간범위 또는 통제속성의 독립 득점 경계.');}
  }
 }
 const qafile='qa-cases-'+s.plan_id.toLowerCase()+'.json';write(qafile,{version:1,artifact_type:'author_expected_judgments',set_id:s.id,draft_sha256:sha(path.join(base,filename)),live_model_grading:'not_run',human_approval:false,expectation_policy:'원문·독립 명제·G1/G3에 따른 작성자 사전 기대값이며 모델 결과가 아니다. condition_boundary의not_met/contradicted 0점 동등은 총괄 runner 정책을 따르되 met는 구별한다.',cases});
 lineage.push({plan_id:s.plan_id,set_id:s.id,kind:'new',stage:'candidate_prepared',actual_file:rel(path.join(base,filename)),sha256:sha(path.join(base,filename)),plan_file:rel(path.join(base,filename+'.authoring-plan.json')),plan_sha256:sha(path.join(base,filename+'.authoring-plan.json')),qa_file:rel(path.join(base,qafile)),qa_sha256:sha(path.join(base,qafile)),evidence_file:rel(path.join(base,'evidence-packet-'+s.plan_id.toLowerCase()+'.json')),plan_question_map:set.subquestions.map((q,i)=>({plan_question_id:`${s.plan_id}-Q${i+1}`,subquestion_id:q.id,points:q.criteria.length})),points:set.subquestions.reduce((n,q)=>n+q.criteria.length,0),qa_cases:cases.length});
}
write('lineage.json',{package:'S03',stage:'candidate_prepared',sets:lineage});write('qa-coverage.json',{artifact_type:'author_qa_criterion_coverage',criterion_count:coverage.length,rows:coverage,limitations:'각명제의 사전 기대 사례 범위표이며 실제 모델검수·채점 통과 증거가 아니다.'});
write('design-changes.json',{package:'S03',original:{sets:5,questions:13,points:36},current:{sets:5,questions:13,points:62},policy:'총괄은 독립적으로 누락 가능한 요구를 분리하도록 승인했다. 단어·주체/대상/조건의 기계적 분할이나 주어진 사실의 배점은 제외한다.',rows:specifications.flatMap(s=>s.questions.map((q,i)=>({plan_question_id:`${s.plan_id}-Q${i+1}`,before:original[s.plan_id][i],after:q.claims.length,reason:changes[s.plan_id][i],claims:q.claims.map(c=>({claim:c.claim,points:1,source:c.key}))})))});
console.log(JSON.stringify({sets:5,questions:13,points:62,qa_cases:lineage.reduce((n,s)=>n+s.qa_cases,0),per_set:lineage.map(s=>({id:s.set_id,points:s.points,qa:s.qa_cases}))}));
