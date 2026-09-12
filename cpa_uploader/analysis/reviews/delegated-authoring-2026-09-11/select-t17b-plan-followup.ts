import fs from 'node:fs';
import {prepareSemanticReview} from '../../../questionSemanticReview.ts';
import {jsonHash,sha256} from '../../../questionReviewIdentity.ts';
import type {QuestionSetV3} from '../../../../lib/questionV3.ts';
type Identity={file:string;sha256:string};
type Entry={plan_id:string;set_id:string;file:string;sha256:string;plan_files:Identity[]};
const root='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=<T>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T;
const hash=(file:string)=>sha256(fs.readFileSync(file));
const originalFile=`${root}/final-153-v3/manifest-plan-followup-01.json`;
const original=read<{entries:Entry[];[key:string]:unknown}>(originalFile),manifest=structuredClone(original);
const entry=manifest.entries.find(entry=>entry.plan_id==='T17-B');
if(!entry)throw Error('Missing T17-B');
const priorPlans=structuredClone(entry.plan_files);
const file='cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/phase-two-followup/t17-b-plan-v2/authoring-plan.json';
const digest='b05d8e24f2e939b89cd046c679173af9ae9f2aafd3f4cafc614bf536127357ad';
if(hash(file)!==digest)throw Error('Proposed plan changed');
entry.plan_files=[{file,sha256:digest}];
for(const item of manifest.entries){
 if(hash(item.file)!==item.sha256)throw Error('Question changed');
 if(item.plan_id!=='T17-B'&&jsonHash(item)!==jsonHash(original.entries.find(old=>old.plan_id===item.plan_id)))throw Error('Unrelated entry changed');
}
const raw=read<QuestionSetV3|QuestionSetV3[]>(entry.file),set=Array.isArray(raw)?raw[0]:raw;
const bankFile=`${root}/final-153-v3/comparison-bank.json`,bank=read<QuestionSetV3[]>(bankFile);
const prepare=(file:string)=>{
 const wrapper=read<{plans?:Array<{set_id:string}>}>(file),plan=wrapper.plans?wrapper.plans.find(p=>p.set_id===set.id):wrapper;
 return prepareSemanticReview(set,{bank:[...bank.filter(p=>p.id!==set.id),set],authoringPlan:plan,maxInputChars:500000});
};
const before=prepare(priorPlans[0].file),after=prepare(file);
if(before.contentHash!==after.contentHash||before.bankHash!==after.bankHash||jsonHash(before.sourceFiles)!==jsonHash(after.sourceFiles)||jsonHash(before.requestContext)===jsonHash(after.requestContext))throw Error('Unexpected input identity');
const proposal='cpa_uploader/drafts/delegated-authoring-2026-09-11/s06/phase-two-followup/t17-b-plan-v2/proposal-diff.json';
const selection={recorded_at:new Date().toISOString(),original_manifest:{file:originalFile,sha256:hash(originalFile)},plan_id:'T17-B',
 previous_plan_files:priorPlans,selected_plan_files:entry.plan_files,proposal:{file:proposal,sha256:hash(proposal)},
 reason:'이번 실제 검수에서 발견한 pilot-07-003/sub1/crit2와의 부분 중복을 내부회계관리제도 통합감사 적용복습으로 명시한다. 선정 통제의 테스트 의무와 개별통제 의견책임 구별은 유지하며, 겹치는 명제에 새 커버리지를 계상하지 않는다.',
 comparison_bank:{file:bankFile,sha256:hash(bankFile)},all_question_source_bank_bytes_unchanged:true,
 old_context_hash:jsonHash(before.context),new_context_hash:jsonHash(after.context),units:after.units.length,
 changed_contexts_from_immediate_predecessor:['T17-B'],changed_contexts_from_original_manifest:['T11-B','T17-B'],
 unchanged_entries_from_immediate_predecessor:48,proof_for_previous_selection:`${root}/t11b-plan-followup-selection.json`,
 actual_api_calls:0,publication:false};
manifest.followup_selection=selection;
const output=`${root}/final-153-v3/manifest-plan-followup-02.json`;
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(`${root}/t17b-plan-followup-selection.json`,JSON.stringify({...selection,selected_manifest:{file:output,sha256:hash(output)}},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:output,sha256:hash(output),changed_contexts:1,unchanged_entries:48,api_calls:0}));
