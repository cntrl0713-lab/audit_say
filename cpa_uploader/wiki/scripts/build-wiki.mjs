import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topicDefinitions } from './topic-definitions.mjs';
import { oxBookRelative, oxStudyChapters, studyTopics } from './ox-study-order.mjs';
import { scanGaps } from './gap-scan.mjs';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';
import { buildQuestionElements } from '../../questionElements.mjs';
import { buildCoverage, renderDashboard } from '../../analysis/coverage/build-coverage.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const bankRelative = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const tocRelative = 'cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md';
const slash = (s) => s.split(path.sep).join('/');
const inline = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
const cell = (s) => inline(s).replaceAll('|', '&#124;');
const list = (values) => JSON.stringify([...new Set(values)]);
const hash = (body) => crypto.createHash('sha256').update(body).digest('hex');
const allFiles = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? allFiles(path.join(root, e.name)) : [path.join(root, e.name)]);
const table = (headers, rows) => `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n')}`;

function parseTopics(text) {
  const matches = [...text.matchAll(/^###\s+(\d+)\.\s+(.+)$/gm)];
  return new Map(matches.map((m, i) => {
    const body = text.slice(m.index + m[0].length, matches[i + 1]?.index ?? text.length).split('\n## 자료 구성')[0];
    return [m[1], { title: m[2].trim(), axis: body.match(/^- 기준 축:\s*(.+)$/m)?.[1]?.trim() || '', terms: body.match(/^- 탐색어:\s*(.+)$/m)?.[1]?.trim() || '', sourceLines: body.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^- `[^`]+\.md`:/.test(s)) }];
  }));
}

// Pure renderer: checks may read expected output without touching the wiki or source bank.
export function buildWiki({ repoDir = path.resolve(scriptDir, '../../..'), date = new Date().toISOString().slice(0, 10) } = {}) {
  const wikiDir = path.join(repoDir, 'cpa_uploader/wiki');
  const read = (relative) => fs.readFileSync(path.join(repoDir, relative), 'utf8').replaceAll('\u0000', '');
  const bank = JSON.parse(read(bankRelative));
  const catalog = buildSourceCatalog({ repoDir });
  const definitions = parseTopics(read(tocRelative));
  const studyRank = new Map(studyTopics.map((topic, index) => [topic.id, index + 1]));
  const orderedBank = [...bank].sort((a, b) => studyRank.get(a.classification.topic_id) - studyRank.get(b.classification.topic_id));
  const pages = new Map();
  const byTopic = new Map(topicDefinitions.map((t) => [t.id, []]));
  const ids = new Set();
  for (const set of bank) {
    if (!byTopic.has(set.classification.topic_id)) throw new Error(`Unknown topic: ${set.id}`);
    if (!/^[a-zA-Z0-9_-]+$/.test(set.id) || ids.has(set.id)) throw new Error(`Invalid/duplicate set ID: ${set.id}`);
    ids.add(set.id);
    byTopic.get(set.classification.topic_id).push(set);
  }
  const link = (from, relative, label = relative) => `[${cell(label)}](${encodeURI(slash(path.relative(path.dirname(path.join(wikiDir, from)), path.join(repoDir, relative))))})`;
  const bookPageLink = (from, page, label) => link(from, oxBookRelative, label).replace(/\)$/u, `#${encodeURIComponent(`원문-페이지-${page}`)})`);
  const chaptersFor = (id) => oxStudyChapters.filter((chapter) => chapter.topics.some(([topicId]) => topicId === id));
  const reviewPaths = (id) => [
    `docs/archive/과거-검토-증거/reports/question-review-2027/${id}.md`,
    `cpa_uploader/analysis/reviews/question-review-2027/${id}.json`,
    ...allFiles(path.join(repoDir, 'docs/archive/과거-검토-증거/reports/question-review-2027')).filter((p) => path.dirname(p) === path.join(repoDir, 'docs/archive/과거-검토-증거/reports/question-review-2027') && new RegExp(`^${id}[-.]`).test(path.basename(p)) && /\.(md|json)$/.test(p)).map((p) => slash(path.relative(repoDir, p))),
  ].filter((p, i, all) => all.indexOf(p) === i && fs.existsSync(path.join(repoDir, p)));
  const reviews = new Map(topicDefinitions.map((t) => [t.id, reviewPaths(t.id)]));
  const reviewLinks = (from, id) => reviews.get(id).map((p) => link(from, p, path.basename(p))).join(' · ') || '검토 기록 없음';
  const front = (title, type, sources = [bankRelative], confidence = 'high') => `---\ntitle: ${JSON.stringify(title)}\ncreated: 2026-08-08\nupdated: ${date}\ntype: ${type}\nstatus: generated\nreview_required: true\ntags: [audit, question-generation, quality]\nsources: ${list(sources)}\nconfidence: ${confidence}\n---\n\n# ${title}\n\n`;
  const put = (file, body) => pages.set(file, body.trimEnd() + '\n');
  const counts = (sets) => ({ sets: sets.length, questions: sets.flatMap((s) => s.subquestions).length, criteria: sets.flatMap((s) => s.subquestions).flatMap((q) => q.criteria).length });
  const types = (sets) => ['descriptive', 'enumeration', 'judgment'].map((t) => `${t} ${sets.flatMap((s) => s.subquestions).filter((q) => q.type === t).length}`).join(' · ');
  const axis = (topic) => topic.standards.join(' · ');
  // Non-KGA source titles are authoritative index labels; do not hide them behind KGA 200 classification.
  const actualAxes = (sets) => [...new Set(sets.flatMap((s) => s.source_refs.map((r) => /^KGA \d+$/.test(r.page) ? r.page : r.title)))];

  for (const [bankIndex, set] of bank.entries()) {
    const file = `questions/${set.id}.md`;
    const topic = topicDefinitions.find((t) => t.id === set.classification.topic_id);
    const sources = new Map(set.source_refs.map((s) => [s.id, s]));
    const body = [front(`${set.id}. ${inline(set.title)}`, 'question', [bankRelative, ...set.source_refs.map((s) => s.file), ...reviews.get(topic.id)]),
      `이 페이지는 편집 정본에서 생성한 출제·검토용 색인이다. 정답·채점 조건을 포함하므로 public 문제 배포물에 포함하지 않는다. 원문과 판본 판단은 연결된 출처 및 검토 기록에서 확인한다.`,
      `- 주제: [[${topic.slug}]] · [[topic-${topic.id}-design]]`,
      `- 정본: ${link(file, bankRelative, 'authoring JSON')} · JSON Pointer \`/${bankIndex}\``,
      `- 상태: ${set.status} / ${set.verification.review_status} · source_fidelity: ${set.verification.source_fidelity}`,
      `- 검토·근거 장부: ${reviewLinks(file, topic.id)}`,
      `- 학습 순서: ${set.learning_order.join(' → ')}`,
      '\n## 공통 사실\n',
      ...set.shared_context.facts.map((f) => `- ${f.id} (scoreable=${f.scoreable}): ${inline(f.text)}`),
    ];
    for (const [qIndex, q] of set.subquestions.entries()) {
      body.push(`\n## ${q.id}\n`, `유형: ${q.type} · JSON Pointer \`/${bankIndex}/subquestions/${qIndex}\``,
        `\n### 발문\n\n${inline(q.prompt)}`, `\n### 모범답안\n\n${q.model_answer.map((a) => `- ${inline(a)}`).join('\n')}`,
        `\n### 답안 계약\n\nselection: \`${JSON.stringify(q.selection)}\` · constraints: \`${JSON.stringify(q.constraints)}\``,
        '\n### 학습목표·채점명제와 핵심 조건\n',
        table(['criterion', '정본 명제', '핵심 사실·조건', '배점·판정별 점수', 'requirement', 'source'], q.criteria.map((c) => [c.id, c.claim, c.critical_facts.map((f) => `${f.id} (${f.type}): ${f.expected}`).join(' / '), `${c.max_points}; ${JSON.stringify(c.scores)}`, c.requirement_id, c.source_ref_ids.join(', ')])),
        '\n### 요구사항과 직접 근거\n',
        table(['requirement', '문단·페이지·판본', 'source', '원문 인용'], q.requirements.map((r) => [r.id, r.source_span, sources.has(r.source_ref_id) ? link(file, sources.get(r.source_ref_id).file, r.source_ref_id) : r.source_ref_id, r.source_quote])),
      );
    }
    body.push('\n## 출처 파일·위치\n', table(['source', '직접 출처', 'page', '인용 SHA-256'], set.source_refs.map((s) => [s.id, link(file, s.file, s.title), s.page, s.content_hash])), '\n## 판본·검수 메모\n', ...set.verification.notes.map((n) => `- ${inline(n)}`), '\n2027 시험 적용 여부는 아래 판본 기록과 공식 시험 공고 확인 상태를 따른다. 게시 상태 또는 이 색인의 생성 상태로 대신 확정하지 않는다.', '\n## Related\n\n- [[source-review-map]]\n- [[requirement-coverage]]');
    put(file, body.join('\n'));
  }

  for (const [studyIndex, topic] of studyTopics.entries()) {
    const definition = definitions.get(topic.id);
    if (!definition) throw new Error(`Missing TOC topic ${topic.id}`);
    if (!definition.sourceLines.length) throw new Error(`Missing source navigation for TOC topic ${topic.id}`);
    const sets = byTopic.get(topic.id), n = counts(sets), file = `concepts/${topic.slug}.md`;
    const neighbors = [studyTopics[studyIndex - 1] && `이전 [[${studyTopics[studyIndex - 1].slug}]]`, studyTopics[studyIndex + 1] && `다음 [[${studyTopics[studyIndex + 1].slug}]]`].filter(Boolean).join(' · ');
    const body = [front(`${definition.title} (주제 ID ${topic.id})`, 'concept', [tocRelative, oxBookRelative, bankRelative, ...reviews.get(topic.id)], 'medium'),
      `학습 순서 ${studyIndex + 1}/${studyTopics.length} · 주제 ID ${topic.id} · [[ox-study-order]]\n\n${neighbors}\n`,
      `교재 연결: ${chaptersFor(topic.id).map((chapter) => `${bookPageLink(file, chapter.page, chapter.label)} — ${chapter.topics.find(([id]) => id === topic.id)[1]}`).join(' · ')}\n`,
      '## 범위\n', `- 탐색 기준 축: ${axis(topic)}`, `- 목차 기준 축: ${definition.axis}`, `- 정본 직접 출처: ${actualAxes(sets).join(' · ') || '연결 없음'}`, `- 탐색어: ${definition.terms}`, `- 세트 ${n.sets} · 물음 ${n.questions} · criterion ${n.criteria} · ${types(sets)}`,
      '\n## 출제 전 확인\n', `- 원자료 단위와 새 목표 설계: [[source-catalog-topic-${topic.id}]] · [[source-authoring-design]]`, `- 주제별 조건·예외: [[topic-${topic.id}-design]]`, `- 문항별 검토·판본·실측: ${reviewLinks(file, topic.id)}`,
      '- 기존 세트 색인의 공통 사실 → 발문 → 모범답안 → 핵심 조건 → requirement·출처를 함께 읽는다. 명제 목록만으로 적용 범위와 정답을 확정하지 않는다.',
      '- 아래 생성 목록은 정본의 현재 기록이며 사람 검수나 2027 시험 적용 판본 확정을 보증하지 않는다.', '\n## v3 문제은행 연결 현황\n'];
    for (const set of sets) {
      body.push(`### ${set.id}. ${inline(set.title)}\n`, `[[${set.id}]] — ${set.status}/${set.verification.review_status}; 조건·정답·requirement·공식 파일 위치 포함`,
        ...set.shared_context.facts.map((f) => `- 공통 사실: ${inline(f.text)}`), ...set.subquestions.map((q) => `- ${q.id} (${q.type}): ${inline(q.prompt)}`), '');
    }
    body.push('\n## 원자료 탐색\n', ...definition.sourceLines.map((line) => {
      const m = line.match(/^- `([^`]+)`:\s*(.+)$/);
      return `- ${link(file, `cpa_uploader/data/회계감사_통합학습자료/${m[1]}`, m[1])}: ${m[2]}`;
    }), '\n## Related\n\n- [[topic-map]]\n- [[coverage-map]]\n- [[source-review-map]]\n- [[requirement-coverage]]\n- [[question-generation-workflow]]');
    put(file, body.join('\n'));
  }

  const studyFile = '_meta/ox-study-order.md';
  put(studyFile, front('필수암기·OX 200제에 맞춘 학습 순서', 'source-map', [oxBookRelative, tocRelative], 'medium')
    + `교재의 필수암기 200제 장별 흐름을 기준으로 위키의 탐색 순서를 구성했다. ${bookPageLink(studyFile, 12, '전체 200제 목차(원문 12–19쪽)')}와 ${bookPageLink(studyFile, 119, 'OX 기출 본문(원문 119–151쪽)')}을 대조했다. 아래 페이지는 인쇄면 쪽수가 아닌 원자료의 ‘원문 페이지’ 번호이며, 링크는 해당 범위의 첫 페이지로 이동한다.\n\n`
    + 'CM1–13은 책의 큰 구분인 필수암기·OX·빈출 핵심정리 안에서 필수암기 부분의 장을 가리킨다. 현재 19개 주제는 여러 장의 내용을 묶은 경우가 있으므로, 첫 화면에서는 대표 순서로 한 번씩 보여주고 아래 장별 표에서는 필요한 주제를 다시 연결한다. 학습 순서와 기존 주제 ID는 별개이며 문제·출처 ID와 정본 JSON 위치는 유지한다.\n\n'
    + '## 교재 장별로 찾아가기\n\n'
    + table(['교재 장', '원문 페이지', '필수암기 물음', '위키 주제와 이 장에서 볼 내용'], oxStudyChapters.map((chapter) => [chapter.label, bookPageLink(studyFile, chapter.page, chapter.page === chapter.endPage ? `${chapter.page}쪽` : `${chapter.page}–${chapter.endPage}쪽`), chapter.questions, chapter.topics.map(([id, focus]) => `[[${studyTopics.find((topic) => topic.id === id).slug}]]: ${focus}`).join(' / ')]))
    + '\n\n## 위키의 대표 학습 순서\n\n'
    + table(['순서', '기존 주제 ID', '주제', '출제 지침'], studyTopics.map((topic, index) => [index + 1, topic.id, `[[${topic.slug}]]`, `[[topic-${topic.id}-design]]`]))
    + '\n\n## 여러 장에 걸친 주제 읽기\n\n'
    + '- 계획·문서화·중요성은 CM4와 CM5에서 필요한 부분을 나누어 읽는다.\n'
    + '- 분석적절차는 CM4, 표본감사는 CM9에 있다. 외부조회는 CM4, 기초잔액·재고는 CM7, 소송은 CM8에 있다.\n'
    + `- 서비스조직은 CM6, 전문가 활용은 CM8에 있다. 내부감사기능 활용은 ${bookPageLink(studyFile, 137, 'OX 원문 137쪽')}에서도 확인한다.\n`
    + '- 통제미비점 커뮤니케이션은 CM6, 부정·법규는 CM8, 지배기구 커뮤니케이션은 CM10에 있다. 왜곡표시 평가는 CM11에서 종결 주제로 다시 연결한다.\n'
    + '- 소규모기업은 필수암기 200번의 정의를 시작점으로 연결한다. 보충 검토 OX와 함께 각 wiki 주제 전체의 출제 범위를 포괄하는 자료로 해석하지 않는다. 출제 범위는 주제별 원자료·기준서와 함께 확인한다.\n'
    + '\n## Related\n\n- [[topic-map]]\n- [[source-catalog]]\n- [[source-authoring-design]]');
  put('_meta/topic-map.md', front('회계감사 주제 지도', 'source-map', [tocRelative, oxBookRelative, bankRelative]) + '[[ox-study-order]]의 교재 흐름을 따른다. 학습 순서는 탐색용이며 기존 주제 ID와 구분한다. 여러 장에 걸친 내용은 장별 안내에서 다시 연결한다.\n\n' + table(['학습 순서', '주제 ID', '주제', '기준 축', '설계 지침', '세트'], studyTopics.map((t, index) => [index + 1, t.id, `[[${t.slug}]]`, axis(t), `[[topic-${t.id}-design]]`, byTopic.get(t.id).length])) + '\n\n## Related\n\n- [[coverage-map]]\n- [[source-review-map]]\n- [[question-generation-workflow]]');
  const coverageRows = studyTopics.map((t) => {
    const sets = byTopic.get(t.id), n = counts(sets);
    const linked = new Set(sets.flatMap((s) => s.source_refs.map((r) => r.page)));
    const missing = t.standards.filter((s) => s.startsWith('KGA ') && !linked.has(s));
    const absentTypes = ['descriptive', 'enumeration', 'judgment'].filter((type) => !sets.some((s) => s.subquestions.some((q) => q.type === type)));
    const priority = !n.sets ? '빈 영역' : missing.length ? '기준서 미연결 우선 검토' : absentTypes.length ? '유형·요구사항 범위 검토' : '요구사항 범위 검토';
    return [t.id, `[[${t.slug}]]`, n.sets, n.questions, n.criteria, sets.filter((s) => s.status === 'published').length, types(sets), missing.join(' · ') || '-', priority];
  });
  put('_meta/coverage-map.md', front('문제은행 커버리지 맵', 'coverage') + '세트 수는 분포이며 출제 범위 충족 판정이 아니다. 기준서별 직접 연결과 요구사항·학습목표의 대응은 [[requirement-coverage]], 판본·조건 검토 기록은 [[source-review-map]]을 먼저 확인한다. 유형 부재는 보강 검토 신호이며 모든 주제에 세 유형을 의무로 만드는 규칙은 아니다.\n\n' + table(['ID', '주제', '세트', '물음', 'criterion', 'published', '유형 분포', '직접 출처 미연결', '검토 우선순위'], coverageRows) + '\n\n## Related\n\n- [[topic-map]]\n- [[requirement-coverage]]\n- [[source-review-map]]\n- [[question-generation-workflow]]');

  const sourceMapFile = '_meta/source-review-map.md';
  const reviewRows = studyTopics.map((t) => {
    const sets = byTopic.get(t.id), ledgerPath = `cpa_uploader/analysis/reviews/question-review-2027/${t.id}.json`;
    const ledger = fs.existsSync(path.join(repoDir, ledgerPath)) ? JSON.parse(read(ledgerPath)) : {};
    // Some historical ledgers embed the entire pre-review bank under baseline.
    // Only scalar status/edition fields belong in this current-state index.
    const status = ['review_record_complete', 'exam_2027_suitable', 'baseline', 'target_exam_year'].filter((k) => ledger[k] !== undefined).map((k) => `${k}=${ledger[k] !== null && typeof ledger[k] === 'object' ? '구조화된 과거 기록: 근거 장부 참조' : String(ledger[k])}`).join('; ');
    return [t.id, `[[${t.slug}]] · [[topic-${t.id}-design]]`, reviewLinks(sourceMapFile, t.id), [...new Set(sets.flatMap((s) => s.source_refs.map((r) => r.file)))].map((p) => link(sourceMapFile, p, path.basename(p))).join(' · '), status || '보고서·장부 본문의 상태 확인'];
  });
  put(sourceMapFile, front('직접 출처·검토·판본 지도', 'source-map', [bankRelative, ...[...reviews.values()].flat()]) + `검토 기록 작성과 최종 시험 적용은 별개다. 아래 상태는 장부의 실제 필드를 옮긴 것이며, 필드가 없는 장부는 보고서 본문에서 확인한다. 주제별 세트 색인에는 출처 제목·문단·페이지·인용 해시와 검수 메모를 함께 보존한다.\n\n2027년의 2026년 시행 기준 동일 적용은 기존 작업 가정이다. ${link(sourceMapFile, 'docs/archive/과거-검토-증거/reports/question-review-2027/개정-감사기준서-220-시행일-별도-기록.md', '개정220 시행일·판본 메모')} 및 ${link(sourceMapFile, 'cpa_uploader/analysis/reviews/question-review-2027/standards-register.json', '기준대장')}의 적용 조건을 확인한다.\n\n` + table(['주제', '색인·지침', '검토·근거 기록', '실제 연결 출처 파일', '장부 상태·적용 가정'], reviewRows) + '\n\n## Related\n\n- [[coverage-map]]\n- [[requirement-coverage]]\n- [[question-output-schema]]');

  // This inventory starts from source files, even when the bank has no questions.
  // A same-file quote containment link is traceability, never a semantic coverage score.
  const normalizedQuote = (text) => String(text).replaceAll('\u0000', '').replace(/\s+/gu, ' ').trim();
  const bankQuotes = new Map();
  for (const set of bank) for (const source of set.source_refs) {
    const file = source.file.replaceAll('\\', '/');
    if (!bankQuotes.has(file)) bankQuotes.set(file, []);
    bankQuotes.get(file).push({ set: set.id, source: source.id, quote: normalizedQuote(source.source_quote) });
  }
  const unitBankLinks = new Map(catalog.units.map((unit) => {
    const quote = normalizedQuote(unit.quote);
    const matches = (bankQuotes.get(unit.file) || []).filter((entry) => quote && entry.quote && (quote.includes(entry.quote) || entry.quote.includes(quote)));
    return [unit.id, [...new Set(matches.map((entry) => entry.set))]];
  }));
  const unitGroups = studyTopics.map((topic) => ({ id: `topic-${topic.id}`, topic, units: catalog.units.filter((unit) => unit.topicIds.includes(topic.id)) }));
  const unmapped = catalog.units.filter((unit) => !unit.topicIds.length);
  if (unmapped.length) unitGroups.push({ id: 'unmapped', topic: null, units: unmapped });
  const catalogFiles = [];
  const catalogRows = [];
  const unitCounts = (units) => `${units.length}개: 기준서 ${units.filter((unit) => unit.kind === 'standard').length}, 이론 ${units.filter((unit) => unit.kind === 'theory').length}, 연습 ${units.filter((unit) => unit.kind === 'practice').length}, 기출 ${units.filter((unit) => unit.kind === 'past_exam').length}`;
  for (const group of unitGroups) {
    const chunkSize = 150;
    const chunks = Array.from({ length: Math.max(1, Math.ceil(group.units.length / chunkSize)) }, (_, index) => ({
      file: `_meta/source-catalog-${group.id}${index ? `-part-${String(index + 1).padStart(2, '0')}` : ''}.md`,
      units: group.units.slice(index * chunkSize, (index + 1) * chunkSize),
    }));
    const title = group.topic ? `${group.topic.id}. ${definitions.get(group.topic.id).title}` : '주제 미연결 원자료';
    const navigation = chunks.map((chunk, index) => `[[${path.basename(chunk.file, '.md')}]] (${index + 1}/${chunks.length})`).join(' · ');
    const linked = group.units.filter((unit) => unitBankLinks.get(unit.id).length).length;
    catalogRows.push([group.topic?.id || '미연결', navigation, unitCounts(group.units), linked, group.units.length - linked]);
    for (const [index, chunk] of chunks.entries()) {
      catalogFiles.push(chunk.file);
      const rows = chunk.units.map((unit) => [
        `<a id="${unit.id}"></a>\`${unit.id}\``,
        `${unit.kind} / ${unit.authority}`,
        `${link(chunk.file, unit.file, `${path.basename(unit.file)} · ${unit.locator}`)}; ${unit.title}`,
        `${unit.context.section || '절 정보 없음'}; ${unit.edition}; ${unit.warnings.join('; ')}`,
        `${unit.dependencies.length}개 / 미확보 ${unit.dependencies.filter((dependency) => !dependency.targetId).length}개`,
        unitBankLinks.get(unit.id).map((id) => `[[${id}]]`).join(' · ') || '직접 인용 연결 없음 · 목표 검토 후보',
        unit.contentHash,
      ]);
      put(chunk.file, front(`${title} 원자료 단위 ${index + 1}/${chunks.length}`, 'source-map', [tocRelative, bankRelative, ...new Set(chunk.units.map((unit) => unit.file))], 'medium')
        + `주제 전체 ${unitCounts(group.units)}. 이 페이지는 ${chunk.units.length}개를 표시한다. 같은 원자료 단위가 여러 주제에 연결될 수 있다.\n\n${navigation}\n\n`
        + '단위·페이지는 원문 탐색 경계다. 실제 발문·해설의 연속성과 조건·예외는 전후 문맥 및 의존 문단까지 읽는다. 의존 문단 수는 현재 카탈로그가 찾은 참조이며 모든 의미상 의존을 보증하지 않는다. 공식 전사라는 분류도 시험 적용 판본 확정이 아니다.\n\n은행 연결은 **동일 파일에서 공백·NUL 정리 후 인용이 서로 포함되는지**만 검사한다. 출제 내용의 충족·중복·미출제를 판정하지 않는다. 연결이 없는 단위도 다른 파일·표현으로 출제되었을 수 있다. [[source-authoring-design]]의 새 목표·기존 차이·조건·예외 표를 작성한다.\n\n'
        + table(['원자료 ID', '종류·근거 계층', '실제 파일·위치', '절·판본·원문 한계', '참조 의존', '은행 인용 연결', '원문 인용 SHA-256'], rows)
        + '\n\n## Related\n\n- [[source-catalog]]\n- [[requirement-coverage]]\n- [[source-review-map]]');
    }
  }
  const catalogFile = '_meta/source-catalog.md';
  put(catalogFile, front('원자료 단위 카탈로그와 새 학습목표 탐색', 'source-map', [tocRelative, 'cpa_uploader/config/question-source-registry.json', ...catalog.sources.map((source) => source.file)], 'medium')
    + `원자료 ${catalog.sources.length}개 파일에서 고유 단위 ${catalog.units.length}개를 분리했다. 주제별 표는 중복 연결을 포함하므로 합계를 고유 단위 수로 해석하지 않는다. 카탈로그는 은행 등록 여부와 독립적으로 기준서·이론·문제연습·기출 원문을 읽는다.\n\n- 카탈로그 버전: ${catalog.version}\n- 입력·분리 계약 SHA-256: ${catalog.fingerprint}\n- 목차 원자료 행: ${catalog.tocLinks.length}개\n- 주제 미연결 단위: ${unmapped.length}개\n\n`
    + '원자료 단위를 선택한 뒤 [[source-authoring-design]]에서 기존 발문 재구성 또는 기준서 기반 신규 목표 경로를 택한다. 인용 연결과 문자 유사도는 후보 탐색이며 정확한 내용 커버리지를 보증하지 않는다. 판본·주체·시점·조건·예외는 원문과 [[source-review-map]]에서 확인한다.\n\n'
    + table(['주제', '원자료 단위 탐색', '원자료 종류', '은행 인용 연결 단위', '직접 연결 없는 검토 후보'], catalogRows)
    + '\n\n## 원자료 파일과 분리 상태\n\n'
    + table(['파일', '종류·계층', '분리 단위', '파일 SHA-256', '판본 기록'], catalog.sources.map((source) => [link(catalogFile, source.file, source.file), `${source.kind} / ${source.authority}`, source.unitIds.length || '미분리: 원문 직접 확인', source.contentHash, source.edition]))
    + '\n\n## 자동 탐색의 미확인 사항\n\n'
    + (catalog.warnings.length ? catalog.warnings.map((warning) => `- ${inline(warning)}`).join('\n') : '- 카탈로그가 감지한 원문 페이지 누락 없음. OCR·문단 분리·내용·법역·판본의 완전성 판정은 아님.')
    + '\n\n## Related\n\n- [[source-authoring-design]]\n- [[requirement-coverage]]\n- [[source-manifest]]');

  const gaps = scanGaps({ repoDir });
  const unscannedStandards = [...new Set(topicDefinitions.flatMap((t) => t.standards))].filter((s) => s.startsWith('KGA ') && !gaps.perStandard.has(s));
  const requirementFile = '_meta/requirement-coverage.md';
  const requirementCount = bank.flatMap((s) => s.subquestions).reduce((n, q) => n + q.requirements.length, 0);
  const missingSections = gaps.rows.filter((r) => r.tier === '공백');
  const sourceFirstCoverage = `## 원자료 단위에서 목표 후보 찾기\n\n[[source-catalog]]의 고유 원자료 단위 ${catalog.units.length}개를 먼저 탐색한다. 주제별 카탈로그는 기준서·이론·문제연습·기출의 실제 파일·위치·판본·은행 인용 연결을 표시한다. 직접 인용 연결이 없는 단위에서 목표 후보를 찾되, 다른 표현·파일로 출제된 기존 목표가 있는지 실제 발문과 대조한다. [[source-authoring-design]]의 두 경로와 계획서로 목표·조건·예외·답안 범위·기존 차이를 명시한다.\n\n`
    + table(['주제', '원자료 단위', '은행 인용 연결', '직접 연결 없는 검토 후보'], unitGroups.map((group) => [
      `[[source-catalog-${group.id}]]`, group.units.length,
      group.units.filter((unit) => unitBankLinks.get(unit.id).length).length,
      group.units.filter((unit) => !unitBankLinks.get(unit.id).length).length,
    ]))
    + '\n\n은행 인용 연결은 동일 파일·인용 포함 여부이며 학습목표 충족 판정이 아니다. 아래 요구사항 절 유사도 스캔과 별도 범위로 읽는다.\n\n## 기존 은행 대응과 요구사항 절 탐색\n\n';
  put(requirementFile, front('요구사항·학습목표 연결과 보강 후보', 'coverage', [bankRelative, 'cpa_uploader/data/회계감사_통합학습자료/01_감사기준']) + sourceFirstCoverage + `정본 requirement ${requirementCount}개와 criterion ${counts(bank).criteria}개의 직접 대응은 각 [[topic-map]] → 세트 색인의 ‘학습목표·채점명제와 핵심 조건’ 및 ‘요구사항과 직접 근거’ 표에서 찾는다. ID는 세트·물음 안에서 해석한다. 실제 발문과 조건을 함께 보고 동일 명제 반복과 범위 누락을 검토한다.\n\n아래는 통합학습자료 요구사항 절의 4글자 문자열 겹침 탐색이다. 공식 문단 식별에 의한 내용 검수가 아니다. 15% 미만은 공백 후보, 15% 이상 35% 미만은 낮은 유사도, 35% 이상도 유사 문구 탐지일 뿐 완전한 출제를 뜻하지 않는다. 짧은 절(40개 미만 4-gram)은 제외한다. 현재 파서가 요구사항 절로 분리하지 못한 기준 축: ${unscannedStandards.join(', ') || '없음'}. 이 기준서는 미출제로 판정하지 말고 원문·세트 직접 연결에서 별도로 검토한다. 비KGA 인증·검토 기준의 전체 범위를 이 스캔에 포함했다고 해석하지 않는다.\n\n- 탐색 절 ${gaps.rows.length}개: 공백 후보 ${gaps.totals.공백}, 낮은 유사도 ${gaps.totals.얇음}, 유사 문구 탐지 ${gaps.totals.커버}\n- 전체 절별 결과: \`node cpa_uploader/wiki/scripts/gap-scan.mjs --sections\`\n\n` + table(['기준서', '공백 후보', '낮은 유사도', '유사 문구 탐지'], [...gaps.perStandard].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([standard, n]) => [standard, n.공백, n.얇음, n.커버])) + '\n\n## 공백 후보의 실제 절 위치\n\n' + table(['기준서', '학습자료 요구사항 절', '문자열 겹침', '최근접 세트'], missingSections.map((r) => [r.standard, link(requirementFile, `cpa_uploader/data/회계감사_통합학습자료/01_감사기준/${r.file}`, r.name), `${r.score}%`, r.bestSet === '-' ? '연결 없음' : `[[${r.bestSet}]]`])) + '\n\nKGA 402처럼 직접 출처가 없는 기준서는 세트 수보다 먼저 보강 범위를 검토한다. 후보 절의 실제 학습목표·조건·예외를 공식 원문과 대조한 뒤 출제 여부를 결정하며, 자동 유사도만으로 문항 검수 상태를 올리지 않는다.\n\n## Related\n\n- [[coverage-map]]\n- [[source-review-map]]\n- [[question-design]]');

  const records = allFiles(path.join(repoDir, 'cpa_uploader/data')).filter((p) => /\.(md|txt|json|sql)$/i.test(p)).sort((a, b) => a.localeCompare(b, 'ko')).map((p) => {
    const body = fs.readFileSync(p);
    return { file: slash(path.relative(repoDir, p)), bytes: body.length, sha: hash(body), nul: body.reduce((n, v) => n + Number(v === 0), 0) };
  });
  const groups = new Map();
  for (const r of records) groups.set(r.sha, [...(groups.get(r.sha) || []), r.file]);
  const duplicates = new Map([...groups].filter(([, files]) => files.length > 1).map(([sha], i) => [sha, `D${i + 1}`]));
  const rawCollections = 'cpa_uploader/raw/collections';
  const collectionManifests = fs.existsSync(path.join(repoDir, rawCollections))
    ? fs.readdirSync(path.join(repoDir, rawCollections), { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(entry => `${rawCollections}/${entry.name}/manifest.json`).filter(file => fs.existsSync(path.join(repoDir, file))).sort() : [];
  const rawArchive = fs.existsSync(path.join(repoDir, 'cpa_uploader/raw/README.md'))
    ? '## 원자료·검증 출처 보관소\n\n' + link('raw/source-manifest.md', 'cpa_uploader/raw/README.md', 'cpa_uploader/raw 안내')
      + '에서 기반 자료·검증 원본·추출본·페이지 이미지와 원래 경로의 연결을 찾는다. 기존 출처 경로를 유지한 보존 복사이며 수집·해시 검사는 의미검수·실제 채점 완료와 별개다.\n\n'
      + table(['수집', '원래 경로', '고유 보존 파일', '미보관 기록'], collectionManifests.map(file => {
        const collection = JSON.parse(read(file));
        return [link('raw/source-manifest.md', file.replace('manifest.json', 'index.md'), path.basename(path.dirname(file))),
          collection.summary.original_paths, collection.summary.unique_files, collection.missing.length];
      })) + '\n\n' : '';
  put('raw/source-manifest.md', front('원자료 매니페스트', 'source-map', ['cpa_uploader/data', ...collectionManifests]) + rawArchive
    + `## 현행 등록 입력\n\n파일 ${records.length}개 · 동일 해시 중복 ${duplicates.size}그룹 · NUL 포함 ${records.filter((r) => r.nul).length}개. 아래는 현재 data 입력이고 raw의 과거 시점 사본과 구분한다. 원자료를 수정하지 않고 읽으며 편집 정본과 배포물은 각각의 생성·검수 절차로만 갱신한다.\n\n`
    + table(['경로', 'bytes', 'SHA-256', 'NUL', '중복 그룹'], records.map((r) => [link('raw/source-manifest.md', r.file, r.file.replace('cpa_uploader/', '')), r.bytes, r.sha, r.nul, duplicates.get(r.sha) || '-'])) + '\n\n## Related\n\n- [[topic-map]]\n- [[coverage-map]]\n- [[source-review-map]]');

  const dashboardFile = '_meta/authoring-dashboard.md';
  const overlayFile = 'cpa_uploader/analysis/coverage/links.json';
  const hasAnalysisInputs = fs.existsSync(path.join(repoDir, overlayFile))
    && fs.existsSync(path.join(repoDir, 'cpa_uploader/analysis/question-elements/past-exam.json'));
  if (hasAnalysisInputs) {
    const currentCoverage = buildCoverage({ repoDir, catalog, dataset: buildQuestionElements({ repoDir }) });
    put(dashboardFile, front('출제 요소·빈도·문항 상태 통합 현황', 'coverage', [bankRelative, overlayFile]) + renderDashboard(currentCoverage)
      + '\n## Related\n\n- [[ox-study-order]]\n- [[source-catalog]]\n- [[question-elements]]\n- [[requirement-coverage]]\n');
  } else {
    put(dashboardFile, front('출제 요소·빈도·문항 상태 통합 현황', 'coverage')
      + '통합 분석 입력이 이 작업 공간에 없다. 추출 데이터와 관계 장부를 준비한 뒤 analysis:build를 실행한다.\n\n## Related\n\n- [[source-catalog]]\n- [[question-elements]]\n- [[requirement-coverage]]\n');
  }

  const manualPages = allFiles(wikiDir).filter((p) => p.endsWith('.md')).map((p) => slash(path.relative(wikiDir, p))).filter((p) => !pages.has(p) && !/^(concepts|questions|_meta|raw)\//.test(p) && !['index.md', 'log.md', 'SCHEMA.md'].includes(p));
  const guideRank = (file) => studyRank.get(file.match(/(?:^|\/)topic-(\d+)-design\.md$/u)?.[1]) || 0;
  const orderedGuides = [...manualPages].sort((a, b) => guideRank(a) - guideRank(b) || a.localeCompare(b, 'en'));
  const contentPages = pages.size + manualPages.length;
  const summary = { wikiDir, topics: topicDefinitions.length, questionSets: bank.length, subquestions: counts(bank).questions, criteria: counts(bank).criteria, requirements: requirementCount, sourceFiles: catalog.sources.length, sourceUnits: catalog.units.length, sourceCatalogPages: catalogFiles.length + 1, sourceNavigationLinks: catalog.tocLinks.length, contentPages };
  const catalogIndex = unitGroups.map((group) => `- ${catalogFiles.filter((file) => file.startsWith(`_meta/source-catalog-${group.id}.`) || file.startsWith(`_meta/source-catalog-${group.id}-part-`)).map((file) => `[[${path.basename(file, '.md')}]]`).join(' · ')}`).join('\n');
  put('index.md', `# CPA 회계감사 문제 출제 LLM Wiki\n\n> Last updated: ${date} | Content pages: ${contentPages} | v3 문제은행: 세트 ${bank.length}개 · 물음 ${summary.subquestions}개 · criterion ${summary.criteria}개\n\n출제·검토용 내부 지식베이스다. 세트 색인은 정답과 비공개 채점 조건을 포함한다.\n\n## Start Here\n\n- [[authoring-dashboard]] — 요구사항·빈도·은행 대응·검토/게시 상태 통합 현황\n- [[ox-study-order]] — 필수암기·OX 200제의 장별 흐름과 학습 순서\n- [[source-catalog]] — 원자료 단위에서 새 목표 탐색\n- [[question-elements]] — 연습·기출의 구체 요구사항과 재수록 제거 빈도\n- [[source-authoring-design]] — 두 설계 경로와 계획서\n- [[topic-map]] — 주제와 설계 지침\n- [[coverage-map]] — 분포·직접 출처 미연결·유형\n- [[requirement-coverage]] — 요구사항·학습목표와 공백 후보\n- [[source-review-map]] — 검토 기록·공식 출처·판본 상태\n- [[question-generation-workflow]] — 생성부터 게시까지\n- [스키마](SCHEMA.md) · [갱신 기록](log.md)\n\n## Concepts\n\n교재 흐름에 따른 학습 순서다. 주제 ID와 장별 연결은 [[ox-study-order]]에서 확인한다.\n\n${studyTopics.map((t, index) => `${index + 1}. ${definitions.get(t.id).title} — [[${t.slug}]] · ${axis(t)}`).join('\n')}\n\n## Question Generation\n\n${orderedGuides.map((p) => `- [[${path.basename(p, '.md')}]]`).join('\n')}\n\n## Questions\n\n${orderedBank.map((s) => `- [[${s.id}]] — ${inline(s.title)}`).join('\n')}\n\n## Meta\n\n- [[topic-map]]\n- [[coverage-map]]\n- [[requirement-coverage]]\n- [[source-review-map]]\n- [[source-manifest]]\n- [[source-catalog]]\n${catalogIndex}`);
  return { pages, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pages, summary } = buildWiki();
  for (const [relative, body] of pages) {
    const target = path.join(summary.wikiDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf8');
  }
  const logPath = path.join(summary.wikiDir, 'log.md');
  const entry = `\n## ${new Date().toISOString()} — 자동 wiki 빌드\n\n생성 ${pages.size}페이지 · 전체 콘텐츠 ${summary.contentPages}페이지 · ${summary.questionSets}세트/${summary.subquestions}물음/${summary.criteria}criterion/${summary.requirements}requirement. 원자료·문제은행 변경 없음. lint·동기화 검사는 별도 명령의 실제 결과를 기록한다.\n`;
  fs.appendFileSync(logPath, entry);
  console.log(JSON.stringify(summary, null, 2));
}
