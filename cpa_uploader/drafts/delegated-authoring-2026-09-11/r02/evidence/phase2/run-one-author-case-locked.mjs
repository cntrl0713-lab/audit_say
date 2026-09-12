import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gradeQuestionSetV3,gradingModelName,buildGradingPrompt,buildGradingResponseSchema} from '../../../../../../lib/questionV3Grading.ts';
const args={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i],v=process.argv[i+1];if(!['--file','--qa','--only','--output','--runtime-lock','--reference-record'].includes(k)||!v||args[k])throw Error('Invalid args');args[k]=v;}
for(const k of ['--file','--qa','--only','--output','--runtime-lock'])if(!args[k])throw Error(k+' required');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=v=>createHash('sha256').update(v).digest('hex');
const hash=f=>sha(fs.readFileSync(f));
const lock=read(args['--runtime-lock']),input=read(args['--file']),set=Array.isArray(input)?input[0]:input,qa=read(args['--qa']),test=qa.cases.find(c=>c.id===args['--only']);
if(Array.isArray(input)&&input.length!==1)throw Error('Exactly one set');
if(qa.version!==1||qa.artifact_type!=='author_expected_judgments'||qa.set_id!==set.id||!test)throw Error('Case contract');
const question=set.subquestions.find(q=>q.id===test.subquestion_id);
if(!question||question.criteria.length!==test.expected_verdicts.length||new Set(test.expected_verdicts.map(v=>v.criterion_id)).size!==question.criteria.length)throw Error('Expected criterion contract');
const expectedSum=test.expected_verdicts.reduce((n,v)=>{const c=question.criteria.find(c=>c.id===v.criterion_id);if(!c||!['met','partial','not_met','contradicted'].includes(v.verdict)||(v.verdict==='partial'&&c.scores.partial===undefined))throw Error('Expected verdict');return n+(v.verdict==='met'?c.scores.met:v.verdict==='partial'?c.scores.partial:0);},0);
if(expectedSum!==test.expected_points)throw Error('Expected score');
const output=path.resolve(args['--output']),allowed=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11')+path.sep;
if(!output.toLowerCase().startsWith(allowed.toLowerCase())||fs.existsSync(output))throw Error('Fresh owned output required');
const model=gradingModelName(),answers=Object.fromEntries(set.subquestions.map(q=>[q.id,q.id===test.subquestion_id?test.answer:'']));
const request_hash=sha(buildGradingPrompt(set,answers)),schema_hash=sha(JSON.stringify(buildGradingResponseSchema(set,answers)));
const extra=[args['--runtime-lock'],args['--file'],args['--qa'],process.argv[1],...set.source_refs.map(s=>s.file),...(args['--reference-record']?[args['--reference-record']]:[])];
const identities=[{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,...extra.map(file=>({file,sha256:hash(file)}))];
const guard=()=>{if(model!==gradingModelName()||model!==lock.settings.grading_model)throw Error('Model changed');for(const i of identities)if(hash(i.file)!==i.sha256)throw Error('Locked input/code changed '+i.file);};
guard();let reference=null;
if(args['--reference-record']){const r=read(args['--reference-record']);if(r.case_id!==test.id||r.transport!=='live_model'||r.error||!r.raw_judgment||r.model!==model||r.request_hash!==request_hash||r.schema_hash!==schema_hash||JSON.stringify(r.answers)!==JSON.stringify(answers))throw Error('Prior valid actual request identity mismatch');reference={file:args['--reference-record'],sha256:hash(args['--reference-record']),same_request_schema_model_answer:true,reused_response:false};}
fs.mkdirSync(output,{recursive:true});const write=(name,v)=>fs.writeFileSync(path.join(output,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write('inputs.json',{created_at:new Date().toISOString(),model,question_set:set,qa,selected:test.id,identities,hashes:Object.fromEntries(identities.map(i=>[i.file,i.sha256])),reference,transport:'production_gradeQuestionSetV3',mock:false,one_grading_execution_only:true});
let raw=null;const trace=[],started_at=new Date().toISOString();let record;
try{
 const result=await gradeQuestionSetV3(set,answers,process.env.OPENAI_API_KEY||'',v=>{raw=v;},undefined,e=>trace.push(e));
 const actual=result.subquestions.find(q=>q.subquestion_id===test.subquestion_id),exact=test.expected_verdicts.filter(v=>actual.criteria.find(c=>c.criterion_id===v.criterion_id)?.verdict!==v.verdict),zero=new Set(['not_met','contradicted']),boundary=['condition_boundary','condition-boundary'].includes(test.kind),differences=exact.filter(v=>!(boundary&&zero.has(v.verdict)&&zero.has(actual.criteria.find(c=>c.criterion_id===v.criterion_id)?.verdict||'')));
 record={set_id:set.id,case_id:test.id,kind:test.kind,attempt:1,started_at,finished_at:new Date().toISOString(),model,transport:test.answer.trim()?'live_model':'production_empty_answer_no_model',answers,expected:test,request_hash,schema_hash,raw_judgment:raw,trace,result,exact_verdict_differences:exact,verdict_differences:differences,matched:differences.length===0&&result.score===test.expected_points&&result.security_flag==='none',boundary_policy:boundary?'Only condition-boundary not_met/contradicted zero equivalence':null,reference};
}catch(error){record={set_id:set.id,case_id:test.id,attempt:1,started_at,finished_at:new Date().toISOString(),model,transport:'live_model_attempt',answers,expected:test,request_hash,schema_hash,raw_judgment:raw,trace,matched:false,error:{name:error.name,message:error.message,code:error.code,status:error.status},reference};}
// File writes and guard failures are outside the model request catch: never retry a local observer/write failure.
guard();write('case-0001-attempt-1.json',record);
write('summary.json',{finished_at:new Date().toISOString(),set_id:set.id,model,planned_cases:1,recorded_cases:1,actual_attempts:1,valid_grading_executions:record.error?0:1,mismatched_case_ids:record.matched?[]:[test.id],stopped_on_execution_error:Boolean(record.error),changed_inputs:[],records:[{file:'case-0001-attempt-1.json',set_id:set.id,case_id:test.id,attempt:1,matched:record.matched,error:record.error||null}],single_execution:true});
console.log(JSON.stringify({set_id:set.id,case_id:test.id,matched:record.matched,execution_error:Boolean(record.error),score:record.result?.score}));
if(!record.matched)process.exitCode=1;
