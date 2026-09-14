import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
import {validateQuestionSetV3} from '../../../../lib/questionV3.ts';
const D='cpa_uploader/drafts/case-additional-2026-09-14', A=`${D}/a`;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
for(const name of ['sets','design','review','qa']){
  const merged=[...read(`${A}/local/${name}.json`),...read(`${A}/materiality/${name}.json`)];
  merged.sort((a,b)=>(a.set_id??a.id).localeCompare(b.set_id??b.id));
  write(`${A}/${name}.json`,merged);
}
const sets=read(`${A}/sets.json`),design=read(`${A}/design.json`),qa=read(`${A}/qa.json`),review=read(`${A}/review.json`);
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),catalog=read(`${D}/source-catalog.json`);
const combined=validateAuthoringBank([...bank,...sets]);
const errors=[...combined.errors],warnings=[...(combined.warnings??[])];
const normalized2026=fs.readFileSync('cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt','utf8').replace(/\s/g,'');
for(const s of sets){
  const shape=validateQuestionSetV3(s,{verifySourceQuotes:true,cwd:process.cwd()});
  errors.push(...shape.errors.map(e=>`${s.id}: ${e}`));warnings.push(...shape.warnings.map(e=>`${s.id}: ${e}`));
  const d=design.find(d=>d.set_id===s.id);assert(d);
  errors.push(...validateQuestionAuthoringPlan(d.plan).map(e=>`${s.id}: ${e}`));
  for(const id of d.plan.source_unit_ids)if(!catalog.units.some(u=>u.id===id))errors.push(`${s.id}: unknown source unit ${id}`);
  if(Array.from(s.shared_context.facts.map(f=>f.text).join('\n')).length<400||s.subquestions.length!==3)errors.push(`${s.id}: facts/count`);
  for(const r of s.source_refs){
    if(!normalized2026.includes(r.source_quote.replace(/\s/g,'')))errors.push(`${s.id}: 2026 body mismatch ${r.id}`);
    if(!catalog.units.some(u=>u.id===r.id&&u.file===r.file))errors.push(`${s.id}: ref/catalog identity ${r.id}`);
  }
  for(const q of s.subquestions){
    if(q.question_style!=='case'||!q.topic_ids.length)errors.push(`${s.id}/${q.id}: style/topic`);
    const reviews=review.filter(r=>r.set_id===s.id&&r.subquestion_id===q.id);
    if(reviews.length!==1||reviews[0].unresolved_content_findings.length)errors.push(`${s.id}/${q.id}: review coverage`);
    const examples=qa.filter(a=>a.set_id===s.id&&a.subquestion_id===q.id);
    if(examples.length!==2||new Set(examples.map(a=>a.kind)).size!==2)errors.push(`${s.id}/${q.id}: representative roles`);
    for(const a of examples){
      const all=new Set(q.criteria.map(c=>c.id));
      if(a.met_criterion_ids.some(id=>!all.has(id))||new Set(a.met_criterion_ids).size!==a.met_criterion_ids.length)errors.push(`${s.id}/${q.id}: QA ids`);
      const sum=q.criteria.filter(c=>a.met_criterion_ids.includes(c.id)).reduce((n,c)=>n+c.max_points,0);
      const total=q.criteria.reduce((n,c)=>n+c.max_points,0);
      if(sum!==a.expected_points||!Number.isSafeInteger(sum))errors.push(`${s.id}/${q.id}: QA score`);
      if(a.kind==='wrong'&&sum!==0||a.kind==='partial'&&(sum<=0||sum>=total))errors.push(`${s.id}/${q.id}: QA role`);
    }
  }
}
write(`${A}/integration-review.json`,{reviewer_id:'agent:/root/expand_a',method:'manual_content_comparison',
  independently_reviewed:'case-04-materiality-reset-20260914',
  finding:'04의 사실·3발문·모범·9criterion·QA6답안 및 KGA320 12/13/14/A14 직접 원문을 대조하였다. 중요성을 같은 비율로 자동 인하하거나 모든 절차를 반복하도록 하지 않고 기존 방법·시기·범위의 적합성을 재평가하도록 요구한다. 수정금액의 계산 없이 문서화 이력과 고려요소를 구별한다. 구체적 결함을 발견하지 못했다.',
  unresolved_content_findings:[],model_grading_performed:false,human_review_performed:false});
const result={executed_at:new Date().toISOString(),checks:['current bank plus new sets in memory','actual source quotes','all current catalog unit identities','2026 official body equality after whitespace normalization','3 case questions and 400+ Unicode fact characters','formal version1 plan','flat review coverage','partial/wrong QA coverage and integer scores'],
  set_count:sets.length,question_count:sets.flatMap(s=>s.subquestions).length,qa_count:qa.length,
  sets:sets.map(s=>({id:s.id,facts_chars:Array.from(s.shared_context.facts.map(f=>f.text).join('\n')).length,points:s.subquestions.flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0)})),
  hashes:Object.fromEntries(['sets','design','review','qa'].map(name=>[`${name}.json`,hash(`${A}/${name}.json`)])),errors,warnings,actual_model_grading:'not_run'};
write(`${A}/validation.json`,result);console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
