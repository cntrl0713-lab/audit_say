import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import specs,{edition} from './content.mjs';
const dir='cpa_uploader/drafts/delegated-authoring-2026-09-11/s05';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const manifest=read(path.join(dir,'lineage.json'));
const validation=read(path.join(dir,'static-validation-01.json'));
if(validation.errors.length)throw Error('정적검사 실패');
const write=(name,data)=>fs.writeFileSync(path.join(dir,name),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const table=manifest.entries.map(e=>`| ${e.plan_id} | [${e.set_id}](${path.basename(e.file)}) | ${e.questions} | ${e.points} | ${e.qa_cases} |`).join('\n');
const scope=`# S05 범위·공식 근거·원출제 대조\n\n${edition}\n\n2027년 시험 범위 공고와 기준서의 실제 시행일은 구별한다. 세트의 기본 보고기간·후속시점을 명시했고, 주변 품질관리 표현 차이는 [사전 출처 대조](source-preparation-handoff.md)와 [총괄 판본 정책](../../../analysis/reviews/delegated-authoring-2026-09-11/edition-policy.md)의 사례 한정 해석을 따른다.\n\n`+
specs.map(s=>`## ${s.plan} — ${s.title}\n\n${s.difference}\n\n제외: ${s.exclusions.join(' ')}\n\n조건·예외: ${s.exceptions.join(' ')}\n\n| 물음 | 실제 발문 | 직접 공식 문단 | 독립 명제·점수 |\n|---|---|---|---|\n`+s.qs.map((q,i)=>`| ${s.plan}-Q${i+1} | ${q.prompt} | ${[...new Set(q.claims.map(c=>c.ref))].join(', ')} | ${q.claims.map(c=>c.claim).join('<br>')} (${q.claims.length}점) |`).join('\n')).join('\n\n')+
`\n\n## 빈도와 관계\n\n[frequency-evidence.json](frequency-evidence.json)은 실제 question-elements 입력 해시·원출제 식별자·원발문·답안 위치를 보존한다. [학습자료 원문](sources/learning-source-units.json)과 [현재 은행 비교](current-bank-context.json)를 대조했다. 기출과 모의·연습/OX 수록은 합산하지 않는다.\n\n- 2020:9:5는 잘못된 문구만 고치는 기출이다. 원문에서 이미 올바른 의견 미표명 문장을 오류라고 처리하지 않았다. 새 사례는 문장 다 자체를 적정의견 문구로 바꾸어 네 수정 요구가 성립한다.\n- 보고서일의 원기출 빈도는 날짜 적용·세 선행 조건의 직접 빈도로 확대하지 않는다.\n- 그룹 수행중요성 적합성 평가 원기출은 T14-C-Q1의 주체와 수행중요성 대상에 연결하며, 별도감사 전체 중요성까지 두 번 출제되었다고 주장하지 않는다.\n- T15-A-Q2는 현재 15-004의 두 단락 생략·법규 예외를 의도적으로 복습한다. T14-C는 N05의 부문 업무유형·중요성 명칭과 구별하고, 최초 보고서일은 N06/기존12-007의 수정 보고서일과 구별한다.\n\n## 원문 확보와 입력 전달\n\n[sources/official-comparison.json](sources/official-comparison.json)의 57문단(2025/2026 각 원문·물리쪽·해시)을 대조했고, 701.18(a)~(c)가 다음 물리쪽725쪽에 이어지는 것을 화면으로 확인했다. 700.46/49는683쪽이다. 별도로 [230.8/A6 비교](sources/documentation-context-comparison.json)는 두 판본이 공백 제외 동일하다. 230.8(a)에 반복된 도입문이 있는 원 PDF 문구는 보존하며 별도 득점 명제가 아니다.\n\n701.18의 각주6은230.8~11/A6, A64는230.8의 일반 문서화 요구를 가리킨다. 새 공식230.8/A6와 기존 공식230.9~11 및701.9/10의 실제 본문·file/quote SHA를 T16-C plan.scope.exceptions에 넣어 의미검수 입력에 전달한다. 해당 주변 문맥을 추가 배점으로 요구하지 않는다. 자동 생성 source-packet의 완전성을 주장하지 않는 수동 작성 경로이며 evidence-packet을 검수 CLI의 --packet에 넣지 않는다.\n\n## QA 기대값과 정적 검사\n\n독립 명제27개에 완전답안·동의 표현·역순·한 문장·무관한 접두문·빈답안·전체 무관답안 및 명제별 누락·반대·실제 조건 경계 사례를 작성했다. 판단 결론을 삭제해도 근거가 판단을 함축하면 기대 met을 유지했고, 명시적 반대 판단과 정확한 후속 근거는 별도로 채점하도록 사례를 마련했다. 보고서 문구 교정은 해당 문장·대상을 각각 평가한다.\n\n첫 후보에서 동일한 일반 채점 지시를 여러 criterion의 critical_facts에 반복해 넣은 형상 오류가 발견되어 제거했다. 현재 critical_facts에는 각 명제의 실제 요구를 기록하고 해석 범위 설명은 requirement.source_span에 둔다. 전역 정적 수집 당시 오류는 보존되며, 후속 [static-validation-01.json](static-validation-01.json)은4세트·9물음·27점·QA150·138세트 메모리 비교, 실제 출처 인용/계획/ID/형상 및400k 입력 한도 오류0이다. 모델 호출은0회다.\n\n[design-changes.json](design-changes.json)에 잠정25→27점의 변경 근거를 남겼다. 날짜 결론1점, 701.18(a)의 서로 독립적인 기록과 판단근거 분리1점이며 요구 문항 수는 유지했다.\n`;
write('scope-and-sources.md',scope);
const frequency=read(path.join(dir,'frequency-evidence.json'));
const links=frequency.elements.map((element,index)=>{
 const row=manifest.entries.find(e=>e.plan_id===element.plan_id);
 const set=read(row.file),q=set.subquestions.find(q=>q.id===element.subquestion_id);
 let selected=q.criteria;
 if(element.element_id==='element-b2f3c0a90ae3028a')selected=q.criteria.filter(c=>c.id==='sub1.crit2');
 if(element.element_id==='element-4acb3c455ddcbb7d')selected=q.criteria.filter(c=>['sub1.crit1','sub1.crit3'].includes(c.id));
 return {id:`delegated-2026-09-11-s05-${String(index+1).padStart(2,'0')}`,plan_id:element.plan_id,element_id:element.element_id,
  source_unit_ids:[...new Set(selected.flatMap(c=>c.source_ref_ids))],target:{scope:'draft',file:row.file,set_id:set.id,subquestion_id:q.id,criterion_ids:selected.map(c=>c.id)},
  relationship:element.relationship,review_status:'needs_review',reason:element.relationship_limit,
  provenance:{scope_file:dir+'/scope-and-sources.md',scope_sha256:sha(dir+'/scope-and-sources.md'),frequency_file:dir+'/frequency-evidence.json',frequency_sha256:sha(dir+'/frequency-evidence.json'),candidate_sha256:sha(row.file)}};
});
write('coverage-proposal.json',{artifact_type:'coverage_relationship_proposal',status:'pending_final_content',links,note:'최종 모델 검수와 문항 수정 이후 재대조·snapshot 확정 전 공통 links에 반영하지 않는다.'});
write('README.md',`# S05 감사보고서·KAM·그룹 중요성\n\n**draft_ready — 1차 중간 인계. 실제 모델 의미검수·채점은 아직 수행하지 않았다.**\n\n총괄이 공통 ID 장부에 따라 직접 작성한4세트·9물음·27점이다. 사용자 지정2027 CPA 목표와2026년 개시 사례를 적용했다.\n\n| 계획 ID | 실제 파일 | 물음 | 점수 | 작성자 QA |\n|---|---|---:|---:|---:|\n${table}\n\n- [범위·근거 대조](scope-and-sources.md)\n- [정적 검사](static-validation-01.json)\n- [설계 변경](design-changes.json) · [계보·입력 해시](lineage.json)\n- [관계 제안](coverage-proposal.json) · [인계](handoff.md)\n\n실제 검수는 총괄이 전체 비교 은행을 고정한 뒤 별도 담당자가 수행한다. `+'`needs_review / needs_human_review`'+` 상태를 유지한다. 정본·공개본·DB·배포 작업은 하지 않았다.\n`);
write('handoff.json',{package:'S05',stage:'draft_ready',author:'root',created_at:new Date().toISOString(),sets:4,questions:9,points:27,qa_cases:150,entries:manifest.entries,static_evidence:dir+'/static-validation-01.json',semantic_review:'not_run',actual_grading:'not_run',model_calls:0,remaining:['전체49세트 비교은행 고정','독립 실제 모델 의미검수','작성자 및 검수자 QA 실제 채점','불일치 반복3회·원인수정·영향사례 재채점','최종 동료 의미중복 재대조'],no_promotion:true});
write('handoff.md',`# S05 1차 인계\n\n4세트·9물음·27점, 작성자 QA150개. **초안 준비 인계이며 검증 완료가 아니다.**\n\n| 계획 ID | 실제 ID | 출처·판본 | 초안 SHA256 | 정적검사 | 의미검수 | 실제 채점 | 남은 일 |\n|---|---|---|---|---|---|---|---|\n`+manifest.entries.map(e=>`| ${e.plan_id} | ${e.set_id} | 국내2025/2026대조·2026개시 | ${e.sha256} | 오류0 | 미실행 |0건|비교은행고정·의미검수·채점·수정|`).join('\n')+`\n\n[상세 대조·범위](scope-and-sources.md), [실제 해시 및 계획·QA 경로](handoff.json), [정적 실행 증거](static-validation-01.json)를 따른다. 자동packet이 아니므로 검수 CLI에는 각 문항과 authoring-plan을 전달하고 수동 evidence-packet을 --packet으로 지정하지 않는다.\n\n선행 N05의 중요성 명칭·업무유형과 N06의 수정 보고·후속시점 경계를 받아 반영했다. T15-B의 최초보고서일, T16-C의701.18 완전 문서화, T14-C의 별도감사 중요성 검증은 각각 구별한다. 잠정25점에서27점으로 조정한 이유는 design-changes.json에 기록했다.\n`);
console.log(JSON.stringify({stage:'draft_ready',sets:4,questions:9,points:27,qa_cases:150,coverage_links:links.length}));
