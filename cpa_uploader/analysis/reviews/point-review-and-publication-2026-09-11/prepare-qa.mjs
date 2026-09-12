import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { computeSubquestionMaxPoints } from '../../../../lib/questionV3.ts';
const directory=path.dirname(fileURLToPath(import.meta.url));
const prepared=path.join(directory,'prepared-reviewed-v1');
const output=path.join(directory,'qa-prepared-v1');
if(fs.existsSync(output))throw Error('Use a fresh QA preparation version');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel=file=>path.relative(process.cwd(),file).replaceAll('\\','/');
const sets=read(path.join(prepared,'candidate-authoring.json'));
const summary=read(path.join(prepared,'summary.json'));
const newManifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-style-v2/manifest.json';
const manifest=read(newManifestFile);
const lineage=read(path.join(directory,'root','lineage.json')).entries;
const selected=new Set([...summary.canonical.changed_sets,...manifest.entries.map(entry=>entry.set_id)]);
const inputs=[{file:rel(path.join(prepared,'candidate-authoring.json')),sha256:sha(path.join(prepared,'candidate-authoring.json'))}];
const rows=[];
for(const owner of ['a','b','c']){
  const file=path.join(directory,owner,'qa.json'),qa=read(file);inputs.push({file:rel(file),sha256:sha(file)});
  const cases=qa.questions?qa.questions.flatMap(group=>group.cases.map(row=>({...row,set_id:group.set_id}))):qa.cases;
  for(const row of cases)rows.push({...row,expected_points:row.expected_points??row.expected_score,
    expected_verdicts:row.expected_verdicts??row.expected_judgments,note:row.note??row.reason??'',origin:{file:rel(file),case_id:row.id}});
}
for(const entry of manifest.entries){
  if(sha(entry.qa_file)!==entry.qa_sha256)throw Error(`Changed source QA ${entry.set_id}`);
  inputs.push({file:entry.qa_file,sha256:entry.qa_sha256});
  const qa=read(entry.qa_file);
  for(const row of qa.cases)rows.push({...row,set_id:entry.set_id,origin:{file:entry.qa_file,case_id:row.id}});
}
const projected=[];
for(const row of rows){
  if(!selected.has(row.set_id))throw Error(`Unexpected QA owner ${row.set_id}`);
  const split=lineage.find(split=>split.set_id===row.set_id&&split.source_subquestion_id===row.subquestion_id);
  if(!split){projected.push(row);continue;}
  const beforeVerdicts=new Map(row.expected_verdicts.map(v=>[v.criterion_id,v]));
  for(const part of split.parts){
    const sub=sets.find(set=>set.id===row.set_id).subquestions.find(q=>q.id===part.subquestion_id);
    const verdicts=part.criterion_ids.map(id=>beforeVerdicts.get(id));
    if(verdicts.some(v=>!v))throw Error(`Missing split expectation ${row.id}`);
    projected.push({...row,id:`split/${row.id}/${part.subquestion_id}`,subquestion_id:part.subquestion_id,
      expected_verdicts:verdicts,expected_points:verdicts.reduce((n,v)=>n+(sub.criteria.find(c=>c.id===v.criterion_id).scores[v.verdict]??0),0),
      note:`${row.note??row.reason??''} 원래 답안을 보존하고 동일 criterion을 새 물음으로 귀속했다. 이 귀속·합산 검사는 실제 모델 판정이 아니다.`,
      origin:{...row.origin,old_subquestion_id:row.subquestion_id,projection:'same_answer_same_criterion_contract'}});
  }
}
// Verify the exact stored model answer and blank answer for every question in a changed/new set.
for(const set of sets.filter(set=>selected.has(set.id)))for(const sub of set.subquestions){
  for(const blank of [false,true])projected.push({id:`current/${sub.id}/${blank?'blank':'stored-model'}`,set_id:set.id,subquestion_id:sub.id,
    kind:blank?'empty':'stored_model_answer',answer:blank?'':sub.model_answer.join('\n'),expected_points:blank?0:computeSubquestionMaxPoints(sub),
    expected_verdicts:sub.criteria.map(c=>({criterion_id:c.id,verdict:blank?'not_met':'met'})),
    note:'현재 고정 후보의 모범답안과 빈 답안. 실제 모델 실행은 별도 수행한다.',origin:{file:rel(path.join(prepared,'candidate-authoring.json')),case_id:`${sub.id}/${blank?'blank':'stored-model'}`}});
}
const errors=[],packages=[],aliases=[];
let replayed=0;
for(const set of sets.filter(set=>selected.has(set.id))){
  const cases=[],identities=new Map();
  for(const row of projected.filter(row=>row.set_id===set.id)){
    const q=set.subquestions.find(q=>q.id===row.subquestion_id);
    if(!q||typeof row.answer!=='string'||!Number.isInteger(row.expected_points)||!Array.isArray(row.expected_verdicts))throw Error(`Invalid QA ${row.id}`);
    const byId=new Map(row.expected_verdicts.map(v=>[v.criterion_id,v]));
    if(byId.size!==q.criteria.length||byId.size!==row.expected_verdicts.length||q.criteria.some(c=>!byId.has(c.id)))throw Error(`Criterion coverage ${row.id}`);
    const verdicts=q.criteria.map(c=>byId.get(c.id));
    if(verdicts.some(v=>!['met','not_met','contradicted'].includes(v.verdict)))throw Error(`Unsupported partial contract ${row.id}`);
    const calculated=verdicts.reduce((n,v)=>n+q.criteria.find(c=>c.id===v.criterion_id).scores[v.verdict],0);
    if(calculated!==row.expected_points)throw Error(`Expected total ${row.id}`);
    const answers=Object.fromEntries(set.subquestions.map(sub=>[sub.id,sub.id===q.id?row.answer:'']));
    const judgment={subquestions:set.subquestions.map(sub=>({subquestion_id:sub.id,
      verdicts:sub.criteria.map(c=>({criterion_id:c.id,verdict:sub.id===q.id?byId.get(c.id).verdict:'not_met',
        quote:sub.id===q.id&&byId.get(c.id).verdict==='met'?row.answer:undefined}))}))};
    const actual=applyQuestionSetJudgment(set,answers,judgment);
    if(actual.score!==row.expected_points)errors.push({set_id:set.id,case_id:row.id,expected:row.expected_points,actual:actual.score});
    replayed++;
    const key=JSON.stringify({subquestion_id:q.id,answer:row.answer,verdicts:verdicts.map(v=>[v.criterion_id,v.verdict])});
    const existing=identities.get(key);
    if(existing){aliases.push({set_id:set.id,case_id:row.id,executed_case_id:existing.id,origin:row.origin});continue;}
    const test={id:row.id,subquestion_id:q.id,kind:row.kind,answer:row.answer,expected_points:row.expected_points,
      expected_verdicts:verdicts,note:row.note,origin:row.origin};
    if(cases.some(test=>test.id===row.id))throw Error(`Duplicate case identity ${set.id}/${row.id}`);
    identities.set(key,test);cases.push(test);
  }
  packages.push({version:1,artifact_type:'author_expected_judgments',set_id:set.id,cases});
}
if(errors.length)throw Error(JSON.stringify(errors,null,2));
for(const input of inputs)if(sha(input.file)!==input.sha256)throw Error(`Input changed ${input.file}`);
fs.mkdirSync(output,{recursive:true});
const entries=[];
for(const qa of packages){
 const file=path.join(output,`${qa.set_id}.json`);fs.writeFileSync(file,JSON.stringify(qa,null,2)+'\n',{flag:'wx'});
 entries.push({set_id:qa.set_id,file:rel(file),sha256:sha(file),cases:qa.cases.length,nonempty_cases:qa.cases.filter(c=>c.answer.trim()).length});
}
const report={created_at:new Date().toISOString(),status:'expected_judgment_replay_passed_model_not_run',
  source_cases:rows.length,projected_plus_current_cases:projected.length,checked_cases:replayed,unique_cases:entries.reduce((n,e)=>n+e.cases,0),
  deduplicated_aliases:aliases.length,sets:entries.length,errors,inputs,entries,
  deduplication_policy:'Only byte-identical answer + subquestion + complete expected criterion vector shares one future model execution. Every original case ID and source is retained as an alias.',
  execution:'Offline applyQuestionSetJudgment with author expectations only; not a model semantic judgment or a publication receipt.'};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(output,'case-aliases.json'),JSON.stringify(aliases,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sets:report.sets,checked_cases:replayed,unique_cases:report.unique_cases,aliases:aliases.length,errors:errors.length}));
