import fs from 'node:fs';
import {createHash} from 'node:crypto';
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v3/manifest.json',manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const inputs=manifest.entries.filter(e=>['R02','N02','N03','S02','S04'].includes(e.package)).map(e=>{
 const raw=JSON.parse(fs.readFileSync(e.file,'utf8')),s=Array.isArray(raw)?raw[0]:raw;
 return {plan_id:e.plan_id,file:e.file,sha256:createHash('sha256').update(fs.readFileSync(e.file)).digest('hex'),shared_context:s.shared_context,subquestions:s.subquestions.map(q=>({id:q.id,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria})),source_refs:s.source_refs};
});
const questions=inputs.flatMap(s=>s.subquestions),criteria=questions.flatMap(q=>q.criteria);
const result={created_at:new Date().toISOString(),mode:'read_only_scoring_review',manifest:manifestFile,sets:inputs.length,questions:questions.length,criteria:criteria.length,points:criteria.reduce((n,c)=>n+c.max_points,0),content_changes:0,inputs};
fs.writeFileSync('cpa_uploader/drafts/delegated-authoring-2026-09-11/r02/evidence/phase2/scoring-review-15-sets-inputs.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sets:result.sets,questions:result.questions,criteria:result.criteria,points:result.points}));
