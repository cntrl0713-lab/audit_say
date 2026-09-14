import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const OLD='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',H=R+'/helpers',N=R+'/incremental-db-publication-v1';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
assert(!fs.existsSync(H+'/reuse-origins.json'));fs.mkdirSync(H+'/reuse-source');fs.mkdirSync(N+'/sources');fs.mkdirSync(N+'/tests');
const origins=[];
function copy(source,target,transform=value=>value){
 const bytes=fs.readFileSync(source),preserved=(target.startsWith(N)?N+'/sources/':H+'/reuse-source/')+target.split('/').at(-1)+'.txt';
 fs.writeFileSync(preserved,bytes,{flag:'wx'});fs.writeFileSync(target,transform(bytes.toString().replaceAll('case-trio-2026-09-14','case-trio-next-2026-09-14')),{flag:'wx'});
 origins.push({source_file:source,sha256:hash(bytes),preserved_file:preserved,target_file:target});
}
const helperFiles=['capture-integration-baseline.mjs','integrate.mjs','record-root-review.mjs','complete-draft-evidence.mjs','source-evidence.mjs','build-execution.mjs','representative-qa.mjs','run-efficient-grading.ts','contract.ts','accounting.ts','seal.mjs','publish.mjs','update-coverage.mjs','write-report.mjs','coverage-contract.mjs','test-coverage-contract.mjs','final-checks.mjs','final-check-paths.mjs','test-final-checks.mjs','test-representative-qa.mjs','validate-static.mjs','tsconfig.helpers.json'];
for(const name of helperFiles)copy(OLD+'/helpers/'+name,H+'/'+name);
copy(OLD+'/prepare-coverage-v2.mjs',H+'/prepare-coverage.mjs',text=>text.replace("from '../../coverage/build-coverage.mjs'","from '../../../coverage/build-coverage.mjs'").replace("from './helpers/coverage-contract.mjs'","from './coverage-contract.mjs'"));
for(const name of ['append-contract.mjs','driver.mjs','validate-local.mjs'])copy(OLD+'/incremental-db-publication-v1/'+name,N+'/'+name);
for(const name of ['append-transaction.test.mjs','source-reconstruction.test.mjs'])copy(OLD+'/incremental-db-publication-v1/tests/'+name,N+'/tests/'+name,text=>text.replaceAll('369 plus','372 plus').replaceAll('length:369','length:372').replace("['369',0","['372',0"));
const inherited=[['collect-source-evidence-v2.mjs','source-collection-predecessor.mjs'],['final-artifact-check.mjs','final-artifact-predecessor.mjs'],['inspect-production.mjs','inspect-production-predecessor.mjs'],['coverage-successor-peer-review.json','coverage-successor-peer-review.json'],['coverage-successor-provenance.json','coverage-successor-provenance.json'],['db-publication-v1/completion.json','prior-db-completion.json'],['db-publication-v1/roundtrip.json','prior-db-roundtrip.json']];
for(const [name,saved]of inherited){const file=OLD+'/'+name,bytes=fs.readFileSync(file),target=(saved.startsWith('prior-db-')?N+'/sources/':H+'/reuse-source/')+saved+'.txt';fs.writeFileSync(target,bytes,{flag:'wx'});origins.push({source_file:file,sha256:hash(bytes),preserved_file:target,target_file:null});}
const prior=JSON.parse(fs.readFileSync(OLD+'/db-publication-v1/roundtrip.json'));assert.equal(prior.status,'passed');assert.equal(prior.after.active.release_id,'a4fb1719-b3fa-43bb-975f-5e1c481e67bd');
write(N+'/sources/installed-functions-after.json',{source:{file:OLD+'/db-publication-v1/roundtrip.json',sha256:hash(fs.readFileSync(OLD+'/db-publication-v1/roundtrip.json'))},functions:prior.after.functions});
const bank=fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json');assert.equal(hash(bank),'fe106741e3b8575f20b1be07786cd034c2ba2f3f4b1a823f2016a2e19a2a9293');assert.equal(JSON.parse(bank).length,372);
write(H+'/reuse-origins.json',{created_at:new Date().toISOString(),reason:'Read and preserve final previous helper bytes and follow-up corrections; only code lineage is reused, never prior content validation or execution as current success.',files:origins,baseline_observed:{file:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',sha256:hash(bank),sets:372},api_calls:0,canonical_writes:0,db_writes:0});
console.log({copied_helpers:helperFiles.length+1,db_code_and_tests:5,api_calls:0,canonical_writes:0,db_writes:0});
