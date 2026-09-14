import assert from 'node:assert/strict';

export function resolveCoverageSourceUnits(set,question,proposal,units){
 const referenceIds=[...new Set(question.criteria.filter(criterion=>proposal.criterion_ids.includes(criterion.id)).flatMap(criterion=>criterion.source_ref_ids))];
 const sourceIds=proposal.source_unit_ids??referenceIds;
 assert(Array.isArray(sourceIds)&&sourceIds.length&&new Set(sourceIds).size===sourceIds.length,'Coverage source units must be nonempty and unique');
 const norm=text=>text.replace(/\s/gu,'');
 for(const referenceId of referenceIds){
  const reference=set.source_refs.find(row=>row.id===referenceId);assert(reference);
  assert(sourceIds.some(id=>{const unit=units.find(row=>row.id===id);return unit&&unit.file===reference.file&&norm(unit.quote).includes(norm(reference.source_quote));}),'Explicit source unit must contain every selected criterion quote: '+referenceId);
 }
 const sources=sourceIds.map(id=>{const unit=units.find(row=>row.id===id);assert(unit,id);return unit;});
 return {sourceIds,sources};
}
