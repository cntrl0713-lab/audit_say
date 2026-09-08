// Internal review only. Run from repository root with node --env-file=.env.local.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { gradeQuestionSetV3, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../../../../lib/questionV3Encryption.ts';

const dir='docs/reports/question-review-2027/grading-cases';
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const all=JSON.parse(fs.readFileSync(bankFile));
const bank=all.filter(s=>s.classification.topic_id==='03');
const inputs=JSON.parse(fs.readFileSync(`${dir}/03-inputs.json`));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashText=t=>crypto.createHash('sha256').update(t).digest('hex');
const normalizeSourceText=t=>t.replace(/\s+/g,' ').trim();
const m=quote=>({verdict:'met',quote});
const n={verdict:'not_met'};
const x=quote=>({verdict:'contradicted',quote});
const cases=[];
function add(id,s,variant,answers,judgments,basis,options={}) {
  const expected={subquestions:s.subquestions.map((q,i)=>({subquestion_id:q.id,verdicts:q.criteria.map((c,j)=>({criterion_id:c.id,...judgments[i][j]}))}))};
  const expected_score=expected.subquestions.flatMap(q=>q.verdicts).filter(v=>v.verdict==='met').length;
  cases.push({id,set_id:s.id,variant,answers,expected,expected_score,basis,...options});
}
for(const s of bank)for(const variant of ['full','paraphrase','omission','contrary','empty']) {
  const answers={},judgments=[];
  for(const q of s.subquestions) {
    const spec=inputs[`${s.id}/${q.id}`], v=spec[variant]||spec.full;
    let entries=variant==='empty'?[]:variant==='omission'?v.slice(1):[...v];
    if(s.id==='pilot-03-003'&&q.id==='sub1'&&entries.length) entries=variant==='omission'?[entries.join(' ')]:[entries[0],entries.slice(1).join(' ')];
    answers[q.id]=entries.map((t,i)=>q.type==='enumeration'?`${i+1}. ${t}`:t).join('\n');
    judgments.push(q.criteria.map((c,i)=>variant==='empty'||(variant==='omission'&&i===0)?n:variant==='contrary'?x(s.id==='pilot-03-003'&&q.id==='sub1'&&i>0?v.slice(1).join(' '):v[i]):m(v[i])));
  }
  add(`${s.id}-${variant}`,s,variant,answers,judgments,'사전 작성한 03-inputs.json의 기준서·현행 criterion 계약');
}
function edge(id,setid,qid,answer,vs,basis,options={}) {
  const s=bank.find(s=>s.id===setid);
  add(id,s,'edge',Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qid?answer:''])),s.subquestions.map(q=>q.id===qid?vs:q.criteria.map(()=>n)),basis,options);
}
const same='경영진이 문단 6(b)의 책임을 인정하고 이해한다는 사실을 기록한다.';
edge('same-quote-independent','pilot-03-003','sub1',same,[n,m(same),m(same)],'한 문장의 인정과 이해는 각각 독립 명제. 동일 인용이어도 기대 2점.');
edge('same-fact-repeated','pilot-03-003','sub1','경영진이 책임을 인정한다는 사실을 기록한다.\n경영진이 책임을 인정한다는 사실을 기록한다.',[n,m('경영진이 책임을 인정한다는 사실을 기록한다.'),n],'인정 반복은 이해를 대체하지 않음.');
const third=['감사보수 지급일을 정한다.',...inputs['pilot-03-003/sub2'].full];
edge('third-entry-overflow','pilot-03-003','sub2',third.map((v,i)=>`${i+1}. ${v}`).join('\n'),[m(third[1]),n],'max_entries=2, ignore_after_limit: 3번째 문서화는 득점 제외.');
edge('reverse-two-entries','pilot-03-003','sub2',[...inputs['pilot-03-003/sub2'].full].reverse().join('\n'),inputs['pilot-03-003/sub2'].full.map(m),'ordered=false: 순서가 바뀌어도 두 조치 득점.');
edge('combined-two-actions','pilot-03-003','sub2','감사인과 경영진은 새 업무조건에 합의하고 그 조건을 계약서에 기록한다.',[m('새 업무조건에 합의하고'),m('그 조건을 계약서에 기록한다.')],'두 조치를 한 문장에 적어도 의미가 모두 있으면 2점.');
edge('conclusion-only','pilot-03-002','sub1','법규에 의해 수임이 요구되지 않으면 수임해서는 안 된다.',[n,m('법규에 의해 수임이 요구되지 않으면 수임해서는 안 된다.')],'현행 계약: 근거 누락 0, 결론+법규 예외 1.');
edge('reason-only','pilot-03-002','sub1','그 범위제한 때문에 재무제표에 대한 의견거절이 예상된다.',[m('그 범위제한 때문에 재무제표에 대한 의견거절이 예상된다.'),n],'근거만 맞으면 crit1만 득점.');
edge('correct-conclusion-wrong-reason','pilot-03-002','sub1','범위제한은 의견거절과 관계가 없다. 법규에 의해 수임이 요구되지 않으면 수임해서는 안 된다.',[x('범위제한은 의견거절과 관계가 없다.'),m('법규에 의해 수임이 요구되지 않으면 수임해서는 안 된다.')],'틀린 근거와 맞는 결론 분리.');
edge('change-conclusion-without-reason','pilot-03-001','sub2','감사업무 조건 변경에는 동의하지 않는다.',[n,n],'변경 거절 결론만으로 요청 정당성·범위제한 고려에 득점하지 않음.');
edge('initial-recurring-swapped','pilot-03-002','sub2','최초감사에서만 상황 변화에 따른 조건 수정 필요성을 평가하고 계속감사에서는 하지 않는다. 최초감사에서만 기존 조건의 재고지 필요성을 평가하고 계속감사에서는 하지 않는다.',[x('최초감사에서만 상황 변화에 따른 조건 수정 필요성을 평가하고 계속감사에서는 하지 않는다.'),x('최초감사에서만 기존 조건의 재고지 필요성을 평가하고 계속감사에서는 하지 않는다.')],'문단13 계속감사 조건을 최초감사에만 해당한다고 바꿈.');
edge('responsibility-ack-only','pilot-03-004','sub1','경영진이 책임을 인정한다는 동의를 받는다.',[n,n],'crit2는 인정과 이해 모두 요구, partial 없음.');
edge('exception19-denied','pilot-03-004','sub2','법규상 강제수임이 없는 경우라도 문단 19의 예외는 없으며 수용불가능한 체계는 전부 수임 금지이다.',[x('문단 19의 예외는 없으며 수용불가능한 체계는 전부 수임 금지이다.'),n,n],'명시적으로 문단19 예외를 부정하면 crit3 contradicted.');
edge('no-overflow-policy-added','pilot-03-004','sub1',['감사보수 지급일을 정한다.',...inputs['pilot-03-004/sub1'].full].map((t,i)=>`${i+1}. ${t}`).join('\n'),inputs['pilot-03-004/sub1'].full.map(m),'max_entries=2이나 overflow_policy=none. 자동 초과 감점 규칙을 새로 만들지 않음.');
edge('full-then-contradiction','pilot-03-003','sub2','새 업무조건에 합의한다. 그러나 실제로는 새 업무조건에 합의할 필요가 없다.',[x('그러나 실제로는 새 업무조건에 합의할 필요가 없다.'),n],'정답 뒤 명시적 반대는 해당 criterion contradicted.');
edge('hallucinated-evidence','pilot-03-002','sub1','검토한다.',[m('범위제한으로 의견거절이 예상된다.'),n],'없는 인용은 code not_met.',{live:false,expected_score:0,post_override:{crit1:'not_met'}});
for(const s of bank) {
  const judgments=s.subquestions.map(q=>q.criteria.map(()=>m('')));
  // Evidence is independently chosen from the stored answer, including shared sentence fragments.
  const quotes={
    'pilot-03-001':[['경영진이 재무제표 작성','관련 내부통제','감사에 필요한 정보의 제공 또는 확보에 대한 책임을 인정하고 이해함을 확인해야 한다.','법규상 강제 수임이 아닌 한 해당 업무를 수임하는 것은 적합하지 않다.'],['요청의 정당성을 고려해야 하며','감사업무 범위제한이 발생하는 경우 그 시사점을 평가해야 한다.']],
    'pilot-03-002':[['그 범위제한으로 의견거절이 예상되면','해당 업무를 감사업무로 수임해서는 안 된다. 다만 법규에 의해 수임이 요구되는 경우는 예외이다.'],inputs['pilot-03-002/sub2'].full.map((_,i)=>s.subquestions[1].model_answer[i])],
    'pilot-03-003':[['그 법규가 적용된다는 사실을 기록한다.','경영진이 문단 6(b)의 책임을 인정하고','이해한다는 사실을 기록한다.'],s.subquestions[1].model_answer],
    'pilot-03-004':[s.subquestions[0].model_answer,s.subquestions[1].model_answer]
  }[s.id];
  s.subquestions.forEach((q,i)=>q.criteria.forEach((c,j)=>judgments[i][j]=m(quotes[i][j])));
  add(`${s.id}-bank-model-answer`,s,'bank-model-answer',Object.fromEntries(s.subquestions.map(q=>[q.id,q.model_answer.join('\n')])),judgments,'현재 저장 모범답안 그대로. 004/sub2 법규 예외 문구는 모호하여 기대3과 실제를 비교하되 정답 적합성 승인과 구별.');
}
const originalFetch=globalThis.fetch,als=new AsyncLocalStorage();
let mockCase=null,mockCalls=0; const prompts={};
globalThis.fetch=async(url,init)=>{
  const context=als.getStore(),params=JSON.parse(init.body);
  if(mockCase){mockCalls++;prompts[mockCase.id]=params;return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(mockCase.expected),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});}
  if(context)context.requests.push({model:params.model,input:params.input,instructions:params.instructions,text:params.text,max_output_tokens:params.max_output_tokens,prompt_sha256:hashText(params.input)});
  const response=await originalFetch(url,init);
  if(context){const body=await response.clone().text();context.responses.push({status:response.status,body:JSON.parse(body)});}
  return response;
};
function compare(c,result,raw=false){
  const differences=[];
  for(const q of c.expected.subquestions)for(const v of q.verdicts){
    const aq=result.subquestions.find(x=>x.subquestion_id===q.subquestion_id);
    const actual=(raw?aq?.verdicts:aq?.criteria)?.find(x=>x.criterion_id===v.criterion_id);
    const expected=(!raw&&c.post_override?.[v.criterion_id])||v.verdict;
    if(actual?.verdict!==expected)differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,expected,actual:actual?.verdict});
    if(['met','partial','contradicted'].includes(actual?.verdict)&&(!actual.quote||!normalizeSourceText(c.answers[q.subquestion_id]).includes(normalizeSourceText(actual.quote))))differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,invalid_quote:actual.quote});
  }
  if(!raw&&result.score!==c.expected_score)differences.push({expected_score:c.expected_score,actual_score:result.score});
  return differences;
}
const offline=[];
for(const c of cases){mockCase=c;mockCalls=0;const result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers,'offline-key');offline.push({id:c.id,model_calls:mockCalls,expected_score:c.expected_score,result,differences:compare(c,result)});}
mockCase=null;
const boundaries=[];
for(const s of bank){
  const good=cases.find(c=>c.id===`${s.id}-full`);
  for(const q of s.subquestions)for(const c of q.criteria){
    const j=structuredClone(good.expected);j.subquestions.find(v=>v.subquestion_id===q.id).verdicts.find(v=>v.criterion_id===c.id).verdict='partial';
    const result=applyQuestionSetJudgment(s,good.answers,j);assert.equal(result.score,good.expected_score-1);boundaries.push({kind:'partial-disallowed',set_id:s.id,subquestion_id:q.id,criterion_id:c.id,passed:true,result});
  }
}
const s=bank[0],good=cases[0];
for(const flag of ['injection_detected','salad_detected'])for(const scope of ['global','local']){
  const j=structuredClone(good.expected);if(scope==='global')j[flag]=true;else j.subquestions[0][flag]=true;
  const result=applyQuestionSetJudgment(s,good.answers,j),expected_score=scope==='global'?0:2;
  assert.equal(result.score,expected_score);boundaries.push({kind:flag,scope,expected_score,passed:true,result});
}
const cross=structuredClone(good.expected);cross.subquestions[0].verdicts[0].quote=good.answers.sub2;
const crossResult=applyQuestionSetJudgment(s,good.answers,cross);assert.equal(crossResult.score,5);boundaries.push({kind:'cross-question-quote',passed:true,result:crossResult});
assert.equal(offline.filter(r=>r.id.endsWith('-empty')).every(r=>r.model_calls===0&&r.result.score===0),true);
const publicBank=JSON.parse(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.public.json'));
const hashes=Object.fromEntries([bankFile,'cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json','lib/questionV3Grading.ts','lib/questionV3.ts','lib/ai/openaiStructured.ts','app/actions.ts','app/quiz/QuizClient.tsx',`${dir}/03-inputs.json`].map(p=>[p,sha(p)]));
const deployment={public_matches:bank.every(s=>JSON.stringify(compilePublicQuestionSet(s))===JSON.stringify(publicBank.find(p=>p.id===s.id)))};
try{const dec=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));deployment.encrypted_matches=bank.every(s=>JSON.stringify(s)===JSON.stringify(dec.find(d=>d.id===s.id)));}catch(e){deployment.encrypted_unverified=e.message;}
fs.writeFileSync(`${dir}/03-cases.json`,JSON.stringify(cases,null,2)+'\n');
fs.writeFileSync(`${dir}/03-public.json`,JSON.stringify(bank.map(compilePublicQuestionSet),null,2)+'\n');
fs.writeFileSync(`${dir}/03-offline.json`,JSON.stringify({offline,boundaries,deployment,prompt_contract:{constraints_transmitted:Object.values(prompts).some(p=>p.input.includes('overflow_policy')),all_blank_calls:offline.filter(r=>r.id.endsWith('-empty')).map(r=>r.model_calls)}},null,2)+'\n');
const liveCases=cases.filter(c=>c.live!==false&&c.variant!=='empty');
const fingerprint=hashText(JSON.stringify({hashes,model:process.env.CPA_GRADING_MODEL||'gpt-5.6-luna',cases}));
const metadata={at:new Date().toISOString(),fingerprint,hashes,model:process.env.CPA_GRADING_MODEL||'gpt-5.6-luna',base_question_answer_combinations:40,extra_target_answers:cases.filter(c=>c.variant==='edge').length+8,planned_initial_live_calls:liveCases.length,estimated_input_tokens:Math.ceil(liveCases.reduce((n,c)=>n+(prompts[c.id]?.input.length||0),0)/1.5),max_output_tokens_per_call:8000,estimate_note:'한국어 포함 문자수/1.5의 거친 추정; 초기 불일치/오류는 2회 추가. HTTP 전송 시도 최대3. 실제 usage 별도.',offline_mismatches:offline.filter(r=>r.differences.length).map(r=>r.id),deployment};
fs.writeFileSync(`${dir}/03-run-metadata.json`,JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata));
if(process.argv.includes('--live')){
  const out=`${dir}/03-live.jsonl`,done=fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  async function run(c,attempt){
    if(done.some(r=>r.id===c.id&&r.attempt===attempt&&r.fingerprint===fingerprint))return;
    const record={id:c.id,attempt,fingerprint,at:new Date().toISOString(),requests:[],responses:[]};
    await als.run(record,async()=>{try{
      record.result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers);record.differences=compare(c,record.result);
      const body=record.responses.at(-1)?.body;const t=body?.output?.flatMap(o=>o.content||[]).find(o=>o.type==='output_text')?.text;
      if(t){record.raw_judgment=JSON.parse(t);record.raw_differences=compare(c,record.raw_judgment,true);}
    }catch(e){record.error={name:e.name,message:e.message,code:e.code,status:e.status};}});
    fs.appendFileSync(out,JSON.stringify(record)+'\n');done.push(record);console.log(c.id,attempt,record.error?'ERROR':`score=${record.result.score} differences=${record.differences.length} raw=${record.raw_differences?.length}`);
  }
  for(let i=0;i<liveCases.length;i+=2)await Promise.all(liveCases.slice(i,i+2).map(c=>run(c,1)));
  const repeat=liveCases.filter(c=>done.some(r=>r.id===c.id&&r.attempt===1&&r.fingerprint===fingerprint&&(r.differences?.length||r.raw_differences?.length||r.error)));
  for(let i=0;i<repeat.length;i+=2)await Promise.all(repeat.slice(i,i+2).map(async c=>{for(const a of [2,3])await run(c,a);}));
}
globalThis.fetch=originalFetch;
