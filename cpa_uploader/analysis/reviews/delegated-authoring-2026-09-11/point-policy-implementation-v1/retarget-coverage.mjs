import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {questionHash} from '../../../coverage/build-coverage.mjs';
const [manifestFile]=process.argv.slice(2);
if(!manifestFile)throw Error('Current point-policy manifest required');
const work='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/point-policy-implementation-v1';
const file='cpa_uploader/analysis/coverage/links.json';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=read(manifestFile);
if(!manifest.point_policy||manifest.errors.length)throw Error('Validated point-policy selection required');
const audits=read(manifest.point_policy.report_file).audits;
const before=fs.readFileSync(file),overlay=read(file);
const previous=read(manifest.predecessor.file);
const load=entry=>{if(hash(fs.readFileSync(entry.file))!==entry.sha256)throw Error('Question bytes changed');const raw=read(entry.file);return Array.isArray(raw)?raw[0]:raw;};
const changes=[];
const updated=overlay.links.map(link=>{
 if(link.target?.scope!=='draft')return link;
 const entry=manifest.entries.find(e=>e.set_id===link.target.set_id);
 if(!entry)return link;
 const old=previous.entries.find(e=>e.set_id===entry.set_id);
 if(entry.file===old.file)return link;
 if(link.target.file!==old.file)throw Error(`Unexpected previous target ${link.id}`);
 const oldSet=load(old),newSet=load(entry);
 const oldSub=oldSet.subquestions.find(q=>q.id===link.target.subquestion_id),newSub=newSet.subquestions.find(q=>q.id===link.target.subquestion_id);
 if(!oldSub||!newSub)throw Error('Subquestion lost');
 const audit=audits.find(q=>q.set_id===entry.set_id&&q.id===newSub.id);
 if(!audit)throw Error('No complete per-question review');
 const map=new Map(audit.criterion_mapping.map(m=>[m.old_id,m]));
 const targetIds=link.target.criterion_ids.flatMap(id=>{const item=map.get(id);if(!item)throw Error(`Missing criterion mapping ${link.id}/${id}`);return item.new_ids;});
 if(new Set(targetIds).size!==targetIds.length||targetIds.some(id=>!newSub.criteria.some(c=>c.id===id)))throw Error('Invalid mapped targets');
 // Preserve the historical semantic snapshot. A changed question remains stale
 // until the source/element relationship is separately reviewed.
 const currentHash=questionHash(newSet,newSub),oldHash=questionHash(oldSet,oldSub);
 const note=`승인된 요소별 배점 적용으로 활성 초안과 criterion 전후 대응을 연결했다. 물음별 배점 검토: ${audit.rationale} 원출제·빈도·관계 종류와 당시 의미대조 snapshot은 보존한다. 바뀐 물음의 관계 재검토를 완료한 것으로 표시하지 않는다.`;
 const next={...link,target:{...link.target,file:entry.file,criterion_ids:targetIds},reason:`${link.reason} ${note}`,review_status:'needs_review',
  provenance:{...link.provenance,previous_link:link,cohort_manifest:manifestFile,candidate_sha256:entry.sha256,
   point_policy_audit:manifest.point_policy.report_file,point_policy_mapping:audit.criterion_mapping,
   application_note:'Active draft and explicit criterion mapping only. Historical snapshot retained; no frequency or coverage expansion, semantic relationship acceptance, publication, or model calls.'}};
 changes.push({id:link.id,plan_id:entry.plan_id,subquestion_id:newSub.id,relationship:link.relationship,
  previous_file:old.file,current_file:entry.file,previous_criterion_ids:link.target.criterion_ids,current_criterion_ids:targetIds,
  previous_snapshot_hash:link.snapshot.question_sha256,previous_active_hash:oldHash,current_active_hash:currentHash,
  snapshot_preserved:true,expected_stale:link.snapshot.question_sha256!==currentHash,reason:audit.rationale});
 return next;
});
if(new Set(updated.map(link=>link.id)).size!==overlay.links.length)throw Error('Relationship IDs changed');
const after=JSON.stringify({...overlay,links:updated},null,2)+'\n';
const record={recorded_at:new Date().toISOString(),manifest_file:manifestFile,manifest_sha256:hash(fs.readFileSync(manifestFile)),
 file,before_sha256:hash(before),after_sha256:hash(after),total_links:updated.length,added_links:0,removed_links:0,
 updated_links:changes.length,changed_question_hashes:changes.filter(c=>c.previous_active_hash!==c.current_active_hash).length,
 snapshot_policy:'Historical snapshots retained; changed questions are pending relationship re-review',changes,api_calls:0};
fs.writeFileSync(`${work}/coverage-before.json`,before,{flag:'wx'});
fs.writeFileSync(`${work}/coverage-retarget-record.json`,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
if(hash(fs.readFileSync(file))!==hash(before))throw Error('Concurrent coverage change');
fs.writeFileSync(file,after);
console.log(JSON.stringify({updated_links:changes.length,total_links:updated.length,stale_targets:changes.filter(c=>c.expected_stale).length,added_links:0,api_calls:0}));
