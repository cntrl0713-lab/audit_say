// Topic 08 only; preserves all other working-tree changes and existing IDs/status.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.id.startsWith('pilot-08-'));
assert.equal(sets.length,5);
if(!fs.existsSync(`${dir}/08-before.json`))fs.writeFileSync(`${dir}/08-before.json`,JSON.stringify(sets,null,2)+'\n');
const sourceFile='cpa_uploader/data/official/kga500-2025-review08.txt',text=fs.readFileSync(sourceFile,'utf8');
function span(start,end){const i=text.indexOf(start);assert.ok(i>=0,start);const j=text.indexOf(end,i+start.length);assert.ok(j>i,end);return text.slice(i,j).trim();}
const passages={
 '7':span('7. 감사인은 감사절차','8. 감사증거로'),
 '8':span('8. 감사증거로','\n6 감사기준서 402'),
 '9':span('9. 감사인은 기업이','감사증거를 입수하기 위한 테스트 항목의 추출'),
 '11':span('11. 어떤 원천에서','적용 및 기타 설명자료'),
 'A19':span('A19. 예를 들어','\n12 감사기준서 330'),
 'A20':span('A20. 유형자산에','\n관찰'),
 'A21':span('A21. 예를 들어','\n외부조회'),
 'A31':span('A31. 관련성은','A32.'),
 'A35':span('A35. 감사증거로','A36.'),
 'A62':span('A62. 감사인은','감사증거를 입수하기 위한 테스트 항목의 추출 (문단'),
 'A63':span('A63. 입수되거나','\n모든 항목의 추출'),
 'A66':span('A66. 어떤 거래유형이나','\n표본감사'),
 'A67':span('A67. 표본감사는','감사증거의 일관성 결여 또는 감사증거의 신뢰성에 대한 의문'),
};
const pages={'7':'370','8':'370','9':'371','11':'371',A19:'375',A20:'376',A21:'376',A31:'378',A35:'378–379',A62:'386',A63:'386',A66:'387',A67:'387'};
function src(id,p){return {id,file:sourceFile,title:`한국공인회계사회 회계감사기준 전문(2025 개정) — 감사기준서 500 / PDF p.${pages[p]} / 문단 ${p}`,page:'KGA 500',source_quote:passages[p],role:'standard',content_hash:crypto.createHash('sha256').update(passages[p]).digest('hex')};}
function sources(s,mapping,requirements){s.source_refs=Object.entries(mapping).map(([id,p])=>src(id,p));for(const [i,map]of requirements.entries())for(const r of s.subquestions[i].requirements){const id=map[r.id];assert.ok(id);r.source_ref_id=id;r.source_quote=s.source_refs.find(x=>x.id===id).source_quote;r.source_span=`500.${mapping[id]}`;}}
function contract(q,i,claim){q.criteria[i].claim=claim;q.criteria[i].critical_facts[0].expected=claim;}
for(const s of sets){for(const q of s.subquestions){q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};}s.verification.notes.push('2026-09-08 주제08 후속 검토: 공식 2025 전문 및 2026년7월 개정 전문 대상 문단 대조. 출처·발문·조건·정수 채점 계약 수정. 기존 상태 유지; 2027 최종 시험 판본 지정 미확정. 실측 결과는 docs/reports/question-review-2027/08.md 참조.');}
let s=sets[0],q=s.subquestions[0];
sources(s,{src1:'A31',src7:'7'},[{req1:'src7'},{req2:'src1'}]);
q.type='enumeration';q.prompt='감사인이 감사절차를 설계하고 수행할 때 감사증거로 사용될 정보에 대하여 고려해야 할 두 가지 요소를 모두 제시하시오.';
q=s.subquestions[1];q.model_answer=['장부에 기록된 매입채무를 테스트하는 것은 매입채무의 과소계상 검증에 관련성이 없다.','관련성 있는 정보의 예로는 후속 지급거래, 미지급 송장, 매입처 계산서 또는 일치하지 않는 검수보고서가 있다.'];
contract(q,1,'매입채무의 과소계상 검증에 관련성 있는 정보의 예를 하나 이상 제시함. 후속 지급거래, 미지급 송장, 매입처 계산서, 일치하지 않는 검수보고서 등 타당한 예를 인정하며, 반드시 장부 밖 정보라고 표현할 필요는 없음');
s=sets[1];sources(s,{src1:'8',src2:'11'},[{req1:'src1'},{req2:'src2'}]);
s.shared_context.facts[0].text='감사인은 경영진측 전문가의 업무를 이용하여 작성된 정보와 다른 원천의 감사증거 사이에서 불일치를 발견하였다.';
s.subquestions[0].prompt='경영진측 전문가의 업무를 이용하여 작성된 정보를 감사증거로 사용하려 한다. 그 업무의 유의성을 고려하여 감사목적에 필요한 정도로 수행해야 할 세 가지 절차를 모두 제시하시오.';
s.subquestions[1].prompt='서로 다른 원천의 정보가 일관되지 않거나 감사증거로 이용되는 정보의 신뢰성에 의문이 있는 경우 감사인이 취해야 할 두 가지 대응을 설명하시오.';
s=sets[2];sources(s,{src1:'9',src2:'A21',src3:'A62'},[{req1:'src1'},{req2:'src2'}]);
q=s.subquestions[0];q.prompt='기업이 생산한 정보가 감사목적을 위해 충분히 신뢰할 수 있는지 평가하려 한다. 해당 상황의 필요에 따라 수행하는 두 가지 절차를 제시하되, 증거를 입수할 정보의 특성 두 가지와 감사목적에 비추어 평가할 정보의 특성 두 가지를 모두 포함하시오.';
q.model_answer=['해당 상황의 필요에 따라 정보의 정확성과 완전성에 대한 감사증거를 입수한다.','또한 정보가 감사인의 목적을 위해 충분히 정확하고 자세한지 평가한다.'];
contract(q,2,'정보가 감사목적을 위해 충분히 정확한지(목적에 필요한 정밀도를 갖추었는지) 평가함. 단순히 정보 자체의 정확성에 대한 감사증거를 입수한다는 진술만으로는 이 별도 목적적합성 평가를 충족하지 않음');
q.criteria[2].source_ref_ids=['src1','src3'];q.criteria[3].source_ref_ids=['src1','src3'];
s=sets[3];sources(s,{src1:'A35',src2:'A63',src3:'A67',src4:'A66'},[{req1:'src1'},{req2:'src2'}]);
q=s.subquestions[0];q.prompt='감사증거의 신뢰성에 대한 일반화에는 예외가 있을 수 있다. 이를 전제로 기준서가 제시하는 일반화 중 원천, 내부통제 및 입수방식과 관련된 세 가지를 모두 제시하시오.';
q.model_answer=q.model_answer.map(a=>'일반적으로 '+a);
for(const c of q.criteria)c.claim+=' (예외가 있을 수 있는 일반화이며, 예외 없이 항상 성립한다고 명시하면 인정하지 않음)';
q=s.subquestions[1];q.prompt='감사인이 테스트할 항목을 추출하는 데 이용할 수 있는 세 가지 방법을 모두 제시하고, 그중 모집단에서 추출한 표본의 테스트 결과에 근거하여 모집단 전체에 대한 결론을 이끌어 내도록 설계되는 방법을 밝히시오.';
q.model_answer[3]='표본감사는 모집단에서 추출한 표본의 테스트 결과에 근거하여 모집단 전체에 대한 결론을 이끌어 내도록 설계된다.';
q.requirements.push({id:'req3',source_ref_id:'src3',source_quote:passages.A67,source_span:'500.A67'});q.criteria[3].requirement_id='req3';q.criteria[3].source_ref_ids=['src3','src4'];
contract(q,3,'표본의 테스트 결과에 근거하여 모집단 전체에 대한 결론을 이끌어 내는 방법이 표본감사임을 연결하여 설명함. 방법 명칭만 나열하거나 특정 항목의 선택적 조사 결과를 전체 모집단에 투영한다는 답은 이 명제를 충족하지 않음');
s=sets[4];sources(s,{src1:'A19',src2:'A20'},[{req1:'src1'},{req2:'src2'}]);
q=s.subquestions[0];q.prompt='주권이나 채권증서처럼 그 자체가 금융상품인 문서를 검사할 때, 소유권과 가치에 관한 감사증거도 반드시 입수되는지 판단하시오. 또한 그러한 문서가 직접적인 감사증거를 제공하는 경영진주장을 제시하시오.';
q.model_answer=['그러한 문서를 검사한다고 해서 소유권이나 가치에 관한 감사증거가 반드시 입수되는 것은 아니다.','주권이나 채권증서처럼 그 자체가 금융상품인 문서는 자산의 실재성에 대한 직접적인 감사증거를 제공한다.'];
contract(q,0,'금융상품인 문서의 검사로 소유권과 가치에 대한 감사증거가 반드시 입수되는 것은 아니라고 판단함. 언제나 입수된다거나 전혀 제공할 수 없다고 단정하는 답은 인정하지 않음');
contract(q,1,'그 자체가 금융상품인 문서는 자산의 실재성에 대한 직접적인 감사증거를 제공한다고 제시함');
q=s.subquestions[1];q.prompt='유형자산의 실물검사가 신뢰성 있는 감사증거를 제공할 수 있는 경영진주장과, 반드시 그러한 증거를 제공하는 것은 아닌 경영진주장을 구분하여 설명하시오.';
q.model_answer=['유형자산의 실물검사는 자산의 실재성에 관한 신뢰성 있는 감사증거를 제공할 수 있다.','기업의 권리와 의무 및 평가에 대해서는 반드시 그러한 증거를 제공하는 것은 아니다.'];
contract(q,0,'유형자산의 실물검사는 실재성에 관한 신뢰성 있는 감사증거를 제공할 수 있다고 설명함');
contract(q,1,'권리와 의무 및 평가에는 실물검사가 반드시 신뢰성 있는 감사증거를 제공하는 것은 아니라고 설명함. 언제나 제공한다거나 전혀 제공할 수 없다고 단정하는 답은 인정하지 않음');
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');
fs.writeFileSync(`${dir}/08-source-passages.json`,JSON.stringify(passages,null,2)+'\n');
console.log('Updated 5 sets, 10 questions, 27 criteria / 27 points');
