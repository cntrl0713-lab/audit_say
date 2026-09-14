import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseFinalChecksArgs,finalChecksDirectory} from './final-check-paths.mjs';
const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const steps=[
 ['analysis-build',['scripts/manage-analysis.mjs']],
 ['analysis-check',['scripts/manage-analysis.mjs','--check']],
 ['analysis-preservation',['cpa_uploader/analysis/reviews/migrate-review-artifacts.mjs','--check']],
 ['wiki-build',['cpa_uploader/wiki/scripts/build-wiki.mjs']],
 ['wiki-check',['cpa_uploader/wiki/scripts/check-wiki.mjs']]
];
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({file,sha256:hash(file)});
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
function captureDirectory(directory){
 assert(!fs.lstatSync(directory).isSymbolicLink(),'Prior output cannot be a symlink');
 assert(fs.statSync(directory).isDirectory(),'Prior output must exist');
 const walk=current=>fs.readdirSync(current,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(current,entry.name);assert(!entry.isSymbolicLink(),'No symlink evidence traversal');
  return entry.isDirectory()?walk(file):[ref(file)];
 });
 const files=walk(directory).sort((a,b)=>a.file.localeCompare(b.file));assert(files.length,'Prior output is empty');
 return {directory,files};
}
/** The injected runner is used only by fixture tests; the CLI uses spawnSync. */
export function runFinalChecks({argv=[],batchRoot=R,runner=spawnSync}={}){
 const options=parseFinalChecksArgs(argv),out=finalChecksDirectory(batchRoot,options.outputName);
 assert(!fs.existsSync(out),'Preserve previous check output; choose a new --output directory');
 const prior=options.priorOutputNames.map(name=>captureDirectory(finalChecksDirectory(batchRoot,name)));
 const guard=()=>{for(const old of prior)assert.deepEqual(captureDirectory(old.directory),old,'Earlier check evidence changed');};
 guard();fs.mkdirSync(out);
 write(path.join(out,'attempt.json'),{started_at:new Date().toISOString(),output:options.outputName,prior_outputs:prior,planned_checks:steps.map(([name])=>name),model_api_calls:0});
 const rows=[];let failed=null;
 for(const [name,args]of steps){
  guard();const file=path.join(out,name+'.log'),started=Date.now();let fd,result,error=null;
  try{
   fd=fs.openSync(file,'wx');
   result=runner(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore',fd,fd]});
   if(result.error)error={name:result.error.name,code:result.error.code,message:result.error.message};
  }catch(cause){error={name:cause.name,code:cause.code,message:cause.message};}
  finally{if(fd!==undefined)fs.closeSync(fd);}
  const row={name,args,exit_code:result?.status??null,signal:result?.signal??null,elapsed_ms:Date.now()-started,log:fs.existsSync(file)?ref(file):null,...(error?{execution_error:error}:{})};
  rows.push(row);write(path.join(out,name+'.json'),row);guard();
  if(error||row.exit_code!==0){failed=name;break;}
 }
 const summary={status:failed?'failed':'passed',completed_at:new Date().toISOString(),failed_check:failed,checks:rows,remaining_checks:steps.slice(rows.length).map(([name])=>name),prior_outputs:prior,semantic_review_replaced:false,model_api_calls:0};
 guard();write(path.join(out,'summary.json'),summary);
 return {output:out,summary};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=runFinalChecks({argv:process.argv.slice(2)});
 console.log(JSON.stringify({output:result.output,status:result.summary.status,failed_check:result.summary.failed_check,checks:result.summary.checks.map(row=>({name:row.name,exit_code:row.exit_code}))},null,2));
 if(result.summary.status!=='passed')process.exitCode=1;
}
