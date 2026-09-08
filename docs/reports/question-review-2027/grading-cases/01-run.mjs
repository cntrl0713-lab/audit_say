import fs from 'node:fs';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { gradeQuestionSetV3, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';

const dir = 'docs/reports/question-review-2027/grading-cases';
const bankFile = 'cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank = JSON.parse(fs.readFileSync(bankFile)).filter(s => s.classification.topic_id === '01');
const inputs = JSON.parse(fs.readFileSync(`${dir}/01-inputs.json`));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const clauses = (q, values) => q.criteria.map((c,i) => values[q.criteria.length === 6 ? [0,1,2,2,2,3][i] : i]);
function verdicts(q, values, variant) {
  return q.criteria.map((c,i) => {
    const verdict = variant === 'empty' || (variant === 'omission' && i === 0) ? 'not_met' : variant === 'contrary' ? 'contradicted' : 'met';
    let quote = clauses(q, values)[i];
    if (q.criteria.length === 6 && variant !== 'contrary' && [2,3,4].includes(i)) {
      quote = i === 2 ? (quote.includes('성격·') ? '성격' : '자문의 성격') : i === 3 ? '범위' : (quote.includes('결론에') ? '결론에 대한 의견이 같은지 확인한다.' : '그 결론이 자문제공자의 의견과 일치하는지 확인한다.');
    }
    return { criterion_id:c.id, verdict, ...(verdict === 'not_met' ? {} : {quote}), reason:'기준서와 명제에 따라 실행 전에 작성한 기대판정' };
  });
}
const cases=[];
for (const s of bank) for (const variant of ['full','paraphrase','omission','contrary','empty']) {
  const answers={}, expected=[];
  for(const q of s.subquestions) {
    const spec=inputs[`${s.id}/${q.id}`]; const values=spec[variant]||spec.full;
    const answerValues=variant==='empty'?[]:variant==='omission'?values.slice(1):values;
    answers[q.id]=answerValues.length?answerValues.map((x,i)=>q.type==='enumeration'?`${i+1}. ${x}`:x).join('\n'):variant==='empty'?'':'이 사항은 감사업무의 품질과 관련된다.';
    expected.push({subquestion_id:q.id,verdicts:verdicts(q,values,variant)});
  }
  cases.push({id:`${s.id}-${variant}`,set_id:s.id,variant,answers,expected:{subquestions:expected},basis:'2026 시행 KGA220; 003/sub1은 4개 항목 안에 6개 독립 명제',expected_score:expected.flatMap(q=>q.verdicts).filter(v=>v.verdict==='met').length});
}
function edge(id,setid,qid,answer,vs,score,notes,live=true) {
  const s=bank.find(s=>s.id===setid);
  cases.push({id,set_id:setid,variant:'edge',answers:Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qid?answer:''])),expected:{subquestions:s.subquestions.map(q=>({subquestion_id:q.id,verdicts:q.criteria.map((c,i)=>q.id===qid?{criterion_id:c.id,...vs[i]}:{criterion_id:c.id,verdict:'not_met'})}))},expected_score:score,basis:notes,live});
}
const m=quote=>({verdict:'met',quote}), n={verdict:'not_met'};
const combined='업무팀의 유의적 판단과 결론을 감사보고서일 또는 그 전에 객관적으로 평가하도록 설계된 절차이다.';
edge('same-quote-independent','pilot-01-001','sub1',combined,[m(combined),m(combined),n,n],2,'같은 문장 안의 평가 행위와 시점은 독립 명제. 모의 인용 중복 차단 재현');
const enumQ=inputs['pilot-01-003/sub1'].full;
const fifth=['이 사항은 품질과 관련된다.',...enumQ].map((x,i)=>`${i+1}. ${x}`).join('\n');
edge('fifth-entry-overflow','pilot-01-003','sub1',fifth,[m(enumQ[0]),m(enumQ[1]),m('자문의 성격'),m('범위'),m('그 결론이 자문제공자의 의견과 일치하는지 확인한다.'),n],5,'ignore_after_limit=4: 5번째 항목의 실행 여부는 득점 대상에서 제외');
edge('same-fact-repeated','pilot-01-001','sub1','상장기업 재무제표감사가 대상이다.\n상장기업 재무제표감사가 대상이다.',[n,n,m('상장기업 재무제표감사가 대상이다.'),n],1,'반복한 동일 사실은 다른 명제의 근거가 되지 않음');
edge('conclusion-only','pilot-01-004','sub1','적절하지 않다.',[n,n],0,'현행 crit1은 결론과 회계법인 커뮤니케이션을 함께 요구. 계약 분리 개선 제안과 현행 기대값 구별');
edge('purpose-without-urgency','pilot-01-004','sub1','자체 판단으로만 처리하는 것은 부적절하며 회계법인에 알린다. 회계법인과 업무수행이사가 필요한 조치를 취할 수 있도록 한다.',[m('자체 판단으로만 처리하는 것은 부적절하며 회계법인에 알린다.'),n],1,'crit2는 목적과 신속성을 모두 요구, partial 없음');
edge('reverse-order','pilot-01-004','sub2',[...inputs['pilot-01-004/sub2'].full].reverse().join('\n'),[m(inputs['pilot-01-004/sub2'].full[0]),m(inputs['pilot-01-004/sub2'].full[1])],2,'기준서와 발문에 순서 요구 없음. ordered=true 데이터가 잘못되었으며 내용 기준 기대는2');
edge('shared-facts-only','pilot-01-001','sub1',bank[0].shared_context.facts[0].text,[n,n,n,n],0,'적용할 수 있다는 일반 사실은 회계법인이 필요하다고 결정한 대상의 명시와 다름');
edge('hallucinated-evidence','pilot-01-001','sub1','관련이 있다.',[m('상장기업 재무제표감사가 대상이다.'),n,n,n],0,'존재하지 않는 인용은 코드에서 0점',false);
const bankQuotes={
 'pilot-01-001':[['업무팀이 내린 유의적 판단 및 그 도달한 결론','감사보고서일 또는 그 전에','상장기업의 재무제표감사','해당 회계법인이 품질관리검토가 필요하다고 결정한 감사업무'],['업무수행이사의 책임은 경감되지 아니한다.']],
 'pilot-01-002':[['감사업무 전 과정에 걸쳐 관찰과 질문으로 업무팀원의 윤리적 요구사항 위반 증거에 주의를 유지한다.','회계법인 내부의 다른 사람에게 자문을 받아','적합한 조치를 결정한다.'],['회계법인과 해당되는 경우 네트워크 회계법인에서 관련 정보를 입수하여 독립성 위협을 일으키는 상황과 관계를 식별·평가한다.','독립성 정책과 절차의 위반정보를 평가하여 감사업무의 독립성에 위협이 발생하는지 결정한다.','안전장치를 적용하여 위협을 제거하거나 수용가능한 수준으로 낮추고','적합하며 법규상 가능하면 감사업무 해지 조치를 취한다.','적합한 조치로 해결할 수 없으면 회계법인에 신속히 보고한다.']],
 'pilot-01-003':[['업무팀이 어렵거나 논쟁의 여지가 있는 사항에 관하여 적합한 자문을 실시하도록 한다.','업무팀원이 업무팀 내부 및 회계법인 내·외부의 적합한 위치의 사람들과 적합한 자문을 실시하였는지 확인한다.','자문의 성격','범위','그 결론에 관하여 자문제공자와 의견이 일치하는지 확인한다.','자문의 결론이 실행되었는지 결정한다.'],['의견의 차이를 처리하고 해결하기 위한 회계법인의 정책과 절차를 따라야 한다.']],
 'pilot-01-004':[['적절하지 않다. 업무수행이사는 회계법인과 업무수행이사가 필요한 조치를 취할 수 있도록 해당 정보를 회계법인에 신속히 커뮤니케이션해야 한다.','회계법인과 업무수행이사가 필요한 조치를 취할 수 있도록 해당 정보를 회계법인에 신속히 커뮤니케이션해야 한다.'],['전문직 기준과 해당 법규의 요구사항에 따라 감사업무를 수행하는 데 적격성과 역량이 있는지','해당 상황에 적합한 감사보고서를 발행할 수 있는지']]
};
for(const s of bank)cases.push({id:`${s.id}-bank-model-answer`,set_id:s.id,variant:'bank-model-answer',answers:Object.fromEntries(s.subquestions.map(q=>[q.id,q.model_answer.join('\n')])),expected:{subquestions:s.subquestions.map((q,qi)=>({subquestion_id:q.id,verdicts:q.criteria.map((c,ci)=>({criterion_id:c.id,...m(bankQuotes[s.id][qi][ci])}))}))},expected_score:s.subquestions.reduce((n,q)=>n+q.criteria.length,0),basis:'저장된 모범답안 원문 그대로 전송; 표현 문제는 별도 내용 검토'});
const implicitConclusion=cases.find(c=>c.id==='pilot-01-004-omission');
implicitConclusion.expected.subquestions[0].verdicts[0]={criterion_id:'crit1',...m(implicitConclusion.answers.sub1)};
implicitConclusion.expected.subquestions[0].verdicts[1]={criterion_id:'crit2',...m('필요한 조치를 취할 수 있도록 신속히 커뮤니케이션해야 한다.')};
implicitConclusion.expected_score=3;
implicitConclusion.basis='2026-09-08 사용자 확정: 요구 조치에서 결론이 분명하면 인정. 명시적 결론 문장이 없더라도 커뮤니케이션 필요가 명확하므로 crit1 met.';
fs.writeFileSync(`${dir}/01-cases.json`,JSON.stringify(cases,null,2)+'\n');
fs.writeFileSync(`${dir}/01-public.json`,JSON.stringify(bank.map(compilePublicQuestionSet),null,2)+'\n');
const originalFetch=globalThis.fetch, als=new AsyncLocalStorage();
let mockCase=null, mockCalls=0; const prompts={};
globalThis.fetch=async (url,init)=>{
  const context=als.getStore(); const params=JSON.parse(init.body);
  if(mockCase){
    mockCalls++;prompts[mockCase.id]=params;
    return new Response(JSON.stringify({id:'resp_offline',object:'response',status:'completed',output:[{type:'message',id:'msg_offline',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(mockCase.expected),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(context) context.requests.push({model:params.model,input:params.input,max_output_tokens:params.max_output_tokens});
  const response=await originalFetch(url,init);
  if(context) context.responses.push({status:response.status,body:await response.clone().json()});
  return response;
};
function compare(c,result){
  const differences=[];
  for(const q of c.expected.subquestions)for(const v of q.verdicts){
    const actual=result.subquestions.find(x=>x.subquestion_id===q.subquestion_id)?.criteria.find(x=>x.criterion_id===v.criterion_id);
    // Hallucinated quote is intentionally rejected by the evidence verifier.
    const expected=c.id==='hallucinated-evidence'?'not_met':v.verdict;
    if(actual?.verdict!==expected)differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,expected,actual:actual?.verdict});
  }
  if(result.score!==c.expected_score)differences.push({expected_score:c.expected_score,actual_score:result.score});
  return differences;
}
const offline=[];
for(const c of cases){
  mockCase=c;mockCalls=0;
  const result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers,'offline-key');
  offline.push({id:c.id,model_calls:mockCalls,expected_score:c.expected_score,result,differences:compare(c,result)});
}
mockCase=null;
const s=bank[0], good=cases[0];
const security=[];
for(const flag of ['injection_detected','salad_detected'])for(const scope of ['global','local']){
  const j=structuredClone(good.expected); if(scope==='global')j[flag]=true;else j.subquestions[0][flag]=true;
  const result=applyQuestionSetJudgment(s,good.answers,j);security.push({flag,scope,result,expected_score:scope==='global'?0:1});
}
for(const partial of [false,true]){
  const j=structuredClone(good.expected);j.subquestions[0].verdicts[0]=partial?{criterion_id:'crit1',verdict:'partial',quote:inputs['pilot-01-001/sub1'].full[0]}:{criterion_id:'crit1',verdict:'met',quote:good.answers.sub2};
  security.push({kind:partial?'partial-disallowed':'cross-question-quote',result:applyQuestionSetJudgment(s,good.answers,j),expected_score:4});
}
fs.writeFileSync(`${dir}/01-offline.json`,JSON.stringify({offline,security,prompt_contract:{constraints_transmitted:Object.values(prompts).some(p=>p.input.includes('overflow_policy')),all_blank_calls:offline.filter(x=>x.id.endsWith('-empty')).map(x=>x.model_calls)}},null,2)+'\n');
const liveCases=cases.filter(c=>c.live!==false&&c.variant!=='empty');
const metadata={at:new Date().toISOString(),bank_sha256:sha(bankFile),grading_sha256:sha('lib/questionV3Grading.ts'),scoring_sha256:sha('lib/questionV3.ts'),input_sha256:sha(`${dir}/01-inputs.json`),base_question_answer_combinations:40,extra_cases:12,planned_initial_live_calls:liveCases.length,estimated_input_tokens:Math.ceil(liveCases.reduce((n,c)=>n+(prompts[c.id]?.input.length||0),0)/1.5),estimate_note:'한국어 포함 문자수/1.5의 거친 예산 추정, 실제 usage 별도 저장. 최대 출력8000/호출, 불일치2회 추가, 전송 재시도최대3.',offline_mismatches:offline.filter(r=>r.differences.length).map(r=>r.id)};
fs.writeFileSync(`${dir}/01-run-metadata.json`,JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata));
if(process.argv.includes('--live')){
  const out=`${dir}/01-live.jsonl`; const done=fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  async function run(c,attempt){
    if(done.some(x=>x.id===c.id&&x.attempt===attempt))return;
    const record={id:c.id,attempt,at:new Date().toISOString(),requests:[],responses:[]};
    await als.run(record,async()=>{try{record.result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers);record.differences=compare(c,record.result);}catch(e){record.error={name:e.name,message:e.message,code:e.code,status:e.status};}});
    fs.appendFileSync(out,JSON.stringify(record)+'\n');done.push(record);console.log(c.id,attempt,record.error?'ERROR':`score=${record.result.score} differences=${record.differences.length}`);
  }
  for(let i=0;i<liveCases.length;i+=2)await Promise.all(liveCases.slice(i,i+2).map(c=>run(c,1)));
  const repeat=liveCases.filter(c=>done.some(r=>r.id===c.id&&r.attempt===1&&(r.differences?.length||r.error)));
  for(const c of repeat)for(const attempt of [2,3])await run(c,attempt);
}
globalThis.fetch=originalFetch;
