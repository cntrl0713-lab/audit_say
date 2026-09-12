import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateAuthoringBank } from '../../../questionBankPublication.ts';
import { computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';
import type { QuestionSetV3 } from '../../../../lib/questionV3.ts';

const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const label=process.argv[2];
const freeze=process.argv.includes('--freeze');
if(!label||!/^[a-z0-9-]+$/.test(label))throw Error('새 영문 소문자 실행 이름 필요');
const output=path.join(control,label);
if(fs.existsSync(output))throw Error('기존 스냅샷을 덮어쓰지 않습니다.');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ledger=read(path.join(control,'id-ledger.json')) as {entries:Array<{plan_id:string;package:string;set_id:string;output_directory:string;questions:Array<{plan_question_id:string;suggested_id:string;provisional_points:number}>}>};
const bankPath='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=read(bankPath) as QuestionSetV3[];
const chosen:QuestionSetV3[]=[];
const errors:string[]=[];
const rows=ledger.entries.map(entry=>{
    const candidates:Array<{file:string;set:QuestionSetV3}>=[];
    const planFiles:string[]=[];
    const parseErrors:string[]=[];
    if(fs.existsSync(entry.output_directory))for(const name of fs.readdirSync(entry.output_directory)){
        if(!name.endsWith('.json'))continue;
        const file=path.join(entry.output_directory,name).replaceAll('\\','/');
        try{
            const raw=read(file);
            for(const set of Array.isArray(raw)?raw:[raw])if(set?.id===entry.set_id&&Array.isArray(set.subquestions)&&Array.isArray(set.source_refs))candidates.push({file,set});
            const plans=Array.isArray(raw?.plans)?raw.plans:[raw];
            if(plans.some((plan:Record<string,unknown>|null)=>plan?.set_id===entry.set_id&&Array.isArray(plan.source_unit_ids)&&plan.scope))planFiles.push(file);
        }catch(error){parseErrors.push(`${file}: ${String(error)}`);}
    }
    if(candidates.length!==1){
        errors.push(`${entry.plan_id}: 문항 파일 ${candidates.length}개`);
        return {...entry,stage:'candidate_missing_or_ambiguous',candidates:candidates.map(x=>x.file),parse_errors:parseErrors};
    }
    const {file,set}=candidates[0];
    chosen.push(set);
    if(set.subquestions.length!==entry.questions.length)errors.push(`${entry.plan_id}: 물음 수 불일치`);
    if(set.subquestions.some((q,index)=>q.id!==entry.questions[index]?.suggested_id))errors.push(`${entry.plan_id}: 배정 물음 ID와 순서 불일치`);
    if(set.status!=='needs_review'||set.verification.review_status!=='needs_human_review')errors.push(`${entry.plan_id}: 초안 상태 변경`);
    const qaFile=path.join(entry.output_directory,`qa-cases-${entry.plan_id.toLowerCase()}.json`).replaceAll('\\','/');
    const qa=fs.existsSync(qaFile)?read(qaFile):null;
    if(!qa||qa.set_id!==set.id||!Array.isArray(qa.cases)||!qa.cases.length)errors.push(`${entry.plan_id}: 작성자 QA 누락 또는 연결 오류`);
    if(planFiles.length!==1)errors.push(`${entry.plan_id}: 출제 계획 파일 ${planFiles.length}개`);
    return {...entry,stage:'candidate_collected_not_validation_complete',file,sha256:sha(file),question_ids:set.subquestions.map(q=>q.id),
        question_mapping:entry.questions.map((q,index)=>({...q,actual_id:set.subquestions[index]?.id})),
        actual_questions:set.subquestions.length,criteria:set.subquestions.reduce((n,q)=>n+q.criteria.length,0),points:computeQuestionSetMaxPoints(set),
        plan_files:planFiles.map(file=>({file,sha256:sha(file)})),qa_file:qa?qaFile:null,qa_sha256:qa?sha(qaFile):null,qa_cases:qa?.cases?.length??0,
        source_files:[...new Set(set.source_refs.map(ref=>ref.file))].map(file=>({file,sha256:sha(file)})),parse_errors:parseErrors};
});
const combined=[...bank.filter(set=>!chosen.some(candidate=>candidate.id===set.id)),...chosen].sort((a,b)=>a.id.localeCompare(b.id));
const validation=validateAuthoringBank(combined);
errors.push(...validation.errors);
if(freeze&&(chosen.length!==49||chosen.reduce((n,set)=>n+set.subquestions.length,0)!==131||errors.length))throw Error(`은행 고정 불가: ${errors.join('; ')}`);
fs.mkdirSync(output,{recursive:true});
const summary={created_at:new Date().toISOString(),purpose:freeze?'fixed_comparison_bank':'progress_snapshot_only',
    bank_file:bankPath,bank_sha256:sha(bankPath),planned_sets:49,planned_questions:131,
    collected_sets:chosen.length,collected_questions:chosen.reduce((n,set)=>n+set.subquestions.length,0),
    collected_points:chosen.reduce((n,set)=>n+computeQuestionSetMaxPoints(set),0),comparison_sets:combined.length,
    errors,validation,entries:rows};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
if(freeze){
    const comparisonPath=path.join(output,'comparison-bank.json');
    fs.writeFileSync(comparisonPath,JSON.stringify(combined,null,2)+'\n',{flag:'wx'});
    fs.writeFileSync(path.join(output,'comparison-bank.sha256'),sha(comparisonPath)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({output,freeze,sets:summary.collected_sets,questions:summary.collected_questions,points:summary.collected_points,comparison_sets:summary.comparison_sets,errors}));
