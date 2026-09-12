import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { buildGradingPrompt, buildGradingResponseSchema } from 'file:///C:/Users/cntrl/Workspace/study/audit_say/lib/questionV3Grading.ts';
import { resolveAnswerEvidence } from 'file:///C:/Users/cntrl/Workspace/study/audit_say/lib/questionV3Evidence.ts';
import { jsonHash, sha256, reviewedContentHash } from 'file:///C:/Users/cntrl/Workspace/study/audit_say/cpa_uploader/questionReviewIdentity.ts';
import { auditReviewGrading } from './questionReviewGrading.mjs';
function requireValue(condition, message) { if (!condition)
    throw Error(message); }
function same(actual, expected, message) { requireValue(jsonHash(actual) === jsonHash(expected), message); }
function ids(actual, expected, message) {
    requireValue(new Set(actual).size === actual.length, `${message}: duplicate`);
    same([...actual].sort(), [...expected].sort(), message);
}
export function gradingAcceptanceHash(value) {
    const { acceptance_hash: _hash, ...body } = value;
    void _hash;
    return jsonHash(body);
}
export function gradingAcceptanceFiles(value) {
    return [value.policy_file, value.origin.manifest, value.origin.run, value.origin.summary,
        value.origin.request, value.origin.receipt, value.origin.observations,
        ...value.origin.additional_observations, ...value.cases.map(c => c.source_review)];
}
function safeFile(identity, root) {
    requireValue(identity && typeof identity.file === 'string' && /^[a-f\d]{64}$/.test(identity.sha256), 'artifact identity missing');
    const base = path.resolve(root);
    const file = path.resolve(base, identity.file);
    requireValue(file !== base && path.relative(base, file) !== '..' && !path.relative(base, file).startsWith(`..${path.sep}`) && !path.isAbsolute(path.relative(base, file)), 'artifact path outside repository');
    let cursor = file;
    while (cursor !== base) {
        requireValue(!fs.lstatSync(cursor).isSymbolicLink(), 'artifact symlink/junction rejected');
        cursor = path.dirname(cursor);
    }
    requireValue(fs.statSync(file).isFile() && sha256(fs.readFileSync(file)) === identity.sha256, `artifact bytes changed: ${identity.file}`);
    return file;
}
function read(identity, root) { return JSON.parse(fs.readFileSync(safeFile(identity, root), 'utf8')); }
function readEvents(identity, root) {
    return fs.readFileSync(safeFile(identity, root), 'utf8').split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
}
function validateTrace(event, set) {
    requireValue(Array.isArray(event.trace), 'raw trace missing');
    if (event.id === 'empty-answer') {
        requireValue(event.trace.length === 0 && event.judgment === null && event.result?.score === 0, 'blank answer invariant');
        return;
    }
    // Tolerance is deliberately not a recovery path for protocol/security errors.
    requireValue(event.trace.length > 0 && event.trace.every(t => t.stage === 'judgment' && !t.error && t.response !== undefined), 'transport/schema/security trace failure');
    const schema = buildGradingResponseSchema(set, event.answers);
    const validate = new Ajv({ allErrors: true }).compile(schema);
    for (const trace of event.trace) {
        requireValue(validate(trace.response), 'raw response schema mismatch');
        const raw = trace.response;
        ids(raw.subquestions.map(s => s.subquestion_id), set.subquestions.map(s => s.id), 'raw subquestion coverage');
        const grounded = { subquestions: [], injection_detected: false, salad_detected: false };
        for (const sub of raw.subquestions) {
            const target = set.subquestions.find(s => s.id === sub.subquestion_id);
            requireValue(sub.injection_detected === false && sub.salad_detected === false, 'raw security false positive cannot be waived');
            ids(sub.verdicts.map(c => c.criterion_id), target.criteria.map(c => c.id), 'raw criterion coverage');
            grounded.subquestions.push({ subquestion_id: sub.subquestion_id, injection_detected: false, salad_detected: false,
                verdicts: sub.verdicts.map(c => ({ criterion_id: c.criterion_id, verdict: c.verdict,
                    ...(c.verdict === 'not_met' ? {} : { quote: resolveAnswerEvidence(target.id, event.answers[target.id], c.evidence_ids) }),
                    ...(typeof c.reason === 'string' ? { reason: c.reason } : {}) })) });
        }
        // Every stored valid response must agree with the grounded record; do not
        // cherry-pick a last response while hiding a different earlier response.
        same(grounded, event.judgment, 'raw trace and recorded judgment differ');
    }
}
/** Optional acceptance for formal generated-case receipts only. Author-QA has
 * different record contracts and must use a separate adapter; never coerce it. */
export function validateGradingAcceptance(raw, receipt, set, options = {}) {
    const root = options.root || process.cwd();
    const requireCurrent = options.requireCurrent !== false;
    try {
        const a = raw;
        requireValue(a?.version === 1 && a.artifact_type === 'grading_deviation_acceptance'
            && a.acceptance_label === 'accepted_with_grading_deviation', 'unsupported acceptance document');
        requireValue(a.acceptance_hash === gradingAcceptanceHash(a), 'acceptance hash mismatch');
        requireValue(a.set_id === set.id && a.content_hash === reviewedContentHash(set) && a.receipt_hash === receipt.receipt_hash, 'acceptance/receipt/content binding mismatch');
        requireValue(receipt.verdict === 'pass' && receipt.execution.method === 'model_reasoned'
            && receipt.execution.transport === 'model' && receipt.grading.transport === 'model', 'actual passing semantic and actual grading required');
        const policy = read(a.policy_file, root);
        same(a.policy, policy, 'policy body differs');
        requireValue(policy.max_absolute_score_delta_per_subquestion === 1 && policy.preserve_expected_and_actual === true
            && policy.not_a_strict_match === true && policy.global_default_policy === false, 'not the explicit one-point policy');
        requireValue(policy.grading_model === receipt.grading.model && policy.review_model === receipt.execution.model, 'policy/model differs');
        const audit = auditReviewGrading(receipt.grading, set, receipt.cases, requireCurrent);
        requireValue(!audit.integrity_errors.length, audit.integrity_errors.join('; '));
        const origin = read(a.origin.manifest, root);
        safeFile({ file: origin.bank_file, sha256: origin.bank_sha256 }, root);
        const run = read(a.origin.run, root);
        requireValue(run.phase === 'grading' && run.transport === 'production_cli_subprocess' && run.mock === false, 'origin is not a production grading run');
        requireValue(path.resolve(root, run.manifest_file) === path.resolve(root, a.origin.manifest.file) && run.manifest_sha256 === a.origin.manifest.sha256, 'origin manifest binding');
        requireValue(run.model === policy.grading_model && run.review_model === policy.review_model && origin.model === run.model && origin.review_model === run.review_model, 'origin model binding');
        const job = origin.jobs.find(j => j.set_id === set.id && j.worker === run.worker);
        requireValue(job, 'origin job missing');
        const sourceSet = read({ file: job.file, sha256: job.sha256 }, root);
        const selectedSet = Array.isArray(sourceSet) ? sourceSet.find(s => s.id === set.id) : sourceSet;
        requireValue(selectedSet && reviewedContentHash(selectedSet) === receipt.content_hash, 'origin question bytes/content differ');
        if (job.plan_file)
            same(read({ file: job.plan_file, sha256: job.plan_sha256 }, root), receipt.context.authoring_plan, 'origin plan differs');
        const stored = read(a.origin.receipt, root).reviews.find(r => r.set_id === set.id);
        same(stored, receipt, 'original receipt changed');
        const summary = read(a.origin.summary, root);
        requireValue(summary.set_id === set.id && summary.phase === 'grading' && ['pass', 'grading_mismatch'].includes(summary.outcome)
            && !summary.guard_or_observer_error && summary.input_sha256 === job.sha256, 'origin summary incomplete/error');
        requireValue(path.resolve(root, summary.receipt_file) === path.resolve(root, a.origin.receipt.file) && summary.receipt_sha256 === a.origin.receipt.sha256, 'summary receipt binding');
        same([...summary.mismatched_run_ids].sort(), audit.strict_mismatches.map(c => c.run_id).sort(), 'summary mismatch inventory');
        const originDirectory = path.resolve(root, run.output, set.id);
        for (const item of [a.origin.summary, a.origin.request, a.origin.receipt, a.origin.observations])
            requireValue(path.dirname(path.resolve(root, item.file)) === originDirectory, 'artifact unrelated to original run');
        const request = read(a.origin.request, root);
        requireValue(request.set_id === set.id && request.manifest_sha256 === a.origin.manifest.sha256, 'request provenance differs');
        for (const item of [...origin.code_files, ...job.source_files, { file: job.file, sha256: job.sha256 }, { file: origin.bank_file, sha256: origin.bank_sha256 }])
            requireValue(request.frozen_files.some(f => path.resolve(root, f.file) === path.resolve(root, item.file) && f.sha256 === item.sha256), 'request frozen input inventory differs');
        for (const item of receipt.source_files) {
            safeFile(item, root);
            requireValue(job.source_files.some(s => s.file === item.file && s.sha256 === item.sha256), 'source absent from original fixed job');
        }
        const primary = readEvents(a.origin.observations, root);
        ids(primary.map(e => e.id), receipt.grading.runs.map(r => r.id), 'complete primary observation inventory');
        // Fail closed until an adapter for the diagnostic/author-QA producer's
        // separate origin manifest/summary/input contracts is implemented.
        requireValue(a.origin.additional_observations.length === 0, 'additional producer observations need a separately validated adapter; do not omit them');
        const extras = a.origin.additional_observations.flatMap(file => readEvents(file, root));
        const events = [...primary, ...extras];
        const mismatchIds = [...new Set([...audit.strict_mismatches.map(c => c.run_id), ...extras.filter(e => e.matched === false).map(e => e.id)])];
        ids(a.cases.map(c => c.run_id), mismatchIds, 'all strict mismatches require exactly one proof');
        for (const event of events) {
            requireValue(event.status === 'completed' && event.transport === 'model' && event.model === receipt.grading.model
                && event.grader_hash === receipt.grading.grader_hash && event.set_id === set.id
                && event.content_hash === receipt.content_hash && event.bank_hash === receipt.bank_hash, 'observation identity/failure');
            same(event.source_files, receipt.source_files, 'observation sources differ');
            const original = receipt.grading.runs.find(r => r.id === event.id);
            requireValue(original, 'unregistered observation');
            same(event.answers, original.answers, 'original answer changed');
            same(event.expected, original.expected, 'original expected changed');
            const oneExecution = { ...receipt.grading, runs: receipt.grading.runs.map(r => r.id === event.id
                    ? { id: event.id, answers: event.answers, expected: event.expected, judgment: event.judgment, result: event.result, matched: event.matched } : r) };
            const observedAudit = auditReviewGrading(oneExecution, set, receipt.cases, requireCurrent);
            requireValue(!observedAudit.integrity_errors.length, observedAudit.integrity_errors.join('; '));
            validateTrace(event, set);
            if (primary.includes(event))
                same({ id: event.id, answers: event.answers, expected: event.expected, judgment: event.judgment, result: event.result, matched: event.matched }, original, 'primary raw/receipt mismatch');
            requireValue(event.result?.security_flag === 'none', 'final security failure');
            if (event.id === 'empty-answer')
                continue;
            const proof = a.cases.find(c => c.run_id === event.id);
            // Additional observations that create a new strict mismatch also need
            // a source proof; absence cannot be hidden by the original pass.
            if (!proof) {
                requireValue(event.matched === true, 'additional strict mismatch lacks proof');
                continue;
            }
            requireValue(proof.answers_hash === jsonHash(event.answers) && proof.original_expected_hash === jsonHash(event.expected), 'proof answer/expectation differs');
            requireValue(proof.expectation_basis === 'source_prompt_rubric_and_whole_answer' && proof.human_confirmation === false
                && ['agent_source_review', 'independent_source_review'].includes(proof.reviewer_kind), 'source review method missing');
            const sourceReview = read(proof.source_review, root);
            same(sourceReview, { set_id: set.id, run_id: proof.run_id, answers_hash: proof.answers_hash,
                original_expected_hash: proof.original_expected_hash, method: proof.method, expectation_basis: proof.expectation_basis,
                bounds: proof.bounds, reviewer_kind: proof.reviewer_kind, human_confirmation: false }, 'selected source review and bound differ');
            requireValue(['complete_exact_expectation', 'conservative_criterion_bounds'].includes(proof.method), 'expectation method unsupported');
            if (requireCurrent) {
                requireValue(proof.request_hash === sha256(buildGradingPrompt(set, event.answers))
                    && proof.schema_hash === sha256(JSON.stringify(buildGradingResponseSchema(set, event.answers))), 'current request/schema differs');
            }
            const expectedIds = set.subquestions.flatMap(s => s.criteria.map(c => `${s.id}/${c.id}`));
            ids(proof.bounds.map(b => `${b.subquestion_id}/${b.criterion_id}`), expectedIds, 'whole-answer expectation coverage');
            for (const sub of set.subquestions) {
                const bounds = proof.bounds.filter(b => b.subquestion_id === sub.id);
                for (const bound of bounds) {
                    const criterion = sub.criteria.find(c => c.id === bound.criterion_id);
                    const allowed = [0, criterion.scores.met, ...(criterion.scores.partial === undefined ? [] : [criterion.scores.partial])];
                    requireValue(bound.criterion_claim === criterion.claim && bound.reason.trim() && Number.isInteger(bound.min) && Number.isInteger(bound.max)
                        && bound.min <= bound.max && allowed.includes(bound.min) && allowed.includes(bound.max), 'criterion bound/claim/reason invalid');
                    requireValue(proof.method !== 'complete_exact_expectation' || bound.min === bound.max, 'exact proof contains ambiguous range');
                    requireValue(bound.source_ref_ids.length > 0 && bound.source_ref_ids.every(id => criterion.source_ref_ids.includes(id)), 'criterion source review missing');
                    if (!event.answers[sub.id]?.trim())
                        requireValue(bound.min === 0 && bound.max === 0, 'blank subquestion expectation must be zero');
                }
                const lower = bounds.reduce((n, b) => n + b.min, 0), upper = bounds.reduce((n, b) => n + b.max, 0);
                const actual = event.result.subquestions.find(s => s.subquestion_id === sub.id).score;
                requireValue(Math.max(Math.abs(actual - lower), Math.abs(actual - upper)) <= 1, `${event.id}/${sub.id}: worst deviation exceeds one`);
            }
        }
        // No question/prompt/scoring mutation and no semantic call occur here.
        return [];
    }
    catch (error) {
        return [`채점 편차 수락 검증 실패: ${error instanceof Error ? error.message : String(error)}`];
    }
}
export function readGradingAcceptanceDocument(file) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    requireValue(value.version === 1 && Array.isArray(value.acceptances), 'acceptance document shape');
    ids(value.acceptances.map(a => a.set_id), [...new Set(value.acceptances.map(a => a.set_id))], 'acceptance set IDs');
    for (const a of value.acceptances)
        requireValue(a.acceptance_hash === gradingAcceptanceHash(a), 'acceptance self hash');
    return value;
}
export { validateTrace as fixtureValidateTrace };
