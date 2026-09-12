import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { decisions, deliberateOverlap } from './manual-decisions.mjs';
import { supplements, caseOverrides } from './representative-supplement-spec.mjs';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11',E=`${D}/efficient-verification-2026-09-12/c`;
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=x=>crypto.createHash('sha256').update(x).digest('hex'),fh=f=>hash(fs.readFileSync(f));
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const load=async f=>await import(pathToFileURL(path.resolve(f)).href);
const {compileLearningCatalog}=await load('scripts/build-learning-unit-catalog.ts');
const {validateAuthoringBank}=await load('cpa_uploader/questionBankPublication.ts');
const master=read(`${D}/a/execution-all-v9/manifest.json`),bank=read(master.bank_file);
const current=read(`${D}/c/prepared-reviewed-v8/learning-question-classifications.json`);
const follow=['content-followups-v1','scope-followups-v1','kga800-followup-v1'].flatMap(d=>read(`${E}/${d}/index.json`).entries);
const jobs=master.jobs.filter(j=>Number(bank.find(s=>s.id===j.set_id).classification.topic_id)>=10).map(j=>({...j,...(follow.find(f=>f.set_id===j.set_id)??{})}));
jobs.push(follow.find(f=>f.set_id==='pilot-10-007-standards'));
for(const j of jobs){const f=`${E}/qa-expectation-followups-v1/${j.set_id}.json`;if(!follow.some(x=>x.set_id===j.set_id)&&fs.existsSync(f)){j.qa_file=f;j.qa_sha256=fh(f);}}
const review=[],representatives=[],selected=[],supplementFiles=[],classes=[],sets=[];
const roles={model:'stored_model_answer',partial:'partial_answer',wrong:'wrong_or_boundary_answer'};
function manualCase(q,id,a,met,contra,kind){const expected_verdicts=q.criteria.map(c=>({criterion_id:c.id,verdict:contra.includes(c.id)?'contradicted':met.includes(c.id)?'met':'not_met',reason:contra.includes(c.id)?'답안이 해당 명제를 명시적으로 부정한다.':met.includes(c.id)?'답안에 해당 독립 명제가 직접 제시되어 있다.':'이 명제 또는 이를 분명하게 함축하는 설명은 제시되지 않았다.'}));return {id,subquestion_id:q.id,kind,answer:a,expected_points:expected_verdicts.filter(x=>x.verdict==='met').length,expected_verdicts,note:'agent가 원문·발문·전체 criterion을 대조한 대표 답안. 실제 모델 호출은 별도이다.'};}
for(const job of jobs){
 const document=read(job.file);const s=(Array.isArray(document)?document:[document]).find(s=>s.id===job.set_id);assert(s);sets.push(s);
 const old=bank.find(s0=>s0.id===s.id)??bank.find(s0=>s0.id==='pilot-10-007');
 const plan0=read(job.plan_file),p=plan0.plans?.find(p=>p.set_id===s.id)??plan0;
 const qa=read(job.qa_file),allCases=qa.cases;
 const derived=s.id==='pilot-10-007-standards',ds=derived?null:read(`${E}/dossiers/topic-${s.classification.topic_id}.json`).entries.find(e=>e.set_id===s.id);
 const supplement=[];
 const followDir=job.file.slice(0,job.file.lastIndexOf('/'));
 const classFile=follow.some(f=>f.set_id===s.id)?`${followDir}/classification.json`:null;
 const clRows=classFile?read(classFile).classifications:current.classifications.filter(c=>c.source_set_id===s.id);
 for(let qi=0;qi<s.subquestions.length;qi++){
  const q=s.subquestions[qi],key=`${s.id}/${q.id}`,c=clRows.find(c=>c.subquestion_id===q.id);assert(c,key);
  const max=q.criteria.reduce((n,c)=>n+c.max_points,0),cid=q.criteria.map(c=>c.id);
  let why=derived?read(`${E}/content-followups-v1/${s.id}/changes.json`).reason:decisions[s.id][qi];assert(why,key);
  if(follow.some(f=>f.set_id===s.id)&&((s.id==='pilot-10-007'&&q.id==='sub2')||(s.id==='pilot-16-011'&&q.id==='sub1')||(s.id==='pilot-17-005'&&q.id==='sub2')))why=read(`${E}/content-followups-v1/${s.id}/changes.json`).reason;
  if(s.id==='pilot-19-003')why=(q.id==='sub1'?'국내800.8(a)~(c)의 목적·이용자·경영진 조치3개의 독립1점을 유지한다.':'국내800.9/A9와200.18/23의 관련기준 준수·예외적 비효과성·목적달성 대체절차3개의 독립1점을 유지한다.')+' '+read(`${followDir}/changes.json`).reason;
  if(s.id==='pilot-11-005'&&q.id==='sub3')why+=' '+read(`${followDir}/changes.json`).reason;
  const beforeQ=old.subquestions.find(oq=>oq.id===(derived?'sub2':q.id));
  const classEntry={set_id:s.id,subquestion_id:q.id,question_style:c.question_style,topic_ids:c.topic_ids,standalone_prompt:c.question_style==='standard'?(c.standalone_prompt??q.prompt):null,case_fact_ids:c.question_style==='standard'?[]:c.case_fact_ids??[],reason:why};classes.push(classEntry);
  const oldProp=ds?.questions.find(dq=>dq.id===q.id)?.proposed_representatives??{};
  const override=caseOverrides[key]??{};
  const subset=allCases.filter(x=>x.subquestion_id===q.id&&x.answer.trim());
  const picks={};
  picks.model=override.model?subset.find(x=>x.id===override.model):subset.find(x=>x.answer===q.model_answer.join('\n')&&x.expected_points===max);
  if(!picks.model){picks.model=manualCase(q,`efficient/${q.id}/stored-model`,q.model_answer.join('\n'),cid,[],'stored_model_answer');supplement.push(picks.model);}
  picks.partial=override.partial?subset.find(x=>x.id===override.partial):oldProp.partial?subset.find(x=>x.id===oldProp.partial.id):null;
  picks.wrong=override.wrong?subset.find(x=>x.id===override.wrong):oldProp.wrong?subset.find(x=>x.id===oldProp.wrong.id):subset.find(x=>x.expected_verdicts.some(v=>v.verdict==='contradicted'));
  const spec=supplements[key];
  if(!picks.partial&&max>1){assert(spec?.[0],`missing partial ${key}`);picks.partial=manualCase(q,`efficient/${q.id}/source-based-partial`,spec[0],spec[1],[],'independent_partial');supplement.push(picks.partial);}
  if(!picks.wrong){assert(spec?.[2],`missing wrong ${key}`);picks.wrong=manualCase(q,`efficient/${q.id}/source-based-wrong`,spec[2],[],spec[3],'wrong');supplement.push(picks.wrong);}
  if(max===1)picks.partial=null;
  const selectedCases=[];
  for(const [kind,cc] of Object.entries(picks))if(cc){
   assert.deepEqual(cc.expected_verdicts.map(v=>v.criterion_id).sort(),[...cid].sort(),`${key}/${cc.id}`);assert.equal(cc.expected_points,cc.expected_verdicts.filter(v=>v.verdict==='met').length);assert(cc.answer.trim());
   if(kind==='model')assert.equal(cc.expected_points,max);if(kind==='partial')assert(cc.expected_points>0&&cc.expected_points<max);
   const qaFile=supplement.includes(cc)?`${E}/representative-supplements/${s.id}.json`:job.qa_file;
   const r={set_id:s.id,subquestion_id:q.id,question_file:job.file,question_sha256:fh(job.file),role:roles[kind],case_id:cc.id,qa_file:qaFile,answer_sha256:hash(cc.answer),expected_points:cc.expected_points,expected_verdicts:cc.expected_verdicts,reason:kind==='model'?'저장 모범답안의 모든 명제를 충족하는지 확인한다.':kind==='partial'?'정확한 독립 명제의 부분점수와 누락 명제의 경계를 확인한다.':'원문과 다른 명시적 반대 또는 발문 대상 밖 답안을 검증한다. 독립적으로 맞는 다른 명제의 점수는 보존한다.',case:cc};representatives.push(r);selectedCases.push(r);
  }
  const refids=[...new Set([...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(c=>c.source_ref_ids)])];
  const source_evidence=refids.map(id=>{const ref=s.source_refs.find(r=>r.id===id);assert(ref,`${key}/${id}`);const text=fs.readFileSync(ref.file,'utf8'),start=text.indexOf(ref.source_quote);assert(start>=0);assert.equal(hash(ref.source_quote),ref.content_hash);return {source_ref_id:id,file:ref.file,file_sha256:fh(ref.file),quote_sha256:ref.content_hash,title:ref.title,source_span:ref.source_span??null,line_start:text.slice(0,start).split('\n').length,line_end:text.slice(0,start+ref.source_quote.length).split('\n').length,exact_in_source:true,criterion_ids:q.criteria.filter(c=>c.source_ref_ids.includes(id)).map(c=>c.id),requirement_ids:q.requirements.filter(r=>r.source_ref_id===id).map(r=>r.id)};});
  const editionPending=s.id==='pilot-19-003'&&!p.metadata?.domestic_kga800_followup;
  const checks=Object.fromEntries(['source','answer','prompt','points','style','topics','edition','nonduplication'].map(k=>[k,editionPending&&(k==='source'||k==='edition')?'needs_review':'pass']));
  const overlap=deliberateOverlap[s.id]??'현재 전체 은행·초안의 같은 주제 요구와 대조했다. 일반 주제의 인접성만으로 같은 요구로 보지 않으며, 이 물음 안에서 동일 명제에 중복 점수를 배정하지 않는다.';
  review.push({set_id:s.id,subquestion_id:q.id,reviewer:'agent',reviewer_agent:'plan_completion',status:editionPending?'needs_review':'pass',status_scope:'실제 agent 내용 대조. 사람 확인·유료 모델 의미검수·실제 채점·게시와 별개.',file:job.file,file_sha256:fh(job.file),subquestion_sha256:hash(JSON.stringify(q)),plan_file:job.plan_file,plan_sha256:fh(job.plan_file),source_evidence,...classEntry,review_reason:why,checks,check_reasons:{source:editionPending?'직접 ISA800 인용은 일치하나 국내800 직접 판본 확인을 A가 진행 중이다. 해당 문단의 국내 적용 확인 전 통과시키지 않는다.':`모든 requirement와 criterion 출처의 합집합 ${source_evidence.length}개를 원문에 대조했다. ${why}`,answer:`저장 답안과 ${cid.join(', ')}의 실질 요구·조건·예외를 대조했다. ${why}`,prompt:`실제 득점요건과 발문 범위를 양방향으로 대조했다. ${why}`,points:why,style:c.question_style==='standard'?'독립 발문만으로 같은 답안과 모든 criterion이 성립한다. 사례 부모와 사실은 학습 투영에서 제거된다.':'공통 사실에서 상황·주체·시점 또는 주어진 판단을 해석하여 답해야 한다. 부모와 해당 사례의 전체 사례형 물음을 함께 투영한다.',topics:`물음의 실제 요구에 따른 주제 ${c.topic_ids.join('/')}를 원문·OX 주제와 대조했다. ${why}`,edition:editionPending?'국내800 본문 및 적용판본 확인 대기. ISA800 국제 원문과 국내 채택·시행을 구별한다.':p.edition_assumption,nonduplication:overlap},point_review:{decision:derived?'split':JSON.stringify(beforeQ)===JSON.stringify(q)?'maintain':s.id==='pilot-10-007'&&q.id==='sub2'?'split':'clarify',before_points:derived?null:beforeQ.criteria.reduce((n,c)=>n+c.max_points,0),after_points:max,independent_elements:q.criteria.map(c=>({criterion_id:c.id,points:c.max_points,minimum_sufficient_proposition:c.claim})),minimum_sufficient_answer:q.model_answer,burden:`${max}개 독립 명제를 짧은 열거 또는 필요한 설명으로 제시한다. 문장·단어 수와 조건·수식어의 기계적 분해로 점수를 정하지 않았다.`,reason:why,partial_answer_evidence:picks.partial?{case_id:picks.partial.id,points:picks.partial.expected_points}:null,partial_not_applicable_reason:max===1?'단일 1점 명제이므로 양의 정수 부분점수는 없고 완전·오답으로 검증한다.':null,split_decision:s.id.startsWith('pilot-10-007')?read(`${E}/content-followups-v1/${s.id}/changes.json`).reason:'현재 요구의 논리 범위와 필요한 서술량을 대조하여 별도 물음 분할을 추가하지 않는다.'},representatives:selectedCases.map(({case:unused,...r})=>r),prior_evidence_reuse:{same_question_as_master:!derived&&JSON.stringify(beforeQ)===JSON.stringify(q),master_file:derived?master.jobs.find(j=>j.set_id==='pilot-10-007').file:master.jobs.find(j=>j.set_id===s.id).file,method:'기존 자료·판본 비교 증거를 재사용하되 이번에 발문·사실·모범답안·전체 criterion 및 직접 요구 출처를 읽고 수동 이유를 작성했다. 반복문은 형상·해시·합계 검증만 수행하며 내용을 자동 판정하지 않는다.'},unresolved_items:editionPending?['국내800 직접 본문·판본 확인 대기']:[],api_calls_in_this_review:0});
 }
 if(supplement.length){fs.mkdirSync(`${E}/representative-supplements`,{recursive:true});const f=`${E}/representative-supplements/${s.id}.json`;write(f,{version:1,artifact_type:'author_expected_judgments',set_id:s.id,cases:supplement});supplementFiles.push({file:f,sha256:fh(f),count:supplement.length});}
 selected.push({set_id:s.id,file:job.file,sha256:fh(job.file),plan_file:job.plan_file,plan_sha256:fh(job.plan_file),qa_file:job.qa_file,qa_sha256:fh(job.qa_file)});
}
assert.equal(sets.length,64);assert.equal(review.length,149);
const reviewedAt=new Date().toISOString();for(const row of review)row.reviewed_at=reviewedAt;
validateAuthoringBank(sets);
const compiled=compileLearningCatalog(sets,classes,current.topics);
for(const u of compiled.units){if(u.question_style==='standard'){assert.equal(u.subquestions.length,1);assert.equal(u.shared_context.facts.length,0);}else{assert(u.shared_context.facts.length>0);assert.deepEqual(u.subquestions.map(q=>q.id).sort(),classes.filter(c=>c.set_id===u.source_set_id&&c.question_style==='case').map(c=>c.subquestion_id).sort());}}
write(`${E}/selected-files.json`,{version:1,entries:selected,representative_supplements:supplementFiles});
write(`${E}/question-reviews.json`,{version:1,reviewer:'agent',reviewer_agent:'plan_completion',input_baseline:{file:master.bank_file,sha256:fh(master.bank_file),master_manifest:`${D}/a/execution-all-v9/manifest.json`,master_sha256:fh(`${D}/a/execution-all-v9/manifest.json`)},entries:review});
write(`${E}/representative-cases.json`,{version:1,api_calls:0,selection_method:'모든 물음의 저장 모범답안·독립 부분답안·명시 반대 또는 범위 밖 답안. 답안 전체를 읽고 기존 기대를 대조한 뒤 누락 유형은 원문에 따라 수동 보충.',entries:representatives});
write(`${E}/classification-review.json`,{version:1,entries:classes});write(`${E}/learning-catalog.json`,{schema_version:1,topics:current.topics,...compiled});
write(`${E}/local-checks.json`,{version:1,api_calls:0,source_set_count:sets.length,question_count:review.length,criteria_count:sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length,review_pass:review.filter(r=>r.status==='pass').length,review_pending:review.filter(r=>r.status!=='pass').map(r=>`${r.set_id}/${r.subquestion_id}`),representative_cases:representatives.length,roles:Object.fromEntries(Object.values(roles).map(role=>[role,representatives.filter(r=>r.role===role).length])),learning_units:compiled.units.length,authoring_shape:'pass',direct_source_quotes:'pass',qa_shape_and_integer_sum:'pass',style_projection:'pass',semantic_model_calls:0,grading_model_calls:0,human_approval:false,production_database_mutations:0,baseline_bank_unchanged:fh(master.bank_file)===master.bank_sha256});
console.log(JSON.stringify({sets:sets.length,questions:review.length,representatives:representatives.length,pending:review.filter(r=>r.status!=='pass').map(r=>`${r.set_id}/${r.subquestion_id}`)}));
