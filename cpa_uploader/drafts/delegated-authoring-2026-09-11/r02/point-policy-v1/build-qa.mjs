import fs from 'node:fs';import crypto from 'node:crypto';
import{splits}from'./split-spec.mjs';import{vectors,vectorReasons,approvedQAOnly}from'./original-qa-adjudications.mjs';import{language}from'./new-case-language.mjs';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11',own=base+'/r02/point-policy-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:process.argv.includes('--update-in-progress')?'w':'wx'});
const inputs=read(own+'/inputs.json'),selection=read(own+'/question-selection.json');
const letter={met:'m',not_met:'n',contradicted:'c'},verdict={m:'met',n:'not_met',c:'contradicted'};
const entries=[];
for(const entry of selection.entries){
 const e=inputs.entries.find(e=>e.plan_id===entry.plan_id),item=structuredClone(entry);
 if(!entry.changed){entries.push(item);continue;}
 const set=read(entry.question_file)[0],qa=structuredClone(e.qa),originalRows=[];
 const mappings=entry.questions.flatMap(q=>q.criterion_mapping.map(m=>({...m,qid:q.id})));
 const alias=new Map(),ids={};
 for(const m of mappings){m.new_ids.forEach((id,i)=>alias.set(id,m.old_id+'#'+i));ids[m.old_id]=m.new_ids;}
 function implied(codes,qid){
  const out=new Set(codes);
  const on=(a,b)=>{if(out.has(a))out.add(b);};
  if(e.plan_id==='T08-B'){on('crit2#1','crit2#0');on('crit7#0','crit8#0');on('crit8#0','crit6#0');on('crit4#0','crit3#0');on('crit3#0','crit3#1');}
  if(e.plan_id==='T06-B'&&qid==='sub3')on('crit7#1','crit7#0');
  if(e.plan_id==='T06-C'&&qid==='sub2'){on('crit6#0','crit4#0');on('crit6#0','crit5#0');}
  if(e.plan_id==='T07-C'&&qid==='sub3'){on('crit8#0','crit7#0');on('crit8#1','crit7#0');}
  if(e.plan_id==='T10-B'&&qid==='sub2'){on('crit3#1','crit3#0');on('crit4#1','crit4#0');}
  if(e.plan_id==='T10-C'){on('crit3#1','crit3#0');if(qid==='sub2')for(let i=0;i<4;i++)on('crit5#'+i,'crit4#0');}
  return out;
 }
 for(const c of qa.cases){
  const old=e.qa.cases.find(x=>x.id===c.id),q=set.subquestions.find(q=>q.id===c.subquestion_id),newV=[];
  for(const m of mappings.filter(m=>m.qid===q.id)){
   const prior=old.expected_verdicts.find(v=>v.criterion_id===m.old_id);
   if(!prior)throw Error('Missing original verdict '+e.plan_id+'/'+c.id+'/'+m.old_id);
   if(m.new_ids.length===1){newV.push(structuredClone(prior));continue;}
   const explicit=vectors[e.plan_id]?.[c.id]?.[m.old_id];
   // The reviewed complete-clause/paraphrase groups preserve all stated components.
   // Partial answers and negative scope were individually adjudicated in vectors above.
   const v=explicit??letter[prior.verdict].repeat(m.new_ids.length);
   if(v.length!==m.new_ids.length)throw Error('Vector length '+e.plan_id+'/'+c.id+'/'+m.old_id);
   const specific=vectorReasons[e.plan_id]?.[c.id];
   m.new_ids.forEach((id,i)=>newV.push({criterion_id:id,verdict:verdict[v[i]],reason:specific??(v[i]==='m'?'원답안 전체의 해당 완전 명제 또는 허용 동의표현이 이 독립 부분을 포함한다.':v[i]==='c'?'원답안이 이 독립 명제의 요구 또는 필수 범위를 명시적으로 부정한다.':'원답안 전체를 대조했으며 이 독립 요구를 표현하거나 함축하는 내용이 없다.')+' 대상: '+q.criteria.find(k=>k.id===id).claim}));
  }
  for(const [cid,[v,reason]]of Object.entries(approvedQAOnly[e.plan_id]?.[c.id]??{})){const r=newV.find(r=>r.criterion_id===cid);if(!r)throw Error('Missing approved criterion');r.verdict=v;r.reason=reason;}
  c.expected_verdicts=newV;c.expected_points=newV.reduce((n,v)=>n+(v.verdict==='met'?1:0),0);
  c.note=(c.note??'')+' [point-policy-v1] 원 ID·물음·답안 보존. 독립 부분별 기대를 원문과 답안 전체에서 재대조했으며 옛 복합 0점을 부분에 기계적으로 전파하지 않는다. 실제 모델 호출 전의 작성자 기대값이다.';
  originalRows.push({id:c.id,subquestion_id:c.subquestion_id,answer:old.answer,original_points:old.expected_points,new_points:c.expected_points,original_verdicts:old.expected_verdicts,new_verdicts:newV,independently_changed_vectors:vectors[e.plan_id]?.[c.id]??null,authority_adjustment:approvedQAOnly[e.plan_id]?.[c.id]??null});
 }
 function add(q,id,kind,answer,positive,negative,target=null,note=''){
  const p=implied(positive,q.id),n=new Set(negative);
  if(e.plan_id==='T08-B'&&q.id==='sub2'&&target===ids.crit3[0]&&kind==='paraphrase')p.delete('crit3#1');
  const vs=q.criteria.map(c=>({criterion_id:c.id,verdict:n.has(alias.get(c.id))?'contradicted':p.has(alias.get(c.id))?'met':'not_met',reason:(n.has(alias.get(c.id))?'필수 의미·대상·조건의 명시적 반대':p.has(alias.get(c.id))?'직접 진술 또는 문맥상 명확한 함축':'원답안에 해당 독립 내용 없음')+'; '+c.claim}));
  qa.cases.push({id,subquestion_id:q.id,kind,answer,expected_points:vs.filter(v=>v.verdict==='met').length,expected_verdicts:vs,...(target?{target_criterion_id:target}:{}),note:'요소별 배점 후속의 작성자 회귀 기대; API 미실행. '+note});
 }
 for(const q of set.subquestions){
  const all=q.criteria.map(c=>alias.get(c.id));
  add(q,'point-v1-'+q.id+'-stored-answer','full',q.model_answer.join('\n'),all,[],null,'현재 저장 모범답안의 문자열을 그대로 사용한다.');
  add(q,'point-v1-'+q.id+'-empty','empty','',[],[]);
  add(q,'point-v1-'+q.id+'-reverse-one-sentence','paraphrase',q.model_answer.toReversed().join(' '),all,[],null,'역순 한 문장의 모든 독립 내용이 합산되어야 한다.');
  for(const m of mappings.filter(m=>m.qid===q.id&&m.new_ids.length>1)){
   for(const [i,id]of m.new_ids.entries()){
    const target=q.criteria.find(c=>c.id===id),key=alias.get(id),lang=language[e.plan_id]?.[m.old_id]?.[i];if(!lang)throw Error('Missing language '+e.plan_id+'/'+key);
    const stem='point-v1-'+q.id+'-'+id;
    add(q,stem+'-complete','full',target.claim,[key],[],id,'이 기준의 독립 요구 전체를 표현한다. 다른 기준은 실제 함축되는 범위에서만 인정한다.');
    add(q,stem+'-paraphrase','paraphrase',lang[0],[key],[],id);
    const safe=q.criteria.filter(c=>c.id!==id&&!implied([alias.get(c.id)],q.id).has(key));
    add(q,stem+'-true-omission','omission',safe.length?safe.map(c=>c.claim).join('\n'):'감사에는 여러 업무가 있다.',safe.map(c=>alias.get(c.id)),[],id,'명확한 함축으로 목표 명제가 남을 수 있는 이웃 문장도 제외하여 실제 누락을 구성한다. 단순 문장 삭제와 구별한다.');
    let negatives=[key];
    if(e.plan_id==='T06-B'&&q.id==='sub3')negatives=['crit7#0','crit7#1'];
    if(e.plan_id==='T08-B'&&m.old_id==='crit2'&&i===1)negatives=['crit2#0','crit2#1'];
    add(q,stem+'-opposite','opposite',lang[1],[],negatives,id,'원인의 부정만으로 별도 결과를 자동 부정하지 않는다.');
    add(q,stem+'-condition-boundary','condition_boundary',lang[2],[],negatives,id,'실제 대상·범위·방법·적용조건을 바꾼 주장의 반대 효과를 해당 명제에 한정한다.');
   }
  }
 }
 if(e.plan_id==='T10-C'){
  const q=set.subquestions.find(q=>q.id==='sub2');
  add(q,'point-v1-sub2-accuracy-without-repeating-calculation','paraphrase','그 기대치가 개별적으로 또는 다른 왜곡표시와 합쳐 중요한 왜곡표시를 드러낼 만큼 충분히 정확한지 평가한다.',['crit4#0','crit6#0'],[],'crit6','주어진 계산 행위를 다시 쓰지 않아도 정확성 평가의 독립 1점을 인정한다. 필요한 미완료 평가를 보완하는 조치는 종료 부적절 판단을 함축한다.');
  add(q,'point-v1-sub2-given-calculation-repeat-only','omission','회사 평균차입금과 평균이자율을 단순 계산한 값이 있다.',[],[],'crit6','이미 지문에 제공한 계산값의 존재만 반복하므로 정확성 평가 점수가 없다.');
  add(q,'point-v1-sub2-wrong-judgment-correct-precision','opposite','그대로 종료하는 계획은 적절하다. 다만 기대치가 개별적 또는 합산하여 중요한 오류를 식별할 만큼 정확한지는 평가해야 한다.',['crit6#0'],['crit4#0'],'crit6','명시적 반대 결론과 독립된 정확성 평가의 점수를 분리한다.');
 }
 if(qa.cases.slice(0,e.qa.cases.length).some((c,i)=>c.id!==e.qa.cases[i].id||c.answer!==e.qa.cases[i].answer||c.subquestion_id!==e.qa.cases[i].subquestion_id))throw Error('Original changed');
 if(new Set(qa.cases.map(c=>c.id)).size!==qa.cases.length)throw Error('Duplicate case id');
 item.qa_file=entry.folder+'/qa-cases-'+e.plan_id.toLowerCase()+'.json';write(item.qa_file,qa);item.qa_sha256=hash(item.qa_file);
 item.previous_case_count=e.qa.cases.length;item.new_case_count=qa.cases.length-e.qa.cases.length;
 const lineage={version:1,plan_id:e.plan_id,set_id:e.set_id,created_at:new Date().toISOString(),authority:'User approved point-policy-implementation-v1/contract.md; author source/prompt review. Not human acceptance or model verification.',predecessor:entry.predecessor,current:{question_file:entry.question_file,question_sha256:hash(entry.question_file),plan_file:entry.plan_file,plan_sha256:hash(entry.plan_file),qa_file:item.qa_file,qa_sha256:item.qa_sha256},questions:entry.questions,original_answers_preserved:true,original_cases:e.qa.cases.length,additional_cases:item.new_case_count,original_case_expected_comparisons:originalRows,source_refs_preserved:JSON.stringify(set.source_refs)===JSON.stringify(e.question.source_refs),shared_context_preserved:JSON.stringify(set.shared_context)===JSON.stringify(e.question.shared_context),new_API_calls:0,model_revalidation:'not_run_user_paused',pending:'Independent static/semantic review and later user-authorized actual model regression required. Prior receipts remain historical.'};
 write(item.lineage_file,lineage);entries.push(item);
}
write(own+'/qa-selection.json',{owner:'plan_procedures',api_calls:0,entries});
console.log(JSON.stringify(entries.map(e=>({id:e.plan_id,changed:e.changed,qa:e.qa_file,old:e.previous_case_count,added:e.new_case_count}))));
