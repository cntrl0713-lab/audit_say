// r38 초안의 학습자 화면 재현. 조립된 최종 문자열을 사람이 읽어 조사·나열 연결을 확인한다.
//   node cpa_uploader/drafts/case-review-2026-09-15/r38-interim-review-update/render-sheet.mjs
// 출력: 같은 폴더의 questions-and-answers.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(here, name), 'utf8'));
const [caseSet] = read('sets.json');
const [standardsSet] = read('standards-sets.json');
const qa = read('qa.json');
const qaStandards = read('qa-standards.json');

const lines = [];
const push = (...values) => lines.push(...values);

push('# r38 초안 물음과 답안 (검토용 재현)', '');
push('이 문서는 `sets.json`과 `standards-sets.json`에서 조립한 최종 문자열을 사람이 읽기 위한 재현이다. 내용을 고칠 때는 `build-draft.mjs`를 고치고 이 파일을 다시 만든다.', '');

push(`## 1. 사례형 \`${caseSet.id}\``, '');
push(`제목: ${caseSet.title}`, '');
push(`물음 ${caseSet.subquestions.length}개 · criterion ${caseSet.subquestions.reduce((n, q) => n + q.criteria.length, 0)}개 · ${caseSet.subquestions.reduce((n, q) => n + q.criteria.reduce((m, c) => m + c.max_points, 0), 0)}점`, '');

push('### 사실관계', '');
for (const fact of caseSet.shared_context.facts) {
    push(`**${fact.id}**`, '');
    push(...fact.text.split('\n'), '');
}

for (const question of caseSet.subquestions) {
    const points = question.criteria.reduce((n, c) => n + c.max_points, 0);
    push(`### 물음 ${question.id} (${points}점 · ${question.type} · ${question.question_style} · 주제 ${question.topic_ids.join('·')})`, '');
    push(question.prompt, '');
    push('**모범답안**', '');
    for (const answer of question.model_answer) push(`- ${answer}`);
    push('');
    push('**채점 기준**', '');
    for (const criterion of question.criteria) push(`- \`${criterion.id}\` (${criterion.max_points}점, ${criterion.requirement_id}) ${criterion.claim}`);
    push('');
    push('**대표 사례**', '');
    for (const row of qa.cases.filter((c) => c.subquestion_id === question.id)) {
        push(`- \`${row.id}\` (${row.kind}, 기대 ${row.expected_points}점) ${row.answer.replace(/\n/g, ' / ')}`);
    }
    push('');
}

push('### 인용', '');
for (const source of caseSet.source_refs) {
    push(`- \`${source.id}\` ${source.page} — ${source.source_quote.replace(/\r?\n/g, ' ').slice(0, 120)}…`);
}
push('');

push(`## 2. 기준서형 \`${standardsSet.id}\``, '');
push(`제목: ${standardsSet.title}`, '');
push(`물음 ${standardsSet.subquestions.length}개 · ${standardsSet.subquestions.reduce((n, q) => n + q.criteria.reduce((m, c) => m + c.max_points, 0), 0)}점 · 사실관계 없음(facts=[])`, '');
for (const question of standardsSet.subquestions) {
    const points = question.criteria.reduce((n, c) => n + c.max_points, 0);
    push(`### 물음 ${question.id} (${points}점 · ${question.type} · ${question.question_style} · 주제 ${question.topic_ids.join('·')})`, '');
    push(question.prompt, '');
    push('**모범답안**', '');
    for (const answer of question.model_answer) push(`- ${answer}`);
    push('');
    push('**채점 기준**', '');
    for (const criterion of question.criteria) push(`- \`${criterion.id}\` (${criterion.max_points}점, ${criterion.requirement_id}) ${criterion.claim}`);
    push('');
    push('**대표 사례**', '');
    for (const row of qaStandards.cases.filter((c) => c.subquestion_id === question.id)) {
        push(`- \`${row.id}\` (${row.kind}, 기대 ${row.expected_points}점) ${row.answer.replace(/\n/g, ' / ')}`);
    }
    push('');
}
push('### 인용', '');
for (const source of standardsSet.source_refs) {
    push(`- \`${source.id}\` ${source.page} — ${source.source_quote.replace(/\r?\n/g, ' ').slice(0, 120)}…`);
}
push('');

fs.writeFileSync(path.join(here, 'questions-and-answers.md'), `${lines.join('\n')}\n`, 'utf8');
console.log('questions-and-answers.md 작성:', lines.length, '줄');
