import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateQuestionSetV3} from '../../../../lib/questionV3.ts';
import {validateAuthoringBank} from '../../../questionBankPublication.ts';
import {validateQuestionAuthoringPlan} from '../../../questionAuthoringPlan.ts';
import {validateQaBank} from './helpers/representative-qa.mjs';
const R='cpa_uploader/analysis/reviews/case-trio-2026-09-14',D='cpa_uploader/drafts/case-trio-2026-09-14',C=D+'/c';
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ref=file=>({file,sha256:hash(fs.readFileSync(file))});
const set=read(C+'/sets.json')[0],bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),design=read(C+'/design.json')[0],qa=read(C+'/qa.json'),boundaries=read(C+'/qa-boundaries.json');
assert.equal(set.id,'case-09-negative-confirmation-conditions-20260914');assert.equal(set.verification.source_fidelity,'reconstructed');
assert.equal(set.subquestions.length,3);assert.equal([...set.shared_context.facts.map(f=>f.text).join('\n')].length,1012);
assert.deepEqual(validateQuestionSetV3(set,{cwd:process.cwd(),verifySourceQuotes:true}).errors,[]);
assert.deepEqual(validateQuestionAuthoringPlan(design.plan),[]);
const bankCheck=validateAuthoringBank([...bank,set]);assert.deepEqual(bankCheck.errors,[]);
const qaScope=validateQaBank([set],qa);assert.equal(qaScope.planned_evaluated_answers,9);assert.equal(boundaries.length,8);
for(const row of [...qa,...boundaries]){
 const question=set.subquestions.find(question=>question.id===row.subquestion_id);assert(question);
 assert.equal(question.criteria.reduce((sum,criterion)=>sum+(row.met_criterion_ids.includes(criterion.id)?criterion.scores.met:criterion.scores.not_met),0),row.expected_points);
}
for(const row of read(C+'/source-files.json'))assert.equal(ref(row.file).sha256,row.sha256);
const text=fs.readFileSync('cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt','utf8').split(/\r?\n/u);
const cut=(first,last)=>text.slice(first-1,last).join('\n'),normalize=value=>value.replace(/\s/gu,'');
const current=[cut(18288,18291),cut(18300,18302),cut(18303,18305),cut(18499,18500)+'\n'+cut(18510,18518)];
const quoteChecks=set.source_refs.map((source,index)=>{
 assert(fs.readFileSync(source.file,'utf8').includes(source.source_quote));assert.equal(hash(source.source_quote),source.content_hash);assert.equal(normalize(source.source_quote),normalize(current[index]));
 return {id:source.id,file:source.file,quote_sha256:source.content_hash,registered_bytes_exact:true,official_2026_complete_passage_whitespace_equal:true,official_locator:source.title};
});
assert(design.source_locations[1].lines.includes('14963'));assert(design.source_locations[0].scope.includes('11074'));
const catalog=read(D+'/source-catalog.json'),proposal=read(C+'/coverage-proposals.json')[0],element=read('cpa_uploader/analysis/question-elements/question-elements.json').elements.find(element=>element.id===proposal.element_id);
assert.deepEqual(proposal.criterion_ids,['sub1.c2']);assert.equal(proposal.relationship,'partial');assert.equal(element.mock_frequency,1);assert.equal(element.exam_frequency,0);
const source=set.source_refs.find(source=>source.id==='src50515a'),unit=catalog.units.find(unit=>unit.id===proposal.source_unit_ids[0]);assert.equal(unit.file,source.file);assert(normalize(unit.quote).includes(normalize(source.source_quote)));
const questions=[
 {subquestion_id:'sub1',facts:['fact1','fact2'],criteria:['sub1.c1','sub1.c2'],points:2,
  checks:{
   source:'2026 PDF429의 505.15 본문은 네 조건 전부를 요구하고 PDF430의 (a)는 낮은 위험 평가와 관련 통제 운영효과성에 관한 충분하고 적합한 증거를 함께 요구한다. 개인예금 fact2는 전자를 충족하지만 후자는 미입수라고 명시한다.',
   answer:'부적절 판단과 설계·실행의 이해가 운영효과성 증거를 대신하지 못한다는 적용 이유가 정확하다. 다른 세 조건은 사실로 고정되므로 추가 감사절차나 네 요건 전체 목록을 정답에 강제하지 않는다.',
   prompt:'갑의 특정 제안과 현재 통제정보의 수준을 판단·근거 한 쌍으로 묻는다. 일반론 열거 또는 개인예금과 법인예금의 독립 판단을 한 물음에 묶지 않는다.',
   points:'판단 1점과 운영증거 결격 사유 1점이다. 설계/실행/연중이라는 단어를 별도 요소로 분할하지 않는다. 정확한 결격 이유가 단독 사용 불가를 함축하면 별도 결론 문구 없이 2점, 반대 결론을 명시하면 판단만 0점이다.',
   style:'규모·동질성·불일치·무시 조건은 충족된 개인예금에서 운영효과성 증거만 없는 상태를 식별해야 만점이다. 사실 삭제 후 네 조건 일반론만으로는 현재 제안의 판단과 적용 이유를 확정할 수 없다.',
   topics:'주된 득점 요구는 외부조회 505.15(a)의 단독 사용 조건이므로 주제09가 적합하다. 통제증거의 구체적 입수 방법까지 묻지 않아 별도 주제07 점수를 숨겨 넣지 않는다.',
   edition:'2026 전문의 본문·하위(a)~(d)와 각주 귀속을 직접 시각 대조했다. 기존 2025 등록 본문의 인용을 유지하되 2026 확인과 새로운 사례 재구성 fidelity를 구분한 정정이 타당하다.',
   nonduplication:'pilot-09-008/sub2 및 과거 draft-09-505-001/sub2는 일반 조건 열거다. 현재는 다른 조건이 충족된 상황에서 낮은 위험과 운영효과성 증거를 구별하는 적용 연습이므로 의도된 심화이며 새로운 기준 자체가 미출제라고 주장하지 않는다.'},
  qa_review:'모범 2점, 판단만 적은 대표 부분 1점, 설계·실행만으로 운영증거가 충족된다고 명시한 대표 오답 0점. 빈답 0점·결격 근거만 적은 함축판단 2점·반대판단+맞는 근거 1점도 원문과 점수 계약에 맞는다.'},
 {subquestion_id:'sub2',facts:['fact1','fact3'],criteria:['sub2.c1','sub2.c2'],points:2,
  checks:{
   source:'PDF430의 505.15(b)는 다수의 동질적인 소액 계정잔액·거래·조건으로 이루어진 모집단을 요구한다. 다른 세 요건의 충족이 이 요건을 대체하지 않는다는 15 본문과 함께 읽었다.',
   answer:'18개 고액 법인계좌 및 큰 만기·해지·이자조건 차이는 (b)를 충족하지 않는다. 18개가 언제나 소수인지에만 답을 걸지 않고 명백한 고액성 또는 조건의 이질성을 요건과 연결해도 인정하므로 타당하다.',
   prompt:'법인예금에 대한 을의 제안과 모집단 특성만 요구한다. 별도의 개인예금 운영증거 결함을 이 상황에 전이하지 않으며 무관한 네 조건 전체 답을 강제하지 않는다.',
   points:'판단1·독립 결격 근거1의 2점이다. 같은 결격 판단을 만드는 다수/동질/소액 수식어를 세 점으로 기계적 분할하지 않고 구체적 한 결격 특성과 요건 불충족의 연결을 허용한다.',
   style:'사실3의 다른 조건 충족·고액·상이한 계약이 있어야 부족한 요건을 판별한다. 사실 없는 일반적 금지 원칙만으로는 이 제안을 조건부 허용 예외와 구별할 수 없다.',
   topics:'실제 요구는 505.15(b) 외부조회에 한정되며 모집단이라는 단어만으로 표본설계 주제10을 추가하지 않는 것이 적합하다.',
   edition:'2026 PDF430의 완전한 (b)와 앞선 429 본문을 함께 확인했고 quote의 CRLF 등 등록 바이트는 유지했다. 계정잔액/거래/조건은 대상 대안이며 모두 존재해야 한다고 해석하지 않는다.',
   nonduplication:'기존 pilot-09-008/sub2의 일반 목록을 실제 법인예금 결격 판단으로 바꾸었다. 같은 새 사례 sub1의 통제증거 결함과도 요건·사실이 달라 중복 점수가 아니다.'},
  qa_review:'모범2·판단만1·고액/이질성도 낮은 위험으로 대체 가능하다는 오답0. 빈답0, 결격특성과 요건 불충족만 제시한 함축판단2, 명시적 반대판단과 올바른 결격 설명1을 확인했다.'},
 {subquestion_id:'sub3',facts:['fact1','fact4'],criteria:['sub3.c1','sub3.c2'],points:2,
  checks:{
   source:'PDF434 하단에서 시작해435에 이어지는 A23 전체는 무응답으로 수령/정확성 검증을 명시적으로 확인할 수 없고 유리한 금액에는 회신 유인이 낮을 수 있음을 설명한다. 예금 과대표시에 소극적 조회가 효과적이지 않을 수 있다는 직접 예시까지 대조했다.',
   answer:'전자열람이 확인된 이 사례에서는 수령 미확인을 이유로 들지 않고 정확성 검증 미확인만 적용한다. 예금주에게 유리한 과대표시가 회신을 덜 하게 하므로 과대표시 탐색의 무응답 증거가 약하다는 두번째 이유의 방향도 정확하다.',
   prompt:'어려운 이유 두 축을 열람 사실과 예금주 이해관계에 연결하도록 명시한다. 결론 자체는 발문에 제공되었으므로 판단 점수를 다시 배정하지 않았으며 별도 감사의견이나 추가 절차까지 묻지 않는다.',
   points:'정확성 검증의 한계1·해당 과대표시/회신유인의 한계1로 양방향 독립 부분점수가 가능하다. 단순히 소극적 조회는 신뢰성이 낮다는 반복은 두 근거의 득점 요건을 충족하지 않는다.',
   style:'수령 불확실성이 이미 제거되었다는 사실과 예금주에게 유리한 과대표시라는 방향을 해석해야 한다. 기존 수령/검증 한계 일반론을 그대로 복사하면 수령 부분이 사실과 충돌하고 유인 이유가 빠진다.',
   topics:'505.A23의 외부조회 증거평가이므로 주제09다. 예금부채의 금액 계산이나 금융규제 적용을 요구하지 않는다.',
   edition:'A23의 434→435 페이지 경계를 모두 읽었다. 434의 각주20·21은A19,22는A21이고 435의23은A25이므로 A23이나 이 물음의 득점 요건에 합치지 않는다.',
   nonduplication:'std-points-20260914-f5d37b0c8b8a/subq2는 적극적 회신과 비교 및 수령/검증 일반적 한계를 묻는다. 새 문항은 수령을 확인한 후 남는 검증 한계와 예금주 유인·과대표시 목적을 적용하므로 사실 의존성이 추가되었다.'},
  qa_review:'모범2, 정확성 검증 한계만 적은 대표부분1, 검증·회신유인을 모두 반대로 한 대표오답0, 빈답0 및 예금주 유인만 적은 다른 절반1이 타당하다.'}
];
const compared=[
 {file:'cpa_uploader/data/cpa_question_sets_v3.authoring.json',set_ids:['pilot-09-008','std-points-20260914-f5d37b0c8b8a'],reason:'현재 은행369세트546물음에서 소극적조회·negative confirmation·회신유인 검색으로3물음을 찾아 실제 발문·정답·criterion을 대조했다.'},
 {file:'cpa_uploader/drafts/frequency-gap-2026-09-10/draft-09-505-001.json',set_ids:['draft-09-505-001'],reason:'은행 ID에 없다고 미검토로 넘기지 않고 사실 없는 일반조건 초안을 읽었다. 현 pilot-09-008의 이전 작성 형태이며 새 사실 적용과 다르다.'},
 {file:'cpa_uploader/drafts/case-additional-2026-09-14/a/sets.json',set_ids:['case-09-confirmation-barrier-20260914'],reason:'발송 거부·부정위험·외부에서만 입수할 정보·필수 적극적 회신 및 대체절차 한계가 중심이며 새 소극적 조회 허용조건·예금주유인과 다르다.'},
 {file:'cpa_uploader/drafts/delegated-authoring-2026-09-11/learning-style-v2/t09-b/question.json',set_ids:['draft-09-505-freq01'],reason:'공란형 적극적 조회와 필수 적극적 회신 일반론으로 소극적 조회 조건 및 무응답 유인 사례와 다르다.'}
];
const inputs=[...['sets.json','design.json','review.json','qa.json','qa-boundaries.json','source-files.json','source-comparison.json','coverage-proposals.json','build.mjs'].map(name=>C+'/'+name),...read(C+'/source-files.json').map(row=>row.file),...compared.map(row=>row.file),D+'/source-catalog.json',D+'/draft-inventory.json',R+'/c-correction.json',R+'/c-source-range-correction.json'];
const checks={checked_at:new Date().toISOString(),method:'Independent agent source/content/points review; filesystem quote/shape/score arithmetic corroboration only',set_id:set.id,source_validation_errors:[],candidate_bank_errors:bankCheck.errors,representative_scope:qaScope,additional_boundary_answers:boundaries.length,quote_checks:quoteChecks,exact_facts_characters:1012,total_points:6,model_calls:0,human_review_performed:false};
fs.writeFileSync(R+'/c-peer-checks.json',JSON.stringify(checks,null,2)+'\n',{flag:'wx'});
const review={version:1,artifact_type:'independent_case_content_peer_review',reviewer_id:'agent:/root/trio_execution',author_id:'agent:/root',reviewed_at:new Date().toISOString(),status:'passed_after_recorded_corrections',method:'agent_content_review',human_review_performed:false,model_api_calls:0,canonical_writes:0,db_writes:0,set_count:1,question_count:3,criterion_count:6,total_points:6,facts_characters:1012,files:[...new Set(inputs)].map(ref),checks:ref(R+'/c-peer-checks.json'),questions,
 source_reading:{official_pdf:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf',visually_read_pdf_pages:[429,430,434,435],official_passages:['505.15 entire body and (a)-(d)','505.A23 complete paragraph across page break'],excluded_footnotes:['429 fn12/13 belong to505.9','434 fn20/21 belong toA19','434 fn22 belongs toA21','435 fn23 belongs toA25'],book_ranges:[{file:design.source_locations[0].file,read_ranges:[[1708,1758],[1823,1846],[11040,11083],[16457,16488]],findings:'2023 GS3 문제2물음2는 예시인 모집단(b)을 제외한 세 조건을 묻는다. 55/58쪽과 PART2 재수록을 별도 출제로 세지 않는다.'},{file:design.source_locations[1].file,read_ranges:[[14736,14812],[14938,14977]],findings:'2018 문제2물음4의④원발문 OCR 시작이 손상되어 공식 기출 원문을 온전히 복원했다고 주장하지 않는다. 교재 해설14955~14963과2026A23로 무응답의 제한적 정황증거 성격을 대조하며 과대표시 회신유인이 직접 기출되었다고 주장하지 않는다.'}]},
 nonduplication:{bank_sets:369,bank_questions:546,draft_discovery:'rg 명시 초안 경로 검색과 보존된7,635개JSON 소재 인벤토리277개세트행을 참고하고 관련 실제 후보 파일을 직접 읽었다. 검색 일치/미일치 자체를 의미중복 판정으로 사용하지 않았다.',compared},
 coverage_review:{element_id:element.id,criterion_ids:proposal.criterion_ids,source_unit_ids:proposal.source_unit_ids,relationship:'partial',decision:'accept',reason:'현재 요소는 mock:2023:GS3-2:2 필요조건의 전체 요구이며 새 sub1.c2는 그중 통제 운영효과성 증거 조건만 적용한다. sourceRef 별칭 src50515a는 같은 파일의 src-a4266fcb0677807733 완전단위에 포함되며 불필요한 전체결합/판단 criterion을 연결대상에서 뺐다.',mock_frequency:1,exam_frequency:0,frequency_inference:'원소 집계값이며2018인접기출과 재수록을 합산하지 않음'},
 resolved_findings:[{id:'source-fidelity-enum',finding:'verbatim은 허용 enum이 아니었다.',resolution:'실측 전 reconstructed로 수정하여 새 사실의 재구성과 등록 인용의 정확성을 구별했고 이전4파일 및 정정 기록을 보존했다.',evidence:ref(R+'/c-correction.json')},{id:'coverage-shape-and-alias',finding:'초기 완성overlay 형상 및 SourceRef별칭을 새 helper의 catalogue ID로 오인할 수 있었다.',resolution:'작성자 배열·명시 source_unit_ids·sub1.c2만으로 정정했다. 고정 helper를 덮어쓰지 않는 root의 별도 successor 준비기를 사용한다.',evidence:ref(C+'/coverage-proposals.json')},{id:'complete-book-ranges',finding:'기출해설 핵심 문장이14963에서 끝나며 ADV재수록 발문/예시가11074까지 이어졌다.',resolution:'design/coverage/builder에14963/11074 완결 범위를 반영했다. 정답·사실·배점·대표 답안은 그대로 보존했다.',evidence:ref(R+'/c-source-range-correction.json')}],unresolved_content_findings:[],unresolved_findings:[],execution_limit:'독립 내용검수와 로컬 기대점수 합산 확인이다. 실제 Luna 채점·봉인·정본·운영 DB 반영은 이 peer 기록의 완료 범위가 아니다.'};
fs.writeFileSync(D+'/c-peer-review.json',JSON.stringify(review,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:review.status,review:ref(D+'/c-peer-review.json'),checks:ref(R+'/c-peer-checks.json'),new_model_calls:0},null,2));
