import fs from 'node:fs';
import { createHash } from 'node:crypto';

const base = 'cpa_uploader/drafts/case-expansion-2026-09-13/';
const out = `${base}b/`;
const bank = JSON.parse(fs.readFileSync(`${base}bank-before.json`, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(`${base}catalog-before.json`, 'utf8'));
const source = JSON.parse(fs.readFileSync(`${base}source-catalog.json`, 'utf8'));
const sha = v => createHash('sha256').update(v).digest('hex');
const clone = v => structuredClone(v);
const unit = id => { const u = source.units.find(u => u.id === id); if (!u) throw Error(`Missing source ${id}`); return u; };
const sets = [], designs = [], reviews = [], qa = [];
const learningFile = name => `cpa_uploader/data/회계감사_통합학습자료/${name}`;
const advanced = '03_문제연습/고급_회계감사_연습.md';
const examA = '04_기출문제/기출문제_연도별_해설_A.md';
const examB = '04_기출문제/기출문제_연도별_해설_B.md';

function excerpt(file, from, to, relation, reason) {
  const path = learningFile(file), data = fs.readFileSync(path, 'utf8');
  return { file: path, start_line: from, end_line: to, quote: data.split(/\r?\n/).slice(from - 1, to).join('\n'), file_sha256: sha(data), source_unit_ids: source.units.filter(u => u.file === path && u.startLine <= to && u.endLine >= from).map(u => u.id), relation, reason, authority: 'learning_material', counted_as_new_occurrence: false };
}
function ref(s, id, uid) {
  const u = unit(uid);
  if (u.authority !== 'official_transcription') throw Error(`Unofficial ${uid}`);
  const r = { id, file: u.file, title: `${u.standard} ${u.title}; ${u.locator}`, page: u.standard, role: 'standard', source_quote: u.quote, content_hash: sha(u.quote), source_span: u.locator };
  const old = s.source_refs.findIndex(r => r.id === id);
  if (old >= 0) s.source_refs[old] = r; else s.source_refs.push(r);
  return r;
}
function question(s, id, type, prompt, claims, refs, topics, expectedNotes = {}) {
  const rs = refs.map(rid => s.source_refs.find(r => r.id === rid));
  if (rs.some(r => !r)) throw Error(`Missing ref ${s.id}/${id}`);
  const q = { id, type, question_style: 'case', topic_ids: topics, prompt, constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, selection: { type: 'all', n: null }, model_answer: claims, requirements: rs.map((r, i) => ({ id: `${id}.r${i + 1}`, source_ref_id: r.id, source_quote: r.source_quote, source_span: r.source_span ?? r.title })), criteria: claims.map((claim, i) => ({ id: `${id}.c${i + 1}`, requirement_id: `${id}.r${Math.min(i + 1, rs.length)}`, claim, critical_facts: [{ id: `${id}.c${i + 1}.core`, type: 'action', expected: expectedNotes[i] ?? claim }], max_points: 1, scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: refs })) };
  s.subquestions.push(q); return q;
}
function start(id, facts, title) {
  const original = bank.find(s => s.id === id), s = clone(original);
  const classes = catalog.classifications.filter(c => c.source_set_id === id);
  s.subquestions = s.subquestions.filter(q => classes.find(c => c.subquestion_id === q.id)?.question_style === 'case');
  for (const q of s.subquestions) { q.question_style = 'case'; q.topic_ids = clone(classes.find(c => c.subquestion_id === q.id).topic_ids); }
  s.shared_context.facts = facts.map((text, i) => ({ id: `fact${i + 1}`, text, scoreable: false }));
  s.title = title; s.status = 'needs_review';
  s.verification = { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false, notes: ['2026-09-13 사례 보강 초안. 기출·고급회계감사연습의 발문과 해설을 참고하여 창작·재구성하였다. 과거 사실·물음·검수 증거는 bank-before.json 및 원래 실행 경로에 보존한다.', '기존 저장 묶음의 기준서형은 사례에서 제외하고 총괄이 별도 기준서형 저장 묶음으로 원문·기준·배점을 보존한다. 이 초안의 agent 내용검수와 실제 Luna 채점·승급·게시·사람 확인은 별도 상태이다.', '2026년 1월 1일 개시 보고기간의 기존 출처 판본 범위를 유지한다. 2027년 시험 적용 판본이 최종 확정되었다고 주장하지 않는다. 사실관계의 회사·조건은 학습용 재구성이며 공식 원문이나 실제 사건의 인용이 아니다.'] };
  return s;
}
function addQa(s, qid, kind, answer, met, reason) {
  const q = s.subquestions.find(q => q.id === qid);
  if (!q || met.some(id => !q.criteria.some(c => c.id === id))) throw Error(`Bad QA ${s.id}/${qid}`);
  qa.push({ set_id: s.id, subquestion_id: qid, kind, answer, expected_points: q.criteria.filter(c => met.includes(c.id)).reduce((a, c) => a + c.max_points, 0), met_criterion_ids: met, reason });
}
function finish(s, config) {
  const original = bank.find(x => x.id === s.id);
  s.learning_order = s.subquestions.map(q => q.id);
  // Same official quotation may already exist in the retained question. Keep
  // its stable reference id and connect the new requirement to that reference.
  const canonicalRefs = new Map(), aliases = new Map();
  for (const r of s.source_refs) {
    const key = `${r.file}\n${r.source_quote}`;
    if (canonicalRefs.has(key)) aliases.set(r.id, canonicalRefs.get(key));
    else canonicalRefs.set(key, r.id);
  }
  for (const q of s.subquestions) {
    for (const r of q.requirements) r.source_ref_id = aliases.get(r.source_ref_id) ?? r.source_ref_id;
    for (const c of q.criteria) c.source_ref_ids = [...new Set(c.source_ref_ids.map(id => aliases.get(id) ?? id))];
  }
  const used = new Set(s.subquestions.flatMap(q => [...q.requirements.map(r => r.source_ref_id), ...q.criteria.flatMap(c => c.source_ref_ids)]));
  s.source_refs = s.source_refs.filter(r => used.has(r.id));
  s.classification.standards = [...new Set(s.source_refs.filter(r => r.role === 'standard').map(r => r.page))];
  const factLength = [...s.shared_context.facts.map(f => f.text).join('\n')].length;
  if (factLength < 400 || s.subquestions.length < 2 || s.subquestions.length > 4) throw Error(`User constraint ${s.id} ${factLength}`);
  const sourceMatches = s.source_refs.map(r => ({ source_ref_id: r.id, file: r.file, source_span: r.source_span ?? r.title, source_quote_sha256: sha(r.source_quote), source_unit_ids: source.units.filter(u => u.file === r.file && (u.quote.includes(r.source_quote) || r.source_quote.includes(u.quote))).map(u => u.id) }));
  const officialIds = [...new Set([...sourceMatches.flatMap(r => r.source_unit_ids), ...(config.official_ids ?? [])])];
  const plan = { set_id: s.id, version: 1, topic_id: s.classification.topic_id, mode: 'adapt_existing_question', objective: config.objective, scope: { actors: config.actors ?? ['재무제표감사인', '피감사기업의 경영진'], timing: ['2026년 1월 1일 개시 보고기간의 감사; 개별 지문에 명시된 기중·기말 및 감사종결 시점'], conditions: config.conditions, exceptions: config.exceptions ?? ['해당 없음: 발문 범위 밖의 감사의견 결정이나 법규상 별도 예외를 추론하도록 요구하지 않는다.'], required_answers: s.subquestions.map(q => `${q.id}: ${q.prompt}`), exclusions: config.exclusions }, question_types: [...new Set(s.subquestions.map(q => q.type))], source_unit_ids: [...new Set([...officialIds, ...config.reads.flatMap(r => r.source_unit_ids)])], existing_question_difference: config.difference, edition_assumption: 'bank-before.json의 2026년 1월 1일 개시 보고기간 및 기존 2025년 전문/2026년 대조 기록 범위를 유지한다. 아래 공식 전사와 의존 문단을 읽어 명제를 검토했으며 학습교재의 옛 문단번호·정수 미만 배점·선택 개수는 그대로 승계하지 않는다.', unresolved_items: [], status: 'ready', lineage: { previous_set_id: s.id, previous_set_sha256: sha(JSON.stringify(original)), retained_case_subquestion_ids: s.subquestions.filter(q => original.subquestions.some(o => o.id === q.id)).map(q => q.id), added_case_subquestion_ids: s.subquestions.filter(q => !original.subquestions.some(o => o.id === q.id)).map(q => q.id), standard_subquestions_for_separate_preservation: catalog.classifications.filter(c => c.source_set_id === s.id && c.question_style === 'standard').map(c => c.subquestion_id) }, fact_question_mapping: config.mapping, facts_unicode_characters: factLength, source_reading: config.reads, official_source_mapping: sourceMatches, source_limitations: config.limitations ?? ['기출·연습의 해당 요구와 인접 요구를 설계 근거로만 사용한다. 새 사실과 추가 물음을 기존 실제 출제로 집계하지 않는다.'], agent_review_status: 'content_reviewed', actual_model_grading_status: 'not_run_by_subagent' };
  designs.push(plan); sets.push(s);
  reviews.push({ set_id: s.id, reviewer: 'Codex expand_b agent', method: '실제 기출·고급연습 발문/해설 및 공식 전사 문맥과 직접 대조한 작성·내용검수', source_fidelity: 'reconstructed', fact_length: factLength, all_facts_used: true, answer_leakage_review: config.leakage, questions: s.subquestions.map(q => ({ subquestion_id: q.id, question_style: 'case', topic_ids: q.topic_ids, required_content: q.prompt, minimum_sufficient_answer: q.model_answer.join('\n'), max_points: q.criteria.reduce((a, c) => a + c.max_points, 0), criteria: q.criteria.map(c => ({ criterion_id: c.id, independently_scoreable_meaning: c.claim, integer_points: c.max_points, source_ref_ids: c.source_ref_ids, source_support: config.support[q.id], verdict: 'supported', partial_rule: '명시적 반대는 해당 명제 0점; 별도로 옳은 독립 근거는 보존하며 근거·조치가 결론을 함축하면 결론을 인정한다.' })), facts_used: config.mapping.filter(m => m.subquestion_ids.includes(q.id)).map(m => m.fact_id), classification_reason: config.classification[q.id], point_reasonableness_decision: original.subquestions.some(o => o.id === q.id) ? '유지: 기존 사례형의 독립 의미와 criterion ID·정수 배점을 보존하고 확장 사실과의 정합성을 대조했다.' : config.point_reason[q.id], response_burden: `${q.criteria.length}개 독립 명제에 관한 짧은 사례 적용. 일반론 전체 또는 최종 의견을 추가 요구하지 않으며 발문에 정한 범위만 평가한다.`, comparison: config.comparison, model_answer_covers_all: true, all_criteria_visible_in_prompt: true, unresolved: [] })), source_edition_review: plan.edition_assumption, unresolved: [], paid_semantic_api: 'not_run', actual_grading: 'delegated_to_root', human_review: 'not_claimed' });
}

{
  const s = start('pilot-13-007', [
    'A사는 2026년 1월 1일부터 12월 31일까지의 급여 계산과 지급업무를 서비스조직 C사에 위탁하고 있다. A사는 매월 근태자료와 승인된 급여변동 내역을 보내며, C사는 이를 입력해 급여를 계산하고 은행 이체파일을 만든다. 감사인은 급여 계산 및 이체파일 승인 통제가 연중 효과적으로 운영된다는 기대를 전제로 실증절차의 범위를 계획하였다.',
    '감사팀이 입수한 자료는 결산일 현재 C사의 시스템과 통제를 기술한 유형 1 보고서이다. 담당자는 보고서에 적정한 의견이 붙어 있다는 이유로 이를 급여 관련 통제의 운영효과성에 관한 감사증거로 사용하고 추가 통제테스트 없이 감사를 마무리하려고 한다. 서비스감사인의 적격성과 독립성, 보고서 적용 기준의 적절성은 별도로 확인하였다.',
    'C사는 당기 대상 유형 2 보고서를 감사보고서 발행기한 안에 제공할 수 없다고 회신하였다. 해당 통제를 테스트한 타감사인의 업무도 이용할 수 없다. 다만 A사의 동의를 받아 감사인이 C사를 방문할 수 있으며, C사는 연중 급여 계산기록과 승인기록 및 담당자에 대한 접근을 허용한다. 담당자는 유형 2 보고서가 나올 때까지 운영효과성 증거의 확보를 생략해도 된다고 주장한다.'
  ], '급여 서비스조직의 유형 1 보고서와 추가 통제증거');
  ref(s, 'exp-402-16', 'src-2e3463fea2ede2582c');
  question(s, 'exp1', 'judgment', '감사인이 현재의 통제 의존 계획을 유지한다면, 운영효과성 증거의 확보를 생략해도 된다는 주장이 적절한지 판단하고 현재 이용 가능한 수단에 따라 수행해야 할 절차를 제시하시오.', [
    '운영효과성 증거의 확보를 생략해도 된다는 주장은 부적절하다. 급여 통제가 효과적으로 운영된다는 기대를 유지하려면 그 운영효과성에 관한 감사증거가 필요하다.',
    '기한 내 유형 2 보고서와 타감사인의 테스트 업무를 이용할 수 없고 C사 접근이 허용되므로, 감사인은 C사의 급여 계산 및 이체파일 승인 통제에 대하여 적합한 통제테스트를 직접 수행한다.'
  ], ['exp-402-16'], ['13', '07'], { 0: '생략 불가라는 명시적 판단 또는 제시된 통제 의존 계획 때문에 C사 통제의 운영효과성 증거를 확보해야 한다는 조치·이유가 있으면 인정. 유형 2 보고서가 없다는 이유로 증거 확보를 생략할 수 있다는 반대 결론은 불인정.' });
  addQa(s, 'sub1', 'partial', '유형 1 보고서를 운영효과성 증거로 사용하는 계획은 부적절하다.', ['crit1'], '판단만 있고 보고서의 증거 한계가 없다.');
  addQa(s, 'sub1', 'wrong', '유형 1 보고서에 적정의견이 붙어 있으므로 연중 운영효과성 증거로 충분하다.', [], '유형 1과 유형 2의 증거범위를 혼동한 반대 결론이다.');
  addQa(s, 'exp1', 'partial', '현재와 같이 급여 통제에 의존하려면 운영효과성 증거를 확보해야 하므로 생략할 수 없다.', ['exp1.c1'], '증거 확보 필요성은 인정하지만 실제 이용 가능한 직접 테스트를 제시하지 않았다.');
  addQa(s, 'exp1', 'wrong', '유형 2 보고서가 없으므로 운영효과성 증거는 생략하고 유형 1 보고서의 적정의견만 사용한다.', [], '직접 접근 가능성을 사용하지 않고 증거 생략을 주장한다.');
  finish(s, { objective: '서비스조직 보고서의 유형과 실제 접근 가능한 증거수단을 연결하여 통제 의존 계획의 후속절차를 결정한다.', conditions: ['C사 급여 통제 운영효과성 기대를 유지한다.', '유형 2 보고서·타감사인의 테스트 업무는 기한 내 이용 불가, 직접 접근 가능'], exclusions: ['보고서의 세 가지 적격성 조건 재열거', '통제 의존 전략을 포기한 경우의 실증절차 설계', '유형 2 보고서 상세 검토 목록'], difference: '기존 sub1 2점은 보존한다. 일반론 sub2·sub3을 제외하고, 보고서·타감사인 업무 이용불가와 직접 접근 허용을 해석해야 하는 exp1 2점을 신설한다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['sub1', 'exp1'], use: '급여 위탁의 거래흐름과 통제 의존 전제' }, { fact_id: 'fact2', subquestion_ids: ['sub1'], use: '유형 1 보고서의 증거 한계와 다른 검토범위의 분리' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '선택 가능한 증거수단을 직접 통제테스트로 한정' }], reads: [excerpt(examA, 914, 940, 'direct', '2025년 문제3 물음3의 급여 위탁·유형1 보고서 이용 계획을 재구성'), excerpt(examB, 9342, 9352, 'direct', '동일 기출 해설의 운영효과성 증거 부재 확인'), excerpt(advanced, 3050, 3054, 'partial', '통제 운영효과성 기대와 실증절차 연결'), excerpt(advanced, 3075, 3079, 'partial', '급여 위탁의 유형2 외 대체 테스트를 구체 조건으로 바꿈'), excerpt(advanced, 3112, 3117, 'direct', '자체 테스트·타감사인 업무 대안 확인')], official_ids: ['src-0cd712b8db350ceb20'], leakage: 'C사 시스템 설명·보고서 명칭·접근 가능성만 제시하며 보고서 한계나 직접 테스트의 의무 결론은 지문에 주지 않았다.', support: { sub1: '402.A22는 유형1이 운영효과성 증거를 제공하지 않는다고 명시한다.', exp1: '402.16은 통제 기대가 포함되면 운영효과성 증거를 입수해야 하며 직접 적합한 테스트를 허용한다. 입수가능성 조건으로 나머지 수단을 제외한다.' }, classification: { sub1: 'A사가 받은 보고서의 유형과 감사팀의 이용목적을 비교해야 한다.', exp1: '서비스 통제 의존, 두 수단 이용불가 및 직접 접근 가능성 없이는 같은 조치를 확정할 수 없다.' }, point_reason: { exp1: '신설 2점: 제시된 생략 계획의 판단 1점과 이용 가능 수단을 적용한 직접 테스트 1점. 관련 일반 대안 전체는 별도로 묻지 않는다.' }, comparison: '기존 sub1 및 pilot-13-011/sub2의 판단+직접 근거 2점과 동일한 규모.' });
}

{
  const s = start('pilot-13-011', [
    '온유회사의 2026년 1월 1일부터 12월 31일까지의 재무제표를 감사한다. 회사는 급여 계산을 서비스조직 새롬에 맡기고 있으며 감사인은 급여 통제의 운영효과성 증거로 새롬의 유형 2 보고서를 이용할 계획이다. 이 보고서는 당기 전체 기간을 다루고 있고 서비스감사인의 적격성·독립성과 적용 기준에 대한 검토에서는 문제가 발견되지 않았다.',
    '보고서에는 급여데이터의 입력과 변환을 맡은 하위서비스조직 다온의 통제가 범위에서 제외되어 있다. 다온은 근태파일의 직원번호와 급여코드를 변환하여 새롬의 계산시스템에 전달한다. 감사인은 이 처리 과정에서 오류가 발생하면 온유회사의 급여 금액에 영향을 줄 수 있어 다온의 서비스가 당기 재무제표감사와 관련된다고 판단했다. 담당자는 보고서에서 제외한 조직까지 확인할 필요는 없다고 한다.',
    '또한 보고서는 온유회사가 매월 급여 지급 전에 직원 명부를 인사기록과 대조하고 퇴직자 지급액을 검토하는 것을 전제로 한다. 온유회사의 급여 담당자는 해당 검토규정을 보여주었으나 실제 수행 증거는 아직 제시하지 않았다. 특히 검토 담당자가 9월 말 퇴사한 뒤 누가 검토했는지 확인되지 않았고 10~12월 검토기록도 받지 못하였다. 감사팀원은 새롬의 보고서에 문제가 없으므로 온유회사에서 추가 확인은 필요 없다고 주장한다.'
  ], '급여 유형 2 보고서의 제외 범위와 이용자기업 통제');
  ref(s, 'exp-402-17', 'src-0f2c39b6322f710c8f');
  question(s, 'exp1', 'descriptive', '유형 2 보고서에 제시된 직원 명부 대조·퇴직자 지급액 검토에 관하여, 온유회사에서 수행할 절차를 설명하시오. 해당 통제의 관련성, 설계, 실제 실행 및 운영효과성을 구별하고 검토 담당자 변경과 미입수 기록을 고려하시오.', [
    '직원 명부 대조와 퇴직자 지급액 검토는 온유회사의 급여 지급 오류를 예방·발견하는 보충적인 이용자기업 통제로서 당기 급여 감사와 관련된다고 결정한다.',
    '온유회사의 검토규정이 직원 명부 대조와 퇴직자 지급액 검토를 하도록 적절하게 설계되었는지 이해한다.',
    '규정의 존재만으로 실행을 인정하지 않고 실제로 누가 검토를 수행했는지 확인한다. 특히 담당자 퇴사 후 10~12월에도 해당 통제가 실제 실행되었는지 이해한다.',
    '관련 보충통제의 운영효과성을 테스트한다. 10~12월의 미입수 검토기록 등 당기 실제 수행 증거를 확인하며 새롬의 유형 2 보고서만으로 온유회사 통제의 효과성을 대신하지 않는다.'
  ], ['exp-402-17'], ['13', '06', '07']);
  addQa(s, 'sub2', 'partial', '다온이 보고서에서 제외되어 있다는 이유만으로 검토를 생략할 수 없다.', ['sub2.crit1'], '판단만 인정하고 관련 하위서비스에 402를 적용하는 근거는 미제시.');
  addQa(s, 'sub2', 'wrong', '서비스감사인이 다온을 제외하였으므로 온유회사 감사에서도 해당 서비스에 관한 검토를 생략할 수 있다.', [], '감사 관련성이 명시되어 있어 제외 범위를 그대로 따를 수 없다.');
  addQa(s, 'exp1', 'partial', '직원 명부와 퇴직자 지급액 검토는 온유회사 급여의 오류를 막는 관련 보충통제이다. 검토규정이 실제 급여 지급 전에 오류를 찾아내도록 설계되어 있는지 이해한다.', ['exp1.c1', 'exp1.c2'], '관련성과 설계만 옳고 담당자 퇴사 후 실행 및 운영테스트가 빠졌다.');
  addQa(s, 'exp1', 'wrong', '새롬 보고서가 연중을 다루므로 온유회사에서 직원 명부 대조나 퇴직자 검토의 실행과 효과성을 추가로 확인할 필요가 없다.', [], '서비스조직 보고서가 이용자기업의 보충통제를 대신한다고 오해했다.');
  finish(s, { objective: '유형2 보고서 범위 제외와 보충적인 이용자기업 통제를 구별하여 서비스조직 보고서가 대신하지 못하는 검증을 설계한다.', actors: ['이용자기업 감사인', '온유회사', '서비스조직 새롬', '하위서비스조직 다온'], conditions: ['보고서는 당기 전체 기간을 대상으로 하지만 관련 하위서비스를 제외한다.', '퇴직자 지급액 검토는 보고서상 전제이고 실제 실행·운영 증거 미확보'], exclusions: ['보고서 대상기간 차이 계산', '402.17 전체 일반 목록 재열거', '인사규정이나 노동법 판단'], difference: '기존 sub2의 하위서비스 적용 2점을 보존하고 sub1 일반론은 별도 보존한다. exp1에서 명시된 퇴직자 검토에 대한 관련성·설계·실행·운영테스트 4점을 새로 적용한다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['sub2', 'exp1'], use: '보고서 이용목적과 기간·적격성 관련 불필요한 쟁점 제외' }, { fact_id: 'fact2', subquestion_ids: ['sub2'], use: '하위서비스의 거래흐름과 실제 감사 관련성' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '보충통제의 명시, 검토자 퇴사 및 실행 증거 부재' }], reads: [excerpt(examA, 914, 940, 'adjacent', '급여서비스조직 보고서의 의존 한계를 유형2 제외범위로 심화; 해당 기출이 하위조직/보충통제를 직접 출제한 것은 아니다.'), excerpt(examB, 9342, 9352, 'adjacent', '서비스 보고서의 증거 범위 구분'), excerpt(advanced, 3075, 3079, 'adjacent', '급여 업무 위탁 상황과 통제증거 취득 문제를 응용'), excerpt(advanced, 3112, 3117, 'adjacent', '통제증거 취득 대안 해설 확인')], leakage: '보고서 전제와 실제 검토자 변경만 주었으며 보충통제라는 명칭·필요 테스트 결론은 답안에서 도출한다.', support: { sub2: '402.18은 관련 하위서비스가 제외되면 그 서비스에 402 요구를 적용하게 한다.', exp1: '402.17(b)는 보충적인 이용자기업 통제의 관련성을 결정하고, 관련되면 설계·실행을 이해하며 운영효과성을 테스트하게 한다.' }, classification: { sub2: '다온의 서비스가 급여 계산에 영향을 미치고 감사와 관련됨을 적용한다.', exp1: '직원 명부·퇴직자 지급액 검토 및 퇴사 후 실행 증거 부재가 조치의 구체 대상이다.' }, point_reason: { exp1: '신설 4점: 관련성 판단·설계 이해·실행 이해·운영테스트는 독립 수행 영역이다. 설계 규정만 확인한 부분답안은 2점이며 단순 문구 분할로 가산하지 않았다.' }, comparison: '기존 표준 sub1의 관련성·설계·실행·테스트 각1점 계약을 유지하면서 기간·테스트 전체 평가의 다른5요구는 제외하였다.' });
}

{
  const s = start('pilot-12-001', [
    '한빛회사의 2026년 12월 31일 재무제표에 대한 감사를 마무리하고 있다. 경영진이 제출한 계속기업 평가자료는 재무제표일 다음 날부터 다음 해 10월 31일까지의 10개월을 대상으로 한다. 재무보고체계나 법규가 이 사례에서 더 긴 평가기간을 요구하는 상황은 아니다. 재무담당이사는 작성 당시 사용한 영업예산의 범위가 10개월이므로 평가도 그 기간으로 끝내면 된다고 설명하였다.',
    '회사는 주력 거래처의 주문 축소로 영업현금 유출이 계속되고 있으며 8월에는 거액의 차입금 상환이 예정되어 있다. 감사인은 이 상황이 계속기업으로서의 존속능력에 유의적 의문을 초래할 수 있다고 식별하였다. 경영진은 은행 차입의 만기 연장과 신규 고객 매출 증가를 반영하면 현금 부족을 해소할 수 있다고 제안하였다. 은행에는 신청서를 제출했지만 아직 승인서를 받지 못했고 신규 고객의 계약도 협의 중이다.',
    '경영진은 위 계획을 반영한 월별 현금흐름예측을 제시하였다. 그 예측은 향후 실행계획의 효과를 평가하는 데 유의적인 자료이며, 기초 영업자료와 매출·회수 가정의 근거에 대한 감사인의 확인은 아직 끝나지 않았다. 감사팀원은 예측표의 최종 현금잔액이 양수라는 이유만으로 자금계획에 관한 검토를 마무리하려고 한다.'
  ], '계속기업 평가기간과 자금계획의 검증');
  ref(s, 'exp-570-16', 'src-53140ed862dddf7d9b');
  question(s, 'exp1', 'descriptive', '예측표의 최종 현금잔액이 양수라는 사실만으로 검토를 마무리하려는 계획을 보완하시오. 차입 연장·신규 매출 계획의 효과와 실행가능성, 현금흐름예측의 기초자료와 가정에 관하여 수행해야 할 평가를 사례와 연결하여 설명하시오. 최종 감사의견은 요구하지 않는다.', [
    '차입 만기 연장과 신규 고객 매출 계획의 결과가 8월 차입금 상환 등 현금 부족 상황을 실제로 개선할 수 있는지 평가한다.',
    '차입 연장의 은행 승인과 신규 고객 계약이 아직 확정되지 않았으므로 경영진의 계획이 해당 상황에서 실행가능한지 평가한다.',
    '현금흐름예측에 사용한 기초 영업자료의 신뢰성을 평가한다.',
    '현금흐름예측에 적용한 매출 증가·회수 및 차입 연장 가정에 적절한 근거가 있는지 결정한다.'
  ], ['exp-570-16'], ['12']);
  addQa(s, 'subq2', 'partial', '제시된 10개월은 재무제표일로부터 최소 12개월에 미달한다.', ['crit3'], '기간 비교는 했으나 경영진에 확장 요청하는 조치가 없다.');
  addQa(s, 'subq2', 'wrong', '평가기간은 감사보고서일로부터 10개월이면 충분하므로 경영진에게 확장을 요구할 필요가 없다.', [], '기산일·최소기간·조치를 모두 반대로 답했다.');
  addQa(s, 'exp1', 'partial', '예측에 사용한 기초 영업자료의 신뢰성을 평가하고, 신규 고객 매출과 회수·차입 연장 가정에 적절한 근거가 있는지 확인한다.', ['exp1.c3', 'exp1.c4'], '예측 입력의 두 평가를 충족하고 계획이 자금 부족을 개선하는지와 실행가능성 판단은 남아 있다.');
  addQa(s, 'exp1', 'wrong', '최종 현금잔액이 양수이면 계획이 실현된 것으로 보므로 신청서나 미체결 계약의 근거를 더 확인할 필요는 없다.', [], '예측 결과를 사실상 실현된 사건으로 바꾸는 오류.');
  finish(s, { objective: '계속기업 평가기간의 부족과 경영진의 낙관적 자금계획에 대한 감사절차를 구별하여 적용한다.', conditions: ['재무제표일 12월31일, 평가10개월, 더 긴 별도 요구 없음', '유의적 의문을 초래할 상황 식별, 현금흐름예측이 유의적 평가자료', '차입 연장 미승인·신규고객 계약 협의 중'], exclusions: ['중요한 불확실성 존재 및 최종 감사의견의 확정', '계속기업 추가절차 전체 목록', '현금흐름 금액 계산', '서면진술 요구 목록'], difference: '기존 subq2 2점을 유지하고 기존 subq1 기준서형은 별도 보존한다. 현금흐름예측·자금계획의 실제 증거를 추가해 570.16(b)(c)의 적용4점을 신설한다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['subq2'], use: '10개월 평가 범위와 기산일 및 예산범위 항변' }, { fact_id: 'fact2', subquestion_ids: ['exp1'], use: '계획 효과 평가에 필요한 현금부족·상환시점, 미확정 계획의 실행가능성' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '현금흐름예측의 유의성 조건과 데이터·가정 검토 미완료' }], reads: [excerpt(examB, 4930, 4942, 'partial', '2020 기출 계속기업 추가절차와 현금예측의 조건부 데이터·가정 평가'), excerpt(examB, 8885, 8886, 'partial', '기출 자구계획에 대한 절차 요구'), excerpt(advanced, 7699, 7716, 'adjacent', '평가기간·감사인 책임·결론을 구별하는 판단형 요구'), excerpt(advanced, 7767, 7784, 'adjacent', '위 계속기업 절차 판단 해설 대조')], leakage: '현금 유출·차입 만기·계획의 미확정 상태만 제시하며 효과·실행가능성의 정답 결론을 지문에 확정하지 않는다.', support: { subq2: '570.13은 평가가 재무제표일로부터12개월 미만이면 확장을 요청하게 한다.', exp1: '570.16(b)의 개선효과·실행가능성, 16(c)의 기초 데이터 신뢰성·가정 근거를 명시된 유의적 예측 조건에서 적용한다.' }, classification: { subq2: '10개월 평가자료와 12월31일을 실제로 비교해야 한다.', exp1: '미승인 차입, 협의중 계약, 상환시점과 예측의 증거상태를 각 평가에 연결해야 한다.' }, point_reason: { exp1: '신설4점: 계획의 개선효과·실행가능성과 예측의 데이터·가정이라는 독립 대상4개. 각각1점이며 전체570.16의 다른절차를 숨은 요구로 넣지 않았다.' }, comparison: '기존 subq2의 판단+조치2점과 달리 exp1은 직접 물은 평가대상4개에 각1점; 옛 세트 총점에 맞춘 조정 없음.' });
}

{
  const s = start('pilot-12-009', [
    '감사인은 일반 영리기업인 누리회사의 2026년 재무제표감사를 수행하고 있다. 매출거래를 테스트하던 중 같은 유형의 매출 인식 오류를 발견하여 경영진에게 해당 거래유형을 조사하도록 요청하였다. 경영진은 자체 조사에서 발견한 오류를 수정하고 수정 내역과 분개가 반영된 장부를 감사팀에 제출하였다. 담당자는 경영진이 조사를 끝내고 수정까지 했으므로 그 거래유형에 대한 감사인의 추가절차는 필요 없다고 주장한다.',
    '한편 감사종결 자료에 따르면 누리회사의 실제 세전이익은 감사계획 당시의 예상 세전이익보다 크게 감소하였다. 감사팀은 예상 세전이익을 기초로 중요성을 정하였지만, 아직 실제 결과에 비추어 재검토하지는 않았다. 현재 집계된 미수정 사항 중에는 제품보증충당부채의 과소계상도 있으며, 경영진은 그 금액이 계획 당시 중요성보다 작다는 이유로 중요하지 않다고 주장한다.',
    '그 충당부채를 수정하면 회사가 금융기관과 합의한 차입약정상 재무비율의 충족 여부가 달라질 가능성이 있다. 또 전기에 수정하지 않았던 관련 오류 일부가 당기 기초잔액과 당기말 잔액에 계속 영향을 미치고 있다. 담당자는 당기 발견 금액만 계획 당시 중요성과 비교하면 평가를 마칠 수 있다고 한다.'
  ], '경영진 수정 후 추가절차와 미수정왜곡표시 평가');
  ref(s, 'exp-450-10', 'src-9395cc89abcfc1bc22'); ref(s, 'exp-450-11', 'src-a78fbf4737bd35a73d');
  question(s, 'exp1', 'descriptive', '당기 발견 금액을 계획 당시 중요성과 비교하는 것만으로 평가를 마치려는 담당자의 계획을 보완하시오. 실제 이익 감소, 차입약정 비율에 대한 영향, 전기 미수정 오류의 당기 영향을 각각 어떻게 고려해야 하는지 설명하시오.', [
    '실제 세전이익이 예상보다 크게 감소했으므로 미수정왜곡표시를 평가하기 전에, 계획 당시 정한 중요성이 실제 재무결과에도 여전히 적합한지 재평가한다.',
    '제품보증충당부채의 금액뿐 아니라 차입약정상 재무비율 충족 여부를 바꿀 수 있는 성격과 발생상황을 고려하여 중요성을 평가한다.',
    '전기의 미수정 오류가 당기 관련 계정잔액과 당기 재무제표 전체에 미치는 영향을 당기 왜곡표시와 함께 고려한다.'
  ], ['exp-450-10', 'exp-450-11'], ['04', '12']);
  addQa(s, 'sub1', 'partial', '경영진이 조사하고 수정했으므로 추가절차가 필요 없다는 주장은 부적절하다.', ['crit1'], '결론만 있으며 잔존왜곡표시 확인이라는 목적을 말하지 않았다.');
  addQa(s, 'sub1', 'wrong', '경영진이 조사를 마쳤으므로 감사인은 남은 왜곡표시에 관한 추가절차를 수행할 필요가 없다.', [], '450.7 후속절차를 부정한다.');
  addQa(s, 'exp1', 'partial', '실제 이익이 감소했으므로 기존 중요성을 다시 평가해야 한다. 전기에 수정하지 않은 오류가 당기말 잔액과 재무제표 전체에 미치는 영향도 함께 고려한다.', ['exp1.c1', 'exp1.c3'], '중요성 재평가·전기오류만 맞고 약정비율이라는 질적 상황은 빠졌다.');
  addQa(s, 'exp1', 'wrong', '계획할 때 정한 중요성은 고정값이다. 당기 오류가 그보다 작으면 차입약정이나 전기 오류의 영향과 무관하게 중요하지 않다.', [], '실제결과·질적특성·과거영향을 모두 배제한다.');
  finish(s, { objective: '경영진 수정의 검증과 미수정왜곡표시의 종결 평가를 실제 이익·질적 상황·이월오류에 적용한다.', conditions: ['경영진이 감사인 요청으로 같은 거래유형 조사·수정', '중요성의 기준인 이익이 예상보다 크게 감소', '약정비율 영향과 전기 오류의 당기 영향 존재'], exclusions: ['부정 발생의 확정', '왜곡표시 및 중요성 수치 계산', '감사의견 확정', '경영진 수정 거절 일반 대응 목록'], difference: '기존 sub1의 수정후 추가절차2점 유지, 일반 sub2·sub3은 별도보존. 신규 exp1은 실제 지문3요소를 해석해야 하는 평가3점으로 범위를 한정한다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['sub1'], use: '수정후 후속절차 필요와 확인 목적' }, { fact_id: 'fact2', subquestion_ids: ['exp1'], use: '중요성 산정기준의 실제 결과 변화·단순금액 주장' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '질적 중요성과 전기오류의 당기 영향' }], reads: [excerpt(examB, 2935, 2965, 'direct', '2023 기출 경영진 조사수정 후 절차·중요성 재평가·과거기간 영향의 판단을 구체 상황으로 바꿈'), excerpt(advanced, 3970, 3987, 'partial', '경영진 수정과 미수정사항을 감사종결 대화로 구분'), excerpt(advanced, 4018, 4030, 'partial', '과거 미수정왜곡표시 누적과 경영진 판단 검토의 해설')], leakage: '중요하다고 결론을 주지 않고 실제이익 감소·약정 영향 가능성·이월 오류라는 평가 입력만 제시한다.', support: { sub1: '450.7 및 A9는 경영진 조사·수정후 잔존왜곡표시 여부의 추가감사절차를 요구한다.', exp1: '450.10은 실제결과 기준 중요성 재평가, 450.11(a)는 규모·성격·상황, 11(b)는 과거기간 미수정오류의 현재 영향을 요구한다.' }, classification: { sub1: '경영진이 자발적 수정만 한 것이 아니라 감사인 요청에 따라 거래유형을 조사·수정했다는 전제를 적용한다.', exp1: '예상이익·실제이익 차이, 약정비율, 전기오류가 각각 답의 평가대상을 결정한다.' }, point_reason: { exp1: '신설3점: 재평가 조치·당기 질적상황·전기오류영향은 별개 의미이다. 특정 상황과 성격을 동일 적용에서 기계적으로 분할하지 않았다.' }, comparison: '기존 표준sub3의5점 목록 중 사례의3개 평가목표만 요구하고 규모·성격을 중복 나눠 가산하지 않았다.' });
}

{
  const s = start('pilot-12-010', [
    '감사팀은 2026년 1월 1일부터 12월 31일까지의 재무제표감사를 마무리하고 있다. 다음 상황 A와 상황 B는 서로 다른 회사에서 발생한 독립적인 상황이다. 두 상황 모두 감사팀이 필요한 서면진술을 경영진에게 요청한 뒤의 일이며, 다른 회사에서 확인된 판단이나 감사증거를 서로 원용할 수 없다.',
    '상황 A에서 감사인이 요청한 특정 사항에 관한 서면진술 하나가 아직 제공되지 않았다. 현재 받은 진행보고에는 어느 사항의 진술이 빠졌는지 표시되어 있지 않고, 담당자는 원본 요청서와 회신서를 대조하지 않은 상태다. 감사팀에는 경영진의 성실성에 관한 우려도 제기되었지만, 그 우려의 정도와 진술 신뢰성에 미치는 영향에 관한 후속 판단은 이루어지지 않았다. 담당자는 어느 서면진술이든 하나라도 없으면 항상 의견을 거절해야 한다고 주장한다.',
    '상황 B의 신임 대표이사는 7월 1일 취임하였다. 그는 취임 후의 거래는 모두 기록하고 재무제표에 반영하였다고 진술했지만, 자신이 재직하지 않은 1~6월 거래의 완전성에 관해서는 서면진술을 제공하지 않겠다고 밝혔다. 감사인은 전체 기간의 진술을 요청했으나 거절은 해소되지 않았다. 감사팀원은 취임 전 거래에 대하여 다른 감사절차를 수행했으므로 현재 받은 진술만으로 적정의견을 표명할 수 있다고 한다.'
  ], '서면진술 미제공의 범위와 경영진 교체');
  ref(s, 'exp-580-A18', 'src-108153a7a4b5704cf3'); ref(s, 'exp-580-20', 'src-e23aa9f4e31b30cf97'); ref(s, 'exp-580-A26', 'src-6c82931285349fa6e4');
  question(s, 'exp1', 'judgment', '상황 B에서 요청해야 할 거래 완전성 진술의 대상기간과 신임 대표이사의 취임 사유가 그 범위를 줄일 수 있는지 설명하시오. 이어 거절이 해소되지 않은 상태에서 다른 감사절차만을 근거로 적정의견을 표명할 수 있는지 판단하고 필요한 감사의견을 제시하시오.', [
    '거래 완전성에 관한 서면진술은 취임 후 기간만이 아니라 감사대상인 1월 1일부터 12월 31일까지 전체 기간을 포함하도록 요청해야 한다.',
    '취임 전 재직하지 않았다는 사실은 현재 경영진의 재무제표 전체에 대한 책임을 경감하지 않으므로 취임일을 이유로 진술의 범위를 줄일 수 없다.',
    '상황 B에서는 적정의견을 표명할 수 없으며 의견을 거절해야 한다.',
    '거래 완전성에 관한 필수 책임진술이 감사대상 전체 기간에 제공되지 않았고, 이는 다른 감사절차로 얻은 증거만으로 대체할 수 없기 때문이다.'
  ], ['exp-580-A18', 'exp-580-20', 'exp-580-A26'], ['12', '15'], { 0: '1월1일~12월31일 전체기간을 요청하며 취임 전 기간도 제외되지 않음을 적용하면 인정한다. 현재 받은 하반기 진술만으로 충분하다는 반대 결론은 불인정.', 1: '취임 전 재직하지 않은 사정이 현재 경영진의 재무제표 전체 책임을 줄이지 않는다는 이유를 인정한다. 단순한 전체기간 요청만으로 이 책임근거까지 자동 인정하지 않는다.', 2: '상황B의 의견거절 결론. 필수 책임진술의 미제공을 이유로 의견거절이 필요함을 분명히 함축한 답안도 인정하며 적정·한정의견이라는 명시적 반대 결론은 불인정.', 3: '거래완전성은 필수 책임진술이고 전체기간에 제공되지 않았으며 다른 절차·증거만으로 대체 불가함을 사례와 연결한다. 해당 이유가 의견거절 결론을 함축하면 결론기준도 인정하되 명시적 반대 결론은 별도 처리한다.' });
  s.subquestions.at(-1).criteria[1].requirement_id = 'exp1.r1';
  s.subquestions.at(-1).criteria[2].requirement_id = 'exp1.r2';
  addQa(s, 'sub1', 'partial', '모든 서면진술 하나의 미제공이 자동으로 의견거절은 아니다. 빠진 진술이 재무제표 작성책임이나 제공정보·거래 완전성에 관한 필수 책임진술인지 먼저 확인해야 한다.', ['crit1', 'crit2'], '범위조건을 확인하므로 자동거절 반박도 함축하며 성실성 우려의 정도는 빠졌다.');
  addQa(s, 'sub1', 'wrong', '진술 종류와 경영진 성실성의 정도는 조사할 필요가 없고, 어떤 진술이든 하나만 없으면 무조건 의견을 거절한다.', [], '자동거절을 주장하고 두 조건확인 모두 배제한다.');
  addQa(s, 'exp1', 'partial', '신임 대표이사에게도 1월부터 12월까지 전체기간의 거래 완전성 진술을 요청한다. 취임 전 재직하지 않았다는 사정은 현재 경영진의 재무제표 전체 책임을 줄이지 않는다.', ['exp1.c1', 'exp1.c2'], '기간과 책임근거의 독립 두 명제는 옳으나 미제공 후 의견과 그 근거는 판단하지 않았다.');
  addQa(s, 'exp1', 'wrong', '신임 대표이사는 7월 이후 거래만 진술하면 되고 1~6월은 다른 절차로 확인했으므로 적정의견을 표명한다.', [], '대상기간과 필수 책임진술의 대체 가능성을 모두 반대로 답했다.');
  finish(s, { objective: '불특정 진술의 미제공과 필수 책임진술의 실제 거절을 구별하고 경영진 교체에도 유지되는 전체기간 책임을 적용한다.', conditions: ['상황A: 미제공 진술의 종류·성실성 영향 미확인', '상황B: 7월취임, 거래완전성 필수진술의1~6월 거절이 미해소'], exceptions: ['580.A27의 단순 문구변형은 미제공으로 단정하지 않는다. 본B는 분명한 제공거절이어서 그 예외에 해당하지 않는다.'], exclusions: ['580.19 일반 대응 목록', '경영진의 불성실 확정', '서면진술일·수신인', '중간취임자의 회사법상 책임 일반론'], difference: '기존 sub1 조건확인3점 보존, 표준sub2별도보존. 신규exp1은 실제 중도취임자의 대상기간·책임 근거·의견거절 판단·필수진술 미제공 근거를 각각1점으로 구별한4점이다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['sub1', 'exp1'], use: '독립상황·감사대상기간 명시' }, { fact_id: 'fact2', subquestion_ids: ['sub1'], use: '확인되지 않은 진술범위와 성실성 영향으로 자동결론 금지' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '취임전 기간 제외의 항변 및 필수 책임진술 명시적 거절' }], reads: [excerpt(examB, 4947, 4970, 'partial', '2020 기출 진술 대상기간·미제공 대응을 조건별 적용으로 확장'), excerpt(examB, 8870, 8889, 'direct', '중도취임 대표이사의 취임전 진술거절 사례를 거래완전성에 한정'), excerpt(advanced, 6895, 6924, 'adjacent', '서면진술의 형식·대상·증거 한계를 나누는 문제 구성'), excerpt(advanced, 6942, 6948, 'adjacent', '미제공이 유의적 이슈의 경보라는 해설; 자동 의견거절 근거로 사용하지 않음')], leakage: '옛 지문의 일반 대응 목록을 제거하고 A의 미확인 범위와 B의 구체 거절을 제공했다. 의견거절이라는 답은 지문에 주지 않았다.', support: { sub1: '580.19·20·10·11은 일반 미제공과 두 특정 거절조건을 구별한다. A27은 문구변형을 곧 미제공으로 보는 오류를 차단한다.', exp1: '580.A18은 현재경영진의 전체기간 책임을 유지한다. 580.11(b)의 필수거래완전성 진술 미제공은20(b)와A26에 따라 다른증거로 대체하지 못하고 의견거절을 초래한다.' }, classification: { sub1: '진술종류도 성실성 영향결론도 미정인 A를 읽어 조건확인을 해야 한다.', exp1: '7월취임·1~6월 진술거절·다른감사절차 완료라는 사실을 전체기간 책임과 특정거절 조건에 적용한다.' }, point_reason: { exp1: '신설4점: 대상기간 적용·현재경영진 책임근거·의견거절 판단·필수진술 미제공 근거는 독립적으로 충족할 수 있어 각1점. 1월~12월 또는 의견거절만 맞힌 부분답안을 보존하며 근거가 결론을 함축하는 경우 판단점수도 인정한다.' }, comparison: '기존case조건확인3점은 판단·범위·성실성이다. exp1은 실제 대상기간과 감사의견의 두 판단에 각각 별도 근거를 요구하므로 총4점이며 2점으로 결합했던 작성안에서 부분정답을 복원했다.' });
}

{
  const s = start('pilot-08-008', [
    '회사의 경영진은 2026년 12월 31일 현재 중요한 비상장 투자자산의 공정가치를 평가하기 위해 외부 가치평가 전문가와 계약했다. 이 전문가는 감사팀이 고용한 감사인측 전문가가 아니라 기업의 재무제표 작성을 돕는 경영진측 전문가다. 보고서는 결산일을 기준으로 작성되었고 회사는 그 결론을 재무제표에 반영했다.',
    '감사팀은 해당 전문가의 가치평가 자격증만 확인했다. 해당 산업의 비상장 투자자산에 관한 경험과 업무를 수행할 시간·인력의 충분성은 아직 확인하지 않았다. 전문가 보수의 일부는 평가금액이 높아질수록 증가하도록 약정되어 있다. 아직 이 약정이나 자격증만으로 전문가의 적합성과 평가결과가 잘못되었다고 확정한 것은 아니다.',
    '평가보고서는 투자대상회사의 주력 거래처와의 장기 공급계약이 그대로 유지된다는 가정으로 매출을 예측하였다. 그러나 감사팀이 별도로 입수한 거래처 서신에는 결산일 전에 계약이 종료되었으며 현재 갱신 협의도 없다는 내용이 있다. 양 자료는 같은 계약과 같은 평가기준일에 관한 것이고 감사팀은 이 불일치를 아직 해결하지 않았다. 회사는 같은 계약자료를 다른 관련 자산의 회수가능성 검토에도 사용했다. 담당자는 평가보고서가 외부 전문가의 서명을 받았으므로 거래처 서신은 더 검토하지 않겠다고 한다.'
  ], '경영진측 전문가의 적합성과 상충하는 계약 증거');
  ref(s, 'exp-500-11', 'src-39e0f966c758bbd43f');
  question(s, 'exp1', 'descriptive', '평가보고서와 거래처 서신의 불일치에 대하여 감사인이 취해야 할 대응을 설명하시오. 불일치를 해결할 절차와 감사의 다른 측면에 미칠 영향으로 나누어 사례와 연결하시오.', [
    '계약 유지 가정과 거래처의 종료 서신 사이의 불일치를 해결하도록 감사절차의 변경이나 추가를 결정한다. 예를 들어 계약서·종료 통지의 효력과 적용시점을 확인하고 전문가와 경영진의 설명을 추가 증거로 검증한다.',
    '같은 계약자료를 사용하는 다른 관련 자산의 회수가능성 검토 등 감사의 다른 측면에 이 불일치가 미치는 영향을 고려한다.'
  ], ['exp-500-11'], ['08']);
  addQa(s, 'sub1', 'partial', '자격증 외에 해당 산업의 비상장 가치평가 경험을 확인하여 적격성을 평가하고, 평가금액에 연동된 보수가 판단을 편향시키는지 객관성을 평가한다.', ['crit1', 'crit2'], '시간·인력을 실제 발휘할 역량에 대한 검토가 빠져2/3.');
  addQa(s, 'sub1', 'wrong', '자격증이 있으므로 산업경험과 시간·인력 확인은 필요 없다. 평가액 연동 보수도 객관성과 무관하다.', [], '세 평가대상의 확인 필요성을 부정한다.');
  addQa(s, 'exp1', 'partial', '장기 공급계약의 종료 서신과 평가보고서의 가정이 일치하지 않으므로 계약서와 종료통지를 확인하고, 추가 증거를 얻도록 감사절차를 변경한다.', ['exp1.c1'], '해당평가의 불일치 해결만 있고 다른 자산/감사측면 영향은 없다.');
  addQa(s, 'exp1', 'wrong', '외부 전문가가 서명했으므로 거래처 서신은 무시하고 다른 자산 검토에도 전문가 보고서를 그대로 사용한다.', [], '상충증거 해결 및 다른측면 영향 검토를 배제한다.');
  finish(s, { objective: '경영진측 전문가의 적격성·역량·객관성을 평가하고 외부서명만으로 해소되지 않는 상충증거에 대응한다.', conditions: ['경영진측 전문가이며 감사인측 전문가가 아님', '산업경험·시간인력 미확인, 성과보수', '동일계약·동일기준일의 상충증거 및 다른자산에 재사용'], exclusions: ['가치평가 금액 계산', '계약의 법률적 효력 확정', '전문가의 고의나 부정 확정', '전문가 업무 적합성 전체 체크리스트'], difference: '기존sub1의3점과 자격요소별계보 유지. 기존sub2·sub4·sub3 표준은 별도보존. 보고서와 종료서신의 실제 충돌을 추가해 exp1의2개 대응을 사례적용으로 신설.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['sub1', 'exp1'], use: '500의경영진전문가·중요투자평가·시점' }, { fact_id: 'fact2', subquestion_ids: ['sub1'], use: '산업경험·시간인력·성과보수의세평가' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '상충정보의구체내용·다른자산으로전파되는영향' }], reads: [excerpt(examB, 4430, 4439, 'partial', '기출 영업권 평가에서 외부전문가 평가 및 별도증거 활용'), excerpt(examB, 4454, 4462, 'partial', '2021기출 전문가업무 이해·적합성을 묻는범위 확인'), excerpt(advanced, 6130, 6152, 'partial', '비상장투자자산·외부전문가보고서 사례를재구성'), excerpt(advanced, 6337, 6342, 'direct', '경영진측전문가500.8 사람·업무구별해설')], leakage: '정반대인증거내용을 주되 어느쪽이 참인지 정답으로 확정하지 않는다. 성과보수도 왜곡표시의증명으로 주지 않는다.', support: { sub1: '500.8(a),A48,A51,A54의적격성·역량·객관성 정의를 구체사실에 적용한다.', exp1: '500.11은 상충증거 해결을위한절차변경·추가와 다른측면영향의두대응을명시한다.' }, classification: { sub1: '자격증 외 경험·자원 및 성과보수라는실제사실을 세평가에연결한다.', exp1: '같은계약에대한종료서신과유지가정의충돌,다른자산재사용을읽어야만최소답안이성립한다.' }, point_reason: { exp1: '신설2점: 불일치해결절차·다른감사측면영향을독립적으로인정. 절차예시는가능한한가지이면충분하며예시전부는숨은요구가아니다.' }, comparison: '기존표준sub3의500.11 두대응각1점계약에구체적사실의존성만추가.' });
}

{
  const s = start('pilot-06-008', [
    '반도체 부품을 생산하는 회사의 2026년 재무제표감사를 수행하고 있다. 회사는 새 기술에 대응하여 거액의 생산설비를 취득하였다. 기술 발전과 경쟁사의 신제품 출시가 빨라졌고, 회사는 제품 불량 때문에 일정 기간 가동을 중단했다. 감사인은 설비의 손상 및 재고 진부화와 관련한 자산 평가 주장의 고유위험을 평가하고 있다.',
    '이 상황에서 고유위험을 평가할 때 통제의 효과는 아직 고려하지 않는다. 기술환경의 발전이 향후 제품수요와 자산 가치에 영향을 줄 수 있다. 설비의 회복가능한 가치정보는 직접 관찰 가능한 충분히 정밀하고 포괄적인 데이터만으로 작성할 수 없어 미래 수요에 관한 가정이 필요하다. 재무제표 확정 전에는 그 미래 결과를 정확히 알 수 없다. 이는 경영진의 고의나 부정이 확인되었다는 뜻이 아니다.',
    '감사인은 같은 설비와 재고에 관한 중요왜곡표시위험을 식별했지만 경영진의 위험평가 자료에는 해당 위험이 없었다. 회사는 분기마다 기술 동향, 불량률과 가동률을 검토하여 자산 손상 위험을 평가하도록 내부 절차를 정해 두었고 관련 부서도 그 자료를 작성하였다. 다만 자료가 위험평가 책임자에게 전달되었는지, 전달되었다면 어떻게 검토되었는지는 아직 확인하지 않았다. 담당자는 감사인이 이미 위험을 찾았으므로 기업의 절차를 더 살펴볼 이유가 없다고 한다.'
  ], '자산 평가의 고유위험과 기업 위험평가절차의 누락');
  s.subquestions[0].prompt = s.subquestions[0].prompt.replace('상황 B의', '제시된');
  ref(s, 'exp-315-23', 'src-54643d5411960543b2');
  question(s, 'exp1', 'descriptive', '감사인이 발견한 설비 손상·재고 진부화 위험이 회사의 위험평가 자료에는 없었다. 제시된 내부 절차와 자료 작성 사실에 비추어, 감사인이 회사의 위험평가절차에 관하여 추가로 수행해야 할 판단·확인·평가를 설명하시오.', [
    '분기마다 기술 동향·불량률·가동률을 검토하도록 한 절차에 비추어, 해당 설비 손상·재고 진부화 위험이 기업의 위험평가절차에서 식별될 것으로 기대되었던 종류의 위험인지 결정한다.',
    '그 절차에서 식별될 것으로 기대되는 위험이라면, 자료 전달과 검토 과정 등을 확인하여 기업의 위험평가절차가 해당 위험을 식별하지 못한 이유를 이해한다.',
    '확인한 누락 원인이 회사의 성격과 복잡성을 고려한 기업 위험평가절차의 적합성 평가에 미치는 시사점을 고려한다.'
  ], ['exp-315-23'], ['06']);
  addQa(s, 'sub2', 'partial', '기술환경의 발전이 제품수요와 자산 가치에 영향을 주는 것은 변화이다. 직접 관측자료만으로 가치정보를 작성할 수 없어 미래 수요 가정이 필요한 것은 불확실성이다.', ['crit4', 'crit5'], '요소의 두연결은 맞고 가능성과규모에대한평가는빠졌다.');
  addQa(s, 'sub2', 'wrong', '기술환경 발전은 통제위험이고 미래 수요를 알 수 없는 것은 감사인의 적발위험이다. 공장이 멈추었으므로 자산 평가의 왜곡가능성과 규모를 검토할 필요가 없다.', [], '고유위험요소분류및평가를부정한다.');
  addQa(s, 'exp1', 'partial', '회사 절차는 기술 동향과 불량률·가동률을 검토하므로 해당 위험이 발견될 것으로 기대되는 종류인지 판단한다. 그 절차가 잡았어야 할 위험이라면 자료가 책임자에게 전달되고 검토되었는지 조사하여 놓친 이유를 이해한다.', ['exp1.c1', 'exp1.c2'], '위험종류판단과조건부이유이해만하고절차적합성평가의시사점은없다.');
  addQa(s, 'exp1', 'wrong', '감사인이 위험을 발견했으므로 경영진 위험평가절차의 누락 원인이나 적합성은 더 검토하지 않는다.', [], '315.23 후속확인·평가배제.');
  finish(s, { objective: '자산평가 고유위험요소의 실제 적용과 기업 위험평가절차가 놓친 위험에 대한 후속평가를 구별한다.', conditions: ['통제효과 고려전의고유위험평가', '거액설비·기술변화·관측불가능한미래수요', '기업이위험을미식별했으며내부위험평가절차·자료는존재'], exclusions: ['유의적위험이라는최종결론', '고유위험요소전체목록', '부정이나경영진고의의확정', '감사계획수정일반론'], difference: '기존sub2의변화·불확실성·가능성·규모4점보존. 기존sub1·sub3표준은별도보존. 새exp1은실제기업절차와자료전달상황에비추어315.23의3단계를적용한다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['sub2', 'exp1'], use: '관련자산·위험내용·거액규모' }, { fact_id: 'fact2', subquestion_ids: ['sub2'], use: '변화와불확실성의구별·가능성평가' }, { fact_id: 'fact3', subquestion_ids: ['exp1'], use: '기업위험평가절차에서기대할위험인지·누락경로·적합성평가' }], reads: [excerpt(examB, 324, 366, 'direct', '2025기출반도체설비·기술변화·가동중단사례;현재315의고유위험요소로재구성'), excerpt(examB, 9192, 9208, 'partial', '기출해설의옛315.28과현행고유위험요소의차이를확인'), excerpt(advanced, 1736, 1749, 'adjacent', '환경변화와추가공시를위험평가과정에연결하는팀토의구성'), excerpt(advanced, 1796, 1809, 'adjacent', '사업위험전체와중요왜곡표시위험의범위를구별하는발문'), excerpt(advanced, 1889, 1900, 'adjacent', '모든사업위험식별의무로확대하지않는해설')], leakage: '기술변화라는현상은주되변화·불확실성이라는요소분류와기업의누락원인을답으로주지않았다.', support: { sub2: '315.12(f),A7,보론2의변화·불확실성,315.31및A207~A213의가능성·규모평가에대응한다.', exp1: '315.23(a)는기대위험종류를판단하고해당하면누락이유를이해하게하며(b)는22(b)의절차적합성평가시사점을요구한다.' }, classification: { sub2: '산업변화·관측자료한계·거액설비를각요소와규모에대응해야한다.', exp1: '분기별자료검토절차가있는회사의실제누락을평가하므로일반3단계만아닌해당위험·절차연결이필요하다.' }, point_reason: { exp1: '신설3점: 기대위험종류판단·조건부누락원인이해·절차평가시사점각각1점.조건은원인이해명제내에유지한다.' }, comparison: '기존표준sub1의독립3요구각1점을구체자산·자료흐름의적용으로심화했다.' });
}

{
  const s = start('draft-09-501-freq01', [
    '나래회사의 감사대상 보고기간은 2026년 1월 1일부터 12월 31일까지이다. 회사는 중요한 재고자산의 실무상 실사일을 11월 30일로 정하였고 감사인은 이날 실사에 입회하여 필요한 실사입회 절차를 수행했다. 회사는 품목별 수량을 계속기록법으로 관리하며 11월 30일 실사수량에 12월 중 입고와 출고를 가감해 재무제표일의 최종 재고기록을 작성하려고 한다.',
    '12월에는 대규모 연말 출하와 신규 원재료 입고가 발생하였다. 회사의 규정상 창고 담당자가 매일 입출고 기록을 작성하면 회계 담당자가 전표와 대조하고, 재무팀장이 월말 차이를 검토하여 승인한다. 그러나 12월 초 회계 담당자가 퇴사한 뒤 대조 업무의 인계가 확인되지 않았고, 감사팀은 12월 대조·차이 검토 기록을 아직 받지 못하였다. 창고 담당자는 11월 실사에서 수량이 맞았으므로 이후 기록도 믿을 수 있다고 한다.',
    '재무팀장은 계속기록법을 사용한다는 이유만으로 11월 30일의 실사 결과를 결산일 재고에 이용하기에 충분하다고 주장한다. 감사인은 12월 입출고 전표와 재고수불부를 입수할 수 있지만 재고변동 기록의 적절성과 관련 통제의 실제 작동 여부에 대한 검토는 아직 완료하지 않았다.'
  ], '기중 재고실사와 결산일까지의 재고변동 통제');
  ref(s, 'exp-501-A9', 'src-810ae371f0022b64c7');
  question(s, 'exp1', 'judgment', '계속기록법을 사용한다는 이유만으로 11월 30일 실사 결과가 결산일 감사목적에 충분하다는 주장이 적절한지 판단하시오. 제시된 입출고 대조·검토 통제에 관하여 추가로 고려해야 할 사항을 담당자 퇴사와 미입수 기록에 연결하여 설명하시오.', [
    '계속기록법을 사용한다는 이유만으로 11월 30일의 기중 실사가 결산일 감사목적에 충분하다고 볼 수 없으며 담당자의 주장은 부적절하다.',
    '대규모 12월 입출고가 적절하게 기록되도록 전표 대조와 월말 차이 검토 통제가 효과적으로 설계되어 있는지 평가한다.',
    '규정이 있다는 사실만으로 실행을 인정하지 않고 12월 입출고 전표의 대조와 월말 차이 검토 통제가 실제로 실행되었는지 확인한다.',
    '담당자 퇴사와 업무 인계 상황을 고려하여 12월 말까지 대조·검토 통제가 효과적으로 유지되었는지 평가한다.'
  ], ['exp-501-A9'], ['09', '06'], { 0: '계속기록법 사용만으로 기중실사가 충분하다는 판단을 부정하면 인정. 계속기록법을 써도 통제 효과성을 별도로 고려해야 한다는 근거·조치로 결론을 함축해도 인정하며 명시적 반대는 불인정.', 1: '대규모12월입출고를 적절히 기록하도록 전표대조·월말차이검토 통제가 효과적으로 설계되었는지 평가한다.', 2: '실제12월대조·검토가 실행되었는지 증거로 확인한다. 규정존재만으로 실행까지 추정하지 않는다.', 3: '퇴사·인계미확인 사실에 비추어 재무제표일까지 통제가 지속적으로 유지되었는지를 평가한다. 단지 특정일한번 실행여부만 확인한 것으로 대체하지 않는다.' });
  addQa(s, 'q1', 'wrong', '11월 30일 실사에서 수량이 맞았으므로 12월 입출고 변동의 기록은 별도로 확인할 필요가 없다.', [], '기간차이추가절차를부정한다.1점물음은대표오답만제출.');
  addQa(s, 'exp1', 'partial', '계속기록법을 사용해도 재고변동 통제의 효과성을 검토해야 하므로 그 방법을 쓴다는 이유만으로 11월 실사가 충분하다고 볼 수 없다.', ['exp1.c1'], '계속기록법의예외오류판단은맞고실제인계누락·검토기록을통제에연결하지않았다.');
  addQa(s, 'exp1', 'wrong', '계속기록법에서는 통제의 작동을 검토할 필요가 없다. 11월 실사수량이 맞았으므로 담당자 퇴사 후에도 12월 수불기록은 정확한 것으로 인정한다.', [], '계속기록법을통제검토면제로보는반대의견이다.');
  finish(s, { objective: '기중 실사 후 재고변동 기록의 검증과 통제 상태에 따른 기중 실사의 적합성 판단을 구별한다.', conditions: ['11월30일실사·12월31일재무제표일', '계속기록법사용·12월대규모입출고', '대조담당자퇴사후실행·유지미확인'], exclusions: ['재고금액계산', '감사의견확정', '실사입회절차전체재열거', '계속기록법자체의회계처리적법성'], difference: '기존q1의기간차이절차1점유지하고q2표준은별도보존한다. exp1은 계속기록법이면 충분하다는 주장 판단1점과 퇴사후 대조업무의 설계·실행·유지 효과성 각1점을 적용하는4점으로 추가한다.', mapping: [{ fact_id: 'fact1', subquestion_ids: ['q1', 'exp1'], use: '실사·기말기간차이와계속기록법의범위' }, { fact_id: 'fact2', subquestion_ids: ['exp1', 'q1'], use: '대규모변동기록위험·대조통제실행유지의미확인' }, { fact_id: 'fact3', subquestion_ids: ['exp1', 'q1'], use: '계속기록법이면충분하다는판단오류·변동자료입수가가능한후속검증' }], reads: [excerpt(examB, 4642, 4668, 'direct', '2021기출재무제표일외실사와계속기록법기록검토를기중실사로변형'), excerpt(advanced, 3848, 3874, 'adjacent', '입회와후속검증의설계,시기·통제고려를연결하는연습'), excerpt(advanced, 3932, 3949, 'adjacent', '실사입회의범위와단점을구별하는해설.교재단순관찰정의를501전체요구로대체하지않음')], leakage: '기록미입수와담당자퇴사만으로통제가반드시실패했다고정답을확정하지않았다. 효과성추가평가가필요한상태이다.', support: { q1: '501.5는실사일과재무제표일사이변동의적절한기록을확인하도록한다.', exp1: '501.A9는실사수량결정·계속기록법모두에대해변동통제의설계·실행·유지효과성이기중실사의적합성을결정한다고명시한다.' }, classification: { q1: '실사일11월30일과결산일12월31일을대상기간에적용한다.', exp1: '계속기록법주장과12월통제인계미확인이라는사실을기중실사의적합성평가에연결해야한다.' }, point_reason: { exp1: '신설4점: 계속기록법을 면제로 보는 판단1점, 재고변동 통제의 설계·실제 실행·기간에 걸친 유지 효과성 각1점. 규정 설계만 평가하거나 인계 후 지속성만 평가한 답안의 독립 부분점수를 보존한다.' }, comparison: 'q1은 기간차이의 단일 후속절차1점. exp1은 기중실사 적합성 판단1점과 설계·실행·유지 각1점으로, 기존 표준q2의 효과성 세 측면 각1점 계약과 맞춘다.' });
}

for (const s of sets) {
  for (const r of s.source_refs) {
    const txt = fs.readFileSync(r.file, 'utf8');
    if (!txt.includes(r.source_quote)) throw Error(`Non-exact source ${s.id}/${r.id}`);
    if (r.content_hash && r.content_hash !== sha(r.source_quote)) throw Error(`Ref hash ${s.id}/${r.id}`);
  }
  for (const q of s.subquestions) {
    if (!qa.some(x => x.set_id === s.id && x.subquestion_id === q.id && x.kind === 'wrong')) throw Error(`QA wrong missing ${s.id}/${q.id}`);
    if (q.criteria.length > 1 && !qa.some(x => x.set_id === s.id && x.subquestion_id === q.id && x.kind === 'partial')) throw Error(`QA partial missing ${s.id}/${q.id}`);
  }
}
fs.mkdirSync(out, { recursive: true });
for (const [file, value] of [['sets.json', sets], ['design.json', designs], ['review.json', reviews], ['qa.json', qa]]) fs.writeFileSync(`${out}${file}`, `${JSON.stringify(value, null, 2)}\n`);
console.log(JSON.stringify(sets.map(s => ({ id: s.id, length: [...s.shared_context.facts.map(f => f.text).join('\n')].length, questions: s.subquestions.map(q => [q.id, q.criteria.length]), points: s.subquestions.flatMap(q => q.criteria).reduce((a, c) => a + c.max_points, 0) })), null, 2));
