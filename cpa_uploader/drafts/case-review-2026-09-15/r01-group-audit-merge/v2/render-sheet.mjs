// v2 sets.json과 execution-v2 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v2/render-sheet.mjs
import fs from 'node:fs';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r01-group-audit-merge/v2';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r01';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v2/actual-a/${set.id}--case--${kind}/observation.json`, 'utf8'));
const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const out = [`# ${set.title}`, '', `병합 초안 \`${set.id}\` v2 · 사례형 ${set.subquestions.length}물음 · ${set.subquestions.reduce((n, q) => n + points(q), 0)}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다.`, '',
  'v1 대비: 절차 ⑤의 책임 귀속 근거 문장을 뺐고, 자료 4를 매출(⑥·⑦)과 소송충당부채(⑧·⑨)별로 옳은 절차와 옳지 않은 절차를 하나씩 둔 구성으로 바꾸었다. 자료 1 끝에 한도기준 전달 사실을 더했다.', ''];
set.shared_context.facts.forEach((fact, i) => out.push(`**자료 ${i + 1}**`, '', ...fact.text.split('\n').flatMap((line) => [line, ''])));
set.subquestions.forEach((q, i) => {
  out.push(`## 물음 ${i + 1} (${points(q)}점)`, '', q.prompt, '', '**모범답안**', '', ...q.model_answer.map((a) => `- ${a}`), '', '**부분점수 기준**', '');
  for (const c of q.criteria) out.push(`- ${c.max_points}점 (\`${c.id}\`): ${c.claim}`);
  out.push('');
});
out.push('## 실제 Luna 채점', '', '| 답안 | 물음 1 기대/실제 | 물음 2 기대/실제 |', '| --- | ---: | ---: |');
for (const kind of ['model', 'partial', 'wrong']) {
  const o = obs(kind); const s = (id) => o.subquestions.find((q) => q.subquestion_id === id);
  out.push(`| ${{ model: '저장 모범답안', partial: '대표 부분정답(함정 ③·⑨ 선택 포함)', wrong: '대표 오답(함정만 선택)' }[kind]} | ${s('sub1').expected_points} / ${s('sub1').actual_points} | ${s('sub2').expected_points} / ${s('sub2').actual_points} |`);
}
out.push('', '대표 답안 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [검증 장부](../../../../analysis/reviews/case-review-2026-09-15/README.md)에 있다.', '');
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
