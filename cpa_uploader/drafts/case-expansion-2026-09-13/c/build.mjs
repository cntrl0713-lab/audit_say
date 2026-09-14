import fs from 'node:fs';
import { createHash } from 'node:crypto';
const D = 'cpa_uploader/drafts/case-expansion-2026-09-13';
const bank = JSON.parse(fs.readFileSync(`${D}/bank-before.json`, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(`${D}/catalog-before.json`, 'utf8'));
const sources = JSON.parse(fs.readFileSync(`${D}/source-catalog.json`, 'utf8'));
const ids = ['pilot-16-011', 'pilot-16-012', 'pilot-14-008', 'pilot-14-007', 'pilot-10-007', 'pilot-10-006', 'pilot-15-006'];
const clone = x => structuredClone(x);
const sha = x => createHash('sha256').update(x).digest('hex');
const original = id => bank.find(x => x.id === id);
const sets = ids.map(id => {
  const s = clone(original(id));
  s.subquestions = s.subquestions.filter(q => catalog.classifications.some(c => c.source_set_id === id && c.subquestion_id === q.id && c.question_style === 'case'));
  s.subquestions.forEach(q => {q.question_style = 'case'; q.topic_ids = catalog.classifications.find(c => c.source_set_id === id && c.subquestion_id === q.id).topic_ids;});
  s.status = 'needs_review';
  s.verification.review_status = 'needs_human_review';
  s.verification.source_fidelity = 'reconstructed';
  s.verification.notes = [original(id).verification.notes[0], '2026-09-13 사용자 요청 사례 보강 초안. 기출·고급회계감사연습의 원발문과 해설을 참고하고 공식 전사를 직접 대조하여 재구성했다. 과거 게시 상태·채점 증거는 이 수정본에 승계하지 않는다. 원자료·조건·criterion 계보와 agent 내용검수는 같은 배치 c/design.json 및 c/review.json 참조.'];
  return s;
});
const get = id => sets.find(s => s.id === id);
const facts = (id, texts) => {get(id).shared_context.facts = texts.map((text, i) => ({id: `f${i + 1}`, text, scoreable: false}));};
const setClaim = (q, cid, claim) => {const c = q.criteria.find(c => c.id === cid); c.claim = claim; c.critical_facts = [{id: `${cid}.claim`, type: 'action', expected: claim}];};
const unit = id => {const u = sources.units.find(u => u.id === id); if (!u) throw new Error(id); return u;};
const addSource = (s, id) => {
  const u = unit(id);
  if (!s.source_refs.some(r => r.id === id)) s.source_refs.push({id, file: u.file, title: `${u.standard} 문단 ${u.paragraph}; ${u.locator}; ${u.edition}`, page: u.standard, role: 'standard', source_quote: u.quote, content_hash: sha(u.quote), source_span: u.locator});
  return id;
};
function newQuestion(s, id, prompt, claims, sourceIds, topicIds = [s.classification.topic_id]) {
  const refs = sourceIds.map(r => addSource(s, r));
  return {id, type: 'descriptive', question_style: 'case', topic_ids: topicIds, prompt,
    constraints: {ordered: false, max_entries: null, overflow_policy: 'none'}, selection: {type: 'all', n: null}, decision: null,
    answer_slots: [{id: `${id}.answer`, label: '답안', input: 'textarea'}], model_answer: claims,
    requirements: claims.map((claim, i) => ({id: `${id}.req${i + 1}`, source_ref_id: refs[0], source_quote: unit(refs[0]).quote, source_span: `${unit(refs[0]).locator}; 직접 요구: ${claim} 동의 표현과 명확한 함축을 허용하며, 사례의 대상·시점·조건을 보존한다.`})),
    criteria: claims.map((claim, i) => ({id: `${id}.crit${i + 1}`, requirement_id: `${id}.req${i + 1}`, claim, critical_facts: [{id: `${id}.crit${i + 1}.claim`, type: 'action', expected: claim}], max_points: 1, scores: {met: 1, not_met: 0, contradicted: 0}, source_ref_ids: refs}))};
}

facts('pilot-16-011', [
  '한결회계법인은 전기 말 자산총액이 8천억원인 상장기업 다온회사의 2026년 1월 1일부터 12월 31일까지의 재무제표를 감사한다. 재무제표와 감사증거 자체에는 별도의 문제가 없으며, 기타정보 오류로 감사증거 전반의 신뢰성에 의문이 생긴 드문 상황도 아니다. 다음 갑과 을은 서로 독립적인 상황이다.',
  '갑: 2027년 3월 감사보고서일 전에 입수한 사업보고서의 경영성과 설명은 재무제표에 반영된 대규모 영업손실을 영업이익으로 서술하고 있었다. 감사인은 이를 기타정보의 중요한 왜곡표시로 결론 내렸다. 경영진에게 수정을 요구했으나 거부당했고, 지배기구와 커뮤니케이션하며 수정을 요구한 뒤에도 수정되지 않았다. 관련 법규상 감사업무의 해지는 불가능하다.',
  '을: 감사보고서일 후 처음 입수한 연차보고서에는 이미 감사한 재무제표와 달리 주요 차입금이 전액 상환되었다는 설명이 실려 있었다. 감사인은 실제 미상환 사실을 확인하여 기타정보의 중요한 왜곡표시라고 결론 내렸다. 이 연차보고서와 감사보고서는 이미 투자자에게 배포되었다. 경영진은 수정을 거부하였고, 감사인이 지배기구와 커뮤니케이션하여 수정을 요구한 후에도 그대로 두었다. 담당자는 보고서일이 지났으므로 이 사항을 종결하자고 한다.'
]);
get('pilot-16-011').subquestions.push(newQuestion(get('pilot-16-011'), 'exp1', '을에서 중요한 미수정왜곡표시를 그대로 둔 채 종결하려는 담당자의 계획에 대응하여, 감사인이 후속 조치를 정할 때 고려할 사항과 그 조치로 달성해야 할 목적을 각각 설명하시오. 이미 마친 수정요구와 지배기구 커뮤니케이션은 반복하지 않아도 되며, 가능한 조치의 예시를 모두 나열할 필요는 없다.', [
  '을의 후속 조치를 정할 때 감사인의 법적 권리와 의무를 고려하여야 한다.',
  '이미 배포된 연차보고서의 중요한 미수정왜곡표시에 감사보고서 이용자가 적절하게 주의를 기울일 수 있도록 적절한 조치를 취하여야 하며, 보고서일 후라는 이유로 종결할 수 없다.'
], ['src-31015981441beec8fd', 'src-97d5f9a4653f4d9b60', 'src-d6306fef8876326b2c']));

facts('pilot-16-012', [
  '감사인은 상장 제조기업 온유의 2026년 개시 보고기간에 관한 재무제표감사를 마치고 2027년 감사보고서를 작성 중이다. 당기에 발생한 장기 공급계약의 분쟁은 외부 법률고문의 설명을 검토하고 여러 차례 지배기구와 토의할 만큼 유의적 감사인 주의를 요구하였으며, 이미 핵심감사사항으로 결정되었다. 해당 사항은 의견변형이나 계속기업 관련 중요한 불확실성에 해당하지 않는다. 다음 세 상황은 독립적이다.',
  '갑: 관련 법규가 이 분쟁사항의 공개적 공시를 배제한다는 것을 법률 검토로 확인하였다. 경영진의 단순한 선호나 회사 내부의 보안방침에 불과한 제한은 아니다.',
  '을: 법규상 공개 금지는 없고 기업이 이 분쟁에 관한 정보를 공시한 적도 없다. 경영진은 감사보고서에 분쟁을 기술하면 거래상대방과의 협상에 불리해지고 경쟁기업이 영업전략을 추측할 수 있다며 비공개를 요청하였다. 감사인은 이러한 주장과 예상 부정적 결과를 아직 평가하지 않았고, 공개의 공익적 효익과 비교하는 검토도 마치지 않았다.',
  '병: 을과 동일한 비공개 요청이 있었지만, 감사인이 공시자료를 확인하자 회사가 이미 이 분쟁의 당사자·쟁점·진행 상황에 관한 정보를 공시한 사실이 드러났다. 법규상 공개 금지는 이 상황에도 없다.'
]);
{
  const s = get('pilot-16-012'), q = s.subquestions[0], old = clone(q);
  const split = (id, cids, prompt, answer) => {const out = clone(old); out.id = id; out.type = 'descriptive'; out.decision = null; out.prompt = prompt; out.model_answer = answer; out.criteria = old.criteria.filter(c => cids.includes(c.id)); const reqs = new Set(out.criteria.map(c => c.requirement_id)); out.requirements = old.requirements.filter(r => reqs.has(r.id)); out.answer_slots = [{id: `${id}.answer`, label: '답안', input: 'textarea'}]; return out;};
  s.subquestions = [
    split('sub1', ['sub1.crit1'], '갑의 계약 분쟁을 감사보고서의 핵심감사사항으로 기술하지 않을 수 있는지, 해당 상황의 근거와 함께 설명하시오.', [old.model_answer[0]]),
    split('exp1', ['sub1.crit2', 'crit5'], '을에서 경영진의 요청만으로 계약 분쟁을 핵심감사사항 기술에서 생략할 수 있는지 판단하고, 그 사항을 공개하지 않는 예외를 적용하려면 감사인이 충족하여야 할 조건을 설명하시오.', [old.model_answer[1], old.model_answer[2]]),
    split('exp2', ['sub1.crit3'], '병에서 경영진이 주장하는 부정적 결과와 공익적 효익의 비교를 이유로 계약 분쟁의 핵심감사사항 기술을 생략하는 예외를 적용할 수 있는지, 공시자료 확인 결과와 연결하여 설명하시오.', [old.model_answer[3]])
  ];
}

facts('pilot-14-008', [
  '한결회계법인은 다온그룹의 2026년 개시 보고기간에 관한 그룹감사를 2027년에 수행하고 있다. 다온그룹은 제조·유통·해외영업 부문을 보유하며 그룹업무팀과 각 부문감사인이 그룹감사계획을 협의 중이다. 다음 두 제안은 각각 독립적으로 평가하며, 중요성 금액 자체의 적정성을 계산하는 문제는 아니다.',
  '상황 가: 해외영업 부문감사인은 현지 법정감사에서 사용해 온 왜곡표시 집계 기준이 익숙하다며, 그룹에 전달할 왜곡표시의 보고한도도 자신이 최종 결정하자고 제안하였다. 여기서 보고한도는 이를 초과하면 그룹재무제표에 대하여 명백하게 사소하다고 볼 수 없는 한도이다. 그룹업무팀은 아직 이 한도를 결정하지 않았으며, 부문감사인은 그룹업무팀의 별도 결정 없이 자신의 한도를 적용하려 한다.',
  '상황 나: 그룹업무팀은 그룹재무제표 전체 중요성을 정한 뒤, 각 부문의 규모와 위험을 검토하여 부문별로 서로 다른 중요성 금액을 제안받았다. 개별 제안금액은 모두 그룹재무제표 전체 중요성보다 낮지만 그 합계는 전체 중요성을 초과한다. 팀원은 중요성이 부문에 나누어 주는 고정 예산과 같으므로 모든 부문중요성의 합계를 반드시 전체 중요성과 일치시켜야 한다며, 각 제안금액을 일률적으로 줄이는 단순 산술배분을 제안하였다.'
]);

facts('pilot-14-007', [
  '다온그룹의 그룹업무팀은 2026년 1월 1일부터 12월 31일까지의 그룹재무제표를 2027년에 감사하고 있다. 부문감사인은 독립성 등 관련 요구사항을 충족하며 그룹업무팀이 필요한 업무에 관여하는 데에도 제한이 없다. 그룹업무팀은 아래 부문별 상황을 검토하여 수행할 업무를 정하려 한다.',
  'A 부문은 그룹의 주력 제조활동을 수행하고 외부매출과 자산에서 큰 비중을 차지하여, 그룹에 대한 개별적인 재무적 유의성이 있는 부문으로 식별되었다. A에 적용할 업무유형은 아직 정하지 않았다.',
  'B 부문은 개별적으로 재무적 유의성은 없지만 그룹의 외화자금 거래를 집중 처리한다. 당기에 체결한 복잡한 외화파생계약의 측정과 관련 공시가 그룹재무제표의 유의적인 중요왜곡표시위험을 포함할 것 같아 유의적 부문으로 식별되었다. 다른 거래와 계정에서는 별도의 유의적 위험이 식별되지 않았다.',
  'C군은 유의적이지 않은 여러 소규모 판매부문으로 구성된다. 그룹업무팀은 유의적 부문의 재무정보에 대한 업무, 그룹차원의 통제와 연결절차에 대한 업무, 그룹 수준의 분석적절차를 모두 수행하여도 그룹감사의견의 근거가 되는 충분하고 적합한 감사증거를 입수하지 못할 것으로 예상한다. 담당자는 추가 업무가 필요하면 매년 같은 판매부문만 선정하면 된다고 생각한다.'
]);
{
  const q = get('pilot-14-007').subquestions.find(q => q.id === 'sub2');
  q.prompt = 'B 부문에 적용할 수 있는 업무유형을 감사기준서 600 문단 27의 범위에서 모두 제시하시오. 특정 위험에 한정하는 대안은 지문의 거래와 연결하고, 부문재무정보 전체를 감사하는 대안의 중요성 및 열거한 유형 중 실제 수행할 업무를 선택하는 원칙도 설명하시오.';
  q.model_answer[1] = '외화파생계약의 측정 및 관련 공시에 관한 유의적인 중요왜곡표시위험과 관련된 하나 이상의 거래유형·계정잔액 또는 공시에 대하여 감사를 수행할 수 있다.';
  q.model_answer[2] = '외화파생계약의 측정 및 관련 공시에 관한 유의적인 중요왜곡표시위험에 대응하는 특정 감사절차를 수행할 수 있다.';
  setClaim(q, 'sub2.crit2', q.model_answer[1]); setClaim(q, 'sub2.crit3', q.model_answer[2]);
  for (const r of q.requirements.filter(r => ['sub2.req2','sub2.req3'].includes(r.id))) r.source_span += '; 사례 적용: B의 외화파생계약 측정 또는 관련 공시 위험과의 연결을 요구한다.';
}

facts('pilot-10-007', [
  '한결회계법인은 여러 은행에서 자금을 조달하는 다온회사의 2026년 재무제표를 감사하고 있다. 이자비용은 중요한 계정이며 일부 차입계약은 변동금리를 적용한다. 감사팀은 관련 주장에 대하여 평가한 중요왜곡표시위험과 세부테스트를 고려하여 실증적 분석절차가 적합하다고 판단했고, 사용 자료의 신뢰성 평가도 별도로 마쳤다. 아래 가와 나는 서로 독립적인 진행 상황이다.',
  '가: 담당자는 회사가 제공한 차입금 평균잔액과 평균이자율을 단순히 곱한 값이 장부의 이자비용과 비슷하자 이를 근거로 절차를 마치려 한다. 그 계산값이 중요한 왜곡표시를 식별할 수 있는 정확한 기대치인지 아직 평가하지 않았으며, 추가 조사 없이 수용할 차이의 기준도 정하지 않았다. 월별 계약조건이 서로 다른 차입금이 있지만 연간 평균자료로 계산한 결과만 보관하였다.',
  '나: 담당자가 적절히 설계한 분석을 수행하자 감사인의 기대치가 장부 이자비용보다 유의적으로 컸고 정해 둔 수용 차이금액도 초과하였다. 재무담당자는 은행이 연말에 이자를 감면해 주었기 때문이라고 설명하였다. 그러나 감사인이 입수한 은행 확인자료에는 그 감면이 반영되지 않았고, 회사도 변경 약정서를 제시하지 못했다. 담당자는 경영진에게 질문하여 설명을 들었으므로 이 차이에 관한 조사를 끝내자고 제안하였다.'
]);
{
  const s = get('pilot-10-007'), q = s.subquestions[0];
  q.prompt = '가에서 계획한 실증적 분석절차의 종결이 적절한지 판단하고, 지문에서 아직 수행하지 않은 기대치의 정확성 평가와 수용 차이금액의 결정에 관하여 보완할 내용을 설명하시오. 이미 마친 절차는 반복하지 않아도 된다.';
  s.subquestions.push(newQuestion(s, 'exp1', '나의 차이 조사를 마치기 전에 감사인이 수행할 내용을 설명하시오. 이자감면 설명을 평가할 증거와, 현재 확보된 자료가 그 설명을 뒷받침하지 못하는 상황의 후속 감사절차를 구별하고 각각 사례에 맞는 대상을 제시하시오.', [
    '이자감면을 뒷받침하는 은행의 변경 약정이나 감면 확인 등 관련성 있는 적합한 감사증거를 입수하여 재무담당자의 설명을 평가하여야 한다.',
    '현재의 은행 확인자료가 이자감면 설명을 뒷받침하지 못하므로 차입계약과 이자 지급·미지급 내역의 세부테스트 등 해당 차이를 조사하는 데 필요한 기타 감사절차를 수행하여야 한다.'
  ], ['src-e7d17e54be2d240805', 'src-610dfeb49d38af086d', 'src-6c6cc0b55e6b722cad']));
}

facts('pilot-10-006', [
  '한결회계법인은 2026년 재무제표 감사에서 다온회사의 매출채권 실재성에 관한 세부테스트를 설계하였다. 매출채권은 소액의 다수 거래처로 구성되며, 감사팀은 모든 항목보다 적은 수의 표본을 추출하여 외부조회와 관련 증빙검사를 수행하였다. 표본은 모집단의 모든 단위가 추출될 기회를 갖도록 선정되었고, 선택된 표본에 대한 절차의 적용과 증거 해석에는 잘못이 없었다. 다음 A와 B는 같은 감사에서 동시에 발생한 일이 아닌 독립적인 가상 상황이다.',
  '상황 A: 선택된 표본에서는 실재하지 않는 채권이 발견되지 않았고, 감사팀은 표본 결과에 근거하여 전체 매출채권에 중요한 왜곡표시가 없다고 결론 내렸다. 그러나 모집단 전체에 동일한 절차를 적용하였다면, 표본에 포함되지 않은 거래처에 존재하는 가공채권 때문에 중요한 왜곡표시가 있다고 결론 내렸을 것이다.',
  '상황 B: 선택된 표본에는 실재하지 않는 채권이 포함되어, 감사팀은 표본 결과에 근거하여 전체 매출채권에 중요한 왜곡표시가 있다고 결론 내렸다. 그러나 모집단 전체에 동일한 절차를 적용하였다면 중요한 왜곡표시가 없다고 결론 내렸을 것이다. 표본과 모집단의 결론이 달라지는 것은 표본추출에 따른 것이며 금액·표본수의 계산은 요구하지 않는다.'
]);

facts('pilot-15-006', [
  '라온산업의 2026년 1월 1일부터 12월 31일까지의 재무제표 감사에서 감사인은 대체절차로도 증거를 확보하지 못하였다. 발견되지 않은 왜곡표시의 가능한 영향이 중요하고 전반적이어서 의견거절을 결정하였다. 다음은 2027년에 발행할 보고서의 초안이며, 의견 선택 자체를 다시 판단하는 문제는 아니다.',
  '의견 단락 초안: [제목] 감사의견. [문장 가] 우리는 라온산업의 별첨 재무제표를 감사하였습니다. [문장 나] 해당 재무제표는 2026년 12월 31일 현재의 재무상태표, 동일자로 종료되는 보고기간의 포괄손익계산서, 자본변동표, 현금흐름표 및 재무제표의 주석으로 구성되어 있습니다. [문장 다] 별첨 재무제표에 대하여 적정의견을 표명합니다. [문장 라] 의견거절근거 단락에 기술된 사항에도 불구하고 감사의견의 근거를 제공하기에 충분하고 적합한 감사증거를 입수하였습니다.',
  '별도의 의견거절근거 단락에는 증거를 입수하지 못한 이유가 적절히 기재되어 있다. 담당자는 감사인의 책임 단락에는 적정의견 보고서에서 사용하는 위험평가, 내부통제 이해, 회계정책 평가 등에 관한 상세한 표준 설명을 그대로 붙였다. 대신 의견거절을 하므로 감사 수행·보고서 발행 책임과 증거를 입수하지 못한 한계는 다시 설명할 필요가 없다고 보았다. 회사로부터의 독립성과 기타 윤리적 책임에 관한 문구도 이 단락에서 삭제하였다.'
]);
{
  const s = get('pilot-15-006');
  s.subquestions[0].prompt = '의견 단락 초안의 제목과 문장 가·다·라를 의견거절에 맞게 각각 수정하시오. 문장 나의 적정한 재무제표 명세는 유지하며, 이 물음에서는 나머지 단락을 작성하지 마시오.';
  s.subquestions.push(newQuestion(s, 'exp1', '감사인의 책임 단락에 상세한 표준 설명을 그대로 붙인 초안을 어떻게 바꾸어야 하는지 설명하시오. 이 상황에서 해당 단락에 포함할 책임, 증거 미입수의 한계, 독립성·윤리적 책임에 관한 기술을 각각 제시하시오.', [
    '상세한 표준 책임 설명을 축소하고, 감사인의 책임은 대한민국의 회계감사기준에 따라 라온산업의 재무제표에 대한 감사를 수행하고 감사보고서를 발행하는 것임을 기술한다.',
    '그러나 의견거절근거 단락에 기술된 사항 때문에 재무제표에 대한 감사의견의 근거를 제공하기에 충분하고 적합한 감사증거를 입수할 수 없었음을 기술한다.',
    '대한민국의 감사 관련 윤리적 요구사항에 따라 라온산업으로부터 독립적이며 그 요구사항에 따른 기타 윤리적 책임을 이행하였음을 기술한다.'
  ], ['src-f8d1a532696d92b917', 'src-bb013e2b227a11dc71']));
}

// Keep only used standard references, then merge exact duplicate quotations without changing original files.
for (const s of sets) {
  const titles = {
    'pilot-16-012': '계약 분쟁 핵심감사사항의 비공개 예외',
    'pilot-14-008': '그룹 보고한도의 결정과 부문중요성 합계',
    'pilot-10-007': '이자비용 분석의 기대치와 차이 조사',
    'pilot-10-006': '매출채권 표본위험의 방향과 감사에 미치는 영향',
    'pilot-15-006': '의견거절 보고서의 의견·감사인책임 단락 수정'
  };
  if(titles[s.id]) s.title = titles[s.id];
  s.learning_order = s.subquestions.map(q => q.id);
  const used = new Set(s.subquestions.flatMap(q => [...q.requirements.map(r => r.source_ref_id), ...q.criteria.flatMap(c => c.source_ref_ids)]));
  s.source_refs = s.source_refs.filter(r => used.has(r.id));
  const owners = new Map(), remap = new Map();
  s.source_refs = s.source_refs.filter(r => {const k=r.source_quote.replace(/\s+/gu,''); if(owners.has(k)){remap.set(r.id,owners.get(k));return false;} owners.set(k,r.id); return true;});
  for(const q of s.subquestions) {for(const r of q.requirements) r.source_ref_id=remap.get(r.source_ref_id)||r.source_ref_id; for(const c of q.criteria)c.source_ref_ids=[...new Set(c.source_ref_ids.map(id=>remap.get(id)||id))];}
  s.classification.standards = [...new Set(s.source_refs.map(r => r.page).filter(p => p?.startsWith('KGA ')))].sort();
}
fs.mkdirSync(`${D}/c`, {recursive: true});
fs.writeFileSync(`${D}/c/sets.json`, JSON.stringify(sets, null, 2)+'\n');
console.log(sets.map(s => ({id:s.id, factsChars:s.shared_context.facts.map(f=>f.text).join('\n').length, questions:s.subquestions.length, points:s.subquestions.reduce((n,q)=>n+q.criteria.reduce((n,c)=>n+c.max_points,0),0)})));
