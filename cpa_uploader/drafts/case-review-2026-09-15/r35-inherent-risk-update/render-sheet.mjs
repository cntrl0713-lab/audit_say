// sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r35-inherent-risk-update/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r35-inherent-risk-update';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r35';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/actual-a/${set.id}--case--${kind}/observation.json`, 'utf8'));

const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const ids = set.subquestions.map((q) => q.id);
const total = set.subquestions.reduce((n, q) => n + points(q), 0);

const out = [
    `# ${set.title}`,
    '',
    `갱신 초안 \`${set.id}\` · 사례형 ${set.subquestions.length}물음 · ${total}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다. 원 세트는 \`pilot-06-008\`(2물음 7점)이다.`,
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
    partial: '대표 부분정답(물음 1은 함정 ④를 옳지 않다고 고르고 ⑤를 빠뜨림, 물음 2는 ⑦을 빠뜨림, 물음 3은 번호는 맞히고 ⑫의 이유를 쓰지 않음)',
    wrong: '대표 오답(함정만 옳지 않다고 고르고 옳지 않은 항목은 감사기준에 부합한다고 명시)',
};
out.push('## 실제 Luna 채점', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = obs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${labels[kind]} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 아홉 개가 모두 허용 범위 안이며(허용 범위 안 9/9 = 100%, 목표 95%) 그 가운데 여덟 개는 점수가 기대와 정확히 일치했다. 나머지 하나는 대표 부분정답의 물음 3으로 기대 2점·실제 3점이다(+1점, 허용 ±1점 안). 모델은 ⑫에 대하여 "감사계획 단계의 평가를 그대로 유지한 것은 절차상 문제가 있다"만 적은 답을 재고 필요성을 제시한 것으로 보아 `crit11`을 met으로 판정했고, 작성자는 발문의 판단을 되풀이한 것으로 보아 not_met으로 기대했다. 문항 내용의 결함이 아니라 대표 부분정답의 경계 설계 문제이므로 원문·정답·배점 기준을 고치지 않았고, 허용한 편차를 없애기 위한 반복 호출도 하지 않았다. 대표 부분정답의 물음 1에서는 `crit1`이 기대 contradicted·실제 not_met으로 판정되었으나 두 판정 모두 0점이라 점수 차이가 없다(0점끼리의 판정 상태 차이는 재채점하지 않는다). 보조 요청은 추가하지 않았다. 대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r35/execution-v1/actual-a/summary.json)와 [요약](../../../analysis/reviews/case-review-2026-09-15/r35/summary-v1.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
