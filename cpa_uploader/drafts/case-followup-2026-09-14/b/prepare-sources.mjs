import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const hash = value => createHash('sha256').update(value).digest('hex');
const original = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const pdf = 'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-full.pdf';
const bytes = fs.readFileSync(original);
const lines = bytes.toString('utf8').match(/[^\n]*\n|[^\n]+$/g);
const spans = [
  { paragraphs: '10', page: 474, ranges: [[20077,20080]] },
  { paragraphs: '14', page: 476, ranges: [[20181,20186]] },
  { paragraphs: 'A55-A60', page: '500-501', ranges: [[21215,21270],[21280,21280]] },
  { paragraphs: '32', page: 481, ranges: [[20414,20419]] },
  { paragraphs: 'A133-A136', page: '521-522', ranges: [[22093,22100],[22108,22127]] },
];
const url = 'https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo=11786004332051&fileSeq=1&subId=sub06';
const header = `확인일: 2026-09-14. 한국공인회계사회 2026 회계감사기준 전문의 직접 발췌.\n공식 URL: ${url}\n판본: 2026 전문; 540.10의 2026-01-01 이후 개시 보고기간을 적용한다. 조기적용 문장의 원문 오탈자(2025년 1일 1일)는 교정하지 않았다.\n원문 파일: ${original}\n원문 파일 SHA-256: ${hash(bytes)}\n원본 PDF: ${pdf}\n원본 PDF SHA-256: ${hash(fs.readFileSync(pdf))}\n추출 방법: 보존된 PyMuPDF 추출본의 지정 행을 원래 줄바꿈·공백 그대로 발췌하였다. 제목과 PDF 페이지 표시는 작성자 위치 색인이다. A58 중간 페이지 머리말을 유지했다. A60의 각주39는 소유 문단에 포함했다. A134 중간의 페이지 머리말과 A132 소유 각주55는 제외하고 두 연속 발췌를 연결했다. 전체 원문은 provenance의 source_line_ranges로 역추적한다.\n\n# KGA 540: 회계추정치와 관련 공시에 대한 감사\n\n## 직접 문단 발췌\n\n`;
let text = header;
for (const span of spans) {
  text += `### 원문 문단 ${span.paragraphs}\n\n## PDF page ${String(span.page).split('-')[0]}\n\n`;
  span.source_line_ranges = span.ranges.map(([start,end]) => ({start,end,quote_sha256:hash(lines.slice(start-1,end).join(''))}));
  text += span.ranges.map(([start,end])=>lines.slice(start-1,end).join('')).join('\n') + '\n';
}
const targets = ['cpa_uploader/raw/originals/case-followup-2026-09-14/kga-540-retrospective.md','cpa_uploader/drafts/case-followup-2026-09-14/b/sources/kga-540-retrospective.md','cpa_uploader/data/official/case-followup-2026-09-14-kga540.md'];
for (const file of targets) { fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(file,text,{flag:'wx'}); }
const provenance = {version:1,confirmed_at:new Date().toISOString(),official_url:url,document:'회계감사기준 2026 전문',authority:'official_transcription',edition:'2026 전문; 540.10 2026-01-01 이후 개시 보고기간',original_file:original,original_sha256:hash(bytes),pdf_file:pdf,pdf_sha256:hash(fs.readFileSync(pdf)),transcription_sha256:hash(text),copies:targets,spans,footnotes:[{number:'38',owner:'A57',reference:'KGA 240.32(b)(ii)'},{number:'39',owner:'A60',reference:'KGA 560.14'}],excluded_footnotes:[{number:'55',owner:'A132',reason:'A134 문단 사이에 놓인 페이지 각주로 A134의 근거가 아님'}],manual_source_review:'540.14의 당기 위험평가 목적과 당시 이용가능 정보에 근거한 적합 판단의 비소급성, A55의 재추정 허용 및 A60의 기존 정보 누락 예외, 32/A133-A136의 편의징후와 확정 왜곡표시 구별을 읽어 확인하였다.',human_review_performed:false};
fs.writeFileSync('cpa_uploader/drafts/case-followup-2026-09-14/b/sources/provenance.json',JSON.stringify(provenance,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({files:targets,sha256:hash(text)}));
