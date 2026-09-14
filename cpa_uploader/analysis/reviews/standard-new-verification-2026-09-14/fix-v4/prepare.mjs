// 관찰 O1–O3의 정본 수정본과 실측 준비물을 만든다. 정본은 쓰지 않고 모델도 호출하지 않는다.
// O1 세트 제목 7개, O2 답안 형식 2개, O3 세분 배점 2물음의 criterion 통합. O4–O6은 정본을 바꾸지 않는다(authorization.md).
//   node --import tsx cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/fix-v4/prepare.mjs
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
const V='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14',F=V+'/fix-v4';
const SP='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const BL='cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const write=(file,v)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v,null,2)+'\n',{flag:'wx'});return ref(file);};
assert(!fs.existsSync(F+'/baseline.json'),'준비 결과가 이미 있다. 새 버전 폴더를 만든다.');
const canonical={authoring:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',ledger:'cpa_uploader/data/cpa_question_sets_v3.promotions.json',public:'cpa_uploader/data/cpa_question_sets_v3.public.json',encrypted:'data/cpa_question_sets_v3.authoring.enc.json',catalog:'cpa_uploader/data/learning-question-classifications.json'};
const D='draft-standard-',P='std-points-20260914-';
// O1: [세트, 기존 제목, 새 제목]. 재편 뒤 남은 물음만 가리키도록 한다.
const TITLES=[
 [D+'gap-20260913-g02','전수조사와 특정 항목 추출의 적용','전수조사가 적합할 수 있는 상황'],
 [D+'gap-20260913-g09','서면진술의 증거상 한계와 요청대상','서면진술을 요청할 경영진의 요건'],
 [D+'expansion-20260913-s06','통제환경의 이해와 평가','통제환경에 대한 평가 사항'],
 [D+'followup-20260913-e01','비인증업무 성공보수의 위협과 안전장치','비인증업무 성공보수의 안전장치'],
 [D+'followup-20260913-l01','외부감사법상 부정행위와 회계처리기준 위반의 보고','외부감사법상 감사인의 부정행위·회계처리기준 위반 통보·보고 상대방'],
 [D+'followup-20260913-s03','통계적 표본감사와 표본추출 방법','통계적 표본감사의 특성과 임의추출·구획추출'],
 [D+'priority-20260914-l01','외부감사법상 감사인의 선임기한과 선정주체','외부감사법상 감사인의 선임기한'],
];
// O2: 명칭만 요구하는 열거 물음의 답안 형식
const TYPES=[[P+'44a4823e71a6','sub1'],[P+'74ee4919bc3f','sub2']];
// O3: 원문의 한 열거 항목을 나눈 criterion을 원문 항목 단위로 합친다.
const MERGES=[
 {set:P+'4906e3107ecd',sub:'sub1',keep:'crit4',drop:['crit4.sp2','crit4.sp3'],dropReq:['req-2','req-3'],from:4,to:2,
  oldClaim:'기업이 적격성 있는 인력을 유치하는 방법을 이해한다.',
  claim:'기업이 적격성 있는 인력을 유치하고 육성하며 유지하는 방법을 이해한다. 감사기준서 315 문단 21(a)(iv)의 한 항목이므로 1점으로 평가한다. 유치·육성·유지 가운데 일부 행위만 쓰더라도 적격성 있는 인력을 관리하는 기업의 방법이라는 이 항목이 드러나면 인정하며, 세 행위를 나누어 따로 점수를 주지 않는다.',
  fact:'기업이 적격성 있는 인력을 유치·육성·유지하는 등 적격성 있는 인력을 관리하는 방법을 이해한다.',
  note:'315 문단 21(a)(iv)는 원문의 한 열거 항목이므로 유치·육성·유지를 1점씩 나눈 3점을 1점 항목으로 합쳤다(물음 4점→2점). 일부 행위만 써도 이 항목이 드러나면 인정한다. 위의 4점 구성 메모는 재편 당시 판단 기록이다.'},
 {set:P+'1cae16e579d0',sub:'sub1',keep:'crit3',drop:['crit3.sp2'],dropReq:['req-4'],from:4,to:3,
  oldClaim:'신뢰할 수 있는 서면진술을 제공받았다는 사실은 경영진 책임완수나 특정 경영진주장에 대해 입수할 다른 감사증거의 성격에 영향을 미치지 않는다.',
  claim:'신뢰할 수 있는 서면진술을 제공받았다는 사실은 경영진 책임완수나 특정 경영진주장에 대해 입수할 다른 감사증거의 성격이나 범위에 영향을 미치지 않는다. 감사기준서 580 문단 4의 한 명제이므로 1점으로 평가한다. 성격과 범위를 나누어 따로 점수를 주지 않으며, 신뢰할 수 있는 서면진술 때문에 다른 감사증거의 입수를 줄이거나 바꿀 수 없다는 취지가 드러나면 인정한다.',
  fact:'신뢰할 수 있는 서면진술을 제공받았다는 사실은 입수할 다른 감사증거의 성격이나 범위에 영향을 미치지 않는다.',
  note:'580 문단 4의 "다른 감사증거의 성격이나 범위에 영향을 미치지 않는다"는 한 명제이므로 성격·범위 2점을 1점으로 합쳤다(물음 4점→3점). 위의 4점 조정 메모는 재편 당시 판단 기록이다.'},
];
const O1=TITLES.map(t=>t[0]),O2=TYPES.map(t=>t[0]),O3=MERGES.map(m=>m.set);
const ids=[...O1,...O2,...O3];assert.equal(new Set(ids).size,11);
// 1. 기준 정본 보존
const baseline=Object.entries(canonical).map(([name,file])=>{const copy=F+'/baseline/'+name+path.extname(file);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);assert.equal(ref(copy).sha256,ref(file).sha256);return{name,...ref(file),backup:copy};});
write(F+'/baseline.json',baseline);
const guard=()=>{for(const r of baseline)assert.equal(ref(r.file).sha256,r.sha256,'준비 중 다른 작업의 정본 변경: '+r.file);};
// 2. 수정
const bank=read(canonical.authoring),oldCatalog=read(canonical.catalog),review=read(V+'/content-review.json'),edited=structuredClone(bank),byId=new Map(edited.map(s=>[s.id,s]));
const scope=read(V+'/scope.json'),inScope=new Set(scope.targets.map(t=>t.set_id));
const changes=[];const before=id=>reviewedContentHash(bank.find(x=>x.id===id));
for(const [id,oldTitle,title] of TITLES){const s=byId.get(id);assert(inScope.has(id));assert.equal(s.status,'published');assert.equal(s.title,oldTitle,'제목 원문 불일치: '+id);
 assert(s.classification.tags.includes(oldTitle),'태그의 원 제목 계보 확인');s.title=title;
 s.verification.notes.push(`2026-09-14 신규 기준서형 전수 검증 O1 후속: 재편 뒤 남은 물음(${s.subquestions.map(q=>q.id).join('·')})에 맞게 세트 제목을 "${oldTitle}"에서 "${title}"로 바꾸었다. 분류 태그의 원 제목은 재편 전후 물음을 묶는 계보 표시로 유지한다. 발문·모범답안·배점은 같다. 근거: ${F}/changes.json`);
 changes.push({set_id:id,observation:'O1',fields:[{field:'title',before:oldTitle,after:title}],content_hash_before:before(id)});}
for(const [id,sub] of TYPES){const s=byId.get(id),q=s.subquestions.find(x=>x.id===sub);assert(inScope.has(id));assert.equal(s.subquestions.length,1);assert.equal(q.type,'descriptive');
 assert(/명칭을 .*모두 제시하시오\. 각 범주의 정의는 요구하지 않는다\.$/.test(q.prompt),'명칭 열거 발문 확인');assert.deepEqual([q.selection,q.constraints],[{type:'all',n:null},{ordered:false,max_entries:null,overflow_policy:'none'}]);
 assert(q.criteria.every(c=>c.max_points===1));q.type='enumeration';
 s.verification.notes.push(`2026-09-14 신규 기준서형 전수 검증 O2 후속: 경영진주장 명칭 여섯 개만 요구하는 열거 물음이므로 답안 형식(type)을 descriptive에서 enumeration으로 바꾸었다. 발문·모범답안·criterion·배점은 같다. 근거: ${F}/changes.json`);
 changes.push({set_id:id,subquestion_id:sub,observation:'O2',fields:[{field:'type',before:'descriptive',after:'enumeration'}],content_hash_before:before(id)});}
for(const m of MERGES){const s=byId.get(m.set),q=s.subquestions.find(x=>x.id===m.sub);assert(inScope.has(m.set));assert.equal(s.subquestions.length,1);assert.equal(computeSubquestionMaxPoints(q),m.from);
 const keep=q.criteria.find(c=>c.id===m.keep),dropped=q.criteria.filter(c=>m.drop.includes(c.id));assert.equal(keep.claim,m.oldClaim,'유지 criterion 원문 불일치: '+m.set);assert.equal(dropped.length,m.drop.length);
 assert(dropped.every(c=>c.max_points===1&&c.source_ref_ids.every(r=>keep.source_ref_ids.includes(r))),'합치는 criterion은 같은 원문 인용을 쓴다');
 const reqs=q.requirements.filter(r=>m.dropReq.includes(r.id));assert.equal(reqs.length,m.dropReq.length);const keepReq=q.requirements.find(r=>r.id===keep.requirement_id);
 assert(reqs.every(r=>r.source_quote===keepReq.source_quote&&r.source_ref_id===keepReq.source_ref_id),'합치는 requirement는 같은 원문 인용이다');
 assert.deepEqual(dropped.map(c=>c.requirement_id).sort(),[...m.dropReq].sort());assert.equal(keep.critical_facts.length,1);
 const prior={criteria:structuredClone(q.criteria),requirements:structuredClone(q.requirements)};
 keep.claim=m.claim;keep.critical_facts=[{id:keep.critical_facts[0].id,type:keep.critical_facts[0].type,expected:m.fact}];
 q.criteria=q.criteria.filter(c=>!m.drop.includes(c.id));q.requirements=q.requirements.filter(r=>!m.dropReq.includes(r.id));assert.equal(computeSubquestionMaxPoints(q),m.to);
 s.verification.notes.push(`2026-09-14 신규 기준서형 전수 검증 O3 후속: ${m.note} 발문·모범답안·원문 인용은 같다. 근거: ${F}/changes.json`);
 changes.push({set_id:m.set,subquestion_id:m.sub,observation:'O3',fields:[{field:'criteria',before:prior.criteria,after:q.criteria},{field:'requirements',before:prior.requirements,after:q.requirements}],max_points:{before:m.from,after:m.to},content_hash_before:before(m.set)});}
// 수정 대상 외 세트, 대상 세트의 발문·모범답안·출처·주제·유형이 그대로인지 확인한다.
for(const s of edited){const o=bank.find(x=>x.id===s.id);if(!ids.includes(s.id)){assert.deepEqual(s,o);continue;}
 assert.deepEqual(s.source_refs,o.source_refs);assert.deepEqual(s.classification,o.classification);assert.deepEqual(s.shared_context,o.shared_context);assert.deepEqual(s.learning_order,o.learning_order);
 for(const q of s.subquestions){const oq=o.subquestions.find(x=>x.id===q.id);assert.equal(q.prompt,oq.prompt);assert.deepEqual(q.model_answer,oq.model_answer);assert.deepEqual(q.topic_ids,oq.topic_ids);assert.equal(q.question_style,'standard');
  if(!O2.includes(s.id))assert.equal(q.type,oq.type);if(!O3.includes(s.id))assert.deepEqual({...q,type:null},{...oq,type:null},'O1·O2 세트의 물음 본문이 바뀌었다');}
 if(!O1.includes(s.id))assert.equal(s.title,o.title);}
assert.deepEqual(validateAuthoringBank(edited).errors,[]);
const bankRef=write(F+'/evidence-bank.json',edited);
for(const c of changes)c.content_hash_after=reviewedContentHash(byId.get(c.set_id));
write(F+'/changes.json',{version:1,authorization:ref(F+'/authorization.md'),baseline_bank:baseline.find(b=>b.name==='authoring'),edited_bank:bankRef,changed_sets:ids,observations:{O1,O2,O3,O4:'정본 변경 없음(주제01 지침에 판본 감시 기록)',O5:'정본 변경 없음(coverage 관계 탐색)',O6:'변경 없음(중복 아님 확인)'},points:{before:bank.flatMap(s=>s.subquestions).reduce((n,q)=>n+computeSubquestionMaxPoints(q),0),after:edited.flatMap(s=>s.subquestions).reduce((n,q)=>n+computeSubquestionMaxPoints(q),0)},changes,unchanged:'발문·모범답안·원문 인용·주제·기준서형 분류·분류 태그. O1·O2 세트의 criterion·배점'});
// 3. 분류: 발문이 같아 기존 판정을 두고 새 원문 판본에 결속한다.
const priorReview=read(oldCatalog.review_file);assert.equal(ref(oldCatalog.review_file).sha256,oldCatalog.review_file_sha256);
const entries=priorReview.entries.map(e=>ids.includes(e.set_id)?{...e,reason:e.reason+' 2026-09-14 관찰 O1–O3 수정본(제목·답안 형식·배점)에 결속했다. 유형·주제·독립 발문은 같다.'}:e);
const reviewRef=write(F+'/classification-review.json',{source_file:bankRef.file,source_file_sha256:bankRef.sha256,entries});
const compiled=compileLearningCatalog(edited,entries,oldCatalog.topics);
for(const c of compiled.classifications){const o=oldCatalog.classifications.find(x=>x.source_set_id===c.source_set_id&&x.subquestion_id===c.subquestion_id);assert(o);if(!ids.includes(c.source_set_id))assert.deepEqual(c,o);else{assert.deepEqual(c.topic_ids,o.topic_ids);assert.equal(c.standalone_prompt,o.standalone_prompt);assert.equal(c.question_style,o.question_style);}}
const catalogRef=write(F+'/evidence-catalog.json',{schema_version:1,source_file:bankRef.file,source_file_sha256:bankRef.sha256,public_content_hash:contentHash(edited.map(compilePublicQuestionSet)),review_file:reviewRef.file,review_file_sha256:reviewRef.sha256,topics:oldCatalog.topics,classifications:compiled.classifications});
// 4. O3 대표답안: 합친 기준으로 기대값을 다시 판정한다. 원 사례의 원답안·기대값을 함께 남긴다.
const spReps=SP+'/execution-v1/representatives.json',spCases=read(spReps).cases;
const v=(criterion_id,verdict,reason)=>({criterion_id,verdict,reason});
const origin=id=>{const c=spCases.find(x=>x.id===id);assert(c,id);return{file:spReps,sha256:ref(spReps).sha256,case_id:id,answer:c.answer,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts};};
const repCases=[
 {id:P+'4906e3107ecd--sub1--partial',set_id:P+'4906e3107ecd',subquestion_id:'sub1',kind:'partial',answer:origin(P+'4906e3107ecd--sub1--partial').answer,expected_points:1,
  expected_verdicts:[v('crit4','met','적격성 있는 인력을 육성하는 방법을 제시해 315.21(a)(iv)의 인력관리 항목이 드러난다. 합친 기준은 세 행위 중 일부만 써도 이 항목을 인정한다.'),v('crit5','not_met','개인에게 책임을 지게 하는 방법(21(a)(v))을 쓰지 않았다.')],
  origin:origin(P+'4906e3107ecd--sub1--partial'),reason:'재편 실측의 원 부분답안(육성만 기재)을 그대로 쓴다. 원 기대 1점은 분할 기준 crit4.sp2 충족이었고, 합친 기준에서는 crit4 충족으로 같은 1점이다. 합친 기준의 일부 행위 인정 경계를 함께 확인한다.'},
 {id:P+'4906e3107ecd--sub1--wrong',set_id:P+'4906e3107ecd',subquestion_id:'sub1',kind:'wrong',answer:origin(P+'4906e3107ecd--sub1--wrong').answer,expected_points:0,
  expected_verdicts:[v('crit4','contradicted','직원 숙련도(적격성 있는 인력)를 이해 대상이 아니라고 명시해 인력관리 항목의 이해 요구를 반대로 썼다.'),v('crit5','contradicted','업무 책임을 이해 대상이 아니라고 명시해 개인 책임 이행 방법의 이해 요구를 반대로 썼다.')],
  origin:origin(P+'4906e3107ecd--sub1--wrong'),reason:'재편 실측의 원 오답을 그대로 쓴다. 이해 대상을 명시적으로 부정하므로 두 기준을 contradicted로 다시 판정했다(원 기대는 not_met, 점수는 같은 0점).'},
 {id:'fix4-1cae16e579d0--sub1--partial',set_id:P+'1cae16e579d0',subquestion_id:'sub1',kind:'partial',answer:'서면진술도 질문에 대한 답변처럼 감사증거에 해당한다. 신뢰할 수 있는 서면진술을 받았다는 사실 때문에 다른 감사증거의 입수 범위를 줄일 수는 없다.',expected_points:2,
  expected_verdicts:[v('crit1','met','서면진술이 감사증거에 해당한다고 썼다.'),v('crit2','not_met','서면진술 자체만으로는 다루는 사항에 대해 충분하고 적합한 감사증거가 되지 않는다는 명제를 쓰지 않았다.'),v('crit3','met','신뢰할 수 있는 서면진술 때문에 다른 감사증거의 입수 범위를 줄일 수 없다고 써 580.4의 "성격이나 범위에 영향 없음" 명제가 드러난다. 합친 기준은 성격과 범위를 나누어 요구하지 않는다.')],
  origin:{file:spReps,sha256:ref(spReps).sha256,case_id:P+'1cae16e579d0--sub1--partial',superseded_because:'원 부분답안(감사증거+자체 불충분)은 바뀌지 않은 crit1·crit2만 다룬다. 합친 crit3의 경계(범위만 언급)를 시험하도록 새 부분답안으로 바꾸었다.'},reason:'합친 crit3를 범위만 언급한 표현으로 충족하고 crit2를 빠뜨린 부분답안이다.'},
 {id:P+'1cae16e579d0--sub1--wrong',set_id:P+'1cae16e579d0',subquestion_id:'sub1',kind:'wrong',answer:origin(P+'1cae16e579d0--sub1--wrong').answer,expected_points:0,
  expected_verdicts:[v('crit1','contradicted','서면진술은 감사증거가 아니라고 명시해 반대로 썼다.'),v('crit2','not_met','서면진술 자체의 충분성·적합성에 관한 명제를 쓰지 않았다.'),v('crit3','contradicted','신뢰할 수 있는 진술을 받으면 다른 감사증거의 종류와 양을 자유롭게 줄여도 된다고 해 명제를 반대로 썼다.')],
  origin:origin(P+'1cae16e579d0--sub1--wrong'),reason:'재편 실측의 원 오답을 그대로 쓴다. 명시적 반대 서술을 contradicted로 다시 판정했다(원 기대는 not_met, 점수는 같은 0점).'},
];
for(const c of repCases){const s=byId.get(c.set_id),q=s.subquestions.find(x=>x.id===c.subquestion_id);assert.deepEqual(c.expected_verdicts.map(x=>x.criterion_id).sort(),q.criteria.map(x=>x.id).sort());
 assert.equal(c.expected_points,c.expected_verdicts.reduce((n,x)=>n+q.criteria.find(k=>k.id===x.criterion_id).scores[x.verdict],0));}
const repsRef=write(F+'/representatives.json',{version:1,purpose:'관찰 O3 합친 기준의 대표답안과 다시 판정한 기대값. 원 사례와 원 기대값을 origin에 남긴다.',cases:repCases});
// 5. 대표답안 manifest: O1·O2는 가장 최근 수락 manifest의 원답안·기대값을 그대로 쓴다.
const ORIGINS=[V+'/fix-v3/grading-manifest.json',BL+'/grading-manifest.json','cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1/grading-manifest.json',SP+'/execution-v4/grading-manifest.json'].map(f=>({file:f,m:read(f)}));
const originFiles=new Set(),selectionFiles=new Set([repsRef.file]),workers=['a','b','c'],jobs=[];let n=0;
const scopeRef=write(F+'/scope.json',{targets:ids.map(id=>({set_id:id,subquestion_ids:byId.get(id).subquestions.map(q=>q.id),observation:O1.includes(id)?'O1':O2.includes(id)?'O2':'O3'}))});
for(const id of ids){const s=byId.get(id);for(const q of s.subquestions){const unit=learningUnitId(id,'standard',q.id),worker=workers[n++%3];
 const meta=compiled.classifications.filter(c=>c.source_set_id===id&&c.subquestion_id===q.id),projected=selectLearningQuestionSet(s,meta,unit);assert.equal(projected.subquestions[0].prompt,q.prompt);assert.equal(projected.subquestions[0].type,q.type);
 const proj=write(F+'/projections/'+unit+'.json',projected);
 const src=ORIGINS.find(o=>o.m.entries.some(e=>e.learning_unit_id===unit));assert(src,'원 대표답안 없음: '+unit);
 for(const kind of ['model','partial','wrong']){
  const old=src.m.entries.find(e=>e.learning_unit_id===unit&&e.kind===kind);assert(old,unit+' '+kind);originFiles.add(src.file);
  let answers,expected,evidence;
  if(kind==='model'){answers={[q.id]:q.model_answer.join('\n')};assert.deepEqual(answers,old.answers,'모범답안이 원 실측과 다르다');
   expected=[{subquestion_id:q.id,expected_points:computeSubquestionMaxPoints(q),expected_verdicts:q.criteria.map(c=>({criterion_id:c.id,verdict:'met',reason:'저장 모범답안이 이 기준의 명제를 그대로 서술한다.'}))}];
   if(!O3.includes(id))assert.deepEqual(expected[0].expected_verdicts.map(x=>[x.criterion_id,x.verdict]),old.expected_by_subquestion[0].expected_verdicts.map(x=>[x.criterion_id,x.verdict]));
   if(!O3.includes(id))expected=old.expected_by_subquestion;
   evidence={...bankRef,subquestion_id:q.id,case_id:null,kind,reason:'수정본의 저장 모범답안 전체를 앱 투영으로 채점한다(만점 기대).'};}
  else if(O3.includes(id)){const c=repCases.find(x=>x.set_id===id&&x.kind===kind);answers={[q.id]:c.answer};expected=[{subquestion_id:q.id,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts}];
   evidence={...repsRef,subquestion_id:q.id,case_id:c.id,kind,reason:c.reason};}
  else{const sel=old.selection_evidence[0];assert.equal(ref(sel.file).sha256,sel.sha256,'원 대표답안 파일 변경: '+sel.file);selectionFiles.add(sel.file);const c=read(sel.file).cases.find(x=>x.id===sel.case_id);assert(c&&c.subquestion_id===q.id);
   answers={[q.id]:c.answer};assert.deepEqual(answers,old.answers);expected=[{subquestion_id:q.id,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts}];assert.deepEqual(expected,old.expected_by_subquestion);
   evidence={file:sel.file,sha256:sel.sha256,subquestion_id:q.id,case_id:c.id,kind,reason:'수락 당시 같은 원답안·기대값을 수정본으로 다시 채점한다: '+sel.reason};}
  jobs.push({id:`fix4-${id.split('-').slice(-2).join('-')}-${q.id}-${kind}`,worker,source_set_id:id,learning_unit_id:unit,kind,projected_file:proj.file,projected_sha256:proj.sha256,evaluated_subquestion_ids:[q.id],answers,expected_by_subquestion:expected,selection_evidence:[evidence]});
 }}}
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
const policy=write(F+'/policy.json',{scope:scopeRef,model:'gpt-5.6-luna',grading_point_tolerance:1,minimum_within_tolerance_ratio:0.95,content_error_tolerance:0,statistical_confidence_claim:false,budget_usd:null,budget_enforcement:'not_specified',planned_new_api_calls:jobs.length,reuse_note:'기존 관측 재사용 계약은 같은 은행 판본(manifest bank)에서만 성립하므로, 수정 세트의 바뀌지 않은 물음도 새로 실측한다.',repeat_policy:'허용 범위 밖 결과에만 원인 조사와 표적 재검사를 한다. ±1점 편차를 없애기 위한 반복 호출은 하지 않는다.'});
// 6. 실행 코드 보존본과 manifest
const runner=SP+'/run-efficient-grading.ts',code=[...new Set([...EFFICIENT_RUNTIME_FILES,runner,SP+'/accounting.ts',SP+'/contract.ts'])];
const snapshots=code.map((file,i)=>{const copy=F+'/runtime/'+i+'-'+path.basename(file)+'.snapshot';fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);return{...ref(copy),runtime_file:file};});
const snapRef=write(F+'/runtime-snapshots.json',snapshots);
const sources=[...new Set(ids.flatMap(id=>byId.get(id).source_refs.map(r=>r.file)))];
const inputs=[...new Set([F+'/authorization.md',F+'/prepare.mjs',F+'/changes.json',F+'/baseline.json',V+'/content-review.json',V+'/scope.json',...originFiles,...selectionFiles,spReps,snapRef.file,...sources])].map(ref);
const manifest=write(F+'/grading-manifest.json',{version:1,artifact_type:'efficient_grading_manifest',model:'gpt-5.6-luna',budget_usd:null,budget_enforcement:'not_specified',bank:bankRef,classifications:catalogRef,policy,inputs,code_files:code.map(ref),entries:jobs});
guard();
console.log(JSON.stringify({status:'prepared',changed_sets:ids.length,changes:changes.length,entries:jobs.length,points:read(F+'/changes.json').points,workers:Object.fromEntries(workers.map(w=>[w,jobs.filter(e=>e.worker===w).length])),manifest}));
