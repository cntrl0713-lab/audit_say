/** Exactly three production-grader executions per case; never runs without a new lock. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gradeQuestionSetV3,gradingModelName,buildGradingPrompt,buildGradingResponseSchema} from '../../../../../../lib/questionV3Grading.ts';
import type {GradingTraceV3,QuestionSetJudgmentV3} from '../../../../../../lib/questionV3Grading.ts';
import type {QuestionSetV3} from '../../../../../../lib/questionV3.ts';

const base=path.dirname(fileURLToPath(import.meta.url)),read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const textHash=(s:string)=>createHash('sha256').update(s).digest('hex');
const prep=read(path.join(base,'preparation.json')),qa=read(prep.regression_qa.file),raw=read(prep.candidate.file),set:QuestionSetV3=Array.isArray(raw)?raw[0]:raw;
const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(key==='--validate-only')args[key]='true';else if(['--lock','--output'].includes(key)&&process.argv[i+1])args[key]=process.argv[++i];else throw Error('Use --validate-only or --lock <new-runtime-lock.json> --output <new-directory>');}
const preparationInputs=[prep.candidate,prep.original_qa,prep.regression_qa,...prep.source_files];
if(preparationInputs.some(x=>sha(x.file)!==x.sha256))throw Error('Prepared input hash changed');
if(qa.cases.length!==2||set.id!==qa.set_id||qa.cases[0].id!==prep.original_qa.case_id)throw Error('Regression scope changed');
const original=read(prep.original_qa.file).cases.find((x:any)=>x.id===prep.original_qa.case_id);
if(JSON.stringify(original)!==JSON.stringify(qa.cases[0]))throw Error('Original QA case differs');
for(const test of qa.cases){const sub=set.subquestions.find(q=>q.id===test.subquestion_id)!;if(!sub||test.expected_points!==1||test.expected_verdicts.length!==sub.criteria.length)throw Error('Case shape/point mismatch');const sum=test.expected_verdicts.reduce((n:number,v:any)=>n+(v.verdict==='met'?sub.criteria.find(c=>c.id===v.criterion_id)!.max_points:0),0);if(sum!==1)throw Error('Independent verdict sum differs');}
if(args['--validate-only']){console.log(JSON.stringify({static_errors:[],cases:2,planned_executions:6,original_case_identical:true,model_calls:0}));process.exit(0);}
if(!args['--lock']||!args['--output'])throw Error('Explicit future runtime lock and new output directory required; API not called');
const lockFile=path.resolve(args['--lock']),lockHash=sha(lockFile),lock=read(lockFile);
if(prep.disallowed_prior_runtime_lock_hashes.some((x:any)=>x.sha256===lockHash))throw Error('v1/v2 lock is not permitted for this future regression');
const manifest=read(lock.manifest_file),entry=manifest.entries.find((x:any)=>x.plan_id==='T09-B');
if(!entry||entry.sha256!==prep.candidate.sha256||entry.qa_sha256!==prep.original_qa.sha256)throw Error('Selected future manifest changed the compared input');
const recordsToGuard=[{file:lockFile,sha256:lockHash},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,...preparationInputs];
const changed=()=>recordsToGuard.filter((x:any)=>sha(x.file)!==x.sha256).map((x:any)=>x.file);
if(changed().length)throw Error('Frozen runtime/input hash mismatch');
if(gradingModelName()!==lock.settings.grading_model)throw Error('Model differs from lock');
if(!process.env.OPENAI_API_KEY)throw Error('Credential missing; load .env.local without logging its contents');
const output=path.resolve(args['--output']);
if(!output.toLowerCase().startsWith((base+path.sep).toLowerCase())||fs.existsSync(output))throw Error('Output must be a new directory within this regression folder');
fs.mkdirSync(output,{recursive:true});
const write=(f:string,v:unknown)=>fs.writeFileSync(path.join(output,f),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write('inputs.json',{created_at:new Date().toISOString(),runtime_lock_file:lockFile,runtime_lock_sha256:lockHash,runner_sha256:sha(fileURLToPath(import.meta.url)),qa,question_set:set,guarded_files:recordsToGuard,model:gradingModelName(),repetitions_each:3,transport:'production_gradeQuestionSetV3',mock:false});
void(async()=>{
 const records:any[]=[];let stopped=false;
 for(let index=0;index<qa.cases.length&&!stopped;index++)for(let attempt=1;attempt<=3;attempt++){
  const test=qa.cases[index],answers=Object.fromEntries(set.subquestions.map(q=>[q.id,q.id===test.subquestion_id?test.answer:'']));
  let rawJudgment:QuestionSetJudgmentV3|null=null;const trace:GradingTraceV3[]=[];
  const record:any={case_id:test.id,attempt,started_at:new Date().toISOString(),expected:test,answers,model:gradingModelName(),transport:'not_invoked',request_hash:textHash(buildGradingPrompt(set,answers)),schema_hash:textHash(JSON.stringify(buildGradingResponseSchema(set,answers)))};
  try{
   if(changed().length||gradingModelName()!==lock.settings.grading_model)throw Error('Runtime changed before invocation');
   record.transport='live_model_attempt';
   const result=await gradeQuestionSetV3(set,answers,process.env.OPENAI_API_KEY||'',value=>{rawJudgment=structuredClone(value);},undefined,event=>trace.push(structuredClone(event)));
   const actual=result.subquestions.find(q=>q.subquestion_id===test.subquestion_id)!;
   const exact=test.expected_verdicts.filter((v:any)=>actual.criteria.find(c=>c.criterion_id===v.criterion_id)?.verdict!==v.verdict);
   const zero=new Set(['not_met','contradicted']);
   const differences=exact.filter((v:any)=>!(zero.has(v.verdict)&&zero.has(actual.criteria.find(c=>c.criterion_id===v.criterion_id)?.verdict||'')));
   Object.assign(record,{transport:'live_model',raw_judgment:rawJudgment,trace,result,exact_verdict_differences:exact,verdict_differences:differences,matched:result.score===1&&result.security_flag==='none'&&differences.length===0,boundary_policy:'공통 condition_boundary 정책의 not_met/contradicted 0점 동등만 적용. 실제 원시 판정 및 exact 차이는 별도 보존.',changed_inputs:changed()});
   if(record.changed_inputs.length)stopped=true;
  }catch(error){const e=error as Error&{code?:string;status?:number};Object.assign(record,{raw_judgment:rawJudgment,trace,error:{name:e.name,message:e.message,code:e.code,status:e.status},matched:false});stopped=true;}
  record.finished_at=new Date().toISOString();const file=`case-${index+1}-attempt-${attempt}.json`;write(file,record);records.push({file,case_id:test.id,attempt,transport:record.transport,matched:record.matched,error:record.error??null,changed_inputs:record.changed_inputs??[]});
  console.log(JSON.stringify(records.at(-1)));if(stopped)break;
 }
 write('summary.json',{finished_at:new Date().toISOString(),model:gradingModelName(),planned_cases:2,planned_executions:6,recorded_attempts:records.length,actual_grader_invocations:records.filter(r=>r.transport!=='not_invoked').length,stopped_on_execution_or_runtime_error:stopped,records});
 if(stopped||records.some(r=>!r.matched))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
