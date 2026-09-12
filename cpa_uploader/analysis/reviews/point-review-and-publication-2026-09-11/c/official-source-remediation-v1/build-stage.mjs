import fs from 'node:fs';
import {createHash} from 'node:crypto';
const D='cpa_uploader/analysis/reviews/point-review-and-publication-2026-09-11';
const out=`${D}/c/official-source-remediation-v1`;
const source='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025-pymupdf-pages.txt';
const pdf='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf';
const sha=x=>createHash('sha256').update(x).digest('hex');
const original=fs.readFileSync(source,'utf8');
const definitions=[
 ['230','7',94398,'수행한 감사절차와 입수한 감사증거의 문서화'],
 ['230','8',94487,null],['230','15',95929,null],
 ['240','27',116822,null],['240','28',117101,'부정으로 인한 중요왜곡표시위험의 평가내용에 대한 대응'],
 ['240','33',118383,null],['240','42',121907,null],['240','48',123461,'적용 및 기타 설명자료'],
 ['260','7',187800,'시행일'],['265','9',217938,null],['265','11',218407,'적용 및 기타 설명자료'],
 ['300','6',231943,'계획수립 활동'],['300','12',233347,'초도감사 시 추가적인 고려사항'],['300','A10',236292,'소규모기업에 특유한 고려사항'],
 ['320','13',386711,'문서화'],['320','14',386904,'적용 및 기타 설명자료'],
];
const boundaries=[...original.matchAll(/^A?\d+\.\s*/gm)].map(m=>m.index);
const pageAt=at=>Number([...original.slice(0,at).matchAll(/## PDF page (\d+)/gi)].at(-1)[1]);
const extracts=definitions.map(([standard,paragraph,start,tail])=>{
 let end=boundaries.find(n=>n>start);let quote=original.slice(start,end);
 if(tail){const i=quote.indexOf(tail);if(i<0)throw Error('Tail not found: '+standard+'.'+paragraph);quote=quote.slice(0,i);}
 quote=quote.trimEnd();end=start+quote.length;
 if(!quote.startsWith(paragraph+'.')||!original.includes(quote))throw Error('Extraction boundary');
 return {standard:'KGA '+standard,paragraph,source_file:source,original_start_offset:start,original_end_offset_exclusive:end,original_start_line:original.slice(0,start).split('\n').length,original_end_line:original.slice(0,end).split('\n').length,pdf_pages:[pageAt(start),pageAt(end)],quote,quote_sha256:sha(quote)};
});
let content=[
 '# 공식 전사 보존 사본 — 기존04~06 출처 보완',
 '출처: 한국공인회계사회 회계감사기준 전문 2025년 11월 개정',
 '공식 URL: https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11762493343340&fileSeq=7&subId=sub06',
 `출처 PDF: ${pdf}`,`출처 PDF SHA-256: ${sha(fs.readFileSync(pdf))}`,
 `출처 추출본: ${source}`,`출처 추출본 SHA-256: ${sha(fs.readFileSync(source))}`,
 '출처 범위: 각 KGA 제목 아래 PDF 물리쪽수와 문단을 표시한다. 각 발췌는 위 추출본의 연속 부분문자열 그대로이며 각주 번호·쪽머리·교차 페이지 표지를 보존했다.',
 '적용 가정: 2027 CPA 대비, 기본 2026-01-01 개시 보고기간. 기존 edition-policy.md의 종전 체계와 최종 시험 판본 미지정 한계를 유지한다. 이 사본은 새 시행일 판단이 아니다.',
 '원문 주의: 230.8(a)에 있는 도입부 반복, 240.27의 문단47 교차참조는 공식 2025 추출본대로 보존한다. 240.48의 문서화 요구를 임의 재번호화하지 않는다.',
 ''
].join('\r\n');
for(const e of extracts){content+=`\r\n## ${e.standard}: 공식 2025 전문 문단 ${e.paragraph}\r\n\r\n## PDF page ${e.pdf_pages[0]}\r\n\r\n`+e.quote+'\r\n';}
fs.mkdirSync(out,{recursive:true});const staged_file=`${out}/point-review-c-source-followup-2026-09-11.staged.txt`;
fs.writeFileSync(staged_file,content);
for(const e of extracts){let start=content.indexOf(e.quote);e.staged_start_line=content.slice(0,start).split('\n').length;e.staged_end_line=content.slice(0,start+e.quote.length).split('\n').length;}
const record={version:1,staged_file,target_file:'cpa_uploader/data/official/point-review-c-source-followup-2026-09-11.txt',sha256:sha(content),source_file:source,source_sha256:sha(fs.readFileSync(source)),source_pdf:pdf,pdf_sha256:sha(fs.readFileSync(pdf)),extracts,original_source_modified:false,model_api_calls:0};
fs.writeFileSync(`${out}/stage-evidence.json`,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({staged_file,sha256:record.sha256,paragraphs:extracts.length,physical_pages:[...new Set(extracts.flatMap(e=>Array.from({length:e.pdf_pages[1]-e.pdf_pages[0]+1},(_,i)=>e.pdf_pages[0]+i)))].sort((a,b)=>a-b)},null,2));
