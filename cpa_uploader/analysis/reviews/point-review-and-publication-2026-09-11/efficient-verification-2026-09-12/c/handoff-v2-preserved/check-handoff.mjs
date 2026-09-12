import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {validateQuestionAuthoringPlan} from '../../../../../questionAuthoringPlan.ts';
import {buildSourceCatalog} from '../../../../../questionSourceCatalog.mjs';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const E=`${D}/efficient-verification-2026-09-12/c`;
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const manifest=read(`${D}/a/execution-all-v9/manifest.json`),bank=read(manifest.bank_file),selected=read(`${E}/selected-files.json`),reviews=read(`${E}/question-reviews.json`).entries,reps=read(`${E}/representative-cases.json`).entries;
const counts={sets:0,questions:0,criteria:0,qa_cases:0,plans:0,source_refs:0,representative_cases:reps.length};
const errors=[];const qaOrigins=[];
const catalogIds=new Set(buildSourceCatalog().units.map(u=>u.id));
function checkQa(qa,s){
 assert.equal(qa.version,1);assert.equal(qa.artifact_type,'author_expected_judgments');assert.equal(qa.set_id,s.id);assert.equal(new Set(qa.cases.map(x=>x.id)).size,qa.cases.length);
 for(const t of qa.cases){const q=s.subquestions.find(q=>q.id===t.subquestion_id);assert(q);assert.equal(typeof t.answer,'string');assert(Number.isInteger(t.expected_points));assert.deepEqual(t.expected_verdicts.map(v=>v.criterion_id).sort(),q.criteria.map(c=>c.id).sort());const sum=t.expected_verdicts.reduce((n,v)=>{const c=q.criteria.find(c=>c.id===v.criterion_id);assert(['met','partial','not_met','contradicted'].includes(v.verdict));assert(v.verdict!=='partial'||c.scores.partial!==undefined);return n+(v.verdict==='met'?c.scores.met:v.verdict==='partial'?c.scores.partial:0);},0);assert.equal(t.expected_points,sum);counts.qa_cases++;}
}
for(const j of selected.entries){try{
 for(const [file,sha] of [[j.file,j.sha256],[j.plan_file,j.plan_sha256],[j.qa_file,j.qa_sha256]])assert.equal(hash(file),sha);
 const raw=read(j.file),s=(Array.isArray(raw)?raw:[raw]).find(s=>s.id===j.set_id);assert(s);counts.sets++;counts.questions+=s.subquestions.length;counts.criteria+=s.subquestions.flatMap(q=>q.criteria).length;
 const old=bank.find(x=>x.id===s.id);if(old){assert.deepEqual(s.shared_context,old.shared_context);if(s.id==='pilot-19-003'){assert.deepEqual(s.source_refs.filter(r=>['src2','src3'].includes(r.id)),old.source_refs.filter(r=>['src2','src3'].includes(r.id)));assert.deepEqual(s.subquestions.map(q=>[q.prompt,q.model_answer,q.criteria.map(c=>[c.id,c.claim,c.critical_facts,c.max_points,c.scores])]),old.subquestions.map(q=>[q.prompt,q.model_answer,q.criteria.map(c=>[c.id,c.claim,c.critical_facts,c.max_points,c.scores])]));}else assert.deepEqual(s.source_refs,old.source_refs);}
 const pp=read(j.plan_file),p=pp.plans?.find(p=>p.set_id===s.id)??pp;assert.equal(p.set_id,s.id);assert.deepEqual(validateQuestionAuthoringPlan(p,true),[]);for(const id of p.source_unit_ids)assert(catalogIds.has(id),id);counts.plans++;
 const qa=read(j.qa_file);checkQa(qa,s);
 const oldJob=manifest.jobs.find(x=>x.set_id===s.id);if(oldJob){const oq=read(oldJob.qa_file);for(const oc of oq.cases){const nc=qa.cases.find(c=>c.id===oc.id);assert(nc);assert.equal(nc.answer,oc.answer);assert.equal(nc.subquestion_id,oc.subquestion_id);}qaOrigins.push({set_id:s.id,original_cases_preserved:oq.cases.length,selected_cases:qa.cases.length});}
 for(const q of s.subquestions){const r=reviews.find(r=>r.set_id===s.id&&r.subquestion_id===q.id);assert(r?.reviewed_at);assert.deepEqual(Object.keys(r.checks).sort(),['source','answer','prompt','points','style','topics','edition','nonduplication'].sort());assert.equal(r.point_review.after_points,q.criteria.reduce((n,c)=>n+c.max_points,0));const rr=reps.filter(r=>r.set_id===s.id&&r.subquestion_id===q.id);assert.equal(rr.length,q.criteria.reduce((n,c)=>n+c.max_points,0)===1?2:3);counts.source_refs+=r.source_evidence.length;}
 for(const sf of selected.representative_supplements.filter(f=>read(f.file).set_id===s.id)){assert.equal(hash(sf.file),sf.sha256);checkQa(read(sf.file),s);}
 }catch(error){errors.push({set_id:j.set_id,error:String(error)});}}
assert.equal(hash(manifest.bank_file),manifest.bank_sha256);
const result={version:1,checked_at:new Date().toISOString(),counts,errors,original_qa_identity_preservation:qaOrigins,bank_sha256:manifest.bank_sha256,original_bank_unchanged:true,scope:'형상·해시·인용 보존·QA 기대 합산·배정 전수 연결 검사. 내용 판정은 question-reviews의 개별 agent 대조 기록에 있으며 정적 검사로 대체하지 않는다.',api_calls:0,db_writes:0};
fs.writeFileSync(`${E}/handoff-static-checks.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({counts,errors}));if(errors.length)process.exitCode=1;
