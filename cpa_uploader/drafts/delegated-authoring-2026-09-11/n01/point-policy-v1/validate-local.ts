import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { applyQuestionSetJudgment } from '../../../../../lib/questionV3Grading.ts';
import { computeQuestionSetMaxPoints, validateQuestionSetV3 } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../../../lib/questionV3.ts';
import { validateAuthoringBank } from '../../../../questionBankPublication.ts';

type Case = {id:string; subquestion_id:string; answer:string; expected_points:number; expected_verdicts:Array<{criterion_id:string;verdict:CriterionVerdictV3['verdict'];reason:string}>;target_criterion_id?:string;target_criterion_ids?:string[];kind:string};
const root=process.cwd();
const dir='cpa_uploader/drafts/delegated-authoring-2026-09-11/n01/point-policy-v1';
const read=(p:string)=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const hash=(p:string)=>createHash('sha256').update(fs.readFileSync(path.resolve(root,p))).digest('hex');
const h=read(`${dir}/handoff.json`);
const validationDir=path.join(root,dir,'local-validation');fs.mkdirSync(validationDir,{recursive:true});
const errors:string[]=[];const records:unknown[]=[];const replacements=new Map<string,QuestionSetV3>();let cases=0;let totalCriteria=0;
for(const e of h.entries){
 const q=read(e.question_file) as QuestionSetV3;const qa=read(e.qa_file) as {cases:Case[]};
 replacements.set(q.id,q);const parsed=validateQuestionSetV3(q,{verifySourceQuotes:true,cwd:root});
 errors.push(...parsed.errors.map(x=>`${e.plan_id}: ${x}`));
 const ids=new Set<string>();for(const s of q.subquestions)for(const c of s.criteria){if(ids.has(c.id))errors.push(`${e.plan_id} duplicate set criterion ${c.id}`);ids.add(c.id);if(c.max_points!==1||c.scores.partial!==undefined)errors.push(`${e.plan_id}/${c.id} non-atomic score`);}
 totalCriteria+=ids.size;
 if(e.changed){
  const lineage=read(e.lineage_file);const oldq=read(lineage.source_inputs.question.file);const oldqa=read(lineage.source_inputs.qa.file) as {cases:Case[]};
  if(hash(lineage.source_inputs.question.file)!==lineage.source_inputs.question.sha256)errors.push(`${e.plan_id} original question hash changed`);
  if(hash(lineage.source_inputs.plan.file)!==lineage.source_inputs.plan.sha256)errors.push(`${e.plan_id} original plan hash changed`);
  if(hash(lineage.source_inputs.qa.file)!==lineage.source_inputs.qa.sha256)errors.push(`${e.plan_id} original QA hash changed`);
  if(JSON.stringify(oldq.source_refs)!==JSON.stringify(q.source_refs)||JSON.stringify(oldq.shared_context)!==JSON.stringify(q.shared_context))errors.push(`${e.plan_id} source/fact mutation`);
  const newById=new Map(qa.cases.map(c=>[c.id,c]));for(const c of oldqa.cases){const after=newById.get(c.id);if(!after||after.answer!==c.answer||after.subquestion_id!==c.subquestion_id)errors.push(`${e.plan_id}/${c.id} original answer not preserved`);}
  const plan=read(e.plan_file);if(plan.version!==1||plan.plans[0].version!==1||plan.plans[0].set_id!==q.id)errors.push(`${e.plan_id} plan version or ID`);
  if(JSON.stringify(plan.plans[0].scope.required_answers)!==JSON.stringify(q.subquestions.map(s=>s.prompt)))errors.push(`${e.plan_id} plan prompt mismatch`);
  const command=[ '--import','tsx','cpa_uploader/validate_draft_v3.ts','--file',e.question_file];
  const cli=spawnSync(process.execPath,command,{cwd:root,encoding:'utf8'});
  fs.writeFileSync(path.join(validationDir,`${e.plan_id.toLowerCase()}-validate-draft.log`),`${cli.stdout}\n${cli.stderr}`);
  if(cli.status!==0)errors.push(`${e.plan_id} validate_draft_v3 exit ${cli.status}`);
 }
 const seen=new Set<string>();
 for(const c of qa.cases){
  cases++;if(seen.has(c.id))errors.push(`${e.plan_id} duplicate QA ${c.id}`);seen.add(c.id);
  const sub=q.subquestions.find(s=>s.id===c.subquestion_id);if(!sub){errors.push(`${e.plan_id}/${c.id} missing sub`);continue;}
  const ids=c.expected_verdicts.map(v=>v.criterion_id);if(ids.length!==sub.criteria.length||new Set(ids).size!==ids.length||sub.criteria.some(k=>!ids.includes(k.id)))errors.push(`${e.plan_id}/${c.id} verdict coverage`);
  const result=applyQuestionSetJudgment(q,{[sub.id]:c.answer},{subquestions:[{subquestion_id:sub.id,verdicts:c.expected_verdicts.map(v=>({...v,...(v.verdict!=='not_met'?{quote:c.answer}:{})}))}]});
  if(result.score!==c.expected_points)errors.push(`${e.plan_id}/${c.id} local sum ${result.score} vs ${c.expected_points}`);
  if(!c.answer.trim()&&c.expected_points!==0)errors.push(`${e.plan_id}/${c.id} nonzero blank`);
 }
 const newCount=q.subquestions.reduce((n,s)=>n+s.criteria.length,0);
 if(e.questions.reduce((n:number,s:{new_points:number})=>n+s.new_points,0)!==newCount)errors.push(`${e.plan_id} handoff point total`);
 records.push({plan_id:e.plan_id,set_id:q.id,changed:e.changed,question_file:e.question_file,question_sha256:hash(e.question_file),plan_sha256:hash(e.plan_file),qa_sha256:hash(e.qa_file),questions:q.subquestions.length,criteria:newCount,points:computeQuestionSetMaxPoints(q),qa_cases:qa.cases.length,shape_errors:parsed.errors,warnings:parsed.warnings});
}
const bank=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/comparison-bank.json') as QuestionSetV3[];
const memory=bank.map(q=>replacements.get(q.id)??q);const memoryResult=validateAuthoringBank(memory,root);
errors.push(...memoryResult.errors.map(e=>'memory bank: '+e));
const report={created_at:new Date().toISOString(),scope:'Local schema/source/lineage/expected-verdict summation only; no model semantic judgment',api_calls:0,sets:h.entries.length,questions:h.entries.reduce((n:number,e:{questions:unknown[]})=>n+e.questions.length,0),criteria:totalCriteria,points:totalCriteria,qa_cases:cases,records,memory_bank_sets:memory.length,memory_bank_errors:memoryResult.errors,errors};
fs.writeFileSync(path.join(validationDir,'results.json'),JSON.stringify(report,null,2)+'\n');
h.validation={api_calls:0,checks:[{kind:'source_quote_schema_and_16_cli_checks',evidence:`${dir}/local-validation/results.json`,errors:errors.length},{kind:'original_answers_and_facts_sources_preserved',errors:errors.length},{kind:'expected_verdict_integer_sum',cases,model_called:false},{kind:'memory_authoring_bank',sets:memory.length,errors:memoryResult.errors.length}],model_revalidation:'not_run_user_paused'};
fs.writeFileSync(path.join(root,dir,'handoff.json'),JSON.stringify(h,null,2)+'\n');
console.log(JSON.stringify({sets:h.entries.length,criteria:totalCriteria,qa_cases:cases,errors},null,2));if(errors.length)process.exitCode=1;
