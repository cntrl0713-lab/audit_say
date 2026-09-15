import fs from 'node:fs';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r03';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const [s] = read(`${D}/sets.json`);
const points = q => q.criteria.reduce((n,c) => n+c.max_points,0);
const out = [`# ${s.title}`, '', `59·30번 통합 수정 초안 · 사례형 ${s.subquestions.length}물음 · ${s.subquestions.reduce((n,q)=>n+points(q),0)}점`, '', `ID: \`${s.id}\`. 원 5물음·12점에서 요구 서술을 줄이고 절차 선택형으로 재구성했다. 정본·운영 DB 반영은 지정 검토를 모아 진행한다.`, '', '## 사실관계', ''];
for (const f of s.shared_context.facts) out.push(...f.text.split('\n').flatMap(line => [line,'']));
for (const [i,q] of s.subquestions.entries()) out.push(`## 물음 ${i+1} (${points(q)}점)`, '', q.prompt, '');
out.push('---', '', '## 모범답안과 배점', '');
for (const [i,q] of s.subquestions.entries()) {
  out.push(`### 물음 ${i+1}`, '', ...q.model_answer.map(a => `- ${a}`), '', '**배점**', '');
  for (const c of q.criteria) out.push(`- ${c.max_points}점: ${c.claim}`);
  out.push('');
}
out.push('### 옳은 항목의 해설', '', '- ①: 직원 명부 대조·퇴직자 지급액 검토는 온유회사의 급여 감사와 관련된 보충통제다.', '- ③: 규정을 설계 이해의 자료로 사용하는 것은 적절하다. 이 항목은 실제 실행이나 운영효과성을 입증했다고 하지 않는다.', '- ⑦: 서비스조직의 승인을 받아 서비스감사인과 테스트 범위·결과를 논의할 수 있다. 보고서 발행 후라는 이유로 금지되지 않는다.', '', '## 검증 결과', '');
const summaryPath = `${R}/summary-v1.json`;
if (fs.existsSync(summaryPath)) {
  const summary = read(summaryPath);
  out.push('| 답안 | 물음 1 기대/실제 | 물음 2 기대/실제 |', '| --- | ---: | ---: |');
  for (const kind of ['model','partial','wrong']) {
    const rows = summary.grading.rows.filter(row => row.kind === kind);
    const cell = id => { const r=rows.find(row => row.subquestion_id===id); return `${r.expected}/${r.actual}`; };
    out.push(`| ${{model:'저장 모범답안',partial:'대표 부분정답',wrong:'대표 오답'}[kind]} | ${cell('sub1')} | ${cell('sub2')} |`);
  }
  const supp = read(`${R}/supplementary-v1/summary.json`);
  for (const row of supp.rows) {
    const cell = id => { const r=row.subquestions.find(q=>q.subquestion_id===id); return `${r.expected_points}/${r.actual_points}`; };
    out.push(`| 보조: 내용으로 특정한 이유 / 간략한 보완절차 | ${cell('sub1')} | ${cell('sub2')} |`);
  }
  out.push('', '작성 agent가 모든 물음·정답·배점·직접 출처를 대조했고, 실제 Luna 대표 채점과 보조 채점을 수행했다. 보조 답안은 대표 검증 분모와 별도로 기록한다. 사람의 직접 내용 확인·정본 수록·운영 반영은 이 검증과 구별한다.', '');
} else out.push('현재 실제 채점 결과 작성 전이다.', '');
out.push('검토 근거: KGA 402 문단 17·18·A32~A34·A38·A40. 대상 연도 2027년의 기존 판본 적용 가정과 원문 대조 범위는 [설계](design.json), 원 기준과의 대응은 [계보](lineage.json), 답안 원문과 기대값은 [QA](qa.json), 실제 원응답은 [검증 장부](../../../analysis/reviews/case-review-2026-09-15/README.md)에 있다.', '');
fs.writeFileSync(`${D}/questions-and-answers.md`,out.join('\n'));
console.log('Wrote question sheet.');
