import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';
const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const file='cpa_uploader/data/official/delegated-r01-kga-2025.txt';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const before=fs.readFileSync(file);
fs.writeFileSync(`${control}/sources/r01-registration-v1.txt`,before,{flag:'wx'});
let text=before.toString('utf8').replace(/^(\[[^\r\n]+; PDF \[([\d, ]+)\]\])$/gm,(_all,label,pages)=>`## PDF PAGE ${pages.split(',')[0].trim()}\n${label.replace(`PDF [${pages}]`,`PDF ${pages}`)}`);
text=text.replace('## PDF PAGE 439\n[530.appendix2-1;', '## 보론 2 (문단 A11 참조)\n\n## PDF PAGE 439\n[530.appendix2-1;')
  .replace('## PDF PAGE 441\n[530.appendix3-2;', '## 보론 3 (문단 A11 참조)\n\n## PDF PAGE 441\n[530.appendix3-2;');
fs.writeFileSync(file,text);
const units=buildSourceCatalog().units.filter(u=>u.file===file);
const sampling=units.filter(u=>u.standard==='KGA 530');
if(!sampling.length||sampling.some(u=>!u.context.section.includes('보론')))throw Error('530 보론 색인 누락');
fs.writeFileSync(`${control}/source-registration-r01-locators.json`,JSON.stringify({created_at:new Date().toISOString(),file,before_sha256:sha(before),after_sha256:sha(text),reason:'원문 내용 보존, PDF 페이지와 보론 색인을 카탈로그 문법에 맞춤',units:units.map(({id,standard,paragraph,page,locator,context})=>({id,standard,paragraph,page,locator,context}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({units:units.length,sampling:sampling.map(u=>({id:u.id,paragraph:u.paragraph,page:u.page,section:u.context.section}))}));
