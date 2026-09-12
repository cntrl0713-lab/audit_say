import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyTopics } from './wiki/scripts/ox-study-order.mjs';
import { buildSourceCatalog } from './questionSourceCatalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRelative = 'cpa_uploader/analysis/question-elements';
const inputNames = ['past-exam.json', 'practice.json', 'ox.json'];
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
export const normalizeElementLabel = text => String(text).normalize('NFKC').replace(/\s+/gu, ' ').trim().replace(/[.。]$/u, '');
const labelKey = text => normalizeElementLabel(text).replace(/\s+/gu, '');
const normalizeQuote = text => String(text).normalize('NFKC').replace(/\s+/gu, '').trim();
const topicIds = new Set(studyTopics.map(topic => topic.id));
const safeText = value => String(value ?? '').replace(/\s+/gu, ' ').replaceAll('|', '&#124;').trim();
const table = (headers, rows) => `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map(row => `| ${row.map(safeText).join(' | ')} |`).join('\n')}`;

// Item numbers remain evidence locators. Repeating one element inside the same
// original subquestion contributes only once to its examination frequency.
export function originalQuestionKey(origin) {
  if (!origin || !['cpa_exam', 'mock'].includes(origin.kind)) return null;
  if (!Number.isInteger(origin.year) || !String(origin.problem ?? '').trim() || !String(origin.subquestion ?? '').trim()) return null;
  return `${origin.kind}:${origin.year}:${origin.problem}:${origin.subquestion}`;
}

export function validateElementInputs(datasets, { repoDir = root } = {}) {
  const errors = [];
  const ids = new Set();
  const sources = new Map();
  const sourceData = new Map();
  for (const dataset of datasets) {
    if (dataset.version !== 1 || !Array.isArray(dataset.records) || !Array.isArray(dataset.sources)) {
      errors.push('Invalid element dataset contract');
      continue;
    }
    for (const source of dataset.sources) {
      const absolute = path.resolve(repoDir, source.file);
      if (!absolute.startsWith(path.resolve(repoDir) + path.sep) || !/\/(?:03_문제연습|04_기출문제)\//u.test(source.file)) {
        errors.push(`Unexpected source path: ${source.file}`);
        continue;
      }
      if (!fs.existsSync(absolute)) { errors.push(`Missing source: ${source.file}`); continue; }
      const bytes = fs.readFileSync(absolute);
      const text = bytes.toString('utf8');
      if (sha(bytes) !== source.sha256?.toLowerCase()) errors.push(`Source hash differs: ${source.file}`);
      const headings = [...text.matchAll(/^## 원문 페이지 (\d+)/gmu)];
      if (headings.length !== source.pages) errors.push(`Page inventory differs: ${source.file}`);
      sources.set(source.file, source);
      sourceData.set(source.file, text.split(/\r?\n/u));
    }
    for (const record of dataset.records) {
      if (!record.id || ids.has(record.id)) errors.push(`Missing/duplicate occurrence ID: ${record.id}`);
      ids.add(record.id);
      const source = record.source;
      const lines = sourceData.get(source?.file);
      if (!lines || !Number.isInteger(source.start_line) || !Number.isInteger(source.end_line)
        || source.start_line < 1 || source.end_line < source.start_line || source.end_line > lines.length) {
        errors.push(`Invalid evidence range: ${record.id}`);
        continue;
      }
      const quote = lines.slice(source.start_line - 1, source.end_line).join('\n').trim();
      if (quote !== String(record.text).replace(/\r\n/gu, '\n').trim()) errors.push(`Evidence quote differs: ${record.id}`);
      const pageHeadings = lines.slice(0, source.start_line).filter(line => /^## 원문 페이지 \d+/u.test(line));
      const page = Number(pageHeadings.at(-1)?.match(/\d+/u)?.[0]);
      if (page !== source.page) errors.push(`Evidence page differs: ${record.id}`);
      if (record.context_source) {
        const context = record.context_source;
        const contextLines = sourceData.get(context.file);
        if (!contextLines || !Number.isInteger(context.start_line) || !Number.isInteger(context.end_line)
          || context.start_line < 1 || context.end_line < context.start_line || context.end_line > contextLines.length) {
          errors.push(`Invalid common context range: ${record.id}`);
        } else {
          const contextHeadings = contextLines.slice(0, context.start_line).filter(line => /^## 원문 페이지 \d+/u.test(line));
          if (Number(contextHeadings.at(-1)?.match(/\d+/u)?.[0]) !== context.page) errors.push(`Common context page differs: ${record.id}`);
        }
      }
      if (!['question', 'author_index'].includes(record.source_role)) errors.push(`Invalid source role: ${record.id}`);
      if (!['extracted', 'needs_review'].includes(record.status)) errors.push(`Invalid extraction status: ${record.id}`);
      if (!record.origin || !['cpa_exam', 'mock', 'practice', 'unknown'].includes(record.origin.kind)) errors.push(`Invalid origin: ${record.id}`);
      if (!Array.isArray(record.elements) || !record.elements.length && record.status === 'extracted' && record.source_role === 'question' && !record.excluded) errors.push(`No elements: ${record.id}`);
      for (const element of record.elements || []) {
        if (!element.label?.trim() || element.topic_id !== null && !topicIds.has(element.topic_id)) errors.push(`Invalid element: ${record.id}`);
        if (!['definition', 'judgment', 'reason', 'procedure', 'list', 'comparison', 'calculation', 'other'].includes(element.kind)) errors.push(`Invalid element kind: ${record.id}`);
      }
    }
  }
  return { errors, sourceFiles: sources.size, records: ids.size };
}

/**
 * @param {object[]} records
 * @param {{elements?: Array<{id: string, label: string, topic_id: string | null, aliases?: string[]}>, mappings?: Array<{source_label: string, element_ids: string[]}>, duplicate_groups?: Array<{id: string, reason: string, record_ids: string[]}>}} registry
 */
export function aggregateQuestionElements(records, registry = { elements: [], duplicate_groups: [] }) {
  const aliases = new Map();
  const definitions = new Map();
  for (const element of registry.elements || []) {
    if (definitions.has(element.id)) throw new Error(`Duplicate canonical element: ${element.id}`);
    definitions.set(element.id, element);
    for (const label of [element.label, ...(element.aliases || [])]) {
      const key = labelKey(label);
      if (aliases.has(key) && aliases.get(key) !== element.id) throw new Error(`Ambiguous element alias: ${label}`);
      aliases.set(key, element.id);
    }
  }
  const expansions = new Map();
  for (const mapping of registry.mappings || []) {
    const key = labelKey(mapping.source_label);
    if (expansions.has(key) || !mapping.element_ids.length || new Set(mapping.element_ids).size !== mapping.element_ids.length || mapping.element_ids.some(id => !definitions.has(id))) throw new Error(`Invalid element expansion: ${mapping.source_label}`);
    expansions.set(key, mapping.element_ids);
  }
  const recordIds = new Set(records.map(record => record.id));
  const duplicateKeys = new Map();
  for (const group of registry.duplicate_groups || []) {
    if (!group.reason?.trim()) throw new Error(`Duplicate group needs evidence: ${group.id}`);
    const origins = new Set(group.record_ids.map(id => originalQuestionKey(records.find(record => record.id === id)?.origin)).filter(Boolean));
    if (origins.size > 1) throw new Error(`Different actual examinations cannot be merged: ${group.id}`);
    const key = [...origins][0] || `reviewed-copy:${group.id}`;
    for (const id of group.record_ids) {
      if (!recordIds.has(id) || duplicateKeys.has(id)) throw new Error(`Invalid duplicate occurrence: ${id}`);
      duplicateKeys.set(id, key);
    }
  }
  const elements = new Map();
  const occurrences = [];
  const questionGroups = new Map();
  const primaryQuestions = new Set(records.filter(record => record.source_role === 'question' && record.status === 'extracted' && record.elements.length)
    .map(record => duplicateKeys.get(record.id) || originalQuestionKey(record.origin)).filter(Boolean));
  const frequencyAuthorities = new Set(records.filter(record => record.frequency_authority && record.source_role === 'question')
    .map(record => originalQuestionKey(record.origin)).filter(Boolean));
  for (const record of records) {
    const originalKey = originalQuestionKey(record.origin);
    const questionKey = duplicateKeys.get(record.id) || originalKey || `unresolved:${record.id}`;
    if (!questionGroups.has(questionKey)) questionGroups.set(questionKey, []);
    questionGroups.get(questionKey).push(record.id);
    const resolved = record.elements.flatMap((raw, rawIndex) => {
      const ids = expansions.get(labelKey(raw.label)) || [aliases.get(labelKey(raw.label))];
      return ids.map((canonicalId, expansionIndex) => ({ raw, rawIndex, expansionIndex, canonicalId }));
    });
    for (const { raw, rawIndex, expansionIndex, canonicalId } of resolved) {
      const normalized = normalizeElementLabel(raw.label);
      const definition = definitions.get(canonicalId);
      const id = canonicalId || `element-${sha(`${raw.topic_id}\n${labelKey(normalized)}`).slice(0, 16)}`;
      if (!elements.has(id)) elements.set(id, {
        id, label: definition?.label || normalized, topic_id: definition?.topic_id ?? raw.topic_id,
        normalization: definition ? 'reviewed_aliases' : 'exact_label_only',
        kinds: new Set(), aliases: new Set(), occurrence_ids: [], source_files: new Set(),
        exam_questions: new Set(), exam_years: new Set(), mock_questions: new Set(),
        index_exam_questions: new Set(), prompt_exam_questions: new Set(),
        unresolved_occurrences: new Set(), practice_occurrences: new Set(),
        confirmed_question_records: new Set(),
      });
      const element = elements.get(id);
      element.kinds.add(raw.kind);
      element.aliases.add(raw.label);
      element.source_files.add(record.source.file);
      if (record.source_role === 'question' && record.status === 'extracted') element.confirmed_question_records.add(record.id);
      const occurrenceId = `${record.id}/element-${rawIndex + 1}-${expansionIndex + 1}`;
      element.occurrence_ids.push(occurrenceId);
      const supersededIndex = record.source_role === 'author_index' && primaryQuestions.has(questionKey);
      const supersededCopy = !record.frequency_authority && frequencyAuthorities.has(questionKey);
      const countable = record.status === 'extracted' && !questionKey.startsWith('unresolved:') && !supersededIndex && !supersededCopy;
      if (countable && questionKey.startsWith('cpa_exam:')) {
        element.exam_questions.add(questionKey);
        element.exam_years.add(Number(questionKey.split(':')[1]));
        (record.source_role === 'author_index' ? element.index_exam_questions : element.prompt_exam_questions).add(questionKey);
      } else if (countable && questionKey.startsWith('mock:') && record.source_role === 'question') {
        element.mock_questions.add(questionKey);
      } else if (record.source_role === 'question' && !supersededCopy) {
        element.unresolved_occurrences.add(record.id);
        if (record.origin.kind === 'practice') element.practice_occurrences.add(record.id);
      }
      occurrences.push({ id: occurrenceId, record_id: record.id, element_id: id, raw_label: raw.label, question_key: questionKey,
        countable, exclusion_reason: supersededIndex ? '같은 원기출의 실제 발문 기록 우선' : supersededCopy ? '원기출 대표 본문에서 빈도 집계; 재수록은 출처로 보존' : !countable ? '원출제 식별 또는 발문·요구 검토 필요' : null,
        source_role: record.source_role, status: record.status, source: record.source });
    }
  }
  const rows = [...elements.values()].map(element => ({
    ...element,
    kinds: [...element.kinds].sort(), aliases: [...element.aliases].sort(), source_files: [...element.source_files].sort(),
    exam_questions: [...element.exam_questions].sort(), exam_years: [...element.exam_years].sort((a, b) => a - b),
    mock_questions: [...element.mock_questions].sort(), index_exam_questions: [...element.index_exam_questions].sort(),
    prompt_exam_questions: [...element.prompt_exam_questions].sort(), unresolved_occurrences: [...element.unresolved_occurrences].sort(),
    practice_occurrences: [...element.practice_occurrences].sort(),
    confirmed_question_records: [...element.confirmed_question_records].sort(),
    catalog_status: element.confirmed_question_records.size ? 'extracted' : 'candidate_only',
    exam_frequency: element.exam_questions.size, exam_year_count: element.exam_years.size,
    latest_exam_year: element.exam_years.size ? Math.max(...element.exam_years) : null,
    mock_frequency: element.mock_questions.size,
  })).sort((a, b) => b.exam_frequency - a.exam_frequency || b.exam_year_count - a.exam_year_count || a.label.localeCompare(b.label, 'ko'));
  const topics = [...studyTopics.map(topic => topic.id), null].map(id => {
    const members = rows.filter(element => element.topic_id === id);
    const questions = new Set(members.flatMap(element => element.exam_questions));
    return { topic_id: id, element_count: members.filter(element => element.catalog_status === 'extracted').length,
      candidate_element_count: members.filter(element => element.catalog_status === 'candidate_only').length, exam_question_count: questions.size,
      element_exam_occurrences: members.reduce((sum, element) => sum + element.exam_frequency, 0),
      exam_years: [...new Set(members.flatMap(element => element.exam_years))].sort((a, b) => a - b),
      mock_question_count: new Set(members.flatMap(element => element.mock_questions)).size };
  });
  // Exact quotations are only review candidates: a generic instruction may be
  // repeated in unrelated cases. Never merge them without original identity.
  const quoted = new Map();
  for (const record of records.filter(record => record.source_role === 'question')) {
    const key = normalizeQuote(record.text);
    if (key.length < 50) continue;
    if (!quoted.has(key)) quoted.set(key, []);
    quoted.get(key).push(record.id);
  }
  const duplicateCandidates = [...quoted.values()].filter(ids => ids.length > 1 && new Set(ids.map(id => duplicateKeys.get(id) || originalQuestionKey(records.find(record => record.id === id).origin) || `unresolved:${id}`)).size > 1)
    .map(ids => ({ record_ids: ids, reason: '같은 발문 인용; 공통 사실과 원출제 ID 대조 필요', status: 'needs_review' }));
  return { version: 1, elements: rows, topics, occurrences,
    question_groups: [...questionGroups].map(([id, record_ids]) => ({ id, record_ids })),
    duplicate_candidates: duplicateCandidates };
}

export function buildQuestionElements({ repoDir = root } = {}) {
  const dir = path.join(repoDir, outputRelative);
  const datasets = inputNames.map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const validation = validateElementInputs(datasets, { repoDir });
  if (validation.errors.length) throw new Error(validation.errors.join('\n'));
  const registryPath = path.join(dir, 'normalization.json');
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : { elements: [], duplicate_groups: [] };
  const records = datasets.flatMap(dataset => dataset.records);
  const byId = new Map(records.map(record => [record.id, record]));
  const overrides = new Set();
  const curation = [];
  for (const name of fs.readdirSync(dir).filter(name => /^curation-.*\.json$/u.test(name)).sort()) {
    const overlay = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (overlay.version !== 1 || !Array.isArray(overlay.records)) throw new Error(`Invalid curation: ${name}`);
    const declared = Object.entries(overlay.source_hashes || {});
    if (!declared.length) throw new Error(`Curation source hashes missing: ${name}`);
    for (const [file, digest] of declared) {
      const source = datasets.flatMap(dataset => dataset.sources).find(source => source.file === file);
      if (!source || source.sha256.toLowerCase() !== String(digest).toLowerCase()) throw new Error(`Stale curation source: ${name}: ${file}`);
    }
    for (const override of overlay.records) {
      const record = byId.get(override.id);
      if (!record || overrides.has(record.id) || !Object.hasOwn(overlay.source_hashes, record.source.file)) throw new Error(`Missing/duplicate curation occurrence: ${name}: ${override.id}`);
      if (!Array.isArray(override.notes) || !override.notes.length) throw new Error(`Curation evidence notes required: ${override.id}`);
      overrides.add(record.id);
      if (override.excluded) {
        record.excluded = true;
        record.elements = [];
      } else {
        record.elements = override.elements;
        record.status = override.status;
      }
      if (override.origin) record.origin = override.origin;
      record.notes = [...record.notes, ...override.notes, `요구사항 의미 대조: ${name}`];
    }
    curation.push({ file: name, records: overlay.records.length, sha256: sha(fs.readFileSync(path.join(dir, name))) });
  }
  const curatedValidation = validateElementInputs([{ version: 1, sources: datasets.flatMap(dataset => dataset.sources), records }], { repoDir });
  if (curatedValidation.errors.length) throw new Error(curatedValidation.errors.join('\n'));
  const activeRecords = records.filter(record => !record.excluded);
  for (const record of activeRecords) {
    record.frequency_authority = record.source.file.endsWith('/기출문제_연도별_해설_A.md') && record.source_role === 'question';
  }
  const catalog = buildSourceCatalog({ repoDir });
  const unitsByFile = new Map();
  for (const unit of catalog.units) {
    if (!unitsByFile.has(unit.file)) unitsByFile.set(unit.file, []);
    unitsByFile.get(unit.file).push(unit);
  }
  const unitIds = source => (unitsByFile.get(source?.file) || [])
    .filter(unit => unit.startLine <= source.end_line && unit.endLine >= source.start_line).map(unit => unit.id);
  for (const record of activeRecords) {
    record.source_unit_ids = unitIds(record.source);
    if (!record.source_unit_ids.length) throw new Error(`Source catalog does not cover occurrence: ${record.id}`);
    if (record.context_source) record.context_source_unit_ids = unitIds(record.context_source);
  }
  const result = aggregateQuestionElements(activeRecords, registry);
  const topicNames = new Map([...fs.readFileSync(path.join(repoDir, 'cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md'), 'utf8')
    .matchAll(/^###\s+(\d+)\.\s+(.+)$/gmu)].map(match => [match[1], match[2].trim()]));
  result.topics = result.topics.map(topic => ({ ...topic, name: topicNames.get(topic.topic_id) || '미분류' }));
  const coverage = datasets.flatMap(dataset => dataset.sources).map(source => {
    const sourceRecords = activeRecords.filter(record => record.source.file === source.file);
    const questions = sourceRecords.filter(record => record.source_role === 'question');
    return { file: source.file, pages: source.pages, question_records: questions.length,
      extracted_questions: questions.filter(record => record.status === 'extracted').length,
      needs_review_questions: questions.filter(record => record.status === 'needs_review').length,
      author_index_records: sourceRecords.filter(record => record.source_role === 'author_index').length,
      excluded_records: records.filter(record => record.excluded && record.source.file === source.file).length };
  });
  return { ...result, inputs: datasets.flatMap(dataset => dataset.sources), records: activeRecords, excluded_records: records.filter(record => record.excluded),
    coverage,
    unresolved: datasets.flatMap(dataset => dataset.unresolved || []).filter(issue => !issue.record_id || !byId.get(issue.record_id)?.excluded && byId.get(issue.record_id)?.status !== 'extracted'), validation, curation,
    source_catalog: { version: catalog.version, fingerprint: catalog.fingerprint },
    policy: {
      unit: '같은 요소는 원시험 연도·문제·물음마다 1회. 동일 물음의 세부항목·재수록·요약표는 추가 횟수가 아니다. 실제 발문 추출이 있으면 같은 물음의 저자 요약표는 빈도에서 제외한다.',
      repeated_years: '서로 다른 실제 출제는 각각 집계한다.',
      representative_source: '2014–2025 기출은 연도별 해설 A의 실제 물음을 대표 본문으로 집계한다. B·주제별·연습서의 재수록은 원출제 ID에 연결해 출처로 보존하며, 재수록에서만 추출된 넓은 라벨을 원출제의 추가 요소로 세지 않는다.',
      practice: '기출 재수록은 원시험에 합친다. 원출제 동일성이 미확정인 연습자료 등장 수는 확정 빈도에 합산하지 않는다.',
      normalization: '검토한 별칭과 동일한 구체 라벨을 통합한다. 동의 요구사항 미통합 후보는 별도로 검토해야 한다.',
      interpretation: '교재에서 식별된 요구사항의 빈도이며 원시험 무변형 검증이나 향후 출제확률이 아니다. 중요성은 빈도·연도 분포·최근 출제와 함께 판단한다.',
    } };
}

/** Render generated artifacts without reading or writing the filesystem. */
export function renderQuestionElements(result, { repoDir = root } = {}) {
  const dir = outputRelative;
  const pages = new Map();
  pages.set(`${dir}/question-elements.json`, JSON.stringify(result, null, 2) + '\n');
  const recordsById = new Map(result.records.map(record => [record.id, record]));
  const occurrencesByElement = new Map();
  for (const occurrence of result.occurrences) {
    if (!occurrencesByElement.has(occurrence.element_id)) occurrencesByElement.set(occurrence.element_id, []);
    occurrencesByElement.get(occurrence.element_id).push(occurrence);
  }
  const sourceLink = (from, source) => {
    const target = path.relative(path.dirname(path.resolve(repoDir, from)), path.resolve(repoDir, source.file)).split(path.sep).join('/');
    return `[${path.basename(source.file, '.md')} ${source.page}쪽](${encodeURI(target)}#${encodeURIComponent(`원문-페이지-${source.page}`)})`;
  };
  for (const topic of result.topics) {
    const target = `${dir}/elements/${topic.topic_id || 'unclassified'}.md`;
    const rows = result.elements.filter(element => element.topic_id === topic.topic_id && element.catalog_status === 'extracted').map(element => {
      const entries = occurrencesByElement.get(element.id) || [];
      const sourceRecords = [...new Map(entries.map(entry => [entry.record_id, recordsById.get(entry.record_id)])).values()];
      const sorted = [...sourceRecords].sort((a, b) => Number(b.status === 'extracted') - Number(a.status === 'extracted') || Number(a.source_role === 'author_index') - Number(b.source_role === 'author_index'));
      const reviewCount = sourceRecords.filter(record => record.status === 'needs_review').length;
      return [element.id, element.label, element.exam_frequency, element.exam_years.join(', ') || '-',
        `${sourceRecords.length}건 중 재검토 ${reviewCount}건`, sorted.slice(0, 3).map(record => sourceLink(target, record.source)).join(' · ')];
    });
    pages.set(target, `# ${topic.topic_id || ''} ${topic.name} — 출제 요구사항\n\n`
      + '구체적인 원문 요구를 모은 추출 자료다. 서로 다른 표현의 동의 요구가 남아 있을 수 있으며, 원출제 식별·발문 경계 미확정 기록은 기출 빈도에 넣지 않는다. 0회는 미출제를 뜻하지 않는다. 표시된 첫 출처 외 모든 인용·재수록·상태는 [통합 JSON](../question-elements.json)에 있다.\n\n'
      + table(['요소 ID', '요구사항', '확인된 기출 물음 수', '출제 연도', '원문 기록 상태', '대표 출처'], rows)
      + '\n\n[전체 안내](../README.md) · [빈도 집계](../frequency.md)\n');
  }
  const topicRows = result.topics.map(topic => [`[${topic.topic_id ? topic.topic_id + ' ' : ''}${topic.name}](elements/${topic.topic_id || 'unclassified'}.md)`, topic.element_count, topic.exam_question_count, topic.element_exam_occurrences, topic.mock_question_count]);
  const elementRows = result.elements.filter(element => element.exam_frequency).slice(0, 60).map(element => [element.label, element.topic_id || '미분류', element.exam_frequency, element.exam_year_count, element.latest_exam_year, element.normalization === 'reviewed_aliases' ? '별칭 통합' : '동일 라벨']);
  pages.set(`${dir}/frequency.md`, '# 출제 요구사항 빈도\n\n'
    + Object.values(result.policy).map(value => `- ${value}`).join('\n') + '\n\n'
    + '## 상위 주제별 집계\n\n한 물음에 여러 요소가 있으면 요소 출현 합계는 늘지만 주제별 고유 물음 수는 한 번만 센다. 여러 주제에 걸친 물음도 있으므로 주제별 고유 물음 수의 합계는 전체 고유 물음 수와 다를 수 있다.\n\n'
    + table(['주제별 요소 목록', '추출 라벨 수', '기출 고유 물음', '기출 요소 출현 합계', '확인된 모의고사 물음'], topicRows) + '\n\n'
    + '## 기출 요구사항별 빈도 상위 60개\n\n대표 기출 본문의 실제 요구사항을 원시험 ID로 집계한 수치다. 원문 표현이 다른 동의 요구사항은 검토·통합이 완료된 범위에서만 묶었다. 빈도와 출제 연도 수가 같은 행의 이름순 정렬은 우선순위 차이를 뜻하지 않는다. 기출과 연습 빈도를 합쳐 임의의 중요도 점수를 만들지 않는다.\n\n'
    + table(['요구사항', '주제 ID', '기출 물음 수', '출제 연도 수', '최근 연도', '통합 수준'], elementRows) + '\n\n'
    + `## 검토 범위\n\n원자료 ${result.validation.sourceFiles}파일 · 원문 기록 ${result.records.length}개 · 실제 발문에서 확인한 요구사항 라벨 ${result.elements.filter(element => element.catalog_status === 'extracted').length}개. 저자 요약·미확정 기록에만 있는 후보 라벨 ${result.elements.filter(element => element.catalog_status === 'candidate_only').length}개는 요소 목록에 포함하지 않고 JSON에 보존한다. 의미·경계 재검토 수록 기록 ${result.coverage.reduce((sum, source) => sum + source.needs_review_questions, 0)}개에는 대표 기출과 연결된 재수록도 포함된다.\n\n`
    + table(['원자료', '원문 페이지', '발문·후보 기록', '요구 추출', '수록 범위 재검토', '저자 목차·요약'], result.coverage.map(source => [path.basename(source.file, '.md'), source.pages, source.question_records, source.extracted_questions, source.needs_review_questions, source.author_index_records])) + '\n\n'
    + '모든 원문 인용·위치·원출제 식별자·요소별 출현·미확정 항목은 [통합 JSON](question-elements.json)에 보존한다. [원자료와 추출 방식](README.md)과 [재수록 처리 근거](deduplication.md)를 함께 확인한다.\n');
  const reviewRows = result.records.filter(record => record.source_role === 'question' && record.status === 'needs_review').map(record => [record.id,
    originalQuestionKey(record.origin) || '원출제 미확정', sourceLink(path.join(dir, 'review-queue.md'), record.source),
    record.elements.map(element => element.label).join(' / '), record.notes.join(' / ')]);
  pages.set(`${dir}/review-queue.md`, '# 원문·재수록 확인 항목\n\n'
    + '실제 발문 경계·OCR·요구 해석 또는 부분 재수록 범위를 더 확인할 수록 기록이다. 같은 원기출의 대표 본문에서 이미 요구를 추출한 재수록도 포함되므로 행 수가 미추출 원시험 물음 수는 아니다. 각 원출제의 전체 본문은 [재수록 연결](deduplication.md)에서 확인한다.\n\n'
    + table(['기록 ID', '원출제', '원문', '후보 요구', '확인 메모'], reviewRows)
    + '\n\n[전체 안내](README.md) · [빈도 집계](frequency.md)\n');
  const duplicateRows = result.question_groups.filter(group => !group.id.startsWith('unresolved:')).map(group => {
    const members = group.record_ids.map(id => recordsById.get(id));
    const prompts = members.filter(record => record.source_role === 'question');
    const indexes = members.length - prompts.length;
    const sources = [...new Map(prompts.map(record => [`${record.source.file}:${record.source.page}`, record.source])).values()];
    return [group.id, prompts.length, indexes, sources.map(source => sourceLink(path.join(dir, 'deduplication.md'), source)).join(' · ')];
  });
  pages.set(`${dir}/deduplication.md`, '# 원출제와 재수록 연결\n\n'
    + '같은 원출제의 연도·문제·물음은 하나의 집계 단위다. 연도나 물음이 다르면 같은 요소라도 별도 출제로 센다. 세부항목·요약표·재수록은 횟수를 늘리지 않는다. 원문 파일은 삭제하거나 수정하지 않았다.\n\n'
    + '연도별 해설 A의 실제 본문이 있는 기출은 그 요구사항을 대표로 센다. 다른 책에 있는 표현이 더 넓거나 일부 항목만 재수록되어 있어도 원시험의 추가 요소로 세지 않는다. 알려진 원출제 ID가 없는 기록은 확정 빈도에 넣지 않고 통합 JSON에 보존한다.\n\n'
    + table(['원출제 ID', '발문 수록 기록', '저자 요약 기록', '연결된 원문 위치'], duplicateRows) + '\n\n'
    + `## 원출제 확인이 더 필요한 동일 인용\n\n${result.duplicate_candidates.length}묶음. 발문 인용의 일치만으로 같은 출제를 확정하지 않으며, 앞의 사례 조건과 문제 식별자를 함께 대조한다. 후보 record_ids는 [통합 JSON](question-elements.json)의 duplicate_candidates에 있다.\n\n[전체 안내](README.md) · [빈도 집계](frequency.md)\n`);
  return pages;
}

/** Compare all generated content, including the current source catalog fingerprint. */
export function checkQuestionElementOutputs(pages, { repoDir = root } = {}) {
  const errors = [];
  const normalizeNewlines = text => text.replace(/\r\n/gu, '\n');
  for (const [relative, expected] of pages) {
    const absolute = path.resolve(repoDir, relative);
    if (!fs.existsSync(absolute)) errors.push(`Missing generated output: ${relative}`);
    else if (!fs.statSync(absolute).isFile()) errors.push(`Expected generated file: ${relative}`);
    else if (normalizeNewlines(fs.readFileSync(absolute, 'utf8')) !== normalizeNewlines(expected)) {
      errors.push(`Generated output differs: ${relative}`);
    }
  }
  const elementsDir = path.join(repoDir, outputRelative, 'elements');
  if (fs.existsSync(elementsDir) && fs.statSync(elementsDir).isDirectory()) {
    for (const name of fs.readdirSync(elementsDir).sort()) {
      const relative = `${outputRelative}/elements/${name}`;
      if (/\.md$/iu.test(name) && !pages.has(relative)) errors.push(`Unexpected generated element page: ${relative}`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildQuestionElements();
  const pages = renderQuestionElements(result);
  const outputErrors = process.argv.includes('--check') ? checkQuestionElementOutputs(pages) : [];
  if (process.argv.includes('--check')) {
    if (outputErrors.length) {
      for (const error of outputErrors) console.error(error);
      console.error('Regenerate with: node cpa_uploader/questionElements.mjs');
      process.exitCode = 1;
    }
  } else {
    for (const [relative, content] of pages) {
      const absolute = path.resolve(root, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content);
    }
  }
  console.log(JSON.stringify({ records: result.records.length, elements: result.elements.filter(element => element.catalog_status === 'extracted').length,
    candidateLabels: result.elements.filter(element => element.catalog_status === 'candidate_only').length, sources: result.validation.sourceFiles,
    identifiedExamQuestions: result.question_groups.filter(group => group.id.startsWith('cpa_exam:')).length,
    countedExamQuestions: new Set(result.elements.flatMap(element => element.exam_questions)).size,
    countedMockQuestions: new Set(result.elements.flatMap(element => element.mock_questions)).size,
    unresolved: result.unresolved.length, duplicateCandidates: result.duplicate_candidates.length, errors: [...result.validation.errors, ...outputErrors] }, null, 2));
}
