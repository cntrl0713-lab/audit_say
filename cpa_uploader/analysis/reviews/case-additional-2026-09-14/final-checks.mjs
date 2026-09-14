import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-additional-2026-09-14',out=R+'/final-checks-v1';
assert(!fs.existsSync(out));fs.mkdirSync(out);
const steps=[
 ['analysis-build',['scripts/manage-analysis.mjs']],
 ['analysis-check',['scripts/manage-analysis.mjs','--check']],
 ['analysis-preservation',['cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs','--check']],
 ['wiki-build',['cpa_uploader/wiki/scripts/build-wiki.mjs']],
 ['wiki-check',['cpa_uploader/wiki/scripts/check-wiki.mjs']]
];
const rows=[];
for(const [name,args]of steps){
 const file=out+'/'+name+'.log',fd=fs.openSync(file,'wx'),started=Date.now();let result;
 try{result=spawnSync(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 const row={name,args,exit_code:result.status,elapsed_ms:Date.now()-started,log:{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}};
 rows.push(row);fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(row,null,2)+'\n',{flag:'wx'});
 console.log(name+': '+result.status);assert.equal(result.status,0,'Inspect '+file);
}
fs.writeFileSync(out+'/summary.json',JSON.stringify({status:'passed',completed_at:new Date().toISOString(),checks:rows,semantic_review_replaced:false,model_api_calls:0},null,2)+'\n',{flag:'wx'});
