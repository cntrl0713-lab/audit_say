// sets.json·standards-sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r21-accounting-estimate-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r21';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const [std] = JSON.parse(fs.readFileSync(`${D}/standards-sets.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/actual-a/${set.id}--case--${kind}/observation.json`, 'utf8'));
const stdObs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-standards-v1/actual-a/${std.id}--sub2--standard--${kind}/observation.json`, 'utf8'));

const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const ids = set.subquestions.map((q) => q.id);
const total = set.subquestions.reduce((n, q) => n + points(q), 0);
const stdTotal = std.subquestions.reduce((n, q) => n + points(q), 0);

const out = [
    `# ${set.title}`,
    '',
    `병합 초안 \`${set.id}\` · 사례형 ${set.subquestions.length}물음 · ${total}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다.`,
    '',
    `같은 회차에서 분리 보존한 기준서형 세트 \`${std.id}\`(1물음 ${stdTotal}점)는 이 문서 아래쪽에 있다.`,
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
    partial: '대표 부분정답(식별은 완전하고 물음마다 한 항목의 이유·절차만 인정 수준에 못 미침)',
    wrong: '대표 오답(함정과 옳은 항목만 옳지 않다고 고름)',
};
out.push('## 실제 Luna 채점 (사례형)', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = obs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${labels[kind]} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 아홉 개의 점수가 모두 기대와 정확히 일치했다(delta 0). 오답에서 식별 기준 `crit1`·`crit5`·`crit8`과 `crit3`의 판정이 기대 `not_met`·실제 `contradicted`로 달랐으나 넷 다 0점인 상태 차이여서 재채점하지 않았다. 대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r21/execution-v1/actual-a/summary.json)와 [요약](../../../analysis/reviews/case-review-2026-09-15/r21/summary-v1.json)에 있다.',
    '',
    '---',
    '',
    `# ${std.title} (기준서형 분리 보존)`,
    '',
    `\`${std.id}\` · 기준서형 1물음 · ${stdTotal}점. 사실관계 없이 독립 발문만으로 푼다. 원 \`pilot-11-005\`의 물음 \`sub2\`를 승계했고 발문만 정답 암시 금지 기준으로 고쳤다.`,
    '',
);
std.subquestions.forEach((question) => {
    out.push(`## 독립 발문 (${points(question)}점)`, '', question.prompt, '', '**모범답안**', '');
    question.model_answer.forEach((answer) => out.push(`- ${answer}`));
    out.push('', '**부분점수 기준**', '');
    question.criteria.forEach((criterion) => out.push(`- ${criterion.max_points}점 (\`${criterion.id}\`): ${criterion.claim}`));
    out.push('');
});
out.push('## 실제 Luna 채점 (기준서형)', '', '| 답안 | 기대/실제 |', '| --- | ---: |');
const stdLabels = {
    model: '저장 모범답안(사례 지문 없이 독립 발문만 제시)',
    partial: '대표 부분정답(문단 27(a)의 두 요구와 (c) 전단만 씀)',
    wrong: '대표 오답(다른 기준서의 절차만 씀)',
};
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = stdObs(kind);
    const at = observation.subquestions.find((q) => q.subquestion_id === 'sub2');
    out.push(`| ${stdLabels[kind]} | ${at.expected_points} / ${at.actual_points} |`);
}
out.push(
    '',
    '모범답안과 오답의 점수는 기대와 정확히 일치했다. 모범답안 요청의 투영에는 사실관계가 비어 있으므로 사례를 보지 않은 답안으로 만점(5점)이 성립함을 실측으로 확인했다. 부분정답은 기대 3점에 실제 2점으로 1점 낮았다(허용 ±1점 안). `crit2`("경영진의 대응이 추정불확실성을 적절하게 이해하고 다루는지 문단 26에 따라 평가한다")에 대하여 답안이 문단 27(a)의 문언 그대로 "경영진의 대응을 문단 26에 따라 평가한다"만 썼는데, 채점 모델이 평가 대상(추정불확실성을 적절하게 이해하고 다루는지)을 쓰지 않았다고 보아 `not_met`으로 판정했다. 이 criterion 명제는 원 `pilot-11-005`에서 바이트 그대로 승계한 것이며 허용 범위 안의 편차이므로 재채점하지 않았고, 명제의 한정어가 문단 27(a) 문언보다 엄격한지는 사람 확인 사항으로 남긴다. 대표 답안의 원문과 기대 판정은 [qa-standards.json](qa-standards.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r21/execution-standards-v1/actual-a/summary.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
