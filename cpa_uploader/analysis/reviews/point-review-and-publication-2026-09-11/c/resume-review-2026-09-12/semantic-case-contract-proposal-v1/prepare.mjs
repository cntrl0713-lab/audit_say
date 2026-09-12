import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const output = `${D}/c/resume-review-2026-09-12/semantic-case-contract-proposal-v1`;
const wave = `${D}/execution-resumes/resume-2026-09-12-v3/canary`;
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const descriptor = file => ({ file, sha256: sha(file) });
const write = (name, value) => fs.writeFileSync(`${output}/${name}`, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

const codeFile = 'cpa_uploader/questionSemanticReview.ts';
const beforeCodeFile = `${D}/grading-inference-followup-v2/cpa_uploader__questionSemanticReview.ts.before.txt`;
const code = read(beforeCodeFile);
const before = 'omission/opposite/condition_boundary는 목표 criterion의 필수 요소·조건을 실제로 바꾸는 사례로 설계한다.';
const after = 'omission은 목표 명제를 실제로 빠뜨리되 부정하지 않는 중립적 누락으로 설계한다. 필요한 행위를 하지 않는다고 명시하거나 만·제외 등으로 그 의무를 실제 배제한 답은 목표 명제에 대한 반대이므로 omission/not_met으로 만들지 말고 opposite/contradicted로 구별하며, condition_boundary는 실제 적용을 가르는 조건을 바꾸고 그 조건에서의 필수 요구를 대조한다.';
assert.equal(code.split(before).length - 1, 1);
const semanticFile = `${wave}/semantic-b/pilot-05-003/semantic.json`;
const gradingFile = `${wave}/grading-b/pilot-05-003/grading.json`;
const repeatBase = `${wave}/grading-b/pilot-05-003/diagnostic-repeat-v1`;
const semantic = json(semanticFile).reviews[0];
const original = json(gradingFile).reviews[0].grading;
const runId = '82b6ce497946d74c9be4bc8ebb22811db233e1965fc715b0d820da983df7352e';
const generated = semantic.cases.find(c => c.unit_id === 'criterion:sub2:crit4' && c.kind === 'omission');
const observations = [
  [gradingFile, original],
  [`${repeatBase}/observation-2.json`, json(`${repeatBase}/observation-2.json`)],
  [`${repeatBase}/observation-3.json`, json(`${repeatBase}/observation-3.json`)],
].map(([file, grading], index) => {
  const run = grading.runs.find(r => r.id === runId);
  assert(run);
  const verdicts = run.judgment.subquestions.find(s => s.subquestion_id === 'sub2').verdicts;
  assert.equal(verdicts.find(c => c.criterion_id === 'crit4').verdict, 'contradicted');
  assert.equal(verdicts.find(c => c.criterion_id === 'crit5').verdict, 'met');
  assert.equal(run.answers.sub2, generated.answer);
  assert.equal(run.result.score, 1);
  return { observation: index + 1, ...descriptor(file), run_id: run.id, model: grading.model, transport: grading.transport, answer: run.answers.sub2, original_expected: run.expected, actual_verdicts: verdicts, score: run.result.score, matched: run.matched };
});
const bankFile = `${D}/c/prepared-reviewed-v8/candidate-authoring.json`;
const bank = json(bankFile);
const sets = Array.isArray(bank) ? bank : bank.question_sets;
assert(Array.isArray(sets));
const set = sets.find(s => s.id === 'pilot-05-003');
assert(set);
const sub = set.subquestions.find(s => s.id === 'sub2');
const source = set.source_refs.find(s => s.id === 'src2');
assert(source);
const sourceText = read(source.file);
// Some authoring schemas call the actual excerpt source_quote rather than quote.
const sourceQuote = source.quote ?? source.source_quote;
assert.equal(typeof sourceQuote, 'string');
assert(sourceText.includes(sourceQuote));
const start = sourceText.indexOf(sourceQuote);
const qaFile = `${D}/b/canary-plan-followup-v1/qa-pilot-05-003.json`;
const existingNeutral = json(qaFile).cases.find(c => c.id === 'pilot-05-003-sub2-omit-crit4');
assert(existingNeutral);
const checks = {
  status: 'read_only_proposal_not_applied', api_calls: 0, code_or_bank_writes: 0,
  exact_replacement_occurrences: 1, original_observations_checked: 3,
  same_original_answer_all_three: true, criterion4_all_contradicted: true, criterion5_all_met: true,
  source_quote_exact: true, existing_neutral_qa_found: true,
  new_active_qa_cases: 0, formal_acceptance: false,
};
write('evidence.json', {
  version: 1, reviewed_at: new Date().toISOString(), checks,
  inspected_code: ['cpa_uploader/questionSemanticReview.ts', 'lib/questionV3Grading.ts', 'cpa_uploader/questionReviewGrading.ts', '.agents/skills/audit-question-review/SKILL.md', '.agents/skills/audit-question-review/references/regression-cases.md'].map(descriptor),
  semantic: { ...descriptor(semanticFile), generated_case: generated }, observations,
  direct_basis: { bank: descriptor(bankFile), set_id: set.id, subquestion_id: sub.id, prompt: sub.prompt, criteria: sub.criteria.map(c => ({ id: c.id, claim: c.claim, scores: c.scores })), source_ref: source, source_file: descriptor(source.file), line_start: sourceText.slice(0, start).split('\n').length, line_end: sourceText.slice(0, start + sourceQuote.length).split('\n').length },
  existing_neutral_qa: { ...descriptor(qaFile), case: existingNeutral },
  previous_c_evidence: descriptor(`${D}/c/resume-review-2026-09-12/pilot-03-001-generated-diagnostic-conclusion.json`),
  distinct_issue: { run_id: '1cc4960647948dc8840c062761b9bf45d9ec920e7fa18290b15ed41a0281c2ca', answer: '감사인은 감사 중 식별된 유의적 내부통제 미비점을 지배기구에 서면으로 커뮤니케이션해야 한다.', classification: '명확히 누락된 커뮤니케이션의 적시성을 식별 시점에서 옮겨 인정한 별도 grader 과다 인정 문제. 이번 semantic 사례 종류 수정으로 해결되었다고 주장하지 않는다.' },
});
write('proposal.json', {
  version: 1, status: 'proposal_record_api0_parent_applied_while_preparing', code_file: codeFile, code_sha256_before: sha(beforeCodeFile), before_snapshot: descriptor(beforeCodeFile), parent_after_code: descriptor(codeFile),
  operation: 'replace_exactly_one_sentence_with_two_sentences', before, after,
  preserved_next_sentence: '답안 전체가 남은 이유나 조치로 명제를 충족하면 실제 누락이 아니므로 누락 사례를 다시 설계한다.',
  rationale: '실제 SDK 지침은 omission/opposite/condition_boundary를 한 문장에 묶으며 omission의 중립성과 명시적 요구 부정을 구별하지 않는다. 현재 validator는 omission=not_met/계약상 partial, opposite=contradicted를 요구하므로 생성 단계에서 기존 계약을 명시해야 한다.',
  unchanged_contracts: [
    '기존 다섯 사례 종류와 개수, response schema와 필수 ID 검증을 유지한다.',
    'criterion별 독립 판정과 점수계약을 유지한다. 다른 독립 요구의 오류를 맞는 목표 명제에 전가하지 않는다.',
    '실제 조건·주체·시점을 바꾸는 condition_boundary의 기존 문맥 규칙을 유지한다. 단순 반대 문장을 경계라고 이름만 바꾸지 않는다.',
    'condition_boundary의 not_met/contradicted 영점 비교 허용을 omission까지 확장하지 않는다.',
    '원문·문항·계획·원 receipt·원 기대·원 답안·원시 실측은 덮어쓰지 않는다.',
  ],
  independent_partial_qa_scope: {
    decision: '이미 존재하는 중립 omit-crit4와 B의 원실패 보존 후속 QA를 사용한다. 아래 짧은 대조군은 제안만 두고 활성 QA를 추가하지 않는다.',
    existing_case_id: existingNeutral.id, existing_case_points: existingNeutral.expected_points,
    preserved_original_answer: generated.answer,
    proposed_original_full_verdicts: sub.criteria.map(c => ({ criterion_id: c.id, verdict: c.id === 'crit4' ? 'contradicted' : c.id === 'crit5' ? 'met' : 'not_met' })),
    proposed_original_points: 1,
    optional_unactivated_companion: { answer: '미비점의 잠재적 영향을 설명한다.', expected_verdicts: sub.criteria.map(c => ({ criterion_id: c.id, verdict: c.id === 'crit5' ? 'met' : 'not_met' })), expected_points: 1 },
    rule: '독립 요구 일부가 빠지면 남은 전체 답안으로 각 criterion을 별도로 판단하여 정수 점수를 합산한다. 옛 총점 0이나 하나의 목표 expected를 이웃 criterion에 복사하지 않는다. 기대를 정정할 때 원답안과 원 expected/receipt를 함께 연결한다.',
  },
  validation_recommendation: ['정확 치환 한 번과 다른 코드 불변 확인', 'semantic schema의 기존 다섯 종류/기대 계약 회귀 유지', '원답안을 보존한 반대 사례와 기존 중립 누락 사례를 별도로 검증', '조건 경계/함축 정답의 기존 회귀 보존; 문자열 만의 유무로 판정하는 규칙 추가 금지'],
  execution: { new_api_calls: 0, proposed_code_applied: false, new_receipt_created: false },
});
fs.writeFileSync(`${output}/README.md`, '# 의미검수 합성 사례 계약의 최소 명료화 제안\n\nB의 원 합성 답안은 미비점 내역 제시를 명시적으로 부정한다. 공식 265.11(a), 실제 발문, 독립 crit4/crit5와 세 관측을 대조한 결과 crit4 contradicted·crit5 met, 합계 1점이 타당하다. omission/not_met로 생성한 원 기대의 오류이며, 해당 원답안·receipt·3회 실측을 보존한다.\n\n`proposal.json`은 실제 SDK 지침의 정확한 한 문장을 두 문장으로 바꾸는 제안이다. 코드·은행·활성 QA는 수정하지 않았다. 기존 중립 omit-crit4의 5점 기대를 확인했고, 짧은 중립 대조군은 제안만 남겼다. parent가 관리하는 전체 QA 수를 늘리지 않는다.\n\n조건 경계는 실제 발동 조건을 대조하고, 이웃 명제의 오류를 맞는 목표 명제에 전가하지 않는 현재 계약을 유지한다. 조건 경계에서 허용하는 영점 판정 비교를 omission까지 넓혀 생성 오류를 숨기지 않는다. B의 적시성 과다 인정은 수식어의 행위 귀속을 잘못 읽은 별도 grader 문제다.\n\n`evidence.json`의 해시는 이 읽기 검토 시점의 파일을 가리킨다. API 0회이며 정식 검수 수락·게시 완료를 뜻하지 않는다.\n', { flag: 'wx' });
console.log(JSON.stringify({ checks, outputs: ['proposal.json', 'evidence.json', 'README.md'].map(name => descriptor(`${output}/${name}`)) }, null, 2));
