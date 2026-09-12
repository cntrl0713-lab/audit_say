import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = JSON.parse(fs.readFileSync(path.join(directory, 'initial-grading-runtime-lock.json'), 'utf8'));
process.loadEnvFile('.env.local');
for (const row of [before.manifest, before.comparison, ...before.code_files, ...before.input_files]) {
    if (sha(row.file) !== row.sha256) throw new Error(`Changed probe input: ${row.file}`);
}
const output = 'cpa_uploader/drafts/delegated-authoring-2026-09-11/production-readiness-2026-09-11/02-t19-judgment-refill';
const lock = {...before, created_at: new Date().toISOString(),
    predecessor: {file: path.join(directory, 'initial-grading-runtime-lock.json'), sha256: sha(path.join(directory, 'initial-grading-runtime-lock.json'))},
    resumption_basis: 'User reported API refill after first HTTP429; one-case recheck before further calls.',
    output,
};
fs.writeFileSync(path.join(directory, 'refill-grading-runtime-lock.json'), JSON.stringify(lock, null, 2)+'\n', {flag:'wx'});
const result = spawnSync(process.execPath, ['--import','tsx','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts',
    '--file', before.input_files[0].file, '--qa', before.input_files[1].file, '--only', before.case.id, '--output', output],
    {cwd: process.cwd(), env: process.env, encoding:'utf8', stdio:['ignore','pipe','pipe']});
const summaryPath=path.join(output,'summary.json');
const summary=fs.existsSync(summaryPath)?JSON.parse(fs.readFileSync(summaryPath,'utf8')):null;
const evidence={finished_at:new Date().toISOString(),exit_code:result.status,summary_file:summaryPath,summary,
    full_semantic_or_grading_complete:false};
fs.writeFileSync(path.join(directory,'refill-grading-result.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
if(summary?.stopped_on_execution_error) fs.writeFileSync(path.join(directory,'refill-api-halt.json'),JSON.stringify({
    halted_at:new Date().toISOString(),reason:'Representative live grading failed after reported refill; no further calls in this run.',
    error:summary.records.find(row=>row.error)?.error, result_file:'refill-grading-result.json'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(evidence,null,2));
if(result.status!==0)process.exitCode=1;
