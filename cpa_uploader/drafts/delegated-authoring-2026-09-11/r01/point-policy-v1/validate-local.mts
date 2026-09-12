import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {validateQuestionSetV3,computeQuestionSetMaxPoints,scoreCriterionVerdicts} from '../../../../../lib/questionV3.ts';
import {draftConflicts} from '../../../../questionDraftInventory.ts';
import {readQuestionAuthoringPlans} from '../../../../questionAuthoringPlan.ts';
const root=process.cwd();
const dir='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/point-policy-v1/';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(f:string)=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const handoff=read(dir+'handoff.in-progress.json');
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/manifest-plan-followup-02.json';
const manifest=read(manifestFile);
const errors:string[]=[];const warnings:any[]=[];const results:any[]=[];let qaTotal=0;
for(const h of handoff.entries){
 const e=manifest.entries.find((e:any)=>e.plan_id===h.plan_id),s=read(h.question_file),old=read(e.file),qa=read(h.qa_file),r=validateQuestionSetV3(s,{verifySourceQuotes:true,cwd:root});
 errors.push(...r.errors.map((x:string)=>h.plan_id+': '+x));warnings.push(...r.warnings.map((x:string)=>({plan_id:h.plan_id,message:x})));
 try{readQuestionAuthoringPlans(h.plan_file,true);}catch(error){errors.push(h.plan_id+' plan: '+String(error));}
 if(JSON.stringify(s.source_refs)!==JSON.stringify(old.source_refs))errors.push(h.plan_id+' source_refs changed');
 if(JSON.stringify(s.shared_context)!==JSON.stringify(old.shared_context))errors.push(h.plan_id+' shared_context changed');
 if(s.id!==old.id||JSON.stringify(s.subquestions.map((q:any)=>q.id))!==JSON.stringify(old.subquestions.map((q:any)=>q.id)))errors.push(h.plan_id+' set/question IDs changed');
 const ids=new Set<string>();const fullModels:any[]=[];
 for(const c of qa.cases){
  if(ids.has(c.id))errors.push(h.plan_id+' duplicate QA id '+c.id);ids.add(c.id);
  const q=s.subquestions.find((q:any)=>q.id===c.subquestion_id);if(!q){errors.push(h.plan_id+' missing question '+c.id);continue;}
  if(c.expected_verdicts.length!==q.criteria.length||new Set(c.expected_verdicts.map((v:any)=>v.criterion_id)).size!==q.criteria.length)errors.push(h.plan_id+' QA verdict shape '+c.id);
  if(c.expected_verdicts.some((v:any)=>!q.criteria.some((cr:any)=>cr.id===v.criterion_id)||!['met','not_met','contradicted'].includes(v.verdict)))errors.push(h.plan_id+' QA invalid verdict '+c.id);
  const score=scoreCriterionVerdicts(q,c.expected_verdicts);
  if(score.score!==c.expected_points)errors.push(h.plan_id+' QA local sum mismatch '+c.id+': '+score.score+' != '+c.expected_points);
  if(c.answer===''&&c.expected_points!==0)errors.push(h.plan_id+' nonzero blank '+c.id);
  if(/(?:^|\/)(?:model|model-answer|stored-model-answer)$/.test(c.id)){fullModels.push({case_id:c.id,score:score.score,max_points:score.max_points});if(score.score!==score.max_points)errors.push(h.plan_id+' model answer not full '+c.id);}
 }
 if(h.changed){
  const lineage=read(h.lineage_file),original=read(lineage.original.qa.file);
  for(const c of original.cases){const n=qa.cases.find((n:any)=>n.id===c.id);if(!n||n.answer!==c.answer||n.subquestion_id!==c.subquestion_id)errors.push(h.plan_id+' original QA changed '+c.id);}
  if(sha(lineage.original.question.file)!==lineage.original.question.sha256||sha(lineage.original.plan.file)!==lineage.original.plan.sha256||sha(lineage.original.qa.file)!==lineage.original.qa.sha256)errors.push(h.plan_id+' predecessor hash changed');
  for(const q of h.questions.filter((q:any)=>q.decision!=='retain')){
   const targets=new Set(q.criterion_mapping.filter((m:any)=>m.new_ids.length>1).flatMap((m:any)=>m.new_ids));
   // T09-C second condition was refined jointly with the OR split and needs the same coverage.
   if(h.plan_id==='T09-C'&&q.id==='sub2')targets.add('sub2.crit2');
   if(h.plan_id==='T09-B'&&q.id==='q1')targets.add('q1.c2');
   for(const target of targets)for(const kind of ['full','paraphrase','omission','opposite','condition_boundary'])if(!qa.cases.some((c:any)=>c.subquestion_id===q.id&&c.target_criterion_id===target&&c.kind===kind))errors.push(h.plan_id+' new criterion QA gap '+String(target)+'/'+kind);
  }
 }
 qaTotal+=qa.cases.length;results.push({plan_id:h.plan_id,set_id:s.id,changed:h.changed,questions:s.subquestions.length,criteria:s.subquestions.reduce((n:number,q:any)=>n+q.criteria.length,0),points:computeQuestionSetMaxPoints(s),qa_cases:qa.cases.length,stored_model_answers:fullModels,question_sha256:sha(h.question_file),plan_sha256:sha(h.plan_file),qa_sha256:sha(h.qa_file),lineage_sha256:h.lineage_file?sha(h.lineage_file):null});
}
const bankFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/comparison-bank.json';
const beforeBank=read(bankFile),byId=new Map(handoff.entries.map((e:any)=>[e.set_id,read(e.question_file)]));
const memoryBank=beforeBank.map((s:any)=>byId.get(s.id)??s);
const originalConflicts=draftConflicts(beforeBank,[]),afterConflicts=draftConflicts(memoryBank,[]);
const addedConflicts=afterConflicts.filter(x=>!originalConflicts.includes(x));errors.push(...addedConflicts.map(x=>'memory bank: '+x));
const report={api_calls:0,method:'local source/schema/plan/ID/QA-preservation checks and deterministic sum of author-supplied judgments; no semantic model call',manifest:{file:manifestFile,sha256:sha(manifestFile)},sets:results.length,questions:results.reduce((n,e)=>n+e.questions,0),points:results.reduce((n,e)=>n+e.points,0),criteria:results.reduce((n,e)=>n+e.criteria,0),qa_cases:qaTotal,changed_sets:results.filter(e=>e.changed).length,added_memory_bank_conflicts:addedConflicts,memory_bank_sets:memoryBank.length,existing_memory_bank_conflicts:originalConflicts,errors,warnings,results,model_revalidation:'not_run_user_paused'};
fs.writeFileSync(dir+'local-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sets:report.sets,questions:report.questions,points:report.points,qa_cases:qaTotal,errors,warnings:warnings.length,memory_bank_sets:memoryBank.length,added_memory_bank_conflicts:addedConflicts}));
if(errors.length)process.exitCode=1;
