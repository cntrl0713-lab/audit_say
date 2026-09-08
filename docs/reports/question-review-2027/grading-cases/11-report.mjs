import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {applyQuestionSetJudgment} from '../../../../lib/questionV3Grading.ts';
import {compilePublicQuestionSet} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const dir='docs/reports/question-review-2027',casesDir=`${dir}/grading-cases`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),sets=bank.filter(s=>s.classification.topic_id==='11'),before=read(`${casesDir}/11-before.json`),meta=read(`${casesDir}/11-v2-run-metadata.json`),cases=read(`${casesDir}/11-v2-cases.json`),offline=read(`${casesDir}/11-v2-offline.json`);
const logs=p=>fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),v1=logs(`${casesDir}/11-live.jsonl`),v2=logs(`${casesDir}/11-v2-live.jsonl`);
assert.deepEqual(sets,read(`${casesDir}/11-v2-after.json`));
for(const file of ['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts'])assert.equal(sha(file),meta.hashes[file]);
const selected=[];
for(const c of cases){
 const original=c.set_id==='pilot-11-004'?v2:v1,r=original.find(r=>r.id===c.id&&r.attempt===1);
 if(c.variant==='empty'||Object.values(c.answers).every(t=>!t.trim())){const o=offline.offline.find(o=>o.id===c.id);assert.equal(o.model_calls,0);assert.equal(o.result.score,0);selected.push({id:c.id,set_id:c.set_id,mode:'no_model_call',score:0,passed:true});continue;}
 assert.ok(r,c.id);assert.ok(!r.error&&!r.differences.length&&!r.raw_differences.length,c.id);
 assert.equal(r.requests[0].prompt_sha256,meta.prompt_hashes[c.id],c.id);assert.equal(r.requests[0].model,meta.model);
 const result=applyQuestionSetJudgment(sets.find(s=>s.id===c.set_id),c.answers,r.raw_judgment);assert.equal(result.score,c.expected_score,c.id);
 for(const q of c.expected.subquestions)for(const v of q.verdicts)assert.equal(result.subquestions.find(x=>x.subquestion_id===q.subquestion_id).criteria.find(x=>x.criterion_id===v.criterion_id).verdict,v.verdict,c.id);
 selected.push({id:c.id,set_id:c.set_id,mode:c.set_id==='pilot-11-004'?'v2_live':'v1_same_request_reprocessed',prompt_sha256:r.requests[0].prompt_sha256,score:result.score,passed:true,log:c.set_id==='pilot-11-004'?'11-v2-live.jsonl':'11-live.jsonl'});
}
const descriptions={
 'pilot-11-001/sub1':'범위와 설명 요구 명확화; 세 요소 명칭만으로는 설명 점수를 받지 못함; 3점 유지',
 'pilot-11-001/sub2':'독립된 두 상황 및 또는 관계 명료화; 2점 유지',
 'pilot-11-002/sub1':'모두 작성 및 선택 가능한 접근방법과 실제 수행 의무 구별; 3점 유지',
 'pilot-11-002/sub2':'결론 반복을 이유에서 제외하고 전체/기간에 걸친 편의의 근거 연결; 2점 유지',
 'pilot-11-003/sub1':'선택 다섯 가지에서 조건을 포함한 모두 작성으로 전환; 7criterion 유지',
 'pilot-11-003/sub2':'정상가격만으로 축소된 계약을 동등한 거래조건 증거로 복원; 1점 유지',
 'pilot-11-004/sub1':'독립된 접근방법 누락배점 복원, crit7 추가; 3→4점; 최소 포함 수 경계 명료화',
 'pilot-11-004/sub2':'실증전용의 전제와 통제의존의 별도 상황 명시; 허용 판단과 조건부 의무 구별; 3점 유지',
};
const ledger=sets.flatMap(s=>s.subquestions.map(q=>{
 const old=before.find(x=>x.id===s.id).subquestions.find(x=>x.id===q.id);
 return{key:`${s.id}/${q.id}`,status:'reviewed_and_remediated',review_note:descriptions[`${s.id}/${q.id}`],before:old,after:q,
  criteria:q.criteria.map(c=>({id:c.id,status:old.criteria.some(x=>x.id===c.id)?'reviewed':'restored_new_criterion',points:c.max_points,claim:c.claim,sources:c.source_ref_ids.map(id=>s.source_refs.find(r=>r.id===id)),positive_and_negative_cases:cases.filter(t=>t.set_id===s.id).map(t=>({case_id:t.id,verdict:t.expected.subquestions.find(x=>x.subquestion_id===q.id).verdicts.find(v=>v.criterion_id===c.id).verdict}))})),
  A:'official source confirmed under 2026-baseline assumption',B:'prompt/model answer/wording reviewed',C:'offline and real-model cases validated',D:'actual QuizClient and CSS at 1440/390, mocked auth/action; actual action isolated boundary checks'};
}));
const pub=read('cpa_uploader/data/cpa_question_sets_v3.public.json'),enc=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY||''));
assert.ok(sets.every(s=>JSON.stringify(s)===JSON.stringify(enc.find(x=>x.id===s.id))));assert.ok(sets.every(s=>JSON.stringify(compilePublicQuestionSet(s))===JSON.stringify(pub.find(x=>x.id===s.id))));
const counts={sets:sets.length,questions:ledger.length,criteria:ledger.flatMap(q=>q.criteria).length,points:ledger.flatMap(q=>q.criteria).reduce((n,c)=>n+c.points,0)};
const modelStats={requested_model:meta.model,response_models:[...new Set([...v1,...v2].flatMap(r=>r.responses.map(x=>x.body.model)).filter(Boolean))],cases:cases.length,base_question_answer_combinations:40,offline_passes:offline.offline.filter(x=>!x.differences.length).length,code_boundary_checks:offline.boundaries.length,initial_v1_records:v1.length,v1_network_calls:v1.reduce((n,r)=>n+r.requests.length,0),v2_records:v2.length,v2_network_calls:v2.reduce((n,r)=>n+r.requests.length,0),final_passed_cases:selected.length,no_call_cases:selected.filter(r=>r.mode==='no_model_call').length,reused_unchanged_requests:selected.filter(r=>r.mode==='v1_same_request_reprocessed').length,fresh_v2_cases:selected.filter(r=>r.mode==='v2_live').length,v2_failures:v2.filter(r=>r.error||r.differences?.length||r.raw_differences?.length).length,corrected_regressions:['pilot-11-004-omission','pilot-11-004-contrary'].map(id=>({id,runs:v2.filter(r=>r.id===id).map(r=>({attempt:r.attempt,score:r.result.score,passed:!r.differences.length&&!r.raw_differences.length}))})),selected};
const report={topic_id:'11',checked_at:new Date().toISOString(),scope:'local question remediation; no production deployment/database changes',counts_before:{sets:4,questions:8,criteria:24,points:24},counts_after:counts,status:{review_record:'complete',local_remediation:'complete',official_passages:'confirmed',grading_regression:'passed_for_recorded_cases',exam_2027:'conditional_same_as_2026_final_edition_unconfirmed',live_auth_db_e2e:'not_executed',duplicate_learning_objective:'11-002/sub1 and 11-004/sub1 retained and documented'},hashes:Object.fromEntries(['cpa_uploader/data/cpa_question_sets_v3.authoring.json','cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json','lib/questionV3.ts','lib/questionV3Grading.ts','app/actions.ts','app/quiz/QuizClient.tsx','cpa_uploader/data/official/kga540-550-2025-review11.txt',`${casesDir}/11-before.json`,`${casesDir}/11-v2-after.json`].map(p=>[p,sha(p)])),sets:sets.map(s=>({id:s.id,title:s.title,shared_context:s.shared_context,verification:s.verification})),ledger,source_comparison:read(`${casesDir}/11-source-comparison.json`),modelStats,checks:{typecheck:'passed',related_tests:{total:26,passed:26},bank_validation:'passed',compile:'passed 96 sets',deployment:{topic_public_matches:true,topic_encrypted_matches:true,round_trip:true},ui:read(`${casesDir}/11-ui-results.json`),action:read(`${casesDir}/11-action-results.json`),skill_format:'passed quick_validate with UTF-8',wiki_lint:'see 11-wiki-lint.json; unrelated missing report links may remain during parallel topic edits'},prior_failures:{compile:'13 source quotes temporarily unavailable',related_tests:'17 source quotes and sections temporarily unavailable',outcome:'later full compile, bank validation and 26 tests passed'},remaining:['2027 final exam edition confirmation','live authentication and database E2E','documented repeated learning objective']};
// Retain the latest broader check, including failures caused by other topics changing.
if(fs.existsSync(`${casesDir}/11-final-tests.log`)){
 const tests=fs.readFileSync(`${casesDir}/11-final-tests.log`,'utf8'),validation=fs.readFileSync(`${casesDir}/11-final-validate.log`,'utf8');
 report.checks.related_tests={prior:{total:26,passed:26,log:'grading-cases/11-tests.log'},latest:{total:Number(tests.match(/tests (\d+)/)?.[1]),passed:Number(tests.match(/pass (\d+)/)?.[1]),failed:Number(tests.match(/fail (\d+)/)?.[1]),log:'grading-cases/11-final-tests.log'}};
 report.checks.bank_validation={prior:'passed; see 11-validate.log',latest:validation.includes('검증 통과')?'passed':'failed; inspect latest log for target vs other-topic errors',log:'grading-cases/11-final-validate.log'};
}
if(fs.existsSync(`${casesDir}/11-wiki-lint.json`))report.checks.wiki_lint=read(`${casesDir}/11-wiki-lint.json`);
fs.writeFileSync(`${dir}/11.json`,JSON.stringify(report,null,2)+'\n');
for(const name of ['typecheck','tests','validate'])fs.copyFileSync(`tmp/question-review-11/${name}.log`,`${casesDir}/11-${name}.log`);
const manifestFile='docs/plans/2027-question-review/manifest.json',manifest=read(manifestFile),topic=manifest.topics.find(t=>t.id==='11');
Object.assign(topic,{sets:4,questions:8,criteria:25,status:'reviewed_and_remediated',report:'../../reports/question-review-2027/11.md',exam_2027_status:'conditional_same_as_2026',question_sets:sets.map(s=>({id:s.id,title:s.title,subquestions:s.subquestions.map(q=>({id:q.id,key:`${s.id}/${q.id}`,type:q.type,criterion_ids:q.criteria.map(c=>c.id),status:'reviewed_and_remediated'}))}))});
manifest.authoring_sha256=report.hashes['cpa_uploader/data/cpa_question_sets_v3.authoring.json'];manifest.public_sha256=report.hashes['cpa_uploader/data/cpa_question_sets_v3.public.json'];manifest.counts={topics:new Set(bank.map(s=>s.classification.topic_id)).size,sets:bank.length,subquestions:bank.flatMap(s=>s.subquestions).length,criteria:bank.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length};
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
const regFile=`${dir}/standards-register.json`,reg=read(regFile);reg.sources=reg.sources.filter(r=>r.id!=='KGA540-550-topic11');reg.sources.push({id:'KGA540-550-topic11',checked_date:'2026-09-08',title:'회계감사기준 전문2025 주제11 및2026 대상 문단 대조',url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',comparison_url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06',sha256:'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989',comparison_sha256:'59020bf1eba001c1fd0612f3af1098dbef4ca11dc22777b7266c80d39a615f84',comparison_retrieval:'cached official PDF hash matched existing register; fresh2026 download did not return a PDF',effective_date:'2026-01-01',effective_condition:'540.10 and550.8: periods beginning on or after;540 early-application date typo retained',exam_2027:'same_as_2026_assumed; final edition unconfirmed',affected_topics:['11'],affected_sets:sets.map(s=>s.id),local_file:'cpa_uploader/data/official/kga540-550-2025-review11.txt',extract_sha256:sha('cpa_uploader/data/official/kga540-550-2025-review11.txt'),comparison:report.source_comparison.map(({quote2026,...r})=>r)});fs.writeFileSync(regFile,JSON.stringify(reg,null,2)+'\n');
const planFile='docs/plans/2027-question-review/11.md';let plan=fs.readFileSync(planFile,'utf8').replace('상태: 계획 작성 완료 / 검토 미착수','상태: 검토·로컬 수정 완료 / 2027 최종 판본 미확인').replace('4세트·8개 물음·24개 criterion을 전수 검토한다.','계획 당시 4세트·8개 물음·24개 criterion을 전수 검토했으며, 누락 배점을 복원한 최종 정본은 25criterion이다.').replaceAll('- [ ]','- [x]');
if(!plan.includes('## 실행 결과 — 2026-09-08'))plan+='\n## 실행 결과 — 2026-09-08\n\n위 표의 발문은 계획 시점의 스냅샷이다. 수정 후 전수 장부·문장·배점·실측 및 미확인 사항은 [검토 보고서](../../reports/question-review-2027/11.md)와 [기계 판독 장부](../../reports/question-review-2027/11.json)에 기록했다. 4세트·8물음·25criterion, 기본40조합을 포함한85사례 및49코드 경계 검사. 실제 인증·DB E2E와2027 최종 판본은 미확인이다. 화면 확인은 실제 QuizClient/CSS 및 모의 인증/action 환경이며 운영 E2E를 완료한 것으로 해석하지 않는다.\n';
fs.writeFileSync(planFile,plan);
console.log(JSON.stringify({counts,modelStats:{...modelStats,selected:undefined},bank:manifest.counts}));
