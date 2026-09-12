import fs from 'node:fs';
import crypto from 'node:crypto';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const out='cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/point-policy-v1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')), hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const manifest=read(control+'/final-153-v3/manifest-plan-followup-02.json');
const overlays=read(control+'/active-qa-overrides-v3-plan-followup-02.json').overrides;
const entries=manifest.entries.filter(e=>['R02','N02','N03','S02','S04'].includes(e.package)).map(e=>{
 const qaFile=overlays.find(o=>o.plan_id===e.plan_id)?.identity.file??e.qa_file;
 const q=read(e.file), question=Array.isArray(q)?q[0]:q;
 return {plan_id:e.plan_id,package:e.package,set_id:e.set_id,question_file:e.file,question_sha256:hash(e.file),plan_file:e.plan_files[0].file,plan_sha256:hash(e.plan_files[0].file),qa_file:qaFile,qa_sha256:hash(qaFile),question,plan:read(e.plan_files[0].file),qa:read(qaFile)};
});
if(entries.length!==15)throw Error('Expected15sets');
fs.writeFileSync(out+'/inputs.json',JSON.stringify({created_at:new Date().toISOString(),entries},null,2)+'\n',{flag:'wx'});
for(const pkg of ['R02','N02','N03','S02','S04']){
 let text='';for(const e of entries.filter(e=>e.package===pkg)){
  text+=`\n# ${e.plan_id} ${e.set_id}\nFacts: ${JSON.stringify(e.question.shared_context)}\n`;
  for(const q of e.question.subquestions) text+=`\n## ${q.id}\n${q.prompt}\nModel: ${JSON.stringify(q.model_answer)}\n${JSON.stringify(q.criteria.map(c=>({id:c.id,claim:c.claim,scope:c.scope,refs:c.source_ref_ids,requirement_id:c.requirement_id,critical_fact_ids:c.critical_fact_ids})),null,2)}\n`;
 }fs.writeFileSync(out+'/read-'+pkg.toLowerCase()+'.md',text,{flag:'wx'});
}
console.log(JSON.stringify(entries.map(e=>({id:e.plan_id,file:e.question_file,plan:e.plan_file,qa:e.qa_file,questions:e.question.subquestions.length,qa_cases:e.qa.cases.length}))));
