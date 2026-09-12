import fs from 'node:fs';
import { createHash } from 'node:crypto';
const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const origin=`${root}/execution-canary-v2/manifest.json`;
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity=file=>({file,sha256:hash(file)});
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const [setId,worker]=process.argv.slice(2);
if(process.argv.length!==4||!['a','b','c'].includes(worker))throw Error('Provide the canary set ID and grading worker.');
const manifest=read(origin),job=manifest.jobs.find(job=>job.set_id===setId);
if(!job)throw Error('Not a canary set');
const output=`${root}/grading-canary-v2-${setId}`;
if(fs.existsSync(output))throw Error('Preserve previous grading output.');
const runDirectory=`${root}/execution-canary-v2/semantic-${job.worker}`;
const receiptFile=`${runDirectory}/${setId}/semantic.json`;
const summaryFile=`${runDirectory}/${setId}/summary.json`;
const summary=read(summaryFile),receipt=read(receiptFile).reviews?.[0];
if(summary.outcome!=='pass'||receipt?.verdict!=='pass'||receipt?.execution.transport!=='model')throw Error('Completed actual semantic pass required.');
const runner=`${root}/b/validation-worker-v3.mjs`;
const runnerEvidence=read(`${root}/b/validation-worker-v3-checks.json`);
// The worker independently validates all original provenance before any API call.
if(!runnerEvidence)throw Error('Missing worker validation evidence.');
const provenance={manifest_file:origin,manifest_sha256:hash(origin),worker:job.worker,run_directory:runDirectory,
    receipt_file:receiptFile,receipt_sha256:hash(receiptFile),run_sha256:hash(`${runDirectory}/run.json`),
    summary_sha256:hash(summaryFile),request_sha256:hash(`${runDirectory}/${setId}/request.json`)};
const result={...manifest,created_at:new Date().toISOString(),purpose:'Actual criterion counterexample grading after completed semantic review',
    predecessor:identity(origin),code_files:[...manifest.code_files,identity(runner)],
    workers:[{id:worker,units:job.semantic_units}],jobs:[{...job,worker,semantic_provenance:provenance}]};
fs.mkdirSync(output);
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,set_id:setId,worker,semantic_receipt_sha256:provenance.receipt_sha256,api_calls:0}));
