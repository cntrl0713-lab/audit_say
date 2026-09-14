import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
const D='cpa_uploader/drafts/case-followup-2026-09-14', O=`${D}/a`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const sets=read(`${O}/sets.json`),design=read(`${O}/design.json`),qa=read(`${O}/qa.json`),bank=read(`${D}/bank-before.json`),catalog=read(`${D}/source-catalog.json`);
const rows=[];
for(const set of sets){
 const d=design.find(x=>x.set_id===set.id);
 d.source_evidence=set.source_refs.map(s=>{const u=catalog.units.find(u=>u.id===s.id);return {source_unit_id:s.id,file:s.file,file_sha256:sha(fs.readFileSync(s.file)),quote_sha256:sha(s.source_quote),authority:u.authority,start_line:u.startLine,end_line:u.endLine,standard:u.standard,paragraph:u.paragraph,quote_exact:fs.readFileSync(s.file,'utf8').includes(s.source_quote),current_official_comparison:u.paragraph==='A58'?'등록학습전재는 첫문장만 인용한다.2026공식전문PDF358 L15358~15375의 전체문단을 읽어 잔여기간 위험의 첫명제와 뒤의고려요소를 구별했고, 이물음에는 앞의시간적한계만 득점시킨다.':'2026공식전문대조위치와판정은official_edition_comparison.ranges 참조'};});
 const errors=validateQuestionAuthoringPlan(d.plan);
 for(const id of d.plan.source_unit_ids)if(!catalog.units.some(u=>u.id===id))errors.push(`missing unit ${id}`);
 for(const s of d.source_evidence)if(!s.quote_exact)errors.push(`quote ${s.source_unit_id}`);
 for(const q of set.subquestions){const max=q.criteria.length;for(const kind of ['partial','wrong']){const r=qa.filter(x=>x.set_id===set.id&&x.subquestion_id===q.id&&x.kind===kind);if(r.length!==1)errors.push(`${q.id}/${kind} count`);else if(r[0].expected_points!==r[0].met_criterion_ids.length||r[0].met_criterion_ids.some(id=>!q.criteria.some(c=>c.id===id))||(kind==='partial'?!(0<r[0].expected_points&&r[0].expected_points<max):r[0].expected_points!==0))errors.push(`${q.id}/${kind} role`);}}
 rows.push({set_id:set.id,plan_source_qa_errors:errors,facts_chars:d.facts_chars});
}
fs.writeFileSync(`${O}/design.json`,JSON.stringify(design,null,2)+'\n');
const fullCheck=validateAuthoringBank([...bank,...sets]);
const bankCheck={errors:fullCheck.errors,setCount:fullCheck.sets.length,subquestionCount:fullCheck.subquestionCount,criterionCount:fullCheck.criterionCount,totalPoints:fullCheck.totalPoints};
const result={checked_at:new Date().toISOString(),method:'Static shape, exact quote, plan catalog linkage and fixed representative QA role validation; content review is separate',rows,bank_check:bankCheck};
fs.writeFileSync(`${O}/validation.json`,JSON.stringify(result,null,2)+'\n');
const files=[...new Set(design.flatMap(d=>[...d.source_evidence.map(x=>x.file),...d.learning_source_comparison.map(x=>x.file),d.official_edition_comparison.file]))];
fs.writeFileSync(`${O}/source-files.json`,JSON.stringify(files.map(file=>({file,sha256:sha(fs.readFileSync(file))})),null,2)+'\n');
console.log(JSON.stringify({rows,bank_check:bankCheck,hashes:Object.fromEntries(['sets','design','review','qa'].map(n=>[n,sha(fs.readFileSync(`${O}/${n}.json`))]))}));
if(rows.some(r=>r.plan_source_qa_errors.length)||bankCheck.errors.length)process.exitCode=1;
