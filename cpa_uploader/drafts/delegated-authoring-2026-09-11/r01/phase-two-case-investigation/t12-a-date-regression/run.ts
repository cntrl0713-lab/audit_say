/** Three actual production-grader executions per preserved case after a new lock. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gradeQuestionSetV3,gradingModelName,buildGradingPrompt,buildGradingResponseSchema} from '../../../../../../lib/questionV3Grading.ts';
import type {GradingTraceV3,QuestionSetJudgmentV3} from '../../../../../../lib/questionV3Grading.ts';
import type {QuestionSetV3} from '../../../../../../lib/questionV3.ts';
const base=path.dirname(fileURLToPath(import.meta.url)),read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const textHash=(text:string)=>createHash('sha256').update(text).digest('hex');
const prep=read(path.join(base,'preparation.json')),qa=read(prep.regression_qa.file),raw=read(prep.candidate.file),set:QuestionSetV3=Array.isArray(raw)?raw[0]:raw;
const args:Record<string,string>={};
for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(key==='--validate-only')args[key]='true';else if(['--lock','--output'].includes(key)&&process.argv[i+1])args[key]=process.argv[++i];else throw Error('Use --validate-only or --lock <new-lock> --output <new-directory>');}
const preparationInputs=[prep.candidate,prep.original_qa,prep.regression_qa,...prep.plan_files,...prep.source_files];
if(preparationInputs.some(item=>sha(item.file)!==item.sha256))throw Error('Prepared input changed');
if(set.id!==qa.set_id||qa.cases.length!==prep.planned_cases)throw Error('Regression scope changed');
const original=read(prep.original_qa.file);
for(const [index,test]of qa.cases.entries()){
 if(test.id!==prep.original_qa.case_ids[index]||JSON.stringify(test)!==JSON.stringify(original.cases.find((sample:any)=>sample.id===test.id)))throw Error('Original QA case changed');
 const sub=set.subquestions.find(sub=>sub.id===test.subquestion_id);
 if(!sub||test.expected_verdicts.length!==sub.criteria.length||new Set(test.expected_verdicts.map((item:any)=>item.criterion_id)).size!==sub.criteria.length)throw Error('Incomplete criterion expectations');
 const sum=test.expected_verdicts.reduce((sum:number,item:any)=>{const criterion=sub.criteria.find(criterion=>criterion.id===item.criterion_id);if(!criterion||!['met','not_met','contradicted'].includes(item.verdict))throw Error('Unknown criterion/verdict');return sum+(item.verdict==='met'?criterion.max_points:0);},0);
 if(sum!==test.expected_points)throw Error('Expected integer points differ from independent verdicts');
}
if(args['--validate-only']){console.log(JSON.stringify({static_errors:[],cases:qa.cases.length,planned_executions:qa.cases.length*3,original_cases_identical:true,model_calls:0}));process.exit(0);}
if(!args['--lock']||!args['--output'])throw Error('Explicit future runtime lock and new output required; API not called');
const lockFile=path.resolve(args['--lock']),lockHash=sha(lockFile),lock=read(lockFile);
if(prep.disallowed_prior_runtime_lock_hashes.some((item:any)=>item.sha256===lockHash))throw Error('Prior v1/v2/v3 runtime lock is not permitted');
const entry=read(lock.manifest_file).entries.find((entry:any)=>entry.plan_id===prep.plan_id);
if(!entry||entry.sha256!==prep.candidate.sha256||entry.qa_sha256!==prep.original_qa.sha256)throw Error('Compared original inputs changed');
const guardFiles=[{file:lockFile,sha256:lockHash},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,...preparationInputs];
const changed=()=>guardFiles.filter((item:any)=>sha(item.file)!==item.sha256).map((item:any)=>item.file);
if(changed().length||gradingModelName()!==lock.settings.grading_model)throw Error('Frozen runtime/model mismatch');
if(!process.env.OPENAI_API_KEY)throw Error('Load .env.local without logging credentials');
const output=path.resolve(args['--output']);
if(!output.toLowerCase().startsWith((base+path.sep).toLowerCase())||fs.existsSync(output))throw Error('Output must be a new directory inside this regression folder');
fs.mkdirSync(output,{recursive:true});
const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('inputs.json',{created_at:new Date().toISOString(),runtime_lock_file:lockFile,runtime_lock_sha256:lockHash,runner_sha256:sha(fileURLToPath(import.meta.url)),qa,question_set:set,guarded_files:guardFiles,model:gradingModelName(),repetitions_each:3,transport:'production_gradeQuestionSetV3',mock:false});
void(async()=>{
 const records:any[]=[];let stopped=false;
 for(let index=0;index<qa.cases.length&&!stopped;index++)for(let attempt=1;attempt<=3;attempt++){
  const test=qa.cases[index],answers=Object.fromEntries(set.subquestions.map(sub=>[sub.id,sub.id===test.subquestion_id?test.answer:'']));
  let rawJudgment:QuestionSetJudgmentV3|null=null;const trace:GradingTraceV3[]=[];
  const record:any={case_id:test.id,attempt,started_at:new Date().toISOString(),expected:test,answers,model:gradingModelName(),transport:'not_invoked',request_hash:textHash(buildGradingPrompt(set,answers)),schema_hash:textHash(JSON.stringify(buildGradingResponseSchema(set,answers)))};
  try{
   if(changed().length||gradingModelName()!==lock.settings.grading_model)throw Error('Runtime changed before invocation');
   record.transport='live_model_attempt';
   const result=await gradeQuestionSetV3(set,answers,process.env.OPENAI_API_KEY||'',value=>{rawJudgment=structuredClone(value);},undefined,event=>trace.push(structuredClone(event)));
   const target=result.subquestions.find(sub=>sub.subquestion_id===test.subquestion_id)!;
   const exact=test.expected_verdicts.filter((item:any)=>target.criteria.find(criterion=>criterion.criterion_id===item.criterion_id)?.verdict!==item.verdict);
   Object.assign(record,{transport:'live_model',raw_judgment:rawJudgment,trace,result,exact_verdict_differences:exact,verdict_differences:exact,matched:result.score===test.expected_points&&result.security_flag==='none'&&exact.length===0,boundary_policy:'이 5사례는 condition_boundary가 아니므로 명시반대/누락을 0점 동등으로 치환하지 않는다.',changed_inputs:changed()});
   if(record.changed_inputs.length)stopped=true;
  }catch(error){const value=error as Error&{code?:string;status?:number};Object.assign(record,{raw_judgment:rawJudgment,trace,error:{name:value.name,message:value.message,code:value.code,status:value.status},matched:false});stopped=true;}
  record.finished_at=new Date().toISOString();const file=`case-${index+1}-attempt-${attempt}.json`;write(file,record);records.push({file,case_id:test.id,attempt,transport:record.transport,matched:record.matched,error:record.error??null,changed_inputs:record.changed_inputs??[]});
  console.log(JSON.stringify(records.at(-1)));if(stopped)break;
 }
 write('summary.json',{finished_at:new Date().toISOString(),model:gradingModelName(),planned_cases:qa.cases.length,planned_executions:qa.cases.length*3,recorded_attempts:records.length,actual_grader_invocations:records.filter(record=>record.transport!=='not_invoked').length,stopped_on_execution_or_runtime_error:stopped,records});
 if(stopped||records.some(record=>!record.matched))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
