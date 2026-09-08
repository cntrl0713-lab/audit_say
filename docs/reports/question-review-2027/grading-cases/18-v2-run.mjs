// Internal synthetic review. node --env-file=.env.local .../18-run.mjs [--live]
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';
import {gradeQuestionSetV3,applyQuestionSetJudgment} from '../../../../lib/questionV3Grading.ts';
import {compilePublicQuestionSet} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.id.startsWith('pilot-18'));
const inputs=JSON.parse(fs.readFileSync(`${dir}/18-inputs.json`,'utf8').replace(/^\uFEFF/,''));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),sha=p=>hash(fs.readFileSync(p));
const cases=[],met=quote=>({verdict:'met',quote}),not={verdict:'not_met'};
function add(s,variant,answers,vs,id,live=true){const expected={subquestions:s.subquestions.map((q,i)=>({subquestion_id:q.id,verdicts:q.criteria.map((c,j)=>({criterion_id:c.id,...vs[i][j]}))}))};cases.push({id:id||`${s.id}-${variant}`,set_id:s.id,variant,answers,expected,expected_score:expected.subquestions.flatMap(q=>q.verdicts).filter(v=>v.verdict==='met').length,live,basis:'18-inputs.json + reviewed KGA1200 criterion contract; independent expectations before execution'});}
for(const s of sets){for(const q of s.subquestions){const i=inputs[`${s.id}/${q.id}`];i.full??=q.model_answer;assert.equal(i.full.length,q.criteria.length);assert.equal(i.paraphrase.length,q.criteria.length);}
for(const v of ['full','paraphrase','omission','contrary','empty']){const answers={},vs=[];for(const q of s.subquestions){const inp=inputs[`${s.id}/${q.id}`],t=inp[v]||inp.full,omit=inp.omit_index??0;answers[q.id]=(v==='empty'?[]:v==='omission'?t.filter((_,j)=>j!==omit):t).join('\n');vs.push(q.criteria.map((c,j)=>v==='empty'||(v==='omission'&&j===omit)?not:v==='contrary'?{verdict:'contradicted',quote:t[j]}:met(t[j])));}add(s,v,answers,vs);}
add(s,'bank-model-answer',Object.fromEntries(s.subquestions.map(q=>[q.id,q.model_answer.join('\n')])),s.subquestions.map(q=>q.criteria.map(()=>met(q.model_answer.join('\n')))));
}
function edge(setid,qid,id,answer,vs,live=true){const s=sets.find(s=>s.id===setid);add(s,'edge',Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qid?answer:''])),s.subquestions.map(q=>q.id===qid?vs:q.criteria.map(()=>not)),id,live);}

for(const s of sets)for(const q of s.subquestions){const lines=inputs[s.id+'/'+q.id].full;
const joined=lines.join(' ');edge(s.id,q.id,s.id+'-'+q.id+'-shared-quote',joined,q.criteria.map(()=>met(joined)));
edge(s.id,q.id,s.id+'-'+q.id+'-reverse-extra',['오늘은 맑다.',...lines.toReversed()].join('\n'),lines.map(met));
edge(s.id,q.id,s.id+'-'+q.id+'-repeated-fact',[lines[0],lines[0],lines[0]].join('\n'),lines.map((t,i)=>i===0?met(t):not));
for(let i=0;i<lines.length;i++)edge(s.id,q.id,s.id+'-'+q.id+'-only-'+q.criteria[i].id,lines[i],lines.map((t,j)=>j===i?met(t):not));
}
const contra=quote=>({verdict:'contradicted',quote});
edge('pilot-18-001','subq1','18-scope-small-other-definition','비상장이고 업무가 단순하기만 하면 KGA 1200을 적용할 수 있다. 일반 감사기준서는 적용하지 않는다.',[contra('비상장이고 업무가 단순하기만 하면 KGA 1200을 적용할 수 있다.'),contra('일반 감사기준서는 적용하지 않는다.')]);
edge('pilot-18-002','sub1','18-transition-missing-areas','일반 감사기준서에 따라 감사를 수행한다. 업무조건을 다시 합의한다. 이미 수행한 업무가 충분하고 적합한지 평가한다. 필요한 추가 절차를 설계·수행하고 필요에 따라 문서화를 추가한다.',[met('일반 감사기준서에 따라 감사를 수행한다.'),met('업무조건을 다시 합의한다.'),not,met('필요한 추가 절차를 설계·수행하고 필요에 따라 문서화를 추가한다.')]);
edge('pilot-18-002','sub1','18-transition-extra-no-documentation','일반 감사기준서 준수를 위해 필요한 추가 절차를 설계·수행한다.',[not,not,not,not]);
edge('pilot-18-002','sub2','18-retrospective','당기 감사부터 적용하되 전기 감사도 일반 감사기준서로 소급하여 다시 수행해야 한다.',[contra('당기 감사부터 적용하되 전기 감사도 일반 감사기준서로 소급하여 다시 수행해야 한다.')]);
edge('pilot-18-003','sub1','18-oral','회계감사기준 전체 준수 표명은 금지된다. 일반 감사기준서나 일부 언급도 금지된다. 적격 기업과 구두로만 합의하면 KGA 1200 대신 일반 감사기준서를 적용할 수 있다.',[met('회계감사기준 전체 준수 표명은 금지된다.'),met('일반 감사기준서나 일부 언급도 금지된다.'),contra('적격 기업과 구두로만 합의하면 KGA 1200 대신 일반 감사기준서를 적용할 수 있다.')]);
edge('pilot-18-004','sub2','18-mixed','기업과 서면으로 합의한다. 두 기준의 편리한 조항만 골라 섞어 적용한다.',[met('기업과 서면으로 합의한다.'),contra('두 기준의 편리한 조항만 골라 섞어 적용한다.')]);
const ds=sets.find(s=>s.id==='pilot-18-003').subquestions[1],dl=inputs['pilot-18-003/sub2'].full;
function doc(id,answer,index,verdict='contradicted'){edge('pilot-18-003','sub2',id,answer,ds.criteria.map((_,i)=>i===index?{verdict,...(verdict==='not_met'?{}:{quote:answer})}:not));}
doc('18-wrong-start','감사계약일로부터 60일 이내에 최종감사파일 취합을 완료한다.',3);
doc('18-number-only','60일, 5년, 10년',3,'not_met');
doc('18-delete-after-report','감사보고서를 발행한 뒤에는 보존기간이 끝나지 않았어도 문서를 폐기할 수 있다.',4);
doc('18-document-reason-only','취합 후 문서를 수정할 필요가 생기면 구체적 이유를 기록한다.',10,'met');
doc('18-doc-no-reviewer','최종감사파일 취합 후 문서를 수정한 사람과 수정일만 기록한다.',11,'not_met');
doc('18-procedure-incomplete','수행한 감사절차의 성격·시기·범위만 기록한다.',6,'not_met');
const originalFetch=globalThis.fetch,als=new AsyncLocalStorage();let mock=null,calls=0;const prompts={};
globalThis.fetch=async(url,init)=>{const p=JSON.parse(init.body),ctx=als.getStore();if(mock){calls++;prompts[mock.id]=p;return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(mock.expected),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});}if(ctx)ctx.requests.push({model:p.model,prompt_sha256:hash(p.input)});const r=await originalFetch(url,init);if(ctx)ctx.responses.push({status:r.status,body:await r.clone().json()});return r;};
const norm=t=>t.replace(/\s+/g,' ').trim();
function compare(c,r,raw=false){const diffs=[];for(const q of c.expected.subquestions)for(const v of q.verdicts){const a=r.subquestions.find(x=>x.subquestion_id===q.subquestion_id);const av=(raw?a?.verdicts:a?.criteria)?.find(x=>x.criterion_id===v.criterion_id);if(av?.verdict!==v.verdict)diffs.push({q:q.subquestion_id,c:v.criterion_id,expected:v.verdict,actual:av?.verdict});if(['met','partial','contradicted'].includes(av?.verdict)&&(!av.quote||!norm(c.answers[q.subquestion_id]).includes(norm(av.quote))))diffs.push({q:q.subquestion_id,c:v.criterion_id,invalid_quote:av.quote});}if(!raw&&r.score!==c.expected_score)diffs.push({expected_score:c.expected_score,actual_score:r.score});return diffs;}
const offline=[];for(const c of cases){mock=c;calls=0;const result=await gradeQuestionSetV3(sets.find(s=>s.id===c.set_id),c.answers,'offline-key');offline.push({id:c.id,model_calls:calls,result,differences:compare(c,result)});}mock=null;
const boundaries=[];for(const s of sets){const c=cases.find(c=>c.id===`${s.id}-full`);for(const q of s.subquestions)for(const v of q.criteria){const j=structuredClone(c.expected);j.subquestions.find(x=>x.subquestion_id===q.id).verdicts.find(x=>x.criterion_id===v.id).verdict='partial';const result=applyQuestionSetJudgment(s,c.answers,j);assert.equal(result.score,c.expected_score-1);boundaries.push({kind:'partial-not-allowed',set:s.id,q:q.id,c:v.id,passed:true});}
for(const flag of ['salad_detected','injection_detected'])for(const scope of ['local','global']){const j=structuredClone(c.expected);(scope==='global'?j:j.subquestions[0])[flag]=true;const result=applyQuestionSetJudgment(s,c.answers,j),score=flag==='salad_detected'?c.expected_score:scope==='global'?0:s.subquestions[1].criteria.length;assert.equal(result.score,score);boundaries.push({kind:flag,scope,set:s.id,score,passed:true});}
for(const kind of ['invented','cross-question']){const j=structuredClone(c.expected);j.subquestions[0].verdicts[0].quote=kind==='invented'?'답안에 전혀 없는 허위 인용':c.answers[s.subquestions[1].id];const r=applyQuestionSetJudgment(s,c.answers,j);assert.equal(r.score,c.expected_score-1);boundaries.push({kind,set:s.id,passed:true});}}
assert.ok(offline.filter(r=>r.id.endsWith('-empty')).every(r=>r.model_calls===0&&r.result.score===0));
const pub=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.public.json'));const encrypted=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));const deployment={public_matches:sets.every(s=>JSON.stringify(compilePublicQuestionSet(s))===JSON.stringify(pub.find(x=>x.id===s.id))),encrypted_matches:sets.every(s=>JSON.stringify(s)===JSON.stringify(encrypted.find(x=>x.id===s.id)))};
for(const s of sets)assert.ok(!/source_quote|critical_facts|model_answer|requirements|content_hash/.test(JSON.stringify(compilePublicQuestionSet(s))));
const hashes=Object.fromEntries([file,'lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts',`${dir}/18-inputs.json`].map(p=>[p,sha(p)])),model=process.env.CPA_GRADING_MODEL||'gpt-5.6-luna';
// Only reviewed topic data participates in cache identity, so independent topic edits do not invalidate this run.
const fingerprint=hash(JSON.stringify({sets,model,code:hashes['lib/questionV3.ts'],prompt:hashes['lib/questionV3Grading.ts'],cases}));
const live=cases.filter(c=>c.live&&c.variant!=='empty');
const metadata={prompt_hashes:Object.fromEntries(Object.entries(prompts).map(([id,p])=>[id,hash(p.input)])),at:new Date().toISOString(),fingerprint,model,hashes,base_question_answer_combinations:40,cases:cases.length,initial_live_calls:live.length,estimated_input_tokens:Math.ceil(live.reduce((n,c)=>n+(prompts[c.id]?.input.length||0),0)/1.5),max_output_tokens_per_call:8000,estimate_note:'Korean characters/1.5 approximation; every first-run mismatch or error repeated twice',deployment,offline_mismatches:offline.filter(r=>r.differences.length).map(r=>r.id)};
for(const [name,data]of Object.entries({'18-v2-cases':cases,'18-v2-offline':{offline,boundaries,deployment},'18-v2-public':sets.map(compilePublicQuestionSet),'18-v2-run-metadata':metadata}))fs.writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(metadata));
if(false){const out=`${dir}/18-v2-live.jsonl`,done=fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
async function run(c,attempt){if(done.some(r=>r.id===c.id&&r.attempt===attempt&&r.fingerprint===fingerprint))return;const rec={id:c.id,attempt,fingerprint,at:new Date().toISOString(),requests:[],responses:[]};await als.run(rec,async()=>{try{rec.result=await gradeQuestionSetV3(sets.find(s=>s.id===c.set_id),c.answers);rec.differences=compare(c,rec.result);const txt=rec.responses.at(-1)?.body?.output?.flatMap(o=>o.content||[]).find(o=>o.type==='output_text')?.text;if(txt){rec.raw_judgment=JSON.parse(txt);rec.raw_differences=compare(c,rec.raw_judgment,true);}}catch(e){rec.error={name:e.name,message:e.message,code:e.code,status:e.status};}});fs.appendFileSync(out,JSON.stringify(rec)+'\n');done.push(rec);console.log(c.id,attempt,rec.error?'ERROR':`score=${rec.result.score} diff=${rec.differences.length} raw=${rec.raw_differences?.length}`);}
for(let i=0;i<live.length;i+=3)await Promise.all(live.slice(i,i+3).map(c=>run(c,1)));
const repeat=live.filter(c=>done.some(r=>r.id===c.id&&r.attempt===1&&r.fingerprint===fingerprint&&(r.error||r.differences?.length||r.raw_differences?.length)));for(let i=0;i<repeat.length;i+=3)await Promise.all(repeat.slice(i,i+3).map(async c=>{for(const a of [2,3])await run(c,a);}));}
globalThis.fetch=originalFetch;
