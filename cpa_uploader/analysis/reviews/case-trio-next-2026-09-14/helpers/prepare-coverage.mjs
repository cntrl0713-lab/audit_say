import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {questionHash,sourceUnitHash} from '../../../coverage/build-coverage.mjs';
import {assertRelationship} from './coverage-contract.mjs';
import {resolveCoverageSourceUnits} from './coverage-source-map.mjs';
const R='cpa_uploader/analysis/reviews/case-trio-next-2026-09-14',D='cpa_uploader/drafts/case-trio-next-2026-09-14';
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=value=>createHash('sha256').update(value).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const elements=read('cpa_uploader/analysis/question-elements/question-elements.json').elements,units=read(D+'/source-catalog-final.json').units,links=[];
for(const worker of ['a','b','c']){
 const file=D+'/'+worker+'/coverage-proposals.json',sets=read(D+'/'+worker+'/sets.json'),proposals=read(file);
 assert.equal(sets.length,1);assert.equal(proposals.length,1,'One deliberately reviewed representative relationship per case');
 for(const proposal of proposals){
  assertRelationship(proposal);
  const set=sets.find(set=>set.id===proposal.set_id),question=set?.subquestions.find(question=>question.id===proposal.subquestion_id);
  const element=elements.find(element=>element.id===proposal.element_id);assert(element&&question);
  assert(Array.isArray(proposal.criterion_ids)&&proposal.criterion_ids.length>0&&new Set(proposal.criterion_ids).size===proposal.criterion_ids.length);
  assert(proposal.criterion_ids.every(id=>question.criteria.some(criterion=>criterion.id===id)));
  const {sourceIds,sources}=resolveCoverageSourceUnits(set,question,proposal,units);
  links.push({id:'coverage-trio-next-20260914-'+worker,element_id:proposal.element_id,source_unit_ids:sourceIds,
   target:{scope:'draft',file:D+'/'+worker+'/sets.json',set_id:set.id,subquestion_id:question.id,criterion_ids:proposal.criterion_ids},
   relationship:proposal.relationship,reason:proposal.reason,review_status:'needs_review',
   snapshot:{element_sha256:hash(JSON.stringify(element)),question_sha256:questionHash(set,question),source_hashes:Object.fromEntries(sources.map(unit=>[unit.id,unit.contentHash])),source_metadata_hashes:Object.fromEntries(sources.map(unit=>[unit.id,sourceUnitHash(unit)]))},
   provenance:{author_proposal:ref(file),source_locations:proposal.source_locations,original_question_ids:proposal.original_question_ids,frequency_treatment:proposal.reprint_treatment,
    scope:'선택한 대표 물음의 실제 criterion에 필요한 공식 단위와 출제 요소를 연결한다. 인접 요구를 직접 출제 빈도나 전체 물음 충족으로 확대하지 않는다.'}});
 }
}
fs.writeFileSync(R+'/coverage-proposals.json',JSON.stringify({version:1,artifact_type:'three_case_representative_coverage_proposals',created_at:new Date().toISOString(),human_review_performed:false,links},null,2)+'\n',{flag:'wx'});
console.log({coverage_proposals:links.length,root_relationship_review:'not_generated_root_must_record_actual_decisions'});
