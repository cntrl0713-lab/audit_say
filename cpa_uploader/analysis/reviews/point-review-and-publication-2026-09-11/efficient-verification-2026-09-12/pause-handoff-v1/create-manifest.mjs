import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const output = path.dirname(fileURLToPath(import.meta.url));
const batch = path.dirname(output);
const root = process.cwd();
const at = name => path.join(batch, name);
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const paths = new Set();
const add = file => { const absolute = path.resolve(file); assert(fs.existsSync(absolute), `Missing handoff input: ${file}`); paths.add(absolute); };
const scanRefs = value => {
  if (!value || typeof value !== 'object') return;
  if (typeof value.file === 'string' && typeof value.sha256 === 'string') {
    add(value.file); assert.equal(sha(path.resolve(value.file)), value.sha256, `Changed reviewed input: ${value.file}`);
  }
  for (const nested of Object.values(value)) scanRefs(nested);
};
const c = read(at('c/private-source-metadata-v1/handoff.json'));
const b = read(at('b/private-metadata-rollout-review-v1.json'));
const install = read(at('canonical-install-v1/install-004/completion.json'));
const receipt = read(at('db-publication-v4/receipt.json'));
const failed = read(at('db-publication-v4/verification.json'));
assert.equal(c.status, 'local_fix_validated_work_stopped');
assert.equal(c.migration_applied_to_production, false);
assert.equal(c.active_owned_test_processes, 0);
assert(c.tests.every(t => t.exit_code === 0));
assert.equal(b.status, 'read_only_review_complete_stopped_before_remote_apply');
assert.equal(receipt.applied, true);
assert.equal(failed.status, 'failed');
assert.equal(failed.failures.length, 37);
assert(failed.failures.every(x => x.startsWith('EXACT_PRIVATE_STORAGE_PROJECTION:')));
for (const name of ['db-private-metadata-v1/request.json', 'db-private-metadata-v1/receipt.json', 'db-private-metadata-v1/postconditions.json', 'db-publication-v4/verification-v2.json', 'completion.json']) assert(!fs.existsSync(at(name)), `Unexpected later execution: ${name}`);
scanRefs(c); scanRefs(b); scanRefs(install);
for (const name of [
  'README.md', '../README.md', 'execution-lock-v4.json', 'candidate-v5/grading-manifest.json',
  'candidate-v5/candidate-authoring.json', 'sealed-results-v4/batch.json', 'sealed-results-v4/readiness.json', 'sealed-results-v4/summary.json',
  'point-allocation-review.md', 'a/operational-point-diff-v1.md', 'a/operational-point-diff-v1.json', 'a/topic-19-point-detail.md',
  'a/bankwide-point-coverage.json', 'a/policy-final-check-v1.json', 'b/final-api-accounting-v1.json',
  'b/private-metadata-rollout-review-v1.json', 'b/private-metadata-rollout-review-v1.md',
  'c/private-source-metadata-v1/handoff.json', 'canonical-install-v1/install-004/completion.json',
  'db-publication-v4/receipt.json', 'db-publication-v4/readiness.json', 'db-publication-v4/verification.json',
  'db-publication-v4/verification-evidence.json', 'db-publication-v4/verification-release-read.json',
  'db-private-metadata-v1/before.json', 'private-metadata-rollout.mjs', 'finalize-publication-report.mjs',
  'checks/final-build-results.json', 'checks/final-canonical-dry-run.log', 'checks/final-canonical-install.log',
  'checks/final-db-apply.log', 'checks/final-db-postverify.log', 'checks/final-db-postverify-derived-v1.log',
  'checks/efficient-final004-tests.log', 'checks/final004-typecheck.log', 'checks/final004-lint.log',
  'checks/private-metadata-preflight.log', 'pause-handoff-v1/create-manifest.mjs',
]) add(at(name));
const report = path.resolve('docs/reports/question-points-and-publication-2026-09-12.md');
const instruction = path.resolve('docs/plans/question-verification-resume-after-pause-2026-09-12.md');
for (const file of [report, instruction, 'AGENTS.md', '.agents/skills/audit-question-review/SKILL.md',
  '.agents/skills/audit-question-author/SKILL.md', '.agents/skills/audit-question-review/references/cost-controlled-verification.md',
  'lib/questionV3.ts', 'lib/questionV3Grading.ts', 'lib/questionV3Repository.ts', 'cpa_uploader/questionEfficientReview.ts',
  'scripts/import-question-bank-v3.ts', path.join(batch, '../c/verify-final-learning-rollout.ts')]) add(file);
for (const result of read(at('checks/final-build-results.json'))) { assert.equal(result.exit_code, 0); add(result.log); }
const before = read(at('db-private-metadata-v1/before.json'));
const manifest = {
  checkpoint_version: 'question-verification-2026-09-12-paused-005',
  created_at: new Date().toISOString(), status: 'paused_by_user_after_local_fix_validation', user_resume_required: true,
  report: relative(report), instructions: relative(instruction),
  completed: { content_and_points_questions: 351, newly_reviewed: 281, unchanged_prior_reviews: 70,
    fixed_grading_answers: 830, exact_points: 821, within_one_point: 830, canonical_installed: true, analysis_wiki_checks_passed: true,
    bank_import_applied: true, local_metadata_fix_sql_tests: 40, final_real_bank_payload_test: 1, local_current_and_retired_sets: 258 },
  production: { last_observed_at: before.captured_at, project: before.project, release_id: receipt.release_id,
    source_file_hash: receipt.source_file_hash, questions: 351, points: 1298, standard_questions: 279, case_questions: 72,
    learning_units: 320, first_independent_postcheck: 'failed_private_metadata_missing',
    unresolved_source_spans: 319, unresolved_grading_scopes: 13,
    affected_scope_sets: { 'pilot-16-011': 2, 'pilot-17-005': 2, 'pilot-10-007': 4, 'pilot-10-007-standards': 5 },
    metadata_migration_applied: false, followup_postcheck_performed: false, live_state_requeried_after_user_stop: false },
  remaining: ['Read current state after explicit resume and compare checkpoint', 'Apply reviewed metadata SQL in guarded transaction',
    'Read all sealed production versions and verify historical compatibility', 'Run new complete active-bank postcheck and grading payload comparison',
    'Write final publication completion only after all postchecks pass'],
  model_api: { model: 'gpt-5.6-luna', actual_calls_in_efficient_batch: 742, usage_based_estimate_usd: 0.8456149,
    new_calls_planned_for_metadata_restore: 0, provider_invoice_amount: false },
  ownership: { subagents_completed_and_stopped: ['plan_foundations', 'plan_procedures', 'plan_completion'],
    root_remaining_action: 'Write this local checkpoint and finish the turn', no_automation_created: true },
  verification_scope: 'Hashes below were checked locally now. Older full grading/source input inventories remain in the separately hashed execution manifest and receipts; this checkpoint did not re-run API, DB, or the entire older inventory.',
  files: [...paths].sort().map(file => ({ file: relative(file), sha256: sha(file), bytes: fs.statSync(file).size })),
};
const manifestFile = path.join(output, 'manifest.json');
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
let checkedLinks = 0;
const badLinks = [];
for (const file of [report, instruction]) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z]+:\/\//i.test(target)) continue;
    checkedLinks++;
    if (!fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(target)))) badLinks.push({ file: relative(file), target });
  }
}
assert.deepEqual(badLinks, []);
for (const file of manifest.files) assert.equal(sha(path.resolve(file.file)), file.sha256);
const checks = { checked_at: new Date().toISOString(), manifest_sha256: sha(manifestFile), files_verified: manifest.files.length,
  report_instruction_links_checked: checkedLinks, errors: [], model_api_calls: 0, database_calls: 0 };
fs.writeFileSync(path.join(output, 'checks.json'), JSON.stringify(checks, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ checkpoint: manifest.checkpoint_version, ...checks }));
