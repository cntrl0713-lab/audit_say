// sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r23-icfr-deficiency-merge/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r23-icfr-deficiency-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r23';
const ACTUAL = 'actual-a';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const suppInput = JSON.parse(fs.readFileSync(`${R}/supplementary-input-v1.json`, 'utf8'));
const supp = JSON.parse(fs.readFileSync(`${R}/supplementary-v1/summary.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/${ACTUAL}/${set.id}--case--${kind}/observation.json`, 'utf8'));

const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const ids = set.subquestions.map((q) => q.id);
const total = set.subquestions.reduce((n, q) => n + points(q), 0);

const out = [
    `# ${set.title}`,
    '',
    `병합 초안 \`${set.id}\` · 사례형 ${set.subquestions.length}물음 · ${total}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다.`,
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
    partial: '대표 부분정답(물음 1은 ④를 빠뜨리고, 물음 2는 ⑥·⑦의 이유를, 물음 3은 ⑪의 이유를 빠뜨림)',
    wrong: '대표 오답(함정과 옳은 항목만 고르고 옳지 않은 항목은 모두 옳다고 적음)',
};
out.push('## 실제 Luna 채점', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = obs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${labels[kind]} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
for (const row of supp.rows) {
    const at = (id) => row.subquestions.find((q) => q.subquestion_id === id);
    const purpose = suppInput.supplementary_cases.find((c) => c.id === row.id).purpose.replace(/\.$/, '');
    out.push(`| 보조: ${purpose} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    `대표 답안 아홉 개의 점수가 모두 기대와 정확히 일치했고(delta 0) criterion 판정도 모두 같았다. 보조 답안 아홉 개도 점수가 모두 일치했으며, 조건 경계 답의 \`crit11\`만 기대 \`not_met\`·실제 \`contradicted\`로 판정 상태가 달랐고 둘 다 0점이어서 재채점하지 않았다. 대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 보조 답안은 [보조 입력](../../../analysis/reviews/case-review-2026-09-15/r23/supplementary-input-v1.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r23/execution-v1/${ACTUAL}/summary.json)와 [요약](../../../analysis/reviews/case-review-2026-09-15/r23/summary-v1.json)에 있다.`,
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
