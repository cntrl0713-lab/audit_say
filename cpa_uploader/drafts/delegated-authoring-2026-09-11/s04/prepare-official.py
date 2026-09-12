from pathlib import Path
from pypdf import PdfReader
from datetime import datetime, timezone
import re, json, hashlib
base=Path(__file__).resolve().parent
root=base.parents[3]
out=base/'sources';out.mkdir(parents=True,exist_ok=True)
hash=lambda b:hashlib.sha256(b).hexdigest()
norm=lambda s:re.sub(r'\s+','',s)
specs={
 '450':('감사 중 식별된 왜곡표시의 평가',(357,367),(383,393),['3','4','5','6','7','8','9','10','11']+['A'+str(n) for n in range(9,26)]),
 '520':('분석적절차',(423,429),(449,455),['2','3','4','5','6','7']+['A'+str(n) for n in range(1,22)]),
 '530':('감사표본추출',(431,437),(457,463),['3','4','5','15','A21','A22','A23']),
 '580':('서면진술',(574,584),(600,610),[str(n) for n in range(6,21)]+['A'+str(n) for n in range(1,28)]),
}
editions={}
for edition,pdf in [('2025','kga-2025.pdf'),('2026','kga-2026-full.pdf')]:
 file=root/'cpa_uploader/drafts/frequency-gap-2026-09-10/sources'/pdf
 reader=PdfReader(file);entries=[]
 for standard,(title,oldpages,newpages,wanted) in specs.items():
  first,last=oldpages if edition=='2025' else newpages
  lines=[];pages={}
  for page in range(first,last+1):
   raw=reader.pages[page-1].extract_text();pages[str(page)]=raw
   for line in raw.splitlines():
    if re.match(r'^\s*감사기준서 '+standard+r' ',line) or re.match(r'^\s*\d+ / \d+\s*$',line):continue
    lines.append((page,line))
  (out/f'kga{standard}-{edition}-pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  starts=[(i,m.group(1)) for i,(_,line) in enumerate(lines) if (m:=re.match(r'^\s*(A?\d+)\.\s*',line))]
  for para in wanted:
   found=[(j,i) for j,(i,num) in enumerate(starts) if num==para]
   if len(found)!=1:raise ValueError((edition,standard,para,found,[num for _,num in starts]))
   j,i=found[0];end=starts[j+1][0] if j+1<len(starts) else len(lines)
   quote='\n'.join(line for _,line in lines[i:end]).strip()
   entries.append({'standard':'KGA '+standard,'paragraph':para,'pages':sorted(set(p for p,_ in lines[i:end])),'quote':quote,'quote_sha256':hash(quote.encode())})
 url='https://www.kicpa.or.kr/board/fileMngr?cmd=down&boardId=acc0102&bltnNo='+('11762493343340&fileSeq=7' if edition=='2025' else '11786004332051&fileSeq=1')+'&subId=sub06'
 editions[edition]={'pdf_file':str(file.relative_to(root)).replace('\\','/'),'pdf_sha256':hash(file.read_bytes()),'url':url,'entries':entries}
 text=f'확인일: 2026-09-11. 공식 {edition} 전문에서 pypdf 직접 추출. 반복 머리말·꼬리말만 제외, 각주·소제목은 보존.\n공식 URL: {url}\nPDF SHA256: {editions[edition]["pdf_sha256"]}\n기본2026년개시보고기간·2027CPA목표.\n'
 for standard,(title,*_) in specs.items():
  text+='\n# KGA '+standard+': '+title+'\n'
  for e in entries:
   if e['standard']=='KGA '+standard:text+='\n## PDF PAGE '+str(e['pages'][0])+'\n\n'+e['quote']+'\n'
 (out/f'official-excerpts-{edition}.txt').write_text(text,encoding='utf8')
comparisons=[{'standard':a['standard'],'paragraph':a['paragraph'],'same_ignoring_whitespace':norm(a['quote'])==norm(b['quote']),'old_pages':a['pages'],'new_pages':b['pages']} for a,b in zip(editions['2025']['entries'],editions['2026']['entries'])]
(out/'official-comparison.json').write_text(json.dumps({'created_at':datetime.now(timezone.utc).isoformat(),'editions':editions,'comparisons':comparisons},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'paragraphs':len(comparisons),'differences':[c for c in comparisons if not c['same_ignoring_whitespace']]},ensure_ascii=False))
