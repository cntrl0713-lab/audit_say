import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildSourceCatalog} from '../../../questionSourceCatalog.mjs';
const D='cpa_uploader/drafts/case-deepening-2026-09-14';
const raw='cpa_uploader/raw/originals/case-deepening-2026-09-14';
const hash=x=>createHash('sha256').update(x).digest('hex');
const rows=JSON.parse(fs.readFileSync(D+'/a/sources/official-request.json'));
const groups=Map.groupBy(rows,x=>x.standard);
const records=[];
for(const [standard,units] of groups){
  const chunks=[`# ${standard} — 한국공인회계사회 2026 공개 전문의 직접 발췌`];
  for(const unit of units){
    const bytes=fs.readFileSync(unit.source_file);
    assert.equal(hash(bytes),unit.source_sha256);
    const lines=bytes.toString('utf8').split(/\r?\n/);
    const quote=unit.ranges.flatMap(([a,b])=>lines.slice(a-1,b)).join('\n');
    assert.equal(hash(quote),unit.quote_sha256);
    assert.equal(quote,unit.quote);
    let footnote='';
    if(standard==='KGA 260'&&unit.paragraph==='A52'){
      const index=lines.findIndex((s,i)=>i>=7819&&i<7830&&s.startsWith('14 '));
      assert(index>=0); footnote='\n'+lines[index];
    }
    chunks.push(`## ${standard} 문단 ${unit.paragraph} · 원PDF ${unit.pdf_pages}쪽\n\n${quote}${footnote}`);
  }
  const fileName=`case-deepening-2026-09-14-${standard.toLowerCase().replace(' ','')}.md`;
  const original=raw+'/'+fileName;
  const registered='cpa_uploader/data/official/'+fileName;
  const content=chunks.join('\n\n')+'\n';
  fs.writeFileSync(original,content,{flag:'wx'});
  fs.copyFileSync(original,registered,fs.constants.COPYFILE_EXCL);
  records.push({standard,original_path:original,registered_path:registered,sha256:hash(content),units});
}
fs.writeFileSync(raw+'/official-a-registration.json',JSON.stringify({version:1,registered_at:new Date().toISOString(),reviewer:'root agent',human_review:false,visual_pdf_pages:[101,102,172,173,187,188,350,351],transformation:'원문 글자와 줄을 보존하여 문단 본문만 연결. 문단 사이 페이지 머리말·쪽수와 다른 문단 각주를 제외하고 260.A52의 각주14는 원문과 함께 보존. 탐색용 제목 추가.',records},null,2)+'\n',{flag:'wx'});
const catalog=buildSourceCatalog();
fs.writeFileSync(D+'/source-catalog-final.json',JSON.stringify(catalog,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(catalog.units.filter(u=>records.some(r=>r.registered_path===u.file)).map(u=>({id:u.id,file:u.file,paragraph:u.paragraph,standard:u.standard,lineStart:u.lineStart,lineEnd:u.lineEnd,contentHash:u.contentHash})),null,2));
