// Prepare an unsigned, fully examined manual-input proposal; never finalize or grade.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const folder=path.dirname(fileURLToPath(import.meta.url));
const root='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const files={template:path.join(folder,'manual-template.json'),model:root+'phase-two-v5/draft-09-501-freq01/semantic-cohort-v5-01-1/review/semantic.json',grading:root+'phase-two-v5/t09-a/generated5-01/failure-evidence.json',question:root+'draft-09-501-freq01.json',plan:root+'draft-09-501-freq01.json.authoring-plan.json',bank:control+'/final-153-v2/comparison-bank.json',runtime:control+'/runtime-v5-stable/runtime-lock.json'};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const source=read(files.model).reviews[0],template=read(files.template),draft=read(files.question),bank=read(files.bank),observed=read(files.grading),proposal=structuredClone(template),review=proposal.reviews[0];
if(observed.failed.length!==3||observed.failed.some(c=>c.observations.length!==3))throw Error('Three observed repetitions required first');
for(const field of ['set_id','content_hash','bank_hash','context_hash'])if(review[field]!==source[field])throw Error('Template/source identity mismatch '+field);
if(JSON.stringify(review.source_files)!==JSON.stringify(source.source_files))throw Error('Source identity mismatch');
const quoteByRef=Object.fromEntries(draft.source_refs.map(ref=>[ref.id,ref.source_quote]));
const sourceEvidence=draft.source_refs.map(ref=>{
 const body=fs.readFileSync(ref.file,'utf8'),index=body.indexOf(ref.source_quote);if(index<0)throw Error('Source quote absent');
 const start=body.slice(0,index).split(/\r?\n/).length,end=start+ref.source_quote.split(/\r?\n/).length-1;
 return{source_ref_id:ref.id,file:ref.file,sha256:sha(ref.file),title:ref.title,quote:ref.source_quote,actual_quote_lines:{start,end},requirement_locator:draft.subquestions.flatMap(q=>q.requirements).find(r=>r.source_ref_id===ref.id).source_span};
});
const commonEdition='2027 CPA 대비라는 목표와 사례에 지정한 2026-01-01 개시 보고기간을 구별한다. 원 계획의 2025 전문 선택 및 2026 전문 대조 기록 범위에서 검토했으며 향후 시험의 공식 판본 지정으로 확대하지 않는다.';
const unitAnalysis={
 'subquestion:q1':'501.5의 실사일과 재무제표일 사이 재고변동의 적절한 기록에 관한 추가 절차를 묻는다. 지문 f1의 11/30~12/31이 대상 기간이다. f2가 입회절차와 최종 재고기록 검사를 별도로 계획했다고 정하고 발문은 날짜가 다름에 따른 추가사항으로 한정했으므로 501.4 전체를 재열거시키지 않는다. q1의 목적·조치와 기간은 하나의 구체 절차 명제를 완성하는 범위이다. 09-002/sub1의 입회 중 네 절차 및 09-006의 입회불능 대응과 요구가 다르고, 09-010/sub2.crit6의 기초수량 역산과도 대상 기간·감사목적이 다르다.',
 'criterion:q1:q1.c1':'501.5 원문과 claim·모범답안은 실사일에서 재무제표일까지 변동이 적절히 기록됐는지 증거를 얻는 절차로 일치한다. 기간만 옮겨 쓰는 답은 지문 재진술이며 scope가 목적·조치를 요구한다. q2의 통제 효과성 측면 열거와 같은 득점 대상이 아니다. 09-010의 기초잔액 수량 조정과 기록 대조 방법은 인접하지만 기초로 역산하는 요구를 이 명제로 집계하지 않는다.',
 'subquestion:q2':'501.A9는 다른 날짜 실사의 감사목적 적합성에 영향을 주는 재고변동 통제의 설계·실행·유지 효과성을 구별하고 두 기록방식 모두에 적용한다고 한다. 발문도 세 측면과 기록방식 적용 여부를 따로 요구하여 c1~c3과 c4의 네 독립 명제가 정당하다. 일반적인 통제 설계·실행 이해를 묻는 06-003/sub2 및 06-006/007/sub3과 개념은 일부 공유하나 이 문항의 재고변동 통제·다른 실사일 적합성·두 기록방식의 요구는 다르다.',
 'criterion:q2:q2.c1':'A9의 설계 효과성을 고려하는 측면을 평가한다. 실행·유지 및 기록방식 적용 범위는 별도 c2/c3/c4에서 평가한다. 설계의 효과성 자체를 무관하다며 부정한 답과, 설계 효과성을 인정하면서 적용 기록방식만 틀린 답은 다르다. 후자는 c1 충족·c4 반대이며 같은 범위 오류를 c1에 다시 전파하지 않는다.',
 'criterion:q2:q2.c2':'A9의 실행 효과성이라는 독립 측면을 평가한다. 실제로 효과적으로 운영되는지 평가한다는 표현은 실행의 효과성을 전달한다. 이 표현만으로 시간에 걸친 유지(c3)나 두 기록방식 적용(c4)을 자동 인정하지 않는다. 특정 기록방식에서만 실행 효과성을 고려한다는 답은 측면을 제시하고 적용 범위를 잘못 쓴 것이므로 c2 충족·c4 반대로 나눈다.',
 'criterion:q2:q2.c3':'A9의 유지 효과성을 고려하는 측면을 평가한다. 계속 효과적으로 유지되는지 평가한다는 답은 이 명제를 충족한다. 설계·실행만 적으면 유지가 함축되지 않는다. 유지 효과성 자체를 고려하지 않는다는 반대와, 유지 효과성을 제시하면서 기록방식 적용 범위를 잘못 한정한 c4 반대는 구별한다.',
 'criterion:q2:q2.c4':'A9의 실사에 의한 수량 결정과 계속기록법 유지의 어느 경우이든 적용됨을 평가한다. 설계·실행·유지의 정확한 열거만으로 두 기록방식의 적용 판단을 자동 인정하지 않는다. 한 방식에만 적용된다는 명시적 한정은 c4의 반대이다. 이 명제는 c1~c3과 달리 적용 대상 범위를 묻는다.'
};
const caseReasons=[
 '두 날짜와 그 사이 변동의 적절한 기록을 검증하는 절차·목적을 모두 제시하여 q1.c1을 충족한다. 날짜 사실 자체를 별도로 득점시키지 않는다.',
 '올바르게 반영되었는지 검증한다는 문구는 적절한 기록 여부의 감사증거를 얻는 추가 절차와 동등하다. 11/30~12/31의 범위도 보존한다.',
 '재고변동을 검토한다는 일반 표현에는 기록의 적절성을 확인하는 목적·대상이 드러나지 않는다. q1.c1.scope가 기간 반복만으로 인정하지 않으므로 not_met이다. 기록 대조를 분명히 함축하는 구체 절차가 있는 답까지 이 사례와 같다고 보지 않는다.',
 '이 답은 기록 적절성 여부를 열린 상태에서 확인하는 것이 아니라, 미기록 사실을 미리 참이라고 전제하고 그 사실만 입증하려 한다. 따라서 여부에 관한 증거를 얻는 명제를 반대로 바꾼 것으로 본다. 실제 감사에서 부적절한 기록을 발견하거나 의심에 따라 조사하는 정상 답안을 이 반대로 확대하지 않는다.',
 '서로 다른 두 날짜라는 실제 사례 조건을 없앤 가상 상황에만 답했으므로 원 q1.c1 요구를 충족하지 않는다. 두 날짜가 다르면서 추가 절차가 불필요하다고 명시한 반대와는 다르다.',
 '전체 모범답안에서 설계의 효과성 고려가 명시되어 c1을 충족한다. 다른 세 명제도 같은 전체 답안 안에 있으나 이 사례의 target은 c1이다.',
 '감사목적 적합성 판단을 위해 재고변동 통제의 효과적 설계를 평가한다는 표현은 c1과 일치한다.',
 '실행·유지 효과성은 있으나 설계의 효과성에 관한 요구가 없어 c1 not_met이다. 다른 측면에 관한 정답을 설계까지 자동 확장하지 않는다.',
 '설계의 효과성이 적합성 판단과 무관하여 고려하지 않는다고 명시하여 c1 자체에 반대한다.',
 '설계 효과성을 고려한다는 측면은 정확히 제시되어 c1 met이다. 계속기록법에만 한정한 적용 범위는 별도 c4 contradicted로 평가한다. 원 답안은 그대로 유지하고 원 모델의 target contra 기대만 이 독립 대상 구분에 맞춰 정정 제안한다.',
 '전체 모범답안은 실행 효과성 고려를 명시하므로 c2 met이다. 다른 독립 명제도 포함되어 있지만 이 target 판단과 구별한다.',
 '재고변동 통제가 실제로 효과적으로 운영되는지를 평가한다는 표현은 실행의 효과성 고려를 전달하므로 c2 met이다. 별도로 유지 및 두 기록방식의 적용까지 답했다고 가정하지 않는다.',
 '설계와 유지 및 적용 범위는 적었지만 실행의 효과성을 제시하지 않았으므로 c2 not_met이다.',
 '실행 효과성을 고려하지 않는다는 무조건적 부정이므로 c2 contradicted이다.',
 '통제 실행 효과성을 고려한다는 측면을 제시하므로 c2 met이다. 계속기록법을 적용 범위에서 제외하는 주장은 별도 c4 contradicted이며, 적용 범위 오류를 실행 측면 점수에서 다시 차감하지 않는다. 원 답안을 바꾸지 않는다.',
 '전체 모범답안에 재고변동 통제의 유지 효과성 고려가 있어 c3 met이다.',
 '계속 효과적으로 유지되고 있는지를 평가한다는 표현은 유지의 효과성과 동등하여 c3 met이다.',
 '설계와 실행은 적었지만 유지 효과성에 관한 명제가 없어 c3 not_met이다.',
 '통제가 효과적으로 유지되는지 고려할 필요가 없다고 하여 c3 자체에 명시적으로 반대한다.',
 '유지의 효과성을 고려한다는 측면은 제시되어 c3 met이다. 실사에 의한 수량결정을 제외한 기록방식 적용 제한은 별도 c4 contradicted이다. 원 답안과 그 안의 잘못된 적용 제한도 보존한다.',
 '전체 모범답안에서 두 기록방식 모두에 적용된다고 명시하여 c4 met이다.',
 '실사에 의한 수량결정과 계속기록법의 어느 방식이든 관계없다는 표현은 c4의 양쪽 적용을 보존한다.',
 '재고변동 통제의 세 효과성 측면은 제시했지만 두 기록방식의 적용 범위를 쓰지 않아 c4 not_met이다. 세 측면과 적용 범위가 독립 요구임을 확인하는 대조 사례이다.',
 '계속기록법만 적용되고 실사에 의한 수량결정에는 적용되지 않는다고 하여 c4 contradicted이다.',
 '실사에 의한 수량결정에는 적용하고 계속기록법에는 적용하지 않는다고 명시하여 c4 contradicted이다. 다른 방식만 제외했어도 두 방식 모두라는 명제를 부정한다.'
];
if(source.units.length!==7||source.cases.length!==25||caseReasons.length!==25)throw Error('Complete review coverage shape');
review.units=review.units.map(unit=>{const ref=unit.id.includes('q1')?'src1':'src2';if(!unitAnalysis[unit.id])throw Error('Unexamined unit');return{...unit,checks:{alignment:'pass',source_support:'pass',conditions_exceptions:'pass',edition_scope:'pass',nonduplication:'pass'},rationale:unitAnalysis[unit.id]+' '+commonEdition,source_quotes:[{source_ref_id:ref,quote:quoteByRef[ref]}]};});
const modified=new Set([9,14,19]);
review.cases=source.cases.map((sample,index)=>({...sample,expected:modified.has(index)?'met':sample.expected,verdict:'pass',rationale:caseReasons[index],source_quotes:[{source_ref_id:index<5?'src1':'src2',quote:quoteByRef[index<5?'src1':'src2']}]}));
review.notes=['이 문서는 전체 7단위·25사례를 직접 대조하여 작성한 미확정 manual-input 제안이다. 실행 상태는 template이며 manual-input 확정과 재채점은 아직 수행하지 않았다.','원 모델 receipt '+files.model+' (SHA '+sha(files.model)+')와 실제 생성 QA '+files.grading+'의 3회 기록을 보존한다.','원 답안 25개와 unit_id/kind는 모두 유지했다. q2.c1/c2/c3 condition_boundary의 target 기대만 contra→met으로 제안하며 그 답안의 적용 범위 오류는 c4 반대로 그대로 남긴다.','작성자 에이전트의 원문 대조이며 독립된 사람 검수 또는 신규 모델 호출로 표시하지 않는다. 총괄이 전체 대조를 읽은 뒤 별도 manual-input 확정 및 실제 재채점을 판단한다.'];
const rows=bank.flatMap(s=>s.id===draft.id?[]:s.subquestions.map(q=>({set_id:s.id,subquestion_id:q.id,prompt:q.prompt,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim}))})));
const compared=rows.filter(q=>/재고|실사|계속기록|통제.*설계.*실행|기중.*실증/.test(q.prompt+' '+q.criteria.map(c=>c.claim).join(' ')));
const proof={recorded_at:new Date().toISOString(),api_calls:0,finalized:false,human_reviewed:false,source_files:Object.fromEntries(Object.entries(files).map(([k,file])=>[k,{file,sha256:sha(file)}])),source_evidence:sourceEvidence,bank_scope:{sets:bank.length,all_prompt_and_claim_rows_scanned:rows.length,selected_rows_directly_read:compared.length,selection_rule:'재고/실사/계속기록, 통제 설계·실행, 기중 실증의 발문 및 claim 검색 후 실제 요구 대조; 어휘 미일치만으로 무중복 확정하지 않음',compared_rows:compared},units:review.units.map(u=>({id:u.id,rationale:u.rationale,checks:u.checks})),cases:review.cases.map((c,i)=>({index:i,unit_id:c.unit_id,kind:c.kind,original_answer:source.cases[i].answer,proposed_answer:c.answer,answer_unchanged:c.answer===source.cases[i].answer,before:source.cases[i].expected,after:c.expected,changed:modified.has(i),rationale:c.rationale})),proposal_contract:{execution_method:review.execution.method,overall_verdict:review.verdict,original_template_receipt_hash_kept:review.receipt_hash===template.reviews[0].receipt_hash,description:'직접 대조를 마친 입력 제안이지만 미확정 template이다. receipt_hash를 임의 갱신하지 않았다. --manual-input 확정 시 도구가 검증하고 새 manual_reasoned receipt를 생성해야 한다.'}};
fs.writeFileSync(path.join(folder,'manual-input-proposal.json'),JSON.stringify(proposal,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(folder,'full-comparison-and-lineage.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({units:review.units.length,cases:review.cases.length,answers_preserved:proof.cases.every(c=>c.answer_unchanged),expected_changes:proof.cases.filter(c=>c.changed).map(c=>({index:c.index,before:c.before,after:c.after})),comparison_rows:compared.length,source_quotes:sourceEvidence.map(s=>s.actual_quote_lines),finalized:false,api_calls:0}));
