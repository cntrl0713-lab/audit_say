import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SOURCE_CATALOG_VERSION = 'source-catalog-context-v1';
const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEARNING = 'cpa_uploader/data/회계감사_통합학습자료';
const OFFICIAL = 'cpa_uploader/data/official';
const REGISTRY = 'cpa_uploader/config/question-source-registry.json';
const sha = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const slash = (value) => value.replaceAll('\\', '/');
const normalized = (value) => value.replace(/\s+/gu, ' ').trim();
const inAppendix = (unit) => /(?:보론|부록|appendix)/iu.test(unit.context.section);

function filesIn(repoDir, directory, extensions) {
  const absolute = path.join(repoDir, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesIn(repoDir, file, extensions)
      : extensions.some((ext) => entry.name.endsWith(ext)) ? [file] : [];
  }).sort();
}

// Offsets retain the actual newline bytes: quote and contentHash refer to the
// original file, while one-based line positions remain readable in editors.
function lineData(text) {
  const lines = text.split(/\r?\n/u);
  const offsets = [0];
  for (const match of text.matchAll(/\r?\n/gu)) offsets.push(match.index + match[0].length);
  return { text, lines, offsets };
}

function exactRange(data, start, end) {
  while (end > start && /^\s*(?:---+)?\s*$/u.test(data.lines[end - 1])) end--;
  return { quote: data.text.slice(data.offsets[start], end < data.offsets.length ? data.offsets[end] : data.text.length).trimEnd(), startLine: start + 1, endLine: end };
}

export function parseSourceToc(text) {
  let topicId = null;
  const links = [];
  const topics = [];
  text.split(/\r?\n/u).forEach((line, index) => {
    if (/^##\s/u.test(line)) topicId = null;
    const heading = line.match(/^###\s+(\d{2})\.\s+(.+)$/u);
    if (heading) { topicId = heading[1]; topics.push({ id: topicId, title: heading[2], keywords: [] }); }
    const keywords = line.match(/^\s*-\s*탐색어:\s*(.+)$/u);
    if (keywords && topicId) topics.at(-1).keywords = keywords[1].split(',').map((word) => word.trim());
    const link = line.match(/^\s*-\s+`([^`]+\.md)`:\s*(.+)$/u);
    if (!link || !topicId) return;
    const pages = [];
    for (const match of link[2].matchAll(/(\d+)(?:\s*[-–~]\s*(\d+))?/gu)) {
      const start = Number(match[1]);
      const end = Number(match[2] || match[1]);
      if (end < start || end - start > 5000) throw new Error(`잘못된 목차 페이지 범위: ${line}`);
      for (let page = start; page <= end; page++) pages.push(page);
    }
    if (pages.length) links.push({ topicId, file: `${LEARNING}/${slash(link[1])}`, pages: [...new Set(pages)], startLine: index + 1 });
  });
  return { topics, links };
}

function topicIdsFor(standard, registry, extra = []) {
  return [...new Set([...registry.topics.filter((topic) => topic.standards.includes(standard)).map((topic) => topic.id), ...extra])].sort();
}

function standardFromHeading(heading) {
  if (/^(?:ETHICS|공인회계사윤리기준)(?:\s|:|$)/u.test(heading)) return '공인회계사윤리기준';
  if (/^분·반기재무제표 검토준칙(?:\s|:|$)/u.test(heading)) return '분·반기재무제표 검토준칙';
  const match = heading.match(/^(?:KGA|감사기준서)\s*(\d{3,4})(?=\s|:|$)/u);
  return match ? `KGA ${match[1]}` : null;
}

function unitFromRange(data, source, start, end, details, occurrences) {
  const range = exactRange(data, start, end);
  if (!range.quote) return null;
  const location = details.paragraph ? `${details.standard}:${inAppendix(details) ? `${details.context.section}:` : ''}p${details.paragraph}`
    : details.page ? `page:${details.page}` : `section:${details.context.section}`;
  const key = `${source.file}\n${location}`;
  const occurrence = (occurrences.get(key) || 0) + 1;
  occurrences.set(key, occurrence);
  const id = `src-${sha(key).slice(0, 18)}${occurrence > 1 ? `-${occurrence}` : ''}`;
  return {
    id, sourceId: source.id, file: source.file, title: details.title || source.title,
    authority: source.authority, kind: source.kind, edition: details.edition || source.edition,
    provenance: details.provenance || source.provenance, warnings: details.warnings || [],
    ...range, contentHash: sha(range.quote), ...details,
    locator: `${details.standard || source.title}${inAppendix(details) ? ` ${details.context.section}` : ''}${details.paragraph ? ` ${inAppendix(details) ? '항목' : '문단'} ${details.paragraph}` : ''}${details.page ? ` 원문 페이지 ${details.page}` : ''}; L${range.startLine}-L${range.endLine}`,
    dependencies: [],
  };
}

function standardUnits(data, source, registry, metadata19) {
  const units = [];
  const repeatedWithoutPage = new Set();
  const occurrences = new Map();
  let standard = null;
  let title = source.title;
  let section = '';
  let sectionPath = [];
  let sectionStart = 0;
  let page = null;
  let current = null;
  let sectionHasParagraph = false;
  let sectionMetadata = {};
  let directExcerpt = false;
  let excerptHasPage = false;
  const context = () => ({ section, sectionId: `section-${sha(`${source.file}\n${standard}\n${section}`).slice(0, 18)}` });
  const flush = (end) => {
    if (!current) return;
    const unit = unitFromRange(data, source, current.start, end, current.details, occurrences);
    if (unit) units.push(unit);
    current = null;
  };
  const flushUnnumberedSection = (end) => {
    if (!standard || sectionHasParagraph || /목차|^$/u.test(section)) return;
    const quote = exactRange(data, sectionStart, end).quote;
    if (quote.length < 30 || /^#{1,6}[^\n]+$/u.test(quote)) return;
    const unit = unitFromRange(data, source, sectionStart, end, {
      standard, paragraph: null, page, title, topicIds: topicIdsFor(standard, registry, source.extraTopicIds),
      context: context(), ...sectionMetadata,
    }, occurrences);
    if (unit) units.push(unit);
  };
  for (let index = 0; index < data.lines.length; index++) {
    const line = data.lines[index];
    const heading = line.match(/^(#{1,6})\s+(.+)$/u)
      || (source.authority === 'official_transcription' && /^(?:보론|부록)\s*\d+(?=\s|[(:]|$)/u.test(line.trim()) ? [line, '###', line.trim()] : null);
    const pageHeading = line.match(/^(?:#{1,6}\s+)?PDF(?: PAGE)?\s+(\d+)/u);
    if (pageHeading) { page = Number(pageHeading[1]); if (directExcerpt) excerptHasPage = true; continue; }
    if (heading) {
      flush(index);
      flushUnnumberedSection(index);
      const code = standardFromHeading(heading[2]);
      const special = source.file === registry.topic19.file
        ? registry.topic19.sections.find((entry) => heading[2].startsWith(entry.prefix)) : null;
      if (code || special) {
        standard = code || special.standard;
        title = heading[2];
        sectionPath = [];
        sectionMetadata = {};
        if (special) {
          const metadata = metadata19.find((entry) => special.metadataName
            ? entry.file?.endsWith(`/${special.metadataName}`) : entry.url?.includes(special.metadataUrlIncludes));
          sectionMetadata = {
            edition: [metadata?.version, metadata?.effective, metadata?.scope, special.warning].filter(Boolean).join('; ') || source.edition,
            provenance: [source.provenance, metadata?.url, metadata?.checked_at ? `확인 기록 ${metadata.checked_at}` : '', special.warning].filter(Boolean).join('\n'),
            warnings: special.warning ? [special.warning] : [],
          };
        }
      }
      sectionPath[heading[1].length - 1] = heading[2];
      sectionPath.length = heading[1].length;
      section = sectionPath.filter(Boolean).join(' / ');
      directExcerpt = source.authority === 'official_transcription' && sectionPath.includes('직접 문단 발췌');
      if (heading[2] === '직접 문단 발췌') excerptHasPage = false;
      sectionStart = index;
      sectionHasParagraph = false;
      continue;
    }
    if (/^\[[\dA.\w-]+\]\s*$/u.test(line)) { flush(index); continue; }
    if (!standard || /목차/u.test(section)) continue;
    const paragraph = (standard === '공인회계사윤리기준' ? line.match(/^ {0,2}(\d{3}\.\d{1,3})\s+/u) : null)
      || line.match(/^ {0,2}(A?\d{1,3})\.\s+/u)
      || (source.file === registry.topic19.file ? line.match(/^(\d{1,3})\s+(?=[가-힣])/u) : null)
      || (source.file === registry.topic19.file && standard === '검토업무기준' ? line.match(/^(\d{1,3})\s*$/u) : null);
    if (paragraph && !line.includes('](#')) {
      flush(index);
      if (directExcerpt && !excerptHasPage) repeatedWithoutPage.add(index + 1);
      current = { start: index, details: {
        standard, paragraph: paragraph[1], page, title, topicIds: topicIdsFor(standard, registry, source.extraTopicIds),
        context: context(), ...sectionMetadata,
      } };
      sectionHasParagraph = true;
    }
  }
  flush(data.lines.length);
  flushUnnumberedSection(data.lines.length);
  // Appended direct excerpts have no page of their own. Do not let the last
  // earlier PDF heading masquerade as their provenance. Match only an earlier
  // paragraph in this same file, preserving every quotation byte and unit ID.
  for (const unit of units.filter((entry) => repeatedWithoutPage.has(entry.startLine))) {
    const quote = unit.quote.replace(/\s/gu, '');
    const originals = units.filter((entry) => entry.startLine < unit.startLine
      && !repeatedWithoutPage.has(entry.startLine) && entry.standard === unit.standard
      && entry.paragraph === unit.paragraph && inAppendix(entry) === inAppendix(unit)
      && entry.page !== null && entry.quote.replace(/\s/gu, '').includes(quote));
    const pages = [...new Set(originals.map((entry) => entry.page))];
    const inheritedPage = unit.page;
    unit.page = pages.length === 1 ? pages[0] : null;
    if (inheritedPage !== null) unit.locator = unit.locator.replace(` 원문 페이지 ${inheritedPage};`, `${unit.page === null ? '' : ` 원문 페이지 ${unit.page}`};`);
    else if (unit.page !== null) unit.locator = unit.locator.replace('; L', ` 원문 페이지 ${unit.page}; L`);
    if (unit.page === null) unit.warnings = [...unit.warnings, '직접 문단 발췌의 원문 페이지를 고유하게 확인하지 못함. 앞선 PDF 쪽수를 상속하지 않았으며 원전의 연속 쪽·각주·판본을 대조해야 한다.'];
  }
  return units;
}

function pageUnits(data, source, tocLinks) {
  const headings = [];
  data.lines.forEach((line, index) => {
    const match = line.match(/^##\s+원문 페이지\s+(\d+)/u);
    if (match) headings.push({ index, page: Number(match[1]) });
  });
  const occurrences = new Map();
  return headings.map(({ index, page }, position) => unitFromRange(data, source, index,
    headings[position + 1]?.index ?? data.lines.length, {
      standard: null, paragraph: null, page,
      topicIds: [...new Set(tocLinks.filter((link) => link.file === source.file && link.pages.includes(page)).map((link) => link.topicId))].sort(),
      context: { section: `원문 페이지 ${page}`, sectionId: `page-${sha(`${source.file}\n${page}`).slice(0, 18)}` },
      warnings: ['OCR 원문 페이지 단위 자료. 문제·해설의 경계와 전후 페이지 연속성을 사람이 확인해야 한다.'],
    }, occurrences)).filter(Boolean);
}

function paragraphReferences(quote, currentStandard) {
  const text = normalized(quote);
  const result = [];
  // Parenthetical sub-items are resolved to their full parent paragraph.
  const expression = /(?:문단|paragraphs?)\s*((?:A?\d+[A-Z]?)(?:\([a-z0-9]+\))?(?:\s*(?:[-–~·,]|및|와|과|또는|그리고)\s*(?:문단\s*)?A?\d+[A-Z]?(?:\([a-z0-9]+\))?)*)/giu;
  for (const match of text.matchAll(expression)) {
    const prefix = text.slice(Math.max(0, match.index - 130), match.index);
    const explicit = prefix.match(/(감사기준서|KGA|ISA|IFRS|IAS)\s*(\d{1,4})(?:\s*[‘“"'][^’”"']+[’”"'])?\s*(?:의\s*)?$/u);
    const standard = explicit
      ? `${explicit[1] === '감사기준서' ? 'KGA' : explicit[1]} ${explicit[2].length === 4 && !['1100', '1200'].includes(explicit[2]) ? explicit[2].slice(0, 3) : explicit[2]}` : currentStandard;
    const refs = match[1].replace(/\([a-z0-9]+\)/giu, '');
    for (const range of refs.matchAll(/(A?)(\d+)([A-Z]?)(?:\s*[-–~]\s*(A?)(\d+)([A-Z]?))?/gu)) {
      const start = Number(range[2]);
      const end = Number(range[5] || range[2]);
      if (end < start || end - start > 200 || (range[5] && (range[3] || range[6]))) {
        result.push({ standard, paragraph: null, reason: `해석하지 못한 참조 범위: ${match[0]}` });
        continue;
      }
      for (let value = start; value <= end; value++) result.push({
        standard: range[3] && !explicit ? '참조 기준서 확인 필요' : standard,
        paragraph: `${range[1] || range[4] || ''}${value}${range[3]}`, reason: match[0],
      });
    }
  }
  // A citation to an entire other standard is not silently treated as evidence
  // for a particular rule, nor expanded into an unbounded full-standard prompt.
  for (const match of text.matchAll(/(?:감사기준서|KGA|ISA)\s*(\d{3,4})/gu)) {
    const code = match[1].length === 4 && !['1100', '1200'].includes(match[1]) ? match[1].slice(0, 3) : match[1];
    const standard = `${match[0].startsWith('ISA') ? 'ISA' : 'KGA'} ${code}`;
    if (standard !== currentStandard && !result.some((entry) => entry.standard === standard))
      result.push({ standard, paragraph: null, reason: `${match[0]} 교차참조의 적용 문단을 지정해야 함` });
  }
  for (const match of text.matchAll(/(?:보론|부록|appendix)\s*(\d+)?/giu))
    result.push({ standard: currentStandard, paragraph: null, appendix: match[1] || '', reason: `${match[0]} 원문 문맥 참조` });
  return [...new Map(result.map((entry) => [`${entry.standard}:${entry.paragraph}:${entry.appendix ?? '-'}`, entry])).values()];
}

function preferred(units, from) {
  return [...units].sort((left, right) => {
    const rank = (unit) => (unit.authority === 'official_transcription' ? 100 : 0)
      + (from && unit.file === from.file ? 10 : 0) + (unit.quote.length > 60 ? 1 : 0);
    return rank(right) - rank(left) || right.quote.length - left.quote.length || left.id.localeCompare(right.id);
  })[0];
}


// Confirmed PDF footnote ownership affects reference inference only. Source
// quotations, offsets, identifiers and hashes retain their original bytes.
function referenceTextsWithFootnotes(units, sources, assignments = []) {
  const result = new Map(units.map((unit) => [unit.id, unit.quote]));
  for (const assignment of assignments) {
    const source = sources.find((entry) => entry.file === assignment.file);
    if (!source) continue; // Registry entries outside a bounded fixture catalog.
    if (source.contentHash !== assignment.source_hash) throw new Error('각주 귀속의 출처 해시가 변경되었습니다: ' + assignment.file);
    const matching = (paragraph) => units.filter((unit) => unit.file === assignment.file
      && unit.standard === assignment.standard && unit.paragraph === paragraph && !inAppendix(unit));
    const from = matching(assignment.from_paragraph), owners = matching(assignment.owner_paragraph);
    if (from.length !== 1 || owners.length !== 1 || from[0].id === owners[0].id)
      throw new Error('각주 귀속 문단을 고유하게 확인할 수 없습니다: ' + assignment.file);
    const body = assignment.footnote_text;
    const number = assignment.footnote_number;
    if (typeof number !== 'string' || !/^[1-9]\d{0,3}$/u.test(number)
      || typeof body !== 'string' || !body.startsWith(`${number} `)
      || typeof assignment.owner_callout !== 'string'
      || !new RegExp(`(?<!\\d)${number}(?!\\d)`, 'u').test(assignment.owner_callout))
      throw new Error('각주 번호와 본문·호출 번호가 일치하지 않습니다: ' + assignment.file);
    const input = result.get(from[0].id);
    if (!body || input.indexOf(body) < 0 || input.indexOf(body) !== input.lastIndexOf(body)
      || !assignment.owner_callout || !owners[0].quote.includes(assignment.owner_callout))
      throw new Error('각주 본문·호출 원문의 확인이 필요합니다: ' + assignment.file);
    result.set(from[0].id, input.replace(body, ''));
    result.set(owners[0].id, result.get(owners[0].id) + '\n' + body);
  }
  return result;
}

// A verified multi-page excerpt may omit intervening page furniture/footnotes.
// The explicit fragments must reconstruct its complete wording, and each page
// must come from the real preceding PDF marker in the immutable source file.
function applyConfirmedPageRanges(units, sources, repoDir, assignments = []) {
  for (const assignment of assignments) {
    const source = sources.find((entry) => entry.file === assignment.file);
    if (!source) continue; // Bounded fixture catalogs need not contain this file.
    const fail = () => { throw new Error('확인된 원문 페이지 범위의 근거가 일치하지 않습니다: ' + assignment.file); };
    const matches = units.filter((unit) => unit.id === assignment.unit_id && unit.file === assignment.file);
    if (source.authority !== 'official_transcription' || source.contentHash !== assignment.source_hash || matches.length !== 1) fail();
    const unit = matches[0];
    if (unit.contentHash !== assignment.quote_hash || !Array.isArray(assignment.fragments) || !assignment.fragments.length) fail();
    const lines = lineData(fs.readFileSync(path.join(repoDir, source.file), 'utf8')).lines;
    const fragments = [];
    let previousEnd = 0;
    for (const fragment of assignment.fragments) {
      if (!Number.isInteger(fragment.start_line) || !Number.isInteger(fragment.end_line)
        || fragment.start_line <= previousEnd || fragment.end_line < fragment.start_line || fragment.end_line > lines.length) fail();
      const marker = lines.slice(0, fragment.start_line - 1).map((line) => line.match(/^(?:#{1,6}\s+)?PDF(?: PAGE)?\s+(\d+)/u)).filter(Boolean).at(-1);
      if (!marker || Number(marker[1]) !== fragment.page) fail();
      const text = lines.slice(fragment.start_line - 1, fragment.end_line).join('\n');
      if (sha(text) !== fragment.quote_hash || /^(?:#{1,6}\s+)?PDF(?: PAGE)?\s+\d+/mu.test(text)) fail();
      fragments.push(text);
      previousEnd = fragment.end_line;
    }
    const pages = assignment.fragments.map((fragment) => fragment.page);
    if (pages.some((page, index) => !Number.isInteger(page) || page < 1 || (index > 0 && page < pages[index - 1]))
      || fragments.join('\n').replace(/\s/gu, '') !== unit.quote.replace(/\s/gu, '')) fail();
    const first = pages[0], last = pages.at(-1);
    unit.page = first;
    unit.locator = unit.locator.replace(/ 원문 페이지 \d+(?:[–-]\d+)?(?=; L)/u, '');
    unit.locator = unit.locator.replace('; L', ` 원문 페이지 ${first === last ? first : `${first}–${last}`}; L`);
    unit.warnings = unit.warnings.filter((warning) => !warning.startsWith('직접 문단 발췌의 원문 페이지를 고유하게 확인하지 못함.'));
  }
}

export function buildSourceCatalog({ repoDir = DEFAULT_ROOT } = {}) {
  const registryText = fs.readFileSync(path.join(repoDir, REGISTRY), 'utf8');
  const registry = JSON.parse(registryText);
  const tocFile = `${LEARNING}/00_통합_목차.md`;
  const tocText = fs.readFileSync(path.join(repoDir, tocFile), 'utf8');
  const toc = parseSourceToc(tocText);
  const metadataText = fs.existsSync(path.join(repoDir, registry.topic19.metadataFile))
    ? fs.readFileSync(path.join(repoDir, registry.topic19.metadataFile), 'utf8') : '[]';
  const metadata19 = JSON.parse(metadataText);
  const sources = [];
  const units = [];
  const warnings = [];
  const files = [...filesIn(repoDir, OFFICIAL, ['.txt', '.md']),
    ...['01_감사기준', '02_기본이론', '03_문제연습', '04_기출문제'].flatMap((directory) => filesIn(repoDir, `${LEARNING}/${directory}`, ['.md']))];
  for (const file of files) {
    const text = fs.readFileSync(path.join(repoDir, file), 'utf8');
    const official = file.startsWith(`${OFFICIAL}/`);
    const kind = official || file.includes('/01_감사기준/') ? 'standard'
      : file.includes('/03_문제연습/') ? 'practice' : file.includes('/04_기출문제/') ? 'past_exam' : 'theory';
    const header = text.split(/\r?\n/u).slice(0, 12).filter((line) => /https?:|확인|개정|시행|Checked|출처/iu.test(line)).join('\n');
    const source = {
      id: `file-${sha(file).slice(0, 18)}`, file, title: path.basename(file, path.extname(file)),
      authority: official ? 'official_transcription' : 'learning_material', kind,
      edition: header || (official ? '로컬 공식 전사 파일. 판본 기록 추가 확인 필요.' : '학습자료/OCR 전사. 공식 판본 대조 필요.'),
      provenance: [header, registry.editionPolicy].filter(Boolean).join('\n'), contentHash: sha(text),
      extraTopicIds: file === registry.topic19.file ? ['19'] : [], unitIds: [], topicIds: [],
    };
    const fileUnits = kind === 'standard' ? standardUnits(lineData(text), source, registry, metadata19) : pageUnits(lineData(text), source, toc.links);
    source.unitIds = fileUnits.map((unit) => unit.id);
    source.topicIds = [...new Set(fileUnits.flatMap((unit) => unit.topicIds))].sort();
    sources.push(source);
    units.push(...fileUnits);
  }
  applyConfirmedPageRanges(units, sources, repoDir, registry.confirmedPageRanges || []);
  const byParagraph = new Map();
  for (const unit of units.filter((entry) => entry.paragraph && !inAppendix(entry))) {
    const key = `${unit.standard}:${unit.paragraph}`;
    if (!byParagraph.has(key)) byParagraph.set(key, []);
    byParagraph.get(key).push(unit);
  }
  // Markdown section boundaries supply readable context for PDF transcriptions,
  // without replacing official wording with learning-material paraphrases.
  for (const unit of units.filter((entry) => entry.authority === 'official_transcription' && entry.paragraph && !inAppendix(entry))) {
    const learning = (byParagraph.get(`${unit.standard}:${unit.paragraph}`) || []).find((entry) => entry.authority === 'learning_material');
    if (learning) unit.context = { ...learning.context, mappedFrom: learning.id };
  }
  const referenceTexts = referenceTextsWithFootnotes(units, sources, registry.referenceFootnotes || []);
  for (const unit of units.filter((entry) => entry.kind === 'standard')) {
    const references = paragraphReferences(referenceTexts.get(unit.id), unit.standard);
    for (const group of registry.coherenceGroups.filter((entry) => !inAppendix(unit) && entry.standard === unit.standard && entry.paragraphs.includes(unit.paragraph)))
      references.push(...group.paragraphs.filter((paragraph) => paragraph !== unit.paragraph).map((paragraph) => ({ standard: unit.standard, paragraph, reason: group.reason })));
    unit.dependencies = [...new Map(references.filter((entry) => !entry.paragraph || entry.standard !== unit.standard || entry.paragraph !== unit.paragraph)
      .map((reference) => {
        const target = reference.paragraph ? preferred(byParagraph.get(`${reference.standard}:${reference.paragraph}`) || [], unit) : null;
        const appendixTargets = reference.appendix ? units.filter((candidate) => candidate.standard === reference.standard
          && new RegExp(`(?:보론|부록|appendix)\\s*${reference.appendix}(?:[^0-9]|$)`, 'iu').test(candidate.context.section)) : [];
        return [`${reference.standard}:${reference.paragraph}:${reference.appendix ?? '-'}`, {
          ...reference, targetId: target?.id || appendixTargets[0]?.id || null,
          ...(reference.appendix !== undefined ? { targetIds: appendixTargets.map((candidate) => candidate.id) } : {}),
        }];
      })).values()];
  }
  for (const link of toc.links) {
    const existingPages = new Set(units.filter((unit) => unit.file === link.file).map((unit) => unit.page));
    const missing = link.pages.filter((page) => !existingPages.has(page));
    if (missing.length) warnings.push(`목차 ${link.topicId} ${link.file}: 원문 페이지 미확보 ${missing.join(', ')}`);
  }
  return {
    version: SOURCE_CATALOG_VERSION, registry, sources, units, tocLinks: toc.links, topics: toc.topics, warnings,
    fingerprint: sha([SOURCE_CATALOG_VERSION, fs.readFileSync(fileURLToPath(import.meta.url), 'utf8'), registryText, tocText, metadataText, ...sources.map((source) => `${source.file}:${source.contentHash}`)].join('\n')),
  };
}

export function sourceUnitToRef(unit) {
  return { id: unit.id, file: unit.file, title: unit.title, page: unit.standard || unit.locator,
    source_quote: unit.quote, content_hash: unit.contentHash,
    role: unit.kind === 'standard' ? 'standard' : 'practice',
    source_span: `L${unit.startLine}-L${unit.endLine}; ${unit.locator}` };
}

function sourceInputChars(units) {
  const provenance = units.map((unit) => ({ id: unit.id, file: unit.file, locator: unit.locator,
    authority: unit.authority, edition: unit.edition, provenance: unit.provenance }));
  return JSON.stringify(units.map(sourceUnitToRef), null, 2).length + JSON.stringify(provenance, null, 2).length;
}

/** @param {import('./questionSourceCatalog.d.mts').SourcePacketOptions} options */
export function createSourcePacket({ repoDir = DEFAULT_ROOT, topicId, sourceIds, maxChars = 45_000, catalog: suppliedCatalog, includeSectionContext = sourceIds === undefined }) {
  const catalog = suppliedCatalog || buildSourceCatalog({ repoDir });
  const topic = catalog.registry.topics.find((entry) => entry.id === topicId);
  if (!topic) throw new Error(`알 수 없는 원자료 주제: ${topicId}`);
  if (!Number.isInteger(maxChars) || maxChars <= 0) throw new Error('maxChars는 양의 정수여야 합니다.');
  const byId = new Map(catalog.units.map((unit) => [unit.id, unit]));
  const warnings = [];
  const unresolved = [];
  let primary;
  if (sourceIds !== undefined) {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) throw new Error('sourceIds에는 출제할 원자료 ID를 지정해야 합니다.');
    primary = [...new Set(sourceIds)].map((id) => {
      const unit = byId.get(id);
      if (!unit) throw new Error(`원자료 ID를 찾을 수 없습니다: ${id}`);
      if (!unit.topicIds.includes(topicId)) throw new Error(`원자료 ${id}는 주제 ${topicId}에 연결되어 있지 않습니다.`);
      return unit;
    });
  } else {
    const selected = preferred(catalog.units.filter((unit) => unit.topicIds.includes(topicId) && !inAppendix(unit)
      && unit.standard === topic.defaultSource.standard && unit.paragraph === topic.defaultSource.paragraph));
    if (!selected) throw new Error(`기본 출제 범위 원문이 없습니다: ${topic.defaultSource.standard}.${topic.defaultSource.paragraph}. sourceIds로 범위를 지정하십시오.`);
    primary = [selected];
  }
  const selected = new Map(primary.map((unit) => [unit.id, unit]));
  // Expand only the chosen section, not every sibling section of every cross-reference.
  for (const unit of primary.filter((entry) => includeSectionContext && entry.kind === 'standard')) {
    const siblings = catalog.units.filter((candidate) => candidate.context.sectionId === unit.context.sectionId && candidate.paragraph);
    const grouped = new Map();
    for (const sibling of siblings) {
      const key = `${sibling.standard}:${sibling.paragraph}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(sibling);
    }
    for (const alternatives of grouped.values()) {
      const sibling = preferred(alternatives, unit);
      selected.set(sibling.id, sibling);
    }
  }
  const queue = [...selected.values()];
  for (let index = 0; index < queue.length; index++) {
    const unit = queue[index];
    for (const dependency of unit.dependencies) {
      const targetIds = dependency.targetIds?.length ? dependency.targetIds : [dependency.targetId];
      for (const targetId of targetIds) {
        const target = byId.get(targetId);
        if (!target) { unresolved.push({ sourceId: unit.id, ...dependency }); continue; }
        if (!selected.has(target.id)) { selected.set(target.id, target); queue.push(target); }
      }
    }
  }
  const required = [...selected.values()];
  let charCount = sourceInputChars(required);
  if (charCount > maxChars) throw new Error(`원자료와 필수 문맥 ${charCount}자가 예산 ${maxChars}자를 초과합니다. 원문을 자르지 않았습니다. sourceIds로 더 좁은 문단·절을 선택하십시오.`);
  const supporting = [];
  const keywords = catalog.topics.find((entry) => entry.id === topicId)?.keywords || [];
  for (const kind of ['practice', 'past_exam']) {
    const ranked = catalog.units.filter((unit) => unit.kind === kind && unit.topicIds.includes(topicId) && !selected.has(unit.id) && unit.quote.length >= 150)
      .map((unit) => ({ unit, score: keywords.filter((word) => unit.quote.includes(word)).length }))
      .sort((left, right) => right.score - left.score || left.unit.file.localeCompare(right.unit.file) || left.unit.startLine - right.unit.startLine);
    const candidate = ranked.find(({ unit }) => sourceInputChars([...required, ...supporting, unit]) <= maxChars)?.unit;
    if (candidate) { supporting.push(candidate); charCount = sourceInputChars([...required, ...supporting]); }
    else if (ranked.length) warnings.push(`${kind} 참고 페이지는 문자 예산 때문에 온전한 페이지 단위로 제외했습니다.`);
    else warnings.push(`${kind}의 연결된 원문 페이지가 없습니다.`);
  }
  const packetUnits = [...required, ...supporting];
  for (const unit of packetUnits) warnings.push(...unit.warnings);
  if (required.some((unit) => unit.authority === 'learning_material')) warnings.push('학습자료를 포함합니다. 정답·조건·예외는 공개 전에 적용 판본의 공식 원문과 대조해야 합니다.');
  warnings.push(catalog.registry.editionPolicy);
  const uniqueUnresolved = [...new Map(unresolved.map((entry) => [`${entry.sourceId}:${entry.standard}:${entry.paragraph}:${entry.appendix ?? '-'}`, entry])).values()];
  return {
    topicId, primary, dependencies: required.filter((unit) => !primary.some((entry) => entry.id === unit.id)), supporting,
    units: packetUnits, sourceRefs: packetUnits.map(sourceUnitToRef), warnings: [...new Set(warnings)], unresolved: uniqueUnresolved,
    completeness: uniqueUnresolved.length ? 'unresolved' : 'complete', completenessScope: 'parsed_references',
    charCount, quoteChars: packetUnits.reduce((sum, unit) => sum + unit.quote.length, 0), maxChars,
    fingerprint: sha(JSON.stringify({ version: SOURCE_CATALOG_VERSION, catalog: catalog.fingerprint, topicId, includeSectionContext, primary: primary.map((unit) => unit.id), units: packetUnits.map((unit) => [unit.id, unit.contentHash]), unresolved: uniqueUnresolved })),
  };
}
