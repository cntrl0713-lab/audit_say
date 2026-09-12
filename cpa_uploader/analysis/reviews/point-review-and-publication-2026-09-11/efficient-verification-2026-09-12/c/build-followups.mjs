import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const E=`${D}/efficient-verification-2026-09-12/c`;
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const fh=f=>sha(fs.readFileSync(f));
const copy=x=>structuredClone(x);
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const master=read(`${D}/a/execution-all-v9/manifest.json`),bank=read(master.bank_file);
const classifications=read(`${D}/c/prepared-reviewed-v8/learning-question-classifications.json`).classifications;
const reason10='KGA 520.5(b), A12의 원천·비교가능성·성격·관련성·작성통제는 일반적으로 열거할 다섯 속성이므로 새 기준서형 sub4로 분리한다. A12(c)의 예시는 둘을 함께 설명하지만 원문 5(b)의 두 평가 속성은 독립적으로 충족할 수 있다. 사례 B에는 이미 계산한 기대치의 정확성 평가, 수용 차이 결정과 그 중요성·확신수준·평가위험 고려 및 종료 판단만 남긴다. 11점을 한 물음에 부여하지 않고 사례 6점과 독립 기준서 5점으로 나눈다. 주어진 계산·적합성 판단과 A15의 추가 예시는 새 배점하지 않는다.';
const reason16='720.18의 일반 보고영향 고려와 구체 기타정보 단락의 처리는 같은 대응의 일반·구체 관계이므로 중복 2점으로 세지 않는다. 3점은 자동 재무제표 의견거절 부정(crit1), 중요한 미수정 기타정보를 보고서에 표시하는 구체 처리(crit2, 보고영향 고려 포함), 그 보고계획의 지배기구 전달(crit3)이다. 원발문 요구를 보존하면서 합성 crit1의 판단 점수를 복원하고 일반 고려 문구를 별도 추가점수로 늘리지 않는다.';
const reason17='1100.79의 다른 경영진 진술 의존능력 평가는 재무제표감사 영향 고려에 포함된다. 둘을 일반·구체 행동으로 중복 배점하지 않고 3점을 유지한다. 내부회계 의견거절(crit3), 재무제표감사 진술을 포함한 다른 진술 의존능력의 영향 평가라는 구체 고려(crit4), 재무제표 의견의 자동 동일 부정(crit5)을 구별한다. 구체 평가에서 재무제표감사 영향을 설명해도 인정하며, 영향 고려라는 일반 제목만으로 요구한 구체 평가를 대체하지는 않는다.';
const reasons={'pilot-10-007':reason10,'pilot-16-011':reason16,'pilot-17-005':reason17};
function change(c,claim,scope){c.claim=claim;c.critical_facts=[{id:c.critical_facts[0].id,type:c.critical_facts[0].type,expected:claim,...(scope?{scope}:{})}];return c;}
function add(base,id,claim,scope){const c=copy(base);c.id=id;c.critical_facts[0].id=`${id}.fact`;return change(c,claim,scope);}
function judgments(q,met=[],contra=[],why='원문·발문·분리 명제와 답안 전체를 직접 대조했다. 독립적인 누락과 명시적 반대를 구별한다.') {return q.criteria.map(c=>({criterion_id:c.id,verdict:contra.includes(c.id)?'contradicted':met.includes(c.id)?'met':'not_met',reason:why}));}
function tc(q,id,answer,met,contra=[],kind='independent_partial',why){const ev=judgments(q,met,contra,why);return {id,subquestion_id:q.id,kind,answer,expected_points:ev.filter(v=>v.verdict==='met').length,expected_verdicts:ev,note:why??'agent가 현재 발문·명제와 공식 원문으로 정한 기대값. API 미실행.'};}
const selected=[];
for(const id of Object.keys(reasons)){
 const job=master.jobs.find(j=>j.set_id===id),before=bank.find(s=>s.id===id),s=copy(before),oldqa=read(job.qa_file),qa=copy(oldqa);
 const pv=read(job.plan_file),p=copy(pv.plans?.find(p=>p.set_id===id)??pv);
 const dir=`${E}/content-followups-v1/${id}`;fs.mkdirSync(dir,{recursive:true});
 const oldqid=id==='pilot-16-011'?'sub1':'sub2';const q=s.subquestions.find(q=>q.id===oldqid),oldq=copy(q);
 const maps=[];let derivative=null;
 if(id==='pilot-10-007'){
  const by=Object.fromEntries(q.criteria.map(c=>[c.id,c]));
  q.prompt='상황 B의 종료 계획이 적절한지 판단하시오. 이미 계산한 값을 감사인의 기대치로 이용할 때 보완할 정확성 평가와 추가조사 없이 수용할 차이의 결정 및 그 결정에 고려할 요인을 설명하시오. 이미 완료한 절차 적합성 판단과 기초자료 신뢰성 평가의 고려사항 목록은 답안 범위에서 제외한다.';
  const q4=copy(q);q4.id='sub4';q4.type='descriptive';
  q4.prompt='실증적인 분석적절차에서 감사인의 기대치를 도출할 데이터의 신뢰성을 평가할 때 고려하여야 하는 정보의 속성과 작성 관련 사항을 모두 제시하시오.';
  q4.requirements=oldq.requirements.filter(r=>r.id==='req5');
  const scope4='기준서형 열거 요구이다. 정보의 원천·비교가능성·성격·관련성·작성통제는 각각 독립 1점이며 명칭 또는 같은 의미의 설명이면 충분하다. A12의 예시나 회사 자료를 다시 설명하는 것은 필수 요건이 아니다.';
  change(by.crit12,'기대치를 도출할 데이터의 신뢰성을 평가할 때 이용가능한 정보의 성격을 고려한다.',scope4);
  const relevance=add(by.crit12,'crit14','기대치를 도출할 데이터의 신뢰성을 평가할 때 이용가능한 정보의 관련성을 고려한다.',scope4);
  q4.criteria=[by.crit5,by.crit11,by.crit12,relevance,by.crit13];
  for(const c of q4.criteria){c.critical_facts[0].scope=scope4;}
  q4.model_answer=q4.criteria.map(c=>c.claim);
  const scope7='차이를 결정한다는 행위와 결정요인을 분리한다. 추가조사 없이 수용할 차이금액을 정한다는 뜻이면 이 기준을 인정하며 중요성·확신수준·평가위험의 누락이나 잘못된 설명만으로 이 행위 점수까지 중복 감점하지 않는다.';
  change(by.crit7,'추가 조사 없이 수용할 수 있는 기록금액과 감사인 기대치의 차이금액을 결정해야 한다.',scope7);
  const factors=[['crit15','수용할 차이금액을 결정할 때 중요성을 고려한다.'],['crit16','수용할 차이금액을 결정할 때 요구되는 확신수준을 고려한다.'],['crit17','수용할 차이금액을 결정할 때 평가된 중요왜곡표시위험을 고려한다.']].map(([cid,claim])=>add(by.crit7,cid,claim,'수용 차이 결정의 해당 요인을 정확히 식별하거나 같은 뜻으로 설명하면 1점이다. 다른 요인이나 결정행위 문구는 이 기준의 추가 필수조건이 아니다. 위험이 높을수록 다른 조건이 같을 때 차이를 늘린다는 설명은 위험의 관계를 반대로 적용한 것이므로 crit17은 반대이다.'));
  q.criteria=[by.crit4,by.crit6,by.crit7,...factors];q.requirements=oldq.requirements.filter(r=>r.id!=='req5');
  q.model_answer=[by.crit4.claim,by.crit6.claim,by.crit7.claim,...factors.map(c=>c.claim)];
  // Existing source-set is legacy mixed storage. Keep its historical schema and classify every learning projection via sidecar.
  derivative={...copy(s),id:'pilot-10-007-standards',title:'실증적 분석절차에 이용하는 데이터의 신뢰성',shared_context:{facts:[]},subquestions:[q4],learning_order:['sub4']};
  q4.question_style='standard';q4.topic_ids=['08','10'];
  derivative.classification.tags.push('pilot-10-007-sub2-동일요구분리');
  // Every preserved answer was read. These rules only materialize the declared per-answer component map.
  qa.cases=oldqa.cases.flatMap(c=>{
   if(c.subquestion_id!==oldqid)return [copy(c)];
   const v=Object.fromEntries(c.expected_verdicts.map(v=>[v.criterion_id,v.verdict]));
   const decision=['sub2-crit7-opposite','sub2-crit7-condition-boundary'].includes(c.id)?'met':v.crit7;
   const factorVerdict=v.crit7==='met'?'met':v.crit7==='contradicted'?'contradicted':'not_met';
   const map2={crit4:v.crit4,crit6:v.crit6,crit7:decision,crit15:factorVerdict,crit16:factorVerdict,crit17:factorVerdict};
   if(c.id==='sub2-crit7-condition-boundary'){map2.crit15='not_met';map2.crit16='not_met';}
   const map4={crit5:v.crit5,crit11:v.crit11,crit12:v.crit12,crit14:v.crit12,crit13:v.crit13};
   const why='전체 원답안을 그대로 보존한 직접 재평가. 원천·비교가능성·성격·관련성·통제는 sub4에만 득점한다. sub2의 종료 판단은 답안이 필요한 보완을 명백히 지시하면 함축을 인정한다. 수용차이 결정행위와 각 요인은 별개이므로 잘못된 결정요인이 행위 자체의 식별까지 소거하지 않는다.';
   const make=(target,mm,newid)=>{const out=copy(c);out.id=newid;out.subquestion_id=target.id;out.expected_verdicts=target.criteria.map(x=>({criterion_id:x.id,verdict:mm[x.id],reason:why}));out.expected_points=out.expected_verdicts.filter(x=>x.verdict==='met').length;out.origin={file:job.qa_file,case_id:c.id};out.note=why;return out;};
   const c2=make(q,map2,c.id),c4=make(q4,map4,`split-to-sub4/${c.id}`);maps.push({original_case_id:c.id,original_answer_sha256:sha(c.answer),original_expected_points:c.expected_points,sub2:c2.expected_verdicts,sub4:c4.expected_verdicts});return [c2,c4];
  });
  // Neutral component-only responses and real relation boundaries supplement preserved compound answers.
  const own2=[
   tc(q,'efficient/sub2/stored-model',q.model_answer.join('\n'),q.criteria.map(c=>c.id),[],'stored_model_answer'),
   tc(q,'efficient/sub2/precision-only',by.crit6.claim,['crit4','crit6']),
   tc(q,'efficient/sub2/difference-only',by.crit7.claim,['crit4','crit7']),
   tc(q,'efficient/sub2/importance-only','추가조사 없이 수용할 차이의 결정에는 중요성을 고려한다.',['crit4','crit7','crit15']),
   tc(q,'efficient/sub2/confidence-only','수용할 차이를 정할 때 요구되는 확신수준을 고려한다.',['crit4','crit7','crit16']),
   tc(q,'efficient/sub2/risk-only','수용할 차이의 결정에는 평가된 중요왜곡표시위험을 고려한다.',['crit4','crit7','crit17']),
   tc(q,'efficient/sub2/close-is-enough','상황 B는 계산값과 장부금액이 비슷하므로 그대로 종료해도 적절하다.',[],['crit4'],'wrong'),
   tc(q,'efficient/sub2/blank','',[],[],'empty')];
  const own4=[tc(q4,'efficient/sub4/stored-model',q4.model_answer.join('\n'),q4.criteria.map(c=>c.id),[],'stored_model_answer'),tc(q4,'efficient/sub4/names','원천, 비교가능성, 성격, 관련성, 정보 작성에 대한 통제',q4.criteria.map(c=>c.id),[],'enumeration'),tc(q4,'efficient/sub4/nature-only','이용가능한 정보의 성격',['crit12']),tc(q4,'efficient/sub4/relevance-only','이용가능한 정보의 관련성',['crit14']),tc(q4,'efficient/sub4/nature-wrong-relevance-right','정보의 성격은 고려할 필요가 없지만 관련성은 고려한다.',['crit14'],['crit12'],'boundary'),tc(q4,'efficient/sub4/relevance-wrong-nature-right','정보의 성격은 고려하지만 관련성은 고려할 필요가 없다.',['crit12'],['crit14'],'boundary'),tc(q4,'efficient/sub4/irrelevant','감사보고서의 글자 크기와 종이 두께를 고려한다.',[],[],'wrong'),tc(q4,'efficient/sub4/blank','',[],[],'empty')];
  qa.cases.push(...own2,...own4);
 }else{
  const c=q.criteria.find(c=>c.id===(id==='pilot-16-011'?'crit1':'crit5'));
  if(id==='pilot-16-011'){
   change(c,'갑의 기타정보 수정거부만으로 재무제표 감사의견을 자동으로 거절해야 하는 것은 아니다.','A45의 드문 상황이 없는 갑의 사실에 적용하는 판단이다. 일반적인 보고영향 고려는 기타정보 단락 처리와 중복하여 별도 점수화하지 않는다. 이 판단을 분명히 함축하는 설명도 인정한다.');
   const report=q.criteria.find(c=>c.id==='crit2');report.critical_facts[0].scope='720.18의 보고영향을 고려하여 기타정보 단락에 중요한 미수정왜곡표시를 기술하는 구체 조치를 요구한다. 일반적으로 영향만 고려한다는 말은 이 구체 요구를 완성하지 못한다. 일반·구체 조치에 2점을 중복 부여하지 않는다.';
   q.model_answer=[c.claim,...oldq.model_answer.slice(1)];
  }else{
   change(c,'내부회계관리제도에 대한 의견거절이라는 이유만으로 재무제표 감사의견까지 자동으로 거절되는 것은 아니다.','이 판단을 분명히 함축하는 설명은 인정한다. 재무제표감사 영향의 구체 고려는 crit4에서 평가하며 일반·구체 행동을 중복 배점하지 않는다.');
   const reliance=q.criteria.find(c=>c.id==='crit4');reliance.critical_facts[0].scope='재무제표감사에 미치는 영향으로 다른 진술의 의존능력 평가를 설명해도 인정한다. 1100.79의 포함관계에 따른 구체 평가이며, 일반적으로 재무제표감사 영향만 고려한다는 말은 요구한 다른 진술 의존능력 평가를 완성하지 못한다.';
   q.model_answer=[oldq.model_answer[0],oldq.model_answer[1]+' 이는 재무제표감사에 미치는 영향의 고려에 포함된다.',c.claim];
  }
  for(const out of qa.cases.filter(c=>c.subquestion_id===oldqid)){
   const old=oldqa.cases.find(c=>c.id===out.id),v=Object.fromEntries(old.expected_verdicts.map(v=>[v.criterion_id,v.verdict]));
   let vv;
   if(id==='pilot-16-011'){
    vv={crit1:v.crit1,crit2:v.crit2,crit3:v.crit3};
   }else vv={crit3:v.crit3,crit4:v.crit4,crit5:v.crit5};
   out.expected_verdicts=q.criteria.map(c=>({criterion_id:c.id,verdict:vv[c.id],reason:reasons[id]}));out.expected_points=out.expected_verdicts.filter(v=>v.verdict==='met').length;out.note=reasons[id];out.origin={file:job.qa_file,case_id:old.id};
   maps.push({original_case_id:old.id,answer_sha256:sha(old.answer),before:old.expected_verdicts,after:out.expected_verdicts});
  }
  const all=q.criteria.map(c=>c.id);qa.cases.push(tc(q,`efficient/${q.id}/stored-model`,q.model_answer.join('\n'),all,[],'stored_model_answer'));
  if(id==='pilot-16-011')qa.cases.push(tc(q,'efficient/sub1/report-effect-only','기타정보의 중요한 미수정왜곡표시가 감사보고서에 미치는 시사점을 고려해야 한다.',[]),tc(q,'efficient/sub1/no-automatic-disclaimer-only','이 기타정보 수정거부만으로 재무제표 감사의견까지 자동으로 거절되는 것은 아니다.',['crit1']),tc(q,'efficient/sub1/consider-but-wrong-opinion','감사보고서에 미치는 시사점은 고려하되 이 기타정보 수정거부만으로 재무제표감사의견을 반드시 거절해야 한다.',[],['crit1'],'boundary'),tc(q,'efficient/sub1/report-action-only',oldq.model_answer[1],['crit2']));
  else qa.cases.push(tc(q,'efficient/sub2/fs-effect-only','서면진술 제공 거부가 재무제표감사에 미치는 영향을 별도로 고려해야 한다.',[]),tc(q,'efficient/sub2/no-automatic-opinion-only','내부회계관리제도 의견거절만으로 재무제표 감사의견까지 자동으로 거절하는 것은 아니다.',['crit5']),tc(q,'efficient/sub2/consider-but-automatic','재무제표감사에 미치는 영향은 고려한다. 그러나 내부회계 의견거절이면 재무제표 의견도 반드시 거절된다.',[],['crit5'],'boundary'),tc(q,'efficient/sub2/fs-representation-effect','재무제표감사에 미치는 영향으로, 그 감사에서 입수한 진술을 포함한 다른 경영진 진술에 의존할 수 있는 능력에 대한 영향을 평가한다.',['crit4']));
 }
 p.scope.required_answers=s.subquestions.map(q=>`${q.id}: ${q.prompt} 배점명제: ${q.criteria.map(c=>`${c.id}=${c.claim}`).join(' / ')}`);
 p.scope.conditions=p.scope.conditions.filter(x=>!x.startsWith('2026-09-11 승인된 후속 배점:'));
 p.scope.conditions.push(`[2026-09-12 내용·배점 보완] ${reasons[id]}`);
 p.existing_question_difference += ` [2026-09-12 후속] ${reasons[id]} 과거 계획의 합성 배점 설명은 당시 기록이며 현재 계약은 위 물음별 required_answers를 따른다. 기존 커버리지 안의 분할이며 새 출제 빈도나 새 커버리지로 세지 않는다.`;
 p.objective+=` ${reasons[id]}`;p.question_types=[...new Set(s.subquestions.map(q=>q.type))];
 const cls=classifications.filter(c=>c.source_set_id===id).map(copy);
 for(const cl of cls){const qq=s.subquestions.find(q=>q.id===cl.subquestion_id);if(cl.subquestion_id===oldqid){cl.reason=reasons[id];cl.standalone_prompt=null;}if(qq.question_style){cl.question_style=qq.question_style;cl.topic_ids=qq.topic_ids;}}
 if(derivative){
  const dd=`${E}/content-followups-v1/${derivative.id}`;fs.mkdirSync(dd,{recursive:true});
  const dqa={version:1,artifact_type:'author_expected_judgments',set_id:derivative.id,cases:qa.cases.filter(c=>c.subquestion_id==='sub4')};qa.cases=qa.cases.filter(c=>c.subquestion_id!=='sub4');
  const dp=copy(p);dp.set_id=derivative.id;dp.objective='원 pilot-10-007/sub2의 데이터 신뢰성 고려요소를 부모 사례 없이 풀이하는 기준서형으로 분리한다.';dp.scope={actors:['감사인'],timing:p.scope.timing,conditions:['실증적 분석절차의 기대치 도출에 이용하는 데이터의 신뢰성을 평가한다.'],exceptions:['A12의 구체 예시는 별도 필수 목록이 아니며 정보의 상황에 적합한 신뢰성 고려요소를 설명하면 된다.'],required_answers:derivative.subquestions.flatMap(q=>q.criteria.map(c=>`${q.id}/${c.id}: ${c.claim}`)),exclusions:['원 상황 B의 종료판단·정확성 평가·수용 차이 결정','A12의 예시를 모두 암기하거나 회사명을 반복하는 요구','새 커버리지 또는 새 출제 빈도 주장']};dp.question_types=['descriptive'];dp.existing_question_difference=reason10+' 원 pilot-10-007/sub2의 crit5/crit11/crit12/crit13을 이관하고 crit12의 관련성을 crit14로 나누었다. 새 set ID는 동일 요구를 독립 풀이하기 위한 저장 분리이며 신출제가 아니다.';
  const dcls={source_set_id:derivative.id,subquestion_id:'sub4',question_style:'standard',topic_ids:['08','10'],reason:reason10,case_fact_ids:[],standalone_prompt:derivative.subquestions[0].prompt};
  write(`${dd}/question.json`,[derivative]);write(`${dd}/authoring-plan.json`,dp);write(`${dd}/qa.json`,dqa);write(`${dd}/classification.json`,{version:1,classifications:[dcls]});
  const di={set_id:derivative.id,file:`${dd}/question.json`,sha256:fh(`${dd}/question.json`),plan_file:`${dd}/authoring-plan.json`,plan_sha256:fh(`${dd}/authoring-plan.json`),qa_file:`${dd}/qa.json`,qa_sha256:fh(`${dd}/qa.json`),derived_from:{set_id:id,subquestion_id:oldqid}};selected.push(di);
  write(`${dd}/changes.json`,{version:1,reviewer:'agent',status:'agent_content_followup_prepared_api_not_run',before:{file:job.file,sha256:fh(job.file),set_id:id,subquestion_id:oldqid},after:di,reason:reason10,existing_criterion_ids_moved:['crit5','crit11','crit12','crit13'],new_split_criterion_id:'crit14',source_refs_unchanged_from_parent:true,original_answers_preserved_in_projection:dqa.cases.filter(c=>c.origin?.file===job.qa_file).length,api_calls:0});
 }
 for(const out of qa.cases){const qq=s.subquestions.find(q=>q.id===out.subquestion_id);assert(qq);assert.deepEqual([...out.expected_verdicts.map(v=>v.criterion_id)].sort(),qq.criteria.map(c=>c.id).sort());assert.equal(out.expected_points,out.expected_verdicts.filter(v=>v.verdict==='met').length);}
 for(const c of oldqa.cases){const out=qa.cases.find(x=>x.id===c.id);assert(out);assert.equal(out.answer,c.answer);assert.equal(out.subquestion_id,c.subquestion_id);}
 assert.deepEqual(s.source_refs,before.source_refs);assert.deepEqual(s.shared_context,before.shared_context);
 write(`${dir}/question.json`,[s]);write(`${dir}/authoring-plan.json`,p);write(`${dir}/qa.json`,qa);write(`${dir}/classification.json`,{version:1,classifications:cls});
 const ledger={version:1,status:'agent_content_followup_prepared_api_not_run',reviewer:'agent',reviewer_agent:'plan_completion',set_id:id,reason:reasons[id],before:{file:job.file,sha256:fh(job.file),plan_file:job.plan_file,plan_sha256:fh(job.plan_file),qa_file:job.qa_file,qa_sha256:fh(job.qa_file)},after:{file:`${dir}/question.json`,sha256:fh(`${dir}/question.json`),plan_file:`${dir}/authoring-plan.json`,plan_sha256:fh(`${dir}/authoring-plan.json`),qa_file:`${dir}/qa.json`,qa_sha256:fh(`${dir}/qa.json`)},questions_before:before.subquestions.length,questions_after:s.subquestions.length,points_before:before.subquestions.flatMap(q=>q.criteria).length,points_after:s.subquestions.flatMap(q=>q.criteria).length,original_qa_answers_preserved:oldqa.cases.length,current_qa_cases:qa.cases.length,source_refs_unchanged:true,shared_context_unchanged:true,qa_component_maps:maps,api_calls:0};
 write(`${dir}/changes.json`,ledger);selected.push({set_id:id,...ledger.after});
 console.log(JSON.stringify({id,questions:s.subquestions.length,points:ledger.points_after,cases:qa.cases.length,file:ledger.after.file,sha256:ledger.after.sha256}));
}
write(`${E}/content-followups-v1/index.json`,{version:1,entries:selected});
