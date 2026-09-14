import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { QuestionSetV3 } from '../lib/questionV3.ts';
import { contentHash } from '../lib/learningSubmission.ts';
import { learningUnitId, selectLearningQuestionSet, validateLearningClassification } from '../lib/learningUnits.ts';
import type { LearningClassification } from '../lib/learningUnits.ts';
import { buildGradingPrompt, buildGradingResponseSchema } from '../lib/questionV3Grading.ts';
import { jsonHash, reviewedContentHash, sha256 } from './questionReviewIdentity.ts';
import { createEfficientValidationContext, EFFICIENT_RUNTIME_FILES } from './questionEfficientReview.ts';
import type { EfficientValidationContext, ReviewFile, EfficientReviewBatch, GradingManifest } from './questionEfficientReview.ts';
import { loadPromotionLedger, validatePromotionLedger } from './questionBankPublication.ts';
import type { PromotionLedger } from './questionBankPublication.ts';

export interface SubsetReviewTarget {
    set_id: string; source_content_hash: string; content_hash: string; removed_subquestion_ids: string[];
}
export interface SubsetReviewManifest {
    version: 1; artifact_type: 'question_deletion_derivation_manifest';
    bank: ReviewFile; catalog: ReviewFile; promotions: ReviewFile;
    authorization: { evidence: ReviewFile; statement: string; question_deletion_and_publication: true };
    targets: SubsetReviewTarget[];
}
interface ContractIdentity {
    learning_unit_id: string; subquestion_ids: string[]; question_contract_hash: string;
    prompt_sha256: string; schema_hash: string;
}
/** A proof of deletion and unchanged contracts, never a new model or human review. */
export interface SubsetReviewReceipt {
    version: 1; method: 'question_deletion_contract_derivation'; set_id: string; content_hash: string;
    manifest: ReviewFile; origin: { bank: ReviewFile; catalog: ReviewFile; promotions: ReviewFile;
        set_id: string; content_hash: string; review_receipt_hash: string };
    authorization: SubsetReviewManifest['authorization']; removed_subquestion_ids: string[];
    retained_subquestion_ids: string[]; contracts: ContractIdentity[]; runtime_files: ReviewFile[];
    new_model_calls: 0; new_human_review: false; receipt_hash: string;
}

const equal = (a: unknown, b: unknown, reason: string) => assert.equal(contentHash(a), contentHash(b), reason);
const validHash = (x: unknown): x is string => typeof x === 'string' && /^[a-f\d]{64}$/.test(x);
const nonempty = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;
const identityValid = (x: ReviewFile) => x && nonempty(x.file) && validHash(x.sha256);
const documents = new WeakMap<EfficientValidationContext, Map<string, unknown>>();
const originalLedgers = new WeakMap<EfficientValidationContext, Map<string, PromotionLedger>>();
const validatedOriginManifests = new WeakMap<EfficientValidationContext, Set<string>>();
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

function readEvidence(identity: ReviewFile, context: EfficientValidationContext, root: string): Buffer {
    assert(identityValid(identity), 'Subset evidence file/hash required');
    const file = path.resolve(root, identity.file), relative = path.relative(root, file);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Subset evidence must stay inside root');
    const bytes = fs.readFileSync(file);
    assert.equal(sha256(bytes), identity.sha256, `Changed subset evidence: ${identity.file}`);
    assert(!context.files.has(file) || context.files.get(file) === identity.sha256, 'Conflicting subset evidence identity');
    context.files.set(file, identity.sha256);
    return bytes;
}
function readJson<T>(identity: ReviewFile, context: EfficientValidationContext, root: string): T {
    const bytes = readEvidence(identity, context, root), key = path.resolve(root, identity.file) + ':' + identity.sha256;
    if (!documents.has(context)) documents.set(context, new Map());
    const cache = documents.get(context)!;
    if (!cache.has(key)) cache.set(key, freeze(JSON.parse(bytes.toString('utf8'))));
    return cache.get(key) as T;
}
const metaContract = (m: LearningClassification) => ({ question_style: m.question_style, topic_ids: m.topic_ids,
    standalone_prompt: m.standalone_prompt, case_fact_ids: m.case_fact_ids ?? [] });

function originalApproval(source: QuestionSetV3, target: SubsetReviewTarget, ledger: PromotionLedger) {
    assert(validHash(target.source_content_hash) && validHash(target.content_hash), 'Subset target and hashes required');
    assert.equal(reviewedContentHash(source), target.source_content_hash, 'Original reviewed content hash differs');
    const verified = ledger.entries.filter(e => e.set_id === source.id && e.to_status === 'verified').at(-1);
    assert(verified && !verified.subset_review, 'A prior subset origin is not supported; re-review required');
    assert(verified.content_hash && (verified.semantic_review || verified.efficient_review), 'Original actual semantic/efficient receipt required; historical backfill cannot be inherited');
    assert.equal(verified.content_hash, target.source_content_hash, 'Original approval hash differs');
    const originLast = ledger.entries.filter(e => e.set_id === source.id).at(-1);
    assert(originLast?.to_status === 'published' && originLast.from_status === 'verified'
        && originLast.review_receipt_hash === verified.review_receipt_hash, 'Original publication transition is not bound to its latest review');
    return verified;
}

function validateOriginManifestOnce(manifestFile: ReviewFile, manifest: SubsetReviewManifest,
    bank: QuestionSetV3[], ledger: PromotionLedger, context: EfficientValidationContext, root: string): void {
    // File reads above this call still check current bytes on every receipt. This
    // cache only avoids repeatedly replaying the same complete set of approvals
    // and scanning every accumulated evidence file once for each subset target.
    const key = jsonHash({ root: path.resolve(root), manifest: manifestFile, bank: manifest.bank,
        catalog: manifest.catalog, promotions: manifest.promotions });
    if (!validatedOriginManifests.has(context)) validatedOriginManifests.set(context, new Set());
    const validated = validatedOriginManifests.get(context)!;
    if (validated.has(key)) return;
    const origins = manifest.targets.map(target => {
        const source = bank.find(s => s.id === target.set_id);
        assert(source, 'Original set missing from manifest approval batch');
        originalApproval(source, target, ledger); // Reject recursion/backfill before ledger validation.
        return source;
    });
    const errors = validatePromotionLedger(origins, ledger, true, { efficientContext: context, root });
    assert.deepEqual(errors, [], 'Original published approval batch failed revalidation');
    validated.add(key); // Never cache an incomplete or failed approval batch.
    // Callers must retain assertEfficientEvidenceUnchanged(context) at the final
    // transaction boundary; cached approvals do not waive the final byte guard.
}

/** Exported for isolated boundary tests; production receipts also verify origin approvals. */
export function verifyQuestionSubsetContracts(source: QuestionSetV3, candidate: QuestionSetV3,
    metadata: LearningClassification[], removedIds: string[]): ContractIdentity[] {
    assert.equal(source.status, 'published', 'Subset origin must be published');
    assert.equal(source.verification.review_status, 'verified', 'Subset origin must be verified');
    assert(candidate.subquestions.length > 0 && candidate.subquestions.length < source.subquestions.length, 'A nonempty proper subset is required');
    const originalIds = source.subquestions.map(q => q.id), kept = candidate.subquestions.map(q => q.id);
    assert.equal(new Set(originalIds).size, originalIds.length, 'Duplicate original question');
    assert.equal(new Set(kept).size, kept.length, 'Duplicate retained question');
    assert(kept.every(id => originalIds.includes(id)), 'New question cannot inherit review');
    equal(kept, originalIds.filter(id => kept.includes(id)), 'Retained question order changed');
    equal(removedIds, originalIds.filter(id => !kept.includes(id)), 'Deletion list differs from exact removed questions');
    assert.equal(metadata.length, source.subquestions.length, 'Complete original catalog projection required');
    assert.equal(new Set(metadata.map(m => m.subquestion_id)).size, metadata.length, 'Duplicate catalog question');
    for (const m of metadata) {
        validateLearningClassification(m);
        assert.equal(m.source_set_id, source.id, 'Catalog source set differs');
        assert(originalIds.includes(m.subquestion_id), 'Catalog contains unknown question');
        assert.equal(m.source_content_hash, contentHash(source), 'Catalog original source hash differs');
        const q = source.subquestions.find(q => q.id === m.subquestion_id)!;
        if (q.question_style) {
            assert.equal(q.question_style, m.question_style, 'Embedded style differs from original catalog');
            equal(q.topic_ids, m.topic_ids, 'Embedded topics differ from original catalog');
            if (m.question_style === 'standard') assert.equal(q.prompt, m.standalone_prompt, 'Embedded standalone prompt differs');
        }
    }
    const expected = structuredClone(source);
    expected.subquestions = expected.subquestions.filter(q => kept.includes(q.id));
    expected.learning_order = source.learning_order.filter(id => kept.includes(id));
    if (expected.subquestions.length === 1 && !expected.subquestions[0].question_style) {
        const q = expected.subquestions[0], m = metadata.find(m => m.subquestion_id === q.id)!;
        q.question_style = m.question_style; q.topic_ids = [...m.topic_ids];
        if (m.question_style === 'standard') { q.prompt = m.standalone_prompt!; expected.shared_context = { facts: [] }; }
    }
    // This full object comparison includes answers, options, requirements, criteria,
    // point rules, conditions, references and all set-level context and labels.
    equal(candidate, expected, 'Only deletion and the exact legacy singleton projection may change');
    const units = new Map<string, LearningClassification[]>();
    for (const m of metadata.filter(m => kept.includes(m.subquestion_id))) {
        const id = learningUnitId(source.id, m.question_style, m.subquestion_id);
        units.set(id, [...(units.get(id) ?? []), m]);
    }
    return [...units].map(([id, members]) => {
        // A case unit must retain its full context and peer questions. Removing a
        // case peer changes the model request even when one answer is unmodified.
        const originalMembers = metadata.filter(m => learningUnitId(source.id, m.question_style, m.subquestion_id) === id);
        equal(members.map(m => m.subquestion_id), originalMembers.map(m => m.subquestion_id), 'Retained learning unit lost a peer question');
        const before = selectLearningQuestionSet(source, originalMembers, id);
        const after = selectLearningQuestionSet(candidate, members, id);
        const contract = (set: QuestionSetV3) => ({ facts: set.shared_context.facts, subquestions: set.subquestions.map(q => {
            const clone = structuredClone(q); delete clone.question_style; delete clone.topic_ids; return clone;
        }) });
        equal(contract(before), contract(after), 'Full grading question contract changed');
        // The same arbitrary answer variable in each question proves prompt/schema
        // construction is identical; the full object comparison above covers fields
        // that happen not to be rendered in these two builders today.
        const answers = Object.fromEntries(before.subquestions.map(q => [q.id, `CONTRACT_VARIABLE_${q.id}\n부분 답안. 경계 조건.`]));
        const prompt = buildGradingPrompt(before, answers), schema = buildGradingResponseSchema(before, answers);
        assert.equal(buildGradingPrompt(after, answers), prompt, 'Grading prompt changed');
        equal(buildGradingResponseSchema(after, answers), schema, 'Grading response schema changed');
        return { learning_unit_id: id, subquestion_ids: members.map(m => m.subquestion_id),
            question_contract_hash: contentHash(contract(before)), prompt_sha256: sha256(prompt), schema_hash: contentHash(schema) };
    });
}

export function subsetReceiptIntegrityErrors(raw: unknown): string[] {
    try {
        assert(raw && typeof raw === 'object', 'Subset receipt required');
        const r = raw as SubsetReviewReceipt;
        assert.equal(r.version, 1); assert.equal(r.method, 'question_deletion_contract_derivation');
        assert(nonempty(r.set_id) && validHash(r.content_hash) && identityValid(r.manifest));
        assert(r.origin && identityValid(r.origin.bank) && identityValid(r.origin.catalog) && identityValid(r.origin.promotions));
        assert.equal(r.origin.set_id, r.set_id); assert(validHash(r.origin.content_hash) && validHash(r.origin.review_receipt_hash));
        assert(r.authorization && identityValid(r.authorization.evidence) && nonempty(r.authorization.statement));
        assert.equal(r.authorization.question_deletion_and_publication, true);
        assert.equal(r.new_model_calls, 0); assert.equal(r.new_human_review, false);
        for (const ids of [r.removed_subquestion_ids, r.retained_subquestion_ids]) {
            assert(Array.isArray(ids) && ids.length && ids.every(nonempty)); assert.equal(new Set(ids).size, ids.length);
        }
        assert(r.removed_subquestion_ids.every(id => !r.retained_subquestion_ids.includes(id)));
        assert(Array.isArray(r.contracts) && r.contracts.length && r.contracts.every(c => nonempty(c.learning_unit_id)
            && Array.isArray(c.subquestion_ids) && c.subquestion_ids.length && c.subquestion_ids.every(nonempty)
            && validHash(c.question_contract_hash) && validHash(c.prompt_sha256) && validHash(c.schema_hash)));
        assert(Array.isArray(r.runtime_files) && r.runtime_files.length && r.runtime_files.every(identityValid));
        const body = { ...r } as Partial<SubsetReviewReceipt>; delete body.receipt_hash;
        assert.equal(r.receipt_hash, jsonHash(body), 'Subset receipt hash differs');
        return [];
    } catch (error) { return [`삭제 파생 receipt 형식/해시: ${String(error)}`]; }
}

export function createSubsetReviewReceipt(manifestFile: ReviewFile, candidate: QuestionSetV3,
    context = createEfficientValidationContext(), root = process.cwd()): SubsetReviewReceipt {
    const manifest = readJson<SubsetReviewManifest>(manifestFile, context, root);
    assert.equal(manifest.version, 1); assert.equal(manifest.artifact_type, 'question_deletion_derivation_manifest');
    assert(Array.isArray(manifest.targets) && manifest.targets.length);
    assert.equal(new Set(manifest.targets.map(t => t.set_id)).size, manifest.targets.length, 'Duplicate subset target');
    const target = manifest.targets.find(t => t.set_id === candidate.id);
    assert(target && validHash(target.source_content_hash) && validHash(target.content_hash), 'Subset target and hashes required');
    assert.equal(target.content_hash, reviewedContentHash(candidate), 'Final subset hash differs');
    const auth = manifest.authorization;
    assert(auth && auth.question_deletion_and_publication === true && nonempty(auth.statement), 'Explicit deletion/publication authorization required');
    const evidence = readJson<{ authorization: string }>(auth.evidence, context, root);
    assert.equal(evidence.authorization, auth.statement, 'Authorization statement differs from recorded user evidence');
    const bank = readJson<QuestionSetV3[]>(manifest.bank, context, root);
    assert(Array.isArray(bank) && new Set(bank.map(s => s.id)).size === bank.length, 'Unique source bank required');
    const source = bank.find(s => s.id === candidate.id);
    assert(source, 'Original set missing');
    assert.equal(reviewedContentHash(source), target.source_content_hash, 'Original reviewed content hash differs');
    const catalog = readJson<{ source_file_sha256: string; classifications: LearningClassification[] }>(manifest.catalog, context, root);
    assert.equal(catalog.source_file_sha256, manifest.bank.sha256, 'Original catalog is not bound to bank snapshot');
    readEvidence(manifest.promotions, context, root);
    const ledgerKey = path.resolve(root, manifest.promotions.file) + ':' + manifest.promotions.sha256;
    if (!originalLedgers.has(context)) originalLedgers.set(context, new Map());
    const ledgers = originalLedgers.get(context)!;
    if (!ledgers.has(ledgerKey)) ledgers.set(ledgerKey, freeze(loadPromotionLedger(path.resolve(root, manifest.promotions.file))));
    const ledger = ledgers.get(ledgerKey)!;
    const verified = originalApproval(source, target, ledger);
    validateOriginManifestOnce(manifestFile, manifest, bank, ledger, context, root);
    const metadata = catalog.classifications.filter(m => m.source_set_id === source.id);
    if (verified.efficient_review) {
        // Bind legacy sidecar classification to the actual reviewed model projection,
        // not just to a freshly supplied bank/catalog pair with self-consistent hashes.
        const batch = readJson<EfficientReviewBatch>(verified.efficient_review.batch, context, root);
        const grading = readJson<GradingManifest>(batch.grading_manifest, context, root);
        const originCatalog = readJson<{ classifications: LearningClassification[] }>(grading.classifications, context, root);
        for (const m of metadata) {
            const prior = originCatalog.classifications.find(p => p.source_set_id === source.id && p.subquestion_id === m.subquestion_id);
            assert(prior, 'Original reviewed classification missing');
            equal(metaContract(m), metaContract(prior), 'Original reviewed learning projection differs');
        }
    } else {
        assert(source.subquestions.every(q => q.question_style && q.topic_ids?.length), 'Legacy semantic receipt has no bound catalog; re-review required');
        for (const file of verified.semantic_review!.source_files) readEvidence(file, context, root);
    }
    const contracts = verifyQuestionSubsetContracts(source, candidate, metadata, target.removed_subquestion_ids);
    const runtimeFiles = EFFICIENT_RUNTIME_FILES.map(file => {
        const identity = { file, sha256: sha256(fs.readFileSync(path.resolve(root, file))) };
        readEvidence(identity, context, root); return identity;
    });
    const body = { version: 1 as const, method: 'question_deletion_contract_derivation' as const,
        set_id: candidate.id, content_hash: target.content_hash, manifest: manifestFile,
        origin: { bank: manifest.bank, catalog: manifest.catalog, promotions: manifest.promotions,
            set_id: source.id, content_hash: target.source_content_hash, review_receipt_hash: verified.review_receipt_hash! },
        authorization: auth, removed_subquestion_ids: target.removed_subquestion_ids,
        retained_subquestion_ids: candidate.subquestions.map(q => q.id), contracts, runtime_files: runtimeFiles,
        new_model_calls: 0 as const, new_human_review: false as const };
    return { ...body, receipt_hash: jsonHash(body) };
}

export function validateRecordedSubsetReview(receipt: SubsetReviewReceipt, set: QuestionSetV3,
    context = createEfficientValidationContext(), root = process.cwd(), activeLedger?: PromotionLedger): string[] {
    const errors = subsetReceiptIntegrityErrors(receipt); if (errors.length) return errors;
    try {
        // Lifecycle transitions after derivation preserve the content identity.
        const published = structuredClone(set); published.status = 'published'; published.verification.review_status = 'verified';
        equal(receipt, createSubsetReviewReceipt(receipt.manifest, published, context, root), 'Recorded subset proof differs');
        if (activeLedger) {
            const origin = readJson<PromotionLedger>(receipt.origin.promotions, context, root);
            equal(activeLedger.entries.slice(0, origin.entries.length), origin.entries, 'Original promotion history was rewritten or removed');
            const matches = activeLedger.entries.map((entry, index) => ({ entry, index }))
                .filter(({ entry }) => entry.set_id === receipt.set_id && entry.subset_review?.receipt_hash === receipt.receipt_hash);
            assert.equal(matches.length, 1, 'A unique derivation transition is required');
            const { entry, index } = matches[0];
            assert(index >= origin.entries.length && entry.from_status === 'published' && entry.to_status === 'verified', 'Invalid derivation lifecycle transition');
            assert(!activeLedger.entries.slice(origin.entries.length, index).some(e => e.set_id === receipt.set_id),
                'A newer approval superseded this subset origin');
            const latestOrigin = origin.entries.filter(e => e.set_id === receipt.set_id).at(-1);
            const predecessor = activeLedger.entries.slice(0, index).filter(e => e.set_id === receipt.set_id).at(-1);
            equal(predecessor, latestOrigin, 'A newer approval superseded this subset origin');
            const suffix = activeLedger.entries.slice(index).filter(e => e.set_id === receipt.set_id);
            assert(suffix.length <= 2 && (suffix.length === 1 || suffix[1].from_status === 'verified' && suffix[1].to_status === 'published'
                && suffix[1].review_receipt_hash === receipt.receipt_hash && suffix[1].content_hash === receipt.content_hash), 'Invalid derived publication lifecycle');
        }
    } catch (error) { errors.push(`${set.id}: ${String(error)}`); }
    return errors;
}
