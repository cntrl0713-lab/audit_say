import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateQuestionSetV3 } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../../../lib/questionV3.ts';
import { applyQuestionSetJudgment } from '../../../../../lib/questionV3Grading.ts';
import { validateAuthoringBank } from '../../../../../cpa_uploader/questionBankPublication.ts';

const out = path.resolve('cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/a');
const load = (p:string) => JSON.parse(fs.readFileSync(p,'utf8'));
const hash = (p:string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sets:QuestionSetV3[] = load(path.join(out,'sets.json'));
const old:QuestionSetV3[] = load(path.join(out,'../canonical-before.json'));
const qa = load(path.join(out,'qa.json')) as { cases:Array<{id:string;set_id:string;subquestion_id:string;answer:string;expected_points:number;expected_verdicts:Array<{criterion_id:string;verdict:'met'|'not_met'|'contradicted';reason:string}>}> };
const audit = load(path.join(out,'audit.json')) as { entries:Array<{set_id:string;subquestion_id:string;changed:boolean;before_points:number;after_points:number}> };
const errors:string[]=[];
const warnings:string[]=[];
const actualIds = new Set(sets.map(s=>s.id));
const owned = old.filter(s=>Number(s.classification.topic_id)>=1&&Number(s.classification.topic_id)<=6);
if (JSON.stringify(owned.map(s=>s.id))!==JSON.stringify(sets.map(s=>s.id)))errors.push('owner set coverage/order mismatch');
for (const s of sets) {
 const r = validateQuestionSetV3(s,{verifySourceQuotes:true,cwd:process.cwd()});
 errors.push(...r.errors.map(e=>`${s.id}: ${e}`));warnings.push(...r.warnings.map(e=>`${s.id}: ${e}`));
 const before=old.find(o=>o.id===s.id)!;
 if(JSON.stringify(s.source_refs.slice(0,before.source_refs.length))!==JSON.stringify(before.source_refs))errors.push(`${s.id}: original source refs changed`);
 if(JSON.stringify(s.shared_context)!==JSON.stringify(before.shared_context))errors.push(`${s.id}: original facts changed`);
 if(JSON.stringify(s.learning_order)!==JSON.stringify(before.learning_order))errors.push(`${s.id}: order changed`);
 for(const q of s.subquestions){
  const a=audit.entries.find(e=>e.set_id===s.id&&e.subquestion_id===q.id);
  if(!a){errors.push(`${s.id}/${q.id}: missing audit`);continue;}
  const oq=before.subquestions.find(x=>x.id===q.id)!;
  if(!a.changed&&JSON.stringify(oq)!==JSON.stringify(q))errors.push(`${s.id}/${q.id}: unaudited change`);
  if(a.before_points!==oq.criteria.reduce((n,c)=>n+c.max_points,0)||a.after_points!==q.criteria.reduce((n,c)=>n+c.max_points,0))errors.push(`${s.id}/${q.id}: audit score mismatch`);
 }
}
const combined=old.map(s=>actualIds.has(s.id)?sets.find(v=>v.id===s.id)!:s);
const bank=validateAuthoringBank(combined);
errors.push(...bank.errors);
const qaIds = new Set<string>();
for (const c of qa.cases){
 if(qaIds.has(c.id))errors.push(`${c.id}: duplicate QA ID`);qaIds.add(c.id);
 const s=sets.find(x=>x.id===c.set_id);const q=s?.subquestions.find(x=>x.id===c.subquestion_id);
 if(!s||!q){errors.push(`${c.id}: target not found`);continue;}
 if(new Set(c.expected_verdicts.map(v=>v.criterion_id)).size!==q.criteria.length||c.expected_verdicts.some(v=>!q.criteria.some(a=>a.id===v.criterion_id)))errors.push(`${c.id}: criterion coverage mismatch`);
 const verdicts:CriterionVerdictV3[]=c.expected_verdicts.map(v=>({...v,quote:v.verdict==='not_met'?'':c.answer}));
 const actual=applyQuestionSetJudgment(s,{[q.id]:c.answer},{subquestions:[{subquestion_id:q.id,verdicts}]}).subquestions.find(x=>x.subquestion_id===q.id)!;
 if(actual.score!==c.expected_points)errors.push(`${c.id}: expected ${c.expected_points}, local ${actual.score}`);
 if(c.expected_verdicts.filter(v=>v.verdict==='met').length!==c.expected_points)errors.push(`${c.id}: integer sum mismatch`);
}
for(const a of audit.entries.filter(e=>e.changed)){
 const cases=qa.cases.filter(c=>c.set_id===a.set_id&&c.subquestion_id===a.subquestion_id);
 if(!cases.length||!cases.some(c=>c.answer===''))errors.push(`${a.set_id}/${a.subquestion_id}: missing QA/empty`);
 const q=sets.find(s=>s.id===a.set_id)!.subquestions.find(q=>q.id===a.subquestion_id)!;
 for(const criterion of q.criteria){
  for(const verdict of ['met','not_met','contradicted'])if(!cases.some(c=>c.expected_verdicts.some(v=>v.criterion_id===criterion.id&&v.verdict===verdict)))errors.push(`${a.set_id}/${a.subquestion_id}/${criterion.id}: no ${verdict} expectation`);
 }
}
const report={checked_at:new Date().toISOString(),sets:sets.length,questions:audit.entries.length,changed_questions:audit.entries.filter(e=>e.changed).length,points_before:audit.entries.reduce((n,e)=>n+e.before_points,0),points_after:audit.entries.reduce((n,e)=>n+e.after_points,0),qa_cases:qa.cases.length,model_api_calls:0,execution:'author_expected_verdicts_replayed_through_applyQuestionSetJudgment; no model semantics measured',memory_bank:{sets:bank.sets.length,questions:bank.subquestionCount,criteria:bank.criterionCount,points:bank.totalPoints,errors:bank.errors},errors,warnings,files:['sets.json','audit.json','qa.json','source-evidence.txt'].map(file=>({file,sha256:hash(path.join(out,file))})),canonical_sha256:hash('cpa_uploader/data/cpa_question_sets_v3.authoring.json')};
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sets:report.sets,questions:report.questions,points_before:report.points_before,points_after:report.points_after,qa_cases:report.qa_cases,errors,warnings},null,2));
if(errors.length)process.exitCode=1;
