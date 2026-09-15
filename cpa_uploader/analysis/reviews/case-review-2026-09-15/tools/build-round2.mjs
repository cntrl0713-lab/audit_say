// 지정 사례 검토 회차의 실제 채점 입력 생성기. build-round.mjs의 후속판으로, design.json의 questions[].classification_note가 있으면
// 분류 사유에 그 문장을 쓴다(선택형이 아닌 열거형 물음 등). 기존 실행 manifest가 build-round.mjs의 바이트를 고정하므로 원본은 고치지 않는다.
// 기존 출력이 있으면 쓰지 않는다.
//   node --import tsx <B>/tools/build-round2.mjs --round r04 --version v1 --draft-dir <D> --set-id <ID> candidate
//   npx tsx scripts/build-learning-unit-catalog.ts --review <R>/classification-<version>.json --output <R>/catalog-<version>.json
//   node --import tsx <B>/tools/build-round2.mjs --round r04 --version v1 --draft-dir <D> --set-id <ID> execution
// 초안 폴더에는 sets.json(한 세트), design.json(questions[].case_fact_ids·topic_reason), lineage.json, qa.json, build-draft.mjs가 있어야 하고
// 검토 폴더에는 root-content-review-<version>.json이 먼저 있어야 한다.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectLearningQuestionSet, learningUnitId } from '../../../../../lib/learningUnits.ts';
import { computeSubquestionMaxPoints } from '../../../../../lib/questionV3.ts';
import { CONTENT_CHECKS, EFFICIENT_RUNTIME_FILES } from '../../../../questionEfficientReview.ts';
import { reviewedContentHash } from '../../../../questionReviewIdentity.ts';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

const B = 'cpa_uploader/analysis/reviews/case-review-2026-09-15';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const CATALOG = 'cpa_uploader/data/learning-question-classifications.json';
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = (file) => ({ file, sha256: hash(fs.readFileSync(file)) });
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const sorted = (values) => [...values].sort();

const args = process.argv.slice(2), options = {};
while (args.length > 1) {
  const flag = args.shift(), value = args.shift();
  assert(['--round', '--version', '--draft-dir', '--set-id'].includes(flag) && value && !options[flag], 'Unknown/duplicate argument: ' + flag);
  options[flag] = value;
}
const mode = args.shift();
assert(['candidate', 'execution'].includes(mode) && Object.keys(options).length === 4, 'Usage: --round rNN --version vN --draft-dir DIR --set-id ID candidate|execution');
assert(/^r\d{2}$/.test(options['--round']) && /^v\d+$/.test(options['--version']));
const R = `${B}/${options['--round']}`, V = options['--version'], D = options['--draft-dir'].replace(/\\/g, '/').replace(/\/$/, ''), SET_ID = options['--set-id'];
const rootFile = `${R}/root-content-review-${V}.json`;
const draftFiles = ['sets.json', 'design.json', 'lineage.json', 'qa.json', 'build-draft.mjs'].map((name) => `${D}/${name}`);
for (const file of [...draftFiles, rootFile]) assert(fs.existsSync(file), 'Missing input: ' + file);
const [draft] = read(`${D}/sets.json`); assert.equal(draft.id, SET_ID);
const rootReview = read(rootFile);
assert.equal(rootReview.method, 'agent_content_review'); assert.equal(rootReview.human_review_performed, false);
assert.equal(rootReview.target.reviewed_content_sha256, reviewedContentHash(draft), 'Reviewed draft changed');
assert.deepEqual(rootReview.unresolved_content_findings, []);
assert.deepEqual(sorted(rootReview.questions.map((q) => q.subquestion_id)), sorted(draft.subquestions.map((q) => q.id)));
for (const q of rootReview.questions) for (const check of CONTENT_CHECKS) assert.equal(q.checks[check], 'pass', check);

if (mode === 'candidate') {
  const bank = read(BANK), catalog = read(CATALOG);
  assert.equal(catalog.source_file_sha256, ref(BANK).sha256, 'Current catalog must describe the current bank');
  const review = read(catalog.review_file); assert.equal(review.source_file_sha256, ref(BANK).sha256);
  assert(!bank.some((set) => set.id === SET_ID), 'This round adds a new set ID');
  const candidate = [...bank, draft];
  const checked = validateAuthoringBank(candidate); assert.deepEqual(checked.errors, []);
  write(`${R}/baseline-${V}.json`, { bank: ref(BANK), catalog: ref(CATALOG), classification_review: ref(catalog.review_file),
    sets: bank.length, questions: bank.reduce((n, s) => n + s.subquestions.length, 0), draft: ref(`${D}/sets.json`) });
  write(`${R}/candidate-${V}.json`, candidate);
  const design = read(`${D}/design.json`);
  const entries = [...review.entries, ...draft.subquestions.map((question) => {
    const row = design.questions.find((q) => q.subquestion_id === question.id);
    assert.deepEqual(row.topic_ids, question.topic_ids);
    return { set_id: SET_ID, subquestion_id: question.id, question_style: 'case', topic_ids: question.topic_ids,
      standalone_prompt: null, case_fact_ids: row.case_fact_ids,
      reason: `${row.topic_reason} ${row.classification_note ?? '사례 절차의 옳고 그름을 사실에 적용해 판단해야 하므로 사례형이다.'}` };
  })];
  write(`${R}/classification-${V}.json`, { source_file: `${R}/candidate-${V}.json`, source_file_sha256: ref(`${R}/candidate-${V}.json`).sha256, entries });
  console.log({ sets: candidate.length, questions: checked.subquestionCount, criteria: checked.criterionCount, points: checked.totalPoints });
} else {
  const bankFile = `${R}/candidate-${V}.json`, catalogFile = `${R}/catalog-${V}.json`;
  const bank = read(bankFile), catalog = read(catalogFile), set = bank.find((s) => s.id === SET_ID);
  assert(set); assert.deepEqual(set, draft, 'Candidate must contain the exact reviewed draft'); assert.deepEqual(validateAuthoringBank(bank).errors, []);
  assert.equal(catalog.source_file_sha256, ref(bankFile).sha256, 'Catalog must describe exact candidate bytes');
  assert.equal(set.status, 'needs_review'); assert.equal(set.verification.review_status, 'needs_human_review');
  const policyInput = read(`${B}/policy-input.json`);
  assert.equal(policyInput.budget_enforcement, 'not_specified'); assert.equal(policyInput.budget_usd, null);
  const qaFile = `${D}/qa.json`, qa = read(qaFile), cases = [];
  for (const question of set.subquestions) {
    const maximum = computeSubquestionMaxPoints(question);
    for (const kind of maximum > 1 ? ['partial', 'wrong'] : ['wrong']) {
      const rows = qa.cases.filter((row) => row.subquestion_id === question.id && row.kind === kind);
      assert.equal(rows.length, 1, `${question.id}/${kind}`);
      const row = rows[0];
      assert.deepEqual(sorted(row.expected_verdicts.map((v) => v.criterion_id)), sorted(question.criteria.map((c) => c.id)));
      const points = question.criteria.reduce((n, c) => n + c.scores[row.expected_verdicts.find((v) => v.criterion_id === c.id).verdict], 0);
      assert.equal(points, row.expected_points); assert(kind === 'wrong' ? points === 0 : points > 0 && points < maximum);
      cases.push({ id: row.id, set_id: SET_ID, subquestion_id: question.id, kind, answer: row.answer, expected_points: points,
        expected_verdicts: row.expected_verdicts, expectation_review: 'agent_content_review_before_execution', human_review_performed: false,
        origin: { file: qaFile, reason: row.reason } });
    }
  }
  const evidenceFiles = [`${B}/authorization.md`, `${B}/policy-input.json`, rootFile, ...draftFiles, `${R}/baseline-${V}.json`, `${R}/classification-${V}.json`];
  const reviews = [{ set_id: SET_ID, content_hash: reviewedContentHash(set), reviewer_id: rootReview.reviewer_id, reviewed_at: rootReview.reviewed_at,
    method: 'agent_content_review', human_review_performed: false, evidence: evidenceFiles.map(ref),
    questions: set.subquestions.map((question) => {
      const row = rootReview.questions.find((q) => q.subquestion_id === question.id);
      return { subquestion_id: question.id, criterion_ids: question.criteria.map((c) => c.id),
        source_ref_ids: [...new Set([...question.requirements.map((r) => r.source_ref_id), ...question.criteria.flatMap((c) => c.source_ref_ids)])],
        checks: row.checks, rationale: row.rationale };
    }), unresolved_content_findings: [] }];
  const out = `${R}/execution-${V}`; assert(!fs.existsSync(out), 'Use a new version for a retry; preserve previous evidence');
  fs.mkdirSync(out); fs.mkdirSync(out + '/projections'); fs.mkdirSync(out + '/runtime');
  write(out + '/representatives.json', { cases });
  write(out + '/scope.json', { targets: [{ set_id: SET_ID, subquestion_ids: set.subquestions.map((q) => q.id) }] });
  write(out + '/policy.json', { scope: ref(out + '/scope.json'), model: 'gpt-5.6-luna', grading_point_tolerance: 1,
    minimum_within_tolerance_ratio: 0.95, content_error_tolerance: 0, statistical_confidence_claim: false,
    budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
    provider_limit_errors_stop_all_workers: true, monetary_limit_not_inferred_from_prior_batches: true,
    reuse_decision: `${V} 초안 1세트만 검토한다. 이전 판본과 원 세트의 실측은 문항 내용이 달라 재사용하지 않고 분모에 넣지 않는다. 모범·부분·오답 역할을 사례 단위로 통합하여 3요청으로 실측한다.` });
  write(out + '/agent-reviews.json', reviews);
  const codeFiles = [...new Set([...EFFICIENT_RUNTIME_FILES, ...['run-efficient-grading.ts', 'contract.ts', 'accounting.ts'].map((file) => `${B}/tools/${file}`)])];
  const snapshots = codeFiles.map((file, index) => {
    const copied = `${out}/runtime/${String(index).padStart(2, '0')}-${path.basename(file)}`;
    fs.copyFileSync(file, copied, fs.constants.COPYFILE_EXCL); return { ...ref(copied), runtime_file: file };
  });
  write(out + '/runtime-snapshots.json', snapshots);
  const metadata = catalog.classifications.filter((c) => c.source_set_id === SET_ID);
  assert.equal(metadata.length, set.subquestions.length); assert(metadata.every((c) => c.question_style === 'case'));
  const units = [...new Set(metadata.map((c) => learningUnitId(SET_ID, c.question_style, c.subquestion_id)))]; assert.equal(units.length, 1);
  const unit = units[0], projection = selectLearningQuestionSet(set, metadata, unit), projectedFile = out + '/projections/' + unit + '.json';
  write(projectedFile, projection);
  const entries = ['model', 'partial', 'wrong'].map((kind) => {
    const answers = {}, expected = [], selection = [];
    for (const question of projection.subquestions) {
      const representative = cases.find((row) => row.subquestion_id === question.id && row.kind === kind);
      const verdicts = kind === 'model' ? question.criteria.map((c) => ({ criterion_id: c.id, verdict: 'met', reason: '직접 출처·발문·독립 득점 조건을 대조한 저장 모범답안.' }))
        : representative.expected_verdicts;
      answers[question.id] = kind === 'model' ? question.model_answer.join('\n') : representative.answer;
      expected.push({ subquestion_id: question.id, expected_points: question.criteria.reduce((n, c) => n + c.scores[verdicts.find((v) => v.criterion_id === c.id).verdict], 0), expected_verdicts: verdicts });
      selection.push({ ...ref(kind === 'model' ? bankFile : out + '/representatives.json'), subquestion_id: question.id,
        case_id: kind === 'model' ? null : representative.id, kind,
        reason: '원문과 현재 criterion에서 실행 전에 확정한 대표 답안. 같은 사례의 같은 역할을 한 요청에 통합한다.' });
    }
    return { id: `${unit}--${kind}`, worker: 'a', learning_unit_id: unit, source_set_id: SET_ID, projected_file: projectedFile,
      projected_sha256: ref(projectedFile).sha256, kind, evaluated_subquestion_ids: projection.subquestions.map((q) => q.id),
      answers, expected_by_subquestion: expected, selection_evidence: selection };
  });
  const inputFiles = [...new Set([...set.source_refs.map((s) => s.file), ...evidenceFiles, `${B}/tools/build-round2.mjs`, bankFile, catalogFile,
    out + '/scope.json', out + '/representatives.json', out + '/agent-reviews.json', out + '/runtime-snapshots.json', ...snapshots.map((s) => s.file)])];
  write(out + '/grading-manifest.json', { version: 1, artifact_type: 'efficient_grading_manifest', model: 'gpt-5.6-luna',
    budget_usd: policyInput.budget_usd, budget_enforcement: policyInput.budget_enforcement,
    bank: ref(bankFile), classifications: ref(catalogFile), policy: ref(out + '/policy.json'), inputs: inputFiles.map(ref), code_files: codeFiles.map(ref), entries });
  console.log(JSON.stringify({ requests: entries.length, evaluated_answers: entries.reduce((n, e) => n + e.evaluated_subquestion_ids.length, 0),
    manifest: ref(out + '/grading-manifest.json'), actual_sdk_calls: 0 }, null, 2));
}
