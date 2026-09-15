// 이 회차에서 실제 대조한 내용과 실행 전 기대값을 기록한다. 기존 기록은 덮어쓰지 않는다.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
const D = 'cpa_uploader/drafts/case-review-2026-09-15/r03-payroll-service-merge';
const R = 'cpa_uploader/analysis/reviews/case-review-2026-09-15/r03';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const bank = read(BANK), [set] = read(`${D}/sets.json`);
const originals = bank.filter(s => ['pilot-13-011', 'case-13-type2-period-exceptions-20260914'].includes(s.id));
assert.equal(originals.length, 2);
fs.mkdirSync(R, { recursive: true });
write(`${D}/original-sets.json`, originals);
const edition = '대상은 2027년 시험 대비이며 기존 작업의 2026 시행 기준 적용 가정을 이어받는다. 2026 전문 KGA 402 문단 6은 2026-01-01 이후 개시 보고기간 시행이다. 공식 최종 시험범위 공고를 확보한 것으로 기록하지 않는다. 문단 17·18·A32~A34·A38·A40의 본문을 2025 등록 전사와 2026 전문에서 직접 대조하여 이 사례의 정답·조건에 차이가 없음을 확인했다.';
const sourceFiles = [
  ['cpa_uploader/data/official/delegated-s03-kga-2025.txt', 'cpa_uploader/raw/materials/official/cc98d534ed8a81cd/delegated-s03-kga-2025.txt'],
  ['cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt', 'cpa_uploader/raw/materials/verification/f0914795b909ea38/kga-2026-pymupdf-pages.txt'],
].map(([file, archived]) => { assert.equal(identity(file).sha256, identity(archived).sha256); return { registered: identity(file), raw: identity(archived) }; });
const items = [
  { no: '①', fact_id: 'fact3', verdict: 'correct', basis: 'KGA 402.17(b). 급여액·지급대상에 영향을 주는 명부 대조·퇴직자 검토의 관련성 결정은 적절하다.', source_refs: ['kga402-17'] },
  { no: '②', fact_id: 'fact3', verdict: 'incorrect', basis: 'KGA 402.18·A40. 급여 산정에 쓰이는 다온의 변환업무는 감사와 관련된다. 보고서 제외 범위를 이용자기업 감사범위로 옮길 수 없다.', source_refs: ['kga402-18', 'kga402-A40'] },
  { no: '③', fact_id: 'fact3', verdict: 'correct', basis: 'KGA 402.17(b). 규정을 설계 이해의 자료로 쓰는 것은 적절하다. 이 항목은 실행이나 운영효과성까지 입증했다고 말하지 않는다.', source_refs: ['kga402-17'] },
  { no: '④', fact_id: 'fact3', verdict: 'incorrect', basis: 'KGA 402.17(b). 이용자기업 통제의 실행 이해와 운영효과성 테스트는 별도로 필요하다. 규정과 서비스조직 보고서로 이용자기업의 당기 운영효과성을 대체 입증할 수 없다.', source_refs: ['kga402-17'] },
  { no: '⑤', fact_id: 'fact5', verdict: 'incorrect', basis: 'KGA 402.17(a)·(c)·A32. 1~9월에 한정된 기술과 테스트를 12월까지의 운영을 입증하는 증거로 처리할 수 없다.', source_refs: ['kga402-17', 'kga402-A32'] },
  { no: '⑥', fact_id: 'fact5', verdict: 'incorrect', basis: 'KGA 402.A33·A34. 동일 인원이어도 변경된 시스템과 승인절차는 통제 변경이며 추가 증거 범위 결정에 고려한다. 모든 가능한 추가절차를 수행하는 의무로 확대하지 않는다.', source_refs: ['kga402-A33', 'kga402-A34'] },
  { no: '⑦', fact_id: 'fact5', verdict: 'correct', basis: 'KGA 402.A38. 서비스조직의 승인을 거쳐 예외와 테스트 범위·결과를 서비스감사인과 논의할 수 있다. 보고서가 이미 발행되었다고 논의가 금지되지 않는다. 논의만으로 모든 증거가 충족된다고 하지 않는다.', source_refs: ['kga402-A38'] },
  { no: '⑧', fact_id: 'fact5', verdict: 'incorrect', basis: 'KGA 402.17(d)·A38. 예외는 통제테스트 평가의 고려사항이다. 예외의 기재만으로 보고서 전체를 자동 배제하는 처리는 잘못이다. 무조건 의존하라는 반대 결론도 정답이 아니다.', source_refs: ['kga402-17', 'kga402-A38'] },
];
const questions = [
  { subquestion_id: 'sub1', question_style: 'case', type: 'judgment', topic_ids: ['13', '06', '07'], case_fact_ids: ['fact1', 'fact2', 'fact3'],
    topic_reason: '13: 관련 하위서비스 및 보충통제. 06: 관련성·설계와 실행 이해. 07: 이용자기업 통제의 운영효과성 테스트.',
    objective: '보고서 범위와 이용자기업 감사범위를 구분하고, 통제 설계의 자료와 실제 운영효과성 증거를 구분한다.',
    minimum_sufficient_answer: '②·④를 식별하고, ② 관련 하위서비스도 검토해야 함, ④ 규정·새롬 보고서가 온유회사 통제 운영을 대신 입증하지 못함을 간략히 쓴다.',
    point_decision: '원 30번 2물음·6점을 1물음·3점으로 조정. 관련성·설계는 옳은 항목 ①·③으로 전환한다. 하위서비스 검토의 판단·근거는 ②에 이유 또는 절차 한 가지로 1점, 실제 실행·운영효과성 입증 요구는 ④의 증거 대체 오류 하나로 1점을 둔다. 독립적으로 세부절차를 모두 써야 하던 요구를 줄이고 식별 1점을 별도로 둔다. 세트 상한에 맞춘 축소가 아니다.',
  },
  { subquestion_id: 'sub2', question_style: 'case', type: 'judgment', topic_ids: ['13', '07'], case_fact_ids: ['fact1', 'fact4', 'fact5'],
    topic_reason: '13: 유형 2 보고서의 이용과 예외. 07: 대상기간·변경된 승인통제의 추가 증거 판단.',
    objective: '보고서의 대상기간, 통제 변경, 예외의 영향을 구별해 증거를 평가한다.',
    minimum_sufficient_answer: '⑤·⑥·⑧을 식별하고, 기간이 1~9월임·시스템/승인절차 변경도 고려함·예외만으로 자동 배제 불가를 간략히 쓴다.',
    point_decision: '원 59번 3물음·6점을 1물음·4점으로 조정. 세 오류를 각 1점(이유 또는 절차)으로 평가하고 식별 1점을 둔다. ⑤는 대상기간, ⑥은 변경을 고려한 증거 범위 결정으로 구분하므로 같은 기간 부족을 두 번 배점하지 않는다. 문항의 구체적 검사방법 요구를 없앤다. r01 v3·r02와 같은 선택형 배점 원칙이다.',
  },
].map(row => ({ ...row, criteria: set.subquestions.find(q => q.id === row.subquestion_id).criteria.map(c => ({ id: c.id, points: c.max_points, meaning: c.claim })) }));
const mapping = [
  ['pilot-13-011', 'sub2', ['sub2.crit1', 'sub2.crit2'], '② / sub1.c2', 'merge', '제외 불가 판단과 402 적용 요구를 하나의 이유 또는 절차 항목으로 통합.'],
  ['pilot-13-011', 'exp1', ['exp1.c1'], '① / sub1.c1 식별', 'correct_item', '보충통제 관련성 결정은 옳은 항목으로 승계.'],
  ['pilot-13-011', 'exp1', ['exp1.c2'], '③ / sub1.c1 식별', 'correct_item', '규정을 활용한 설계 이해로 승계. 운영효과성과 구분.'],
  ['pilot-13-011', 'exp1', ['exp1.c3', 'exp1.c4'], '④ / sub1.c3', 'merge', '실제 실행·운영 입증을 규정과 서비스조직 보고서로 대체하는 한 오류로 통합. 월별 검사 등 세부 나열을 요구하지 않음.'],
  ['case-13-type2-period-exceptions-20260914', 'sub1', ['sub1.c1', 'sub1.c2'], '⑤ / sub2.c2', 'merge', '기간 한계를 이유 또는 절차 한 가지로 평가.'],
  ['case-13-type2-period-exceptions-20260914', 'sub2', ['sub2.c1', 'sub2.c2'], '⑥ / sub2.c3', 'merge', '변경 고려와 변경 후 추가 통제증거를 대안 인정. 구체적 테스트방법의 별도 의무를 제거.'],
  ['case-13-type2-period-exceptions-20260914', 'sub3', ['sub3.c1', 'sub3.c2'], '⑧ / sub2.c4', 'merge', '자동 배제 불가 또는 예외 영향 평가 중 한 가지로 인정.'],
].map(([set_id, subquestion_id, criterion_ids, to, disposition, reason]) => ({ from: { set_id, subquestion_id, criterion_ids }, to, disposition, reason }));
for (const s of originals) for (const q of s.subquestions) for (const c of q.criteria) assert.equal(mapping.filter(m => m.from.set_id === s.id && m.from.subquestion_id === q.id && m.from.criterion_ids.includes(c.id)).length, 1, `lineage ${s.id}/${c.id}`);
write(`${D}/lineage.json`, { version: 1, artifact_type: 'case_merge_lineage', created_at: new Date().toISOString(), source_bank: identity(BANK), snapshot: identity(`${D}/original-sets.json`),
  sources: originals.map(s => ({ set_id: s.id, title: s.title, reviewed_content_sha256: reviewedContentHash(s), points: s.subquestions.flatMap(q => q.criteria).reduce((n,c) => n+c.max_points,0) })),
  target: { set_id: set.id, reviewed_content_sha256: reviewedContentHash(set), points: 7 }, mapping,
  new_elements: ['sub1.c1·sub2.c1: 옳지 않은 항목 전체를 정확히 식별하면 물음별 1점', '⑦: KGA 402.A38상 허용되는 논의 요청을 옳은 항목으로 추가. 별도 설명점수 없음.'],
  changed_facts: ['이용자기업 온유·서비스조직 새롬·하위서비스조직 다온으로 통일. 원 59의 다온은 이용자기업이었으므로 역할 혼동 제거.', '원 30의 연간 보고서와 원 59의 1~9월 보고서를 1~9월로 통일.', '원 59의 하위서비스 없음·보충통제 문제 없음 전제를 제거하여 원 30의 검토 대상과 결합.', '확인되지 않은 후임자·미입수 기록 목록 대신 후임자 배정 사실과 감사팀이 근거로 사용한 자료를 제시.'],
  retirement: { requested: '사용자 지정 두 사례의 병합', active_release_exclusion: 'not_performed', reason: '기존 결정에 따라 지정 검토를 모아 운영 반영. 현재 원 세트와 원 제출·receipt는 보존.' } });
write(`${D}/design.json`, { version: 1, set_id: set.id, mode: 'adapt_existing_question', route: '지정 사례 병합 수정 및 새 사실·발문 제작',
  user_requests: ['59·30 두 문제를 통합하고 옳고 그름을 판단하는 물음들로 대체한다.', '스포일러 제거, 여러 절차 중 옳지 않은 항목 선택 및 간략한 이유, 상대 연도 사용, 지정 사례만 수정.'],
  scope: { actors: ['온유(이용자기업)', '새롬(서비스조직)', '다온(하위서비스조직)', '새길회계법인', '서비스감사인'], timing: ['20X1년 연간 감사', '보고서 1~9월', '10월 변경·10~12월 잔여기간'], exclusions: ['유형 1 보고서와의 일반 비교', '감사의견 선택', '미비점 통지', '구체적인 추가 통제테스트의 나열'] },
  items, questions, edition, source_files: sourceFiles, source_scope: '등록 전사의 7개 exact 발췌. 2026 전문 KGA 402 363·367·377~379쪽의 본문·하위 항목·페이지 경계를 대조. 새 공식 원자료 수집은 없음.',
  spoiler_review: ['제목을 중립화하고 팀원의 틀린 주장과 답안 구성요소를 열거한 발문을 제거.', '사실은 거래흐름·보고범위·통제규정·인사와 시스템 변경·예외의 객관적 기재로 제시.', '절차 항목에 정답인 이유를 덧붙이지 않음. 보고서 발행 후의 ⑦은 ⑤·⑥·⑧의 평가 결과나 보완 답안을 주지 않음.', '③은 규정의 제한된 활용으로 옳다. 실행·운영효과성을 인정했다고 확대하여 오답 처리하지 않는다.', '옳지 않은 항목은 물음 1 두 개, 물음 2 세 개이나 발문에는 수를 밝히지 않는다.'],
  nonduplication: ['pilot-13-006: 서비스 이해와 부족시 절차의 일반 열거. 새 사례 적용과 요구가 다름.', 'pilot-13-007: 유형 1 보고서의 증거 한계 사례. 이번 수정 대상이 아니며 바꾸지 않음.', 'std-points-20260914-31ae55b0b72f·045726cceb66: 402.17의 일반 절차 열거. 동일 근거이나 새 사례의 사실·절차판단과 다른 학습 유형.', '원 59·30은 병합 대체 대상으로 계보 보존. r01·r02는 그룹감사·기타정보이므로 중복 없음.'],
  target_reviewed_content_sha256: reviewedContentHash(set), unresolved_content_findings: [] });
const v = (criterion_id, verdict, reason) => ({ criterion_id, verdict, reason });
const expected = (qid, states, reasons) => set.subquestions.find(q => q.id === qid).criteria.map((c,i) => v(c.id, states[i], reasons[i]));
const qa = { version: 1, set_id: set.id, method: 'author_expected_verdicts_before_model_grading', human_review_performed: false,
  note: '모범답안은 model_answer.join(newline) 바이트 그대로 실제 실행. 대표 분모는 물음별 3답안씩 6개. 보조는 별도 2답안. ±1점 허용이나 모범·기대값의 내용 결함은 허용하지 않음.',
  cases: [
    { id: 'r03-sub1-partial', set_id: set.id, subquestion_id: 'sub1', kind: 'partial', answer: '②, ④', expected_points: 1,
      expected_verdicts: expected('sub1',['met','not_met','not_met'],['두 오류만 모두 식별.', '이유나 보완절차 없음.', '이유나 보완절차 없음.']), reason: '번호만 쓴 답의 식별 1점과 설명 0점 확인.' },
    { id: 'r03-sub1-wrong', set_id: set.id, subquestion_id: 'sub1', kind: 'wrong', answer: '옳지 않은 것은 ①과 ③이다. 온유회사의 통제는 감사와 관련이 없고 규정은 설계를 이해하는 자료로도 쓸 수 없다. ②와 ④는 적절하다.', expected_points: 0,
      expected_verdicts: expected('sub1',['contradicted','contradicted','contradicted'],['옳은 항목만 고름.', '② 적절 명시.', '④ 적절 명시.']), reason: '함정만 선택하고 실제 오류는 적절하다고 한 0점 경계.' },
    { id: 'r03-sub2-partial', set_id: set.id, subquestion_id: 'sub2', kind: 'partial', answer: '옳지 않은 것은 ⑤, ⑦, ⑧이다. ⑤ 보고서 대상은 1~9월이라 10~12월의 운영까지 입증하지 못한다. ⑦ 보고서 발행 후에는 서비스감사인과 논의할 수 없다. ⑧ 예외가 있다는 이유만으로 보고서 전체를 쓸모없다고 할 수는 없다.', expected_points: 2,
      expected_verdicts: expected('sub2',['contradicted','met','not_met','met'],['옳은 ⑦ 선택과 ⑥ 누락.', '기간 한계 이유.', '변경에 관한 답 없음.', '자동 배제 불가 이유.']), reason: '오선택·누락은 식별점수를 잃지만 독립적으로 맞힌 ⑤·⑧ 이유는 유지.' },
    { id: 'r03-sub2-wrong', set_id: set.id, subquestion_id: 'sub2', kind: 'wrong', answer: '옳지 않은 것은 ⑦이다. 보고서가 발행되면 논의를 요청할 수 없다. ⑤, ⑥, ⑧은 모두 적절하다.', expected_points: 0,
      expected_verdicts: expected('sub2',['contradicted','contradicted','contradicted','contradicted'],['함정만 선택.', '⑤ 적절 명시.', '⑥ 적절 명시.', '⑧ 적절 명시.']), reason: '0점 오답과 정상 학생 서술의 보안 오탐 확인.' },
  ],
  supplementary_cases: [{ id: 'r03-supp-reason-or-procedure', purpose: '번호 없이 이유로 특정한 답과 보완절차만 간략히 쓴 답의 만점 확인',
    answers: { sub1: '다온을 검토대상에서 제외한 처리는 잘못이다. 그 변환업무가 온유회사의 급여 산정과 관련되기 때문이다. 온유회사 통제가 당기 내내 효과적이었다는 결론도 잘못이다. 검토규정과 새롬의 보고서만으로 온유회사 통제의 실제 운영을 입증하지 못하기 때문이다.',
      sub2: '⑤, ⑥, ⑧이 옳지 않다. ⑤ 10~12월에 관한 추가 증거를 입수해야 한다. ⑥ 변경된 승인통제를 고려해 필요한 증거의 범위를 정해야 한다. ⑧ 온유회사 급여 승인통제에 대한 예외의 영향을 평가해야 한다.' },
    expected: { sub1: { expected_points: 3, expected_verdicts: expected('sub1',['met','met','met'],['내용으로 ②·④만 특정.', '관련성 이유.', '증거 대체 불가 이유.']) },
      sub2: { expected_points: 4, expected_verdicts: expected('sub2',['met','met','met','met'],['⑤·⑥·⑧ 정확히 식별.', '잔여기간 증거 절차.', '변경 고려 절차.', '예외 영향 평가 절차.']) } } }],
  semantic_boundaries_reviewed: [
    '각 식별 기준: 모든 번호만 정확히 기재=1점; 내용으로 특정·함축 판단도 인정; 누락·옳은 항목 오선택=0점.',
    'sub1.c2: 다온에도 감사기준 적용 또는 관련 서비스라 제외 불가=1점; 다온은 제외해도 됨=0점; 관련성 없는 다른 하위서비스까지 전부 동일 절차를 요구하지 않음.',
    'sub1.c3: 규정·서비스보고서로 온유의 운영 입증 불가 또는 보충통제 운영테스트=1점; 단지 규정을 읽는다거나 명칭만 나열=0점.',
    'sub2.c2: 1~9월로 10~12월까지 입증 불가 또는 잔여기간 증거 확보=1점; 유형 2 명칭만으로 연간 입증=0점.',
    'sub2.c3: 인원이 같아도 시스템·절차 변경 고려 또는 변경 후 통제증거 결정=1점; ⑤의 기간 한계만 반복=0점.',
    'sub2.c4: 자동 전체 배제 불가 또는 예외 영향 평가=1점; 예외 무시·자동 전부 배제=0점.',
    '모범답안 전 criterion 충족. 반대 판단은 해당 항목 미득점. 다른 항목의 독립 정답은 유지. 모든 빈 답안은 0점이며 사전 실행에서 모델 호출 없는 경로를 검사.',
  ],
};
write(`${D}/qa.json`, qa);
const checks = { source:'pass', answer:'pass', prompt:'pass', points:'pass', style:'pass', topics:'pass', edition:'pass', nonduplication:'pass' };
write(`${R}/root-content-review-v1.json`, { version: 1, method: 'agent_content_review', reviewer_id: 'agent:/root (Codex; author content review; no independent peer review)', human_review_performed: false, reviewed_at: new Date().toISOString(),
  target: { ...identity(`${D}/sets.json`), set_id: set.id, reviewed_content_sha256: reviewedContentHash(set) },
  evidence: [`${D}/design.json`, `${D}/lineage.json`, `${D}/qa.json`, ...sourceFiles.flatMap(s => [s.registered.file, s.raw.file])],
  questions: questions.map(q => ({ set_id: set.id, subquestion_id: q.subquestion_id, checks,
    rationale: `${q.objective} ${items.filter(i => q.subquestion_id === 'sub1' ? ['①','②','③','④'].includes(i.no) : ['⑤','⑥','⑦','⑧'].includes(i.no)).map(i => `${i.no}: ${i.basis}`).join(' ')} ${q.point_decision}`,
    check_rationales: { source: '7개 직접 인용의 전체 본문·하위항목·판본을 대조하고 raw 동일 해시 확인. 근거 유형은 기준서 조건에 대한 사례 적용이며 근거가 부족한 작성자 추론 없음.', answer: '모범·대표·보조·의미 경계 기대값을 실행 전에 대조. 근거 또는 절차 한 가지만 인정. 실제 답안에 없는 내용은 추정하지 않음.', prompt: '범위와 번호·간략한 이유/절차 요구만 명시. 해답 구성요소나 오류 수를 알려주지 않음.', points: q.point_decision, style: '부모의 급여흐름·대상기간·변경과 개별 절차를 읽어야 같은 답안으로 만점 가능.', topics: q.topic_reason, edition, nonduplication: '원 59·30의 병합 대체. 비교한 일반 KGA402 물음의 출처 공유를 신규성·미출제 주장으로 이용하지 않음.' }, unresolved_content_findings: [] })),
  unresolved_content_findings: [], observations_not_blocking: ['최종 2027 시험 적용 공고 확보 여부는 기존 가정으로 분리.', '정본·공개본·운영 DB 및 원 세트 퇴역은 미실행.'] });
console.log({ reviewed_set: set.id, criteria: set.subquestions.flatMap(q=>q.criteria).length, original_criteria_mapped: 12, qa_cases: qa.cases.length });
