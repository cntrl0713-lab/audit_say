import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const prior='cpa_uploader/analysis/reviews/case-followup-2026-09-14';
const batch='cpa_uploader/analysis/reviews/case-applied-2026-09-14';
const destination=batch+'/helpers';
const files=['capture-integration-baseline.mjs','integrate.mjs','build-execution.mjs','run-efficient-grading.ts','contract.ts','accounting.ts','seal.mjs','publish.mjs','deploy.mjs','update-coverage.mjs','final-checks.mjs','write-report.mjs','record-root-review.mjs','complete-draft-evidence.mjs'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
fs.mkdirSync(destination+'/reuse-source',{recursive:true});
const origins=[];
for(const name of files){
  const original=prior+'/'+name,bytes=fs.readFileSync(original);
  const copy=destination+'/reuse-source/'+name+'.txt';
  fs.writeFileSync(copy,bytes,{flag:'wx'});
  let content=bytes.toString('utf8').replaceAll('case-followup-2026-09-14','case-applied-2026-09-14');
  content=content.replace(/(from\s+['"])(\.\.\/)/gu,'$1../$2');
  if(name==='run-efficient-grading.ts')content=content.replace("'../../../..'","'../../../../..'");
  if(name==='integrate.mjs')content=content.replaceAll('source-catalog-v3.json','source-catalog-final.json');
  if(name==='build-execution.mjs'){
    content=content.replace("D + '/source-catalog-v2.json', D + '/source-catalog-v3.json'","D + '/source-catalog-final.json'");
    content=content.replace(".map(file => R + '/' + file)",".map(file => R + '/helpers/' + file)");
    content=content.replace("R + '/build-execution.mjs', R + '/recorder-provenance.json'","R + '/helpers/build-execution.mjs', R + '/helpers/provenance.json'");
  }
  if(name==='write-report.mjs')content=content.replaceAll('후속 사례형','적용 확장 사례형').replaceAll('후속 제작한','추가 제작한');
  const file=destination+'/'+name;assert.equal(path.dirname(file),destination);
  fs.writeFileSync(file,content,{flag:'wx'});
  origins.push({original_file:original,original_sha256:hash(bytes),preserved_source_file:copy,preserved_source_sha256:hash(fs.readFileSync(copy)),adapted_file:file,initial_adapted_sha256:hash(Buffer.from(content))});
}
fs.writeFileSync(destination+'/reuse-origins.json',JSON.stringify({created_at:new Date().toISOString(),method:'byte_preserving_source_copy_then_explicit_batch_and_location_adaptation',origins},null,2)+'\n',{flag:'wx'});
console.log({copied:origins.length,output:destination,model_api_calls:0,canonical_writes:0,db_writes:0});
