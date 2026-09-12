import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateQuestionAuthoringPlan,authoringPlanHash} from '../../../../../questionAuthoringPlan';
import {buildSourceCatalog} from '../../../../../questionSourceCatalog.mjs';

const base='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const out=base+'/c/review-plans';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const expected=read(base+'/prepared-reviewed-v1/summary.json').canonical.changed_sets as string[];
const index=read(out+'/index.json');
const bank=read(base+'/prepared-reviewed-v3/candidate-authoring.json');
const units=buildSourceCatalog().units;
const unitMap=new Map(units.map((u:any)=>[u.id,u]));
const errors:string[]=[];const checks:any[]=[];const sourceIds=new Set<string>();
if(index.entries.length!==expected.length)errors.push('index count');
if(new Set(index.entries.map((e:any)=>e.set_id)).size!==expected.length)errors.push('set_id duplicate');
for(const e of index.entries){
 const p=read(e.file),s=bank.find((s:any)=>s.id===e.set_id);
 if(!expected.includes(e.set_id))errors.push('out of scope '+e.set_id);
 if(p.set_id!==e.set_id)errors.push('plan linkage '+e.set_id);
 if(!s)throw new Error('candidate missing '+e.set_id);
 errors.push(...validateQuestionAuthoringPlan(p,true).map(x=>e.set_id+':'+x));
 if(sha(fs.readFileSync(e.file))!==e.sha256)errors.push('file hash '+e.set_id);
 if(p.topic_id!==s.classification.topic_id)errors.push('topic '+e.set_id);
 if(p.scope.required_answers.length!==s.subquestions.length)errors.push('question count '+e.set_id);
 const required=p.scope.required_answers.join('\n');
 for(const q of s.subquestions){
  if(!required.includes(`${e.set_id}/${q.id}`)||!required.includes(q.prompt))errors.push('prompt '+e.set_id+'/'+q.id);
  for(const c of q.criteria)if(!required.includes(`${c.id}(${c.max_points}점): ${c.claim}`))errors.push('criterion '+e.set_id+'/'+q.id+'/'+c.id);
 }
 for(const sid of p.source_unit_ids){if(!unitMap.has(sid))errors.push('source id '+e.set_id+'/'+sid);sourceIds.add(sid);}
 for(const m of p.metadata.source_mapping_evidence){
  const r=s.source_refs.find((r:any)=>r.id===m.source_ref_id);
  if(!r||sha(r.source_quote)!==m.source_quote_sha256)errors.push('source mapping '+e.set_id+'/'+m.source_ref_id);
  for(const u of m.units){const actual:any=unitMap.get(u.id);if(!actual||actual.file!==u.file||sha(actual.quote)!==u.quote_sha256||actual.authority!==u.authority)errors.push('catalog metadata '+u.id);}
 }
 for(const id of new Set<string>(p.existing_question_difference.match(/pilot-\d\d-\d\d\d/gu)||[]))if(!bank.some((s:any)=>s.id===id))errors.push('comparison set '+id);
 checks.push({set_id:e.set_id,plan_file:e.file,plan_file_sha256:e.sha256,authoring_plan_hash:authoringPlanHash(p),ready:p.status==='ready',questions:s.subquestions.length,criteria:s.subquestions.reduce((n:number,q:any)=>n+q.criteria.length,0),points:s.subquestions.reduce((n:number,q:any)=>n+q.criteria.reduce((n:number,c:any)=>n+c.max_points,0),0),source_refs:s.source_refs.length,source_units:p.source_unit_ids.length});
}
for(const f of read(out+'/input-snapshot.json').files)if(sha(fs.readFileSync(f.file))!==f.sha256)errors.push('read input changed '+f.file);
const result={version:1,method:'local_question_authoring_plan_validator_and_explicit_linkage_check',api_calls:0,model_semantic_review:false,model_grading:false,human_approval_asserted:false,question_bank_or_source_mutation:false,status:errors.length?'fail':'pass',summary:{plans:checks.length,questions:checks.reduce((n,c)=>n+c.questions,0),criteria:checks.reduce((n,c)=>n+c.criteria,0),points:checks.reduce((n,c)=>n+c.points,0),source_refs:checks.reduce((n,c)=>n+c.source_refs,0),unique_source_unit_ids:sourceIds.size,catalog_units:units.length,errors:errors.length},errors,entries:checks};
fs.writeFileSync(out+'/static-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary,null,2));if(errors.length){console.log(errors);process.exitCode=1;}
