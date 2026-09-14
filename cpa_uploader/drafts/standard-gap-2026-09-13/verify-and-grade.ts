import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import OpenAI from 'openai';
import {validateQuestionSetV3,compilePublicQuestionSet,computeSubquestionMaxPoints} from '../../../lib/questionV3.ts';
import type {QuestionSetV3} from '../../../lib/questionV3.ts';
import {learningUnitId,selectLearningQuestionSet} from '../../../lib/learningUnits.ts';
import type {LearningClassification} from '../../../lib/learningUnits.ts';
import {gradeQuestionSetV3,applyQuestionSetJudgment,gradingModelName,buildGradingPrompt,buildGradingResponseSchema} from '../../../lib/questionV3Grading.ts';
import {OpenAIRequestError,withOpenAIUsageObserver} from '../../../lib/ai/openaiStructured.ts';
import {validateQuestionAuthoringPlan} from '../../questionAuthoringPlan.ts';
import {draftConflicts} from '../../questionDraftInventory.ts';
import {validateAuthoringBank} from '../../questionBankPublication.ts';

const batch='cpa_uploader/drafts/standard-gap-2026-09-13';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const write=(f:string,v:unknown)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');};
const sha=(f:string)=>hash(fs.readFileSync(f));
const index=read(`${batch}/index.json`);
const manifest=read(`${batch}/qa-representatives.json`);
const sets:QuestionSetV3[]=index.sets.map((s:{file:string})=>read(s.file));
const bank:QuestionSetV3[]=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const semantics=read(`${batch}/agent-review.json`);
function projection(set:QuestionSetV3,subId:string) {
 const sub=set.subquestions.find(q=>q.id===subId)!;
 const identity=hash(JSON.stringify(sub));
 const meta:LearningClassification={learning_question_id:`local-draft-${set.id}-${sub.id}`,classification_version_id:`local-draft-${identity}`,source_set_id:set.id,source_set_version_id:`local-draft-${hash(JSON.stringify(set))}`,source_subquestion_version_id:`local-draft-${identity}`,subquestion_id:sub.id,question_style:'standard',case_set_id:null,topic_ids:sub.topic_ids!,standalone_prompt:sub.prompt,content_hash:identity};
 return selectLearningQuestionSet(set,[meta],learningUnitId(set.id,'standard',sub.id));
}

async function main() {
 const errors:string[]=[]; const seen=new Set<string>(); const local:any[]=[];
 for(const set of sets) {
  errors.push(...validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()}).errors.map(e=>`${set.id}: ${e}`));
  const file=index.sets.find((s:any)=>s.set_id===set.id).file;
  errors.push(...validateQuestionAuthoringPlan(read(`${file}.authoring-plan.json`).plans[0]));
  for(const q of set.subquestions) {
   const rows=manifest.cases.filter((c:any)=>c.set_id===set.id&&c.subquestion_id===q.id);
   assert.deepEqual(rows.map((c:any)=>c.role).sort(),['model','partial','wrong']);
   const projected=projection(set,q.id);
   assert.equal(projected.subquestions.length,1); assert.equal(projected.shared_context.facts.length,0);
   assert.deepEqual(projected.subquestions[0].topic_ids,q.topic_ids);
   const publicSet=compilePublicQuestionSet(projected);
   assert.equal(publicSet.max_points,computeSubquestionMaxPoints(q));
   assert.equal('model_answer' in publicSet.subquestions[0],false);
   assert.equal('criteria' in publicSet.subquestions[0],false);
   assert.equal('requirements' in publicSet.subquestions[0],false);
   const empty=await gradeQuestionSetV3(projected,{[q.id]:''},'',undefined,async()=>{throw Error('빈 답안에서 API 호출 발생');});
   assert.equal(empty.score,0); assert.equal(empty.security_flag,'none');
   local.push({set_id:set.id,subquestion_id:q.id,empty_score:empty.score,max_points:empty.max_points,transport:'local_no_api',standalone_projection:true,private_fields_removed:true});
   const semantic=semantics.questions.find((s:any)=>s.question===`${set.id}/${q.id}`);
   assert(semantic&&semantic.source_review.length===q.criteria.length&&semantic.unresolved_items.length===0);
   for(const c of rows) {
    assert(c.answer.trim()); assert.equal(c.expected_criteria.length,q.criteria.length);
    assert.deepEqual(c.expected_criteria.map((r:any)=>r.criterion_id),q.criteria.map(r=>r.id));
    const points=c.expected_criteria.filter((r:any)=>r.verdict==='met').length;
    assert.equal(points,c.expected_score);
    if(c.role==='model'){assert.equal(c.answer,q.model_answer.join('\n'));assert.equal(points,q.criteria.length);}
    if(c.role==='partial')assert(points>0&&points<q.criteria.length);
    if(c.role==='wrong')assert.equal(points,0);
    const answers={[q.id]:c.answer};
    const expected={subquestions:[{subquestion_id:q.id,verdicts:c.expected_criteria.map((r:any)=>({...r,quote:r.verdict==='not_met'?'':c.answer}))}]};
    const replay=applyQuestionSetJudgment(projected,answers,expected);
    assert.equal(replay.score,points);
    const signature=hash(gradingModelName()+buildGradingPrompt(projected,answers)+JSON.stringify(buildGradingResponseSchema(projected,answers)));
    assert(!seen.has(signature),`중복 요청 ${c.id}`);seen.add(signature);
   }
  }
 }
 errors.push(...draftConflicts(sets,bank));
 errors.push(...validateAuthoringBank([...bank,...sets]).errors);
 assert.deepEqual(errors,[]);
 assert.equal(manifest.cases.length,42); assert.equal(local.length,14);
 const preflight={version:1,artifact_type:'draft_batch_preflight',errors,sets:sets.length,questions:local.length,criteria:sets.flatMap(s=>s.subquestions).reduce((n,q)=>n+q.criteria.length,0),representatives:manifest.cases.length,unique_request_signatures:seen.size,local_checks:local,expectation_replay:'점수 합산 검사이며 모델 의미 판정이 아님',canonical_plus_drafts:'메모리 검증만 수행; 정본 쓰기 없음'};
 write(`${batch}/preflight.json`,preflight);
 console.log(JSON.stringify({stage:'preflight',sets:sets.length,questions:local.length,cases:manifest.cases.length,errors:0}));
 if(!process.argv.includes('--run'))return;
 const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
 const jobs=only?manifest.cases.filter((c:any)=>only.split(',').some(prefix=>c.id.startsWith(`${prefix}-`))):manifest.cases;
 assert(jobs.length>0,'실행 대상 없음');
 assert.equal(gradingModelName(),'gpt-5.6-luna','Luna 외 모델 실행 금지');
 const runName=process.argv.find(a=>a.startsWith('--run-id='))?.slice(9)||'run-v1';
 assert(/^[a-z0-9-]+$/.test(runName));
 const dir=`${batch}/grading/${runName}`;
 assert(!fs.existsSync(dir),'기존 실행 덮어쓰기 금지');fs.mkdirSync(dir,{recursive:true});
 const runtimeFiles=['lib/questionV3Grading.ts','lib/questionV3.ts','lib/questionV3Answer.ts','lib/questionV3Evidence.ts','lib/learningUnits.ts','lib/ai/openaiStructured.ts','package-lock.json'];
 const inputFiles=[...index.sets.flatMap((s:any)=>[s.file,`${s.file}.authoring-plan.json`]),`${batch}/sources/kga-2026-excerpts.txt`,`${batch}/qa-representatives.json`,`${batch}/agent-review.json`,`${batch}/content.mjs`,`${batch}/build.mjs`,`${batch}/verify-and-grade.ts`];
 const guards=[...runtimeFiles,...inputFiles].map(file=>({file,sha256:sha(file)}));
 for(const row of guards){const dst=`${dir}/frozen/${row.file}`;fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(row.file,dst);}
 const guard=()=>{for(const g of guards)assert.equal(sha(g.file),g.sha256,`실행 입력 변경: ${g.file}`);};
 const run={version:1,artifact_type:'draft_actual_grading_manifest',started_at:new Date().toISOString(),model:gradingModelName(),transport:'model',selected_cases:jobs.map((c:any)=>c.id),policy:manifest.policy,inputs:guards,sdk_retries:0,concurrency:2,production_publication:false,synthetic_data_only:true};
 write(`${dir}/manifest.json`,run);
 if(!process.env.OPENAI_API_KEY?.trim()) {write(`${dir}/blocked.json`,{reason:'OPENAI_API_KEY 미설정',completed_jobs:0,unexecuted:42,local_preflight_completed:true});console.log('실제 채점 중단: OPENAI_API_KEY 미설정');return;}
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
 const results:any[]=[];let next=0;let stopped=false;let stopReason:string|null=null;
 async function worker() {
  while(!stopped&&next<jobs.length) {
   const c=jobs[next++];const set=sets.find(s=>s.id===c.set_id)!;const projected=projection(set,c.subquestion_id);
   const answers={[c.subquestion_id]:c.answer}; const traces:any[]=[]; const usage:any[]=[]; const transport:any[]=[]; let requestNumber=0;
   const prefix=`${dir}/${c.id}`;
   write(`${prefix}.input.json`,{case:c,projected_set:projected,answers,source_hash:sha(index.sets.find((s:any)=>s.set_id===set.id).file)});
   try {
    guard();
    const result=await withOpenAIUsageObserver(e=>{usage.push(e);write(`${prefix}.usage.json`,usage);},()=>gradeQuestionSetV3(projected,answers,process.env.OPENAI_API_KEY,undefined,async(params,options)=>{
     if(stopped)throw new OpenAIRequestError('configuration',stopReason||'실행 중지');
     guard();requestNumber++;const sequence=requestNumber;
     write(`${prefix}.request-${sequence}.json`,{params,options});
     let response;
     try {response=await client.responses.create(params,options);}
     catch(error:any) {
      const safe={status:error.status??null,code:error.code??null,type:error.name??'unknown',request_id:error.request_id??null,usage:'unknown'};
      write(`${prefix}.request-${sequence}.error.json`,safe);
      if(error.status===429||error.status===401||error.status===403) {
       stopped=true;stopReason=`제공자 오류: HTTP ${error.status}, ${error.code||'unknown'}`;
       throw new OpenAIRequestError('configuration',stopReason,{status:error.status});
      }
      throw error;
     }
     const metadata={request_id:response._request_id??null,response_id:response.id,model:response.model,usage:response.usage??null};
     try{write(`${prefix}.response-${sequence}.json`,{metadata,response});transport.push(metadata);}
     catch{stopped=true;stopReason='응답 증거 저장 실패';throw new OpenAIRequestError('configuration',stopReason);}
     return response;
    },trace=>{traces.push(trace);write(`${prefix}.trace.json`,traces);}));
    guard();
    const sub=result.subquestions.find(q=>q.subquestion_id===c.subquestion_id)!;
    assert.equal(result.subquestions.length,1);assert.equal(result.max_points,projected.subquestions[0].criteria.length);
    const delta=sub.score-c.expected_score;
    const securityOkay=result.security_flag==='none';
    const record={case_id:c.id,set_id:c.set_id,subquestion_id:c.subquestion_id,role:c.role,expected_score:c.expected_score,actual_score:sub.score,delta,strict_pass:delta===0&&securityOkay,accepted:Math.abs(delta)<=1&&securityOkay,status:!securityOkay?'security_error':delta===0?'exact':Math.abs(delta)<=1?'accepted_with_grading_deviation':'outside_tolerance',result,usage,transport};
    write(`${prefix}.result.json`,record);results.push(record);
    console.log(JSON.stringify({completed:results.length,total:jobs.length,id:c.id,expected:c.expected_score,actual:sub.score,status:record.status}));
   } catch(error:any) {
    const record={case_id:c.id,role:c.role,expected_score:c.expected_score,status:'execution_error',accepted:false,strict_pass:false,error:String(error?.message||error).replace(/sk-[A-Za-z0-9_-]+/g,'[REDACTED]'),usage,transport};
    write(`${prefix}.result.json`,record);results.push(record);
    console.log(JSON.stringify({completed:results.length,total:jobs.length,id:c.id,status:'execution_error',error:record.error}));
   }
  }
 }
 await Promise.all([worker(),worker()]);
 const events=results.flatMap(r=>r.usage);const unknown=events.filter(e=>!e.usage).length;
 const sum=(f:(u:any)=>number)=>events.reduce((n,e)=>n+(e.usage?f(e.usage):0),0);
 const summary={version:1,artifact_type:'draft_actual_grading_summary',transport:'model',model:gradingModelName(),finished_at:new Date().toISOString(),selected:jobs.length,completed:results.length,unexecuted:jobs.map((c:any)=>c.id).filter((id:string)=>!results.some(r=>r.case_id===id)),exact:results.filter(r=>r.strict_pass).length,accepted:results.filter(r=>r.accepted).length,accepted_rate:results.filter(r=>r.accepted).length/jobs.length,outside_tolerance:results.filter(r=>r.status==='outside_tolerance').map(r=>r.case_id),errors:results.filter(r=>r.status==='execution_error'||r.status==='security_error').map(r=>r.case_id),stop_reason:stopReason,usage:{responses:events.length,missing_usage_responses:unknown,input_tokens:sum(u=>u.input_tokens),cached_input_tokens:sum(u=>u.input_tokens_details?.cached_tokens??0),output_tokens:sum(u=>u.output_tokens),reasoning_tokens_included_in_output:sum(u=>u.output_tokens_details?.reasoning_tokens??0),failed_request_usage:results.some(r=>r.status==='execution_error')?'unknown':'none',cost_usd:null,cost_note:'금액 미계산; 실제 토큰 사용량을 기록했으며 미확인 비용을 0으로 표시하지 않음'},unchanged_inputs:guards.every(g=>sha(g.file)===g.sha256),results:results.map(({result,usage,transport,...r})=>r)};
 write(`${dir}/summary.json`,summary);console.log(JSON.stringify(summary));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
