import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ref=file=>({file,sha256:sha(fs.readFileSync(file))});
const observation=R+'execution-v1/actual-b/std-points-20260914-17c71aee6d2b--sub2--partial/observation.json';
const o=JSON.parse(fs.readFileSync(observation,'utf8'));
const source='cpa_uploader/data/official/kga315-330-2025-review06.txt';
const runtime=R+'execution-v1/runtime/lib/questionV3Grading.ts';
const rule='발문과 shared_context에 이미 주어진 전제는 답안에서 반복하지 않아도 적용한다.';
assert(fs.readFileSync(runtime,'utf8').includes(rule));
assert.equal(o.result.score,0);assert.equal(o.original_expected[0].expected_points,2);
const result={schema_version:1,reviewer:'agent:/root/review_06_10',reviewed_at:'2026-09-14',
 kind:'observed_outside_tolerance_semantic_adjudication',
 findings:[{
  entry_id:o.entry_id,question_key:o.source_set_id+'/sub2',origin_key:'pilot-06-003/sub2',
  classification:'grading_consistency_only',content_rechecked:true,
  disposition:'accepted_within_batch_95_percent',
  disposition_scope:'이 관측을 실패 분모에 포함한 채 전체 실측 허용범위 비율로 판단한다. 이 장부의 작성 자체는 미완료 배치의95% 달성 선언이 아니며, 최종 집계·receipt는 root의 실행 결과를 따른다.',
  observation:ref(observation),model:o.model,transport:o.transport,response_injection:o.response_injection,
  expected_points:2,actual_points:0,delta:-2,within_tolerance:false,expected_2_valid:true,
  original_answer:o.answers.sub2,
  source_recheck:{...ref(source),paragraph:'315.26(b)~(c)',line_start:286,line_end:295,
   edition:'로컬 보존된 한국공인회계사회 회계감사기준2025개정 전문 발췌 pp202–203',
   finding:'26(b)는 식별된 통제를 바탕으로 IT 사용 위험이 따르는 응용프로그램과 IT 환경의 기타 측면을 식별하게 하고,26(c)는 그 대상의 관련 IT 위험과 이를 대처하는 IT 일반통제를 별도 식별하게 한다. 네 독립 대상의 각1점 구조와 원 부분답의 두 대상 식별은 타당하다.'},
  prompt_recheck:'발문은26(a) 통제를 식별한 후26(b)~(c)에 따라 식별할 사항을 모두 제시하도록 요구한다. 이 문맥에서 응용프로그램과 기타IT환경을 정확히 열거한 답은 두 기준을 충족하며, 식별된 통제라는 발문의 전제를 반복하지 않았다고 두 점수를 함께 없애서는 안 된다.',
  expected_verdicts:[
   {criterion_id:'crit7',verdict:'met',reason:'IT 사용 위험이 따르는 응용프로그램 식별을 정확히 제시했다. 발문이 전제한26(a) 통제 식별을 반복할 필요는 없다.'},
   {criterion_id:'crit12',verdict:'met',reason:'IT 사용 위험이 따르는 기타 IT 환경 식별도 같은 문장에 정확히 제시했다. 하나의문장이어도 다른 식별대상에 각각1점이다.'},
   {criterion_id:'crit8',verdict:'not_met',reason:'IT 사용 위험이 따르는 것은 식별대상의 수식어다. 그 대상에 관련된 위험 자체를 식별한다는 별도 조치까지 쓰지는 않았다.'},
   {criterion_id:'crit9',verdict:'not_met',reason:'위험에 대처하는 IT 일반통제의 식별은 없다.'}
  ],
  runtime_rule:{...ref(runtime),line:239,quote:rule,already_present_during_original_call:true},
  actual_error:'Luna는 crit7과crit12 모두에서 공통 전제의 미재진술을 누락 요건으로 삼아 일괄 감점했다. 실제 입력 모델규칙의 주어진 전제 반복불요를 해당 답안에 적용하지 못한 과소채점이다.',
  underlying_content_errors_found:[],
  distinction:'기준서 원문·독립 배점·기대점수의 오류를95% 허용률로 면제한 것이 아니다. 기반 내용을 다시 확인하여 오류가 없음을 판단한 뒤 관측된 채점 일관성 실패를 보존한다. 후속 변경은 올바른 전제 처리를 모델이 놓치지 않도록 발문과critical_facts.scope를 명시하는 표현 보강이다.',
  followup:{status:'planned_by_root',
   change:'발문에26(a)에서 식별한 통제를 바탕으로를 명시하고 crit7/crit12 scope에 발문 전제 재진술 불요와 그 기반을 명시적으로 부정한 답의 불인정 경계를 적는다.',
   preserved:['원 모범답안','원 부분답안과 기대2점','원 오답','4점의 독립 기준 배점','원 execution-v1 관측·사용량·실패판정'],
   actual_grading:'대상 물음이 포함된 최종 후속판본의 한 세트를 새 배치로 실측하고 새 receipt로 route한다. 그 세트의 옛 receipt를 새 판본의 receipt로 바꾸지 않는다.',
   other_evidence:'나머지 변경되지 않은 대상은 원 실행 증거 참조를 보존하며 실행하지 않은 재호출을 실행으로 기록하지 않는다.'}
 }],
 exclusions:'다른 관측의 점수 허용범위 밖 결과가 추가되면 별도 의미 분석이 필요하다. 이 파일은 전체 배치의 자동 합격 선언이 아니다.'};
fs.writeFileSync(R+'residual-findings-v1.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({findings:result.findings.length,expected:2,actual:0,classification:result.findings[0].classification}));
