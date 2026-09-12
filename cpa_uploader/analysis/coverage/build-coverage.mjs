import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';
import { studyTopics } from '../../wiki/scripts/ox-study-order.mjs';
import { scanGaps } from '../../wiki/scripts/gap-scan.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const coverageDirectory = 'cpa_uploader/analysis/coverage';
export const elementFile = 'cpa_uploader/analysis/question-elements/question-elements.json';
export const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const hashObject = value => sha(JSON.stringify(value));
const clean = value => String(value ?? '').replace(/\s+/gu, ' ').replaceAll('|', '&#124;').trim();
const normalizeQuote = value => String(value).replace(/\s+/gu, '');
const table = (headers, rows) => `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map(row => `| ${row.map(clean).join(' | ')} |`).join('\n')}\n`;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
export function sourceUnitHash(unit) {
  return hashObject({ contentHash: unit.contentHash, file: unit.file, standard: unit.standard,
    paragraph: unit.paragraph, authority: unit.authority, edition: unit.edition, provenance: unit.provenance,
    context: unit.context });
}
export function resolveDraftFile(repoDir, file) {
  const draftRoot = path.resolve(repoDir, 'cpa_uploader/drafts');
  if (typeof file !== 'string' || !file.startsWith('cpa_uploader/drafts/') || !file.endsWith('.json')) throw new Error(`허용되지 않은 초안 경로: ${file}`);
  const absolute = path.resolve(repoDir, file);
  if (!absolute.startsWith(draftRoot + path.sep)) throw new Error(`허용되지 않은 초안 경로: ${file}`);
  return absolute;
}
export function questionHash(set, subquestion) {
  const ids = new Set(subquestion.criteria.flatMap(c => c.source_ref_ids));
  return hashObject({ classification: set.classification, context: set.shared_context, subquestion,
    sources: set.source_refs.filter(ref => ids.has(ref.id)) });
}

// Keep extraction labels, edition-specific source units and bank criteria as
// separate entities. A citation match never becomes a semantic coverage verdict.
/** @param {{dataset: any, bank: any[], catalog: any, overlay: any, inputs: any, gaps?: object[], drafts?: Array<{file: string, set: any}>}} options */
export function assembleCoverage({ dataset, bank, catalog, overlay, inputs, gaps = [], drafts = [] }) {
  if (overlay.version !== 1 || !Array.isArray(overlay.links)) throw new Error('links.json 형상 오류');
  const elements = new Map(dataset.elements.map(element => [element.id, element]));
  const units = new Map(catalog.units.map(unit => [unit.id, unit]));
  const sets = new Map(bank.map(set => [set.id, set]));
  if (elements.size !== dataset.elements.length) throw new Error('요소 ID 중복');
  if (units.size !== catalog.units.length) throw new Error('원자료 단위 ID 중복');
  if (sets.size !== bank.length) throw new Error('문제은행 ID 중복');
  if (new Set(drafts.map(draft => JSON.stringify([draft.file, draft.set.id]))).size !== drafts.length) throw new Error('초안 파일/세트 ID 중복');
  for (const set of [...bank, ...drafts.map(draft => draft.set)]) {
    if (new Set(set.subquestions.map(q => q.id)).size !== set.subquestions.length) throw new Error(`${set.id}: 물음 ID 중복`);
    for (const q of set.subquestions) if (new Set(q.criteria.map(c => c.id)).size !== q.criteria.length) throw new Error(`${set.id}/${q.id}: criterion ID 중복`);
  }
  const seen = new Set();
  const relations = new Set(['direct', 'partial', 'broader', 'adjacent', 'excluded']);
  const links = overlay.links.map(link => {
    if (!link.id || seen.has(link.id)) throw new Error(`연결 ID 없음/중복: ${link.id}`);
    seen.add(link.id);
    const element = elements.get(link.element_id);
    if (!element) throw new Error(`${link.id}: 없는 요소 ID ${link.element_id}`);
    if (!relations.has(link.relationship)) throw new Error(`${link.id}: 대응 관계 오류`);
    if (!['needs_review', 'reviewed'].includes(link.review_status) || !link.reason?.trim()) throw new Error(`${link.id}: 검토상태/근거 없음`);
    if (!Array.isArray(link.source_unit_ids)) throw new Error(`${link.id}: source_unit_ids 없음`);
    for (const id of link.source_unit_ids) if (!units.has(id)) throw new Error(`${link.id}: 없는 원자료 단위 ${id}`);
    let target = null;
    let targetHash = null;
    if (link.target) {
      if (link.target.scope && !['bank', 'draft'].includes(link.target.scope)) throw new Error(`${link.id}: 대상 범위 오류`);
      const isDraft = link.target.scope === 'draft';
      const set = isDraft ? drafts.find(draft => draft.file === link.target.file && draft.set.id === link.target.set_id)?.set : sets.get(link.target.set_id);
      const question = set?.subquestions.find(q => q.id === link.target.subquestion_id);
      if (!question) throw new Error(`${link.id}: 없는 물음 ${link.target.set_id}/${link.target.subquestion_id}`);
      if (!Array.isArray(link.target.criterion_ids) || !link.target.criterion_ids.length) throw new Error(`${link.id}: 대상 criterion을 명시하십시오`);
      for (const id of link.target.criterion_ids) if (!question.criteria.some(c => c.id === id)) throw new Error(`${link.id}: 없는 criterion ${id}`);
      targetHash = questionHash(set, question);
      target = { ...link.target, scope: isDraft ? 'draft' : 'bank', bank_status: isDraft ? null : set.status,
        draft_status: isDraft ? set.status : null, verification_status: set.verification.review_status };
    }
    const changed = [];
    if (link.snapshot?.element_sha256 !== hashObject(element)) changed.push('element');
    if (target && link.snapshot?.question_sha256 !== targetHash) changed.push('question');
    for (const id of link.source_unit_ids) if (link.snapshot?.source_hashes?.[id] !== units.get(id).contentHash) changed.push(id);
    for (const id of link.source_unit_ids) if (link.snapshot?.source_metadata_hashes?.[id] !== sourceUnitHash(units.get(id))) changed.push(`${id}:metadata`);
    return { ...link, target, freshness: changed.length ? 'stale' : 'current', changed_inputs: changed,
      effective_review_status: changed.length ? 'needs_review' : link.review_status,
      confirms_semantic_coverage: !changed.length && link.review_status === 'reviewed' && link.relationship === 'direct' && target?.scope === 'bank' && link.source_unit_ids.length > 0 };
  });
  const unitsByFile = new Map();
  for (const unit of catalog.units.filter(u => u.kind === 'standard')) {
    if (!unitsByFile.has(unit.file)) unitsByFile.set(unit.file, []);
    unitsByFile.get(unit.file).push({ ...unit, normalized: normalizeQuote(unit.quote) });
  }
  const citations = [];
  const unmatched = [];
  for (const set of bank) for (const q of set.subquestions) for (const c of q.criteria) {
    for (const sourceId of c.source_ref_ids) {
      const ref = set.source_refs.find(source => source.id === sourceId);
      if (!ref) throw new Error(`${set.id}/${q.id}/${c.id}: 출처 ${sourceId} 없음`);
      const quote = normalizeQuote(ref.source_quote);
      const matches = (unitsByFile.get(ref.file) || []).filter(unit => quote.length >= 24 && unit.normalized.length >= 24
        && (unit.normalized.includes(quote) || quote.includes(unit.normalized)));
      const target = { set_id: set.id, subquestion_id: q.id, criterion_id: c.id, source_ref_id: ref.id };
      if (!matches.length) unmatched.push({ ...target, file: ref.file, locator: ref.source_span || ref.title,
        reason: '동일 파일의 원자료 단위와 인용 포함관계 미연결; 미출제 판정 아님' });
      for (const unit of matches) citations.push({ ...target, source_unit_id: unit.id, kind: 'citation_overlap', semantic_status: 'not_assessed' });
    }
  }
  const sourceUnits = catalog.units.filter(unit => unit.kind === 'standard').map(unit => ({
    id: unit.id, standard: unit.standard, paragraph: unit.paragraph, topic_ids: unit.topicIds,
    title: unit.title, section: unit.context.section, authority: unit.authority, edition: unit.edition,
    file: unit.file, start_line: unit.startLine, end_line: unit.endLine, content_hash: unit.contentHash,
    warnings: unit.warnings, inventory_kind: /요구사항/u.test(unit.context.section) ? 'requirement_source_unit' : 'supporting_source_unit',
  }));
  const elementViews = dataset.elements.map(element => {
    const connected = links.filter(link => link.element_id === element.id && link.relationship !== 'excluded');
    return { id: element.id, label: element.label, topic_id: element.topic_id, catalog_status: element.catalog_status,
      exam_frequency: element.exam_frequency, mock_frequency: element.mock_frequency, exam_years: element.exam_years,
      exam_question_ids: element.exam_questions, mock_question_ids: element.mock_questions,
      link_ids: connected.map(link => link.id),
      mapping_status: connected.some(link => link.confirms_semantic_coverage) ? 'reviewed_direct_link'
        : connected.length ? 'mapping_needs_review' : 'unmapped_not_absence' };
  });
  const questions = bank.flatMap(set => set.subquestions.map(q => ({ set_id: set.id, subquestion_id: q.id,
    topic_id: set.classification.topic_id, title: set.title, prompt: q.prompt, bank_status: set.status,
    verification_status: set.verification.review_status, criterion_ids: q.criteria.map(c => c.id),
    question_sha256: questionHash(set, q) })));
  const topics = studyTopics.map((topic, index) => {
    const topicElements = elementViews.filter(e => e.topic_id === topic.id);
    const topicSets = bank.filter(set => set.classification.topic_id === topic.id);
    const unitIds = new Set(sourceUnits.filter(u => u.topic_ids.includes(topic.id)).map(u => u.id));
    const frequency = dataset.topics.find(t => t.topic_id === topic.id) || {};
    return { id: topic.id, title: frequency.name || catalog.topics?.find(t => t.id === topic.id)?.title || topic.id, study_order: index + 1, frequency,
      extracted_elements: topicElements.filter(e => e.catalog_status === 'extracted').length,
      unmapped_elements: topicElements.filter(e => e.mapping_status === 'unmapped_not_absence' && e.catalog_status === 'extracted').length,
      reviewed_direct_elements: topicElements.filter(e => e.mapping_status === 'reviewed_direct_link').length,
      source_units: unitIds.size, units_without_citation: [...unitIds].filter(id => !citations.some(c => c.source_unit_id === id)).length,
      sets: topicSets.length, questions: topicSets.flatMap(s => s.subquestions).length,
      needs_review_sets: topicSets.filter(s => s.status === 'needs_review').length,
      verified_sets: topicSets.filter(s => s.status === 'verified').length,
      published_sets: topicSets.filter(s => s.status === 'published').length };
  });
  return { version: 1, inputs, scope: '은행 파일 기준. 운영 DB 배포 현황이 아님. 원자료 단위는 고유한 법적 요구사항 수가 아니며 공식·학습자료 판본별 단위를 유지한다.',
    policy: '빈도는 원출제 고유 물음별 집계. 0회·요소 미연결·인용 미연결·문구 유사도는 미출제 확정이 아니다. 검수·게시 상태와 의미상 포함 범위를 분리한다.',
    topics, elements: elementViews, source_units: sourceUnits, questions, links, citations, unmatched_citations: unmatched,
    gap_candidates: gaps.map(row => ({ ...row, assessment: 'text_similarity_candidate_only' })),
    review_queue: links.filter(link => link.effective_review_status !== 'reviewed').map(link => ({ id: link.id, freshness: link.freshness, changed_inputs: link.changed_inputs })),
    summary: { sets: bank.length, questions: questions.length, criteria: questions.reduce((n, q) => n + q.criterion_ids.length, 0),
      extracted_elements: elementViews.filter(e => e.catalog_status === 'extracted').length,
      candidate_elements: elementViews.filter(e => e.catalog_status !== 'extracted').length,
      source_units: sourceUnits.length, links: links.length, reviewed_links: links.filter(l => l.effective_review_status === 'reviewed').length,
      stale_links: links.filter(l => l.freshness === 'stale').length } };
}

/** @param {{repoDir?: string, catalog?: import('../../questionSourceCatalog.mjs').SourceCatalog, dataset?: any}} [options] */
export function buildCoverage({ repoDir = defaultRoot, catalog = buildSourceCatalog({ repoDir }), dataset } = {}) {
  const bytes = file => fs.readFileSync(path.join(repoDir, file));
  const elements = dataset || readJson(path.join(repoDir, elementFile));
  const bank = readJson(path.join(repoDir, bankFile));
  const overlayFile = `${coverageDirectory}/links.json`;
  const overlay = readJson(path.join(repoDir, overlayFile));
  const draftFiles = [...new Set(overlay.links.filter(link => link.target?.scope === 'draft').map(link => link.target.file))].sort();
  const drafts = draftFiles.flatMap(file => {
    const absolute = resolveDraftFile(repoDir, file);
    const raw = readJson(absolute);
    return (Array.isArray(raw) ? raw : [raw]).map(set => ({ file, set }));
  });
  const sources = [...new Set(bank.flatMap(set => set.source_refs.map(ref => ref.file)))].sort();
  const sourceHashes = Object.fromEntries(sources.map(file => [file, sha(bytes(file))]));
  const inputs = { bank: { file: bankFile, sha256: sha(bytes(bankFile)) },
    elements: { file: elementFile, sha256: dataset ? sha(JSON.stringify(dataset, null, 2) + '\n') : sha(bytes(elementFile)) },
    overlay: { file: overlayFile, sha256: sha(bytes(overlayFile)) },
    source_catalog_fingerprint: catalog.fingerprint, bank_source_hashes: sourceHashes,
    draft_hashes: Object.fromEntries(draftFiles.map(file => [file, sha(bytes(file))])),
    generator_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))) };
  return assembleCoverage({ dataset: elements, bank, catalog, overlay, inputs, gaps: scanGaps({ repoDir }).rows, drafts });
}

function relativeLink(from, to, label) {
  return `[${clean(label)}](${encodeURI(path.posix.relative(path.posix.dirname(from), to))})`;
}
const questionName = target => `${target.set_id}/${target.subquestion_id}`;
const relationNames = { direct: '직접', partial: '일부', broader: '상위', adjacent: '인접', excluded: '제외' };
export function renderCoverage(registry) {
  const pages = new Map();
  pages.set(`${coverageDirectory}/registry.json`, JSON.stringify(registry, null, 2) + '\n');
  const summaryFile = `${coverageDirectory}/summary.md`;
  const introduction = `생성 결과이며 직접 수정하지 않는다. \`npm run analysis:build\`로 갱신하고 \`npm run analysis:check\`로 입력·생성 결과의 일치를 확인한다.\n\n${registry.scope}\n\n${registry.policy}\n\n`;
  pages.set(summaryFile, '# 출제 요소·원자료·현재 문제은행 연결\n\n' + introduction
    + `정본 ${registry.summary.sets}세트 · ${registry.summary.questions}물음 · ${registry.summary.criteria}criterion. 추출 요소 ${registry.summary.extracted_elements}개 · 후보 라벨 ${registry.summary.candidate_elements}개. 관계 확인 완료 ${registry.summary.reviewed_links}건 · 관계 검토 대기 ${registry.review_queue.length}건(입력 변경 ${registry.summary.stale_links}건).\n\n`
    + table(['학습 순서·주제', '추출 요소', '미연결 요소', '정본 세트', '문항 검토 대기 세트', 'verified', 'published'], registry.topics.map(t => [
      relativeLink(summaryFile, `${coverageDirectory}/topics/${t.id}.md`, `${t.study_order}. ${t.id} ${t.title}`), t.extracted_elements, t.unmapped_elements, t.sets, t.needs_review_sets, t.verified_sets, t.published_sets]))
    + `\n미연결 요소는 제외 관계를 뺀 연결이 없는 요소 수이며, 연결 관계의 검토 대기는 포함하지 않는다. 은행에 없는 요소 수가 아니다. 기준서 요구 및 적용자료는 판본별 원자료 단위로 유지한다. 미분류 추출 요소 ${registry.elements.filter(e => e.catalog_status === 'extracted' && !registry.topics.some(t => t.id === e.topic_id)).length}개는 [미분류 원발문 목록](../question-elements/elements/unclassified.md)에서 별도로 확인한다.\n\n## 입력 버전\n\n`
    + table(['입력', 'SHA-256 / fingerprint'], [['문제은행', registry.inputs.bank.sha256], ['요소 데이터', registry.inputs.elements.sha256], ['연결 장부', registry.inputs.overlay.sha256], ['원자료 카탈로그', registry.inputs.source_catalog_fingerprint]])
    + '\n[관리 규칙](../../../docs/출제-검토-자료-관리.md) · [연결 장부 안내](README.md)\n');
  for (const topic of registry.topics) {
    const file = `${coverageDirectory}/topics/${topic.id}.md`;
    const elements = registry.elements.filter(e => e.topic_id === topic.id && e.catalog_status === 'extracted');
    const topicLinks = registry.links.filter(l => elements.some(e => e.id === l.element_id));
    const sourceUnits = registry.source_units.filter(u => u.topic_ids.includes(topic.id));
    const elementRows = elements.map(e => {
      const links = topicLinks.filter(l => l.element_id === e.id);
      return [e.id, e.label, e.exam_frequency ?? '미확인', e.mock_frequency ?? '미확인', e.exam_years.join(', ') || '—',
        links.map(l => `${l.target ? questionName(l.target) : '문항 미지정'} (${l.target?.scope === 'draft' ? '초안만 연결, ' : ''}${relationNames[l.relationship]}, ${l.effective_review_status}${l.freshness === 'stale' ? '/입력 변경' : ''})`).join(' · ') || '대응 미확인'];
    });
    const unitRows = sourceUnits.map(unit => {
      const citations = registry.citations.filter(c => c.source_unit_id === unit.id);
      const links = topicLinks.filter(l => l.source_unit_ids.includes(unit.id));
      return [relativeLink(file, unit.file, `${unit.standard || unit.title} ${unit.paragraph || unit.section}; L${unit.start_line}`), unit.id,
        `${unit.authority}: ${unit.edition}`, unit.inventory_kind === 'requirement_source_unit' ? '요구사항 구간' : '적용자료 등',
        [...new Set(citations.map(c => `${questionName(c)}/${c.criterion_id}`))].join(' · ') || '인용 미연결',
        links.map(l => `${l.element_id} (${l.effective_review_status})`).join(' · ') || '요소 미연결'];
    });
    const questions = registry.questions.filter(q => q.topic_id === topic.id);
    pages.set(file, `# ${topic.study_order}. ${topic.title} — 연결 현황\n\n` + introduction
      + '## 추출 요구사항과 빈도\n\n' + table(['요소 ID', '구체 요구사항', '기출', '모의', '기출 연도', '은행 대응·검토 상태'], elementRows)
      + '\n## 기준서 요구사항·적용자료의 원문 단위\n\n인용 포함관계는 같은 파일의 원문 연결이다. 이것만으로 해당 문단 전체를 평가하는 문제라고 판정하지 않는다. 학습자료 단위의 판본은 공식 원문에서 확인한다.\n\n'
      + table(['원문 위치', '원자료 단위 ID', '자료 종류·판본', '구간', '인용 연결 물음/criterion', '요소 연결'], unitRows)
      + '\n## 현재 은행 물음\n\n' + table(['물음', '발문', '은행 상태', '검토 상태', 'criterion'], questions.map(q => [
        relativeLink(file, `cpa_uploader/wiki/questions/${q.set_id}.md`, questionName(q)), q.prompt, q.bank_status, q.verification_status, q.criterion_ids.join(', ')]))
      + `\n[전체 주제](../summary.md) · ${relativeLink(file, `cpa_uploader/analysis/question-elements/elements/${topic.id}.md`, '원발문·원출제·재수록 근거')}\n`);
  }
  return pages;
}

export function renderDashboard(registry, from = 'cpa_uploader/wiki/_meta/authoring-dashboard.md') {
  return `${registry.scope}\n\n${registry.policy}\n\n`
    + `관계 확인 완료 ${registry.summary.reviewed_links}건 · 관계 검토 대기 ${registry.review_queue.length}건(입력 변경 ${registry.summary.stale_links}건). 미연결 요소는 제외 관계를 뺀 연결이 없는 요소 수이며, 연결 관계의 검토 대기는 포함하지 않는다.\n\n`
    + table(['학습 순서', '요구사항·빈도·문항 연결', '추출 요소', '미연결 요소', '문항 검토 대기 세트', 'verified', 'published'], registry.topics.map(t => [
      t.study_order, relativeLink(from, `${coverageDirectory}/topics/${t.id}.md`, `${t.id} ${t.title}`), t.extracted_elements, t.unmapped_elements, t.needs_review_sets, t.verified_sets, t.published_sets]))
    + `\n${relativeLink(from, `${coverageDirectory}/summary.md`, '전체 집계·입력 해시')} · ${relativeLink(from, `${coverageDirectory}/README.md`, '연결표 관리법')} · ${relativeLink(from, 'docs/출제-검토-자료-관리.md', '자료별 정본과 갱신 순서')}\n\n`
    + '출제 순서: 원자료 요구와 빈도 확인 → 현재 물음·criterion 대조 → 부족한 조건·예외 확인 → 별도 초안 제작 → 의미검수·실제 사례 채점 → 승인 범위에 따른 반영. 미연결은 조사 대기이며 자동 미출제 판정이 아니다.\n';
}
