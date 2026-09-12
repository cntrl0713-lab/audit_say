import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import specs,{edition} from './content.mjs';

const base=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const rel=f=>path.relative(root,f).replaceAll('\\','/');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const sha=f=>hash(fs.readFileSync(f));
const write=(name,value)=>fs.writeFileSync(path.join(base,name),JSON.stringify(value,null,2)+'\n');
const source='cpa_uploader/data/official/delegated-s05-kga-2025.txt';
const catalog=buildSourceCatalog();
const ownUnits=catalog.units.filter(u=>u.file===source);
const unit=key=>{const [std,para]=key.split('.');const u=ownUnits.find(u=>u.standard===`KGA ${std}`&&u.paragraph===para);if(!u)throw Error(key);return u;};
const ledger=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json');
const chapters={'14':'그룹감사','15':'감사의견과 보고','16':'감사보고의 특수사항'};
const supplementary=catalog.units.filter(u=>(u.file==='cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt'&&u.standard==='KGA 701'&&['9','10'].includes(u.paragraph))
 || (u.file==='cpa_uploader/data/official/delegated-s05-kga230-context-2025.txt'&&u.standard==='KGA 230')
 || (u.file==='cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt'&&u.standard==='KGA 230'&&['9','10','11'].includes(u.paragraph)));
if(supplementary.length!==7)throw Error('701 선정 단계 및 230 문서화의 공식 문맥 부재');
const lineage=[];
for(const s of specs){
 const assigned=ledger.entries.find(e=>e.plan_id===s.plan);
 if(!assigned||assigned.package!=='S05'||assigned.questions.length!==s.qs.length)throw Error('S05 ID 배정 오류');
 const refs=s.paras.map(key=>{const u=unit(key);return {id:u.id,file:source,title:`${u.standard} 문단 ${u.paragraph}; ${u.locator}; 2025 전문`,page:u.standard,source_quote:u.quote,role:'standard',content_hash:hash(u.quote)};});
 const set={schema_version:'3.0',id:assigned.set_id,type:'linked_question_set',status:'needs_review',title:s.title,
  classification:{topic_id:s.topic,part:'PART4',chapter:chapters[s.topic],domain:'audit',standards:s.standards,tags:[s.title,chapters[s.topic]]},
  source_refs:refs,shared_context:{facts:s.facts.map((text,i)=>({id:`f${i+1}`,text,scoreable:false}))},
  learning_order:assigned.questions.map(q=>q.suggested_id),
  subquestions:s.qs.map((q,i)=>{const id=assigned.questions[i].suggested_id;return {id,type:q.type,prompt:q.prompt,
   constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},
   decision:q.type==='judgment'?{options:['적절하다','부적절하다'],correct:q.correct}:null,
   answer_slots:[{id:`${id}.answer`,label:'답안',input:'textarea'}],model_answer:q.claims.map(c=>c.claim),
   requirements:q.claims.map((c,j)=>({id:`${id}.req${j+1}`,source_ref_id:unit(c.ref).id,source_quote:unit(c.ref).quote,source_span:`${unit(c.ref).locator}; 직접 요구 범위: ${c.scope}`})),
   criteria:q.claims.map((c,j)=>({id:`${id}.crit${j+1}`,requirement_id:`${id}.req${j+1}`,claim:c.claim,
    critical_facts:[{id:`${id}.crit${j+1}.claim`,type:'action',expected:c.claim}],
    max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[unit(c.ref).id]}))};}),
  verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[edition,
   '총괄이 ID 장부에 따라 수동 작성했다. 공식 인용은 등록 파일의 실제 연속 문자열이며 사례·발문·답안은 재구성했다. 자동 생성 source packet의 완전성을 주장하지 않는다.',
   '중간 인계와 모델 의미검수·실제 채점·사람 승인을 구별한다. 전체 비교 은행 고정 후 실제 모델 검수와 모든 사전 기대사례 채점을 수행한다.',
   s.difference]}};
 const file=`${set.id}.json`;write(file,set);
 const extra=s.topic==='16'?supplementary:[];
 const plan={version:1,set_id:set.id,topic_id:s.topic,mode:'adapt_existing_question',status:'ready',objective:s.title,
  scope:{actors:s.topic==='14'?['그룹업무팀','부문감사인']:['감사인','업무수행이사','경영진과 지배기구'],timing:[s.facts[0]],conditions:s.facts.slice(1),
   exceptions:[...s.exceptions,...extra.map(u=>`주변 공식 문맥 ${u.id}, ${u.file}, ${u.locator}, 파일 SHA256 ${sha(u.file)}, 인용 SHA256 ${hash(u.quote)}: ${u.quote}`)],
   required_answers:s.qs.map(q=>q.prompt),exclusions:s.exclusions},question_types:[...new Set(s.qs.map(q=>q.type))],
  source_unit_ids:[...new Set([...s.paras.map(p=>unit(p).id),...extra.map(u=>u.id),...s.learning])],existing_question_difference:s.difference,edition_assumption:edition,unresolved_items:[]};
 for(const id of plan.source_unit_ids)if(!catalog.units.some(u=>u.id===id))throw Error(`source ID 부재 ${id}`);
 write(file+'.authoring-plan.json',{artifact_type:'question_authoring_plan',version:1,plans:[plan]});
 const cases=[];
 for(const [i,q] of s.qs.entries()){
  const sq=set.subquestions[i],n=q.claims.length,clauses=q.claims.map(c=>c.claim),yes=()=>Array(n).fill('met');
  const add=(id,kind,answer,vs,note='')=>cases.push({id:`${sq.id}/${id}`,subquestion_id:sq.id,kind,answer,expected_points:vs.filter(v=>v==='met').length,
   expected_verdicts:vs.map((verdict,j)=>({criterion_id:sq.criteria[j].id,verdict,reason:verdict==='met'?'전체 답안이 발문에서 요구한 이 명제를 직접 또는 명확한 함축으로 충족한다.':verdict==='contradicted'?'명시적으로 바꾼 주체·대상·조건·결론이 공식 요구와 반대다.':'나머지 문장을 함께 읽어도 요구된 명제가 제시되지 않거나 불완전하다.'})),note});
  add('stored-model','model',clauses.join('\n'),yes());
  add('equivalent','equivalent',q.equivalent,yes());
  add('reverse-order','reverse-order',clauses.toReversed().join('\n'),yes());
  add('single-sentence','single-sentence',clauses.map(c=>c.replace(/\.$/, '')).join('; ')+'.',yes());
  add('irrelevant-prefix','irrelevant-prefix','감사팀은 이번 주 금요일에 자료실을 정리한다.\n'+q.equivalent,yes());
  add('empty','empty','',Array(n).fill('not_met'));
  add('unrelated','omission','감사보고서는 여러 이용자가 읽는다.',Array(n).fill('not_met'),'어느 요구 명제도 답하지 않은 비빈답안이다. 특히 판단형의 이유가 판단을 함축하는 방향에서는 판단문장만 지운 사례를 진짜 누락으로 만들지 않고 판단·이유가 모두 없는 이 사례를 함께 확인한다.');
  for(let j=0;j<n;j++){
   const vs=yes();vs[j]='not_met';let answer=clauses.filter((_,k)=>j!==k).join('\n');
   if(s.plan==='T14-C'&&(i===1||i===2)&&j===0){vs[0]='met';add(`implicit-${j+1}`,'implicit-judgment',answer,vs,'그룹팀의 최종 결정 의무 또는 산술배분 의무 부재의 이유가 제안에 대한 부적절 판단을 분명히 함축한다. 판단 문장만 삭제한 것을 실제 누락으로 취급하지 않는다.');}
   else add(`omit-${j+1}`,'omission',answer,vs);
   add(`opposite-${j+1}`,'opposite',clauses.map((text,k)=>j===k?q.claims[j].opposite:text).join('\n'),yes().map((v,k)=>k===j?'contradicted':v));
   // Expected noncredit follows the actual changed actor/condition/object; raw
   // not_met vs contradicted is separately retained by the QA runner.
   const incomplete=(s.plan==='T15-A'&&i===0&&j===3);
   add(`boundary-${j+1}`,'condition_boundary',clauses.map((text,k)=>j===k?q.claims[j].boundary:text).join('\n'),yes().map((v,k)=>k===j?(incomplete?'not_met':'contradicted'):v),'실제 주체·대상·충족조건·예외를 변경한 사례. 단순한 정답 부정 사례와 별도로 대조한다.');
  }
  if(s.plan==='T14-C'&&(i===1||i===2)){
   add('judgment-only','judgment-only','제안은 부적절하다.',['met','not_met']);
   add('explicit-conflict','explicit-conflict','제안은 적절하다. '+clauses[1],['contradicted','met'],'명시적인 반대 판단은 후속 설명에서 함축된 판단으로 상쇄하지 않는다. 별도로 정확히 쓴 근거는 해당 계약대로 인정한다.');
  }
  if(s.plan==='T15-B'&&i===0)add('date-only','date-only','2027년 3월 12일이다.',['met','not_met','not_met','not_met'],'사례의 날짜 결론만 제시했고 별도로 요구한 규범적 조건은 생략했다.');
  if(s.plan==='T16-C'&&i===1)add('only-nondisclosure','partial-answer',clauses[3],['not_met','not_met','not_met','met'],'비공개 사유만 기록한다는 답이 전체 KAM 문서화 요구를 대체하지 않는다.');
 }
 write(`qa-cases-${s.plan.toLowerCase()}.json`,{version:1,artifact_type:'author_expected_judgments',set_id:set.id,expectation_policy:'공식 원문과 확정 발문/criterion에서 사전에 판단했다. 아직 실제 모델 결과가 아니며 통과를 위한 기대값 변경을 하지 않는다.',cases});
 write(`evidence-packet-${s.plan.toLowerCase()}.json`,{artifact_type:'manual_source_evidence_packet',not_generated_source_packet:true,plan_id:s.plan,set_id:set.id,
  source_file:source,source_file_sha256:sha(source),official_evidence:'sources/official-comparison.json',learning_evidence:'sources/learning-source-units.json',
  model_input:'직접 및 주변 공식 문맥은 source_refs와 plan.scope에 포함한다. 이 수동 증거 파일을 --packet으로 전달하지 않는다.',
  mapping:set.subquestions.map((q,i)=>({plan_question_id:`${s.plan}-Q${i+1}`,id:q.id,learning_objective:s.title,prompt:q.prompt,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim,points:1,requirement:q.requirements.find(r=>r.id===c.requirement_id)}))}))});
 lineage.push({plan_id:s.plan,set_id:set.id,stage:'candidate_prepared',file:rel(path.join(base,file)),sha256:sha(path.join(base,file)),
  plan_file:rel(path.join(base,file+'.authoring-plan.json')),plan_sha256:sha(path.join(base,file+'.authoring-plan.json')),
  qa_file:rel(path.join(base,`qa-cases-${s.plan.toLowerCase()}.json`)),qa_sha256:sha(path.join(base,`qa-cases-${s.plan.toLowerCase()}.json`)),
  questions:set.subquestions.length,points:set.subquestions.reduce((n,q)=>n+q.criteria.length,0),qa_cases:cases.length,
  question_mapping:assigned.questions.map((q,i)=>({...q,actual_id:set.subquestions[i].id,actual_points:set.subquestions[i].criteria.length}))});
}
write('lineage.json',{package:'S05',author:'root',stage:'candidate_prepared',entries:lineage});
write('design-changes.json',{package:'S05',original:{sets:4,questions:9,points:25},current:{sets:4,questions:9,points:27},changes:[
 {question:'T15-B-Q1',before:3,after:4,reason:'요구한 가장 빠른 날짜 결론을 조건 세 가지와 별도로1점 부여한다. 제시 날짜의 반복만으로 규범적 조건 점수를 주지 않는다.'},
 {question:'T16-C-Q2',before:3,after:4,reason:'공식701.18(a)의 유의적 감사인 주의 사항 기록과 각 사항의 KAM 해당 여부 판단 근거는 독립적으로 누락 가능하여각1점으로분리했다. (b)의 두 대안과(c)의 비공개근거 및 해당되는 경우 조건은 유지한다.'},
 {question:'T15-A-Q1',before:4,after:4,reason:'제목의 직접근거를705.16으로보강했다. 원기출의 올바른 의견미표명문구까지오류로 간주하지 않고새초안의문장다를명확한오류로설계했다.'},
 {question:'T15-B-Q2',before:3,after:3,reason:'계획의 일반불편·평판예를 공식700.A63에 명시된법적책임·제재위협사례로구체화했다. 개인안전위협에관한평가와지배기구논의요구를구별하며지배기구동의의무를만들지않았다.'},
 {question:'T16-C-Q1',before:3,after:3,reason:'경영진 요청으로생략결론을이미주지않고감사인평가가필요한상황으로재구성했다. 사전공시는14(b)에만연결한다.'},
]});
console.log(JSON.stringify({sets:lineage.length,questions:lineage.reduce((n,e)=>n+e.questions,0),points:lineage.reduce((n,e)=>n+e.points,0),qa_cases:lineage.reduce((n,e)=>n+e.qa_cases,0)}));
