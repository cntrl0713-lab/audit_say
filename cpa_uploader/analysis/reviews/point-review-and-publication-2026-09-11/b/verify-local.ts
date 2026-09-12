import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateQuestionSetV3, computeQuestionSetMaxPoints } from '../../../../../lib/questionV3.ts';
import type { QuestionSetV3, CriterionVerdictV3 } from '../../../../../lib/questionV3.ts';
import { applyQuestionSetJudgment } from '../../../../../lib/questionV3Grading.ts';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=(p:string)=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
const hash=(b:string|Buffer)=>crypto.createHash('sha256').update(b).digest('hex');
const before=read('../canonical-before.json') as QuestionSetV3[];
const sets=read('sets.json') as QuestionSetV3[];
type Case={id:string,subquestion_id:string,answer:string,expected_points:number,expected_verdicts:Array<{criterion_id:string,verdict:'met'|'not_met'|'contradicted',reason:string}>};
const qa=read('qa.json') as {case_count:number,questions:Array<{set_id:string,subquestion_id:string,cases:Case[]}>};
const audit=read('audit.json') as {entries:Array<{set_id:string,subquestion_id:string,before_points:number,after_points:number,changed:boolean}>};
const errors:string[]=[];
const expect=(condition:boolean,message:string)=>{if(!condition)errors.push(message);};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
let checks=0;
for(const s of sets){
 const old=before.find(x=>x.id===s.id)!;
 const validation=validateQuestionSetV3(s,{verifySourceQuotes:true,cwd:process.cwd()});errors.push(...validation.errors.map(x=>s.id+': '+x));
 expect(equal(s.shared_context,old.shared_context),s.id+' facts changed');
 expect(equal(s.source_refs,old.source_refs),s.id+' source refs changed');
 expect(equal(s.classification,old.classification),s.id+' classification changed');
 expect(equal(s.learning_order,old.learning_order),s.id+' order changed');
 for(const [i,q]of s.subquestions.entries()){
  const oq=old.subquestions[i];expect(q.id===oq.id,s.id+' subquestion id changed');
  expect(q.prompt===oq.prompt,s.id+'/'+q.id+' prompt changed');
  expect(equal(q.model_answer,oq.model_answer),s.id+'/'+q.id+' model answer changed');
  expect(equal(q.requirements,oq.requirements),s.id+'/'+q.id+' source requirements changed');
  expect(oq.criteria.every(c=>q.criteria.some(x=>x.id===c.id)),s.id+'/'+q.id+' original criterion id lost');
  expect(q.criteria.every(c=>c.max_points===1&&c.scores.met===1&&c.scores.not_met===0&&c.scores.contradicted===0&&c.scores.partial===undefined),s.id+'/'+q.id+' not one-point contract');
  expect(equal(q.selection,{type:'all',n:null})&&equal(q.constraints,{ordered:false,max_entries:null,overflow_policy:'none'}),s.id+'/'+q.id+' partial selection');
  const entry=audit.entries.find(x=>x.set_id===s.id&&x.subquestion_id===q.id);expect(Boolean(entry),s.id+'/'+q.id+' audit missing');
  expect(entry?.after_points===q.criteria.length,s.id+'/'+q.id+' audit score mismatch');
  if(!entry?.changed)expect(equal(q,oq),s.id+'/'+q.id+' unchanged question bytes mismatch');
  const bundle=qa.questions.find(x=>x.set_id===s.id&&x.subquestion_id===q.id);
  if(entry?.changed){
   expect(Boolean(bundle),s.id+'/'+q.id+' missing QA');
   expect(Boolean(bundle?.cases.some(c=>c.answer===q.model_answer.join('\n')&&c.expected_points===q.criteria.length)),s.id+'/'+q.id+' stored model answer QA missing');
   expect(Boolean(bundle?.cases.some(c=>c.answer===''&&c.expected_points===0)),s.id+'/'+q.id+' empty QA missing');
  }
  const caseIds=new Set<string>();
  for(const c of bundle?.cases??[]){
   expect(!caseIds.has(c.id),s.id+'/'+q.id+' duplicate case '+c.id);caseIds.add(c.id);
   expect(c.expected_verdicts.length===q.criteria.length&&new Set(c.expected_verdicts.map(v=>v.criterion_id)).size===q.criteria.length,c.id+' expected verdict coverage');
   expect(c.expected_verdicts.every(v=>q.criteria.some(x=>x.id===v.criterion_id)),c.id+' unknown criterion');
   const judgment={subquestions:s.subquestions.map(sub=>({subquestion_id:sub.id,verdicts:sub.id===q.id?c.expected_verdicts.map(v=>({...v,...(v.verdict==='not_met'?{}:{quote:c.answer})})):sub.criteria.map(cr=>({criterion_id:cr.id,verdict:'not_met' as const})) as CriterionVerdictV3[]}))};
   const score=applyQuestionSetJudgment(s,{[q.id]:c.answer},judgment);
   expect(score.score===c.expected_points,c.id+' production deterministic sum mismatch '+score.score+' != '+c.expected_points);
   expect(score.security_flag==='none',c.id+' deterministic security flags');checks++;
  }
 }
}
expect(sets.length===35&&audit.entries.length===70,'scope counts mismatch');
expect(checks===qa.case_count,'QA count mismatch');
const changed=audit.entries.filter(x=>x.changed);
const sourceFiles=[...new Set(sets.flatMap(s=>s.source_refs.map(r=>r.file)))];
const report={version:1,generated_at:new Date().toISOString(),method:'local_schema_exact_source_and_author_expected_judgment_replay',api_calls:0,model_semantic_review:'not_run',model_grading:'not_run',human_approval:false,errors,counts:{sets:sets.length,questions:audit.entries.length,changed_questions:changed.length,before_points:audit.entries.reduce((n,x)=>n+x.before_points,0),after_points:sets.reduce((n,s)=>n+computeQuestionSetMaxPoints(s),0),qa_cases:checks},invariants:{all_original_set_subquestion_criterion_ids_preserved:!errors.some(e=>e.includes('id')),all_prompts_model_answers_facts_sources_classification_preserved:!errors.some(e=>e.includes('changed')),source_quotes_verified:true},files:Object.fromEntries(['sets.json','audit.json','qa.json','legacy-qa-preserved.json','build-review.mjs','supplement-qa.mjs'].map(f=>[f,hash(fs.readFileSync(path.join(dir,f)))])),sources:sourceFiles.map(file=>({file,sha256:hash(fs.readFileSync(file))})),limits:['작성자 기대판정 입력의 합산 검사로 실제 모델 판정·보안·정답 품질을 검증한 것은 아니다.','정본/공개본/DB/공통코드 및 과거 receipt를 수정하지 않았다.','통합 은행과 후속 의미검수·모델 채점·사람 확인·게시 여부는 총괄 단계이다.']};
fs.writeFileSync(path.join(dir,'local-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({errors:errors.length,...report.counts}));if(errors.length){console.log(errors.join('\n'));process.exitCode=1;}
