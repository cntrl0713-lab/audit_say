import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { buildReviewChunkInput, prepareSemanticReview } from '../../../questionSemanticReview.ts';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
import { validateQuestionAuthoringPlan } from '../../../questionAuthoringPlan.ts';

// Preflight only: no model client, grading call, promotion, or DB mutation.
const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const mode=process.argv[2]??'--all';
if(process.argv.length>3||!['--all','--new-only','--existing-only'].includes(mode))throw Error('Use --all, --new-only, or --existing-only.');
const output=`${root}/execution-${mode==='--all'?'all':mode==='--new-only'?'new':'existing'}-v3`;
const bankFile=`${root}/prepared-reviewed-v5/candidate-authoring.json`;
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const identity=(file:string)=>({file,sha256:sha(fs.readFileSync(file))});
const verify=(row:{file:string;sha256:string})=>{if(identity(row.file).sha256!==row.sha256)throw Error(`Changed input: ${row.file}`);};
if(fs.existsSync(output))throw Error('Execution versions are immutable; use a new directory.');
const bank:QuestionSetV3[]=read(bankFile);
const before:QuestionSetV3[]=read(`${root}/prepared-reviewed-v4/candidate-authoring.json`);
const qaManifestFile=`${root}/qa-prepared-v3/manifest.json`;
const qaManifest=read(qaManifestFile);
const plansIndexFile=`${root}/c/review-plans/index.json`;
const plansIndex=mode==='--new-only'?{entries:[]}:read(plansIndexFile);
const newManifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-style-v2/manifest.json';
const newManifest=read(newManifestFile);
const summary=read(`${root}/prepared-reviewed-v5/summary.json`);
const overrideFile=`${root}/prepared-reviewed-v5/plan-overrides.json`;
const overrides=read(overrideFile);
const selected=new Set<string>([...(mode==='--new-only'?[]:summary.canonical.changed_sets),
    ...(mode==='--existing-only'?[]:newManifest.entries.map((entry:{set_id:string})=>entry.set_id))]);
const catalog=buildSourceCatalog();
const codeFiles=read(`${root}/execution-runtime-v3.json`).code_files;
for(const row of codeFiles)verify(row);
const extraCode=['cpa_uploader/questionReviewIdentity.ts','lib/learningUnits.ts','lib/learningSubmission.ts',
    'cpa_uploader/questionSourceCatalog.d.mts','cpa_uploader/questionV3Authoring.ts',`${root}/b/validation-worker.mjs`,
    'package.json','package-lock.json'].filter(file=>fs.existsSync(file));
const globalFiles=[...codeFiles,...extraCode.map(identity),...catalog.sources.map(source=>identity(source.file)),
    identity('cpa_uploader/data/회계감사_통합학습자료/00_통합_목차.md'),identity(catalog.registry.topic19.metadataFile),
    identity(qaManifestFile),identity(overrideFile),...(mode==='--new-only'?[]:[identity(plansIndexFile)]),identity(newManifestFile)];
const uniqueGlobal=[...new Map(globalFiles.map(row=>[row.file,row])).values()];
const jobs:Array<Record<string,unknown>>=[];
const checks:Array<Record<string,unknown>>=[];
const errors:Array<Record<string,unknown>>=[];
const maximum=500000;
let largest=0,unitCount=0,questionCount=0,criterionCount=0;
for(const set of bank.filter(set=>selected.has(set.id))){
    try{
        // Only the independently reviewed official source replacement and explicit 03-001 scope clarification are allowed.
        const original=structuredClone(before.find(row=>row.id===set.id)!);
        const corrections=read(root+'/prepared-reviewed-v5/official-source-corrections.json');
        for(const change of corrections.changes.filter((row:{set_id:string})=>row.set_id===set.id)){
            const sourceIndex=original.source_refs.findIndex(source=>source.id===change.source_ref_id);
            if(JSON.stringify(original.source_refs[sourceIndex])!==JSON.stringify(change.before_source_ref))throw Error('Before source identity differs.');
            original.source_refs[sourceIndex]=change.after_source_ref;
            for(const row of change.requirements){
                const sub=original.subquestions.find(sub=>sub.id===row.subquestion_id)!;
                const index=sub.requirements.findIndex(req=>req.id===row.requirement_id);
                if(JSON.stringify(sub.requirements[index])!==JSON.stringify(row.before))throw Error('Before requirement identity differs.');
                sub.requirements[index]=row.after;
            }
        }
        if(set.id==='pilot-03-001'){
            const scope=corrections.scope_clarification.proposal;
            if(original.subquestions.find(sub=>sub.id==='sub1')!.prompt!==scope.before_prompt)throw Error('Scope clarification predecessor mismatch.');
            original.subquestions.find(sub=>sub.id==='sub1')!.prompt=scope.after_prompt;
        }
        if(JSON.stringify(original)!==JSON.stringify(set))throw Error('Unreviewed question, answer, criterion, or source change.');
        const qa=qaManifest.entries.find((row:{set_id:string})=>row.set_id===set.id);if(!qa)throw Error('Missing author QA');verify(qa);
        const newRow=newManifest.entries.find((row:{set_id:string})=>row.set_id===set.id);
        const oldPlan=plansIndex.entries.find((row:{set_id:string})=>row.set_id===set.id);
        const override=overrides.entries.find((row:{set_id:string})=>row.set_id===set.id);
        const planFiles=override?[override]:newRow?newRow.plan_files:[oldPlan];
        if(planFiles.length!==1||!planFiles[0])throw Error('Exactly one actual plan file required');
        const planFile=planFiles[0];verify(planFile);
        const rawPlan=read(planFile.file);
        const matching=rawPlan.plans?.filter((row:{set_id:string})=>row.set_id===set.id);
        if(matching&&matching.length!==1)throw Error('Wrapped plan identity mismatch');
        const plan=matching?matching[0]:rawPlan;
        const planErrors=validateQuestionAuthoringPlan(plan);if(planErrors.length)throw Error(planErrors.join('; '));
        for(const id of plan.source_unit_ids)if(!catalog.units.some(unit=>unit.id===id))throw Error(`Unregistered plan source: ${id}`);
        const prepared=prepareSemanticReview(set,{bank,authoringPlan:plan,maxInputChars:maximum});
        const contexts=prepared.requestContext as Record<string,unknown>;
        const chunks=prepared.units.map(unit=>buildReviewChunkInput(prepared,unit).length);
        const chunkMax=Math.max(...chunks);if(chunkMax>maximum)throw Error(`Chunk input ${chunkMax} exceeds ${maximum}`);
        const missing=(contexts.source_excerpts as Array<Record<string,unknown>>).filter(row=>row.line_start==null||row.source_quote_line_start==null);
        if(missing.length)throw Error(`Missing exact source locations: ${missing.map(row=>row.id).join(', ')}`);
        largest=Math.max(largest,chunkMax);unitCount+=prepared.units.length;questionCount+=set.subquestions.length;
        const criteria=set.subquestions.reduce((n,sub)=>n+sub.criteria.length,0);criterionCount+=criteria;
        checks.push({set_id:set.id,status:'local_preflight_pass',request_chars:prepared.requestChars,max_chunk_chars:chunkMax,
            units:prepared.units.length,source_locations:'exact_file_positions',source_files:prepared.sourceFiles,plan_file:planFile.file,
            author_qa_cases:qa.cases,semantic_review:'not_run',model_grading:'not_run'});
        const planSources=plan.source_unit_ids.map((id:string)=>catalog.units.find(unit=>unit.id===id)!.file);
        const sources=[...new Set([...prepared.sourceFiles.map(row=>row.file),...planSources])].map(identity);
        const json=JSON.stringify(set,null,2)+'\n';
        jobs.push({set_id:set.id,worker:'',file:`${output}/sets/${set.id}.json`,sha256:sha(json),
            plan_file:planFile.file,plan_sha256:planFile.sha256,qa_file:qa.file,qa_sha256:qa.sha256,source_files:sources,
            semantic_units:prepared.units.length,questions:set.subquestions.length,criteria,author_qa_cases:qa.cases,body:json});
    }catch(error){errors.push({set_id:set.id,error:error instanceof Error?error.message:String(error)});}
    if((checks.length+errors.length)%10===0)console.log(`Local preflight ${checks.length+errors.length}/${selected.size}; errors ${errors.length}`);
}
for(const input of uniqueGlobal)verify(input);
const preflight={created_at:new Date().toISOString(),bank:identity(bankFile),source_catalog_fingerprint:catalog.fingerprint,
    selected_sets:selected.size,checked_sets:checks.length,questions:questionCount,criteria:criterionCount,semantic_units:unitCount,
    largest_chunk_chars:largest,max_input_chars:maximum,api_calls:0,errors,checks};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(`${output}/preflight.json`,JSON.stringify(preflight,null,2)+'\n',{flag:'wx'});
if(errors.length)throw Error(`Preflight errors ${errors.length}; no execution manifest or API calls. See ${output}/preflight.json`);
const workers=[{id:'a',units:0},{id:'b',units:0},{id:'c',units:0}];
for(const job of [...jobs].sort((a,b)=>Number(b.semantic_units)-Number(a.semantic_units)||String(a.set_id).localeCompare(String(b.set_id)))){
    workers.sort((a,b)=>a.units-b.units||a.id.localeCompare(b.id));job.worker=workers[0].id;workers[0].units+=Number(job.semantic_units);
}
fs.mkdirSync(`${output}/sets`);
for(const job of jobs){fs.writeFileSync(String(job.file),String(job.body),{flag:'wx'});delete job.body;}
const manifest={created_at:new Date().toISOString(),purpose:'mandatory_actual_semantic_review_then_grading_before_publication',
    user_authorization:'필수 전수검증을 진행하고 통과 후 DB 반영',bank_file:bankFile,bank_sha256:identity(bankFile).sha256,
    code_files:uniqueGlobal,model:'gpt-5.6-luna',review_model:'gpt-5.6-luna',max_input_chars:maximum,
    source_catalog_fingerprint:catalog.fingerprint,preflight_file:`${output}/preflight.json`,preflight_sha256:identity(`${output}/preflight.json`).sha256,
    max_concurrent_workers:3,workers,jobs};
fs.writeFileSync(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,sets:jobs.length,questions:questionCount,criteria:criterionCount,semantic_units:unitCount,
    largest_chunk_chars:largest,workers,api_calls:0},null,2));
