import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const D='cpa_uploader/drafts/case-deepening-2026-09-14',O=`${D}/a`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sets=read(`${O}/sets.json`),design=read(`${O}/design.json`),qa=read(`${O}/qa.json`),review=read(`${O}/review.json`),bank=read(`${D}/bank-before.json`),catalog=read(`${D}/source-catalog-final.json`);
const rows=[];
for(const set of sets){
 const d=design.find(x=>x.set_id===set.id),errors=validateQuestionAuthoringPlan(d.plan);
 for(const id of d.plan.source_unit_ids)if(!catalog.units.some(u=>u.id===id))errors.push(`missing source unit ${id}`);
 for(const ref of set.source_refs){
  if(!fs.readFileSync(ref.file,'utf8').includes(ref.source_quote))errors.push(`nonexact quote ${ref.id}`);
  if(sha(ref.source_quote)!==ref.content_hash)errors.push(`quote hash ${ref.id}`);
 }
 for(const q of set.subquestions){
  const max=q.criteria.reduce((n,c)=>n+c.max_points,0);
  const rr=review.filter(r=>r.set_id===set.id&&r.subquestion_id===q.id);
  if(rr.length!==1||Object.keys(rr[0].checks).length!==8||Object.keys(rr[0].check_rationales).length!==8||rr[0].unresolved.length)errors.push(`review coverage ${q.id}`);
  for(const kind of (max===1?['wrong']:['partial','wrong'])){
   const r=qa.filter(x=>x.set_id===set.id&&x.subquestion_id===q.id&&x.kind===kind);
   if(r.length!==1)errors.push(`${q.id}/${kind} count`);
   else if(r[0].expected_points!==r[0].met_criterion_ids.length||r[0].met_criterion_ids.some(id=>!q.criteria.some(c=>c.id===id))||(kind==='partial'?!(0<r[0].expected_points&&r[0].expected_points<max):r[0].expected_points!==0))errors.push(`${q.id}/${kind} role`);
  }
  if(max===1 && qa.some(x=>x.set_id===set.id&&x.subquestion_id===q.id&&x.kind==='partial'))errors.push('single-point false partial');
  if(q.question_style!=='case'||!q.topic_ids?.length)errors.push(`classification ${q.id}`);
 }
 const factsChars=Array.from(set.shared_context.facts.map(f=>f.text).join('\n')).length;
 if(factsChars<400)errors.push('facts shorter than 400 Unicode');
 rows.push({set_id:set.id,facts_chars:factsChars,subquestions:set.subquestions.length,points:set.subquestions.flatMap(q=>q.criteria).length,plan_source_qa_errors:errors});
}
const check=validateAuthoringBank([...bank,...sets]);
const bankCheck={errors:check.errors,setCount:check.sets.length,subquestionCount:check.subquestionCount,criterionCount:check.criterionCount,totalPoints:check.totalPoints};
const hashes=Object.fromEntries(['sets','design','review','qa','coverage-proposals','source-files'].map(x=>[x,sha(fs.readFileSync(`${O}/${x}.json`))]));
const result={checked_at:new Date().toISOString(),method:'Draft static shape, exact citation bytes and hashes, plan/catalog linkage, representative QA roles, and frozen bank plus three drafts in memory. No model calls or canonical mutation.',rows,bank_check:bankCheck,hashes};
fs.writeFileSync(`${O}/validation.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(rows.some(r=>r.plan_source_qa_errors.length)||bankCheck.errors.length)process.exitCode=1;
