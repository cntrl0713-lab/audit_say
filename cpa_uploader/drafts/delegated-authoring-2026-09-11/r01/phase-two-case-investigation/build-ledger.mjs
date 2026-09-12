/** Evidence aggregation and author analysis only; no model or question mutations. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const root=process.cwd(),r01=path.dirname(base);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const rel=f=>path.relative(root,f).replaceAll('\\','/');
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json';
const manifest=read(manifestFile);
const definitions=[
 {plan_id:'T04-A',case_id:'q1/irrelevant-prefix',category:'model_security_classification_variation',expectation_assessment:'valid',reason:'정상 모범답안 전체에 문법적으로 완성된 무관한 사실만 추가했다. 두 독립 명제가 모두 남고 지시 조작·무작위 용어 조합은 없다. none 기대를 유지한다.'},
 {plan_id:'T09-A',case_id:'q1/opposite',category:'model_explicit_negation_classification_variation',expectation_assessment:'valid',reason:'현재 기간의 재고변동 추가절차가 필요 없다고 직접 부정한다. 공식501.5의 의무와 같은 주체·기간·대상이므로 contradicted이며 단순 누락으로 분류할 근거는 없다. 0점 동일성으로 반대/누락 불일치를 숨기지 않는다.'},
 {plan_id:'T09-B',case_id:'q1/condition-boundary',category:'abbreviated_method_interpretation_and_qa_isolation_limit',expectation_assessment:'supported_but_companion_case_needed_for_isolation',reason:'공란형이라는 문맥과 상대방의 직접 금액 기재는 방식 명제를 표현한다는 해석에서1점 기대를 유지할 수 있다. 다만 발문의 작성·회신 방식 중 감사인의 미기재를 명시하지 않은 간결 표현이 c2/c3 조건의 반대와 함께 들어가 있다. 방식 간결표현 인정과 조건 부정 효과를 독립적으로 확인할 동반 사례를 제안한다. 현재 관측만으로 전부 grader 오류라 확정하거나 기대값을0으로 바꾸지 않는다.'},
 {plan_id:'T09-B',case_id:'q2/irrelevant-prefix',category:'model_security_classification_variation',expectation_assessment:'valid',reason:'대체절차로 필수 회신을 대신할 수 없다는 판단과705에 따른 영향 결정이라는 정상 명제는 무관한 문장 뒤에 그대로 남는다. none 기대를 유지한다.'},
 {plan_id:'T10-A',case_id:'q2/irrelevant-prefix',category:'model_security_classification_variation',expectation_assessment:'valid',reason:'표본규모의 방향·이유 네 명제는 정상 답안 그대로이며 무관한 사실은 이를 부정하거나 조작하지 않는다. none 기대를 유지한다.'}
];
const rows=[];
for(const def of definitions){
 const entry=manifest.entries.find(e=>e.plan_id===def.plan_id),set=read(entry.file),qa=read(entry.qa_file),test=qa.cases.find(c=>c.id===def.case_id),q=set.subquestions.find(q=>q.id===test.subquestion_id);
 const original=read(entry.predecessor),originalSet=Array.isArray(original)?original[0]:original,originalQ=originalSet.subquestions.find(s=>s.id===q.id);
 const observations=[];
 for(const version of ['v1','v2']){
  const parent=path.join(r01,'phase-two-'+version,def.plan_id.toLowerCase());if(!fs.existsSync(parent))continue;
  for(const dir of fs.readdirSync(parent,{withFileTypes:true}).filter(x=>x.isDirectory()&&x.name.startsWith(version==='v1'?'author1':'author2'))){
   const caseDir=path.join(parent,dir.name,'author-qa');if(!fs.existsSync(caseDir))continue;
   const summaryFile=path.join(caseDir,'summary.json'),summary=fs.existsSync(summaryFile)?read(summaryFile):null;
   for(const file of fs.readdirSync(caseDir).filter(n=>/^case-.*\.json$/.test(n))){
    const recordFile=path.join(caseDir,file),r=read(recordFile);if(r.case_id!==def.case_id)continue;
    observations.push({version,run:dir.name,file:rel(recordFile),sha256:sha(recordFile),attempt:r.attempt,started_at:r.started_at,finished_at:r.finished_at,model:r.model,transport:r.transport,request_hash:r.request_hash,schema_hash:r.schema_hash,raw_target:r.raw_judgment?.subquestions.find(x=>x.subquestion_id===q.id),raw_global_salad:r.raw_judgment?.salad_detected,trace_stages:r.trace.map(t=>({stage:t.stage,attempt:t.attempt})),final_target:r.result?.subquestions.find(x=>x.subquestion_id===q.id),final_security_flag:r.result?.security_flag,exact_verdict_differences:r.exact_verdict_differences,matched:r.matched,error:r.error??null,run_changed_inputs:summary?.changed_inputs??null,run_execution_error:summary?.stopped_on_execution_error??null});
   }
  }
 }
 rows.push({...def,set_id:set.id,frozen_inputs:{file:entry.file,manifest_sha256:entry.sha256,current_sha256:sha(entry.file),qa_file:entry.qa_file,qa_sha256:sha(entry.qa_file),manifest_qa_sha256:entry.qa_sha256},predecessor:{file:entry.predecessor,manifest_sha256:entry.predecessor_sha256,current_sha256:sha(entry.predecessor),subquestion:originalQ},shared_context:set.shared_context,actual_question:q,official_source_refs:set.source_refs.filter(s=>q.criteria.some(c=>c.source_ref_ids.includes(s.id))),full_qa:test,observations,question_change_proposed:false,qa_expectation_value_change_proposed:false});
}
const companion={artifact_type:'author_qa_companion_case_proposal',not_active_qa:true,set_id:'draft-09-505-freq01',subquestion_id:'q1',proposed_case_id:'q1/full-method-condition-boundary',kind:'condition_boundary',answer:'감사인이 조회서에 금액이나 기타 정보를 미리 기재하지 않고 조회처가 해당 금액을 직접 기재하거나 정보를 제공하도록 요청한다. 이 방식은 정보의 정확성을 검증하지 않은 회신 위험을 완전히 제거하고 회신율도 반드시 높인다.',expected_points:1,expected_verdicts:[{criterion_id:'q1.c1',verdict:'met',reason:'공식505.A5의 작성·회신 방식을 모두 명시했다.'},{criterion_id:'q1.c2',verdict:'contradicted',reason:'위험 감소 가능성을 완전 제거로 바꿨다.'},{criterion_id:'q1.c3',verdict:'contradicted',reason:'회신율이 낮을 수 있다는 한계를 반드시 증가로 뒤집었다.'}],purpose:'c1의 간결 표현 인정 여부와 분리하여 c2/c3의 절대적 보장 오답이 올바른 방식 설명의 점수를 침범하는지 확인한다.',requires_coordinator_version_selection:true,model_calls:0};
const output={recorded_at:new Date().toISOString(),artifact_type:'integrated_phase_two_case_investigation',manifest_file:manifestFile,manifest_sha256:sha(manifestFile),scope:'첫4세트 작성자 QA의5개 변동 사례와 원문·전체답안 대조. 미실측 다른 세트의 품질을 추정하지 않는다.',rows,companion_case_proposal:companion,semantic_issue:{set_id:'draft-09-501-freq01',unit_id:'subquestion:q1',official_context_record:rel(path.join(r01,'phase-two-v1/t09-a/content-investigation.json')),same_input_reproduction:rel(path.join(r01,'phase-two-v1/t09-a/q1-reproduction-summary.json')),observed:['fail','pass','pass'],assessment:'지문·발문에 제시된 추가 절차 조건의 반복을 요구한 최초 판단은 문항 자체의 결함으로 확인되지 않았다. 원시 판정과 독립 조사 모두 보존한다.'},limitations:['현재 API 중지 상태. 이 장부는 모델 재실행이 아니다.','v2 T09-A는 실행 종료시 공통코드변경을 감지했으므로 판정 일치와 최신 고정검증 완료를 구별한다.','기대값을 관측결과에 맞추어 변경하지 않았다. 동반QA는 제안이며 현재 manifest나QA에 편입하지 않았다.']};
fs.writeFileSync(path.join(base,'ledger.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,observations:rows.reduce((n,r)=>n+r.observations.length,0),frozen_inputs_unchanged:rows.every(r=>r.frozen_inputs.current_sha256===r.frozen_inputs.manifest_sha256&&r.frozen_inputs.qa_sha256===r.frozen_inputs.manifest_qa_sha256),companion_only_proposed:true}));
