import fs from 'node:fs';
import {createHash} from 'node:crypto';
import OpenAI from 'openai';
import ts from 'typescript';
import {prepareSemanticReview,reviewChunkSchema,groundReviewChunk} from '../../../questionSemanticReview.ts';
import {requestOpenAIStructured} from '../../../../lib/ai/openaiStructured.ts';
import {jsonHash} from '../../../questionReviewIdentity.ts';

const [manifestFile,planId,logFile,unitId,output,policyFlag]=process.argv.slice(2);
if(policyFlag&&policyFlag!=='--changed-policy')throw Error('선택 인자는 --changed-policy만 허용');
if(!output||fs.existsSync(output))throw Error('manifest planID 원시chunks unitID 새출력파일 필요');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const manifest=read(manifestFile),entry=manifest.entries.find((row:{plan_id:string})=>row.plan_id===planId);
const raw=read(entry.file),set=Array.isArray(raw)?raw[0]:raw;
const planRaw=read(entry.plan_files[0].file),plan=planRaw.plans?planRaw.plans.find((plan:{set_id:string})=>plan.set_id===set.id):planRaw;
const bank=read(manifestFile.replace(/manifest\.json$/,'comparison-bank.json'));
const peerBank=[...bank.filter((peer:{id:string})=>peer.id!==set.id),set];
const prepared=prepareSemanticReview(set,{bank:peerBank,authoringPlan:plan,maxInputChars:500000});
const unit=prepared.units.find(unit=>unit.id===unitId);
if(!unit)throw Error('대상 검수단위 없음');
const priorRows=fs.readFileSync(logFile,'utf8').trim().split(/\r?\n/).map(line=>JSON.parse(line)).filter(row=>row.unit_id===unitId);
const prior=priorRows.find(row=>!row.error)||priorRows[0];
if(!prior)throw Error('원래 실행기록 없음');
const input=JSON.stringify({...prepared.requestContext as Record<string,unknown>,target_unit:unit.id,
 reference_catalog:{fields:unit.fields,sources:prepared.sources.filter(source=>unit.sources.includes(source.source_ref_id)).map(source=>({id:source.source_ref_id,quote:source.declared_metadata.source_quote}))}});
const schema=reviewChunkSchema(unit);
if(sha(input)!==prior.input_hash||jsonHash(schema)!==prior.schema_hash||prepared.contentHash!==prior.content_hash||prepared.bankHash!==prior.bank_hash)throw Error('원 실패 입력/스키마/문항/비교은행과 다름');
const originalRuntime=read(manifestFile.replace(/manifest\.json$/,'runtime-lock.json'));
const semanticCodeFile='cpa_uploader/questionSemanticReview.ts';
const previousCodeHash=originalRuntime.code_files.find((row:{file:string})=>row.file===semanticCodeFile)?.sha256;
const currentCodeHash=sha(fs.readFileSync(semanticCodeFile,'utf8'));
if(currentCodeHash!==previousCodeHash&&policyFlag!=='--changed-policy')throw Error('원 검수 지시 코드와 다릅니다. 정책 변경 후속 검수는 --changed-policy를 명시해야 합니다.');
const sourceFile=ts.createSourceFile('questionSemanticReview.ts',fs.readFileSync('cpa_uploader/questionSemanticReview.ts','utf8'),ts.ScriptTarget.Latest,true);
let instructions='';
function visit(node:ts.Node){
 if(ts.isPropertyAssignment(node)&&node.name.getText(sourceFile)==='instructions'&&ts.isBinaryExpression(node.initializer)&&ts.isStringLiteral(node.initializer.left))instructions=node.initializer.left.text;
 ts.forEachChild(node,visit);
}
visit(sourceFile);
if(!instructions.startsWith('당신은 별도 의미 검수자다.'))throw Error('현행 원래 검수지시 추출 실패');
const headers=(value:Headers|undefined)=>Object.fromEntries(['x-request-id','x-ratelimit-limit-requests','x-ratelimit-remaining-requests','x-ratelimit-reset-requests','x-ratelimit-limit-tokens','x-ratelimit-remaining-tokens','x-ratelimit-reset-tokens','retry-after'].flatMap(key=>value?.get(key)?[[key,value.get(key)]]:[]));
void(async()=>{
 const record:Record<string,unknown>={started_at:new Date().toISOString(),plan_id:planId,unit_id:unitId,model:prior.model,source_log:logFile,
  input_hash:sha(input),schema_hash:jsonHash(schema),content_hash:prepared.contentHash,bank_hash:prepared.bankHash,
  purpose:policyFlag?'판정 정책 명확화 후의 후속 의미검수. 문항·출처·비교은행·입력·스키마·모델은 원래 단위와 같고 기본 검수 지시는 변경되었다. 기존 결과는 보존한다.':prior.error?'고정된 실패단위의 원래 요청1회로 HTTP상태·요청ID·속도제한 메타만 안전하게 계측한다. 기존 실패의 원인은 새 요청의 결과만으로 확정하지 않는다.':'고정된 동일 검수단위의 같은 입력·스키마·모델·기본지시로 의미판정의 불일치를 재현한다. 재현결과로 이전판정을 덮어쓰지 않는다.',
  production_code_modified:currentCodeHash!==previousCodeHash,previous_semantic_code_hash:previousCodeHash,semantic_code_hash:currentCodeHash,instructions_hash:sha(instructions)};
 const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,maxRetries:0});
 try{
  const result=await requestOpenAIStructured({apiKey:process.env.OPENAI_API_KEY||'',model:prior.model,name:'question_semantic_review_unit',schema,maxOutputTokens:6000,instructions,input,timeoutMs:60000,maxAttempts:1},async(params,options)=>{
   try{
    const response=await client.responses.create(params,options).withResponse();
    record.http_status=response.response.status;record.response_headers=headers(response.response.headers);record.request_id=response.request_id;
    return response.data;
   }catch(error){
    const value=error as {name?:string;status?:number;code?:string;type?:string;request_id?:string;headers?:Headers};
    record.provider_error={name:value.name,status:value.status,code:value.code,type:value.type,request_id:value.request_id,headers:headers(value.headers)};
    throw error;
   }
  });
  record.raw_response=result;
  try{record.grounded=groundReviewChunk(result,prepared,unit);record.status='response_valid';}catch(error){record.status='grounding_failed';record.validation_error=String(error);}
 }catch(error){
  const value=error as {name?:string;status?:number;code?:string;retryable?:boolean};
  record.status='request_failed';record.error={name:value.name,status:value.status,code:value.code,retryable:value.retryable};
 }
 record.finished_at=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,status:record.status,http_status:record.http_status,provider_error:record.provider_error,response_headers:record.response_headers}));
})();
