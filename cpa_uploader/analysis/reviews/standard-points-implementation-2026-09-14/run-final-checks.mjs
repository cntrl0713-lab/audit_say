import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const out=R+'/final-checks-v1';
assert(!fs.existsSync(out));fs.mkdirSync(out);
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const jobs=[
 ['coverage',['--import','tsx',R+'/update-coverage.mjs','--apply']],
 ['analysis-build',['scripts/manage-analysis.mjs']],
 ['analysis-check',['scripts/manage-analysis.mjs','--check']],
 ['review-preservation',['cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs','--check']],
 ['wiki-build',['cpa_uploader/wiki/scripts/build-wiki.mjs']],
 ['wiki-check',['cpa_uploader/wiki/scripts/check-wiki.mjs']],
];
const results=[];
for(const[id,args]of jobs){
 const file=out+'/'+id+'.log',fd=fs.openSync(file,'wx'),start=Date.now();let result;
 try{result=spawnSync(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 const row={id,args,exit_code:result.status,signal:result.signal,elapsed_ms:Date.now()-start,log:ref(file)};
 fs.writeFileSync(out+'/'+id+'.json',JSON.stringify(row,null,2)+'\n',{flag:'wx'});results.push(row);
 assert.equal(result.status,0,`${id} failed; preserve this run before fixing and using a new output version`);console.log(id+' passed');
}
fs.writeFileSync(out+'/completion.json',JSON.stringify({status:'passed',completed_at:new Date().toISOString(),results},null,2)+'\n',{flag:'wx'});
