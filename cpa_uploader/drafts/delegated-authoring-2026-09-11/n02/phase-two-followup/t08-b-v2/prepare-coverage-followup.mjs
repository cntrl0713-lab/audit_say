import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/n02';
const original=base+'/coverage-proposal.json';
const value=JSON.parse(fs.readFileSync(original,'utf8'));
const file=base+'/phase-two-followup/t08-b-v2/pilot-08-007.json';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const set=JSON.parse(fs.readFileSync(file,'utf8'))[0];
const entries=value.entries.filter(e=>e.target.set_id===set.id).map(e=>({...e,target:{...e.target,file},reason:e.reason+' 후속 발문은 기존 crit3의 자료 이용 전제를 명시한 것으로, 새 원출제 빈도나 새로운 관계를 추가로 산입하지 않는다.',review_status:'needs_review'}));
for(const e of entries){const q=set.subquestions.find(q=>q.id===e.target.subquestion_id);if(!q||e.target.criterion_ids.some(id=>!q.criteria.some(c=>c.id===id)))throw Error('Target mismatch');}
fs.writeFileSync(base+'/phase-two-followup/t08-b-v2/coverage-proposal-followup.json',JSON.stringify({version:1,artifact_type:'coverage_proposal',package:'N02',created_at:new Date().toISOString(),scope:'Only active T08-B followup target path. Other original N02 entries remain in original proposal.',predecessor:{file:original,sha256:sha(original)},target_file_sha256:sha(file),entries,common_coverage_modified:false,relationships_or_frequency_counts_changed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({entries:entries.length,status:'needs_review',common_changes:false}));
