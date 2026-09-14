import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14';
const source=R+'/helpers/prepare-coverage.mjs',target=R+'/prepare-coverage-v2.mjs';
let text=fs.readFileSync(source,'utf8').replace("'../../../coverage/build-coverage.mjs'","'../../coverage/build-coverage.mjs'").replace("'./coverage-contract.mjs'","'./helpers/coverage-contract.mjs'");
const old="const sourceIds=[...new Set(question.criteria.filter(criterion=>proposal.criterion_ids.includes(criterion.id)).flatMap(criterion=>criterion.source_ref_ids))];";
assert(text.includes(old));
text=text.replace(old,`const referenceIds=[...new Set(question.criteria.filter(criterion=>proposal.criterion_ids.includes(criterion.id)).flatMap(criterion=>criterion.source_ref_ids))];
  const sourceIds=proposal.source_unit_ids??referenceIds;
  assert(new Set(sourceIds).size===sourceIds.length);
  // A local SourceRef ID is not necessarily a catalogue unit ID. Explicit mapping must retain actual quoted text and file identity.
  const norm=text=>text.replace(/\\s/gu,'');
  for(const referenceId of referenceIds){
   const reference=set.source_refs.find(row=>row.id===referenceId);assert(reference);
   assert(sourceIds.some(id=>{const unit=units.find(row=>row.id===id);return unit&&unit.file===reference.file&&norm(unit.quote).includes(norm(reference.source_quote));}),'Explicit source unit must contain every selected criterion quote: '+referenceId);
  }`);
fs.writeFileSync(target,text,{flag:'wx'});
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
fs.writeFileSync(R+'/coverage-successor-provenance.json',JSON.stringify({source:ref(source),successor:ref(target),reason:'SourceRef 별칭을 catalogue unit ID와 혼동하지 않도록 작성자가 명시한 단위를 실제 인용문·원파일과 대조한다. 기존 고정 helper를 보존한다.',model_calls:0},null,2)+'\n',{flag:'wx'});
