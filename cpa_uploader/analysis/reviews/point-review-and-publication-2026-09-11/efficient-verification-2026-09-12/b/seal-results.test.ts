import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture } from './seal-fixture.ts';
import { sealResults, parseSealArgs } from './seal-results.ts';
import { buildGradingPrompt, buildGradingResponseSchema, groundJudgment, applyQuestionSetJudgment } from '../../../../../../lib/questionV3Grading.ts';
import type { EfficientReviewBatch } from '../../../../../../cpa_uploader/questionEfficientReview.ts';

const E = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12';
const synthetic = 'OFFLINE TEST ONLY: all model records are synthesized; no API or content approval is performed.';
function setup(count = 1) {
    const f = fixture(count);
    f.jobs.forEach((j, i) => { j.entry.worker = (['a', 'b', 'c'] as const)[i % 3]; });
    const options = { candidate: 'candidate', runs: ['worker-a', 'worker-b', 'worker-c'], output: 'seal-output' };
    const flush = (residuals?: EfficientReviewBatch['residual_grading_findings']) => {
        const manifest = f.write('candidate/grading-manifest.json', f.manifest);
        f.write('candidate/agent-reviews.json', f.reviews);
        f.write('candidate/runtime-snapshots.json', f.batch.runtime_snapshots);
        f.write(E + '/authorization.md', synthetic, true);
        for (const worker of ['a', 'b', 'c']) {
            const owned = f.jobs.filter(j => j.entry.worker === worker);
            const rows = owned.map(job => {
                const folder = `worker-${worker}/${job.entry.id}`, obs = job.observation;
                obs.manifest = manifest;
                obs.files.input = f.write(folder + '/input.json', { entry: job.entry, set: job.projected,
                    prompt: buildGradingPrompt(job.projected, job.entry.answers), schema: buildGradingResponseSchema(job.projected, job.entry.answers), model: f.manifest.model });
                obs.files.transport = f.write(folder + '/transport.jsonl', job.rows.map(r => JSON.stringify(r)).join('\n') + '\n', true);
                obs.files.traces = f.write(folder + '/traces.jsonl', job.traces.map(r => JSON.stringify(r)).join('\n') + '\n', true);
                f.write(folder + '/usage.jsonl', obs.usage.map(r => JSON.stringify(r)).join('\n') + '\n', true);
                return { id: job.entry.id, status: obs.within_tolerance ? 'within_tolerance' : 'outside_tolerance_or_security', observation: f.write(folder + '/observation.json', obs) };
            });
            f.write(`worker-${worker}/preflight.json`, { version: 1, manifest, worker, mode: 'actual_sdk_forwarding', jobs: owned.map(j => j.entry.id), inputs: [manifest, ...f.manifest.inputs, ...f.manifest.code_files] });
            f.write(`worker-${worker}/summary.json`, { version: 1, status: 'completed', worker, selected_entries: owned.length, completed_observations: owned.length,
                actual_sdk_calls: owned.length, remaining_entry_ids: [], rows, frozen_input_error: null });
        }
        if (residuals) f.write('residual-findings.json', residuals);
    };
    const load = (file: string) => JSON.parse(fs.readFileSync(path.join(f.root, file), 'utf8'));
    flush();
    return { f, options, flush, load, run: () => sealResults(options, f.root) };
}
function check(name: string, action: (f: ReturnType<typeof setup>) => void, count = 1) {
    test(name, () => { const f = setup(count); try { action(f); } finally { f.f.cleanup(); } });
}
function turnWrongIntoTwoPoints(f: ReturnType<typeof setup>) {
    const j = f.f.jobs.find(j => j.entry.kind === 'wrong')!;
    for (const v of j.raw.subquestions[0].verdicts) { v.verdict = 'met'; v.evidence_ids = ['q1/e0']; }
    const text = JSON.stringify(j.raw); j.response.output_text = text;
    (j.response.output[0] as { content: { text: string }[] }).content[0].text = text;
    j.observation.judgment = groundJudgment(j.raw, j.projected, j.entry.answers);
    j.observation.result = applyQuestionSetJudgment(j.projected, j.entry.answers, j.observation.judgment);
    j.observation.subquestions[0] = { ...j.observation.subquestions[0], actual_points: 2, delta: 2, strict_matched: false, within_tolerance: false };
    j.observation.strict_matched = false; j.observation.within_tolerance = false;
    return j;
}

/** Synthetic two-wave records only; original files remain unchanged in the fixture. */
function resumed(t: ReturnType<typeof setup>) {
    t.f.manifest.inputs.push(t.f.identity('candidate/runtime-snapshots.json')); t.flush();
    const origin = t.f.identity('candidate/grading-manifest.json'), first = t.f.jobs[0];
    const originalObservation = t.load(`worker-${first.entry.worker}/summary.json`).rows[0].observation;
    const manifest = structuredClone(t.f.manifest);
    manifest.reused_observations = [{ entry_id: first.entry.id, worker: first.entry.worker, observation: originalObservation, origin_manifest: origin }];
    const current = t.f.write('candidate-resume/grading-manifest.json', manifest);
    t.f.write('candidate-resume/agent-reviews.json', t.f.reviews); t.f.write('candidate-resume/runtime-snapshots.json', t.f.batch.runtime_snapshots);
    for (const worker of ['a', 'b', 'c']) {
        const owned = t.f.jobs.filter(j => j.entry.worker === worker);
        const rows = owned.map(job => {
            if (job.entry.id === first.entry.id) return { id: job.entry.id, status: job.observation.within_tolerance ? 'within_tolerance' : 'outside_tolerance_or_security',
                observation: originalObservation, reused: true, origin_manifest: origin, original_actual_sdk_calls: job.observation.actual_sdk_calls };
            const folder = `resume-worker-${worker}/${job.entry.id}`, obs = structuredClone(job.observation); obs.manifest = current;
            obs.files.input = t.f.write(folder + '/input.json', { entry: job.entry, set: job.projected,
                prompt: buildGradingPrompt(job.projected, job.entry.answers), schema: buildGradingResponseSchema(job.projected, job.entry.answers), model: manifest.model });
            obs.files.transport = t.f.write(folder + '/transport.jsonl', job.rows.map(r => JSON.stringify(r)).join('\n') + '\n', true);
            obs.files.traces = t.f.write(folder + '/traces.jsonl', job.traces.map(r => JSON.stringify(r)).join('\n') + '\n', true);
            t.f.write(folder + '/usage.jsonl', obs.usage.map(r => JSON.stringify(r)).join('\n') + '\n', true);
            return { id: job.entry.id, status: obs.within_tolerance ? 'within_tolerance' : 'outside_tolerance_or_security', observation: t.f.write(folder + '/observation.json', obs) };
        });
        const reusedCount = rows.filter(r => 'reused' in r).length;
        t.f.write(`resume-worker-${worker}/preflight.json`, { version: 1, manifest: current, worker, mode: 'actual_sdk_forwarding', jobs: owned.map(j => j.entry.id), inputs: [current, ...manifest.inputs, ...manifest.code_files] });
        t.f.write(`resume-worker-${worker}/summary.json`, { version: 1, status: 'completed', worker, selected_entries: owned.length, completed_observations: owned.length,
            actual_sdk_calls: owned.length - reusedCount, reused_observations: reusedCount, reused_actual_sdk_calls: reusedCount,
            remaining_entry_ids: [], rows, frozen_input_error: null });
    }
    return { options: { candidate: 'candidate-resume', runs: ['resume-worker-a', 'resume-worker-b', 'resume-worker-c'], output: 'seal-resume-output' },
        manifest, current, origin, originalObservation, first };
}

check('seals a full three-worker synthetic cohort using the production replay; context-only answers do not inflate five-answer denominator', t => {
    assert.equal(t.run().ready, true);
    const s = t.load('seal-output/summary.json');
    assert.equal(s.fixed_evaluated_answers, 5); assert.equal(s.scores.length, 6);
    assert.equal(s.within_tolerance, 5); assert.equal(s.strict_verdict_matches, 5);
    assert.equal(s.accounting.actual_sdk_calls_from_transport, 3);
    assert.equal(s.accounting.output_tokens_including_reasoning, 90);
    assert.equal(s.accounting.reasoning_tokens_already_in_output, 60);
    assert.equal(t.load('seal-output/receipts.json').receipts.length, 1);
    assert.throws(() => t.run(), /new directory/);
});
check('missing original entry leaves the fixed denominator and readiness false, never changes an execution error into zero points', t => {
    const s = t.load('worker-b/summary.json'); s.rows = []; s.completed_observations = 0; t.f.write('worker-b/summary.json', s);
    assert.equal(t.run().ready, false);
    const out = t.load('seal-output/summary.json'); assert.equal(out.fixed_evaluated_answers, 5);
    assert.equal(out.scores.find((r: { entry_id: string }) => r.entry_id.endsWith('partial')).actual_points, null);
});
check('duplicate row is rejected', t => {
    const s = t.load('worker-a/summary.json'); s.rows.push(s.rows[0]); t.f.write('worker-a/summary.json', s);
    assert.equal(t.run().ready, false);
});
check('missing worker summary leaves accounting explicitly incomplete and total cost unknown', t => {
    fs.renameSync(path.join(t.f.root, 'worker-a/summary.json'), path.join(t.f.root, 'worker-a/summary.preserved.json'));
    assert.equal(t.run().ready, false);
    const a = t.load('seal-output/summary.json').accounting;
    assert.equal(a.all_worker_call_logs_accounted, false); assert.equal(a.complete_cost_known, false); assert.equal(a.usd, null);
});
check('dry-run and unrelated manifest are rejected', t => {
    const p = t.load('worker-a/preflight.json'); p.mode = 'dry_run_no_model'; t.f.write('worker-a/preflight.json', p);
    assert.equal(t.run().ready, false);
});
check('summary cannot point to another worker observation', t => {
    const s = t.load('worker-a/summary.json'); s.rows[0].observation = t.load('worker-b/summary.json').rows[0].observation; t.f.write('worker-a/summary.json', s);
    assert.equal(t.run().ready, false);
});
check('tampered observation hash and request body cannot be accepted', t => {
    const job = t.f.jobs[0]; job.observation.prompt_sha256 = '0'.repeat(64); t.flush();
    assert.equal(t.run().ready, false); assert(t.load('seal-output/readiness.json').problems.some((p: { stage: string }) => p.stage === 'core_replay'));
});
check('execution-error rows and stopped summaries cannot be accepted', t => {
    const s = t.load('worker-b/summary.json'); s.status = 'stopped'; s.completed_observations = 0;
    s.rows = [{ id: s.rows[0].id, status: 'execution_error', error: { code: 'credit_balance_exhausted' } }]; t.f.write('worker-b/summary.json', s);
    const r = t.run(); assert.equal(r.ready, false); assert(r.problems.some(p => p.stage === 'execution_error'));
});
check('source or agent content failures are not waived by perfect score ratio', t => {
    t.f.reviews[0].questions[0].checks.points = 'fail' as 'pass'; t.flush(); assert.equal(t.run().ready, false);
});
check('security detection is rejected by production replay, even at identical numeric score', t => {
    t.f.jobs[0].raw.subquestions[0].salad_detected = true; t.flush(); assert.equal(t.run().ready, false);
});
check('95 percent without an explicit residual source investigation remains false', t => {
    turnWrongIntoTwoPoints(t); t.flush(); const r = t.run(); assert.equal(r.ready, false);
    assert(r.problems.some(p => p.stage === 'residual_findings')); assert.equal(t.load('seal-output/summary.json').ratio_over_frozen_denominator, .95);
}, 4);
check('explicit synthetic investigated residual allows exactly 95 percent but never rewrites the original expected or actual score', t => {
    const j = turnWrongIntoTwoPoints(t);
    const findings: EfficientReviewBatch['residual_grading_findings'] = [{ entry_id: j.entry.id, subquestion_id: 'q1', delta: 2,
        classification: 'grading_consistency_only', rationale: synthetic, content_rechecked: true, disposition: 'accepted_within_batch_95_percent' }];
    t.flush(findings);
    const r = sealResults({ ...t.options, residualFindings: 'residual-findings.json' }, t.f.root); assert.equal(r.ready, true);
    const score = t.load('seal-output/summary.json').outside_tolerance[0]; assert.equal(score.expected_points, 0); assert.equal(score.actual_points, 2);
    assert.equal(t.load('seal-output/seal-inputs.json').residual_findings.file, 'residual-findings.json');
}, 4);
check('unknown cost is preserved without making an extra model call', t => {
    const j = t.f.jobs[0]; j.observation.usage[0].cost = { status: 'unknown', usd: null, min_usd: null, max_usd: null, reason: 'Unknown endpoint test' }; t.flush();
    assert.equal(t.run().ready, true); const a = t.load('seal-output/summary.json').accounting;
    assert.equal(a.usd, null); assert.equal(a.unknown_cost_responses, 1); assert.equal(a.complete_cost_known, false);
});
check('explicit old observation seals without rewriting it or double-counting old/new costs', t => {
    const r = resumed(t), before = t.f.identity(r.originalObservation.file);
    assert.equal(sealResults(r.options, t.f.root).ready, true);
    const summary = t.load('seal-resume-output/summary.json');
    assert.equal(summary.fixed_evaluated_answers, 5); assert.equal(summary.observed_entries, 3);
    assert.equal(summary.accounting.new_actual_sdk_calls, 2); assert.equal(summary.accounting.reused_actual_sdk_calls, 1);
    assert.equal(summary.accounting.actual_sdk_calls_from_transport, 3);
    assert.equal(summary.accounting.new_accounting.output_tokens_including_reasoning, 60);
    assert.equal(summary.accounting.reused_accounting.output_tokens_including_reasoning, 30);
    assert.equal(summary.accounting.usd, summary.accounting.new_accounting.usd + summary.accounting.reused_accounting.usd);
    assert.deepEqual(t.f.identity(r.originalObservation.file), before);
    assert(t.load('seal-resume-output/batch.json').observations.some((o: { file: string }) => o.file === r.originalObservation.file));
});
check('undeclared old observation is not accepted as a new run result', t => {
    const r = resumed(t), summary = t.load('resume-worker-a/summary.json'); summary.rows[0].reused = false;
    t.f.write('resume-worker-a/summary.json', summary);
    assert.equal(sealResults(r.options, t.f.root).ready, false);
    assert.equal(t.load('seal-resume-output/summary.json').fixed_evaluated_answers, 5);
});
check('one provider response cannot count once as reused and again as newly executed', t => {
    const r = resumed(t), summary = t.load('resume-worker-b/summary.json'), row = summary.rows[0], obs = t.load(row.observation.file);
    const log = fs.readFileSync(path.join(t.f.root, obs.files.transport.file), 'utf8').trim().split(/\r?\n/u).map(line => JSON.parse(line));
    log.find((x: { event: string }) => x.event === 'response_received').response.id = r.first.response.id;
    obs.usage[0].provider.response_id = r.first.response.id;
    obs.files.transport = t.f.write(obs.files.transport.file, log.map(row => JSON.stringify(row)).join('\n') + '\n', true);
    t.f.write(path.dirname(row.observation.file) + '/usage.jsonl', obs.usage.map((row: unknown) => JSON.stringify(row)).join('\n') + '\n', true);
    row.observation = t.f.write(row.observation.file, obs); t.f.write('resume-worker-b/summary.json', summary);
    const result = sealResults(r.options, t.f.root); assert.equal(result.ready, false);
    assert(result.problems.some(p => p.message.includes('Provider response reused across entries')));
});
check('an explicitly reused entry cannot also have a fresh execution folder', t => {
    const r = resumed(t); t.f.write(`resume-worker-a/${r.first.entry.id}/transport.jsonl`, '', true);
    assert.equal(sealResults(r.options, t.f.root).ready, false);
});
check('candidate overlap and duplicate run paths reject before writing any batch', t => {
    assert.throws(() => sealResults({ ...t.options, output: 'candidate/new-output' }, t.f.root), /overlaps/);
    assert.throws(() => sealResults({ ...t.options, runs: ['worker-a', 'worker-a', 'worker-c'] }, t.f.root), /Repeated/);
    assert.throws(() => sealResults({ ...t.options, output: '../escape' }, t.f.root), /outside/);
});
test('strict CLI parsing rejects missing, unknown, duplicate, and malformed run arguments', () => {
    const args = ['--candidate', 'candidate', '--runs', 'a,b,c', '--output', 'out']; assert.equal(parseSealArgs(args).runs.length, 3);
    for (const x of [[], [...args, '--api'], [...args, '--output', 'different'], ['--candidate', 'c', '--runs', 'a,b', '--output', 'out']]) assert.throws(() => parseSealArgs(x));
});
