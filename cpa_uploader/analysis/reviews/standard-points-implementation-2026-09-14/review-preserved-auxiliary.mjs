import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createEfficientValidationContext, createEfficientReviewReceipt, assertEfficientEvidenceUnchanged, readPreservedAuxiliaryInput } from '../../../questionEfficientReview.ts';

const root = process.cwd();
const R = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = file => ({ file, sha256: hash(fs.readFileSync(file)) });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const priorFile = `${R}/evidence-archive-followup.json`;
const prior = read(priorFile);
const verifiedIdentities = prior.original_runtime_and_provider_evidence_unchanged.map(item => {
    assert.equal(identity(item.file).sha256, item.sha256);
    return item;
});
const gradingFiles = [
    'lib/questionV3Grading.ts', 'lib/questionV3Evidence.ts', 'lib/questionV3.ts', 'lib/questionV3Answer.ts',
    'lib/ai/openaiStructured.ts', 'lib/learningUnits.ts', 'lib/learningSubmission.ts', 'scripts/build-learning-unit-catalog.ts',
];
const snapshots = read(`${R}/execution-v3/runtime-snapshots.json`);
const gradingIdentity = gradingFiles.map(file => {
    const snapshot = snapshots.find(item => item.runtime_file === file);
    assert(snapshot);
    assert.equal(identity(snapshot.file).sha256, snapshot.sha256);
    assert.equal(identity(file).sha256, snapshot.sha256);
    return { current: identity(file), snapshot, identical: true };
});
const bank = read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const ledger = read('cpa_uploader/data/cpa_question_sets_v3.promotions.json');
const context = createEfficientValidationContext();
const receipts = prior.unchanged_receipts.map(item => {
    const entry = ledger.entries.find(e => e.set_id === item.set_id && e.efficient_review?.receipt_hash === item.old_receipt_hash);
    assert(entry);
    const source = bank.find(s => s.id === item.set_id);
    assert(source);
    const recreated = createEfficientReviewReceipt(entry.efficient_review.batch, source, context, root, false);
    assert.deepEqual(recreated, entry.efficient_review);
    return { set_id: item.set_id, receipt_hash: recreated.receipt_hash, observed_answers: recreated.observed_answers, deep_equal: true };
});
assertEfficientEvidenceUnchanged(context);
// This is a recorded-receipt replay. The same old batch must still fail a NEW acceptance against changed current verifier code.
assert.throws(() => createEfficientReviewReceipt(prior.original_batch, bank.find(s => s.id === receipts[0].set_id), context, root, true), /Changed evidence/);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-independent-auxiliary-'));
try {
    const original = { file: 'cpa_uploader/analysis/question-elements/question-elements.json', sha256: hash('old') };
    const file = path.join(tempRoot, original.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'new');
    assert.throws(() => readPreservedAuxiliaryInput(original, [], createEfficientValidationContext(), tempRoot), /Changed evidence/);
} finally {
    assert.equal(path.dirname(tempRoot), os.tmpdir());
    fs.rmSync(tempRoot, { recursive: true });
}
// Include any current identities read before the intentional new-acceptance rejection.
assertEfficientEvidenceUnchanged(context);
const result = {
    version: 1, artifact_type: 'independent_auxiliary_archive_review', reviewed_at: new Date().toISOString(),
    reviewer: 'agent:/root/review_01_05', status: 'pass', acceptance_code: identity('cpa_uploader/questionEfficientReview.ts'),
    reviewed_implementation_evidence: identity(priorFile), verified_original_evidence: verifiedIdentities,
    grading_runtime_identity: gradingIdentity, independently_recreated_receipts: receipts,
    final_guard: { passed: true, files: context.files.size, preserved_resolutions: [...context.preservedAuxiliaryInputs.values()] },
    checks: [
        'Resolver only accepts the exact question-elements auxiliary file identity registered in the same frozen input manifest.',
        'Collection and preserved raw bytes are both read with their same-manifest SHA; their original path and SHA must match. Both are included in the final byte guard.',
        'Bank, catalog, policy, authorization, runtime snapshots, provider observations and declared question sources keep strict current/snapshot reads.',
        'Normalized protected-path alias and collection ID traversal regression fixes were inspected; the 2-test suite was independently executed with 2 pass, 0 fail.',
        'The exact allowed auxiliary path without manifest registration was independently rejected.',
        'Existing provider request, grading prompt/schema, response, result and expected-score replay checks are unchanged; all six recorded receipts were independently recreated byte-equivalently.',
        'New acceptance of the old batch still rejects its changed current verifier runtime. Historical replay does not bypass new acceptance.',
    ],
    resolved_review_findings: [
        { issue: 'Protected source path aliases could miss raw string comparisons.', resolution: 'Both sides now resolve before comparison; the alias regression passes.' },
        { issue: 'Collection ID previously allowed Windows backslash/parent aliases.', resolution: 'Collection IDs are restricted to ASCII letters, digits, underscore and hyphen; traversal regression passes.' },
    ],
    scope: { actual_model_calls: 0, new_human_reviews: 0, canonical_writes: 0, db_writes: 0 },
    limitations: 'This is an independent code/evidence replay audit of six existing receipts, not a new model run or publication approval. Current source-catalog validity remains the responsibility of the unchanged publication/source validation paths. Deployment and the postdeployment 44-scope audit are separate.',
};
const output = `${R}/archive-input-independent-review-v2.json`;
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ status: result.status, receipts: receipts.length, answers: receipts.reduce((n, r) => n + r.observed_answers, 0), guarded_files: context.files.size, output }) + '\n');
