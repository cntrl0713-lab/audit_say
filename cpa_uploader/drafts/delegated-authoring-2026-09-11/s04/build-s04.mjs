import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { definitions } from './content.mjs';
import { buildSourceCatalog, sourceUnitToRef, createSourcePacket } from '../../../questionSourceCatalog.mjs';

const folder = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/s04';
const control = 'cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(`${folder}/${file}`, JSON.stringify(value, null, 2) + '\n');
const hash = value => createHash('sha256').update(value).digest('hex');
const catalog = buildSourceCatalog();
const ledger = read(`${control}/id-ledger.json`);
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const sourceMap = {};
const supplementalContext = d => {
  const source = read(`${folder}/sources/supplementary-cross-context.json`);
  const selected = d.planId === 'T10-C' ? ['KGA 315','KGA 330','KGA 320','KGA 500'] : d.planId === 'T12-C' ? ['KGA 320','KGA 700'] : d.planId === 'T12-D' ? ['KGA 580','KGA 210','KGA 705'] : [];
  const ids = d.planId === 'T10-C' ? ['src-b9fb1f4cecefc55ca4','src-ff9452743975ce975f','src-76885938f19682ee3b'] : d.planId === 'T12-C' ? ['src-cf48998e374d9facdc','src-bf37526631a4d268cf','src-2d5646d6a0eb9bbba5'] : d.planId === 'T12-D' ? ['src-77a6e86a4450489a5e','src-3a02c5c340fba28e3a','src-f60ace40f5c68198f9'] : [];
  const registered = ids.map(id => { const u = catalog.units.find(u => u.id === id); if (!u || u.authority !== 'official_transcription') throw new Error(`공식 교차문맥 없음 ${id}`); return `별도 득점요건이 아닌 등록 교차참조 문맥: 실제ID ${id}, 파일 ${u.file}, locator ${u.locator}, 파일SHA256 ${hash(fs.readFileSync(u.file))}. 원문: ${u.quote}`; });
  return [...registered, ...source.versions['2025'].entries.filter(e => selected.includes(e.standard)).map(e => `추가 득점요건이 아닌 필수 교차참조 문맥 ${e.standard}.${e.paragraph}, 공식2025 전문 ${e.pages.join(',')}쪽; 파일 ${source.versions['2025'].file}, SHA256 ${source.versions['2025'].file_sha256}. 양판본 비교는sources/supplementary-cross-context.json에 보존했다. 원문: ${e.quote}`)];
};
for (const key of new Set(definitions.flatMap(d => [...d.questions.flatMap(q => q.criteria.flatMap(c => c.sources)), ...d.contextSources]))) {
  const [standard, paragraph, item] = key.split('.');
  const file = standard === '315' ? (paragraph.startsWith('A') ? 'delegated-s04-kga315-2025.txt' : 'kga315-330-2025-review06.txt') : 'delegated-s04-kga-2025.txt';
  const found = catalog.units.filter(u => u.file === `cpa_uploader/data/official/${file}` && u.standard === `KGA ${standard}` && u.paragraph === paragraph);
  if (found.length !== 1) throw new Error(`${key}가 유일하게 등록되지 않음: ${found.length}`);
  sourceMap[key] = { key, unit: found[0], ref: sourceUnitToRef(found[0]) };
}

const edition = '2027년CPA시험 대비,2026년1월1일개시보고기간과필요한2027년후속업무다. 총괄edition-policy.md를따른다. 공식2025년11월전문과2026년7월전문의450/520/530/580 선택102문단 및추가315.A27~A31 다섯문단은공백제외동일하다. 보조교차문맥의별도대조장부를보존한다.2027출제비중공고가최종기준서판본을지정한것으로주장하지않는다. 사례금액계산과사람확인·정본편입·게시·배포는범위밖이다.';


const summaries = [];
const packetInvestigations = [];
for (const d of definitions) {
  const assignment = ledger.entries.find(e => e.plan_id === d.planId && e.package === 'S04');
  if (!assignment || assignment.set_id !== d.id || assignment.questions.length !== d.questions.length) throw new Error(`배정 불일치 ${d.planId}`);
  const sourceKeys = [...new Set([...d.questions.flatMap(q => q.criteria.flatMap(c => c.sources)), ...d.contextSources])];
  const refs = sourceKeys.map(key => sourceMap[key].ref);
  const topicSample = bank.find(s => s.classification.topic_id === d.topic);
  let ci = 0;
  const set = {
    schema_version: '3.0', id: d.id, type: 'linked_question_set', status: 'needs_review', title: d.title,
    classification: { ...topicSample.classification, standards: [...new Set(sourceKeys.map(k => `KGA ${k.split('.')[0]}`))], tags: ['2027-CPA-출제검토', '공식근거-사례적용', d.planId, 'S04'] },
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
  const plan = { version: 1, set_id: d.id, topic_id: d.topic, mode: d.mode || 'adapt_existing_question', objective: d.objective,
    scope: { actors: ['재무제표 감사팀', '기업의 경영진·재무제표 작성자'],
      timing: ['2026년1월1일개시보고기간의계획·감사수행·종결및필요한2027년후속업무'],
      conditions: d.facts.slice(1), exceptions: d.exceptions,
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
    const packet = createSourcePacket({ topicId: d.topic, sourceIds: plan.source_unit_ids, maxChars: 500000, catalog });
    const evidencePath = `evidence/phase1/${d.id}.packet-investigation-${Date.now()}.json`;
    write(evidencePath, packet);
    packetInvestigations.push({ set_id: d.id, file: `${folder}/${evidencePath}`, keys: Object.keys(packet), dependency_completeness: packet.dependency_completeness, context_errors: packet.context_errors, packet_is_final: false });
  } catch (error) { packetInvestigations.push({ set_id: d.id, error: String(error), packet_is_final: false }); }
  summaries.push({ plan_id: d.planId, set_id: d.id, file: `${folder}/${d.id}.json`, sha256: hash(fs.readFileSync(`${folder}/${d.id}.json`)), plan: `${folder}/${d.id}.authoring-plan.json`, plan_sha256: hash(fs.readFileSync(`${folder}/${d.id}.authoring-plan.json`)), questions: set.subquestions.length, criteria: ci, points: ci, source_ids: refs.map(r => r.id) });
}
write('source-registration-map.json', { checked_at: new Date().toISOString(), catalog_fingerprint: catalog.fingerprint, sources: Object.values(sourceMap).map(({ key, unit, ref }) => ({ key, id: ref.id, file: ref.file, locator: unit.locator, paragraph: unit.paragraph, source_span: ref.source_span, quote_sha256: hash(ref.source_quote), content_hash: ref.content_hash, topic_ids: unit.topicIds })), registration_manifests: [`${control}/source-registration-s04-kga-2025.json`, `${control}/source-registration-s04-kga315.json`] });
write('draft-manifest.json', { version: 1, package: 'S04', checked_at: new Date().toISOString(), stage: 'draft_written_pending_static', sets: summaries, total_sets: summaries.length, total_questions: summaries.reduce((n, s) => n + s.questions, 0), total_points: summaries.reduce((n, s) => n + s.points, 0), packet_investigations: packetInvestigations, model_semantic_review: 'not_run', live_model_grading: 'not_run', published: false });
console.log(JSON.stringify(summaries.map(({ plan_id, set_id, questions, points }) => ({ plan_id, set_id, questions, points })), null, 2));
