// decision-o3-v3.md에 따라 1cae16e579d0을 정본 판본 그대로 두고 나머지 10세트 수정본(v3)과 새 manifest를 만든다.
// v1·v2 준비물과 관측은 보존한다. 정본은 쓰지 않고 모델도 호출하지 않는다.
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/prepare-v3.mjs
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
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v4',W=F+'/v3';
const SP='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(W),'v3 준비 결과가 이미 있다');
const baseline=read(F+'/baseline.json');for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 후 정본이 바뀌었다: '+r.file);
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업의 정본 변경: '+r.file);};
const DROP='std-points-20260914-1cae16e579d0';
// 1. v1·v2 실측 확인: 두 번 모두 1cae 새 부분답안만 −1, 나머지 38건 일치
const obsOf=(dir,manifest)=>['a','b','c'].flatMap(w=>read(dir+'/actual-'+w+'/summary.json').rows.map(r=>({row:r,obs:read(r.observation.file)}))).map(x=>{assert.equal(x.obs.manifest.sha256,ref(manifest).sha256);return x;});
const runs={v1:obsOf(F+'/execution-v1',F+'/grading-manifest.json'),v2:obsOf(F+'/v2/execution',F+'/v2/grading-manifest.json')};
const evidence={};
for(const [name,rows] of Object.entries(runs)){assert.equal(rows.length,39);assert(rows.every(x=>x.obs.within_tolerance));
 const off=rows.filter(x=>x.obs.subquestions[0].delta!==0);assert.equal(off.length,1);assert(off[0].obs.entry_id.endsWith('1cae16e579d0-sub1-partial'));assert.equal(off[0].obs.subquestions[0].delta,-1);
 const crit=off[0].obs.result.subquestions[0].criteria.find(c=>c.criterion_id==='crit3');assert.equal(crit.verdict,'not_met');
 evidence[name]={manifest:ref(name==='v1'?F+'/grading-manifest.json':F+'/v2/grading-manifest.json'),observations:39,exact:38,off:{entry_id:off[0].obs.entry_id,observation:off[0].row.observation,expected:2,actual:1,crit3_reason:crit.reason}};}
// 2. v3 은행: v1 수정본에서 1cae만 기준 정본 판본으로 되돌린다.
const original=read(baseline.find(b=>b.name==='authoring').backup),v1Bank=read(F+'/evidence-bank.json');
const bank=v1Bank.map(s=>s.id===DROP?structuredClone(original.find(x=>x.id===DROP)):s);
assert.deepEqual(bank.map(s=>s.id),original.map(s=>s.id));
const v1Changes=read(F+'/changes.json'),ids=v1Changes.changed_sets.filter(id=>id!==DROP);assert.equal(ids.length,10);
for(const [i,s] of bank.entries()){if(ids.includes(s.id))assert.notDeepEqual(s,original[i]);else assert.deepEqual(s,original[i]);}
assert.deepEqual(validateAuthoringBank(bank).errors,[]);
const bankRef=write(W+'/evidence-bank.json',bank);
const changes=v1Changes.changes.filter(c=>c.set_id!==DROP);for(const c of changes)assert.equal(reviewedContentHash(bank.find(s=>s.id===c.set_id)),c.content_hash_after);
const points=b=>b.flatMap(s=>s.subquestions).reduce((n,q)=>n+computeSubquestionMaxPoints(q),0);
write(W+'/changes.json',{...v1Changes,version:3,edited_bank:bankRef,changed_sets:ids,observations:{...v1Changes.observations,O3:ids.filter(id=>v1Changes.observations.O3.includes(id)),O3_retained:{set_id:DROP,subquestion_id:'sub1',decision:ref(F+'/decision-o3-v3.md'),reason:'발문이 성격·범위를 직접 들어 묻는 독립 검토 특성이다. 합친 기준은 한쪽만 맞은 답안을 0점으로 만들었고 두 번의 실측에서 같은 결과가 나왔다. 재편 승인 분할(4점)을 유지한다.'}},points:{before:points(original),after:points(bank)},changes,prior_attempts:evidence});
// 3. 분류·카탈로그
const oldCatalog=read(baseline.find(b=>b.name==='catalog').backup),priorReview=read(oldCatalog.review_file),v1Review=read(F+'/classification-review.json');
assert.equal(ref(oldCatalog.review_file).sha256,oldCatalog.review_file_sha256);
const entries=v1Review.entries.map((e,i)=>{const p=priorReview.entries[i];assert.equal(p.set_id,e.set_id);assert.equal(p.subquestion_id,e.subquestion_id);return e.set_id===DROP?p:e;});
const reviewRef=write(W+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries});
const compiled=compileLearningCatalog(bank,entries,oldCatalog.topics);
for(const c of compiled.classifications){const o=oldCatalog.classifications.find(x=>x.source_set_id===c.source_set_id&&x.subquestion_id===c.subquestion_id);assert(o);if(!ids.includes(c.source_set_id))assert.deepEqual(c,o);else{assert.deepEqual(c.topic_ids,o.topic_ids);assert.equal(c.standalone_prompt,o.standalone_prompt);assert.equal(c.question_style,o.question_style);}}
const catalogRef=write(W+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,public_content_hash:contentHash(bank.map(compilePublicQuestionSet)),review_file:reviewRef.file,review_file_sha256:reviewRef.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
// 4. manifest: v1의 10세트 36건과 같은 답안·기대값·작업자 배정
const v1=read(F+'/grading-manifest.json'),jobs=[];
for(const e of v1.entries.filter(e=>e.source_set_id!==DROP)){const set=bank.find(x=>x.id===e.source_set_id),meta=compiled.classifications.filter(k=>k.source_set_id===set.id&&learningUnitId(set.id,k.question_style,k.subquestion_id)===e.learning_unit_id);
 const projected=selectLearningQuestionSet(set,meta,e.learning_unit_id);assert.deepEqual(projected,read(e.projected_file),'v1과 투영이 다르다');
 const file=W+'/projections/'+e.learning_unit_id+'.json',proj=fs.existsSync(file)?ref(file):write(file,projected);
 jobs.push({...e,id:e.id.replace(/^fix4-/,'fix4v3-'),projected_file:proj.file,projected_sha256:proj.sha256,selection_evidence:e.selection_evidence.map(ev=>ev.file===v1.bank.file?{...ev,...bankRef}:ev)});}
assert.equal(jobs.length,36);
const scopeRef=write(W+'/scope.json',{targets:ids.map(id=>({set_id:id,subquestion_ids:bank.find(s=>s.id===id).subquestions.map(q=>q.id),observation:v1Changes.observations.O1.includes(id)?'O1':v1Changes.observations.O2.includes(id)?'O2':'O3'}))});
const policy=write(W+'/policy.json',{...read(v1.policy.file),scope:scopeRef,planned_new_api_calls:jobs.length,rerun_note:'O3 결정 변경(decision-o3-v3.md)으로 1cae를 제외한 은행 판본에 관측을 결속하기 위한 재실측이다. 관측 재사용 계약은 같은 은행 판본에서만 성립한다. ±1점 편차를 없애기 위한 반복 호출이 아니다.'});
const runner=SP+'/run-efficient-grading.ts',code=[...new Set([...EFFICIENT_RUNTIME_FILES,runner,SP+'/accounting.ts',SP+'/contract.ts'])];
const snapshots=code.map((file,i)=>{const copy=W+'/runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
for(const [i,snap] of snapshots.entries())assert.equal(snap.sha256,read(F+'/runtime-snapshots.json')[i].sha256,'v1 이후 실행 코드가 바뀌었다');
const snapRef=write(W+'/runtime-snapshots.json',snapshots);
const inputs=[...new Set([F+'/authorization.md',F+'/decision-o3-v3.md',F+'/prepare.mjs',F+'/prepare-v2.mjs',F+'/prepare-v3.mjs',W+'/changes.json',F+'/baseline.json',V+'/content-review.json',F+'/grading-manifest.json',F+'/v2/grading-manifest.json',snapRef.file,...v1.inputs.map(i=>i.file).filter(f=>f!==F+'/runtime-snapshots.json')])].map(ref);
const manifest=write(W+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs,code_files:code.map(ref),entries:jobs});
guard();
console.log(JSON.stringify({status:'prepared_v3',changed_sets:ids.length,entries:jobs.length,points:read(W+'/changes.json').points,manifest}));
