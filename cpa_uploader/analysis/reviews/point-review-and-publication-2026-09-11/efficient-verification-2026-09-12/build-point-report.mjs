import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// This renders existing agent judgments. It does not decide content correctness,
// call a model, update a question, or create publication evidence.
const directory = path.dirname(fileURLToPath(import.meta.url));
let repository = directory;
while (!fs.existsSync(path.join(repository, 'AGENTS.md'))) {
  const parent = path.dirname(repository);
  if (parent === repository) throw new Error('Repository root not found');
  repository = parent;
}
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => !['--check', '--help'].includes(argument))) {
  throw new Error('Supported options: --check, --help');
}
if (arguments_.includes('--help')) {
  console.log('node <this-file> [--check]\nReads A/C reviews and B crosscheck; writes only adjacent point-allocation-review.md. --check writes nothing.');
  process.exit(0);
}
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const loaded = new Map();
function read(file) {
  const absolute = path.resolve(repository, file);
  if (!loaded.has(absolute)) {
    const bytes = fs.readFileSync(absolute);
    loaded.set(absolute, { bytes, sha256: hash(bytes), json: JSON.parse(bytes.toString('utf8')) });
  }
  return loaded.get(absolute);
}
function check(condition, message) {
  if (!condition) throw new Error(message);
}
function link(label, file) {
  const absolute = path.resolve(repository, file);
  check(fs.existsSync(absolute), `Missing link: ${file}`);
  return `[${label}](${encodeURI(path.relative(directory, absolute).replaceAll('\\', '/'))})`;
}
const markdown = (value) => String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ').trim();
const key = (entry) => `${entry.set_id}/${entry.subquestion_id}`;
const relative = (file) => path.relative(repository, file).replaceAll('\\', '/');
const inputs = ['a/question-reviews.json', 'c/question-reviews.json', 'b/point-crosscheck/review.json']
  .map((file) => ({ file: path.join(directory, file), ...read(path.join(directory, file)) }));
const [a, c, b] = inputs.map((input) => input.json);
check(a.entries.length === 132 && c.entries.length === 149, 'Expected 132 A and 149 C review records');
const rows = [...a.entries.map((entry) => ({ ...entry, owner: 'A', ledger: inputs[0].file })),
  ...c.entries.map((entry) => ({ ...entry, owner: 'C', ledger: inputs[1].file }))];
const byKey = new Map(rows.map((entry) => [key(entry), entry]));
check(byKey.size === 281, 'Expected 281 unique question identities');
const crosscheck = new Map(b.entries.map((entry) => [key(entry), entry]));
check(crosscheck.size === b.entries.length, 'Duplicate B crosscheck identity');
const contracts = (subquestion) => ({
  prompt: subquestion.prompt,
  model_answer: subquestion.model_answer,
  criteria: subquestion.criteria.map(({ id, claim, critical_facts, max_points, scores }) =>
    ({ id, claim, critical_facts, max_points, scores })),
});
const evidenceReuse = [];
for (const entry of rows) {
  check(entry.reviewer === 'agent', `Non-agent review: ${key(entry)}`);
  check(['standard', 'case'].includes(entry.question_style), `Invalid style: ${key(entry)}`);
  const points = entry.point_review;
  check(['maintain', 'clarify', 'adjust', 'split'].includes(points.decision), `Unknown point decision: ${key(entry)}`);
  check(Number.isInteger(points.after_points) && points.after_points > 0, `Invalid points: ${key(entry)}`);
  check(points.before_points === null || Number.isInteger(points.before_points), `Invalid baseline: ${key(entry)}`);
  check(points.reason && points.burden && points.split_decision, `Missing manual rationale: ${key(entry)}`);
  for (const name of ['source', 'answer', 'prompt', 'points', 'style', 'topics', 'edition', 'nonduplication']) {
    check(entry.checks?.[name], `Missing ${name} review: ${key(entry)}`);
  }
  const source = read(entry.file);
  check(source.sha256 === entry.file_sha256, `Selected question changed: ${entry.file}`);
  const sets = Array.isArray(source.json) ? source.json : [source.json];
  const matching = sets.filter((set) => set.id === entry.set_id);
  check(matching.length === 1, `Set identity mismatch: ${key(entry)}`);
  const question = matching[0].subquestions.find((item) => item.id === entry.subquestion_id);
  check(question, `Question not found: ${key(entry)}`);
  check(question.criteria.reduce((total, criterion) => total + criterion.max_points, 0) === points.after_points,
    `Point total mismatch: ${key(entry)}`);
  check(points.independent_elements.reduce((total, element) => total + element.points, 0) === points.after_points,
    `Independent-element total mismatch: ${key(entry)}`);
  entry.question = question;
  const independent = crosscheck.get(key(entry));
  if (independent) {
    check(independent.after_points === points.after_points, `B point comparison stale: ${key(entry)}`);
    const sameContract = isDeepStrictEqual(contracts(question), contracts(independent));
    evidenceReuse.push({ id: key(entry), sameFile: independent.input.sha256 === entry.file_sha256, sameContract });
    entry.crosscheck = independent;
    entry.crosscheckSameContract = sameContract;
  }
}
const topic = (entry) => entry.set_id.match(/^(?:pilot|draft)-(\d{2})-/)?.[1] ?? entry.topic_ids[0];
rows.sort((left, right) => topic(left).localeCompare(topic(right))
  || left.set_id.localeCompare(right.set_id, 'en', { numeric: true })
  || left.subquestion_id.localeCompare(right.subquestion_id, 'en', { numeric: true }));
const sum = (entries, field) => entries.reduce((total, entry) => total + (entry.point_review[field] ?? 0), 0);
const styles = rows.reduce((counts, entry) => ({ ...counts, [entry.question_style]: (counts[entry.question_style] ?? 0) + 1 }), {});
const unresolved = rows.filter((entry) => entry.status !== 'pass' || Object.values(entry.checks).some((value) => value !== 'pass'));
const decisions = rows.reduce((counts, entry) => ({ ...counts, [entry.point_review.decision]: (counts[entry.point_review.decision] ?? 0) + 1 }), {});
const nineteenth = rows.filter((entry) => topic(entry) === '19');
const nineteenthRelated = rows.filter((entry) => entry.topic_ids.includes('19') && topic(entry) !== '19');
check(nineteenth.length === 11 && nineteenth.every((entry) => crosscheck.has(key(entry))), 'Topic 19 crosscheck coverage incomplete');
const changed = rows.filter((entry) => entry.point_review.before_points !== null && entry.point_review.before_points !== entry.point_review.after_points);
const output = [
  '# 물음별 배점 검토 보고서', '',
  '<!-- Generated by build-point-report.mjs from recorded agent reviews. Do not edit the table directly. -->', '',
  `선택 대상 ${new Set(rows.map((entry) => entry.set_id)).size}세트의 **${rows.length}물음**을 정리했다. A는 132물음, C는 149물음이며, 기존 280물음에서 pilot-10-007의 혼합 요구를 분리해 한 물음이 늘었다. 배점은 이번 검토 직전 **${sum(rows, 'before_points')}점 → ${sum(rows, 'after_points')}점**이다. 기준서형 ${styles.standard}물음과 사례형 ${styles.case}물음을 포함한다. 이 수치는 전체 운영 문제은행의 수치와 구별한다.`, '',
  `담당 agent의 현재 내용·배점 장부에는 통과 ${rows.length - unresolved.length}물음, 미해결 ${unresolved.length}물음이 기록되어 있다. 이 보고서는 **agent의 내용·배점 검토**를 모은 문서다. 사람 확인, 대표 답안의 실제 API 채점 완료, 95% 일관성 달성 또는 운영 DB 반영을 인증하지 않는다. 생성기는 이미 작성된 판단을 표시하고 파일·ID·합계만 검사하며 내용의 옳고 그름을 자동 판정하지 않는다.`, '',
  '±1점·95% 허용 기준은 실제 채점의 일관성에만 적용한다. 발문·모범답안·공식 출처·배점·QA 기대값의 알려진 오류에는 허용률을 적용하지 않는다. 판본 검토는 장부의 2027년 CPA 대비 적용 조건과 국내 공식 시행 근거의 범위 안에서 해석한다.', '',
  '## 주요 배점 판단', '',
  `- **pilot-04-007/sub3: 2→4점.** 중요성 수정 후 수행중요성 수정 필요와 추가감사절차의 성격·시기·범위 적합성을 각각 평가하는 **KGA 320.13**의 물음이다. 감사문서화 요구가 아니다. 같은 문단의 pilot-04-001/sub2와 독립 부분점수 기준을 맞췄으며, 중요성 인하 자체를 다시 채점하지 않는다.`,
  '- **pilot-10-007/sub2: 원 7점 → 사례형 6점 + 독립 기준서형 5점.** 새 pilot-10-007-standards/sub4는 데이터 신뢰성의 원천·비교가능성·성격·관련성·작성통제만 묻는다. 기존 사례 물음에는 종료 판단, 기대치 정확성, 수용 차이와 그 고려사항이 남는다. 독립 요구의 부분점수를 복원한 총 11점이므로 총점 보존 분할로 설명하지 않는다. 주어진 계산 결과와 적합성 판단은 추가 채점하지 않는다.',
  '- **pilot-16-011/sub1 및 pilot-17-005/sub2: 각 3→3점.** 중간 수정안에서 일반적인 보고영향 고려와 구체 조치, 재무제표감사 영향과 다른 진술 의존능력 평가를 각각 다시 채점하던 중복을 제거했다. 최초 3점을 더 감점한 것이 아니라 중복 증가를 막고 구별되는 세 요구를 유지한 결과다.',
  `- **주제 19 원세트 전수 별도 교차검토:** ${nineteenth.length}물음, ${sum(nineteenth, 'after_points')}점 모두 B가 독립적으로 배점을 대조했다. 서술 길이보다 실제로 요구한 독립 명제와 부분답안이 기준이다. pilot-19-003의 국내 800 출처·시행 근거는 C의 최신 장부를 따르며, B의 과거 국내 원문 미확인 기록을 소급 수정하지 않는다. 실제 주제 연결에 19를 함께 갖는 ${nineteenthRelated.map((entry) => `${key(entry)}(${entry.point_review.after_points}점)`).join(', ')}도 이 전수 표의 담당 agent 검토에 포함되지만 B의 11물음 범위와 구별한다.`,
  '- **pilot-11-005/sub3: 4점 유지.** 발문이 공시에 대해 수행할 추가절차를 설명하라고 한 범위에서 채점한다. 충분하고 적합한 증거를 얻는 절차 수행을 제시했는데 별도 “설계”라는 단어가 없다는 이유로 숨은 감점을 만들지 않는다. 설계·수행 각각을 요구하는 pilot-19-001/sub2와 구분한다.', '',
  `배점 결정은 유지 ${decisions.maintain ?? 0}행, 점수 유지·내용 명료화 ${decisions.clarify ?? 0}행, 기준 분리·배점 조정 ${decisions.adjust ?? 0}행, 물음 분리 ${decisions.split ?? 0}행이다. 분리 두 행은 하나의 원물음과 그 분리 결과를 연결한 것이며, 서로 다른 두 분할로 세지 않는다. 숫자가 바뀐 기존 물음은 ${changed.map((entry) => `${key(entry)}(${entry.point_review.before_points}→${entry.point_review.after_points})`).join(', ')}이다.`, '',
  '## 표를 읽는 방법', '',
  '“전→후”의 전은 이번 효율 검토 직전 선택 입력의 점수다. 과거 정본 최초 배점과 혼동하지 않는다. “원 sub2에서 분리→5”는 새 독립 요구를 0점에서 임의로 추가했다는 뜻이 아니라 원물음에 있던 기준서 요구를 별도 학습 단위로 옮긴 것이다.', '',
  '물음 ID는 현재 선택 문항 JSON에 연결한다. 각 행의 상세 장부에는 실제 발문·출처 해시, criterion별 최소충분명제, 서술·추론 부담, 분할 판단과 대표 부분답안 ID가 있다. 비교는 담당 장부 또는 B의 독립 대조에 실제 기록된 경우만 표시한다. 문서의 행 수나 문장 수로 배점을 산정하지 않는다.', '',
  '## 물음별 전수 표', '',
  '| 물음 ID | 학습 유형 | 점수 전→후 | 결정 | 구체적 타당성 근거·부분정답 | 비교 문항·범위 |',
  '| --- | --- | --- | --- | --- | --- |',
];
for (const entry of rows) {
  const points = entry.point_review;
  const independent = entry.crosscheck;
  const pointChange = points.before_points === null ? `원 sub2에서 분리→${points.after_points}` : `${points.before_points}→${points.after_points}`;
  const disposition = { maintain: '유지', clarify: '유지·명료화', adjust: '조정·기준 분리', split: '물음 분리' }[points.decision];
  let reason = markdown(points.reason);
  if (independent?.independent_partial_example) reason += ` 부분정답: ${markdown(independent.independent_partial_example)}`;
  else if (points.partial_answer_evidence) reason += ` 부분답안 ${points.partial_answer_evidence.points}점 인정 사례를 장부에 연결했다.`;
  else if (points.partial_not_applicable_reason) reason += ` ${markdown(points.partial_not_applicable_reason)}`;
  reason += ` ${link(`${entry.owner} 상세`, entry.ledger)}`;
  if (independent) reason += ` ${link('B 교차검토', inputs[2].file)}${entry.crosscheckSameContract ? '' : ' (후속 계약 차이 있음)'}`;
  if (entry.status !== 'pass') reason += ` **현재 ${markdown(entry.status)}**`;
  let comparison = '별도 비교 문항 미기록';
  if (independent?.similar_question_comparison) comparison = markdown(independent.similar_question_comparison);
  else if (points.comparison) {
    const peer = points.comparison;
    const target = byKey.get(`${peer.set_id}/${peer.subquestion_id}`);
    const label = `${peer.set_id}/${peer.subquestion_id} (${peer.points}점)`;
    comparison = `${target ? link(label, target.file) : markdown(label)}: ${markdown(peer.reason)}`;
  }
  output.push(`| ${link(key(entry), entry.file)} | ${entry.question_style === 'case' ? '사례형' : '기준서형'} | ${pointChange} | ${disposition} | ${reason} | ${comparison} |`);
}
output.push('', '## 입력과 상태의 경계', '',
  `전수 표는 ${rows.length}개 고유 set_id/subquestion_id를 읽어 생성했다. 원본 파일 해시·문항 ID·criterion 합계와 장부의 독립 요소 합계를 대조했다. B 교차검토 ${b.entries.length}행 중 현재 파일 전체가 같은 것은 ${evidenceReuse.filter((entry) => entry.sameFile).length}행이고, 발문·모범답안·채점명제/조건·배점 계약이 같은 것은 ${evidenceReuse.filter((entry) => entry.sameContract).length}행이다. 파일이 다른 후속 출처 보완은 과거 교차검토 당시의 출처 확인으로 바꾸어 기록하지 않는다.`, '',
  unresolved.length ? `현재 내용 검토의 미해결: ${unresolved.map((entry) => `${key(entry)} (${entry.status}; ${Object.entries(entry.checks).filter(([, value]) => value !== 'pass').map(([name, value]) => `${name}=${value}`).join(', ')})`).join('; ')}.` : '현재 입력의 8개 검토 항목(source/answer/prompt/points/style/topics/edition/nonduplication)은 281물음 모두 agent pass다. 이는 해당 검토 장부의 상태를 인용한 것이며 실제 채점이나 게시 상태를 새로 부여한 결과가 아니다.', '',
  '| 읽은 장부 | SHA-256 |', '| --- | --- |',
  ...inputs.map((input) => `| ${link(path.relative(directory, input.file).replaceAll('\\', '/'), input.file)} | ${input.sha256} |`), '',
  '## 갱신 방법', '',
  'C의 최종 장부나 선택 파일이 바뀌면 저장소 루트에서 아래 생성기를 다시 실행한다. 생성 전후 입력이 바뀌거나 선택 파일 해시·합계가 맞지 않으면 실패하며 보고서를 쓰지 않는다. 원본 장부·문항·QA·인계 파일에는 쓰지 않는다.', '',
  '```powershell', `node ${relative(fileURLToPath(import.meta.url))}`, `node ${relative(fileURLToPath(import.meta.url))} --check`, '```', '',
  '`--check`는 현재 입력으로 재생성한 내용과 이 보고서가 같은지만 읽기 전용으로 확인한다. 새 API 채점·의미검수·DB 작업은 실행하지 않는다.', '');
const report = output.join('\n');
for (const [file, original] of loaded) check(hash(fs.readFileSync(file)) === original.sha256, `Input changed during generation: ${file}`);
const destination = path.join(directory, 'point-allocation-review.md');
if (arguments_.includes('--check')) check(fs.readFileSync(destination, 'utf8') === report, 'Report is stale; rerun without --check');
else fs.writeFileSync(destination, report, 'utf8');
console.log(JSON.stringify({ mode: arguments_.includes('--check') ? 'check' : 'build', questions: rows.length,
  sets: new Set(rows.map((entry) => entry.set_id)).size, before_points: sum(rows, 'before_points'),
  after_points: sum(rows, 'after_points'), agent_pending: unresolved.length, crosscheck: evidenceReuse,
  output: relative(destination), sha256: hash(Buffer.from(report)), api_calls: 0 }, null, 2));
