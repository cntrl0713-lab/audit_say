import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
import {assembleCoverage,questionHash} from '../../coverage/build-coverage.mjs';

const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const file='cpa_uploader/analysis/coverage/links.json';
const proposalFile=control+'/coverage-proposals-final-153-v1.json';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const before=fs.readFileSync(file),previous=read(file),proposal=read(proposalFile);
if(proposal.errors.length||proposal.links.length!==150)throw Error('150개 후보 관계 확인 필요');
const baseline=read(control+'/input-baseline.json').files.find(row=>row.file===file);
if(sha(before)!==baseline.sha256)throw Error('기존 관계가 바뀌었으므로 다시 대조해야 함');
const replacements=[],additions=[],drafts=[];
const updated=structuredClone(previous);
for(const candidate of proposal.links){
 const raw=read(candidate.target.file);
 const set=(Array.isArray(raw)?raw:[raw]).find(set=>set.id===candidate.target.set_id);
 const question=set?.subquestions.find(question=>question.id===candidate.target.subquestion_id);
 if(!question||questionHash(set,question)!==candidate.snapshot.question_sha256)throw Error(`${candidate.id}: 제안 이후 문항 변경`);
 if(!drafts.some(draft=>draft.file===candidate.target.file&&draft.set.id===set.id))drafts.push({file:candidate.target.file,set});
 const index=previous.links.findIndex(link=>link.element_id===candidate.element_id&&link.target?.scope==='draft'
  &&link.target.set_id===candidate.target.set_id&&link.target.subquestion_id===candidate.target.subquestion_id);
 const next={...candidate,review_status:'needs_review',provenance:{...candidate.provenance,
  cohort_manifest:control+'/final-153-v1/manifest.json',meaning_comparison:control+'/coverage-followup-paired-review.json',
  application_note:'담당자의 실제 원문·원발문·후속 초안 대조 근거와 현재 식별자를 확인한 후보 관계다. 의미검수·채점·사람 승인과 별개이며 needs_review를 유지한다.'}};
 if(index>=0){
  const old=updated.links[index];
  next.id=old.id;
  next.provenance.previous_link=old;
  next.provenance.proposed_followup_id=candidate.id;
  next.reason=candidate.reason+' 기존 관계의 후속 대상·공식 출처를 대조하여 현재 활성 초안에 연결했다. 이전 대상·해시·관계는 provenance.previous_link에 보존한다.';
  updated.links[index]=next;
  replacements.push({id:old.id,old_file:old.target.file,new_file:next.target.file,old_relationship:old.relationship,new_relationship:next.relationship});
 }else{
  if(updated.links.some(link=>link.id===next.id))throw Error('관계 ID 충돌');
  updated.links.push(next);additions.push(next.id);
 }
}
const catalog=buildSourceCatalog();
const assembled=assembleCoverage({dataset:read('cpa_uploader/analysis/question-elements/question-elements.json'),
 bank:read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),catalog,overlay:updated,inputs:{},drafts});
if(replacements.length!==15||additions.length!==135||updated.links.length!==166)throw Error('관계 수동 대조 범위와 불일치');
fs.writeFileSync(control+'/coverage-before-followup.json',before,{flag:'wx'});
fs.writeFileSync(file,JSON.stringify(updated,null,2)+'\n');
const result={applied_at:new Date().toISOString(),file,previous_sha256:sha(before),current_sha256:sha(fs.readFileSync(file)),
 proposal_file:proposalFile,proposal_sha256:sha(fs.readFileSync(proposalFile)),replacements,additions,total_links:updated.links.length,
 current_new_draft_links:proposal.links.length,reviewed_links:assembled.links.filter(link=>link.review_status==='reviewed').length,
 stale_links:assembled.links.filter(link=>link.freshness==='stale').map(link=>({id:link.id,changed_inputs:link.changed_inputs})),
 policy:'15개 이전 활성초안 관계를 실제 요구 차이와 연결해 후속 경로로 갱신하고 135개 후보 관계를 추가했다. 기존13개R01의직접/부분관계는유지하며 R02의원발문일부요구와전체기준요구 차이2건은partial로정정했다. 모든새관계는needs_review이며 은행/공개본/모델입력은변경하지 않았다.'};
fs.writeFileSync(control+'/coverage-followup-applied.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file,replaced:replacements.length,added:additions.length,total:updated.links.length,reviewed:result.reviewed_links,stale:result.stale_links}));
