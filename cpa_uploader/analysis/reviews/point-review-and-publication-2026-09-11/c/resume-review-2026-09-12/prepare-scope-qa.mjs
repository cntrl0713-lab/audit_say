import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const D = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const dir = path.dirname(fileURLToPath(import.meta.url));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const oldQAFile = D + '/qa-prepared-v1/pilot-03-001.json';
const oldQA = read(oldQAFile);
const oldQuestionFile = D + '/execution-all-v6/sets/pilot-03-001.json';
const question = read(oldQuestionFile).subquestions.find(row => row.id === 'sub1');
const proposalFile = path.join(dir, 'pilot-03-001-scope-proposal-v2.json');
const proposal = read(proposalFile);
const verdicts = rows => rows.map(([criterion_id, verdict, reason]) => ({ criterion_id, verdict, reason }));
const missing1 = '재무제표 작성 책임을 경영진이 인정·이해함을 확인한다는 요구가 답안에 없다.';
const missing2 = '관련 내부통제 책임을 경영진이 인정·이해함을 확인한다는 요구가 답안에 없다.';
const missing3 = '정보를 제공·확보할 책임을 경영진이 인정·이해함을 확인한다는 요구가 답안에 없다.';
const missing4 = '책임 불인정 시 수임 부적합과 법규상 예외를 설명하지 않았다.';
const fullResponsibilities = '감사인은 경영진이 재무제표 작성, 관련 내부통제, 감사에 필요한 정보의 제공 또는 확보에 대한 책임을 인정하고 이해함을 확인해야 한다.';
const cases = [
  {
    id: 'scope-followup/sub1/premise-capability-only', subquestion_id: 'sub1', kind: 'condition_boundary', target_criterion_id: 'crit3',
    answer: '경영진은 감사에 필요한 정보를 제공하거나 확보할 능력이 있다.', expected_points: 0,
    expected_verdicts: verdicts([['crit1', 'not_met', missing1], ['crit2', 'not_met', missing2], ['crit3', 'not_met', '발문의 능력 전제만 반복했다. 정보를 제공·확보할 책임의 인정·이해를 확인한다는 별도 요구는 없다.'], ['crit4', 'not_met', missing4]]),
    note: '새 발문의 비득점 전제를 되풀이한 사실과 실제 책임 확인을 구별한다. ability가 없다는 반대 사실로 경계를 꾸미지 않는다.',
  },
  {
    id: 'scope-followup/sub1/only-information-responsibility', subquestion_id: 'sub1', kind: 'independent_partial', target_criterion_id: 'crit3',
    answer: '감사인은 경영진이 감사에 필요한 정보를 제공하거나 확보할 책임을 인정하고 이해하고 있음을 확인해야 한다.', expected_points: 1,
    expected_verdicts: verdicts([['crit1', 'not_met', missing1], ['crit2', 'not_met', missing2], ['crit3', 'met', '정보 제공·확보 책임의 인정·이해를 확인하는 행위를 직접 썼다. 능력 전제를 다시 쓰지 않아도 충족한다.'], ['crit4', 'not_met', missing4]]),
    note: '독립적으로 맞는 정보 관련 책임 확인만 1점이다. 세 책임과 수임 판단을 일괄 채점하지 않는다.',
  },
  {
    id: 'scope-followup/sub1/omit-internal-control-responsibility', subquestion_id: 'sub1', kind: 'omission', target_criterion_id: 'crit2',
    answer: '감사인은 경영진이 재무제표 작성과 감사에 필요한 정보 제공·확보에 대한 책임을 인정하고 이해함을 확인해야 한다. 경영진이 자신의 책임을 인정하지 않으면 법규상 강제 수임이 아닌 한 해당 업무를 수임하는 것은 적합하지 않다.', expected_points: 3,
    expected_verdicts: verdicts([['crit1', 'met', '재무제표 작성 책임 인정·이해의 확인이 명시돼 있다.'], ['crit2', 'not_met', missing2], ['crit3', 'met', '정보 제공·확보 책임 인정·이해의 확인이 명시돼 있다.'], ['crit4', 'met', '책임 불인정 시 수임 부적합과 법규상 강제 예외를 직접 설명했다.']]),
    note: '관련 내부통제의 이름이나 책임 확인을 다른 표현으로 남기지 않은 실제 누락이다. 마지막 수임 판단의 일반적 책임 언급만으로 누락된 책임 범주의 식별을 보충하지 않는다.',
  },
  {
    id: 'scope-followup/sub1/implied-inappropriate-with-legal-exception', subquestion_id: 'sub1', kind: 'implication_boundary', target_criterion_id: 'crit4',
    answer: fullResponsibilities + ' 경영진이 책임을 인정하지 않는다면, 법규가 수임을 강제하는 경우에만 이 업무의 수임을 검토할 수 있다.', expected_points: 4,
    expected_verdicts: verdicts([['crit1', 'met', '재무제표 작성 책임 인정·이해의 확인을 직접 요구했다.'], ['crit2', 'met', '관련 내부통제 책임 인정·이해의 확인을 직접 요구했다.'], ['crit3', 'met', '정보 제공·확보 책임 인정·이해의 확인을 직접 요구했다.'], ['crit4', 'met', '법규가 강제하는 경우에만 수임을 검토할 수 있다는 한정은 그렇지 않은 경우에는 수임할 수 없음을 분명히 함축한다. 모든 강제 수임이 무조건 적합하다고 보장하지 않는다.']]),
    note: '부적합이라는 특정 낱말을 반복하지 않아도 비강제 상황의 부적합 판단과 법규상 예외가 한정 관계로 명확하다. 수임 후 설명을 추가로 쓰도록 요구하지 않는다.',
  },
  {
    id: 'scope-followup/sub1/explicit-opposite-accept-without-legal-compulsion', subquestion_id: 'sub1', kind: 'explicit_opposite', target_criterion_id: 'crit4',
    answer: fullResponsibilities + ' 경영진이 책임을 인정하지 않아도 법규상 강제가 아닌 감사업무를 수임하는 데 아무런 문제가 없다.', expected_points: 3,
    expected_verdicts: verdicts([['crit1', 'met', '첫 문장에서 재무제표 작성 책임 확인을 올바르게 요구했다. 수임 적합성에 관한 후행 오류가 이 독립 책임 내용까지 부정하지 않는다.'], ['crit2', 'met', '첫 문장에서 관련 내부통제 책임 확인을 올바르게 요구했다.'], ['crit3', 'met', '첫 문장에서 정보 제공·확보 책임 확인을 올바르게 요구했다.'], ['crit4', 'contradicted', '책임 불인정 상황에서 법규상 강제가 없어도 수임에 문제가 없다고 명시하여 A14의 수임 부적합 결론을 반대로 썼다.']]),
    note: '판단의 명시 반대만 0점이며, 옳게 적은 세 책임을 함께 감점하지 않는다.',
  },
];
const supplemental = {
  version: 1, artifact_type: 'author_expected_judgments', set_id: 'pilot-03-001',
  purpose: 'Root-approved prompt-scope followup supplementary cases; not model output and not yet executed.',
  source_evidence_file: D + '/c/resume-review-2026-09-12/pilot-03-001-scope-proposal-v2.json',
  source_evidence_sha256: sha(fs.readFileSync(proposalFile)),
  original_qa: { file: oldQAFile, sha256: sha(fs.readFileSync(oldQAFile)), preserve_all_ids_answers_expectations: true, total_cases: oldQA.cases.length, sub1_cases: oldQA.cases.filter(row => row.subquestion_id === 'sub1').map(row => ({ id: row.id, expected_points: row.expected_points })) },
  question_proposal: { file: D + '/c/resume-review-2026-09-12/pilot-03-001-scope-proposal-v2.json', before_sha256: sha(fs.readFileSync(oldQuestionFile)), criteria_and_scores_unchanged: true, after_prompt: proposal.changes.find(row => row.artifact === 'question').after },
  api_calls: 0, execution_status: 'prepared_only', cases,
};
const errors = [];
const seen = new Set(oldQA.cases.map(row => row.id));
for (const row of cases) {
  if (seen.has(row.id)) errors.push(row.id + ': duplicate id'); seen.add(row.id);
  if (row.subquestion_id !== 'sub1') errors.push(row.id + ': wrong subquestion');
  if (row.expected_verdicts.length !== question.criteria.length || new Set(row.expected_verdicts.map(item => item.criterion_id)).size !== question.criteria.length) errors.push(row.id + ': incomplete/duplicate verdicts');
  let points = 0;
  for (const judgement of row.expected_verdicts) {
    const criterion = question.criteria.find(item => item.id === judgement.criterion_id);
    if (!criterion || !['met', 'not_met', 'contradicted'].includes(judgement.verdict)) errors.push(row.id + ': invalid verdict');
    else if (judgement.verdict === 'met') points += criterion.scores.met;
    if (!judgement.reason) errors.push(row.id + ': no reason');
  }
  if (points !== row.expected_points) errors.push(row.id + ': point sum mismatch');
}
if (errors.length) throw new Error(JSON.stringify(errors));
const file = path.join(dir, 'pilot-03-001-sub1-qa-supplement.json');
fs.writeFileSync(file, JSON.stringify(supplemental, null, 2) + '\n', { flag: 'wx' });
const validation = {
  version: 1, checked_at: new Date().toISOString(), api_calls: 0,
  supplemental_file: D + '/c/resume-review-2026-09-12/pilot-03-001-sub1-qa-supplement.json', supplemental_sha256: sha(fs.readFileSync(file)),
  checks: ['5 unique supplementary case IDs do not collide with original 15', 'all 4 criteria have independent expected verdicts and reasons', 'integer point sums match declared values 0/1/3/4/3', 'original question, QA and receipt files were not edited', 'the existing sub1 stored-model and blank cases remain in original file'],
  original_qa_sha256: sha(fs.readFileSync(oldQAFile)), expected_points: cases.map(row => ({ id: row.id, expected_points: row.expected_points })), errors,
  interpretation: 'Local case-shape and point arithmetic validation only. It does not establish actual model grading agreement.',
};
fs.writeFileSync(path.join(dir, 'pilot-03-001-sub1-qa-validation.json'), JSON.stringify(validation, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ file: validation.supplemental_file, sha256: validation.supplemental_sha256, proposal_sha256: supplemental.source_evidence_sha256, cases: cases.length, errors }, null, 2));
