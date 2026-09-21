// sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r29-kam-exception-extension/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r29-kam-exception-extension';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r29';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const qa = JSON.parse(fs.readFileSync(`${D}/qa.json`, 'utf8'));
const suppV1 = JSON.parse(fs.readFileSync(`${R}/supplementary-v1/summary.json`, 'utf8'));
const suppV2 = JSON.parse(fs.readFileSync(`${R}/supplementary-v2-actual/summary.json`, 'utf8'));
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
    partial: '대표 부분정답(물음 1은 ④를 번호로만, 물음 2는 ⑧을 번호로만, 물음 3은 함정 ⑭를 옳지 않다고 고르고 ⑮는 놓침)',
    wrong: '대표 오답(함정만 옳지 않다고 고르고 실제 위반은 지적하지 못함)',
};
out.push('## 실제 Luna 채점', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = obs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${labels[kind]} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
for (const row of [...suppV1.rows, ...suppV2.rows]) {
    if (!row.subquestions) continue;
    const at = (id) => row.subquestions.find((q) => q.subquestion_id === id);
    const source = qa.supplementary_cases.find((c) => c.id === row.id);
    const purpose = (source ? source.purpose : row.id).split('.')[0];
    out.push(`| 보조: ${purpose} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 아홉 개 가운데 여덟 개의 점수가 기대와 정확히 일치했고, 물음 2의 부분정답 한 건이 기대 3점에 실제 4점으로 +1점이었다(허용 ±1점 안, 허용 범위 안 비율 9/9 = 100%). 그 한 건은 ⑧을 "감사위원회에 알리지 않은 것은 옳지 않다"로만 쓴 답을 채점 모델이 crit7의 절차(알렸어야 한다)를 함축한 것으로 보고 met으로 판정한 결과다. 같은 형태의 답이라도 물음 1의 ④("기술하기로 한 것은 옳지 않다")는 기대대로 not_met이었다. 허용 범위 안이므로 기대값을 바꾸거나 다시 채점하지 않았다.',
    '',
    '보조 실측은 승급 receipt 분모가 아니다. 번호만 쓴 답은 물음마다 식별 1점만 받았고, 인정 기준 경계 답(전기 핵심감사사항 반복이 허용된다는 반대 결론, "극히 드문 상황" 문구 없는 서술, 영업권이 핵심감사사항이어서 강조사항문단 대상이 아니라는 취지만 쓴 서술)도 기대와 정확히 일치했다. 절차만 쓴 답은 도구 입력 형식 오류로 점수가 기록되지 않았고 저장된 응답의 수동 판독 결과만 [보조 실측 기록](../../../analysis/reviews/case-review-2026-09-15/r29/supplementary-note-v1.json)에 남겼다.',
    '',
    '대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r29/execution-v1/actual-a/summary.json)와 [요약](../../../analysis/reviews/case-review-2026-09-15/r29/summary-v1.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
