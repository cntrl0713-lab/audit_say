import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// cpa_uploader/data의 v3 문제은행과 원자료를 출처로 하는 위키 생성기.
//
// 생성 대상(재생성해도 안전): concepts/, _meta/topic-map·coverage-map, raw/source-manifest, index.md
// 보존 대상(이 스크립트가 건드리지 않음): question-generation/ 수동 검수 문서, log.md(append만), SCHEMA.md
//
// 사용법: node cpa_uploader/wiki/scripts/build-wiki.mjs

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const wikiDir = path.resolve(scriptDir, '..');
const uploaderDir = path.resolve(wikiDir, '..');
const dataDir = path.join(uploaderDir, 'data');
const integratedDir = path.join(dataDir, '회계감사_통합학습자료');
const tocPath = path.join(integratedDir, '00_통합_목차.md');
const bankPath = path.join(dataDir, 'cpa_question_sets_v3.authoring.json');
const today = new Date().toISOString().slice(0, 10);

const topicDefinitions = [
  { id: '01', slug: 'ethics-independence-quality', standards: ['KGA 200', 'KGA 220'], tags: ['audit', 'ethics'] },
  { id: '02', slug: 'audit-objectives-foundations', standards: ['KGA 200'], tags: ['audit'] },
  { id: '03', slug: 'engagement-acceptance-contract', standards: ['KGA 210'], tags: ['audit', 'planning'] },
  { id: '04', slug: 'planning-documentation-materiality', standards: ['KGA 230', 'KGA 300', 'KGA 320'], tags: ['audit', 'planning'] },
  { id: '05', slug: 'fraud-laws-governance-communication', standards: ['KGA 240', 'KGA 250', 'KGA 260', 'KGA 265'], tags: ['audit', 'risk'] },
  { id: '06', slug: 'risk-assessment-internal-control', standards: ['KGA 315', 'KGA 330'], tags: ['audit', 'risk', 'control'] },
  { id: '07', slug: 'responses-controls-substantive-procedures', standards: ['KGA 330'], tags: ['audit', 'risk', 'control', 'procedures'] },
  { id: '08', slug: 'audit-evidence-assertions', standards: ['KGA 500'], tags: ['audit', 'evidence'] },
  { id: '09', slug: 'inventory-litigation-confirmations-opening-balances', standards: ['KGA 501', 'KGA 505', 'KGA 510'], tags: ['audit', 'evidence', 'procedures'] },
  { id: '10', slug: 'analytics-audit-sampling', standards: ['KGA 520', 'KGA 530'], tags: ['audit', 'evidence', 'procedures'] },
  { id: '11', slug: 'estimates-related-parties', standards: ['KGA 540', 'KGA 550'], tags: ['audit', 'evidence', 'procedures'] },
  { id: '12', slug: 'completion-subsequent-events-going-concern', standards: ['KGA 450', 'KGA 560', 'KGA 570', 'KGA 580'], tags: ['audit', 'completion'] },
  { id: '13', slug: 'service-organizations-internal-audit-experts', standards: ['KGA 402', 'KGA 610', 'KGA 620'], tags: ['audit', 'evidence', 'procedures'] },
  { id: '14', slug: 'group-audit', standards: ['KGA 600'], tags: ['audit', 'group-audit'] },
  { id: '15', slug: 'audit-opinions-reports', standards: ['KGA 700', 'KGA 705'], tags: ['audit', 'reporting'] },
  { id: '16', slug: 'kam-emphasis-comparatives-other-information', standards: ['KGA 701', 'KGA 706', 'KGA 710', 'KGA 720'], tags: ['audit', 'reporting'] },
  { id: '17', slug: 'internal-control-over-financial-reporting', standards: ['KGA 1100'], tags: ['audit', 'icfr', 'control'] },
  { id: '18', slug: 'small-entity-audit', standards: ['KGA 1200'], tags: ['audit'] },
  { id: '19', slug: 'assurance-review-related-services', standards: ['KGA 200'], tags: ['audit', 'assurance'] },
];

function cleanText(buffer) {
  return buffer.toString('utf8').replaceAll('\u0000', '');
}

function yamlList(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${content.trimEnd()}\n`, 'utf8');
}

function inlineText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTopics(tocText) {
  const matches = [...tocText.matchAll(/^###\s+(\d+)\.\s+(.+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    let end = index + 1 < matches.length ? matches[index + 1].index : tocText.length;
    const dataSection = tocText.indexOf('\n## 자료 구성', start);
    if (dataSection !== -1 && dataSection < end) end = dataSection;
    const body = tocText.slice(start, end);
    const axis = body.match(/^- 기준 축:\s*(.+)$/m)?.[1]?.trim() || '';
    const terms = (body.match(/^- 탐색어:\s*(.+)$/m)?.[1] || '')
      .split(',')
      .map((term) => term.trim())
      .filter(Boolean);
    const sourceLines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^- `[^`]+\.md`:\s*/.test(line));
    return {
      id: match[1],
      title: match[2].trim(),
      axis,
      terms,
      sourceLines,
    };
  });
}

function setStandards(set) {
  return [...new Set(
    (set.source_refs || [])
      .map((source) => source.page)
      .filter((page) => typeof page === 'string' && page.startsWith('KGA ')),
  )];
}

function topicForSet(set) {
  const classified = topicDefinitions.find((topic) => topic.id === set.classification.topic_id);
  if (classified) return classified;
  const standards = setStandards(set);
  const matched = topicDefinitions.find((topic) => (
    standards.length > 0 && standards.every((standard) => topic.standards.includes(standard))
  ));
  return matched || topicDefinitions.at(-1);
}

function sourceLink(line) {
  const match = line.match(/^- `([^`]+)`:\s*(.+)$/);
  if (!match) return line;
  const target = `../../data/회계감사_통합학습자료/${match[1]}`.split(path.sep).join('/');
  return `- [${match[1]}](${encodeURI(target)}): ${match[2]}`;
}

function buildConceptPage(topic, definition, sets, previous, next) {
  const criteriaCount = sets.reduce((sum, set) => sum + set.subquestions.reduce((acc, q) => acc + q.criteria.length, 0), 0);
  const typeCounts = {};
  for (const set of sets) for (const q of set.subquestions) typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;
  const typeSummary = Object.entries(typeCounts).map(([type, count]) => `${type} ${count}`).join(', ') || '물음 없음';

  const setSection = sets.length
    ? sets.map((set) => {
      const criteriaLines = set.subquestions.map((q) => {
        const claims = q.criteria
          .map((criterion) => `\`${criterion.id}\` ${inlineText(criterion.claim)}`)
          .join(' · ');
        return `- ${q.id}(${q.type}): ${claims || 'criterion 없음'}`;
      }).join('\n');
      const statusNote = set.status === 'published'
        ? '게시 중'
        : set.status === 'verified'
          ? '검증 완료·게시 대기'
          : '검수 대기';
      const setTypeCounts = {};
      for (const q of set.subquestions) setTypeCounts[q.type] = (setTypeCounts[q.type] || 0) + 1;
      const setTypeSummary = Object.entries(setTypeCounts).map(([type, count]) => `${type} ${count}`).join(', ');
      return `### ${set.id}. ${inlineText(set.title)} (${statusNote})\n\n- 물음 구성: ${set.subquestions.map((q) => q.id).join(', ')} · 유형 분포: ${setTypeSummary}\n${criteriaLines}`;
    }).join('\n\n')
    : '> 현재 v3 문제은행에 이 주제의 세트가 없다. 원자료에서 우선 보강할 영역이다.';

  const sources = definition.sourceLines.length
    ? definition.sourceLines.map(sourceLink).join('\n')
    : '- [[source-manifest]]에서 탐색 후 사람이 출처를 지정해야 한다.';

  return `---
title: ${definition.title}
created: 2026-08-08
updated: ${today}
type: concept
status: generated
review_required: true
tags: ${yamlList([...new Set([...topic.tags, 'question-generation'])])}
sources: ${yamlList(['cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md', 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'])}
confidence: medium
---

# ${definition.id}. ${definition.title}

## 범위

- 기준 축: ${definition.axis || '원자료 확인 필요'}
- 현재 문제은행 연결 기준: ${[...new Set(sets.flatMap((set) => set.classification.standards))].join('·') || '연결 없음'}
- 탐색어: ${definition.terms.join(', ') || '원자료 확인 필요'}
- 현재 연결된 문제 세트: ${sets.length}개
- 현재 연결된 criterion: ${criteriaCount}개
- 주제 전체 유형 분포: ${typeSummary}

## 문제 생성 관점

- 핵심개념과 정의를 묻는 \`descriptive\`
- 조건 또는 결론을 판단하고 근거를 묻는 \`judgment\`
- 독립된 절차·고려사항을 요구하는 \`enumeration\`
- 같은 개념의 정의 → 적용 조건 → 절차 또는 보고효과를 연계형 물음으로 구성
- 실제 산술을 요구하는 문제는 제외하고, 기준서상 수치·기간 자체를 묻는 경우만 허용

## v3 문제은행 연결 현황

아래 criterion claim과 게시 상태는 현재 정본의 기록이다. 생성된 목록 자체는 공식 출처 대조나 사람 검수 완료를 보증하지 않는다.
새 문제를 만들 때는 중복 명제 탐색에 참고하고 해당 검토 보고서와 공식 근거를 확인한다.

${setSection}

## 원자료 탐색

아래 페이지 범위는 통합 목차가 제공한 탐색 인덱스다. 새 문제를 만들 때 최소한 기준서 또는 기본이론과 실제 문제 발문을 함께 확인한다.

${sources}

## 검증 상태

- 새로 만드는 문제는 [[question-output-schema]] 계약과 validateQuestionSetV3 검증을 통과해야 한다.
- 상태 전환(needs_review → verified → published)은 promote_cpa_v3.ts와 승급 장부로만 수행한다.
- OCR 훼손이나 서로 다른 자료의 답안 충돌은 추정하지 말고 verification.notes에 남긴다.

## Related

- [[${previous.slug}]]
- [[${next.slug}]]
- [[question-generation-workflow]]
- [[question-design]]
`;
}

function allFiles(root) {
  const results = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) results.push(...allFiles(full));
    else results.push(full);
  }
  return results;
}

function buildSourceManifest() {
  const files = allFiles(dataDir)
    .filter((file) => ['.md', '.txt', '.json', '.sql'].includes(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const records = files.map((file) => {
    const body = fs.readFileSync(file);
    return {
      path: path.relative(uploaderDir, file).split(path.sep).join('/'),
      bytes: body.length,
      sha: crypto.createHash('sha256').update(body).digest('hex'),
      nullBytes: body.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0),
    };
  });
  const groups = new Map();
  for (const record of records) {
    const group = groups.get(record.sha) || [];
    group.push(record.path);
    groups.set(record.sha, group);
  }
  const duplicateHashes = new Map([...groups].filter(([, paths]) => paths.length > 1).map(([sha], index) => [sha, `D${index + 1}`]));
  const rows = records.map((record) => {
    const duplicate = duplicateHashes.get(record.sha) || '';
    const status = record.nullBytes > 0 ? 'NUL 포함·정제 읽기 필요' : '정상';
    return `| \`${record.path}\` | ${record.bytes} | \`${record.sha.slice(0, 12)}\` | ${record.nullBytes} | ${duplicate} | ${status} |`;
  }).join('\n');
  return `---
title: 원자료 매니페스트
created: 2026-08-08
updated: ${today}
type: source-map
status: generated
review_required: true
tags: [audit, source-map, quality]
sources: [cpa_uploader/data]
confidence: high
---

# 원자료 매니페스트

> 위키는 원자료를 복제하지 않는다. 아래 파일은 \`cpa_uploader/data\`에 있는 immutable source layer로 취급한다.

- 파일 수: ${records.length}
- 동일 해시를 가진 중복 그룹 수: ${duplicateHashes.size}
- NUL 바이트가 포함된 파일 수: ${records.filter((record) => record.nullBytes > 0).length}

| 경로 | bytes | SHA-256 앞 12자 | NUL bytes | 중복 그룹 | 상태 |
|---|---:|---|---:|---|---|
${rows}

## 사용 규칙

- SHA가 같은 파일은 별도 출처가 아니라 동일 복제본일 수 있으므로 중복 문제 생성에 주의한다.
- NUL 바이트가 있는 마크다운은 일반 텍스트 도구가 binary로 판단할 수 있다. 읽을 때 NUL을 제거하되 원본 파일은 수정하지 않는다.
- 주제별 페이지 탐색은 [[topic-map]], 현재 문제 커버리지는 [[coverage-map]]을 사용한다.
- 원자료 품질 기록은 \`data/회계감사_통합학습자료/99_문맥_교정_기록.md\`와 관련 QA 문서를 확인한다.

## Related

- [[topic-map]]
- [[coverage-map]]
- [[question-generation-workflow]]
`;
}

const tocText = cleanText(fs.readFileSync(tocPath));
const parsedTopics = parseTopics(tocText);
if (!fs.existsSync(bankPath)) throw new Error(`v3 문제은행이 없습니다: ${bankPath}`);
const bank = JSON.parse(cleanText(fs.readFileSync(bankPath)));
const definitionsById = new Map(parsedTopics.map((topic) => [topic.id, topic]));
const setsByTopic = new Map(topicDefinitions.map((topic) => [topic.id, []]));
for (const set of bank) setsByTopic.get(topicForSet(set).id).push(set);

ensureDir(path.join(wikiDir, 'concepts'));
ensureDir(path.join(wikiDir, '_meta'));
ensureDir(path.join(wikiDir, 'raw'));

for (let index = 0; index < topicDefinitions.length; index += 1) {
  const topic = topicDefinitions[index];
  const definition = definitionsById.get(topic.id);
  if (!definition) throw new Error(`통합 목차에서 topic ${topic.id}를 찾을 수 없습니다.`);
  const previous = topicDefinitions[(index - 1 + topicDefinitions.length) % topicDefinitions.length];
  const next = topicDefinitions[(index + 1) % topicDefinitions.length];
  write(
    path.join(wikiDir, 'concepts', `${topic.slug}.md`),
    buildConceptPage(topic, definition, setsByTopic.get(topic.id), previous, next),
  );
}

const topicMapRows = topicDefinitions.map((topic) => {
  const definition = definitionsById.get(topic.id);
  const sets = setsByTopic.get(topic.id);
  const standardAxis = topic.standards.length ? topic.standards.join('·') : (definition.axis || '원자료 확인 필요');
  return `| ${topic.id} | [[${topic.slug}]] | ${standardAxis} | ${definition.terms.join(', ')} | ${sets.length}세트 |`;
}).join('\n');
write(path.join(wikiDir, '_meta', 'topic-map.md'), `---
title: 회계감사 주제 지도
created: 2026-08-08
updated: ${today}
type: source-map
status: generated
review_required: false
tags: [audit, source-map, question-generation]
sources: ${yamlList(['cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md', 'cpa_uploader/data/cpa_question_sets_v3.authoring.json'])}
confidence: high
---

# 회계감사 주제 지도

| ID | 주제 | 기준 축 | 탐색어 | v3 세트 |
|---|---|---|---|---:|
${topicMapRows}

## 사용법

1. 보강할 주제를 [[coverage-map]]에서 선택한다.
2. 해당 concept 페이지의 v3 연결 현황과 원자료 페이지를 확인한다.
3. [[question-generation-workflow]]에 따라 발문과 답안을 분리 추출한다.

## Related

- [[coverage-map]]
- [[source-manifest]]
- [[question-design]]
`);

const coverageRows = topicDefinitions.map((topic) => {
  const definition = definitionsById.get(topic.id);
  const sets = setsByTopic.get(topic.id);
  const criteriaCount = sets.reduce((sum, set) => sum + set.subquestions.reduce((acc, q) => acc + q.criteria.length, 0), 0);
  const subquestionCount = sets.reduce((sum, set) => sum + set.subquestions.length, 0);
  const publishedCount = sets.filter((set) => set.status === 'published').length;
  const status = sets.length === 0 ? '빈 영역' : sets.length <= 2 ? '우선 보강' : sets.length <= 3 ? '보강 권장' : '충분';
  // 세트 수가 충분해도 주제 축의 기준서 하나가 통째로 비어 있을 수 있다. 상태 열만으로는 보이지 않는다.
  const linkedStandards = new Set(sets.flatMap((set) => set.classification.standards || []));
  const unlinked = topic.standards.filter((standard) => !linkedStandards.has(standard));
  const ids = sets.length ? sets.map((set) => `${set.id}(${set.subquestions.length}문항/${set.subquestions.reduce((acc, q) => acc + q.criteria.length, 0)}루브릭)`).join(', ') : '-';
  const standardAxis = topic.standards.length ? topic.standards.join('·') : (definition.axis || '원자료 확인 필요');
  return `| ${topic.id} | [[${topic.slug}]] | ${standardAxis} | ${sets.length} | ${subquestionCount} | ${criteriaCount} | ${publishedCount} | ${status} | ${unlinked.length ? unlinked.join('·') : '-'} | ${ids} |`;
}).join('\n');
write(path.join(wikiDir, '_meta', 'coverage-map.md'), `---
title: 문제은행 커버리지 맵
created: 2026-08-08
updated: ${today}
type: coverage
status: generated
review_required: true
tags: [audit, quality, question-generation]
sources: ${yamlList(['cpa_uploader/data/cpa_question_sets_v3.authoring.json'])}
confidence: high
---

# 문제은행 커버리지 맵

> 개수는 현재 v3 authoring 은행(\`cpa_question_sets_v3.authoring.json\`) 기준 분포다.
> 세트 수·criterion 수는 게시 여부나 기준서 요구사항의 완전성을 의미하지 않는다.

| ID | 주제 | 기준 축 | 세트 | 세부 물음 | criterion | published | 상태 | 미연결 기준서 | 세트 ID |
|---|---|---|---:|---:|---:|---:|---|---|---|
${coverageRows}

## 우선순위

1. \`빈 영역\`과 \`우선 보강\` 주제의 실제 원문을 먼저 확인한다.
2. \`미연결 기준서\`가 있는 주제는 상태가 \`충분\`이어도 그 기준서를 다루는 세트가 하나도 없다는 뜻이다. 세트 수보다 먼저 본다.
3. 문제 수가 많아도 judgment·enumeration·descriptive가 한쪽으로 치우치지 않았는지 확인한다.
4. 새 세트는 [[question-generation-workflow]]와 validateQuestionSetV3 검증을 통과한 뒤 promote_cpa_v3.ts로 상태를 올린다.
5. 실제 산술을 요구하는 문제는 coverage 목표에서 제외하고 \`excluded: calculation\`로 기록한다.

## Related

- [[topic-map]]
- [[question-generation-workflow]]
- [[source-manifest]]
`);

write(path.join(wikiDir, 'raw', 'source-manifest.md'), buildSourceManifest());

const conceptIndex = topicDefinitions.map((topic) => {
  const definition = definitionsById.get(topic.id);
  const sets = setsByTopic.get(topic.id);
  const standardAxis = topic.standards.length ? topic.standards.join('·') : (definition.axis || '원자료 확인 필요');
  return `- [[${topic.slug}]] — ${standardAxis} · ${definition.terms.join(', ')} · v3 ${sets.length}세트`;
}).join('\n');
const contentPageCount = topicDefinitions.length + 4 + 3;
const totalSets = bank.length;
const totalCriteria = bank.reduce((sum, set) => sum + set.subquestions.reduce((acc, q) => acc + q.criteria.length, 0), 0);
write(path.join(wikiDir, 'index.md'), `# CPA 회계감사 문제 출제 LLM Wiki

> ` + '`cpa_uploader/data`' + `를 출처로 하는 문제 생성 지식베이스.
> Last updated: ${today} | Content pages: ${contentPageCount} | v3 문제은행: 세트 ${totalSets}개 · criterion ${totalCriteria}개

## Start Here

1. [[topic-map]] — 19개 공통 주제 탐색
2. [[coverage-map]] — v3 문제은행 세트 분포와 보강 우선순위
3. [[question-generation-workflow]] — 출처에서 linked question set을 만드는 절차
4. [[question-output-schema]] — 생성 JSON 계약
5. [[llm-question-generation-prompt]] — LLM 입력 템플릿

## Concepts

${conceptIndex}

## Question Generation

- [[question-design]] — 3개 물음 유형과 정수 배점
- [[question-generation-workflow]] — 발문 우선 추출과 검증 절차
- [[question-output-schema]] — linked question set 출력 구조
- [[llm-question-generation-prompt]] — 출처 기반 생성 프롬프트

## Meta

- [[topic-map]] — 주제·기준서·탐색어 지도
- [[coverage-map]] — v3 문제은행 커버리지
- [[source-manifest]] — 원자료 해시·중복·NUL 상태
`);

console.log(JSON.stringify({
  wikiDir,
  topics: topicDefinitions.length,
  questionSets: totalSets,
  subquestions: bank.reduce((sum, set) => sum + set.subquestions.length, 0),
  criteria: totalCriteria,
  contentPages: contentPageCount,
}, null, 2));
