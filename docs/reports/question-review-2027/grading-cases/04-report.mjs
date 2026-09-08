// Produce the internal topic ledger from preserved evidence. Run after evaluations finish.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { compilePublicQuestionSet, computeQuestionSetMaxPoints } from '../../../../lib/questionV3.ts';
import { decryptAuthoringQuestionBankV3 } from '../../../../lib/questionV3Encryption.ts';
import { applyQuestionSetJudgment } from '../../../../lib/questionV3Grading.ts';
const dir='docs/reports/question-review-2027', casesDir=`${dir}/grading-cases`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const bank=read('cpa_uploader/data/cpa_question_sets_v3.authoring.json'),sets=bank.filter(s=>s.classification.topic_id==='04');
const baseline=read(`${casesDir}/04-baseline.json`),metadata=read(`${casesDir}/04-run-metadata.json`),cases=read(`${casesDir}/04-cases.json`),offline=read(`${casesDir}/04-offline.json`),ui=read(`${casesDir}/04-ui-results.json`);
const runs=fs.readFileSync(`${casesDir}/04-live.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
// Reuse only exact final prompt/schema/model and unchanged grading code. Whole-bank hash changes
// in concurrent, unrelated topic work do not authorize stale criterion results.
const eligible=r=>r.requests?.at(-1)?.prompt_sha256===metadata.expected_prompt_hashes[r.id]&&r.requests.at(-1).model===metadata.model&&hash(JSON.stringify(r.requests.at(-1).text))===metadata.expected_schema_sha256&&r.requests.at(-1).instructions===metadata.expected_api_instructions;
const effective=cases.filter(c=>c.live!==false&&c.variant!=='empty').map(c=>{
  const rs=runs.filter(r=>r.id===c.id&&eligible(r));
  return {id:c.id,set_id:c.set_id,expected_score:c.expected_score,matching_runs:rs.map(r=>({attempt:r.attempt,fingerprint:r.fingerprint,at:r.at,result:r.result,raw_judgment:r.raw_judgment,differences:r.differences,raw_differences:r.raw_differences,error:r.error})),latest:rs.at(-1)};
});
assert.ok(effective.every(r=>r.latest),'Every final case needs an actual response with the final prompt hash');
const unresolved=effective.filter(r=>r.matching_runs.some(v=>v.error||v.differences?.length||v.raw_differences?.length));
for(const e of effective)for(const run of e.matching_runs){
  const c=cases.find(v=>v.id===e.id),s=sets.find(v=>v.id===e.set_id);
  assert.ok(Object.values(c.answers).every(a=>a.length<=5000));
  assert.deepEqual(applyQuestionSetJudgment(s,c.answers,run.raw_judgment),run.result);
}
const affectedHashes=['lib/questionV3.ts','lib/questionV3Grading.ts','lib/ai/openaiStructured.ts'];
for(const p of affectedHashes)assert.equal(sha(p),metadata.hashes[p]);
const pdf2025='https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const pdf2026='https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06';
const sources=[
 {standard:'KGA 300',paragraphs:['3','6(a)-(c)','8(e)','9(a)-(c)','12(a)-(c)','A7','A10'],pages2025:[180,181,182,184],pages2026:[205,206,207,209,210],change:'개정판 6(a)는 수용과 계속, 8 머리말에 220 정보 고려, 9(a)에 팀 지휘·감독·검토 추가, 종전9(a)-(c)는9(b)-(d), 종전12는11, 종전A10은A12. 개정 연계 적용 및 최종 시험 판본은 별도 확인 필요.'},
 {standard:'KGA 320',paragraphs:['7','9-14','A14'],pages2025:[306,307,308,311],pages2026:[332,333,334,337],change:'대상13·14의 금액·수정·문서화 명제는 두 전문에서 동일. 2027 시험 판본 지정 자체는 미확정.'},
 {standard:'KGA 230',paragraphs:['4','7','8(a)-(c)','14-16','A1','A21-A24'],pages2025:[71,72,73,79],pages2026:[96,97,98,104],change:'7·8·15의 대상 명제 동일. A21/A23은 품질관리시스템 연계 표현 변경, 일반적60일/5년과 기산점 유지. 공식8(a)에 머리말이 반복되어 있으며 PDF72쪽 이미지로 확인; 로컬 인용은 반복을 생략한 편집 원문.'},
].map(s=>({...s,id:`${s.standard.replace(' ','')}-topic04`,checked_date:'2026-09-08',baseline_effective_date:'2026-01-01',effective_condition:'이후 개시하는 보고기간의 재무제표 감사',exam2027:'2026 시행 기준 동일 가정; 최종 지정 미확인',url:pdf2025,comparison_url:pdf2026,local2025:'sources/kga-2025.pdf',local2026:'sources/03-kga-2026.pdf',sha2025:sha(`${dir}/sources/kga-2025.pdf`),sha2026:sha(`${dir}/sources/03-kga-2026.pdf`)}));
const basis=[
 ['300 A10',['300 A10','300 A10'],[184],[210],'결론과 상호변경 가능성의 근거를 독립1점씩 평가. 문장호응 교정, 의미 유지.'],
 ['320 13',['320 13','320 13'],[307],[333],'판단형→서술형. 재무제표 전체/해당 중요성 수준의 전제와 필요성 결정을 명료화. 자동 인하 아님.'],
 ['300 6(a)-(c)',['300 6(a)','300 6(b)','300 6(c)'],[180,181],[206],'세 예비적 활동을 모두 요구. 계속 여부·윤리 준수·조건 이해를 구별. 단순 나열 순서 제한 제거.'],
 ['300 12(a)-(c)',['300 12(a)','300 12(b)','300 12(c)'],[182],[207],'전략 자체, 계획 자체, 중요한 변경과 이유. 변경대상 이름의 단순 등장으로 전략·계획 문서화까지 중복 인정하지 않도록 보강.'],
 ['300 8(e)',['300 8(e)','300 8(e)','300 8(e)'],[181],[206],'자원의 성격·시기·범위 명칭이면 충족. 문장이나 번호 순서를 요구하지 않음.'],
 ['300 9(a)-(c)',['300 9(a)','300 9(b)','300 9(c)'],[181],[207],'발문은 절차 범주만 요구하므로 성격·시기·범위를 추가 배점하지 않음. 기준서 번호는 필수 아님. 경영진주장 수준은 보존.'],
 ['230 7',['230 7'],[71,73],[96,98],'발문이 적시 작성이라는 정답을 그대로 말하는 순환을 줄임. 적시작성 요구1점, A1 목적이나60일 취합기간은 별도 요구하지 않음.'],
 ['230 8(a)-(c)',['230 8(a)','230 8(b)','230 8(c)'],[71,72],[96,97],'머리말뿐이던 출처에 (a)-(c) 복원. 절차3측면/결과와증거/유의적사항·결론·유의적판단을 각 결합1점으로 유지.'],
 ['230 15',['230 15','230 15'],[73,79],[98,104],'저장공간 상황을 물음 안으로 이동. 결론1점과 모든성격의 문서라는 근거1점. 숫자는 요구하지 않지만 명시한 법정기산점 오류는 결론의 조건훼손.'],
 ['320 14(a)-(d)',['320 14(a)','320 14(b)','320 14(c)','320 14(d)'],[307,308],[333,334],'머리말뿐이던 출처에 (a)-(d) 복원. 금액·고려요소를 각각 결합1점, 해당조건 및 수정금액의 결정요소 복원. 공통 요소 서술은 각 금액에 적용 허용.'],
];
const questions=sets.flatMap(s=>s.subquestions.map(q=>({s,q}))).map(({s,q},i)=>{
 const before=baseline.sets.find(v=>v.id===s.id).subquestions.find(v=>v.id===q.id),b=basis[i];
 return {key:`${s.id}/${q.id}`,set_id:s.id,subquestion_id:q.id,review_status:'reviewed_and_locally_corrected',application2027:'same_as_2026_assumed',basis:b[0],official_url:pdf2025,official_pages:b[2],comparison_url:pdf2026,comparison_pages:b[3],finding:b[4],before,after:q,meaning_change:JSON.stringify(before.criteria)!==JSON.stringify(q.criteria)?'채점요건 명료화 또는 누락 복원; 정수배점 유지':'표현/범위 안내 정리 또는 유지; 정수배점 유지',criteria:q.criteria.map((c,j)=>({id:c.id,requirement_id:c.requirement_id,source_ref_ids:c.source_ref_ids,official_paragraph:b[1][j],claim:c.claim,critical_facts:c.critical_facts,points_before:before.criteria.find(x=>x.id===c.id).max_points,points_after:c.max_points,partial_allowed:false,positive_case:`${s.id}-full`,negative_case:`${s.id}-contrary`,partial_boundary:'04-offline.json boundaries: partial-disallowed'})),base_cases:cases.filter(c=>c.set_id===s.id&&['full','paraphrase','omission','contrary','empty'].includes(c.variant)).map(c=>c.id),ui:ui.records.filter(r=>r.set_id===s.id)};
});
const issues=[
 {id:'04-D01',priority:'P1',target:['pilot-04-004/sub2','pilot-04-005/sub2'],problem:'머리말만으로 하위 정답을 뒷받침한 출처',fix:'230.8(a)-(c),320.14(a)-(d)를 source/requirement에 복원하고 실제 quote 해시 갱신',status:'fixed',evidence:'은행 source 존재 검사와10 source SHA-256 확인'},
 {id:'04-D02',priority:'P1',target:['pilot-04-005/sub2/crit3-crit6'],problem:'정답·기준서의 결정 고려요소 및 해당조건을 criterion이 요구하지 않음; 수정금액 고려요소가 모범답안에 없음',fix:'발문·정답·각 결합criterion 동시 복원, 총4점 유지',status:'fixed',evidence:'materiality-names-without-factors=0; common-factors-one-sentence=4; condition-denied=0'},
 {id:'04-D03',priority:'P1',target:['pilot-04-003/sub2/crit4-crit5'],problem:'범주 답안에 기준서 번호를 요구하는 불안정 판정',reproduction:'pilot-04-003-full',before:'v1은4/6,6/6,6/6으로 흔들림; 코드 보정 전 raw부터2criterion 미충족',fix:'기준서 번호 자체는 필수가 아님을 명시; 주장수준은 유지',status:'fixed_and_remeasured'},
 {id:'04-D04',priority:'P1',target:['pilot-04-005/sub1/crit1'],problem:'법정 보존기간 기산점을 취합완료일로 바꾼 답안에 득점',reproduction:'wrong-start-date',before:'v1 세 번 모두2점(기대1)',fix:'날짜 작성은 요구하지 않되 명시적 기산점 오류는 금지조건 훼손이라고 명료화',status:'fixed_and_remeasured'},
 {id:'04-D05',priority:'P1',target:['pilot-04-002/sub2/crit4-crit5'],problem:'변경내용만 기록한다는 답안에서 변경대상인 전략·계획 이름을 별도 문서화 항목으로 과대 인정',reproduction:'change-without-reason',before:'v1 0점, v2 세 번 모두2점(기대0); raw 모델 판정 오류',fix:'전략·계획 자체 문서화와 변경대상 명칭의 등장을 구별',status:unresolved.some(r=>r.id==='change-without-reason')?'open_model_mismatch':'fixed_and_remeasured'},
 {id:'04-D06',priority:'P2',target:['all topic04 enumeration'],problem:'모두작성 정책과 기존 max_entries/ignore_after_limit 불일치',fix:'6열거물음을 all/n:null, ordered:false, max_entries:null, overflow:none으로 정합화',status:'fixed',evidence:'6 reverse-overflow cases'},
 {id:'04-D07',priority:'P2',target:['pilot-04-001/sub2','pilot-04-004/sub1','pilot-04-005'],problem:'후속조치 물음 오분류, 정답을 반복하는 발문, 관련없는 공통상황·좁은 제목',fix:'서술형 교정, 적시라는 정답 표현을 발문에서 제거,005 독립상황·중립 제목; 전체 문장 before/after 장부',status:'fixed'},
 {id:'04-C01',priority:'P1',target:['lib/questionV3.ts','all 19 topics'],problem:'동일 인용의 독립 명제가 코드에서 감점',fix:'인용문자열 승자 선택 제거; 인용실존·물음격리·criterion합산 유지',status:'fixed',evidence:'same-quote-independent=2; 전체96세트 mock 합산검사'},
 {id:'04-C02',priority:'P1',target:['lib/questionV3Grading.ts','all 19 topics'],problem:'정상 명칭 나열을 salad로 오탐하고 일괄0점',fix:'명칭 요구는 명칭으로 인정하는 프롬프트와 criterion별 판정. salad만으로 전체/개별0점 제거; injection은 유지',status:'fixed',evidence:'names-only=3; global/local salad 및 injection mock 경계'},
 {id:'04-C03',priority:'P2',target:['app/quiz/QuizClient.tsx','app/actions.ts'],problem:'화면20000자와 action5000자 불일치; HTML required가 빈물음 제출 차단',status:'open_existing_common_issue',followup:'question-review-01-03-remediation.md §6 공통 제출경로 구현에서 처리; 이번 문항·핵심 채점 수정 범위와 구분'},
 {id:'04-C04',priority:'P2',target:['app/quiz/QuizClient.tsx'],problem:'채점 완료 후 refreshProfile 실패가 풀이화면 복귀를 유발',status:'open_existing_common_issue',evidence:'04-ui-results.json 10행',followup:'공통 결과·진도 경로 수정에서 처리'},
 {id:'04-A01',priority:'P1',target:['pilot-04-001/sub1','pilot-04-002','pilot-04-003/sub2'],problem:'2026개정300에서 항목·문단번호 변경,2027최종 시험판본 미확인',status:'edition_assumption_open',followup:'2026 시행 기준 가정 유지. 시험판본 확정 시300.6/9/11/A12와 현행 문항 재대조'},
];
const currentHashes=Object.fromEntries(['cpa_uploader/data/cpa_question_sets_v3.authoring.json','cpa_uploader/data/cpa_question_sets_v3.public.json','data/cpa_question_sets_v3.authoring.enc.json',...affectedHashes,'app/quiz/QuizClient.tsx',`${casesDir}/04-inputs.json`,`${casesDir}/04-run.mjs`].map(p=>[p,sha(p)]));
for(const issue of issues.filter(i=>['04-C03','04-C04'].includes(i.id))){
  issue.status='fixed_in_concurrent_work_reverified_here';
  issue.fix='병행 작업의 공통 UI/action 수정 반영 후10회 화면 재검증: 빈답안 제출 가능,5000자 한도,프로필 갱신 실패에도 결과 유지·프로필만 재시도';
  issue.followup='운영 인증·DB·경험치 동시성 E2E는 미실행';
}
const published=read('cpa_uploader/data/cpa_question_sets_v3.public.json'),decrypted=JSON.parse(decryptAuthoringQuestionBankV3(fs.readFileSync('data/cpa_question_sets_v3.authoring.enc.json','utf8'),process.env.CPA_QUESTION_V3_ENCRYPTION_KEY));
const deployment={all_public_match:JSON.stringify(published)===JSON.stringify(bank.map(compilePublicQuestionSet)),all_encrypted_match:JSON.stringify(decrypted)===JSON.stringify(bank),topic_source_hashes_match:sets.every(s=>s.source_refs.every(r=>r.content_hash===hash(r.source_quote))),private_public_fields_absent:!JSON.stringify(published).match(/"(?:source_quote|model_answer|requirements|criteria|critical_facts)"\s*:/)};
assert.ok(Object.values(deployment).every(Boolean));
const usage=runs.reduce((a,r)=>{for(const response of r.responses){const u=response.body?.usage||{};for(const k of ['input_tokens','output_tokens','total_tokens'])a[k]+=(u[k]||0);}return a;},{input_tokens:0,output_tokens:0,total_tokens:0});
const report={topic_id:'04',reviewed_on:'2026-09-08',internal_only:true,scope:{sets:sets.length,questions:questions.length,criteria:questions.reduce((n,q)=>n+q.criteria.length,0),points:sets.reduce((n,s)=>n+computeQuestionSetMaxPoints(s),0)},review_record_status:'complete_with_documented_limitations',fit_for_2027:'withheld_pending_exam_edition_and_common_ui_work',baseline_hashes:baseline.hashes,current_hashes:currentHashes,sources,questions,set_reviews:sets.map(s=>({id:s.id,before:baseline.sets.find(v=>v.id===s.id).title,after:s.title,context_before:baseline.sets.find(v=>v.id===s.id).shared_context,context_after:s.shared_context,tags_before:baseline.sets.find(v=>v.id===s.id).classification.tags,tags_after:s.classification.tags,status_unchanged:s.status===baseline.sets.find(v=>v.id===s.id).status,verification_status_unchanged:s.verification.review_status===baseline.sets.find(v=>v.id===s.id).verification.review_status})),issues,grading:{base_question_answer_combinations:50,set_cases:cases.length,offline_mismatches:offline.offline.filter(r=>r.differences.length),offline_boundaries:offline.boundaries.length,live_calls_all_versions:runs.length,live_errors:runs.filter(r=>r.error).length,final_unique_live_cases:effective.length,final_unresolved:unresolved.map(r=>r.id),effective,usage,cache_policy:'Fresh live calls after contract changes. Final aggregation requires exact actual prompt SHA-256, model and schema, with unchanged parser/scorer. Reuse of unaffected set measurements is explicit; old mismatches remain in append-only JSONL.'},ui,source_limits:['공식230.8(a)의 머리말 반복을 로컬 편집 원문은 생략함. source_fidelity exact는 로컬 파일 일치만 의미, 공식PDF exact가 아님.','2027 시험의 최종 기준서 판본 지정과 개정300 연계 시행 적용 미확인.','기간 숫자 자체를 묻는 문항은 없음. 일반적 취합60일·보존5년은230 A21/A23 문맥 확인. 외부감사법상 법정기한의 숫자는 이번에 별도 확정하지 않음.'],cross_topic_review:[{topic:'06',finding:'315 위험평가절차 정의·세절차와04-003 계획된 위험평가절차 범주는 학습층위가 다름. 계획/수행 혼동 없음. 병행 수정된06 데이터의 최종내용 승인을 포함하지 않음.'},{topic:'07',finding:'330 경영진주장 수준 추가감사절차 설계·수행과04-001 적합성 재결정은 서로 다른 단계; 성격·시기·범위를 보존.'},{topic:'12',finding:'560 보고서일 후 사실에 따른 예외절차와230 최종파일 취합의 행정절차는 구별. 보고서일·발행일을 취합일로 대체하지 않음. 450 미수정왜곡표시의 평가와320 계획 중요성 문서화는 별도 요구.'},{topic:'18',finding:'18-003/sub2는1200 작성·취합·보존의 일반요구,04-004/005는230 세부범주·삭제사례. 동일 취합완료/보존종료 경계, 직접모순 없음.'}],deployment,validation:{typecheck:'passed',bank:'passed:96 sets/192 questions/503 criteria/501 points',tests:'39 passed in8files; includes bank-wide mock only',ui:'10 set-width runs, actual QuizClient+CSS with mock auth/action; no live auth/DB E2E'},limitations:['정상사례는 원칙적으로1회,불일치3회. 반복성공은 확률적 무오류 보장이 아님.','기본변형은동의표현·띄어쓰기 위주이며 철자오타 전반 강건성평가가 아님.','UI는 전세트 자동 문구/슬롯/귀속/가로넘침 확인과 대표 화면 육안 확인. 운영 인증·DB·경험치E2E 미실행.','공통 입력/빈답안/프로필실패 및 보안감점 안내는 별도 미해결. 주제04 데이터와 직접채점 경로 수정이 운영전체완료를 뜻하지 않음.','병행 작업의06 데이터·검증기·wiki 변경은 본 작업이 만든 수정으로 집계하지 않음.'],artifacts:{baseline:'grading-cases/04-baseline.json',cases:'grading-cases/04-cases.json',raw:'grading-cases/04-live.jsonl',offline:'grading-cases/04-offline.json',ui:'grading-cases/04-ui-results.json'}};
assert.equal(report.scope.criteria,26);assert.equal(report.scope.points,26);
report.fit_for_2027='withheld_pending_exam_edition_and_live_db_e2e';
report.grading.current_code_replay_verified=true;
report.grading.compatibility_note='실측 후 병행 작업이5000자 한도 공통상수를 추가했다. 모든 사례는5000자 이하이며,현재 코드로 최종계약 raw판정을 전부 재합산하여 기록된 결과와 깊은동등성을 확인했다. 모델요청의prompt/schema/instructions/model도 모두 일치한다.';
report.limitations=report.limitations.filter(s=>!s.startsWith('공통 입력/빈답안/프로필실패'));
report.limitations.push('공통 UI의 입력한도·빈답안·프로필실패는 병행 수정 후 재검증했다. 운영 인증·DB·경험치 E2E와 보안감점 안내는 별도 확인이 필요하다.');
write(`${dir}/04.json`,report);
const rows=questions.map(q=>`| ${q.key} | ${q.criteria.map(c=>c.id).join(', ')} | ${q.basis} · PDF ${q.official_pages.join(',')}쪽 | ${q.finding} |`).join('\n');
const changes=questions.map(q=>`| ${q.key} | ${q.before.prompt} | ${q.after.prompt} | ${q.meaning_change} |`).join('\n');
const issueRows=issues.map(x=>`| ${x.id} | ${x.priority} | ${x.problem} | ${x.fix||x.followup||'장부 참조'} | ${x.status} |`).join('\n');
const md=`# 주제 04 — 감사계획과 중요성 검토·수정 결과

2026-09-08 · 내부 검토자료. **5세트·10물음·26criterion 전수 검토 및 로컬 수정, 총26점 유지.** 정본·공개본·암호화본을 갱신했다. 검토기록 완료와2027 시험사용 적합은 구별하며, 2027 최종 판본과 운영 인증·DB E2E 확인이 남아 있어 사용 적합 확정은 보류한다.

## 범위와 출처

기존 [수정 정책](../../plans/question-review-01-03-remediation.md)의 모두작성·정수합산·독립인용·정상명칭 인정 정책을 적용했다. 이전01–03 보고서와 원실측은 덮어쓰지 않았다. 상세before/after와 모든26criterion의 requirement/source 연결은 [04.json](04.json), 원상태·해시는 [baseline](grading-cases/04-baseline.json)에 있다. 게시/검수 상태를 승급하지 않았다.

2026 시행 기준의 [공식2025 전문](${pdf2025})을 기준으로 [공식2026 개정 전문](${pdf2026})과 대조했다. KGA300.3·320.7·230.4는2026-01-01 이후 개시 보고기간 적용이다. 2027 동일적용 가정은 유지한다. [출제범위 공고](https://www.fsc.go.kr/no010104/86803)는 최종 기준서 판본 지정과 같지 않다.

개정300은6(a)에 수용,9(a)에 업무팀 지휘·감독·검토를 포함하며, 종전9(a)–(c)는9(b)–(d),12는11,A10은A12로 바뀐다(PDF206–210쪽). 이 차이를 누락 없이 장부에 남겼다. [220시행일 메모](kga220-effective-date-note.md)와 관련 개정의 적용을 구분하며, 개정판 발행만으로 기존 세범주 문제를 네범주로 교체하지 않았다. 최종시험판본 확정 시 재검토해야 한다.

230.7/8/15와320.13/14의 대상 정답 명제는 유지된다. 로컬230.8(a)는 공식PDF72쪽의 머리말 반복을 생략한 편집 원문이다. **source_fidelity=exact는 연결된 로컬파일 일치이며 공식PDF의 완전 전재를 의미하지 않는다.** 머리말만이던 두source는 하위항목까지 보강하고10source의 실제SHA-256을 맞췄다.

적시작성(230.7), 보고서일 후 행정적 취합(14,A21–A22), 취합완료 후 보존종료 전 삭제금지(15), 취합 후 수정·추가의 문서화(16)를 구별했다. 일반적 취합완료는보고서일로부터60일 이내, 일반적 보존은감사보고서일(그룹감사보고서일)로부터5년 이상이다. 외부감사법 감사는15의 감사종료시점부터 법정기한이라는 별도 조건을 보존했다. 문항이 묻지 않는 법정기간 숫자를 새 채점요건으로 추가하지 않았다.

## 전수 장부

| 물음 | criterion | 직접 근거(2025전문) | 검토·수정 판단 |
| --- | --- | --- | --- |
${rows}

전 문장의 의미·부정·시점·주체·수식 범위를 대조했다.001 태그의 관련없는 감사문서/감사조서를 제거했다.005 제목은 ‘최종감사파일의 보존과 중요성의 문서화’, 공통사실은독립상황 안내로 바꾸고 저장공간 사례는sub1 안으로 옮겼다. 모든 모범답안의 전후문장은JSON에 보존했다. 단순항목순서와 절차상 의미순서를 구별했으며, 물음간 답안 의존성이나 선행정답 복사 요구를 추가하지 않았다.

| 물음 | 발문 이전 | 발문 수정 | 의미 영향 |
| --- | --- | --- | --- |
${changes}

## 발견과 수정

| ID | 우선순위 | 발견 | 수정·후속 | 상태 |
| --- | --- | --- | --- | --- |
${issueRows}

공통코드 수정은19주제·${bank.length}세트·${bank.reduce((n,s)=>n+s.subquestions.length,0)}물음에 영향을 준다. 점수와 인용검증은 계속 코드에서 처리한다. 동일criterion의 중복응답 검증·없는인용 차단·물음간 인용격리·injection 감점은 유지했다. 모든주제의내용까지 승인하거나 전체은행 열거계약을 이번에 이행했다는 뜻은 아니다. 다른주제의기존 선택계약/상한은 유지하며, 전체은행mock에서도 이를 확인했다. 공개화면의 ‘criterion’을‘채점기준’으로 바꾸고 명칭형에도 맞는 답안안내로 교정했다.

## 검증 결과

- 기본50개 물음–답안 조합(완전정답/동의표현/핵심누락/반대의미/빈답안)과 추가27세트사례를 [사례파일](grading-cases/04-cases.json)에 기록했다. 저장모범답안5세트,6열거물음 역순·초과,동일문장,반복사실,숫자만,잘못된기산점,누락조건,결론/근거분리 등을 포함한다.
- mock ${offline.offline.length}세트사례 불일치${offline.offline.filter(r=>r.differences.length).length}건. 별도${offline.boundaries.length}경계(26criterion partial금지·global/local보안4·물음간인용1) 통과. 빈답안5세트는API키 없이 모델호출0회·0점.
- 실제모델은실행시 기능설정 ${metadata.model}. 전버전 누적${runs.length}호출,서비스오류${runs.filter(r=>r.error).length}건. 최종계약과동일한요청으로측정한46개서로다른실제사례 중 미해결${unresolved.length}개. [raw판정/quote/보안/usage 및 코드최종점수](grading-cases/04-live.jsonl)를 함께 보존했다.
- 범주답안 번호누락,잘못된법정기산점,변경내용만기록의3개사례는불일치후총3회측정하고criterion을보강했다. 계약변경후영향세트는새로호출했다. 최종집계는실제 요청의 prompt SHA-256·모델·schema·instructions 일치를 확인한다. 실측 후 병행 작업에서 입력 한도 공통상수를 추가했으므로, 5,000자 이하인 모든 사례의 raw 판정을 최신 코드로 다시 합산해 이전 결과와 깊은 동등성도 확인했다. 변경 없는 세트의 동일 계약 측정은 보존해 사용한다. 최종불일치: ${unresolved.map(r=>r.id).join(', ')||'없음'}.
- 실제사용량(전버전): 입력${usage.input_tokens},출력${usage.output_tokens},합계${usage.total_tokens}토큰. 초기에46호출·입력약11.8만토큰을추정했고8,000출력토큰/호출상한,불일치재측정을기록했다. 추정은실제사용량과구별한다.
- npm run typecheck 통과. npm run questions:v3:validate 통과(96세트·192물음·503criterion·501점). 관련8테스트파일39개통과. 공개본/정본일치·암호화복호화왕복·비공개필드비노출통과.
- 실제QuizClient와CSS를사용하여5세트×1440/390px의10회화면실행. 문구·슬롯·제출ID·결과답안/모범답안귀속·가로넘침검사통과. 화면안내수정후재실행했다. [UI결과](grading-cases/04-ui-results.json). 인증과서버액션은합성어댑터이며운영DB/인증E2E가아니다.

UI의 빈 물음 제출 차단, 입력 길이 불일치, 프로필 갱신 실패 후 결과 소실을 처음에는 재현했다. 이후 병행 작업에서 해당 경로가 수정되어, 최신 코드의 10회 화면 검사에서 빈 답안 제출 가능·5,000자 한도·결과 유지와 프로필 재시도를 확인했다. 이전 UI 기록은 v1/v2 산출물에 보존했다. 이 변경은 병행 작업의 수정이며, 본 작업의 독자 수정으로 집계하지 않는다. 경험치·중복 제출의 DB E2E와 운영 배포는 수행하지 않았다.

## 연계와 남은 확인

06의위험평가절차와04의계획범주,07의주장수준추가절차와04의재평가,12의보고서일후사실에따른예외절차와230의행정적취합을구별했다.18-003의1200문서보존요구와04-005의230사례는같은취합완료/보존종료경계를사용하며직접모순은없다. 중복은정의·계획·수행·사례의학습층위차이로남겼다.

**발견·수정·검증완료:** 대상26criterion의근거장부,문항·정답·출처수정,두공통채점결함수정,공개/암호화산출물반영,위명령검증. **미확인·미해결:** 2027최종시험판본및300개정연계적용,운영 인증·DB·경험치 E2E,확률적모델의장기안정성. 문장변형은동의표현·띄어쓰기중심으로,광범위한철자오타강건성을검증한것은아니다. 작업중병행변경된06데이터·검증기·wiki는본작업의수정실적으로집계하지않는다.
`;
fs.writeFileSync(`${dir}/04.md`,md);
const registerPath=`${dir}/standards-register.json`,register=read(registerPath);
register.sources=register.sources.filter(s=>!sources.some(n=>n.id===s.id));register.sources.push(...sources.map(s=>({...s,affected_topics:['04'],affected_sets:sets.filter(v=>v.classification.standards.includes(s.standard)).map(v=>v.id)})));
if(!register.coverage.includes('04'))register.coverage+=', 04';write(registerPath,register);
const manifestPath='docs/plans/2027-question-review/manifest.json',manifest=read(manifestPath),topic=manifest.topics.find(t=>t.id==='04');
topic.status='reviewed_and_locally_corrected_with_limitations';topic.report='../../reports/question-review-2027/04.md';topic.question_sets.forEach(s=>{const actual=sets.find(v=>v.id===s.id);s.title=actual.title;s.subquestions.forEach(q=>{q.type=actual.subquestions.find(v=>v.id===q.id).type;q.status=topic.status;});});
manifest.topic04_review={authoring_sha256:currentHashes['cpa_uploader/data/cpa_question_sets_v3.authoring.json'],public_sha256:currentHashes['cpa_uploader/data/cpa_question_sets_v3.public.json'],topic_sha256:hash(JSON.stringify(sets)),date:'2026-09-08',note:'기존 전체계획 baseline 해시는 보존; 이번 수정시점 별도기록'};write(manifestPath,manifest);
console.log(JSON.stringify({scope:report.scope,live_calls:runs.length,final_cases:effective.length,unresolved:unresolved.map(r=>r.id),deployment}));
