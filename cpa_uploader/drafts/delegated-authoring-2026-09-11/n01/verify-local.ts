import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateQuestionSetV3,computeQuestionSetMaxPoints,type QuestionSetV3} from '../../../../lib/questionV3.ts';
import {draftConflicts} from '../../../questionDraftInventory.ts';
import {prepareSemanticReview} from '../../../questionSemanticReview.ts';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=process.cwd();
const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=read(path.join(dir,'build-manifest.json'));
const bankFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json';
const bank:QuestionSetV3[]=read(bankFile);
const sets:QuestionSetV3[]=manifest.outputs.map((o:any)=>read(path.join(dir,o.file)));
const catalog=buildSourceCatalog({repoDir:root});
const conflicts=draftConflicts(sets,bank);
const outputs=[];
for(const [index,set] of sets.entries()){
    const output=manifest.outputs[index];
    const plan=read(path.join(dir,output.file+'.authoring-plan.json')).plans[0];
    const qa=read(path.join(dir,`qa-cases-${output.plan_id.toLowerCase()}.json`));
    const structural=validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:root});
    const errors=[...structural.errors];
    if(qa.draft_sha256!==hash(fs.readFileSync(path.join(dir,output.file))))errors.push('QA draft hash mismatch');
    const caseIds=new Set();
    for(const c of qa.cases){
        const q=set.subquestions.find(q=>q.id===c.subquestion_id)!;
        if(!q){errors.push(`${c.id}: unknown subquestion`);continue;}
        if(caseIds.has(c.id))errors.push(`${c.id}: duplicate case`);caseIds.add(c.id);
        if(c.expected_verdicts.length!==q.criteria.length)errors.push(`${c.id}: incomplete criterion coverage`);
        const points=c.expected_verdicts.reduce((sum:number,v:any)=>{
            const criterion=q.criteria.find(k=>k.id===v.criterion_id);
            if(!criterion){errors.push(`${c.id}: unknown criterion ${v.criterion_id}`);return sum;}
            if(!['met','not_met','contradicted'].includes(v.verdict))errors.push(`${c.id}: invalid verdict`);
            return sum+(v.verdict==='met'?criterion.max_points:0);
        },0);
        if(points!==c.expected_points)errors.push(`${c.id}: expected points mismatch`);
    }
    for(const q of set.subquestions){
        const cs=qa.cases.filter((c:any)=>c.subquestion_id===q.id);
        for(const kind of ['model','equivalent','reverse-order','single-paragraph','single-sentence','irrelevant-prefix','empty'])if(!cs.some((c:any)=>c.kind===kind))errors.push(`${q.id}: missing ${kind}`);
        for(const cr of q.criteria)for(const kind of ['omission','opposite','condition_boundary'])if(!cs.some((c:any)=>c.kind===kind&&c.target_criterion_id===cr.id))errors.push(`${q.id}/${cr.id}: missing ${kind}`);
    }
    for(const ref of set.source_refs){
        const unit=catalog.units.find(u=>u.id===ref.id);
        if(!unit||unit.file!==ref.file||!unit.quote.includes(ref.source_quote))errors.push(`${ref.id}: registered exact excerpt mismatch`);
    }
    let preflight:any;
    try{
        const p=prepareSemanticReview(set,{root,bank:[...bank,...sets],authoringPlan:plan,maxInputChars:200000});
        preflight={status:'pass',request_chars:p.requestChars,required_units:p.units.length,bank_hash:p.bankHash,source_files:p.sourceFiles,content_hash:p.contentHash};
    }catch(e){preflight={status:'fail',error:String(e)};errors.push(String(e));}
    outputs.push({set_id:set.id,plan_id:output.plan_id,questions:set.subquestions.length,criteria:set.subquestions.reduce((n,q)=>n+q.criteria.length,0),points:computeQuestionSetMaxPoints(set),qa_cases:qa.cases.length,errors,warnings:structural.warnings,preflight});
}
const report={artifact_type:'n01_static_validation',version:1,performed_at:new Date().toISOString(),comparison_file:bankFile,comparison_sha256:hash(fs.readFileSync(bankFile)),comparison_sets:bank.length,own_sets:sets.length,conflicts,outputs,model_calls:0,semantic_review:'not_run',live_grading:'not_run',status:conflicts.length||outputs.some(o=>o.errors.length)?'fail':'pass'};
const reportFile=process.argv[2]??'static-validation-latest.json';
if(path.basename(reportFile)!==reportFile)throw new Error('Report filename must stay in the package directory');
if(fs.existsSync(path.join(dir,reportFile)))throw new Error('Preserve prior validation evidence; select a new report filename');
fs.writeFileSync(path.join(dir,reportFile),JSON.stringify({...report,max_input_chars:200000},null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status==='fail')process.exitCode=1;
