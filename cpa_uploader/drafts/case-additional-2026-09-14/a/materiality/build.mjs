import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const directory = 'cpa_uploader/drafts/case-additional-2026-09-14/a/materiality';
const catalogFile = 'cpa_uploader/drafts/case-additional-2026-09-14/source-catalog.json';
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank = JSON.parse(fs.readFileSync(bankFile, 'utf8'));
const official2026 = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const id = 'case-04-materiality-reset-20260914';
const hash = value => createHash('sha256').update(value).digest('hex');
const unit = id => { const found = catalog.units.find(u => u.id === id); assert(found, `Unknown source unit: ${id}`); return found; };
const extract = (file, first, last) => {
  const text = fs.readFileSync(file, 'utf8');
  const quote = text.split(/\r?\n/u).slice(first - 1, last).join(text.includes('\r\n') ? '\r\n' : '\n');
  assert(text.includes(quote)); return quote;
};
const sourceDefinitions = [
  ['src-0daaa18eaf14f4f6a8', '12', 504, 507, 307, 14302, 14305, 333],
  ['src-24bfa3ad9356517e75', 'A14', 538, 543, 311, 14482, 14487, 337],
  ['src-5fbe07fb969895bbb3', '13', 510, 514, 307, 14306, 14310, 333],
  ['src-2fec01ef526043b066', '14 도입·(a)', 248, 252, 307, 14312, 14316, 333],
  ['src-68a4011b89412b5afd', '14(b)–(d)', 260, 266, 308, 14324, 14330, 334],
];
const sourceComparisons = sourceDefinitions.map(([sourceId, paragraph, first, last, page, currentFirst, currentLast, currentPage]) => {
  const u = unit(sourceId); assert.equal(u.authority, 'official_transcription');
  const quote = extract(u.file, first, last), currentQuote = extract(official2026, currentFirst, currentLast);
  const normalized = text => text.replace(/\s/gu, '');
  assert.equal(normalized(quote), normalized(currentQuote), `2025/2026 paragraph differs: ${paragraph}`);
  return { source_unit_id: sourceId, standard: 'KGA 320', paragraph,
    registered_source: { file: u.file, file_sha256: hash(fs.readFileSync(u.file)), start_line: first, end_line: last, pdf_page: page, quote, quote_sha256: hash(quote) },
    current_2026_comparison: { file: official2026, file_sha256: hash(fs.readFileSync(official2026)), start_line: currentFirst, end_line: currentLast, pdf_page: currentPage, quote: currentQuote, quote_sha256: hash(currentQuote) },
    result: 'same_text_after_whitespace_normalization',
    semantic_comparison: '주체·조건·의무·적용자료의 의미가 동일함을 직접 읽어 확인했다. 2025 등록 전사의 기존 경로·바이트·ID를 사용하되 2026 전문의 대응 문단과 대조했다. 원문 인용에서 관련 없는 다음 페이지 표지와 각주를 제외한 연속 본문만 사용한다.' };
});
const sources = sourceComparisons.map(c => ({ id: c.source_unit_id, file: c.registered_source.file,
  title: `KGA 320 문단 ${c.paragraph}; 등록 전사 PDF ${c.registered_source.pdf_page}쪽, 2026 전문 PDF ${c.current_2026_comparison.pdf_page}쪽 동일 문구 대조`,
  page: 'KGA 320', role: 'standard', source_quote: c.registered_source.quote, content_hash: c.registered_source.quote_sha256 }));
const source = sourceId => sources.find(s => s.id === sourceId);
const requirement = (questionId, number, sourceId) => {
  const s = source(sourceId), c = sourceComparisons.find(c => c.source_unit_id === sourceId); assert(s && c);
  return { id: `${questionId}.r${number}`, source_ref_id: sourceId, source_quote: s.source_quote,
    source_span: `KGA 320 ${c.paragraph}; 등록 전사 PDF ${c.registered_source.pdf_page}쪽 L${c.registered_source.start_line}–L${c.registered_source.end_line}; 2026 전문 PDF ${c.current_2026_comparison.pdf_page}쪽 L${c.current_2026_comparison.start_line}–L${c.current_2026_comparison.end_line} 대조` };
};
const criterion = (questionId, number, requirementId, claim, condition, sourceIds, factType = 'action') => ({
  id: `${questionId}.c${number}`, requirement_id: requirementId, claim,
  critical_facts: [
    { id: `${questionId}.c${number}.meaning`, type: factType, expected: claim },
    { id: `${questionId}.c${number}.scope`, type: 'condition', expected: condition },
  ], max_points: 1, scores: { met: 1, not_met: 0, contradicted: 0 }, source_ref_ids: sourceIds,
});
const facts = [
  '솔빛회계법인은 도현회사의 2026년 1월 1일부터 12월 31일까지의 재무제표를 감사한다. 감사계획 당시에는 기존 사업이 유지된다는 연간 이익 예측을 토대로 전체 중요성을 5억원, 수행중요성을 3억원으로 정하였다. 당초 계획은 종전 제품구성을 전제한 월별 매출 분석, 중간감사 중심의 일정, 당시 수행중요성에 따른 표본범위로 구성되었다.',
  '9월 말 감사팀은 주요사업의 처분결정과 주요 거래처의 계약종료를 확인하였다. 실제 실적과 수정 예측을 대조한 결과, 연간 이익은 최초 예측에 크게 미달할 전망이다. 이는 일회성 평가손실 때문이 아니라 수익구조가 축소된 결과이며, 계획 당시에는 알지 못한 정보다.',
  '담당자 갑은 최초 중요성을 바꾸면 감사의 일관성이 훼손되므로 5억원을 유지하자고 한다. 다음은 이 제안과 별도로 준비한 조건부 후속안이다. 전체 중요성을 낮추는 것이 적합하다고 결정되더라도, 이미 중간감사를 수행했으므로 수행중요성 3억원과 위의 매출 분석·일정·표본범위를 모두 그대로 유지할 계획이다.',
  '문서화 담당자는 중요성표의 5억원을 최종 결정액으로 덮어쓰면 충분하다고 한다. 수행중요성에 관한 후속 결정과 이익 예측의 변경 자료는 별도 기록 없이 구두로 인계하려 한다. 특정 거래유형·계정잔액·공시에 적용할 별도 중요성 수준은 이 사례의 검토 범위에서 제외한다.',
];
const baseQuestion = questionId => ({ id: questionId, type: 'descriptive', question_style: 'case', topic_ids: ['04'],
  selection: { type: 'all', n: null }, constraints: { ordered: false, max_entries: null, overflow_policy: 'none' }, decision: null });
const sub1 = { ...baseQuestion('sub1'),
  prompt: '갑의 최초 중요성 유지 제안이 적절한지 판단하고, 감사 중 확인한 정보가 그 판단에 미치는 이유를 설명하시오. 수정할 금액의 계산은 요구하지 않는다.',
  model_answer: [
    '최초 중요성 5억원을 고정하여 유지하자는 제안은 부적절하며, 새 정보를 반영하여 중요성을 수정해야 한다.',
    '주요사업 처분과 거래처 계약종료에 따른 수익구조 축소로 연간 이익이 최초 예측과 크게 달라질 전망이므로, 처음부터 알았다면 최초 중요성을 다르게 결정했을 정보에 해당한다.',
  ],
  requirements: [requirement('sub1', 1, sources[0].id), requirement('sub1', 2, sources[1].id)],
  criteria: [
    criterion('sub1', 1, 'sub1.r1', '도현회사의 최초 중요성 5억원을 고정하여 유지하자는 제안을 부적절하다고 판단한다. 새 정보를 반영해 중요성을 수정해야 한다는 조치나 명확한 이유가 판단을 함축해도 인정한다.', '명시적으로 종전 중요성을 계속 고정해야 한다고 하면 판단 점수는 인정하지 않는다. 단순히 모든 감사의 중요성이 언제나 낮아져야 한다는 일반론은 인정하지 않는다.', [sources[0].id], 'conclusion'),
    criterion('sub1', 2, 'sub1.r2', '주요사업 처분·거래처 계약종료에 따른 실제 수익구조 변화와 최초 연간 이익 예측의 큰 차이를 연결하여, 처음 알았다면 중요성을 다르게 결정했을 새로운 정보임을 설명한다.', '사업처분 또는 거래처 계약종료 중 구체적인 구조 변화와 최초 예측과의 차이를 중요성 재결정에 연결한다. 상황 변화를 그대로 복사하거나 일회성 손실을 무조건 가산하면 부족하다. 판단에 명시적으로 반대하더라도 이 독립된 이유가 정확히 성립하면 이 기준은 별도로 평가한다.', [sources[0].id, sources[1].id], 'conclusion'),
  ],
};
const sub2 = { ...baseQuestion('sub2'),
  prompt: '전체 중요성을 낮추는 것이 적합하다고 결정되는 경우, 조건부 후속안에서 재검토할 사항을 수행중요성과 추가감사절차로 구별하여 설명하시오. 추가감사절차는 사례에 제시된 분석 방법·수행 일정·표본범위에 각각 연결하시오. 구체적인 수정 금액이나 표본 수의 계산은 요구하지 않는다.',
  model_answer: [
    '낮아진 전체 중요성에 비추어 종전에 정한 수행중요성 3억원을 수정할 필요가 있는지 결정한다.',
    '종전 제품구성을 전제한 월별 매출 분석이 사업 변화 이후에도 적합한 방법인지 검토하여 추가감사절차의 성격을 재평가한다.',
    '중간감사 중심의 기존 일정이 새 상황에서도 적합한지 검토하여 추가감사절차의 시기를 재평가한다.',
    '종전 수행중요성을 기초로 정한 표본범위가 낮아진 중요성에서도 적합한지 검토하여 추가감사절차의 범위를 재평가한다.',
  ],
  requirements: [requirement('sub2', 1, sources[2].id)],
  criteria: [
    criterion('sub2', 1, 'sub2.r1', '낮아진 전체 중요성에 비추어 종전 수행중요성 3억원을 수정할 필요가 있는지 결정한다.', '수행중요성은 무조건 같은 비율로 낮춘다고 단정하지 않는다. 3억원이라는 숫자의 반복은 필수가 아니나, 원래 설정한 수행중요성을 새 전체 중요성에 비추어 재검토한다는 관계가 필요하다.', [sources[2].id]),
    criterion('sub2', 2, 'sub2.r1', '종전 제품구성을 전제한 월별 매출 분석이 사업 변화 후에도 적합한 방법인지 검토하여 추가감사절차의 성격을 재평가한다.', '성격이라는 명칭만으로는 부족하다. 기존 매출 분석의 방법 또는 전제가 변경된 사업 상황에도 적합한지 연결하면 인정한다. 기존 분석을 무조건 전부 폐기해야 한다는 단정은 요구하지 않는다.', [sources[2].id]),
    criterion('sub2', 3, 'sub2.r1', '중간감사 중심의 기존 일정이 새 상황에서도 적합한지 검토하여 추가감사절차의 시기를 재평가한다.', '시기라는 명칭만으로는 부족하다. 이미 수행한 중간감사 또는 기존 중간감사 중심 일정과 변화 이후의 절차 시기 판단을 연결하면 인정한다. 기말감사를 무조건 추가하라는 특정 결론은 요구하지 않는다.', [sources[2].id]),
    criterion('sub2', 4, 'sub2.r1', '종전 수행중요성을 기초로 정한 표본범위가 낮아진 중요성에서도 적합한지 검토하여 추가감사절차의 범위를 재평가한다.', '범위라는 명칭만으로는 부족하다. 기존 표본범위와 수정된 중요성의 적합성 판단을 연결하면 인정한다. 표본 수의 자동 증감, 전수검사 또는 이미 수행한 모든 검사의 반복은 요구하지 않는다.', [sources[2].id]),
  ],
};
const sub3 = { ...baseQuestion('sub3'),
  prompt: '문서화 담당자의 계획을 보완하시오. 전체 중요성과 수행중요성의 금액·수정내용, 그리고 이번 결정에서 고려한 요소의 기록을 구별하여 설명하시오. 금액을 새로 계산할 필요는 없다.',
  model_answer: [
    '전체 중요성은 최종액만 덮어쓰는 데 그치지 않고, 최초 5억원에서 어떻게 수정하였는지 그 금액과 수정내용을 기록한다.',
    '종전 수행중요성 3억원도 문서에 포함하고, 이를 수정한 경우 수정된 금액과 수정내용을 함께 기록한다.',
    '주요사업 처분·거래처 계약종료에 따른 수익구조 변화와 최초 이익 예측 대비 수정 자료 등 중요성 금액을 결정할 때 고려한 요소를 구두 인계에 그치지 않고 문서화한다.',
  ],
  requirements: [requirement('sub3', 1, sources[3].id), requirement('sub3', 2, sources[4].id)],
  criteria: [
    criterion('sub3', 1, 'sub3.r1', '도현회사의 전체 중요성에 관하여 최종액만 덮어쓰는 대신 최초 금액에서 최종 금액으로의 수정내용을 문서화한다.', '최초 5억원이라는 숫자의 정확한 재기재를 별도 점수로 요구하지 않는다. 기존 금액과 최종 금액의 변경 이력이 드러나야 하며 최종 금액만 기록하면 부족하다.', [sources[3].id, sources[4].id]),
    criterion('sub3', 2, 'sub3.r2', '수행중요성 3억원을 문서에 포함하고 수정한 경우 그 변경 금액과 수정내용도 기록하여, 수행중요성에 관한 내용을 구두로만 인계하려는 계획을 보완한다.', '수행중요성 금액의 기록과 수정한 경우의 변경내용이 함께 드러나야 한다. 변경 자체가 반드시 발생한다고 단정하지 않는다. 최초 금액의 숫자 반복 자체를 숨은 득점 요건으로 두지 않는다.', [sources[3].id, sources[4].id]),
    criterion('sub3', 3, 'sub3.r1', '사업처분·거래처 계약종료에 따른 구조 변화와 이익 예측의 변경 자료 등 이번 중요성 금액 결정에서 고려한 구체적인 요소를 문서화한다.', '고려한 요소를 기록한다는 일반론이나 사실관계 복사만으로는 부족하다. 구조 변화 또는 최초와 수정 이익 예측 차이를 이번 금액의 결정근거로 기록한다는 조치가 있어야 한다. 금액별로 같은 근거를 불필요하게 반복할 의무는 없다.', [sources[3].id, sources[1].id]),
  ],
};
const set = { schema_version: '3.0', id, type: 'linked_question_set', status: 'needs_review',
  title: '사업축소 후 중요성 수정과 기존 감사계획의 재평가',
  classification: { topic_id: '04', part: 'PART2', chapter: '감사계획과 중요성', domain: 'audit', standards: ['KGA 320'], tags: ['중요성 수정', '추가감사절차', '문서화'] },
  source_refs: sources, shared_context: { facts: facts.map((text, i) => ({ id: `fact${i + 1}`, text, scoreable: false })) },
  learning_order: ['sub1', 'sub2', 'sub3'], subquestions: [sub1, sub2, sub3],
  verification: { source_fidelity: 'reconstructed', review_status: 'needs_human_review', calculation_required: false,
    notes: ['2026-09-14 사용자 승인에 따른 독립 신규 사례. 출제·의미검수 및 대표 QA는 a/materiality 산출물에 기록한다. 실제 모델 채점·승급·게시를 뜻하지 않는다.',
      '2021 기출 문제 8 물음 2와 2026 고급 회계감사연습 수록 23년 제2회 GS 문제 2의 원지문·발문·해설을 참고했다. 사업축소·조건부 후속안은 공식 KGA 320 문단 12–14 및 A14를 적용하기 위한 창작 사실이다.',
      '2026년 개시 보고기간을 적용한다. 2025 등록 전사의 득점 문단을 현행 2026 전문 PDF 333–334·337쪽과 실제 대조하여 의미와 문구 동일성을 확인했다. 최종 시험 적용 판본의 확정 주장이 아니다.'] },
};
const qa = [
  { set_id: id, subquestion_id: 'sub1', kind: 'partial', answer: '갑의 제안은 부적절하다. 기존 중요성을 고정해서는 안 된다.', expected_points: 1, met_criterion_ids: ['sub1.c1'], reason: '부적절 판단만 있다. 실제 구조 변화와 최초 예측의 차이가 왜 재결정 정보인지의 독립 근거는 설명하지 않았다.' },
  { set_id: id, subquestion_id: 'sub1', kind: 'wrong', answer: '갑의 제안이 적절하다. 감사의 일관성을 위해 중요성은 최초에 정한 금액을 감사 종료까지 고정하여야 한다.', expected_points: 0, met_criterion_ids: [], reason: '최초 중요성 고정이라는 잘못된 결론·이유만 있고 새로운 정보에 대한 올바른 평가가 없다.' },
  { set_id: id, subquestion_id: 'sub2', kind: 'partial', answer: '전체 중요성이 낮아졌으므로 기존 수행중요성 3억원을 수정할 필요가 있는지 결정한다. 또 사업 변화 후에도 종전 제품구성에 기초한 매출 분석 방법이 적합한지 재검토한다.', expected_points: 2, met_criterion_ids: ['sub2.c1', 'sub2.c2'], reason: '수행중요성과 분석 방법의 성격만 맞는다. 중간감사 일정이나 표본범위에 관한 독립 판단은 함축하지 않는다.' },
  { set_id: id, subquestion_id: 'sub2', kind: 'wrong', answer: '전체 중요성만 낮추면 되므로 수행중요성은 항상 3억원으로 고정한다. 중간감사를 한 번 수행했으면 기존 매출 분석 방법과 일정 및 표본범위도 재검토할 필요가 없다.', expected_points: 0, met_criterion_ids: [], reason: '수행중요성 및 성격·시기·범위의 적합성 재검토를 모두 부정하며 독립적인 정답 명제가 없다.' },
  { set_id: id, subquestion_id: 'sub3', kind: 'partial', answer: '종전에 정한 수행중요성 3억원을 문서에 포함하고, 이를 수정했다면 변경된 금액과 수정내용도 기록한다.', expected_points: 1, met_criterion_ids: ['sub3.c2'], reason: '수행중요성의 기록만 맞는다. 전체 중요성 수정 이력과 금액 결정에서 고려한 구체적인 요소는 빠져 있다.' },
  { set_id: id, subquestion_id: 'sub3', kind: 'wrong', answer: '최종 전체 중요성 금액만 덮어쓰면 충분하다. 수행중요성에 관한 기록과 이익 예측이 바뀐 이유는 구두 인계로 대신할 수 있다.', expected_points: 0, met_criterion_ids: [], reason: '전체 중요성 변경 이력·수행중요성 기록·결정요소 문서화를 모두 부정한다.' },
];
const learningSourceIds = ['src-a64feca907e456c351', 'src-c4401b3265b9fd502a', 'src-12aa16376b756bb01a', 'src-1054a4c127004f6da9', 'src-a65b605fbea53109ce'];
const comparedIds = ['pilot-04-001', 'pilot-04-007', 'draft-04-320-freq01', 'pilot-12-009', 'pilot-04-005-standards-20260913', 'pilot-04-007-standards-20260913'];
const difference = 'pilot-04-007은 최초 수행중요성의 고정비율·기업 이해이고 draft-04-320-freq01은 일시손실의 정상화 및 인수 공시 중요성이다. 이 사례는 감사 도중의 지속적인 사업축소에 따라 최초 중요성을 재결정하고 이미 계획·수행한 절차를 재평가하며 변경 이력을 남기는 흐름이다. pilot-12-009의 감사종결 미수정왜곡표시 평가와도 시점·대응목적이 다르다. pilot-04-001/sub2 및 분리된 기준서형의 일반론은 이미 존재하므로 새로운 기준서 요구의 발견으로 주장하지 않고 사례 적용 심화로 기록한다.';
const edition = '감사대상은 2026년 1월 1일 개시 보고기간이다. 현행 2026 전문 KGA 320 문단 7(PDF 332쪽 L14268–14270)이 이를 적용 대상으로 정하고 있음을 직접 읽었다. 득점 근거인 12·13·14·A14는 2025 등록 전사와 2026 전문의 문단번호 및 문구가 공백 정규화 후 동일함을 확인했다. 2026 품질관리 개정에 따라 문단 번호가 이동한 KGA 300·220은 이 사례의 득점 근거로 사용하지 않는다. 2027 CPA 시험의 최종 판본을 확정한 것이 아니다.';
const plan = { version: 1, topic_id: '04', mode: 'new_from_standard',
  objective: '감사 도중 확인된 지속적인 사업축소를 최초 중요성 수정의 계기로 해석하고, 기존 수행중요성·감사절차 및 중요성 문서화의 적합성을 사례에 적용한다.',
  scope: { actors: ['솔빛회계법인 감사팀과 담당자 갑', '도현회사의 사업·재무자료를 평가하는 감사인', '중요성 문서화 담당자'],
    timing: ['2026년 1월 1일 개시 보고기간', '최초 감사계획 및 중간감사 이후 9월 말 새로운 사업 정보 확인', '전체 중요성 인하가 적합하다고 결정될 경우의 조건부 후속안'],
    conditions: facts,
    exceptions: ['전체 중요성 인하를 이유로 수행중요성의 기계적 자동 인하나 모든 감사절차의 반복을 요구하지 않는다. 수정 필요성·기존 절차의 적합성 판단을 요구한다.', '중요성 금액이 실제로 수정되지 않은 경우를 가정해 변경이 발생했다고 꾸며 문서화할 필요는 없다. 변경한 경우의 내용과 고려요소를 기록한다.'],
    required_answers: set.subquestions.map(q => `${q.id}: ${q.prompt}`),
    exclusions: ['구체적인 중요성 금액·적정 비율·표본 수 계산', '특정 거래유형·계정잔액·공시의 별도 중요성 수준', '미수정왜곡표시의 최종 평가와 감사의견 종류', '사업처분의 회계처리 적정성 및 KGA 300 전반감사전략 문서화 일반 목록'] },
  question_types: ['descriptive'], source_unit_ids: [...sources.map(s => s.id), ...learningSourceIds],
  existing_question_difference: difference, edition_assumption: edition, unresolved_items: [], status: 'ready' };
const pointDecisions = [
  '2점: 기존 금액 고정 제안의 판단 1점과 사업구조 변화·최초 예측 차이를 연결한 근거 1점. 조치와 판단은 함축 관계이므로 따로 중복 배점하지 않는다. 일반론만으로 푸는 pilot-04-001과 달리 이 회사의 새로운 정보 해석이 필요하다.',
  '4점: 종전 수행중요성의 수정 필요성, 매출 분석 방법의 성격, 중간감사 일정의 시기, 표본범위의 범위를 각 1점으로 분리했다. pilot-04-001/sub2의 네 독립 조치와 배점을 맞추되 이번 사례의 실제 계획에 연결해야 한다. 하나의 인하 후 재평가 업무이므로 문서화와만 별도 물음으로 나누고 단어·문장 수로 추가 배점하지 않는다.',
  '3점: 전체 중요성 수정내용 1점, 수행중요성 금액 및 조건부 수정내용 1점, 이번 결정에서 고려한 요소의 기록 1점. 전체 금액과 수행중요성은 별개의 기록 대상이다. 각 금액과 그 수정내용은 동일 대상을 변경 이력으로 기록하는 한 조치여서 중복 세분화하지 않는다. 특정 중요성은 명시적으로 범위에서 제외했다.',
];
const factLinks = [['fact1', 'fact2', 'fact3'], ['fact1', 'fact2', 'fact3'], ['fact1', 'fact2', 'fact4']];
const review = set.subquestions.map((q, index) => ({
  set_id: id, subquestion_id: q.id, reviewer_id: 'reuse_lineage_review authoring agent',
  method: 'agent_content_review', human_review_performed: false, actual_model_grading: 'not_run',
  rationale: [
    'KGA 320.12의 수정 의무와 A14의 주요사업 처분·예측 차이를 적용했다. 실제 정보가 최초 중요성을 다르게 정했을 정보인지에 대한 이유를 필수로 하므로 일반적인 중요성 정의만으로 만점이 성립하지 않는다. 후속안은 명시적 조건부 가정이며 갑 제안의 정답을 이미 확정한 사실로 제공하지 않는다.',
    'KGA 320.13을 적용하여 네 재평가 대상을 구분했다. 회사가 실제 제시한 매출 분석·중간감사 일정·표본범위의 해석을 요구하고 단순한 성격·시기·범위 명칭 나열은 만점이 아니다. 인하 후 수행중요성이나 표본 수를 자동 변경한다는 원문 밖 결론을 요구하지 않았다.',
    'KGA 320.14의 도입·(a)와 다음 페이지 (b)–(d)를 모두 읽었다. 최종 전체 중요성만 남기고 수행중요성·이익 변경 자료를 구두로 넘기는 안을, 실제 기록 대상과 결정요소에 연결해 보완한다. 특정 중요성과 일반 감사문서 작성자·검토자 목록은 발문 밖이어서 요구하지 않는다.',
  ][index],
  point_decision: pointDecisions[index], max_points: q.criteria.length,
  fact_ids: factLinks[index], question_style: 'case', topic_ids: ['04'],
  minimal_sufficient_answer: q.model_answer,
  source_checks: q.requirements.map(r => ({ requirement_id: r.id, source_ref_id: r.source_ref_id, exact_quote_checked: true, source_span: r.source_span, verdict: 'pass' })),
  criterion_checks: q.criteria.map(c => ({ criterion_id: c.id, claim: c.claim, source_ref_ids: c.source_ref_ids,
    independent_points: 1, verdict: 'pass', rationale: `${c.claim} ${c.critical_facts[1].expected}` })),
  representative_qa_checks: qa.filter(a => a.subquestion_id === q.id).map(a => ({ kind: a.kind, expected_points: a.expected_points, met_criterion_ids: a.met_criterion_ids, rationale: a.reason })),
  empty_answer_expected_points: 0, model_answer_expected_points: q.criteria.length,
  unresolved_content_findings: [],
}));
const design = [{ set_id: id, plan, source_catalog: { file: catalogFile, sha256: hash(fs.readFileSync(catalogFile)), unit_count: catalog.units.length },
  source_comparisons: sourceComparisons,
  edition_check: { rationale: edition, file: official2026, sha256: hash(fs.readFileSync(official2026)), paragraph_7: { pdf_page: 332, start_line: 14268, end_line: 14270 } },
  learning_source_evidence: learningSourceIds.map(sourceId => {
    const u = unit(sourceId); return { source_unit_id: sourceId, file: u.file, file_sha256: hash(fs.readFileSync(u.file)), page: u.page, start_line: u.startLine, end_line: u.endLine, quote: u.quote,
      role: /고급_회계감사_연습/u.test(u.file) ? 'practice_exam_design_reference' : 'past_exam_design_reference',
      reading_result: /고급_회계감사_연습/u.test(u.file) ? '23년 제2회 GS 문제 2의 교수·학생 대화 및 중요성 수정 상황 물음과 320.A14 해설을 확인했다. 새로운 구체 사업 사실은 작성자가 창작했다.' : '2021년 문제 8 물음 2의 예측과 실제 차이·문서화 요구 및 일시손실 조정 해설을 확인했다. 기출의 일시손실을 이 사례의 지속적 사업축소와 혼동하지 않고 새로운 판단을 공식 320.12·A14로 검증했다.' };
  }),
  supplementary_context_read: ['KGA 320.7·9–11·A13(2026 전문 PDF 332–333·337쪽): 시행, 수행중요성의 정의·목적 및 판단성 확인. 정의 자체는 새 득점 요소가 아니다.', 'KGA 230.8(a)–(c)·9–11·A6: 중요성 문서화의 일반적 배경을 확인했다. 일반 감사문서 목록은 이 물음의 숨은 요구로 추가하지 않았다.'],
  comparison_bank: { file: bankFile, sha256: hash(fs.readFileSync(bankFile)), compared_sets: comparedIds.map(comparedId => {
    const s = bank.find(s => s.id === comparedId); assert(s, `Missing comparison set: ${comparedId}`); return { set_id: comparedId, title: s.title, compared_content_sha256: hash(JSON.stringify(s)), subquestion_ids: s.subquestions.map(q => q.id) };
  }), conclusion: difference },
  recent_drafts_checked: ['cpa_uploader/drafts/case-expansion-2026-09-13/a/sets.json', 'cpa_uploader/drafts/case-expansion-2026-09-13/b/sets.json', 'cpa_uploader/drafts/standard-expansion-2026-09-13/s02.json', 'cpa_uploader/drafts/standard-gap-2026-09-13/g08.json'],
  originality: '새로운 기준서 요구가 아니라 기존 규범의 적용 심화이다. 일시손실 정상화·최초 수행중요성·감사종결 평가와 구분하는 조건 및 기존 절차의 구체적 재평가를 창작했다. 교재 재수록을 추가 출제로 집계하지 않는다.',
  fact_character_count: Array.from(facts.join('\n')).length,
  question_fact_mapping: review.map(r => ({ subquestion_id: r.subquestion_id, fact_ids: r.fact_ids, rationale: r.rationale, point_decision: r.point_decision })),
  authoring_status: 'written_and_agent_content_reviewed; model_grading_not_run',
}];
for (const value of [set, design, review, qa]) assert(value);
fs.mkdirSync(directory, { recursive: true });
for (const [file, value] of Object.entries({ 'sets.json': [set], 'design.json': design, 'review.json': review, 'qa.json': qa })) {
  fs.writeFileSync(`${directory}/${file}`, JSON.stringify(value, null, 2) + '\n');
}
console.log(JSON.stringify({ id, fact_characters: Array.from(facts.join('\n')).length, questions: 3, criteria: 9, points: 9, qa: 6, sets_sha256: hash(fs.readFileSync(`${directory}/sets.json`)) }, null, 2));
