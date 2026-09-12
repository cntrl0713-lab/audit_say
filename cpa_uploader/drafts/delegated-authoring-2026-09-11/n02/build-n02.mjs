import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
import { buildSourceCatalog, sourceUnitToRef, createSourcePacket } from '../../../questionSourceCatalog.mjs';

const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/n02';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(`${folder}/${file}`, JSON.stringify(value, null, 2) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const catalog = buildSourceCatalog();
const ledger = read(`${control}/id-ledger.json`);
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const sourceMap = {};
for (const key of new Set(definitions.flatMap(d => d.questions.flatMap(q => q.criteria.flatMap(c => c.sources))))) {
  const [standard, paragraph, item] = key.split('.');
  const file = standard === '500' ? 'kga500-2025-review08.txt' : standard === '330' ? 'kga330-2025-review07.txt' : paragraph === '26' ? 'kga315-330-2025-review06.txt' : 'delegated-n02-kga315-2025.txt';
  const found = catalog.units.filter(u => u.file === `cpa_uploader/data/official/${file}` && u.paragraph === (item || paragraph) && (!item || u.locator.includes(`보론 ${paragraph.replace('app', '')}`)));
  if (found.length !== 1) throw new Error(`${key}가 유일하게 등록되지 않음: ${found.length}`);
  sourceMap[key] = { key, unit: found[0], ref: sourceUnitToRef(found[0]) };
}

const edition = '2027년 CPA 시험 대비이며 사례는 2026년 1월 1일 개시 보고기간이다. 총괄 edition-policy.md에 따라 2025년 11월 공식 전문의 시행 문맥을 적용하고 2026년 7월 전문의 관련 문단을 대조했다. 315.26(d)는 2026년판에서 적용자료 교차참조가 추가되었으나 해당 요구 문구는 같다. 2027년 공식 시험 공고는 출제 비중에 관한 것으로 특정 최종 판본을 확정하지 않는다. 미래 미공표 개정을 가정하지 않는다. 문단·보론 비교 및 파일 해시는 n02/evidence/phase1의 판본 장부에 보존한다.';
const summaries = [];
const packetInvestigations = [];
for (const d of definitions) {
  const assignment = ledger.entries.find(e => e.plan_id === d.planId && e.package === 'N02');
  if (!assignment || assignment.set_id !== d.id || assignment.questions.length !== d.questions.length) throw new Error(`배정 불일치 ${d.planId}`);
  const sourceKeys = [...new Set(d.questions.flatMap(q => q.criteria.flatMap(c => c.sources)))];
  const refs = sourceKeys.map(key => sourceMap[key].ref);
  const topicSample = bank.find(s => s.classification.topic_id === d.topic);
  let ci = 0;
  const set = {
    schema_version: '3.0', id: d.id, type: 'linked_question_set', status: 'needs_review', title: d.title,
    classification: { ...topicSample.classification, standards: [...new Set(sourceKeys.map(k => `KGA ${k.split('.')[0]}`))], tags: ['2027-CPA-출제검토', '공식근거-사례적용', d.planId, 'N02'] },
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
    scope: { actors: ['재무제표 감사팀', d.topic === '08' ? '매출·채권 담당자와 거래 상대방' : '기업의 지급·기록·대사 및 IT 통제 담당자'],
      timing: ['2026년 1월 1일 개시 보고기간과 해당 결산일 전후. 통제 이해 물음의 실행 확인과 기간 전체 운영효과성을 구별한다.'],
      conditions: d.facts.slice(1),
      exceptions: [d.topic === '06' ? '소규모 기업 등 직무분리가 실무적으로 곤란하면 같은 위험을 충분히 다루는 독립된 보완 통제를 허용한다. 자동통제의 운영효과성은 관련 IT 일반통제 테스트로 뒷받침할 수 있으므로 직접 통제테스트만을 유일한 방법으로 단정하지 않는다.' : '정보의 신뢰성 일반화에는 예외가 있으며 목적·상황별로 판단한다. 내부 총액 대사 또는 동일한 특정 일수로 모든 목적을 충족한다고 단정하지 않는다.'],
      required_answers: set.subquestions.flatMap(q => q.criteria.map(c => `${q.id}/${c.id}: ${c.claim}`)), exclusions: d.exclusions },
    question_types: [...new Set(d.questions.map(q => q.type))], source_unit_ids: [...refs.map(r => r.id), ...d.originIds],
    existing_question_difference: d.prior, edition_assumption: edition, unresolved_items: [], status: 'ready' };
  for (const id of plan.source_unit_ids) {
    const unit = catalog.units.find(u => u.id === id);
    if (!unit || !unit.topicIds.includes(d.topic)) throw new Error(`현재 카탈로그/분류 연결 불일치 ${d.planId}/${id}`);
  }
  write(`${d.id}.json`, [set]);
  write(`${d.id}.authoring-plan.json`, plan);
  const mapping = set.subquestions.map((q, qi) => ({ plan_question_id: `${d.planId}-Q${qi + 1}`, subquestion_id: q.id, criteria: q.criteria.map((c, j) => ({ criterion_id: c.id, points: c.max_points, claim: c.claim, source_keys: d.questions[qi].criteria[j].sources, source_ref_ids: c.source_ref_ids })) }));
  write(`${d.id}.source-bindings.json`, { version: 1, artifact_type: 'manual_source_evidence', set_id: d.id, plan_id: d.planId, mapping, source_refs: refs, original_learning_units: [...d.originIds, ...(d.adjacentOriginIds || [])].map(id => { const u = catalog.units.find(u => u.id === id); return { id, file: u.file, locator: u.locator, content_hash: u.contentHash, relationship: d.originIds.includes(id) ? 'adapted_primary' : 'adjacent_design_reference', topic_ids: u.topicIds }; }), catalog_fingerprint_at_binding: catalog.fingerprint, official_file_hashes: [...new Set(refs.map(r => r.file))].map(file => ({ file, sha256: hash(fs.readFileSync(file)) })), generation: 'manual_authoring_with_registered_sources', automatic_packet_is_complete: false });
  try {
    const packet = createSourcePacket({ topicId: d.topic, sourceIds: plan.source_unit_ids, maxChars: 200000, catalog });
    const evidencePath = `evidence/phase1/${d.id}.packet-investigation-${Date.now()}.json`;
    write(evidencePath, packet);
    packetInvestigations.push({ set_id: d.id, file: `${folder}/${evidencePath}`, keys: Object.keys(packet), dependency_completeness: packet.dependency_completeness, context_errors: packet.context_errors, packet_is_final: false });
  } catch (error) { packetInvestigations.push({ set_id: d.id, error: String(error), packet_is_final: false }); }
  summaries.push({ plan_id: d.planId, set_id: d.id, file: `${folder}/${d.id}.json`, sha256: hash(fs.readFileSync(`${folder}/${d.id}.json`)), plan: `${folder}/${d.id}.authoring-plan.json`, plan_sha256: hash(fs.readFileSync(`${folder}/${d.id}.authoring-plan.json`)), questions: set.subquestions.length, criteria: ci, points: ci, source_ids: refs.map(r => r.id) });
}
write('source-registration-map.json', { checked_at: new Date().toISOString(), catalog_fingerprint: catalog.fingerprint, sources: Object.values(sourceMap).map(({ key, unit, ref }) => ({ key, id: ref.id, file: ref.file, locator: unit.locator, paragraph: unit.paragraph, source_span: ref.source_span, quote_sha256: hash(ref.source_quote), content_hash: ref.content_hash, topic_ids: unit.topicIds })), parser_fix: `${control}/catalog-appendix-fix.json`, source_registration_initial_record: `${control}/source-registration-n02-kga315.json` });
write('draft-manifest.json', { version: 1, package: 'N02', checked_at: new Date().toISOString(), stage: 'draft_written_pending_static', sets: summaries, total_sets: summaries.length, total_questions: summaries.reduce((n, s) => n + s.questions, 0), total_points: summaries.reduce((n, s) => n + s.points, 0), packet_investigations: packetInvestigations, model_semantic_review: 'not_run', live_model_grading: 'not_run', published: false });
console.log(JSON.stringify(summaries.map(({ plan_id, set_id, questions, points }) => ({ plan_id, set_id, questions, points })), null, 2));
