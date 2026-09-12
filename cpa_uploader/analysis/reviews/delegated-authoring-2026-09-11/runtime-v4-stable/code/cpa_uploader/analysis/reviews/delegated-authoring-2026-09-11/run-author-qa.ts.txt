import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gradeQuestionSetV3, gradingModelName, buildGradingPrompt, buildGradingResponseSchema } from '../../../../lib/questionV3Grading.ts';
import type { QuestionSetJudgmentV3, GradingTraceV3 } from '../../../../lib/questionV3Grading.ts';
import type { QuestionSetV3, CriterionVerdictNameV3 } from '../../../../lib/questionV3.ts';

interface Case {
    id: string; subquestion_id: string; kind: string; answer: string; expected_points: number;
    expected_verdicts: Array<{ criterion_id: string; verdict: CriterionVerdictNameV3; reason?: string }>;
    note?: string;
}
const args: Record<string,string> = {};
for(let i=2;i<process.argv.length;i+=2){
    const key=process.argv[i],value=process.argv[i+1];
    if(!['--file','--qa','--output','--only'].includes(key)||!value||args[key])throw Error('지원 인자: --file --qa --output [--only 사례ID]');
    args[key]=value;
}
if(!args['--file']||!args['--qa']||!args['--output'])throw Error('--file --qa --output 필요');
const output=path.resolve(args['--output']);
const allowed=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11')+path.sep;
if(!output.toLowerCase().startsWith(allowed.toLowerCase()))throw Error('출력은 배정 전용 폴더 안이어야 함');
if(fs.existsSync(output))throw Error('새 실행 경로를 사용하십시오. 기존 실행을 덮어쓰지 않습니다.');
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const input=read(args['--file']);
if(Array.isArray(input)&&input.length!==1)throw Error('작성자 QA 실측은 한 세트 파일만 받습니다.');
const set:QuestionSetV3=Array.isArray(input)?input[0]:input;
const qa=read(args['--qa']) as {version:number;artifact_type:string;set_id:string;cases:Case[]};
if(qa.version!==1||qa.artifact_type!=='author_expected_judgments'||qa.set_id!==set.id||!Array.isArray(qa.cases))throw Error('문항과 version 1 작성자 QA 연결 오류');
if(new Set(qa.cases.map(x=>x.id)).size!==qa.cases.length)throw Error('QA 사례ID 중복');
for(const test of qa.cases){
    const q=set.subquestions.find(q=>q.id===test.subquestion_id);
    if(!q||typeof test.answer!=='string'||!Number.isInteger(test.expected_points)||!Array.isArray(test.expected_verdicts))throw Error(`${test.id}: QA 형상 오류`);
    if(test.expected_verdicts.length!==q.criteria.length||new Set(test.expected_verdicts.map(x=>x.criterion_id)).size!==q.criteria.length||test.expected_verdicts.some(x=>!q.criteria.some(c=>c.id===x.criterion_id)))throw Error(`${test.id}: 모든 대상 criterion의 기대값을 한 번씩 지정해야 함`);
    const expectedSum=test.expected_verdicts.reduce((sum,value)=>{
        const criterion=q.criteria.find(c=>c.id===value.criterion_id)!;
        if(!['met','partial','not_met','contradicted'].includes(value.verdict))throw Error(`${test.id}: 허용되지 않은 기대 판정`);
        if(value.verdict==='partial'&&criterion.scores.partial===undefined)throw Error(`${test.id}: 부분점수 계약이 없는 partial 기대값`);
        return sum+(value.verdict==='met'?criterion.scores.met:value.verdict==='partial'?criterion.scores.partial!:0);
    },0);
    if(expectedSum!==test.expected_points)throw Error(`${test.id}: 명제별 기대 점수와 합계가 다름`);
}
const jobs=qa.cases.filter(test=>!args['--only']||test.id===args['--only']);
if(!jobs.length)throw Error('실행할 사례 없음');
const codeFiles=['lib/questionV3Grading.ts','lib/questionV3Evidence.ts','lib/questionV3.ts','lib/questionV3Answer.ts','lib/ai/openaiStructured.ts','cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/run-author-qa.ts'];
const sourceFiles=[...new Set(set.source_refs.map(ref=>ref.file))];
const hashFiles=[args['--file'],args['--qa'],...codeFiles,...sourceFiles];
const hashes=Object.fromEntries(hashFiles.map(file=>[file,sha(fs.readFileSync(file))]));
const model=gradingModelName();
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'inputs.json'),JSON.stringify({created_at:new Date().toISOString(),model,question_set:set,qa,hashes,selected:args['--only']||null,transport:'production_gradeQuestionSetV3',mock:false},null,2)+'\n',{flag:'wx'});
const zero=new Set(['not_met','contradicted']);
void(async()=>{
    const records:Array<Record<string,unknown>>=[];
    let executionError=false;
    for(let index=0;index<jobs.length;index++){
        const test=jobs[index];
        const answers=Object.fromEntries(set.subquestions.map(q=>[q.id,q.id===test.subquestion_id?test.answer:'']));
        let repetitions=1;
        for(let attempt=1;attempt<=repetitions;attempt++){
            if(gradingModelName()!==model||hashFiles.some(file=>hashes[file]!==sha(fs.readFileSync(file))))throw Error('실측 중 입력·코드·모델 변경. 새 버전으로 다시 실행 필요');
            let raw:QuestionSetJudgmentV3|null=null;
            const trace:GradingTraceV3[]=[];
            const started_at=new Date().toISOString();
            let record:Record<string,unknown>;
            try{
                const result=await gradeQuestionSetV3(set,answers,process.env.OPENAI_API_KEY||'',value=>{raw=value;},undefined,event=>trace.push(event));
                const actual=result.subquestions.find(q=>q.subquestion_id===test.subquestion_id)!;
                const exactDifferences=test.expected_verdicts.filter(v=>actual.criteria.find(c=>c.criterion_id===v.criterion_id)?.verdict!==v.verdict);
                const boundary=['condition_boundary','condition-boundary'].includes(test.kind);
                const differences=exactDifferences.filter(v=>!(boundary&&zero.has(v.verdict)&&zero.has(actual.criteria.find(c=>c.criterion_id===v.criterion_id)?.verdict||'')));
                const matched=differences.length===0&&result.score===test.expected_points&&result.security_flag==='none';
                record={set_id:set.id,case_id:test.id,kind:test.kind,attempt,started_at,finished_at:new Date().toISOString(),model,
                    transport:test.answer.trim()?'live_model':'production_empty_answer_no_model',answers,expected:test,
                    request_hash:sha(buildGradingPrompt(set,answers)),schema_hash:sha(JSON.stringify(buildGradingResponseSchema(set,answers))),
                    raw_judgment:raw,trace,result,exact_verdict_differences:exactDifferences,verdict_differences:differences,matched,
                    boundary_policy:boundary?'조건 경계의 not_met/contradicted만 0점 동등 취급; 반대·누락 사례에는 적용하지 않음':null};
                if(!matched)repetitions=3;
            }catch(error){
                const value=error as Error&{code?:string;status?:number};
                record={set_id:set.id,case_id:test.id,attempt,started_at,finished_at:new Date().toISOString(),model,answers,expected:test,trace,
                    transport:'live_model_attempt',matched:false,error:{name:value.name,message:value.message,code:value.code,status:value.status}};
                executionError=true;
            }
            const name=`case-${String(index+1).padStart(4,'0')}-attempt-${attempt}.json`;
            fs.writeFileSync(path.join(output,name),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
            records.push({file:name,set_id:set.id,case_id:test.id,attempt,matched:record.matched,error:record.error||null});
            console.log(JSON.stringify({set_id:set.id,case_id:test.id,attempt,matched:record.matched,execution_error:executionError}));
            if(executionError)break;
        }
        if(executionError)break;
    }
    const changed=hashFiles.filter(file=>hashes[file]!==sha(fs.readFileSync(file)));
    const summary={finished_at:new Date().toISOString(),set_id:set.id,model,planned_cases:jobs.length,recorded_cases:new Set(records.map(r=>r.case_id)).size,
        actual_attempts:records.length,mismatched_case_ids:[...new Set(records.filter(r=>!r.matched).map(r=>r.case_id))],stopped_on_execution_error:executionError,changed_inputs:changed,records};
    fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
    if(executionError||changed.length||summary.mismatched_case_ids.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
