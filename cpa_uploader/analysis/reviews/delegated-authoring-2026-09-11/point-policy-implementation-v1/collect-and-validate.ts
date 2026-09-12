import fs from 'node:fs';
import {computeQuestionSetMaxPoints,validateQuestionSetV3} from '../../../../../lib/questionV3.ts';
import type {QuestionSetV3} from '../../../../../lib/questionV3.ts';
import {validateAuthoringBank} from '../../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../../questionAuthoringPlan.ts';
import {jsonHash,sha256} from '../../../../questionReviewIdentity.ts';

type Identity={file:string;sha256:string};
type Mapping={old_id:string;new_ids:string[];reason:string};
type AuditQuestion={id:string;old_points:number;new_points:number;decision:string;rationale:string;source_ref_ids:string[];criterion_mapping:Mapping[]};
type HandoffEntry={plan_id:string;set_id:string;changed:boolean;question_file:string;plan_file:string;qa_file:string;lineage_file:string|null;questions:AuditQuestion[]};
type Entry={plan_id:string;package:string;set_id:string;topic_id:string;file:string;sha256:string;qa_file:string;qa_sha256:string;qa_cases:number;plan_files:Identity[];source_files:Identity[];output_directory:string;question_ids:string[];actual_questions:number;criteria:number;points:number;[key:string]:unknown};
type QaCase={id:string;subquestion_id:string;kind:string;answer:string;expected_points:number;target_criterion_id?:string;note?:string;expected_verdicts:Array<{criterion_id:string;verdict:'met'|'partial'|'not_met'|'contradicted';reason?:string}>};
type Qa={version:number;artifact_type:string;set_id:string;cases:QaCase[]};
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const work=`${control}/point-policy-implementation-v1`;
const read=<T>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const hash=(file:string)=>sha256(fs.readFileSync(file));
const baseline=read<{manifest_file:string;qa_overlay_file:string;files:Identity[]}>(`${work}/baseline.json`);
const previous=read<{entries:Entry[];bank_file:string;bank_sha256:string}>(baseline.manifest_file);
const overlay=read<{overrides:Array<{plan_id:string;identity:Identity}>}>(baseline.qa_overlay_file);
const [label,mode='check']=process.argv.slice(2);
if(!label||!/^[a-z0-9-]+$/.test(label)||!['check','collect'].includes(mode))throw Error('label [check|collect] required');
const output=`${control}/${label}`;
if(mode==='collect'&&fs.existsSync(output))throw Error('Refuse overwrite');
const packages:Record<string,string[]>={n01:['N01','N06','S01','S05','S06'],r01:['R01','N04','N05','S03'],r02:['R02','N02','N03','S02','S04']};
const handoffs=Object.entries(packages).map(([owner,owned])=>({owner,owned,file:`cpa_uploader/drafts/delegated-authoring-2026-09-11/${owner}/point-policy-v1/handoff.json`}));
const missing=handoffs.filter(item=>!fs.existsSync(item.file));
if(missing.length)throw Error(`Handoffs not ready: ${missing.map(item=>item.owner).join(', ')}`);
const errors:string[]=[],warnings:string[]=[];
const assert=(condition:unknown,message:string)=>{if(!condition)errors.push(message);};
for(const item of baseline.files)assert(fs.existsSync(item.file)&&hash(item.file)===item.sha256,`Preserved bytes changed: ${item.file}`);
const selected=new Map<string,HandoffEntry>();
for(const handoff of handoffs){
 const data=read<{api_calls:number;entries:HandoffEntry[]}>(handoff.file);
 assert(data.api_calls===0,`${handoff.owner}: API must remain paused`);
 for(const row of data.entries){
  const entry=previous.entries.find(entry=>entry.plan_id===row.plan_id);
  assert(entry&&handoff.owned.includes(entry.package),`${handoff.owner}: ownership ${row.plan_id}`);
  assert(!selected.has(row.plan_id),`Duplicate handoff ${row.plan_id}`);selected.set(row.plan_id,row);
 }
}
assert(selected.size===49,'49 handoff entries required');
const loadSet=(file:string)=>{const raw=read<QuestionSetV3|QuestionSetV3[]>(file);if(Array.isArray(raw)&&raw.length!==1)throw Error(`Single set expected: ${file}`);return Array.isArray(raw)?raw[0]:raw;};
const points=(sub:QuestionSetV3['subquestions'][number])=>sub.criteria.reduce((n,c)=>n+c.max_points,0);
const sets:QuestionSetV3[]=[],audits:Array<Record<string,unknown>>=[];
const coverage:Array<Record<string,unknown>>=[];
const entries:Entry[]=[];
let preservedAnswers=0,addedCases=0,changedQuestions=0;
for(const old of previous.entries){
 const row=selected.get(old.plan_id);if(!row){errors.push(`Missing ${old.plan_id}`);continue;}
 const oldQaIdentity=overlay.overrides.find(item=>item.plan_id===old.plan_id)?.identity||{file:old.qa_file,sha256:old.qa_sha256};
 if(![row.question_file,row.plan_file,row.qa_file].every(file=>typeof file==='string'&&fs.existsSync(file))){errors.push(`Missing selected file ${old.plan_id}`);continue;}
 const oldSet=loadSet(old.file),set=loadSet(row.question_file),qa=read<Qa>(row.qa_file),oldQa=read<Qa>(oldQaIdentity.file);
 const changed=hash(row.question_file)!==old.sha256;
 assert(row.changed===changed,`${old.plan_id}: changed flag`);
 assert(set.id===old.set_id&&row.set_id===old.set_id,`${old.plan_id}: set ID`);
 assert(jsonHash(set.subquestions.map(sub=>sub.id))===jsonHash(oldSet.subquestions.map(sub=>sub.id)),`${old.plan_id}: subquestion IDs changed`);
 assert(jsonHash(set.shared_context)===jsonHash(oldSet.shared_context),`${old.plan_id}: shared facts changed outside point policy`);
 assert(jsonHash(set.source_refs)===jsonHash(oldSet.source_refs),`${old.plan_id}: direct sources changed`);
 assert(set.status==='needs_review'&&set.verification.review_status==='needs_human_review',`${old.plan_id}: premature review promotion`);
 if(changed){
  assert(row.question_file.replaceAll('\\','/').startsWith(old.output_directory.replaceAll('\\','/')+'point-policy-v1/'),`${old.plan_id}: question ownership`);
  assert(row.lineage_file&&fs.existsSync(row.lineage_file),`${old.plan_id}: missing lineage`);
 }
 const validation=validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()});
 errors.push(...validation.errors.map(error=>`${old.plan_id}: ${error}`));warnings.push(...validation.warnings.map(w=>`${old.plan_id}: ${w}`));
 const planRaw=read<{plans?:Array<{set_id:string;topic_id:string}>}>(row.plan_file);
 const plan=planRaw.plans?.find(item=>item.set_id===set.id)||planRaw;
 errors.push(...validateQuestionAuthoringPlan(plan).map(error=>`${old.plan_id} plan: ${error}`));
 assert((plan as {set_id?:string}).set_id===set.id,`${old.plan_id}: plan set ID`);
 assert(row.questions.length===set.subquestions.length&&new Set(row.questions.map(q=>q.id)).size===set.subquestions.length,`${old.plan_id}: complete per-question rationale`);
 assert(qa.version===1&&qa.artifact_type==='author_expected_judgments'&&qa.set_id===set.id,`${old.plan_id}: QA envelope`);
 assert(new Set(qa.cases.map(c=>c.id)).size===qa.cases.length,`${old.plan_id}: QA IDs`);
 const newQaMap=new Map(qa.cases.map(c=>[c.id,c]));
 for(const sample of oldQa.cases){
  const next=newQaMap.get(sample.id);
  assert(next&&next.answer===sample.answer&&next.subquestion_id===sample.subquestion_id,`${old.plan_id}/${sample.id}: original answer not preserved`);
  if(next&&next.answer===sample.answer&&next.subquestion_id===sample.subquestion_id)preservedAnswers++;
 }
 addedCases+=qa.cases.filter(c=>!oldQa.cases.some(old=>old.id===c.id)).length;
 for(const sub of set.subquestions){
  const oldSub=oldSet.subquestions.find(q=>q.id===sub.id)!,audit=row.questions.find(q=>q.id===sub.id);
  assert(audit,`${old.plan_id}/${sub.id}: missing audit`);if(!audit)continue;
  const subChanged=jsonHash(oldSub)!==jsonHash(sub);if(subChanged)changedQuestions++;
  assert(audit.old_points===points(oldSub)&&audit.new_points===points(sub),`${old.plan_id}/${sub.id}: point calculation`);
  assert(typeof audit.rationale==='string'&&audit.rationale.trim().length>=10,`${old.plan_id}/${sub.id}: specific rationale required`);
  assert(audit.source_ref_ids.length&&audit.source_ref_ids.every(id=>set.source_refs.some(source=>source.id===id)),`${old.plan_id}/${sub.id}: rationale source IDs`);
  assert(audit.criterion_mapping.length===oldSub.criteria.length&&new Set(audit.criterion_mapping.map(m=>m.old_id)).size===oldSub.criteria.length,`${old.plan_id}/${sub.id}: old criterion mapping incomplete`);
  const mapped=audit.criterion_mapping.flatMap(m=>m.new_ids);
  assert(new Set(mapped).size===mapped.length&&jsonHash([...mapped].sort())===jsonHash(sub.criteria.map(c=>c.id).sort()),`${old.plan_id}/${sub.id}: target criterion mapping incomplete/duplicate`);
  for(const c of oldSub.criteria){
   assert(sub.criteria.some(n=>n.id===c.id),`${old.plan_id}/${sub.id}/${c.id}: original ID removed`);
   assert(audit.criterion_mapping.some(m=>m.old_id===c.id&&m.new_ids.length&&m.reason.trim()),`${old.plan_id}/${sub.id}/${c.id}: mapping reason`);
  }
  const cases=qa.cases.filter(c=>c.subquestion_id===sub.id);
  assert(cases.some(c=>!c.answer.trim()&&c.expected_points===0),`${old.plan_id}/${sub.id}: empty QA`);
  const normalize=(text:string)=>text.replace(/\s+/g,'');
  assert(cases.some(c=>normalize(c.answer)===normalize(sub.model_answer.join('\n'))&&c.expected_points===points(sub)),`${old.plan_id}/${sub.id}: current model answer full-score QA`);
  for(const c of sub.criteria){
   assert(c.max_points===1&&c.scores.met===1&&c.scores.partial===undefined,`${old.plan_id}/${sub.id}/${c.id}: atomic integer policy`);
   const verdictCases=(verdict:string)=>cases.filter(sample=>sample.expected_verdicts.some(v=>v.criterion_id===c.id&&v.verdict===verdict));
   const hasMet=verdictCases('met').length>0,hasOmission=verdictCases('not_met').some(sample=>sample.answer.trim()),hasOpposite=verdictCases('contradicted').length>0;
   assert(hasMet&&hasOmission&&hasOpposite,`${old.plan_id}/${sub.id}/${c.id}: met/nonempty omission/opposite coverage`);
   const changedCriterion=jsonHash(oldSub.criteria.find(old=>old.id===c.id)||null)!==jsonHash(c);
   coverage.push({plan_id:old.plan_id,subquestion_id:sub.id,criterion_id:c.id,changed:changedCriterion,met:hasMet,nonempty_omission:hasOmission,opposite:hasOpposite,
    explicit_target_kinds:[...new Set(cases.filter(sample=>sample.target_criterion_id===c.id).map(sample=>sample.kind))]});
  }
  audits.push({plan_id:old.plan_id,set_id:set.id,topic_id:old.topic_id,package:old.package,question_file:row.question_file,changed:subChanged,prompt:sub.prompt,...audit,
   criteria:sub.criteria.map(c=>({id:c.id,claim:c.claim,points:c.max_points,source_ref_ids:c.source_ref_ids})),qa_cases:cases.length});
 }
 for(const sample of qa.cases){
  const sub=set.subquestions.find(sub=>sub.id===sample.subquestion_id);
  if(!sub){errors.push(`${old.plan_id}/${sample.id}: QA subquestion`);continue;}
  assert(sample.expected_verdicts.length===sub.criteria.length&&new Set(sample.expected_verdicts.map(v=>v.criterion_id)).size===sub.criteria.length,`${old.plan_id}/${sample.id}: QA verdict coverage`);
  let score=0;
  for(const v of sample.expected_verdicts){const criterion=sub.criteria.find(c=>c.id===v.criterion_id);assert(criterion&&['met','not_met','contradicted'].includes(v.verdict),`${old.plan_id}/${sample.id}: QA verdict`);if(criterion&&v.verdict==='met')score+=criterion.scores.met;}
  assert(score===sample.expected_points,`${old.plan_id}/${sample.id}: expected sum ${sample.expected_points} vs ${score}`);
 }
 sets.push(set);
 entries.push({...old,file:row.question_file,sha256:hash(row.question_file),plan_files:[{file:row.plan_file,sha256:hash(row.plan_file)}],qa_file:row.qa_file,qa_sha256:hash(row.qa_file),qa_cases:qa.cases.length,
  actual_questions:set.subquestions.length,criteria:set.subquestions.reduce((n,q)=>n+q.criteria.length,0),points:computeQuestionSetMaxPoints(set),stage:changed?'point_policy_applied_pending_model_revalidation':'point_policy_reviewed_retained',
  predecessor:{manifest:baseline.manifest_file,manifest_sha256:hash(baseline.manifest_file),file:old.file,sha256:old.sha256,qa_file:oldQaIdentity.file,qa_sha256:oldQaIdentity.sha256,plan_files:old.plan_files},
  followup:{kind:'approved_element_and_descriptive_credit',changed,lineage_file:row.lineage_file,question_audit:row.questions,api_calls:0,model_revalidation:'not_run_at_collection'}});
}
assert(audits.length===131,'131 per-question audits required');
assert(preservedAnswers===2389,'All 2389 prior QA answers must remain');
assert(hash(previous.bank_file)===previous.bank_sha256,'Canonical bank changed');
const bank=read<QuestionSetV3[]>(previous.bank_file);
const combined=[...bank.filter(set=>!sets.some(candidate=>candidate.id===set.id)),...sets].sort((a,b)=>a.id.localeCompare(b.id));
const bankValidation=validateAuthoringBank(combined);errors.push(...bankValidation.errors);
assert(combined.length===153,'153 comparison sets required');
const totals={sets:sets.length,questions:audits.length,points:entries.reduce((n,e)=>n+e.points,0),criteria:entries.reduce((n,e)=>n+e.criteria,0),changed_sets:entries.filter(e=>(e.followup as {changed:boolean}).changed).length,changed_questions:changedQuestions,
 reweighted_questions:audits.filter(q=>q.old_points!==q.new_points).length,
 preserved_qa_answers:preservedAnswers,added_qa_cases:addedCases,qa_cases:entries.reduce((n,e)=>n+e.qa_cases,0)};
const report={recorded_at:new Date().toISOString(),api_calls:0,mode,totals,errors,warnings,source_and_shape_validation:true,model_validation:'not_run_at_collection',
 baseline:{file:`${work}/baseline.json`,sha256:hash(`${work}/baseline.json`)},handoffs:handoffs.map(item=>({file:item.file,sha256:hash(item.file)})),audits,criterion_qa_coverage:coverage};
const reportFile=`${work}/${label}-validation.json`;
fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({reportFile,...totals,errors,warnings: warnings.length,api_calls:0}));
if(errors.length){process.exitCode=1;}else if(mode==='collect'){
 fs.mkdirSync(output);
 const write=(name:string,value:unknown)=>fs.writeFileSync(`${output}/${name}`,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 write('comparison-bank.json',combined);
 const manifest={created_at:new Date().toISOString(),purpose:'fixed_comparison_bank',bank_file:previous.bank_file,bank_sha256:previous.bank_sha256,
  predecessor:{file:baseline.manifest_file,sha256:hash(baseline.manifest_file)},planned_sets:49,planned_questions:131,collected_sets:totals.sets,collected_questions:totals.questions,collected_points:totals.points,
  comparison_sets:combined.length,comparison_bank_sha256:hash(`${output}/comparison-bank.json`),author_qa_cases:totals.qa_cases,errors:[],validation:bankValidation,
  point_policy:{approval:'User approved enumeration element points, descriptive partial credit and per-question appropriateness review',report_file:reportFile,api_calls:0,model_revalidation:'not_run_at_collection'},entries};
 write('manifest.json',manifest);write('per-question-point-audit.json',report);
 fs.writeFileSync(`${output}/comparison-bank.sha256`,hash(`${output}/comparison-bank.json`)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output,manifest_sha256:hash(`${output}/manifest.json`),comparison_bank_sha256:hash(`${output}/comparison-bank.json`),canonical_or_public_mutation:false}));
}
