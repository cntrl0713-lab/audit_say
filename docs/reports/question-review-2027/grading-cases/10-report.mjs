import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {applyQuestionSetJudgment} from '../../../../lib/questionV3Grading.ts';
import {validateQuestionSetV3,compilePublicQuestionSet} from '../../../../lib/questionV3.ts';
import {decryptAuthoringQuestionBankV3} from '../../../../lib/questionV3Encryption.ts';
const d='docs/reports/question-review-2027',g=d+'/grading-cases',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),sha=p=>hash(fs.readFileSync(p));
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),sets=bank.filter(s=>s.id.startsWith('pilot-10-')),before=read(g+'/10-before.json'),v1=read(g+'/10-v1-authoring.json');
const cases=read(g+'/10-cases.json'),meta=read(g+'/10-run-metadata.json'),oldmeta=read(g+'/10-v1-run-metadata.json'),offline=read(g+'/10-offline.json');
const raw=fs.readFileSync(g+'/10-live.jsonl','utf8').trim().split('\n').map(JSON.parse);
for(const s of sets){assert.deepEqual(validateQuestionSetV3(s,{verifySourceQuotes:true}).errors,[]);if(s.id!=='pilot-10-001')assert.deepEqual(s,v1.find(x=>x.id===s.id));}
for(const p of ['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts']){assert.equal(meta.hashes[p],sha(p));assert.equal(oldmeta.hashes[p],sha(p));}
const final=[];
for(const c of cases.filter(c=>c.live&&c.variant!=='empty')){
 const fp=c.set_id==='pilot-10-001'?meta.fingerprint:oldmeta.fingerprint;
 const rr=raw.filter(r=>r.id===c.id&&r.fingerprint===fp);assert.ok(rr.length,c.id);
 const r=rr.at(-1);assert.ok(!r.error,c.id);if(!r.raw_judgment){assert.equal(r.requests.length,0);assert.equal(r.result.score,0);assert.equal(c.expected_score,0);continue;}const s=sets.find(s=>s.id===c.set_id),applied=applyQuestionSetJudgment(s,c.answers,r.raw_judgment);
 assert.equal(applied.score,c.expected_score,c.id);for(const q of c.expected.subquestions)for(const v of q.verdicts)assert.equal(applied.subquestions.find(x=>x.subquestion_id===q.subquestion_id).criteria.find(x=>x.criterion_id===v.criterion_id).verdict,v.verdict,c.id);
 assert.deepEqual(applied,r.result,c.id);assert.equal(r.differences.length,0);assert.equal(r.raw_differences.length,0);
 final.push({case_id:c.id,set_id:c.set_id,selected_fingerprint:fp,attempts:rr.length,raw_and_final_match:true,score:applied.score,evidence_mode:c.set_id==='pilot-10-001'?'new calls after criterion clarification':'original live calls; complete set, prompt/schema/instructions/model and scoring code unchanged; raw re-applied'});
}
const counts={sets:sets.length,subquestions:sets.flatMap(s=>s.subquestions).length,criteria:sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).length,points:sets.flatMap(s=>s.subquestions).flatMap(q=>q.criteria).reduce((n,c)=>n+c.max_points,0)};
const usage=raw.reduce((n,r)=>{for(const x of r.responses){n.input+=x.body.usage?.input_tokens||0;n.output+=x.body.usage?.output_tokens||0;}return n;},{input:0,output:0});
const models=[...new Set(raw.flatMap(r=>r.responses.map(x=>x.body.model)).filter(Boolean))];
const changes=[
 ['P2','A5 대상 정의2+완전성 증거1로 범위를 한정하고 열거형·모두 작성으로 정리. 넓은 모집단 고려사항 질문에 특정 세 사항만 인정하던 모호성 해소.','범위 명료화 / 3점 유지'],
 ['P1','효율성·변동성·표본규모의 세 명제와 이유는 유지. 표본위험 증가 없는 표본규모 축소가 효율성 향상을 분명히 함축하는 답안도 인정하도록 criterion 명료화.','정당한 표현 인정 / 3점 유지'],
 ['P1','경영진주장·해당되는 세부테스트 조건, 데이터 신뢰성의 다섯 고려요소, 개별 또는 합산 중요왜곡표시 식별 정밀도를 발문·모범답안·criterion에 일치시킴.','빠진 조건 복원 / 4점 유지'],
 ['P3','다른 관련정보·유의적인 금액 차이·변동이나 관계로 발문 표현 교정. 질문+관련 적합한 증거와 상황에 필요한 기타 절차의 두 criterion 유지.','의미 유지 / 2점 유지'],
 ['P1','절차가 적용되지 않고 이탈도 아닌 항목과, 설계된 절차·대체적 절차 모두 불능인 항목을 구분하는 두 상황을 제시. A14–A16 직접 근거 추가.','상황 혼동 해소 / 3점 유지'],
 ['P1','변이 판단의 추가 감사절차와 충분하고 적합한 증거 요건을 마지막 criterion에도 명시. 조사1·영향평가2·변이요건2 모두 작성.','증거 요건 복원 / 5점 유지'],
 ['P2','표본위험 정의와 충분한 표본규모 기준은 유지. 실제 묻지 않는 두 형태를 제목에서 삭제. 정의의 공식5(c)와7 인용 및 실제 해시 연결.','문항 의미 유지 / 2점 유지'],
 ['P1','투영하지 않으면 표본위험이 커진다는 단정의 근거 부족을 수정. 일반 투영의 변이 제외 전제와 A18 목적·A22 위험 한계 복원. 서술형으로 정정.','근거 오류 수정 / 2점 유지'],
 ['P3','모든 표본단위 추출 기회 요건은 유지. 가짜 해시를 실제 SHA-256으로 교체. 동일 확률이 필수라는 숨은 조건 없음.','의미 유지 / 1점 유지'],
 ['P1','004/sub2와 같은 투영 의무를 반복하던 문항을 변이로 밝혀진 왜곡표시의 투영 제외·미수정 효과 가산으로 수정. 판단/조치의 중복 배점도 두 독립 명제로 정리.','학습 범위 조정, 예외 보완 / 2점 유지']
];
let i=0;const ledger=sets.flatMap(s=>s.subquestions.map(q=>{const prev=before.find(x=>x.id===s.id).subquestions.find(x=>x.id===q.id),ch=changes[i++];return{key:s.id+'/'+q.id,set_id:s.id,subquestion_id:q.id,priority:ch[0],finding_and_fix:ch[1],impact:ch[2],before:prev,after:q,title_before:before.find(x=>x.id===s.id).title,title_after:s.title,context_before:before.find(x=>x.id===s.id).shared_context,context_after:s.shared_context,criteria:q.criteria.map(c=>({id:c.id,claim:c.claim,max_points:c.max_points,partial_allowed:c.scores.partial!==undefined,direct_sources:c.source_ref_ids.map(id=>s.source_refs.find(x=>x.id===id)),result:'source + prompt + answer + criterion reviewed'})),source_status:'official2025 / official2026 comparison equal; 2026 effective; 2027 same assumed',language:'제목·상황·발문·모범답안 전수 대조; 수정 전후 전문 보존',ui:'actual QuizClient / synthetic action+auth; 1440 and390 confirmed',status:'reviewed_and_locally_corrected'};}));
const publicBank=read('cpa_uploader/data/cpa_question_sets_v3.public.json'),encrypted=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY));
const deployment={public_matches:sets.every(s=>JSON.stringify(compilePublicQuestionSet(s))===JSON.stringify(publicBank.find(x=>x.id===s.id))),encrypted_matches:sets.every(s=>JSON.stringify(s)===JSON.stringify(encrypted.find(x=>x.id===s.id))),private_data_not_in_public:sets.every(s=>!/source_quote|critical_facts|model_answer|requirements|content_hash/.test(JSON.stringify(compilePublicQuestionSet(s))))};assert.ok(Object.values(deployment).every(Boolean));
const report={topic:'10',date:'2026-09-08',counts,record_complete:true,exam_2027_suitability:'pending final exam edition; isolated live auth/DB E2E not run',ledger,source_comparison:read(g+'/10-source-comparison.json'),source_file:'cpa_uploader/data/official/kga520-530-2025-review10.txt',cases:{base_question_answer_combinations:50,total_set_cases:cases.length,mock_passes:offline.offline.length,boundaries:offline.boundaries.length,empty_model_calls:0,unique_live_cases:final.length,actual_live_calls:raw.reduce((n,r)=>n+r.requests.length,0),models,usage,initial_mismatching_cases:[...new Set(raw.filter(r=>r.fingerprint===oldmeta.fingerprint&&r.differences.length).map(r=>r.id))],final_mismatches:0,final},deployment,hashes:Object.fromEntries(['cpa_uploader/data/cpa_question_sets_v3.authoring.json','cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json','lib/questionV3.ts','lib/questionV3Grading.ts',g+'/10-before.json','cpa_uploader/data/official/kga520-530-2025-review10.txt'].map(p=>[p,sha(p)])),cross_topics:[{topic:'07',sets:['pilot-07-001','pilot-07-003'],finding:'330.21 유의적 위험 실증절차만 접근의 세부테스트 필요와520.5 적합성 고려는 맥락이 다름.330.17 통제이탈 대응과530.12–13 표본이탈 조사·변이 판단은 모순 없음.'},{topic:'08',sets:['pilot-08-005'],finding:'500의 표본·특정항목 추출 구별과530 모든단위 기회·표본 결과의 모집단 투영이 일치. 특정항목 선택을 표본으로 간주하지 않음.'},{topic:'11',sets:['pilot-11-002','pilot-11-004'],finding:'회계추정치 감사인 점·범위추정과520 기록금액·비율 기대치는 다른 맥락. 유의적위험에 대한 세부테스트 필요 조건 유지.'},{topic:'12',sets:['pilot-12-003','pilot-12-006','pilot-12-008'],finding:'계속기업 현금흐름 예측 데이터 신뢰성과520 데이터 신뢰성은 목적이 다름. 변이는 명백하게 사소한 왜곡표시와 다르며, 미수정 변이는 효과 고려가 필요하므로450 집계·수정 요청과 모순 없음.'}],unverified:[{id:'10-E01',priority:'P2',issue:'2027 최종 시험 판본 지정 미확정;2026 시행 기준 동일 적용 가정 유지'},{id:'10-E02',priority:'P2',issue:'운영 실계정/DB 제출·진도·경험치 E2E 미실행. 이번 데이터 수정으로 인증·DB 보장까지 확정하지 않음'}],coverage_gaps:['표본위험의 효과성/효율성 두 형태는 정의 인용의 앞뒤로 검토했으나 본 10물음에서 별도 출제하지 않음. 제목의 잘못된 범위는 정정.','계층별 투영·통제테스트 명시적 투영 불필요는 연계 검토 및 wiki에 기록. 실제 산술 문제는 추가하지 않음.']};
fs.writeFileSync(d+'/10.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(g+'/10-final-verification.json',JSON.stringify({counts,cases:report.cases,deployment,hashes:report.hashes},null,2)+'\n');
const rows=ledger.map(l=>`| ${l.key} | ${l.after.criteria.map(c=>c.id).join(', ')} | ${l.finding_and_fix} | ${l.impact} |`).join('\n');
fs.writeFileSync(d+'/10.md',`# 주제10 — 분석적절차와 표본감사 검토·수정

2026-09-08. **5세트·10물음·27criterion 전수 검토·로컬 수정 완료. 총27점 유지.** 2027 시험 사용 적합은 최종 시험 판본 지정 확인 전까지 보류한다. 기록 완료와 시험 판본 확정은 별도다.

## 기준과 출처

[한국공인회계사회 2025 개정 전문](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06)과 [2026 개정 전문](https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06)의 520·530을 대조했다. 관련11개 페이지는 공백·페이지 번호를 제외하면 동일하다. 520.2와530.3은2026-01-01 이후 개시 보고기간 감사에 시행된다. 2027은2026 시행 기준 동일 적용 가정을 유지하며 [출제범위 사전예고](https://www.fsc.go.kr/no010104/86803)를 특정 판본의 최종 지정으로 해석하지 않는다.

공식 PDF의 기존 로컬 다운로드를 pypdf로 읽고 판본 해시를 기준대장과 대조했다. 공식 게시목록은 이번 검토에서 다시 확인했다. 원문 줄바꿈은 보존하고, 검증기가 요구하는 KGA 구간 머리말만 추출 파일에 추가했다. 인용15개를 실제 SHA-256으로 연결했으며 출처·요구사항의 문단·PDF쪽·URL과27개 criterion 대응은 [10.json](10.json)에 기록했다. 기존 게시·검수 상태를 승급하지 않았다.

## 물음별 발견과 수정

| 물음 | criterion ID | 발견·수정 | 의미·배점 |
| --- | --- | --- | --- |
${rows}

제목·상황·발문·모범답안 전 문장을 대조했다. 수정 전후 전문은 장부에 보존했다. 001/subq1의 모집단 고려사항은 A5의 정의2+증거1로 명확히 했고,002는 설계/수행 전과 결과 조사 후의 상황을 분리했다. 003은 각 상황을 독립적으로 답할 수 있도록 명시했다. 004의 표본위험 두 형태는 실제 출제 범위가 아니므로 제목을 고쳤다. 005/sub2는004의 투영 요구와 중복되던 문항을 변이 예외의 두 독립 명제로 바꿨다. 모두 작성·순서무관·항목수 제한없음·정수 배점이며 개수 초과만으로 감점하지 않는다. 산술 요구는 없다.

## 실제 채점과 코드 검증

- 기본50개 물음-답안 조합, 은행 모범답안10개, criterion별 누락과 동일 인용·역순/추가 문장·반복 사실 및6개 특화 반례를 작성했다. 총${cases.length}개 세트 사례의 모의 응답 검증과${offline.boundaries.length}개 코드 경계 검증이 통과했다.
- 27개 criterion 각각 정답·반대 의미·partial 불허를 확인했다. 전부 빈 답안5세트는 모델0회·0점이다. 한 물음만 빈 경우의 귀속, 허위·다른 물음 인용 차단, 정상 salad 신호의 비감점과 injection 보정을 분리 검증했다.
- 현재 기능 설정 ${meta.model}, 실제 응답 ${models.join(', ')}로 **총${raw.reduce((n,r)=>n+r.requests.length,0)}회 실제 호출**, 최종 계약의${final.length}개 고유 사례에서 raw 판정·실존 인용·코드 최종판정·점수 불일치0건. 입력${usage.input}·출력${usage.output}토큰. 원본 응답과 요청 입력 해시는 [10-live.jsonl](grading-cases/10-live.jsonl)에 보존했다.
- 최초 001의 효율성 함축 답안2개는 각각3회 모두1점 과소평가됐다. 기대값을 모델에 맞춰 낮추지 않고, 확정 표현 인정 정책을 해당 criterion에 명시했다. 변경된001 세트만 새로 실행했고 문제의 두 사례는 수정 후에도 각각3회 일치했다. 다른4세트는 전체 데이터와 모델·프롬프트·스키마·instructions·점수 코드 동일성을 확인한 뒤 기존 raw를 현재 코드로 재처리했다. 새 호출로 집계하지 않았다.
- 001/subq2의 효율성 문장을 삭제해도 표본위험 증가 없이 표본규모를 줄인다는 문장이 남으면 효율성은 함축된다. 이 사례는 누락으로 무조건0점 처리하지 않는다. 실제 핵심누락 경계는 omit-crit4/omit-crit5로 별도 확인했다.

모의 검증은 의미 판정의 증거가 아니므로 실제 호출과 따로 기록했다. 첫 실행과 수정 후 해시·정본·기대표는 v1 파일 및 최종 파일로 구별했다. 반복 성공은 영구적인 모델 무오류를 보장하지 않는다.

## 화면과 배포물

실제 QuizClient와 globals.css를 사용해5세트×1440/390폭의 문제·결과20화면을 확인했다. 각 발문·답안 슬롯 ID·전송 ID·결과 소속·모범답안·줄바꿈·가로넘침을 검사했다. 빈 답안 제출의 HTML 차단 없음,5,000자,서비스 오류 후 답안 보존,프로필 갱신 실패 후 결과 유지·재시도도 통과했다. 기존06 보고서의 당시 공통 화면 결함은 현재 코드에서는 재현되지 않았다. 본 작업이 공통 코드를 수정한 성과로 집계하지 않는다. [UI 검사](grading-cases/10-ui-results.json), [모바일 연락판](grading-cases/10-contact-390.png), [데스크톱 연락판](grading-cases/10-contact-1440.png).

정본을 공개본·암호화본으로 컴파일했고, **주제10은 최종 공개 변환·복호화 결과와 일치**하며 공개본에 정답·requirements·source quote·criteria 비공개 데이터가 없다. 화면의 action/auth는 합성 어댑터로 운영 인증·DB E2E가 아니다. 현재 다른 주제의 병행 변경으로 전체은행 검증 상태가 바뀔 수 있어 실행 시각별 결과를 별도 기록한다.

## 연계 주제와 지침

07의 유의적 위험 대응·통제 이탈,08의 표본/특정항목 추출,11의 감사인 추정치,12의 계속기업 예측·미수정왜곡표시와 대조했다. 목적·조건이 다른 유사 절차를 같은 명제로 취급하지 않았다. 변이를 사소한 왜곡표시로 해석하거나 미수정 효과를 무시하는 처리는 허용하지 않는다. 자세한 대상 ID와 대조는 장부에 있다. 미검토 연계 주제의 전체 적합성을 승인한 것은 아니다.

wiki question-design에 분석절차 고려사항, 항목 교체/증거 미입수, 변이·투영·추출확률 구분을 추가했다. 생성 대상의 주제10 제목·형식·criterion 현황을 정본으로 갱신했다. audit-question-review 스킬에 해당 지침을 읽도록 범위를 한정한 안내를 추가했고 skill-creator 검사도 통과했다.

## 남은 확인

- 10-E01(P2): 2027 최종 시험 판본 지정 미확정.
- 10-E02(P2): 운영 실계정·DB의 제출/경험치 E2E 미실행. 합성 화면 검증으로 대체했다고 하지 않는다.
- 표본위험 두 형태와 계층별 투영은 검토 문맥·wiki에는 포함했지만 이10물음의 별도 출제 범위는 아니다.

최종 명령 결과는 [검증 기록](grading-cases/10-checks.json)을 따른다. 대상 외 병행 수정의 실패를 주제10 내용 결함으로 합산하거나 전체 검증 통과로 표시하지 않는다.
`);
console.log(JSON.stringify({counts,cases:cases.length,live:raw.length,unique:final.length,usage,deployment}));
