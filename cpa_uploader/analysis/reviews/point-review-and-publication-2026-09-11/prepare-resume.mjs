import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [original,worker,output]=process.argv.slice(2);
if(!original||!['a','b','c'].includes(worker)||!output||process.argv.length!==5)throw Error('Use <original execution directory> <a|b|c> <new execution directory>.');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const file=path.join(original,'manifest.json'),manifest=read(file);
const summaryFile=path.join(original,`semantic-${worker}`,'summary.json'),summary=read(summaryFile);
if(!summary.finished_at||summary.worker!==worker||summary.manifest_sha256!==hash(file))throw Error('Prior worker has not completed under this manifest.');
if(fs.existsSync(output))throw Error('Use a fresh resume directory.');
const finished=summary.results.filter(row=>['pass','semantic_nonpass'].includes(row.outcome));
const selected=manifest.jobs.filter(job=>job.worker===worker&&!finished.some(row=>row.set_id===job.set_id));
if(!selected.length)throw Error('No incomplete jobs to resume.');
for(const row of [{file:manifest.bank_file,sha256:manifest.bank_sha256},...manifest.code_files,...selected.flatMap(job=>[
  {file:job.file,sha256:job.sha256},{file:job.plan_file,sha256:job.plan_sha256},{file:job.qa_file,sha256:job.qa_sha256},...job.source_files])]){
  if(hash(row.file)!==row.sha256)throw Error(`Frozen input changed: ${row.file}`);
}
const resumed={...manifest,created_at:new Date().toISOString(),purpose:'resume_incomplete_jobs_after_recorded_transport_or_response_validation_error',
  predecessor:{manifest_file:file.replaceAll('\\','/'),manifest_sha256:hash(file),summary_file:summaryFile.replaceAll('\\','/'),summary_sha256:hash(summaryFile)},
  preserved_completed:finished.map(row=>({set_id:row.set_id,outcome:row.outcome,receipt_file:row.receipt_file,receipt_sha256:row.receipt_sha256})),
  workers:[{id:worker,units:selected.reduce((sum,job)=>sum+job.semantic_units,0)}],jobs:selected};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(resumed,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,worker,resumed_sets:selected.length,preserved_finished:finished.length,api_calls:0},null,2));
