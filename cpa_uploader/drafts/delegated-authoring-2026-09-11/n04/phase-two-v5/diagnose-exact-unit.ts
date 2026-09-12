// Explicit-lock diagnostic for already-observed non-pass units. No API without --execute.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import OpenAI from 'openai';
import ts from 'typescript';
import {prepareSemanticReview,reviewChunkSchema,groundReviewChunk} from '../../../../../cpa_uploader/questionSemanticReview.ts';
import {requestOpenAIStructured} from '../../../../../lib/ai/openaiStructured.ts';
import {jsonHash} from '../../../../../cpa_uploader/questionReviewIdentity.ts';
const [lockFile,planId,logFile,unitId,output,flag]=process.argv.slice(2);
if(!output||fs.existsSync(output)||(flag&&flag!=='--execute')||!['T11-A','T11-B'].includes(planId))throw Error('Need explicit lock, assigned plan ID, original chunks, unit ID and fresh owned output');
const own=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/n04');
if(!path.resolve(output).startsWith(own+path.sep))throw Error('Output outside assigned package');
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const sha=(f:string)=>hash(fs.readFileSync(f));
const lock=read(lockFile),lockHash=sha(lockFile),manifest=read(lock.manifest_file),entry=manifest.entries.find((r:any)=>r.plan_id===planId);
const records=[{file:lockFile,sha256:lockHash},{file:lock.manifest_file,sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,{file:entry.file,sha256:entry.sha256},{file:entry.qa_file,sha256:entry.qa_sha256},...entry.plan_files];
const guard=()=>{for(const r of records)if(sha(r.file)!==r.sha256)throw Error('Frozen input changed: '+r.file);};guard();
const set=read(entry.file),plan=read(entry.plan_files[0].file).plans.find((p:any)=>p.set_id===set.id),bank=read(lock.comparison_bank.file);
const prepared=prepareSemanticReview(set,{bank:[...bank.filter((s:any)=>s.id!==set.id),set],authoringPlan:plan,maxInputChars:500000}),unit=prepared.units.find(u=>u.id===unitId);
if(!unit)throw Error('Missing unit');
const priorRows=fs.readFileSync(logFile,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line)).filter(r=>r.unit_id===unitId),prior=priorRows.find(r=>!r.error);
if(!prior||prior.attempt!==1)throw Error('An original valid first-attempt observation is required');
const input=JSON.stringify({...prepared.requestContext as Record<string,unknown>,target_unit:unit.id,reference_catalog:{fields:unit.fields,sources:prepared.sources.filter(s=>unit.sources.includes(s.source_ref_id)).map(s=>({id:s.source_ref_id,quote:s.declared_metadata.source_quote}))}}),schema=reviewChunkSchema(unit);
if(hash(input)!==prior.input_hash||jsonHash(schema)!==prior.schema_hash||prepared.contentHash!==prior.content_hash||prepared.bankHash!==prior.bank_hash)throw Error('Original input/schema/content/bank identity differs');
const codeFile='cpa_uploader/questionSemanticReview.ts',sourceFile=ts.createSourceFile(codeFile,fs.readFileSync(codeFile,'utf8'),ts.ScriptTarget.Latest,true);
let instructions='';
function visit(node:ts.Node){if(ts.isPropertyAssignment(node)&&node.name.getText(sourceFile)==='instructions'&&ts.isBinaryExpression(node.initializer)&&ts.isStringLiteral(node.initializer.left))instructions=node.initializer.left.text;ts.forEachChild(node,visit);}visit(sourceFile);
if(!instructions.startsWith('당신은 별도 의미 검수자다.')||!prior.instructions_hash||hash(instructions)!==prior.instructions_hash)throw Error('Exact original instruction hash mismatch');
const record:any={prepared_at:new Date().toISOString(),plan_id:planId,set_id:set.id,unit_id:unitId,runtime_lock:{file:lockFile,sha256:lockHash},manifest:{file:lock.manifest_file,sha256:sha(lock.manifest_file)},source_log:{file:logFile,sha256:sha(logFile)},model:prior.model,input_hash:hash(input),schema_hash:jsonHash(schema),instructions_hash:hash(instructions),content_hash:prepared.contentHash,bank_hash:prepared.bankHash,semantic_code_hash:sha(codeFile),same_original_input_schema_instructions_model:true,original_receipt_unchanged:true,purpose:'동일한 원문항·원계획·원은행·원 입력/스키마/검수 지시의 non-pass 단위 재현. 후속 계획 검수나 최초 판정 대체가 아니다.',new_api_request:flag==='--execute',request:{model:prior.model,name:'question_semantic_review_unit',schema,maxOutputTokens:6000,instructions,input,timeoutMs:60000,maxAttempts:1}};
const safeHeaders=(headers:Headers|undefined)=>Object.fromEntries(['x-request-id','x-ratelimit-limit-requests','x-ratelimit-remaining-requests','x-ratelimit-reset-requests','x-ratelimit-limit-tokens','x-ratelimit-remaining-tokens','x-ratelimit-reset-tokens','retry-after'].flatMap(k=>headers?.get(k)?[[k,headers.get(k)]]:[]));
function safeError(error:any,depth=0):any{if(!error||depth>4)return undefined;return {name:error.name,status:error.status,code:error.code,type:error.type,retryable:error.retryable,request_id:error.request_id,headers:safeHeaders(error.headers),cause:safeError(error.cause,depth+1),error:typeof error.error==='object'?safeError(error.error,depth+1):undefined};}
void(async()=>{
if(flag==='--execute'){
 if(!process.env.OPENAI_API_KEY)throw Error('Credential missing');
 guard();record.started_at=new Date().toISOString();
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
 try{
  const result=await requestOpenAIStructured({apiKey:process.env.OPENAI_API_KEY,model:prior.model,name:'question_semantic_review_unit',schema,maxOutputTokens:6000,instructions,input,timeoutMs:60000,maxAttempts:1},async(params,options)=>{
   record.actual_request_parameters=params;
   try{const response=await client.responses.create(params,options).withResponse();record.http_status=response.response.status;record.response_headers=safeHeaders(response.response.headers);record.request_id=response.request_id;record.actual_sdk_response=response.data;return response.data;}
   catch(error){record.provider_error=safeError(error);throw error;}
  });
  record.raw_response=result;
  try{record.grounded=groundReviewChunk(result,prepared,unit);record.status='response_valid';}catch(error){record.status='grounding_failed';record.validation_error=String(error);}
 }catch(error){record.status='request_failed';record.error=safeError(error);}
 record.finished_at=new Date().toISOString();
 try{guard();record.frozen_inputs_unchanged_after=true;}catch(error){record.frozen_inputs_unchanged_after=false;record.guard_error=String(error);}
}else record.status='preflight_api_0';
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,status:record.status,unit_id:unitId,http_status:record.http_status,api_calls:flag==='--execute'?1:0}));
if(flag==='--execute'&&(record.status!=='response_valid'||record.frozen_inputs_unchanged_after!==true))process.exitCode=1;
})();
