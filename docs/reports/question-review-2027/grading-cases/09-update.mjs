import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const dir='docs/reports/question-review-2027/grading-cases',file='cpa_uploader/data/cpa_question_sets_v3.authoring.json',srcfile='cpa_uploader/data/official/kga501-505-510-2025-review09.txt';
const bank=JSON.parse(fs.readFileSync(file)),sets=bank.filter(s=>s.id.startsWith('pilot-09')),before=JSON.parse(fs.readFileSync(`${dir}/09-before.json`)),quotes=JSON.parse(fs.readFileSync(`${dir}/09-source-quotes.json`));
assert.deepEqual(sets,before,'Topic09 changed since baseline; merge explicitly');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
// Exact extracted paragraphs; join A23 across page boundary, excluding running footer/header.
fs.appendFileSync(srcfile,'\n=== DIRECT PARAGRAPH EXTRACTS (page-break headers/footers omitted) ===\n'+Object.entries(quotes).map(([k,t])=>`\n[${k}]\n${t}`).join('\n')+'\n');
function sources(s,spec){s.source_refs=Object.entries(spec).map(([id,[key,page]])=>({id,file:srcfile,title:'한국공인회계사회 회계감사기준 전문(2025 개정)',page,source_quote:quotes[key],role:'standard',content_hash:hash(quotes[key])}));for(const q of s.subquestions)for(const r of q.requirements){r.source_quote=s.source_refs.find(x=>x.id===r.source_ref_id).source_quote;r.source_span=s.source_refs.find(x=>x.id===r.source_ref_id).page;}}
function claim(q,i,t){q.criteria[i].claim=t;q.criteria[i].critical_facts[0].expected=t;}
const [s1,s2,s3,s4,s5,s6,s7]=sets;
sources(s1,{src4:['505.A23','505.A23, pp.408–409'],src5:['510.A6','510.A6, p.415'],src9:['510.10','510.10, p.413']});
s1.classification.tags=['재고자산','외부조회','기초잔액','초도감사'];s1.shared_context.facts[0].text='각 물음은 독립된 상황이다. 물음 1은 초도감사의 재고자산 기초잔액을, 물음 2는 외부조회 증거의 설득력을 다룬다.';
s1.subquestions[0].prompt='초도감사에서 당기 말 재고자산 잔액에 대한 감사절차만으로 기초재고자산에 관한 충분하고 적합한 감사증거를 얻기 어려운 이유를 설명하시오. 추가적인 감사절차로도 기초잔액에 관한 충분하고 적합한 감사증거를 입수할 수 없다면 감사인이 취해야 할 보고 조치를 서술하시오.';
s1.subquestions[0].model_answer=['당기 말 재고자산 잔액에 대한 감사절차는 보고기간 개시일에 보유한 재고자산에 대해서는 거의 증거를 제공하지 않으므로 추가적인 감사절차가 필요할 수 있다.','기초잔액에 관하여 충분하고 적합한 감사증거를 입수할 수 없다면 감사기준서 705에 따라 상황에 적합하게 한정의견을 표명하거나 의견을 거절한다.'];
claim(s1.subquestions[0],0,'당기 말 재고자산 잔액에 대한 감사절차가 기초에 보유한 재고자산에 대해서는 거의 증거를 제공하지 않는다는 한계를 설명함');
claim(s1.subquestions[0],1,'기초잔액 증거 입수가 불가능하면 상황에 적합하게 한정의견 또는 의견거절을 제시함. 부적정의견이나 자동 적정의견으로 대체하지 않음');
sources(s2,{src1:['501.4','501.4(a)(i)–(iv), p.390'],src2:['501.11','501.11(a)–(b), p.392']});
s2.subquestions[0].prompt='재고자산이 중요하여 감사인이 실사에 입회할 때, 감사기준서 501 문단 4(a)에 따라 수행할 네 가지 절차를 모두 제시하시오.';
s2.subquestions[1].prompt='소송·배상청구 감사에서 외부 법률고문과의 커뮤니케이션이나 답변을 얻지 못하는 경우를 다룬다. 감사기준서 501 문단 11에 따라 감사의견을 변형해야 하는 두 조건을 각각 설명하고, 두 조건 사이의 관계를 제시하시오.';
s2.subquestions[1].model_answer=['감사인이 기업의 외부 법률고문과 커뮤니케이션하거나 만나는 것을 경영진이 거부하거나, 외부 법률고문이 질의서에 대한 적절한 답변을 거부하거나 답변이 금지된다.','이와 함께 대체적인 감사절차로도 충분하고 적합한 감사증거를 얻을 수 없는 경우, 즉 두 조건이 모두 충족되면 감사기준서 705에 따라 감사의견을 변형한다.'];
claim(s2.subquestions[1],0,'경영진의 외부 법률고문과의 커뮤니케이션·만남 거부 또는 외부 법률고문의 적절한 답변 거부·금지라는 조건을 제시함');
claim(s2.subquestions[1],1,'위 커뮤니케이션·답변 제약과 함께 대체적 감사절차로 충분하고 적합한 증거도 얻을 수 없어야 의견변형함을 제시함. 두 조건의 동시 충족 관계가 필요하며 어느 하나만으로 자동 변형한다는 답안은 충족하지 않음');
sources(s3,{src1:['505.8','505.8(a)–(c), p.402'],src2:['505.10-11','505.10–11, p.403']});
s3.title='외부조회 발송 거부와 회신 신뢰성에 대한 대응';s3.shared_context.facts[0].text='외부조회에서 경영진의 조회서 발송 거부와 회신의 신뢰성 문제를 검토한다. 각 물음의 상황은 독립적이다.';
s3.subquestions[0].prompt='경영진이 감사인의 조회서 발송을 거부하였다. 감사기준서 505 문단 8에 따라 거부사유와 그 근거를 확인하고, 거부의 시사점을 평가하며 감사증거를 확보하기 위해 수행할 사항을 모두 제시하시오.';
claim(s3.subquestions[0],2,'발송 거부가 부정위험을 포함한 관련 중요왜곡표시위험의 평가에 미치는 시사점을 평가함');claim(s3.subquestions[0],3,'발송 거부가 다른 감사절차의 성격·시기·범위에 미치는 시사점을 평가함');claim(s3.subquestions[0],4,'관련성이 있고 신뢰할 수 있는 감사증거를 입수하도록 설계된 대체적 감사절차를 수행함');
claim(s3.subquestions[1],0,'회신 신뢰성에 의문을 제기하는 요소를 식별하면 그 의문을 해결하기 위한 추가 감사증거를 입수함');claim(s3.subquestions[1],1,'회신을 신뢰할 수 없다고 결정하면 부정위험을 포함한 관련 중요왜곡표시위험 평가에 대한 시사점을 평가함');claim(s3.subquestions[1],2,'회신을 신뢰할 수 없다고 결정하면 관련 기타 감사절차의 성격·시기·범위에 대한 시사점을 평가함');
sources(s4,{src1:['505.8','505.8(a)–(c), p.402'],src2:['505.8','505.8(c), p.402'],src3:['505.9','505.9, p.403']});
s4.subquestions[0].prompt='경영진이 조회서 발송을 거부한 경우, 감사기준서 505 문단 8(a)~(c)에 따라 수행할 세 가지 절차를 모두 제시하시오.';
s4.subquestions[0].model_answer[1]='경영진의 거부가 부정위험을 포함한 관련 중요왜곡표시위험의 평가와 다른 감사절차의 성격·시기·범위에 미치는 시사점을 평가한다.';
claim(s4.subquestions[0],1,'거부가 부정위험을 포함한 관련 중요왜곡표시위험 평가와 다른 감사절차의 성격·시기·범위에 미치는 시사점을 모두 평가함');claim(s4.subquestions[0],2,'관련성이 있고 신뢰할 수 있는 감사증거를 입수하도록 설계된 대체적 감사절차를 수행함');
s4.subquestions[1].type='descriptive';s4.subquestions[1].prompt='경영진의 조회서 발송 거부가 비합리적이라고 결론 내렸거나, 대체절차로 관련성이 있고 신뢰할 수 있는 감사증거를 입수할 수 없다면 감사인은 누구와 커뮤니케이션해야 하는지 제시하시오.';
claim(s4.subquestions[1],0,'커뮤니케이션 대상인 지배기구를 제시함. 대상 명칭만으로 충족하며 기준서 번호는 별도 득점 요건이 아님');
sources(s5,{src1:['505.10','505.10, p.403'],src2:['505.11','505.11, p.403']});
s5.shared_context.facts[0].text='외부조회 회신의 서명과 내용에서 신뢰성을 의심하게 하는 정황이 발견되었다. 각 물음에 제시된 검토 단계를 따른다.';
s5.subquestions[0].type='descriptive';s5.subquestions[0].prompt='조회 회신의 신뢰성에 의문을 제기하는 요소를 식별한 경우, 그 의문에 대응하여 감사인이 수행할 조치를 서술하시오.';
s5.subquestions[1].model_answer=['회신이 신뢰할 만하지 않다는 결정이 부정위험을 포함한 관련 중요왜곡표시위험의 평가에 미치는 시사점을 평가한다.','관련 기타 감사절차의 성격·시기·범위에 미치는 시사점을 평가한다.'];
claim(s5.subquestions[1],0,'회신이 신뢰할 만하지 않다는 결정이 부정위험을 포함한 관련 중요왜곡표시위험 평가에 미치는 시사점을 평가함');claim(s5.subquestions[1],1,'그 결정이 관련 기타 감사절차의 성격·시기·범위에 미치는 시사점을 평가함');
sources(s6,{src1:['501.4','501.4 본문·(a), p.390'],src2:['501.6-7','501.6–7, p.391'],src3:['501.A12-14','501.A12–A14, p.395']});
s6.classification.tags=['재고자산','실사입회','실행불가능','대체적 감사절차','의견변형'];
s6.subquestions[0].model_answer=['재고자산이 중요한 경우 실사 입회는 감사인의 임의 선택 사항이 아니다.','실행불가능한 경우를 제외하면 입회해야 한다.'];
claim(s6.subquestions[0],0,'재고자산이 중요한 경우 실사 입회가 감사인의 임의 선택 사항이 아니라고 판단함. 의무를 분명히 나타내는 조치로도 충족함');
claim(s6.subquestions[0],1,'입회 요구에 실행불가능한 경우의 예외가 있음을 제시함. 단순한 불편·시간·비용만으로 면제되거나 어떠한 경우에도 예외가 없다는 답안은 충족하지 않음');s6.subquestions[0].criteria[1].source_ref_ids=['src1','src3'];
s6.subquestions[1].prompt='재고자산 실사 입회가 실행가능하지 않은 경우 감사인이 우선 수행할 절차와, 그 절차로도 충분하고 적합한 감사증거를 얻을 수 없을 때의 보고 조치를 설명하시오.';
s6.subquestions[1].model_answer=['먼저 재고자산의 실재성과 상태에 관한 충분하고 적합한 감사증거를 입수하기 위해 대체적인 감사절차를 수행한다.','대체적인 감사절차로도 그러한 증거를 입수할 수 없다면 감사기준서 705에 따라 감사의견을 변형한다.'];
claim(s6.subquestions[1],0,'입회가 실행가능하지 않으면 재고자산의 실재성과 상태에 관한 충분하고 적합한 감사증거를 얻기 위한 대체적 감사절차를 우선 수행함');claim(s6.subquestions[1],1,'대체적 감사절차로도 충분하고 적합한 감사증거를 얻을 수 없을 때 감사기준서 705에 따라 의견을 변형함. 대체절차를 물리적으로 수행할 수 없는 때에만 한정하지 않음');
s6.subquestions[1].requirements.push({id:'req3',source_ref_id:'src3',source_quote:quotes['501.A12-14'],source_span:'501.A12–A14'});s6.subquestions[1].criteria[1].requirement_id='req3';s6.subquestions[1].criteria[1].source_ref_ids=['src2','src3'];
sources(s7,{src1:['505.7','505.7(a)–(d), p.402'],src2:['505.12-13','505.12–13, p.403'],src3:['505.14','505.14, p.403']});
s7.classification.tags=['외부조회','조회 통제','적극적 조회','미회신','불일치사항'];
s7.subquestions[0].prompt='외부조회 요청에 대한 통제를 유지하기 위해 감사기준서 505 문단 7에 따라 수행할 네 가지 절차를 모두 제시하시오. 조회서 설계 시 확인할 내용과 후속확인조회서 발송 조건도 포함하시오.';
s7.subquestions[0].model_answer=['확인하거나 요청할 정보를 결정한다.','적합한 조회 대상자를 선택한다.','조회서의 수신인이 적절히 표시되고 회신이 감사인에게 직접 발송되도록 회신에 관한 정보가 포함되었는지 확인하는 등 조회서를 설계한다.','조회처에 조회요청서를 발송하며, 적용가능한 경우 후속확인조회서를 발송한다.'];
const template=s7.subquestions[0].criteria[0];
function criterion(id,text){return {...structuredClone(template),id,claim:text,critical_facts:[{id:'cf'+id.slice(4),type:'action',expected:text}]};}
// Keep existing IDs: crit1 becomes information, crit2 retains design; new IDs cover omitted selection/dispatch.
s7.subquestions[0].criteria=[criterion('crit1','확인하거나 요청할 정보를 결정함'),criterion('crit5','적합한 조회 대상자를 선택함'),criterion('crit2','수신인의 적절한 표시와 감사인에게 직접 회신되도록 하는 정보를 확인하는 등 조회서를 설계함'),criterion('crit6','조회처에 조회요청서를 발송하고 적용가능한 경우 후속확인조회서를 포함함')];
s7.subquestions[1].prompt='적극적 조회의 각 미회신에 대해 추가 조치 없이 기존 증거로 감사를 진행하는 것과, 회신이 기업 장부와 불일치할 때 기록만 하고 넘기는 것이 각각 허용되는지 판단하고 필요한 처리를 설명하시오. 미회신은 대체절차로 필요한 감사증거를 얻을 수 있는 상황을 전제로 한다.';
s7.subquestions[1].model_answer=['둘 다 허용되지 않는다. 적극적 조회의 각 미회신에 대해 관련성이 있고 신뢰할 수 있는 감사증거를 입수하기 위한 대체적 감사절차를 수행해야 한다.','불일치사항이 왜곡표시를 나타내는지 결정하기 위해 해당 사항을 조사해야 한다.'];
claim(s7.subquestions[1],0,'적극적 조회의 각 미회신에 대해 추가 조치 없이 진행하는 것은 허용되지 않으며 관련성 있고 신뢰할 수 있는 증거를 위한 대체적 감사절차가 필요함을 제시함. 요구 조치로 결론이 분명하면 인정하되 명시적 반대 결론은 인정하지 않음');claim(s7.subquestions[1],1,'불일치사항을 기록만 하고 넘기는 것은 허용되지 않으며 왜곡표시 여부를 결정하기 위해 조사해야 함을 제시함. 조치로 결론이 분명하면 인정하되 명시적 반대 결론은 인정하지 않음');
for(const s of sets){for(const q of s.subquestions){q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};}s.verification.notes.push('2026-09-08 주제09 후속 검토: 공식2025 전문 직접 출처 및2026 전문 대상 명제 대조. 발문·답안·조건·채점요소·인용 해시 수정. 기존 게시/검수 상태 유지(승급 아님). 실측 및2027 판본 미확정은 docs/reports/question-review-2027/09.md 참조.');}
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');fs.writeFileSync(`${dir}/09-after.json`,JSON.stringify(sets,null,2)+'\n');console.log('7 sets, 14 questions, '+sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length+' criteria');
