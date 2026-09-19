import fs from 'node:fs';
import path from 'node:path';

const outDir = 'cpa_uploader/drafts/pilot-01-005-comprehensive-2026-09-18';
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank = JSON.parse(fs.readFileSync(bankFile, 'utf8'));
const byId = new Map(bank.map((set) => [set.id, set]));
const old = byId.get('pilot-01-005');
const ethicsResponse = byId.get('pilot-01-002');
const qualityReview = byId.get('pilot-01-006');
if (!old || !ethicsResponse || !qualityReview) throw new Error('Required source set is missing');

const sourceFrom = (set, id) => {
  const source = set.source_refs.find((row) => row.id === id);
  if (!source) throw new Error(`Missing source ${set.id}/${id}`);
  return structuredClone(source);
};

const sourceRefs = [
  sourceFrom(old, 'src-7f5576107b198d3b0f'),
  sourceFrom(old, 'src-30bdfbe0bd09bb26a5'),
  sourceFrom(old, 'src-7e9495ceac6def64f7'),
  sourceFrom(old, 'src-cbdae8404682e7ebb9'),
  sourceFrom(ethicsResponse, 'src1'),
  sourceFrom(ethicsResponse, 'src2'),
  sourceFrom(qualityReview, 'src-07f6fdcca61f34837e'),
  sourceFrom(qualityReview, 'src-ed87eeac932c8cb633'),
  sourceFrom(qualityReview, 'src-7c7ab629a8dab452d3'),
];

const sourceById = new Map(sourceRefs.map((source) => [source.id, source]));
const requirement = (id, sourceRefId) => {
  const source = sourceById.get(sourceRefId);
  return {
    id,
    source_ref_id: sourceRefId,
    source_quote: source.source_quote,
    ...(source.source_span ? { source_span: source.source_span } : {}),
  };
};
const criterion = (id, requirementId, claim, sourceRefIds, type = 'condition') => ({
  id,
  requirement_id: requirementId,
  claim,
  critical_facts: [{ id: `${id}.fact`, type, expected: claim }],
  max_points: 1,
  scores: { met: 1, not_met: 0, contradicted: 0 },
  source_ref_ids: sourceRefIds,
});
const baseQuestion = {
  type: 'judgment',
  constraints: { ordered: false, max_entries: null, overflow_policy: 'none' },
  selection: { type: 'all', n: null },
  question_style: 'case',
  topic_ids: ['01'],
};

const set = {
  schema_version: '3.0',
  id: 'pilot-01-005',
  type: 'linked_question_set',
  status: 'needs_review',
  title: '감사 수임부터 보고서일까지의 독립성·품질관리',
  classification: {
    topic_id: '01',
    part: 'PART1',
    chapter: '감사인의 책임과 품질관리',
    domain: 'ethics',
    standards: ['KGA 220'],
    tags: ['독립성', '감사보수', '윤리적 요구사항', '업무품질관리검토'],
  },
  source_refs: sourceRefs,
  shared_context: {
    facts: [
      {
        id: 'f1',
        text: '한결회계법인은 상장기업인 가온주식회사의 20X1년 1월 1일 개시 재무제표감사 수임을 검토한다. 이 감사에는 종전 KGA 220의 품질관리체계를 적용하고, 감사보고서 작성은 20X2년에 이루어진다. 수임검토회의에서 다음 네 의견이 제시되었다. ① 감사보수 중 일부를 가온회사가 보유한 자기주식으로 받아 감사보고서일까지 보유한 후 처분한다. ② 회계법인과 가온회사의 서비스를 결합한 상품의 공동 개발·판매 관계는 회계법인에는 중요하지 않으므로, 가온회사에는 중요하더라도 유지한다. ③ 현금보수가 전임 감사인 보수의 40%이면 낮은 보수 그 자체가 비윤리적이므로 다른 검토 없이 수임을 거절한다. ④ 보수산정 기준과 수행할 서비스 내용을 의뢰인에게 알리고, 업무에 적절한 시간과 적격한 스태프를 투입한다.',
        scoreable: false,
      },
      {
        id: 'f2',
        text: '감사업무를 수임한 뒤 업무수행이사는 관련 윤리적 요구사항의 준수에 관하여 다음 방침을 세웠다. ① 감사 전 과정에서 필요한 관찰과 질문으로 업무팀원의 위반 증거에 주의를 유지한다. ② 보조자가 가온회사 주식을 매수했더라도 2주 안에 처분하겠다고 약속하면 회계법인 내부 자문과 위협 평가 없이 그 보조자를 계속 업무팀에 둔다. ③ 회계법인과 네트워크 회계법인에서 관련 정보를 입수하여 위협과 위반을 평가하고, 필요한 안전장치 또는 법규상 가능한 업무 해지를 검토한다. ④ 적합한 조치로 독립성 문제를 해결할 수 없더라도 감사보고서 발행 때까지 기다렸다가 회계법인에 보고한다.',
        scoreable: false,
      },
      {
        id: 'f3',
        text: '감사 막바지에 중요한 회계추정치에 관한 업무팀의 판단을 업무품질관리검토자가 문제 삼았다. 업무수행이사는 다음과 같이 처리하려 한다. ① 업무품질관리검토자가 선임되었는지 확인하고, 검토 중 식별된 사항을 포함한 유의적 사항을 검토자와 논의한다. ② 실제 검토가 끝나기 하루 전에 감사보고서일을 정한 뒤 남은 검토를 마친다. 최종 검토 문서는 보고서일 후에도 정리할 수 있다는 점을 그 근거로 든다. ③ 업무팀과 검토자의 의견 차이는 감사문서에 기록하기만 하고 해결하지 않은 채 보고서를 발행한다. ④ 문단 20~22에 따른 실제 검토와 의견 차이의 해결을 보고서일까지 마쳤다면, 검토 문서의 최종 정리는 최종감사파일 취합의 일부로 보고서일 후에 완료한다.',
        scoreable: false,
      },
    ],
  },
  learning_order: ['sub1', 'sub2', 'sub3'],
  subquestions: [
    {
      ...baseQuestion,
      id: 'sub1',
      prompt: '수임검토회의의 ①~④ 중 부적절한 의견을 모두 식별하고, 각 의견이 부적절한 이유 또는 필요한 수정조치를 간략히 설명하시오.',
      model_answer: [
        '부적절한 의견은 ①, ②, ③이다.',
        '① 회계법인 자체가 감사의뢰인 주식을 직접 보유하면 직접적인 재무적 이해관계가 발생하고 이를 유지한 채 적용할 수 있는 안전장치가 없으므로, 주식보수 조건을 제거하여 그 이해관계를 청산해야 한다.',
        '② 친밀한 공동사업 관계의 예외는 재무적 이해관계가 회계법인과 감사의뢰인 모두에게 중요하지 않고 관계도 명백하게 경미해야 한다. 가온회사에는 중요하므로 관계를 종료·축소하거나 감사를 거절해야 한다.',
        '③ 낮은 보수 자체는 비윤리적인 것이 아니다. 보수 수준과 업무에 따라 전문가적 적격성과 정당한 주의에 대한 이기적 위협을 평가하고, 보수산정 기준·업무 내용을 알리며 적절한 시간과 적격한 스태프를 투입하는 등의 안전장치를 적용해야 한다.',
      ],
      requirements: [
        requirement('sub1.req1', 'src-7e9495ceac6def64f7'),
        requirement('sub1.req2', 'src-cbdae8404682e7ebb9'),
        requirement('sub1.req3', 'src-7f5576107b198d3b0f'),
        requirement('sub1.req4', 'src-30bdfbe0bd09bb26a5'),
      ],
      criteria: [
        criterion('sub1.crit1', 'sub1.req1', '부적절한 의견을 ①·②·③으로 빠짐없이 식별하고 적절한 ④를 부적절하다고 선택하지 않는다.', ['src-7e9495ceac6def64f7', 'src-cbdae8404682e7ebb9', 'src-7f5576107b198d3b0f', 'src-30bdfbe0bd09bb26a5'], 'conclusion'),
        criterion('sub1.crit2', 'sub1.req1', '①은 회계법인 자체의 감사의뢰인 주식 직접 보유이므로 안전장치로 유지할 수 없고 그 재무적 이해관계를 청산해야 한다고 설명한다.', ['src-7e9495ceac6def64f7']),
        criterion('sub1.crit3', 'sub1.req2', '②는 회계법인과 의뢰인 모두에게 중요하지 않고 명백하게 경미해야 하는 예외를 충족하지 못하므로 공동사업의 종료·축소 또는 감사 거절이 필요하다고 설명한다.', ['src-cbdae8404682e7ebb9']),
        criterion('sub1.crit4', 'sub1.req3', '③은 낮은 보수 자체가 비윤리적인 것은 아니며 보수 수준과 업무에 따른 위협을 평가하고 보수산정 기준·업무 내용의 고지 또는 적절한 시간·적격한 스태프 투입 등 안전장치를 적용해야 한다고 설명한다.', ['src-7f5576107b198d3b0f', 'src-30bdfbe0bd09bb26a5']),
      ],
    },
    {
      ...baseQuestion,
      id: 'sub2',
      prompt: '감사업무 중 윤리적 요구사항 준수에 관한 ①~④ 중 부적절한 방침을 모두 식별하고, 각 방침이 부적절한 이유 또는 필요한 조치를 간략히 설명하시오.',
      model_answer: [
        '부적절한 방침은 ②, ④이다.',
        '② 위반을 시사하는 사항을 알게 되면 처분 약속만으로 끝낼 수 없고 회계법인 내부의 다른 사람에게 자문하여 적합한 조치를 결정해야 한다. 또한 위반 사실과 독립성 위협을 평가하고 필요한 안전장치 등을 검토해야 한다.',
        '④ 적합한 조치로 문제를 해결할 수 없다면 감사보고서 발행 때까지 기다릴 것이 아니라 회계법인에 신속히 보고해야 한다.',
      ],
      requirements: [
        requirement('sub2.req1', 'src1'),
        requirement('sub2.req2', 'src2'),
      ],
      criteria: [
        criterion('sub2.crit1', 'sub2.req1', '부적절한 방침을 ②·④로 빠짐없이 식별하고 적절한 ①·③을 부적절하다고 선택하지 않는다.', ['src1', 'src2'], 'conclusion'),
        criterion('sub2.crit2', 'sub2.req1', '②는 위반을 시사하는 사항을 알게 된 때 회계법인 내부의 다른 사람에게 자문하여 적합한 조치를 결정하고, 위반 사실과 독립성 위협을 평가해야 한다고 설명한다.', ['src1', 'src2']),
        criterion('sub2.crit3', 'sub2.req2', '④는 적합한 조치로 독립성 문제를 해결할 수 없으면 보고서 발행 때까지 기다리지 말고 회계법인에 신속히 보고해야 한다고 설명한다.', ['src2']),
      ],
    },
    {
      ...baseQuestion,
      id: 'sub3',
      prompt: '업무품질관리검토에 관한 ①~④ 중 부적절한 처리를 모두 식별하고, 각 처리가 부적절한 이유 또는 필요한 수정조치를 간략히 설명하시오.',
      model_answer: [
        '부적절한 처리는 ②, ③이다.',
        '② 감사보고서일은 업무품질관리검토의 실제 종료일보다 앞설 수 없다. 보고서일 후 허용되는 것은 실제 검토와 의견 차이의 해결을 이미 마친 경우의 검토 문서 최종 정리이지, 남은 검토 자체가 아니다.',
        '③ 업무팀과 업무품질관리검토자의 의견 차이는 단순히 기록하는 데 그치지 않고, 이를 처리하고 해결하기 위한 회계법인의 정책과 절차에 따라 해결한 뒤 보고서를 발행해야 한다.',
      ],
      requirements: [
        requirement('sub3.req1', 'src-07f6fdcca61f34837e'),
        requirement('sub3.req2', 'src-ed87eeac932c8cb633'),
        requirement('sub3.req3', 'src-7c7ab629a8dab452d3'),
      ],
      criteria: [
        criterion('sub3.crit1', 'sub3.req1', '부적절한 처리를 ②·③으로 빠짐없이 식별하고 적절한 ①·④를 부적절하다고 선택하지 않는다.', ['src-07f6fdcca61f34837e', 'src-ed87eeac932c8cb633', 'src-7c7ab629a8dab452d3'], 'conclusion'),
        criterion('sub3.crit2', 'sub3.req1', '②는 감사보고서일을 실제 업무품질관리검토 종료일보다 앞서 정할 수 없고 보고서일 후 가능한 문서 정리는 남은 검토의 수행과 다르다고 설명한다.', ['src-07f6fdcca61f34837e', 'src-7c7ab629a8dab452d3']),
        criterion('sub3.crit3', 'sub3.req2', '③은 의견 차이를 단순 기록하는 것으로 부족하고 회계법인의 정책과 절차에 따라 처리하고 해결한 뒤 보고서를 발행해야 한다고 설명한다.', ['src-ed87eeac932c8cb633', 'src-7c7ab629a8dab452d3']),
      ],
    },
  ],
  verification: {
    source_fidelity: 'reconstructed',
    review_status: 'needs_human_review',
    calculation_required: false,
    notes: [
      'pilot-01-005의 ID 계보를 유지하면서 2물음·4점의 단순 판단형을 수임, 업무수행, 보고서일 전 품질검토를 연결한 3물음·10점 종합사례로 전면 대체한 후보본이다.',
      '2027년 CPA 시험 대비 사례로, 20X1년 1월 1일 개시 보고기간과 20X2년 후속업무를 가정한다. 윤리 판단은 2024-12-19 의결 전문(2025-01-01 시행 개정 반영)을, 품질관리는 이 사례에 명시한 종전 KGA 220 체계를 적용한다. 2026년 공개초안 또는 이후 개정안을 확정 기준으로 적용하지 않는다.',
      '기출 반복요소인 감사보수의 자기주식 지급, 양 당사자 중요성에 따른 공동사업, 낮은 보수의 위협·안전장치를 한 수임판단에 통합하고, 고급회계감사연습의 다중 독립 상황 판단 형식을 참고하여 옳은 조치와 부적절한 조치를 함께 제시했다.',
      '각 물음은 부적절한 항목의 정확한 식별 1점과 항목별 이유 또는 수정조치 각 1점으로 구성한다. 발문·사실에는 부적절한 항목의 개수나 정답을 노출하지 않는다.',
    ],
  },
};

const design = {
  version: 1,
  set_id: set.id,
  target_exam_year: 2027,
  replacement_of: { set_id: old.id, prior_questions: old.subquestions.length, prior_points: old.subquestions.flatMap((q) => q.criteria).reduce((sum, c) => sum + c.max_points, 0) },
  case_fact_characters: [...set.shared_context.facts.map((fact) => fact.text).join('\n')].length,
  questions: [
    { subquestion_id: 'sub1', question_style: 'case', topic_ids: ['01'], case_fact_ids: ['f1'], topic_reason: '수임 단계에서 독립성·보수 위협을 사실에 적용한다.', classification_note: '네 가지 제안의 옳고 그름을 비교하는 사례형 판단이다.', points: 4 },
    { subquestion_id: 'sub2', question_style: 'case', topic_ids: ['01'], case_fact_ids: ['f2'], topic_reason: '감사 중 윤리 위반 징후와 독립성 대응을 사실에 적용한다.', classification_note: '네 가지 방침의 옳고 그름을 비교하는 사례형 판단이다.', points: 3 },
    { subquestion_id: 'sub3', question_style: 'case', topic_ids: ['01'], case_fact_ids: ['f3'], topic_reason: '업무품질관리검토의 완료와 의견 차이 해결을 사실에 적용한다.', classification_note: '네 가지 처리의 옳고 그름을 비교하는 사례형 판단이다.', points: 3 },
  ],
  evidence_basis: {
    past_exam_elements: ['ethics.own-share-audit-fee (2020, 2022)', 'ethics.client-material-joint-business (2016, 2024)', 'ethics.low-fee-required-safeguards (2014, 2019)'],
    advanced_practice_pattern: ['2023 GS2-1 물음5', '2024 GS1-1 물음2', '2025 GS1-1 물음3'],
    design_choice: '기출의 반복 핵심은 보존하되 단독 회상형 재현이 아니라 수임부터 보고서일까지의 연속 사례에 적용한다.',
  },
};

const qa = {
  version: 1,
  cases: [
    {
      id: 'pilot-01-005-sub1-partial', subquestion_id: 'sub1', kind: 'partial',
      answer: '부적절한 의견은 ①, ②, ③이다. ①은 회계법인이 감사의뢰인의 주식을 직접 보유하게 되므로 해당 이해관계를 청산해야 한다.', expected_points: 2,
      expected_verdicts: [
        { criterion_id: 'sub1.crit1', verdict: 'met' }, { criterion_id: 'sub1.crit2', verdict: 'met' },
        { criterion_id: 'sub1.crit3', verdict: 'not_met' }, { criterion_id: 'sub1.crit4', verdict: 'not_met' },
      ], reason: '정확한 식별과 주식보수 이유만 충족한다.',
    },
    {
      id: 'pilot-01-005-sub1-wrong', subquestion_id: 'sub1', kind: 'wrong',
      answer: '④만 부적절하다. 낮은 보수는 언제나 감사품질을 떨어뜨리므로 수임할 수 없다.', expected_points: 0,
      expected_verdicts: ['sub1.crit1', 'sub1.crit2', 'sub1.crit3', 'sub1.crit4'].map((criterion_id) => ({ criterion_id, verdict: 'not_met' })), reason: '식별과 이유가 모두 반대이다.',
    },
    {
      id: 'pilot-01-005-sub2-partial', subquestion_id: 'sub2', kind: 'partial',
      answer: '부적절한 방침은 ②와 ④이다.', expected_points: 1,
      expected_verdicts: [
        { criterion_id: 'sub2.crit1', verdict: 'met' }, { criterion_id: 'sub2.crit2', verdict: 'not_met' }, { criterion_id: 'sub2.crit3', verdict: 'not_met' },
      ], reason: '정확한 식별만 충족한다.',
    },
    {
      id: 'pilot-01-005-sub2-wrong', subquestion_id: 'sub2', kind: 'wrong',
      answer: '①과 ③이 부적절하다. 업무수행이사는 독립성 정보를 따로 확인할 필요가 없다.', expected_points: 0,
      expected_verdicts: ['sub2.crit1', 'sub2.crit2', 'sub2.crit3'].map((criterion_id) => ({ criterion_id, verdict: 'not_met' })), reason: '식별과 이유가 모두 반대이다.',
    },
    {
      id: 'pilot-01-005-sub3-partial', subquestion_id: 'sub3', kind: 'partial',
      answer: '부적절한 처리는 ②와 ③이다. 의견 차이는 회계법인의 정책과 절차에 따라 해결해야 한다.', expected_points: 2,
      expected_verdicts: [
        { criterion_id: 'sub3.crit1', verdict: 'met' }, { criterion_id: 'sub3.crit2', verdict: 'not_met' }, { criterion_id: 'sub3.crit3', verdict: 'met' },
      ], reason: '정확한 식별과 의견 차이 이유만 충족한다.',
    },
    {
      id: 'pilot-01-005-sub3-wrong', subquestion_id: 'sub3', kind: 'wrong',
      answer: '①과 ④가 부적절하다. 검토 문서는 모두 감사보고서일 전에 최종 정리되어야 한다.', expected_points: 0,
      expected_verdicts: ['sub3.crit1', 'sub3.crit2', 'sub3.crit3'].map((criterion_id) => ({ criterion_id, verdict: 'not_met' })), reason: '식별과 완료·문서화 구분이 모두 반대이다.',
    },
  ],
};
for (const testCase of qa.cases) {
  testCase.expected_verdicts = testCase.expected_verdicts.map((verdict) => ({
    ...verdict,
    reason: `${testCase.reason} ${verdict.criterion_id}은(는) ${verdict.verdict}로 예상한다.`,
  }));
}

const lineage = {
  version: 1,
  set_id: set.id,
  action: 'replace_existing_set_content',
  preserved: ['set_id', 'topic_id', 'original recurring ethics issues'],
  changed: ['title', 'facts', 'subquestions', 'points', 'learning metadata', 'quality-management coverage'],
  prior_title: old.title,
  new_title: set.title,
  prior_subquestion_ids: old.subquestions.map((q) => q.id),
  new_subquestion_ids: set.subquestions.map((q) => q.id),
  note: 'sub1·sub2는 ID 계보를 유지하되 내용과 rubric을 종합사례에 맞게 대체하고 sub3를 추가한다.',
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, value] of [['sets.json', [set]], ['design.json', design], ['qa.json', qa], ['lineage.json', lineage]]) {
  fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
}
console.log(JSON.stringify({ set_id: set.id, questions: set.subquestions.length, points: set.subquestions.flatMap((q) => q.criteria).reduce((sum, c) => sum + c.max_points, 0), fact_characters: design.case_fact_characters }, null, 2));
