import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { E, hash, deriveCohorts, realIdentity } from '../stage-publication-v1.ts';
import { reviewedContentHash } from '../../../../../../questionReviewIdentity.ts';
import { loadPromotionLedger, validateAuthoringBank, validatePromotionLedger } from '../../../../../../questionBankPublication.ts';
import { buildGradingPrompt, buildGradingResponseSchema } from '../../../../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../../../../../../../lib/questionV3.ts';
const root = process.cwd(), here = path.dirname(fileURLToPath(import.meta.url));
const D = E.slice(0, E.lastIndexOf('/'));
const snapshots = new Map();
const read = file => { const bytes = fs.readFileSync(file); snapshots.set(file, bytes); return JSON.parse(bytes); };
const sourceFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const candidateFile = `${E}/candidate-v1/candidate-authoring.json`;
const original = read(sourceFile), candidate = read(candidateFile), scope = read(`${E}/candidate-v1/target-scope.json`).targets.map(t => t.set_id);
const previous = read(`${D}/canonical-before.json`);
const v7 = read(`${D}/prepared-reviewed-v7/candidate-authoring.json`);
const proposal = read(`${D}/prepared-reviewed-v7/notes-merge.json`);
read(`${D}/c/resume-review-2026-09-12/final-v7-integration-check.json`);
read(`${E}/live-before-publication-v1/unselected-diff-review-v2.json`);
const stripNotes = set => { const out = structuredClone(set); delete out.verification.notes; return out; };
const notesFromHistorical = original.filter(s => !isDeepStrictEqual(s.verification.notes, previous.find(p => p.id === s.id)?.verification.notes));
assert(original.every(s => isDeepStrictEqual(stripNotes(s), stripNotes(previous.find(p => p.id === s.id)))));
const unchanged = original.filter(s => !scope.includes(s.id));
const corrections = [];
for (const old of unchanged) {
    const next = candidate.find(s => s.id === old.id);
    if (isDeepStrictEqual(old, next)) continue;
    assert(isDeepStrictEqual(stripNotes(old), stripNotes(next)), `${old.id}: difference beyond notes`);
    assert.deepEqual(next.verification.notes, v7.find(s => s.id === old.id).verification.notes);
    const afterPath = 'cpa_uploader/analysis/reviews/question-review-2027/17.json';
    const beforePath = 'docs/archive/과거-검토-증거/reports/question-review-2027/17.json';
    assert.deepEqual(old.verification.notes.map(n => n.replace(beforePath, afterPath)), next.verification.notes);
    assert(fs.existsSync(afterPath));
    const changedDeclaration = proposal.changes.find(c => c.set_id === old.id);
    assert(changedDeclaration, `${old.id}: missing historical v7 note declaration`);
    const answers = Object.fromEntries(old.subquestions.map(q => [q.id, q.model_answer.join('\n')]));
    const promptA = buildGradingPrompt(old, answers), promptB = buildGradingPrompt(next, answers);
    assert.equal(promptA, promptB);
    assert.deepEqual(buildGradingResponseSchema(old, answers), buildGradingResponseSchema(next, answers));
    assert.deepEqual(compilePublicQuestionSet(old), compilePublicQuestionSet(next));
    corrections.push({ set_id: old.id, before_hash: reviewedContentHash(old), after_hash: reviewedContentHash(next),
        before_notes: old.verification.notes, after_notes: next.verification.notes,
        field: 'verification.notes', specific_before_path: beforePath, specific_after_path: afterPath,
        after_path_exists: true, historical_v7_change: changedDeclaration,
        grader_prompt_sha256: hash(promptA), schema_sha256: hash(JSON.stringify(buildGradingResponseSchema(old, answers))),
        public_sha256: hash(JSON.stringify(compilePublicQuestionSet(old))),
        rationale: 'Existing v7 migration correction only; not new content review, paid grading, or a newly waived receipt hash.' });
}
const cohorts = deriveCohorts(original, candidate, scope, corrections);
const ledgerFile = 'cpa_uploader/data/cpa_question_sets_v3.promotions.json';
read(ledgerFile);
const ledger = loadPromotionLedger(ledgerFile), staging = structuredClone(candidate);
for (const id of cohorts.reverify_existing_ids) {
    const old = original.find(s => s.id === id), next = staging.find(s => s.id === id);
    next.status = old.status; next.verification.review_status = old.verification.review_status;
}
const structureErrors = validateAuthoringBank(staging).errors;
assert.deepEqual(structureErrors, []);
const ledgerErrors = validatePromotionLedger(staging, ledger, false, { pendingReverificationIds: new Set(cohorts.reverify_existing_ids) });
assert.deepEqual(ledgerErrors, []);
const manifest = read(`${E}/candidate-v1/grading-manifest.json`);
const named = [sourceFile, ledgerFile, 'cpa_uploader/data/cpa_question_sets_v3.public.json', 'data/cpa_question_sets_v3.authoring.enc.json',
    'cpa_uploader/data/learning-question-classifications.json', candidateFile, `${E}/candidate-v1/classification-review.json`,
    `${E}/candidate-v1/target-scope.json`, `${E}/authorization.md`, `${E}/prepare-publication.ts`,
    `${E}/c/stage-publication-v1.ts`, `${E}/c/rebind-final-catalog.ts`, `${E}/c/publication-workflow-v1/inspect-and-freeze.mjs`,
    'cpa_uploader/promote_cpa_v3.ts', 'cpa_uploader/validate_cpa_v3.ts', 'scripts/compile-question-bank-v3.ts',
    'scripts/build-learning-unit-catalog.ts', 'scripts/import-question-bank-v3.ts', 'cpa_uploader/questionBankPublication.ts',
    'cpa_uploader/questionEfficientReview.ts', 'cpa_uploader/questionReviewIdentity.ts', 'lib/questionV3Encryption.ts',
    'cpa_uploader/analysis/coverage/registry.json', 'cpa_uploader/wiki/scripts/ox-study-order.mjs',
    'cpa_uploader/config/question-source-registry.json', 'package.json', 'package-lock.json',
    ...manifest.code_files.map(r => r.file), ...candidate.flatMap(s => s.source_refs.map(r => r.file)), ...snapshots.keys()];
const inputs = [...new Set(named)].sort().map(file => {
    const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (snapshots.has(file)) assert.equal(hash(bytes), hash(snapshots.get(file)));
    const full = realIdentity(path.resolve(root, file));
    return { file, sha256: bytes ? hash(bytes) : null, real_path: process.platform === 'win32' ? full.toLowerCase() : full };
});
const result = { status: 'offline_staging_preparation_only', checked_at: new Date().toISOString(),
    counts: { existing_reverify: cohorts.reverify_existing_ids.length, new_verify: cohorts.verify_new_ids.length, selected: scope.length,
        bank_sets: candidate.length, bank_questions: candidate.flatMap(s => s.subquestions).length, unselected: unchanged.length,
        unchanged_unselected_exact: unchanged.length - corrections.length, known_unselected_note_corrections: corrections.length,
        canonical_historical_note_migration_sets: notesFromHistorical.length },
    unselected_note_corrections: corrections, structure_errors: structureErrors, pending_reverification_ledger_errors: ledgerErrors,
    canonical_old_bytes_modified: false, staging_created: false, actual_promotion: false, model_calls: 0, db_calls: 0,
    limitations: ['No sealed grading batch was supplied. Actual efficient receipt acceptance is deferred to execution.',
        'Notes are in reviewedContentHash. Only the exact historical v7 correction is declared; any future byte drift is rejected.',
        'The imported core was used read-only in memory; pending-reverification is not a verified transition.'] };
fs.writeFileSync(path.join(here, 'input-inspection.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(here, 'preparation-lock.json'), JSON.stringify({ version: 1, created_at: result.checked_at,
    status: 'preparation_lock_not_execution_evidence', inputs, allowed_unselected_note_changes: corrections, cohorts }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...result.counts, guarded_files: inputs.length, errors: structureErrors.length + ledgerErrors.length, staging_created: false }));
