// 발문의 KGA 약칭 21개를 감사기준서 표기로 바꾼 수정본과 실측 준비물을 만든다. 정본은 쓰지 않고 모델도 호출하지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v2/prepare.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EFFICIENT_RUNTIME_FILES} from '../../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../../questionReviewIdentity.ts';
import {validateAuthoringBank} from '../../../../questionBankPublication.ts';
import {compileLearningCatalog} from '../../../../../scripts/build-learning-unit-catalog.ts';
import {compilePublicQuestionSet,computeSubquestionMaxPoints} from '../../../../../lib/questionV3.ts';
import {selectLearningQuestionSet,learningUnitId} from '../../../../../lib/learningUnits.ts';
import {contentHash} from '../../../../../lib/learningSubmission.ts';
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v2';
const SP='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const PR='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/sealed-results-v4/batch.json';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/baseline.json'),'준비 결과가 이미 있다. 새 버전 폴더를 만든다.');
const canonical={authoring:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',ledger:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json',encrypted:'data/cpa_question_sets_v3.authoring.enc.json',catalog:'cpa_uploader/data/learning-question-classifications.json'};
const FULL='감사기준서 1200(소규모기업 재무제표에 대한 감사)';
// 표기 변환: 1200은 첫 언급에 공식 제목, 일반 약칭은 감사기준서 NNN, 붙여 쓴 문단 번호는 띄운다.
function T(text,firstMention){
 let t=text.replaceAll('소규모기업감사기준서 KGA 1200',FULL).replaceAll('KGA 200부터 KGA 720까지','감사기준서 200부터 720까지');
 if(firstMention&&!t.includes(FULL))t=t.replace('KGA 1200',FULL);
 return t.replace(/\bKGA (\d{3,4})/g,'감사기준서 $1').replace(/문단(?=A?\d)/g,'문단 ');
}
const NOTE='2026-09-14 신규 기준서형 전수 검증 후속(범위 밖 KGA 약칭): 학습자에게 보이는 KGA 약칭을 감사기준서 표기로 바꾸었다. 요구·정답 명제·배점은 같다. 근거: '+F+'/changes.json';
// 1. 기준 정본 보존
const baseline=Object.entries(canonical).map(([name,file])=>{const copy=F+'/baseline/'+name+path.extname(file);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);assert.equal(ref(copy).sha256,ref(file).sha256);return{name,...ref(file),backup:copy};});
write(F+'/baseline.json',baseline);
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업의 정본 변경: '+r.file);};
// 2. 수정
const bank=read(canonical.authoring),oldCatalog=read(canonical.catalog),edited=structuredClone(bank);
const targets=edited.filter(s=>s.status==='published'&&s.subquestions.some(q=>/\bKGA\b/.test(q.prompt)));
assert.equal(targets.length,21);assert(targets.every(s=>s.subquestions.length===1&&s.subquestions[0].question_style==='standard'&&!(s.shared_context?.facts??[]).length));
const changes=[];
for(const s of targets){const q=s.subquestions[0],before=reviewedContentHash(bank.find(x=>x.id===s.id)),fields=[];
 const rec=(field,oldText,newText)=>{if(oldText!==newText){fields.push({field,before:oldText,after:newText});}return newText;};
 if(s.title===q.prompt)s.title=rec('title',s.title,T(s.title,true));
 q.prompt=rec('subquestions[0].prompt',q.prompt,T(q.prompt,true));
 q.model_answer=q.model_answer.map((a,i)=>rec(`model_answer[${i}]`,a,T(a,false)));
 for(const c of q.criteria){c.claim=rec(`criteria.${c.id}.claim`,c.claim,T(c.claim,false));for(const f of c.critical_facts)f.expected=rec(`criteria.${c.id}.critical_facts.${f.id}`,f.expected,T(f.expected,false));}
 assert(fields.some(f=>f.field==='subquestions[0].prompt'));
 const visible=[s.title,q.prompt,...q.model_answer,...q.criteria.map(c=>c.claim)].join('\n');assert(!/\bKGA\b/.test(visible),'학습자에게 보이는 KGA가 남았다: '+s.id);
 s.verification.notes.push(NOTE);
 changes.push({set_id:s.id,subquestion_id:q.id,fields,content_hash_before:before});}
for(const s of edited){const o=bank.find(x=>x.id===s.id);if(!targets.includes(s)){assert.deepEqual(s,o);continue;}
 const q=s.subquestions[0],oq=o.subquestions[0];assert.deepEqual(q.criteria.map(c=>[c.id,c.max_points,c.requirement_id,c.scores,c.source_ref_ids,c.critical_facts.map(f=>[f.id,f.type])]),oq.criteria.map(c=>[c.id,c.max_points,c.requirement_id,c.scores,c.source_ref_ids,c.critical_facts.map(f=>[f.id,f.type])]));
 assert.deepEqual(q.requirements,oq.requirements);assert.deepEqual(s.source_refs,o.source_refs);assert.deepEqual(q.topic_ids,oq.topic_ids);assert.equal(q.model_answer.length,oq.model_answer.length);assert.equal(s.status,'published');}
assert.deepEqual(validateAuthoringBank(edited).errors,[]);
const bankRef=write(F+'/evidence-bank.json',edited);
const ids=targets.map(s=>s.id);
for(const c of changes)c.content_hash_after=reviewedContentHash(edited.find(s=>s.id===c.set_id));
write(F+'/changes.json',{version:1,authorization:ref(F+'/authorization.md'),baseline_bank:baseline.find(b=>b.name==='authoring'),edited_bank:bankRef,changed_sets:ids,rule:'KGA NNN → 감사기준서 NNN, 감사기준서 1200은 첫 언급에 공식 제목 병기, 붙여 쓴 문단 번호 띄움',changes,unchanged:'요구 범위·정답 명제·criterion ID·배점·requirement·원문 인용·주제·유형'});
// 3. 분류 검토·카탈로그
const priorReview=read(oldCatalog.review_file);assert.equal(ref(oldCatalog.review_file).sha256,oldCatalog.review_file_sha256);
const entries=priorReview.entries.map(e=>{if(!ids.includes(e.set_id))return e;const q=edited.find(s=>s.id===e.set_id).subquestions.find(x=>x.id===e.subquestion_id);assert.equal(e.question_style,'standard');return{...e,standalone_prompt:q.prompt,reason:e.reason+' 2026-09-14 KGA 약칭 표기 수정본에 결속했다. 유형·주제는 같다.'};});
const reviewRef=write(F+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries});
const compiled=compileLearningCatalog(edited,entries,oldCatalog.topics);
for(const c of compiled.classifications){const o=oldCatalog.classifications.find(x=>x.source_set_id===c.source_set_id&&x.subquestion_id===c.subquestion_id);assert(o);if(!ids.includes(c.source_set_id))assert.deepEqual(c,o,'수정 대상 외 분류 변경');else{assert.deepEqual(c.topic_ids,o.topic_ids);assert.equal(c.question_style,o.question_style);}}
const catalogRef=write(F+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,public_content_hash:contentHash(edited.map(compilePublicQuestionSet)),review_file:reviewRef.file,review_file_sha256:reviewRef.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
// 4. 대표답안: 직전 수락 실측의 원답안·기대값을 그대로 쓴다(모범답안이 바뀐 물음은 새 모범답안).
const v4=read(SP+'/execution-v4/grading-manifest.json'),pr=read(read(PR).grading_manifest.file);
const scope=write(F+'/scope.json',{targets:ids.map(id=>({set_id:id,subquestion_ids:edited.find(s=>s.id===id).subquestions.map(q=>q.id)}))});
const workers=['a','b','c'],jobs=[],selectionFiles=new Set();
ids.forEach((id,i)=>{const s=edited.find(x=>x.id===id),q=s.subquestions[0],unit=learningUnitId(id,'standard',q.id);
 const meta=compiled.classifications.filter(c=>c.source_set_id===id),projected=selectLearningQuestionSet(s,meta,unit);assert.equal(projected.subquestions[0].prompt,q.prompt);
 const proj=write(F+'/projections/'+unit+'.json',projected);
 const origin=v4.entries.some(e=>e.source_set_id===id)?{manifest:v4,file:SP+'/execution-v4/grading-manifest.json'}:{manifest:pr,file:read(PR).grading_manifest.file};
 for(const kind of ['model','partial','wrong']){
  const old=origin.manifest.entries.find(e=>e.source_set_id===id&&e.kind===kind&&e.evaluated_subquestion_ids.join()===q.id);assert(old,id+' '+kind);assert.equal(old.learning_unit_id,unit);
  let answers,expected,evidence;
  if(kind==='model'){answers={[q.id]:q.model_answer.join('\n')};expected=old.expected_by_subquestion;assert(expected[0].expected_verdicts.every(v=>v.verdict==='met'));
   assert.deepEqual(expected[0].expected_verdicts.map(v=>v.criterion_id).sort(),q.criteria.map(c=>c.id).sort());assert.equal(expected[0].expected_points,computeSubquestionMaxPoints(q));
   evidence={...bankRef,subquestion_id:q.id,case_id:null,kind,reason:'수정본의 저장 모범답안 전체를 앱 투영으로 채점한다(만점 기대).'};}
  else{const sel=old.selection_evidence[0];assert.equal(ref(sel.file).sha256,sel.sha256,'원 대표답안 파일 변경: '+sel.file);selectionFiles.add(sel.file);const c=read(sel.file).cases.find(x=>x.id===sel.case_id);assert(c&&c.subquestion_id===q.id);
   answers={[q.id]:c.answer};assert.deepEqual(answers,old.answers);expected=[{subquestion_id:q.id,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts}];assert.deepEqual(expected,old.expected_by_subquestion);
   assert.deepEqual(c.expected_verdicts.map(v=>v.criterion_id).sort(),q.criteria.map(x=>x.id).sort(),'기준 ID 변경: '+id);
   evidence={file:sel.file,sha256:sel.sha256,subquestion_id:q.id,case_id:c.id,kind,reason:'직전 수락 실측의 같은 원답안·기대값을 수정본으로 다시 채점한다: '+sel.reason};}
  jobs.push({id:`fix2-${id.replace('std-points-20260914-','')}-${q.id}-${kind}`,worker:workers[i%3],source_set_id:id,learning_unit_id:unit,kind,projected_file:proj.file,projected_sha256:proj.sha256,evaluated_subquestion_ids:[q.id],answers,expected_by_subquestion:expected,selection_evidence:[evidence]});
 }});
const policy=write(F+'/policy.json',{scope,model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:0.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:null,budget_enforcement:'not_specified',planned_new_api_calls:jobs.length,repeat_policy:'허용 범위 밖 결과에만 원인 조사와 표적 재검사를 한다. ±1점 편차를 없애기 위한 반복 호출은 하지 않는다.'});
// 5. 실행 코드 보존본과 manifest
const runner=SP+'/run-efficient-grading.ts',code=[...new Set([...EFFICIENT_RUNTIME_FILES,runner,SP+'/accounting.ts',SP+'/contract.ts'])];
const snapshots=code.map((file,i)=>{const copy=F+'/runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
const snapRef=write(F+'/runtime-snapshots.json',snapshots);
const sources=[...new Set(targets.flatMap(s=>s.source_refs.map(r=>r.file)))];
const inputs=[...new Set([F+'/authorization.md',F+'/prepare.mjs',F+'/changes.json',F+'/baseline.json',SP+'/execution-v4/grading-manifest.json',read(PR).grading_manifest.file,...selectionFiles,snapRef.file,...sources])].map(ref);
const manifest=write(F+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs,code_files:code.map(ref),entries:jobs});
guard();
console.log(JSON.stringify({status:'prepared',changed_sets:ids.length,field_changes:changes.reduce((n,c)=>n+c.fields.length,0),entries:jobs.length,workers:Object.fromEntries(workers.map(w=>[w,jobs.filter(e=>e.worker===w).length])),manifest}));
