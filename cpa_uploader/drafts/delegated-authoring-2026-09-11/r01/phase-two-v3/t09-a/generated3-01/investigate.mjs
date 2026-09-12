// Preserve a content-level investigation without editing any fixed input or receipt.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const entry=read(manifestFile).entries.find(entry=>entry.plan_id==='T09-A');
const input=read(path.join(here,'inputs.json'));
const raw=read(entry.file),set=Array.isArray(raw)?raw[0]:raw;
const receipt=read(input.semantic_file).reviews.find(receipt=>receipt.set_id===set.id);
const initial=fs.readFileSync(path.join(here,'initial.grading.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const repeated=fs.readFileSync(path.join(here,'repeat.grading.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const cases=initial.filter(event=>event.matched===false).map(event=>({
 id:event.id,answer:event.answers.q2,generated_case:receipt.cases.find(sample=>sample.answer===event.answers.q2),
 observations:[{attempt:1,event},...repeated.filter(followup=>followup.id===event.id).map(followup=>({attempt:followup.attempt,event:followup}))],
 proposed_interpretation:{classification:'generated_case_target_expected_mismatch',status:'pending_coordinator_confirmation',target_criterion:event.expected[0].criterion_id,target_expected:'met',application_scope_criterion:'q2.c4',application_scope_expected:'contradicted',proposed_subquestion_points:1,
 basis:'발문은 통제 효과성의 세 측면 제시와 두 기록방식에 대한 적용범위를 별개로 요구하며 각각 c1~c3 및 c4로 독립 배점한다. 이 답안은 설계 또는 실행의 평가 측면을 직접 제시하고, 별개 적용범위를 계속기록법으로 잘못 제한한다. 현재 사례는 기록방식을 고정하지 않았다. 따라서 잘못된 적용범위를 c4에서 0점으로 판정하면서 올바르게 특정한 평가 측면의 1점을 보존하는 해석이 독립 배점과 맞는다.',
 limit:'A9의 어느 경우이든이라는 실제 적용 조건은 참이며 삭제할 수 없다. 모든 조건 오류를 일률적으로 별개 배점에 격리하는 정책 제안이 아니다. 이 문항의 발문과 명제 분리를 근거로 한 개별 해석이며 원 receipt의 기대값은 그대로 보존한다.'}
}));
const source=set.source_refs.find(ref=>ref.id==='src2');
const report={recorded_at:new Date().toISOString(),set_id:set.id,plan_id:entry.plan_id,classification:'content_and_generated_expectation_investigation',api_calls_by_this_script:0,fixed_inputs_unchanged:sha(entry.file)===entry.sha256&&sha(entry.qa_file)===entry.qa_sha256&&entry.plan_files.every(file=>sha(file.file)===file.sha256),files:[manifestFile,entry.file,entry.qa_file,...entry.plan_files.map(file=>file.file),input.semantic_file,source.file,path.join(here,'initial.grading.jsonl'),path.join(here,'repeat.grading.jsonl')].map(file=>({file,sha256:sha(file)})),shared_context:set.shared_context,subquestion:set.subquestions.find(sub=>sub.id==='q2'),source,author_condition_case:read(entry.qa_file).cases.find(sample=>sample.id==='q2/condition-boundary'),cases,
 conclusion:'두 답안의 원시 의미판정부터 최종 합산까지 각각 3회 모두 해당 평가 측면 met, c4 contradicted, 1점이며 인용 복원·보안·합산 단계의 변동이나 실행 오류가 아니다. 생성한 기대의 대상 명제를 c4와 구별하지 않은 문제가 유력하다. 총괄의 독립 판단과 후속 검증 전까지 실제 채점 pass로 변경하지 않는다.'};
fs.writeFileSync(path.join(here,'investigation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:cases.length,observations:cases.map(sample=>sample.observations.length),fixed_inputs_unchanged:report.fixed_inputs_unchanged,api_calls:0}));
