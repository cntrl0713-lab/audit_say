import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';
import { contentHash } from '../../../../lib/learningSubmission.ts';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { compileLearningCatalog } from '../../../../scripts/build-learning-unit-catalog.ts';
import { inspectBankSnapshot, learningCatalogForBank } from '../../../../scripts/import-question-bank-v3.ts';

const root='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const previous=`${root}/prepared-reviewed-v1`, output=`${root}/prepared-reviewed-v3`;
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const cached=new Map<string,Buffer>();
const bytes=(file:string)=>{if(!cached.has(file))cached.set(file,fs.readFileSync(file));return cached.get(file)!;};
const read=(file:string)=>JSON.parse(bytes(file).toString('utf8'));
const identity=(file:string)=>({file,sha256:hash(bytes(file))});
const strip=(value:string)=>value.replace(/\s/gu,'');
const bank:QuestionSetV3[]=read(`${previous}/candidate-authoring.json`);
const summary=read(`${previous}/summary.json`);
const entries=read(`${previous}/classification-review.json`).entries;
const topics=read(`${previous}/learning-question-classifications.json`).topics;
const newManifest=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-style-v2/manifest.json');
const selected=new Set<string>([...summary.canonical.changed_sets,...newManifest.entries.map((entry:{set_id:string})=>entry.set_id)]);
const fileMappings:Record<string,string>={
    [`${root}/a/source-evidence.txt`]:'cpa_uploader/data/official/point-review-a-supplement-2026-09-11.txt',
    'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/e-official.txt':'cpa_uploader/data/official/point-review-710-appendix-2026-09-11.txt',
};
if(fs.existsSync(output))throw Error('Prepared source revisions are immutable; use a new output version.');
const inputs=[identity(`${previous}/candidate-authoring.json`),identity(`${previous}/classification-review.json`),identity(`${previous}/learning-question-classifications.json`)];
const corrections:Array<Record<string,unknown>>=[];
const requirementLocations:Array<Record<string,unknown>>=[];
function exactSubstring(text:string,quote:string){
    if(text.includes(quote))return quote;
    const positions:number[]=[];let normalized='';
    for(let i=0;i<text.length;i++)if(!/\s/u.test(text[i])){normalized+=text[i];positions.push(i);}
    const target=strip(quote),start=normalized.indexOf(target);
    if(start<0||!target)throw Error('Non-whitespace source content does not match the actual file.');
    if(normalized.indexOf(target,start+1)>=0)throw Error('Source occurrence is ambiguous; select a verified occurrence explicitly.');
    const actual=text.slice(positions[start],positions[start+target.length-1]+1);
    if(strip(actual)!==target||!text.includes(actual))throw Error('Exact source reconstruction failed.');
    return actual;
}
for(const set of bank.filter(set=>selected.has(set.id)))for(const source of set.source_refs){
    const before=structuredClone(source);
    const target=fileMappings[source.file]??source.file;
    const text=bytes(target).toString('utf8');inputs.push(identity(target));
    const originalText=bytes(before.file).toString('utf8');inputs.push(identity(before.file));
    const copyOffset=target===before.file?0:text.indexOf(originalText);
    if(copyOffset<0)throw Error(`Official copy must contain the full original bytes: ${before.file}`);
    const lineOffset=text.slice(0,copyOffset).split('\n').length-1;
    const relocated=(value:string)=>value.replaceAll(before.file,target)
        .replaceAll(path.basename(before.file),path.basename(target))
        .replace(/L(\d+)(?:([–-])L?(\d+))?/gu,(_,a:string,dash:string,b:string)=>`L${Number(a)+lineOffset}${b?`${dash}${Number(b)+lineOffset}`:''}`);
    const exact=exactSubstring(text,source.source_quote);
    source.file=target;source.source_quote=exact;
    if(target!==before.file&&source.title)source.title=relocated(source.title);
    if(source.id==='src-point-a-330-8'&&source.title)source.title=source.title.replace('PDF 문단 8','PDF 314');
    if(source.content_hash!==undefined)source.content_hash=hash(exact);
    if(JSON.stringify(before)!==JSON.stringify(source))corrections.push({set_id:set.id,source_id:source.id,
        reason:before.file!==target?'Verified official excerpt copy with preserved provenance; source wording unchanged.':'Direct original-file comparison; only source whitespace and/or obsolete quote hash corrected.',
        before,after:structuredClone(source),same_nonwhitespace_quote:strip(before.source_quote)===strip(exact),
        exact_file_inclusion:true,source_quote_sha256:hash(exact),source_file_sha256:hash(text),
        quote_line_start:text.slice(0,text.indexOf(exact)).split('\n').length});
    for(const sub of set.subquestions)for(const req of sub.requirements.filter(req=>req.source_ref_id===source.id)){
        const oldSpan=req.source_span;
        if(oldSpan&&target!==before.file)req.source_span=relocated(oldSpan);
        if(source.id==='src-point-a-330-8'&&req.source_span)req.source_span=req.source_span.replace('PDF 문단 8','PDF 314');
        if(!req.source_span){
            const start=text.indexOf(exact),end=start+exact.length;
            if(!strip(exact).includes(strip(req.source_quote)))throw Error(`${set.id}/${sub.id}/${req.id}: source locator needs an independent quote-range review`);
            req.source_span=`${source.page??source.title}; ${target} L${text.slice(0,start).split('\n').length}–${text.slice(0,end-1).split('\n').length}; 직접 인용을 포함하는 실제 파일 범위`;
        }
        if(oldSpan!==req.source_span)requirementLocations.push({set_id:set.id,subquestion_id:sub.id,requirement_id:req.id,
            before:oldSpan??null,after:req.source_span,method:oldSpan?'byte-preserved copy line/path relocation':'exact parent quote bounds; requirement included after whitespace normalization'});
    }
}
const validation=validateAuthoringBank(bank);if(validation.errors.length)throw Error(JSON.stringify(validation.errors));
const publicSets=bank.map(compilePublicQuestionSet);
const bankBytes=JSON.stringify(bank,null,2)+'\n',publicBytes=JSON.stringify(publicSets,null,2)+'\n';
const review={schema_version:1,source_file:`${output}/candidate-authoring.json`,source_file_sha256:hash(bankBytes),
    status:'candidate_classification_structurally_checked',predecessor_file:`${previous}/classification-review.json`,entries};
const reviewBytes=JSON.stringify(review,null,2)+'\n';
const {classifications,units}=compileLearningCatalog(bank,entries,topics);
const catalog={schema_version:1,source_file:review.source_file,source_file_sha256:hash(bankBytes),public_content_hash:contentHash(publicSets),
    review_file:`${output}/classification-review.json`,review_file_sha256:hash(reviewBytes),topics,classifications};
const inspection=inspectBankSnapshot(bankBytes,publicBytes);
if(inspection.report.source_hash_mismatches.length)throw Error(JSON.stringify(inspection.report.source_hash_mismatches));
inputs.push(...[...cached.keys()].map(identity));
const uniqueInputs=[...new Map(inputs.map(row=>[row.file,row])).values()];
for(const row of uniqueInputs)if(hash(fs.readFileSync(row.file))!==row.sha256)throw Error(`Input changed: ${row.file}`);
fs.mkdirSync(output,{recursive:true});
const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('candidate-authoring.json',bankBytes);write('candidate-public.json',publicBytes);write('classification-review.json',reviewBytes);
write('learning-question-classifications.json',catalog);write('db-learning-metadata.json',learningCatalogForBank(bank,catalog));
write('source-exactness.json',{created_at:new Date().toISOString(),status:'direct_file_comparison_only_model_review_pending',inputs:uniqueInputs,corrections,requirement_locations:requirementLocations});
write('summary.json',{created_at:new Date().toISOString(),predecessor:`${previous}/summary.json`,canonical:summary.canonical,new:summary.new,
    combined:summary.combined,source_corrections:corrections.length,validation:{structure_source_quotes_duplicates:'passed',learning_units:units.length,
        import_preconditions:inspection.report,model_semantic_review:'not_run',model_grading:'not_run',human_review:'not_asserted',production_db:'not_applied'}});
console.log(JSON.stringify({output,source_corrections:corrections.length,source_hash_mismatches:inspection.report.source_hash_mismatches.length,
    selected_sets:selected.size,bank_sha256:hash(bankBytes),learning_units:units.length},null,2));
