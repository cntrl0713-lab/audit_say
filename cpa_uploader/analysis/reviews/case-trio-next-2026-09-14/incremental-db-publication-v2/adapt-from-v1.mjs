import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',N1=R+'/incremental-db-publication-v1',N2=R+'/incremental-db-publication-v2';
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const read=file=>JSON.parse(fs.readFileSync(file));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
assert.equal(process.argv.length,2);assert(!fs.existsSync(N2+'/source-provenance.json'));assert(!fs.existsSync(N2+'/reuse-origins.json'));
for(const name of ['sources','tests','diffs'])fs.mkdirSync(N2+'/'+name);
const prior=read(N1+'/source-provenance.json');
assert.equal(ref(N1+'/source-provenance.json').sha256,'5db4c2562a2753ba45b6ab54e7299276078040f13ba0c75c3b96c2ab1f96b49d');
for(const row of prior.files)assert.equal(ref(row.preserved_file).sha256,row.sha256);
for(const row of prior.derived_files)assert.equal(ref(row.file).sha256,row.sha256);
const origins=[];
const paths=text=>text.replaceAll('/publication-v1/','/publication-v2/').replaceAll("'/integration-baseline/","'/integration-baseline-v2/").replaceAll("'/integration-baseline.json'","'/integration-baseline-v2.json'");
function copy(name,transform=text=>text){
 const source=N1+'/'+name,saved=N2+'/sources/'+name.split('/').at(-1)+'.v1.txt',target=N2+'/'+name,bytes=fs.readFileSync(source);
 fs.writeFileSync(saved,bytes,{flag:'wx'});fs.writeFileSync(target,transform(bytes.toString()),{flag:'wx'});
 const result=spawnSync('git',['diff','--no-index','--',saved,target],{shell:false,windowsHide:true,encoding:'utf8'});assert([0,1].includes(result.status));
 const diff=N2+'/diffs/'+name.split('/').at(-1)+'.diff';fs.writeFileSync(diff,result.stdout,{flag:'wx'});
 origins.push({...ref(source),preserved_file:saved,target:ref(target),diff:ref(diff),changed:result.status===1});
}
copy('append-contract.mjs',text=>paths(text).replace("N=R+'/incremental-db-publication-v1'","N=R+'/incremental-db-publication-v2'"));
copy('driver.mjs',text=>paths(text).replace("R+'/publication-v2/stage-completion.json',","R+'/publication-v2/stage-completion.json',R+'/candidate-publication-v2.json',"));
copy('validate-local.mjs',text=>text.replaceAll('/incremental-db-publication-v1','/incremental-db-publication-v2')
 .replace("'tests/source-reconstruction.test.mjs'].map(name=>N+'/'+name)","'tests/source-reconstruction.test.mjs','adapt-from-v1.mjs'].map(name=>N+'/'+name)")
 .replace("['cpa_uploader/data/cpa_question_sets_v3.authoring.json','cpa_uploader/data/learning-question-classifications.json','cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/authorization.md','cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/policy-input.json']",JSON.stringify([N1+'/driver.mjs',N1+'/append-contract.mjs',N1+'/source-provenance.json',R+'/helpers/provenance.json',R+'/execution-v1/grading-manifest.json',R+'/sealed-v1/batch.json',R+'/authorization.md',R+'/policy-input.json']))
 .replace(".filter(file=>fs.existsSync(file)).map(ref);",".filter(file=>fs.existsSync(file)).concat(code).map(ref);"));
for(const name of ['tests/append-transaction.test.mjs','tests/source-reconstruction.test.mjs'])copy(name);
copy('README.md',text=>paths(text).replaceAll('/incremental-db-publication-v1','/incremental-db-publication-v2'));
const copiedProvenance=N2+'/sources/source-provenance.v1.json.txt';fs.copyFileSync(N1+'/source-provenance.json',copiedProvenance,fs.constants.COPYFILE_EXCL);
const functions=N2+'/sources/installed-functions-after.json';fs.copyFileSync(N1+'/sources/installed-functions-after.json',functions,fs.constants.COPYFILE_EXCL);assert.equal(ref(functions).sha256,ref(N1+'/sources/installed-functions-after.json').sha256);
const originRecord={version:1,created_at:new Date().toISOString(),reason:'The separately completed or in-progress standard abbreviation corrections require a new publication baseline. N1, sealed case content, grading manifest and existing helpers remain immutable. Adapt only new N/STAGE/baseline references and bind the replacement candidate input; SQL/grading/publication semantics remain unchanged.',files:origins,prior_source_provenance:{...ref(N1+'/source-provenance.json'),preserved_file:copiedProvenance},reused_preserved_sources:prior.files.map(row=>({file:row.preserved_file,sha256:row.sha256})),prior_derived_files:prior.derived_files,api_calls:0,canonical_writes:0,db_writes:0};
write(N2+'/reuse-origins.json',originRecord);
write(N2+'/source-provenance.json',{version:2,collected_at:new Date().toISOString(),method:'Successor of the current batch N1. Reuse its immutable source copies and function provenance, preserve each N1 helper byte-for-byte, and bind the new N2 code through reuse-origins and a separately required current independent review. No prior validation or execution result is current success.',files:[...prior.files,...origins.map(row=>({file:row.file,sha256:row.sha256,preserved_file:row.preserved_file,status:'immutable_N1_source_copy_for_path_only_successor'})),{file:N1+'/source-provenance.json',sha256:ref(N1+'/source-provenance.json').sha256,preserved_file:copiedProvenance,status:'unchanged_N1_source_provenance'}],derived_files:[...prior.derived_files,ref(functions),ref(N2+'/reuse-origins.json')],derivation:{...prior.derivation,file:functions,prior_source_provenance:ref(N1+'/source-provenance.json'),current_code_provenance:ref(N2+'/reuse-origins.json')},input_paths:{baseline:R+'/integration-baseline-v2.json',baseline_bank:R+'/integration-baseline-v2/bank.json',candidate:R+'/candidate-publication-v2.json',stage:R+'/publication-v2/stage',installation:R+'/publication-v2/install-completion.json',sealed_batch:R+'/sealed-v1/batch.json',changed_ids:R+'/changed-sets-v1.json',db_output:R+'/db-publication-v1'},http_success:prior.http_success,api_calls:0,canonical_writes:0,db_writes:0});
for(const row of origins){assert.equal(ref(row.file).sha256,row.sha256);assert.equal(ref(row.preserved_file).sha256,row.sha256);}
console.log(JSON.stringify({status:'prepared_code_only',copied_files:origins.length,source_provenance:ref(N2+'/source-provenance.json'),api_calls:0,canonical_writes:0,db_writes:0},null,2));
