import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const dir='cpa_uploader/drafts/case-trio-2026-09-14/b';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=v=>createHash('sha256').update(v).digest('hex');
const files=['sets.json','design.json','review.json','qa.json','coverage-proposals.json','source-files.json'];
const [sets,design,review,qa,coverage]=files.map(f=>read(`${dir}/${f}`));
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=read(bankFile);
const catalog=read('cpa_uploader/drafts/case-trio-2026-09-14/source-catalog.json');
const units=new Map(catalog.units.map(u=>[u.id,u]));
const dataset=read('cpa_uploader/analysis/question-elements/question-elements.json');
const errors=[];
const result=validateAuthoringBank([...bank,...sets]);
errors.push(...result.errors);
for(const s of sets){
  const d=design.find(x=>x.set_id===s.id);
  errors.push(...validateQuestionAuthoringPlan(d.plan,true).map(e=>`${s.id}: ${e}`));
  if(d.reviewed_content_hash!==hash(JSON.stringify(s)))errors.push(`${s.id}: design content hash mismatch`);
  if([...s.shared_context.facts.map(f=>f.text).join('\n')].length<400)errors.push(`${s.id}: facts shorter than 400`);
  if(s.subquestions.length!==3)errors.push(`${s.id}: not three questions`);
  for(const id of d.plan.source_unit_ids)if(!units.has(id))errors.push(`${s.id}: missing source ${id}`);
  for(const q of s.subquestions){
    const rv=review.filter(r=>r.set_id===s.id&&r.subquestion_id===q.id);
    const variants=qa.filter(r=>r.set_id===s.id&&r.subquestion_id===q.id);
    if(rv.length!==1)errors.push(`${s.id}/${q.id}: missing review row`);
    if(variants.length!==2||!variants.some(x=>x.kind==='partial')||!variants.some(x=>x.kind==='wrong'))errors.push(`${s.id}/${q.id}: missing QA variant`);
    for(const [name,verdict]of Object.entries(rv[0]?.checks??{}))if(verdict!=='pass')errors.push(`${s.id}/${q.id}: ${name} not pass`);
    if(q.question_style!=='case'||q.topic_ids.length<1)errors.push(`${s.id}/${q.id}: missing case metadata`);
    for(const v of variants){
      if(v.kind==='partial'&&(v.expected_points<=0||v.expected_points>=q.criteria.reduce((n,c)=>n+c.max_points,0)))errors.push(`${s.id}/${q.id}: partial role invalid`);
      if(v.kind==='wrong'&&v.expected_points!==0)errors.push(`${s.id}/${q.id}: wrong representative not zero`);
      const criteria=q.criteria.filter(c=>v.met_criterion_ids.includes(c.id));
      if(criteria.length!==v.met_criterion_ids.length)errors.push(`${s.id}/${q.id}: invalid criterion in QA`);
      if(criteria.reduce((sum,c)=>sum+c.max_points,0)!==v.expected_points)errors.push(`${s.id}/${q.id}: QA sum mismatch`);
    }
  }
}
for(const c of coverage){
  const e=dataset.elements.find(e=>e.id===c.element_id);
  const s=sets.find(s=>s.id===c.set_id),q=s?.subquestions.find(q=>q.id===c.subquestion_id);
  if(!e||!q)errors.push(`coverage: missing element/target ${c.element_id}`);
  for(const id of c.criterion_ids)if(!q?.criteria.some(x=>x.id===id))errors.push(`coverage: missing criterion ${id}`);
  for(const id of c.source_unit_ids)if(!units.has(id))errors.push(`coverage: missing source ${id}`);
}
const output={timestamp:new Date().toISOString(),method:'local_shape_quote_identity_plan_and_expectation_checks',actual_model_grading:'not_run',human_review_performed:false,bank_file:bankFile,bank_sha256:hash(fs.readFileSync(bankFile)),bank_sets:bank.length,merged_sets:bank.length+sets.length,merged_subquestions:result.subquestionCount,errors,draft_validation_command:'node --import tsx cpa_uploader/validate_draft_v3.ts --file cpa_uploader/drafts/case-trio-2026-09-14/b/sets.json --against-bank',draft_validation_exit_code:null,files:Object.fromEntries(files.map(f=>[`${dir}/${f}`,hash(fs.readFileSync(`${dir}/${f}`))])),sets:sets.map(s=>({id:s.id,fact_characters:[...s.shared_context.facts.map(f=>f.text).join('\n')].length,questions:s.subquestions.length,points:s.subquestions.reduce((sum,q)=>sum+q.criteria.reduce((v,c)=>v+c.max_points,0),0)})),review_rows:review.length,qa_rows:qa.length,coverage_rows:coverage.length};
fs.writeFileSync(`${dir}/validation.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
if(errors.length)process.exitCode=1;
