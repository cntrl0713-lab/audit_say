import fs from 'node:fs';
import crypto from 'node:crypto';
const path='docs/reports/question-review-2027/standards-register.json';
const data=fs.existsSync(path)?JSON.parse(fs.readFileSync(path)):{target_exam_year:2027,sources:[]};
const sets=['pilot-03-001','pilot-03-002','pilot-03-003','pilot-03-004'];
const common={checked_date:'2026-09-08',affected_topics:['03'],affected_sets:sets};
const paragraphs=['2','6(a)','6(b)(i)-(iii)','7','8(a)(b)','11','13','14','16','19','20','A11','A14','A30-A33'];
const additions=[
 {id:'KGA210-effective-2026',title:'회계감사기준 전문(2025 개정)의 감사기준서210',url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',local_file:'sources/kga-2025.pdf',publication_date:'2025-11-07',effective_date:'2026-01-01',effective_condition:'이후 개시하는 보고기간의 재무제표에 대한 감사',paragraphs,pages:'33-47',exam_2027:'same_as_2026_assumed; explicit edition designation not found',sha256:'b6b3a965c25cdb5bfdc0bf54838ae1bcc642581eef2d2d9e306a67ac811b0989'},
 {id:'KGA210-2026-compared',title:'회계감사기준 전문(2026년7월 개정)의 감사기준서210 대조',url:'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06',local_file:'sources/03-kga-2026.pdf',publication_date:'2026-08-06',approval_date:'2026-07-31',paragraphs,pages:'33-47',effective_date:'2026-01-01',effective_condition:'210 문단2. 개정220 및210 A1의 연계 개정 시행과 구별',exam_2027:'selected question paragraphs unchanged; no immediate substitution from publication',sha256:'59020bf1eba001c1fd0612f3af1098dbef4ca11dc22777b7266c80d39a615f84',comparison:{pages_33_to_52_equal_after_whitespace_and_page_number_removal:[33,34,35,36,39,40,41,42,43,44,45,46,47,48,49,50,51,52],changed_pages:[37,38],change_note:'A1 및220/품질관리기준서 연결 각주. 대상 요구사항·A11/A14/A31 의미 동일.',new_220_effective_by_firm:[{category:'등록 회계법인',period_beginning_on_or_after:'2027-12-31'},{category:'그 외 회계법인·감사반',period_beginning_on_or_after:'2029-12-31'}]}},
 {id:'FSC-exam-2027-topic03',title:'2027년도 제62회 공인회계사시험 출제범위 사전예고 공고 / 감사수임·감사계약',url:'https://www.fsc.go.kr/no010104/86803',attachment_url:'https://www.fsc.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=86803&fileTy=ATTACH&fileNo=1',local_file:'sources/03-fsc-2027-scope.hwpx',publication_date:'2026-04-28',document_date:'2026-04-29',paragraphs:['제2차시험 다. 회계감사 분야2'],effective_date:null,exam_2027:'scope_confirmed; no KGA210 edition designation in attachment',sha256:crypto.createHash('sha256').update(fs.readFileSync('docs/reports/question-review-2027/sources/03-fsc-2027-scope.hwpx')).digest('hex')},
 {id:'FSC-exam-2027-plan-pending-topic03',title:'2026년도 제61회 공인회계사시험 최종 합격자 발표 중 2027 시행계획 예고',url:'https://www.fsc.go.kr/no010101/87628',publication_date:'2026-09-01',paragraphs:['2027년도 공인회계사시험 시행계획 공고 예정 문단'],effective_date:null,exam_2027:'final implementation plan announced for November2026; recheck before final fitness decision'}
 ].map(s=>({...s,...common}));
for(const source of additions){const i=data.sources.findIndex(s=>s.id===source.id);if(i<0)data.sources.push(source);else data.sources[i]=source;}
data.coverage='topics '+[...new Set(data.sources.flatMap(s=>s.affected_topics||[]))].sort().join(', ');
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({added_ids:additions.map(s=>s.id),coverage:data.coverage}));
