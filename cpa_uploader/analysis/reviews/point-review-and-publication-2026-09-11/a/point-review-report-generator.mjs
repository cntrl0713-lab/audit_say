import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.dirname(here);
const repo = path.resolve(base, '../../../..');
const file = relative => path.join(base, relative);
const read = relative => JSON.parse(fs.readFileSync(file(relative), 'utf8'));
const hash = relative => createHash('sha256').update(fs.readFileSync(file(relative))).digest('hex');
const slash = value => value.replaceAll('\\', '/');
const esc = value => String(value ?? '').replaceAll('|', '\\|').replace(/\s+/gu, ' ').trim();
const points = question => question.criteria.reduce((sum, criterion) => sum + criterion.max_points, 0);
const link = (label, relative, line = null) => `[${esc(label)}](${slash(file(relative))}${line ? ':' + line : ''})`;
const auditFiles = ['a', 'b', 'c'].map(owner => ({ owner, relative: owner + '/audit.json', data: read(owner + '/audit.json'), text: fs.readFileSync(file(owner + '/audit.json'), 'utf8') }));
const auditMap = new Map();
for (const owner of auditFiles) {
  const start = owner.text.indexOf('"entries"');
  for (const entry of owner.data.entries) {
    const needle = new RegExp(`"set_id"\\s*:\\s*"${entry.set_id}"\\s*,\\s*"subquestion_id"\\s*:\\s*"${entry.subquestion_id}"`, 'u');
    const found = needle.exec(owner.text.slice(start));
    if (!found) throw new Error('Audit line not found: ' + entry.set_id + '/' + entry.subquestion_id);
    const key = entry.set_id + '/' + entry.subquestion_id;
    if (auditMap.has(key)) throw new Error('Duplicate audit: ' + key);
    auditMap.set(key, { ...entry, audit_file: owner.relative, audit_line: owner.text.slice(0, start + found.index).split(/\r?\n/u).length });
  }
}
const diff = read('prepared-reviewed-v1/point-diff.json');
const summary = read('prepared-reviewed-v3/summary.json');
const lineage = read('root/lineage.json');
const candidate = read('prepared-reviewed-v3/candidate-authoring.json');
const candidateFile = 'prepared-reviewed-v3/candidate-authoring.json';
const candidateText = fs.readFileSync(file(candidateFile), 'utf8');
const candidateById = new Map(candidate.map(set => [set.id, set]));
const oldIds = new Set(diff.map(entry => entry.set_id));
const lineFor = (setId, questionId = null) => {
  const setAt = candidateText.indexOf('"id": "' + setId + '"');
  const at = questionId ? candidateText.indexOf('"id": "' + questionId + '"', setAt) : setAt;
  if (setAt < 0 || at < 0) throw new Error('Candidate location missing');
  return candidateText.slice(0, at).split(/\r?\n/u).length;
};
const calculated = {
  old_sets: oldIds.size,
  old_questions: diff.length,
  old_points: diff.reduce((sum, entry) => sum + entry.old_points, 0),
  candidate_old_questions: candidate.filter(set => oldIds.has(set.id)).reduce((sum, set) => sum + set.subquestions.length, 0),
  candidate_old_points: candidate.filter(set => oldIds.has(set.id)).flatMap(set => set.subquestions).reduce((sum, question) => sum + points(question), 0),
  new_sets: candidate.filter(set => !oldIds.has(set.id)).length,
  new_questions: candidate.filter(set => !oldIds.has(set.id)).reduce((sum, set) => sum + set.subquestions.length, 0),
  new_points: candidate.filter(set => !oldIds.has(set.id)).flatMap(set => set.subquestions).reduce((sum, question) => sum + points(question), 0),
  combined_sets: candidate.length,
  combined_questions: candidate.reduce((sum, set) => sum + set.subquestions.length, 0),
  combined_points: candidate.flatMap(set => set.subquestions).reduce((sum, question) => sum + points(question), 0),
};
const expected = { old_sets: 104, old_questions: 212, old_points: 574, candidate_old_questions: 218, candidate_old_points: 772, new_sets: 49, new_questions: 132, new_points: 521, combined_sets: 153, combined_questions: 350, combined_points: 1293 };
for (const [key, expectedValue] of Object.entries(expected)) if (calculated[key] !== expectedValue) throw new Error(`Count changed; review report assumptions: ${key} ${calculated[key]} != ${expectedValue}`);
if (summary.combined.points !== calculated.combined_points || summary.canonical.candidate_points !== calculated.candidate_old_points || summary.canonical.candidate_questions !== calculated.candidate_old_questions) throw new Error('Summary/candidate mismatch');
if (auditMap.size !== diff.length || new Set(diff.map(entry => entry.set_id + '/' + entry.subquestion_id)).size !== diff.length) throw new Error('212 source question coverage mismatch');

const topicIndexText = fs.readFileSync(path.join(repo, 'docs/plans/question-authoring-by-topic-2026-09-11/README.md'), 'utf8');
const topicIndex = [...topicIndexText.matchAll(/^\| \d+\. \[(\d{2}) ([^\]]+)\]\(topics\/topic-\d{2}\.md\)/gmu)].map(match => ({ id: match[1], title: match[2] }));
if (topicIndex.length !== 19) throw new Error('OX topic index unavailable');
const order = topicIndex.map(topic => topic.id);
const topicNames = Object.fromEntries(topicIndex.map(topic => [topic.id, topic.title]));
const decisions = { 유지: 0, 수정: 0, 분리: 0 };
const rows = diff.map(entry => {
  const key = entry.set_id + '/' + entry.subquestion_id;
  const audit = auditMap.get(key);
  if (!audit) throw new Error('Missing audit: ' + key);
  const afterIds = entry.after_subquestions.map(question => question.id);
  const after = afterIds.map(id => candidateById.get(entry.set_id)?.subquestions.find(question => question.id === id));
  if (after.some(question => !question)) throw new Error('Missing current question for ' + key);
  const total = after.reduce((sum, question) => sum + points(question), 0);
  if (total !== entry.new_points) throw new Error('Diff/current points mismatch: ' + key);
  const split = lineage.entries.find(item => item.set_id === entry.set_id && item.source_subquestion_id === entry.subquestion_id);
  if (Boolean(split) !== Boolean(entry.split)) throw new Error('Lineage mismatch: ' + key);
  const decision = entry.split ? '분리' : entry.changed ? '수정' : '유지';
  decisions[decision]++;
  const reason = split ? split.reason : audit.reason;
  const shortReason = reason.length <= 210 ? reason : reason.split(/(?<=다\.)\s+/u)[0];
  const currentLink = after.length === 1
    ? link(key, candidateFile, lineFor(entry.set_id, after[0].id))
    : `${esc(key)} → ${after.map(question => link(question.id, candidateFile, lineFor(entry.set_id, question.id))).join(' / ')}`;
  const pointText = `${entry.old_points} → ${total}${after.length > 1 ? ' (' + after.map(question => points(question)).join('+') + ')' : ''}`;
  const minimum = audit.minimum_sufficient_answer ?? audit.minimal_sufficient_answer;
  if (!minimum || !audit.burden) throw new Error('Missing minimum answer/burden: ' + key);
  const burden = audit.burden;
  const typeName = { descriptive: '서술', enumeration: '열거', judgment: '판단' }[after[0].type] ?? after[0].type;
  const burdenText = after.length > 1 ? `${after.length}물음·총 ${total}의미단위` : `${typeName}·${total}의미단위`;
  return { entry, row: `| ${currentLink} | ${esc(entry.before.prompt)} | ${pointText} | ${decision} | ${esc(shortReason)} | ${link('최소답안·요구부담', audit.audit_file, audit.audit_line)} — ${burdenText} |`, audit, burden };
});
const lines = [
  '# 기존 문제 배점 전수 검토 — 사용자 검토용 초안', '',
  '기존 104세트의 원래 물음 212개를 모두 검토했다. 독립된 요구가 맞으면 그 부분의 점수를 인정하도록 수정한 후보는 218물음·772점이며, 종전 574점에서 198점 증가했다. 신규 49세트·132물음·521점을 합친 현재 후보는 153세트·350물음·1,293점이다.', '',
  '| 구분 | 세트 | 물음 | 총점 |', '|---|---:|---:|---:|',
  '| 기존 정본의 원래 판본 | 104 | 212 | 574 |',
  '| 기존 문항의 검토·분리 후보 | 104 | 218 | 772 |',
  '| 신규 문항 후보 | 49 | 132 | 521 |',
  '| 합계 후보 | 153 | 350 | 1,293 |', '',
  `아래 표는 원래 물음당 한 행으로 ${diff.length}행이다. 배점·발문·채점기준 검토 결정은 유지 ${decisions.유지}개, 수정 ${decisions.수정}개, 분리 ${decisions.분리}개다. 같은 점수라도 발문이나 기준을 바로잡은 경우는 수정으로 표시했다. 인용의 정확한 줄바꿈·경로·위치 정정은 별도 출처 보정으로 구분한다.`, '',
  '각 행의 물음 ID를 누르면 현행 v3 후보의 해당 물음 위치를 볼 수 있다. ‘최소답안·요구부담’ 링크에는 최소 충분 답안, 요구 수와 서술·추론 부담, 유사 물음과의 비교 및 기존 criterion 대응을 남겼다. 분리 물음의 원발문은 변경 전 요구 범위를 확인하도록 표시했고, 개별 ID 링크에는 나뉜 발문이 있다.', '',
  '배점은 열거 요소와 서술의 독립된 의미 단위를 기본 1점으로 누적한다. 단어·조건 수식어를 기계적으로 나누거나, 주어진 사실과 같은 명제의 반복에 점수를 늘리지 않는다. 목적만 맞고 조치는 빠진 답처럼 독립된 부분정답은 해당 점수를 유지한다. 높은 배점은 원발문이 실제로 요구한 범위인지 검토했으며 아래 분리는 점수를 추가하기 위한 조치가 아니다.', '',
  '## 세 가지 분리의 계보', '',
  '원래 배점을 독립 요구 단위에 맞추는 조정과, 조정된 물음을 나누는 작업을 구별한다. 다음 세 경우는 **배점 조정 후의 합계**를 분리 전후 동일하게 유지했다. 세트 ID와 원물음 ID는 첫 부분에 보존하고 새 부분에 sub3/sub4를 추가했다. 기존 다른 물음과 criterion ID를 재번호화하지 않았다.', '',
  '| 원물음 | 원배점 → 독립 요구 재산정 | 분리 결과 | 범위·계보 |', '|---|---|---|---|',
];
for (const split of lineage.entries) {
  const old = diff.find(entry => entry.set_id === split.set_id && entry.subquestion_id === split.source_subquestion_id);
  const total = split.parts.reduce((sum, part) => sum + part.points, 0);
  if (split.before_points !== split.after_points || total !== split.after_points || !split.no_requirement_added_or_removed) throw new Error('Split total/scope not preserved');
  lines.push(`| ${esc(split.set_id + '/' + split.source_subquestion_id)} | ${old.old_points} → ${split.before_points} | ${split.parts.map(part => link(part.subquestion_id, candidateFile, lineFor(split.set_id, part.subquestion_id)) + ' ' + part.points + '점').join(' + ')} = ${total}점 | ${esc(split.reason)} ${link('분리 근거·criterion 계보', 'root/lineage.json')} |`);
}
lines.push('', '## 검증 상태와 남은 단계', '',
  '현재 후보에 대해 로컬 전수 내용·배점 검토, 직접 인용·형상·ID·합산 검사가 완료되었다. 이번 후보의 필수 실제 모델 의미검수와 반례 채점은 예정 단계이며, 사람 확인 근거는 기록되지 않았고 운영 DB에도 반영하지 않았다. 이전 판본의 실행 기록을 이번 후보의 완료 증거로 승계하지 않는다. 이 문서는 사람이 실제 후보와 배점 근거를 검토하기 위한 입력이며, 사람의 확인을 대신 인증하지 않는다.', '',
  `${link('v3 검사 요약', 'prepared-reviewed-v3/summary.json')}에 모델 의미검수 not_run, 실제 채점 not_run, 사람 확인 not_asserted, DB not_applied가 구분되어 있다. 형상 검사 통과와 게시·검수 준비 상태는 별개이며 검수·게시 상태가 아직 미완료이므로 DB 반영 전제조건 ready는 false다.`, '',
  '## 원래 212물음 전수 대응표', '',
  '탐색은 OX 학습 순서를 따르되 기존 주제·세트·물음 ID는 유지했다. 아래 주제 구분은 원세트의 주제이며, 실제 물음별 다주제 분류는 후보의 topic_ids를 따른다.', '');
for (const topicId of order) {
  const topicRows = rows.filter(item => item.entry.topic_id === topicId);
  if (!topicRows.length) continue;
  lines.push(`### ${topicId}. ${topicNames[topicId] ?? '주제 ' + topicId}`, '',
    `원물음 ${topicRows.length}개 · ${topicRows.reduce((sum, item) => sum + item.entry.old_points, 0)} → ${topicRows.reduce((sum, item) => sum + item.entry.new_points, 0)}점.`, '',
    '| 원물음 → 현재 물음 | 원래 요구 | 배점 전→후 | 결정 | 타당성 요약 | 최소 충분 답안·요구부담 근거 |',
    '|---|---|---:|---|---|---|', ...topicRows.map(item => item.row), '');
}
lines.push('## 입력과 재현', '',
  '본문 수치는 v3 후보와 요약에서 재계산하고, 원물음·전후 점수는 v1 전수 차이 장부 및 세 담당의 감사 장부와 대조했다. 원문·후보·QA 파일을 바꾸지 않고 이 보고서만 생성했다.', '',
  '| 입력 | SHA-256 |', '|---|---|');
const inputFiles = ['prepared-reviewed-v1/point-diff.json', 'a/audit.json', 'b/audit.json', 'c/audit.json', 'root/lineage.json', 'prepared-reviewed-v3/summary.json', candidateFile];
for (const input of inputFiles) lines.push(`| ${link(input, input)} | \`${hash(input)}\` |`);
lines.push('', `전수 확인: 원물음 ${rows.length}개, 감사 장부 ${auditMap.size}개, 누락·중복 0개. 분리 계보 ${lineage.entries.length}건의 합계 보존 확인. 생성기: ${link('point-review-report-generator.mjs', 'a/point-review-report-generator.mjs')}.`, '');
const text = lines.join('\n');
const sourceRows = text.split('\n').filter(line => line.startsWith('| ') && /pilot-\d{2}-\d{3}\//u.test(line) && /최소답안·요구부담/u.test(line));
if (sourceRows.length !== 212) throw new Error('Rendered table row count mismatch: ' + sourceRows.length);
for (const match of text.matchAll(/\]\(([^)]+)\)/gu)) {
  const target = match[1].replace(/:\d+$/u, '');
  if (!fs.existsSync(target)) throw new Error('Broken report link: ' + target);
}
const output = path.join(here, 'point-review-report-draft.md');
fs.writeFileSync(output, text);
console.log(JSON.stringify({ output: slash(output), ...calculated, decisions, table_rows: sourceRows.length, audit_links: rows.length, split_total_checks: lineage.entries.length, link_errors: 0, api_calls: 0 }, null, 2));
