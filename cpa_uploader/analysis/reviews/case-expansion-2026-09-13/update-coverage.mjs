import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-expansion-2026-09-13',file='cpa_uploader/analysis/coverage/links.json';
const read=f=>JSON.parse(fs.readFileSync(f));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(file),data=JSON.parse(bytes),bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json');
const lineage=read(R+'/criterion-lineage.json'),changed=[],next=[];
for(const link of data.links){
 if(!link.target||link.target.scope==='draft'){next.push(link);continue;}
 const mappings=lineage.filter(l=>l.source_set_id===link.target.set_id&&l.source_subquestion_id===link.target.subquestion_id);
 if(!mappings.length){next.push(link);continue;}
 const groups=new Map();
 for(const id of link.target.criterion_ids){
  const m=mappings.find(l=>l.source_criterion_id===id);assert(m,link.id+'/'+id);
  const key=m.target.set_id+'/'+m.target.subquestion_id;
  if(!groups.has(key))groups.set(key,{set_id:m.target.set_id,subquestion_id:m.target.subquestion_id,criterion_ids:[]});
  groups.get(key).criterion_ids.push(id);
 }
 assert(groups.size,link.id);
 for(const [i,target]of [...groups.values()].entries()){
  const row=structuredClone(link);
  if(i)row.id+=`-case-expansion-${i+1}`;
  if(JSON.stringify(target)!==JSON.stringify(link.target)){
   row.target=target;row.review_status='needs_review';
   row.reason+=' 2026-09-13 사례 보강 시 원 criterion의 새 물음·기준서형 저장 위치로 연결했다. 원 관계의 의미·빈도는 새로 승인하지 않으며 이전 snapshot을 보존하여 재검토 대기를 표시한다.';
   row.provenance={...row.provenance,case_expansion:{file:R+'/criterion-lineage.json',sha256:sha(fs.readFileSync(R+'/criterion-lineage.json')),original_link_id:link.id,original_snapshot_file:R+'/coverage-links-before.json'}};
   changed.push({id:row.id,before:link.target,after:target});
  }
  next.push(row);
 }
}
assert.equal(new Set(next.map(l=>l.id)).size,next.length);
for(const l of next){if(!l.target||l.target.scope==='draft')continue;const q=bank.find(s=>s.id===l.target.set_id)?.subquestions.find(q=>q.id===l.target.subquestion_id);assert(q,l.id);assert(l.target.criterion_ids.every(id=>q.criteria.some(c=>c.id===id)),l.id);}
assert.equal(sha(fs.readFileSync(file)),sha(bytes),'Concurrent coverage edit');
fs.writeFileSync(R+'/coverage-links-before.json',bytes,{flag:'wx'});
data.links=next;fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(R+'/coverage-update.json',JSON.stringify({before_sha256:sha(bytes),after_sha256:sha(fs.readFileSync(file)),changed,relationship_review_performed:false,prior_snapshots_preserved:true},null,2)+'\n',{flag:'wx'});
console.log({rebound_links:changed.length,links:next.length});
