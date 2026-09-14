import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
const d='cpa_uploader/drafts/case-expansion-2026-09-13/a';
const read=f=>JSON.parse(fs.readFileSync(`${d}/${f}`, 'utf8'));
const sets=read('sets.json'),plans=read('design.json'),qa=read('qa.json');
const before=JSON.parse(fs.readFileSync('cpa_uploader/drafts/case-expansion-2026-09-13/bank-before.json','utf8'));
const result=validateAuthoringBank([...before.filter(s=>!sets.some(n=>n.id===s.id)),...sets]);
const errors=[...(result.errors||[])];
for(const p of plans)errors.push(...validateQuestionAuthoringPlan(p).map(e=>`${p.set_id}: ${e}`));
for(const s of sets){
 const units=s.shared_context.facts.map(f=>f.text).join('\n').length;
 if(units<400||s.subquestions.length<2||s.subquestions.length>4)errors.push(`${s.id}: length/count`);
 for(const q of s.subquestions){
  if(q.question_style!=='case')errors.push(`${s.id}/${q.id}: style`);
  const examples=qa.filter(a=>a.set_id===s.id&&a.subquestion_id===q.id);
  if(examples.length!==2)errors.push(`${s.id}/${q.id}: representative QA missing`);
  for(const a of examples){
   if(a.met_criterion_ids.some(id=>!q.criteria.some(c=>c.id===id)))errors.push(`${s.id}/${q.id}: unknown QA criterion`);
   if(q.criteria.filter(c=>a.met_criterion_ids.includes(c.id)).reduce((n,c)=>n+c.max_points,0)!==a.expected_points)errors.push(`${s.id}/${q.id}: expected score sum`);
  }
 }
}
const record={executed_at:new Date().toISOString(),checks:['validateAuthoringBank on in-memory replacement bank','version1 authoring plan','2-4 case questions and 400+ fact characters','QA ID and integer score consistency'],sets_sha256:createHash('sha256').update(fs.readFileSync(`${d}/sets.json`)).digest('hex'),set_count:sets.length,question_count:sets.flatMap(s=>s.subquestions).length,qa_count:qa.length,model_grading:'not_run',errors,warnings:result.warnings||[]};
fs.writeFileSync(`${d}/validation.json`,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
if(errors.length)process.exitCode=1;
