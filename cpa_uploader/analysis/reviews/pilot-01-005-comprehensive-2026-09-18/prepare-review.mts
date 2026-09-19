import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectLearningQuestionSet } from '../../../../lib/learningUnits.ts';
import { computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
import { reviewedContentHash } from '../../../questionReviewIdentity.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { EFFICIENT_RUNTIME_FILES } from '../../../questionEfficientReview.ts';

const D = 'cpa_uploader/drafts/pilot-01-005-comprehensive-2026-09-18';
const R = 'cpa_uploader/analysis/reviews/pilot-01-005-comprehensive-2026-09-18';
const BANK = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const CATALOG = 'cpa_uploader/data/learning-question-classifications.json';
const TARGET = 'pilot-01-005';
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const ref = (file: string) => ({ file, sha256: sha(fs.readFileSync(file)) });
const write = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
};
const mode = process.argv[2];
assert(['candidate', 'execution'].includes(mode), 'Usage: prepare-review.mts candidate|execution');

if (mode === 'candidate') {
  const bank = read(BANK);
  const currentCatalog = read(CATALOG);
  assert.equal(currentCatalog.source_file_sha256, ref(BANK).sha256, 'Current catalog is stale');
  const [draft] = read(`${D}/sets.json`);
  assert.equal(draft.id, TARGET);
  const prior = bank.find((set: { id: string }) => set.id === TARGET);
  assert(prior, 'Existing target set is missing');
  const candidate = bank.map((set: { id: string }) => set.id === TARGET ? draft : set);
  const result = validateAuthoringBank(candidate);
  assert.deepEqual(result.errors, []);
  const candidateFile = `${R}/candidate-v1.json`;
  write(`${R}/baseline-v1.json`, {
    bank: ref(BANK),
    catalog: ref(CATALOG),
    classification_review: ref(currentCatalog.review_file),
    prior_target: { title: prior.title, questions: prior.subquestions.length, points: prior.subquestions.flatMap((q: { criteria: { max_points: number }[] }) => q.criteria).reduce((n: number, c: { max_points: number }) => n + c.max_points, 0) },
  });
  write(candidateFile, candidate);
  const oldReview = read(currentCatalog.review_file);
  const design = read(`${D}/design.json`);
  const entries = oldReview.entries.filter((entry: { set_id: string }) => entry.set_id !== TARGET);
  for (const question of draft.subquestions) {
    const row = design.questions.find((item: { subquestion_id: string }) => item.subquestion_id === question.id);
    assert(row);
    entries.push({
      set_id: TARGET,
      subquestion_id: question.id,
      question_style: 'case',
      topic_ids: question.topic_ids,
      standalone_prompt: null,
      case_fact_ids: row.case_fact_ids,
      reason: `${row.topic_reason} ${row.classification_note}`,
    });
  }
  write(`${R}/classification-review-v1.json`, { source_file: candidateFile, source_file_sha256: ref(candidateFile).sha256, entries });
  console.log(JSON.stringify({ sets: candidate.length, questions: result.subquestionCount, criteria: result.criterionCount, points: result.totalPoints }, null, 2));
  process.exit(0);
}

const candidateFile = `${R}/candidate-v1.json`;
const catalogFile = `${R}/catalog-v1.json`;
const contentReviewFile = `${R}/content-review-v1.json`;
const candidate = read(candidateFile);
const catalog = read(catalogFile);
const set = candidate.find((row: { id: string }) => row.id === TARGET);
const review = read(contentReviewFile);
assert(set && review.set_id === TARGET);
assert.deepEqual(set, read(`${D}/sets.json`)[0]);
assert.equal(review.content_hash, reviewedContentHash(set));
assert.equal(catalog.source_file_sha256, ref(candidateFile).sha256);

const out = `${R}/execution-v1`;
assert(!fs.existsSync(out), 'Execution directory already exists');
fs.mkdirSync(`${out}/projections`, { recursive: true });
fs.mkdirSync(`${out}/runtime`, { recursive: true });
write(`${out}/scope.json`, { targets: [{ set_id: TARGET, subquestion_ids: set.subquestions.map((q: { id: string }) => q.id) }] });
write(`${out}/policy.json`, {
  scope: ref(`${out}/scope.json`),
  model: 'gpt-5.6-luna',
  grading_point_tolerance: 1,
  minimum_within_tolerance_ratio: 0.95,
  content_error_tolerance: 0,
  statistical_confidence_claim: false,
  budget_usd: null,
  budget_enforcement: 'not_specified',
  provider_limit_errors_stop_all_workers: true,
  monetary_limit_not_inferred_from_prior_batches: true,
  reuse_decision: '문항 내용과 rubric이 전면 변경되어 기존 실측을 재사용하지 않는다. 같은 사례의 세 물음을 모범·부분·오답 역할별 한 요청으로 통합하여 총 세 요청으로 실측한다.',
});
write(`${out}/representatives.json`, read(`${D}/qa.json`));
write(`${out}/agent-reviews.json`, [review]);

const metadata = catalog.classifications.filter((row: { source_set_id: string }) => row.source_set_id === TARGET);
assert.equal(metadata.length, set.subquestions.length);
const unit = `${TARGET}--case`;
const projection = selectLearningQuestionSet(set, metadata, unit);
const projectedFile = `${out}/projections/${unit}.json`;
write(projectedFile, projection);

const runtimeFiles = [
  ...EFFICIENT_RUNTIME_FILES,
  'cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/run-efficient-grading.ts',
  'cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/contract.ts',
  'cpa_uploader/analysis/reviews/case-review-2026-09-15/tools/accounting.ts',
];
const codeFiles = [...new Set(runtimeFiles)];
const snapshots = codeFiles.map((file, index) => {
  const copy = `${out}/runtime/${String(index).padStart(2, '0')}-${path.basename(file)}`;
  fs.copyFileSync(file, copy, fs.constants.COPYFILE_EXCL);
  return { ...ref(copy), runtime_file: file };
});
write(`${out}/runtime-snapshots.json`, snapshots);

const qa = read(`${D}/qa.json`);
const entries = ['model', 'partial', 'wrong'].map((kind) => {
  const answers: Record<string, string> = {};
  const expected_by_subquestion = [];
  const selection_evidence = [];
  for (const question of projection.subquestions) {
    const representative = qa.cases.find((row: { subquestion_id: string; kind: string }) => row.subquestion_id === question.id && row.kind === kind);
    const expectedVerdicts = kind === 'model'
      ? question.criteria.map((criterion: { id: string }) => ({ criterion_id: criterion.id, verdict: 'met', reason: '저장 모범답안이 해당 독립 득점조건을 직접 충족한다.' }))
      : representative.expected_verdicts;
    const answer = kind === 'model' ? question.model_answer.join('\n') : representative.answer;
    const expectedPoints = question.criteria.reduce((sum: number, criterion: { id: string; scores: Record<string, number> }) => {
      const verdict = expectedVerdicts.find((row: { criterion_id: string }) => row.criterion_id === criterion.id);
      return sum + criterion.scores[verdict.verdict];
    }, 0);
    if (kind === 'partial') assert(expectedPoints > 0 && expectedPoints < computeSubquestionMaxPoints(question));
    if (kind === 'wrong') assert.equal(expectedPoints, 0);
    answers[question.id] = answer;
    expected_by_subquestion.push({ subquestion_id: question.id, expected_points: expectedPoints, expected_verdicts: expectedVerdicts });
    selection_evidence.push({
      ...ref(kind === 'model' ? candidateFile : `${D}/qa.json`),
      subquestion_id: question.id,
      case_id: kind === 'model' ? null : representative.id,
      kind,
      reason: kind === 'model' ? '공식 출처와 criterion을 대조한 저장 모범답안이다.' : representative.reason,
    });
  }
  return {
    id: `${TARGET}-case-${kind}`,
    worker: 'a',
    learning_unit_id: unit,
    source_set_id: TARGET,
    projected_file: projectedFile,
    projected_sha256: ref(projectedFile).sha256,
    kind,
    evaluated_subquestion_ids: projection.subquestions.map((q: { id: string }) => q.id),
    answers,
    expected_by_subquestion,
    selection_evidence,
  };
});

const evidenceFiles = [
  `${R}/authorization.md`, `${R}/policy-input.json`, contentReviewFile,
  `${D}/sets.json`, `${D}/design.json`, `${D}/qa.json`, `${D}/lineage.json`, `${D}/build-draft.mjs`,
  candidateFile, catalogFile, `${R}/classification-review-v1.json`,
  `${out}/scope.json`, `${out}/policy.json`, `${out}/representatives.json`, `${out}/agent-reviews.json`, projectedFile,
  `${out}/runtime-snapshots.json`,
  ...set.source_refs.map((source: { file: string }) => source.file),
  ...review.evidence.map((identity: { file: string }) => identity.file),
  ...codeFiles,
  ...snapshots.map((snapshot) => snapshot.file),
];
const inputFiles = [...new Set(evidenceFiles)];
write(`${out}/grading-manifest.json`, {
  version: 1,
  artifact_type: 'efficient_grading_manifest',
  model: 'gpt-5.6-luna',
  budget_usd: null,
  budget_enforcement: 'not_specified',
  bank: ref(candidateFile),
  classifications: ref(catalogFile),
  policy: ref(`${out}/policy.json`),
  inputs: inputFiles.map(ref),
  code_files: codeFiles.map(ref),
  entries,
});
console.log(JSON.stringify({ requests: entries.length, evaluated_answers: entries.length * set.subquestions.length, manifest: ref(`${out}/grading-manifest.json`) }, null, 2));
