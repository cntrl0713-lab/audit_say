import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const batch='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const label=process.argv[2];
if(!label||!/^[a-z0-9-]+$/.test(label))throw Error('새 기록 이름 필요');
const output=path.join(root,`live-evidence-${label}.json`);
if(fs.existsSync(output))throw Error('기존 집계는 보존합니다.');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=read(path.join(root,'final-153-v1/manifest.json'));
const selected=new Set(manifest.entries.map(entry=>entry.set_id));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const files=walk(batch),groups=new Map(),errors=[];
for(const file of files.filter(file=>/case-\d+-attempt-\d+\.json$/.test(file))){
 try{
  const record=read(file);
  if(!selected.has(record.set_id)||!record.case_id||!record.started_at||!record.expected)continue;
  const inputFile=path.join(path.dirname(file),'inputs.json');
  if(!fs.existsSync(inputFile))continue;
  const input=read(inputFile),graderHash=input.hashes?.['lib/questionV3Grading.ts'];
  if(!graderHash)continue;
  const group=groups.get(graderHash)||{grader_sha256:graderHash,sets:new Set(),case_inputs:new Set(),executions:0,live_grader_executions:0,empty_production_executions:0,request_attempt_records:0,mismatched_executions:0,execution_errors:0,first_started_at:record.started_at,last_finished_at:record.finished_at,records:[]};
  group.sets.add(record.set_id);group.case_inputs.add(JSON.stringify([record.set_id,record.case_id,record.answers,input.hashes]));group.executions++;
  if(record.transport==='live_model')group.live_grader_executions++;
  if(record.transport==='production_empty_answer_no_model')group.empty_production_executions++;
  group.request_attempt_records+=(record.trace||[]).filter(event=>event.response!==undefined).length;
  if(!record.matched)group.mismatched_executions++;
  if(record.error)group.execution_errors++;
  if(record.started_at<group.first_started_at)group.first_started_at=record.started_at;
  if(record.finished_at>group.last_finished_at)group.last_finished_at=record.finished_at;
  group.records.push({file:file.replaceAll('\\','/'),sha256:hash(file),set_id:record.set_id,case_id:record.case_id,attempt:record.attempt,matched:record.matched,error:record.error||null});
  groups.set(graderHash,group);
 }catch(error){errors.push({file,error:String(error)});}
}
const current=hash('lib/questionV3Grading.ts');
const result={created_at:new Date().toISOString(),planned_sets:manifest.collected_sets,planned_questions:manifest.collected_questions,planned_points:manifest.collected_points,
 author_qa_cases:manifest.entries.reduce((n,entry)=>n+entry.qa_cases,0),current_grader_sha256:current,
 author_qa_by_grader_version:[...groups.values()].map(group=>({...group,sets:[...group.sets],unique_test_inputs:group.case_inputs.size,case_inputs:undefined,current_grader:group.grader_sha256===current})),
 errors,scope:'작성자 QA case-NNNN-attempt-N 원시파일만 집계한다. semantic 단위 진단·생성사례 채점·별도탐색회귀는 포함하지 않는다. 시작/종료 사이 다른 의존코드 변경 여부와 전체 완료는 실행별 guard/summary로 따로 판단해야 하며, 현재 grader 해시 일치만으로 현행 검증 통과를 주장하지 않는다.'};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,versions:result.author_qa_by_grader_version.map(({records,...group})=>({...group,recorded_files:records.length})),errors}));
