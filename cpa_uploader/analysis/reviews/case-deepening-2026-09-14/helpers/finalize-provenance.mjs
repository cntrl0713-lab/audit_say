import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const H='cpa_uploader/analysis/reviews/case-deepening-2026-09-14/helpers';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file));
const origin=read(H+'/reuse-origins.json');
const checks=read(H+'/static-checks.json');assert.equal(checks.status,'passed');
assert(!fs.existsSync(H+'/provenance.json'),'Finalize once, before runtime freeze; preserve prior provenance on later revisions');
fs.mkdirSync(H+'/reuse-diffs');
const changes=[];
for(const row of origin.origins){
  assert.equal(hash(row.original_file),row.original_sha256);
  assert.equal(hash(row.preserved_source_file),row.preserved_source_sha256);
  const result=spawnSync('git',['diff','--no-index','--no-ext-diff','--',row.preserved_source_file,row.adapted_file],{shell:false,windowsHide:true,encoding:'utf8'});
  assert([0,1].includes(result.status),'Unable to record code diff');
  const file=H+'/reuse-diffs/'+row.adapted_file.split('/').at(-1)+'.diff';
  fs.writeFileSync(file,result.stdout,{flag:'wx'});
  changes.push({...row,final_adapted_sha256:hash(row.adapted_file),diff:{file,sha256:hash(file)}});
}
const current=fs.readdirSync(H).filter(name=>/\.(mjs|ts|md)$/u.test(name)||name==='tsconfig.helpers.json').map(name=>H+'/'+name);
const priorEvidence=['final-check-retry-plan.json','final-checks-v1/analysis-build.json','final-checks-v1/analysis-build.log','final-checks-v2/summary.json'].map(name=>'cpa_uploader/analysis/reviews/case-applied-2026-09-14/'+name);
const value={created_at:new Date().toISOString(),method:'prior_source_preservation_and_explicit_helper_adaptation',prior_batch:'case-applied-2026-09-14',current_batch:'case-deepening-2026-09-14',
  changes:['Updated batch paths with unchanged helper-directory depth and relative imports.','Retained final source-catalog filename and root-selected source-evidence-plan; final source units and peers are not yet asserted complete.','Added final-checks --output/--prior-output, write-once attempt and failed summaries, prior-file guards, and mock-runner preservation regression tests.','Added write-report --final-checks to require a complete successful selected check run and verify prior preserved logs.','Preserved six-case/eighteen-question scope, Luna, null unspecified monetary budget, stop guards, actual usage, security checks, immutable inputs, staged publication and rollback.','Retained runtime-derived report totals; no prior question counts or actual grading/publication outcomes were copied as new outcomes.'],
  prior_failure_design_evidence:priorEvidence.map(file=>({file,sha256:hash(file)})),
  pricing:{decision:'Historical pinned-rate arithmetic reused explicitly; no new current-price verification claim.',upstream_file:'cpa_uploader/analysis/reviews/case-applied-2026-09-14/helpers/accounting.ts',checked_at_in_source:'2026-09-12'},
  source_origins:changes,current_helper_files:current.map(file=>({file,sha256:hash(file)})),validation:{file:H+'/static-checks.json',sha256:hash(H+'/static-checks.json')},actual_model_calls:0,canonical_writes:0,db_writes:0};
fs.writeFileSync(H+'/provenance.json',JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log({provenance:H+'/provenance.json',sha256:hash(H+'/provenance.json'),helpers:current.length});
