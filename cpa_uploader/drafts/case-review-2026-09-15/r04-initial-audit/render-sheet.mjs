// sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit/render-sheet.mjs
import fs from 'node:fs';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r04-initial-audit';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r04';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const qa = JSON.parse(fs.readFileSync(`${D}/qa.json`, 'utf8'));
// execution-v1/actual-a는 API 키 없이 끝난 시도(호출 0회)의 preflight만 있으므로 actual-a2의 관측을 읽는다.
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/actual-a2/${set.id}--case--${kind}/observation.json`, 'utf8'));
const supp = JSON.parse(fs.readFileSync(`${R}/supplementary-v1/summary.json`, 'utf8'));
const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const ids = set.subquestions.map((q) => q.id);
const out = [`# ${set.title}`, '', `재구성 초안 \`${set.id}\` · 사례형 ${set.subquestions.length}물음 · ${set.subquestions.reduce((n, q) => n + points(q), 0)}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다.`, ''];
set.shared_context.facts.forEach((fact, i) => out.push(`**자료 ${i + 1}**`, '', ...fact.text.split('\n').flatMap((line) => [line, ''])));
set.subquestions.forEach((q, i) => {
  out.push(`## 물음 ${i + 1} (${points(q)}점)`, '', q.prompt, '', '**모범답안**', '', ...q.model_answer.map((a) => `- ${a}`), '', '**부분점수 기준**', '');
  for (const c of q.criteria) out.push(`- ${c.max_points}점 (\`${c.id}\`): ${c.claim}`);
  out.push('');
});
const labels = { model: '저장 모범답안', partial: '대표 부분정답(물음 1 함정 ④, 물음 2 두 주장만, 물음 3 ⑨ 누락, 물음 4 함정 ⑩)', wrong: '대표 오답(물음 1·3·4는 옳은 항목만 고르고 옳지 않은 항목을 적절하다고 명시, 물음 2는 개시일 잔액의 증거 제공을 부정)' };
out.push('## 실제 Luna 채점', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
  const o = obs(kind); const s = (id) => o.subquestions.find((q) => q.subquestion_id === id);
  out.push(`| ${labels[kind]} | ${ids.map((id) => `${s(id).expected_points} / ${s(id).actual_points}`).join(' | ')} |`);
}
for (const row of supp.rows) {
  const s = (id) => row.subquestions.find((q) => q.subquestion_id === id);
  out.push(`| 보조: ${qa.supplementary_cases.find((c) => c.id === row.id).purpose.replace(/\.$/, '')} | ${ids.map((id) => `${s(id).expected_points} / ${s(id).actual_points}`).join(' | ')} |`);
}
out.push('', '대표 답안 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [검증 장부](../../../analysis/reviews/case-review-2026-09-15/README.md)에 있다.', '');
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
