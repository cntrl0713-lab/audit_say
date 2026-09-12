import fs from 'node:fs';
import {prepareSemanticReview} from '../../../questionSemanticReview.ts';
import {jsonHash,sha256} from '../../../questionReviewIdentity.ts';
import type {QuestionSetV3} from '../../../../lib/questionV3.ts';
type Identity={file:string;sha256:string};
type Entry={plan_id:string;set_id:string;file:string;sha256:string;plan_files:Identity[]};
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const originalFile=`${root}/final-153-v3/manifest.json`;
const read=<T>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const hash=(file:string)=>sha256(fs.readFileSync(file));
const original=read<{entries:Entry[];[key:string]:unknown}>(originalFile);
const planFile='cpa_uploader/drafts/delegated-authoring-2026-09-11/n04/phase-two-followup/t11-b-plan-v2/pilot-11-006.json.authoring-plan.v2.json';
const expected='dfe28252a99aeeb8ef3c832d8725fa1c21bf36556a23f9ff07d48f7818b03ac5';
if(hash(planFile)!==expected)throw Error('Proposed plan changed');
const manifest=structuredClone(original);
const selected=manifest.entries.find(entry=>entry.plan_id==='T11-B');
if(!selected)throw Error('No T11-B');
const beforePlans=structuredClone(selected.plan_files);
selected.plan_files=[{file:planFile,sha256:expected}];
const bankFile=`${root}/final-153-v3/comparison-bank.json`,bank=read<QuestionSetV3[]>(bankFile);
const comparisons=[];
for(const entry of manifest.entries){
 const old=original.entries.find(item=>item.plan_id===entry.plan_id)!;
 if(hash(entry.file)!==entry.sha256)throw Error('Frozen question changed');
 const raw=read<QuestionSetV3|QuestionSetV3[]>(entry.file),set=Array.isArray(raw)?raw[0]:raw;
 const prepare=(file:string)=>{
  const wrapper=read<{plans?:Array<{set_id:string}>}>(file),plan=wrapper.plans?wrapper.plans.find(item=>item.set_id===set.id):wrapper;
  return prepareSemanticReview(set,{bank:[...bank.filter(peer=>peer.id!==set.id),set],authoringPlan:plan,maxInputChars:500000});
 };
 const previous=prepare(old.plan_files[0].file),current=prepare(entry.plan_files[0].file);
 const row={plan_id:entry.plan_id,content_same:previous.contentHash===current.contentHash,bank_same:previous.bankHash===current.bankHash,
  sources_same:jsonHash(previous.sourceFiles)===jsonHash(current.sourceFiles),context_same:jsonHash(previous.requestContext)===jsonHash(current.requestContext),
  old_context_hash:jsonHash(previous.context),new_context_hash:jsonHash(current.context),units:current.units.length};
 if(!row.content_same||!row.bank_same||!row.sources_same||row.context_same===(entry.plan_id==='T11-B'))throw Error(`Unexpected input change: ${entry.plan_id}`);
 comparisons.push(row);
}
const at=new Date().toISOString();
const lineageFile='cpa_uploader/drafts/delegated-authoring-2026-09-11/n04/phase-two-followup/t11-b-plan-v2/lineage.json';
const selection={recorded_at:at,original_manifest:{file:originalFile,sha256:hash(originalFile)},plan_id:'T11-B',
 previous_plan_files:beforePlans,selected_plan_files:selected.plan_files,lineage:{file:lineageFile,sha256:hash(lineageFile)},
 reason:'실제 후속 검토로 발견한 pilot-05-006/sub2/crit3와의 중복을 명시적 특수관계자 계약검사 적용 복습으로 재분류한다. 기존 계획에 이 비교가 있었다고 소급하지 않는다. 신규 커버리지로 세지 않으며 다른 네 요구와 모든 기존 문항 ID·배점은 유지한다.',
 comparison_bank:{file:bankFile,sha256:hash(bankFile)},all_question_source_bank_bytes_unchanged:true,
 changed_semantic_contexts:['T11-B'],unchanged_semantic_contexts:comparisons.filter(row=>row.context_same).map(row=>row.plan_id),
 actual_model_calls:0,publication:false};
manifest.followup_selection=selection;
const file=`${root}/final-153-v3/manifest-plan-followup-01.json`;
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(`${root}/t11b-plan-followup-selection.json`,JSON.stringify({...selection,selected_manifest:{file,sha256:hash(file)},comparisons},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file,manifest_sha256:hash(file),changed_contexts:1,unchanged_contexts:48,bank_sha256:hash(bankFile),api_calls:0}));
