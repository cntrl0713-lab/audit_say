import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const H='cpa_uploader/analysis/reviews/case-applied-2026-09-14/helpers';
const files=fs.readdirSync(H).filter(name=>/\.(mjs|ts)$/u.test(name)).map(name=>H+'/'+name);
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const protectedFiles=['setup.mjs','authorization.md','baseline.json','policy-input.json','README.md'].map(name=>path.posix.dirname(H)+'/'+name);
const before=protectedFiles.map(file=>({file,sha256:hash(file)}));
const rows=[];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{shell:false,windowsHide:true,encoding:'utf8'});
  rows.push({check:'node_syntax',file,exit_code:result.status,output:result.stdout+result.stderr});
}
for(const file of files){
  const content=fs.readFileSync(file,'utf8');
  for(const match of content.matchAll(/from\s+['"]([^'"]+)['"]/gu))if(match[1].startsWith('.')){
    const target=path.resolve(path.dirname(file),match[1]);
    assert(fs.existsSync(target),'Unresolved relative import: '+file+' -> '+match[1]);
  }
}
for(const [check,args]of [
  ['targeted_lint',['node_modules/eslint/bin/eslint.js',...files]],
  ['targeted_typecheck',['node_modules/typescript/bin/tsc','--project',H+'/tsconfig.helpers.json']],
]){
  const result=spawnSync(process.execPath,args,{shell:false,windowsHide:true,encoding:'utf8'});
  rows.push({check,exit_code:result.status,output:result.stdout+result.stderr});
}
for(const identity of before)assert.equal(hash(identity.file),identity.sha256,'Root-owned input changed during helper checks');
const result={checked_at:new Date().toISOString(),status:rows.every(row=>row.exit_code===0)?'passed':'failed',checks:rows,protected_inputs:before,actual_api_calls:0,canonical_writes:0,db_writes:0,batch_runtime_dry_run:'not_run_missing_final_authoring_inputs'};
fs.writeFileSync(H+'/static-checks.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,checks:rows.map(row=>({check:row.check,file:row.file,exit_code:row.exit_code,...(row.exit_code?{output:row.output}:{})}))},null,2));
if(result.status!=='passed')process.exitCode=1;
