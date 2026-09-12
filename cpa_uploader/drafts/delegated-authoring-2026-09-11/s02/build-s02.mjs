import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
import { buildSourceCatalog, sourceUnitToRef, createSourcePacket } from '../../../questionSourceCatalog.mjs';

const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s02';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(`${folder}/${file}`, JSON.stringify(value, null, 2) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const catalog = buildSourceCatalog();
const ledger = read(`${control}/id-ledger.json`);
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const sourceMap = {};
const registeredContext = ids => ids.map(id => {
  const u = catalog.units.find(u => u.id === id);
  if (!u || u.authority !== 'official_transcription') throw new Error(`보조 문맥 공식자료 없음 ${id}`);
  return `별도 득점요건이 아닌 등록 교차참조 문맥: 실제ID ${u.id}, 파일 ${u.file}, locator ${u.locator}, 파일SHA256 ${hash(fs.readFileSync(u.file))}. 원문: ${u.quote}`;
});
const supplementalContext = d => d.planId === 'T08-C'
  ? ['500.A55 각주23은620.7,500.A68 각주25는230.11을 가리킨다. 직접 답안은500.8/.11이며620.11 업무합의나230의 문서화 목록을 별도 점수로 요구하지 않는다.', ...registeredContext(['src-ff2aa4b5349550a125', 'src-21bdaeecb1163404d0'])]
  : d.planId === 'T06-C'
    ? read(`${folder}/evidence/phase1/supplementary-cross-context.json`).items.map(item => {
      const v = item.versions.find(v => v.year === 2025);
      return `별도 득점요건이 아닌 공식 교차참조 문맥 ${item.standard}.${item.paragraph}, 공식2025 전문${v.page}쪽. 파일 ${v.file}, SHA256 ${v.file_sha256}. 2026 같은문단과 대조하여 요구가 동일하다. 기업의 사업위험 전체를 감사인이 책임지는 것이 아니며 부정위험요소와 부정발생 확정을 구별한다. 존재하지 않는 등록ID를 만들지 않는다. 원문: ${v.quote}`;
    })
    : registeredContext(catalog.units.filter(u => u.file === 'cpa_uploader/data/official/kga315-330-2025-review06.txt' && u.standard === 'KGA 315' && ['31', '34'].includes(u.paragraph)).map(u => u.id));
for (const key of new Set(definitions.flatMap(d => [...d.questions.flatMap(q => q.criteria.flatMap(c => c.sources)), ...d.contextSources]))) {
  const [standard, paragraph, item] = key.split('.');
  let file;
  if (standard === '500') file = 'kga500-2025-review08.txt';
  else if (standard === '315') file = item ? 'delegated-s02-kga315-appendix2-2025.txt' : paragraph.startsWith('A') ? 'delegated-s02-kga315-2025.txt' : 'kga315-330-2025-review06.txt';
  else if (standard === '330') file = paragraph.startsWith('A') ? 'delegated-s02-kga330-2025.txt' : 'delegated-n03-kga330-2025.txt';
  else throw new Error(`지원 기준서가 아님 ${key}`);
  const found = catalog.units.filter(u => u.file === `cpa_uploader/data/official/${file}` && u.paragraph === (item || paragraph) && (!item || u.locator.includes(`보론 ${paragraph.replace('app', '')}`)));
  if (found.length !== 1) throw new Error(`${key}가 유일하게 등록되지 않음: ${found.length}`);
  sourceMap[key] = { key, unit: found[0], ref: sourceUnitToRef(found[0]) };
}

const edition = '2027년 CPA 시험 대비,2026년1월1일 개시 보고기간과 필요한2027년 후속업무다. 총괄 edition-policy.md를 따른다. 공식2025년11월 전문과2026년7월 전문의82개 직접·관련 문단 중80개는 공백·머리말 제외 동일하다.500.5 인접각주315제목 및500.A45 인접각주705제목만 달라 직접 요구는 같다. 추가315보론2.1/.2도 양판본이 동일하다. 2027 출제비중공고가 최종 기준서 판본을 지정한 것으로 주장하지 않는다. 등록 공식 원문과 source quote/span을 연결하며 계산과 법규·의견 유형의 별도 판단은 범위에서 제외한다.';

const summaries = [];
const packetInvestigations = [];
for (const d of definitions) {
  const assignment = ledger.entries.find(e => e.plan_id === d.planId && e.package === 'S02');
  if (!assignment || assignment.set_id !== d.id || assignment.questions.length !== d.questions.length) throw new Error(`배정 불일치 ${d.planId}`);
  const sourceKeys = [...new Set([...d.questions.flatMap(q => q.criteria.flatMap(c => c.sources)), ...d.contextSources])];
  const refs = sourceKeys.map(key => sourceMap[key].ref);
  const topicSample = bank.find(s => s.classification.topic_id === d.topic);
  let ci = 0;
  const set = {
    schema_version: '3.0', id: d.id, type: 'linked_question_set', status: 'needs_review', title: d.title,
    classification: { ...topicSample.classification, standards: [...new Set(sourceKeys.map(k => `KGA ${k.split('.')[0]}`))], tags: ['2027-CPA-출제검토', '공식근거-사례적용', d.planId, 'S02'] },
    source_refs: refs,
    shared_context: { facts: d.facts.map((text, i) => ({ id: `fact${i + 1}`, text, scoreable: false })) },
    learning_order: d.questions.map((_, i) => assignment.questions[i].suggested_id),
    subquestions: d.questions.map((q, i) => {
      const id = assignment.questions[i].suggested_id;
      if (q.criteria.length !== assignment.questions[i].provisional_points) throw new Error(`점수 배정 불일치 ${d.planId}/${id}`);
      const criteria = q.criteria.map(c => {
        ci++;
        return { id: `crit${ci}`, requirement_id: `req${ci}`, claim: c.answer,
          critical_facts: [{ id: `cf${ci}`, type: q.type === 'judgment' && !c.answer.includes('절차') ? 'conclusion' : 'action', expected: c.answer }],
          max_points: 1, scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: c.sources.map(k => sourceMap[k].ref.id) };
      });
      return { id, type: q.type, prompt: q.prompt,
        constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, decision: null,
        answer_slots: [{ id: 'answer', label: '답안', input: 'textarea' }], model_answer: q.criteria.map(c => c.answer),
        requirements: criteria.map((c, j) => { const ref = sourceMap[q.criteria[j].sources[0]].ref; return { id: c.requirement_id, source_ref_id: ref.id, source_quote: ref.source_quote, source_span: ref.source_span }; }), criteria };
    }),
    verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: [
      edition, '공식 source_refs의 문구는 실제 등록 원문에 연결한다. 사례와 발문은 원발문의 목표를 바탕으로 수동 재구성한 것으로 공식 문구나 실제 사건으로 표시하지 않는다.',
      d.prior, `계획 ID ${d.planId}는 ${d.id}에 대응한다. 실제 ID는 총괄 id-ledger.json으로 배정했고 기존 문항 ID를 바꾸지 않았다.`,
      '모든 요구를 평가하고 순서·개수 상한·여분 답안 잘라내기를 적용하지 않는다. 대안적이지만 동등한 절차·통제와 조치에 함축된 판단을 허용한다. 지문 사실을 옮겨 쓴 것만으로 답해야 할 판단·인과관계·절차를 대신할 수 없다.',
      '현재는 출처·설계·작성자 기대판정과 정적 검증을 준비하는 1차다. 독립 모델 의미검수와 비어 있지 않은 실제 모델 채점은 총괄의 비교 은행·출처 고정 뒤 수행하며, 게시·정본 편입·사람 확인 완료를 뜻하지 않는다.'
    ] }
  };
  const plan = { version: 1, set_id: d.id, topic_id: d.topic, mode: 'adapt_existing_question', objective: d.objective,
    scope: { actors: ['재무제표 감사팀', d.planId === 'T08-C' ? '경영진 및 기업과 계약한 가치평가 전문가' : '기업의 경영진·재무제표 작성자·통제 담당자'],
      timing: ['2026년 1월 1일 개시 보고기간의 계획·중간감사·결산일 및 필요한2027년 후속업무. 사실에서 정한 기준일과 절차의 수행시점을 구별한다.'],
      conditions: d.facts.slice(1),
      exceptions: [d.planId === 'T08-C' ? '경영진측 전문가 업무의 유의성을 고려해 감사목적에 필요한 정도로 수행한다. 자격이나 보수연동만으로 보고서를 자동 수용·폐기하지 않는다. 감사인측 전문가가 필요할 수 있지만 그 합의사항은 답안이 아니다.' : d.planId === 'T06-C' ? '기업이 놓친 위험이라도 그 절차에서 식별할 것으로 기대했는지 먼저 판단한다. 비공식적 위험평가절차도 있을 수 있으며 새 정보를 모두 자동 유의적 위험으로 바꾸지 않는다. 통제를 고려하기 전 고유위험요소를 평가한다.' : '의존할 수 없는 것은 사례의 관련 통제다. 조회는 위험과 관련된 범위에서 계속 사용한다는 조건이며 기말 기준 증거와2월 발송시점을 혼동하지 않는다.500.A61의 관련 통제테스트를 통한 데이터품질 증거도 허용한다. T07-C-Q1/Q3는N02 이후 적용복습이며 신규커버리지로 세지 않는다.'],
      required_answers: set.subquestions.flatMap(q => q.criteria.map(c => `${q.id}/${c.id}: ${c.claim}`)), exclusions: d.exclusions },
    question_types: [...new Set(d.questions.map(q => q.type))], source_unit_ids: [...refs.map(r => r.id), ...d.originIds],
    existing_question_difference: d.prior, edition_assumption: edition, unresolved_items: [], status: 'ready' };
  plan.scope.exceptions.push(...supplementalContext(d));
  for (const id of plan.source_unit_ids) {
    const unit = catalog.units.find(u => u.id === id);
    if (!unit || unit.authority === 'official_transcription' && !unit.topicIds.includes(d.topic)) throw new Error(`현재 카탈로그/공식분류 연결 불일치 ${d.planId}/${id}`);
  }
  write(`${d.id}.json`, [set]);
  write(`${d.id}.authoring-plan.json`, plan);
  const mapping = set.subquestions.map((q, qi) => ({ plan_question_id: `${d.planId}-Q${qi + 1}`, subquestion_id: q.id, criteria: q.criteria.map((c, j) => ({ criterion_id: c.id, points: c.max_points, claim: c.claim, source_keys: d.questions[qi].criteria[j].sources, source_ref_ids: c.source_ref_ids })) }));
  write(`${d.id}.source-bindings.json`, { version: 1, artifact_type: 'manual_source_evidence', set_id: d.id, plan_id: d.planId, mapping, source_refs: refs, original_learning_units: [...d.originIds, ...(d.adjacentOriginIds || [])].map(id => { const u = catalog.units.find(u => u.id === id); return { id, file: u.file, locator: u.locator, content_hash: u.contentHash, relationship: d.originIds.includes(id) ? 'adapted_primary' : 'adjacent_design_reference', topic_ids: u.topicIds }; }), catalog_fingerprint_at_binding: catalog.fingerprint, official_file_hashes: [...new Set(refs.map(r => r.file))].map(file => ({ file, sha256: hash(fs.readFileSync(file)) })), generation: 'manual_authoring_with_registered_sources', automatic_packet_is_complete: false });
  try {
    const packet = createSourcePacket({ topicId: d.topic, sourceIds: plan.source_unit_ids, maxChars: 400000, catalog });
    const evidencePath = `evidence/phase1/${d.id}.packet-investigation-${Date.now()}.json`;
    write(evidencePath, packet);
    packetInvestigations.push({ set_id: d.id, file: `${folder}/${evidencePath}`, keys: Object.keys(packet), dependency_completeness: packet.dependency_completeness, context_errors: packet.context_errors, packet_is_final: false });
  } catch (error) { packetInvestigations.push({ set_id: d.id, error: String(error), packet_is_final: false }); }
  summaries.push({ plan_id: d.planId, set_id: d.id, file: `${folder}/${d.id}.json`, sha256: hash(fs.readFileSync(`${folder}/${d.id}.json`)), plan: `${folder}/${d.id}.authoring-plan.json`, plan_sha256: hash(fs.readFileSync(`${folder}/${d.id}.authoring-plan.json`)), questions: set.subquestions.length, criteria: ci, points: ci, source_ids: refs.map(r => r.id) });
}
write('source-registration-map.json', { checked_at: new Date().toISOString(), catalog_fingerprint: catalog.fingerprint, sources: Object.values(sourceMap).map(({ key, unit, ref }) => ({ key, id: ref.id, file: ref.file, locator: unit.locator, paragraph: unit.paragraph, source_span: ref.source_span, quote_sha256: hash(ref.source_quote), content_hash: ref.content_hash, topic_ids: unit.topicIds })), registration_manifests: [`${control}/source-registration-s02-kga315.json`, `${control}/source-registration-s02-kga330.json`, `${control}/source-registration-s02-kga315-appendix2.json`] });
write('draft-manifest.json', { version: 1, package: 'S02', checked_at: new Date().toISOString(), stage: 'draft_written_pending_static', sets: summaries, total_sets: summaries.length, total_questions: summaries.reduce((n, s) => n + s.questions, 0), total_points: summaries.reduce((n, s) => n + s.points, 0), packet_investigations: packetInvestigations, model_semantic_review: 'not_run', live_model_grading: 'not_run', published: false });
console.log(JSON.stringify(summaries.map(({ plan_id, set_id, questions, points }) => ({ plan_id, set_id, questions, points })), null, 2));
