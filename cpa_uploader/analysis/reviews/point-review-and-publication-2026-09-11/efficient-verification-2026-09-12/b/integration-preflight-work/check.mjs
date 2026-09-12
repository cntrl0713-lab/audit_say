import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12';
const D=path.dirname(E), BASE=D+'/c/prepared-reviewed-v8';
const moduleAt=file=>import(pathToFileURL(path.resolve(file)).href);
const {computeSubquestionMaxPoints}=await moduleAt('lib/questionV3.ts');
const {contentHash}=await moduleAt('lib/learningSubmission.ts');
const {compileLearningCatalog}=await moduleAt('scripts/build-learning-unit-catalog.ts');
const {learningUnitId,selectLearningQuestionSet}=await moduleAt('lib/learningUnits.ts');
const {buildGradingPrompt,buildGradingResponseSchema}=await moduleAt('lib/questionV3Grading.ts');
const {validateExpected}=await moduleAt(E+'/b/run-efficient-grading.ts');
const sha=x=>createHash('sha256').update(x).digest('hex'), inputs=new Map();
const bytes=file=>{if(!inputs.has(file)){const b=fs.readFileSync(file);inputs.set(file,{file,sha256:sha(b),bytes:b});}return inputs.get(file).bytes;};
const read=file=>JSON.parse(bytes(file).toString('utf8'));
const errors=[], modelChanges=[], selected=[], reviews=[], reps=[], origins=[];
const fail=(check,detail)=>errors.push({check,...detail});
const same=(a,b)=>contentHash(a)===contentHash(b);
const arrset=file=>{const s=read(file);if(Array.isArray(s)){if(s.length!==1)fail('selected_single_set',{file,count:s.length});return s[0];}return s;};
const norm=s=>s.replace(/\s+/gu,' ').trim();
for(const owner of ['a','c']) {
  const ss=read(E+'/'+owner+'/selected-files.json').entries;
  const rr=read(E+'/'+owner+'/question-reviews.json').entries;
  const rp=read(E+'/'+owner+'/representative-cases.json').entries;
  for(const s of ss){for(const [key,h]of[['file','sha256'],['plan_file','plan_sha256'],['qa_file','qa_sha256']]){const actual=sha(bytes(s[key]));if(actual!==s[h])fail('selected_hash',{owner,set_id:s.set_id,file:s[key],expected:s[h],actual});}selected.push({...s,owner,set:arrset(s.file)});}
  reviews.push(...rr); reps.push(...rp.map(r=>({...r,owner})));
}
const selectedById=new Map(selected.map(s=>[s.set_id,s]));
if(selectedById.size!==selected.length)fail('selected_unique',{selected:selected.length,unique:selectedById.size});
const normalized=new Map(), roleKind={stored_model_answer:'model',partial_answer:'partial',wrong_or_boundary_answer:'wrong'};
for(const r of reps){
  const s=selectedById.get(r.set_id),sub=s?.set.subquestions.find(q=>q.id===r.subquestion_id),kind=roleKind[r.role];
  const identity={owner:r.owner,set_id:r.set_id,subquestion_id:r.subquestion_id,case_id:r.case_id,kind};
  if(!sub||!kind){fail('representative_target',{...identity});continue;}
  const c=r.case,max=computeSubquestionMaxPoints(sub),qafile=read(r.qa_file),matches=qafile.cases.filter(q=>q.id===r.case_id),original=matches[0];
  if(matches.length!==1)fail('qa_origin_unique',{...identity,qa_file:r.qa_file,count:matches.length});
  for(const field of ['answer','expected_points','expected_verdicts'])if(original&&!same(original[field],c[field]))fail('qa_origin_preserved',{...identity,field});
  if(c.id!==r.case_id||c.subquestion_id!==sub.id)fail('qa_identity',{...identity,embedded_id:c.id,embedded_subquestion_id:c.subquestion_id});
  const actualIds=c.expected_verdicts.map(v=>v.criterion_id).sort(),expectedIds=sub.criteria.map(v=>v.id).sort();
  if(!same(actualIds,expectedIds))fail('criterion_coverage',{...identity,actualIds,expectedIds});
  let sum=0;
  for(const v of c.expected_verdicts){const criterion=sub.criteria.find(c=>c.id===v.criterion_id),points=criterion?.scores[v.verdict];if(!Number.isSafeInteger(points)||points<0)fail('criterion_score',{...identity,criterion_id:v.criterion_id,verdict:v.verdict,points});else sum+=points;}
  if(sum!==c.expected_points)fail('expected_sum',{...identity,sum,expected:c.expected_points});
  if(kind==='partial'&&!(0<c.expected_points&&c.expected_points<max))fail('partial_range',{...identity,points:c.expected_points,max});
  if(kind==='wrong'&&c.expected_points!==0)fail('wrong_zero',{...identity,points:c.expected_points});
  if(kind==='model'&&(c.expected_points!==max||!c.expected_verdicts.every(v=>v.verdict==='met')))fail('model_full_expected',{...identity,points:c.expected_points,max});
  if(typeof c.answer!=='string'||!c.answer.trim()||c.answer.length>5000)fail('answer_contract',{...identity,length:c.answer?.length});
  if(kind==='model'&&c.answer!==sub.model_answer.join('\n'))modelChanges.push({...identity,relation:norm(c.answer)===norm(sub.model_answer.join('\n'))?'whitespace_only':'different_nonwhitespace_content',stored_answer_sha256:sha(sub.model_answer.join('\n')),representative_answer_sha256:sha(c.answer)});
  const key=r.set_id+'/'+sub.id+'/'+kind;
  if(normalized.has(key))fail('duplicate_representative',{...identity});
  normalized.set(key,{identity,answer:kind==='model'?sub.model_answer.join('\n'):c.answer,expected:{subquestion_id:sub.id,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts.map(v=>({...v,reason:v.reason?.trim()||'準備検査専用: 元の agent 期待判定をそのまま合算。新しい意味判定ではない。'}))}});
  origins.push({...identity,max_points:max,expected_points:c.expected_points,criterion_count:sub.criteria.length,qa_file:r.qa_file,answer_sha256:sha(c.answer)});
}
for(const s of selected)for(const sub of s.set.subquestions){
  const wanted=computeSubquestionMaxPoints(sub)>1?['model','partial','wrong']:['model','wrong'];
  for(const kind of wanted)if(!normalized.has(s.set_id+'/'+sub.id+'/'+kind))fail('missing_representative',{set_id:s.set_id,subquestion_id:sub.id,kind});
  if(computeSubquestionMaxPoints(sub)===1&&normalized.has(s.set_id+'/'+sub.id+'/partial'))fail('one_point_partial',{set_id:s.set_id,subquestion_id:sub.id});
  const rr=reviews.filter(r=>r.set_id===s.set_id&&r.subquestion_id===sub.id);
  if(rr.length!==1)fail('review_coverage',{set_id:s.set_id,subquestion_id:sub.id,count:rr.length});
}
const baseline=read(BASE+'/candidate-authoring.json'),final=baseline.map(s=>selectedById.get(s.id)?.set??s);
for(const s of selected)if(!baseline.some(b=>b.id===s.set_id))final.push(s.set);
const classification=read(BASE+'/classification-review.json'),topics=read(BASE+'/learning-question-classifications.json').topics;
for(const r of reviews){const sub=selectedById.get(r.set_id)?.set.subquestions.find(s=>s.id===r.subquestion_id);if(!sub)continue;const entry={set_id:r.set_id,subquestion_id:r.subquestion_id,question_style:r.question_style,topic_ids:r.topic_ids,standalone_prompt:r.question_style==='standard'?r.standalone_prompt??sub.prompt:null,case_fact_ids:r.case_fact_ids,reason:r.review_reason};const old=classification.entries.find(q=>q.set_id===r.set_id&&q.subquestion_id===r.subquestion_id);if(old)Object.assign(old,entry);else classification.entries.push(entry);}
const requests=[], requestKeys=new Map();let contextOnly=0,unitCount=0;
try {
  const {classifications,units}=compileLearningCatalog(final,classification.entries,topics);
  for(const unit of units.filter(u=>selectedById.has(u.source_set_id))){
    unitCount++;
    const source=selectedById.get(unit.source_set_id).set,meta=classifications.filter(c=>c.source_set_id===source.id&&learningUnitId(source.id,c.question_style,c.subquestion_id)===unit.id),projected=selectLearningQuestionSet(source,meta,unit.id);
    if(meta[0].question_style==='standard'&&(projected.subquestions.length!==1||projected.shared_context.facts.length!==0))fail('standard_projection',{unit_id:unit.id});
    if(meta[0].question_style==='case'&&!same(projected.subquestions.map(q=>q.id).sort(),classifications.filter(c=>c.source_set_id===source.id&&c.question_style==='case').map(c=>c.subquestion_id).sort()))fail('case_complete_projection',{unit_id:unit.id});
    for(const kind of ['model','partial','wrong']){
      const chosen=projected.subquestions.map(s=>normalized.get(source.id+'/'+s.id+'/'+kind));if(!chosen.some(Boolean))continue;
      const answers=Object.fromEntries(projected.subquestions.map((s,i)=>[s.id,chosen[i]?.answer??'']));
      const expected=projected.subquestions.map((s,i)=>chosen[i]?.expected??{subquestion_id:s.id,expected_points:0,expected_verdicts:s.criteria.map(c=>({criterion_id:c.id,verdict:'not_met',reason:'준비 검사 전용 context-only 빈 답안'}))});
      const evaluated=projected.subquestions.filter((_,i)=>chosen[i]).map(s=>s.id);contextOnly+=projected.subquestions.length-evaluated.length;
      try{validateExpected(projected,expected);}catch(e){fail('production_expected_validator',{unit_id:unit.id,kind,error:e.message});}
      const inputKey=contentHash({model:'gpt-5.6-luna',prompt:buildGradingPrompt(projected,answers),schema:buildGradingResponseSchema(projected,answers)});
      const id=unit.id+'--'+kind;if(requestKeys.has(inputKey))fail('duplicate_actual_request',{id,previous:requestKeys.get(inputKey),input_hash:inputKey});requestKeys.set(inputKey,id);
      requests.push({id,input_hash:inputKey,projected_hash:contentHash(projected),evaluated_subquestion_ids:evaluated,expected_points:expected.map(q=>({subquestion_id:q.subquestion_id,expected_points:q.expected_points})),kind});
    }
  }
}catch(e){fail('projection_compile',{error:e.message});}
const parent=selectedById.get('pilot-10-007')?.set,derivative=selectedById.get('pilot-10-007-standards')?.set;
const split={parent_subquestion_ids:parent?.subquestions.map(q=>q.id),derivative_subquestion_ids:derivative?.subquestions.map(q=>q.id),derivative_native_style:derivative?.subquestions[0]?.question_style,derivative_fact_count:derivative?.shared_context.facts.length};
if(!same(split.parent_subquestion_ids,['sub1','sub2','sub3'])||!same(split.derivative_subquestion_ids,['sub4'])||split.derivative_native_style!=='standard'||split.derivative_fact_count!==0)fail('new_split_shape',split);
bytes(E+'/prepare-batch.ts');
const changed=[...inputs.values()].filter(i=>sha(fs.readFileSync(i.file))!==i.sha256).map(({bytes,...i})=>i);
const report={version:1,artifact_type:'independent_integration_preflight',reviewer:'plan_procedures',created_at:new Date().toISOString(),api_calls:0,formal_validation_evidence:false,scope_note:'A 저장 모범답안 대표 교정 중의 준비 검사. model 실제 입력은 저장 model_answer.join(newline)로 가정한다. 이 가정은 대표 QA의 내용 검토 완료나 실제 모델 통과를 의미하지 않는다.',status:errors.length?'contract_errors_found':changed.length?'inputs_changed_during_check':'preparation_contracts_pass_under_stored_model_assumption',counts:{selected_sets:selected.length,selected_subquestions:selected.reduce((n,s)=>n+s.set.subquestions.length,0),representatives:reps.length,learning_units:unitCount,actual_request_shapes:requests.length,evaluated_answers:requests.reduce((n,r)=>n+r.evaluated_subquestion_ids.length,0),context_only_answers:contextOnly,errors:errors.length},errors,model_representative_differences:modelChanges,split,requests,representatives:origins,changed_during_read:changed,inputs:[...inputs.values()].map(({bytes,...i})=>i),prepare_script_review:[{finding:'prepare-batch 자체는 partial 범위·wrong 0·criterion 합계·kind 전수 커버를 쓰기 전에 검사하지 않는다.',effect:'현재 원자료는 독립 검사로 확인하며 실제 API 전 완성 manifest에 같은 검사를 적용해야 한다. receipt의 후행 검사만 사용하면 API 이후 발견될 수 있다.'},{finding:'prepare-batch는 baseline/master/classification/oldCatalog를 read하지만 최초 read buffer와 freeze hash를 결속하지 않는다.',effect:'현재 동결 입력 읽기에서는 즉시 오류를 뜻하지 않는다. 실행 중 입력을 바꾸지 않고, 최종 candidate 선택·diff 전수 검사로 실제 snapshot을 확인해야 한다.'}]};
const out=E+'/b/integration-preflight.json';fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:out,sha256:sha(fs.readFileSync(out)),status:report.status,counts:report.counts,errors,model_difference_count:modelChanges.length,changed_during_read:changed},null,2));
