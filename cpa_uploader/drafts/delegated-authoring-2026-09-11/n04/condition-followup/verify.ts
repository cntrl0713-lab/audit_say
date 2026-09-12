/** Targeted no-call verification after T13-A condition wording correction. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateQuestionSetV3} from '../../../../../lib/questionV3.ts';
import {validateQuestionAuthoringPlan} from '../../../../questionAuthoringPlan.ts';
import {prepareSemanticReview} from '../../../../questionSemanticReview.ts';
import {buildSourceCatalog} from '../../../../questionSourceCatalog.mjs';
const base=path.resolve('cpa_uploader/drafts/delegated-authoring-2026-09-11/n04'),folder=path.join(base,'condition-followup');
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8')),sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const write=(f:string,v:any)=>fs.writeFileSync(path.join(folder,f),JSON.stringify(v,null,2)+'\n');
const lineage=read(path.join(base,'lineage.json')),entry=lineage.sets.find((s:any)=>s.set_id==='pilot-13-009'),set=read(entry.actual_file),plan=read(entry.plan_file).plans[0],qa=read(entry.qa_file);
const before=read(path.join(folder,'prior/pilot-13-009.json.txt')),priorQa=read(path.join(folder,'prior/qa-cases-t13-a.json.txt')),errors:string[]=[];
const preservation=read(path.join(folder,'preservation-manifest.json'));
for(const r of preservation.files)if(sha(r.preserved_file)!==r.sha256)errors.push('Preservation hash mismatch');
for(const id of ['pilot-11-005','pilot-11-006'])for(const suffix of ['.json','.json.authoring-plan.json'])if(sha(path.join(base,id+suffix))!==sha(path.join(folder,'prior',id+suffix+'.txt')))errors.push('Other candidate/plan changed '+id+suffix);
for(const name of ['qa-cases-t11-a.json','qa-cases-t11-b.json'])if(sha(path.join(base,name))!==sha(path.join(folder,'prior',name+'.txt')))errors.push('Other QA changed '+name);
for(const key of ['id','classification','shared_context','source_refs'])if(JSON.stringify(set[key])!==JSON.stringify(before[key]))errors.push('Unexpected set field changed '+key);
for(const i of [0,1])if(JSON.stringify(set.subquestions[i])!==JSON.stringify(before.subquestions[i]))errors.push('Other question changed');
const q=set.subquestions[2],oldQ=before.subquestions[2];
if(q.prompt!==oldQ.prompt.replace(' 가정·방법과 원천데이터 평가의 적용 조건도 함께 쓰시오.',''))errors.push('Unexpected prompt change');
for(const key of ['model_answer','type','selection','constraints','decision'])if(JSON.stringify(q[key])!==JSON.stringify(oldQ[key]))errors.push('Unexpected q3 change '+key);
for(let i=0;i<q.criteria.length;i++){
 const c=q.criteria[i],old=oldQ.criteria[i];for(const key of Object.keys(c).filter(k=>k!=='critical_facts'))if(JSON.stringify(c[key])!==JSON.stringify(old[key]))errors.push('Criterion claim/point changed '+c.id);
 if(i<3&&JSON.stringify(c)!==JSON.stringify(old))errors.push('Unrelated criterion changed');
 const req=q.requirements[i],oldReq=oldQ.requirements[i];
 for(const key of ['id','source_ref_id','source_quote'])if(req[key]!==oldReq[key])errors.push('Requirement binding changed '+req.id);
 if(i<3&&JSON.stringify(req)!==JSON.stringify(oldReq))errors.push('Unrelated requirement changed');
 if(i>=3){
  if(!req.source_span.startsWith(oldReq.source_span+'; 채점해석: ')||!req.source_span.includes('별도 득점요건이 아니며 답안에서 반복할 필요가 없다')||!req.source_span.includes('명시적 반대 답안'))errors.push('Missing interpretation in requirement '+req.id);
  const expected=['가정의 관련성을 평가한다.','가정의 합리성을 평가한다.','방법의 관련성을 평가한다.','방법의 합리성을 평가한다.','원천데이터의 관련성을 평가한다.','원천데이터의 완전성을 평가한다.','원천데이터의 정확성을 평가한다.'][i-3];
  if(c.critical_facts.length!==1||c.critical_facts[0].type!=='action'||c.critical_facts[0].expected!==expected)errors.push('Critical fact contains more than actual evaluation '+c.id);
 }
}
if(!plan.scope.exceptions.some((e:string)=>e.includes('별도 득점요건이 아니며 답안에서 반복할 필요가 없다')&&e.includes('명시적 반대 답안')))errors.push('Missing shared plan interpretation');
const validation=validateQuestionSetV3(set,{verifySourceQuotes:true,cwd:process.cwd()});errors.push(...validation.errors,...validateQuestionAuthoringPlan(plan));
const catalog=buildSourceCatalog();for(const id of plan.source_unit_ids)if(!catalog.units.some(u=>u.id===id))errors.push('Missing source unit '+id);
if(qa.draft_sha256!==sha(entry.actual_file)||qa.cases.length!==77)errors.push('QA hash/count mismatch');
for(const c of qa.cases){const sub=set.subquestions.find((q:any)=>q.id===c.subquestion_id);if(!sub||c.expected_verdicts.length!==sub.criteria.length)errors.push('QA scope mismatch '+c.id);let sum=0;for(const v of c.expected_verdicts){const crit=sub.criteria.find((x:any)=>x.id===v.criterion_id);if(!crit||!['met','not_met','contradicted'].includes(v.verdict))errors.push('QA verdict mismatch');if(v.verdict==='met')sum+=crit.max_points;}if(sum!==c.expected_points)errors.push('QA points mismatch');}
for(const old of priorQa.cases){const now=qa.cases.find((c:any)=>c.id===old.id);if(!now)errors.push('Prior QA missing');else if(old.id!=='sub3/boundary-8'&&JSON.stringify(now)!==JSON.stringify(old))errors.push('Other QA changed '+old.id);}
const boundary=qa.cases.find((c:any)=>c.id==='sub3/boundary-8');if(boundary.expected_points!==0||boundary.expected_verdicts.find((v:any)=>v.criterion_id==='sub3.crit8').verdict!=='contradicted')errors.push('Boundary correction missing');
const concise=qa.cases.find((c:any)=>c.id==='sub3/given-significance-not-repeated');if(concise?.expected_points!==10||concise?.answer.includes('유의적'))errors.push('Concise case missing');
const initial=read('cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/comparison-initial.json'),peer=[...initial,...lineage.sets.map((e:any)=>read(e.actual_file))];
const prep=prepareSemanticReview(set,{bank:peer,authoringPlan:plan,maxInputChars:400000});
const cli=execFileSync(process.execPath,['--import','tsx','cpa_uploader/validate_draft_v3.ts','--file',entry.actual_file,'--against-bank'],{encoding:'utf8'});
if(validation.max_points!==19||q.criteria.reduce((n:number,c:any)=>n+c.max_points,0)!==10)errors.push('Point count changed');
if(errors.length){write('result.json',{errors});throw Error(errors.join('\n'));}
lineage.stage='draft_ready';for(const e of lineage.sets){e.stage='draft_ready';e.sha256=sha(e.actual_file);e.plan_sha256=sha(e.plan_file);e.qa_sha256=sha(e.qa_file);e.evidence_sha256=sha(e.evidence_file);e.semantic_review='not_run';e.live_grading='not_run';}fs.writeFileSync(path.join(base,'lineage.json'),JSON.stringify(lineage,null,2)+'\n');
const result={recorded_at:new Date().toISOString(),stage:'draft_ready',model_calls:0,preserved_files:preservation.files.length,target:{set_id:set.id,subquestion_id:q.id,question_points:10,set_points:19},package:{sets:3,questions:9,points:53,qa_cases:215},before_sha256:sha(path.join(folder,'prior/pilot-13-009.json.txt')),current_sha256:sha(entry.actual_file),plan_sha256:sha(entry.plan_file),qa_sha256:sha(entry.qa_file),qa_cases:77,prior_qa_cases:76,boundary_change:{case_id:boundary.id,criterion_id:'sub3.crit8',before:'not_met',after:'contradicted',points:0},new_case:concise,static:{errors:validation.errors,warnings:validation.warnings},cli_output:cli,preparation:{request_chars:prep.requestChars,bank_hash:prep.bankHash,content_hash:prep.contentHash,source_files:prep.sourceFiles},other_two_candidates_and_qa_unchanged:true,errors};
write('result.json',result);console.log(JSON.stringify({stage:'draft_ready',sha256:result.current_sha256,plan_sha256:result.plan_sha256,qa_sha256:result.qa_sha256,points:53,qa:215,chars:prep.requestChars,errors}));
