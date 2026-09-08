import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {applyQuestionSetJudgment} from '../../../../lib/questionV3Grading.ts';
import {validateQuestionSetV3,compilePublicQuestionSet,computeQuestionSetMaxPoints} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const p='docs/reports/question-review-2027/grading-cases/',read=f=>JSON.parse(fs.readFileSync(f)),write=(f,d)=>fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n'),hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const b=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),sets=b.filter(s=>s.id.startsWith('pilot-13-')),before=read(p+'13-before.json'),v1=read(p+'13-after.json'),v2=read(p+'13-v2-after.json');
const pub=read('cpa_uploader/data/cpa_question_sets_v3.public.json'),dec=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY));
const meta1=read(p+'13-run-metadata.json'),meta2=read(p+'13-v2-run-metadata.json');
const logs1=fs.readFileSync(p+'13-live.jsonl','utf8').trim().split('\n').map(JSON.parse),logs2=fs.readFileSync(p+'13-v2-live.jsonl','utf8').trim().split('\n').map(JSON.parse);
const cases=read(p+'13-v2-cases.json');
const code=Object.fromEntries(['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts'].map(f=>[f,hash(fs.readFileSync(f))]));
for(const [f,h]of Object.entries(code)){assert.equal(h,meta1.hashes[f]);assert.equal(h,meta2.hashes[f]);}
const deployment=sets.map(s=>({set:s.id,public_matches:JSON.stringify(compilePublicQuestionSet(s))===JSON.stringify(pub.find(x=>x.id===s.id)),encrypted_matches:JSON.stringify(s)===JSON.stringify(dec.find(x=>x.id===s.id)),validation:validateQuestionSetV3(s,{verifySourceQuotes:true,cwd:process.cwd()}).errors,hashes:s.source_refs.every(r=>hash(r.source_quote)===r.content_hash)}));
for(const s of sets){assert.deepEqual(s,v2.find(x=>x.id===s.id));assert.ok(!/model_answer|critical_facts|source_quote|requirements|content_hash/.test(JSON.stringify(compilePublicQuestionSet(s))));}
const effective=[];
for(const c of cases.filter(c=>c.live&&c.variant!=='empty')){
 const use1=['pilot-13-001','pilot-13-002'].includes(c.set_id),meta=use1?meta1:meta2,logs=use1?logs1:logs2,s=sets.find(s=>s.id===c.set_id);
 if(use1)assert.deepEqual(s,v1.find(x=>x.id===s.id));
 const matches=logs.filter(r=>r.id===c.id&&r.fingerprint===meta.fingerprint);assert.ok(matches.length,c.id);
 for(const r of matches){assert.ok(!r.error);const result=r.raw_judgment?applyQuestionSetJudgment(s,c.answers,r.raw_judgment):r.result;assert.equal(result.score,c.expected_score,c.id);
  const diffs=[];for(const q of c.expected.subquestions)for(const v of q.verdicts){const a=result.subquestions.find(x=>x.subquestion_id===q.subquestion_id).criteria.find(x=>x.criterion_id===v.criterion_id);if(a.verdict!==v.verdict)diffs.push({q:q.subquestion_id,c:v.criterion_id,actual:a.verdict,expected:v.verdict});}
  assert.equal(diffs.length,0,c.id);assert.equal(r.raw_differences?.length||0,0,c.id);
  effective.push({id:c.id,attempt:r.attempt,source:use1?'13-live.jsonl':'13-v2-live.jsonl',mode:r.responses.length?'actual_model':'empty_no_call',score:result.score,differences:diffs,raw_differences:r.raw_differences||[],reprocessed_with_current_code:!!r.raw_judgment});
 }
}
const stats=logs=>({scenarios:logs.length,unique_scenarios:new Set(logs.map(r=>r.id)).size,actual_http_requests:logs.reduce((n,r)=>n+r.requests.length,0),actual_http_responses:logs.reduce((n,r)=>n+r.responses.length,0),mismatch_records:logs.filter(r=>r.error||r.differences?.length||r.raw_differences?.length).length});
const result={at:new Date().toISOString(),scope:{sets:sets.length,questions:sets.flatMap(s=>s.subquestions).length,criteria:sets.flatMap(s=>s.subquestions.flatMap(q=>q.criteria)).length,points:sets.reduce((n,s)=>n+computeQuestionSetMaxPoints(s),0)},code,topic_hash:hash(JSON.stringify(sets)),authoring_sha256:hash(fs.readFileSync('cpa_uploader/data/cpa_question_sets_v3.authoring.json')),deployment,first_run:stats(logs1),second_run:stats(logs2),offline:{cases:read(p+'13-v2-offline.json').offline.length,mismatches:read(p+'13-v2-offline.json').offline.filter(x=>x.differences.length).length,boundaries:read(p+'13-v2-offline.json').boundaries.length},effective};
write(p+'13-final-validation.json',result);console.log(JSON.stringify({...result,effective:{records:effective.length,unique_scenarios:new Set(effective.map(x=>x.id)).size,mismatches:effective.filter(x=>x.differences.length).length}}));
// Complete per-question ledger, preserving every original criterion and source link.
const notes={
 'pilot-13-001/sub1':'책임 불경감 2명제 유지; 공식 문단 교정; 한 문장 양자 설명 인정',
 'pilot-13-001/sub2':'발문 근거 누락 복원, 법규상 언급 시 책임 표시 추가; +2점',
 'pilot-13-002/sub1':'기능 평가 3요소 유지; 앞N 제한 제거; 610.15 직접 연결',
 'pilot-13-002/sub2':'전문가 합의4요소 유지; 보고서 형태 포함; 앞N 제한 제거',
 'pilot-13-003/sub1':'국내·그룹 부문감사 금지 +1점, 허용 국가 가정 분리, 서면 입수 상대방 강화',
 'pilot-13-003/sub2':'후속업무 합의+추가 감사절차 유지; 모두 작성',
 'pilot-13-004/sub1':'무조건 활용과 여부 결정 구분, 서술형 교정',
 'pilot-13-004/sub2':'총괄 적합성 결론으로 명료화; 세부항목을 추가 채점하지 않음; 다른 주체·목적 반례',
 'pilot-13-005/sub1':'610.16(a) 직접 근거 및 조건 설명; 문단번호 요구 제거; 함축 결론 판정 보강',
 'pilot-13-005/sub2':'기본 요건 충족 전제 및 독립 상황, 활용 축소·직접 수행 확대의 양방향 관계 유지',
};
const ledger={topic:'13',date:'2026-09-08',baseline_assumption:'2026 시행 기준 동일 적용; 2027 최종 시험 판본 미확인',before:{sets:5,questions:10,criteria:21,points:21,sha256:hash(fs.readFileSync(p+'13-before.json'))},after:result.scope,verification:'grading-cases/13-final-validation.json',scope_notes:{ui:'actual QuizClient/CSS; auth/action mocked, no live DB E2E',linked_topics:['01','08','14'],service_organization_402:'현재5세트에 독립 문항 없음; 신규 출제하지 않음'},sets:sets.map(s=>({id:s.id,title_before:before.find(x=>x.id===s.id).title,title_after:s.title,shared_context_before:before.find(x=>x.id===s.id).shared_context,shared_context_after:s.shared_context,status:s.status,review_status:s.verification.review_status,questions:s.subquestions.map(q=>{const old=before.find(x=>x.id===s.id).subquestions.find(x=>x.id===q.id);return {id:`${s.id}/${q.id}`,review:'전수 대조 및 수정/재검증',domain_notes:notes[`${s.id}/${q.id}`],prompt_before:old.prompt,prompt_after:q.prompt,type_before:old.type,type_after:q.type,model_answer_before:old.model_answer,model_answer_after:q.model_answer,points_before:old.criteria.reduce((n,c)=>n+c.max_points,0),points_after:q.criteria.reduce((n,c)=>n+c.max_points,0),requirements:q.requirements,criteria:q.criteria.map(c=>({id:c.id,existed_before:old.criteria.some(x=>x.id===c.id),before:old.criteria.find(x=>x.id===c.id)||null,after:c,source_refs:s.source_refs.filter(r=>c.source_ref_ids.includes(r.id)).map(r=>({id:r.id,file:r.file,page:r.page,content_hash:r.content_hash})),test_cases:cases.filter(x=>x.set_id===s.id).map(x=>x.id)}))};})}))};write('docs/reports/question-review-2027/13.json',ledger);
