import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14';
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
assert(!fs.existsSync(R+'/execution-v1'));
const file=R+'/draft-evidence.json',rows=JSON.parse(fs.readFileSync(file));
for(const row of rows)assert.equal(ref(row.file).sha256,row.sha256);
const extras=['capture-integration-baseline-successor.mjs','integration-baseline-successor-evidence.json','integration-baseline-root-review.json','integration-baseline.json','integration-baseline/bank.json','integration-baseline/catalog.json','integration-baseline/classification.json','link-integration-evidence.mjs'].map(f=>ref(R+'/'+f));
const map=new Map(rows.map(r=>[r.file,r]));
for(const row of extras){if(map.has(row.file))assert.equal(map.get(row.file).sha256,row.sha256);map.set(row.file,row);}
fs.copyFileSync(file,R+'/draft-evidence-before-baseline-link.json',fs.constants.COPYFILE_EXCL);
fs.writeFileSync(file,JSON.stringify([...map.values()],null,2)+'\n');
console.log({final_evidence_files:map.size});
