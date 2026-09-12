import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { inspectBankSnapshot, learningCatalogForBank } from '../../../../scripts/import-question-bank-v3.ts';

const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous=`${root}/prepared-reviewed-v4`,output=`${root}/prepared-reviewed-v5`;
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const inputs:Array<{file:string;sha256:string}>=[];
const read=(file:string)=>{const bytes=fs.readFileSync(file);inputs.push({file,sha256:sha(bytes)});return JSON.parse(bytes.toString('utf8'));};
const identity=(file:string)=>({file,sha256:sha(fs.readFileSync(file))});
const bank:QuestionSetV3[]=read(`${previous}/candidate-authoring.json`);
const original=structuredClone(bank);
const inventory=read(`${root}/official-source-remediation-inventory-v1.json`);
const priorSummary=read(`${previous}/summary.json`),priorReview=read(`${previous}/classification-review.json`);
const priorCatalog=read(`${previous}/learning-question-classifications.json`);
const catalog=buildSourceCatalog();
if(fs.existsSync(output))throw Error('Prior prepared banks are immutable.');
const seen=new Set<string>();
const changes:Array<Record<string,unknown>>=[];
for(const owner of ['a','b','c']){
    const file=`${root}/${owner}/official-source-remediation-v1/proposals.json`;
    const proposals=read(file);
    if(proposals.bank_sha256!==identity(`${previous}/candidate-authoring.json`).sha256)throw Error(`${owner}: wrong source bank`);
    for(const entry of proposals.entries){
        const key=`${entry.set_id}/${entry.source_ref_id}`;
        if(seen.has(key)||!inventory.rows.some((row:{set_id:string;source_ref_id:string})=>`${row.set_id}/${row.source_ref_id}`===key))throw Error(`Unexpected or repeated source correction ${key}`);
        seen.add(key);
        const set=bank.find(set=>set.id===entry.set_id)!;
        const source=set.source_refs.find(source=>source.id===entry.source_ref_id)!;
        if(JSON.stringify(source)!==JSON.stringify(entry.before_source_ref))throw Error(`${key}: before source differs`);
        const after=entry.after_source_ref;
        if(after.id!==source.id||!catalog.sources.some(row=>row.file===after.file&&row.authority==='official_transcription'))throw Error(`${key}: actual registered official source required`);
        const text=fs.readFileSync(after.file,'utf8');inputs.push(identity(after.file));
        if(!text.includes(after.source_quote)||after.content_hash!==sha(after.source_quote))throw Error(`${key}: source quote bytes/hash invalid`);
        if(!Array.isArray(entry.catalog_unit_ids)||!entry.catalog_unit_ids.length||entry.catalog_unit_ids.some((id:string)=>!catalog.units.some(unit=>unit.id===id&&unit.file===after.file&&unit.authority==='official_transcription')))throw Error(`${key}: actual official catalog IDs required`);
        set.source_refs[set.source_refs.indexOf(source)]=after;
        const expected=set.subquestions.flatMap(sub=>sub.requirements.filter(req=>req.source_ref_id===source.id).map(req=>`${sub.id}/${req.id}`));
        if(JSON.stringify([...expected].sort())!==JSON.stringify(entry.requirements.map((row:{subquestion_id:string;requirement_id:string})=>`${row.subquestion_id}/${row.requirement_id}`).sort()))throw Error(`${key}: incomplete requirement mapping`);
        for(const row of entry.requirements){
            const sub=set.subquestions.find(sub=>sub.id===row.subquestion_id)!;
            const req=sub.requirements.find(req=>req.id===row.requirement_id)!;
            if(JSON.stringify(req)!==JSON.stringify(row.before)||row.after.id!==req.id||row.after.source_ref_id!==req.source_ref_id)throw Error(`${key}: requirement identity differs`);
            sub.requirements[sub.requirements.indexOf(req)]=row.after;
        }
        changes.push({owner,...entry});
    }
}
if(seen.size!==inventory.rows.length)throw Error(`Official source follow-up is incomplete: ${seen.size}/${inventory.rows.length}`);
// Source modernization alone must not change grading or learning contracts.
const gradingContract=(set:QuestionSetV3)=>({...set,source_refs:undefined,subquestions:set.subquestions.map(sub=>({...sub,requirements:undefined}))});
for(const set of bank)if(JSON.stringify(gradingContract(set))!==JSON.stringify(gradingContract(original.find(row=>row.id===set.id)!)))throw Error(`${set.id}: source correction changed a question contract`);
const scopeFile=`${root}/a/official-source-remediation-v1/scope-clarification-pilot-03-001.json`;
const scope=read(scopeFile);
const scopedQuestion=bank.find(set=>set.id===scope.set_id)!.subquestions.find(sub=>sub.id===scope.subquestion_id)!;
if(scope.set_id!=='pilot-03-001'||scope.subquestion_id!=='sub1'||scopedQuestion.prompt!==scope.proposal.before_prompt)throw Error('Unexpected scope clarification.');
scopedQuestion.prompt=scope.proposal.after_prompt;
const scopedClassification=priorReview.entries.find((entry:{set_id:string;subquestion_id:string})=>entry.set_id===scope.set_id&&entry.subquestion_id===scope.subquestion_id);
if(scopedClassification.standalone_prompt!==null)throw Error('Standalone prompt needs an explicit overlay review.');
scopedClassification.reason+=' 후속 원문 대조에서 발문을 수임 적합성과 법규상 예외로 명료화했다. 강제 수임 후 의사소통은 별도 득점 요구가 아니다.';
const validation=validateAuthoringBank(bank);if(validation.errors.length)throw Error(JSON.stringify(validation.errors));
const publicSets=bank.map(compilePublicQuestionSet),bankBytes=JSON.stringify(bank,null,2)+'\n',publicBytes=JSON.stringify(publicSets,null,2)+'\n';
const review={...priorReview,source_file:`${output}/candidate-authoring.json`,source_file_sha256:sha(bankBytes),predecessor_file:`${previous}/classification-review.json`};
const reviewBytes=JSON.stringify(review,null,2)+'\n';
const compiled=compileLearningCatalog(bank,review.entries,priorCatalog.topics);
const learningCatalog={...priorCatalog,source_file:review.source_file,source_file_sha256:sha(bankBytes),public_content_hash:contentHash(publicSets),
    review_file:`${output}/classification-review.json`,review_file_sha256:sha(reviewBytes),classifications:compiled.classifications};
const inspection=inspectBankSnapshot(bankBytes,publicBytes);
if(inspection.report.source_hash_mismatches.length)throw Error('Unresolved source quote hashes');
for(const input of inputs)if(identity(input.file).sha256!==input.sha256)throw Error(`Input changed: ${input.file}`);
fs.mkdirSync(output);
const write=(name:string,value:unknown)=>fs.writeFileSync(`${output}/${name}`,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('candidate-authoring.json',bankBytes);write('candidate-public.json',publicBytes);write('classification-review.json',reviewBytes);
write('learning-question-classifications.json',learningCatalog);write('db-learning-metadata.json',learningCatalogForBank(bank,learningCatalog));
write('official-source-corrections.json',{created_at:new Date().toISOString(),inputs,changes,scope_clarification:{file:scopeFile,proposal:scope.proposal},api_calls:0});
write('summary.json',{...priorSummary,created_at:new Date().toISOString(),predecessor:`${previous}/summary.json`,source_corrections:changes.length,
    combined:{...priorSummary.combined,points:bank.reduce((n,set)=>n+computeQuestionSetMaxPoints(set),0)},
    validation:{structure_source_quotes_duplicates:'passed',learning_units:compiled.units.length,import_preconditions:inspection.report,
        model_semantic_review:'new_sources_and_comparison_bank_require_new_review',model_grading:'not_completed',human_review:'not_asserted',production_db:'not_applied'}});
console.log(JSON.stringify({output,sets:bank.length,source_corrections:changes.length,bank_sha256:sha(bankBytes),api_calls:0}));
