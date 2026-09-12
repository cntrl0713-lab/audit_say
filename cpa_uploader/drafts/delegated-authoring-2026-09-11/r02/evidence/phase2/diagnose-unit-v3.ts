import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import OpenAI from 'openai';
import {prepareSemanticReview,reviewChunkSchema,groundReviewChunk} from '../../../../../questionSemanticReview.ts';
import {jsonHash} from '../../../../../questionReviewIdentity.ts';
import {requestOpenAIStructured} from '../../../../../../lib/ai/openaiStructured.ts';
import {gradingModelName} from '../../../../../../lib/questionV3Grading.ts';
import type {QuestionSetV3} from '../../../../../../lib/questionV3.ts';
import {extractProductionInstructions,safeHeaders,safeError} from './resume-semantic.ts';

type Identity={file:string;sha256:string};
type Entry={plan_id:string;set_id:string;file:string;sha256:string;qa_file:string;qa_sha256:string;plan_files:Identity[];source_files:Identity[]};
type Lock={manifest_sha256:string;comparison_bank:Identity;code_files:Identity[];source_files:Identity[];settings:{review_model:string;grading_model:string;review_input_max_chars:number}};
type Runtime={args:string[];code_hashes:Record<string,string>;mock:boolean;review_model:string;grading_model:string;max_input_chars:number};
type Row={set_id:string;unit_id:string;attempt:number;model:string;transport:string;input_hash:string;schema_hash:string;instructions_hash:string;content_hash:string;bank_hash:string;source_files:Identity[];response:unknown;error?:string;record_kind?:string};
const read=<T=unknown>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const fileHash=(file:string)=>hash(fs.readFileSync(file));
const samePath=(a:string,b:string)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const ownFile=fileURLToPath(import.meta.url);
const helperFile=path.join(path.dirname(ownFile),'resume-semantic.ts');
const reviewFile='cpa_uploader/questionSemanticReview.ts';

export async function main(argv=process.argv.slice(2)):Promise<void>{
 const args:Record<string,string>={};let execute=false;
 for(let i=0;i<argv.length;i++){
  const key=argv[i];if(key==='--execute'){if(execute)throw Error('duplicate execute');execute=true;continue;}
  if(!['--manifest','--runtime-lock','--chunks','--unit-id','--output','--plan-id'].includes(key)||args[key]||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Use --manifest --runtime-lock --chunks --unit-id --output [--plan-id] [--execute]');
  args[key]=argv[++i];
 }
 for(const key of ['--manifest','--runtime-lock','--chunks','--unit-id','--output'])if(!args[key])throw Error('Missing '+key);
 const output=path.resolve(args['--output']);
 const allowed=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11')+path.sep;
 if(!output.toLowerCase().startsWith(allowed.toLowerCase())||fs.existsSync(output)||fs.existsSync(output+'.started.json'))throw Error('A new output file in a delegated draft folder is required');
 if(!args['--chunks'].endsWith('.chunks.jsonl'))throw Error('Original semantic.chunks.jsonl required');
 const semanticFile=args['--chunks'].slice(0,-'.chunks.jsonl'.length);
 const runtimeFile=semanticFile+'.runtime.json',runtimeResultFile=semanticFile+'.runtime-result.json';
 const manifest=read<{entries:Entry[]}>(args['--manifest']),lock=read<Lock>(args['--runtime-lock']);
 const runtime=read<Runtime>(runtimeFile),runtimeResult=read<{changed_code_files?:string[];changed_input_files?:string[]}>(runtimeResultFile);
 const rows=fs.readFileSync(args['--chunks'],'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line) as Row);
 const candidates=rows.filter(row=>row.unit_id===args['--unit-id']&&!row.error&&row.response!==null&&row.response!==undefined&&row.attempt===1);
 if(candidates.length!==1)throw Error('Exactly one original successful attempt-1 response is required; no selection among different valid responses');
 const prior=candidates[0];
 const selected=manifest.entries.filter(e=>e.set_id===prior.set_id&&(!args['--plan-id']||e.plan_id===args['--plan-id']));
 if(selected.length!==1||selected[0].plan_files.length!==1)throw Error('Unique manifest set/plan binding required');
 const entry=selected[0],planFile=entry.plan_files[0].file;
 if(rows.some(row=>row.set_id!==entry.set_id))throw Error('Original chunks contains another set');
 const model=lock.settings.review_model,budget=lock.settings.review_input_max_chars;
 if(model!=='gpt-5.6-luna'||lock.settings.grading_model!==model||budget!==500000)throw Error('Expected fixed model and 500000-character budget');
 if(gradingModelName()!==lock.settings.grading_model||process.env.CPA_REVIEW_MODEL&&process.env.CPA_REVIEW_MODEL!==model||process.env.CPA_REVIEW_INPUT_MAX_CHARS&&Number(process.env.CPA_REVIEW_INPUT_MAX_CHARS)!==budget)throw Error('Process model or budget differs from lock');
 if(runtime.mock!==false||runtime.review_model!==model||runtime.grading_model!==lock.settings.grading_model||runtime.max_input_chars!==budget||!Array.isArray(runtimeResult.changed_code_files)||runtimeResult.changed_code_files.length||runtimeResult.changed_input_files?.length)throw Error('Original runtime stability or actual-model evidence is invalid');
 const originalArg=(key:string)=>{const indexes=runtime.args.flatMap((v,i)=>v===key?[i]:[]);if(indexes.length!==1||!runtime.args[indexes[0]+1])throw Error('Original runtime arg missing/duplicated: '+key);return runtime.args[indexes[0]+1];};
 for(const [key,file]of [['--file',entry.file],['--plan',planFile],['--bank',lock.comparison_bank.file],['--output',semanticFile]])if(!samePath(originalArg(key),file))throw Error('Original runtime path differs: '+key);
 const snapshots=new Map<string,string>();
 const verify=(identity:Identity)=>{if(fileHash(identity.file)!==identity.sha256)throw Error('Fixed hash mismatch: '+identity.file);snapshots.set(path.resolve(identity.file),identity.sha256);};
 for(const identity of [{file:args['--manifest'],sha256:lock.manifest_sha256},lock.comparison_bank,...lock.code_files,...lock.source_files,{file:entry.file,sha256:entry.sha256},{file:entry.qa_file,sha256:entry.qa_sha256},...entry.plan_files,...entry.source_files])verify(identity);
 for(const required of lock.code_files){const original=Object.entries(runtime.code_hashes).filter(([file])=>samePath(file,required.file));if(original.length!==1||original[0][1]!==required.sha256)throw Error('Original runtime lacks matching fixed code evidence: '+required.file);}
 for(const [file,sha256]of Object.entries(runtime.code_hashes))verify({file,sha256});
 for(const file of [args['--runtime-lock'],args['--chunks'],runtimeFile,runtimeResultFile,ownFile,helperFile])snapshots.set(path.resolve(file),fileHash(file));
 const changes=()=>[...snapshots].filter(([file,sha256])=>!fs.existsSync(file)||fileHash(file)!==sha256).map(([file])=>file);
 const guard=()=>{if(gradingModelName()!==model)throw Error('Model changed during diagnosis');const changed=changes();if(changed.length)throw Error('Input/code changed during diagnosis: '+changed.join(', '));};
 const candidate=read<QuestionSetV3|QuestionSetV3[]>(entry.file);
 if(Array.isArray(candidate)&&candidate.length!==1)throw Error('One set per file required');
 const set=Array.isArray(candidate)?candidate[0]:candidate;
 if(set.id!==entry.set_id)throw Error('Manifest/set ID mismatch');
 const planRaw=read<{plans?:Array<{set_id:string}>}>(planFile);
 const plan=planRaw.plans?planRaw.plans.find(p=>p.set_id===set.id):planRaw;
 const bank=read<QuestionSetV3[]>(lock.comparison_bank.file);
 const prepared=prepareSemanticReview(set,{bank:[...bank.filter(peer=>peer.id!==set.id),set],authoringPlan:plan,maxInputChars:budget});
 for(const source of prepared.sourceFiles)verify(source);
 const unit=prepared.units.find(unit=>unit.id===args['--unit-id']);if(!unit)throw Error('Unknown target unit');
 const input=JSON.stringify({...prepared.requestContext as Record<string,unknown>,target_unit:unit.id,reference_catalog:{fields:unit.fields,sources:prepared.sources.filter(source=>unit.sources.includes(source.source_ref_id)).map(source=>({id:source.source_ref_id,quote:source.declared_metadata.source_quote}))}});
 const schema=reviewChunkSchema(unit),instructions=extractProductionInstructions(fs.readFileSync(reviewFile,'utf8'));
 if(input.length>budget||prior.model!==model||prior.transport!=='model'||prior.record_kind&&prior.record_kind!=='new_actual_model_request'||prior.input_hash!==hash(input)||prior.schema_hash!==jsonHash(schema)||prior.instructions_hash!==hash(instructions)||prior.content_hash!==prepared.contentHash||prior.bank_hash!==prepared.bankHash||jsonHash(prior.source_files)!==jsonHash(prepared.sourceFiles))throw Error('Original row model/transport/input/schema/instructions/content/bank/source identity mismatch');
 const originalGrounded=groundReviewChunk(prior.response,prepared,unit);
 guard();
 const record:Record<string,unknown>={started_at:new Date().toISOString(),mode:execute?'one_actual_model_request':'local_preflight',set_id:set.id,plan_id:entry.plan_id,unit_id:unit.id,model,transport:execute?'model':'none',mock:false,max_input_chars:budget,
  manifest:{file:args['--manifest'],sha256:fileHash(args['--manifest'])},runtime_lock:{file:args['--runtime-lock'],sha256:fileHash(args['--runtime-lock'])},
  original_log:{file:args['--chunks'],sha256:fileHash(args['--chunks']),line:rows.indexOf(prior)+1,response_hash:jsonHash(prior.response),runtime_file:runtimeFile,runtime_hash:fileHash(runtimeFile)},
  input_hash:hash(input),schema_hash:jsonHash(schema),instructions_hash:hash(instructions),content_hash:prepared.contentHash,bank_hash:prepared.bankHash,source_files:prepared.sourceFiles,
  original_grounded:originalGrounded,checked_hashes:Object.fromEntries(snapshots),actual_API_requests:0,
  purpose:'Repeat one valid original attempt-1 semantic judgment with identical fixed model, production instructions, input/schema, full bank, source and code. Valid nonpass findings remain unchanged; no retry, cache injection, or receipt promotion.'};
 fs.mkdirSync(path.dirname(output),{recursive:true});
 if(!execute){fs.writeFileSync(output,JSON.stringify({...record,finished_at:new Date().toISOString(),status:'preflight_valid',changed_files:[]},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'preflight_valid',set_id:set.id,unit_id:unit.id,actual_API_requests:0,output}));return;}
 if(!process.env.OPENAI_API_KEY?.trim())throw Error('API key unavailable');
 fs.writeFileSync(output+'.started.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
 let raw:unknown=null;
 // One actual request only. Observer/write/guard errors are outside this model try.
 try{
  raw=await requestOpenAIStructured({apiKey:process.env.OPENAI_API_KEY,model,name:'question_semantic_review_unit',schema,instructions,input,maxOutputTokens:6000,timeoutMs:60000,maxAttempts:1},async(params,options)=>{
   record.actual_API_requests=1;
   try{const response=await client.responses.create(params,options).withResponse();record.http_status=response.response.status;record.request_id=response.request_id;record.response_headers=safeHeaders(response.response.headers);return response.data;}
   catch(error){record.provider_error=safeError(error);throw error;}
  });
  record.raw_response=raw;
  try{record.grounded=groundReviewChunk(raw,prepared,unit);record.status='response_valid';}catch(error){record.status='grounding_failed';record.validation_error=String(error);}
 }catch(error){record.status='request_failed';record.error=safeError(error);}
 // Persist raw evidence even if an external code/input change occurred during HTTP.
 record.changed_files=changes();
 if((record.changed_files as string[]).length||gradingModelName()!==model){record.status='input_or_model_changed';record.model_after=gradingModelName();}
 record.finished_at=new Date().toISOString();
 fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:record.status,set_id:set.id,unit_id:unit.id,actual_API_requests:record.actual_API_requests,http_status:record.http_status,output}));
 if(record.status!=='response_valid')process.exitCode=1;
}
if(process.argv[1]&&samePath(process.argv[1],ownFile))void main().catch(error=>{console.error(JSON.stringify({error:safeError(error),validation_error:String(error)}));process.exitCode=1;});
