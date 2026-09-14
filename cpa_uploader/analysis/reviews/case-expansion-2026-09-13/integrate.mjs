import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const write=(f,x)=>fs.writeFileSync(R+'/'+f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const before=read(D+'/bank-before.json'),classes=read(D+'/classification-before.json').entries;
assert.equal(hash(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json')),hash(fs.readFileSync(D+'/bank-before.json')),'Concurrent canonical changes: merge them explicitly before continuing');
const ids=read(R+'/target-ids.json'),standards=read(R+'/standards.json'),lineage=read(R+'/standard-lineage.json');
const changes=[],qa=[],design=[],reviews=[],evidence=[];
for(const agent of ['a','b','c','root']){
 const dir=D+'/'+agent;
 const sets=read(dir+'/sets.json'),plans=read(dir+'/design.json'),reviewDocument=read(dir+'/review.json'),cases=read(dir+'/qa.json');
 const review=Array.isArray(reviewDocument)?reviewDocument:reviewDocument.sets;
 assert(!(reviewDocument.unresolved??[]).length,dir);
 assert(Array.isArray(sets)&&Array.isArray(plans)&&Array.isArray(review)&&Array.isArray(cases));
 changes.push(...sets);qa.push(...cases);design.push(...plans);
 reviews.push(...review.flatMap(r=>Array.isArray(r.questions)?r.questions.map(q=>({
  ...q,set_id:r.set_id,reviewer_id:r.reviewer??r.reviewer_id??agent,
  rationale:[q.rationale,q.reason,q.source_answer_scope_points_comparison,q.point_reason,q.facts_dependency,q.classification_reason,q.point_reasonableness_decision,q.point_review?.reason,q.response_burden,q.comparison,...(q.criteria??[]).map(c=>c.source_support)].filter(Boolean).join(' '),
  unresolved_content_findings:[...(r.unresolved??r.unresolved_content_findings??[]),...(q.unresolved??q.unresolved_content_findings??[])],
  source_review_file:dir+'/review.json'
 })):r));
 for(const name of ['sets.json','design.json','review.json','qa.json'])evidence.push({file:dir+'/'+name,sha256:hash(fs.readFileSync(dir+'/'+name))});
 for(const row of plans){const plan=row.plan??row.authoring_plan??row;assert.deepEqual(validateQuestionAuthoringPlan(plan),[],row.set_id);}
}
assert.deepEqual(changes.filter(s=>before.some(b=>b.id===s.id)).map(s=>s.id).sort(),ids.toSorted());
assert.equal(new Set(changes.map(s=>s.id)).size,changes.length);
const bank=before.map(s=>{
 const replacement=changes.find(n=>n.id===s.id);if(!replacement)return s;
 const n=structuredClone(replacement);
 // Lifecycle is inherited solely for the existing-ID --reverify transaction.
 // Authored needs_review originals remain in the draft directories. This private
 // candidate is not a publication; the new receipt is mandatory before install.
 n.status=s.status;n.verification.review_status=s.verification.review_status;
 return n;
});
bank.push(...standards,...changes.filter(s=>!before.some(b=>b.id===s.id)));
const entries=classes.filter(c=>!ids.includes(c.set_id));
for(const s of changes){
 assert(s.subquestions.length>=2&&s.subquestions.length<=4,s.id);
 assert([...s.shared_context.facts.map(f=>f.text).join('\n')].length>=400,s.id);
 for(const q of s.subquestions){
  assert.equal(q.question_style,'case');assert(q.topic_ids?.length);
  const rev=reviews.find(r=>r.set_id===s.id&&r.subquestion_id===q.id);assert(rev,'Review missing '+s.id+'/'+q.id);
  assert(!(rev.unresolved_content_findings??rev.unresolved_items??[]).length,'Unresolved '+s.id+'/'+q.id);
  entries.push({set_id:s.id,subquestion_id:q.id,question_style:'case',topic_ids:q.topic_ids,standalone_prompt:null,case_fact_ids:s.shared_context.facts.map(f=>f.id),reason:rev.rationale??rev.reason,review_evidence:evidence.filter(e=>e.file.endsWith('/review.json'))});
 }
}
for(const s of standards)for(const q of s.subquestions){
 const l=lineage.find(l=>l.target_set_id===s.id&&l.target_subquestion_id===q.id),old=classes.find(c=>c.set_id===l.source_set_id&&c.subquestion_id===q.id);assert(old);
 entries.push({...old,set_id:s.id,standalone_prompt:q.prompt,case_fact_ids:[],reason:old.reason+' 기존 독립 학습 발문을 그대로 저장하여 사례 부모 없이 풀 수 있도록 분리. 정답·기준·배점·출처 보존을 대조함.',predecessor:{source_set_id:l.source_set_id,subquestion_id:q.id,review_file:D+'/classification-before.json'}});
}
const criterionLineage=[];
for(const id of ids){
 const old=before.find(s=>s.id===id),now=bank.filter(s=>s.id===id||s.id===id+'-standards-20260913');
 for(const q of old.subquestions)for(const c of q.criteria){
  const destinations=now.flatMap(s=>s.subquestions.flatMap(q=>q.criteria.filter(n=>n.id===c.id).map(n=>({set_id:s.id,subquestion_id:q.id,criterion_id:n.id,points:n.max_points}))));
  assert.equal(destinations.length,1,`${id}/${q.id}/${c.id} lineage`);
  assert.equal(destinations[0].points,c.max_points);
  criterionLineage.push({source_set_id:id,source_subquestion_id:q.id,source_criterion_id:c.id,target:destinations[0]});
 }
}
const checked=validateAuthoringBank(bank);assert.deepEqual(checked.errors,[]);
const shapes=bank.map(s=>{const caseRows=entries.filter(e=>e.set_id===s.id&&e.question_style==='case');return{set_id:s.id,questions:caseRows.length,facts_characters:[...s.shared_context.facts.map(f=>f.text).join('\n')].length};}).filter(s=>s.questions);
assert(shapes.every(s=>s.questions>=2&&s.facts_characters>=400));
const candidate='candidate-v1.json';write(candidate,bank);
write('classification-v1.json',{source_file:R+'/'+candidate,source_file_sha256:hash(fs.readFileSync(R+'/'+candidate)),entries});
write('changed-sets-v1.json',[...changes.map(s=>s.id),...standards.map(s=>s.id)]);
write('case-reviews.json',reviews);write('designs.json',design);write('case-qa.json',qa);write('draft-evidence.json',evidence);write('criterion-lineage.json',criterionLineage);
write('shape-check.json',{case_sets:shapes.length,case_questions:shapes.reduce((n,s)=>n+s.questions,0),minimum_facts_characters:Math.min(...shapes.map(s=>s.facts_characters)),below_two_questions:shapes.filter(s=>s.questions<2),below_400_characters:shapes.filter(s=>s.facts_characters<400),rows:shapes});
write('authoring-check.json',{errors:checked.errors,sets:bank.length,questions:checked.subquestionCount,criteria:checked.criterionCount,total_points:checked.totalPoints});
console.log({sets:bank.length,questions:checked.subquestionCount,case_sets:shapes.length,case_questions:shapes.reduce((n,s)=>n+s.questions,0),changed_sets:changes.length+standards.length});
