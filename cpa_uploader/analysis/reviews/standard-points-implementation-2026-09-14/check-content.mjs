import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R='cpa_uploader/analysis/reviews/standard-points-implementation-2026-09-14',C=R+'/candidate-v1';
const read=f=>JSON.parse(fs.readFileSync(f));
const ref=file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const old=read(R+'/bank.snapshot.json'),bank=read(C+'/bank.json'),catalog=read(C+'/catalog.json'),before=read(R+'/catalog.snapshot.json');
const checks=read(C+'/checks.json');
for(const f of checks.plan_files)assert.equal(ref(f.file).sha256,f.sha256);
for(const tag of ['06-10','11-14']){const q=read(R+'/qa-'+tag+'.json');assert.equal(q.status,'pass');assert.equal(q.plan_sha256,ref(R+'/plan-'+tag+'.json').sha256);assert.deepEqual(q.unresolved,[]);}
for(const tag of ['01-05','15-19']){const q=read(R+'/qa-'+tag+'-resolution.json');assert.equal(q.unresolved_issues,0);assert.equal(q.resolved_plan_sha256,ref(R+'/plan-'+tag+'.json').sha256);}
const supplemental=read(R+'/subset-regrade-representatives.json');
assert.equal(supplemental.questions.length,10);
assert.deepEqual(supplemental.unresolved??[],[]);
for(const row of supplemental.questions){const s=bank.find(s=>s.id===row.set_id),q=s.subquestions.find(q=>q.id===row.subquestion_id);assert.deepEqual(q.model_answer,row.model_answer);assert(row.source_review&&row.partial_answer&&row.wrong_answer);}
const caseRows=before.classifications.filter(c=>c.question_style==='case');
for(const meta of caseRows){const a=old.find(s=>s.id===meta.source_set_id),b=bank.find(s=>s.id===meta.source_set_id);assert(b);const aq=a.subquestions.find(q=>q.id===meta.subquestion_id),bq=b.subquestions.find(q=>q.id===meta.subquestion_id);assert.deepEqual(aq,bq);assert.deepEqual(a.shared_context,b.shared_context);}
const standards=catalog.classifications.filter(c=>c.question_style==='standard');
const points=rows=>rows.reduce((n,c)=>n+bank.find(s=>s.id===c.source_set_id).subquestions.find(q=>q.id===c.subquestion_id).criteria.length,0);
const evidence=['qa-01-05.json','qa-01-05-resolution.json','qa-06-10.json','qa-11-14.json','qa-15-19.json','qa-15-19-resolution.json','source-evidence-11-14.json','subset-regrade-representatives.json'].map(f=>ref(R+'/'+f));
const result={status:'pass',reviewed_at:new Date().toISOString(),candidate_sha256:ref(C+'/bank.json').sha256,unresolved:[],content_error_tolerance:0,review_method:'주제 담당자의 출처·최종 발문·답안·배점 직접 대조와 다른 agent/root의 출력 전수 교차 검수, 발견한 6개 답안·범위 쟁점 수정 확인',evidence,counts:{standards_before:before.classifications.filter(c=>c.question_style==='standard').length,standards_after:standards.length,standard_points_after:points(standards),unchanged_case_questions:caseRows.length,new_independent_questions:checks.new_sets,retained_questions_newly_reviewed:10},source_registry_correction:'감사증거 주제 08에 KGA 200.A32/A33의 충분성·적합성 정의가 직접 근거이므로 허용 기준서에 KGA 200을 추가했다. 기존 해당 물음·분류·모범·배점은 그대로 유지한다.',human_review_performed:false,model_api_calls:0};
fs.writeFileSync(R+'/implementation-content-checks.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result.counts));
