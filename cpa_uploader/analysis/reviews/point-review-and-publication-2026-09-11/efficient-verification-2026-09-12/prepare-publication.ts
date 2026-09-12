import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import type { QuestionSetV3 } from '../../../../../lib/questionV3.ts';
import { reviewedContentHash, sha256 } from '../../../../questionReviewIdentity.ts';
import { validateAuthoringBank, validatePromotionLedger } from '../../../../questionBankPublication.ts';
import type { PromotionLedger } from '../../../../questionBankPublication.ts';
import { createEfficientReviewReceipt, createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../../../../questionEfficientReview.ts';
const root = process.cwd(), here = path.dirname(fileURLToPath(import.meta.url));
const rel = (file: string) => path.relative(root, file).replace(/\\/g, '/');
const identity = (file: string) => ({ file: rel(file), sha256: sha256(fs.readFileSync(file)) });
const snapshots = new Map<string, Buffer>();
const read = <T>(file: string): T => { const bytes = fs.readFileSync(file); snapshots.set(file, bytes); return JSON.parse(bytes.toString('utf8')) as T; };
function argument(name: string) { const index = process.argv.indexOf(name); const value = index < 0 ? null : process.argv[index + 1]; assert(value && !value.startsWith('--'), `Missing ${name}`); return path.resolve(value); }
const batchFile = argument('--batch'), output = argument('--output');
assert(!fs.existsSync(output), 'Publication staging output exists');
const canonical = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const ledgerFile = path.join(root, 'cpa_uploader/data/cpa_question_sets_v3.promotions.json');
const candidate = path.join(here, 'candidate-v1/candidate-authoring.json');
const original = read<QuestionSetV3[]>(canonical), sets = read<QuestionSetV3[]>(candidate);
const selected = read<{ targets: { set_id: string }[] }>(path.join(here, 'candidate-v1/target-scope.json')).targets.map(t => t.set_id);
const ledger = read<PromotionLedger>(ledgerFile);
const guard = [...snapshots].map(([file, bytes]) => ({ file: rel(file), sha256: sha256(bytes) }));
guard.push(identity(batchFile));
const context = createEfficientValidationContext();
for (const id of selected) createEfficientReviewReceipt(identity(batchFile), sets.find(s => s.id === id)!, context);
const reverify = selected.filter(id => original.some(s => s.id === id)), verify = selected.filter(id => !reverify.includes(id));
for (const id of reverify) {
    const previous = original.find(s => s.id === id)!;
    assert(['verified', 'published'].includes(previous.status));
    assert(ledger.entries.some(e => e.set_id === id && e.to_status === 'verified'));
    const next = sets.find(s => s.id === id)!;
    const before = reviewedContentHash(next);
    // Only the actual prior lifecycle labels are restored in isolated staging.
    // The explicit reverify transition below must validate the changed content.
    next.status = previous.status; next.verification.review_status = previous.verification.review_status;
    assert.equal(reviewedContentHash(next), before);
}
for (const id of verify) {
    const next = sets.find(s => s.id === id)!;
    assert.equal(next.status, 'needs_review'); assert.equal(next.verification.review_status, 'needs_human_review');
    assert(!ledger.entries.some(e => e.set_id === id));
}
assert.deepEqual(validateAuthoringBank(sets).errors, []);
assert.deepEqual(validatePromotionLedger(sets, ledger, false, { pendingReverificationIds: new Set(reverify) }), []);
assertEfficientEvidenceUnchanged(context);
for (const input of guard) assert.equal(sha256(fs.readFileSync(path.resolve(root, input.file))), input.sha256);
fs.mkdirSync(output, { recursive: true });
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(output, 'before-canonical.json'), snapshots.get(canonical)!, { flag: 'wx' });
fs.writeFileSync(path.join(output, 'before-promotions.json'), snapshots.get(ledgerFile)!, { flag: 'wx' });
write('authoring.json', sets); write('promotions.json', ledger);
write('cohorts.json', { version: 1, status: 'isolated_staging_not_promoted', batch: identity(batchFile), inputs: guard,
    reverify_existing_ids: reverify, verify_new_ids: verify, publish_ids: selected,
    rationale: 'Prior lifecycle and all old ledger entries are preserved. Changed existing content requires explicit reverify; new IDs use the ordinary needs_review transition. No canonical or DB writes occurred.' });
assertEfficientEvidenceUnchanged(context);
for (const input of guard) assert.equal(sha256(fs.readFileSync(path.resolve(root, input.file))), input.sha256);
console.log(JSON.stringify({ output: rel(output), existing_reverify: reverify.length, new_verify: verify.length, selected: selected.length, canonical_writes: 0, db_writes: 0 }));
