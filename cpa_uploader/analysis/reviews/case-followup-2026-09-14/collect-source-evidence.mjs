import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const D='cpa_uploader/drafts/case-followup-2026-09-14',R='cpa_uploader/analysis/reviews/case-followup-2026-09-14';
const read=f=>JSON.parse(fs.readFileSync(f));
const hash=b=>createHash('sha256').update(b).digest('hex');
const ref=f=>({file:f,sha256:hash(fs.readFileSync(f))});
const write=(f,x)=>fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const p=read(D+'/b/sources/provenance-v2.json');
assert.equal(ref(p.original_file).sha256,p.original_sha256);assert.equal(ref(p.pdf_file).sha256,p.pdf_sha256);
for(const f of p.copies)assert.equal(ref(f).sha256,p.transcription_sha256);
const lines=fs.readFileSync(p.original_file,'utf8').match(/[^\n]*\n|[^\n]+$/gu);
for(const span of p.spans)for(const range of span.source_line_ranges){
 assert.equal(hash(lines.slice(range.start-1,range.end).join('')),range.quote_sha256,'Source fragment changed');
}
const learning='cpa_uploader/data/회계감사_통합학습자료';
const items=[
 ...p.copies.map(original_path=>({original_path,category:'official',role:'2026 KGA 540 직접 발췌·위치 및 각주 소유를 확인한 등록 전사'})),
 {original_path:'cpa_uploader/raw/originals/case-followup-2026-09-14/kga-540-retrospective.md',category:'verification',role:'페이지 표시 보완 전 발췌 v1 보존본; 최종 제작 근거는 v2'},
 ...['provenance.json','provenance-v2.json'].map(name=>({original_path:D+'/b/sources/'+name,category:'verification',role:'발췌 판본별 원문 행·페이지·파일 해시와 변환 계보'})),
 {original_path:p.original_file,category:'verification',role:'기존 공식 2026 전문 PyMuPDF 추출본 재사용'},
 {original_path:p.pdf_file,category:'verification',role:'기존 공식 2026 전문 PDF 재사용'},
 {original_path:'cpa_uploader/raw/originals/case-additional-2026-09-14/kicpa-audit-standards-index.html',category:'verification',role:'같은 날짜에 확인·보존한 공식 감사기준 게시목록 재사용; 2026 전문 공고 확인'},
 {original_path:learning+'/03_문제연습/고급_회계감사_연습.md',category:'learning',role:'고급회계감사연습 원발문·해설; 공식 기준 대체물 아님'},
 ...['A','B'].map(part=>({original_path:learning+'/04_기출문제/기출문제_연도별_해설_'+part+'.md',category:'learning',role:'실제 기출 원발문·해설과 출제조건 비교'})),
];
write(R+'/source-inventory.json',{version:1,created_at:new Date().toISOString(),entries:items.map(item=>({...item,sha256:ref(item.original_path).sha256}))});
write(R+'/source-fragments-check.json',{checked_at:new Date().toISOString(),method:'local_byte_and_lineage_check',content_review_separate:true,provenance:ref(D+'/b/sources/provenance-v2.json'),original:ref(p.original_file),pdf:ref(p.pdf_file),registered:ref(p.copies.at(-1)),fragments:p.spans.reduce((n,s)=>n+s.source_line_ranges.length,0),copies_match:true,fragment_hashes_match:true});
console.log({collection_entries:items.length,source_fragments_verified:true});
