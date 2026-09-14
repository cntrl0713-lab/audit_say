import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import {questionHash} from '../../coverage/build-coverage.mjs';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const overlay=read(R+'coverage-links.snapshot.json'),lineage=read(R+'candidate-v1/lineage.json');
const before=read(R+'bank.snapshot.json'),after=read(R+'candidate-v1/bank.json');
const dataset=read('cpa_uploader/analysis/question-elements/question-elements.json');
const catalog=buildSourceCatalog({repoDir:process.cwd()});
const units=new Map(catalog.units.map(u=>[u.id,u]));
const elements=new Map(dataset.elements.map(e=>[e.id,e]));
const records=new Map(dataset.records.map(r=>[r.id,r]));
const B=new Map(before.flatMap(s=>s.subquestions.map(q=>[s.id+'/'+q.id,{s,q}])));
const A=new Map(after.flatMap(s=>s.subquestions.map(q=>[s.id+'/'+q.id,{s,q}])));
const L=new Map(lineage.flatMap(g=>g.source_keys.map(k=>[k,g])));
const rows=[];
for(const link of overlay.links){
 if(!link.target||link.target.scope==='draft')continue;
 const key=link.target.set_id+'/'+link.target.subquestion_id;
 const prior=B.get(key),next=A.get(key);
 let g=L.get(key);
 assert(prior,`${link.id}: source question missing`);
 if(next&&questionHash(prior.s,prior.q)===questionHash(next.s,next.q))continue;
 if(!g){
  assert(next,`${link.id}: removed without lineage`);
  g={source_keys:[key],targets:[{set_id:next.s.id,subquestion_id:next.q.id,points:next.q.criteria.length,
    criteria:next.q.criteria.map(c=>({criterion_id:c.id,from_key:key,from_criterion_id:c.id,claim_changed:c.claim!==prior.q.criteria.find(a=>a.id===c.id)?.claim}))}],
    reason:'기존 세트에 남긴 물음의 독립 발문·메타데이터/부모 사실 정리로 questionHash가 바뀐 경우. ID를 유지하며 별도로 의미 대조한다.',retained_identity:true};
 }
 const element=elements.get(link.element_id);
 const questionRecords=[...new Set(element.occurrence_ids.map(id=>dataset.occurrences.find(o=>o.id===id)?.record_id).filter(Boolean))].map(id=>records.get(id));
 rows.push({link,element,question_records:questionRecords,
  source_units:link.source_unit_ids.map(id=>units.get(id)),
  old_question:{key,prompt:prior.q.prompt,criteria:prior.q.criteria.filter(c=>link.target.criterion_ids.includes(c.id))},
  lineage:g,
  candidates:g.targets.map(t=>{const {q}=A.get(t.set_id+'/'+t.subquestion_id);return{...t,prompt:q.prompt,model_answer:q.model_answer,
    criteria:t.criteria.map(c=>({...c,claim:q.criteria.find(n=>n.id===c.criterion_id).claim,
      lineage_matches:c.from_key===key&&link.target.criterion_ids.includes(c.from_criterion_id)}))};})});
}
fs.writeFileSync(R+'coverage-review-input.json',JSON.stringify({rows},null,2)+'\n');
fs.writeFileSync(R+'coverage-elements.snapshot.json',JSON.stringify(dataset,null,2)+'\n');
fs.writeFileSync(R+'coverage-source-units.snapshot.json',JSON.stringify({fingerprint:catalog.fingerprint,units:[...new Set(overlay.links.flatMap(l=>l.source_unit_ids))].map(id=>units.get(id))},null,2)+'\n');
console.log(JSON.stringify({links:overlay.links.length,changed_targets:rows.length,deleted_without_targets:rows.filter(r=>!r.candidates.length).map(r=>r.link.id)}));
