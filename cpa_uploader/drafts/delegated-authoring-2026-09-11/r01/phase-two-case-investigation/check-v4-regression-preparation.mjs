import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11';
for(const relative of ['r01/phase-two-case-investigation/t12-a-date-regression','n04/phase-two-case-investigation/t11-a-range-regression']){
 const folder=path.join(base,relative),runner=path.join(folder,'run.ts');
 const validation=spawnSync(process.execPath,['--import','tsx',runner,'--validate-only'],{encoding:'utf8',windowsHide:true});
 const rejectedOutput=path.join(folder,'runs/rejected-v3-lock');
 if(fs.existsSync(rejectedOutput))throw Error('Negative-check output already exists');
 const rejection=spawnSync(process.execPath,['--import','tsx',runner,'--lock','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/runtime-v3-stable/runtime-lock.json','--output',rejectedOutput],{encoding:'utf8',windowsHide:true});
 const output={checked_at:new Date().toISOString(),runner:{file:runner,sha256:sha(runner)},preparation_sha256:sha(path.join(folder,'preparation.json')),validation:{exit_code:validation.status,stdout:validation.stdout,stderr:validation.stderr},prior_lock_rejection:{exit_code:rejection.status,stdout:rejection.stdout,stderr:rejection.stderr,output_created:fs.existsSync(rejectedOutput)},actual_model_calls:0};
 const valid=validation.status===0&&rejection.status!==0&&rejection.stderr.includes('Prior v1/v2/v3 runtime lock is not permitted')&&!fs.existsSync(rejectedOutput);
 fs.writeFileSync(path.join(folder,'static-check.json'),JSON.stringify({...output,valid},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({folder,valid,actual_model_calls:0}));if(!valid)process.exitCode=1;
}
