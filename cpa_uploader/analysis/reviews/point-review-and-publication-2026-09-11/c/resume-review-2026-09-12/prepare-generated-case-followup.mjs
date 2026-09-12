import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const O = path.dirname(fileURLToPath(import.meta.url));
const wave = D + '/execution-resumes/resume-2026-09-12-v2/canary';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const setFile = D + '/a/execution-all-v7/sets/pilot-03-001.json';
const planFile = D + '/prepared-reviewed-v7/pilot-03-001-plan.json';
const receiptFile = wave + '/grading-c/pilot-03-001/grading.json';
const rawFile = receiptFile + '.grading.jsonl';
const set = read(setFile), plan = read(planFile), receipt = read(receiptFile).reviews[0];
const bad = receipt.grading.runs.filter(r => !r.matched);
if (bad.length !== 2) throw new Error('Expected exactly the two observed mismatches');
const exceptionRun = bad.find(r => r.expected.some(e => e.criterion_id === 'crit4'));
const onlyRun = bad.find(r => r.expected.some(e => e.criterion_id === 'crit5'));
const rows = [
  {
    id: 'generated-followup/sub1/legal-exception-without-general-rule', subquestion_id: 'sub1', kind: 'omission', target_criterion_id: 'crit4', answer: exceptionRun.answers.sub1, expected_points: 0,
    expected_verdicts: [
      { criterion_id: 'crit1', verdict: 'not_met', reason: '재무제표 작성 책임의 확인을 제시하지 않았다.' },
      { criterion_id: 'crit2', verdict: 'not_met', reason: '관련 내부통제 책임의 확인을 제시하지 않았다.' },
      { criterion_id: 'crit3', verdict: 'not_met', reason: '정보 제공·확보 책임의 확인을 제시하지 않았다.' },
      { criterion_id: 'crit4', verdict: 'not_met', reason: '강제 수임일 때 이 사유만으로 부적합이라 하지 않는다는 예외만 제시했다. 법규상 강제가 없는 경우의 수임 부적합을 명시하거나 필연적으로 함축하지 않아 현재 조건부 판단의 전체 요구를 충족하지 않는다. 예외 설명 자체는 반대가 아니다.' },
    ],
    origin: { receipt_file: receiptFile, receipt_sha256: sha(receiptFile), run_id: exceptionRun.id, original_expectations: exceptionRun.expected, original_answer_preserved: true },
    note: '조건부 일반 규칙과 그 규칙의 예외만 제시하는 답안을 구별한다. 원 모델의 met 기대를 덮어쓰지 않는 별도 직접근거 후속 제안이다.',
  },
  {
    id: 'generated-followup/sub2/exclusive-implications-not-neutral-omission', subquestion_id: 'sub2', kind: 'explicit_opposite', target_criterion_id: 'crit5', answer: onlyRun.answers.sub2, expected_points: 1,
    expected_verdicts: [
      { criterion_id: 'crit5', verdict: 'contradicted', reason: '두 고려사항을 묻는 발문에서 범위제한의 시사점만 평가한다고 범위를 배타적으로 한정하여, 별도로 필요한 변경 요청의 정당성 고려를 배제했다. 이는 언급이 없는 중립적 누락과 다르다.' },
      { criterion_id: 'crit6', verdict: 'met', reason: '범위제한이 발생할 때 그 시사점을 평가한다고 올바르게 제시했다. 다른 독립 요구를 배제한 오류가 이 올바른 내용까지 소거하지 않는다.' },
    ],
    origin: { receipt_file: receiptFile, receipt_sha256: sha(receiptFile), run_id: onlyRun.id, original_expectations: onlyRun.expected, original_answer_preserved: true },
    note: '만이라는 글자를 기계적으로 감점하지 않고, 전체 문장에서 무엇을 배제하는지 판단한다. 이 원답안에서는 유일 평가대상을 범위제한 시사점으로 한정한다.',
  },
];
const supplements = { version: 1, artifact_type: 'author_expected_judgments', set_id: set.id, status: 'proposed_after_direct_source_review_before_repeat_diagnostics', api_calls: 0, cases: rows };
const interpretations = {
  purpose: '후속 의미검수의 사례 설계·대조 범위를 명료화한다. 학생 채점의 원 criterion·점수·모범답안·질문은 변경하지 않는다.',
  principles: [
    '조건부 일반 판단과 예외만 서술한 답안을 구별한다. 예외가 참이라는 설명만으로 예외가 아닌 모든 경우의 결론이 논리적으로 도출되지는 않는다. 반면 예외인 경우에만 해당 행위가 가능하다는 배타적 한정은 그 밖의 경우 불가를 분명히 함축할 수 있으므로 전체 답안의 관계로 판단한다.',
    '누락 사례는 해당 독립 요구를 실제로 말하지 않은 답이어야 한다. 다른 요구만 수행한다고 배타적으로 한정하거나 이 요구는 필요 없다고 명시한 답을 중립적 누락으로 분류하지 않는다. 단순히 특정 낱말이 있다는 이유가 아니라 주체·행위·대상·시점과 전체 문장의 배제 범위를 대조한다.',
    '독립된 이웃 요구가 올바르면 그 점수는 유지한다. 한 요구를 배제한 오류를 다른 요구로 전파하지 않는다. 원생성 기대와 실제 채점의 불일치는 보존하며 별도 직접근거 후속안으로만 다룬다.',
  ],
  set_specific_application: [
    'sub1/crit4는 경영진 책임 불인정 시 법규상 강제가 없는 경우 수임 부적합이라는 조건부 판단이다. 강제인 경우의 예외만 서술한 답은 이 일반 판단을 모두 제시한 것과 같지 않다. 수임 후 경영진 통지는 여전히 범위 밖이다.',
    'sub2/crit5의 변경 요청 정당성 고려와 crit6의 범위제한 시사점 고려는 독립 요구이다. 두 번째만 평가한다고 첫 번째를 배제한 답과, 첫 번째를 단지 언급하지 않은 답은 구별한다.',
  ],
  source_evidence: [
    { source_ref_id: 'src10', paragraph: 'KGA 210.A14', file: set.source_refs.find(r => r.id === 'src10').file, locator: set.source_refs.find(r => r.id === 'src10').source_span, explanation: '법규에서 강제하지 않는 한 수임 부적합이라는 원 규칙과 강제 시 후속 설명을 구별한다.' },
    { source_ref_id: 'src13', paragraph: 'KGA 210.A31', file: set.source_refs.find(r => r.id === 'src13').file, locator: set.source_refs.find(r => r.id === 'src13').source_span, explanation: '변경 요청의 정당성, 특히 범위제한의 시사점을 고려한다. 두 번째로 첫 번째를 대체한다고 하지 않는다.' },
  ],
};
const proposal = {
  version: 1, prepared_at: new Date().toISOString(), status: 'local_proposal_not_activated', api_calls: 0, set_id: set.id,
  changes: [{ artifact: 'plan', file: planFile, before_sha256: sha(planFile), field: 'metadata.semantic_case_interpretation_followup', before_exists: Object.hasOwn(plan.metadata, 'semantic_case_interpretation_followup'), before: plan.metadata.semantic_case_interpretation_followup ?? null, after: interpretations }],
  original_observations: { receipt_file: receiptFile, receipt_sha256: sha(receiptFile), raw_file: rawFile, raw_sha256: sha(rawFile), model: receipt.grading.model, original_nonpass_run_ids: bad.map(r => r.id), original_target_expectations_preserved: bad.map(r => ({ run_id: r.id, expected: r.expected })), repetition_status: 'one initial observation each; additional two same-answer runs await the root-approved common helper' },
  proposed_counterexample_qa: { file: D + '/c/resume-review-2026-09-12/pilot-03-001-generated-counterexamples-proposed.json', cases: 2, original_answers_unchanged: true, expected_values_reviewed_directly: true, original_receipt_not_modified: true },
  positive_controls: [
    { qa_id: 'current/sub1/stored-model', expected_points: 4, reason: '기본 규칙과 법규 예외를 모두 포함하며 실제 작성자 QA 일치.' },
    { qa_id: 'scope-followup/sub1/implied-inappropriate-with-legal-exception', expected_points: 4, reason: '법규가 수임을 강제하는 경우에만 검토 가능하다는 한정이 비강제 상황의 부적합을 함축한다. 실제 작성자 QA 일치.' },
    { qa_id: 'pilot-03-001-sub2-omit-crit5', expected_points: 1, reason: '정당성 고려를 단순히 누락한 답은 범위제한 시사점 1점을 얻는다. 실제 작성자 QA 일치.' },
  ],
  fixed_bank_change: false, fixed_criterion_change: false, fixed_grader_change: false,
  followup_validation: '원 불일치 답안 총3관측을 먼저 보존한다. 총괄이 제안을 읽고 새 계획 선택을 고정하면 해당 계획의 후속 실제 의미검수를 실시한다. 새 생성 사례가 원 반례를 포함하지 않더라도 이 두 원답안을 별도 QA로 계속 보존·실측한다. 과거 receipt나 기대값을 갱신하지 않는다. 새 계획 메타데이터만으로 기존 모델 pass/채점 mismatch를 자동 승계하지 않는다.',
};
const errors = [];
for (const row of rows) {
  const q = set.subquestions.find(q => q.id === row.subquestion_id);
  if (row.expected_verdicts.length !== q.criteria.length) errors.push(row.id + ': incomplete criteria');
  const points = row.expected_verdicts.reduce((n, e) => n + (e.verdict === 'met' ? q.criteria.find(c => c.id === e.criterion_id).scores.met : 0), 0);
  if (points !== row.expected_points) errors.push(row.id + ': point sum');
}
if (errors.length) throw new Error(JSON.stringify(errors));
fs.writeFileSync(path.join(O, 'pilot-03-001-generated-counterexamples-proposed.json'), JSON.stringify(supplements, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(O, 'pilot-03-001-generated-case-plan-proposal.json'), JSON.stringify(proposal, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ proposal_sha256: sha(path.join(O, 'pilot-03-001-generated-case-plan-proposal.json')), qa_sha256: sha(path.join(O, 'pilot-03-001-generated-counterexamples-proposed.json')), cases: rows.length, errors }, null, 2));
