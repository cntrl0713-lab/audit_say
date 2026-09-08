import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const path='cpa_uploader/data/cpa_question_sets_v3.authoring.json',dir='docs/reports/question-review-2027/grading-cases';
const bank=JSON.parse(fs.readFileSync(path)),sets=bank.filter(s=>s.id.startsWith('pilot-18-'));assert.equal(sets.length,4);
const before=structuredClone(sets);assert.ok(!fs.existsSync(`${dir}/18-before.json`),'Do not overwrite baseline');
fs.writeFileSync(`${dir}/18-before.json`,JSON.stringify(before,null,2)+'\n');
const pages=JSON.parse(fs.readFileSync('tmp/question-review-18/selected-pages.json'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const span=(p,a,b)=>{const t=pages[p],start=t.indexOf(a),end=b?t.indexOf(b,start):t.length;assert.ok(start>=0&&end>start);return t.slice(start,end).trim();};
const quotes={scope:span(909,'2. 이 감사기준서는','\n3. '),nonSmall:span(909,'3. 이 감사기준서는','\n \n1 외부'),compliance:span(910,'4. 감사인은','\n5. '),choice:span(910,'5. 감사인은','\n이 감사기준서와'),prospective:span(910,'6. 직전','\n7. '),transition:span(910,'7. 이 감사기준서를','\n시행일'),docs:span(914,'27. 감사인은')+'\n'+span(915,'(a) 감사보고서의','\n경영진 및'),report:pages[956]+'\n'+pages[957]};
function src(s,id,key,paragraph,p){const value={id,file:'cpa_uploader/data/official/kga1200-2025-review18.txt',title:`한국공인회계사회 회계감사기준 전문(2025 개정), KGA1200 ${paragraph}, PDF ${p}쪽`,page:'KGA 1200',source_quote:quotes[key],role:'standard',content_hash:hash(quotes[key])};s.source_refs.push(value);return value;}
function req(q,id,ref,paragraph,p){const r={id,source_ref_id:ref.id,source_quote:ref.source_quote,source_span:`KGA1200 ${paragraph}; 2025 개정 전문 PDF ${p}쪽; 2026-09-08 공식 PDF 확인`};q.requirements.push(r);return r;}
function bind(c,r){c.requirement_id=r.id;c.source_ref_ids=[r.source_ref_id];}
const [a,b,c,d]=sets;
for(const s of sets){s.source_refs=[];for(const q of s.subquestions){q.requirements=[];q.selection={type:'all',n:null};q.constraints={ordered:false,max_entries:null,overflow_policy:'none'};}}
a.title='소규모기업 감사기준의 적용 범위와 감사보고서 사례';
a.shared_context.facts[0].text='각 물음은 KGA 1200의 적용 범위 또는 보론 2의 감사보고서 사례를 다룬다.';
let ref=src(a,'src1','nonSmall','3',909),r=req(a.subquestions[0],'req1',ref,'3',909);a.subquestions[0].criteria.forEach(x=>bind(x,r));
src(a,'src2','scope','2',909);
a.subquestions[0].prompt='KGA 1200에서 정한 소규모기업에 해당하지 않는 기업의 일반목적 재무제표 감사에 KGA 1200을 적용할 수 있는지 판단하고, 이 경우 적용해야 하는 감사기준서를 제시하시오.';
a.subquestions[0].model_answer=['KGA 1200을 적용할 수 없다.','일반 감사기준서(KGA 200부터 KGA 720까지)를 적용해야 한다.'];
a.subquestions[0].criteria[1].critical_facts[0].expected='일반 감사기준서 적용. 명칭이 명확하면 기준서 번호의 나열을 별도로 요구하지 않음';
ref=src(a,'src6','report','보론 2 사례 1','956–957');r=req(a.subquestions[1],'req2',ref,'보론 2 사례 1 전체에 KAM 단락 없음(사례 관찰; 일반적 금지로 확대하지 않음)','956–957');bind(a.subquestions[1].criteria[0],r);
a.subquestions[1].type='judgment';a.subquestions[1].prompt='KGA 1200 보론 2의 사례 1(적정의견 감사보고서)에 핵심감사사항(KAM) 단락이 포함되어 있는지 판단하시오.';
b.shared_context.facts[0].text='각 물음은 독립된 상황이며, 감사 진행 중의 기준 전환과 회계연도 간 기준 변경을 각각 다룬다.';
ref=src(b,'src1','transition','7',910);r=req(b.subquestions[0],'req1',ref,'7(a)–(c), (b)(i)–(iii)',910);b.subquestions[0].criteria.forEach(x=>bind(x,r));
ref=src(b,'src2','prospective','6',910);r=req(b.subquestions[1],'req2',ref,'6',910);bind(b.subquestions[1].criteria[0],r);
b.subquestions[0].prompt='KGA 1200에 따라 감사를 수행하던 중 감사대상 기업이 문단 2의 적용 조건을 충족하지 못하게 되었다. 적용해야 하는 기준과 문단 7의 후속 절차를 모두 제시하고, 이미 수행한 업무를 평가할 때 포함해야 하는 세 범주도 설명하시오.';
b.subquestions[0].model_answer[2]='기업과 기업 환경의 이해를 포함한 위험평가절차, 이미 설계하였거나 수행한 추가감사절차 및 문서화를 포함하여, 이미 수행한 업무가 충분하고 적합한지 평가한다.';
b.subquestions[0].criteria[2].claim='위험평가절차(기업과 기업 환경의 이해 포함), 이미 설계하거나 수행한 추가감사절차 및 문서화의 세 범주를 포함하여 기수행 업무의 충분성과 적합성을 평가함';
b.subquestions[0].criteria[2].critical_facts[0].expected=b.subquestions[0].criteria[2].claim;
b.subquestions[0].criteria[3].critical_facts[0].expected='일반 감사기준서의 관련 요구사항 준수에 필요한 추가 절차를 설계하고 수행하며 필요에 따라 문서화를 추가함';
b.subquestions[1].model_answer=['일반 감사기준서는 당기 감사부터 전진적으로 적용한다. 적용 기준서의 변경 자체 때문에 기초잔액이나 비교재무제표에 관한 추가 고려 또는 추가 절차가 요구되는 것은 아니다.'];
b.subquestions[1].criteria[0].critical_facts[0].expected='당기 감사부터 전진적 적용. 다음 회계연도부터 적용 또는 전기 감사의 소급 재수행을 요구하는 답은 불인정';
ref=src(c,'src1','compliance','4',910);r=req(c.subquestions[0],'req1',ref,'4',910);c.subquestions[0].criteria.slice(0,2).forEach(x=>bind(x,r));
ref=src(c,'src3','choice','5',910);r=req(c.subquestions[0],'req3',ref,'5',910);bind(c.subquestions[0].criteria[2],r);
c.subquestions[0].prompt='KGA 1200을 적용해 감사를 수행한 경우 감사보고서에 기술하거나 언급해서는 안 되는 두 사항을 모두 제시하시오. 또한 문단 2의 적용 조건을 충족하는 기업에 일반 감사기준서를 선택 적용할 수 있는 조건과 적용 방식을 설명하시오.';
c.subquestions[0].criteria[2].critical_facts[0].expected='적격 기업과 서면으로 합의하고 KGA 1200 대신 일반 감사기준서를 대체 적용함. 구두 합의나 두 기준의 일부씩 혼용은 불인정';
ref=src(c,'src2','docs','27–31','914–915');r=req(c.subquestions[1],'req2',ref,'27–31','914–915');c.subquestions[1].criteria.forEach(x=>bind(x,r));
const q=c.subquestions[1];q.prompt='KGA 1200 문단 27–31에 따른 감사문서 요구사항을 모두 설명하시오. 문서 작성의 목적, 이해할 수 있어야 하는 사람과 문서에 담을 사항, 유의적 사안의 논의 기록, 최종감사파일의 취합 및 취합 후 삭제·폐기와 수정·추가 시의 요구사항을 포함하시오.';
const extra=[
 ['crit9','이 감사기준서와 관련 법규에 따라 감사를 계획하고 수행하였다는 증거를 제공하는 문서를 작성함','KGA 1200과 관련 법규의 요구사항에 따라 감사를 계획하고 수행하였다는 증거를 제공하는 문서를 작성한다.','27(b)'],
 ['crit10','수행한 절차의 성격·시기·범위와 테스트 항목의 식별 특성, 수행자·완료일, 검토자·검토일·검토범위를 기록함','수행한 감사절차의 성격·시기·범위를 기록하며, 테스트한 항목이나 사안의 식별 특성, 업무 수행자와 완료일, 검토자와 검토일 및 검토 범위를 포함한다.','28(a)(i)–(iii)'],
 ['crit11','감사절차의 수행 결과 및 입수한 감사증거를 기록함','감사절차의 수행 결과와 입수한 감사증거를 기록한다.','28(b)'],
 ['crit12','감사 중 유의적 사안, 관련 결론 및 결론 도출에 적용한 유의적인 전문가적 판단을 기록함','감사 중 발생한 유의적 사안, 그에 관한 결론 및 결론 도출에 적용한 유의적인 전문가적 판단을 기록한다.','28(c)'],
 ['crit13','경영진·지배기구·기타 관련자와 유의적 사안을 논의한 경우 그 성격·논의 시기·상대자 등 논의 내용을 문서화함','경영진, 지배기구 또는 기타 관련자와 유의적 사안을 논의한 경우, 사안의 성격과 논의 시기 및 상대자 등 논의 내용을 문서화한다.','29'],
 ['crit14','취합 완료 후 기존 문서 수정 또는 새 문서 추가가 필요한 경우 그 성격과 관계없이 구체적 이유를 문서화함','최종감사파일 취합 후 기존 문서의 수정이나 새 문서의 추가가 필요한 경우, 그 성격과 관계없이 수정하거나 추가하는 구체적 이유를 문서화한다.','31(a)'],
 ['crit15','취합 완료 후 문서를 수정·추가한 사람과 검토한 사람 및 각각의 시기를 문서화함','최종감사파일 취합 후 문서를 수정·추가한 사람과 검토한 사람 및 각각의 시기를 문서화한다.','31(b)']
];
for(const [id,claim,answer,paragraph]of extra){q.criteria.push({id,requirement_id:r.id,claim,critical_facts:[{id:`cf${id.slice(4)}`,type:'action',expected:claim}],max_points:1,scores:{met:1,not_met:0,contradicted:0},source_ref_ids:[r.source_ref_id]});q.model_answer.push(answer);}
q.criteria[3].critical_facts[0].expected='감사보고서일 이후 적시에 최종감사파일 취합 행정절차 완료. 정해진 일수는 요구하지 않으며 감사계약일 등 다른 기산점을 명시하면 불인정';
q.criteria[4].critical_facts[0].expected='최종감사파일 취합 완료 후 보존기간 종료 전 감사문서 삭제·폐기 금지. 수정·추가의 조건부 허용과 구별';
d.title='소규모기업 감사보고서의 준수 표명 제한과 일반 감사기준서 선택 적용';
ref=src(d,'src1','compliance','4',910);r=req(d.subquestions[0],'req1',ref,'4',910);d.subquestions[0].criteria.forEach(x=>bind(x,r));
d.subquestions[0].prompt='KGA 1200을 적용해 감사를 수행한 경우, 감사보고서에 ① 회계감사기준 전체를 준수하였다고 기술하는 것과 ② 일반 감사기준서 또는 그 일부를 언급하는 것이 허용되는지 각각 판단하시오.';
d.subquestions[0].criteria[1].claim='감사보고서에서 일반 감사기준서 또는 그 일부를 언급하는 것도 금지됨을 판단함';
d.subquestions[0].model_answer=['회계감사기준 전체를 준수하였다고 기술해서는 안 된다.','일반 감사기준서 또는 그 일부를 언급해서도 안 된다.'];
ref=src(d,'src2','choice','5',910);r=req(d.subquestions[1],'req2',ref,'5',910);d.subquestions[1].criteria.forEach(x=>bind(x,r));
d.subquestions[1].model_answer=['감사대상 기업과 서면으로 합의해야 한다.','KGA 1200 대신 일반 감사기준서를 대체 적용한다.'];
d.subquestions[1].criteria[1].critical_facts[0].expected='KGA 1200 대신 일반 감사기준서를 대체 적용. 두 기준에서 일부 조항씩 선택하여 혼용하는 방식은 불인정';
for(const s of sets)s.verification.notes.push('2026-09-08 주제18 검토: 공식 2025 전문의 직접 인용·문단·SHA-256 정비. 대상 명제는 2026 개정 전문과 동일. 기존 게시/검수 상태는 유지하며 2027 최종 시험 판본 확정과 구별. 상세 변경·평가 결과: docs/reports/question-review-2027/18.md.');
fs.writeFileSync(path,JSON.stringify(bank,null,2)+'\n');
fs.writeFileSync(`${dir}/18-edit-ledger.json`,JSON.stringify({at:new Date().toISOString(),before,after:sets,additional_documentation_criteria:extra.map(([id,claim,answer,paragraph])=>({id,paragraph,claim})),before_count:20,after_count:27},null,2)+'\n');
console.log('topic18 updated: 4 sets / 8 questions / 27 criteria');
