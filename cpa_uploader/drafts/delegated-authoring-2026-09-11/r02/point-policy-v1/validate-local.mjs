import fs from 'node:fs';import crypto from 'node:crypto';import{spawnSync}from'node:child_process';
import {validateQuestionSetV3} from '../../../../../lib/questionV3.ts';
import {validateAuthoringBank} from '../../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../../questionAuthoringPlan.ts';
const own='cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/point-policy-v1',read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const selection=read(own+'/qa-selection.json'),inputs=read(own+'/inputs.json'),errors=[],sets=[];let originals=0,added=0;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const e of selection.entries){
 const input=inputs.entries.find(x=>x.plan_id===e.plan_id),raw=read(e.question_file),set=Array.isArray(raw)?raw[0]:raw,qa=read(e.qa_file),plan=read(e.plan_file);
 const structural=validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()});errors.push(...structural.errors.map(x=>e.plan_id+': '+x));
 const pe=validateQuestionAuthoringPlan(plan);errors.push(...pe.map(x=>e.plan_id+' plan: '+x));
 if(JSON.stringify(set.source_refs)!==JSON.stringify(input.question.source_refs)||JSON.stringify(set.shared_context)!==JSON.stringify(input.question.shared_context))errors.push(e.plan_id+' source/context changed');
 for(const [i,c]of input.qa.cases.entries()){const actual=qa.cases[i];if(!actual||c.id!==actual.id||c.answer!==actual.answer||c.subquestion_id!==actual.subquestion_id)errors.push(e.plan_id+' original QA changed '+c.id);}
 for(const c of qa.cases){const q=set.subquestions.find(q=>q.id===c.subquestion_id);if(!q){errors.push(e.plan_id+' invalid QA subquestion');continue;}
  const ids=c.expected_verdicts.map(v=>v.criterion_id);if(ids.length!==q.criteria.length||new Set(ids).size!==ids.length||q.criteria.some(k=>!ids.includes(k.id)))errors.push(e.plan_id+'/'+c.id+' QA IDs mismatch');
  const sum=c.expected_verdicts.reduce((n,v)=>n+(v.verdict==='met'?1:0),0);if(sum!==c.expected_points||c.expected_verdicts.some(v=>!['met','not_met','contradicted'].includes(v.verdict)))errors.push(e.plan_id+'/'+c.id+' sum/verdict invalid');
 }
 for(const q of set.subquestions){if(!qa.cases.some(c=>c.subquestion_id===q.id&&!c.answer.trim()&&c.expected_points===0))errors.push(e.plan_id+'/'+q.id+' missing empty');if(!qa.cases.some(c=>c.subquestion_id===q.id&&c.answer===q.model_answer.join('\n')&&c.expected_points===q.criteria.length))errors.push(e.plan_id+'/'+q.id+' missing current model answer');}
 if(e.changed){for(const sq of e.questions)for(const m of sq.criterion_mapping.filter(m=>m.new_ids.length>1))for(const id of m.new_ids){const cs=qa.cases.filter(c=>c.subquestion_id===sq.id&&c.target_criterion_id===id);for(const k of ['full','paraphrase','omission','opposite','condition_boundary'])if(!cs.some(c=>c.kind===k))errors.push(e.plan_id+'/'+id+' missing '+k);}}
 const oldPoints=input.question.subquestions.flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0),points=set.subquestions.flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0);
 originals+=input.qa.cases.length;added+=qa.cases.length-input.qa.cases.length;sets.push({plan_id:e.plan_id,set_id:set.id,changed:e.changed,questions:set.subquestions.length,old_points:oldPoints,new_points:points,criteria:set.subquestions.flatMap(q=>q.criteria).length,original_QA:input.qa.cases.length,new_QA:qa.cases.length-input.qa.cases.length,structural_errors:structural.errors,structural_warnings:structural.warnings,plan_errors:pe,question_sha256:hash(e.question_file),qa_sha256:hash(e.qa_file)});
}
const comparison=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/comparison-bank.json'),chosen=new Map(selection.entries.map(e=>{const r=read(e.question_file);return[e.set_id,Array.isArray(r)?r[0]:r];}));
const memory=comparison.map(s=>chosen.get(s.id)??s);const bank=validateAuthoringBank(memory);errors.push(...bank.errors.map(x=>'memory bank: '+x));
const cli=[];for(const e of selection.entries.filter(e=>e.changed)){const r=spawnSync(process.execPath,['--import','tsx','cpa_uploader/validate_draft_v3.ts','--file',e.question_file],{encoding:'utf8',windowsHide:true});cli.push({plan_id:e.plan_id,exit_code:r.status,stdout:r.stdout,stderr:r.stderr});if(r.status!==0)errors.push(e.plan_id+' validate_draft_v3 CLI failed');}
const report={created_at:new Date().toISOString(),api_calls:0,sets,original_cases:originals,added_cases:added,questions:sets.reduce((n,s)=>n+s.questions,0),points:sets.reduce((n,s)=>n+s.new_points,0),errors,memory_bank_sets:memory.length,memory_bank_errors:bank.errors,cli,model_revalidation:'not_run_user_paused'};
const output=process.argv[2]??own+'/local-validation-01.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,sets:sets.length,questions:report.questions,points:report.points,originals,added,errors}));process.exitCode=errors.length?1:0;
