import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import type { LearningClassification } from '../lib/learningUnits.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { jsonHash, reviewedContentHash, sha256 } from '../cpa_uploader/questionReviewIdentity.ts';
import { createEfficientValidationContext, assertEfficientEvidenceUnchanged } from '../cpa_uploader/questionEfficientReview.ts';
import type { ReviewFile } from '../cpa_uploader/questionEfficientReview.ts';
import { createSubsetReviewReceipt, validateRecordedSubsetReview, verifyQuestionSubsetContracts, subsetReceiptIntegrityErrors } from '../cpa_uploader/questionSubsetReview.ts';
import type { SubsetReviewManifest, SubsetReviewReceipt } from '../cpa_uploader/questionSubsetReview.ts';
import { loadPromotionLedger, validatePromotionLedger } from '../cpa_uploader/questionBankPublication.ts';
import type { PromotionLedger } from '../cpa_uploader/questionBankPublication.ts';
import { offlineReviewReceipt } from './helpers/questionSemanticReviewFixture.ts';

const root = process.cwd();
const baseline = 'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const bank = JSON.parse(fs.readFileSync(path.join(root, baseline, 'bank.snapshot.json'), 'utf8')) as QuestionSetV3[];
const catalog = JSON.parse(fs.readFileSync(path.join(root, baseline, 'catalog.snapshot.json'), 'utf8')) as { classifications: LearningClassification[] };
const json = (x: unknown) => JSON.stringify(x, null, 2) + '\n';
const origin = () => structuredClone(bank.find(s => s.id === 'draft-standard-additional-20260913-e01')!);
const metadata = (source: QuestionSetV3) => catalog.classifications.filter(c => c.source_set_id === source.id)
    .map(c => ({ ...structuredClone(c), source_content_hash: contentHash(source) }));
function subset(source: QuestionSetV3, meta = metadata(source)) {
    const candidate = structuredClone(source);
    candidate.subquestions = [candidate.subquestions[0]]; candidate.learning_order = [candidate.subquestions[0].id];
    if (!candidate.subquestions[0].question_style) {
        const q = candidate.subquestions[0], m = meta.find(m => m.subquestion_id === q.id)!;
        q.question_style = m.question_style; q.topic_ids = m.topic_ids;
        if (m.question_style === 'standard') { q.prompt = m.standalone_prompt!; candidate.shared_context = { facts: [] }; }
    }
    return candidate;
}
const removed = (source: QuestionSetV3) => source.subquestions.slice(1).map(q => q.id);

test('only exact deletion survives: answers, criteria, sources, conditions, order, labels and deletion list are guarded', () => {
    const source = origin(), candidate = subset(source), meta = metadata(source);
    assert.equal(verifyQuestionSubsetContracts(source, candidate, meta, removed(source)).length, 1);
    const changes: Array<(s: QuestionSetV3) => void> = [
        s => { s.subquestions[0].model_answer[0] += ' 변경된 답안'; },
        s => { s.subquestions[0].criteria[0].claim += ' 추가 조건'; },
        s => { s.subquestions[0].criteria[0].scores.met += 1; },
        s => { s.subquestions[0].criteria[0].critical_facts[0].expected += ' 변경'; },
        s => { s.subquestions[0].requirements[0].source_quote += ' 변경'; },
        s => { s.source_refs[0].source_quote += ' 변경'; },
        s => { s.source_refs[0].file = 'another-source.txt'; },
        s => { s.subquestions[0].prompt += ' 새로운 요구'; },
        s => { s.subquestions[0].topic_ids = ['19']; },
        s => { s.subquestions[0].criteria.push(structuredClone(s.subquestions[0].criteria[0])); },
        s => { s.learning_order = []; },
        s => { s.status = 'verified'; },
        s => { s.verification.notes.push('새 검수처럼 표시'); },
    ];
    for (const change of changes) {
        const mutated = structuredClone(candidate); change(mutated);
        assert.throws(() => verifyQuestionSubsetContracts(source, mutated, meta, removed(source)));
    }
    for (const ids of [[], [candidate.subquestions[0].id], [...removed(source), ...removed(source)]]) {
        assert.throws(() => verifyQuestionSubsetContracts(source, candidate, meta, ids), /Deletion list/);
    }
    assert.throws(() => verifyQuestionSubsetContracts(source, source, meta, []), /proper subset/);
});

test('legacy singleton preserves its catalog standalone projection and refuses altered style/topic/prompt', () => {
    const source = structuredClone(bank.find(s => s.id === 'pilot-01-002')!), meta = metadata(source);
    assert.equal(source.subquestions[0].question_style, undefined);
    const candidate = subset(source, meta);
    const proof = verifyQuestionSubsetContracts(source, candidate, meta, removed(source));
    assert.equal(proof.length, 1); assert.equal(candidate.shared_context.facts.length, 0);
    assert.equal(candidate.subquestions[0].prompt, meta[0].standalone_prompt);
    const bad = structuredClone(candidate); bad.subquestions[0].prompt = source.subquestions[0].prompt + ' 새 조건';
    assert.throws(() => verifyQuestionSubsetContracts(source, bad, meta, removed(source)));
    const changedMeta = structuredClone(meta); changedMeta[0].source_content_hash = '0'.repeat(64);
    assert.throws(() => verifyQuestionSubsetContracts(source, candidate, changedMeta, removed(source)), /source hash/);
});

test('a retained case unit cannot silently lose a case peer', () => {
    const source = origin();
    source.shared_context.facts = [{ id: 'f1', text: '합성 격리 사례 사실', scoreable: false }];
    for (const q of source.subquestions) { q.question_style = 'case'; }
    const meta = metadata(source).map(m => ({ ...m, question_style: 'case' as const, case_set_id: source.id,
        standalone_prompt: null, case_fact_ids: ['f1'] }));
    assert.throws(() => verifyQuestionSubsetContracts(source, subset(source, meta), meta, removed(source)), /lost a peer/);
});

async function fixture() {
    const directory = fs.mkdtempSync(path.join(root, 'tests/.subset-fixture-'));
    const write = (name: string, value: unknown): ReviewFile => {
        const file = path.join(directory, name); fs.writeFileSync(file, json(value));
        return { file: path.relative(root, file).replace(/\\/g, '/'), sha256: sha256(fs.readFileSync(file)) };
    };
    const source = origin(), candidate = subset(source);
    const receipt = await offlineReviewReceipt(source, [source]); // Synthetic transport only; no real API or quality claim.
    const ledger: PromotionLedger = { version: 1, entries: [
        { set_id: source.id, from_status: 'needs_review', to_status: 'verified', date: '2026-09-14', evidence: 'TEST FIXTURE ONLY',
            content_hash: reviewedContentHash(source), semantic_review: receipt, review_receipt_hash: receipt.receipt_hash,
            review_summary: { units: receipt.units.length, cases: receipt.cases.length, method: receipt.execution.method, verdict: 'pass' } },
        { set_id: source.id, from_status: 'verified', to_status: 'published', date: '2026-09-14', evidence: 'TEST FIXTURE ONLY',
            content_hash: reviewedContentHash(source), review_receipt_hash: receipt.receipt_hash },
    ] };
    const bankFile = write('bank.json', [source]);
    const manifest: SubsetReviewManifest = { version: 1, artifact_type: 'question_deletion_derivation_manifest',
        bank: bankFile, catalog: write('catalog.json', { source_file_sha256: bankFile.sha256, classifications: metadata(source) }),
        promotions: write('promotions.json', ledger),
        authorization: { evidence: write('authorization.json', { authorization: 'TEST FIXTURE ONLY: question deletion and publication authorized' }),
            statement: 'TEST FIXTURE ONLY: question deletion and publication authorized', question_deletion_and_publication: true },
        targets: [{ set_id: source.id, source_content_hash: reviewedContentHash(source), content_hash: reviewedContentHash(candidate), removed_subquestion_ids: removed(source) }] };
    const run = () => createSubsetReviewReceipt(write('manifest.json', manifest), candidate);
    const cleanup = () => {
        const resolved = path.resolve(directory);
        assert(resolved.startsWith(path.resolve(root, 'tests') + path.sep) && path.basename(resolved).startsWith('.subset-fixture-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    };
    return { directory, write, source, candidate, ledger, manifest, run, cleanup };
}

test('a derivation receipt binds original published evidence and appends distinct verified/published records', async () => {
    const f = await fixture();
    try {
        const before = fs.readFileSync(path.resolve(root, f.manifest.promotions.file));
        const receipt = f.run();
        assert.deepEqual(subsetReceiptIntegrityErrors(receipt), []);
        assert.equal(receipt.method, 'question_deletion_contract_derivation');
        assert.equal(receipt.new_model_calls, 0); assert.equal(receipt.new_human_review, false);
        const ledger = structuredClone(f.ledger);
        ledger.entries.push({ set_id: f.candidate.id, from_status: 'published', to_status: 'verified', date: '2026-09-14', evidence: 'TEST deletion proof',
            content_hash: reviewedContentHash(f.candidate), subset_review: receipt, review_receipt_hash: receipt.receipt_hash,
            review_summary: { units: receipt.contracts.length, cases: 0, method: receipt.method, verdict: 'pass' } },
        { set_id: f.candidate.id, from_status: 'verified', to_status: 'published', date: '2026-09-14', evidence: 'TEST publication authorization',
            content_hash: reviewedContentHash(f.candidate), review_receipt_hash: receipt.receipt_hash });
        const saved = f.write('active-ledger.json', ledger);
        assert.deepEqual(validatePromotionLedger([f.candidate], loadPromotionLedger(path.resolve(root, saved.file)), true), []);
        assert.deepEqual(fs.readFileSync(path.resolve(root, f.manifest.promotions.file)), before);
        const superseded = structuredClone(ledger);
        superseded.entries.splice(f.ledger.entries.length, 0, { ...structuredClone(f.ledger.entries.at(-1)!), evidence: 'Newer approval after origin snapshot' });
        assert.match(validatePromotionLedger([f.candidate], superseded, true).join('\n'), /newer approval superseded/);
        superseded.entries.splice(f.ledger.entries.length + 1, 0, structuredClone(f.ledger.entries.at(-1)!));
        assert.match(validatePromotionLedger([f.candidate], superseded, true).join('\n'), /newer approval superseded/);
        const wrongLifecycle = structuredClone(ledger); wrongLifecycle.entries.at(-2)!.from_status = 'needs_review';
        assert.match(validatePromotionLedger([f.candidate], wrongLifecycle, true).join('\n'), /Invalid derivation lifecycle/);
        ledger.entries[0].evidence = 'rewritten old history';
        assert.match(validatePromotionLedger([f.candidate], ledger, true).join('\n'), /history was rewritten/);
        const changed = structuredClone(receipt); changed.contracts[0].prompt_sha256 = '0'.repeat(64);
        const body = { ...changed } as Partial<SubsetReviewReceipt>; delete body.receipt_hash; changed.receipt_hash = jsonHash(body);
        assert.match(validateRecordedSubsetReview(changed, f.candidate).join('\n'), /proof differs/);
        changed.receipt_hash = '0'.repeat(64);
        assert.ok(subsetReceiptIntegrityErrors(changed).length);
        const altered = structuredClone(f.candidate); altered.subquestions[0].model_answer[0] += ' new';
        assert.ok(validateRecordedSubsetReview(receipt, altered).length);
        const priorSubset = structuredClone(f.ledger);
        priorSubset.entries[0] = { ...priorSubset.entries[0], semantic_review: undefined, subset_review: receipt,
            content_hash: receipt.content_hash, review_receipt_hash: receipt.receipt_hash,
            review_summary: { units: receipt.contracts.length, cases: 0, method: receipt.method, verdict: 'pass' } };
        f.manifest.promotions = f.write('prior-subset.json', priorSubset);
        assert.throws(f.run, /prior subset origin is not supported/);
    } finally { f.cleanup(); }
});

test('tampered source snapshots, origin approvals, deletions, authorization and hash-bearing backfill are rejected', async () => {
    const f = await fixture();
    try {
        const original = structuredClone(f.manifest);
        const changes: Array<() => void> = [
            () => { f.manifest.bank.sha256 = '0'.repeat(64); },
            () => { f.manifest.catalog.sha256 = '0'.repeat(64); },
            () => { f.manifest.promotions.sha256 = '0'.repeat(64); },
            () => { f.manifest.targets[0].source_content_hash = '0'.repeat(64); },
            () => { f.manifest.targets[0].content_hash = '0'.repeat(64); },
            () => { f.manifest.targets[0].removed_subquestion_ids = []; },
            () => { f.manifest.authorization.statement = 'invented authorization'; },
            () => { const bad = structuredClone(f.ledger); bad.entries[0].semantic_review!.units[0].rationale = 'tampered'; f.manifest.promotions = f.write('bad-ledger.json', bad); },
            () => { const bad = structuredClone(f.ledger); delete bad.entries[0].semantic_review; delete bad.entries[0].review_receipt_hash; delete bad.entries[0].review_summary;
                f.manifest.promotions = f.write('bad-ledger.json', bad); },
            () => { const bad = structuredClone(f.ledger); delete bad.entries[0].semantic_review; delete bad.entries[0].review_receipt_hash; delete bad.entries[0].review_summary;
                delete bad.entries[0].content_hash; f.manifest.promotions = f.write('bad-ledger.json', bad); },
            () => { const bad = structuredClone(f.ledger); bad.entries.pop(); f.manifest.promotions = f.write('bad-ledger.json', bad); },
        ];
        for (const change of changes) { Object.assign(f.manifest, structuredClone(original)); change(); assert.throws(f.run); }
    } finally { f.cleanup(); }
});

test('manifest approval cache validates every origin once and remains bound to manifest and source bytes', async () => {
    const f = await fixture();
    try {
        const peer = structuredClone(f.source); peer.id += '-cache-peer';
        const peerReview = await offlineReviewReceipt(peer, [f.source, peer]);
        const peerMeta = metadata(f.source).map(m => ({ ...m, source_set_id: peer.id, source_content_hash: contentHash(peer) }));
        const peerCandidate = subset(peer, peerMeta);
        f.ledger.entries.push({ set_id: peer.id, from_status: 'needs_review', to_status: 'verified', date: '2026-09-14', evidence: 'TEST cache peer approval',
            content_hash: reviewedContentHash(peer), semantic_review: peerReview, review_receipt_hash: peerReview.receipt_hash,
            review_summary: { units: peerReview.units.length, cases: peerReview.cases.length, method: peerReview.execution.method, verdict: 'pass' } },
        { set_id: peer.id, from_status: 'verified', to_status: 'published', date: '2026-09-14', evidence: 'TEST cache peer publication',
            content_hash: reviewedContentHash(peer), review_receipt_hash: peerReview.receipt_hash });
        f.manifest.bank = f.write('cache-bank.json', [f.source, peer]);
        f.manifest.catalog = f.write('cache-catalog.json', { source_file_sha256: f.manifest.bank.sha256, classifications: [...metadata(f.source), ...peerMeta] });
        f.manifest.promotions = f.write('cache-promotions.json', f.ledger);
        f.manifest.targets.push({ set_id: peer.id, source_content_hash: reviewedContentHash(peer), content_hash: reviewedContentHash(peerCandidate), removed_subquestion_ids: removed(peer) });
        const manifest = f.write('cache-manifest.json', f.manifest);
        class EvidenceMap extends Map<string, string> {
            scans = 0;
            override [Symbol.iterator]() { this.scans++; return super[Symbol.iterator](); }
        }
        const context = createEfficientValidationContext(), files = new EvidenceMap(); context.files = files;
        const tracked = f.write('tracked-origin-source.json', { original_source_evidence: true });
        files.set(path.resolve(root, tracked.file), tracked.sha256);
        const first = createSubsetReviewReceipt(manifest, f.candidate, context);
        assert.equal(files.scans, 1, 'the complete origin batch must run one full evidence guard');
        const second = createSubsetReviewReceipt(manifest, peerCandidate, context);
        assert.deepEqual(createSubsetReviewReceipt(manifest, f.candidate, context), first);
        assert.equal(files.scans, 1, 'other targets and repeated receipts must not rescan all origin evidence');
        assert.deepEqual(second, createSubsetReviewReceipt(manifest, peerCandidate), 'fresh and cached receipts are identical');
        assertEfficientEvidenceUnchanged(context); assert.equal(files.scans, 2, 'the transaction final guard is still mandatory');

        const copiedManifest = f.write('copied-manifest.json', f.manifest);
        createSubsetReviewReceipt(copiedManifest, f.candidate, context);
        assert.equal(files.scans, 3, 'a different manifest identity requires its own whole-origin validation');
        const poisoned = structuredClone(f.manifest); poisoned.targets[1].source_content_hash = '0'.repeat(64);
        assert.throws(() => createSubsetReviewReceipt(f.write('poisoned-manifest.json', poisoned), f.candidate, context), /Original reviewed content hash differs/,
            'a bad peer approval must fail the first target, before any cached current-target receipt can bypass it');

        const changedBank = path.resolve(root, f.manifest.bank.file), originalBytes = fs.readFileSync(changedBank);
        fs.appendFileSync(changedBank, '\n');
        assert.throws(() => createSubsetReviewReceipt(manifest, f.candidate, context), /Changed subset evidence/);
        fs.writeFileSync(changedBank, originalBytes);
        const changedLedger = path.resolve(root, f.manifest.promotions.file), ledgerBytes = fs.readFileSync(changedLedger);
        fs.appendFileSync(changedLedger, '\n');
        assert.throws(() => createSubsetReviewReceipt(manifest, f.candidate, context), /Changed subset evidence/);
        fs.writeFileSync(changedLedger, ledgerBytes);

        fs.appendFileSync(path.resolve(root, tracked.file), '\n');
        createSubsetReviewReceipt(manifest, f.candidate, context);
        assert.throws(() => assertEfficientEvidenceUnchanged(context), /Evidence changed during validation/,
            'a cached origin cannot waive the final guard for tracked source files not reread by the current target');
    } finally { f.cleanup(); }
});

test('actual efficient origin supports the unchanged legacy singleton; catalog spoofing and source changes cannot pass', () => {
    const directory = fs.mkdtempSync(path.join(root, 'tests/.subset-real-origin-'));
    try {
        const identity = (file: string) => ({ file, sha256: sha256(fs.readFileSync(path.resolve(root, file))) });
        const source = structuredClone(bank.find(s => s.id === 'pilot-01-002')!), candidate = subset(source);
        const evidence = identity(`${baseline}/baseline.json`);
        const manifest: SubsetReviewManifest = { version: 1, artifact_type: 'question_deletion_derivation_manifest',
            bank: identity(`${baseline}/bank.snapshot.json`), catalog: identity(`${baseline}/catalog.snapshot.json`),
            promotions: identity(`${baseline}/promotions.snapshot.json`), authorization: { evidence,
                statement: JSON.parse(fs.readFileSync(path.resolve(root, evidence.file), 'utf8')).authorization, question_deletion_and_publication: true },
            targets: [{ set_id: source.id, source_content_hash: reviewedContentHash(source), content_hash: reviewedContentHash(candidate), removed_subquestion_ids: removed(source) }] };
        const file = path.relative(root, path.join(directory, 'manifest.json')).replace(/\\/g, '/'); fs.writeFileSync(path.resolve(root, file), json(manifest));
        const context = createEfficientValidationContext();
        const receipt = createSubsetReviewReceipt(identity(file), candidate, context);
        assert.equal(receipt.contracts.length, 1); assertEfficientEvidenceUnchanged(context);
        const altered = JSON.parse(fs.readFileSync(path.resolve(root, manifest.catalog.file), 'utf8'));
        const m = altered.classifications.find((m: LearningClassification) => m.source_set_id === source.id && m.subquestion_id === candidate.subquestions[0].id);
        m.standalone_prompt += ' 다른 요구'; candidate.subquestions[0].prompt = m.standalone_prompt;
        const alteredFile = path.relative(root, path.join(directory, 'catalog.json')).replace(/\\/g, '/'); fs.writeFileSync(path.resolve(root, alteredFile), json(altered));
        manifest.catalog = identity(alteredFile); manifest.targets[0].content_hash = reviewedContentHash(candidate);
        fs.writeFileSync(path.resolve(root, file), json(manifest));
        assert.throws(() => createSubsetReviewReceipt(identity(file), candidate, createEfficientValidationContext()), /reviewed learning projection differs/);
    } finally {
        const resolved = path.resolve(directory); assert(resolved.startsWith(path.resolve(root, 'tests') + path.sep) && path.basename(resolved).startsWith('.subset-real-origin-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
});

test('CLI exposes only explicit reverify subset route and keeps isolated paths untouched on invalid invocation', () => {
    const result = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'cpa_uploader/promote_cpa_v3.ts',
        '--subset-review', 'missing.json', '--to', 'published'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /--reverify --to verified/);
});

test('isolated CLI appends derivation transitions, leaves origin bytes intact and refuses a changed answer', async () => {
    const f = await fixture();
    try {
        // No production approvals are created. Historical peer entries here are
        // synthetic fixtures solely to satisfy the CLI whole-bank lifecycle gate.
        const originalLedger: PromotionLedger = { version: 1, entries: [
            ...bank.filter(s => s.id !== f.source.id).flatMap(s => [
                { set_id: s.id, from_status: 'needs_review', to_status: 'verified' as const, date: '2026-09-14', evidence: 'TEST historical peer fixture' },
                { set_id: s.id, from_status: 'verified', to_status: 'published' as const, date: '2026-09-14', evidence: 'TEST historical peer fixture' },
            ]), ...f.ledger.entries,
        ] };
        f.manifest.promotions = f.write('original-cli-ledger.json', originalLedger);
        const manifest = f.write('cli-manifest.json', f.manifest);
        const candidates = bank.map(s => s.id === f.source.id ? structuredClone(f.candidate) : structuredClone(s));
        const authoring = f.write('candidate.json', candidates), ledger = f.write('cli-ledger.json', originalLedger);
        const env = { ...process.env, CPA_QUESTION_V3_AUTHORING_PATH: path.resolve(root, authoring.file),
            CPA_QUESTION_V3_PROMOTIONS_PATH: path.resolve(root, ledger.file), CPA_QUESTION_V3_PUBLIC_PATH: path.join(f.directory, 'public.json'),
            CPA_QUESTION_V3_ENCRYPTED_PATH: path.join(f.directory, 'encrypted.json') };
        const call = (args: string[]) => spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'cpa_uploader/promote_cpa_v3.ts',
            ...args, '--sets', f.source.id, '--evidence', 'TEST FIXTURE ONLY: explicit deletion/publication'], { cwd: root, env, encoding: 'utf8', timeout: 120_000 });
        const originalBytes = fs.readFileSync(path.resolve(root, f.manifest.promotions.file));
        const verified = call(['--to', 'verified', '--reverify', '--subset-review', manifest.file]);
        assert.equal(verified.status, 0, verified.stdout + verified.stderr);
        const published = call(['--to', 'published']);
        assert.equal(published.status, 0, published.stdout + published.stderr);
        const active = loadPromotionLedger(path.resolve(root, ledger.file));
        assert.equal(active.entries.length, originalLedger.entries.length + 2);
        assert.deepEqual(active.entries.slice(0, originalLedger.entries.length), originalLedger.entries);
        assert.equal(active.entries.at(-2)!.subset_review!.new_model_calls, 0);
        assert.deepEqual(fs.readFileSync(path.resolve(root, f.manifest.promotions.file)), originalBytes);
        const changed = JSON.parse(fs.readFileSync(path.resolve(root, authoring.file), 'utf8')) as QuestionSetV3[];
        changed.find(s => s.id === f.source.id)!.subquestions[0].model_answer[0] += ' 변경 답안';
        fs.writeFileSync(path.resolve(root, authoring.file), json(changed));
        const beforeLedger = fs.readFileSync(path.resolve(root, ledger.file));
        const failed = call(['--to', 'verified', '--reverify', '--subset-review', manifest.file]);
        assert.notEqual(failed.status, 0); assert.match(failed.stderr, /Final subset hash differs/);
        assert.deepEqual(fs.readFileSync(path.resolve(root, ledger.file)), beforeLedger);
    } finally { f.cleanup(); }
});
