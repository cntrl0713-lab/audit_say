// sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r15-inventory-count-merge/v2';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r15';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const suppInput = JSON.parse(fs.readFileSync(`${R}/supplementary-input-v1.json`, 'utf8'));
const supp = JSON.parse(fs.readFileSync(`${R}/supplementary-v1/summary.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v2/actual-a/${set.id}--case--${kind}/observation.json`, 'utf8'));

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
    out.push(`**자료 ${index + 1}**`, '');
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
    partial: '대표 부분정답(물음 1은 함정 ⑤ 선택과 ④ 누락, 물음 2는 옳은 항목 ⑨ 선택과 ⑧ 누락)',
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
    const purpose = suppInput.supplementary_cases.find((c) => c.id === row.id).purpose.replace(/\.$/, '');
    out.push(`| 보조: ${purpose} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    'v2 최종 내용에 대한 대표 답안 여섯 개의 점수와 판정이 모두 기대와 일치했고(상태 차이 0건), 보조 세 답안은 v1 발문으로 측정했으며 판정까지 일치했다(항목·답안·criterion·배점은 v2와 같다). 대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 보조 답안은 [보조 입력](../../../../analysis/reviews/case-review-2026-09-15/r15/supplementary-input-v1.json), 원응답·사용량은 [검증 장부](../../../../analysis/reviews/case-review-2026-09-15/r15/summary-v2.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
