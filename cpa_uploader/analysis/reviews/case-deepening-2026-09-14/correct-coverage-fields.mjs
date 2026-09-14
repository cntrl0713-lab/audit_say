import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assembleCoverage,resolveDraftFile} from '../../coverage/build-coverage.mjs';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';

const R='cpa_uploader/analysis/reviews/case-deepening-2026-09-14';
const file='cpa_uploader/analysis/coverage/links.json';
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const ref=p=>({file:p,sha256:sha(fs.readFileSync(p))});
const bytes=fs.readFileSync(file),before=JSON.parse(bytes),after=structuredClone(before);
const proposals=read(R+'/coverage-proposals.json').links;
const ids=proposals.map(p=>p.id),review=read(R+'/coverage-root-review.json');
assert.equal(read(R+'/final-checks-v1/summary.json').failed_check,'analysis-build');
assert.equal(review.proposal_sha256,ref(R+'/coverage-proposals.json').sha256);
assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);
const expected=['partial','direct','adjacent','direct','direct','direct'];
for(const [index,id]of ids.entries()){
 const row=after.links.find(l=>l.id===id),proposal=proposals[index];
 assert(row);assert.equal(row.relationship,undefined);assert.equal(row.relation,expected[index]);
 assert.equal(row.relation,proposal.relation);assert.equal(row.reason,proposal.reason);
 assert.deepEqual(row.snapshot,proposal.snapshot);assert.equal(row.review_status,'reviewed');
 assert.equal(review.links.find(l=>l.id===id)?.decision,'accept');
 row.relationship=row.relation;delete row.relation;
 const restored=structuredClone(row);restored.relation=restored.relationship;delete restored.relationship;
 assert.deepEqual(restored,before.links.find(l=>l.id===id));
}
const old=read(R+'/coverage-links-before.json');
assert.deepEqual(after.links.filter(l=>!ids.includes(l.id)),old.links);
const drafts=[...new Set(after.links.filter(l=>l.target?.scope==='draft').map(l=>l.target.file))].flatMap(file=>{
 const raw=read(resolveDraftFile(process.cwd(),file));
 return (Array.isArray(raw)?raw:[raw]).map(set=>({file,set}));
});
const registry=assembleCoverage({dataset:read('cpa_uploader/analysis/question-elements/question-elements.json'),bank:read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),catalog:buildSourceCatalog(),overlay:after,inputs:{},drafts});
const checked=registry.links.filter(l=>ids.includes(l.id));
assert.equal(checked.length,6);assert(checked.every(l=>l.freshness==='current'&&l.effective_review_status==='reviewed'));
assert.equal(sha(fs.readFileSync(file)),sha(bytes),'Concurrent coverage edit');
fs.writeFileSync(R+'/coverage-links-before-field-correction.json',bytes,{flag:'wx'});
fs.writeFileSync(file,JSON.stringify(after,null,2)+'\n');
fs.writeFileSync(R+'/coverage-field-correction.json',JSON.stringify({status:'corrected_and_schema_validated',corrected_at:new Date().toISOString(),cause:'Draft proposal relation was copied without mapping to the live coverage relationship field.',method:'Exact field rename for these six reviewed relationships; values and all other fields unchanged.',prior_failure:ref(R+'/final-checks-v1/summary.json'),original_update:ref(R+'/coverage-update.json'),before:ref(R+'/coverage-links-before-field-correction.json'),after:ref(file),proposal:ref(R+'/coverage-proposals.json'),root_review:ref(R+'/coverage-root-review.json'),corrections:checked.map(l=>({id:l.id,from:'relation',to:'relationship',value:l.relationship,freshness:l.freshness,effective_review_status:l.effective_review_status})),existing_links_preserved:old.links.length,question_content_changes:0,frequency_input_changes:0,model_api_calls:0,db_calls:0,human_review_performed:false},null,2)+'\n',{flag:'wx'});
console.log({status:'corrected_and_schema_validated',corrected:checked.length,existing_preserved:old.links.length});
