import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';

const [manifestFile,lockFile,label,resumeMapFile,...excluded]=process.argv.slice(2);
if(!manifestFile||!lockFile||!label||!/^[a-z0-9-]+$/.test(label))throw Error('manifest runtime-lock 새실행이름 [별도실행한계획ID...] 필요');
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const runner=path.join(root,'continue-semantic-partial.ts');
const directory=path.join(root,label);
if(fs.existsSync(directory))throw Error('기존 코호트 실행을 덮어쓰지 않습니다.');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=read(manifestFile),lock=read(lockFile),resumeMap=read(resumeMapFile);
const quotaCodes=new Set(['credit_balance_exhausted','insufficient_quota','quota_exceeded']);
const terminalQuota=value=>!!value&&typeof value==='object'&&(quotaCodes.has(value.code)||Object.values(value).some(item=>item&&typeof item==='object'&&terminalQuota(item)));

const phase=lock.phase_directory || 'phase-two-v3';
if(!/^phase-two-v[0-9]+$/.test(phase))throw Error('안전한 단계 폴더 이름 필요');
if(manifest.collected_sets!==49||manifest.collected_questions!==131||manifest.errors.length)throw Error('49/131 고정manifest 필요');
if(excluded.some(id=>!manifest.entries.some(entry=>entry.plan_id===id)))throw Error('알수없는 제외계획');
const fixed=[{file:manifestFile,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,
 ...[lockFile,runner,process.argv[1],resumeMapFile].map(file=>({file,sha256:hash(file)}))];
const guard=()=>{for(const row of fixed)if(hash(row.file)!==row.sha256)throw Error(`고정 코드·입력 변경: ${row.file}`);};
guard();fs.mkdirSync(directory);
const write=(name,value)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const append=value=>fs.appendFileSync(path.join(directory,'progress.jsonl'),JSON.stringify(value)+'\n');
write('inputs.json',{started_at:new Date().toISOString(),manifestFile,lockFile,label,excluded,
 policy:'대용량 의미검수는 세트당한프로세스/전체한프로세스로직렬호출한다. 실제retryable전송실패1회는30초후원시단위검증재개,반복전송실패는중지한다. 의미fail/uncertain은보존하고다음독립세트를검수한다. 코드변경시즉시중지한다.',fixed});
const execute=(args,output)=>new Promise((resolve,reject)=>{
 const stdout=fs.openSync(path.join(output,'stdout.log'),'wx'),stderr=fs.openSync(path.join(output,'stderr.log'),'wx');
 const child=spawn(process.execPath,['--env-file=.env.local','--import','tsx',runner,...args],{cwd:process.cwd(),windowsHide:true,stdio:['ignore',stdout,stderr]});
 child.once('error',error=>{fs.closeSync(stdout);fs.closeSync(stderr);reject(error);});
 child.once('exit',(code,signal)=>{fs.closeSync(stdout);fs.closeSync(stderr);resolve({code,signal});});
});
const records=[];
try{
 for(const entry of manifest.entries.filter(entry=>!excluded.includes(entry.plan_id))){
  guard();if(fs.existsSync(path.join(directory,'PAUSE'))){write('paused.json',{at:new Date().toISOString(),next_plan_id:entry.plan_id,completed_records:records.length});break;}
  const previousLogs=[...(resumeMap[entry.plan_id]||[])];
  for(const file of previousLogs)if(!fs.existsSync(file))throw Error(`Missing prior actual log: ${file}`);
  for(let attempt=1;attempt<=2;attempt++){
   guard();
   const parent=path.join(entry.output_directory,phase,entry.set_id,`${label}-${attempt}`);
   if(fs.existsSync(parent))throw Error('다른 실행 폴더와 충돌');
   fs.mkdirSync(parent,{recursive:true});
   const output=path.join(parent,'review');
   const args=['--manifest',manifestFile,'--plan-id',entry.plan_id,'--runtime-lock',lockFile,'--output',output,...previousLogs.flatMap(log=>['--resume-log',log]),'--execute'];
   append({at:new Date().toISOString(),event:'start',plan_id:entry.plan_id,attempt,output});
   console.log(JSON.stringify({plan_id:entry.plan_id,event:'start',attempt,output}));
   const result=await execute(args,parent);guard();
   const summaryFile=path.join(output,'summary.json'),summary=fs.existsSync(summaryFile)?read(summaryFile):null;
   const record={at:new Date().toISOString(),plan_id:entry.plan_id,set_id:entry.set_id,attempt,output,summary_file:summaryFile,...result,summary};
   records.push(record);append(record);console.log(JSON.stringify({plan_id:entry.plan_id,event:'finished',attempt,code:result.code,status:summary?.status,verdict:summary?.receipt_verdict,error:summary?.error}));
   if(!summary)throw Error(`실행 요약 없이 중지: ${entry.plan_id}. stderr와고정입력을대조해야함`);
   if(['receipt_created','partial_units_completed'].includes(summary.status))break;
   if(terminalQuota(summary.error))throw Error(`API credit/quota exhausted: ${entry.plan_id}; all new calls stopped`);
   if(fs.existsSync(path.join(directory,'PAUSE')))throw Error('Requested pause: no additional calls');
   if(summary.error?.code==='transport'&&summary.error.retryable===true){
    if(attempt===2)throw Error(`반복 전송 실패: ${entry.plan_id}`);
    previousLogs.push(path.join(output,'semantic.json.chunks.jsonl'));
    await new Promise(resolve=>setTimeout(resolve,30000));
    continue;
   }
   if(summary.error?.code==='transport')throw Error(`비재시도 전송 실패: ${entry.plan_id}`);
   break;
  }
 }
 write('summary.json',{finished_at:new Date().toISOString(),status:fs.existsSync(path.join(directory,'paused.json'))?'paused':'queue_finished',excluded,records,
  receipt_sets:new Set(records.filter(record=>record.summary?.status==='receipt_created').map(record=>record.set_id)).size,
  policy:'의미검수 fail/uncertain 및 실행 미완료는 별도 해결 대상이며 queue종료가전수검증완료는아니다. 실제생성사례채점은각receipt후에별도수행한다.'});
}catch(error){write('stopped.json',{at:new Date().toISOString(),error:String(error),records});console.error(String(error));process.exitCode=1;}
