/** S03 no-call handoff evidence; writes this package only. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readPendingDrafts,draftConflicts} from '../../../questionDraftInventory.ts';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/s03');
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const rel=(f:string)=>path.relative(process.cwd(),f).replaceAll('\\','/');
const write=(f:string,v:any)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n');
const lineage=read(path.join(base,'lineage.json')),check=read(path.join(base,'static-check.json'));
if(check.errors.length||check.review_preparation_issues.length)throw Error('Static gate failed');
const sets=lineage.sets.map((s:any)=>read(s.actual_file)),ids=new Set(sets.map((s:any)=>s.id));
const excluded:any[]=[];
for(const p of ['n02','n03','s02']){const file=`cpa_uploader/drafts/delegated-authoring-2026-09-11/${p}/draft-manifest.json`,r=read(file);if(!r.sets.every((s:any)=>typeof s.set_id==='string'&&typeof s.file==='string'&&!s.subquestions&&fs.existsSync(s.file)))throw Error('Unexpected manifest content');excluded.push({file,sha256:sha(file),reason:'세트 파일·계획·해시를 가리키는 제작 장부이며 문항 본문이 아님',keys:Object.keys(r)});}
for(const phase of ['engine-final','engine-r1','engine-r2']){const dir=`cpa_uploader/drafts/frequency-priority-2026-09-10/semantic-review/${phase}`;for(const name of fs.readdirSync(dir).filter(n=>/\.(?:chunks|error)\.json$/u.test(n))){const file=path.join(dir,name),r=read(file);if(!Array.isArray(r.events)&&!(typeof r.error==='string'&&'completed_units'in r))throw Error('Unexpected review artifact');excluded.push({file:rel(file),sha256:sha(file),reason:r.events?'과거 모델 실행 이벤트 로그':'과거 모델 실행 오류 로그',keys:Object.keys(r)});}}
write('inventory-exclusions.json',{known_inventory_limitation:'Earlier N04 investigation showed readPendingDrafts(data+drafts) rejects metadata named draft-manifest. S03 independently reread the known manifests/logs below and explicitly excluded only these metadata files. No current failed run is claimed; originals were not renamed or modified.',excluded});
const globalDrafts=readPendingDrafts(process.cwd(),path.resolve('cpa_uploader/drafts'),excluded.map(e=>e.file));
const errors:string[]=[];
for(const id of ids)if(globalDrafts.filter(s=>s.id===id).length!==1)errors.push('Global inventory duplicate/missing '+id);
errors.push(...draftConflicts(sets,globalDrafts.filter(s=>!ids.has(s.id))));
const catalog=buildSourceCatalog(),relations=read(path.join(base,'coverage-proposal.json')).relationships;
const elements=read('cpa_uploader/analysis/question-elements/question-elements.json');
for(const r of relations){
 if(!elements.elements.some((e:any)=>e.id===r.element_id))errors.push('Missing element '+r.element_id);
 for(const id of r.source_unit_ids)if(!catalog.units.some(u=>u.id===id))errors.push('Missing source '+id);
 const s=read(r.target.file),q=s.subquestions.find((q:any)=>q.id===r.target.subquestion_id);
 if(s.id!==r.target.set_id||!q)errors.push('Missing relation target');
 for(const id of r.target.criterion_ids)if(!q.criteria.some((c:any)=>c.id===id))errors.push('Missing criterion '+id);
 for(const f of Object.values(r.evidence) as string[])if(!fs.existsSync(f))errors.push('Missing evidence '+f);
}
const cli=lineage.sets.map((s:any)=>({file:s.actual_file,sha256:sha(s.actual_file),command:`node --import tsx cpa_uploader/validate_draft_v3.ts --file ${s.actual_file} --against-bank`,output:execFileSync(process.execPath,['--import','tsx','cpa_uploader/validate_draft_v3.ts','--file',s.actual_file,'--against-bank'],{encoding:'utf8'})}));
write('cli-validation.json',{recorded_at:new Date().toISOString(),phase:'static_only',model_calls:0,results:cli});
write('inventory-and-relations-check.json',{recorded_at:new Date().toISOString(),model_calls:0,global_inventory_raw_sets:globalDrafts.length,global_inventory_unique_ids:new Set(globalDrafts.map(s=>s.id)).size,policy:'data+drafts 명시 탐색. 역사본·사본 포함의 원자료 수이며 전역 활성 세트 수가 아니다. 실제 의미검수 비교은행은 총괄이 선택·고정한다.',s03_inventory_ids:globalDrafts.filter(s=>ids.has(s.id)).map(s=>s.id),other_topic05_09_13:globalDrafts.filter(s=>!ids.has(s.id)&&['05','09','13'].includes(s.classification?.topic_id)).map(s=>({set_id:s.id,title:s.title})),unclassified_inventory_ids:globalDrafts.filter(s=>!s.classification).map(s=>s.id),relationship_rows:relations.length,errors});
if(errors.length)throw Error(errors.join('\n'));
lineage.stage='draft_ready';
for(const s of lineage.sets){s.stage='draft_ready';s.evidence_sha256=sha(s.evidence_file);s.sha256=sha(s.actual_file);s.plan_sha256=sha(s.plan_file);s.qa_sha256=sha(s.qa_file);s.semantic_review='not_run';s.live_grading='not_run';}
write('lineage.json',lineage);
const source='cpa_uploader/data/official/delegated-s03-kga-2025.txt';
const files=['lib/questionV3.ts','lib/questionV3Grading.ts','cpa_uploader/questionSemanticReview.ts','cpa_uploader/questionAuthoringPlan.ts','cpa_uploader/questionDraftInventory.ts','cpa_uploader/questionBankPublication.ts','cpa_uploader/questionSourceCatalog.mjs','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/runtime-settings.json','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json'];
write('execution-inputs.json',{recorded_at:new Date().toISOString(),phase:'draft_ready_no_model',model_calls:0,source_file:source,source_sha256:sha(source),bank_sha256:check.bank_sha256,preflight_input_budget_chars:400000,openai_api_key_present:!!process.env.OPENAI_API_KEY,review_model_env_present:!!process.env.CPA_REVIEW_MODEL,model_policy:'총괄 현행 앱 기본 gpt-5.6-luna. 이 단계에서 임의 모델 선택·호출 없음.',input_hashes:files.map(file=>({file,sha256:sha(file)}))});
const rows=lineage.sets.map((s:any)=>`| ${s.plan_id} | [${s.set_id}](${path.basename(s.actual_file)}) | ${s.plan_question_map.map((q:any)=>q.points).join(' / ')} | ${s.points} | ${s.qa_cases} | \`${s.sha256}\` |`).join('\n');
const chars=check.per_set.map((s:any)=>s.review_preparation.request_chars.toLocaleString('en-US'));
const text=`# S03 1차 인계\n\n**draft_ready: 5세트·13물음·62점·작성자 QA274사례.** 공식 원문과 계획을 결속한 수동 초안이며 실제 의미검수·모델채점은 미실행이다. 전체49 최종 비교은행 고정 후2차를 재개한다. 정본편입·게시·배포하지 않았다.\n\n| 계획 ID | 실제 초안 | 물음별 점수 | 합계 | QA | SHA-256 |\n|---|---|---|---:|---:|---|\n${rows}\n\n[총괄49행 ID 장부](../../../analysis/reviews/delegated-authoring-2026-09-11/id-ledger.json)의 S03 배정과 일치한다. [lineage](lineage.json)는13개 계획물음과 실제subquestion,초안·계획·QA·수동근거 해시를 보존한다. 초안 상태는needs_review/needs_human_review이며 사람확인이나 제작완료 상태가 아니다.\n\n잠정36→62점(+26)이다. [변경표](design-changes.json)에 각 물음의 독립명제와 분리 근거를 남겼다. 소송의 질문상대/문서군, 법률고문 소통조건/경로, 기초채권 주장/일부증거 한계, 내부감사업무의 개별 평가, 서비스보고서·실제테스트의 기간 및 보충통제의 독립 평가를 발문에 명시했다. 같은 배분결정의 활용축소/직접업무확대는1점이고 유형 정의 등 주어진 사실은 배점하지 않는다.\n\n[정적 검사](static-check.json), [CLI 검사](cli-validation.json), [전역자료 탐색과 관계검사](inventory-and-relations-check.json)는 오류0이다. 정본+S03 메모리검증,등록 인용의 exact 일치,version1계획,ID/정수합계/QA형상/해시,62criterion별조건경계와 비빈답not_met,명시data+drafts탐색 및 동일ID/발문 충돌을 확인했다. 전체49의 의미적 중복검수 결과로 확대하지 않는다.\n\n400,000자 명시 한도에서 준비용111세트+S03로 무호출 입력을 구성했다. 순서대로 ${chars.join(' / ')}자이며 공식 등록 메타데이터를 모두 확인했다. 기본160,000자 설정이나 비교은행·공식본문을 줄이지 않았다. 최종비교본으로 다시 준비해야 한다.\n\n공식 [등록파일](../../../data/official/delegated-s03-kga-2025.txt)의 SHA-256은 \`${sha(source)}\`이다. 선택98문단의89개는 공백제거 기준 동일하고9개는 각주 번호·기준서 제목 차이이다. [판본과 범위](scope-and-sources.md)에 실제 확인과 한계를 구분했다.250.10은 양판본 모두202X를 유지하므로 시행일을 추정하지 않고 가상법규 두 유형의250.6/14~16 책임 적용으로 한정했다.610의 국내 직접적 보조 금지를 유지하며 공식23/24와 학습요약22/23을 구별한다.\n\n모델에 필요한 의존문맥은 실제source_refs에,조건·판본판단과 제한은 version1 plan에 들어간다. 각 \`.json.authoring-plan.json\`을--plan으로 전달하며 수동evidence-packet을--packet으로 넘기지 않는다. 별도 근거장부가 자동 모델입력이라고 가정하지 않았다.\n\n[빈도 증거](frequency-evidence.json)는9요소를13관계행으로 연결하되 반복행을 빈도에 가산하지 않는다. 필수암기/OX 교재 심화18 수록1개와 원출처 미확정 연습711쪽을 기출/모의로 바꾸지 않았다. [원발문·해설15문맥](learning-original-context.json), [정본23세트 대조](comparison-notes.json)를 읽어 차이를 기록했다. 특히T09-D/Q3 상황A는정본09-001/subq1/crit2의 의도된 직접복습1점이며 새 공백으로 주장하지 않는다. [coverage 제안](coverage-proposal.json)의 실제element/src/draft/criterion을 확인했으며 전부needs_review다. 최종snapshot·공통links는 총괄 소유다.\n\n[선행·후속 범위](peer-scope-handoff.md)는 R01 재고시차/조회필수,R02 지배기구 커뮤니케이션,N04 전문가620,N02 일반통제 개념과의 경계를 담았다. [2차 체크포인트](phase2-followups.md)의 누락함축·OR조건·독립평가·시점경계를 실제모델로 확인하고 불일치는 원문/기대값/문항/엔진을 구분하여 수정·재실측한다.\n\nAPI 호출0회다. 키는.env.local 로드 후 존재만 확인했고 값은 기록하지 않았다. 실제 모델은 총괄 runtime의 gpt-5.6-luna를 따른다. [실행입력](execution-inputs.json)은 현재코드·정책·원문해시이며2차에다시고정한다. S03 작업의 쓰기는s03/에 한정했다. R01/N05 QA후속은 총괄 소유이며 변경하지 않았다.\n`;
fs.writeFileSync(path.join(base,'handoff.md'),text);
let links=0;
for(const file of fs.readdirSync(base).filter(f=>f.endsWith('.md'))){const t=fs.readFileSync(path.join(base,file),'utf8');for(const m of t.matchAll(/\]\(([^)]+)\)/gu)){const dest=m[1].split('#')[0];if(!dest||/^[a-z]+:/iu.test(dest))continue;links++;if(!fs.existsSync(path.resolve(base,dest)))errors.push('Missing link '+file+' '+dest);}}
write('handoff-check.json',{recorded_at:new Date().toISOString(),local_markdown_links:links,sets:sets.length,questions:sets.reduce((n:number,s:any)=>n+s.subquestions.length,0),points:check.points,qa:check.qa_cases,errors,source_sha256:sha(source),bank_sha256:check.bank_sha256});
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({stage:lineage.stage,sets:sets.length,questions:13,points:check.points,qa:check.qa_cases,links,errors,hashes:lineage.sets.map((s:any)=>({id:s.set_id,sha256:s.sha256}))}));
