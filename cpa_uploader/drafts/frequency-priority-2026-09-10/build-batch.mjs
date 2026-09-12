import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSourceCatalog } from '../../questionSourceCatalog.mjs';
import { specifications } from './content.mjs';

const base = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(base, '../../..');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const datasetFile = path.join(root, 'cpa_uploader/analysis/question-elements/question-elements.json');
const bankFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const dataset = read(datasetFile), bank = read(bankFile);
const blocks = read(path.join(base, 'sources/blocks.json'));
const catalog = buildSourceCatalog();
const sourceFile = rel(path.join(base, 'sources/official-excerpts.txt'));
const edition = '2025 개정 전문의 선택 문단을 사용하며 공식 2026 개정 전문의 대응 본문과 대조하였다. 2026년 시행 기준에 따른 학습용 사례이며 특정 미래 시험의 적용 판본을 확정한 것은 아니다. 다운로드·문단 대조 기록은 sources/provenance.json 참조.';
const inputs = [datasetFile, bankFile, path.join(base, 'sources/blocks.json'), path.join(base, 'sources/provenance.json'), path.join(root, sourceFile)]
  .map(file => ({ file: rel(file), sha256: hash(fs.readFileSync(file)) }));

function evidence(elementId) {
  const element = dataset.elements.find(e => e.id === elementId);
  if (!element) throw new Error(`Missing element ${elementId}`);
  const occurrences = dataset.occurrences.filter(o => o.element_id === elementId && o.countable && o.source_role === 'question');
  return {
    element_id: elementId, label: element.label, exam_frequency: element.exam_frequency,
    mock_frequency: element.mock_frequency, exam_years: element.exam_years, exam_questions: element.exam_questions,
    source_records: occurrences.map(o => {
      const record = dataset.records.find(r => r.id === o.record_id);
      const file = path.join(root, o.source.file);
      return { occurrence_id: o.id, record_id: record.id, question_key: o.question_key,
        source: o.source, original_label: o.raw_label, original_text: record.text,
        source_range_text: fs.readFileSync(file, 'utf8').split(/\r?\n/u).slice(o.source.start_line - 1, o.source.end_line).join('\n'),
        source_file_sha256: hash(fs.readFileSync(file)), source_unit_ids: record.source_unit_ids ?? [] };
    }),
  };
}

function unitsFor(keys) {
  return [...new Map(keys.map(key => {
    const block = blocks[key];
    const paragraph = key === '705.src1' ? '7' : key === '705.src2' ? '8' : key.startsWith('530.appendix') ? 'A11' : block.paragraph;
    const matches = catalog.units.filter(u => u.standard === block.standard && u.paragraph === paragraph);
    const unit = matches.find(u => u.authority === 'official_transcription') ?? matches[0];
    if (!unit) throw new Error(`Missing catalog locator ${key}`);
    return [unit.id, { id: unit.id, standard: unit.standard, paragraph: unit.paragraph,
      authority: unit.authority, file: unit.file, content_hash: unit.contentHash,
      role: key.startsWith('530.appendix') ? '보론 2·3을 지시하는 A11 탐색 연결. 표의 직접 근거는 이 배치의 공식 발췌·PDF이며 A11 자체를 표 본문으로 간주하지 않는다.' : '해당 문단 탐색 연결. 정답 근거는 별도로 확보한 공식 발췌이다.' }];
  })).values()];
}

const frequencySets = [], outputSets = [];
for (const spec of specifications) {
  const keys = [...new Set(spec.questions.flatMap(q => q.claims.map(c => c.source)))];
  const refs = keys.map((key, index) => {
    const b = blocks[key];
    const paragraph = key === '705.src1' ? '7' : key === '705.src2' ? '8–9' : b.paragraph;
    return { id: `src${index + 1}`, file: sourceFile, title: `${b.standard} 문단/보론 ${paragraph}; 2025 개정${b.pdf_pages_2025 ? ` PDF ${b.pdf_pages_2025.join('·')}쪽` : '; 기존 공식 전사 대조'}`,
      page: b.standard, role: 'standard', source_quote: b.quote, content_hash: hash(b.quote) };
  });
  const byKey = Object.fromEntries(keys.map((key, i) => [key, refs[i]]));
  const template = bank.find(s => s.classification.topic_id === spec.topic);
  const set = {
    schema_version: '3.0', id: spec.id, type: 'linked_question_set', status: 'needs_review', title: spec.title,
    classification: { ...template.classification, standards: [...new Set(keys.map(k => blocks[k].standard))], tags: ['요구사항별 기출빈도', '보완 출제', '검토 전 초안'] },
    source_refs: refs, shared_context: { facts: spec.facts.map((text, i) => ({ id: `f${i + 1}`, text, scoreable: false })) },
    learning_order: spec.questions.map(q => q.id),
    subquestions: spec.questions.map(q => ({
      id: q.id, type: q.type, prompt: q.prompt,
      selection: { type: 'all', n: null }, constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
      decision: null, model_answer: q.claims.map(c => c.answer),
      requirements: [...new Set(q.claims.map(c => c.source))].map((key, i) => ({ id: `${q.id}.r${i + 1}`, source_ref_id: byKey[key].id,
        source_quote: blocks[key].quote, source_span: byKey[key].title })),
      criteria: q.claims.map((c, i) => ({ id: `${q.id}.c${i + 1}`,
        requirement_id: `${q.id}.r${[...new Set(q.claims.map(c => c.source))].indexOf(c.source) + 1}`,
        claim: c.gradingClaim, critical_facts: [{ id: `${q.id}.c${i + 1}.fact`, type: 'conclusion', expected: c.gradingClaim },
          ...(c.guard ? [{ id: `${q.id}.c${i + 1}.scope`, type: 'condition', expected: c.guard }] : [])],
        max_points: 1, scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: [byKey[c.source].id] })),
    })),
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false,
      notes: [edition, spec.difference, '공식 인용은 발췌 원문과 일치한다. 사례·발문·답안은 범위를 명료화하여 재구성하였다.',
        '독립 요구별 정수 1점. 의미가 같은 표현과 답안 전체에서 분명한 판단을 인정한다. 명시적 반대 결론은 해당 criterion에서 불인정한다.',
        '작성자 QA 기대 판정의 점수 재생은 실제 모델 의미 채점이나 사람 승인·정식 검수 receipt가 아니다.'] },
  };
  const units = unitsFor(keys);
  const links = spec.questions.flatMap(q => q.elements.map((id, i) => ({ ...evidence(id), subquestion_id: q.id,
    criterion_ids: q.claims.map((_, ci) => ci).filter(ci => q.elements.length === 1 || Math.floor(ci / 2) === i).map(ci => `${q.id}.c${ci + 1}`),
    relationship: q.relationship ?? (spec.topic === '10' ? 'partial' : 'direct'),
    reason: spec.topic === '10' ? '원발문의 표본규모 방향 요구에 대응하며 이유 설명을 추가하였다. 기출 빈도를 이유 설명 자체의 직접 빈도로 해석하지 않는다.' : spec.difference,
    source_unit_ids: unitsFor(q.claims.filter((_, ci) => q.elements.length === 1 || Math.floor(ci / 2) === i).map(c => c.source)).map(u => u.id),
  })));
  const plan = { version: 1, set_id: spec.id, topic_id: spec.topic, mode: 'adapt_existing_question', status: 'ready',
    objective: spec.title, scope: { actors: ['독립된 재무제표감사의 감사인', ...(spec.topic === '12' ? ['경영진 및 필요한 경우 재무제표 승인권자'] : [])],
      timing: spec.facts, conditions: spec.facts,
      exceptions: spec.questions.map(q => q.boundary.reason), required_answers: spec.questions.map(q => q.prompt),
      exclusions: ['원출제의 답안 개수 선택·줄 수 제한은 승계하지 않는다. 새 발문에 한정된 요구 전부를 평가한다.', '금액 계산·특정 미래 시험의 판본 확정·정본 승급·운영 배포는 이번 범위에 포함하지 않는다.'] },
    question_types: [...new Set(spec.questions.map(q => q.type))], source_unit_ids: units.map(u => u.id),
    existing_question_difference: spec.difference, edition_assumption: edition, unresolved_items: [] };
  const draftFile = path.join(base, `${spec.id}.json`);
  write(draftFile, set);
  write(`${draftFile}.authoring-plan.json`, { artifact_type: 'question_authoring_plan', version: 1, plans: [plan] });

  const cases = [];
  for (const q of spec.questions) {
    const all = q.claims.map((_, i) => i);
    const add = (kind, answer, met, contradicted = [], note = '') => cases.push({ id: `${q.id}/${kind}`, subquestion_id: q.id, kind,
      answer, expected_points: met.length, note,
      expected_verdicts: all.map(i => ({ criterion_id: `${q.id}.c${i + 1}`, verdict: contradicted.includes(i) ? 'contradicted' : met.includes(i) ? 'met' : 'not_met', reason: note || '공식 근거와 작성자 기준에 따라 정한 기대 판정' })) });
    add('model', q.claims.map(c => c.answer).join('\n'), all);
    add('equivalent', q.claims.map(c => c.alternative).join('\n'), all);
    add('reverse-order', [...q.claims].reverse().map(c => c.answer).join('\n'), all);
    add('single-paragraph', q.claims.map(c => c.answer).join(' '), all);
    add('empty', '', []);
    for (const i of all) add(`omit-${i + 1}`, q.claims.filter((_, j) => i !== j).map(c => c.answer).join('\n'),
      all.filter(j => j !== i || q.omitKeeps?.[i]?.includes(j)), [],
      q.omitKeeps?.[i]?.includes(i) ? '결론 문장을 지웠으나 남은 보고 내용이 같은 결론을 명시하므로 해당 판단도 충족한다.' : '다른 독립 명제는 유지하고 해당 요구를 생략한 작성자 기대 사례. 실제 모델 판정은 별도 실행 기록에서 대조한다.');
    add('opposite', q.claims.map(c => c.opposite).join('\n'), [], all);
    add('condition-boundary', q.boundary.answer, q.boundary.met, q.boundary.contradicted, q.boundary.reason);
  }
  write(path.join(base, `qa-${spec.id.replace('draft-', '')}.json`), { version: 1, artifact_type: 'author_expected_judgments', set_id: spec.id,
    draft_sha256: hash(fs.readFileSync(draftFile)), live_model_grading: 'not_run', human_approval: false,
    interpretation: '작성자가 원문과 rubric에서 정한 기대값이다. 점수 재생 검사는 의미 판정의 정확성을 실측하지 않는다.', cases });
  frequencySets.push({ set_id: spec.id, draft_file: rel(draftFile), compared_existing_ids: spec.comparison,
    existing_question_difference: spec.difference, catalog_locators: units, links,
    additional_scope: spec.questions.filter(q => q.elements.length === 0).map(q => ({ subquestion_id: q.id, prompt: q.prompt,
      relationship: 'adjacent', exam_frequency: null, reason: '공란형·일반 미회신 학습과 구별해야 하는 필수 회신 예외. 인접 요소의 빈도를 전용하지 않는다.' })) });
  outputSets.push(set);
}

write(path.join(base, 'frequency-links.json'), { version: 1, status: 'author_proposed_needs_review',
  policy: '실제 원출제별 요구사항 빈도. 재수록 제외. 기출·모의 별도. 한 요소에 대응한 여러 새 물음의 빈도를 합산하지 않음.',
  dataset: inputs[0], bank: { ...inputs[1], sets: bank.length }, sets: frequencySets });
write(path.join(base, 'inputs.json'), { version: 1, files: inputs,
  bank_comparison: specifications.flatMap(s => s.comparison).filter((v, i, a) => a.indexOf(v) === i).map(id => {
    const set = bank.find(s => s.id === id); if (!set) throw new Error(`Missing comparison ${id}`);
    return { set_id: id, sha256: hash(JSON.stringify(set)), subquestions: set.subquestions.map(q => ({ id: q.id, prompt: q.prompt, model_answer: q.model_answer, criteria: q.criteria.map(c => c.claim) })) };
  }) });

const reportDir = path.join(root, 'docs/reports/question-authoring-frequency-priority-2026-09-10');
fs.mkdirSync(reportDir, { recursive: true });
const reportRel = file => path.relative(reportDir, path.join(root, file)).replaceAll('\\', '/');
const questions = ['# 요구사항별 기출빈도 기반 보완 문제', '', '총 6세트·12물음·37점. 각 물음이 요구한 범위를 모두 답한다. 물음에 별도 선후관계가 없는 한 답안 순서는 자유이다.', '', '[모범답안·배점](answers.md) · [선정 근거와 상태](README.md)', ''];
const answers = ['# 모범답안과 배점', '', '독립 채점 명제별 1점이다. 의미가 같은 표현을 인정하며, 정해진 문장 일치 여부로 채점하지 않는다. 실제 모델 채점 결과와 잔여 오류는 후속 기록에서 확인한다. 사람 검수 전 초안이다.', '', '[문제지](questions.md) · [실제 모델 채점 결과](live-grading.md)', ''];
const selection = ['# 기출빈도를 참고한 보완 출제 — 2026-09-10', '', '기존 은행의 발문·모범답안·채점 명제와 보존 초안을 대조하여 6세트·12물음·37점을 작성했다. 상태는 `needs_review` / `needs_human_review`이며 정본·공개본·운영 DB에 추가하지 않았다.', '', '[문제지](questions.md) · [모범답안·배점](answers.md)', '', '## 선정 기준', '', '요구사항별 실제 기출 2~4회의 반복성과 현재 은행의 요구 범위를 함께 고려했다. 재수록은 제외하고 서로 다른 실제 출제는 각각 센다. 아래 횟수는 각 요소의 빈도이며 서로 더하여 고유 기출 문항 수나 중요도 점수로 만들지 않는다. 학습 순서는 OX 주제 순서를 따른다.', '', '| 세트 | 주제 | 물음 | 배점 |', '| --- | --- | ---: | ---: |'];
for (const [i, set] of outputSets.entries()) {
  const spec = specifications[i];
  const points = set.subquestions.reduce((n, q) => n + q.criteria.length, 0);
  selection.push(`| ${i + 1} | ${set.title} | ${set.subquestions.length} | ${points} |`);
  questions.push(`## ${i + 1}. ${set.title} (${points}점)`, '', ...spec.facts.map(x => `${x}\n`));
  answers.push(`## ${i + 1}. ${set.title}`, '');
  for (const [j, q] of set.subquestions.entries()) {
    questions.push(`### 물음 ${j + 1} (${q.criteria.length}점)`, '', q.prompt, '');
    answers.push(`### 물음 ${j + 1} (${q.criteria.length}점)`, '', ...q.model_answer.map(a => `- ${a} **(1점)**`), '',
      `근거: ${[...new Set(q.requirements.map(r => r.source_span))].join(' / ')}.`, '');
    const guards = spec.questions[j].claims.map(c => c.guard).filter(Boolean);
    if (guards.length) answers.push('허용 범위와 구별 사항:', '', ...guards.map(g => `- ${g}`), '');
  }
}
selection.push('', '## 요구사항별 빈도와 기존 문제의 차이', '', '| 새 세트/물음 | 요구사항 | 실제 기출 | 출제 연도 | 관계 |', '| --- | --- | ---: | --- | --- |');
for (const [i, entry] of frequencySets.entries()) for (const link of entry.links) selection.push(`| ${i + 1}/${link.subquestion_id} | ${link.label} | ${link.exam_frequency}회 | ${link.exam_years.join(', ')} | ${link.relationship} |`);
selection.push('', '후속사건의 두 물음은 같은 원출제 요소를 나누어 평가한다. 각 물음의 4회를 합쳐 8회로 해석하지 않는다. 표본규모는 기출의 방향 판단에 이유 설명을 추가한 심화이다. 공란형 조회 세트의 물음 2(회신 자체가 필수인 예외)는 인접 요구 보완으로 직접 기출 빈도를 부여하지 않았다.', '');
for (const [i, spec] of specifications.entries()) selection.push(`- **${i + 1}.** 비교: ${spec.comparison.join(', ')}. ${spec.difference}`);
selection.push('', '반복 빈도가 높더라도 회사가 작성한 정보의 적합성(08-003), 미공개 특수관계자 식별 후 조치(11-003)처럼 이미 직접 다루는 요구는 이번에 추가하지 않았다. 기존 9세트 제작 배치도 대조했으며 해당 배치의 재수록은 새 문제로 만들지 않았다. 현재 연결이 없다는 사실만으로 모든 신규 요구를 미출제로 확정한 것은 아니다.', '', '## 근거와 검증 자료', '', edition, '',
  `- [원출제·발문·재수록 제외 집계 연결](${reportRel(rel(path.join(base, 'frequency-links.json')))})`,
  `- [대조한 은행과 입력 해시](${reportRel(rel(path.join(base, 'inputs.json')))})`,
  `- [공식 다운로드·판본 대조 기록](${reportRel(rel(path.join(base, 'sources/provenance.json')))})`,
  `- [공식 문단 발췌](${reportRel(sourceFile)})`,
  `- [초안별 검사 결과](${reportRel(rel(path.join(base, 'validation.json')))})`, '',
  '카탈로그의 KGA 320 단위는 학습자료 전사이므로 정답 근거는 별도 공식 PDF와 대조하였다. KGA 530 보론 표는 기존 카탈로그의 A11에서 탐색하고 이 배치의 공식 표 발췌로 직접 입증한다. A11 자체에 표의 답이 전부 있다고 표시하지 않는다.', '',
  '작성자 QA는 모범답안·동의 표현·역순·한 문장·명제 누락·반대 의미·조건 경계·빈 답안의 기대 판정과 정수 합산을 확인하는 자료다. 후속 [실제 모델 채점·수정·재채점 결과](live-grading.md)는 별도 실행 증거로 관리한다. 정식 검수 receipt 통과·사람 승인·게시·배포는 완료하지 않았다.', '');
fs.writeFileSync(path.join(reportDir, 'questions.md'), questions.join('\n'));
fs.writeFileSync(path.join(reportDir, 'answers.md'), answers.join('\n'));
fs.writeFileSync(path.join(reportDir, 'README.md'), selection.join('\n'));
fs.writeFileSync(path.join(base, 'README.md'), '# 요구사항별 빈도 기반 보완 출제\n\n[문제·모범답안·선정 보고서](../../../docs/reports/question-authoring-frequency-priority-2026-09-10/README.md)\n\n`content.mjs`는 작성 정본, `build-batch.mjs`는 개별 초안·계획·QA·빈도 연결과 읽기용 문서 생성기다. `prepare-sources.py`는 공식 파일 확인 및 발췌를 재현한다. `verify-batch.ts`는 초안·인용·계획·빈도·점수 재생을 검사한다.\n\n재생성: `node cpa_uploader/drafts/frequency-priority-2026-09-10/build-batch.mjs`\n\n검사: `npx tsx cpa_uploader/drafts/frequency-priority-2026-09-10/verify-batch.ts`\n\n관계 장부의 검토 상태는 별도로 관리한다. 작성 초안이며 정본 승급·사람 승인·실제 모델 채점 완료를 의미하지 않는다.\n');
console.log(JSON.stringify({ sets: outputSets.length, subquestions: outputSets.flatMap(s => s.subquestions).length, points: outputSets.flatMap(s => s.subquestions).reduce((n, q) => n + q.criteria.length, 0) }));
