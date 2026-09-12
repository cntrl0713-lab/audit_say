import fs from 'node:fs';import crypto from 'node:crypto';
import {splits,questionRationales} from './split-spec.mjs';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11', own=base+'/r02/point-policy-v1';
const inputs=JSON.parse(fs.readFileSync(own+'/inputs.json','utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:process.argv.includes('--update-in-progress')?'w':'wx'});
const entries=[];
for(const e of inputs.entries){
 if(hash(e.question_file)!==e.question_sha256||hash(e.plan_file)!==e.plan_sha256||hash(e.qa_file)!==e.qa_sha256)throw Error('Input changed '+e.plan_id);
 const set=structuredClone(e.question),plan=structuredClone(e.plan),changed=Boolean(splits[e.plan_id]);
 const folder=base+'/'+e.package.toLowerCase()+'/point-policy-v1/'+e.plan_id.toLowerCase();
 let next=Math.max(...set.subquestions.flatMap(q=>q.criteria.map(c=>Number(c.id.replace('crit','')))))+1;
 const qs=[];
 for(const [qi,q]of set.subquestions.entries()){
  const original=e.question.subquestions[qi],mapping=[];q.criteria=[];
  for(const old of original.criteria){
   const claims=splits[e.plan_id]?.[old.id];
   if(!claims){q.criteria.push(structuredClone(old));mapping.push({old_id:old.id,new_ids:[old.id],reason:'독립 요구 유지; '+questionRationales[e.plan_id][qi]});continue;}
   const ids=[];
   for(const [i,claim]of claims.entries()){
    const id=i===0?old.id:'crit'+next++;ids.push(id);
    const c={...structuredClone(old),id,claim,max_points:1,scores:{met:1,not_met:0,contradicted:0},critical_facts:[{id:'cf'+id.slice(4),type:old.critical_facts[0].type,expected:claim}]};
    for(const scope of old.critical_facts.slice(1)){
     let expected=scope.expected;
     if(e.plan_id==='T08-B'&&old.id==='crit8')expected=i===0?'대상기간 조정의 허용범위: 실제 운송·인수기간을 포착할 적절한 조정을 인정한다. 특정 추가 일수나 일수가 불필요하다는 문구의 재진술을 요구하지 않는다. 고객 인수·통제이전이 인식시점이라는 주어진 전제를 적용한다.':'증빙 대조의 허용범위: 출고·인수 자료는 계약상 인식시점과 기록기간을 확인하는 목적을 충족할 수 있는 예시이며 두 명칭 모두의 열거를 요구하는 공동 필수목록이 아니다. 같은 목적을 충족하는 대체 증빙을 허용하며 주어진 고객 인수·통제이전 전제의 재진술을 요구하지 않는다.';
     c.critical_facts.push({...scope,id:'cf'+id.slice(4)+'-scope',expected});
    }
    q.criteria.push(c);
   }mapping.push({old_id:old.id,new_ids:ids,reason:questionRationales[e.plan_id][qi]});
  }
  if(e.plan_id==='T10-C'&&q.id==='sub2'){
   const c=q.criteria.find(c=>c.id==='crit6');c.claim='이미 계산한 값을 감사인의 기대치로 이용할 때, 그 기대치가 개별적으로 또는 다른 왜곡표시와 합쳐 재무제표를 중요하게 왜곡표시시킬 수 있는 왜곡표시를 식별할 정도로 충분히 정확한지 평가한다.';c.critical_facts[0].expected=c.claim;
   c.critical_facts.push({id:'cf6-calculation-scope',type:'condition',expected:'이미 계산한 값의 도출 행위 자체를 다시 쓰는 것은 추가 득점요건이 아니다. 중요한 왜곡표시를 식별할 충분한 정확성의 평가를 요구한다.'});
   q.prompt=q.prompt.replace('기대치의 도출·정확성 평가와 추가조사 없이 수용할 차이의 결정기준도 설명하시오.','이미 계산한 값을 감사인의 기대치로 이용할 때의 정확성 평가와 추가조사 없이 수용할 차이의 결정기준도 설명하시오.');
  }
  if(mapping.some(m=>m.new_ids.length>1))q.model_answer=q.criteria.map(c=>c.claim);
  if(e.plan_id==='T08-C'&&q.id==='sub2')q.prompt=q.prompt.replace('① 수행업무의 이해','① 수행업무의 성격·범위·목적 및 관련 전문영역의 이해');
  if(e.plan_id==='T10-B'&&q.id==='sub2')q.prompt=q.prompt.replace('어떠한 영향을 미치는지 설명하시오.','어떠한 영향을 미치는지와 그 영향이 생기는 경로를 설명하시오.');
  qs.push({id:q.id,old_points:original.criteria.reduce((n,c)=>n+c.max_points,0),new_points:q.criteria.reduce((n,c)=>n+c.max_points,0),decision:mapping.some(m=>m.new_ids.length>1)?'split':'retain',rationale:questionRationales[e.plan_id][qi],source_ref_ids:[...new Set(q.criteria.flatMap(c=>c.source_ref_ids))],criterion_mapping:mapping});
 }
 let qf=e.question_file,pf=e.plan_file;
 if(changed){
  fs.mkdirSync(folder,{recursive:true});
  set.status='needs_review';set.verification.review_status='needs_human_review';
  set.verification.notes.push('2026-09-11 사용자 승인 요소별 정수 배점 후속본. 원지문·공식 source_refs·세트/물음/기존 criterion ID 보존. 모든 독립 명제는 1점. 과거 검수·채점은 새 계약 검증 완료로 승계하지 않으며 API는 사용자 지시로 중지 상태다.');
  plan.scope.required_answers=set.subquestions.flatMap(q=>q.criteria.map(c=>q.id+'/'+c.id+': '+c.claim));
  plan.existing_question_difference+=' [요소별 배점 후속] '+qs.map(q=>q.id+' '+q.old_points+'→'+q.new_points+'점: '+q.rationale).join(' ');
  plan.scope.exceptions.push('각 독립 명제는 1점으로 합산한다. 조건·대안·주어진 사실·설명만의 반복에 새 점수를 주지 않고 정확한 근거의 명확한 판단 함축을 인정한다. 과거 실제 모델 채점은 변경된 문항의 검증을 대신하지 않는다.');
  qf=folder+'/'+set.id+'.json';pf=folder+'/'+set.id+'.authoring-plan.json';write(qf,[set]);write(pf,plan);
 }
 entries.push({plan_id:e.plan_id,set_id:e.set_id,package:e.package,changed,question_file:qf,plan_file:pf,qa_file:e.qa_file,lineage_file:changed?folder+'/lineage.json':null,questions:qs,predecessor:{question_file:e.question_file,question_sha256:e.question_sha256,plan_file:e.plan_file,plan_sha256:e.plan_sha256,qa_file:e.qa_file,qa_sha256:e.qa_sha256},folder,question_sha256:hash(qf),plan_sha256:hash(pf)});
}
write(own+'/question-selection.json',{owner:'plan_procedures',api_calls:0,entries});
console.log(JSON.stringify({sets:entries.length,changed:entries.filter(e=>e.changed).length,questions:entries.flatMap(e=>e.questions).length,old:entries.flatMap(e=>e.questions).reduce((n,q)=>n+q.old_points,0),new:entries.flatMap(e=>e.questions).reduce((n,q)=>n+q.new_points,0),entries:entries.map(e=>({id:e.plan_id,points:e.questions.reduce((n,q)=>n+q.new_points,0),file:e.question_file}))}));
