// sets.json·standards-sets.json과 실제 채점 결과에서 사람이 읽는 문제지를 만든다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update/render-sheet.mjs
import fs from 'node:fs';

const D = 'cpa_uploader/drafts/case-review-2026-09-15/r37-small-entity-update';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r37';
const [caseSet] = JSON.parse(fs.readFileSync(`${D}/sets.json`, 'utf8'));
const [stdSet] = JSON.parse(fs.readFileSync(`${D}/standards-sets.json`, 'utf8'));

const points = (q) => q.criteria.reduce((n, c) => n + c.max_points, 0);
const total = (set) => set.subquestions.reduce((n, q) => n + points(q), 0);
const caseObs = (kind) => JSON.parse(fs.readFileSync(`${R}/execution-v1/actual-a/${caseSet.id}--case--${kind}/observation.json`, 'utf8'));
const stdObs = (unit, kind) => JSON.parse(fs.readFileSync(`${R}/execution-standards-v1/actual-a/${stdSet.id}--${unit}--standard--${kind}/observation.json`, 'utf8'));

const out = [
    '# 소규모기업 감사기준의 적용 검토 (수정 요청서 40번 갱신)',
    '',
    `원 세트 \`pilot-18-005\`(4물음 20점)을 사례형 \`${caseSet.id}\`(${caseSet.subquestions.length}물음 ${total(caseSet)}점)와 기준서형 \`${stdSet.id}\`(${stdSet.subquestions.length}물음 ${total(stdSet)}점)로 다시 썼다. 두 세트 모두 상태는 \`needs_review\`이며 정본·운영 DB에는 아직 반영하지 않았다.`,
    '',
    `## 사례형 \`${caseSet.id}\` — ${caseSet.title}`,
    '',
];
caseSet.shared_context.facts.forEach((fact, index) => {
    out.push(`**사실관계 ${index + 1}**`, '');
    fact.text.split('\n').forEach((line) => out.push(line, ''));
});
caseSet.subquestions.forEach((question, index) => {
    out.push(`### 물음 ${index + 1} (${points(question)}점)`, '', question.prompt, '', '**모범답안**', '');
    question.model_answer.forEach((answer) => out.push(`- ${answer}`));
    out.push('', '**부분점수 기준**', '');
    question.criteria.forEach((criterion) => out.push(`- ${criterion.max_points}점 (\`${criterion.id}\`): ${criterion.claim}`));
    out.push('');
});

const caseLabels = {
    model: '저장 모범답안',
    partial: '대표 부분정답(물음 1은 함정 ⑤를 옳지 않다고 고르고 ④를 빠뜨림, 물음 2는 ⑧을 빠뜨리고 적절하다고 명시)',
    wrong: '대표 오답(옳은 항목·함정만 고르고 옳지 않은 항목은 적절하다고 명시)',
};
const caseIds = caseSet.subquestions.map((q) => q.id);
out.push('### 실제 Luna 채점', '', `| 답안 | ${caseIds.map((_, i) => `물음 ${i + 1} 기대/실제`).join(' | ')} |`, `| --- | ${caseIds.map(() => '---:').join(' | ')} |`);
for (const kind of ['model', 'partial', 'wrong']) {
    const observation = caseObs(kind);
    const at = (id) => observation.subquestions.find((q) => q.subquestion_id === id);
    out.push(`| ${caseLabels[kind]} | ${caseIds.map((id) => `${at(id).expected_points} / ${at(id).actual_points}`).join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 여섯 개의 점수가 모두 기대와 정확히 일치했다(delta 0, 허용 범위 안 6/6 = 100%, 목표 95%). 오답 답안에서 식별 criterion `crit1`·`crit5`가 contradicted 대신 not_met으로 판정되었으나 두 판정 모두 0점이어서 점수 차이는 없다.',
    '',
    `## 기준서형 \`${stdSet.id}\` — ${stdSet.title}`,
    '',
    '사례 지문 없이 각 물음을 혼자 푼다(`facts=[]`). 학습 단위는 물음마다 하나씩이며 실측도 물음마다 따로 했다.',
    '',
);
stdSet.subquestions.forEach((question, index) => {
    out.push(`### 물음 ${index + 1} (${points(question)}점) · 학습 단위 \`${stdSet.id}--${question.id}--standard\``, '', question.prompt, '', '**모범답안**', '');
    question.model_answer.forEach((answer) => out.push(`- ${answer}`));
    out.push('', '**부분점수 기준**', '');
    question.criteria.forEach((criterion) => out.push(`- ${criterion.max_points}점 (\`${criterion.id}\`): ${criterion.claim}`));
    out.push('');
});

const stdLabels = {
    model: '저장 모범답안',
    partial: '대표 부분정답(물음 1은 두 범주 누락·시기 범위 확대, 물음 2는 금액 경계와 논리관계 오류)',
    wrong: '대표 오답',
};
out.push('### 실제 Luna 채점', '', '| 답안 | 물음 1 기대/실제 | 물음 2 기대/실제 |', '| --- | ---: | ---: |');
for (const kind of ['model', 'partial', 'wrong']) {
    const cells = ['sub1', 'sub2'].map((unit) => {
        const observation = stdObs(unit, kind);
        const row = observation.subquestions.find((q) => q.subquestion_id === unit);
        return `${row.expected_points} / ${row.actual_points}`;
    });
    out.push(`| ${stdLabels[kind]} | ${cells.join(' | ')} |`);
}
out.push(
    '',
    '대표 답안 여섯 개가 모두 허용 범위(±1점) 안이고 그 가운데 다섯 개가 정확히 일치했다(허용 범위 안 6/6 = 100%, 목표 95%). 물음 1의 부분정답 1건이 기대 4점·실제 3점이다. `crit6`의 승계된 채점 기준이 "지배회사에 해당하여 연결재무제표를 작성하는 회사"를 요구하는데 대표 답안이 문단 2(a)(vi) 본문 표현만 적어 not_met이 되었다. 문항 내용이 아니라 작성자 기대값 쪽 차이이며 허용 범위 안이므로 재채점하지 않았다.',
    '',
    '두 실행을 합하면 대표 12답안 전부가 허용 범위 안이고 11개가 정확히 일치했다. 실제 호출 9회, 약 $0.0157(제공자 사용량 × 고정 공개 단가 추정이며 청구액과 구별). 대표 답안의 원문과 기대 판정은 [qa.json](qa.json)·[qa-standards.json](qa-standards.json), 원응답·사용량은 [실행 폴더](../../../analysis/reviews/case-review-2026-09-15/r37/)와 [요약](../../../analysis/reviews/case-review-2026-09-15/r37/summary-v1.json)에 있다.',
    '',
);
fs.writeFileSync(`${D}/questions-and-answers.md`, out.join('\n'));
console.log('written', out.length, 'lines');
