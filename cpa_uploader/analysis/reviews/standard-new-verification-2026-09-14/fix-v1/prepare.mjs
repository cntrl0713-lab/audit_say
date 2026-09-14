// F1–F3 문구 수정본과 실측 준비물을 만든다. 정본은 쓰지 않고 모델도 호출하지 않는다.
// 출력: 기준 정본 사본, 수정 은행(evidence-bank.json), 변경 장부, 분류 검토·카탈로그, 앱 투영, 대표답안 30건의 채점 manifest
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v1/prepare.mjs
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
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v1';
const SP='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/baseline.json'),'준비 결과가 이미 있다. 새 버전 폴더를 만든다.');
const canonical={authoring:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',ledger:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json',encrypted:'data/cpa_question_sets_v3.authoring.enc.json',catalog:'cpa_uploader/data/learning-question-classifications.json'};
const P='std-points-20260914-';
// [세트, 물음, 위치(prompt 또는 criterion ID), 바꿀 원문, 새 문구, 발견]
const EDITS=[
 [P+'2089042a4b32','sub3','crit2','정관 위반인 사실이 동시에 부정행위나 중대한 법령 위반이면 그 해당 사유로 보고 대상이 될 수 있다.','정관 위반인 사실이 동시에 부정행위나 중대한 법령 위반에 해당하면 그 사유로 보고 대상이 될 수 있다는 부연은 요구하지 않으며, 덧붙여도 감점하지 않는다.','F1'],
 [P+'10e28726886d','sub2','crit1','준수했는지 여부 괄호는','준수했는지 여부. 괄호는','F2'],
 [P+'97a86c8d6e2f','sub2','crit5','미수정왜곡표시의 목록 그룹업무팀이','미수정왜곡표시의 목록. 그룹업무팀이','F2'],
 [P+'97a86c8d6e2f','sub2','crit8','(부정이나 의심되는 부정 포함) 부정 관련','(부정이나 의심되는 부정 포함). 부정 관련','F2'],
 [P+'d22c23444c4b','sub1','prompt','KGA 230 문단13(a)~(b)에 따라','감사기준서 230 문단 13(a)~(b)에 따라','F3'],
 [P+'6e9dfa933285','sub1','prompt','KGA 230 문단13(c)에 따라','감사기준서 230 문단 13(c)에 따라','F3'],
 [P+'f47d4eaf7a09','sub1','prompt','KGA 260 문단22에 따라','감사기준서 260 문단 22에 따라','F3'],
 [P+'7e1091f2c13f','sub1','prompt','KGA 260 A53에 예시된','감사기준서 260 문단 A53에 예시된','F3'],
 [P+'c9c523cdf8c0','sub2','prompt','KGA 260 문단18에 따라','감사기준서 260 문단 18에 따라','F3'],
 [P+'e0f4e9e0403a','sub2','prompt','KGA 260 문단19~21에 따라 지배기구와 커뮤니케이션할 때 유의적 발견사항과 문단17의','감사기준서 260 문단 19~21에 따라 지배기구와 커뮤니케이션할 때 유의적 발견사항과 문단 17의','F3'],
 [P+'3e3ab8d53e62','sub2','prompt','KGA 260 문단23에 따라','감사기준서 260 문단 23에 따라','F3'],
];
const NOTE={F1:'2026-09-14 신규 기준서형 전수 검증 F1 후속: crit2의 비필수 부연을 채점 요건이 아닌 안내로 바꾸었다. 정답 명제·모범답안·배점은 같다.',F2:'2026-09-14 신규 기준서형 전수 검증 F2 후속: 기준 명제와 채점 안내 사이에 마침표를 넣었다. 정답 명제·모범답안·배점은 같다.',F3:'2026-09-14 신규 기준서형 전수 검증 F3 후속: 발문의 내부 약칭 KGA를 감사기준서로 바꾸었다. 요구·정답·배점은 같다.'};
// 1. 기준 정본을 보존한다.
const baseline=Object.entries(canonical).map(([name,file])=>{const copy=F+'/baseline/'+name+path.extname(file);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);assert.equal(ref(copy).sha256,ref(file).sha256);return{name,...ref(file),backup:copy};});
write(F+'/baseline.json',baseline);
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업의 정본 변경: '+r.file);};
// 2. 검증 당시 본문과 같은지 확인하고 문구만 바꾼다.
const bank=read(canonical.authoring),oldCatalog=read(canonical.catalog),mech=read(V+'/mechanical-checks.json');
const edited=structuredClone(bank),byId=new Map(edited.map(s=>[s.id,s]));
const changes=[];
for(const [setId,subId,where,oldText,newText,finding] of EDITS){
 const s=byId.get(setId),q=s.subquestions.find(x=>x.id===subId);assert(s&&q&&s.subquestions.length===1,setId);
 const m=mech.questions.find(x=>x.question===setId+'/'+subId);assert(m,'검증 범위 밖: '+setId);
 const before=reviewedContentHash(bank.find(x=>x.id===setId));
 if(where==='prompt'){
  assert.equal(s.title,q.prompt,'세트 제목이 발문과 달라 제목 수정 범위를 다시 정해야 한다');
  assert.equal(q.prompt.split(oldText).length,2,'발문 원문 불일치: '+setId);
  const prompt=q.prompt.replace(oldText,newText);changes.push({set_id:setId,subquestion_id:subId,finding,fields:['title','subquestions[0].prompt','learning classification standalone_prompt'],before:q.prompt,after:prompt});q.prompt=prompt;s.title=prompt;
 }else{
  const c=q.criteria.find(x=>x.id===where);assert(c,where);assert.equal(c.claim.split(oldText).length,2,'criterion 원문 불일치: '+setId+'/'+where);
  const claim=c.claim.replace(oldText,newText);changes.push({set_id:setId,subquestion_id:subId,criterion_id:where,finding,fields:['criteria.claim'],before:c.claim,after:claim});c.claim=claim;
  assert(c.critical_facts.every(f=>!f.expected.includes(newText)),'핵심 사실은 기준 명제만 유지한다');
 }
 changes.at(-1).content_hash_before=before;
}
const touched=[...new Set(EDITS.map(e=>e[0]))];assert.equal(touched.length,10);
for(const id of touched){const s=byId.get(id),f=[...new Set(EDITS.filter(e=>e[0]===id).map(e=>e[5]))];assert.equal(f.length,1);s.verification.notes.push(NOTE[f[0]]+` 근거: ${F}/changes.json`);}
// 수정 대상 외 세트와 모든 정답·배점·criterion 구성이 그대로인지 확인한다.
for(const s of edited){const o=bank.find(x=>x.id===s.id);if(!touched.includes(s.id)){assert.deepEqual(s,o);continue;}
 const q=s.subquestions[0],oq=o.subquestions[0];assert.deepEqual(q.model_answer,oq.model_answer);assert.deepEqual(q.criteria.map(c=>[c.id,c.max_points,c.requirement_id,c.critical_facts,c.scores,c.source_ref_ids]),oq.criteria.map(c=>[c.id,c.max_points,c.requirement_id,c.critical_facts,c.scores,c.source_ref_ids]));
 assert.deepEqual(q.requirements,oq.requirements);assert.deepEqual(s.source_refs,o.source_refs);assert.deepEqual(q.topic_ids,oq.topic_ids);assert.equal(q.question_style,'standard');assert.equal(s.status,'published');}
assert.deepEqual(validateAuthoringBank(edited).errors,[]);
const bankRef=write(F+'/evidence-bank.json',edited);
for(const c of changes)c.content_hash_after=reviewedContentHash(byId.get(c.set_id));
write(F+'/changes.json',{version:1,authorization:ref(F+'/authorization.md'),baseline_bank:baseline.find(b=>b.name==='authoring'),edited_bank:bankRef,changed_sets:touched,changes,unchanged:'발문(F1·F2 대상)·모범답안·criterion ID·배점·requirement·원문 인용·주제·분류 유형'});
// 3. 분류 검토와 카탈로그: 기존 판정을 유지하고 F3 발문만 독립 발문에 반영한다.
const priorReview=read(oldCatalog.review_file);assert.equal(ref(oldCatalog.review_file).sha256,oldCatalog.review_file_sha256);
const entries=priorReview.entries.map(e=>{if(!touched.includes(e.set_id))return e;const s=byId.get(e.set_id),q=s.subquestions.find(x=>x.id===e.subquestion_id);assert.equal(e.question_style,'standard');
 return{...e,standalone_prompt:q.prompt,reason:e.reason+' 2026-09-14 F1–F3 문구 수정본에 결속했다. 유형·주제는 같다.'};});
assert.equal(entries.length,edited.flatMap(s=>s.subquestions).length);
const reviewRef=write(F+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries});
const compiled=compileLearningCatalog(edited,entries,oldCatalog.topics);
for(const c of compiled.classifications){const o=oldCatalog.classifications.find(x=>x.source_set_id===c.source_set_id&&x.subquestion_id===c.subquestion_id);assert(o);if(!touched.includes(c.source_set_id))assert.deepEqual(c,o,'수정 대상 외 분류 변경');else{assert.deepEqual(c.topic_ids,o.topic_ids);assert.equal(c.question_style,o.question_style);}}
const catalogRef=write(F+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,public_content_hash:contentHash(edited.map(compilePublicQuestionSet)),review_file:reviewRef.file,review_file_sha256:reviewRef.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
// 4. 대표답안: 재편 실행의 모범·부분·오답 원답안과 기대값을 그대로 쓴다.
const originManifest=read(SP+'/execution-v4/grading-manifest.json'),repsFile=SP+'/execution-v1/representatives.json',reps=read(repsFile);
const scope=write(F+'/scope.json',{targets:touched.map(id=>({set_id:id,subquestion_ids:byId.get(id).subquestions.map(q=>q.id)}))});
const policy=write(F+'/policy.json',{scope,model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:0.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:null,budget_enforcement:'not_specified',planned_new_api_calls:30,repeat_policy:'허용 범위 밖 결과에만 원인 조사와 표적 재검사를 한다. ±1점 편차를 없애기 위한 반복 호출은 하지 않는다.'});
const workers=['a','b','c'],entries2=[];
touched.forEach((id,i)=>{const s=byId.get(id),q=s.subquestions[0],unit=learningUnitId(id,'standard',q.id);
 const meta=compiled.classifications.filter(c=>c.source_set_id===id);const projected=selectLearningQuestionSet(s,meta,unit);
 assert.equal(projected.subquestions[0].prompt,q.prompt);const proj=write(F+'/projections/'+unit+'.json',projected);
 for(const kind of ['model','partial','wrong']){
  const old=originManifest.entries.find(e=>e.source_set_id===id&&e.kind===kind);assert(old,id+' '+kind);
  let answers,expected,evidence;
  if(kind==='model'){answers={[q.id]:q.model_answer.join('\n')};assert.deepEqual(answers,old.answers);expected=old.expected_by_subquestion;assert(expected[0].expected_verdicts.every(v=>v.verdict==='met'));assert.equal(expected[0].expected_points,computeSubquestionMaxPoints(q));evidence={...bankRef,subquestion_id:q.id,case_id:null,kind,reason:'저장 모범답안 전체를 수정본 앱 투영으로 채점한다(만점 기대).'};}
  else{const sel=old.selection_evidence[0];assert.equal(sel.file,repsFile);assert.equal(sel.sha256,ref(repsFile).sha256);const c=reps.cases.find(x=>x.id===sel.case_id);assert(c&&c.subquestion_id===q.id);answers={[q.id]:c.answer};assert.deepEqual(answers,old.answers);
   expected=[{subquestion_id:q.id,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts}];assert.deepEqual(expected,old.expected_by_subquestion);evidence={file:repsFile,sha256:sel.sha256,subquestion_id:q.id,case_id:c.id,kind,reason:'재편 실측에서 쓴 같은 원답안·기대값을 수정본으로 다시 채점한다: '+sel.reason};}
  entries2.push({id:`fix1-${id.slice(P.length)}-${q.id}-${kind}`,worker:workers[i%3],source_set_id:id,learning_unit_id:unit,kind,projected_file:proj.file,projected_sha256:proj.sha256,evaluated_subquestion_ids:[q.id],answers,expected_by_subquestion:expected,selection_evidence:[evidence]});
 }});
// 5. 실행 코드 보존본과 manifest
const runner=SP+'/run-efficient-grading.ts',code=[...new Set([...EFFICIENT_RUNTIME_FILES,runner,SP+'/accounting.ts',SP+'/contract.ts'])];
const snapshots=code.map((file,i)=>{const copy=F+'/runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
const snapRef=write(F+'/runtime-snapshots.json',snapshots);
const sources=[...new Set(touched.flatMap(id=>byId.get(id).source_refs.map(r=>r.file)))];
const inputs=[...new Set([F+'/authorization.md',F+'/prepare.mjs',F+'/changes.json',F+'/baseline.json',V+'/content-review.json',V+'/mechanical-checks.json',repsFile,SP+'/execution-v4/grading-manifest.json',snapRef.file,...sources])].map(ref);
const manifest=write(F+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs,code_files:code.map(ref),entries:entries2});
guard();
console.log(JSON.stringify({status:'prepared',changed_sets:touched.length,changes:changes.length,entries:entries2.length,workers:Object.fromEntries(workers.map(w=>[w,entries2.filter(e=>e.worker===w).length])),manifest}));
