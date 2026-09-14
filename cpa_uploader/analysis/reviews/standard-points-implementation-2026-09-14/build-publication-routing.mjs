import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const routes=new Map(),superseded=[];
for(const v of [1,2,3]){
 const base=R+'/sealed-v'+v;assert.equal(read(base+'/readiness.json').ready,true);
 for(const review of read(base+'/batch.json').agent_reviews){
  if(routes.has(review.set_id))superseded.push(routes.get(review.set_id));
  routes.set(review.set_id,{set_id:review.set_id,method:'efficient',evidence:ref(base+'/batch.json')});
 }
}
const subset=R+'/subset-batch-v2';assert.equal(read(subset+'/checks.json').failed,0);
for(const target of read(subset+'/manifest.json').targets){assert(!routes.has(target.set_id));routes.set(target.set_id,{set_id:target.set_id,method:'subset',evidence:ref(subset+'/manifest.json')});}
const entries=[...routes.values()];
const expected=[...read(R+'/candidate-v3/new-sets.json').map(s=>s.id),...read(R+'/candidate-v3/retained-subsets.json').map(s=>s.set_id)];
assert.equal(new Set(entries.map(e=>e.set_id)).size,entries.length);
assert.deepEqual(entries.map(e=>e.set_id).sort(),expected.sort());
assert.equal(superseded.length,1);
fs.writeFileSync(R+'/publication-review-routing.json',JSON.stringify({created_at:new Date().toISOString(),entries,superseded},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sets:entries.length,efficient:entries.filter(e=>e.method==='efficient').length,subset:entries.filter(e=>e.method==='subset').length}));
