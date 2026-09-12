import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11',common='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11',own=base+'/r02/evidence/phase2';
const config=[
 ['n02','T06-A','pilot-06-006','semantic-v5-bank-v3-root-01-1','subquestion:sub2'],
 ['n02','T06-A','pilot-06-006','semantic-v5-bank-v3-root-01-1','criterion:sub2:crit6'],
 ['n02','T06-A','pilot-06-006','semantic-v5-bank-v3-after-refill-root-01-1','subquestion:sub3'],
 ['n02','T06-A','pilot-06-006','semantic-v5-bank-v3-after-refill-root-01-2','criterion:sub3:crit9'],
 ['n02','T06-B','pilot-06-007','semantic-v5-bank-v3-after-refill-root-01-1','criterion:sub1:crit3'],
 ['n03','T05-B','pilot-05-009','semantic-v5-bank-v3-after-refill-root-01-1','criterion:sub3:crit5']
];
const manifest=common+'/final-153-v3/manifest.json',lock=common+'/runtime-v5-bank-v3-after-refill-02/runtime-lock.json',helper=common+'/diagnose-unit-exact-attempt.ts';
const taskFile=own+'/semantic-diagnostic-tasks-refill02.json';if(fs.existsSync(taskFile))throw Error('Fresh task file required');
const tasks=[];
for(const [owner,plan,set,run,unit] of config){
 const chunks=base+'/'+owner+'/phase-two-v5/'+set+'/'+run+'/review/semantic.json.chunks.jsonl';
 const dir=base+'/'+owner+'/evidence/phase2/semantic-exact-diagnostics-v5-bank-v3-refill02/'+set+'/'+unit.replaceAll(':','-');
 const output=dir+'/preflight.json',args=['--import','tsx',helper,'--manifest',manifest,'--runtime-lock',lock,'--chunks',chunks,'--unit-id',unit,'--plan-id',plan,'--output',output];
 const result=spawnSync(process.execPath,args,{env:process.env,encoding:'utf8'});
 tasks.push({owner,plan_id:plan,set_id:set,unit_id:unit,chunks,manifest,runtime_lock:lock,helper,preflight_output:output,preflight_exit_code:result.status,preflight_stdout:result.stdout,preflight_stderr:result.stderr,actual_outputs:[dir+'/actual-repeat-02.json',dir+'/actual-repeat-03.json'],actual_API_calls:0});
 console.log(JSON.stringify({plan_id:plan,unit_id:unit,code:result.status,output:result.stdout.trim()||result.stderr.trim()}));
}
fs.writeFileSync(taskFile,JSON.stringify({created_at:new Date().toISOString(),mode:'local_preflight_only',actual_API_calls:0,tasks},null,2)+'\n',{flag:'wx'});
