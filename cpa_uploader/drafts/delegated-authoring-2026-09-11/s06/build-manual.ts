import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildSourceCatalog,sourceUnitToRef} from '../../../questionSourceCatalog.mjs';
import {authoringPlanHash,validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const dir=path.dirname(fileURLToPath(import.meta.url));const root=process.cwd();
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const catalog=buildSourceCatalog({repoDir:root});
const files=['cpa_uploader/data/official/delegated-s06-kga1100-1200-2025.txt','cpa_uploader/data/official/delegated-s06-interim-2015.txt'];
const byKey=new Map(catalog.units.filter(u=>files.includes(u.file)).map(u=>[`${u.standard==='분·반기재무제표 검토준칙'?'INTERIM':(u.standard??'').replace('KGA ','')}.${u.paragraph}`,u]));
const context:Record<string,string[]>={
 'T17-B':['1100.4','1100.10','1100.39','1100.A52','1100.A53','1100.A54','1100.A55','1100.A56','1100.A57','1100.A58','1100.A59','1100.A60','1100.A61','1100.A63','1100.A64','1100.A65'],
 'T18-A':['1200.3','1200.5','1200.8'],
 'T19-A':['INTERIM.1','INTERIM.7','INTERIM.8','INTERIM.9','INTERIM.19'],
};
const dependency=JSON.parse(fs.readFileSync(path.join(dir,'sources/dependency-context.json'),'utf8'));
const policyFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md';
const policyHash=hash(fs.readFileSync(policyFile));
const content=JSON.parse(fs.readFileSync(path.join(dir,'content-proposal.json'),'utf8'));const outputs=[];
for(const item of content.sets){
 const keys=[...new Set<string>([...item.questions.flatMap((q:any)=>q.criteria.flatMap((c:any)=>[c.support,...c.also])),...context[item.plan_id]])];
 const units=keys.map(k=>{const u=byKey.get(k);if(!u)throw new Error(`Missing registered ${k}`);return u;});
 const refs=units.map(u=>{const ref=sourceUnitToRef(u);const raw=fs.readFileSync(path.resolve(root,ref.file),'utf8');const pos=raw.indexOf(ref.source_quote);if(pos<0)throw new Error(`Source exact match missing ${u.id}`);const first=raw.slice(0,pos).split('\n').length;return {...ref,source_span:`L${first}-L${first+ref.source_quote.split('\n').length-1}; ${u.locator}; 수동 확인한 연속 인용`};});
 const refById=new Map(refs.map(r=>[r.id,r]));
 const edition=item.plan_id==='T19-A'?'2027년CPA대비. 본 사례는2026-01-01개시 회계연도의2026-06-30반기 전체형식 재무제표 검토이며 종결업무는해당반기 후수행한다. FSC2015-20고시(2015-06-30타법개정,2015-07-01시행)의실제HWPML원문을확보했다. KICPA2014-12-30개정HWP의선택요구와2015요구본문을대조했고9말미절제목유무외선택내용동일이다.2015첨부에없는보론4는2014공식원전문맥으로구분한다. 과거자료의미확보로그는보존한다.':'2027년CPA대비. 기본2026-01-01개시보고기간,필요후속업무2027. KICPA2025전문의선택1100/1200문단27개를2026전문과대조하여정규화본문동일확인.1100.4는2026-01-01이후개시시행이며모든회사에내부회계감사를의무화하는규정이아니다.1200.8는2023-01-01이후개시적용이다.1200.2의200억원/100억원미만또는조건과질적6범주를공식본문으로확인하고현행법적참조를별도대조했다.';
 const plan:any={version:1,topic_id:item.topic_id,mode:'adapt_existing_question',objective:item.objective,scope:{actors:item.plan_id==='T17-B'?['감사인','경영진','통제수행자']:item.plan_id==='T18-A'?['감사인','개별기업','증권선물위원회']:['회사의독립된연간재무제표감사인','경영진','정보이용자'],timing:item.plan_id==='T19-A'?['2026년상반기검토','나머지종결절차완료를전제로결론작성']:['2026-01-01개시보고기간','평가기준일2026-12-31또는규모판단직전2025년'],conditions:[...item.facts,dependency[item.plan_id],`총괄판본정책 ${policyFile}; SHA256 ${policyHash}. ${edition} 시험당국이모든기준서의2027시험판본을명시지정했다는주장은아니다.`],exceptions:[item.plan_id==='T17-B'?'A59 최초효과성증거의질문불충분과 A68 낮은위험의잔여기간질문가능을구분한다. 기말후새거래와당기운영증거의사후입수를구분한다.':item.plan_id==='T18-A'?'질적제외어느하나도없어야하고양적기준은또는이다. 미만에등호를넣지않는다. 지정회사는11조1항이며주기적지정등으로무조건확대하지않는다. 해당기업이라는것이서면합의로일반기준대체를금지한다는뜻은아니다.':'전체형식반기재무제표로46(8)공정표시결론을적용한다. 요약형식46-1과구분한다. 제한적/보통수준동의표현허용. 해당검토라는이유만으로중요성완화금지이며연간중요성금액기계적일치는아니다.'],required_answers:item.questions.map((q:any)=>q.prompt),exclusions:item.exclusions},question_types:[...new Set(item.questions.map((q:any)=>q.type))],source_unit_ids:[...new Set([...item.source_ids,...units.map(u=>u.id)])],existing_question_difference:item.difference,edition_assumption:edition,unresolved_items:[],status:'ready'};
 const errors=validateQuestionAuthoringPlan(plan);if(errors.length)throw new Error(errors.join('; '));let counter=0;
 const subs=item.questions.map((q:any,i:number)=>{
  const sourceIds=[...new Set<string>(q.criteria.flatMap((c:any)=>[c.support,...c.also].map(k=>byKey.get(k)!.id)))];const reqBySource=new Map(sourceIds.map((id,n)=>[id,`sub${i+1}.req${n+1}`]));
  return {id:`sub${i+1}`,type:q.type,prompt:q.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:q.decision,model_answer:q.model_answer,requirements:sourceIds.map(id=>({id:reqBySource.get(id),source_ref_id:id,source_quote:refById.get(id)!.source_quote,source_span:refById.get(id)!.source_span})),criteria:q.criteria.map((c:any)=>{const id=`crit${++counter}`,source=byKey.get(c.support)!.id;return {id,requirement_id:reqBySource.get(source),claim:c.claim,critical_facts:[{id:`${id}.fact`,type:c.critical_type,expected:c.claim}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[source,...c.also.map((k:string)=>byKey.get(k)!.id)]};})};
 });
 const set={schema_version:'3.0',id:item.id,type:'linked_question_set',status:'needs_review',title:item.title,classification:{topic_id:item.topic_id,part:item.part,chapter:item.chapter,domain:item.domain,standards:item.standards,tags:item.tags},source_refs:refs.map(({source_span,...r})=>r),shared_context:{facts:item.facts.map((text:string,i:number)=>({id:`f${i+1}`,text,scoreable:false}))},learning_order:subs.map((q:any)=>q.id),subquestions:subs,verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:[`계획ID ${item.plan_id}; 총괄배정ID 수동저작.`,edition,'등록 source_refs/requirements는 실제 공식본문 연속인용이며, 추가판본문맥·법적인용·2014보론4는 해시/경로/원문을 plan.scope.conditions에 담아 실제검수모델입력에전달한다. 수동version1계획이며자동sourcepacket을사칭하지않고생성marker를사용하지않았다.','작성자기대QA·정적준비단계, 실제모델의미검수·채점·사람승인은미실행이다.']}};
 const file=`draft-${item.id}.json`;fs.writeFileSync(path.join(dir,file),JSON.stringify(set,null,2)+'\n');fs.writeFileSync(path.join(dir,file+'.authoring-plan.json'),JSON.stringify({artifact_type:'question_authoring_plan',version:1,plans:[{...plan,set_id:item.id}]},null,2)+'\n');
 outputs.push({plan_id:item.plan_id,set_id:item.id,file,questions:subs.length,criteria:counter,points:counter,manual_plan_hash:authoringPlanHash(plan),catalog_fingerprint_at_build:catalog.fingerprint,source_map:Object.fromEntries(keys.map(k=>[k,byKey.get(k)!.id])),draft_sha256:hash(fs.readFileSync(path.join(dir,file)))});
}
fs.writeFileSync(path.join(dir,'build-manifest.json'),JSON.stringify({artifact_type:'s06_manual_build',version:1,outputs},null,2)+'\n');console.log(outputs.map(o=>({id:o.set_id,questions:o.questions,points:o.points,refs:Object.keys(o.source_map).length})));
