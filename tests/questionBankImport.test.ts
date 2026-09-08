import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectBankSnapshot } from '../scripts/import-question-bank-v3.ts';
import { compilePublicQuestionSet } from '../lib/questionV3.ts';
import { sampleQuestionSet } from './helpers/cpaLearningDatabase.ts';

test('bank import requires matching public snapshot and final all-policy without changing source content', () => {
    const set = sampleQuestionSet();
    const raw = JSON.stringify([set]);
    const publicRaw = JSON.stringify([compilePublicQuestionSet(set)]);
    const checked = inspectBankSnapshot(raw, publicRaw, { verifySourceQuotes: false });
    assert.equal(checked.report.ready, true);
    assert.equal(checked.report.set_count, 1);
    assert.equal(checked.report.criterion_count, 2);
    const legacy = structuredClone(set);
    legacy.subquestions[0].constraints.max_entries = 2;
    const before = JSON.stringify(legacy);
    const refused = inspectBankSnapshot(JSON.stringify([legacy]), JSON.stringify([compilePublicQuestionSet(legacy)]), { verifySourceQuotes: false });
    assert.equal(refused.report.ready, false);
    assert.deepEqual(refused.report.legacy_policy_subquestions, [`${set.id}/sub1`]);
    assert.equal(JSON.stringify(legacy), before);
    assert.equal(inspectBankSnapshot(raw, '[]', { verifySourceQuotes: false }).report.ready, false);
    assert.notEqual(checked.report.bank_content_hash, inspectBankSnapshot(raw, publicRaw, { verifySourceQuotes: false, applicability: { exam_year: 2027, status: 'assumed' } }).report.bank_content_hash);
});

test('bank readiness refuses a stale quote hash before any database import', () => {
    const set = sampleQuestionSet();
    set.source_refs[0].content_hash = '0'.repeat(64);
    const raw = JSON.stringify([set]);
    const checked = inspectBankSnapshot(raw, JSON.stringify([compilePublicQuestionSet(set)]), { verifySourceQuotes: false });
    assert.equal(checked.report.ready, false);
    assert.deepEqual(checked.report.source_hash_mismatches, [`${set.id}/src1`]);
    assert.match(checked.report.errors.join('\n'), /SHA-256/);
    assert.equal(JSON.stringify(checked.sets), raw);
});

test('bank readiness rejects a source fidelity outside the persisted contract', () => {
    const set = sampleQuestionSet();
    const raw = JSON.stringify([set]).replace('"source_fidelity":"exact"', '"source_fidelity":"invalid"');
    const checked = inspectBankSnapshot(raw, JSON.stringify([compilePublicQuestionSet(set)]), { verifySourceQuotes: false });
    assert.equal(checked.report.ready, false);
    assert.match(checked.report.errors.join('\n'), /source_fidelity/);
});

test('explicit source-preserving import skips content review without rewriting the identified source', () => {
    const set = sampleQuestionSet();
    set.verification.source_fidelity = 'excerpt';
    set.source_refs[0].content_hash = 'previously-declared-hash';
    set.subquestions[0].constraints = { ordered: true, max_entries: 2, overflow_policy: 'ignore_after_limit' };
    const raw = JSON.stringify([set]);
    const checked = inspectBankSnapshot(raw, JSON.stringify([compilePublicQuestionSet(set)]), { contentReview: false });
    assert.equal(checked.report.ready, true);
    assert.equal(checked.report.content_review_performed, false);
    assert.equal(JSON.stringify(checked.sets), raw);
    assert.equal(inspectBankSnapshot(raw, '[]', { contentReview: false }).report.ready, false);
});
