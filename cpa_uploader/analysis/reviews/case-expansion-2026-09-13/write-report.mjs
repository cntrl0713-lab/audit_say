import fs from 'node:fs';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f));
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const before=read(D+'/bank-before.json');
const oldCatalog=read(D+'/catalog-before.json');
const catalog=read('cpa_uploader/data/learning-question-classifications.json');
const targetIds=read(R+'/target-ids.json');
const shapes=read(R+'/shape-check.json');
const grading=read(R+'/sealed-v1/summary.json');
const production=read(R+'/db-publication-v1/completion.json');
const lineage=read(R+'/standard-lineage.json');
const independent=read(R+'/report-counts.json');
assert.equal(production.status,'production_published_and_independently_verified');
assert.equal(grading.status,'passed');
const count=(b,c)=>({sets:b.length,questions:b.reduce((n,s)=>n+s.subquestions.length,0),standard:c.classifications.filter(q=>q.question_style==='standard').length,case:c.classifications.filter(q=>q.question_style==='case').length,caseSets:new Set(c.classifications.filter(q=>q.question_style==='case').map(q=>q.source_set_id)).size,units:new Set(c.classifications.map(q=>q.question_style==='case'?q.source_set_id+'--case':q.source_set_id+'--standard--'+q.subquestion_id)).size,points:b.reduce((n,s)=>n+s.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0),0)});
const old=count(before,oldCatalog),ours=count(read(R+'/candidate-v1.json'),read(R+'/catalog-v1.json')),now=count(bank,catalog);
const merge=read(R+'/publication-v2/merge-evidence.json');
const facts=s=>[...s.shared_context.facts.map(f=>f.text).join('\n')].length;
const cq=(s,c)=>c.classifications.filter(q=>q.source_set_id===s.id&&q.question_style==='case').length;
const rows=targetIds.map(id=>{const a=before.find(s=>s.id===id),b=bank.find(s=>s.id===id);return`| ${id} | ${facts(a)} → ${facts(b)} | ${cq(a,oldCatalog)} → ${cq(b,catalog)} |`;});
const added=bank.filter(s=>!before.some(b=>b.id===s.id)&&s.subquestions[0].question_style==='case');
const checks=read(R+'/final-checks.json');
assert(checks.every(c=>c.exit_code===0));
const costText=grading.known_cost?`$${grading.estimated_cost_usd.toFixed(7)}`:`확정 불가(사용량 미반환 ${grading.accounting.requests_without_returned_usage}회, 비용 미확인 ${grading.accounting.unknown_cost_responses}회, 캐시 쓰기량 미기록 ${grading.accounting.bounded_cost_responses}회)`;
const report=`# 사례 보강·기준서형 분리·운영 반영 결과 — 2026-09-13

기존 사례 41개를 전수 조사하고 미달 사례 23개를 보강했다. 기출문제와 고급 회계감사 연습의 실제 발문·답안, 관련 공식 기준서 원문을 대조하여 새 사례 2개를 추가했다. 현재 사례 43개는 모두 사실관계 400자 이상, 사례형 물음 2개 이상이다. 가장 짧은 사실관계는 ${shapes.minimum_facts_characters}자다. 정본·공개본·운영 DB 반영 및 독립 조회 검증을 완료했다.

시작 시 사례형 물음이 2개 미만인 사례는 ${independent.totals.before.case_shape.below_two_questions.length}개, 사실관계가 400자 미만인 사례는 ${independent.totals.before.case_shape.below_400_characters.length}개였으며, 두 조건의 합집합이 보강한 23개다. [독립 전후 대조](../../${R}/report-counts.json)에 집계와 보존 검사를 기록했다.

## 전후 변화

| 구분 | 시작 | 이번 사례 작업만 반영 | 병행 작업을 보존한 최종 게시본 |
| --- | ---: | ---: | ---: |
| 저장 세트 | ${old.sets} | ${ours.sets} | ${now.sets} |
| 전체 물음 | ${old.questions} | ${ours.questions} | ${now.questions} |
| 기준서형 독립 물음 | ${old.standard} | ${ours.standard} | ${now.standard} |
| 사례형 물음 | ${old.case} | ${ours.case} | ${now.case} |
| 사례 부모 | ${old.caseSets} | ${ours.caseSets} | ${now.caseSets} |
| 학습 단위 | ${old.units} | ${ours.units} | ${now.units} |
| 전체 배점 | ${old.points} | ${ours.points} | ${now.points} |

게시 준비 중 다른 작업이 추가한 기준서형 ${merge.external_count}세트·${merge.external_questions}물음을 감지했다. 원본 보호 검사가 v1 설치를 막았고, 그 추가 문항·분류·검수 이력을 모두 보존한 v2 병합본을 검증해 설치했다. 이를 이번 사례 작업의 신규 제작으로 계상하지 않는다. [병합 근거](../../${R}/publication-v2/merge-evidence.json)에 별도로 기록했다.

기준서형 ${lineage.length}물음은 사례에서 분리해 23개 별도 저장 묶음으로 옮겼다. 앱에서는 각 물음을 독립 학습한다. 기존 앱의 독립 발문·모범답안·요구사항·채점기준·배점을 유지했으며, 기준서형 전체 수는 늘리지 않았다. [분리 계보](../../${R}/standard-lineage.json)와 [기준별 계보](../../${R}/criterion-lineage.json)에 이전 위치와 현재 위치를 기록했다. 과거 봉인 판본·시도·검수 receipt는 보존했다.

## 보강 내역

글자 수는 제목·발문을 제외하고 facts의 본문을 줄바꿈 하나로 결합한 문자열의 유니코드 코드포인트 수이며 공백을 포함한다. 분량을 늘리는 데 그치지 않고, 감사 대상·시점·증거·관계자 주장·잘못된 계획을 물음의 판단과 절차 선택에 대응시켰다. 사실을 제거하면 같은 만점 답안이 성립하는 물음은 독립 기준서형으로 분리했다.

| 기존 사례 ID | 사실관계 글자 수 | 사례형 물음 수 |
| --- | ---: | ---: |
${rows.join('\n')}

| 추가 사례 | 제목 | 사실관계 | 물음 |
| --- | --- | ---: | ---: |
${added.map(s=>`| ${s.id} | ${s.title} | ${facts(s)}자 | ${s.subquestions.length} |`).join('\n')}

요구량이 큰 독립 상황은 물음을 분리하고, 판단·근거 및 별도 절차는 각각의 독립 의미에 정수 배점을 부여했다. 문서화 5개 요소, 현재 경영진의 서면진술 책임과 미입수 효과, 보고서 단락의 기능 등은 발문·모범답안·기준을 함께 대조했다. 새 분개 사례에서는 이미 주어진 계획을 다시 쓰면 점수를 받던 초안을 수정해, 누락된 수동 조정분개 검사를 찾아 보완하도록 바꿨다.

## 출처와 내용 검토

[제작 배치](../../${D}/README.md)의 a/b/c/root 폴더에 각 사례의 출제 계획, 실제 source unit, 기출·고급연습의 발문·답안 위치, 공식 문단, 사실-물음 연결, 배점 결정과 QA를 보존했다. 기출·모의·연습의 빈도는 합산하지 않았다. 신규 사례는 기존 요구의 사례 적용을 보강하는 목적이며 미출제 확정을 주장하지 않는다.

작성 담당 agent와 총괄 agent가 변경 사례의 모든 물음·모범답안·채점기준·기대답안을 대조했다. 추가로 [B 교차 검토](../../${D}/c/cross-review-b.json)와 [신규 사례 교차 검토](../../${D}/a/root-peer-review.json)를 수행했다. 발견한 내용 결함은 통합 전에 수정했으며 미해결 내용 결함은 없다. 별도 유료 API 의미검수나 사람의 내용 확인으로 기록하지 않았다. 이번에 내용이 바뀌지 않은 기존 18개 사례는 앞선 전수 검토와 유효한 실측 증거를 유지한다.

## 실제 채점과 검사

Luna(gpt-5.6-luna)로 변경·신규 사례 25개와 이동 기준서형 35물음, 합계 ${grading.target_questions}물음을 검증했다. 모범·대표 부분·대표 오답 ${grading.fixed_evaluated_answers}개 중 ${grading.exact_score_matches}개가 기대점수와 정확히 일치했고 ${grading.within_tolerance}개가 ±1점 이내였다(${(grading.within_tolerance_ratio*100).toFixed(2)}%). 실제 SDK 호출 ${grading.actual_sdk_calls}회, 기록된 토큰 기준 추정 비용 ${costText}이다. 이 비율은 이번 대표 답안의 실측 결과이며 모든 학생 답안의 정확도나 통계적 신뢰수준이 아니다.

[봉인 결과](../../${R}/sealed-v1/summary.json), [최초 실행 입력](../../${R}/execution-v1/grading-manifest.json), [최종 재개 실행 입력](../../${R}/execution-resume-v4/grading-manifest.json)에 모든 관측·요청 식별자·입출력/캐시 토큰·실측 비용 근거를 연결했다. ±1점 내 편차를 없애기 위한 반복 호출은 하지 않았다. 배치 예산 $20, 제공자 한도 방식이며 실패를 분모에서 제외하지 않았다.

허용 범위 밖 결과는 ${grading.outside_tolerance.length}개다. [잔여 채점 차이 조사](../../${R}/residual-findings-v1.json)에 원 답안·기대값을 유지한 채 원인과 학습 영향을 기록했다. 내용·출처·발문·배점의 오류를 5% 허용으로 면제하지 않았으며, 모델이 문맥의 의미를 지나치게 엄격하게 해석한 실측 편차는 배치 정책에 따라 별도로 남겼다.

DNS 연결 오류로 두 차례 실행이 중단되어 [첫 재개](../../${R}/execution-resume-v2/recovery.json)와 [최종 재개](../../${R}/execution-resume-v4/recovery.json)를 기록했다. 처음 90개, 다음에는 누적 148개 관측을 원 경로·해시로 재사용하고 미완료 요청만 수행했다. v3 사전 검사의 복구 기록 제약은 [보존한 실패](../../${R}/execution-resume-v3/preflight-failure.json)와 [기록 소비자 수정](../../${R}/execution-resume-v4/recorder-revision.json)에 연결했다. 실제 채점 동작·답안·기대값은 바꾸지 않았고, 정확히 동일한 코드의 조상 보존본만 허용하는 검증을 회귀 테스트로 확인했다. 기존 오류와 중단 로그는 삭제하지 않았다. 사용량이 반환되지 않은 호출 ${grading.accounting.requests_without_returned_usage}회가 있어 전체 비용을 0이나 확정 금액으로 표시하지 않았다. 반환된 응답의 비용 합계 범위는 $${grading.accounting.accounted_min_usd?.toFixed(7)}~$${grading.accounting.accounted_max_usd?.toFixed(7)}이며 전체 청구액과 구별한다.

${checks.map(c=>`- ${c.command}: 통과`).join('\n')}

## 반영과 보존

정본·공개본·암호화본·학습 분류를 함께 검증해 설치했고 승급 장부에 기존 23세트의 재검수, 신규 25세트의 검수와 48세트의 게시 기록을 추가했다. [설치 기록](../../${R}/publication-v2/install-completion.json)은 병행 작업을 포함한 기존 장부 보존과 이번 작업의 추가 96개 기록을 확인한다.

운영 릴리스 ID: **${production.release_id}**. 대상 프로젝트는 xvifzicrjmbfqaepcfpp.supabase.co이며, [배포 기록](../../${R}/db-publication-v1/completion.json)과 [독립 검증](../../${R}/db-publication-v1/verification.json)으로 실제 활성 릴리스·공개/사설 페이로드·학습 단위·배점을 대조했다. 기존 이력은 삭제하지 않았다.

coverage의 기존 연결은 이동한 criterion 위치로 다시 연결하고 이전 snapshot을 보존했다. 관계 의미를 새로 승인했다고 기록하지 않았다. 생성 분석·wiki는 현재 입력에서 다시 생성했다. 이 작업에서 앱 실행 코드는 바꾸지 않았으며 운영 DB 게시본이 갱신된 결과다.
`;
const output='docs/reports/case-expansion-2026-09-13.md';
assert(!fs.existsSync(output));fs.writeFileSync(output,report);
fs.appendFileSync(R+'/README.md',`\n## 완료 결과\n\n[최종 보고서](../../../../${output})에 전후 수치와 보강 목록을 기록했다. 사례 ${now.caseSets}개·사례형 ${now.case}물음이며 모든 사례가 400자/2물음 기준을 충족한다. 실제 ${grading.fixed_evaluated_answers}답안 중 ${grading.within_tolerance}개가 ±1점 이내다. 정본·공개본과 운영 DB 릴리스 ${production.release_id}의 독립 검증을 완료했다. 실행 증거는 위 단계별 디렉터리에 보존한다.\n`);
fs.appendFileSync(D+'/README.md',`\n최종 통합·채점·운영 반영을 완료했다. [최종 보고서](../../../${output})와 후속 검토 장부에서 단계별 실제 결과를 확인한다. 작성 당시 초안의 needs_review 상태는 제작 이력으로 보존했으며, 현재 게시 상태는 정본과 새 승급 장부를 따른다.\n`);
console.log({report:output,before:old,after:now});
