import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const old='cpa_uploader/analysis/reviews/case-deepening-2026-09-14';
const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const H=R+'/helpers',N=R+'/incremental-db-publication-v1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
assert(!fs.existsSync(H));assert(!fs.existsSync(N));
fs.mkdirSync(H);fs.mkdirSync(H+'/reuse-source');fs.mkdirSync(N);fs.mkdirSync(N+'/sources');
const origins=[];
const adapt=(file,target,transform=value=>value)=>{
 const bytes=fs.readFileSync(file),snapshot=(target.startsWith(N)?N+'/sources/':H+'/reuse-source/')+target.split('/').at(-1)+'.txt';
 fs.writeFileSync(snapshot,bytes,{flag:'wx'});
 const content=transform(bytes.toString().replaceAll('case-deepening-2026-09-14','case-trio-2026-09-14'));
 fs.writeFileSync(target,content,{flag:'wx'});origins.push({source_file:file,sha256:sha(bytes),preserved_file:snapshot,target_file:target});
};
const files=['capture-integration-baseline.mjs','integrate.mjs','record-root-review.mjs','complete-draft-evidence.mjs','source-evidence.mjs','build-execution.mjs','representative-qa.mjs','run-efficient-grading.ts','contract.ts','accounting.ts','seal.mjs','final-checks.mjs','final-check-paths.mjs','test-final-checks.mjs','test-representative-qa.mjs','validate-static.mjs','tsconfig.helpers.json'];
for(const name of files)adapt(old+'/helpers/'+name,H+'/'+name,text=>{
 text=text.replaceAll("['a','b']","['a','b','c']").replaceAll("['a', 'b'][index % 2]","['a', 'b', 'c'][index % 3]")
  .replaceAll("R+'/helpers/provenance.json',R+'/helpers/provenance-v2.json'","R+'/helpers/provenance.json'")
  .replaceAll("R + '/helpers/provenance.json', R + '/helpers/provenance-v2.json'","R + '/helpers/provenance.json'");
 if(name==='integrate.mjs')text=text.replace('sets.length,3','sets.length,1').replace('rs.length,9','rs.length,3')
  .replaceAll('changes.length,6','changes.length,3').replace('size,6','size,3').replace('question_count,18','question_count,9')
  .replaceAll('new_cases:6','new_cases:3').replaceAll('new_questions:18','new_questions:9');
 if(name==='record-root-review.mjs')text=text.replace("'root-review-notes-b.json'","'root-review-notes-b.json','root-review-notes-c.json'")
  .replace('notes.length,18','notes.length,9').replace('size,18','size,9').replace('sets.length,6','sets.length,3')
  .replace("'a-peer-review.json','b-peer-review.json'","'c/sets.json','c/design.json','c/review.json','c/qa.json','a-peer-review.json','b-peer-review.json','c-peer-review.json'");
 if(name==='complete-draft-evidence.mjs')text=text.replace("...walk(D+'/b')","...walk(D+'/b'),...walk(D+'/c')")
  .replace("D+'/b-peer-review.json'","D+'/b-peer-review.json',D+'/c-peer-review.json'");
 if(name==='build-execution.mjs')text=text.replace('size, 6','size, 3').replace('ids.length, 6','ids.length, 3')
  .replaceAll('six new case','three new case').replaceAll('six new cases','three new cases').replaceAll('all 18 questions','all 9 questions')
  .replace('신규 6사례·18물음','신규 3사례·9물음');
 return text;
});
for(const name of ['publish.mjs','update-coverage.mjs','write-report.mjs'])adapt(old+'/post-concurrent-helpers/'+name,H+'/'+name,text=>text
 .replaceAll('publication-v2','publication-v1').replaceAll('db-publication-v2','db-publication-v1')
 .replaceAll('candidate-v2','candidate-v1').replaceAll('classification-v2','classification-v1').replaceAll('integration-baseline-v2','integration-baseline')
 .replaceAll('ids.length,6','ids.length,3').replaceAll('proposals.length,6','proposals.length,3').replaceAll('size,6','size,3')
 .replaceAll('심화 사례형','추가 사례형'));
for(const name of ['append-contract.mjs','driver.mjs'])adapt(old+'/incremental-db-publication-v2/'+name,N+'/'+name,text=>text
 .replaceAll('incremental-db-publication-v2','incremental-db-publication-v1').replaceAll('publication-v2','publication-v1').replaceAll('db-publication-v2','db-publication-v1')
 .replaceAll('integration-baseline-v2','integration-baseline').replaceAll('ids.length,6','ids.length,3').replaceAll('size,6','size,3').replaceAll('added.length,6','added.length,3')
 .replaceAll('the six reviewed','the three reviewed').replaceAll('exact_baseline_plus_six','exact_baseline_plus_three').replaceAll('exact-six-case-append','exact-three-case-append')
 .replaceAll(",R+'/concurrent-reuse-validation-v2.json'",''));
const functionSource=old+'/db-publication-v2/roundtrip.json';
const functionBytes=fs.readFileSync(functionSource);fs.writeFileSync(N+'/sources/prior-db-roundtrip.json',functionBytes,{flag:'wx'});
const prior=JSON.parse(functionBytes);assert.equal(prior.status,'passed');assert(Array.isArray(prior.after.functions));
write(N+'/sources/installed-functions-after.json',{source:{file:functionSource,sha256:sha(functionBytes)},functions:prior.after.functions});
const inherited=['coverage-field-correction.json','correct-coverage-fields.mjs','incremental-db-publication-v2/independent-review.json','incremental-db-publication-v2/local-guard-tests.json'];
for(const name of inherited){const file=old+'/'+name;if(!fs.existsSync(file))continue;const bytes=fs.readFileSync(file),saved=N+'/sources/'+name.replaceAll('/','--')+'.txt';fs.writeFileSync(saved,bytes,{flag:'wx'});origins.push({source_file:file,sha256:sha(bytes),preserved_file:saved,target_file:null});}
origins.push({source_file:functionSource,sha256:sha(functionBytes),preserved_file:N+'/sources/prior-db-roundtrip.json',target_file:null});
write(H+'/reuse-origins.json',{created_at:new Date().toISOString(),reason:'Reuse only reviewed local helper contracts, not their execution or content approval.',files:origins});
console.log({helper_files:files.length+3,db_helpers:2,api_calls:0,canonical_writes:0,db_writes:0});
