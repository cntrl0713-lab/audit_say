// sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r32-documentation-extension/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r32-documentation-extension';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r32';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const qa = JSON.parse(fs.readFileSync(`${D}/qa.json`, 'utf8'));
const supp = JSON.parse(fs.readFileSync(`${R}/supplementary-v1/summary.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/actual-a/${set.id}--case--${kind}/observation.json`, 'utf8'));

const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const ids = set.subquestions.map((q) => q.id);
const total = set.subquestions.reduce((n, q) => n + points(q), 0);

const out = [
    `# ${set.title}`,
    '',
    `확장 초안 \`${set.id}\` · 사례형 ${set.subquestions.length}물음 · ${total}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다.`,
    '',
];
set.shared_context.facts.forEach((fact, index) => {
    out.push(`**사실관계 ${index + 1}**`, '');
    fact.text.split('\n').forEach((line) => out.push(line, ''));
});
set.subquestions.forEach((question, index) => {
    out.push(`## 물음 ${index + 1} (${points(question)}점)`, '', question.prompt, '', '**모범답안**', '');
    question.model_answer.forEach((answer) => out.push(`- ${answer}`));
    out.push('', '**부분점수 기준**', '');
    question.criteria.forEach((criterion) => out.push(`- ${criterion.max_points}점 (\`${criterion.id}\`): ${criterion.claim}`));
    out.push('');
});

const labels = {
    model: '저장 모범답안',
    partial: '대표 부분정답(물음 1은 함정 ③을 옳지 않다고 고르고 ②에 무관한 절차, 물음 2는 ⑤를 번호만·⑥에 ⑤와 같은 의미, 물음 3은 함정 ⑨를 옳지 않다고 고르고 ⑩은 번호만·⑫는 누락)',
    wrong: '대표 오답(옳은 항목만 고르고 옳지 않은 항목을 옳다고 명시)',
};
out.push('## 실제 Luna 채점', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = obs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${labels[kind]} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
for (const row of supp.rows) {
    const at = (id) => row.subquestions.find((q) => q.subquestion_id === id);
    const purpose = qa.supplementary_cases.find((c) => c.id === row.id).purpose.split('.')[0];
    out.push(`| 보조: ${purpose} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 아홉 개와 보조 답안 아홉 개의 점수가 모두 기대와 정확히 일치했다(delta 0). criterion 판정의 상태 차이는 세 건이며 모두 0점 상태끼리의 차이여서 점수에 영향이 없다(대표: 물음 1 `crit1`·물음 3 `crit8`이 contradicted → not_met, 보조 경계 답안: 물음 3 `crit12`가 not_met → contradicted). 대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r32/execution-v1/actual-a/summary.json)와 [보조 실행](../../../analysis/reviews/case-review-2026-09-15/r32/supplementary-v1/summary.json), [요약](../../../analysis/reviews/case-review-2026-09-15/r32/summary-v1.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
