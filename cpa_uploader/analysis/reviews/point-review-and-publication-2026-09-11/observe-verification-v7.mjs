import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Read-only status projection. A summary is not an independent receipt validation.
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const run = `${base}/execution-resumes/resume-2026-09-12-v2`;
const qa = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v2';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rows = [];
for (const wave of ['canary', 'remaining']) {
    const manifestFile = `${run}/${wave}/manifest.json`, manifest = read(manifestFile), manifestHash = hash(manifestFile);
    for (const phase of ['semantic', 'grading', 'author-qa']) for (const worker of ['a', 'b', 'c']) {
        const folder = phase === 'author-qa' ? `${qa}/${wave}/author-qa-${worker}` : `${run}/${wave}/${phase}-${worker}`;
        const jobs = manifest.jobs.filter(job => job.worker === worker);
        const state = { wave, phase, worker, planned_sets: jobs.length, state: 'not_started', recorded_sets: 0,
            pass_sets: 0, nonpass_sets: [], open_set_records: [], model_semantic_response_events: 0, semantic_error_events: 0,
            recorded_case_runs: 0, case_mismatch_runs: 0, not_started_set_ids: jobs.map(job => job.set_id) };
        if (fs.existsSync(`${folder}/run.json`)) {
            const record = read(`${folder}/run.json`);
            if (record.manifest_sha256 !== manifestHash) throw Error(`Different manifest: ${folder}`);
            state.state = 'started_without_final_summary';
            for (const job of jobs) {
                const setFolder = `${folder}/${job.set_id}`;
                if (!fs.existsSync(setFolder)) continue;
                const summaryFile = `${setFolder}/summary.json`;
                if (fs.existsSync(summaryFile)) {
                    const summary = read(summaryFile);
                    state.recorded_sets++;
                    state.not_started_set_ids = state.not_started_set_ids.filter(id => id !== job.set_id);
                    if (summary.outcome === 'pass') state.pass_sets++;
                    else state.nonpass_sets.push({ set_id: job.set_id, outcome: summary.outcome,
                        nonpass_units: summary.nonpass_units, mismatched_run_ids: summary.mismatched_run_ids,
                        mismatched_case_ids: summary.mismatched_case_ids, error: summary.error ?? summary.guard_or_observer_error });
                } else state.open_set_records.push(job.set_id);
                for (const file of fs.readdirSync(setFolder)) {
                    if (!file.endsWith('.chunks.jsonl') && !file.endsWith('.grading.jsonl')) continue;
                    const lines = fs.readFileSync(path.join(setFolder, file), 'utf8').split('\n').filter(Boolean);
                    for (const line of lines) {
                        let event; try { event = JSON.parse(line); } catch { continue; } // A writer can be appending the final line.
                        if (file.endsWith('.chunks.jsonl')) {
                            if (event.response) state.model_semantic_response_events++;
                            if (event.error) state.semantic_error_events++;
                        } else {
                            state.recorded_case_runs++;
                            if (event.matched === false || event.status === 'failed') state.case_mismatch_runs++;
                        }
                    }
                }
            }
            if (fs.existsSync(`${folder}/summary.json`)) {
                const final = read(`${folder}/summary.json`);
                state.state = final.gracefully_stopped || final.interrupted ? 'stopped'
                    : final.stopped_on_execution_error ? 'execution_error'
                        : state.pass_sets === jobs.length ? 'completed_pass' : 'completed_with_nonpass';
                state.not_started_set_ids = final.not_started_set_ids;
            }
        }
        rows.push(state);
    }
}
const result = { observed_at: new Date().toISOString(), version: 'question-verification-2026-09-12-resume-002',
    observation_only: true, api_calls_by_observer: 0,
    response_count_note: 'Recorded semantic response events include validation retries; these are not billable API totals or completed unit counts.', rows };
console.log(JSON.stringify(result, null, 2));
