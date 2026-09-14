import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const prior='cpa_uploader/analysis/reviews/case-applied-2026-09-14/helpers';
const destination='cpa_uploader/analysis/reviews/case-deepening-2026-09-14/helpers';
const files=['capture-integration-baseline.mjs','integrate.mjs','build-execution.mjs','run-efficient-grading.ts','contract.ts','accounting.ts','seal.mjs','publish.mjs','deploy.mjs','update-coverage.mjs','final-checks.mjs','write-report.mjs','record-root-review.mjs','complete-draft-evidence.mjs','source-evidence.mjs','validate-static.mjs','finalize-provenance.mjs','tsconfig.helpers.json','README.md'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(destination+'/reuse-source',{recursive:true});
const origins=[];
for(const name of files){
 const original=prior+'/'+name,bytes=fs.readFileSync(original),copy=destination+'/reuse-source/'+name+'.txt';
 fs.writeFileSync(copy,bytes,{flag:'wx'});
 const content=bytes.toString('utf8').replaceAll('case-applied-2026-09-14','case-deepening-2026-09-14');
 const file=destination+'/'+name;assert.equal(path.dirname(file),destination);
 fs.writeFileSync(file,content,{flag:'wx'});
 origins.push({original_file:original,original_sha256:hash(bytes),preserved_source_file:copy,preserved_source_sha256:hash(fs.readFileSync(copy)),adapted_file:file,initial_adapted_sha256:hash(Buffer.from(content))});
}
fs.writeFileSync(destination+'/reuse-origins.json',JSON.stringify({created_at:new Date().toISOString(),method:'exact_prior_source_bytes_preserved_then_new_batch_path_adaptation',origins},null,2)+'\n',{flag:'wx'});
console.log({copied:origins.length,output:destination,actual_api_calls:0,canonical_writes:0,db_writes:0});
