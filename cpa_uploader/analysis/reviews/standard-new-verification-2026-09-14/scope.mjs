// 이 세션이 2026-09-14 정본에 넣은 기준서형 53물음을 현재 정본의 물음으로 추적해 검증 대상을 고정한다.
// 그 뒤 기준서형 배점 재편(standard-points-implementation)으로 30물음은 퇴역하고 55개 새 물음으로 나뉘거나 조정됐다.
//   node cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14/scope.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-new-verification-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=file=>({file,sha256:sha(file)});
const inputs={
 backlog_scope:'cpa_uploader/analysis/reviews/standard-backlog-publication-2026-09-14/scope.json',
 priority_scope:'cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1/scope.json',
 published_bank:'cpa_uploader/drafts/standard-priority-2026-09-14/publication-v1/stage/authoring.json',
 lineage:'cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/candidate-v3/lineage.json',
 current_bank:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',
};
const origins=[...read(inputs.backlog_scope).targets,...read(inputs.priority_scope).targets].flatMap(t=>t.subquestion_ids.map(q=>`${t.set_id}/${q}`));
assert.equal(origins.length,53);
const published=new Map(read(inputs.published_bank).map(s=>[s.id,s])),current=new Map(read(inputs.current_bank).map(s=>[s.id,s])),lineage=read(inputs.lineage);
const targets=[],retired=[];
for(const key of origins){
 const [sid,qid]=key.split('/'),before=published.get(sid).subquestions.find(q=>q.id===qid),now=current.get(sid)?.subquestions.find(q=>q.id===qid);
 const lin=lineage.filter(l=>l.source_keys.includes(key));
 if(now){assert.equal(lin.length,0,key);assert.deepEqual(now,before,'유지 물음이 게시 당시와 다르다: '+key);targets.push({set_id:sid,subquestion_id:qid,kind:'kept',origin:key});continue;}
 assert.equal(lin.length,1,key);retired.push(key);
 for(const t of lin[0].targets){assert(current.get(t.set_id)?.subquestions.some(q=>q.id===t.subquestion_id),'재편 대상 없음: '+t.set_id);assert.deepEqual(lin[0].source_keys,[key],'다른 물음과 통합된 재편은 이 범위 계산이 다루지 않는다');targets.push({set_id:t.set_id,subquestion_id:t.subquestion_id,kind:'restructured',origin:key,lineage_reason:lin[0].reason});}
}
const points=targets.reduce((n,t)=>n+current.get(t.set_id).subquestions.find(q=>q.id===t.subquestion_id).criteria.reduce((a,c)=>a+c.max_points,0),0);
const out={version:1,created_at:new Date().toISOString(),inputs:Object.fromEntries(Object.entries(inputs).map(([k,f])=>[k,ref(f)])),origin_questions:origins.length,retired_origins:retired,targets,counts:{targets:targets.length,kept:targets.filter(t=>t.kind==='kept').length,restructured:targets.filter(t=>t.kind==='restructured').length,sets:new Set(targets.map(t=>t.set_id)).size,points}};
fs.writeFileSync(R+'/scope.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(out.counts),'retired',retired.length);
