import fs from 'node:fs';import crypto from 'node:crypto';import {AsyncLocalStorage} from 'node:async_hooks';
import {gradeQuestionSetV3} from '../../../../lib/questionV3Grading.ts';
const dir='docs/reports/question-review-2027/grading-cases';
const set=JSON.parse(fs.readFileSync('docs/reports/question-review-2027/grading-cases/14-followup-before.json'));
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const code=Object.fromEntries(['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts'].map(p=>[p,hash(fs.readFileSync(p,'utf8'))]));
const old=JSON.parse(fs.readFileSync(`${dir}/14-v2-cases.json`));
const cases=old.filter(c=>c.set_id===set.id).map(c=>structuredClone(c));
const last=q=>q.criteria.length-1;
for(const c of cases){if(c.variant==='bank-model-answer'){c.answers=Object.fromEntries(set.subquestions.map(q=>[q.id,q.model_answer.join('\n')]));for(const e of c.expected.subquestions){const q=set.subquestions.find(q=>q.id===e.subquestion_id);e.verdicts.forEach(v=>v.quote=q.model_answer.join('\n'));}}}
function edge(id,answer,verdict){cases.push({id,variant:'followup-boundary',set_id:set.id,answers:{sub1:'',sub2:answer},expected:{subquestions:set.subquestions.map(q=>({subquestion_id:q.id,verdicts:q.criteria.map((c,i)=>({criterion_id:c.id,verdict:q.id==='sub2'&&i===last(q)?verdict:'not_met'}))}))},expected_score:verdict==='met'?1:0});}
edge('14-report-other-action','그룹감사인이 부문감사인에게 자신이 발견한 사항을 알린다.','not_met');
edge('14-report-both-actions','그룹업무팀이 자신의 발견사항을 부문감사인에게 알린다. 또한 부문감사인이 그룹업무팀에 보고할 사항의 형식과 내용을 정하여 전달한다.','met');
edge('14-report-no-format','부문감사인은 그룹업무팀에게 발견사항을 보고해야 한다.','not_met');
edge('14-report-format-only','그룹업무팀이 부문감사인이 제출할 보고의 형식만 정한다.','contradicted');
edge('14-report-format-omission','그룹업무팀이 부문감사인이 제출할 보고의 형식을 정한다.','not_met');
edge('14-report-denial','부문감사인이 그룹업무팀에 보고할 사항의 형식과 내용은 정하여 전달할 필요가 없다.','contradicted');
edge('14-report-replacement','부문감사인으로부터 보고받는 대신 그룹업무팀이 자기 발견사항만 부문감사인에게 알리면 된다.','contradicted');
edge('14-report-wrong-owner','부문감사인이 그룹업무팀과 협의하지 않고 보고 형식과 내용을 임의로 정하도록 해야 한다.','contradicted');
const meta={at:new Date().toISOString(),set,code,model:process.env.CPA_GRADING_MODEL||'gpt-5.6-luna',cases};meta.fingerprint=hash(meta.set)+hash({code,model:meta.model,cases});
const out=`${dir}/14-followup-baseline-live.jsonl`,done=fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const als=new AsyncLocalStorage(),original=globalThis.fetch;
globalThis.fetch=async(url,init)=>{const ctx=als.getStore(),p=JSON.parse(init.body);ctx.requests.push({model:p.model,input_sha256:hash(p.input),schema_sha256:hash(p.text),instructions_sha256:hash(p.instructions)});const r=await original(url,init);ctx.responses.push({status:r.status,body:await r.clone().json()});return r;};
async function run(c,attempt){if(done.some(r=>r.id===c.id&&r.attempt===attempt&&r.fingerprint===meta.fingerprint))return;const rec={id:c.id,attempt,fingerprint:meta.fingerprint,at:new Date().toISOString(),requests:[],responses:[]};await als.run(rec,async()=>{try{rec.result=await gradeQuestionSetV3(set,c.answers);rec.differences=[];for(const q of c.expected.subquestions)for(const v of q.verdicts){const actual=rec.result.subquestions.find(a=>a.subquestion_id===q.subquestion_id).criteria.find(a=>a.criterion_id===v.criterion_id);if(v.verdict!==actual.verdict)rec.differences.push({q:q.subquestion_id,c:v.criterion_id,expected:v.verdict,actual:actual.verdict});if(['met','contradicted'].includes(actual.verdict)&&!c.answers[q.subquestion_id].replace(/\s+/g,' ').includes(actual.quote?.replace(/\s+/g,' ')))rec.differences.push({invalid_quote:actual.quote});}if(rec.result.score!==c.expected_score)rec.differences.push({expected_score:c.expected_score,actual_score:rec.result.score});const text=rec.responses.at(-1)?.body?.output?.flatMap(o=>o.content||[]).find(o=>o.type==='output_text')?.text;if(text)rec.raw_judgment=JSON.parse(text);}catch(e){rec.error={message:e.message};}});fs.appendFileSync(out,JSON.stringify(rec)+'\n');done.push(rec);console.log(c.id,attempt,rec.error||rec.differences);}
fs.writeFileSync(`${dir}/14-followup-baseline-contract.json`,JSON.stringify(meta,null,2)+'\n');
const selected=process.argv.includes('--probe')?cases.filter(c=>['14-wrong-report-direction','14-report-both-actions'].includes(c.id)):cases;
for(let i=0;i<selected.length;i+=3)await Promise.all(selected.slice(i,i+3).map(c=>run(c,1)));
const repeats=selected.filter(c=>c.id==='14-wrong-report-direction'||c.variant==='followup-boundary'||done.some(r=>r.id===c.id&&r.fingerprint===meta.fingerprint&&(r.error||r.differences?.length)));
for(let i=0;i<repeats.length;i+=3)await Promise.all(repeats.slice(i,i+3).map(async c=>{for(const a of [2,3])await run(c,a);}));
globalThis.fetch=original;
