import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const N='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/incremental-db-publication-v2';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({file,sha256:hash(file)});
assert.equal(process.argv.length,2);assert(!fs.existsSync(N+'/validation.json'));assert(!fs.existsSync(N+'/local-checks'));
const code=['append-contract.mjs','driver.mjs','validate-local.mjs','tests/append-transaction.test.mjs','tests/source-reconstruction.test.mjs','adapt-from-v1.mjs'].map(name=>N+'/'+name);
const protectedFiles=["cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/incremental-db-publication-v1/driver.mjs","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/incremental-db-publication-v1/append-contract.mjs","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/incremental-db-publication-v1/source-provenance.json","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/helpers/provenance.json","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/execution-v1/grading-manifest.json","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/sealed-v1/batch.json","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/authorization.md","cpa_uploader/analysis/reviews/case-trio-next-2026-09-14/policy-input.json"].filter(file=>fs.existsSync(file)).concat(code).map(ref);
const guard=()=>{for(const row of protectedFiles)assert.equal(hash(row.file),row.sha256,'Protected current input changed during local tests');};
fs.mkdirSync(N+'/local-checks');const rows=[],imports=[];
for(const file of code){
 for(const match of fs.readFileSync(file,'utf8').matchAll(/from\s+['"]([^'"]+)['"]/gu))if(match[1].startsWith('.')){const target=path.resolve(path.dirname(file),match[1]);assert(fs.existsSync(target));imports.push({file,specifier:match[1],target:ref(target)});}
}
const checks=[...code.map((file,index)=>['syntax-'+index,['--check',file]]),['targeted-lint',['node_modules/eslint/bin/eslint.js',...code]],['local-transaction-tests',['--import','tsx','--test',N+'/tests/append-transaction.test.mjs',N+'/tests/source-reconstruction.test.mjs']]];
for(const [name,args]of checks){
 guard();const log=N+'/local-checks/'+name+'.log',fd=fs.openSync(log,'wx'),started=Date.now();let result;
 try{result=spawnSync(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 rows.push({name,args,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-started,log:ref(log)});guard();
}
const result={status:rows.every(row=>row.exit_code===0)?'passed':'failed',checked_at:new Date().toISOString(),files:code.map(ref),checks:rows,resolved_imports:imports,protected_inputs:protectedFiles,scope:'Syntax, targeted lint and local synthetic PGlite source reconstruction/transaction tests only. No production importer, model API, canonical installation or DB query.',api_calls:0,canonical_writes:0,db_writes:0};
fs.writeFileSync(N+'/validation.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,checks:rows.map(({name,exit_code})=>({name,exit_code})),api_calls:0,db_writes:0},null,2));
if(result.status!=='passed')process.exitCode=1;
