import fs from 'node:fs';
import { createHash } from 'node:crypto';
const sha = x => createHash('sha256').update(x).digest('hex');
const original='cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2026-pymupdf-pages.txt';
const originalBytes=fs.readFileSync(original);
const lines=originalBytes.toString('utf8').match(/[^\n]*\n|[^\n]+$/g);
const range=(a,b)=>lines.slice(a-1,b).join('');
const sections=[
  {paragraph:'10',page:474,ranges:[[20077,20080]]},
  {paragraph:'14',page:476,ranges:[[20181,20186]]},
  {paragraph:'A55-A57',page:500,ranges:[[21215,21237],[21241,21241]]},
  {paragraph:'A58',page:500,ranges:[[21238,21239],[21247,21251]],page_between:501},
  {paragraph:'A59-A60',page:501,ranges:[[21252,21270],[21280,21280]]},
  {paragraph:'32',page:481,ranges:[[20414,20419]]},
  {paragraph:'A133-A136',page:521,ranges:[[22093,22100],[22108,22127],[22140,22140]],page_between:522},
];
const v1='cpa_uploader/raw/originals/case-followup-2026-09-14/kga-540-retrospective.md';
const v1text=fs.readFileSync(v1,'utf8');
let text=v1text.slice(0,v1text.indexOf('# KGA 540:'));
text+='전사 v2: v1의 원문 어구를 유지하고 PDF PAGE 위치표시를 카탈로그 형식으로 교정했다. A58 사이 각주38은 실제 소유 문단 A57 말미로 이동하였다. A136의 각주56을 원문에서 추가 보존하였다. 페이지 머리말을 제거한 fragment 모음이며 전문 전체의 무변형 사본이 아니다.\n\n# KGA 540: 회계추정치와 관련 공시에 대한 감사\n\n## 직접 문단 발췌\n\n';
for(const s of sections){
  text+=`PDF PAGE ${s.page}\n\n`;
  s.ranges.forEach(([a,b],i)=>{if(i===1&&s.page_between)text+=`\nPDF PAGE ${s.page_between}\n\n`;text+=range(a,b)+'\n';});
}
const copies=['cpa_uploader/raw/originals/case-followup-2026-09-14/kga-540-retrospective-v2.md','cpa_uploader/drafts/case-followup-2026-09-14/b/sources/kga-540-retrospective-v2.md'];
for(const file of copies)fs.writeFileSync(file,text,{flag:'wx'});
fs.writeFileSync('cpa_uploader/data/official/case-followup-2026-09-14-kga540.md',text);
const previous=JSON.parse(fs.readFileSync('cpa_uploader/drafts/case-followup-2026-09-14/b/sources/provenance.json','utf8'));
const provenance={...previous,version:2,confirmed_at:new Date().toISOString(),previous_transcription:{file:v1,sha256:sha(v1text)},transcription_sha256:sha(text),copies:[...copies,'cpa_uploader/data/official/case-followup-2026-09-14-kga540.md'],spans:sections.map(s=>({...s,source_line_ranges:s.ranges.map(([start,end])=>({start,end,quote_sha256:sha(range(start,end))}))})),footnotes:[{number:'38',owner:'A57',reference:'KGA 240.32(b)(ii)',transformation:'A58 중간에서 A57 말미로 이동'},{number:'39',owner:'A60',reference:'KGA 560.14'},{number:'56',owner:'A136',reference:'KGA 240.33(b)',transformation:'원문 L22140에서 추가 발췌. 원문 문단번호를 임의 교정하지 않음'}],transformations:['작성자 위치표시 PDF PAGE 대문자 규약 사용','A58 내 500/501 및 A134 내 521/522의 실제 페이지 경계 표시','문단 본체의 어구·공백·줄바꿈은 범위별 exact; 범위 사이 위치표시·소유 각주 배치는 작성자 전사 편집']};
fs.writeFileSync('cpa_uploader/drafts/case-followup-2026-09-14/b/sources/provenance-v2.json',JSON.stringify(provenance,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha256:sha(text),files:provenance.copies}));
