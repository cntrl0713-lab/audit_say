// 첫 실측(execution-v1)에서 합친 1cae16e579d0/sub1 crit3의 핵심 사실 "성격이나 범위"가 둘 다 요구하는 것으로 읽혀
// 범위만 쓴 부분답안이 1점 낮게 채점되었다(기대 2·실제 1). crit3의 핵심 사실을 최소 요건으로 좁힌 수정본(v2)과 새 manifest를 만든다.
// v1 준비물·관측은 보존한다. 은행 판본이 바뀌므로 관측 재사용 계약상 39건을 모두 새로 실측한다. 정본은 쓰지 않고 모델도 호출하지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/prepare-v2.mjs
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
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v4',W=F+'/v2';
const SP='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(W),'v2 준비 결과가 이미 있다');
const baseline=read(F+'/baseline.json');for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 후 정본이 바뀌었다: '+r.file);
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업의 정본 변경: '+r.file);};
// 1. v1 실측 결과를 확인한다: 1cae 부분답안만 기대와 다르고(−1) 나머지 38건은 정확히 일치했다.
const v1Manifest=ref(F+'/grading-manifest.json'),v1Obs=['a','b','c'].flatMap(w=>read(F+'/execution-v1/actual-'+w+'/summary.json').rows.map(r=>read(r.observation.file)));
assert.equal(v1Obs.length,39);assert(v1Obs.every(o=>o.within_tolerance&&o.manifest.sha256===v1Manifest.sha256));
const off=v1Obs.filter(o=>o.subquestions[0].delta!==0);assert.deepEqual(off.map(o=>[o.entry_id,o.subquestions[0].delta]),[['fix4-20260914-1cae16e579d0-sub1-partial',-1]]);
const offCrit=off[0].result.subquestions[0].criteria.find(c=>c.criterion_id==='crit3');assert.equal(offCrit.verdict,'not_met');
// 2. crit3 문구 수정
const SET='std-points-20260914-1cae16e579d0',v1Bank=read(F+'/evidence-bank.json'),bank=structuredClone(v1Bank),s=bank.find(x=>x.id===SET),q=s.subquestions[0],c=q.criteria.find(x=>x.id==='crit3');
const OLD_CLAIM='신뢰할 수 있는 서면진술을 제공받았다는 사실은 경영진 책임완수나 특정 경영진주장에 대해 입수할 다른 감사증거의 성격이나 범위에 영향을 미치지 않는다. 감사기준서 580 문단 4의 한 명제이므로 1점으로 평가한다. 성격과 범위를 나누어 따로 점수를 주지 않으며, 신뢰할 수 있는 서면진술 때문에 다른 감사증거의 입수를 줄이거나 바꿀 수 없다는 취지가 드러나면 인정한다.';
const OLD_FACT='신뢰할 수 있는 서면진술을 제공받았다는 사실은 입수할 다른 감사증거의 성격이나 범위에 영향을 미치지 않는다.';
const CLAIM='신뢰할 수 있는 서면진술을 제공받았다는 사실은 경영진 책임완수나 특정 경영진주장에 대해 입수할 다른 감사증거의 성격이나 범위에 영향을 미치지 않는다. 감사기준서 580 문단 4의 한 명제이므로 1점으로 평가한다. 성격과 범위를 모두 쓰지 않아도, 신뢰할 수 있는 서면진술 때문에 다른 감사증거를 줄이거나 바꿀 수 없다는 취지가 드러나면 인정한다. 성격과 범위를 나누어 따로 점수를 주지 않는다.';
const FACT='신뢰할 수 있는 서면진술을 제공받았다는 이유로 입수할 다른 감사증거를 줄이거나 바꿀 수 없다.';
assert.equal(c.claim,OLD_CLAIM);assert.equal(c.critical_facts.length,1);assert.equal(c.critical_facts[0].expected,OLD_FACT);
c.claim=CLAIM;c.critical_facts[0].expected=FACT;
for(const x of bank){const o=v1Bank.find(y=>y.id===x.id);if(x.id!==SET)assert.deepEqual(x,o);}
assert.deepEqual(validateAuthoringBank(bank).errors,[]);
const bankRef=write(W+'/evidence-bank.json',bank);
// 3. 변경 장부: 기준 정본 대비 전체 변경(v1 장부)에 이번 문구 수정을 반영한다.
const v1Changes=read(F+'/changes.json'),ids=v1Changes.changed_sets;
const changes=v1Changes.changes.map(ch=>{if(ch.set_id!==SET)return{...ch,content_hash_after:reviewedContentHash(bank.find(x=>x.id===ch.set_id))};
 return{...ch,fields:ch.fields.map(f=>f.field==='criteria'?{...f,after:q.criteria}:f),content_hash_after:reviewedContentHash(s)};});
for(const ch of changes)if(ch.set_id!==SET)assert.equal(ch.content_hash_after,v1Changes.changes.find(x=>x.set_id===ch.set_id).content_hash_after);
write(W+'/changes.json',{...v1Changes,version:2,edited_bank:bankRef,changes,revision_from_v1:{set_id:SET,subquestion_id:'sub1',criterion_id:'crit3',reason:'v1 실측에서 합친 crit3의 핵심 사실 "성격이나 범위에 영향을 미치지 않는다"를 성격·범위 모두의 언급으로 읽어, 범위만 쓴 부분답안(기대 2)을 1점으로 채점했다. 안내 문장이 있었으나 핵심 사실이 우선 적용되었으므로, 핵심 사실을 최소 요건("다른 감사증거를 줄이거나 바꿀 수 없다")으로 좁히고 안내 문장을 앞세웠다. 기대값·배점·원문 명제는 같다.',observation:{entry_id:off[0].entry_id,file:['a','b','c'].flatMap(w=>read(F+'/execution-v1/actual-'+w+'/summary.json').rows).find(r=>r.id===off[0].entry_id).observation,model_reason:offCrit.reason},fields:[{field:'criteria.crit3.claim',before:OLD_CLAIM,after:CLAIM},{field:'criteria.crit3.critical_facts.crit3.fact',before:OLD_FACT,after:FACT}],v1_manifest:v1Manifest,v1_evidence_bank:ref(F+'/evidence-bank.json')}});
// 4. 분류·카탈로그: v1 판정 그대로 새 원문에 결속한다.
const oldCatalog=read(baseline.find(b=>b.name==='catalog').file),v1Review=read(F+'/classification-review.json');
const reviewRef=write(W+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries:v1Review.entries});
const compiled=compileLearningCatalog(bank,v1Review.entries,oldCatalog.topics),v1Catalog=read(F+'/evidence-catalog.json');
for(const k of compiled.classifications){const o=v1Catalog.classifications.find(x=>x.source_set_id===k.source_set_id&&x.subquestion_id===k.subquestion_id);assert(o);if(k.source_set_id!==SET)assert.deepEqual(k,o);else{assert.deepEqual(k.topic_ids,o.topic_ids);assert.equal(k.standalone_prompt,o.standalone_prompt);}}
const catalogRef=write(W+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,public_content_hash:contentHash(bank.map(compilePublicQuestionSet)),review_file:reviewRef.file,review_file_sha256:reviewRef.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
// 5. manifest: v1과 같은 답안·기대값·작업자 배정을 새 투영으로 다시 만든다.
const v1=read(F+'/grading-manifest.json'),jobs=[];
for(const e of v1.entries){const set=bank.find(x=>x.id===e.source_set_id),meta=compiled.classifications.filter(k=>k.source_set_id===set.id&&learningUnitId(set.id,k.question_style,k.subquestion_id)===e.learning_unit_id);
 const projected=selectLearningQuestionSet(set,meta,e.learning_unit_id),file=W+'/projections/'+e.learning_unit_id+'.json',proj=fs.existsSync(file)?ref(file):write(file,projected);assert.deepEqual(read(proj.file),projected);
 if(set.id!==SET)assert.deepEqual(projected,read(e.projected_file),'수정 대상 외 투영이 바뀌었다');
 const sub=set.subquestions.find(x=>x.id===e.evaluated_subquestion_ids[0]);if(e.kind==='model')assert.equal(e.answers[sub.id],sub.model_answer.join('\n'));assert.equal(e.expected_by_subquestion[0].expected_points,e.expected_by_subquestion[0].expected_verdicts.reduce((n,v)=>n+sub.criteria.find(k=>k.id===v.criterion_id).scores[v.verdict],0));
 jobs.push({...e,id:e.id.replace(/^fix4-/,'fix4v2-'),projected_file:proj.file,projected_sha256:proj.sha256,selection_evidence:e.selection_evidence.map(ev=>ev.file===v1.bank.file?{...ev,...bankRef}:ev)});}
const scopeRef=ref(F+'/scope.json');
const policy=write(W+'/policy.json',{...read(v1.policy.file),scope:scopeRef,planned_new_api_calls:jobs.length,rerun_note:'v1 39건은 모두 ±1점 안(38건 일치)이었다. 합친 crit3 문구의 모호함을 고친 내용 수정이며, 관측 재사용 계약이 같은 은행 판본에서만 성립해 39건을 다시 실측한다. ±1점 편차를 없애기 위한 반복 호출이 아니다.'});
const runner=SP+'/run-efficient-grading.ts',code=[...new Set([...EFFICIENT_RUNTIME_FILES,runner,SP+'/accounting.ts',SP+'/contract.ts'])];
const snapshots=code.map((file,i)=>{const copy=W+'/runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
for(const [i,snap] of snapshots.entries())assert.equal(snap.sha256,read(F+'/runtime-snapshots.json')[i].sha256,'v1 이후 실행 코드가 바뀌었다');
const snapRef=write(W+'/runtime-snapshots.json',snapshots);
const inputs=[...new Set([F+'/authorization.md',F+'/prepare.mjs',W.replace(/\/v2$/,'')+'/prepare-v2.mjs',W+'/changes.json',F+'/baseline.json',V+'/content-review.json',v1Manifest.file,snapRef.file,...v1.inputs.map(i=>i.file).filter(f=>![F+'/runtime-snapshots.json',F+'/changes.json'].includes(f))])].map(ref);
const manifest=write(W+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs,code_files:code.map(ref),entries:jobs});
guard();
console.log(JSON.stringify({status:'prepared_v2',entries:jobs.length,manifest,crit3:{claim:CLAIM,fact:FACT}}));
