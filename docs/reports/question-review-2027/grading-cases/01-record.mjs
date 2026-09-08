import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='docs/reports/question-review-2027',dir=`${root}/grading-cases`;
const file='cpa_uploader/data/cpa_question_sets_v3.authoring.json';
const text=fs.readFileSync(file,'utf8'),bank=JSON.parse(text),sets=bank.filter(s=>s.classification.topic_id==='01');
const cases=JSON.parse(fs.readFileSync(`${dir}/01-cases.json`));
const live=fs.readFileSync(`${dir}/01-live.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const location=(s,needle)=>({file,line:text.slice(0,text.indexOf(needle,text.indexOf(`"id": "${s.id}"`))).split('\n').length});
const policy={date:'2026-09-08',implicit_conclusion:'accepted_if_required_action_makes_conclusion_clear',user_reply:'요구 조치에서 결론이 분명하면 인정',repeat_experience:'awaiting_user_reply'};
const reassessment=live.map(r=>{
 const c=cases.find(c=>c.id===r.id),differences=[];
 for(const q of c.expected.subquestions)for(const v of q.verdicts){const actual=r.result?.subquestions.find(x=>x.subquestion_id===q.subquestion_id)?.criteria.find(x=>x.criterion_id===v.criterion_id);if(actual?.verdict!==v.verdict)differences.push({subquestion:q.subquestion_id,criterion:v.criterion_id,expected:v.verdict,actual:actual?.verdict});}
 if(r.result?.score!==c.expected_score)differences.push({expected_score:c.expected_score,actual_score:r.result?.score});
 return{id:r.id,attempt:r.attempt,expected_score:c.expected_score,actual_score:r.result?.score,differences,original_execution_differences:r.differences};
});
fs.writeFileSync(`${dir}/01-live-policy-reassessment.json`,JSON.stringify({policy,method:'저장된 실측 결과를 확정 정책으로 재판정. 추가 모델 호출 없음.',records:reassessment},null,2)+'\n');
const official='https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06';
const sources=[
 {id:'KGA220-effective-2026',title:'회계감사기준 전문(2025 개정)의 감사기준서220',url:official,local_file:'sources/kga-2025.pdf',publication_date:'2025-11-07',effective_date:'2026-01-01',effective_condition:'이후 개시하는 보고기간의 재무제표에 대한 감사',paragraphs:['5','7(b)','9-14','18','22','A28'],pages:'53-69',exam_2027:'same_as_2026_assumed; explicit edition designation not found'},
 {id:'KGA220-revised-2026',title:'감사기준서220(2026년 개정)',url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786003927937&fileSeq=2&subId=sub06',local_file:'sources/kga220-2026.pdf',publication_date:'2026-08-06',approval_date:'2026-07-31',effective_date:null,effective_by_firm:[{category:'주권상장법인 감사인으로 등록한 회계법인',reporting_period_beginning_on_or_after:'2027-12-31'},{category:'그 외 회계법인 및 감사반',reporting_period_beginning_on_or_after:'2029-12-31'}],paragraphs:['10'],pages:'5-6',exam_2027:'no immediate substitution inferred from publication date'},
 {id:'KGA220-amendment-overview',title:'품질관리기준 및 관련 감사기준서 개정 개요',url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786003927937&fileSeq=1&subId=sub06',local_file:'sources/kga220-notice.pdf',publication_date:'2026-08-06',approval_date:'2026-07-31',paragraphs:['1-5'],pages:'3'},
 {id:'FSC-exam-2027',title:'2027년도 제62회 공인회계사시험 출제범위 사전예고 공고',url:'https://www.fsc.go.kr/no010104/86803',attachment_url:'https://www.fsc.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=86803&fileTy=ATTACH&fileNo=2',local_file:'sources/fsc-2027-scope.pdf',publication_date:'2026-04-28',document_date:'2026-04-29',pages:'8',exam_2027:'topic scope confirmed; no 220 edition specified in attachment'}
].map(s=>({...s,checked_date:'2026-09-08',sha256:hash(`${root}/${s.local_file}`),affected_topics:['01'],affected_sets:sets.map(s=>s.id)}));
fs.writeFileSync(`${root}/standards-register.json`,JSON.stringify({target_exam_year:2027,coverage:'topic01 only',sources},null,2)+'\n');
const configs={
 'pilot-01-001/sub1':{paragraphs:['7(b)','19','A24-A28'],pages:[55,58,66],map:['7(b): definition','7(b): timing','7(b): listed entity','7(b): firm-determined audit'],review:'정의·시점·두 대상 범주를 네 명제로 정확히 분해. 저장 모범답안 만점. 문법과 공통 사실의 임의성 표현 교정.',issues:['01-C01','01-E01']},
 'pilot-01-001/sub2':{paragraphs:['A28'],pages:[66],map:['A28: responsibility not reduced'],review:'책임 불경감 결론 하나를 요구하며 설명 근거를 숨겨서 요구하지 않음. 문장·정답·채점 대응 이상 없음.',issues:[]},
 'pilot-01-002/sub1':{paragraphs:['9','10','A4-A5'],pages:[56,61],map:['9','10: consultation','10: appropriate action'],review:'관찰·질문·주의의 지속 시점과 위반 징후 이후 자문·조치 결정이 일치. 반복 표현만 교정. 자문과 결정은 독립 행위.',issues:['01-C01','01-E01']},
 'pilot-01-002/sub2':{paragraphs:['11(a)-(c)','A5-A7'],pages:[56,57,61,62],map:['11(a)','11(b)','11(c): safeguards','11(c): conditional withdrawal','11(c): prompt reporting'],review:'5개 요구에 근거 있음. 해지의 적합성·법규상 가능 및 미해결시 신속 보고 조건 보존. 모범답안의 대안 관계 접속어 교정.',issues:['01-E01']},
 'pilot-01-003/sub1':{paragraphs:['18(a)-(d)','A22-A23'],pages:[58,65],map:['18(a)','18(b)','18(c): nature','18(c): scope','18(c): conclusion','18(d)'],review:'네 사항과 여섯 채점기준은 일치한다. 세 번째 사항을 세 독립 측면으로 평가. 순서 강요 없음. 초과 답안 처리 결함 실측.',issues:['01-C01','01-C02']},
 'pilot-01-003/sub2':{paragraphs:['22'],pages:[59],map:['22'],review:'법인 정책·절차에 따른 의견차이 처리·해결 원칙을 묻고 그대로 평가. 문장·정답·출처 대응 이상 없음.',issues:[]},
 'pilot-01-004/sub1':{paragraphs:['13','A10'],pages:[57,62],map:['13: communication obligation and inferred conclusion','13: purpose and urgency'],review:'현행 claim과 critical_facts의 결론 요구 불일치. 사용자 확정 정책상 조치에서 결론이 분명하면 인정. 실측 세 번 중 한 번 부당 감점. 목적·시급성은 함께 충족해야 하며 partial 없음.',issues:['01-D01','01-D03','01-E01']},
 'pilot-01-004/sub2':{paragraphs:['14','14(a)','14(b)','A11-A13'],pages:[57,62,63],map:['14+14(a)','14+14(b)'],review:'정답 두 수행능력은 기준에 있으나 src2는14(b)만 포함. 총체적 적격성·역량 전제와 전문가 범위 명확화 필요. 순서 요구 근거 없음.',issues:['01-D02','01-D03']}
};
const issueSpecs=[
 ['01-C01','P1','독립 명제의 동일 인용 감점','lib/questionV3.ts',276,'same-quote-independent','기대2점, 모의1점; 실제 모델은 인용을 나누어2점','문자열 동일성만으로 감점하지 않고 명제 중복을 구별'],
 ['01-C02','P1','초과 열거 항목의 득점','lib/questionV3Grading.ts',237,'fifth-entry-overflow','crit6 기대not_met, 실제3회 모두met; 총점5/6/6','코드에서 허용 항목 범위를 결정하고 그 범위만 채점·인용 검증'],
 ['01-D01','P1','함축된 결론의 불안정 판정',file,location(sets[3],'"claim": "정보를 자체').line,'pilot-01-004-omission','사용자 정책상 sub1 기대2점; 실제2/1/2점','조치에서 분명한 결론은 인정하도록 claim·critical_facts·발문을 정합화'],
 ['01-C03','P2','입력 한도 불일치','app/quiz/QuizClient.tsx',212,null,'화면20000, 서버5000; 5001자 거절 재현','세 경계의 공통 한도 상수 및 사용자 안내'],
 ['01-C04','P2','프로필 실패가 채점 결과를 가림','app/quiz/QuizClient.tsx',65,null,'채점 성공→refreshProfile 실패→solving; 8개 시나리오 재현','채점 결과 유지, 프로필 갱신 오류 분리'],
 ['01-C05','P2','보안 감점 사유의 결과 전달 누락','lib/questionV3Grading.ts',110,null,'개별 보안 감점시 반환 전역security_flag는none; UI에서 사유 미표시','개별 상태와 사용자용 사유 전달·표시'],
 ['01-D02','P2','업무팀 배정 첫 정답의 source_quote 누락',file,location(sets[3],'"id": "src2"').line,null,'src2가14(b)만 인용하여crit3을 뒷받침하지 못함','src2·req2를14 본문과(a)(b)로 확장; 총체성 명시'],
 ['01-D03','P2','근거 없는 순서·불완전 검증 메타데이터',file,location(sets[3],'"ordered": true').line,'reverse-order','역순 정답2점; ordered=true 근거 없음; content_hash 자리표시자','ordered=false; 실제 해시·검토상태 갱신'],
 ['01-E01','P2/P3','문장과 대안 관계·UI 용어 교정',file,location(sets[1],'"model_answer"').line,null,'002/sub2의 또는 관계, 001의 문법, 장문 및 UI 구현 용어','01.md 교정표의 정확한 문안 적용, 원문 인용은 보존']
];
const issues=issueSpecs.map(([id,priority,title,file,line,case_id,actual,fix])=>({id,priority,title,location:{file,line},case_id,actual,proposed_fix:fix,status:'open',applied:false,exam_2027:'2026-effective-baseline; same2027_assumed',affected_questions:Object.entries(configs).filter(([,c])=>c.issues.includes(id)||id.startsWith('01-C0')&&['01-C03','01-C04','01-C05'].includes(id)).map(([k])=>k)}));
const records=sets.flatMap(s=>s.subquestions.map(q=>{
 const key=`${s.id}/${q.id}`,c=configs[key];
 return{key,set_id:s.id,subquestion_id:q.id,location:location(s,'"prompt": '+JSON.stringify(q.prompt)),status:'review_record_complete_with_open_issues',suitable_for_2027:false,basis_status:'2026_confirmed_2027_assumed',source_register_id:'KGA220-effective-2026',paragraphs:c.paragraphs,pdf_pages:c.pages,prompt:q.prompt,model_answer:q.model_answer,review:c.review,issues:[...c.issues,'01-C03','01-C04','01-C05'],sentence_review:{prompt:'전문 읽기 완료; 구체적 수정안은01.md 교정표, 없으면 이상 없음',model_answer:'전문 읽기·출처 대조·실모델 원문 만점 확인',hidden_answer_or_dependency:'다른 물음의 정답 의존·직접 노출 발견 없음'},criteria:q.criteria.map((v,i)=>({id:v.id,key:`${key}/${v.id}`,requirement_id:v.requirement_id,source_ref_ids:v.source_ref_ids,location:location(s,'"claim": '+JSON.stringify(v.claim)),claim:v.claim,scores:v.scores,official_paragraph:c.map[i],source_verdict:key==='pilot-01-004/sub2'&&i===0?'official_basis_found_but_attached_quote_missing':'official_basis_matches',partial_allowed:false,positive_case:`${s.id}-full`,failure_case:`${s.id}-contrary`,partial_boundary:'01-boundaries.json',review_status:'reviewed'})),basic_cases:['full','paraphrase','omission','contrary','empty'].map(t=>`${s.id}-${t}`),bank_answer_case:`${s.id}-bank-model-answer`,ui:{widths:[1440,390],solving_and_result_checked:true,auth_database:'mocked; live E2E not performed'}};
}));
assert.equal(records.length,8);assert.equal(records.flatMap(q=>q.criteria).length,24);
const report={topic:'01',review_date:'2026-09-08',target_year:2027,review_record_complete:true,suitable_for_2027:false,counts:{sets:4,questions:8,criteria:24},policy,records,issues,live_summary:{unique_cases:new Set(live.map(r=>r.id)).size,calls:live.length,errors:live.filter(r=>r.error).length,current_policy_mismatching_runs:reassessment.filter(r=>r.differences.length).length,models:[...new Set(live.flatMap(r=>r.requests.map(p=>p.model)))],total_tokens:live.reduce((n,r)=>n+r.responses.reduce((s,x)=>s+(x.body.usage?.total_tokens||0),0),0)},unverified:['2027 시험의 220 판본 지정','실제 인증·운영DB/RPC·전체 라우트 E2E','배포환경 시간초과 및 실제DB 동시성'],product_files_changed:false};
fs.writeFileSync(`${root}/01.json`,JSON.stringify(report,null,2)+'\n');
const manifestFile='docs/plans/2027-question-review/manifest.json',manifest=JSON.parse(fs.readFileSync(manifestFile));
manifest.status='partially_reviewed';const topic=manifest.topics.find(t=>t.id==='01');topic.status='review_record_complete_with_open_issues';topic.report='../../reports/question-review-2027/01.md';topic.suitable_for_2027=false;
for(const s of topic.question_sets)for(const q of s.subquestions){assert.ok(records.some(r=>r.key===q.key));q.status='review_record_complete_with_open_issues';}
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({records:records.length,criteria:24,issues:issues.length,live:report.live_summary}));
