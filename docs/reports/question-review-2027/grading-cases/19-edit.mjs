import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const file='cpa_uploader/data/cpa_question_sets_v3.authoring.json',dir='docs/reports/question-review-2027/grading-cases';
const bank=JSON.parse(fs.readFileSync(file)),before=JSON.parse(fs.readFileSync(`${dir}/19-before.json`));
const sets=bank.filter(s=>s.id.startsWith('pilot-19-'));assert.deepEqual(sets,before,'Target changed since snapshot; rebase required');
const quotes=JSON.parse(fs.readFileSync(`${dir}/19-source-quotes.json`));
const sourceFile='cpa_uploader/data/official/assurance-review-2027-topic19.txt';
function source(s,id,key,title,page){const x={id,file:sourceFile,title,page,source_quote:quotes[key],role:'standard',content_hash:crypto.createHash('sha256').update(quotes[key]).digest('hex')};const old=s.source_refs.findIndex(x=>x.id===id);if(old<0)s.source_refs.push(x);else s.source_refs[old]=x;return id;}
function req(q,id,sid,s,span){const x={id,source_ref_id:sid,source_quote:s.source_refs.find(x=>x.id===sid).source_quote,source_span:span};const old=q.requirements.findIndex(x=>x.id===id);if(old<0)q.requirements.push(x);else q.requirements[old]=x;}
function claim(q,n,text,reqid,sids){const c=q.criteria[n];c.claim=text;c.critical_facts[0].expected=text;if(reqid)c.requirement_id=reqid;if(sids)c.source_ref_ids=sids;}
const [s1,s2,s3,s4]=sets;
source(s1,'src4','framework17','인증업무개념체계(2022 개정)','문단17, PDF13');
source(s1,'src10','review5-6','역사적 재무제표에 대한 검토업무기준(2021 개정)','문단5–6');
source(s1,'src14','review7-8','역사적 재무제표에 대한 검토업무기준(2021 개정)','문단7–8');
s1.shared_context.facts[0].text='공인회계사가 제공하는 업무의 성격과 역사적 재무제표 검토업무를 다룬다.';
s1.subquestions[0].prompt='다음 업무 중 인증결론을 표명하지 않는 비인증업무를 모두 고르시오: 재무제표 감사, 재무정보 작성업무, 합의된 절차 수행업무, 역사적 재무제표 검토, 세무조정계산서 작성업무.';
s1.subquestions[0].model_answer=['재무정보 작성업무','합의된 절차 수행업무','세무조정계산서 작성업무'];
claim(s1.subquestions[0],2,'세무조정계산서 작성업무를 비인증업무로 선택함. 세무업무라는 상위 표현도 이 보기의 업무를 지칭하면 인정함');
s1.subquestions[1].prompt='역사적 재무제표 검토업무가 제공하는 확신 수준을 제시하고, 주로 수행하는 절차와 중요한 왜곡표시가 있을 수 있다고 믿게 하는 문제를 알게 된 경우의 추가절차를 설명하시오.';
s1.subquestions[1].model_answer=['검토업무는 합리적 확신보다 낮은 제한적 확신을 제공한다.','주로 질문과 분석적절차를 수행하며, 중요한 왜곡표시가 있을 수 있다고 믿게 하는 문제를 알게 되면 결론에 필요한 추가절차를 설계하고 수행한다.'];
claim(s1.subquestions[1],1,'주로 질문과 분석적절차를 수행하며, 중요한 왜곡표시가 있을 수 있다고 믿게 하는 문제를 알게 되면 결론에 필요한 추가절차를 설계·수행함을 모두 설명함. 검사·관찰·조회가 절대 금지된다는 답은 충족하지 않음');
req(s1.subquestions[0],'req1','src4',s1,'개념체계17, PDF13');req(s1.subquestions[1],'req2','src10',s1,'검토기준5–6');req(s1.subquestions[1],'req3','src14',s1,'검토기준7–8');
s1.classification.tags=['인증업무','비인증업무','제한적 확신','질문과 분석적절차'];
source(s2,'src1','framework10','인증업무개념체계(2022 개정)','문단10, PDF12');source(s2,'src2','framework26','인증업무개념체계(2022 개정)','문단26, PDF15');source(s2,'src3','framework8','인증업무개념체계(2022 개정)','문단8, PDF11');
s2.subquestions[0].prompt='인증업무의 정의를 기초인증대상과 준거기준, 증거의 요건, 결론의 목적과 대상 이용자를 포함하여 설명하고, 공인회계사가 인증업무를 수행할 때의 독립성 요건을 제시하시오.';
s2.subquestions[0].model_answer=['인증업무는 준거기준에 따라 기초인증대상을 측정하거나 평가한 결과에 대해 결론을 표명하기 위하여 충분하고 적합한 증거를 입수하는 것을 목적으로 하는 업무이다.','그 결론은 인증대상책임자가 아닌 의도된 이용자의 신뢰수준을 향상시키기 위한 것이다.','인증업무를 수행하는 공인회계사는 독립성을 충족해야 한다.'];
claim(s2.subquestions[0],0,'준거기준에 따라 기초인증대상을 측정·평가한 결과에 대해 결론을 표명하기 위하여 충분하고 적합한 증거를 입수하는 업무임을 설명함. 기준에 따른 평가·측정, 결론 표명 및 충분하고 적합한 증거 요건을 모두 충족해야 함');
claim(s2.subquestions[0],1,'인증대상책임자가 아닌 의도된 이용자의 신뢰수준을 향상시키는 결론이 목적임을 설명함. 책임자만의 신뢰 향상이나 책임자를 제외하는 조건의 누락은 충족하지 않음');
claim(s2.subquestions[0],2,'인증업무를 수행하는 공인회계사는 독립성을 충족해야 한다고 설명함','req3',['src3']);
s2.subquestions[1].prompt='인증업무개념체계의 다섯 가지 구성요소를 모두 제시하시오. 삼자관계의 당사자, 인증대상·준거기준·증거의 요건, 인증보고서의 형식과 업무 성격에 대한 적합성을 포함하시오.';
s2.subquestions[1].model_answer=['인증인·인증대상책임자·의도된 이용자로 구성되는 삼자관계','적절한 인증대상','적합한 준거기준','충분하고 적합한 증거','합리적 확신업무 또는 제한적 확신업무에 적합한 형태의 서면 인증보고서'];
claim(s2.subquestions[1],0,'인증인·인증대상책임자·의도된 이용자의 삼자관계를 제시함. 이 공인회계사 사례에서 인증인을 공인회계사로 표현해도 인정하며, 삼자관계라는 명칭만 쓰고 당사자를 누락하면 충족하지 않음');
claim(s2.subquestions[1],2,'적합한 준거기준을 제시함. 적절한 준거기준이라는 동의 표현도 인정함');
claim(s2.subquestions[1],4,'합리적 확신업무 또는 제한적 확신업무의 성격에 적합한 형태의 서면 인증보고서를 제시함. 보고서라는 명칭만으로는 서면성과 업무 성격 적합성 요건을 충족하지 않음');
req(s2.subquestions[0],'req1','src1',s2,'개념체계10, PDF12');req(s2.subquestions[0],'req3','src3',s2,'개념체계8, PDF11');req(s2.subquestions[1],'req2','src2',s2,'개념체계26, PDF15');s2.classification.tags=['인증업무','삼자관계','기초인증대상','준거기준','충분하고 적합한 증거','서면 인증보고서','독립성'];
// ISA800 international source is explicit. Do not label it as a verified domestic edition.
source(s3,'src1','800.8','ISA800(Revised), IAASB final pronouncement2016; IRBA 게재','문단8, PDF6 (각주번호 제외 웹 발췌)');source(s3,'src2','200.18','회계감사기준 전문(2025 개정)','KGA 200');source(s3,'src3','200.23','회계감사기준 전문(2025 개정)','KGA 200');source(s3,'src4','800.9','ISA800(Revised), IAASB final pronouncement2016; IRBA 게재','문단9, PDF6 (각주번호 제외 웹 발췌)');
s3.classification.standards=['KGA 200'];s3.classification.tags=['특정목적 재무제표','특정목적 재무보고체계','수용가능성','ISA 800','감사기준 준수','예외적 이탈'];
s3.shared_context.facts[0].text='특정 이용자의 재무정보 수요를 충족하도록 작성된 재무제표 전체에 대한 감사업무를 다룬다. 각 물음의 수임 또는 계획·수행 단계를 따른다.';
s3.subquestions[1].prompt='특정목적 재무제표 감사를 계획하고 수행할 때 관련 감사기준서 준수의 원칙을 제시하고, 관련 요구사항에서 이탈할 수 있는 예외적 상황의 조건과 이 경우 수행할 대체적 감사절차를 설명하시오.';
s3.subquestions[1].model_answer=['해당 감사와 관련된 모든 감사기준서를 준수해야 한다.','예외적 상황에서 특정 절차가 그 요구사항의 목적을 달성하는 데 비효과적이어서 관련 요구사항을 이탈할 필요가 있다고 판단한 경우, 해당 목적을 달성하기 위한 대체적 감사절차를 수행해야 한다.'];
claim(s3.subquestions[0],2,'해당 상황에서 재무보고체계의 수용가능성을 결정하기 위해 경영진이 취한 조치를 이해함. 감사인이 취한 조치로 주체를 바꾸면 충족하지 않음');
claim(s3.subquestions[1],1,'예외적 상황에서 요구된 특정 절차가 그 요구사항의 목적 달성에 비효과적이어서 이탈할 필요가 있다고 판단하며, 해당 목적을 달성할 대체적 감사절차를 수행함을 모두 설명함. ISA800에만 허용되는 이탈로 한정하거나 예외적 상황이라는 표현만 제시하면 충족하지 않음','req3',['src3']);
req(s3.subquestions[0],'req1','src1',s3,'ISA800.8, PDF6;국내800 판본 직접 확인 미완료');req(s3.subquestions[1],'req2','src2',s3,'KGA200.18, PDF10;ISA800.9 대조');req(s3.subquestions[1],'req3','src3',s3,'KGA200.23, PDF11');req(s3.subquestions[1],'req4','src4',s3,'ISA800.9, PDF6');s3.subquestions[1].criteria[0].source_ref_ids=['src2','src4'];s3.verification.source_fidelity='excerpt';
source(s4,'src1','aup7','합의된 절차 수행업무기준(2006-09-28 개정)','문단7, PDF3–4');source(s4,'src2','review1-2','역사적 재무제표에 대한 검토업무기준(2021 개정)','문단1–2');source(s4,'src3','framework6','인증업무개념체계(2022 개정)','문단6, PDF11');source(s4,'src4','interim1','분·반기재무제표 검토준칙(2014-12-30 개정)','문단1·1-1;2015 타법개정 원문 대조 미완료');source(s4,'src5','200.18','회계감사기준 전문(2025 개정)','KGA 200');s4.classification.standards=['KGA 200'];
s4.subquestions[0].type='descriptive';s4.subquestions[0].prompt='감사·인증 의뢰인에게 제공하는 업무는 제외하고, 공인회계사가 비인증업무를 수행할 때 독립성 요구의 일반원칙과 별도 요구가 있는 경우의 예외, 객관성 유지 의무를 각각 설명하시오.';
s4.subquestions[0].model_answer=['비인증업무 자체가 독립성을 일률적으로 요구하는 것은 아니다. 다만 관련 법규나 계약의 조건·목적 등에 따라 별도로 독립성이 요구되면 이를 준수해야 한다.','비인증업무를 수행할 때에도 객관성 또는 공정을 항상 유지해야 한다.'];
claim(s4.subquestions[0],0,'감사·인증 의뢰인 업무를 제외한 비인증업무는 그 자체로 독립성을 일률적으로 요구하지 않으나, 법규나 계약 조건·목적 등에 따라 별도로 독립성이 요구되면 준수해야 함을 설명함. 일반원칙과 별도 요구의 예외를 모두 제시해야 하며 무조건 독립성이 불필요하다는 답은 인정하지 않음');
claim(s4.subquestions[0],1,'비인증업무에서도 항상 객관성 또는 공정을 유지해야 함을 설명함','req3',['src3']);
s4.subquestions[1].prompt='다음 세 업무에 각각 적용되는 수행기준의 명칭을 모두 제시하시오. ① 연간재무제표 감사 ② 주권상장법인의 분·반기보고서에 포함되는 중간재무제표를 그 회사의 독립된 연간재무제표 감사인이 검토하는 업무 ③ 법정감사대상이 아닌 회사의 연간재무제표를 그 회사의 재무제표 감사인이 아닌 검토인이 검토하는 업무.';
s4.subquestions[1].model_answer=['연간재무제표 감사에는 회계감사기준을 적용한다.','②의 중간재무제표 검토에는 분·반기재무제표 검토준칙을 적용한다.','③의 연간재무제표 검토에는 역사적 재무제표에 대한 검토업무기준을 적용한다.'];
claim(s4.subquestions[1],0,'①의 연간재무제표 감사에 회계감사기준을 연결하여 제시함','req5',['src5']);claim(s4.subquestions[1],1,'②의 해당 회사 독립된 연간재무제표 감사인의 중간재무제표 검토에 분·반기재무제표 검토준칙을 연결하여 제시함','req4',['src4']);claim(s4.subquestions[1],2,'③의 해당 회사 감사인이 아닌 검토인의 역사적 재무제표 검토에 역사적 재무제표에 대한 검토업무기준을 연결하여 제시함');
req(s4.subquestions[0],'req1','src1',s4,'합의된절차7, PDF3–4');req(s4.subquestions[0],'req3','src3',s4,'개념체계6, PDF11');req(s4.subquestions[1],'req2','src2',s4,'검토기준1–2');req(s4.subquestions[1],'req4','src4',s4,'분·반기준칙1·1-1');req(s4.subquestions[1],'req5','src5',s4,'KGA200.18, PDF10');
for(const s of sets){for(const q of s.subquestions){q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};q.selection={type:'all',n:null};}s.verification.notes.push('2026-09-08 주제19 후속 검토: 공식 개념체계2022·검토기준2021·합의된절차2006·분반기준칙2014·KGA200 및 ISA800 대조. 발문 범위·조건·용어·직접 출처·해시 수정. 기존 게시/검수 상태 유지(승급 아님); 국내800 및 분반기2015 전문·2027 시험 판본 미확정은 docs/reports/question-review-2027/19.md 참조.');}
fs.writeFileSync(file,JSON.stringify(bank,null,2)+'\n');fs.writeFileSync(`${dir}/19-after.json`,JSON.stringify(sets,null,2)+'\n');console.log('topic19 updated: 4 sets /8 questions /23 criteria');
