import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileLearningCatalog} from '../../../../scripts/build-learning-unit-catalog.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {compilePublicQuestionSet} from '../../../../lib/questionV3.ts';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=x=>createHash('sha256').update(x).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const version=process.argv[2]??'candidate-v1';
assert(/^candidate-v\d+$/.test(version));
const dest=R+'/'+version;
assert(!fs.existsSync(dest),'Preserve prior candidates; use a new version');
const bank=read(R+'/bank.snapshot.json'),cat=read(R+'/catalog.snapshot.json');
const baseline=read(R+'/baseline.json');
for(const input of baseline.inputs)assert.equal(hash(fs.readFileSync(R+'/'+input.snapshot)),input.sha256);
const qmap=new Map(bank.flatMap(s=>s.subquestions.map(q=>[s.id+'/'+q.id,{s,q}])));
const cmap=new Map(cat.classifications.map(c=>[c.source_set_id+'/'+c.subquestion_id,c]));
const planFiles=['01-05','06-10','11-14','15-19'].map(p=>R+'/plan-'+p+'.json');
const plans=planFiles.map(file=>({file,...read(file)}));
const consumed=new Set(),unchanged=new Set(),groups=[],newSets=[],lineage=[],representatives=[],contentReviews=[];
for(const plan of plans){
 for(const key of plan.unchanged_keys){assert(!unchanged.has(key),'duplicate unchanged '+key);unchanged.add(key);}
 for(const g of plan.groups){
  assert(g.source_keys.length&&g.reason?.trim());
  for(const key of g.source_keys){assert(qmap.has(key)&&cmap.get(key)?.question_style==='standard','only standard changes '+key);assert(!consumed.has(key),'overlap '+key);consumed.add(key);}
  groups.push({...g,plan_file:plan.file});
 }
}
const standards=[...cmap].filter(([,c])=>c.question_style==='standard').map(([key])=>key);
assert.deepEqual([...new Set([...consumed,...unchanged])].sort(),standards.sort(),'all reviewed standards accounted for');
assert(![...consumed].some(k=>unchanged.has(k)),'changed also unchanged');
for(const g of groups){
 const targets=[];
 for(const [oi,o] of g.outputs.entries()){
  assert(g.source_keys.includes(o.base_key),'output base outside group');
  assert(o.prompt?.trim()&&o.model_answer?.length&&o.source_review?.trim());
  assert(Array.isArray(o.topic_ids)&&o.topic_ids.length&&o.topic_ids.every(t=>cat.topics.some(x=>x.id===t)));
  const base=qmap.get(o.base_key),id='std-points-20260914-'+hash(g.source_keys.join('|')+'|'+o.base_key+'|'+oi).slice(0,12);
  assert(!bank.some(s=>s.id===id)&&!newSets.some(s=>s.id===id));
  const sourceMap=new Map(),sourceByOrigin=new Map(),requirements=[],criteria=[],criterionLineage=[];
  const addSource=(key,sourceId)=>{
   const originKey=key+'#'+sourceId;
   if(sourceByOrigin.has(originKey))return sourceByOrigin.get(originKey);
   const source=qmap.get(key).s.source_refs.find(s=>s.id===sourceId);assert(source,'source missing '+originKey);
   const signature=source.source_quote.replace(/\s+/g,'').toLowerCase();
   let next=sourceMap.get(signature);
   if(!next){next={...structuredClone(source),id:'src-'+hash(signature).slice(0,16),content_hash:hash(source.source_quote)};sourceMap.set(signature,next);}
   assert.equal(next.page,source.page,'same quote has conflicting KGA classification');
   sourceByOrigin.set(originKey,next.id);return next.id;
  };
  const usedIds=new Set();
  for(const [ci,entry] of o.criteria.entries()){
   assert(g.source_keys.includes(entry.from_key),'criterion origin outside group');
   const original=qmap.get(entry.from_key).q.criteria.find(c=>c.id===entry.criterion_id);assert(original,'criterion missing');
   const req=qmap.get(entry.from_key).q.requirements.find(r=>r.id===original.requirement_id);assert(req,'requirement missing');
   let cid=original.id;for(let n=2;usedIds.has(cid);n++)cid=original.id+'.sp'+n;
   usedIds.add(cid);
   const rid='req-'+(ci+1);
   requirements.push({...structuredClone(req),id:rid,source_ref_id:addSource(entry.from_key,req.source_ref_id)});
   const override=typeof entry.claim==='string';
   const next={...structuredClone(original),id:cid,requirement_id:rid,...(override?{claim:entry.claim,critical_facts:[{id:cid+'.fact',type:entry.fact_type??'action',expected:entry.claim,...(entry.scope?{scope:entry.scope}:{})}]}:{}),max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:original.source_ref_ids.map(s=>addSource(entry.from_key,s))};
   if(!override&&entry.scope)throw Error('scope without claim override '+o.base_key);
   criteria.push(next);criterionLineage.push({criterion_id:cid,from_key:entry.from_key,from_criterion_id:entry.criterion_id,claim_changed:override});
  }
  assert(criteria.length);
  const sub={id:base.q.id,type:o.type??base.q.type,question_style:'standard',topic_ids:o.topic_ids,prompt:o.prompt,constraints:{ordered:false,max_entries:null,overflow_policy:'none'},selection:{type:'all',n:null},decision:null,model_answer:o.model_answer,requirements,criteria};
  assert(sub.type!=='judgment','combined judgment needs explicit decision options or descriptive type');
  const refs=[...sourceMap.values()];
  const set={schema_version:'3.0',id,type:'linked_question_set',status:'needs_review',title:o.prompt,classification:{...structuredClone(base.s.classification),topic_id:o.topic_ids[0],standards:[...new Set(refs.map(s=>s.page).filter(p=>p?.startsWith('KGA ')))].sort()},source_refs:refs,shared_context:{facts:[]},learning_order:[sub.id],subquestions:[sub],verification:{source_fidelity:'reconstructed',review_status:'needs_human_review',calculation_required:false,notes:['2026-09-14 기준서형 배점 검토의 승인된 분리·통합·조정 후속본. 원문 계보: '+g.source_keys.join(', '),g.reason,o.source_review,'검토·실측·게시 단계의 상태는 이번 실행 장부에서 확인한다.']}};
  for(const s of refs)assert(fs.readFileSync(s.file,'utf8').replace(/\s+/g,'').includes(s.source_quote.replace(/\s+/g,'')),'source quote mismatch '+s.file);
  const met=o.partial_met;
  if(criteria.length>1)assert(met?.length&&new Set(met).size===met.length&&met.length<criteria.length&&met.every(i=>Number.isInteger(i)&&i>=0&&i<criteria.length),'invalid partial '+o.base_key);
  for(const kind of criteria.length>1?['partial','wrong']:['wrong']){
   const answer=kind==='partial'?o.partial_answer:o.wrong_answer;assert(answer?.trim());
   const matching=kind==='partial'?met:[];
   representatives.push({set_id:id,subquestion_id:sub.id,kind,answer,met_criterion_ids:matching.map(i=>criteria[i].id),expected_points:matching.length,reason:kind==='partial'?'최종 발문과 독립 명제에 맞춰 작성자가 답안 전체를 대조한 부분정답. '+(o.partial_reason??'적힌 의미만 인정하고 생략한 나머지 명제는 인정하지 않는다.'):'최종 요구를 충족하지 않는 대표 오답으로 작성자가 모든 기준을 대조했다.',plan_file:g.plan_file,base_key:o.base_key});
  }
  contentReviews.push({set_id:id,subquestion_id:sub.id,plan_file:g.plan_file,base_key:o.base_key,rationale:g.reason,source_review:o.source_review,criteria:criterionLineage});
  newSets.push(set);targets.push({set_id:id,subquestion_id:sub.id,points:criteria.length,criteria:criterionLineage});
 }
 lineage.push({source_keys:g.source_keys,targets,reason:g.reason,plan_file:g.plan_file});
}
const retained=[],subsets=[],removed=[];
for(const old of bank){
 const qs=old.subquestions.filter(q=>!consumed.has(old.id+'/'+q.id));
 if(qs.length===old.subquestions.length){retained.push(old);continue;}
 if(!qs.length){removed.push(old.id);continue;}
 const next=structuredClone(old);next.subquestions=qs.map(q=>structuredClone(q));next.learning_order=old.learning_order.filter(id=>qs.some(q=>q.id===id));
 // A legacy singleton needs explicit learning metadata. This is the already
 // reviewed catalog projection, not new answer content or a new classification.
 if(qs.length===1&&!qs[0].question_style){const q=next.subquestions[0],meta=cmap.get(old.id+'/'+q.id);q.question_style=meta.question_style;q.topic_ids=meta.topic_ids;if(meta.question_style==='standard'){q.prompt=meta.standalone_prompt;next.shared_context={facts:[]};}}
 subsets.push({set_id:old.id,removed_subquestion_ids:old.subquestions.filter(q=>consumed.has(old.id+'/'+q.id)).map(q=>q.id),retained_subquestion_ids:qs.map(q=>q.id)});
 retained.push(next);
}
const candidate=[...retained,...newSets];
const validation=validateAuthoringBank(candidate);assert.deepEqual(validation.errors,[]);
const entries=candidate.flatMap(s=>s.subquestions.map(q=>{const prior=cmap.get(s.id+'/'+q.id);return {set_id:s.id,subquestion_id:q.id,question_style:q.question_style??prior.question_style,topic_ids:q.topic_ids??prior.topic_ids,standalone_prompt:(q.question_style??prior.question_style)==='standard'?(q.question_style?q.prompt:prior.standalone_prompt):null,case_fact_ids:prior?.case_fact_ids??[],reason:prior?'기존 분류를 유지하고 변경 후 원문 판본에 결속했다.':'원검토·수정 명세의 독립 기준서형 분류와 실제 요구주제를 반영했다.'};}));
const compiled=compileLearningCatalog(candidate,entries,cat.topics);
fs.mkdirSync(dest,{recursive:true});
const write=(name,value)=>fs.writeFileSync(dest+'/'+name,json(value),{flag:'wx'});
write('bank.json',candidate);write('new-sets.json',newSets);write('lineage.json',lineage);write('retained-subsets.json',subsets);write('retired-sets.json',removed);write('representatives.json',representatives);write('content-reviews.json',contentReviews);
write('classification-review.json',{source_file:dest+'/bank.json',source_file_sha256:hash(fs.readFileSync(dest+'/bank.json')),entries});
write('catalog.json',{schema_version:1,source_file:dest+'/bank.json',source_file_sha256:hash(fs.readFileSync(dest+'/bank.json')),review_file:dest+'/classification-review.json',topics:cat.topics,classifications:compiled.classifications});
write('public.json',candidate.map(compilePublicQuestionSet));
const report={new_sets:newSets.length,changed_original_questions:consumed.size,unchanged_standard_questions:unchanged.size,retained_subset_sets:subsets.length,retired_sets:removed.length,sets:candidate.length,questions:validation.subquestionCount,criteria:validation.criterionCount,points:validation.totalPoints,plan_files:planFiles.map(file=>({file,sha256:hash(fs.readFileSync(file))})),errors:validation.errors};
write('checks.json',report);console.log(JSON.stringify(report,null,2));
