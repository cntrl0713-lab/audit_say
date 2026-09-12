import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildSourceCatalog,sourceUnitToRef} from '../../../questionSourceCatalog.mjs';
import {authoringPlanHash,validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const catalog=buildSourceCatalog({repoDir:root});
const files=['cpa_uploader/data/official/delegated-n01-kga200-210-230-2025.txt','cpa_uploader/data/official/delegated-s01-kga200-210-220-320-2025.txt'];
const byKey=new Map(catalog.units.filter(u=>files.includes(u.file)).map(u=>[`${(u.standard??'').replace('KGA ','')}.${u.paragraph}`,u]));
const context:Record<string,string[]>={
 'T02-B':['200.10','200.11','200.A54','200.A55','200.A56'],
 'T01-B':['220.5','220.7','220.8','220.21','220.22','220.24','220.A24','220.A25','220.A26','220.A27','220.A28','220.A29','220.A30','220.A31','220.A32','220.A33'],
 'T03-B':['210.16'],
 'T04-C':['320.7','320.10','320.11','320.12','320.A12','320.A14'],
};
const content=JSON.parse(fs.readFileSync(path.join(dir,'content-proposal.json'),'utf8'));
const outputs=[];
for(const item of content.sets){
 const direct=[...new Set<string>(item.questions.flatMap((q:any)=>q.criteria.flatMap((c:any)=>[c.support,...c.also])))];
 const keys=[...new Set([...direct,...context[item.plan_id]])];
 const units=keys.map(k=>{const u=byKey.get(k);if(!u)throw new Error(`Missing registered source ${k}`);return u;});
 const refs=units.map(u=>{
  const ref=sourceUnitToRef(u);let quote=ref.source_quote;
  if(u.standard==='KGA 220'&&u.paragraph==='7'){
   const end=quote.search(/\(d\)\s/);if(end<0)throw new Error('220.7(a-c) range unavailable');quote=quote.slice(0,end).trim();
  }
  const text=fs.readFileSync(path.resolve(root,ref.file),'utf8');const pos=text.indexOf(quote);if(pos<0)throw new Error(`Exact source not found ${ref.id}`);
  const first=text.slice(0,pos).split('\n').length;const last=first+quote.split('\n').length-1;
  return {...ref,source_quote:quote,source_span:`L${first}-L${last}; ${u.locator}${u.standard==='KGA 220'&&u.paragraph==='7'?' 중 (a-c) 역할 정의':''}; 수동 확인한 연속 인용`};
 });
 const refById=new Map(refs.map(r=>[r.id,r]));
 const edition='2027년 CPA 시험 대비, 2026-01-01 개시 보고기간 및2027년 후속업무. KICPA2025년11월 공식 전문의 해당 시행요구를 적용한다.200/210/320의 선택 문단을2026년 전문과 비교하였고200의 각주번호·위치·참조표제 변화와 본문을 구별했다.220은2026년 전문에서 체계·책임·문단이 변경되었으므로 같은 번호의 동등성을 가정하지 않는다. 본사례는2026개시이고 개정 품질관리체계를 선제적용하지 않으며 종전220.5/19/20/25/A26을 적용한다. 개정220.10의 등록법인2027-12-31/기타2029-12-31이후 개시 시행과 총괄이 확인한 공식공고·정합개정 연결을 고려했다. 모든 정합개정에 독립적인 일괄시행일이 공고되었다는 주장은 하지 않는다. 시험당국이 특정KGA판본을 모두 지정했다는 뜻은 아니며 이후 지시가 확보되면 재대조한다.';
 const policyFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md';
 const policyHash=createHash('sha256').update(fs.readFileSync(path.resolve(root,policyFile))).digest('hex');
 const plan:any={version:1,topic_id:item.topic_id,mode:'adapt_existing_question',objective:item.objective,scope:{
  actors:['감사인·업무수행이사·업무품질관리검토자·경영진·지배기구·이용자'],
  timing:['2026-01-01 개시 보고기간과2027 후속업무','품질검토의 실제종료·감사보고서일·문서최종취합일을 구별'],
  conditions:[...item.facts,...(item.plan_id==='T01-B'?[JSON.parse(fs.readFileSync(path.join(dir,'sources/edition-supplement.json'),'utf8')).text]:[]),`공식 판본 해석의 총괄 장부 ${policyFile}; SHA-256 ${policyHash}. ${edition}`],
  exceptions:[item.plan_id==='T01-B'?'선제적용하지 않는 종전220체계. 검토실제종료는보고서일이전/당일, 문서화 최종완료는A26에따라그후일수있다.20일반절차를 묻고21상장기업추가목록은제외한다.':item.plan_id==='T03-B'?'정당한 변경 사유와 의견회피를 구별한다. 해지는 법규허용조건이고 제3자에대해서는 의무존재판단이다. A35 보고서비언급요구는 관련서비스로한정하며 합의된절차 예외는 절차언급에만적용한다.':item.plan_id==='T04-C'?'특정거래유형 등의 별도중요성은제외. 금액/비율계산없음. 중요성인하후 수행중요성은수정필요결정이며자동인하아님. Q3는기존04-001/sub2의의도된복습이다.':'시간·비용만으로필수절차생략/낮은설득력증거만족을정당화할수없음. 사후발견만으로실제감사적절성이나법률책임을확정하지않음.'],
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
 const set={schema_version:'3.0',id:item.id,type:'linked_question_set',status:'needs_review',title:item.title,classification:{topic_id:item.topic_id,part:item.part,chapter:item.chapter,domain:item.domain,standards:item.standards,tags:item.tags},source_refs:refs.map(({source_span,...ref})=>ref),shared_context:{facts:item.facts.map((text:string,i:number)=>({id:`f${i+1}`,text,scoreable:false}))},learning_order:subs.map((q:any)=>q.id),subquestions:subs,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[`계획 ID ${item.plan_id}; 총괄 배정 ID로 수동 저작함.`,edition,'직접 근거와 필요한 문맥은 실제 등록 source ID의 원문을 source_refs·requirements·plan에 연결하였다. 220.7은 (a-c)의 연속 원문만 인용하며 나머지 등록 문단은 본문을 그대로 유지한다.','수동 version1 계획을 sidecar로 유지하며 자동 source packet·생성 marker를 사용하지 않았다.','작성자 QA와 정적 준비 단계이며 모델 의미검수·실제 채점·사람 승인을 뜻하지 않는다.']}};
 const file=`draft-${item.id}.json`;fs.writeFileSync(path.join(dir,file),JSON.stringify(set,null,2)+'\n');
 fs.writeFileSync(path.join(dir,file+'.authoring-plan.json'),JSON.stringify({artifact_type:'question_authoring_plan',version:1,plans:[{...plan,set_id:item.id}]},null,2)+'\n');
 outputs.push({plan_id:item.plan_id,set_id:item.id,file,questions:subs.length,criteria:counter,points:counter,manual_plan_hash:authoringPlanHash(plan),catalog_fingerprint_at_build:catalog.fingerprint,source_map:Object.fromEntries(keys.map(k=>[k,byKey.get(k)!.id])),draft_sha256:createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')});
}
fs.writeFileSync(path.join(dir,'build-manifest.json'),JSON.stringify({artifact_type:'s01_manual_build',version:1,outputs},null,2)+'\n');console.log(outputs.map(o=>({id:o.set_id,questions:o.questions,points:o.points,refs:Object.keys(o.source_map).length})));
