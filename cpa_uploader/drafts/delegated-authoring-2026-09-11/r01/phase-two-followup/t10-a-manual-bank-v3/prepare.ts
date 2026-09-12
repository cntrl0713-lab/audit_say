// All ten units and forty cases compared locally; unsigned proposal only.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareSemanticReview,createManualReviewTemplate} from '../../../../../../cpa_uploader/questionSemanticReview.ts';
const dir=path.dirname(fileURLToPath(import.meta.url)),control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8')),sha=(f:string)=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=(file:string)=>({file,sha256:sha(file)});
const lockFile=control+'/runtime-v5-bank-v3-plan-followup-02/runtime-lock.json',lock=read(lockFile),manifest=read(lock.manifest_file),entry=manifest.entries.find((e:any)=>e.plan_id==='T10-A');
for(const r of [lock.comparison_bank,...lock.code_files,...lock.source_files,{file:entry.file,sha256:entry.sha256},...entry.plan_files])if(sha(r.file)!==r.sha256)throw Error('Frozen input changed');
const set=read(entry.file),plan=read(entry.plan_files[0].file).plans.find((p:any)=>p.set_id===set.id),bank=read(lock.comparison_bank.file),semanticFile=path.join(entry.output_directory,'phase-two-v5',entry.set_id,'semantic-v5-bank-v3-root-01-1/review/semantic.json'),source=read(semanticFile).reviews[0];
const gradingFile=path.join(entry.output_directory,'phase-two-v5/t10-a/generated-bank-v3-refill02-01/failure-evidence.json'),grading=read(gradingFile);
if(grading.failed.length!==1||grading.failed[0].observations.length!==3)throw Error('Need three observed repetitions');
const prepared=prepareSemanticReview(set,{bank:[...bank.filter((s:any)=>s.id!==set.id),set],authoringPlan:plan,maxInputChars:500000}),template=createManualReviewTemplate(prepared),review=structuredClone(template);
for(const key of ['content_hash','context_hash','bank_hash'])if((template as any)[key]!==source[key])throw Error('Original/current identity differs');
const sourceEvidence=set.source_refs.map((r:any)=>{const t=fs.readFileSync(r.file,'utf8'),i=t.indexOf(r.source_quote);if(i<0)throw Error('Quote absent');return{...r,file_sha256:sha(r.file),actual_start:t.slice(0,i).split('\n').length,actual_end:t.slice(0,i+r.source_quote.length-1).split('\n').length,declared_spans:set.subquestions.flatMap((q:any)=>q.requirements).filter((x:any)=>x.source_ref_id===r.id).map((x:any)=>x.source_span)};});
const rows=bank.flatMap((s:any)=>s.id===set.id?[]:s.subquestions.map((q:any)=>({set_id:s.id,subquestion_id:q.id,prompt:q.prompt,criteria:q.criteria.map((c:any)=>({id:c.id,claim:c.claim}))}))); 
const compared=rows.filter((q:any)=>/표본규모|표본.*확신|확신.*표본|통제.*의존/.test(q.prompt+' '+q.criteria.map((c:any)=>c.claim).join(' ')));
const unitReasons:Record<string,string>={
 'subquestion:q1':'다른 사항이 같다는 지문 조건 아래 통제의존 증가 및 요구확신수준 증가라는 독립 두 상황의 표본규모 방향과 이유를 각각 묻는다. 530 보론2 항목1·4가 각각 증가와 해당 확신 이유를 지지한다. 주어진 변화 자체가 아니라 결과와 이유가 배점이다. 330의 통제테스트 필요 여부·증거 설득력과 개념이 이어지지만 그 필요 여부를 다시 점수화하지 않는다.',
 'criterion:q1:q1.c1':'통제의존 증가 시 표본규모 증가라는 방향 하나이다. src1의 증가 열과 설명이 지지한다. c2의 운영효과성 확신 이유는 별개이고 이유만 제시해 방향을 답했다고 자동 채점하지 않는다.',
 'criterion:q1:q1.c2':'통제를 더 믿고 위험을 낮게 평가하려면 운영효과성에 더 많은 확신이 필요하다는 이유이다. 통제테스트 필요 여부 자체 또는 단순 증가 결론과 다르다. 기존07-004/sub2의 증거 설득력은 상위 개념이며 현 계획도 그 연결을 밝힌다.',
 'criterion:q1:q1.c3':'실제 이탈률이 허용이탈률을 넘지 않는다는 확신 요구가 증가한 상황의 표본규모 증가이다. 항목1의 통제의존 조건과 다른 요소이며 이유 c4와 구별한다.',
 'criterion:q1:q1.c4':'표본결과가 모집단 실제 이탈을 나타낸다는 더 높은 확신 요구가 이유이다. src2의 보론2 항목4가 이를 직접 지지한다. 허용이탈률의 크기 자체가 바뀌는 것과는 다른 조건이다.',
 'subquestion:q2':'동일 경영진주장에 관한 다른 실증절차 의존 증가와 예상왜곡표시금액 증가를 구별한다. 전자는 표본감사에서 필요한 확신수준이 낮아져 표본규모가 감소할 수 있고, 후자는 실제 왜곡표시금액의 합리적 추정을 위해 증가한다. q1의 통제테스트 방향과 동일 대상의 이중 배점이 아니다.',
 'criterion:q2:q2.c1':'같은 경영진주장에 대한 다른 실증절차를 더 적용하고 더 의존한다는 조건에서 감소할 수 있다는 방향을 평가한다. src3의 조건과 가능 표현을 보존하고 무조건적 모든 절차 증가로 확대하지 않는다.',
 'criterion:q2:q2.c2':'다른 실증절차 의존 증가가 표본감사에서 확보해야 할 확신수준을 낮춘다는 이유이다. 같은 경영진주장이라는 적용 대상이 중요하다. c1의 표본규모 감소 방향만 쓰면 이유를 자동으로 충족하지 않는다.',
 'criterion:q2:q2.c3':'예상왜곡표시금액 증가에 따른 세부테스트 표본규모 증가 방향이다. src4의 증가 열과 설명이 지지한다. 추정 목적 c4가 정확해도 감소 방향이면 c3 반대이다.',
 'criterion:q2:q2.c4':'예상왜곡표시금액이 더 큰 모집단의 실제 왜곡표시금액을 합리적으로 추정한다는 이유이다. src4가 지지하고 c3의 방향과 독립된다. 방향을 반대로 적었어도 이 이유 자체를 정확히 제시한 경우 c4까지 반대로 만들지 않는다.'
};
const reasons=[
 '전체 모범답안에①증가 방향이 있어 met.', '더 많이 선정한다는 말은 표본규모 증가와 동등하다.', '더 많은 확신이라는 이유만 있어 방향 명제는 not_met.', '통제의존 증가에 감소라고 하여 방향의 반대다.', '의존도 감소라는 다른 전제에만 답해 원 증가상황의 방향은 not_met.',
 '전체 모범답안에 통제의존·낮은 위험평가·운영효과성 확신 필요의 이유가 있다.', '통제 운영효과성 확신을 더 확보한다는 이유와 위험평가 연결을 보존한다.', '표본규모 증가만 있어 요구한 확신 이유는 없다.', '추가 확신이 필요 없다고 하여 해당 이유를 명시 부정한다.', '위험평가에서 운영효과성에 의존하는 상황을 제거한 가상조건이므로 원 이유를 답하지 않는다. 형식적 절차배분을 실제 통제의존으로 일반화하지 않는다.',
 '전체 모범답안에②증가 방향이 있다.', '더 높은 확신에 표본수를 늘린다고 하여 방향을 충족한다.', '확신 요구의 변화라는 전제만 반복하고 표본규모 영향은 쓰지 않았다.', '요구확신 증가에 감소 방향을 적어 반대다.', '확신 요구가 낮아진 다른 상황만 다루어 원 증가상황의 방향을 답하지 않는다.',
 '전체 모범답안에 모집단 실제 이탈을 나타낸다는 더 높은 확신 이유가 있다.', '표본결과의 실제 이탈률 대표성에 관한 더 높은 확신이라는 동등한 이유다.', '②증가 결론만 적어 확신 이유는 없다.', '요구확신수준이 낮아진다는 이유를 들어 주어진 더 높은 확신 이유와 반대다.', '요구확신 증가가 없고 허용이탈률만 바뀐 다른 조건을 다루어 원 이유를 답하지 않는다.',
 '전체 모범답안에 감소할 수 있다는 방향과 동일 주장 조건이 있다.', '같은 주장에 다른 실증절차 의존을 높여 표본을 줄일 수 있다는 의미를 보존한다.', '표본감사 확신수준 감소라는 이유만 적어 표본규모의 방향은 없다.', '다른 실증절차 의존 증가에 표본규모 증가라고 하여 방향이 반대다.', '같은 경영진주장이라는 조건이 없는 별도 상황에 대한 답이므로 원 조건의 감소 방향을 충족하지 않는다.',
 '전체 모범답안에 표본감사에서 얻어야 할 확신수준 감소의 이유가 있다.', '같은 주장에서 다른 절차 의존으로 표본감사 확신이 낮아진다고 명시한다.', '표본규모 감소 결과만 적고 요구확신 변화 이유는 없다.', '다른 절차에 더 의존할수록 표본감사 요구확신이 높다고 하여 이유가 반대다.', '같은 주장에 대한 의존 증가 조건을 없앴으므로 원 감소 이유의 답은 아니다.',
 '전체 모범답안에②표본규모 증가가 있다.', '예상금액 증가에 더 많이 추출한다는 방향을 보존한다.', '합리적으로 추정해야 한다는 이유만 있어 표본규모 방향은 없다.', '예상왜곡표시금액 증가에 감소 방향을 제시하여 반대다.', '예상금액 감소라는 다른 상황을 다루므로 원 증가상황의 방향을 충족하지 않는다.',
 '전체 모범답안에 실제 왜곡표시금액의 합리적 추정 목적이 있다.', '더 큰 예상금액의 실제 왜곡표시를 합리적으로 추정한다는 목적을 보존한다.', '예상금액 증가와 표본규모 증가만 적고 추정 이유는 없다.', '추정 목적은 정확하므로 c4 met으로 정정한다. 감소 방향은 c3 contradicted다. 원 valid 1점 답안은 그대로 보존한다. 다만 이것은 c4 자체의 opposite가 아니므로 종류 역할은 아직 uncertain이다.', '예상금액 증가 조건을 없앤 가상상황에만 답한다. 실제 문제의 더 큰 예상금액에서 추정 목적을 부정한 것으로 확대하지 않고 not_met을 유지한다.'
];
if(source.units.length!==10||source.cases.length!==40||reasons.length!==40)throw Error('Incomplete comparison');
review.units=review.units.map((u:any)=>{const old=source.units.find((x:any)=>x.id===u.id);if(!unitReasons[u.id])throw Error('Unexamined unit');return{...u,checks:{alignment:'pass',source_support:'pass',conditions_exceptions:'pass',edition_scope:'pass',nonduplication:'pass'},rationale:unitReasons[u.id]+' 2026년 개시 보고기간에2025전문을 적용하는 명시적 계획가정을 검토했으며 시험당국의 판본 지정으로 확대하지 않는다. 공식 파일의 실제 인용행이 선언 보론·쪽수 범위에 있음을 확인했다.',source_quotes:old.source_quotes};});
review.cases=source.cases.map((c:any,i:number)=>({...c,expected:i===38?'met':c.expected,verdict:i===38?'uncertain':'pass',rationale:reasons[i]}));
review.notes=['모든10단위·40사례·4공식 인용과 현재 은행의 관련11개 발문/criterion을 작성자 에이전트가 직접 대조한 미확정 제안이다. 사람 확인이나 신규 모델 검수는 아니다.','원40답안을 유지한다. q2.c4/opposite 원 기대contra는met으로 정정 제안하지만, target 자체의 반대 종류가 아니므로 실제 반대 사례를 별도로 추가해야 한다. 현재 전체pass로 확정하지 않는다.'];
const comparisonReasons={ 'pilot-07-002':'통제테스트가 요구되는 경우이며 표본규모 변화의 결과가 아니다.','pilot-07-003':'이탈 발견 후 질문 및 추가절차 결정으로 네 표본규모 요인과 다르다.','pilot-07-004':'sub1은 필요조건,sub2는 의존 증가와 증거 설득력의 상위 관계이다. 새 물음은 구체 표본규모 방향/이유를 묻고 현 계획이 그 연결을 명시한다.','pilot-07-006':'전기증거 재사용·당기테스트·잔여기간 증거결정 요소로서 네 표본규모 요인의 방향/이유와 다르다.','pilot-07-008':'통제의존 근거 약화 후 외부조회 시기/범위 대응이며 네 독립 표본요소 변화의 직접 요구가 아니다.','pilot-10-001':'계층화로 변동성이 줄어 표본규모가 줄어드는 별도 요인이다.','pilot-10-004':'표본위험 정의와 수용가능한 수준까지 낮추는 일반 설계 원칙이다. 네 구체 변화와 이유를 모두 요구하지 않는다.','pilot-11-004':'추정치 유의적 위험에서 실증전용 접근 및 통제테스트의 포함·기간으로 표본규모 방향/이유와 다르다.'};
for(const row of compared)if(!(row.set_id in comparisonReasons))throw Error('Unexamined related peer '+row.set_id);
fs.writeFileSync(path.join(dir,'manual-template.json'),JSON.stringify({schema_version:1,reviews:[template]},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(dir,'manual-input-proposal.json'),JSON.stringify({schema_version:1,reviews:[review]},null,2)+'\n',{flag:'wx'});
const proof={recorded_at:new Date().toISOString(),api_calls:0,finalized:false,human_reviewed:false,runtime_lock:ref(lockFile),manifest:ref(lock.manifest_file),question:ref(entry.file),plan:ref(entry.plan_files[0].file),bank:ref(lock.comparison_bank.file),model_receipt:ref(semanticFile),actual_grading:ref(gradingFile),source_evidence:sourceEvidence,bank_scan:{all_prompt_claim_rows:rows.length,selected:compared.length,rows:compared.map((q:any)=>({...q,comparison_reason:(comparisonReasons as any)[q.set_id]}))},units:review.units,cases:review.cases.map((c:any,i:number)=>({index:i,unit_id:c.unit_id,kind:c.kind,answer:c.answer,answer_unchanged:c.answer===source.cases[i].answer,before:source.cases[i].expected,after:c.expected,verdict:c.verdict,rationale:c.rationale})),remaining:'q2.c4의 실제 opposite 추가. 원1점답안/3회실측은 그 자체로 보존하여 후속 expectation overlay와 연결.',original_receipts_and_question_unchanged:true};
fs.writeFileSync(path.join(dir,'full-comparison-and-lineage.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({units:10,cases:40,sources:4,peers:compared.length,expected_changes:1,original_answers_preserved:true,unresolved_kind:1,api_calls:0}));
