import fs from 'node:fs';
import path from 'node:path';
import {gradeSemanticReviewReceipt,prepareSemanticReview,completeSemanticReview,readSemanticReviewDocument,semanticReceiptIntegrityErrors,validateSemanticReviewReceipt} from '../../../questionSemanticReview.ts';
import {executeReviewGrading} from '../../../questionReviewGrading.ts';
import type {ReviewGradingEvent} from '../../../questionReviewGrading.ts';
import type {QuestionSetV3} from '../../../../lib/questionV3.ts';
import {jsonHash,sha256} from '../../../questionReviewIdentity.ts';
import {gradingModelName} from '../../../../lib/questionV3Grading.ts';

type Identity={file:string;sha256:string};
type Entry={plan_id:string;set_id:string;file:string;sha256:string;plan_files:Identity[];source_files:Identity[]};
type Lock={manifest_sha256:string;comparison_bank:Identity;code_files:Identity[];source_files:Identity[];settings:{grading_model:string;review_model:string;review_input_max_chars:number}};
const read=<T=unknown>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const fileHash=(file:string)=>sha256(fs.readFileSync(file));
const samePath=(left:string,right:string)=>path.resolve(left).toLowerCase()===path.resolve(right).toLowerCase();
const safeError=(error:unknown,depth=0):Record<string,unknown>=>{
 const value=(error&&typeof error==='object'?error:{})as{name?:unknown;status?:unknown;code?:unknown;retryable?:unknown;request_id?:unknown;cause?:unknown};
 return{name:typeof value.name==='string'?value.name:null,status:typeof value.status==='number'?value.status:null,
  code:typeof value.code==='string'?value.code:null,retryable:typeof value.retryable==='boolean'?value.retryable:null,
  request_id:typeof value.request_id==='string'?value.request_id:null,...(depth<2&&value.cause?{cause:safeError(value.cause,depth+1)}:{})};
};
const args:Record<string,string>={};let execute=false;
for(let i=2;i<process.argv.length;i++){
 const key=process.argv[i];
 if(key==='--execute'){if(execute)throw Error('중복 --execute');execute=true;continue;}
 if(!['--manifest','--plan-id','--runtime-lock','--semantic','--output'].includes(key)||args[key]||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error('지원인자 --manifest --plan-id --runtime-lock --semantic --output [--execute]');
 args[key]=process.argv[++i];
}
if(['--manifest','--plan-id','--runtime-lock','--semantic','--output'].some(key=>!args[key]))throw Error('필수 인자 누락');
const manifest=read<{entries:Entry[]}>(args['--manifest']),lock=read<Lock>(args['--runtime-lock']);
const entries=manifest.entries.filter(entry=>entry.plan_id===args['--plan-id']);
if(entries.length!==1||entries[0].plan_files.length!==1)throw Error('유일한 문항 및 계획 연결 필요');
const entry=entries[0],output=path.resolve(args['--output']);
const allowed=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11')+path.sep;
if(!output.toLowerCase().startsWith(allowed.toLowerCase())||fs.existsSync(output))throw Error('배정 폴더의 새 실행 경로만 허용');
const snapshots=new Map<string,string>();
const verify=(identity:Identity)=>{
 if(fileHash(identity.file)!==identity.sha256)throw Error(`고정 해시 불일치: ${identity.file}`);
 snapshots.set(path.resolve(identity.file),identity.sha256);
};
for(const identity of [{file:args['--manifest'],sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,
 {file:entry.file,sha256:entry.sha256},...entry.plan_files,...entry.source_files])verify(identity);
for(const file of [args['--runtime-lock'],args['--semantic'],process.argv[1]])snapshots.set(path.resolve(file),fileHash(file));
const semanticRuntimeFile=args['--semantic']+'.runtime.json';
const semanticResultFile=args['--semantic']+'.runtime-result.json';
const runtime=read<{mock:boolean;review_model:string;grading_model:string;max_input_chars:number;args:string[];code_hashes:Record<string,string>}>(semanticRuntimeFile);
const runtimeResult=read<{changed_code_files:string[];changed_input_files?:string[];completed_receipt?:boolean}>(semanticResultFile);
if(runtime.mock!==false||runtime.review_model!==lock.settings.review_model||runtime.grading_model!==lock.settings.grading_model||runtime.max_input_chars!==lock.settings.review_input_max_chars||!Array.isArray(runtimeResult.changed_code_files)||runtimeResult.changed_code_files.length||runtimeResult.changed_input_files?.length||runtimeResult.completed_receipt===false)throw Error('원 의미검수의 실제 실행/안정성 증거가 유효하지 않음');
const requiredCode=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3Answer.ts','lib/questionV3.ts','lib/ai/openaiStructured.ts','cpa_uploader/questionSemanticReview.ts','cpa_uploader/questionReviewGrading.ts','cpa_uploader/review_question_draft_v3.ts','cpa_uploader/questionBankPublication.ts','cpa_uploader/questionAuthoringPlan.ts','cpa_uploader/questionSourceCatalog.mjs'];
for(const file of requiredCode)if(!Object.keys(runtime.code_hashes).some(item=>samePath(item,file)))throw Error(`원 의미검수 필수 코드 해시 누락: ${file}`);
for(const [key,file]of Object.entries({'--file':entry.file,'--plan':entry.plan_files[0].file,'--bank':lock.comparison_bank.file,'--output':args['--semantic']})){
 const index=runtime.args.indexOf(key);
 if(index<0||!runtime.args[index+1]||!samePath(runtime.args[index+1],file))throw Error(`원 의미검수 인자 연결 불일치: ${key}`);
}
for(const [file,hash] of Object.entries(runtime.code_hashes))verify({file,sha256:hash});
for(const file of [semanticRuntimeFile,semanticResultFile])snapshots.set(path.resolve(file),fileHash(file));
const raw=read<QuestionSetV3|QuestionSetV3[]>(entry.file);
if(Array.isArray(raw)&&raw.length!==1)throw Error('한 세트 문항 파일 필요');
const set=Array.isArray(raw)?raw[0]:raw;
const planRaw=read<{plans?:Array<{set_id:string}>}>(entry.plan_files[0].file);
const plan=planRaw.plans?planRaw.plans.find(plan=>plan.set_id===set.id):planRaw;
const bank=read<QuestionSetV3[]>(lock.comparison_bank.file);
const options={bank:[...bank.filter(peer=>peer.id!==set.id),set],authoringPlan:plan,maxInputChars:lock.settings.review_input_max_chars};
const prepared=prepareSemanticReview(set,options);
const candidates=readSemanticReviewDocument(args['--semantic']).reviews.filter(receipt=>receipt.set_id===set.id);
if(candidates.length!==1)throw Error('의미검수 receipt 연결 오류');
const receipt=candidates[0];
const errors=semanticReceiptIntegrityErrors(receipt,false);
if(errors.length||receipt.execution.method!=='model_reasoned'||receipt.execution.transport!=='model'||receipt.execution.model!==lock.settings.review_model||receipt.grading.status!=='not_run')throw Error('현재 실제 모델의 미채점 pass receipt가 필요: '+errors.join('\n'));
const rebuilt=completeSemanticReview(prepared,{units:receipt.units,cases:receipt.cases,notes:receipt.notes},receipt.execution);
if(rebuilt.receipt_hash!==receipt.receipt_hash)throw Error('현재 문항·은행·계획·출처와 의미검수 receipt가 다름');
const guard=()=>{
 if(gradingModelName()!==lock.settings.grading_model)throw Error('채점 모델 변경');
 for(const [file,hash]of snapshots)if(fileHash(file)!==hash)throw Error(`실행 중 고정 입력 변경: ${file}`);
};
guard();fs.mkdirSync(output,{recursive:true});
const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const log=(name:string,value:unknown)=>fs.appendFileSync(path.join(output,name),JSON.stringify(value)+'\n');
const answersFor=(unitId:string,answer:string)=>{
 const sub=set.subquestions.find(sub=>sub.criteria.some(criterion=>`criterion:${sub.id}:${criterion.id}`===unitId));
 if(!sub)throw Error('사례 대상 criterion 없음');
 return Object.fromEntries(set.subquestions.map(item=>[item.id,item.id===sub.id?answer:'']));
};
const uniqueCaseIds=new Set(receipt.cases.map(sample=>jsonHash(answersFor(sample.unit_id,sample.answer))));
write('inputs.json',{created_at:new Date().toISOString(),mode:execute?'actual_model':'local_preflight',set_id:set.id,plan_id:entry.plan_id,
 semantic_file:args['--semantic'],semantic_sha256:fileHash(args['--semantic']),cases:receipt.cases.length,unique_answer_cases:uniqueCaseIds.size,additional_empty_answer_case:1,
 hashes:Object.fromEntries(snapshots),model:gradingModelName(),transport:'production_gradeSemanticReviewReceipt_and_executeReviewGrading',mock:false});
if(!execute)console.log(JSON.stringify({preflight:true,set_id:set.id,cases:receipt.cases.length,unique:uniqueCaseIds.size,actual_model_calls:0}));
else void(async()=>{
 const events:ReviewGradingEvent[]=[];
 const mismatches=new Map<string,ReviewGradingEvent>();
 let gradedFile:string|null=null;
 try{
  const graded=await gradeSemanticReviewReceipt(receipt,set,{...options,onGradingRun(event){
   log('initial.grading.jsonl',event);events.push(event);if(event.status==='completed'&&!event.matched)mismatches.set(event.id,event);
   guard();console.log(JSON.stringify({set_id:set.id,id:event.id,status:event.status,matched:event.matched}));
  }});
  guard();gradedFile='graded-initial.json';write(gradedFile,{schema_version:'1.0',reviews:[graded]});
  for(const [id,event]of mismatches){
   const selected=receipt.cases.filter(sample=>jsonHash(answersFor(sample.unit_id,sample.answer))===id);
   if(!selected.length&&id!=='empty-answer')throw Error('불일치 재채점 대상 없음');
   for(let attempt=2;attempt<=3;attempt++){
    guard();
    const followup=await executeReviewGrading(set,selected,{onRun(current){
     log('repeat.grading.jsonl',{...current,repeat_of:id,attempt});events.push(current);guard();
     console.log(JSON.stringify({set_id:set.id,id:current.id,repeat_of:id,attempt,status:current.status,matched:current.matched}));
    }});
    write(`repeat-${id}-${attempt}.json`,{original_event:event,grading:followup});
   }
  }
  const validationErrors=validateSemanticReviewReceipt(graded,set,options);
  write('summary.json',{finished_at:new Date().toISOString(),status:'executed',set_id:set.id,initial_cases:graded.grading.runs.length,
   initial_mismatched_case_ids:[...mismatches.keys()],recorded_executions:events.length,nonempty_grader_executions:events.filter(event=>Object.values(event.answers).some(answer=>answer.trim())).length,
   blank_production_executions:events.filter(event=>Object.values(event.answers).every(answer=>!answer.trim())).length,
   validation_errors:validationErrors,first_receipt:gradedFile,all_prior_results_preserved:true});
  if(validationErrors.length)process.exitCode=1;
 }catch(error){
  write('stopped.json',{finished_at:new Date().toISOString(),status:'stopped',error:String(error),error_metadata:safeError(error),recorded_executions:events.length,first_receipt:gradedFile,initial_mismatched_case_ids:[...mismatches.keys()]});
  process.exitCode=1;console.error(String(error));
 }
})();
