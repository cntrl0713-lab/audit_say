import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { inspectBankSnapshot, learningCatalogForBank } from '../../../../scripts/import-question-bank-v3.ts';

// Integrate the independently checked duplicate-score correction into a fresh review bank.
// No promotion, model calls, canonical writes, or database mutations.
const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous=`${root}/prepared-reviewed-v3`,output=`${root}/prepared-reviewed-v4`;
const correction=`${root}/a/pilot-08-007-remediation-v1`;
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const inputs:Array<{file:string;sha256:string}>=[];
function read(file:string){const bytes=fs.readFileSync(file);inputs.push({file,sha256:sha(bytes)});return JSON.parse(bytes.toString('utf8'));}
const identity=(file:string)=>({file,sha256:sha(fs.readFileSync(file))});
if(fs.existsSync(output)||fs.existsSync(`${root}/qa-prepared-v2`))throw Error('Use a fresh version; earlier artifacts are immutable.');
const bank:QuestionSetV3[]=read(`${previous}/candidate-authoring.json`);
const priorSummary=read(`${previous}/summary.json`);
const priorReview=read(`${previous}/classification-review.json`);
const priorCatalog=read(`${previous}/learning-question-classifications.json`);
const replacement:QuestionSetV3=read(`${correction}/question.json`);
const original=bank.find(set=>set.id==='pilot-08-007')!;
if(replacement.id!==original.id)throw Error('Unexpected replacement ID');
const exceptQuestion=(set:QuestionSetV3)=>({...set,subquestions:undefined});
if(JSON.stringify(exceptQuestion(original))!==JSON.stringify(exceptQuestion(replacement)))throw Error('Only the reviewed question scope may change.');
if(JSON.stringify(original.subquestions.slice(0,2))!==JSON.stringify(replacement.subquestions.slice(0,2)))throw Error('Earlier questions must remain exact.');
const oldSub=original.subquestions[2],newSub=replacement.subquestions[2];
const exceptChanged=(sub:typeof oldSub)=>({...sub,prompt:undefined,model_answer:undefined,criteria:undefined});
if(newSub.id!=='sub3'||JSON.stringify(exceptChanged(oldSub))!==JSON.stringify(exceptChanged(newSub)))throw Error('Unexpected third-question contract change.');
if(JSON.stringify(oldSub.criteria.filter(row=>row.id!=='crit13'))!==JSON.stringify(newSub.criteria))throw Error('Surviving criteria must remain exact.');
if(JSON.stringify(oldSub.model_answer.slice(0,-1))!==JSON.stringify(newSub.model_answer))throw Error('Only duplicated answer content may be removed.');
if(computeQuestionSetMaxPoints(original)!==13||computeQuestionSetMaxPoints(replacement)!==12)throw Error('Unexpected score transition.');
bank[bank.indexOf(original)]=replacement;
const validation=validateAuthoringBank(bank);if(validation.errors.length)throw Error(JSON.stringify(validation.errors));
const publicSets=bank.map(compilePublicQuestionSet);
const bankBytes=JSON.stringify(bank,null,2)+'\n',publicBytes=JSON.stringify(publicSets,null,2)+'\n';
const review={...priorReview,source_file:`${output}/candidate-authoring.json`,source_file_sha256:sha(bankBytes),
    predecessor_file:`${previous}/classification-review.json`};
const reviewBytes=JSON.stringify(review,null,2)+'\n';
const {classifications,units}=compileLearningCatalog(bank,review.entries,priorCatalog.topics);
const catalog={...priorCatalog,source_file:review.source_file,source_file_sha256:sha(bankBytes),public_content_hash:contentHash(publicSets),
    review_file:`${output}/classification-review.json`,review_file_sha256:sha(reviewBytes),classifications};
const inspection=inspectBankSnapshot(bankBytes,publicBytes);
if(inspection.report.source_hash_mismatches.length)throw Error('Source quote hash mismatch.');
const oldQA=read(`${root}/qa-prepared-v1/manifest.json`);
const newQA=read(`${correction}/qa.json`);
const plan=read(`${correction}/authoring-plan.json`);
if(plan.set_id!==replacement.id)throw Error('Wrong correction plan.');
const qaEntry=oldQA.entries.find((row:{set_id:string})=>row.set_id===replacement.id);
const oldQABody=read(qaEntry.file);
const cases=(body:{cases:unknown[]})=>body.cases;
if(!Array.isArray(cases(newQA))||!Array.isArray(cases(oldQABody)))throw Error('Unexpected QA format.');
const newQAEntry={...qaEntry,...identity(`${correction}/qa.json`),cases:newQA.cases.length};
const qaManifest={...oldQA,created_at:new Date().toISOString(),predecessor:identity(`${root}/qa-prepared-v1/manifest.json`),
    status:'corrected_expected_judgments_model_not_run',bank_file:`${output}/candidate-authoring.json`,bank_sha256:sha(bankBytes),
    unique_cases:oldQA.unique_cases-qaEntry.cases+newQAEntry.cases,correction:identity(`${correction}/remediation.json`),
    inputs:[...oldQA.inputs,...inputs],entries:oldQA.entries.map((row:{set_id:string})=>row.set_id===replacement.id?newQAEntry:row)};
const overrides={created_at:new Date().toISOString(),entries:[{set_id:replacement.id,...identity(`${correction}/authoring-plan.json`)}]};
for(const input of inputs)if(identity(input.file).sha256!==input.sha256)throw Error(`Changed input: ${input.file}`);
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(`${root}/qa-prepared-v2`);
function write(file:string,value:unknown){fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
write(`${output}/candidate-authoring.json`,bankBytes);write(`${output}/candidate-public.json`,publicBytes);
write(`${output}/classification-review.json`,reviewBytes);write(`${output}/learning-question-classifications.json`,catalog);
write(`${output}/db-learning-metadata.json`,learningCatalogForBank(bank,catalog));
write(`${output}/plan-overrides.json`,overrides);
write(`${root}/qa-prepared-v2/manifest.json`,qaManifest);
write(`${output}/summary.json`,{...priorSummary,created_at:new Date().toISOString(),predecessor:`${previous}/summary.json`,
    new:{...priorSummary.new,points:priorSummary.new.points-1},combined:{...priorSummary.combined,points:bank.reduce((n,set)=>n+computeQuestionSetMaxPoints(set),0)},
    remediation:{set_id:replacement.id,retired_criterion:'sub3/crit13',retained_criterion:'sub2/crit5',before_points:13,after_points:12,
        reason:'Same contract recognition-date and recorded-period comparison was scored in two questions; scope retained once.',inputs},
    validation:{structure_source_quotes_duplicates:'passed',learning_units:units.length,import_preconditions:inspection.report,
        model_semantic_review:'new_comparison_bank_requires_new_review',model_grading:'not_run',human_review:'not_asserted',production_db:'not_applied'}});
console.log(JSON.stringify({output,bank_sha256:sha(bankBytes),sets:bank.length,points:bank.reduce((n,set)=>n+computeQuestionSetMaxPoints(set),0),qa_cases:qaManifest.unique_cases,api_calls:0}));
