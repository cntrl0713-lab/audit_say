import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {selectLearningQuestionSet, learningUnitId} from '../../../../../lib/learningUnits.ts';
import {computeSubquestionMaxPoints} from '../../../../../lib/questionV3.ts';
import {CONTENT_CHECKS, EFFICIENT_RUNTIME_FILES} from '../../../../questionEfficientReview.ts';
import {reviewedContentHash} from '../../../../questionReviewIdentity.ts';
import {validateAuthoringBank} from '../../../../questionBankPublication.ts';
import {validateQaBank} from './representative-qa.mjs';

const R = 'cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const D = 'cpa_uploader/drafts/case-trio-2026-09-14';
const read = file => JSON.parse(fs.readFileSync(file));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ref = file => ({file, sha256: hash(fs.readFileSync(file))});
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const sorted = values => [...values].sort();
assert.equal(process.argv.length, 2, 'No arguments; inputs and execution-v1 are explicit batch files');

const bankFile = R + '/candidate-v1.json', catalogFile = R + '/catalog-v1.json';
const bank = read(bankFile), catalog = read(catalogFile), ids = read(R + '/changed-sets-v1.json');
const target = ids.map(id => bank.find(set => set.id === id));
assert.equal(new Set(ids).size, 3, 'User requested exactly three new case sets');
assert.equal(ids.length, 3); assert(target.every(Boolean));
assert.deepEqual(validateAuthoringBank(bank).errors, []);
assert.equal(catalog.source_file_sha256, ref(bankFile).sha256, 'Catalog must describe exact candidate bytes');
const baseline = read(R + '/integration-baseline/bank.json');
for (const set of target) {
  assert(!baseline.some(old => old.id === set.id), 'This batch only adds new IDs: ' + set.id);
  assert.equal(set.status, 'needs_review');
  assert.equal(set.verification.review_status, 'needs_human_review');
  assert.equal(set.subquestions.length, 3, 'Exactly three case questions per new case');
  assert([...set.shared_context.facts.map(fact => fact.text).join('\n')].length >= 400, 'Minimum case facts length');
  assert(set.subquestions.every(question => question.question_style === 'case' && question.topic_ids.length > 0));
}
assert.equal(bank.length, baseline.length + target.length, 'Candidate must contain baseline plus three new cases');
for (const old of baseline) assert.deepEqual(bank.find(set => set.id === old.id), old, 'Unrelated bank content changed');

const policyInput = read(R + '/policy-input.json');
if (policyInput.budget_enforcement === 'not_specified') assert.equal(policyInput.budget_usd, null);
else {
  assert.equal(policyInput.budget_enforcement, 'provider_limit');
  assert(typeof policyInput.budget_usd === 'number' && Number.isFinite(policyInput.budget_usd) && policyInput.budget_usd > 0);
}
const qaFile = R + '/case-qa.json', qa = read(qaFile), authorReviews = read(R + '/case-reviews.json');
const representativeScope = validateQaBank(target, qa);
assert.deepEqual(read(R + '/representative-scope-check.json'), representativeScope, 'Integrated representative scope changed');
const rootFile = R + '/root-content-review.json', rootReview = read(rootFile);
assert.equal(rootReview.method, 'agent_content_review');
assert.equal(rootReview.human_review_performed, false);
assert(rootReview.reviewer_id?.trim()); assert(!Number.isNaN(Date.parse(rootReview.reviewed_at)));
assert.deepEqual(rootReview.unresolved_content_findings, []);
const requiredKeys = target.flatMap(set => set.subquestions.map(question => set.id + '/' + question.id));
assert.deepEqual(sorted(rootReview.questions.map(question => question.set_id + '/' + question.subquestion_id)), sorted(requiredKeys), 'Root review must explicitly cover all 9 questions once');
assert.deepEqual(sorted(authorReviews.map(question => question.set_id + '/' + question.subquestion_id)), sorted(requiredKeys), 'Author review must cover all 9 questions once');
for (const question of rootReview.questions) {
  assert(question.rationale?.trim(), 'Root must record an actual content comparison rationale');
  for (const check of CONTENT_CHECKS) assert.equal(question.checks?.[check], 'pass', 'Unresolved root content check ' + check);
}

const cases = [];
for (const set of target) for (const question of set.subquestions) {
  const maximum = computeSubquestionMaxPoints(question);
  for (const kind of maximum > 1 ? ['partial', 'wrong'] : ['wrong']) {
    const matches = qa.filter(row => row.set_id === set.id && row.subquestion_id === question.id && row.kind === kind);
    assert.equal(matches.length, 1, `One representative required: ${set.id}/${question.id}/${kind}`);
    const row = matches[0], met = row.met_criterion_ids;
    assert(typeof row.answer === 'string' && row.answer.trim() && row.answer.length <= 5000);
    assert(typeof row.reason === 'string' && row.reason.trim());
    assert(Array.isArray(met) && new Set(met).size === met.length);
    assert(met.every(id => question.criteria.some(criterion => criterion.id === id)));
    const verdicts = question.criteria.map(criterion => ({criterion_id: criterion.id, verdict: met.includes(criterion.id) ? 'met' : 'not_met', reason: row.reason}));
    const points = question.criteria.reduce((sum, criterion) => sum + criterion.scores[verdicts.find(verdict => verdict.criterion_id === criterion.id).verdict], 0);
    assert(Number.isSafeInteger(points)); assert.equal(points, row.expected_points);
    assert(kind === 'wrong' ? points === 0 : points > 0 && points < maximum, 'Role score range');
    cases.push({id: `${set.id}--${question.id}--${kind}`, set_id: set.id, subquestion_id: question.id, kind,
      answer: row.answer, expected_points: points, expected_verdicts: verdicts,
      expectation_review: 'agent_content_review_before_execution', human_review_performed: false,
      origin: {file: qaFile, reason: row.reason, ...(row.origin ? {prior_evidence: row.origin} : {})}});
  }
}

const draftEvidence = read(R + '/draft-evidence.json');
assert(Array.isArray(draftEvidence));
for (const evidence of draftEvidence) {
  assert(typeof evidence.file === 'string' && fs.existsSync(evidence.file));
  if (evidence.sha256 !== undefined) assert.equal(ref(evidence.file).sha256, evidence.sha256, 'Draft evidence changed');
}
const evidenceFiles = [...new Set([R + '/designs.json', R + '/draft-evidence.json', R + '/case-reviews.json', rootFile,
  qaFile, R + '/representative-scope-check.json', R + '/authorization.md', R + '/policy-input.json', D + '/bank-before.json', D + '/catalog-before.json',
  D + '/classification-before.json', D + '/source-catalog.json', D + '/source-catalog-final.json', R + '/integration-baseline.json',
  R + '/integration-baseline/bank.json', R + '/integration-baseline/catalog.json', R + '/integration-baseline/classification.json', ...draftEvidence.map(evidence => evidence.file)])];
const evidenceReferences = evidenceFiles.map(ref);
const reviews = target.map(set => ({set_id: set.id, content_hash: reviewedContentHash(set),
  reviewer_id: rootReview.reviewer_id + ' with author-agent source comparison', reviewed_at: rootReview.reviewed_at,
  method: 'agent_content_review', human_review_performed: false, evidence: evidenceReferences,
  questions: set.subquestions.map(question => {
    const authored = authorReviews.find(row => row.set_id === set.id && row.subquestion_id === question.id);
    const integrated = rootReview.questions.find(row => row.set_id === set.id && row.subquestion_id === question.id);
    assert(authored.rationale?.trim()); assert(authored.point_decision);
    assert.deepEqual(authored.unresolved_content_findings, []);
    return {subquestion_id: question.id, criterion_ids: question.criteria.map(criterion => criterion.id),
      source_ref_ids: [...new Set([...question.requirements.map(requirement => requirement.source_ref_id), ...question.criteria.flatMap(criterion => criterion.source_ref_ids)])],
      checks: integrated.checks,
      rationale: `작성자 대조: ${authored.rationale}\n배점 결정: ${typeof authored.point_decision === 'string' ? authored.point_decision : JSON.stringify(authored.point_decision)}\n통합 검토: ${integrated.rationale}`};
  }), unresolved_content_findings: []}));

const out = R + '/execution-v1'; assert(!fs.existsSync(out), 'Use a new version for a retry; preserve previous evidence');
fs.mkdirSync(out); fs.mkdirSync(out + '/projections'); fs.mkdirSync(out + '/runtime');
write(out + '/representatives.json', {cases, representative_scope: representativeScope});
write(out + '/scope.json', {targets: target.map(set => ({set_id: set.id, subquestion_ids: set.subquestions.map(question => question.id)}))});
write(out + '/policy.json', {scope: ref(out + '/scope.json'), model: 'gpt-5.6-luna', grading_point_tolerance: 1,
  minimum_within_tolerance_ratio: 0.95, content_error_tolerance: 0, statistical_confidence_claim: false,
  budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
  provider_limit_errors_stop_all_workers: true, monetary_limit_not_inferred_from_prior_batches: true,
  representative_scope: ref(R + '/representative-scope-check.json'),
  one_point_partial_representative_policy: '1점 물음에는 0점과 1점 사이 정수 부분점수가 없으므로 모범답안과 대표 정오 경계 오답만 실측한다. 부분답안 요청에서 해당 물음은 미제출 문맥으로 남기며 분모에 넣지 않는다.',
  reuse_decision: '신규 3사례·9물음만 검토하고 각 사례의 모범·적용 가능한 대표 부분·오답을 전체 사례 단위로 통합하여 실측한다. 기존 은행 문항·과거 실측을 새 검증 분모에 넣지 않는다.'});
write(out + '/agent-reviews.json', reviews);
const codeFiles = [...new Set([...EFFICIENT_RUNTIME_FILES, ...['run-efficient-grading.ts', 'contract.ts', 'accounting.ts'].map(file => R + '/helpers/' + file)])];
const snapshots = codeFiles.map((file, index) => {
  const copied = `${out}/runtime/${String(index).padStart(2, '0')}-${path.basename(file)}`;
  fs.copyFileSync(file, copied, fs.constants.COPYFILE_EXCL); return {...ref(copied), runtime_file: file};
});
write(out + '/runtime-snapshots.json', snapshots);
const entries = [];
for (const [index, set] of target.entries()) {
  const metadata = catalog.classifications.filter(classification => classification.source_set_id === set.id);
  assert.equal(metadata.length, 3); assert(metadata.every(classification => classification.question_style === 'case'));
  const units = [...new Set(metadata.map(classification => learningUnitId(set.id, classification.question_style, classification.subquestion_id)))];
  assert.equal(units.length, 1);
  const unit = units[0], projection = selectLearningQuestionSet(set, metadata, unit), projectedFile = out + '/projections/' + unit + '.json';
  write(projectedFile, projection);
  for (const kind of ['model', 'partial', 'wrong']) {
    const evaluated = projection.subquestions.filter(question => kind !== 'partial' || computeSubquestionMaxPoints(question) > 1);
    if (!evaluated.length) continue;
    const answers = {}, expected = [], selection = [];
    for (const question of projection.subquestions) {
      const representative = cases.find(row => row.set_id === set.id && row.subquestion_id === question.id && row.kind === kind);
      const isEvaluated = evaluated.some(row => row.id === question.id);
      const verdicts = kind === 'model' ? question.criteria.map(criterion => ({criterion_id: criterion.id, verdict: 'met', reason: '직접 출처·발문·독립 득점 조건을 대조한 저장 모범답안.'}))
        : isEvaluated ? representative.expected_verdicts : question.criteria.map(criterion => ({criterion_id: criterion.id, verdict: 'not_met', reason: '문맥으로만 남긴 미제출 물음.'}));
      answers[question.id] = kind === 'model' ? question.model_answer.join('\n') : isEvaluated ? representative.answer : '';
      expected.push({subquestion_id: question.id, expected_points: question.criteria.reduce((sum, criterion) => sum + criterion.scores[verdicts.find(verdict => verdict.criterion_id === criterion.id).verdict], 0), expected_verdicts: verdicts});
      if (isEvaluated) selection.push({...ref(kind === 'model' ? bankFile : out + '/representatives.json'), subquestion_id: question.id,
        case_id: kind === 'model' ? null : representative.id, kind,
        reason: '원문과 현재 criterion에서 실행 전에 확정한 대표 답안. 같은 사례의 같은 역할을 한 요청에 통합한다.'});
    }
    entries.push({id: `${unit}--${kind}`, worker: ['a', 'b', 'c'][index % 3], learning_unit_id: unit, source_set_id: set.id,
      projected_file: projectedFile, projected_sha256: ref(projectedFile).sha256, kind,
      evaluated_subquestion_ids: evaluated.map(question => question.id), answers, expected_by_subquestion: expected, selection_evidence: selection});
  }
}
const inputFiles = [...new Set([...target.flatMap(set => set.source_refs.map(source => source.file)), ...evidenceFiles,
  R + '/helpers/build-execution.mjs', R + '/helpers/representative-qa.mjs', R + '/helpers/provenance.json', bankFile, catalogFile, R + '/changed-sets-v1.json',
  out + '/scope.json', out + '/representatives.json', out + '/agent-reviews.json', out + '/runtime-snapshots.json', ...snapshots.map(snapshot => snapshot.file)])];
assert.equal(entries.reduce((sum, entry) => sum + entry.evaluated_subquestion_ids.length, 0), representativeScope.planned_evaluated_answers, 'Manifest coverage must equal the applicable representative roles');
write(out + '/grading-manifest.json', {version: 1, artifact_type: 'efficient_grading_manifest', model: 'gpt-5.6-luna',
  budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
  bank: ref(bankFile), classifications: ref(catalogFile), policy: ref(out + '/policy.json'), inputs: inputFiles.map(ref), code_files: codeFiles.map(ref), entries});
console.log(JSON.stringify({target_sets: target.length, questions: target.reduce((sum, set) => sum + set.subquestions.length, 0),
  requests: entries.length, evaluated_answers: entries.reduce((sum, entry) => sum + entry.evaluated_subquestion_ids.length, 0),
  manifest: ref(out + '/grading-manifest.json'), actual_sdk_calls: 0}, null, 2));
