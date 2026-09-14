import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const H='cpa_uploader/analysis/reviews/case-deepening-2026-09-14/helpers';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({file,sha256:hash(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const origin=read(H+'/one-point-v2-origins.json');
const checks=read(H+'/static-checks-v2.json');assert.equal(checks.status,'passed');
assert(!fs.existsSync(H+'/provenance-v2.json'),'Preserve prior provenance versions');
fs.mkdirSync(H+'/one-point-v2-diffs');
const changes=[];
for(const row of origin.files){
  if(row.preserve_in_place){assert.equal(hash(row.file),row.sha256);continue;}
  assert.equal(hash(row.preserved_file),row.preserved_sha256);
  const result=spawnSync('git',['diff','--no-index','--no-ext-diff','--',row.preserved_file,row.file],{shell:false,windowsHide:true,encoding:'utf8'});
  assert([0,1].includes(result.status),'Unable to preserve follow-up diff');
  const file=H+'/one-point-v2-diffs/'+row.file.split('/').at(-1)+'.diff';
  fs.writeFileSync(file,result.stdout,{flag:'wx'});
  changes.push({before:{file:row.preserved_file,sha256:row.preserved_sha256},current:ref(row.file),diff:ref(file)});
}
const current=fs.readdirSync(H).filter(name=>/\.(mjs|ts|md)$/u.test(name)||name==='tsconfig.helpers.json').map(name=>H+'/'+name);
const value={version:2,created_at:new Date().toISOString(),method:'one_point_representative_contract_followup',
  prior_provenance:ref(H+'/provenance.json'),prior_validation:ref(H+'/static-checks.json'),origins:ref(H+'/one-point-v2-origins.json'),
  changes,added_helpers:['representative-qa.mjs','test-representative-qa.mjs','finalize-provenance-v2.mjs'].map(name=>ref(H+'/'+name)),
  decisions:['Keep the single independent action at one point. No integer partial score exists between zero and one.',
    'Use model and representative wrong boundary answers for one-point questions; do not evaluate blank context-only one-point answers in partial requests.',
    'Compute author QA counts from applicable roles; reject duplicate, missing, unknown or false partial cases. Freeze the role scope in integration, policy and manifest.',
    'Preserve common efficient grading/runtime/publishing contracts and retain original helper provenance and validation unchanged.',
    'Report actual role counts from final evidence; do not treat planned grading as executed.'],
  unchanged_common_contracts:['cpa_uploader/questionEfficientReview.ts',H+'/contract.ts',H+'/run-efficient-grading.ts',H+'/seal.mjs'].map(ref),
  current_helper_files:current.map(ref),validation:ref(H+'/static-checks-v2.json'),actual_model_calls:0,canonical_writes:0,db_writes:0,integration_executed:false};
fs.writeFileSync(H+'/provenance-v2.json',JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log({provenance:ref(H+'/provenance-v2.json'),helper_files:current.length});
