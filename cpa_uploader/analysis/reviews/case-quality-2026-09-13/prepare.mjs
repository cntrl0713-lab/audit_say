import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const D='cpa_uploader/analysis/reviews/case-quality-2026-09-13';
export const E='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11/efficient-verification-2026-09-12';
export const read=f=>JSON.parse(fs.readFileSync(f));
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
export const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n');
const bank=read(D+'/candidate-v1.json'), changed=read(D+'/changed-sets-v1.json');
const previous=read(E+'/candidate-v5/grading-manifest.json'), lineage=read(D+'/lineage-v1.json');
const catalog=read(D+'/classification-v1.json');
const rows=[];
for(const set of bank.filter(s=>changed.includes(s.id)))for(const q of set.subquestions){
 const l=lineage.find(l=>l.targets.some(t=>t.set_id===set.id&&t.subquestion_id===q.id));
 const oldId=l?.source_set_id??set.id,oldQ=l?.source_subquestion_id??q.id;
 const row={set_id:set.id,subquestion_id:q.id,style:catalog.entries.find(e=>e.set_id===set.id&&e.subquestion_id===q.id).question_style,prompt:q.prompt,model_answer:q.model_answer,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim,critical_facts:c.critical_facts})),candidates:[]};
 for(const kind of ['partial','wrong']){
  const entry=previous.entries.find(e=>e.source_set_id===oldId&&e.kind===kind&&e.evaluated_subquestion_ids.includes(oldQ));
  if(!entry)continue;
  const old=entry.expected_by_subquestion.find(x=>x.subquestion_id===oldQ);
  const expected=q.criteria.map(c=>old.expected_verdicts.find(v=>v.criterion_id===c.id)??{criterion_id:c.id,verdict:'not_met',reason:'원 대표 답안은 이번에 옮겨진 별도 요구를 다루지 않음.'});
  const points=q.criteria.reduce((n,c)=>n+(expected.find(v=>v.criterion_id===c.id).verdict==='met'?c.max_points:0),0);
  row.candidates.push({kind,answer:entry.answers[oldQ],expected_points:points,expected_verdicts:expected,origin:{manifest:ref(E+'/candidate-v5/grading-manifest.json'),entry_id:entry.id,source_set_id:oldId,subquestion_id:oldQ,selection_evidence:entry.selection_evidence.find(e=>e.subquestion_id===oldQ)}});
 }
 rows.push(row);
}
write(D+'/qa-candidates-v1.json',rows);
const from=Number(process.argv[2])||0,to=Number(process.argv[3])||rows.length;
for(const [i,r]of rows.entries())if(i>=from&&i<to)console.log(`${i} ${r.set_id}/${r.subquestion_id} ${r.style}\nQ ${r.prompt}\nMODEL ${r.model_answer.join(' | ')}\n${r.candidates.map(c=>`${c.kind} (${c.expected_points}) ${c.answer} [${c.expected_verdicts.filter(v=>v.verdict==='met').map(v=>v.criterion_id).join(',')}]`).join('\n')}\n`);
console.log('TOTAL '+rows.length);
