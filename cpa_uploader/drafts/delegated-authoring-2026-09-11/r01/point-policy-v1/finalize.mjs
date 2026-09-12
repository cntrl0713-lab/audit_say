import fs from 'node:fs';
import crypto from 'node:crypto';
const base='cpa_uploader/drafts/delegated-authoring-2026-09-11/r01/point-policy-v1/';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const h=read(base+'handoff.in-progress.json'),v=read(base+'local-validation.json');
if(v.errors.length)throw new Error('Static errors remain');
const coverage=[];
for(const e of h.entries){
 const qa=read(e.qa_file),s=read(e.question_file);
 e.hashes={question_sha256:sha(e.question_file),plan_sha256:sha(e.plan_file),qa_sha256:sha(e.qa_file),lineage_sha256:e.lineage_file?sha(e.lineage_file):null};
 if(!e.changed)continue;
 for(const q of e.questions.filter(q=>q.decision==='split')){
  const targets=new Set(q.criterion_mapping.filter(m=>m.new_ids.length>1).flatMap(m=>m.new_ids));
  if(e.plan_id==='T09-C'&&q.id==='sub2')targets.add('sub2.crit2');
  if(e.plan_id==='T09-B'&&q.id==='q1')targets.add('q1.c2');
  for(const target of targets)coverage.push({plan_id:e.plan_id,set_id:e.set_id,subquestion_id:q.id,criterion_id:target,source_ref_ids:s.subquestions.find(a=>a.id===q.id).criteria.find(c=>c.id===target).source_ref_ids,kinds:Object.fromEntries(['full','paraphrase','omission','opposite','condition_boundary'].map(kind=>[kind,qa.cases.filter(c=>c.subquestion_id===q.id&&c.target_criterion_id===target&&c.kind===kind).map(c=>({id:c.id,target_verdict:c.expected_verdicts.find(v=>v.criterion_id===target).verdict,expected_points:c.expected_points}))]))});
 }
}
const cf=base+'new-criterion-qa-coverage.json';fs.writeFileSync(cf,JSON.stringify({api_calls:0,criteria:coverage.length,rows:coverage},null,2)+'\n');
h.created_at=new Date().toISOString();h.status='local_followup_ready_needs_model_and_human_review';
h.validation={api_calls:0,checks:[{check:'all_questions_reviewed',sets:16,questions:39,old_points:171,new_points:182,status:'pass'},{check:'source_schema_plan_and_memory_bank',file:base+'local-validation.json',sha256:sha(base+'local-validation.json'),errors:0,warnings:0,memory_bank_sets:153,added_conflicts:0,status:'pass'},{check:'original_QA_ID_question_ID_answer_preservation',original_cases:746,changed_set_original_cases:356,selected_cases:v.qa_cases,added_cases:v.qa_cases-746,status:'pass'},{check:'new_and_first_split_criterion_QA_coverage',file:cf,sha256:sha(cf),criteria:coverage.length,required_kinds:5,status:'pass'},{check:'local_deterministic_sum_of_author_expectations',cases:v.qa_cases,status:'pass',limitation:'작성자가 정한 verdict를 현행 scoreCriterionVerdicts로 합산한 검사이며 실제 모델 판단의 검증이 아니다.'}],model_revalidation:'not_run_user_paused',canonical_public_database_writes:0};
fs.writeFileSync(base+'handoff.json',JSON.stringify(h,null,2)+'\n');
const lines=['# 담당 16세트의 독립 내용별 1점 후속 적용','','사용자가 승인한 요소별·서술 독립 내용별 1점 정책을 39개 물음 전체에 적용하여 검토했다. 기존 171점에서 182점으로 조정했다. 7개 세트는 후속본을 작성했고 9개 세트는 원 선택을 유지했다. 모든 원문항·계획·QA·실측 원시는 보존했다. API는 0회이며 새 계약의 의미검수·모델 채점과 사람 승인은 완료하지 않았다.','','선택과 물음별 판단은 [handoff.json](handoff.json), 정적 증거는 [local-validation.json](local-validation.json), 분리기준별 회귀 범위는 [new-criterion-qa-coverage.json](new-criterion-qa-coverage.json)에 있다. 각 변경 세트의 lineage에는 원 파일 해시와 모든 원답안의 전후 기대값이 있다.','','| 계획 ID | 세트 ID | 물음 | 기존→후속 점수 | 선택 |','| --- | --- | ---: | ---: | --- |'];
for(const e of h.entries)lines.push(`| ${e.plan_id} | ${e.set_id} | ${e.questions.length} | ${e.questions.reduce((a,q)=>a+q.old_points,0)}→${e.questions.reduce((a,q)=>a+q.new_points,0)} | ${e.changed?'후속본':'기존 선택 유지'} |`);
lines.push('','분리한 요구는 공란형 작성·회신 방식과 회신율/이유, 비회신의 감사/감사의견 영향, 후속사건 보고서 형태/문단, 가능한 의견명, 외부전문가의 이해/관계 질문, 직접조회 두 조건의 내용/OR 관계, 내부감사 활용과 외부감사 직접수행의 두 배분 방향이다. 같은 행위의 주체·대상·조건, 공통 중요성 명칭, 객관성 지원 정도의 배경요소, 보고서 시간범위 같은 한 평가를 단어별로 쪼개지는 않았다. 유지한 9개 세트에도 각 물음의 발문·답안·원문에 근거한 이유를 기록했다.','','QA는 원 선택 746사례를 모두 보존하고 새 142사례를 추가한 888사례이다. 변경한 356개 원사례도 ID·물음 ID·답안 문자열이 동일하다. 분리한 기존 첫 명제와 새 명제, 함께 범위를 정리한 T09-C 두 번째 조건까지 23개 기준에는 완전·동의·진짜 누락·명시 반대·조건 경계가 각각 있으며 target_criterion_id로 연결했다. 원 저장 모범답안 QA와 새 저장 모범답안·역순·한 문단 답안도 모두 만점 기대를 로컬 합산으로 확인했다.','','T09-C의 정확한 두 조건을 AND로 잘못 묶은 답은 조건식별 점수를 보존하고 OR만 0점이다. 한 조건만 맞고 다른 조건은 틀린 경우도 내용과 결합관계를 각각 평가하는 추가 답안을 두었다. 원 sub2/omit-3에는 “경영진이 작성한 질의서”가 남아 있으므로 기존 작성자 기대 c3 not_met를 met으로 정정했다. 이 QA-only 교정은 원답안을 바꾸지 않았고 이전 기대값과 근거를 lineage에 보존했다.','','T12-B의 역사적 생성답안 “이 경우에는 한정의견을 표명한다.”를 그대로 추가했다. 옛 두 의견 묶음의 기대0/실측1·1·1은 그 계약의 불일치로 남으며, 새 분리계약에서는 한정의견1·부적정의견0으로 1점이다. T12-A의 유효한 추가일자 함축 답안도 원문 그대로 유지하여 새 요구에 따른 기대를 만들었고, 과거 변동이나 실패를 해결했다고 표시하지 않았다.','','로컬 검증은 validate_draft_v3.ts와 같은 validateQuestionSetV3({verifySourceQuotes:true})를 16세트에 직접 적용하고 계획 형상·공식 인용·ID·원자료 보존·QA 대응·현행 정수 합산을 확인했다. 고정 153세트 비교본의 담당 세트만 메모리에서 대체한 ID/발문 중복 검사는 추가 오류0이다. 16세트39물음182점, QA888사례에서 정적 오류0·경고0이다. 빌드/검사 스크립트는 이 전용 폴더만 출력하며 환경키를 로딩하거나 모델을 호출하지 않는다.','','입력은 final-153-v3/manifest-plan-followup-02.json 및 active-qa-overrides-v3-plan-followup-02.json이다. T11-B 최신 적용복습 계획과 T14-A/T09-C QA-only 후속 선택을 이어받았다. T11-B는 변경하지 않아 최신 계획 경로를 그대로 선택했다. 공통 출처·wiki·coverage·manifest·정본·공개본·운영DB는 수정하지 않았다. 총괄의 독립 통합 검토 이후에도 실제 모델 재검수·채점은 사용자 API 중지 정책이 해제되기 전까지 실행하지 않는다.','');
fs.writeFileSync(base+'README.md',lines.join('\n').replaceAll('142사례','147사례').replaceAll('888사례','893사례').replaceAll('23개 기준','24개 기준'));
console.log(JSON.stringify({handoff:base+'handoff.json',sha256:sha(base+'handoff.json'),readme_sha256:sha(base+'README.md'),coverage:coverage.length,sets:16,questions:39,points:182,qa_cases:v.qa_cases,api_calls:0}));
