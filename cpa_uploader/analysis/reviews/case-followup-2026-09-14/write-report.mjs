import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const R='cpa_uploader/analysis/reviews/case-followup-2026-09-14';
const D='cpa_uploader/drafts/case-followup-2026-09-14';
const reportFile='docs/reports/case-followup-2026-09-14.md';
const answersFile=D+'/questions-and-answers.md';
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write=(file,text)=>fs.writeFileSync(file,text,{flag:'wx'});
const sorted=values=>[...values].sort();
const chars=set=>[...set.shared_context.facts.map(fact=>fact.text).join('\n')].length;
const questionPoints=question=>question.criteria.reduce((sum,criterion)=>sum+criterion.max_points,0);
const points=set=>set.subquestions.reduce((sum,question)=>sum+questionPoints(question),0);
const tableText=text=>String(text).replaceAll('|','\\|').replaceAll('\n',' ');
const assertIdentity=identity=>assert.equal(hash(identity.file),identity.sha256,'Completion evidence changed: '+identity.file);
assert.equal(process.argv.length,2,'This report reads explicit final batch artifacts');
assert(!fs.existsSync(reportFile)&&!fs.existsSync(answersFile),'Preserve earlier report artifacts');

const ids=read(R+'/changed-sets-v1.json');
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const catalogFile='cpa_uploader/data/learning-question-classifications.json';
const bank=read(bankFile),catalog=read(catalogFile),shape=read(R+'/shape-check.json');
const sets=ids.map(id=>bank.find(set=>set.id===id));
assert.equal(ids.length,6);assert.equal(new Set(ids).size,ids.length);
assert(sets.every(set=>set?.status==='published'&&set.verification.review_status==='verified'));
assert(sets.every(set=>set.subquestions.length===3&&set.subquestions.every(question=>question.question_style==='case')));
assert.equal(catalog.source_file_sha256,hash(bankFile));
const measured=sets.map(set=>({set_id:set.id,title:set.title,questions:set.subquestions.length,facts_characters:chars(set),points:points(set)}));
assert.deepEqual(shape.rows,measured,'Final cases differ from reviewed shape/content summary');
assert.equal(shape.new_cases,sets.length);
assert.equal(shape.new_questions,sets.reduce((sum,set)=>sum+set.subquestions.length,0));
assert.equal(shape.minimum_facts_characters,Math.min(...measured.map(row=>row.facts_characters)));
assert(shape.minimum_facts_characters>=400);

const grade=read(R+'/sealed-v1/summary.json'),readiness=read(R+'/sealed-v1/readiness.json');
const db=read(R+'/db-publication-v1/completion.json');
const installed=read(R+'/publication-v1/install-completion.json');
const root=read(R+'/root-content-review.json');
assert.equal(grade.status,'passed');assert.equal(readiness.ready,true);
assert.equal(grade.target_sets,shape.new_cases);assert.equal(grade.target_questions,shape.new_questions);
assert.equal(grade.human_review_performed,false);assert.equal(grade.new_model_semantic_review_calls,0);
assert.equal(root.method,'agent_content_review');assert.equal(root.human_review_performed,false);
assert.deepEqual(root.unresolved_content_findings,[]);
assert.deepEqual(sorted(root.questions.map(question=>question.set_id+'/'+question.subquestion_id)),
  sorted(sets.flatMap(set=>set.subquestions.map(question=>set.id+'/'+question.id))));
assert(root.questions.every(question=>Object.values(question.checks).length===8&&Object.values(question.checks).every(value=>value==='pass')&&question.rationale.trim()));
assert.equal(db.status,'production_published_and_independently_verified');
assert.equal(installed.status,'canonical_installed_and_validated');
assert(typeof db.release_id==='string'&&db.release_id.trim());
for(const identity of [...db.files,...installed.files])assertIdentity(identity);
assertIdentity(readiness.batch);
const sealedBatch=read(readiness.batch.file);
assertIdentity(sealedBatch.grading_manifest);
const manifest=read(sealedBatch.grading_manifest.file);
assert.equal(manifest.model,'gpt-5.6-luna');
assert.deepEqual(sorted(sealedBatch.agent_reviews.map(review=>review.set_id)),sorted(ids));
assert.equal(grade.fixed_evaluated_answers,grade.scores.length);
assert.equal(grade.exact_score_matches,grade.scores.filter(score=>score.delta===0).length);
assert.equal(grade.within_tolerance,grade.scores.filter(score=>score.within_tolerance).length);
assert.equal(grade.within_tolerance_ratio,grade.within_tolerance/grade.fixed_evaluated_answers);
assert(grade.within_tolerance_ratio>=0.95);
assert.equal(grade.outside_tolerance.length,grade.scores.filter(score=>!score.within_tolerance).length);
assert(grade.scores.every(score=>ids.includes(score.source_set_id)));

const old=read(R+'/integration-baseline/bank.json');
const oldCatalog=read(R+'/integration-baseline/catalog.json').classifications;
for(const set of old)assert.deepEqual(bank.find(current=>current.id===set.id),set,'Existing question changed');
assert.equal(bank.length,old.length+sets.length);
const classifications=catalog.classifications;
const caseIds=[...new Set(classifications.filter(row=>row.question_style==='case').map(row=>row.source_set_id))];
const beforeCaseIds=[...new Set(oldCatalog.filter(row=>row.question_style==='case').map(row=>row.source_set_id))];
const caseQuestions=classifications.filter(row=>row.question_style==='case').length;
const beforeCaseQuestions=oldCatalog.filter(row=>row.question_style==='case').length;
assert(caseIds.every(id=>{
  const set=bank.find(current=>current.id===id);
  return set&&chars(set)>=400&&classifications.filter(row=>row.source_set_id===id&&row.question_style==='case').length>=2;
}));
const deviations=grade.scores.filter(score=>score.delta!==0&&score.within_tolerance);
const cost=grade.known_cost
  ? `반환된 실제 사용량에 고정 단가를 적용한 추정액은 $${grade.estimated_cost_usd.toFixed(6)}다.`
  : `전체 비용은 미확인이다. 사용량 미반환 호출 ${grade.accounting.requests_without_returned_usage}개, 단가/사용량 미확인 응답 ${grade.accounting.unknown_cost_responses}개, 비용 범위만 계산 가능한 응답 ${grade.accounting.bounded_cost_responses}개를 0원으로 처리하지 않았다.`;

const lines=[
  '# 2026-09-14 후속 사례형 제작 결과','',
  `사용자 확정 범위인 새 사례 ${shape.new_cases}개·${shape.new_questions}물음의 제작, agent 내용 검토, 실제 Luna 채점과 정본·공개본·운영 DB 반영을 완료했다. 기존 문항의 본문·정답·배점을 보존했다.`,'',
  '| 추가 사례 | 사실관계 문자 수 | 물음 | 배점 |','|---|---:|---:|---:|',
  ...measured.map(row=>`| ${tableText(row.title)} | ${row.facts_characters} | ${row.questions} | ${row.points} |`),'',
  `통합 직전 은행과 비교하면 사례는 ${beforeCaseIds.length}개에서 ${caseIds.length}개, 사례형 물음은 ${beforeCaseQuestions}개에서 ${caseQuestions}개로 늘었다. 전체 ${caseIds.length}개 사례가 400자 이상·사례형 물음 2개 이상이며, 이번 ${shape.new_cases}개는 각각 정확히 3개 물음이다. 사실관계 분량은 제목·물음을 제외한 facts 본문을 LF 하나로 연결한 Unicode 코드포인트 수로 계산하고 공백을 포함했다.`,'',
  `[전체 문제와 모범답안](../../${answersFile})에서 지문·발문·정답을 확인할 수 있다.`,'',
  '## 선정과 내용 검토','',
  '기출문제와 고급회계감사연습의 지문·물음·해설, 직접 기준서 원문을 대조하고 현재 은행 및 진행 중 초안과 차이를 검토했다. 기출·모의·연습 수록을 임의로 합산하거나 교재 재수록을 새 출제로 세지 않았다. 적용 판본과 원문 위치는 각 사례의 설계·검토 장부에 기록했다.','',
  `총 ${shape.new_questions}개 물음에 대해 사실 의존성, 발문과 모범답안, 독립 득점 요건·정수 부분점수, 공식 근거·판본, 주제와 기존 문항 차이를 실제 agent가 대조했다. 미해결 내용 결함은 없으며, 이를 사람의 직접 내용 확인 또는 별도 API 의미검수로 기록하지 않았다.`,'',
  '## 실제 채점','',
  `고정된 ${grade.fixed_evaluated_answers}개 대표 답안(저장 모범·대표 부분·대표 오답)을 ${grade.requests}개 사례 단위 요청으로 통합했다. 기대점수와 정확히 일치한 답안은 ${grade.exact_score_matches}개, ±1점 이내는 ${grade.within_tolerance}개(${(grade.within_tolerance_ratio*100).toFixed(2)}%)다. 0점이 아닌 허용 편차는 ${deviations.length}개, 허용 범위 밖은 ${grade.outside_tolerance.length}개다. 원 기대값·실측·원응답을 보존했다. 이 비율은 고정된 대표 답안의 관측 결과이며 통계적 신뢰수준이나 모든 답안의 정확도 보장이 아니다.`,'',
  `실제 SDK 호출은 ${grade.actual_sdk_calls}개다. ${cost} 단가는 2026-09-12 확인 기록을 고정한 추정용 값이며 청구서·세금과 다르다. 입력·캐시·출력 토큰과 요청·응답 식별자는 실행 기록에 보존했다. 이번 금액 정책은 예산 ${grade.budget_usd===null?'미지정':`$${grade.budget_usd}`}·${grade.budget_enforcement}이며 모델은 Luna를 유지했다.`,'',
];

const notesFile=R+'/within-tolerance-notes.json';
if(fs.existsSync(notesFile)){
  const raw=read(notesFile),notes=Array.isArray(raw)?raw:Array.isArray(raw.findings)?raw.findings:Array.isArray(raw.notes)?raw.notes:[raw];
  const seen=new Set();
  for(const note of notes){
    assert.equal(note.human_review_performed??raw.human_review_performed,false);
    const score=deviations.find(row=>row.entry_id===note.entry_id&&row.subquestion_id===note.subquestion_id);
    assert(score,'Deviation note must match an actual result in this batch');
    const key=note.entry_id+'/'+note.subquestion_id;assert(!seen.has(key),'Duplicate deviation note');seen.add(key);
    assert.equal(note.expected_points,score.expected_points);assert.equal(note.actual_points,score.actual_points);assert.equal(note.delta,score.delta);
    const set=sets.find(current=>current.id===score.source_set_id);
    const index=set.subquestions.findIndex(question=>question.id===score.subquestion_id)+1;
    assert(index>0);assert(typeof note.finding==='string'&&note.finding.trim());
    assert(typeof note.decision==='string'&&note.decision.trim());
    lines.push(`- ${set.title} 물음 ${index}: 기대 ${score.expected_points}점·실측 ${score.actual_points}점. ${note.finding} ${note.decision}`);
  }
  lines.push('',`[허용 편차 조사 기록](../../${notesFile})에 실제 조사와 처리 근거를 보존했다.`,'');
}
if(grade.outside_tolerance.length){
  const findings=read(R+'/residual-findings-v1.json');
  assert.deepEqual(sorted(findings.map(finding=>finding.entry_id+'/'+finding.subquestion_id+'/'+finding.delta)),
    sorted(grade.outside_tolerance.map(score=>score.entry_id+'/'+score.subquestion_id+'/'+score.delta)));
  lines.push(`[허용 범위 밖 ${findings.length}개 관측의 조사·잔여 제한](../../${R}/residual-findings-v1.json)을 별도로 기록했다. 이 관측을 분모에서 제외하지 않았다.`,'');
}
lines.push('## 반영·검사','',
  '- 기존 문제·승급 장부를 보존한 격리 게시본을 검증한 뒤 정본·공개본·암호화본·학습 분류에 반영했다.',
  `- 운영 DB 릴리스: \`${db.release_id}\`. 공개·비공개 내용, 분류와 집계를 독립 조회로 검증했다.`,
  '- 문항 형상·정본 통합·대표 기대값·학습 단위 검사를 통과했다. 검사별 실제 결과는 검토 배치의 실행 증거를 따른다.','');
const finalChecksFile=R+'/final-checks-v1/summary.json';
if(fs.existsSync(finalChecksFile)){
  const checks=read(finalChecksFile);assert.equal(checks.status,'passed');
  assert(checks.checks.every(check=>check.exit_code===0));
  for(const check of checks.checks)assertIdentity(check.log);
  lines.push(`분석·보존·wiki 관련 ${checks.checks.length}개 최종 검사를 통과했다. [검사 결과](../../${finalChecksFile})를 보존했다.`,'');
}
lines.push(`[실행·게시 증거](../../${R}/README.md) · [출처·설계와 검토](../../${D}/README.md) · [공식 판본 확인 목록](https://www.kicpa.or.kr/board/list.brd?boardId=acc0102)`,'');

const questionLines=['# 후속 사례형 문제와 모범답안','',
  `2026-09-14 후속 제작한 사례 ${shape.new_cases}개·${shape.new_questions}물음이다. 지문과 모범답안을 함께 조회하는 내부 검토 자료이며, 기출·연습과 기준서의 요구를 참고해 별도로 구성한 연습 사례다.`];
for(const [index,set]of sets.entries()){
  questionLines.push('',`## ${index+1}. ${set.title}`,'',...set.shared_context.facts.flatMap(fact=>[fact.text,'']));
  for(const [questionIndex,question]of set.subquestions.entries()){
    questionLines.push(`### 물음 ${questionIndex+1} (${questionPoints(question)}점)`,'',question.prompt,'','**모범답안**','',
      ...question.model_answer.map(answer=>'- '+answer),'');
  }
}
write(reportFile,lines.join('\n'));
write(answersFile,questionLines.join('\n')+'\n');
console.log({report:reportFile,questions_and_answers:answersFile,case_sets:caseIds.length,added_cases:sets.length,
  added_questions:shape.new_questions,added_points:sets.reduce((sum,set)=>sum+points(set),0)});
