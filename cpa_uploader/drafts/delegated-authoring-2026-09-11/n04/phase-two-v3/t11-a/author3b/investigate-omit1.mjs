import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestFile='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11/final-153-v1/manifest.json';
const entry=read(manifestFile).entries.find(entry=>entry.plan_id==='T11-A');
const raw=read(entry.file),set=Array.isArray(raw)?raw[0]:raw,sub=set.subquestions.find(sub=>sub.id==='sub3');
const summary=read(path.join(here,'author-qa/summary.json'));
const selected=['sub3/omit-1','sub3/model-answer','sub3/opposite-1'];
const observations=summary.records.filter(record=>selected.includes(record.case_id)).map(record=>{
 const file=path.join(here,'author-qa',record.file),recorded=read(file);
 return {file,sha256:sha(file),case_id:record.case_id,attempt:record.attempt,expected:recorded.expected,model:recorded.model,transport:recorded.transport,request_hash:recorded.request_hash,schema_hash:recorded.schema_hash,raw_target:recorded.raw_judgment?.subquestions.find(sub=>sub.subquestion_id==='sub3'),final_target:recorded.result?.subquestions.find(sub=>sub.subquestion_id==='sub3'),security_flag:recorded.result?.security_flag,matched:recorded.matched,exact_verdict_differences:recorded.exact_verdict_differences,trace:recorded.trace};
});
const sourceIds=new Set(sub.criteria.flatMap(criterion=>criterion.source_ref_ids));
const report={recorded_at:new Date().toISOString(),plan_id:entry.plan_id,set_id:set.id,case_id:'sub3/omit-1',classification:'grader_implied_conclusion_variance_under_explicit_scope',status:'unresolved_v4_targeted_regression_prepared',api_calls_by_this_script:0,fixed_input_hashes_match:sha(entry.file)===entry.sha256&&sha(entry.qa_file)===entry.qa_sha256&&entry.plan_files.every(file=>sha(file.file)===file.sha256),files:[manifestFile,entry.file,entry.qa_file,...entry.plan_files.map(file=>file.file),...new Set(set.source_refs.map(ref=>ref.file))].map(file=>({file,sha256:sha(file)})),shared_context:set.shared_context,subquestion:sub,source_refs:set.source_refs.filter(ref=>sourceIds.has(ref.id)),observations,
 analysis:{expectation:'4점 유지, crit1~crit4 모두 met. 최초 문장만 삭제해도 추가 검증을 계속 수행하는 나머지 조치가 종료 불가를 함축한다.',observed:'동일 입력·모델·스키마에서 3/4/4점. crit1만 not_met/met/met이며 crit2~crit4는 모두 met다. 원시 판단과 최종 합산이 동일하고 보안 플래그 없다.',prompt_context:'경영진 점추정치가 범위 안에 포함된다는 사실만 확인했으며 540.29의 다른 검증은 아직 하지 않았다고 준다. 이 상황에서 모든 금액의 증거·합리성과 공시 추가 절차를 요구하는 답안은 현재 종료할 수 없다는 뜻이다.',explicit_scope:sub.criteria[0].critical_facts.find(fact=>fact.id==='sub3.crit1.scope').expected,source:'540.29는 범위의 모든 금액의 충분하고 적합한 감사증거, 측정목적과 기타 요구에 따른 합리적인 금액만 포함, 추정불확실성 공시의 위험에 대한 충분하고 적합한 증거를 요구한다.',controls:'저장 모범답안 4점, 종료 가능을 명시하면서 독립 정상 조치를 쓴 반대 답안 3점은 같은 실행에서 일치했다.',next:'총괄 지시에 따라 원 반례·저장 모범답안·명시 반대 원 QA 3개를 변경 없이 추출했다. v4 고정 후 각 3회 총 9회 검증한다. 원 QA·문항·계획 변경 또는 기대 하향 없음.'}};
fs.writeFileSync(path.join(here,'omit1-investigation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({observations:observations.length,fixed_input_hashes_match:report.fixed_input_hashes_match,api_calls:0}));
