import fs from 'node:fs';
import { createHash } from 'node:crypto';

// Read-only projection of writer records, not an independent receipt validation.
const base = 'cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const run = `${base}/execution-resumes/resume-2026-09-12-v4`;
const qa = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/validation-resumes/resume-2026-09-12-v4';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readIf = file => fs.existsSync(file) ? read(file) : null;
const rows = [];
for (const wave of ['canary', 'remaining']) {
    const manifestFile = `${run}/${wave}/manifest.json`, manifest = read(manifestFile), manifestHash = hash(manifestFile);
    for (const phase of ['semantic', 'grading', 'author-qa']) for (const worker of ['a', 'b', 'c']) {
        const folder = phase === 'author-qa' ? `${qa}/${wave}/author-qa-${worker}` : `${run}/${wave}/${phase}-${worker}`;
        const jobs = manifest.jobs.filter(job => job.worker === worker);
        const row = { wave, phase, worker, state: 'not_started', planned_sets: jobs.length, pass_sets: 0,
            finished_sets: 0, nonpass_sets: [], open_sets: [], not_started_set_ids: jobs.map(job => job.set_id),
            semantic_response_events: 0, grading_runs: 0, grading_mismatches: 0, author_qa_observations: 0 };
        const record = readIf(`${folder}/run.json`), final = readIf(`${folder}/summary.json`);
        if (record) {
            const preserved = record.phase === 'grading_preserved_semantic';
            const boundHash = preserved ? record.provenance.current_manifest.sha256 : record.manifest_sha256;
            if (boundHash !== manifestHash) throw Error(`Manifest identity differs: ${folder}`);
            if (preserved && !(wave === 'canary' && phase === 'grading' && worker === 'a')) throw Error('Unexpected preserved-semantic run');
            row.state = 'running';
            if (preserved) row.preserved_semantic_units = record.provenance.original_semantic_units;
            for (const job of jobs) {
                const setFolder = `${folder}/${job.set_id}`;
                if (!fs.existsSync(setFolder)) continue;
                row.not_started_set_ids = row.not_started_set_ids.filter(id => id !== job.set_id);
                const summary = preserved ? final : readIf(`${setFolder}/summary.json`);
                if (summary) {
                    row.finished_sets++;
                    if (summary.outcome === 'pass') row.pass_sets++;
                    else row.nonpass_sets.push({ set_id: job.set_id, outcome: summary.outcome,
                        nonpass_units: summary.nonpass_units, mismatched_run_ids: summary.mismatched_run_ids ?? summary.validation?.mismatched_run_ids,
                        mismatched_case_ids: summary.mismatched_case_ids, error: summary.error ?? summary.guard_or_observer_error });
                } else row.open_sets.push(job.set_id);
                for (const file of fs.readdirSync(setFolder)) {
                    if (!file.endsWith('.chunks.jsonl') && !file.endsWith('.grading.jsonl')) continue;
                    for (const line of fs.readFileSync(`${setFolder}/${file}`, 'utf8').split('\n').filter(Boolean)) {
                        let event; try { event = JSON.parse(line); } catch { continue; }
                        if (file.endsWith('.chunks.jsonl') && event.response) row.semantic_response_events++;
                        if (file.endsWith('.grading.jsonl')) { row.grading_runs++; if (event.matched === false || event.status === 'failed') row.grading_mismatches++; }
                    }
                }
                const authorFolder = `${setFolder}/author-qa`;
                if (phase === 'author-qa' && fs.existsSync(authorFolder)) {
                    row.author_qa_observations += fs.readdirSync(authorFolder).filter(file => /^case-\d+-attempt-\d+\.json$/.test(file)).length;
                }
            }
            if (final) {
                row.state = final.gracefully_stopped || final.interrupted ? 'stopped'
                    : final.stopped_on_execution_error || final.outcome === 'execution_error' ? 'execution_error'
                        : row.pass_sets === jobs.length ? 'completed_pass' : 'completed_with_nonpass';
                if (final.not_started_set_ids) row.not_started_set_ids = final.not_started_set_ids;
            }
        }
        if (wave === 'canary' && phase === 'semantic' && worker === 'a') {
            const preservedRun = readIf(`${run}/canary/grading-a/run.json`);
            if (preservedRun?.provenance?.current_manifest?.sha256 === manifestHash) {
                row.state = 'prior_model_semantic_inputs_validated_by_grading_wrapper';
                row.preserved_units = preservedRun.provenance.original_semantic_units;
                row.new_semantic_calls = 0;
            }
        }
        rows.push(row);
    }
}
console.log(JSON.stringify({ observed_at: new Date().toISOString(), version: 'question-verification-2026-09-12-resume-004',
    observation_only: true, api_calls_by_observer: 0, note: 'Response events/QA records include retries and are not billing totals or independent proof of completion.', rows }, null, 2));
