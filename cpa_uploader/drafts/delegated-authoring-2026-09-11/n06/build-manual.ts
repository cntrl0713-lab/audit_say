import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildSourceCatalog,sourceUnitToRef} from '../../../questionSourceCatalog.mjs';
import {authoringPlanHash,validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const catalog=buildSourceCatalog({repoDir:root});
const files=['cpa_uploader/data/official/kga701-706-710-720-2025-review16.txt','cpa_uploader/data/official/kga1100-2025-review17.txt','cpa_uploader/data/official/delegated-n06-kga710-720-1100-supplement-2025.txt'];
const byKey=new Map(catalog.units.filter(u=>files.includes(u.file)).map(u=>[`${(u.standard??'').replace('KGA ','')}.${u.paragraph}`,u]));
const context:Record<string,string[]>={
 'T16-A':['710.2','710.3','710.15'],
 'T16-B':['720.8','720.10','720.17','720.21','720.A44','720.A45','720.A46','720.A47','720.A49','720.A50'],
 'T17-A':['1100.4','1100.6','1100.74','1100.75','1100.76','1100.78','1100.81','1100.A99','1100.A100','1100.A101','1100.A102','1100.A103'],
};
const content=JSON.parse(fs.readFileSync(path.join(dir,'content-proposal.json'),'utf8'));
const outputs=[];
for(const item of content.sets){
 const direct=[...new Set<string>(item.questions.flatMap((q:any)=>q.criteria.flatMap((c:any)=>[c.support,...c.also])))];
 const keys=[...new Set([...direct,...context[item.plan_id]])];
 const units=keys.map(k=>{const u=byKey.get(k);if(!u)throw new Error(`Missing registered source ${k}`);return u;});
 const refs=units.map(u=>{
  const ref=sourceUnitToRef(u);let quote=ref.source_quote;
  if(u.standard==='KGA 1100'&&u.paragraph==='69'){
   const start=quote.indexOf('내부회계관리제도에 대한 의견');const end=quote.indexOf('내부회계관리제도 감사의견의 근거');
   if(start<0||end<=start)throw new Error('1100.69(c) exact range unavailable');quote=quote.slice(start,end).trim();
  }
  const text=fs.readFileSync(path.resolve(root,ref.file),'utf8');const pos=text.indexOf(quote);if(pos<0)throw new Error(`Exact source not found ${ref.id}`);
  const first=text.slice(0,pos).split('\n').length;const last=first+quote.split('\n').length-1;
  return {...ref,source_quote:quote,source_span:`L${first}-L${last}; ${u.locator}${u.standard==='KGA 1100'&&u.paragraph==='69'?' 중 (c) 의견 단락':''}; 수동 확인한 연속 인용`};
 });
 const refById=new Map(refs.map(r=>[r.id,r]));
 const edition='2027년 CPA 시험 대비, 2026-01-01 개시 보고기간과 2027년 후속보고 사례다. KICPA 2025년11월 공식 전문의 해당 시행 요구를 적용하고 2026년 전문의 직접 문단 및 필요한 적용자료 26개를 원문 대조하여 공백 제외 동일함을 확인했다. 720 적용 사례는 직전말 자산5천억원 이상 주권상장법인이다(공식720.10 원표 확인). 1100의 회사별 법정 감사대상 여부는 사례에서 감사대상임을 부여하며 별도 판단하지 않는다. 금융위원회 2027출제범위 공고는 특정판본을 지정하지 않았으며 이후 시험판본 지정·개정이 있으면 재대조한다.';
 const plan:any={version:1,topic_id:item.topic_id,mode:'adapt_existing_question',objective:item.objective,scope:{
  actors:[item.plan_id==='T16-A'?'당기감사인·전임감사인·경영진·지배기구':'감사인·경영진·지배기구·감사보고서 이용자'],
  timing:['2026-01-01 개시 보고기간, 필요 후속 업무2027',item.plan_id==='T17-A'?'내부회계 평가기준일2026-12-31':'전기2025와 당기2026 또는2027보고서일 전·후를 명시'],
  conditions:item.facts,exceptions:[item.plan_id==='T16-A'?'710.A12의 문구는 포함 가능한 설명이다. Q1은 초안의 오류를 정정하며 일반적인 강제 기재의무를 새로 만들지 않는다. 수정사항 감사와 전기 전체 확신은 구별한다.':item.plan_id==='T16-B'?'해지 불가의 보고서일 전 사례와 보고서일 후 상황을 구별한다. A45의 감사증거 전반 신뢰성에 대한 의문은 없으며, A50 조치들은 법규에서 허용될 때의 예시다.':'중요한 취약점 판단과 범위제한은 독립이다. 운영실태보고서 제공과 효과성 서면진술 제공을 구별하며79의 해지불가 예외를 적용한다. 범위제한 중 별도 중요한 취약점 발견81은 제외한다.'],
  required_answers:item.questions.map((q:any)=>q.prompt),exclusions:item.exclusions},question_types:[...new Set(item.questions.map((q:any)=>q.type))],source_unit_ids:[...new Set([...item.source_ids,...units.map(u=>u.id)])],existing_question_difference:item.difference,edition_assumption:edition,unresolved_items:[],status:'ready'};
 const errors=validateQuestionAuthoringPlan(plan);if(errors.length)throw new Error(errors.join('; '));
 let counter=0;
 const subs=item.questions.map((q:any,i:number)=>{
  const sourceIds=[...new Set<string>(q.criteria.flatMap((c:any)=>[c.support,...c.also].map(k=>byKey.get(k)!.id)))];
  const reqBySource=new Map(sourceIds.map((id,n)=>[id,`sub${i+1}.req${n+1}`]));
  return {id:`sub${i+1}`,type:q.type,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:q.decision,model_answer:q.model_answer,
   requirements:sourceIds.map(id=>({id:reqBySource.get(id),source_ref_id:id,source_quote:refById.get(id)!.source_quote,source_span:refById.get(id)!.source_span})),
   criteria:q.criteria.map((c:any)=>{const id=`crit${++counter}`;const source=byKey.get(c.support)!.id;return {id,requirement_id:reqBySource.get(source),claim:c.claim,critical_facts:[{id:`${id}.fact`,type:c.critical_type,expected:c.claim}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[source,...c.also.map((k:string)=>byKey.get(k)!.id)]};})};
 });
 const set={schema_version:'3.0',id:item.id,type:'linked_question_set',status:'needs_review',title:item.title,classification:{topic_id:item.topic_id,part:'PART4',chapter:item.chapter,domain:item.domain,standards:item.standards,tags:item.tags},source_refs:refs.map(({source_span,...ref})=>ref),shared_context:{facts:item.facts.map((text:string,i:number)=>({id:`f${i+1}`,text,scoreable:false}))},learning_order:subs.map((q:any)=>q.id),subquestions:subs,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[`계획 ID ${item.plan_id}; 총괄 배정 ID로 수동 저작함.`,edition,'직접 근거와 필요한 문맥은 실제 등록 source ID의 원문을 source_refs·requirements·plan에 연결하였다. 1100.69는 (c)의 연속 원문만 인용하며 나머지 등록 문단은 본문을 그대로 유지한다.','수동 version1 계획을 sidecar로 유지하며 자동 source packet·생성 marker를 사용하지 않았다.','작성자 QA와 정적 준비 단계이며 모델 의미검수·실제 채점·사람 승인을 뜻하지 않는다.']}};
 const file=`draft-${item.id}.json`;fs.writeFileSync(path.join(dir,file),JSON.stringify(set,null,2)+'\n');
 fs.writeFileSync(path.join(dir,file+'.authoring-plan.json'),JSON.stringify({artifact_type:'question_authoring_plan',version:1,plans:[{...plan,set_id:item.id}]},null,2)+'\n');
 outputs.push({plan_id:item.plan_id,set_id:item.id,file,questions:subs.length,criteria:counter,points:counter,manual_plan_hash:authoringPlanHash(plan),catalog_fingerprint_at_build:catalog.fingerprint,source_map:Object.fromEntries(keys.map(k=>[k,byKey.get(k)!.id])),draft_sha256:createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')});
}
fs.writeFileSync(path.join(dir,'build-manifest.json'),JSON.stringify({artifact_type:'n06_manual_build',version:1,outputs},null,2)+'\n');console.log(outputs.map(o=>({id:o.set_id,questions:o.questions,points:o.points,refs:Object.keys(o.source_map).length})));
