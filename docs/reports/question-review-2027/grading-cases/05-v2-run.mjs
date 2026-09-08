import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { gradeQuestionSetV3,applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
const dir='docs/reports/question-review-2027/grading-cases';
const bank=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json')).filter(s=>s.classification.topic_id==='05');
const inputs=JSON.parse(fs.readFileSync(`${dir}/05-inputs.json`));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const cases=[], n={verdict:'not_met'},m=quote=>({verdict:'met',quote}),x=quote=>({verdict:'contradicted',quote});
function add(id,s,variant,answers,vs,basis,live=true){cases.push({id,set_id:s.id,variant,answers,expected:{subquestions:s.subquestions.map((q,i)=>({subquestion_id:q.id,verdicts:q.criteria.map((c,j)=>({criterion_id:c.id,...vs[i][j]}))}))},expected_score:vs.flat().filter(v=>v.verdict==='met').length,basis,live});}
for(const s of bank)for(const variant of ['full','paraphrase','omission','contrary','empty']){
 const answers={},vs=[];
 for(const q of s.subquestions){const spec=inputs[`${s.id}/${q.id}`];const parts=spec[variant]||spec.full;
 answers[q.id]=(variant==='empty'?[]:variant==='omission'?parts.slice(1):parts).join('\n');
 vs.push(q.criteria.map((c,i)=>variant==='omission'&&i===0&&((s.id==='pilot-05-005'&&q.id==='sub1')||(s.id==='pilot-05-006'&&q.id==='sub2'))?m(answers[q.id]):variant==='empty'||variant==='omission'&&i===0?n:variant==='contrary'?x(parts[i]):m(parts[i])));}
 add(`${s.id}-${variant}`,s,variant,answers,vs,'05-inputs.json 사전 기대표; 독립 criterion 누락만 0점',variant!=='empty');
}
for(const s of bank)add(`${s.id}-bank-model-answer`,s,'bank-model-answer',Object.fromEntries(s.subquestions.map(q=>[q.id,q.model_answer.join('\n')])),s.subquestions.map(q=>q.criteria.map(()=>m(q.model_answer.join('\n')))),'저장 모범답안이 모든 명제를 충족하는지 별도 검증');
function edge(id,suffix,qid,answer,vs,basis){const s=bank.find(s=>s.id===`pilot-05-00${suffix}`);add(id,s,'edge',Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qid?answer:''])),s.subquestions.map(q=>q.id===qid?vs:q.criteria.map(()=>n)),basis);}
let t='지배기구에 적시에 서면으로 커뮤니케이션한다.';
edge('05-one-sentence',3,'sub1',t,[m(t),m(t),m(t)],'동일 문장에 상대방·시점·형태 독립 3명제');
t='적시에 서면으로 경영진에게만 알리고 지배기구에는 알리지 않는다.';
edge('05-wrong-recipient',3,'sub1',t,[x(t),m(t),m(t)],'상대방만 반대: 2점');
t='지배기구에 적시에 구두로만 알리고 서면으로는 알리지 않는다.';
edge('05-oral-only',3,'sub1',t,[m(t),m(t),x(t)],'서면만 반대: 2점');
t='지배기구에 서면으로 알리되 적시에 알릴 필요는 없다.';
edge('05-wrong-time',3,'sub1',t,[m(t),x(t),m(t)],'적시성만 반대: 2점');
t='지배기구에 알린다. 지배기구에 알린다. 지배기구에 알린다.';
edge('05-repeated-fact',3,'sub1',t,[m(t),n,n],'상대방 반복은 시점·서면 대신 못함');
t='경영진의 부정 의심은 확정된 뒤에만 지배기구에 보고한다.';
edge('05-suspected-v-confirmed',1,'sub1',t,[x(t),n],'의심 단계의 적시 커뮤니케이션을 확정 후로 바꾸면 0점');
t='법적 조언은 모든 제한 상황에서 반드시 받아야 한다.';
edge('05-advice-mandatory',1,'sub2',t,[x(t)],'고려할 수 있음과 항상 의무를 구별');
t='유의적 위험으로 취급한다. 위험에 대처하는 통제를 식별하고 설계를 평가한다.';
edge('05-control-implementation-missing',5,'sub2',t,[m('유의적 위험으로 취급한다.'),n],'세 활동은 결합 1점: 실행 여부 누락 시 해당 criterion 0점');
t='유의적 위험으로 취급한다. 통제를 식별하고 설계를 평가하며 운영효과성을 테스트한다.';
edge('05-control-operating-effectiveness',5,'sub2',t,[m('유의적 위험으로 취급한다.'),n],'운영효과성 테스트를 실행 여부 결정의 명시적 답 대신 쓴 경계');
t='의심만으로는 외부 보고 의무나 적합성을 검토하지 않고 법규위반이 확정되면 무조건 외부 기관에 보고한다.';
edge('05-report-always',4,'sub2',t,[x(t),x(t)],'의심 포함 여부·보고 판단을 무조건 보고로 대체 불가');
t=inputs['pilot-05-006/sub2'].full[1];
edge('05-implied-conclusion',6,'sub2',t,[m(t),m(t)],'사업 근거와 부정 목적 추가평가가 형식 확인 불충분을 분명히 함축');
t='형식적 적법성만 확인하면 충분하다. '+inputs['pilot-05-006/sub2'].full[1];
edge('05-explicit-conflicting-conclusion',6,'sub2',t,[x('형식적 적법성만 확인하면 충분하다.'),m(inputs['pilot-05-006/sub2'].full[1])],'명시적 반대 판단과 독립된 평가명제 분리');
t='당기재무제표에 반영될 추정치만 검토하고 전기재무제표의 유의적 추정에 관한 판단과 가정은 재검토하지 않는다.';
edge('05-prior-period-swapped',6,'sub1',t,[x(t)],'전기 소급재검토를 당기만으로 대체 불가');
t='수익인식에 부정위험이 존재한다고 가정한다.';
edge('05-revenue-assumption-only',5,'sub1',t,[m(t),n],'위험 존재 추정으로 판단 함축; 유형·거래·주장별 평가 누락');
for(const [suffix,qid] of [[2,'sub1'],[3,'sub2'],[4,'sub1'],[4,'sub2']]){
 const parts=inputs[`pilot-05-00${suffix}/${qid}`].full;
 edge(`05-extra-first-${suffix}-${qid}`,suffix,qid,['감사보수 협의도 별도로 한다.',...parts].map((v,i)=>`${i+1}. ${v}`).join('\n'),parts.map(m),'무관한 첫 문장 뒤 모든 정답: 항목 잘림 없음');
}
const als=new AsyncLocalStorage(),originalFetch=globalThis.fetch,prompts={};let mock=null,calls=0;
globalThis.fetch=async(url,init)=>{const p=JSON.parse(init.body),r=als.getStore();if(mock){calls++;prompts[mock.id]=p;return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(mock.expected),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});}if(r)r.requests.push({model:p.model,input:p.input,instructions:p.instructions,text:p.text,prompt_sha256:hash(p.input)});const res=await originalFetch(url,init);if(r)r.responses.push({status:res.status,body:await res.clone().json()});return res;};
function compare(c,result,raw=false){const diffs=[];for(const q of c.expected.subquestions)for(const v of q.verdicts){const aq=result.subquestions.find(a=>a.subquestion_id===q.subquestion_id),a=(raw?aq?.verdicts:aq?.criteria)?.find(a=>a.criterion_id===v.criterion_id);if(a?.verdict!==v.verdict)diffs.push({subquestion:q.subquestion_id,criterion:v.criterion_id,expected:v.verdict,actual:a?.verdict});if(a?.quote&&!c.answers[q.subquestion_id].replace(/\s+/g,' ').includes(a.quote.replace(/\s+/g,' ')))diffs.push({invalid_quote:a.quote});}if(!raw&&result.score!==c.expected_score)diffs.push({expected_score:c.expected_score,actual_score:result.score});return diffs;}
const offline=[];for(const c of cases){mock=c;calls=0;const result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers,'offline-key');offline.push({id:c.id,model_calls:calls,result,differences:compare(c,result)});}mock=null;
const boundaries=[];for(const s of bank){const good=cases.find(c=>c.id===`${s.id}-full`);for(const q of s.subquestions)for(const c of q.criteria){const j=structuredClone(good.expected);j.subquestions.find(a=>a.subquestion_id===q.id).verdicts.find(v=>v.criterion_id===c.id).verdict='partial';const result=applyQuestionSetJudgment(s,good.answers,j);assert.equal(result.score,good.expected_score-1);boundaries.push({kind:'partial-disallowed',set_id:s.id,qid:q.id,criterion_id:c.id,score:result.score,passed:true});}}
for(const scope of ['global','local'])for(const flag of ['salad_detected','injection_detected']){const s=bank[0],good=cases[0],j=structuredClone(good.expected);if(scope==='global')j[flag]=true;else j.subquestions[0][flag]=true;const result=applyQuestionSetJudgment(s,good.answers,j),expected=flag==='salad_detected'?3:scope==='global'?0:1;boundaries.push({kind:flag,scope,expected,result,passed:result.score===expected});}
for(const kind of ['invented','cross-question']){const s=bank[0],good=cases[0],j=structuredClone(good.expected);j.subquestions[0].verdicts[0].quote=kind==='invented'?'답안에 없는 허위 인용':good.answers.sub2;const result=applyQuestionSetJudgment(s,good.answers,j);boundaries.push({kind,result,passed:result.score===2});}
fs.writeFileSync(`${dir}/05-v2-cases.json`,JSON.stringify(cases,null,2)+'\n');fs.writeFileSync(`${dir}/05-v2-public.json`,JSON.stringify(bank.map(compilePublicQuestionSet),null,2)+'\n');fs.writeFileSync(`${dir}/05-v2-offline.json`,JSON.stringify({offline,boundaries},null,2)+'\n');
const hashes=Object.fromEntries(['lib/questionV3Grading.ts','lib/questionV3.ts','lib/ai/openaiStructured.ts',`${dir}/05-inputs.json`].map(p=>[p,hash(fs.readFileSync(p))]));hashes.topic=hash(JSON.stringify(bank));
const liveCases=cases.filter(c=>c.live),fingerprint=hash(JSON.stringify({hashes,cases,model:process.env.CPA_GRADING_MODEL||'gpt-5.6-luna'}));
const meta={at:new Date().toISOString(),fingerprint,hashes,model:process.env.CPA_GRADING_MODEL||'gpt-5.6-luna',base_question_answer_combinations:60,extra_target_answers:12+cases.filter(c=>c.variant==='edge').length,initial_live_calls:liveCases.length,estimated_input_tokens:Math.ceil(liveCases.reduce((sum,c)=>sum+(prompts[c.id]?.input.length||0),0)/1.5),max_output_tokens_per_call:8000,estimate_note:'문자수/1.5의 사전 근사; 불일치 총3회 재측정, HTTP 재시도 최대3',offline_mismatches:offline.filter(r=>r.differences.length).map(r=>r.id),boundary_failures:boundaries.filter(r=>!r.passed).map(r=>r.kind)};
fs.writeFileSync(`${dir}/05-v2-run-metadata.json`,JSON.stringify(meta,null,2)+'\n');console.log(JSON.stringify(meta));
if(process.argv.includes('--live')){const out=`${dir}/05-v2-live.jsonl`,done=fs.existsSync(out)?fs.readFileSync(out,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
 async function run(c,attempt){if(done.some(r=>r.id===c.id&&r.attempt===attempt&&r.fingerprint===fingerprint))return;const r={id:c.id,attempt,fingerprint,at:new Date().toISOString(),requests:[],responses:[]};await als.run(r,async()=>{try{r.result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers);r.differences=compare(c,r.result);const text=r.responses.at(-1)?.body?.output?.flatMap(o=>o.content||[]).find(o=>o.type==='output_text')?.text;if(text){r.raw_judgment=JSON.parse(text);r.raw_differences=compare(c,r.raw_judgment,true);}}catch(e){r.error={name:e.name,message:e.message,code:e.code,status:e.status};}});fs.appendFileSync(out,JSON.stringify(r)+'\n');done.push(r);console.log(c.id,attempt,r.error||{score:r.result.score,differences:r.differences.length,raw:r.raw_differences?.length});}
 for(let i=0;i<liveCases.length;i+=2)await Promise.all(liveCases.slice(i,i+2).map(c=>run(c,1)));
 const repeat=liveCases.filter(c=>done.some(r=>r.id===c.id&&r.attempt===1&&r.fingerprint===fingerprint&&(r.error||r.differences?.length||r.raw_differences?.length)));
 for(let i=0;i<repeat.length;i+=2)await Promise.all(repeat.slice(i,i+2).map(async c=>{for(const a of [2,3])await run(c,a);}));
}
globalThis.fetch=originalFetch;
