import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {gradingModelName} from '../../../../../../lib/questionV3Grading.ts';
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[2+2*i],process.argv[3+2*i]]));
if(Object.keys(args).some(k=>!['--manifest','--runtime-lock','--output-phase'].includes(k))||!args['--manifest']||!args['--runtime-lock']||!args['--output-phase']||!/^[a-z0-9-]+$/.test(args['--output-phase']))throw Error('Explicit --manifest --runtime-lock --output-phase required');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const norm=f=>path.resolve(f).toLowerCase();
const base='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11',drafts='cpa_uploader/drafts/delegated-authoring-2026-09-11';
const manifestFile=args['--manifest'],lockFile=args['--runtime-lock'],phase=args['--output-phase'];
const manifest=read(manifestFile),lock=read(lockFile),owners=['r02','n02','n03','s02','s04'];
if(norm(lock.manifest_file)!==norm(manifestFile)||lock.manifest_sha256!==hash(manifestFile))throw Error('Manifest lock mismatch');
const all=manifest.entries.filter(e=>owners.some(o=>e.file.replaceAll('\\','/').includes('/'+o+'/')));
if(all.length!==15||all.reduce((n,e)=>n+e.qa_cases,0)!==835)throw Error('Expected owned15/835');
const previous=drafts+'/r02/evidence/phase2/phase-two-v5-source-ranges-control';
if(!fs.existsSync(previous+'/queue-stopped.json'))throw Error('Prior single stream must have stopped at a set boundary');
const priorInputs=read(previous+'/queue-inputs.json'),priorHashes=new Map(priorInputs.identities.map(i=>[norm(i.file),i.sha256]));
const graderFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3.ts','lib/questionV3Answer.ts','lib/ai/openaiStructured.ts',base+'/run-author-qa.ts'];
for(const f of graderFiles)if(priorHashes.get(norm(f))!==hash(f))throw Error('Prior grading code changed: '+f);
if(priorInputs.model!==gradingModelName()||lock.settings.grading_model!==gradingModelName())throw Error('Grading model changed');
const inheritSpecs=[['T05-A','r02','phase-two-v4-bank-v2'],['T08-A','n02','phase-two-v4-bank-v2'],['T06-A','n02','phase-two-v5-source-ranges'],['T06-B','n02','phase-two-v5-source-ranges'],['T07-A','n03','phase-two-v5-source-ranges']];
const inherited=inheritSpecs.map(([id,owner,oldphase])=>{
 const e=all.find(e=>e.plan_id===id);if(!e)throw Error('Missing inherited set '+id);
 const file=drafts+'/'+owner+'/evidence/phase2/'+oldphase+'/'+e.set_id+'/required-case-coverage-summary.json',r=read(file);
 if(!r.completed_required_case_coverage||r.required_cases!==e.qa_cases)throw Error('Incomplete prior required coverage '+id);
 for(const item of [{file:e.file,sha256:e.sha256},...e.source_files])if(hash(item.file)!==item.sha256||priorHashes.get(norm(item.file))!==item.sha256)throw Error('Prior question/source identity mismatch '+id);
 const currentQa=read(e.qa_file),oldQaFile=r.QA_file||e.qa_file,oldQa=read(oldQaFile);
 const semanticQa=q=>q.cases.map(c=>({id:c.id,subquestion_id:c.subquestion_id,kind:c.kind,answer:c.answer,expected_points:c.expected_points,expected_verdicts:c.expected_verdicts.map(v=>({criterion_id:v.criterion_id,verdict:v.verdict}))}));
 if(JSON.stringify(semanticQa(currentQa))!==JSON.stringify(semanticQa(oldQa)))throw Error('Changed prior answers or expected judgments '+id);
 return {plan_id:id,file,sha256:hash(file),...r,selected_QA_file:e.qa_file,selected_QA_sha256:e.qa_sha256,reason_only_QA_change:hash(oldQaFile)!==e.qa_sha256,new_API_calls_for_reuse:0};
});
const t08=all.find(e=>e.plan_id==='T08-B');
if(t08.sha256!=='7779f552dcc7fcc30a0b34de13045a8d383df386a5c9fe21f41df37bc33dc1a3')throw Error('Expected approved T08-B v3');
const entries=[t08,...all.filter(e=>e.plan_id!=='T08-B'&&!inherited.some(r=>r.plan_id===e.plan_id))];
if(entries.length!==10||entries.reduce((n,e)=>n+e.qa_cases,0)!==527||inherited.reduce((n,e)=>n+e.required_cases,0)!==308)throw Error('Expected308 inherited +527 newly graded required cases');
const supplements=['qa-supplement-t08-b-v3-evidence-scope.json','qa-supplement-t08-b-original-expressions.json'].map(n=>path.dirname(t08.file)+'/'+n);
if(supplements.reduce((n,f)=>n+read(f).cases.length,0)!==6)throw Error('Expected six T08-B supplementary cases');
const repeatRequired=['sub2-crit3-opposite','sub3-all-paraphrases','sub3-crit7-paraphrase','sub3-crit8-paraphrase','sub3-crit8-opposite'];
const control=drafts+'/r02/evidence/phase2/'+phase+'-control';
if(fs.existsSync(control))throw Error('Fresh output control path required');
const identities=[{file:manifestFile,sha256:lock.manifest_sha256},{file:lockFile,sha256:hash(lockFile)},lock.comparison_bank,...lock.code_files,...lock.source_files,...all.flatMap(e=>[{file:e.file,sha256:e.sha256},{file:e.qa_file,sha256:e.qa_sha256},...e.plan_files,...e.source_files]),...supplements.map(file=>({file,sha256:hash(file)})),{file:process.argv[1],sha256:hash(process.argv[1])}];
const guard=()=>{if(gradingModelName()!==lock.settings.grading_model)throw Error('Model changed');for(const i of identities)if(hash(i.file)!==i.sha256)throw Error('Fixed input/code changed: '+i.file);if(fs.existsSync(control+'/STOP-BEFORE-NEXT-JOB'))throw Error('Owner pause before next job');};
guard();fs.mkdirSync(control,{recursive:true});
const write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write(control+'/queue-inputs.json',{created_at:new Date().toISOString(),manifest:manifestFile,runtime_lock:lockFile,identities,model:gradingModelName(),required_total:835,inherited_required_cases:308,newly_graded_required_cases:527,inherited,selected_followup:'T08-B v3; all55 original required answers preserved; superseded v2 runs remain historical',repeatRequired,supplements:supplements.map(file=>({file,sha256:hash(file),count:read(file).cases.length,minimum_repeats:3})),policy:'One child stream. Preserve complete and nonpass records. Grade changed T08-B afresh. Reuse other sets only with grading-code/model/content/source/answer/expected-judgment identity. Bank affects semantic review, not grading prompt.'});
let job=0,completed=0;
async function run(entry,qaFile,output,only){
 guard();const n=String(++job).padStart(2,'0');fs.mkdirSync(path.dirname(output),{recursive:true});
 const started={started_at:new Date().toISOString(),job,set_id:entry.set_id,plan_id:entry.plan_id,qa_file:qaFile,only:only||null,output};write(control+'/job-'+n+'-start.json',started);console.log(JSON.stringify(started));
 const fd=fs.openSync(control+'/job-'+n+'-console.log','wx');let code;
 try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx',base+'/run-author-qa.ts','--file',entry.file,'--qa',qaFile,'--output',output,...(only?['--only',only]:[])],{stdio:['ignore',fd,fd],env:process.env});child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error('Child signal '+signal)):resolve(code));});}finally{fs.closeSync(fd);}
 const summary=fs.existsSync(output+'/summary.json')?read(output+'/summary.json'):null;
 write(control+'/job-'+n+'-result.json',{finished_at:new Date().toISOString(),job,set_id:entry.set_id,only:only||null,exit_code:code,summary_file:output+'/summary.json',summary});
 if(!summary||summary.stopped_on_execution_error||summary.changed_inputs.length||summary.recorded_cases!==summary.planned_cases)throw Error('Incomplete child/transport failure; no further API jobs');
 if(code!==0&&!(code===1&&summary.mismatched_case_ids.length))throw Error('Unexpected child exit');
 console.log(JSON.stringify({job,set_id:entry.set_id,only:only||null,recorded:summary.recorded_cases,attempts:summary.actual_attempts,mismatches:summary.mismatched_case_ids}));return summary;
}
async function minimumThree(entry,qaFile,c,output,initial){
 let observed=initial?.attempts||0,invocation=0;const evidence=initial?[initial]:[];
 while(observed<3){const next=output+'/execution-'+(++invocation),r=await run(entry,qaFile,next,c.id);observed+=r.actual_attempts;evidence.push({summary_file:next+'/summary.json',attempts:r.actual_attempts,mismatched_case_ids:r.mismatched_case_ids});guard();}
 fs.mkdirSync(output,{recursive:true});write(output+'/minimum-three-result.json',{case_id:c.id,observed,evidence});
}
try{
 for(const entry of entries){
  const owner=owners.find(o=>entry.file.replaceAll('\\','/').includes('/'+o+'/')),out=drafts+'/'+owner+'/evidence/phase2/'+phase+'/'+entry.set_id;
  const summary=await run(entry,entry.qa_file,out+'/author-qa-run1');
  if(summary.planned_cases!==entry.qa_cases)throw Error('Required count changed');
  write(out+'/required-case-coverage-summary.json',{finished_at:new Date().toISOString(),set_id:entry.set_id,plan_id:entry.plan_id,required_cases:entry.qa_cases,QA_file:entry.qa_file,QA_sha256:hash(entry.qa_file),new_grading_executions:summary.actual_attempts,unresolved_cases:summary.mismatched_case_ids,completed_required_case_coverage:true,summary_file:out+'/author-qa-run1/summary.json'});completed++;guard();
  if(entry.plan_id==='T08-B'){
   for(const id of repeatRequired){const c=read(entry.qa_file).cases.find(c=>c.id===id);if(!c)throw Error('Missing original regression case '+id);const records=summary.records.filter(r=>r.case_id===id);await minimumThree(entry,entry.qa_file,c,out+'/original-mismatch-regression/'+id,{summary_file:out+'/author-qa-run1/summary.json',attempts:records.length,records});}
   for(const file of supplements)for(const c of read(file).cases)await minimumThree(entry,file,c,out+'/supplement/'+c.id,null);
  }
 }
 write(control+'/queue-completed.json',{finished_at:new Date().toISOString(),newly_completed_required_sets:completed,inherited_required_sets:5,required_cases:835,T08_B_supplement_cases:6,T06_A_prior_supplement_cases:5,all_evidence_preserved:true});
}catch(error){write(control+'/queue-stopped.json',{stopped_at:new Date().toISOString(),completed_required_sets:completed,inherited_required_sets:5,error:String(error)});console.error(String(error));process.exitCode=1;}
