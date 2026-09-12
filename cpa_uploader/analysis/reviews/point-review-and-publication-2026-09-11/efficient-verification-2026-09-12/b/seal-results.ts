import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createEfficientReviewReceipt, validateRecordedEfficientReview, createEfficientValidationContext,
    assertEfficientEvidenceUnchanged, validateReusableEfficientObservation } from '../../../../../../cpa_uploader/questionEfficientReview.ts';
import type { EfficientReviewBatch, EfficientReviewReceipt, AgentSetReview, ReviewFile } from '../../../../../../cpa_uploader/questionEfficientReview.ts';
import { sha256 } from '../../../../../../cpa_uploader/questionReviewIdentity.ts';
import type { QuestionSetV3 } from '../../../../../../lib/questionV3.ts';
import type { EfficientManifest, EfficientObservation, UsageObservation } from './contract.ts';
import { assessUsageCost, safeError } from './accounting.ts';

const E = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12';
const SELF = fileURLToPath(import.meta.url);
type Worker = 'a' | 'b' | 'c';
export interface SealOptions { candidate: string; runs: string[]; output: string; residualFindings?: string }
interface RunSummary { version: number; status: string; worker: Worker; selected_entries: number; completed_observations: number;
    actual_sdk_calls: number; remaining_entry_ids: string[]; frozen_input_error: unknown;
    reused_observations?: number; reused_actual_sdk_calls?: number;
    rows: { id: string; status: string; observation?: ReviewFile; error?: unknown;
        reused?: boolean; origin_manifest?: ReviewFile; original_actual_sdk_calls?: number }[] }
interface Preflight { version: number; manifest: ReviewFile; worker: Worker; mode: string; jobs: string[]; inputs: ReviewFile[] }
interface Problem { stage: string; message: string }
interface ScoreRow { entry_id: string; source_set_id: string; learning_unit_id: string; kind: string; subquestion_id: string;
    evaluated: boolean; expected_points: number; actual_points: number | null; delta: number | null;
    exact_score: boolean | null; strict_matched: boolean | null; within_tolerance: boolean | null }
const same = (a: unknown, b: unknown, label: string) => assert.deepEqual(a, b, label);
const json = (x: unknown) => JSON.stringify(x, null, 2) + '\n';
const sorted = (x: string[]) => [...x].sort();

export function parseSealArgs(args: string[]): SealOptions {
    const values = new Map<string, string>();
    for (let i = 0; i < args.length; i += 2) {
        const name = args[i], value = args[i + 1];
        assert(['--candidate', '--runs', '--output', '--residual-findings'].includes(name), 'Unknown seal argument: ' + name);
        assert(value && !value.startsWith('--') && !values.has(name), 'Missing or repeated argument: ' + name);
        values.set(name, value);
    }
    for (const name of ['--candidate', '--runs', '--output']) assert(values.has(name), 'Missing ' + name);
    const runs = values.get('--runs')!.split(',');
    assert(runs.length === 3 && runs.every(x => x.trim() === x && x.length), '--runs requires exactly three comma-separated directories');
    return { candidate: values.get('--candidate')!, runs, output: values.get('--output')!, residualFindings: values.get('--residual-findings') };
}

/** Local evidence aggregation only. No API, promotion, DB write, or inferred agent review. */
export function sealResults(options: SealOptions, root = process.cwd()) {
    root = path.resolve(root);
    const frozen = new Map<string, string>(), problems: Problem[] = [];
    const relative = (file: string) => path.relative(root, file).split(path.sep).join('/');
    function inside(file: string): string {
        const absolute = path.resolve(root, file), rel = path.relative(root, absolute);
        assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Path outside repository: ' + file);
        let cursor = root;
        for (const part of rel.split(path.sep)) {
            cursor = path.join(cursor, part);
            if (fs.existsSync(cursor)) assert(!fs.lstatSync(cursor).isSymbolicLink(), 'Symlink/junction evidence path is not allowed');
        }
        return absolute;
    }
    const output = inside(options.output), candidate = inside(options.candidate), runs = options.runs.map(inside);
    assert(!fs.existsSync(output), 'Output must be a new directory');
    assert(new Set(runs.map(x => x.toLowerCase())).size === 3, 'Repeated run directory');
    for (const input of [candidate, ...runs]) {
        const a = path.relative(output, input), b = path.relative(input, output);
        assert(a.startsWith('..') && b.startsWith('..'), 'Output overlaps candidate/run directory');
    }
    function read(file: string, expected?: string): { bytes: Buffer; identity: ReviewFile } {
        const absolute = inside(file);
        const underOutput = path.relative(output, absolute);
        assert(underOutput.startsWith('..') || path.isAbsolute(underOutput), 'Output overlaps an input file');
        const bytes = fs.readFileSync(absolute), hash = sha256(bytes);
        if (expected) assert.equal(hash, expected, 'Changed evidence: ' + relative(absolute));
        assert(!frozen.has(absolute) || frozen.get(absolute) === hash, 'Conflicting evidence hashes');
        frozen.set(absolute, hash); return { bytes, identity: { file: relative(absolute), sha256: hash } };
    }
    function readJson<T>(file: string, expected?: string): { value: T; identity: ReviewFile } {
        const result = read(file, expected); return { value: JSON.parse(result.bytes.toString('utf8')) as T, identity: result.identity };
    }
    const guard = () => { for (const [file, hash] of frozen) assert.equal(sha256(fs.readFileSync(inside(file))), hash, 'Input changed during sealing: ' + relative(file)); };
    const problem = (stage: string, error: unknown) => problems.push({ stage, message: String(safeError(error).error ? JSON.stringify(safeError(error).error) : error) });
    const write = (name: string, value: unknown) => {
        inside(path.join(output, name)); fs.writeFileSync(path.join(output, name), json(value), { flag: 'wx' });
    };

    // Essential candidate files must be parseable before a batch of this shape can exist.
    const manifestFile = readJson<EfficientManifest>(path.join(candidate, 'grading-manifest.json'));
    const manifest = manifestFile.value;
    const reviewsFile = readJson<AgentSetReview[]>(path.join(candidate, 'agent-reviews.json'));
    const runtimeFile = readJson<EfficientReviewBatch['runtime_snapshots']>(path.join(candidate, 'runtime-snapshots.json'));
    const authorization = read(path.join(root, E, 'authorization.md')).identity;
    const policyFile = readJson<Record<string, unknown>>(manifest.policy.file, manifest.policy.sha256);
    const bankFile = readJson<QuestionSetV3[]>(manifest.bank.file, manifest.bank.sha256);
    const residualFile = options.residualFindings ? readJson<EfficientReviewBatch['residual_grading_findings']>(options.residualFindings) : null;
    assert(Array.isArray(reviewsFile.value) && Array.isArray(runtimeFile.value), 'Candidate review/runtime files must be arrays');
    assert(!residualFile || Array.isArray(residualFile.value), '--residual-findings must be the exact explicit residual_grading_findings array');
    const batch: EfficientReviewBatch = { version: 1, artifact_type: 'cost_controlled_review_batch', created_at: new Date().toISOString(),
        authorization: { evidence: authorization, agent_review_and_representative_grading: true, production_publication: true },
        grading_manifest: manifestFile.identity, observations: [], agent_reviews: reviewsFile.value,
        runtime_snapshots: runtimeFile.value, residual_grading_findings: residualFile?.value ?? [] };
    const observations = new Map<string, EfficientObservation>(), seenRows = new Set<string>(), seenWorkers = new Set<string>();
    const runEvidence: { directory: string; preflight?: ReviewFile; summary?: ReviewFile }[] = [];
    const usage: UsageObservation[] = [], newUsage: UsageObservation[] = [], reusedUsage: UsageObservation[] = [];
    let actualCalls = 0, actualResponses = 0, missingTransportLogs = 0, accountedRuns = 0;
    let newCalls = 0, reusedCalls = 0, newResponses = 0, reusedResponses = 0;
    const seenResponseIds = new Set<string>();
    const reuseContext = createEfficientValidationContext();
    const reused = new Map((manifest.reused_observations ?? []).map(r => [r.entry_id, r]));
    function checkUsage(row: UsageObservation) {
        assert(row.provider && row.cost, 'Usage row shape');
        if (row.cost.status !== 'unknown') {
            const computed = assessUsageCost(row.provider, true);
            assert.equal(computed.status, row.cost.status); assert.equal(computed.usd, row.cost.usd);
            assert.equal(computed.min_usd, row.cost.min_usd); assert.equal(computed.max_usd, row.cost.max_usd);
        }
    }
    function countTransport(file: string, expected?: string) {
        const rows = read(file, expected).bytes.toString('utf8').trim().split(/\r?\n/u).filter(Boolean).map(x => JSON.parse(x) as { event: string; response?: { id?: string } });
        const calls = rows.filter(r => r.event === 'request_started').length, responses = rows.filter(r => r.event === 'response_received');
        for (const row of responses) if (row.response?.id) {
            assert(!seenResponseIds.has(row.response.id), 'Provider response reused across entries'); seenResponseIds.add(row.response.id);
        }
        actualCalls += calls; actualResponses += responses.length;
        return { calls, responses: responses.length };
    }
    try {
        assert.equal(manifest.version, 1); assert.equal(manifest.artifact_type, 'efficient_grading_manifest');
        assert.equal(manifest.model, 'gpt-5.6-luna'); assert(manifest.entries.length > 0);
        assert.equal(new Set(manifest.entries.map(e => e.id)).size, manifest.entries.length, 'Duplicate manifest entry');
        assert(manifest.entries.every(e => ['a', 'b', 'c'].includes(e.worker)), 'Invalid worker in manifest');
        assert.equal(reused.size, (manifest.reused_observations ?? []).length, 'Duplicate manifest reused entry');
        assert.equal(new Set([...reused.values()].map(r => path.resolve(root, r.observation.file))).size, reused.size, 'Duplicate reused observation file');
        for (const ref of reused.values()) assert(manifest.entries.some(e => e.id === ref.entry_id && e.worker === ref.worker), 'Unknown reused entry or worker');
        for (const ref of [...manifest.inputs, ...manifest.code_files]) read(ref.file, ref.sha256);
        for (const entry of manifest.entries) read(entry.projected_file, entry.projected_sha256);
    } catch (error) { problem('candidate_identity', error); }

    for (const directory of runs) {
        const evidence: typeof runEvidence[number] = { directory: relative(directory) }; runEvidence.push(evidence);
        try {
            const preflight = readJson<Preflight>(path.join(directory, 'preflight.json'));
            const summary = readJson<RunSummary>(path.join(directory, 'summary.json'));
            evidence.preflight = preflight.identity; evidence.summary = summary.identity;
            const p = preflight.value, s = summary.value;
            assert.equal(p.version, 1); assert.equal(s.version, 1); assert.equal(p.mode, 'actual_sdk_forwarding', 'Dry-run/mock output is not an actual run');
            same(p.manifest, manifestFile.identity, 'Run belongs to another manifest'); assert.equal(p.worker, s.worker);
            assert(['a', 'b', 'c'].includes(s.worker) && !seenWorkers.has(s.worker), 'Missing/duplicate worker'); seenWorkers.add(s.worker);
            const owned = manifest.entries.filter(e => e.worker === s.worker);
            same(sorted(p.jobs), sorted(owned.map(e => e.id)), 'Worker job scope differs');
            assert.equal(new Set(p.jobs).size, p.jobs.length); assert.equal(s.selected_entries, owned.length);
            for (const ref of p.inputs) read(ref.file, ref.sha256);
            const callsBefore = actualCalls, responsesBefore = actualResponses, reusedCallsBefore = reusedCalls;
            for (const entry of owned) {
                assert(/^[A-Za-z0-9_.-]+$/.test(entry.id), 'Entry ID must be a plain filename');
                const folder = path.join(directory, entry.id);
                if (reused.has(entry.id)) {
                    assert(!fs.existsSync(folder), 'Explicit reused entry also has a new execution directory');
                    continue;
                }
                const transport = path.join(folder, 'transport.jsonl'), usageFile = path.join(folder, 'usage.jsonl');
                if (fs.existsSync(transport)) {
                    const counted = countTransport(transport); newCalls += counted.calls; newResponses += counted.responses;
                } else missingTransportLogs++;
                if (fs.existsSync(usageFile)) {
                    const lines = read(usageFile).bytes.toString('utf8').trim().split(/\r?\n/u).filter(Boolean);
                    for (const line of lines) {
                        const row = JSON.parse(line) as UsageObservation;
                        checkUsage(row); usage.push(row); newUsage.push(row);
                    }
                }
            }
            assert.equal(actualCalls - callsBefore, s.actual_sdk_calls, 'Summary call count differs from transport');
            assert(usage.length <= actualResponses, 'Usage exceeds provider response count');
            for (const row of s.rows) {
                assert(owned.some(e => e.id === row.id), 'Unknown or wrong-worker result');
                assert(!seenRows.has(row.id), 'Duplicate entry result'); seenRows.add(row.id);
                if (row.status === 'execution_error' || row.error) { problem('execution_error', new Error(row.id + ': source summary has an execution error')); continue; }
                assert(['within_tolerance', 'outside_tolerance_or_security'].includes(row.status), 'Invalid result status');
                assert(row.observation, 'Result has no observation');
                const reuse = reused.get(row.id);
                if (reuse) {
                    assert.equal(row.reused, true, 'Explicit reuse row marker missing'); same(row.observation, reuse.observation, 'Reused observation differs from manifest');
                    same(row.origin_manifest, reuse.origin_manifest, 'Reused origin differs from manifest');
                    validateReusableEfficientObservation(reuse, manifest, reuseContext, root);
                } else {
                    assert(row.reused !== true && row.origin_manifest === undefined, 'Undeclared reuse');
                    assert.equal(path.resolve(root, row.observation.file), path.join(directory, row.id, 'observation.json'), 'Observation path unrelated to source run');
                }
                const obs = readJson<EfficientObservation>(row.observation.file, row.observation.sha256);
                assert.equal(obs.value.entry_id, row.id); assert.equal(obs.value.transport, 'model'); assert.equal(obs.value.response_injection, false);
                same(obs.value.manifest, reuse?.origin_manifest ?? manifestFile.identity, 'Observation manifest mismatch');
                const usageLines = read(path.join(path.dirname(path.resolve(root, row.observation.file)), 'usage.jsonl')).bytes.toString('utf8').trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line) as UsageObservation);
                same(usageLines, obs.value.usage, 'Observation usage differs from actual usage log');
                if (reuse) {
                    const counted = countTransport(obs.value.files.transport.file, obs.value.files.transport.sha256);
                    assert.equal(counted.calls, obs.value.actual_sdk_calls, 'Reused observation call count differs');
                    assert.equal(row.original_actual_sdk_calls, counted.calls, 'Reused summary call count differs');
                    reusedCalls += counted.calls; reusedResponses += counted.responses;
                    for (const item of usageLines) { checkUsage(item); usage.push(item); reusedUsage.push(item); }
                }
                observations.set(row.id, obs.value); batch.observations.push(obs.identity);
            }
            assert.equal(s.reused_observations ?? 0, s.rows.filter(r => r.reused).length, 'Reused observation count differs');
            assert.equal(s.reused_actual_sdk_calls ?? 0, reusedCalls - reusedCallsBefore, 'Reused call total differs');
            assert.equal(s.completed_observations, s.rows.filter(r => r.observation).length, 'Completed observation count differs');
            assert.equal(s.status, 'completed', 'Worker did not complete'); assert.deepEqual(s.remaining_entry_ids, []);
            assert.equal(s.frozen_input_error, null, 'Worker frozen input error');
            same(sorted(s.rows.map(r => r.id)), sorted(owned.map(e => e.id)), 'Missing worker entries');
            assert.equal(actualResponses - responsesBefore, usage.filter(u => owned.some(e => observations.get(e.id)?.usage.some(x => x.provider.response_id === u.provider.response_id))).length, 'Unaccounted response in completed run');
            accountedRuns++;
        } catch (error) { problem('run:' + relative(directory), error); }
    }
    if (seenWorkers.size !== 3) problem('coverage', new Error('All three original workers are required'));
    const missing = manifest.entries.filter(e => !observations.has(e.id)).map(e => e.id);
    if (missing.length) problem('coverage', new Error('Missing observations: ' + missing.join(', ')));
    try {
        assertEfficientEvidenceUnchanged(reuseContext);
        for (const [file, hash] of reuseContext.files) read(file, hash);
    } catch (error) { problem('reuse_identity', error); }
    const scores: ScoreRow[] = manifest.entries.flatMap(entry => entry.expected_by_subquestion.map(expected => {
        const obs = observations.get(entry.id), result = obs?.result.subquestions.find(q => q.subquestion_id === expected.subquestion_id);
        const score = result?.score ?? null, delta = score === null ? null : score - expected.expected_points;
        return { entry_id: entry.id, source_set_id: entry.source_set_id, learning_unit_id: entry.learning_unit_id, kind: entry.kind,
            subquestion_id: expected.subquestion_id, evaluated: entry.evaluated_subquestion_ids.includes(expected.subquestion_id),
            expected_points: expected.expected_points, actual_points: score, delta, exact_score: delta === null ? null : delta === 0,
            strict_matched: !result ? null : delta === 0 && expected.expected_verdicts.every(v => result.criteria.find(c => c.criterion_id === v.criterion_id)?.verdict === v.verdict),
            within_tolerance: delta === null ? null : Math.abs(delta) <= 1 };
    }));
    const outside = scores.filter(s => s.evaluated && s.within_tolerance === false);
    if (outside.length && !residualFile) problem('residual_findings', new Error('Outside-tolerance observations require the explicit source-investigation JSON; never auto-waived'));
    guard(); fs.mkdirSync(output, { recursive: true });
    write('batch.json', batch);
    const batchIdentity = { file: relative(path.join(output, 'batch.json')), sha256: sha256(fs.readFileSync(path.join(output, 'batch.json'))) };
    const receipts: EfficientReviewReceipt[] = [], context = createEfficientValidationContext();
    let coreValidated = false;
    try {
        for (const review of batch.agent_reviews) {
            const set = bankFile.value.find(s => s.id === review.set_id); assert(set, 'Unknown reviewed set');
            const receipt = createEfficientReviewReceipt(batchIdentity, set, context, root);
            same(validateRecordedEfficientReview(receipt, set, context, root), [], 'Recorded receipt failed independent validation');
            receipts.push(receipt);
        }
        assert(receipts.length > 0); assertEfficientEvidenceUnchanged(context); guard(); coreValidated = true;
    } catch (error) { problem('core_replay', error); }
    const evaluated = scores.filter(s => s.evaluated), within = evaluated.filter(s => s.within_tolerance).length;
    function account(list: UsageObservation[], calls: number, responses: number, missingLogs: number) {
        const unknown = list.filter(u => u.cost.status === 'unknown').length, bounded = list.filter(u => u.cost.status === 'bounded_missing_cache_write').length;
        const unaccounted = Math.max(0, calls - list.length);
        const sumToken = (get: (u: UsageObservation) => number | undefined) => list.every(u => Number.isSafeInteger(get(u))) ? list.reduce((n, u) => n + get(u)!, 0) : null;
        return { actual_sdk_calls_from_transport: calls, all_worker_call_logs_accounted: accountedRuns === 3,
            accounted_worker_runs: accountedRuns, provider_responses: responses, usage_responses: list.length,
            requests_without_usage: unaccounted, missing_transport_logs: missingLogs, input_tokens: sumToken(u => u.provider.usage?.input_tokens),
            output_tokens_including_reasoning: sumToken(u => u.provider.usage?.output_tokens), reasoning_tokens_already_in_output: sumToken(u => u.provider.usage?.output_tokens_details?.reasoning_tokens),
            cached_tokens: sumToken(u => u.provider.usage?.input_tokens_details?.cached_tokens), cache_write_tokens: sumToken(u => u.provider.usage?.input_tokens_details?.cache_write_tokens),
            total_tokens: sumToken(u => u.provider.usage?.total_tokens), unknown_cost_responses: unknown, bounded_cost_responses: bounded,
            usd: unknown || bounded || unaccounted || accountedRuns !== 3 ? null : list.reduce((n,u) => n + u.cost.usd!, 0),
            accounted_min_usd: unknown ? null : list.reduce((n,u) => n + u.cost.min_usd!, 0),
            accounted_max_usd: unknown ? null : list.reduce((n,u) => n + u.cost.max_usd!, 0),
            complete_cost_known: accountedRuns === 3 && !unknown && !bounded && !unaccounted && !missingLogs,
            cost_basis: 'Runner-recorded endpoint/tier qualification; known amounts recomputed from actual usage. Unknown remains unknown. Arithmetic is not an invoice.' };
    }
    const accounting = { ...account(usage, actualCalls, actualResponses, missingTransportLogs),
        scope: 'Unique target observations; original reused responses counted once. Other prior or retired observations are outside this cohort accounting.',
        new_actual_sdk_calls: newCalls, reused_actual_sdk_calls: reusedCalls,
        new_observations: [...observations.keys()].filter(id => !reused.has(id)).length, reused_observations: [...observations.keys()].filter(id => reused.has(id)).length,
        new_accounting: account(newUsage, newCalls, newResponses, missingTransportLogs),
        reused_accounting: account(reusedUsage, reusedCalls, reusedResponses, 0) };
    write('receipts.json', { status: coreValidated && problems.length === 0 ? 'validated_not_promoted' : 'not_accepted', receipts });
    write('summary.json', { version: 1, api_calls_by_sealer: 0, observation_values_validated: coreValidated, fixed_manifest_entries: manifest.entries.length,
        observed_entries: observations.size, missing_entry_ids: missing, fixed_evaluated_answers: evaluated.length,
        observed_evaluated_answers: evaluated.filter(s => s.actual_points !== null).length,
        exact_score_matches: evaluated.filter(s => s.exact_score).length, strict_verdict_matches: evaluated.filter(s => s.strict_matched).length,
        within_tolerance: within, ratio_over_frozen_denominator: evaluated.length ? within / evaluated.length : null,
        statistical_confidence_claim: false, target_ratio: 0.95, outside_tolerance: outside, scores, accounting });
    write('seal-inputs.json', { candidate: relative(candidate), grading_manifest: manifestFile.identity, agent_reviews: reviewsFile.identity,
        runtime_snapshots: runtimeFile.identity, policy: policyFile.identity, authorization, residual_findings: residualFile?.identity ?? null,
        runs: runEvidence, source_inputs: [...frozen].map(([file, hash]) => ({ file: relative(file), sha256: hash })), batch: batchIdentity });
    try { assertEfficientEvidenceUnchanged(context); guard(); } catch (error) { problem('final_guard', error); }
    const readiness = { version: 1, ready: coreValidated && problems.length === 0, created_at: new Date().toISOString(), batch: batchIdentity,
        core_replay_passed: coreValidated, problems, api_calls_by_sealer: 0, promotion_performed: false, db_write_performed: false };
    write('readiness.json', readiness); return readiness;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
    try { const result = sealResults(parseSealArgs(process.argv.slice(2))); console.log(json(result)); if (!result.ready) process.exitCode = 1; }
    catch (error) { console.error(JSON.stringify(safeError(error))); process.exitCode = 1; }
}
