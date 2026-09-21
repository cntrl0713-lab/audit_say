// sets.json·standards-sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r31-comparative-restatement-extension';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r31';
const [set] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const [std] = JSON.parse(fs.readFileSync(`${D}/standards-sets.json`, 'utf8'));
const obs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/actual-a/${set.id}--case--${kind}/observation.json`, 'utf8'));
const stdObs = (subId, kind) => JSON.parse(fs.readFileSync(`${R}/execution-standards-v1/actual-a/${std.id}--${subId}--standard--${kind}/observation.json`, 'utf8'));

const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const ids = set.subquestions.map((q) => q.id);
const total = set.subquestions.reduce((n, q) => n + points(q), 0);
const stdTotal = std.subquestions.reduce((n, q) => n + points(q), 0);

const out = [
    `# ${set.title}`,
    '',
    `확장 초안 \`${set.id}\` · 사례형 ${set.subquestions.length}물음 · ${total}점. 상태는 \`${set.status}\`이며 정본·운영 DB에는 아직 반영하지 않았다.`,
    '',
    '대상 갱신본 `case-16-comparative-restatement-20260919`(2물음 7점)의 항목 ①~⑨와 채점 기준을 그대로 보존하고, 비교정보에 대한 감사절차와 서면진술 범위를 묻는 물음 3(⑩~⑫, 2점)을 더했다. KGA 710의 대응수치 방식과 비교재무제표 방식을 섞지 않도록 이 사례는 외부감사법 감사의 비교재무제표 방식 하나로 고정했다.',
    '',
    `같은 회차에서 분리 보존한 기준서형 세트 \`${std.id}\`(${std.subquestions.length}물음 ${stdTotal}점)는 이 문서 아래쪽에 있다.`,
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
    partial: '대표 부분정답(물음마다 옳지 않은 항목을 하나씩 덜 골랐거나 이유가 불인정 조건에 걸림)',
    wrong: '대표 오답(옳은 항목만 옳지 않다고 고름)',
};
out.push('## 실제 Luna 채점 (사례형)', '', `| 답안 | ${ids.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${ids.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = obs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${labels[kind]} | ${ids.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 아홉 개의 점수가 모두 기대와 정확히 일치했다(delta 0). 부분정답 물음 3의 `crit9`와 오답의 식별 기준 `crit1`·`crit5`·`crit8`은 판정이 기대 `not_met`·실제 `contradicted`로 달랐으나 넷 다 0점인 상태 차이여서 재채점하지 않았다. 대표 답안의 원문과 기대 판정은 [qa.json](qa.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r31/execution-v1/actual-a/summary.json)와 [요약](../../../analysis/reviews/case-review-2026-09-15/r31/summary-v1.json)에 있다.',
    '',
    '---',
    '',
    `# ${std.title} (기준서형 분리 보존)`,
    '',
    `\`${std.id}\` · 기준서형 ${std.subquestions.length}물음 · ${stdTotal}점. 사실관계 없이 각 발문만으로 푼다. 원 \`pilot-16-008\`의 기준서형 물음 \`sub2\`·\`sub3\`을 승계했고 발문만 정답 암시 금지와 발문 바이트 중복 기준으로 고쳤다. 이 세트는 대응수치 방식만 다룬다.`,
    '',
);
std.subquestions.forEach((question, index) => {
    out.push(`## 독립 발문 ${index + 1} — \`${question.id}\` (${points(question)}점)`, '', question.prompt, '', '**모범답안**', '');
    question.model_answer.forEach((answer) => out.push(`- ${answer}`));
    out.push('', '**부분점수 기준**', '');
    question.criteria.forEach((criterion) => out.push(`- ${criterion.max_points}점 (\`${criterion.id}\`): ${criterion.claim}`));
    out.push('');
});
out.push('## 실제 Luna 채점 (기준서형)', '', `| 답안 | ${std.subquestions.map((q) => `${q.id} 기대/실제`).join(' | ')} |`, `| --- | ${std.subquestions.map(() => '---:').join(' | ')} |`);
const stdLabels = {
    model: '저장 모범답안(사례 지문 없이 독립 발문만 제시)',
    partial: '대표 부분정답(허용 대안 하나만·기재 사항 절반만 씀)',
    wrong: '대표 오답(다른 문단의 처리를 적용함)',
};
for (const kind of ['model', 'partial', 'wrong']) {
    const cells = std.subquestions.map((q) => {
        const at = stdObs(q.id, kind).subquestions.find((row) => row.subquestion_id === q.id);
        return `${at.expected_points} / ${at.actual_points}`;
    });
    out.push(`| ${stdLabels[kind]} | ${cells.join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 여섯 개의 점수가 모두 기대와 정확히 일치했다(delta 0). 모범답안 요청의 투영에는 사실관계가 비어 있으므로 사례를 보지 않은 답안으로 각각 만점(2점·4점)이 성립함을 실측으로 확인했다. 오답에서 `crit1`·`crit2`·`crit6`의 판정이 기대 `not_met`·실제 `contradicted`로 달랐으나 모두 0점인 상태 차이여서 재채점하지 않았다. 기준서형은 물음마다 학습 단위가 따로 생겨 한 요청이 한 물음만 담으므로 2물음 × 3역할 = 6요청을 실측했다. 대표 답안의 원문과 기대 판정은 [qa-standards.json](qa-standards.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r31/execution-standards-v1/actual-a/summary.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
