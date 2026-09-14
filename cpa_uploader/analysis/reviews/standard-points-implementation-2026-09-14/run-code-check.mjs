import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const mode=process.argv[2];assert(['tests','types'].includes(mode));
const dir=R+'/code-checks';fs.mkdirSync(dir,{recursive:true});
const args=mode==='tests'?['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','--test','tests/**/*.test.ts']:['node_modules/typescript/bin/tsc','--noEmit'];
const file=dir+'/'+mode+'.log',fd=fs.openSync(file,'wx'),started_at=new Date().toISOString();let run;
try{run=spawnSync(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
const result={command:[process.execPath,...args],started_at,completed_at:new Date().toISOString(),exit_code:run.status,signal:run.signal,log:{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}};
fs.writeFileSync(dir+'/'+mode+'.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
console.log(fs.readFileSync(file,'utf8').split(/\r?\n/).slice(mode==='tests'?-18:-50).join('\n'));
process.exitCode=run.status??1;
