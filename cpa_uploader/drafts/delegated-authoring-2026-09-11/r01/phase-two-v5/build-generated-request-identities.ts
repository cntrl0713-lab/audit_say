import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildGradingPrompt,buildGradingResponseSchema,gradingModelName} from '../../../../../lib/questionV3Grading.ts';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/phase-two-v5';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const sha=(f:string)=>hash(fs.readFileSync(f));
const lockFile=control+'/runtime-v5-stable/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file);
for(const item of lock.code_files)if(sha(item.file)!==item.sha256)throw Error('Locked code changed');
const results=[];
for(const id of ['T04-A','T09-A','T09-B','T10-A']){
 const entry=manifest.entries.find((e:any)=>e.plan_id===id),directory=path.join(base,id.toLowerCase(),'generated5-01');
 const inputs=read(path.join(directory,'inputs.json')),summary=read(path.join(directory,'summary.json')),set=read(entry.file);
 if(sha(entry.file)!==entry.sha256||inputs.model!==gradingModelName())throw Error('Question/model changed');
 for(const [file,digest]of Object.entries(inputs.hashes))if(sha(file)!==digest)throw Error('Execution input changed '+file);
 const files=['initial.grading.jsonl','repeat.grading.jsonl'].map(f=>path.join(directory,f)).filter(f=>fs.existsSync(f));
 const events=files.flatMap(file=>fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean).map((line,index)=>({file,line:index+1,value:JSON.parse(line)}))).filter(item=>item.value.status==='completed');
 const records=events.map(item=>{const e=item.value,empty=Object.values(e.answers).every((value:any)=>!value.trim());if(e.transport!=='model'||e.model!==gradingModelName())throw Error('Unexpected actual grading transport/model');return{file:item.file,file_sha256:sha(item.file),line:item.line,id:e.id,repeat_of:e.repeat_of??null,attempt:e.attempt??1,model:e.model,grader_hash:e.grader_hash,answer_hash:hash(JSON.stringify(e.answers)),request_hash:empty?null:hash(buildGradingPrompt(set,e.answers)),schema_hash:empty?null:hash(JSON.stringify(buildGradingResponseSchema(set,e.answers))),no_model_empty_answer:empty,matched:e.matched};});
 if(records.length!==summary.recorded_executions)throw Error('Execution count mismatch');
 results.push({plan_id:id,set_id:entry.set_id,question_file:entry.file,question_sha256:entry.sha256,inputs_file:path.join(directory,'inputs.json'),inputs_sha256:sha(path.join(directory,'inputs.json')),summary_file:path.join(directory,'summary.json'),summary_sha256:sha(path.join(directory,'summary.json')),records});
}
const output={recorded_at:new Date().toISOString(),api_calls:0,runtime_lock:{file:lockFile,sha256:sha(lockFile)},identity_basis:'요청/스키마 해시는 실행 후, 실행 당시 고정되어 현재도 동일한 buildGradingPrompt/buildGradingResponseSchema와 원 문항·기록된 답안으로 결정적으로 재구성했다. SDK 전송 시 저장된 해시라고 표시하지 않는다. 원 이벤트의 모델·grader_hash·원시 judgment·trace 및 실행 전후 입력 보호 기록을 연결한다. 재사용 시 새 입력으로 다시 재구성해 동일성을 대조해야 한다.',sets:results,observations:results.reduce((sum,s)=>sum+s.records.length,0),nonempty_model_observations:results.reduce((sum,s)=>sum+s.records.filter(r=>!r.no_model_empty_answer).length,0)};
fs.writeFileSync(base+'/generated-request-identities.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sets:results.length,observations:output.observations,nonempty:output.nonempty_model_observations,api_calls:0,hashes:'post_execution_reconstructed_from_frozen_inputs'}));
