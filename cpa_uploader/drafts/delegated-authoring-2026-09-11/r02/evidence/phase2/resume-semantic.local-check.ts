import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {extractProductionInstructions,safeHeaders,safeError} from './resume-semantic.ts';
const root='cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2';
const script=root+'/resume-semantic.ts';
const manifest='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json';
const oldLock=manifest.replace('manifest.json','runtime-lock.json');
const newLock='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/runtime-v2-policy/runtime-lock.json';
const oldLog=root+'/final-153-v1/semantic-run1.json.chunks.jsonl';
const records:Record<string,unknown>[]=[];
const run=Date.now();
function local(name:string, fn:()=>void){fn();records.push({name,passed:true,actual_api_requests:0});}
local('safe HTTP metadata excludes authorization and unknown headers',()=>assert.deepEqual(safeHeaders(new Headers({'x-request-id':'req-public','authorization':'secret-test','set-cookie':'secret-test'})),{'x-request-id':'req-public'}));
local('error cause metadata retains status/code/retryable without message/body/secrets',()=>{const r=safeError({name:'Outer',code:'transport',retryable:true,message:'secret-test',cause:{name:'APIError',status:429,code:'rate_limit',request_id:'req-public',headers:{'x-ratelimit-remaining-tokens':'0',authorization:'secret-test'},body:'secret-test'}});assert.equal(JSON.stringify(r).includes('secret-test'),false);assert.equal((r.cause as Record<string,unknown>).status,429);});
local('production instruction AST exact base and uniqueness guard',()=>{const s=fs.readFileSync('cpa_uploader/questionSemanticReview.ts','utf8');const instruction=extractProductionInstructions(s);assert.ok(instruction.includes('authoring_plan'));assert.throws(()=>extractProductionInstructions('const x={instructions:"other"};'));});
function cli(name:string, lock:string, plan:string, output:string, log?:string, expectedError?:string){const args=['--import','tsx',script,'--manifest',manifest,'--runtime-lock',lock,'--plan-id',plan,'--output',output,'--cache-only',...(log?['--resume-log',log]:[])];const res=spawnSync(process.execPath,args,{encoding:'utf8'});if(expectedError){assert.equal(res.status,1);assert.ok((res.stderr+res.stdout).includes(expectedError));}else{assert.equal(res.status,0,res.stderr);assert.equal(JSON.parse(res.stdout.trim()).actual_api_requests,0);}records.push({name,exit_code:res.status,passed:true,actual_api_requests:0,stdout:res.stdout.trim(),stderr:res.stderr.trim()});}
local('model retry try-block excludes guards and observers',()=>{const source=ts.createSourceFile(script,fs.readFileSync(script,'utf8'),ts.ScriptTarget.Latest,true);let count=0;function visit(node:ts.Node){if(ts.isTryStatement(node)&&node.tryBlock.statements.some(s=>ts.isExpressionStatement(s)&&s.getText(source).includes('rawResponse = await requestOpenAIStructured'))){count++;const body=node.tryBlock.getText(source);for(const forbidden of ['guard();','append(','chunks.push(','console.log('])assert.equal(body.includes(forbidden),false,forbidden);}ts.forEachChild(node,visit);}visit(source);assert.equal(count,1);});
cli('v2 lock now refuses externally changed production code',newLock,'T08-A',root+'/prototype-cache-check-v2-n02-no-resume-'+run,undefined,'고정 해시 불일치');
cli('existing output is refused without overwrite',newLock,'T05-A',root+'/prototype-cache-check-v2-no-resume-1',undefined,'새 디렉터리만 허용');
cli('v1 lock refuses changed production code',oldLock,'T05-A',root+'/prototype-local-rejected-old-lock',undefined,'고정 해시 불일치');
cli('v2 lock refuses past v1 model cache runtime code',newLock,'T05-A',root+'/prototype-local-rejected-old-runtime',oldLog,'고정 해시 불일치');
const hash=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(root,'prototype-local-validation-'+run+'.json'),JSON.stringify({performed_at:new Date().toISOString(),script:{file:script,sha256:hash(script)},actual_api_requests:0,records,historical_positive_cache_audit:{file:root+'/prototype-cache-check-r02-1/cache-audit.json',sha256:hash(root+'/prototype-cache-check-r02-1/cache-audit.json'),note:'Before policy v2; 9 actual prior model units grounded. Now rejected after common instruction/code change.'}},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checks:records.length,passed:true,actual_api_requests:0}));
