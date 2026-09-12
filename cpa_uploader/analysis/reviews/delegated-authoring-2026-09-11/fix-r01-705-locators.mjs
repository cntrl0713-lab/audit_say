import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceCatalog } from '../../../questionSourceCatalog.mjs';

const control='cpa_uploader/analysis/reviews/delegated-authoring-2026-09-11';
const file='cpa_uploader/data/official/delegated-r01-kga-2025.txt';
const bytes=fs.readFileSync(file);
const sha=value=>createHash('sha256').update(value).digest('hex');
if(sha(bytes)!=='42e2d4b62c6946653b50b7d2ce2f4533af08c30b59b0da735ec475b2620dfc76')throw Error('등록본 기준선 변경');
const before=buildSourceCatalog();
let content=bytes.toString('utf8');
for(const [marker,page] of [['[705.src1; PDF 별도 공식 발췌 참조]',743],['[705.src2; PDF 별도 공식 발췌 참조]',744]]){
  if(!content.includes(marker))throw Error('원래 locator 없음');
  content=content.replace(marker,`## PDF PAGE ${page}\n${marker}`);
}
fs.writeFileSync(`${control}/sources/r01-registration-before-705-locators.txt`,bytes,{flag:'wx'});
fs.writeFileSync(file,content);
const after=buildSourceCatalog();
const select=catalog=>catalog.units.filter(unit=>unit.file===file&&unit.standard==='KGA 705').map(({id,paragraph,page,locator})=>({id,paragraph,page,locator}));
fs.writeFileSync(`${control}/source-registration-r01-705-locators.json`,JSON.stringify({created_at:new Date().toISOString(),file,
  before_sha256:sha(bytes),after_sha256:sha(Buffer.from(content)),before:select(before),after:select(after),
  evidence:`${control}/sources/kga705-pages-743-744.txt`,evidence_sha256:sha(fs.readFileSync(`${control}/sources/kga705-pages-743-744.txt`)),
  official_pdf:'cpa_uploader/drafts/frequency-gap-2026-09-10/sources/kga-2025.pdf',
  reason:'705.7은 공식 PDF743쪽, 8~9는744쪽. 앞선570의552쪽을상속하던색인수정. 인용본문보존,기존priority원본불변.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha256:sha(Buffer.from(content)),units:select(after)}));
