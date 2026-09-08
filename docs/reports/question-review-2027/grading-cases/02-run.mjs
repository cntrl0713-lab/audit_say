// Internal review harness. Calls the production grader; never updates user progress.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { gradeQuestionSetV3, applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
import { compilePublicQuestionSet } from '../../../../lib/questionV3.ts';
const dir='docs/reports/question-review-2027/grading-cases';
const bankFile='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(bankFile)).filter(s=>s.classification.topic_id==='02');
const inputs=JSON.parse(fs.readFileSync(`${dir}/02-inputs.json`));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const m=quote=>({verdict:'met',quote}), n={verdict:'not_met'}, x=quote=>({verdict:'contradicted',quote});
const cases=[];
for(const s of bank)for(const variant of ['full','paraphrase','omission','contrary','empty']){
  const answers={},expected={subquestions:[]};
  for(const q of s.subquestions){
    const spec=inputs[`${s.id}/${q.id}`], values=spec[variant]||spec.full;
    const parts=variant==='empty'?[]:variant==='omission'?values.slice(1):values;
    answers[q.id]=parts.length?parts.map((p,i)=>q.type==='enumeration'?`${i+1}. ${p}`:p).join('\n'):variant==='empty'?'':'이 문제는 감사와 관련된다.';
    expected.subquestions.push({subquestion_id:q.id,verdicts:q.criteria.map((c,i)=>({criterion_id:c.id,...(variant==='empty'||variant==='omission'&&i===0?n:variant==='contrary'?x(values[i]):m(values[i]))}))});
  }
  cases.push({id:`${s.id}-${variant}`,set_id:s.id,variant,answers,expected,expected_score:expected.subquestions.flatMap(q=>q.verdicts).filter(v=>v.verdict==='met').length,basis:'실행 전 KGA200 원출처와 현행 criterion 계약으로 기대판정 작성. 005/sub2의 누락된 판단은 현행 점수에 추가하지 않음.'});
}
function edge(id,setId,qId,answer,vs,basis,options={}){
  const s=bank.find(s=>s.id===setId);
  cases.push({id,set_id:setId,variant:'edge',answers:Object.fromEntries(s.subquestions.map(q=>[q.id,q.id===qId?answer:''])),expected:{subquestions:s.subquestions.map(q=>({subquestion_id:q.id,verdicts:q.criteria.map((c,i)=>({criterion_id:c.id,...(q.id===qId?vs[i]:n)}))}))},expected_score:vs.filter(v=>v.verdict==='met').length,basis,...options});
}
const combined='충분성은 양적 척도이며 적합성은 질적 척도이다.';
edge('same-quote-independent','pilot-02-004','sub1',combined,[m(combined),m(combined)],'한 문장 안의 독립된 두 명제 모두 충족. 동일 인용 차단으로 1점이 되는지 확인.');
edge('third-entry-overflow','pilot-02-004','sub1','1. 감사증거는 필요하다.\n2. 충분성은 양적 척도이다.\n3. 적합성은 질적 척도이다.',[m('충분성은 양적 척도이다.'),n],'max_entries=2, ignore_after_limit 계약상 세 번째 항목은 제외');
edge('repeated-fact','pilot-02-004','sub1','1. 충분성은 양적 척도이다.\n2. 충분성은 양적 척도이다.',[m('충분성은 양적 척도이다.'),n],'같은 사실 반복은 질적 척도의 증거가 아님');
edge('reverse-order','pilot-02-004','sub1','1. 적합성은 질적 척도이다.\n2. 충분성은 양적 척도이다.',[m('충분성은 양적 척도이다.'),m('적합성은 질적 척도이다.')],'ordered=false, 순서 변경 허용');
edge('spacing-only','pilot-02-001','sub1','경영진을신뢰해도전문가적의구심유지필요성은경감되지않는다. 설득력이낮은감사증거에만족할수없다.',[m('경영진을신뢰해도전문가적의구심유지필요성은경감되지않는다.'),m('설득력이낮은감사증거에만족할수없다.')],'띄어쓰기 변화는 부정어 제거와 다름');
edge('one-character-negation','pilot-02-001','sub1','경영진을 신뢰해도 전문가적 의구심 유지 필요성은 경감되지 않는다. 설득력이 낮은 감사증거에 만족할 수 있다.',[m('경영진을 신뢰해도 전문가적 의구심 유지 필요성은 경감되지 않는다.'),x('설득력이 낮은 감사증거에 만족할 수 있다.')],'없다→있다 한 글자 변경, 결론과 근거를 독립 판정');
edge('judgment-only','pilot-02-005','sub2','적발위험은 완전히 제거할 수 없다.',[n],'판단은 맞지만 현행 criterion은 정의만 채점. 요구와 배점의 누락 재현');
const def='적발위험은 감사절차가 중요한 왜곡표시를 발견하지 못할 위험이다.';
edge('definition-with-wrong-judgment','pilot-02-005','sub2',`${def} 적발위험은 완전히 제거할 수 있다.`,[m(def)],'현행 criterion상 정의는 충족하여 1점. 발문 전체로는 오답인 제거 가능 판단이 채점되지 않음');
edge('definition-incomplete','pilot-02-005','sub2','적발위험은 감사위험을 낮추기 위한 감사절차와 관련된 위험이다.',[n],'미발견이라는 핵심 행위 없음, partial 미허용');
edge('audit-risk-incomplete','pilot-02-005','sub1','감사위험은 감사인이 부적합한 의견을 표명할 위험이다.',[n,n],'중요하게 왜곡표시된 재무제표라는 조건 누락, partial 미허용');
edge('risk-components-swapped','pilot-02-005','sub1','감사위험은 고유위험과 통제위험의 함수이다.',[n,x('감사위험은 고유위험과 통제위험의 함수이다.')],'중요왜곡표시위험 구성요소를 감사위험의 두 구성요소로 교체');
edge('withdrawal-without-legal-condition','pilot-02-002','sub2','감사업무의 해지가 필요한지를 평가한다.',[n,n,n],'법규상 가능한 경우라는 필수 조건 없음');
edge('expensive-procedure','pilot-02-002','sub1','요구된 절차는 효과적이지만 비용이 많이 들기 때문에 이탈할 수 있다. 요구사항의 목적을 달성할 대체적 감사절차를 수행한다.',[x('요구된 절차는 효과적이지만 비용이 많이 들기 때문에 이탈할 수 있다.'),m('요구사항의 목적을 달성할 대체적 감사절차를 수행한다.')],'A53 및 23: 비용만으로 이탈 불가, 조치는 별도 판정');
edge('conclusion-without-basis','pilot-02-004','sub2','적발위험은 완전히 제거할 수 없다.',[n,n],'현행 crit4 claim의 감사 고유한계 근거는 누락, 발문은 판단만 요구하여 불일치');
edge('standards-list-only','pilot-02-001','sub2','감사기준, 회계기준, 윤리기준',[n,m('감사기준'),m('회계기준'),m('윤리기준')],'발문이 세 기준의 제시를 요구하므로 나열 자체는 정답. 정의만 누락. keyword_salad 오탐 검사');
edge('two-standards','pilot-02-001','sub2','판단 근거는 감사기준과 회계기준이다.',[n,m('감사기준'),m('회계기준'),n],'요구한 세 기준 중 두 기준만 득점, max_entries 새로 추가하지 않음');
edge('three-standards-one-sentence','pilot-02-001','sub2','판단 근거는 감사기준, 회계기준 및 윤리기준이다.',[n,m('감사기준'),m('회계기준'),m('윤리기준')],'하나의 문장에 세 독립 기준이 표현되어도 득점');
edge('unrelated-fourth-standard','pilot-02-001','sub2','감사기준에 근거한다. 회계기준에 근거한다. 윤리기준에 근거한다. 추가로 경영진의 개인적 선호도 판단의 공식 기준이다.',[n,m('감사기준'),m('회계기준'),m('윤리기준')],'현행 max_entries=null, overflow=none. 추가 오류를 벌점으로 처리하는 계약 없음; 정의는 누락');
edge('contradiction-after-correct','pilot-02-001','sub1','전문가적 의구심 유지 필요성은 경감되지 않는다. 그러나 최종적으로 경영진이 정직하면 의구심을 줄여도 된다.',[x('그러나 최종적으로 경영진이 정직하면 의구심을 줄여도 된다.'),n],'정답 뒤 명시적 반대 결론 추가');
edge('hallucinated-evidence','pilot-02-004','sub1','관련이 있다.',[m('충분성은 양적 척도이다.'),n],'원문에 없는 인용은 코드가 제거',{live:false,expected_score:0,corrected_verdicts:['not_met','not_met']});
// Raw mock deliberately claims the ignored third entry; code must enforce the public limit.
edge('overflow-mock-enforcement','pilot-02-004','sub1','1. 관련이 있다.\n2. 충분성은 양적 척도이다.\n3. 적합성은 질적 척도이다.',[m('충분성은 양적 척도이다.'),m('적합성은 질적 척도이다.')],'AI가 3번째 항목을 met 반환해도 코드가 한도 계약을 적용해야 함',{live:false,expected_score:1,corrected_verdicts:['met','not_met']});
const modelQuotes=[
  [['전문가적 의구심을 유지할 필요성은 경감되지 않으며','설득력이 낮은 감사증거에 만족할 수 없다.'],['감사업무 상황에 적합한 일련의 행동에 관하여 정보에 근거한 의사결정을 내릴 때','감사기준','회계기준','윤리기준']],
  [['예외적 상황에서 요구된 특정 절차가 해당 감사상황에서 요구사항의 목적 달성에 비효과적일 때','그 목적을 달성하기 위한 대체적 감사절차를 수행해야 한다.'],['감사의견을 변형하거나','관련 법규상 가능한 경우 감사업무를 해지해야 하는지 평가한다.','목적 미달성은 감사기준서 230에 따라 문서화해야 하는 유의적 사항이다.']],
  [['감사의견은 재무제표가 중요성의 관점에서 해당 재무보고체계에 따라 작성되었는지를 다룬다.','감사의견은 기업의 향후 존속가능성을 인증하지 않으며','경영진이 기업 업무를 효과적 또는 효율적으로 수행했는지도 인증하지 않는다.'],['감사기준서가 시행 중이고','그 기준서가 다루는 상황이 존재하면 해당 감사와 관련된다.','감사인은 해당 감사와 관련된 모든 감사기준서의 요구사항을 준수한 경우에만 감사보고서에 감사기준을 준수하였다고 기술할 수 있다.']],
  [['충분성은 감사증거의 양적 척도이다.','적합성은 감사증거의 질적 척도이다.'],['수용가능한 적발위험 수준은 경영진주장 수준의 평가된 중요왜곡표시위험과 역의 관계에 있다.','적발위험은 감소시킬 수 있지만 감사의 고유한계 때문에 제거할 수는 없다.']],
  [['감사위험이란 재무제표가 중요하게 왜곡표시되어 있을 경우에 감사인이 부적합한 감사의견을 표명할 위험이다.','감사위험은 중요왜곡표시위험과 적발위험의 함수이다.'],['적발위험은 감사위험을 수용가능한 낮은 수준으로 감소시키기 위해 감사인이 수행하는 절차가 개별적으로 또는 다른 왜곡표시와 합칠 경우 중요할 수 있는 왜곡표시를 발견하지 못할 위험이다.']]
];
for(const [i,s]of bank.entries())cases.push({id:`${s.id}-stored-model-answer`,set_id:s.id,variant:'model_answer',answers:Object.fromEntries(s.subquestions.map(q=>[q.id,q.model_answer.join('\n')])),expected:{subquestions:s.subquestions.map((q,j)=>({subquestion_id:q.id,verdicts:q.criteria.map((c,k)=>({criterion_id:c.id,...m(modelQuotes[i][j][k])}))}))},expected_score:s.subquestions.reduce((n,q)=>n+q.criteria.length,0),basis:'저장된 모범답안 그대로 제출. 기대는 전 criterion met. 인용 예시는 검증용이며 실제 모델 인용은 원문 내 다른 구절도 허용.'});
fs.writeFileSync(`${dir}/02-cases.json`,JSON.stringify(cases,null,2)+'\n');
fs.writeFileSync(`${dir}/02-public.json`,JSON.stringify(bank.map(compilePublicQuestionSet),null,2)+'\n');
const originalFetch=globalThis.fetch,als=new AsyncLocalStorage();let mockCase=null,mockCalls=0;const prompts={};
globalThis.fetch=async(url,init)=>{
  const context=als.getStore(),params=JSON.parse(init.body);
  if(mockCase){mockCalls++;prompts[mockCase.id]=params;return new Response(JSON.stringify({id:'resp_mock',object:'response',status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(mockCase.expected),annotations:[]}]}]}),{status:200,headers:{'Content-Type':'application/json'}});}
  if(context)context.requests.push({model:params.model,input:params.input,max_output_tokens:params.max_output_tokens,store:params.store});
  const response=await originalFetch(url,init);if(context)context.responses.push({status:response.status,body:await response.clone().json()});return response;
};
function compare(c,result){
  const differences=[];
  for(const q of c.expected.subquestions)for(const [i,v]of q.verdicts.entries()){
    const actual=result.subquestions.find(a=>a.subquestion_id===q.subquestion_id)?.criteria.find(a=>a.criterion_id===v.criterion_id);
    const expected=c.corrected_verdicts&&c.answers[q.subquestion_id]?c.corrected_verdicts[i]:v.verdict;
    if(actual?.verdict!==expected)differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,expected,actual:actual?.verdict});
    if(actual?.quote&&!c.answers[q.subquestion_id].replace(/\s/g,'').includes(actual.quote.replace(/\s/g,'')))differences.push({kind:'invalid-evidence',subquestion:q.subquestion_id,criterion:v.criterion_id});
  }
  if(result.score!==c.expected_score)differences.push({expected_score:c.expected_score,actual_score:result.score});
  assert.equal(result.question_set_id,c.set_id);assert.equal(result.score,result.subquestions.reduce((n,q)=>n+q.score,0));assert.ok(result.score<=result.max_points);
  return differences;
}
const offline=[];
for(const c of cases){mockCase=c;mockCalls=0;const result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers,'offline-key');offline.push({id:c.id,model_calls:mockCalls,expected_score:c.expected_score,result,differences:compare(c,result)});}
mockCase=null;
const security=[],good=cases[0],s=bank[0];
for(const flag of ['injection_detected','salad_detected'])for(const scope of ['global','local']){
  const j=structuredClone(good.expected);if(scope==='global')j[flag]=true;else j.subquestions[0][flag]=true;
  const result=applyQuestionSetJudgment(s,good.answers,j),expected_score=scope==='global'?0:4;assert.equal(result.score,expected_score);security.push({flag,scope,expected_score,result});
}
for(const kind of ['partial-disallowed','cross-question-quote']){
  const j=structuredClone(good.expected);j.subquestions[0].verdicts[0]={criterion_id:'crit1',verdict:kind==='partial-disallowed'?'partial':'met',quote:kind==='partial-disallowed'?inputs['pilot-02-001/sub1'].full[0]:good.answers.sub2};
  const result=applyQuestionSetJudgment(s,good.answers,j);assert.equal(result.score,5);security.push({kind,expected_score:5,result});
}
assert.ok(offline.filter(r=>r.id.endsWith('-empty')).every(r=>r.model_calls===0&&r.result.score===0));
fs.writeFileSync(`${dir}/02-offline.json`,JSON.stringify({offline,security,prompt_contract:{constraints_transmitted:Object.values(prompts).some(p=>p.input.includes('overflow_policy')),all_blank_calls:offline.filter(r=>r.id.endsWith('-empty')).map(r=>r.model_calls)}},null,2)+'\n');
const liveCases=cases.filter(c=>c.live!==false&&c.variant!=='empty');
const metadata={at:new Date().toISOString(),model:process.env.CPA_GRADING_MODEL||'gpt-5.6-luna',bank_sha256:sha(bankFile),grading_sha256:sha('lib/questionV3Grading.ts'),scoring_sha256:sha('lib/questionV3.ts'),input_sha256:sha(`${dir}/02-inputs.json`),cases_sha256:sha(`${dir}/02-cases.json`),base_question_answer_combinations:50,extra_cases:cases.length-25,planned_initial_live_calls:liveCases.length,estimated_input_tokens:Math.ceil(liveCases.reduce((n,c)=>n+(prompts[c.id]?.input.length||0),0)/1.5),estimate_note:'한국어 문자수/1.5의 거친 추정. 최대 출력8000/호출; 불일치2회 추가, 전송 재시도최대3.',prompt_hashes:Object.fromEntries(Object.entries(prompts).map(([id,p])=>[id,crypto.createHash('sha256').update(p.input).digest('hex')])),offline_mismatches:offline.filter(r=>r.differences.length).map(r=>r.id)};
fs.writeFileSync(`${dir}/02-run-metadata.json`,JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify({...metadata,prompt_hashes:undefined}));
if(process.argv.includes('--live')){
  const out=`${dir}/02-live.jsonl`,done=fs.existsSync(out)?fs.readFileSync(out,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  async function run(c,attempt){
    if(done.some(r=>r.id===c.id&&r.attempt===attempt))return;
    const record={id:c.id,attempt,at:new Date().toISOString(),requests:[],responses:[]};
    await als.run(record,async()=>{try{record.result=await gradeQuestionSetV3(bank.find(s=>s.id===c.set_id),c.answers);record.differences=compare(c,record.result);}catch(e){record.error={name:e.name,message:e.message,code:e.code,status:e.status};}});
    fs.appendFileSync(out,JSON.stringify(record)+'\n');done.push(record);console.log(c.id,attempt,record.error?'ERROR':`score=${record.result.score} differences=${record.differences.length}`);
  }
  for(let i=0;i<liveCases.length;i+=2)await Promise.all(liveCases.slice(i,i+2).map(c=>run(c,1)));
  const repeat=liveCases.filter(c=>done.some(r=>r.id===c.id&&r.attempt===1&&(r.differences?.length||r.error)));
  for(const c of repeat)for(const attempt of [2,3])await run(c,attempt);
}
globalThis.fetch=originalFetch;
