import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const D='cpa_uploader/drafts/case-expansion-2026-09-13';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13';
const read=f=>JSON.parse(fs.readFileSync(f));
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const bank=read(D+'/bank-before.json'),cat=read(D+'/catalog-before.json');
const targets=bank.filter(s=>{const qs=cat.classifications.filter(c=>c.source_set_id===s.id&&c.question_style==='case');return qs.length&&(qs.length<2||[...s.shared_context.facts.map(f=>f.text).join('\n')].length<400);});
const standards=[],lineage=[];
for(const s of targets){
 const rows=cat.classifications.filter(c=>c.source_set_id===s.id&&c.question_style==='standard');
 if(!rows.length)continue;
 const n=structuredClone(s);n.id=s.id+'-standards-20260913';assert(!bank.some(s=>s.id===n.id));n.title=read(R+'/standard-titles.json')[s.id];n.status='needs_review';n.verification.review_status='needs_human_review';
 n.verification.notes.push('2026-09-13 사례 보강에 따른 독립 기준서형 저장 분리. 기존 학습 발문·답안·기준·정수 배점과 공식 인용을 보존. 과거 source_set_id와 새 ID의 대응은 case-expansion-2026-09-13/standard-lineage.json 참조.');
 n.shared_context.facts=[];
 n.subquestions=s.subquestions.filter(q=>rows.some(c=>c.subquestion_id===q.id)).map(q=>{const c=rows.find(c=>c.subquestion_id===q.id);return{...structuredClone(q),prompt:c.standalone_prompt??q.prompt,question_style:'standard',topic_ids:c.topic_ids};});
 n.learning_order=n.subquestions.map(q=>q.id);
 const used=new Set(n.subquestions.flatMap(q=>[...q.requirements.map(r=>r.source_ref_id),...q.criteria.flatMap(c=>c.source_ref_ids)]));
 n.source_refs=n.source_refs.filter(r=>used.has(r.id));
 n.classification.standards=[...new Set(n.source_refs.flatMap(r=>(r.page??'').match(/KGA\s+\d+/g)??[]))];
 for(const q of n.subquestions){const old=s.subquestions.find(x=>x.id===q.id);for(const key of ['model_answer','requirements','criteria','selection','constraints'])assert.deepEqual(q[key],old[key]);lineage.push({source_set_id:s.id,source_subquestion_id:q.id,target_set_id:n.id,target_subquestion_id:q.id,criterion_ids:q.criteria.map(c=>c.id),source_catalog:D+'/catalog-before.json',prompt_preserved_from:'current_standalone_learning_prompt',semantic_change:false});}
 standards.push(n);
}
write(R+'/target-ids.json',targets.map(s=>s.id));write(R+'/standards.json',standards);write(R+'/standard-lineage.json',lineage);
write(R+'/baseline.json',{date:'2026-09-13',bank:{file:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',sha256:createHash('sha256').update(fs.readFileSync(D+'/bank-before.json')).digest('hex')},catalog:{file:'cpa_uploader/data/learning-question-classifications.json',sha256:createHash('sha256').update(fs.readFileSync(D+'/catalog-before.json')).digest('hex')},case_shape:{minimum_questions:2,minimum_fact_characters:400,count_method:'Unicode codepoints, facts text joined by one newline, whitespace included'},target_ids:targets.map(s=>s.id)});
console.log({case_targets:targets.length,standard_containers:standards.length,standard_questions:lineage.length});
