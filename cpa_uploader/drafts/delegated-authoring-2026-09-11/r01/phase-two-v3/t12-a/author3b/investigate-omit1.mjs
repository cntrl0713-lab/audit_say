import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json';
const entry=read(manifestFile).entries.find(entry=>entry.plan_id==='T12-A');
const raw=read(entry.file),set=Array.isArray(raw)?raw[0]:raw;
const summary=read(path.join(here,'author-qa/summary.json'));
const selected=['q2/omit-1','q2/model','q2/equivalent','q2/date-only','q2/dual-date-one-sentence','q2/opposite'];
const observations=summary.records.filter(record=>selected.includes(record.case_id)).map(record=>{
 const file=path.join(here,'author-qa',record.file),observation=read(file);
 return {file,sha256:sha(file),case_id:record.case_id,attempt:record.attempt,expected:observation.expected,model:observation.model,transport:observation.transport,request_hash:observation.request_hash,schema_hash:observation.schema_hash,raw_target:observation.raw_judgment?.subquestions.find(sub=>sub.subquestion_id==='q2'),final_target:observation.result?.subquestions.find(sub=>sub.subquestion_id==='q2'),security_flag:observation.result?.security_flag,matched:observation.matched,exact_verdict_differences:observation.exact_verdict_differences,trace:observation.trace};
});
const report={recorded_at:new Date().toISOString(),plan_id:entry.plan_id,set_id:set.id,case_id:'q2/omit-1',classification:'grader_implied_conclusion_mismatch_under_explicit_current_criterion_scope',status:'unresolved_coordinator_notified',api_calls_by_this_script:0,fixed_input_hashes_match:sha(entry.file)===entry.sha256&&sha(entry.qa_file)===entry.qa_sha256&&entry.plan_files.every(file=>sha(file.file)===file.sha256),files:[manifestFile,entry.file,entry.qa_file,...entry.plan_files.map(file=>file.file),...new Set(set.source_refs.map(ref=>ref.file))].map(file=>({file,sha256:sha(file)})),shared_context:set.shared_context,subquestion:set.subquestions.find(sub=>sub.id==='q2'),source_refs:set.source_refs,observations,
 analysis:{original_expectation:'5점, q2.c1~c5 모두 met. 이전에 첫 문장 삭제만으로 최초 일자 보존 명제가 사라지지 않는다는 사전 근거로 정한 기대다.',actual:'동일 입력 3회 모두 4점, q2.c1만 not_met. 원시 판단부터 최종 점수까지 동일하고 보안 플래그 없다.',explicit_contract:'q2.c1.scope는 최초 일자 후의 절차 범위를 한정하는 추가 일자를 병기한다는 답을 두 일자의 병존을 분명히 함축하는 허용 답안으로 명시한다. 실제 원답안은 추가 일자를 기재하여 최초 일자 후 절차의 범위를 설명한다. 기재와 병기의 단어 차이를 필수 정답어로 삼는 계약은 없다.',source:'560.A13은 12(a) 방식에서 수정 전 재무제표에 대한 보고서일이 변경 없이 남고 추가 일자는 최초 일자 후 절차의 한정 범위를 알린다고 직접 설명한다.',controls:'완전 답안과 허용 표현 5점, 최초 일자 유지뿐인 답안 1점, 명시 유지와 병기 한 문장 2점, 반대 답안 0점은 같은 실행에서 기대와 일치한다. c1과 c2의 독립 점수를 합치거나 삭제할 필요를 보여주는 증거는 아니다.',decision:'현행 명시적 scope 및 사전 기대에 따라 원답안의 5점 기대를 유지한다. 원 QA를 4점으로 낮추거나 더 명시적인 답안만 남겨 통과 처리하지 않는다.',next:'총괄이 공통 실행과 영향을 조정한 후 함축 허용 범위의 모델 해석을 보완하고 원답안과 정상·단일명제·반대 대조 사례를 재확인할 수 있다. 현재 실행 중 파일과 공통 코드는 수정하지 않았다.'}};
fs.writeFileSync(path.join(here,'omit1-investigation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({mismatch_observations:observations.filter(item=>item.case_id==='q2/omit-1').length,controls:observations.filter(item=>item.case_id!=='q2/omit-1').length,fixed_input_hashes_match:report.fixed_input_hashes_match}));
