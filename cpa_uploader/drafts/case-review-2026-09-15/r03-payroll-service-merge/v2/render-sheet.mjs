// r03 v2의 사람용 문제지를 만든다(v1 문제지와 같은 구성).
//   node cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge/v2/render-sheet.mjs
import fs from 'node:fs';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge/v2';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r03';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const [s] = read(`${D}/sets.json`);
const design = read(`${D}/design.json`);
const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const out = [`# ${s.title}`, '', `59·30번 통합 수정 초안 v2 · 사례형 ${s.subquestions.length}물음 · ${s.subquestions.reduce((n, q) => n + points(q), 0)}점`, '',
  `ID: \`${s.id}\`. 사용자 검토 요청(사실관계가 너무 복잡)에 따라 v1의 쟁점·출처·배점을 유지하고 사실관계를 줄였다. 정본·운영 DB 반영은 지정 검토를 모아 진행한다.`, '',
  '## v1에서 바꾼 점', '', ...design.changes_v2.map((c) => `- ${c}`), '', '## 사실관계', ''];
for (const f of s.shared_context.facts) out.push(...f.text.split('\n').flatMap((line) => [line, '']));
for (const [i, q] of s.subquestions.entries()) out.push(`## 물음 ${i + 1} (${points(q)}점)`, '', q.prompt, '');
out.push('---', '', '## 모범답안과 배점', '');
for (const [i, q] of s.subquestions.entries()) {
  out.push(`### 물음 ${i + 1}`, '', ...q.model_answer.map((a) => `- ${a}`), '', '**배점**', '');
  for (const c of q.criteria) out.push(`- ${c.max_points}점: ${c.claim}`);
  out.push('');
}
out.push('### 옳은 항목의 해설', '', ...design.items.filter((it) => it.verdict.startsWith('옳음')).map((it) => `- ${it.no}: ${it.basis}`), '', '## 검증 결과', '');
const summary = read(`${R}/summary-v2.json`);
out.push('| 답안 | 물음 1 기대/실제 | 물음 2 기대/실제 |', '| --- | ---: | ---: |');
for (const kind of ['model', 'partial', 'wrong']) {
  const rows = summary.grading.rows.filter((row) => row.kind === kind);
  const cell = (id) => { const r = rows.find((row) => row.subquestion_id === id); return `${r.expected}/${r.actual}`; };
  out.push(`| ${{ model: '저장 모범답안', partial: '대표 부분정답(물음 1 번호만, 물음 2 함정 ⑦ 선택·⑥ 누락)', wrong: '대표 오답(옳은 항목만 선택)' }[kind]} | ${cell('sub1')} | ${cell('sub2')} |`);
}
const supp = read(`${R}/supplementary-v2/summary.json`);
for (const row of supp.rows) {
  const cell = (id) => { const r = row.subquestions.find((q) => q.subquestion_id === id); return `${r.expected_points}/${r.actual_points}`; };
  out.push(`| 보조: 번호 없이 내용으로 특정한 이유 / 간략한 보완절차 | ${cell('sub1')} | ${cell('sub2')} |`);
}
out.push('', 'v2 수정·검토 agent가 물음·정답·배점·직접 출처를 대조했고, 실제 Luna 대표 채점과 보조 채점을 수행했다. 보조 답안은 대표 검증 분모와 별도로 기록한다. 사람의 직접 내용 확인·정본 수록·운영 반영은 이 검증과 구별한다.', '',
  '검토 근거: KGA 402 문단 17·18·A32~A34·A36~A38·A40. 수정 이유와 변경 내역은 [설계](design.json), v1과의 대응은 [계보](lineage.json), 답안 원문과 기대값은 [QA](qa.json), 실제 원응답은 [검증 장부](../../../../analysis/reviews/case-review-2026-09-15/README.md)에 있다.', '');
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('Wrote question sheet v2.');
