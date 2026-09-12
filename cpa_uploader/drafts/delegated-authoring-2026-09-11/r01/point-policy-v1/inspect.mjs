import fs from 'node:fs';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/';
const manifest=JSON.parse(fs.readFileSync(control+'final-153-v3/manifest-plan-followup-02.json','utf8'));
const overlay=JSON.parse(fs.readFileSync(control+'active-qa-overrides-v3-plan-followup-02.json','utf8'));
export const entries=manifest.entries.filter(e=>['R01','N04','N05','S03'].includes(e.package)).map(e=>({...e,qa_file:overlay.overrides.find(o=>o.plan_id===e.plan_id)?.identity.file??e.qa_file}));
export const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
if(process.argv[2]){
 const e=entries.find(e=>e.plan_id===process.argv[2]);const s=read(e.file);const q=s.subquestions.find(q=>q.id===process.argv[3]);
 if(process.argv[4]==='source')for(const r of s.source_refs.filter(r=>q.criteria.some(c=>c.source_ref_ids.includes(r.id))))console.log(r.id+' '+r.title+'\n'+r.source_quote);
 else for(const c of read(e.qa_file).cases.filter(c=>c.subquestion_id===q.id))console.log(c.id+' | '+c.expected_verdicts.map(v=>v.verdict==='met'?'M':v.verdict==='contradicted'?'C':'N').join('')+' | '+c.answer.replaceAll('\n',' / '));
}
