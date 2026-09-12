import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { inspectBankSnapshot, learningCatalogForBank } from '../../../../scripts/import-question-bank-v3.ts';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';

const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous=`${root}/prepared-reviewed-v5`,output=`${root}/prepared-reviewed-v6`;
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const identity=(file:string)=>({file,sha256:sha(fs.readFileSync(file))});
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
if(fs.existsSync(output))throw Error('Preserve all earlier candidate versions.');
const proposalFile=`${root}/a/official-source-remediation-v2/proposals.json`,proposal=read(proposalFile);
if(proposal.bank_sha256!==identity(`${previous}/candidate-authoring.json`).sha256||proposal.entries.length!==1)throw Error('Unexpected correction inventory.');
const entry=proposal.entries[0];
if(entry.set_id!=='pilot-02-004'||entry.source_ref_id!=='src2'||entry.requirements.length!==1)throw Error('Unexpected correction scope.');
const bank:QuestionSetV3[]=read(`${previous}/candidate-authoring.json`),set=bank.find(set=>set.id===entry.set_id)!;
const sourceIndex=set.source_refs.findIndex(source=>source.id===entry.source_ref_id);
if(JSON.stringify(set.source_refs[sourceIndex])!==JSON.stringify(entry.before_source_ref))throw Error('Before source differs.');
const source=entry.after_source_ref;
if(source.id!==entry.source_ref_id||source.file!==entry.before_source_ref.file||!fs.readFileSync(source.file,'utf8').includes(source.source_quote)||source.content_hash!==sha(source.source_quote))throw Error('Source quote/hash is not exact.');
const normalized=source.source_quote.replace(/\s/g,'');
if(!normalized.endsWith('은항상존재할것이다.')||!normalized.includes('감사의고유한계때문에제거될수는없다.'))throw Error('A49 conclusion remains incomplete.');
set.source_refs[sourceIndex]=source;
for(const row of entry.requirements){
    const sub=set.subquestions.find(sub=>sub.id===row.subquestion_id)!,index=sub.requirements.findIndex(req=>req.id===row.requirement_id);
    if(JSON.stringify(sub.requirements[index])!==JSON.stringify(row.before)||row.after.id!==row.before.id||row.after.source_ref_id!==source.id)throw Error('Requirement identity mismatch.');
    sub.requirements[index]=row.after;
}
const validation=validateAuthoringBank(bank);if(validation.errors.length)throw Error(JSON.stringify(validation.errors));
const publicSets=bank.map(compilePublicQuestionSet),bankBytes=JSON.stringify(bank,null,2)+'\n',publicBytes=JSON.stringify(publicSets,null,2)+'\n';
const review={...read(`${previous}/classification-review.json`),source_file:`${output}/candidate-authoring.json`,source_file_sha256:sha(bankBytes),predecessor_file:`${previous}/classification-review.json`};
const reviewBytes=JSON.stringify(review,null,2)+'\n',priorCatalog=read(`${previous}/learning-question-classifications.json`);
const compiled=compileLearningCatalog(bank,review.entries,priorCatalog.topics);
const learningCatalog={...priorCatalog,source_file:review.source_file,source_file_sha256:sha(bankBytes),public_content_hash:contentHash(publicSets),review_file:`${output}/classification-review.json`,review_file_sha256:sha(reviewBytes),classifications:compiled.classifications};
const inspection=inspectBankSnapshot(bankBytes,publicBytes);
if(inspection.report.source_hash_mismatches.length)throw Error('Source quote mismatch.');
const priorOverrides=read(`${previous}/plan-overrides.json`),priorPlan=priorOverrides.entries.find((row:{set_id:string})=>row.set_id===set.id);
if(identity(priorPlan.file).sha256!==priorPlan.sha256)throw Error('Prior plan changed.');
const plan=read(priorPlan.file),catalog=buildSourceCatalog();
const mapping=plan.metadata.source_mapping_evidence.find((row:{source_ref_id:string})=>row.source_ref_id===source.id);
mapping.source_quote_sha256=source.content_hash;
mapping.semantic_comparison=entry.semantic_comparison;
mapping.units=entry.catalog_unit_ids.map((id:string)=>{
    const unit=catalog.units.find(unit=>unit.id===id&&unit.file===source.file);
    if(!unit||unit.authority!=='official_transcription')throw Error('Unknown official source unit.');
    return {id:unit.id,file:unit.file,authority:unit.authority,standard:unit.standard,paragraph:unit.paragraph,locator:unit.locator,quote_sha256:sha(unit.quote),
        quote_relation:source.source_quote.includes(unit.quote)?'source_contains_catalog_quote':unit.quote.includes(source.source_quote)?'catalog_contains_source_quote':'anchor_with_explicit_continuation_in_full_source_quote'};
});
plan.source_unit_ids=[...new Set(plan.metadata.source_mapping_evidence.flatMap((row:{units:Array<{id:string}>})=>row.units.map(unit=>unit.id)).concat(plan.source_unit_ids))];
plan.metadata.source_followup={predecessor:priorPlan,bank:{file:review.source_file,sha256:sha(bankBytes)},evidence_file:proposalFile,
    official_text_comparison:'Restore the entire official A49 conclusion after independent peer review detected a truncated quotation. No scored proposition or grading answer changed; actual model review remains required.'};
const planErrors=validateQuestionAuthoringPlan(plan);if(planErrors.length)throw Error(planErrors.join('; '));
const planFile=`${output}/pilot-02-004-plan.json`,planBytes=JSON.stringify(plan,null,2)+'\n';
const priorCorrections=read(`${previous}/official-source-corrections.json`),priorSummary=read(`${previous}/summary.json`);
fs.mkdirSync(output);
const write=(file:string,value:unknown)=>fs.writeFileSync(`${output}/${file}`,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('candidate-authoring.json',bankBytes);write('candidate-public.json',publicBytes);write('classification-review.json',reviewBytes);
write('learning-question-classifications.json',learningCatalog);write('db-learning-metadata.json',learningCatalogForBank(bank,learningCatalog));
write('pilot-02-004-plan.json',planBytes);
write('plan-overrides.json',{created_at:new Date().toISOString(),bank:{file:review.source_file,sha256:sha(bankBytes)},entries:priorOverrides.entries.map((row:{set_id:string})=>row.set_id===set.id?{set_id:set.id,file:planFile,sha256:sha(planBytes)}:row)});
write('official-source-corrections.json',{...priorCorrections,created_at:new Date().toISOString(),predecessor:identity(`${previous}/official-source-corrections.json`),
    inputs:[...priorCorrections.inputs,identity(proposalFile)],changes:[...priorCorrections.changes,{owner:'a',...entry}],quote_completion:identity(proposalFile)});
write('summary.json',{...priorSummary,created_at:new Date().toISOString(),predecessor:`${previous}/summary.json`,source_corrections:56,
    quote_completion:{set_id:set.id,source_ref_id:source.id,model_review:'not_run'},validation:{...priorSummary.validation,import_preconditions:inspection.report}});
console.log(JSON.stringify({output,bank_sha256:sha(bankBytes),source_corrections:1,grading_contract_changes:0,api_calls:0}));
