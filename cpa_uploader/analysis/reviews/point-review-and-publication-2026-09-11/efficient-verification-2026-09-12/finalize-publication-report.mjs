import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const batch = path.dirname(fileURLToPath(import.meta.url));
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const file = name => path.join(batch, name);
const receipt = read(file('db-publication-v4/receipt.json'));
const verified = read(file('db-publication-v4/verification.json'));
const installation = read(file('canonical-install-v1/install-004/completion.json'));
const grading = read(file('sealed-results-v4/summary.json'));
const readiness = read(file('sealed-results-v4/readiness.json'));
const cost = read(file('b/final-api-accounting-v1.json'));
const builds = read(file('checks/final-build-results.json'));
assert.equal(receipt.applied, true);
assert.equal(receipt.release_id, '2fe460a1-8107-40cd-8afd-e6eb539ef997');
assert.equal(verified.status, 'passed');
assert.deepEqual(verified.failures, []);
assert.equal(verified.actual.questions, 351);
assert.equal(verified.actual.points, 1298);
assert.equal(verified.actual.standard_questions, 279);
assert.equal(verified.actual.case_questions, 72);
assert.equal(verified.actual.learning_units, 320);
assert.equal(verified.hashes.expected_source_file, receipt.source_file_hash);
assert.equal(verified.remote_write_queries, 0);
assert.equal(verified.model_api_calls, 0);
assert.equal(readiness.ready, true);
assert.equal(grading.observed_evaluated_answers, 830);
assert.equal(grading.within_tolerance, 830);
assert.equal(grading.exact_score_matches, 821);
assert.equal(cost.total_actual_new_responses.calls, 742);
assert.deepEqual(builds.map(x => [x.task, x.exit_code]), [
  ['analysis:build', 0], ['analysis:check', 0], ['wiki:build', 0], ['wiki:check', 0],
]);
for (const input of [...installation.files, ...verified.inputs]) assert.equal(hash(path.resolve(input.file)), input.sha256);
const report = path.resolve('docs/reports/question-points-and-publication-2026-09-12.md');
const beforeReport = fs.readFileSync(report, 'utf8');
assert(beforeReport.includes('독립 DB 사후 대조: 실행 중.'));
const finalReport = beforeReport
  .replace('실제 DB를 다시 읽는 독립 사후 대조 결과는 아래 적용 기록에 추가한다.', '실제 DB를 다시 읽는 독립 사후 대조도 통과했다. 원문·배점·유형·주제 연결이 검증본과 일치한다.')
  .replace('- 독립 DB 사후 대조: 실행 중. 완료 결과를 별도 증거와 함께 추가한다.', '- 독립 DB 사후 대조: **통과, 불일치 0건**. 전체 154개 저장 판본과 351개 물음의 원문·공개본·배점·분류·주제·학습 단위 및 설치된 DB 계약을 대조했다. [실제 사후 대조](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/verification.json).\n- 원 적용 영수증에 없는 공개본 해시는 실제 DB 릴리스를 읽어 원 영수증·검증본과 일치시킨 [별도 파생 입력](../../cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12/db-publication-v4/verification-evidence.json)에 기록했다. 원 영수증·검사 코드를 바꾸지 않았으며, 이 입력 필드 차이로 DB 읽기 전에 종료된 첫 시도도 보존했다.');
const batchReadme = file('README.md');
const parentReadme = path.join(batch, '../README.md');
const finalBatch = fs.readFileSync(batchReadme, 'utf8').replace(
  '**내용·배점 검토와 실제 대표 채점은 완료했으며, 게시용 파일 생성 중이다. 정본 설치·운영 DB 적용은 아직 미완료다.**',
  '**내용·배점 검토, 실제 대표 채점, 정본 설치·wiki 갱신·운영 DB 적용과 독립 사후 대조를 완료했다.** [최종 보고서](../../../../../docs/reports/question-points-and-publication-2026-09-12.md), [적용 영수증](db-publication-v4/receipt.json), [실제 DB 대조](db-publication-v4/verification.json)를 따른다. 운영 릴리스는 `2fe460a1-8107-40cd-8afd-e6eb539ef997`다.');
const finalParent = fs.readFileSync(parentReadme, 'utf8')
  .replace('## 2026-09-12 현재 상태 — 효율 검증 완료, DB 반영 준비', '## 2026-09-12 현재 상태 — 검증·정본·운영 DB 적용 완료')
  .replace('현재 게시용 파일 생성 중이며 정본 설치·운영 DB 적용은 아직 미완료다.', '정본 설치와 analysis·wiki 검사, 운영 DB 적용 및 독립 사후 대조까지 완료했다. [최종 보고서](../../../../docs/reports/question-points-and-publication-2026-09-12.md), [원 적용 영수증](efficient-verification-2026-09-12/db-publication-v4/receipt.json), [실제 DB 대조](efficient-verification-2026-09-12/db-publication-v4/verification.json)를 따른다.');
const evidenceFiles = [
  ...installation.files.map(x => path.resolve(x.file)), report, batchReadme, parentReadme,
  ...['execution-lock-v4.json', 'candidate-v5/grading-manifest.json', 'sealed-results-v4/batch.json', 'sealed-results-v4/readiness.json',
    'sealed-results-v4/summary.json', 'point-allocation-review.md', 'a/bankwide-point-coverage.json', 'a/operational-point-diff-v1.md',
    'a/topic-19-point-detail.md', 'a/policy-final-check-v1.json', 'b/final-api-accounting-v1.json',
    'canonical-install-v1/install-004/completion.json', 'live-before-publication-v3/summary.json',
    'db-publication-v4/readiness.json', 'db-publication-v4/receipt.json', 'db-publication-v4/verification-evidence.json',
    'db-publication-v4/verification-release-read.json', 'db-publication-v4/verification.json', 'checks/final-build-results.json',
    'checks/final-db-apply.log', 'checks/final-db-postverify-derived-v1.log', 'checks/efficient-final004-tests.log',
    'checks/final004-typecheck.log', 'checks/final004-lint.log'].map(file),
  ...builds.map(x => path.resolve(x.log)), file('finalize-publication-report.mjs'),
];
const completionFile = file('completion.json');
assert(!fs.existsSync(completionFile));
assert(evidenceFiles.every(x => fs.existsSync(x)), 'All final evidence must exist');
for (const [target, contents] of [[report, finalReport], [batchReadme, finalBatch], [parentReadme, finalParent]]) fs.writeFileSync(target, contents);
const completion = {
  version: 'question-verification-2026-09-12-efficient-004', status: 'verified_published_db_applied_and_independently_checked',
  completed_at: new Date().toISOString(), release_id: receipt.release_id, project_host: receipt.project_host,
  counts: verified.expected, grading: { evaluated_answers: 830, exact_points: 821, within_one_point: 830, statistical_confidence_claim: false },
  content_review: { newly_reviewed_questions: 281, unchanged_prior_review_questions: 70, unresolved_known_issues: 0, human_review_asserted: false },
  api_usage: { ...cost.total_actual_new_responses, model: 'gpt-5.6-luna', separate_paid_semantic_calls: 0, invoice_amount: false, scope: 'efficient batch only; excludes earlier other batches and agent chat' },
  points_vs_prior_db: { existing: 212, unchanged: 126, changed: 86, increased: 84, decreased_by_scope_split: 2, added_keys_including_splits: 139 },
  checks: builds, db_postcheck: { status: verified.status, requests: verified.requests, failures: verified.failures },
  learner_progress_reset: false, website_code_deployment: false,
  evidence: [...new Set(evidenceFiles)].map(x => ({ file: rel(x), sha256: hash(x) })),
};
fs.writeFileSync(completionFile, JSON.stringify(completion, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: completion.status, release_id: receipt.release_id, counts: completion.counts, evidence_files: completion.evidence.length, completion: rel(completionFile), sha256: hash(completionFile) }));
