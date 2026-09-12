import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = read(path.join(here, 'candidate-v3/grading-manifest.json'));
const reused = manifest.reused_observations.map(r => read(r.observation.file));
const current = [], workerStates = [];
for (const worker of ['a', 'b', 'c']) {
    const directory = path.join(here, 'run-v2', `worker-${worker}`);
    const records = fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => path.join(directory, d.name, 'observation.json')).filter(fs.existsSync).map(read) : [];
    current.push(...records);
    const summary = path.join(directory, 'summary.json');
    workerStates.push({ worker, new_completed: records.length, final_status: fs.existsSync(summary) ? read(summary).status : 'running' });
}
const observations = [...reused, ...current], comparisons = observations.flatMap(o => o.subquestions.filter(q => q.evaluated).map(q => ({ entry_id: o.entry_id, ...q })));
const calls = current.reduce((n, o) => n + o.actual_sdk_calls, 0);
const costs = current.flatMap(o => o.usage.map(u => u.cost));
const unknown = costs.filter(c => c.usd === null).length;
console.log(JSON.stringify({ as_of: new Date().toISOString(), workers: workerStates,
    observations: observations.length, planned_observations: manifest.entries.length, new_observations: current.length, reused_observations: reused.length,
    evaluated_answers: comparisons.length, planned_answers: 830, exact_points: comparisons.filter(q => q.delta === 0).length,
    within_one: comparisons.filter(q => Math.abs(q.delta) <= 1).length,
    outside_one: comparisons.filter(q => Math.abs(q.delta) > 1).map(q => ({ entry_id: q.entry_id, subquestion_id: q.subquestion_id, expected: q.expected_points, actual: q.actual_points, delta: q.delta })),
    security_findings: observations.flatMap(o => o.security_findings.map(finding => ({ entry_id: o.entry_id, finding }))),
    new_actual_calls: calls, all_actual_calls_including_prior_excluded: 67 + calls,
    new_usd: unknown ? null : costs.reduce((n, c) => n + c.usd, 0),
    all_usd_including_prior_excluded: unknown ? null : .07273115 + costs.reduce((n, c) => n + c.usd, 0),
    unknown_cost_responses: unknown, pending_requests_not_yet_included_in_accounting: true }, null, 2));
