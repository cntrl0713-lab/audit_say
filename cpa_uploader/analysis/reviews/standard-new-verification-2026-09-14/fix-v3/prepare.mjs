// 경계 사례 B1·B2의 채점기준 문구 수정본과 실측 준비물을 만든다. 정본은 쓰지 않고 모델도 호출하지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v3/prepare.mjs
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
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v3';
const SP='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const BL='cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/baseline.json'),'준비 결과가 이미 있다. 새 버전 폴더를 만든다.');
const canonical={authoring:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',ledger:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json',encrypted:'data/cpa_question_sets_v3.authoring.enc.json',catalog:'cpa_uploader/data/learning-question-classifications.json'};
const E1='draft-standard-expansion-20260913-e01',S3='draft-standard-followup-20260913-s03';
// [세트, 물음, criterion, 기존 claim, 새 claim, 기존 핵심 사실, 새 핵심 사실, 발견]
const EDITS=[
 [E1,'sub1','crit1','회계법인의 사업적 이해관계나 영업활동 중 의뢰인과 이해상충이 될 수 있는 사항을 그 의뢰인에게 통보한다.',
  '회계법인의 사업적 이해관계나 영업활동 중 의뢰인과 이해상충이 될 수 있는 사항을 그 의뢰인에게 통보한다. 발문 ①이 제시한 "회계법인의 사업적 이해관계나 영업활동" 상황은 반복하지 않아도, ①의 경우 의뢰인과 이해상충이 될 수 있는 사항을 그 의뢰인에게 통보한다는 내용이 드러나면 인정한다.',
  '회계법인의 사업적 이해관계나 영업활동 중 의뢰인과 이해상충이 될 수 있는 사항을 그 의뢰인에게 통보한다.','①의 경우 의뢰인과 이해상충이 될 수 있는 사항을 그 의뢰인에게 통보한다.','B1'],
 [S3,'sub4','crit2','전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다. 특정 구획의 항목을 조사하는 절차 자체가 항상 금지되는 것은 아니다.',
  '전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다. "일반적으로" 등으로 절대적 금지가 아님이 드러나면 특정 구획의 항목을 조사하는 절차가 항상 금지되는 것은 아니라는 부연을 따로 쓰지 않아도 인정한다. 구획추출이나 특정 구획의 조사가 언제나 금지된다고 단정하면 인정하지 않는다.',
  '전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다. 특정 구획의 항목을 조사하는 절차 자체가 항상 금지되는 것은 아니다.','전체 모집단을 추론하는 표본감사에는 일반적으로 적합하지 않다.','B2'],
];
// 1. 기준 정본 보존
const baseline=Object.entries(canonical).map(([name,file])=>{const copy=F+'/baseline/'+name+path.extname(file);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);assert.equal(ref(copy).sha256,ref(file).sha256);return{name,...ref(file),backup:copy};});
write(F+'/baseline.json',baseline);
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업의 정본 변경: '+r.file);};
// 2. 수정
const bank=read(canonical.authoring),oldCatalog=read(canonical.catalog),edited=structuredClone(bank),byId=new Map(edited.map(s=>[s.id,s]));
const changes=[];
for(const [setId,subId,critId,oldClaim,newClaim,oldFact,newFact,finding] of EDITS){
 const s=byId.get(setId),q=s.subquestions.find(x=>x.id===subId),c=q.criteria.find(x=>x.id===critId);assert.equal(s.status,'published');
 assert.equal(c.claim,oldClaim,'claim 원문 불일치: '+setId);assert.equal(c.critical_facts.length,1);assert.equal(c.critical_facts[0].expected,oldFact,'핵심 사실 원문 불일치: '+setId);
 const before=reviewedContentHash(bank.find(x=>x.id===setId));c.claim=newClaim;c.critical_facts[0].expected=newFact;
 s.verification.notes.push(`2026-09-14 신규 기준서형 전수 검증 ${finding} 후속: ${subId} ${critId}의 채점기준 문구와 핵심 사실만 고쳤다. 발문·모범답안·배점·기대값은 같다. 근거: ${F}/changes.json`);
 changes.push({set_id:setId,subquestion_id:subId,criterion_id:critId,finding,fields:[{field:`criteria.${critId}.claim`,before:oldClaim,after:newClaim},{field:`criteria.${critId}.critical_facts.${c.critical_facts[0].id}`,before:oldFact,after:newFact}],content_hash_before:before});
}
const ids=[E1,S3];
for(const s of edited){const o=bank.find(x=>x.id===s.id);if(!ids.includes(s.id)){assert.deepEqual(s,o);continue;}
 for(const q of s.subquestions){const oq=o.subquestions.find(x=>x.id===q.id);assert.equal(q.prompt,oq.prompt);assert.deepEqual(q.model_answer,oq.model_answer);assert.deepEqual(q.requirements,oq.requirements);assert.deepEqual(q.topic_ids,oq.topic_ids);
  assert.deepEqual(q.criteria.map(c=>[c.id,c.max_points,c.requirement_id,c.scores,c.source_ref_ids]),oq.criteria.map(c=>[c.id,c.max_points,c.requirement_id,c.scores,c.source_ref_ids]));
  if(!EDITS.some(e=>e[0]===s.id&&e[1]===q.id))assert.deepEqual(q,oq,'수정 대상이 아닌 물음이 바뀌었다');}
 assert.deepEqual(s.source_refs,o.source_refs);assert.equal(s.title,o.title);}
assert.deepEqual(validateAuthoringBank(edited).errors,[]);
const bankRef=write(F+'/evidence-bank.json',edited);
for(const c of changes)c.content_hash_after=reviewedContentHash(byId.get(c.set_id));
write(F+'/changes.json',{version:1,authorization:ref(F+'/authorization.md'),baseline_bank:baseline.find(b=>b.name==='authoring'),edited_bank:bankRef,changed_sets:ids,changes,unchanged:'발문·모범답안·criterion ID·배점·requirement·원문 인용·주제·유형·대표답안 기대값'});
// 3. 분류: 발문이 같아 기존 판정을 그대로 두고 새 원문 판본에 결속한다.
const priorReview=read(oldCatalog.review_file);assert.equal(ref(oldCatalog.review_file).sha256,oldCatalog.review_file_sha256);
const entries=priorReview.entries.map(e=>ids.includes(e.set_id)?{...e,reason:e.reason+' 2026-09-14 B1·B2 채점기준 문구 수정본에 결속했다. 유형·주제·독립 발문은 같다.'}:e);
const reviewRef=write(F+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries});
const compiled=compileLearningCatalog(edited,entries,oldCatalog.topics);
for(const c of compiled.classifications){const o=oldCatalog.classifications.find(x=>x.source_set_id===c.source_set_id&&x.subquestion_id===c.subquestion_id);assert(o);if(!ids.includes(c.source_set_id))assert.deepEqual(c,o);else{assert.deepEqual(c.topic_ids,o.topic_ids);assert.equal(c.standalone_prompt,o.standalone_prompt);assert.equal(c.question_style,o.question_style);}}
const catalogRef=write(F+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,public_content_hash:contentHash(edited.map(compilePublicQuestionSet)),review_file:reviewRef.file,review_file_sha256:reviewRef.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
// 4. 대표답안: 두 세트 모든 물음의 원 모범·부분·오답과 기대값(standard-backlog-publication 수락 manifest)
const origin=read(BL+'/grading-manifest.json');
const scope=write(F+'/scope.json',{targets:ids.map(id=>({set_id:id,subquestion_ids:byId.get(id).subquestions.map(q=>q.id)}))});
const workers=['a','b','c'],jobs=[],selectionFiles=new Set();let n=0;
for(const id of ids){const s=byId.get(id);for(const q of s.subquestions){const unit=learningUnitId(id,'standard',q.id),worker=workers[n++%3];
 const meta=compiled.classifications.filter(c=>c.source_set_id===id&&c.subquestion_id===q.id),projected=selectLearningQuestionSet(s,meta,unit);assert.equal(projected.subquestions[0].prompt,q.prompt);
 const proj=write(F+'/projections/'+unit+'.json',projected);
 for(const kind of ['model','partial','wrong']){
  const old=origin.entries.find(e=>e.learning_unit_id===unit&&e.kind===kind);assert(old,unit+' '+kind);
  let answers,expected,evidence;
  if(kind==='model'){answers={[q.id]:q.model_answer.join('\n')};assert.deepEqual(answers,old.answers);expected=old.expected_by_subquestion;assert(expected[0].expected_verdicts.every(v=>v.verdict==='met'));assert.equal(expected[0].expected_points,computeSubquestionMaxPoints(q));
   evidence={...bankRef,subquestion_id:q.id,case_id:null,kind,reason:'수정본의 저장 모범답안 전체를 앱 투영으로 채점한다(만점 기대).'};}
  else{const sel=old.selection_evidence[0];assert.equal(ref(sel.file).sha256,sel.sha256,'원 대표답안 파일 변경: '+sel.file);selectionFiles.add(sel.file);const c=read(sel.file).cases.find(x=>x.id===sel.case_id);assert(c&&c.subquestion_id===q.id);
   answers={[q.id]:c.answer};assert.deepEqual(answers,old.answers);expected=[{subquestion_id:q.id,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts}];assert.deepEqual(expected,old.expected_by_subquestion);
   evidence={file:sel.file,sha256:sel.sha256,subquestion_id:q.id,case_id:c.id,kind,reason:'수락 당시 같은 원답안·기대값을 수정본으로 다시 채점한다: '+sel.reason};}
  jobs.push({id:`fix3-${id.split('-').slice(-2).join('-')}-${q.id}-${kind}`,worker,source_set_id:id,learning_unit_id:unit,kind,projected_file:proj.file,projected_sha256:proj.sha256,evaluated_subquestion_ids:[q.id],answers,expected_by_subquestion:expected,selection_evidence:[evidence]});
 }}}
const policy=write(F+'/policy.json',{scope,model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:0.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:null,budget_enforcement:'not_specified',planned_new_api_calls:jobs.length,reuse_note:'기존 관측 재사용 계약은 같은 은행 판본(manifest bank)에서만 성립하므로, 수정 세트의 바뀌지 않은 물음도 새로 실측한다.',repeat_policy:'허용 범위 밖 결과에만 원인 조사와 표적 재검사를 한다. ±1점 편차를 없애기 위한 반복 호출은 하지 않는다.'});
// 5. 실행 코드 보존본과 manifest
const runner=SP+'/run-efficient-grading.ts',code=[...new Set([...EFFICIENT_RUNTIME_FILES,runner,SP+'/accounting.ts',SP+'/contract.ts'])];
const snapshots=code.map((file,i)=>{const copy=F+'/runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
const snapRef=write(F+'/runtime-snapshots.json',snapshots);
const sources=[...new Set(ids.flatMap(id=>byId.get(id).source_refs.map(r=>r.file)))];
const inputs=[...new Set([F+'/authorization.md',F+'/prepare.mjs',F+'/changes.json',F+'/baseline.json',V+'/content-review.json',BL+'/grading-manifest.json',...selectionFiles,snapRef.file,...sources])].map(ref);
const manifest=write(F+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs,code_files:code.map(ref),entries:jobs});
guard();
console.log(JSON.stringify({status:'prepared',changed_sets:ids.length,changes:changes.length,entries:jobs.length,workers:Object.fromEntries(workers.map(w=>[w,jobs.filter(e=>e.worker===w).length])),manifest}));
