// Internal synthetic evaluation. node --env-file=.env.local .../04-run.mjs [--live]
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { gradeQuestionSetV3, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../../../../lib/questionV3Encryption.ts';
const dir='docs/reports/question-review-2027/grading-cases';
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const all=JSON.parse(fs.readFileSync(bankFile)), bank=all.filter(s=>s.classification.topic_id==='04');
const inputs=JSON.parse(fs.readFileSync(`${dir}/04-inputs.json`));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const norm=t=>t.replace(/\s+/g,' ').trim();
const m=quote=>({verdict:'met',quote}), n={verdict:'not_met'}, x=quote=>({verdict:'contradicted',quote});
const cases=[];
function add(id,s,variant,answers,vs,basis,options={}){
  const expected={subquestions:s.subquestions.map((q,i)=>({subquestion_id:q.id,verdicts:q.criteria.map((c,j)=>({criterion_id:c.id,...vs[i][j]}))}))};
  cases.push({id,set_id:s.id,variant,answers,expected,expected_score:expected.subquestions.flatMap(q=>q.verdicts).filter(v=>v.verdict==='met').length,basis,...options});
}
function edge(id,setid,qid,answer,vs,basis,options={}){
  const s=bank.find(s=>s.id===setid);
  add(id,s,'edge',Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qid?answer:''])),s.subquestions.map(q=>q.id===qid?vs:q.criteria.map(()=>n)),basis,options);
}
for(const s of bank)for(const variant of ['full','paraphrase','omission','contrary','empty']){
  const answers={},vs=[];
  for(const q of s.subquestions){
    const spec=inputs[`${s.id}/${q.id}`], entries=spec[variant]||spec.full;
    answers[q.id]=(variant==='empty'?[]:variant==='omission'?entries.slice(1):entries).join('\n');
    if(variant==='omission'&&q.criteria.length===1)answers[q.id]='감사문서는 감사품질에 도움을 준다.';
    vs.push(q.criteria.map((c,i)=>variant==='empty'||variant==='omission'&&i===0?n:variant==='contrary'?x(entries[i]):m(entries[i])));
  }
  add(`${s.id}-${variant}`,s,variant,answers,vs,'04-inputs.json: 공식 기준서와 수정 criterion 계약에서 사전 작성한 기대');
}
for(const s of bank){
  const answers=Object.fromEntries(s.subquestions.map(q=>[q.id,q.model_answer.join('\n')]));
  add(`${s.id}-bank-model-answer`,s,'bank-model-answer',answers,s.subquestions.map(q=>q.criteria.map(()=>m(answers[q.id]))),'저장 모범답안 전체 인용, 독립 명제는 같은 인용 허용');
}
edge('same-quote-independent','pilot-04-001','sub1','한쪽이 바뀌면 다른 쪽도 변경될 수 있어 서로 밀접하므로 반드시 순차적일 필요는 없다.',Array(2).fill(m('한쪽이 바뀌면 다른 쪽도 변경될 수 있어 서로 밀접하므로 반드시 순차적일 필요는 없다.')),'독립 결론과 이유 각 1점');
edge('names-only','pilot-04-003','sub1','성격, 시기, 범위',[m('성격'),m('시기'),m('범위')],'세 측면의 명칭만으로 3점');
edge('same-fact-repeat','pilot-04-003','sub1','자원의 성격, 자원의 성격, 자원의 성격',[m('자원의 성격'),n,n],'동일 사실은 하나의 criterion만 충족');
for(const s of bank)for(const q of s.subquestions.filter(q=>q.type==='enumeration')){
  const entries=inputs[`${s.id}/${q.id}`].full;
  edge(`${s.id}-${q.id}-reverse-overflow`,s.id,q.id,['감사보수의 입금일을 정한다.',...entries.toReversed()].map((t,i)=>`${i+1}. ${t}`).join('\n'),entries.map(m),'무관한 앞 항목+역순이어도 모든 요구사항 정수 합산');
}
edge('conclusion-only','pilot-04-005','sub1','보존기간 종료 전 삭제는 허용되지 않는다.',[m('보존기간 종료 전 삭제는 허용되지 않는다.'),n],'삭제 금지 결론만 1점');
edge('reason-only','pilot-04-005','sub1','취합 완료 후의 금지 대상은 어떠한 성격의 감사문서도 포함한다.',[n,m('취합 완료 후의 금지 대상은 어떠한 성격의 감사문서도 포함한다.')],'삭제 허용 여부 불명시, 모든 문서라는 범위만 1점');
edge('delete-contradiction','pilot-04-005','sub1','보존기간 전에는 삭제할 수 없다. 그러나 보존기간 전이라도 공간이 부족하면 삭제할 수 있다.',[x('그러나 보존기간 전이라도 공간이 부족하면 삭제할 수 있다.'),n],'정답과 명시적 반대 결론 병기');
edge('number-only','pilot-04-005','sub1','5년, 10년, 60일',[n,n],'요구한 판단과 모든 문서라는 범위가 없는 숫자만으로는 0점');
edge('wrong-start-date','pilot-04-005','sub1','취합 완료 후 모든 성격의 감사문서는 감사종료가 아니라 취합완료일부터 법정 보존기간을 계산해 그 기간 전에는 삭제할 수 없다.',[x('감사종료가 아니라 취합완료일부터 법정 보존기간을 계산해 그 기간 전에는 삭제할 수 없다.'),m('취합 완료 후 모든 성격의 감사문서')],'법정기한의 기산점을 명시적으로 바꾼 금지 결론은 불충족; 대상범위 명제는 유지');
edge('assembly-as-writing','pilot-04-004','sub1','감사문서는 업무 중에 적시에 작성할 필요 없이 감사보고서일 후 60일 안에만 작성하면 된다.',[x('감사문서는 업무 중에 적시에 작성할 필요 없이 감사보고서일 후 60일 안에만 작성하면 된다.')],'적시 작성과 행정적 취합 기한은 구별');
edge('number-only-writing','pilot-04-004','sub1','60일',[n],'숫자만으로 적시 작성 요구 충족 아님');
edge('materiality-names-without-factors','pilot-04-005','sub2','재무제표 전체 중요성, 해당되는 경우 특정 거래유형·계정잔액·공시의 중요성 수준, 수행중요성, 감사 중 이들 금액의 수정내용',[n,n,n,n],'각 결합 criterion은 금액과 결정 시 고려 요소 모두 요구');
const factorAnswer='재무제표 전체 중요성, 해당되는 경우 특정 거래유형·계정잔액·공시의 중요성 수준, 수행중요성, 감사 중 이들 세 금액의 수정내용을 문서화하며, 위의 각 금액을 결정하거나 수정할 때 고려한 요소도 함께 기록한다.';
edge('common-factors-one-sentence','pilot-04-005','sub2',factorAnswer,Array(4).fill(m(factorAnswer)),'공통 고려 요소 서술은 네 독립 금액에 함께 적용');
edge('condition-denied','pilot-04-005','sub2','해당 여부와 무관하게 항상 모든 거래유형·계정잔액·공시에 별도 중요성 수준을 정하고 금액 및 그 결정 요소를 기록해야 한다.',[n,x('해당 여부와 무관하게 항상 모든 거래유형·계정잔액·공시에 별도 중요성 수준을 정하고 금액 및 그 결정 요소를 기록해야 한다.'),n,n],'해당되는 경우 조건을 무조건으로 바꿈');
edge('missing-assertion-level','pilot-04-003','sub2','추가감사절차는 재무제표 전체 수준에 대해서만 계획한다.',[n,x('추가감사절차는 재무제표 전체 수준에 대해서만 계획한다.'),n],'경영진주장 수준을 명시적으로 대체');
edge('change-without-reason','pilot-04-002','sub2','감사 중 전반감사전략과 감사계획의 중요한 변경내용만 기록하고 변경 이유는 기록하지 않는다.',[n,n,x('감사 중 전반감사전략과 감사계획의 중요한 변경내용만 기록하고 변경 이유는 기록하지 않는다.')],'중요한 변경과 이유의 결합 criterion; 전략·계획 자체 기록도 명시하지 않음');
edge('hallucinated-evidence','pilot-04-004','sub1','검토한다.',[m('적시에 작성한다.')],'허위 인용은 코드가 차단',{live:false,expected_score:0,post_override:{crit1:'not_met'}});

const originalFetch=globalThis.fetch,als=new AsyncLocalStorage();let mockCase=null,mockCalls=0;const prompts={};
globalThis.fetch=async(url,init)=>{
  const params=JSON.parse(init.body),ctx=als.getStore();
  if(mockCase){mockCalls++;prompts[mockCase.id]=params;return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(mockCase.expected),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});}
  if(ctx)ctx.requests.push({model:params.model,input:params.input,instructions:params.instructions,text:params.text,max_output_tokens:params.max_output_tokens,prompt_sha256:hash(params.input)});
  const r=await originalFetch(url,init);if(ctx)ctx.responses.push({status:r.status,body:await r.clone().json()});return r;
};
function compare(c,result,raw=false){
  const differences=[];
  for(const q of c.expected.subquestions)for(const v of q.verdicts){
    const aq=result.subquestions.find(x=>x.subquestion_id===q.subquestion_id),actual=(raw?aq?.verdicts:aq?.criteria)?.find(x=>x.criterion_id===v.criterion_id);
    const expected=(!raw&&c.post_override?.[v.criterion_id])||v.verdict;
    if(actual?.verdict!==expected)differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,expected,actual:actual?.verdict});
    if(['met','partial','contradicted'].includes(actual?.verdict)&&(!actual.quote||!norm(c.answers[q.subquestion_id]).includes(norm(actual.quote))))differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,invalid_quote:actual.quote});
  }
  if(!raw&&result.score!==c.expected_score)differences.push({expected_score:c.expected_score,actual_score:result.score});return differences;
}
const offline=[];
for(const c of cases){mockCase=c;mockCalls=0;const result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers,'offline-key');offline.push({id:c.id,model_calls:mockCalls,expected_score:c.expected_score,result,differences:compare(c,result)});}mockCase=null;
const boundaries=[];
for(const s of bank){const good=cases.find(c=>c.id===`${s.id}-full`);for(const q of s.subquestions)for(const c of q.criteria){const j=structuredClone(good.expected);j.subquestions.find(v=>v.subquestion_id===q.id).verdicts.find(v=>v.criterion_id===c.id).verdict='partial';const result=applyQuestionSetJudgment(s,good.answers,j);assert.equal(result.score,good.expected_score-1);boundaries.push({kind:'partial-disallowed',set_id:s.id,subquestion_id:q.id,criterion_id:c.id,passed:true});}}
const s=bank[0],good=cases[0];
for(const flag of ['injection_detected','salad_detected'])for(const scope of ['global','local']){
  const j=structuredClone(good.expected);if(scope==='global')j[flag]=true;else j.subquestions[0][flag]=true;
  const result=applyQuestionSetJudgment(s,good.answers,j),expected_score=flag==='salad_detected'?4:scope==='global'?0:2;
  assert.equal(result.score,expected_score);boundaries.push({kind:flag,scope,expected_score,passed:true,result});
}
const cross=structuredClone(good.expected);cross.subquestions[0].verdicts[0].quote=good.answers.sub2;
const crossResult=applyQuestionSetJudgment(s,good.answers,cross);assert.equal(crossResult.score,3);boundaries.push({kind:'cross-question-quote',passed:true,result:crossResult});
assert.ok(offline.filter(r=>r.id.endsWith('-empty')).every(r=>r.model_calls===0&&r.result.score===0));
const publicBank=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.public.json'));
const hashes=Object.fromEntries([bankFile,'cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json','lib/questionV3Grading.ts','lib/questionV3.ts','lib/ai/openaiStructured.ts',`${dir}/04-inputs.json`,`${dir}/04-run.mjs`].map(p=>[p,hash(fs.readFileSync(p))]));
const deployment={public_matches:bank.every(s=>JSON.stringify(compilePublicQuestionSet(s))===JSON.stringify(publicBank.find(p=>p.id===s.id)))};
try{const dec=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));deployment.encrypted_matches=bank.every(s=>JSON.stringify(s)===JSON.stringify(dec.find(d=>d.id===s.id)));}catch(e){deployment.encrypted_unverified=e.message;}
fs.writeFileSync(`${dir}/04-cases.json`,JSON.stringify(cases,null,2)+'\n');
fs.writeFileSync(`${dir}/04-public.json`,JSON.stringify(bank.map(compilePublicQuestionSet),null,2)+'\n');
fs.writeFileSync(`${dir}/04-offline.json`,JSON.stringify({offline,boundaries,deployment},null,2)+'\n');
const liveCases=cases.filter(c=>c.live!==false&&c.variant!=='empty');
const requestedSets=process.argv.find(a=>a.startsWith('--sets='))?.slice(7).split(',');
const selectedLiveCases=requestedSets?liveCases.filter(c=>requestedSets.includes(c.set_id)):liveCases;
const model=process.env.CPA_GRADING_MODEL||'gpt-5.6-luna';
const fingerprint=hash(JSON.stringify({hashes,model,cases}));
const metadata={at:new Date().toISOString(),fingerprint,hashes,model,base_question_answer_combinations:50,extra_cases:cases.length-25,planned_initial_live_calls:liveCases.length,estimated_input_tokens:Math.ceil(liveCases.reduce((n,c)=>n+(prompts[c.id]?.input.length||0),0)/1.5),max_output_tokens_per_call:8000,estimate_note:'한국어 문자수/1.5의 거친 추정, 불일치/오류는 2회 추가. HTTP 재시도 최대3. 실제 usage 별도.',offline_mismatches:offline.filter(r=>r.differences.length).map(r=>r.id),deployment};
fs.writeFileSync(`${dir}/04-run-metadata.json`,JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata));
metadata.selected_sets=requestedSets||bank.map(s=>s.id);
metadata.planned_initial_live_calls=selectedLiveCases.length;
metadata.expected_prompt_hashes=Object.fromEntries(Object.entries(prompts).map(([id,p])=>[id,hash(p.input)]));
metadata.expected_schema_sha256=hash(JSON.stringify(Object.values(prompts)[0].text));
metadata.expected_api_instructions=Object.values(prompts)[0].instructions;
fs.writeFileSync(`${dir}/04-run-metadata.json`,JSON.stringify(metadata,null,2)+'\n');
if(process.argv.includes('--live')){
  const out=`${dir}/04-live.jsonl`,done=fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  async function run(c,attempt){
    if(done.some(r=>r.id===c.id&&r.attempt===attempt&&r.fingerprint===fingerprint))return;
    const record={id:c.id,attempt,fingerprint,at:new Date().toISOString(),requests:[],responses:[]};
    await als.run(record,async()=>{try{record.result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers);record.differences=compare(c,record.result);const body=record.responses.at(-1)?.body,t=body?.output?.flatMap(o=>o.content||[]).find(o=>o.type==='output_text')?.text;if(t){record.raw_judgment=JSON.parse(t);record.raw_differences=compare(c,record.raw_judgment,true);}}catch(e){record.error={name:e.name,message:e.message,code:e.code,status:e.status};}});
    fs.appendFileSync(out,JSON.stringify(record)+'\n');done.push(record);console.log(c.id,attempt,record.error?'ERROR':`score=${record.result.score} differences=${record.differences.length} raw=${record.raw_differences?.length}`);
  }
  for(let i=0;i<selectedLiveCases.length;i+=2)await Promise.all(selectedLiveCases.slice(i,i+2).map(c=>run(c,1)));
  const repeat=selectedLiveCases.filter(c=>['pilot-04-003-full','wrong-start-date','change-without-reason'].includes(c.id)||done.some(r=>r.id===c.id&&r.attempt===1&&r.fingerprint===fingerprint&&(r.differences?.length||r.raw_differences?.length||r.error)));
  for(let i=0;i<repeat.length;i+=2)await Promise.all(repeat.slice(i,i+2).map(async c=>{for(const a of [2,3])await run(c,a);}));
}
globalThis.fetch=originalFetch;
